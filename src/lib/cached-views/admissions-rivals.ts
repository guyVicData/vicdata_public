// The "admissions/rivals" view (cached-views/views.json), keyed on the lists the chosen sets resolved to. Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { EntryPoint } from "../admissions/entry-points";
import type { SavedList } from "../admissions/lists";
import type { AdmissionsFilters } from "../admissions/traits";
import { rivalsView } from "../admissions/views-api";

export function cachedRivals(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters; subject: string | null; family: string | null; qual: string | null; measure: string | null }) {
  return cachedResult(resultKey("admissions/rivals", urn, { ep: ep.id, lists, ...o }), () => rivalsView(urn, ep, lists, o));
}
