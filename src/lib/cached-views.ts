// Speed plan §4.2 item 2: the slow views, through the shared results cache (results-cache.ts). Server-only.
//
// Each function takes exactly what its builder takes, already resolved by the route AFTER the caller
// check, and keys the answer on those inputs, never on who is asking:
//   - a set is its kind, label and URNs, in the order given (the order can show in the answer);
//   - what the caller read with their own rights is in the key as read: the Admissions lists the
//     chosen sets resolved to, the school's saved catchment (inside the resolved catchment), Pupils'
//     saved entry points and lists, and whether a head office may see the school's Admissions (the
//     SMT Overview's privateNote) -- so two callers who can see different things get different keys;
//   - what differs by caller and costs nothing (the Admissions routes' setChoices and tiers, the menu's
//     ticks) is left out of the stored answer and added by the route per request.
// The routes call these; scripts/results-cache-parity.ts calls them too, to prove an answer served from
// the cache is byte for byte the answer built.
import { cachedResult, resultKey } from "./results-cache";
import type { SmtAdmissionsReader } from "./smt/auth-rules";
import type { SmtSchool } from "./smt/school";
import { buildOverview, type SmtSet } from "./smt/overview";
import { buildAcademic } from "./smt/academic";
import type { AcademicState } from "./smt/qual-groups";
import { buildPupils, readPupilsAdmissions } from "./smt/pupils";
import type { SmtLevel, SmtPhase } from "./smt/levels";
import { buildContext, type ContextArea } from "./smt/context";
import { buildContextMap } from "./smt/context-map";
import type { Catchment } from "./smt/catchment";
import type { EntryPoint } from "./admissions/entry-points";
import type { SavedList } from "./admissions/lists";
import type { AdmissionsFilters } from "./admissions/traits";
import type { Sex } from "./admissions/cohort";
import { marketView, pipelineView, rivalsView, shapeView } from "./admissions/views-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTeacherModel } from "./front-door/teacher-data";
import type { TeacherPhaseId } from "./front-door/teacher-model";

const setKey = (s: SmtSet) => ({ kind: s.kind, label: s.label, urns: s.urns });

// ---- SMT ---------------------------------------------------------------------------------------

/** Overview: the caller matters only through whether a head office may see the school's Admissions
 * (the market panel's privateNote); with a set, the market rivals are the set's, so no lists are read. */
export function cachedOverview(school: SmtSchool, set: SmtSet, admissions: SmtAdmissionsReader) {
  return cachedResult(resultKey("smt/overview", school.urn, { set: setKey(set), privateNote: admissions.privateNote ?? null }), () => buildOverview(school, set, admissions));
}

export function cachedAcademic(school: SmtSchool, state: AcademicState, set: SmtSet) {
  return cachedResult(resultKey("smt/academic", school.urn, { state, set: setKey(set) }), () => buildAcademic(school, state, set));
}

/** Pupils: the school's saved entry points and lists are read first, with the caller's reader, and
 * keyed as read. */
export async function cachedPupils(school: SmtSchool, set: SmtSet, level: SmtLevel, admissions: SmtAdmissionsReader) {
  const pre = await readPupilsAdmissions(school, admissions);
  return cachedResult(resultKey("smt/pupils", school.urn, { set: setKey(set), level, adm: pre }), () => buildPupils(school, set, level, admissions, pre));
}

/** Context: public data; the resolved catchment carries the school's saved catchment as the caller read it. */
export function cachedContext(school: SmtSchool, area: ContextArea, level: SmtPhase, catchment: Catchment) {
  return cachedResult(resultKey("smt/context", school.urn, { area, level, catchment }), () => buildContext(school, area, level, catchment));
}

/** The neighbourhood map; its fallback state (no boundaries, no coordinates, nothing near) isn't kept. */
export function cachedContextMap(school: SmtSchool, level: SmtPhase, catchment: Catchment) {
  return cachedResult(
    resultKey("smt/context/map", school.urn, { level, catchment }),
    async () => {
      const c = await buildContext(school, "around", level, catchment);
      return buildContextMap(school, level, c.map.schools, catchment.km);
    },
    { shouldStore: (m) => m.state !== "fallback" },
  );
}

// ---- Admissions: the views, keyed on the lists the chosen sets resolved to ------------------------

export function cachedPipeline(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters; sex: Sex; projection: boolean; catchment: { km: unknown; savedKm: number | null } }) {
  return cachedResult(resultKey("admissions/pipeline", urn, { ep: ep.id, lists, ...o }), () => pipelineView(urn, ep, lists, o));
}

export function cachedMarket(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters; sex: Sex }) {
  return cachedResult(resultKey("admissions/market-share", urn, { ep: ep.id, lists, ...o }), () => marketView(urn, ep, lists, o));
}

export function cachedRivals(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters; subject: string | null; family: string | null; qual: string | null; measure: string | null }) {
  return cachedResult(resultKey("admissions/rivals", urn, { ep: ep.id, lists, ...o }), () => rivalsView(urn, ep, lists, o));
}

export function cachedShape(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters }) {
  return cachedResult(resultKey("admissions/shape", urn, { ep: ep.id, lists, ...o }), () => shapeView(urn, ep, lists, o));
}

// ---- Teacher -----------------------------------------------------------------------------------

/** The Teacher home's model: public rows (schools, read with the caller's client as before) and the
 * reference data; the focus, ticks and depth are the request's. */
export function cachedTeacherModel(supabase: SupabaseClient, urn: string, phase: TeacherPhaseId, opts: { focusKey: string | null; ticked: string[]; full: boolean; lite: boolean }) {
  return cachedResult(resultKey("front-door/teacher", urn, { phase, ...opts }), () => loadTeacherModel(supabase, urn, phase, opts));
}
