// UNUSED as of 2026-08-24 -- flagged, not deleted. SchoolMap.tsx dropped the LA
// boundary overlay entirely (Guy's call, having seen it live on the redesigned map:
// "not adding value now that the map's job is just 'which schools are we looking
// at'"). Nothing in the codebase calls getGssCodeForLaCode/fetchLaBoundary any more
// (confirmed by grep before this note was added) -- this file is real, working code
// (fetches genuine WGS84 ONS boundary polygons server-side, nothing wrong with it),
// just currently wired to nothing. Left in place rather than removed in case a future
// round of "what do we actually show" on this page wants a boundary back -- delete
// for real only once that's been decided against, not by default.
//
// Real UK Local Authority boundary data (map spec, "Public View rebuild"): ONS Open
// Geography Portal's Counties and Unitary Authorities FeatureServer -- the unified
// dataset covering BOTH district- and county-tier LAs in one source (the district-only
// "Local_Authority_Districts" FeatureServer was tried first and confirmed NOT to
// cover county-level GSS codes like Surrey's E10000030 -- a real 0-feature response,
// caught before building anything on top of it).
//
// Requested in WGS84 (outSR=4326), not British National Grid, as of the 2026-08-23
// Leaflet map redesign -- Leaflet plots in lat/lng, so asking the FeatureServer to
// reproject server-side (a one-line query-param change it already supports) is simpler
// and cheaper than pulling BNG rings and reprojecting hundreds of boundary points
// client-side with proj4. School markers still start from real easting/northing
// (school_entities' own native coordinate system) and are converted with proj4 in
// SchoolMap.tsx itself -- a single point per school, not worth a second server round
// trip for. rings below are now [lng, lat] pairs (GeoJSON coordinate order), not
// [easting, northing] -- SchoolMap.tsx swaps to Leaflet's [lat, lng] expectation.
//
// Fetched server-side per page view rather than pre-stored (avoids CORS, keeps the
// schema simple) -- boundaries are lightweight at this generalisation (877B-3.4KB per
// LA, verified against all 5 GSS codes the Task 3 review schools need). Cached for a
// day via Next's fetch cache: LA boundaries are static government geography, not
// something that changes between page views.

import { createServerAnonSupabaseClient } from "./supabase";

// schools.la_code is GIAS's old 3-digit DfE/LEA number, a different coding system
// from the GSS codes the ONS boundary service and ons_births both use (see
// la_gss_crosswalk's own migration comment for the Reading/870->E06000038 and
// Surrey/936->E10000030 verification) -- same crosswalk table market share already
// depends on, reused here rather than duplicated.
export async function getGssCodeForLaCode(laCode: string | null): Promise<string | null> {
  if (!laCode) return null;
  const supabase = createServerAnonSupabaseClient();
  const { data } = await supabase
    .from("la_gss_crosswalk")
    .select("gss_code")
    .eq("dfe_code", laCode)
    .maybeSingle();
  return (data as { gss_code: string } | null)?.gss_code ?? null;
}

const FEATURE_SERVER_URL =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Counties_and_Unitary_Authorities_December_2023_Boundaries_UK_BUC/FeatureServer/0/query";

const GSS_CODE_RE = /^[EWS]\d{8}$/;

export type LaBoundary = {
  gssCode: string;
  name: string;
  // WGS84 [lng, lat] rings (GeoJSON coordinate order), same shape regardless of
  // Polygon/MultiPolygon input -- MultiPolygon islands/exclaves are rare for
  // county/unitary LAs but not impossible, so every ring from every part is kept, not
  // just the first.
  rings: [number, number][][];
};

export async function fetchLaBoundary(gssCode: string): Promise<LaBoundary | null> {
  if (!GSS_CODE_RE.test(gssCode)) return null; // defensive: never interpolate an unvalidated value into the query

  const url = `${FEATURE_SERVER_URL}?where=CTYUA23CD='${gssCode}'&outFields=CTYUA23CD,CTYUA23NM&outSR=4326&f=geojson`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 86400 } });
  } catch {
    return null; // ONS service unreachable -- degrade to no boundary, not a page error
  }
  if (!res.ok) return null;

  const body = await res.json();
  const feature = body?.features?.[0];
  if (!feature) return null;

  const geom = feature.geometry;
  const rings: [number, number][][] = [];
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) rings.push(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const polygon of geom.coordinates) {
      for (const ring of polygon) rings.push(ring);
    }
  } else {
    return null;
  }

  return {
    gssCode,
    name: feature.properties?.CTYUA23NM ?? gssCode,
    rings,
  };
}
