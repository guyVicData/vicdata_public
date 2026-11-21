// The "admissions/pipeline" view (cached-views/views.json), keyed on the lists the chosen sets resolved to. Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { EntryPoint } from "../admissions/entry-points";
import type { SavedList } from "../admissions/lists";
import type { AdmissionsFilters } from "../admissions/traits";
import type { Sex } from "../admissions/cohort";
import { pipelineView } from "../admissions/views-api";

export function cachedPipeline(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters: AdmissionsFilters; sex: Sex; projection: boolean; catchment: { km: unknown; savedKm: number | null } }) {
  return cachedResult(resultKey("admissions/pipeline", urn, { ep: ep.id, lists, ...o }), () => pipelineView(urn, ep, lists, o));
}
