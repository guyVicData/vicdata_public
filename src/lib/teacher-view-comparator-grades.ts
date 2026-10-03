// Teacher view, Comparisons on a grade threshold: every comparator school's per-grade
// entry counts for one subject (/api/teacher/comparator-grades), so each school's Grade 4+
// / A*-E rate is scored the same way as the school's own. Client-safe.
import type { createBrowserSupabaseClient } from "@/lib/supabase";
import type { KsStage, SubjectGradeCount } from "@/lib/academic-data-view";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// null = the request failed (no session, not staff, a server error): the caller says it
// could not load, rather than that nobody publishes the figure.
export async function fetchComparatorGrades(
  supabase: Supa,
  anchorUrn: string,
  urns: string[],
  stage: KsStage,
  subject: string,
): Promise<Record<string, SubjectGradeCount[]> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const params = new URLSearchParams({ anchorUrn, urns: urns.join(","), stage, subject });
  const res = await fetch(`/api/teacher/comparator-grades?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const body = (await res.json()) as { gradeRowsByUrn?: Record<string, SubjectGradeCount[]> };
  return body.gradeRowsByUrn ?? {};
}

/**
 * R-COMPARATOR-RATE-PER-QUAL, R-GRADE-SCALE-MATCH: each comparator school's rate per year,
 * from its rows for this subject AND this qualification type (a GCSE and a Cambridge
 * National in one subject are scored apart), scored by `rateOf` -- the page's own rate
 * function (gradeRateScorer), so every school is scored exactly as the school itself is.
 * Years with no figure are left out. (Lifted verbatim from ComparisonsPanels in 0.6 S2.)
 */
export function rateSeriesByUrn(
  rowsByUrn: Record<string, SubjectGradeCount[]>,
  subject: string,
  qualificationType: string,
  rateOf: (rows: SubjectGradeCount[]) => number | null,
): Record<string, { period: number; value: number }[]> {
  const out: Record<string, { period: number; value: number }[]> = {};
  for (const [urn, rows] of Object.entries(rowsByUrn)) {
    const mine = rows.filter((g) => g.subject === subject && g.qualificationType === qualificationType);
    out[urn] = Array.from(new Set(mine.map((g) => g.period)))
      .sort((a, b) => a - b)
      .map((period) => ({ period, value: rateOf(mine.filter((g) => g.period === period)) }))
      .filter((r): r is { period: number; value: number } => r.value !== null);
  }
  return out;
}
