// The "admissions/shape" view (cached-views/views.json), keyed on the lists the chosen sets resolved to. Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { EntryPoint } from "../admissions/entry-points";
import type { SavedList } from "../admissions/lists";
import type { AdmissionsFilters } from "../admissions/traits";
import { shapeView } from "../admissions/views-api";

export function cachedShape(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters }) {
  return cachedResult(resultKey("admissions/shape", urn, { ep: ep.id, lists, ...o }), () => shapeView(urn, ep, lists, o));
}
