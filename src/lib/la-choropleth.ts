// Map round (2026-09-12), Part 2 Stage A (2c) + Stage B. Server-side data for the
// choropleth's two geometry tiers -- LA (Region scope, and the zoomed-in drill-down
// within Nation scope) and Region (Nation scope, zoomed out) -- same "one shared lib
// module, consumed by the API routes" shape as region-nation-comparator.ts, not
// inlined into the routes themselves.
//
// Two RPCs combined into one response per tier: region_nation_la_rollup() (small,
// filter-dependent -- changes every time a member ticks a filter pill) and a
// *_boundaries_geojson() RPC (larger, filter-INDEPENDENT -- the same real polygons
// regardless of which filters are active). Fetched together, scoped to exactly the
// gss_codes the rollup actually returned, rather than the client juggling two
// separately-cached datasets.
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
  regionCode: string | null;
  schoolCount: number;
  currentTotal: number;
  anchorTotal: number | null;
  currentPeriod: number | null;
  anchorPeriod: number | null;
};

// Shared by both tiers below -- fetches real stored geometry (via whichever
// *_boundaries_geojson RPC the caller names) for exactly the gss_codes given, and
// attaches it to each entry (null when no matching boundary row exists -- a real,
// known gap, e.g. la_boundaries's own 7 legacy Pre-LGR codes -- the render layer's
// job to treat as genuine no-shape-available, not this function's to paper over).
async function attachGeometry<T extends { gssCode: string }>(
  supabase: ReturnType<typeof createServerAnonSupabaseClient>,
  rpcName: "la_boundaries_geojson" | "region_boundaries_geojson",
  entries: T[],
): Promise<(T & { geometry: GeoJSON.MultiPolygon | null })[]> {
  if (entries.length === 0) return [];
  const { data: geoData, error: geoError } = await supabase.rpc(rpcName, {
    p_gss_codes: entries.map((e) => e.gssCode),
  });
  if (geoError) throw geoError;
  const geoByGss = new Map(
    ((geoData ?? []) as { gss_code: string; geojson: string }[]).map((g) => [g.gss_code, JSON.parse(g.geojson) as GeoJSON.MultiPolygon]),
  );
  return entries.map((e) => ({ ...e, geometry: geoByGss.get(e.gssCode) ?? null }));
}

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
  // regionCode (added to RollupRow for fetchNationRegionChoropleth's own grouping
  // below) is deliberately dropped here -- the LA tier's own LaChoroplethEntry type
  // never declared it, and the client has no use for it at this tier.
  const laEntries = rollup.map((r) => ({
    gssCode: r.gssCode,
    laName: r.laName,
    schoolCount: r.schoolCount,
    currentTotal: r.currentTotal,
    anchorTotal: r.anchorTotal,
    currentPeriod: r.currentPeriod,
    anchorPeriod: r.anchorPeriod,
  }));
  return attachGeometry(supabase, "la_boundaries_geojson", laEntries);
}

// Map round (2026-09-12), Part 2 Stage B. Nation scope's region tier -- per direct
// instruction, region numbers come from RE-SUMMING the same region_nation_la_rollup()
// LA rows (called with p_region_code = null, meaning "every LA nationally"), not a
// second copy of the sector/phase/gender/boarding predicate logic in a forked SQL
// function. Folding ~175 LA rows into ~9 region rows is genuinely trivial done here,
// so it's done here rather than as a second Postgres function -- keeps the ONE real
// predicate implementation in exactly one place.
//
// Wales (region_code W92000004, a whole-country pseudo-"region" school_region_nation
// already uses -- there is no real ONS sub-national region for Wales at all) is
// deliberately excluded from this tier's own output: region_boundaries only ever
// stored the 9 real English regions (Regions_December_2023_Boundaries_EN_BFC is an
// English-only ONS dataset -- see that table's own migration comment), so a Welsh
// "region" row would have no real geometry to draw regardless. Filtered by the real
// RGN23CD prefix ('E12') rather than relying on the geometry lookup below to silently
// skip it -- explicit, not incidental. Nation scope for a Welsh target uses the LA
// tier directly instead (DataViewShell.tsx's own comment on why).
const ENGLISH_REGION_CODE_PREFIX = "E12";

export async function fetchNationRegionChoropleth(
  sectors: string[] | null,
  phaseBands: string[] | null,
  gender: "Girls" | "Boys" | null,
  boardingMode: "boarders" | "day" | "whole" | null,
): Promise<LaChoroplethEntry[]> {
  const supabase = createServerAnonSupabaseClient();

  const { data: rollupData, error: rollupError } = await supabase.rpc("region_nation_la_rollup", {
    p_region_code: null,
    p_sectors: sectors && sectors.length > 0 ? sectors : null,
    p_phase_bands: phaseBands && phaseBands.length > 0 ? phaseBands : null,
    p_gender: gender,
    p_boarding_mode: boardingMode,
  });
  if (rollupError) throw rollupError;
  const rollup = (rollupData ?? []) as RollupRow[];

  const byRegion = new Map<
    string,
    { gssCode: string; laName: string; schoolCount: number; currentTotal: number; anchorTotal: number; currentPeriod: number | null; anchorPeriod: number | null; hasRealName: boolean }
  >();
  for (const r of rollup) {
    if (!r.regionCode || !r.regionCode.startsWith(ENGLISH_REGION_CODE_PREFIX)) continue;
    const acc = byRegion.get(r.regionCode) ?? {
      gssCode: r.regionCode,
      laName: "",
      schoolCount: 0,
      currentTotal: 0,
      anchorTotal: 0,
      currentPeriod: null,
      anchorPeriod: null,
      hasRealName: false,
    };
    acc.schoolCount += r.schoolCount;
    acc.currentTotal += r.currentTotal;
    // A hollow LA (schoolCount 0) always carries anchorTotal null -- treated as a
    // real 0 contribution to the region sum (matches currentTotal's own treatment),
    // not as "unknown," since the LA genuinely has zero matching pupils either period.
    acc.anchorTotal += r.anchorTotal ?? 0;
    acc.currentPeriod = acc.currentPeriod ?? r.currentPeriod;
    acc.anchorPeriod = acc.anchorPeriod ?? r.anchorPeriod;
    byRegion.set(r.regionCode, acc);
  }

  // region_boundaries.name (RGN23NM, e.g. "South East") is the one real name this
  // tier displays -- fetched alongside geometry below rather than carried through
  // the LA-level rollup (which never sees a region's own name at all, only its
  // code), same "one real source of truth per name" discipline the LA tier already
  // applies to la_gss_crosswalk.la_name.
  const { data: geoData, error: geoError } = await supabase.rpc("region_boundaries_geojson", {
    p_gss_codes: Array.from(byRegion.keys()),
  });
  if (geoError) throw geoError;
  const geoByGss = new Map(
    ((geoData ?? []) as { gss_code: string; name: string; geojson: string }[]).map((g) => [
      g.gss_code,
      { name: g.name, geometry: JSON.parse(g.geojson) as GeoJSON.MultiPolygon },
    ]),
  );

  return Array.from(byRegion.values()).map((r) => {
    const geo = geoByGss.get(r.gssCode);
    return {
      gssCode: r.gssCode,
      laName: geo?.name ?? r.gssCode,
      schoolCount: r.schoolCount,
      currentTotal: r.currentTotal,
      // Boarding mode makes every LA's own anchorTotal null (region_nation_la_rollup's
      // own documented behaviour) -- summing nulls-as-0 above would silently produce a
      // fabricated 0% comparison instead of "no comparison" at the region tier, so
      // this is re-nulled here whenever boarding mode is active, mirroring the LA
      // tier's own honesty rule exactly rather than losing it one level up.
      anchorTotal: boardingMode !== null ? null : r.anchorTotal,
      currentPeriod: r.currentPeriod,
      anchorPeriod: r.anchorPeriod,
      geometry: geo?.geometry ?? null,
    };
  });
}
