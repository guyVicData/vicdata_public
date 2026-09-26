// Teacher view, Candidates live review Part 5: the focused subject's entries in the
// school's LA, region and England (/api/teacher/subject-geography). Client-safe. GCSE per
// subject; Post-16 (Part C) per subject and exact qualification.
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

// Post-16 Part C: pass the item's exact qualification type at KS5, where the area figures
// are per (subject, qualification) rather than per subject.
export async function fetchSubjectGeography(
  supabase: Supa,
  urn: string,
  subject: string,
  qualificationType?: string,
): Promise<GeographyPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const params = new URLSearchParams({ urn, subject });
  if (qualificationType) {
    params.set("phase", "ks5");
    params.set("qualificationType", qualificationType);
  }
  const res = await fetch(`/api/teacher/subject-geography?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok ? ((await res.json()) as GeographyPayload) : null;
}
