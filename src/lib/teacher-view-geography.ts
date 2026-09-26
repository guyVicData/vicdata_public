// Teacher view, Candidates live review Part 5: the focused GCSE subject's entries in the
// school's LA, region and England (/api/teacher/subject-geography). Client-safe.
//
// Every figure here is POINTS-ELIGIBLE entries (GCSE full course) -- the source table's
// own convention -- which is why the school's own row beside them is its points-eligible
// entries too, not its all-qualifications Candidates count: all four rows then count the
// same thing.
import type { createBrowserSupabaseClient } from "@/lib/supabase";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// avgPointScore: the area's own average point score for the subject -- what Results
// compares against. entries: its points-eligible entries -- what Candidates compares.
export type GeographyRow = { period: number; entries: number | null; avgPointScore: number | null; schoolCount: number };
export type GeographyPayload = {
  la: { name: string; rows: GeographyRow[] } | null;
  region: { name: string; rows: GeographyRow[] } | null;
  national: { name: string; rows: GeographyRow[] } | null;
};

export async function fetchSubjectGeography(supabase: Supa, urn: string, subject: string): Promise<GeographyPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(`/api/teacher/subject-geography?urn=${encodeURIComponent(urn)}&subject=${encodeURIComponent(subject)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok ? ((await res.json()) as GeographyPayload) : null;
}
