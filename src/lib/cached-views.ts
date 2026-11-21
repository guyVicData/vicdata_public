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
import { smtSchool, type SmtSchool } from "./smt/school";
import { dependOn, type BuildTrace } from "./build-trace";
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
import { resolveDefaultNearest, resolveFixedSet, resolveRankingPopulation, resolveRankingSet } from "./chooser-sets";
import type { RankingFilters } from "./comparator-chooser";
import type { RankingPhase } from "./ranking-population";
import { serializeAcademicProfile } from "./academic-data-view";
import { fetchTeacherComparatorProfiles, profileUrnsFor } from "./teacher-comparator-profiles";
import { rankFixedSets } from "./teacher-view-comparator-series";
import type { KsStage } from "./academic-data-view";

const setKey = (s: SmtSet) => ({ kind: s.kind, label: s.label, urns: s.urns });

// ---- SMT ---------------------------------------------------------------------------------------

/** The school as SMT's chips need it (/api/smt/school): public data only (the anon client, the national
 * populations, the IGCSE list, England's schools), the same for every caller, so keyed on the URN alone.
 * "No such school" (null) isn't kept. */
/** `started`: the route's own read, begun alongside its caller check -- reused as the build, so the shared store
 * is only asked (and only ever written) once the caller has passed. */
export function cachedSmtSchool(urn: string, started?: { trace: BuildTrace; promise: Promise<SmtSchool | null> }) {
  return cachedResult(
    resultKey("smt/school", urn, {}),
    () => {
      if (!started) return smtSchool(urn);
      // Begun outside this build: link its trace in, so a read it carried past still keeps the answer out of the store.
      dependOn(started.trace);
      return started.promise;
    },
    { shouldStore: (s) => s !== null },
  );
}

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

// ---- the comparator chooser's sets (/api/teacher/chooser-set; SMT's sets too) -------------------
// Every kind is public data resolved from what the request names: the school, the phase, the URNs or
// the ranking's filters (as sent: arrays keep their order) and the school's own name and LA as the route
// read them. Nothing here reads with the caller's rights or depends on who is asking, so the route's
// gate (member, View as / peek, head office) comes first and the key never names the caller.

type ChooserPhase = "ks2" | "ks4" | "ks5";

/** At GCSE and Post-16 the answer carries the set's lean school details too (0.6.7 B1). */
async function withChooserProfiles<T extends { rows: { urn: string }[]; subjectRows?: { urn: string }[] }>(urn: string, phase: ChooserPhase, set: T) {
  return phase === "ks2"
    ? set
    : { ...set, profiles: (await fetchTeacherComparatorProfiles(profileUrnsFor([...set.rows, ...(set.subjectRows ?? [])].map((r) => r.urn), urn), phase)).map(serializeAcademicProfile) };
}

/** The column's default: the chooser's own "10 nearest schools". */
export function cachedNearestSet(urn: string, phase: ChooserPhase) {
  return cachedResult(resultKey("chooser/nearest", urn, { phase }), async () => withChooserProfiles(urn, phase, await resolveDefaultNearest(urn, phase)));
}

/** A list of schools, as given (already deduplicated and capped by the route). */
export function cachedFixedSet(urn: string, phase: ChooserPhase, urns: string[]) {
  return cachedResult(resultKey("chooser/urns", urn, { phase, urns }), async () => withChooserProfiles(urn, phase, await resolveFixedSet(urn, phase, urns)));
}

/** A ranking for Teacher: the top and the school's neighbours, with the whole population's figures. */
export function cachedRankingSet(urn: string, targetName: string, phase: RankingPhase, filters: RankingFilters, laName: string | null) {
  return cachedResult(resultKey("chooser/ranking", urn, { phase, filters, targetName, laName }), async () => withChooserProfiles(urn, phase, await resolveRankingSet(urn, targetName, phase, filters, laName)));
}

/** A ranking's whole population, for SMT (`full`): ranked, no profiles or series. */
export function cachedRankingPopulationSet(urn: string, targetName: string, phase: RankingPhase, filters: RankingFilters, laName: string | null) {
  return cachedResult(resultKey("chooser/ranking-full", urn, { phase, filters, targetName, laName }), () => resolveRankingPopulation(urn, targetName, phase, filters, laName));
}

// ---- Saved sets --------------------------------------------------------------------------------

/** 21 Nov: /api/teacher/saved-comparator-sets' ranking of the school's saved, Victoria Consultancy and group sets
 * (every member's academic profile: seven reference reads over all the sets' schools, on every SMT and Teacher
 * page). Public data only, a pure function of the school, the phase and each set's id and URNs in order, so
 * keyed on exactly those; who may see which set was decided by the route before. Stored from 100 ms: it is
 * read on nearly every page, so even a short build is worth keeping. */
export function cachedFixedSetRanks(urn: string, sets: { id: string; urns: string[] }[], phase: KsStage) {
  return cachedResult(resultKey("teacher/saved-set-ranks", urn, { phase, sets }), () => rankFixedSets(urn, sets, phase), { minBuildMs: 100 });
}
