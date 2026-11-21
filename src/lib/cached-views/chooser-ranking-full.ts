// The "chooser/ranking-full" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import { resolveRankingPopulation } from "../chooser-sets";
import type { RankingFilters } from "../comparator-chooser";
import type { RankingPhase } from "../ranking-population";

/** A ranking's whole population, for SMT (`full`): ranked, no profiles or series. */
export function cachedRankingPopulationSet(urn: string, targetName: string, phase: RankingPhase, filters: RankingFilters, laName: string | null) {
  return cachedResult(resultKey("chooser/ranking-full", urn, { phase, filters, targetName, laName }), () => resolveRankingPopulation(urn, targetName, phase, filters, laName));
}
