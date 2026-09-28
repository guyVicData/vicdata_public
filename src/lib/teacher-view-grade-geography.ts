// Grade bands frontend round: the focused subject's per-grade entries in the school's LA,
// region and England (/api/teacher/subject-grade-geography). Client-safe; the grade-grain
// sibling of teacher-view-geography.ts, and its hook mirrors useSubjectGeography.
//
// Each grouping's rows are every grade's own count, per year. A grade missing from a
// grouping is one the RPC suppressed (fewer than 5 schools), not a zero.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

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
  const res = await fetch(`/api/teacher/subject-grade-geography?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? ((await res.json()) as GradeGeographyPayload) : null;
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
