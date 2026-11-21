// The "chooser/nearest" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import { resolveDefaultNearest } from "../chooser-sets";
import { withChooserProfiles, type ChooserPhase } from "./chooser-profiles";

/** The column's default: the chooser's own "10 nearest schools". */
export function cachedNearestSet(urn: string, phase: ChooserPhase) {
  return cachedResult(resultKey("chooser/nearest", urn, { phase }), async () => withChooserProfiles(urn, phase, await resolveDefaultNearest(urn, phase)));
}
