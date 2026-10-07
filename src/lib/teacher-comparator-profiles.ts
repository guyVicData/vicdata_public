// VicData 0.6.7 B1: the Teacher page's comparator school details, lean. Server-only.
//
// The Teacher page used to read its comparator schools' details from the Data View's
// /api/data-view/academic-schools (fetchAcademicProfiles with includeSubjects): every
// phase's headline, family and subject rows, KS2 facts, KS5 qualification flags and the
// census pages, about 1 MB for ten schools. Of all that, the Teacher page reads only the
// fields below (traced over every Teacher view at both phases, both drawing paths: the
// 0.6.7 report lists them). This builds the same AcademicSchoolProfile shape with those
// fields filled for ONE phase and every other field empty, so every consumer reads exactly
// the values it read before:
//
//   urn, name, easting, northing, establishmentTypeGroup     the schools row
//   ks4Subjects[].subject / period / entriesTotal / avgPointScore            (GCSE)
//   ks5SubjectsByBucket[bucket][].subject / period / entriesTotal / avgPointScore (Post-16)
//
// The schools query is fetchAcademicProfiles' own (same table, same columns, same filter),
// so for the same schools the profiles come back in the same order. The Data View is not
// in this module's graph: it keeps calling academic-schools, unchanged.
import { fetchSubjectHeadlineForSchools, type AcademicSchoolProfile, type AcademicSubjectHeadlineEntry } from "./academic-data-view";
import { createServerAnonSupabaseClient } from "./supabase";

type SchoolRow = { urn: string; current_name: string; town: string | null; easting: number | null; northing: number | null; establishment_type_group: string | null };

// A subject row as the Teacher page reads it. The other fields keep their types, empty.
const leanRow = (r: AcademicSubjectHeadlineEntry): AcademicSubjectHeadlineEntry => ({
  subject: r.subject,
  familyId: "",
  familyLabel: "",
  period: r.period,
  entriesTotal: r.entriesTotal,
  entriesShareOfSchoolPercent: null,
  entriesShareOfFamilyPercent: null,
  avgPointScore: r.avgPointScore,
  pointsCoveragePercent: null,
});

export async function fetchTeacherComparatorProfiles(urns: string[], phase: "ks4" | "ks5"): Promise<AcademicSchoolProfile[]> {
  if (urns.length === 0) return [];
  const supabase = createServerAnonSupabaseClient();
  const [{ data: rows }, subjectsByUrn] = await Promise.all([
    supabase.from("schools").select("urn, current_name, town, easting, northing, establishment_type_group").in("urn", urns),
    // The same subject lookups fetchAcademicProfiles makes, for this phase only.
    phase === "ks4" ? fetchSubjectHeadlineForSchools(urns, "ks4") : fetchSubjectHeadlineForSchools(urns, "ks5", undefined, null),
  ]);
  const byBucket = (urn: string): Record<string, AcademicSubjectHeadlineEntry[]> => {
    const out: Record<string, AcademicSubjectHeadlineEntry[]> = {};
    for (const r of subjectsByUrn.get(urn) ?? []) {
      const b = r.bucket ?? "all";
      if (b === "all") continue;
      (out[b] ??= []).push(leanRow(r));
    }
    return out;
  };
  return ((rows ?? []) as SchoolRow[]).map((row) => ({
    urn: row.urn,
    name: row.current_name,
    town: null,
    easting: row.easting,
    northing: row.northing,
    establishmentTypeGroup: row.establishment_type_group,
    ks5QualTypes: { ib: false, preU: false },
    ks2: [],
    ks4: [],
    ks5: [],
    ks4Families: [],
    ks5Families: [],
    ks5FamiliesByBucket: {},
    ks4Subjects: phase === "ks4" ? (subjectsByUrn.get(row.urn) ?? []).map(leanRow) : [],
    ks5Subjects: [],
    ks5SubjectsByBucket: phase === "ks5" ? byBucket(row.urn) : {},
    ageGenderCounts: new Map(),
    ageGenderCountsByPeriod: new Map(),
  }));
}

/** The schools a set's profiles cover, as the page asks for them: the set's own, sorted,
 * and the school itself (academic-schools added it when missing). */
export function profileUrnsFor(setUrns: string[], anchorUrn: string): string[] {
  const urns = Array.from(new Set(setUrns)).sort();
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);
  return urns;
}
