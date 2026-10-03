// Grade bands frontend round: the focused subject's per-grade entries in the school's LA,
// region and England (/api/teacher/subject-grade-geography). Client-safe; the grade-grain
// sibling of teacher-view-geography.ts, and its hook mirrors useSubjectGeography.
//
// Each grouping's rows are every grade's own count, per year. A grade missing from a
// grouping is one the RPC suppressed (fewer than 5 schools), not a zero.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { bandRate, type GradeRange } from "@/lib/subject-grades";
import { cachedFetchJson } from "@/lib/fetch-cache";

export type GradeGeographyRow = { period: number; grade: string; entries: number; schoolCount: number };
type Area = { name: string; rows: GradeGeographyRow[] } | null;
export type GradeGeographyPayload = { la: Area; region: Area; national: Area };

export type GradeGeographyInput = { urn: string; subject: string; qualificationType: string; phase: "ks4" | "ks5" };

export async function fetchSubjectGradeGeography(input: GradeGeographyInput): Promise<GradeGeographyPayload | null> {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const params = new URLSearchParams({ urn: input.urn, subject: input.subject, qualificationType: input.qualificationType, phase: input.phase });
  // Shared across panels and embedded views for 5 minutes (fetch-cache.ts, decision 10).
  const res = await cachedFetchJson<GradeGeographyPayload>(`/api/teacher/subject-grade-geography?${params.toString()}`, { token });
  return res.ok ? res.body : null;
}

// Fetched once per (school, subject, qualification): the payload covers every year and
// every grade, so changing the range or the year never refetches. null input = not wanted.
export function useSubjectGradeGeography(input: GradeGeographyInput | null): { id: string; data: GradeGeographyPayload | null } | null {
  const [geo, setGeo] = useState<{ id: string; data: GradeGeographyPayload | null } | null>(null);
  const id = input ? `${input.urn}|${input.phase}|${input.subject}|${input.qualificationType}` : null;
  useEffect(() => {
    if (!input || !id || geo?.id === id) return;
    let cancelled = false;
    (async () => {
      const data = await fetchSubjectGradeGeography(input);
      if (!cancelled) setGeo({ id, data });
    })();
    return () => { cancelled = true; };
    // `id` carries every field of `input`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, geo?.id]);
  return geo && geo.id === id ? geo : null;
}

/**
 * R-BANDS-ENGLAND-BENCH, R-SAME-YEAR-BENCH, R-MIN-SCHOOLS: on Grade bands the focused
 * subject's benchmark is England's rate on the SAME span for the same year, from its
 * national grade rows (a grade England suppressed below 5 schools is simply absent).
 * Peers have no fetched England rows, so they carry none, as on the threshold measure.
 * The focused series is `focus`, or the first one when `focus` is not among them.
 * (Lifted verbatim from SubjectPanels in 0.6 S2.)
 */
export function withEnglandBandBenchmark<S extends { key: string; benchmark?: (number | null)[] }>(
  subjects: S[],
  focus: string | null,
  periods: number[],
  englandRows: GradeGeographyRow[],
  range: GradeRange | null,
): S[] {
  const englandBandRate = (period: number): number | null =>
    range ? bandRate(englandRows.filter((r) => r.period === period), range)?.rate ?? null : null;
  const focusKey = (subjects.find((x) => x.key === focus) ?? subjects[0])?.key ?? null;
  return subjects.map((x) => (x.key === focusKey ? { ...x, benchmark: periods.map(englandBandRate) } : x));
}
