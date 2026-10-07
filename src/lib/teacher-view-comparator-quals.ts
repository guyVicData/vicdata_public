// VicData 0.6.5 S3 (R-POINTS-SAME-QUAL): each comparator school's figures for the focus's
// EXACT Post-16 qualification (/api/teacher/comparator-qualifications) -- points and entries
// per year -- so Comparisons and the maps show the same figure as Column 1. Client-safe.
import type { createBrowserSupabaseClient } from "@/lib/supabase";
import type { SchoolSeries } from "@/lib/teacher-view-comparator-series";
import { cachedFetchJson } from "@/lib/fetch-cache";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

export type ComparatorQualificationRow = { period: number; entries: number | null; avgPointScore: number | null };

// null = the request failed (no session, not staff, a server error).
export async function fetchComparatorQualifications(
  supabase: Supa,
  anchorUrn: string,
  urns: string[],
  subject: string,
  qualificationType: string,
): Promise<Record<string, ComparatorQualificationRow[]> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const params = new URLSearchParams({ anchorUrn, urns: [...urns].sort().join(","), subject, qualificationType });
  // Shared across panels and embedded views for 5 minutes (fetch-cache.ts), keyed by the
  // set, the subject and the qualification.
  const res = await cachedFetchJson<{ rowsByUrn?: Record<string, ComparatorQualificationRow[]> }>(`/api/teacher/comparator-qualifications?${params}`, { token });
  if (!res.ok) return null;
  return res.body?.rowsByUrn ?? {};
}

/** One school's exact-qualification rows as the series Comparisons reads (results = points, candidates = entries). */
export function seriesFromQualificationRows(rows: ComparatorQualificationRow[]): SchoolSeries {
  return {
    results: rows.filter((r) => r.avgPointScore !== null).map((r) => ({ period: r.period, value: r.avgPointScore as number })),
    candidates: rows.filter((r) => r.entries !== null).map((r) => ({ period: r.period, value: r.entries as number })),
  };
}
