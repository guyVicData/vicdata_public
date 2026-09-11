// Map round (2026-09-12), Part 2 Stage A (2c). Server-side data for the Region-scope
// LA choropleth -- same "one shared lib module, consumed by the API route" shape as
// region-nation-comparator.ts, not inlined into the route itself.
//
// Two RPCs combined into one response: region_nation_la_rollup() (small, filter-
// dependent -- changes every time a member ticks a filter pill) and
// la_boundaries_geojson() (larger, filter-INDEPENDENT -- the same real polygons
// regardless of which filters are active). Fetched together here, scoped to exactly
// the gss_codes the rollup actually returned (an LA with zero matching schools never
// gets its polygon fetched at all, since there'd be nothing to colour it with),
// rather than the client juggling two separately-cached datasets for what is, at
// Region scale (a few dozen LAs), a small combined payload either way.
import { createServerAnonSupabaseClient } from "./supabase";

export type LaChoroplethEntry = {
  gssCode: string;
  laName: string;
  schoolCount: number;
  currentTotal: number;
  anchorTotal: number | null;
  currentPeriod: number | null;
  anchorPeriod: number | null;
  // GeoJSON MultiPolygon geometry (not the full Feature) straight from
  // ST_AsGeoJSON(geom) -- parsed server-side once here so route.ts and the client
  // both work with real objects, not a string every consumer would have to
  // JSON.parse itself.
  geometry: GeoJSON.MultiPolygon | null;
};

type RollupRow = {
  gssCode: string;
  laName: string;
  schoolCount: number;
  currentTotal: number;
  anchorTotal: number | null;
  currentPeriod: number | null;
  anchorPeriod: number | null;
};

export async function fetchLaChoropleth(
  regionCode: string,
  sectors: string[] | null,
  phaseBands: string[] | null,
  gender: "Girls" | "Boys" | null,
  boardingMode: "boarders" | "day" | "whole" | null,
): Promise<LaChoroplethEntry[]> {
  const supabase = createServerAnonSupabaseClient();

  const { data: rollupData, error: rollupError } = await supabase.rpc("region_nation_la_rollup", {
    p_region_code: regionCode,
    p_sectors: sectors && sectors.length > 0 ? sectors : null,
    p_phase_bands: phaseBands && phaseBands.length > 0 ? phaseBands : null,
    p_gender: gender,
    p_boarding_mode: boardingMode,
  });
  if (rollupError) throw rollupError;
  const rollup = (rollupData ?? []) as RollupRow[];
  if (rollup.length === 0) return [];

  const { data: geoData, error: geoError } = await supabase.rpc("la_boundaries_geojson", {
    p_gss_codes: rollup.map((r) => r.gssCode),
  });
  if (geoError) throw geoError;
  const geoByGss = new Map(
    ((geoData ?? []) as { gss_code: string; geojson: string }[]).map((g) => [g.gss_code, JSON.parse(g.geojson) as GeoJSON.MultiPolygon]),
  );

  return rollup.map((r) => ({
    ...r,
    // A gss_code the rollup returned but with no matching boundary row (the 7 known
    // legacy Pre-LGR crosswalk codes -- see la_boundaries's own migration comment --
    // or any other real future gap) gets geometry: null here rather than a thrown
    // error or a silently skipped row: the render layer's job is to treat that as
    // genuine no-shape-available, the same no-data discipline every other real gap in
    // this feature already applies, not something this function should paper over by
    // dropping the row's real stats entirely.
    geometry: geoByGss.get(r.gssCode) ?? null,
  }));
}
