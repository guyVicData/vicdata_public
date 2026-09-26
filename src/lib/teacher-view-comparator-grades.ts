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
