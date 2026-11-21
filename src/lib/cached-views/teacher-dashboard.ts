// The "teacher/dashboard" view (cached-views/views.json). Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KsStage } from "../academic-data-view";
import { cachedResult, resultKey } from "../results-cache";
import { buildTeacherDashboard } from "../teacher-dashboard-data";

/** Teacher's dashboard (/api/teacher/dashboard): the answer depends only on the school and the phase
 * (public data), so after the caller check it is kept in the shared results cache. */
export function cachedTeacherDashboard(supabase: SupabaseClient, urn: string, phase: KsStage) {
  return cachedResult(resultKey("teacher/dashboard", urn, { phase }), () => buildTeacherDashboard(supabase, urn, phase));
}
