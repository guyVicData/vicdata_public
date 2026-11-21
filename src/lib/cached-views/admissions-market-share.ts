// The "admissions/market-share" view (cached-views/views.json), keyed on the lists the chosen sets resolved to. Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { EntryPoint } from "../admissions/entry-points";
import type { SavedList } from "../admissions/lists";
import type { AdmissionsFilters } from "../admissions/traits";
import type { Sex } from "../admissions/cohort";
import { marketView } from "../admissions/views-api";

export function cachedMarket(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters; sex: Sex }) {
  return cachedResult(resultKey("admissions/market-share", urn, { ep: ep.id, lists, ...o }), () => marketView(urn, ep, lists, o));
}
