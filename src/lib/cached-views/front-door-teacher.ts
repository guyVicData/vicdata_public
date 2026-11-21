// The "front-door/teacher" view (cached-views/views.json). Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cachedResult, resultKey } from "../results-cache";
import { loadTeacherModel } from "../front-door/teacher-data";
import type { TeacherPhaseId } from "../front-door/teacher-model";

/** The Teacher home's model: public rows (schools, read with the caller's client as before) and the
 * reference data; the focus, ticks and depth are the request's. */
export function cachedTeacherModel(supabase: SupabaseClient, urn: string, phase: TeacherPhaseId, opts: { focusKey: string | null; ticked: string[]; full: boolean; lite: boolean }) {
  return cachedResult(resultKey("front-door/teacher", urn, { phase, ...opts }), () => loadTeacherModel(supabase, urn, phase, opts));
}
