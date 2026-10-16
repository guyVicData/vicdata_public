// The ranking population's cache (chooser-sets.ts cachedRankingPopulation): one population per
// scope and phase, kept POPULATION_CACHE_MS, and dropped as soon as the school list is synced again
// (school-sync-stamp.ts) -- a population is the school list, so a sync changes it whatever its age.
import type { PopulationRow } from "./comparator-chooser";
import type { RankingPhase } from "./ranking-population";

// A population changes only when the census snapshot or the school list does: six hours, or the
// next school sync, whichever comes first.
export const POPULATION_CACHE_MS = 6 * 60 * 60 * 1000;

type Build = (regionCode: string | null, phase: RankingPhase, laName: string | null) => Promise<PopulationRow[]>;

export function makeRankingPopulationCache(build: Build, stamp: () => Promise<string>, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; stamp: string; rows: PopulationRow[] }>();
  return async (regionCode: string | null, phase: RankingPhase, laName: string | null): Promise<PopulationRow[]> => {
    const key = `${regionCode ?? "england"}|${phase}`;
    const s = await stamp();
    const hit = cache.get(key);
    if (hit && hit.stamp === s && now() - hit.at < POPULATION_CACHE_MS) return hit.rows;
    const rows = await build(regionCode, phase, laName);
    cache.set(key, { at: now(), stamp: s, rows });
    return rows;
  };
}
