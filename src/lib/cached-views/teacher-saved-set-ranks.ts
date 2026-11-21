// The "teacher/saved-set-ranks" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import { rankFixedSets } from "../teacher-view-comparator-series";
import type { KsStage } from "../academic-data-view";

/** 21 Nov: /api/teacher/saved-comparator-sets' ranking of the school's saved, Victoria Consultancy and group sets
 * (every member's academic profile: seven reference reads over all the sets' schools, on every SMT and Teacher
 * page). Public data only, a pure function of the school, the phase and each set's id and URNs in order, so
 * keyed on exactly those; who may see which set was decided by the route before. Stored from 100 ms: it is
 * read on nearly every page, so even a short build is worth keeping. */
export function cachedFixedSetRanks(urn: string, sets: { id: string; urns: string[] }[], phase: KsStage) {
  return cachedResult(resultKey("teacher/saved-set-ranks", urn, { phase, sets }), () => rankFixedSets(urn, sets, phase), { minBuildMs: 100 });
}
