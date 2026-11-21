// The "chooser/ranking" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import { resolveRankingSet } from "../chooser-sets";
import type { RankingFilters } from "../comparator-chooser";
import type { RankingPhase } from "../ranking-population";
import { withChooserProfiles } from "./chooser-profiles";

/** A ranking for Teacher: the top and the school's neighbours, with the whole population's figures. */
export function cachedRankingSet(urn: string, targetName: string, phase: RankingPhase, filters: RankingFilters, laName: string | null) {
  return cachedResult(resultKey("chooser/ranking", urn, { phase, filters, targetName, laName }), async () => withChooserProfiles(urn, phase, await resolveRankingSet(urn, targetName, phase, filters, laName)));
}
