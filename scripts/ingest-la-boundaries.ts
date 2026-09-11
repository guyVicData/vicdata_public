#!/usr/bin/env -S npx tsx
// Map round (2026-09-12), Part 2 (Region/Nation choropleth, Stage A). One-off ingest
// of real LA (county/unitary authority) boundary polygons into la_boundaries
// (20261012090000_la_boundaries.sql) -- per direct instruction, a proper stored
// dataset, not a live fetch at render time (see that migration's own comment for the
// full reasoning, including the real architecture finding about why this lives here
// and not the vicdata ingest repo).
//
// Usage: npx tsx --env-file=.env scripts/ingest-la-boundaries.ts
//
// Source: ONS Open Geography Portal, the SAME real, already-proven FeatureServer
// src/lib/la-boundary.ts already fetches single boundaries from live (that module's
// own header comment documents how this endpoint was found -- a district-only
// FeatureServer was tried first and confirmed NOT to cover county-level GSS codes,
// before landing on this one). This script does the same real query, just once, for
// every UK feature at once (confirmed directly: the service's own maxRecordCount is
// 2000, comfortably above the real 218-feature UK total -- no pagination needed) --
// requested in GeoJSON/WGS84 (outSR=4326) to match Leaflet's own coordinate system,
// exactly as la-boundary.ts already establishes.
//
// Real, confirmed gap, not a bug: la_gss_crosswalk has 160 English rows (region IS
// NOT NULL), but only 153 have a real boundary in this dataset -- the other 7 are
// genuine "Pre-LGR" (pre-Local Government Reorganisation) historical entries
// (la_gss_crosswalk's own seed data keeps these for older DfE census rows that still
// reference a superseded LA code), which no longer exist as a real administrative
// area to draw a boundary for. Confirmed directly by diffing the two sets before
// writing this script, not assumed -- this script stores whatever the ONS service
// genuinely returns (153 English + 65 Welsh/Scottish/NI features, 218 total); the
// render layer treats a gss_code with no matching row as honestly "no boundary
// available," the same discipline this codebase already applies to every other real
// data gap (a LEFT JOIN, not an inner join, at read time).

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";

const FEATURE_SERVER_URL =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Counties_and_Unitary_Authorities_December_2023_Boundaries_UK_BUC/FeatureServer/0/query";
const SOURCE_DATASET = "Counties_and_Unitary_Authorities_December_2023_Boundaries_UK_BUC";

type GeoJsonFeature = {
  properties: { CTYUA23CD: string; CTYUA23NM: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

async function fetchAllBoundaries(): Promise<GeoJsonFeature[]> {
  const url = `${FEATURE_SERVER_URL}?where=1=1&outFields=CTYUA23CD,CTYUA23NM&outSR=4326&f=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ONS FeatureServer query failed: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { features: GeoJsonFeature[] };
  return body.features;
}

// A bare Polygon becomes a single-polygon MultiPolygon, matching la_boundaries.geom's
// own MultiPolygon column type (la-boundary.ts's own comment: "MultiPolygon islands/
// exclaves are rare for county/unitary LAs but not impossible" -- normalising both
// input shapes to one output shape here means every row has one consistent type to
// query against, not a per-row type check at read time).
function toMultiPolygonGeoJson(geom: GeoJsonFeature["geometry"]): { type: "MultiPolygon"; coordinates: unknown } {
  if (geom.type === "MultiPolygon") return geom as { type: "MultiPolygon"; coordinates: unknown };
  return { type: "MultiPolygon", coordinates: [geom.coordinates] };
}

async function main() {
  console.log("Fetching all UK LA boundaries from ONS Open Geography...");
  const features = await fetchAllBoundaries();
  console.log(`Fetched ${features.length} real features.`);
  const englishCount = features.filter((f) => f.properties.CTYUA23CD.startsWith("E")).length;
  console.log(`  of which ${englishCount} are English (E-prefixed GSS codes).`);
  if (englishCount < 140) {
    // Sanity floor, not an exact match -- a real drop from the expected ~153 English
    // LAs (rather than the small, already-diagnosed 7-row Pre-LGR gap) would mean the
    // service itself returned something wrong; better to fail loudly here than
    // silently store a truncated dataset.
    throw new Error(`Only ${englishCount} English features returned -- expected ~153. Refusing to ingest a possibly-truncated response.`);
  }

  const supabase = createServiceRoleSupabaseClient();
  const rows = features.map((f) => ({
    gss_code: f.properties.CTYUA23CD,
    name: f.properties.CTYUA23NM,
    // PostgREST/PostgreSQL's geometry columns accept GeoJSON directly via
    // ST_GeomFromGeoJSON when passed as text through a normal insert is NOT
    // supported by the REST API's plain upsert (no SQL function call available this
    // way) -- so this writes through a small SQL RPC instead (below), matching the
    // pattern the geo/nearest-schools migrations already use for anything needing
    // a real geometry construction, not a raw client-side upsert.
    geom_geojson: JSON.stringify(toMultiPolygonGeoJson(f.geometry)),
    source_dataset: SOURCE_DATASET,
  }));

  console.log(`Writing ${rows.length} rows via ingest_la_boundary()...`);
  let written = 0;
  for (const row of rows) {
    const { error } = await supabase.rpc("ingest_la_boundary", {
      p_gss_code: row.gss_code,
      p_name: row.name,
      p_geom_geojson: row.geom_geojson,
      p_source_dataset: row.source_dataset,
    });
    if (error) throw new Error(`ingest_la_boundary(${row.gss_code}) failed: ${error.message}`);
    written++;
  }
  console.log(`Done -- ${written} boundary rows written to la_boundaries.`);
}

main().catch((e) => {
  console.error("[ingest-la-boundaries] failed:", e);
  process.exit(1);
});
