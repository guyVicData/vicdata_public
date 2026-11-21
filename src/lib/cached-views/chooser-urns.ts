// The "chooser/urns" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import { resolveFixedSet } from "../chooser-sets";
import { withChooserProfiles, type ChooserPhase } from "./chooser-profiles";

/** A list of schools, as given (already deduplicated and capped by the route). */
export function cachedFixedSet(urn: string, phase: ChooserPhase, urns: string[]) {
  return cachedResult(resultKey("chooser/urns", urn, { phase, urns }), async () => withChooserProfiles(urn, phase, await resolveFixedSet(urn, phase, urns)));
}
