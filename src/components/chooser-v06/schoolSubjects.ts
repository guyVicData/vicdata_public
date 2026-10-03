"use client";

// VicData 0.6 integration: the school's own subjects for Add a view's Step 2a / 2b
// (SubjectSource), when the chooser is opened with a school context (the editor with a
// school, a meeting). The same rows the Teacher page's subject picker shows: the
// dashboard route's latest-year entries (shared through the fetch cache), mapped as the
// page maps them (by subject name, the qualification added only where one tab holds the
// same subject twice), with the person's own ticked subjects as "mine".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademicSubjectHeadlineEntry, SubjectEntry } from "@/lib/academic-data-view";
import { cachedFetchJson } from "@/lib/fetch-cache";
import { familyFor } from "@/lib/teacher-view-catalogue";
import { fetchPreferences } from "@/lib/teacher-view-data";
import { subjectItemsOf } from "@/lib/teacher-view-populations";
import { QUALIFICATION_FAMILIES, qualificationFamilyOf } from "@/lib/teacher-view-theme";
import { shortQualificationLabel } from "@/components/data-view/SubjectAreaSection";
import type { SubjectSource } from "./StepScreens";

type Phase = "ks4" | "ks5";

export async function loadSubjectSources(supabase: SupabaseClient, urn: string, phases: Phase[] = ["ks4", "ks5"]): Promise<Partial<Record<Phase, SubjectSource>>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  const out: Partial<Record<Phase, SubjectSource>> = {};
  await Promise.all(
    phases.map(async (ph) => {
      try {
        const res = await cachedFetchJson<{ subjectData?: { entries?: SubjectEntry[] }; headline?: AcademicSubjectHeadlineEntry[] }>(
          `/api/teacher/dashboard?urn=${encodeURIComponent(urn)}&phase=${ph}`,
          { token },
        );
        if (!res.ok || !res.body) return;
        const items = subjectItemsOf(res.body.subjectData?.entries ?? []);
        if (!items.length) return;
        const headline = res.body.headline ?? [];
        const fam = (q: string) => qualificationFamilyOf(ph, q);
        const pickerItems = items.map((i) => ({
          key: i.key,
          label: items.some((o) => o.key !== i.key && o.subject === i.subject && fam(o.qualificationType) === fam(i.qualificationType))
            ? `${i.subject} (${shortQualificationLabel(i.qualificationType)})`
            : i.subject,
          entries: i.entries,
          familyId: fam(i.qualificationType),
          category: familyFor(headline, i.subject),
        }));
        const families = QUALIFICATION_FAMILIES[ph].filter((f) => pickerItems.some((i) => i.familyId === f.id));
        let mine: string[] = [];
        try {
          mine = (await fetchPreferences(supabase, urn, ph)).subjects;
        } catch {
          mine = [];
        }
        out[ph] = { items: pickerItems, families, mine };
      } catch {
        /* the step says so when a phase has no subjects */
      }
    }),
  );
  return out;
}
