#!/usr/bin/env -S npx tsx
// Map round (2026-09-12), Part 2 Stage B (Nation scope's region tier + zoom-drill).
// One-off ingest of real ONS region boundary polygons into region_boundaries
// (20261013091000_region_boundaries.sql) -- same pattern as
// scripts/ingest-la-boundaries.ts, same real ONS host, a different (smaller, 9-row)
// FeatureServer.
//
// Usage: npx tsx --env-file=.env scripts/ingest-region-boundaries.ts
//
// Endpoint/fields confirmed live before writing this script (not assumed):
// Regions_December_2023_Boundaries_EN_BFC, layer 0, fields RGN23CD/RGN23NM,
// geometryType esriGeometryPolygon, maxRecordCount 2000 (comfortably above the real
// 9-feature total -- no pagination needed). English-only dataset by design (no Welsh
// region entry) -- region_boundaries's own migration comment explains why Stage B's
// Nation-scope logic doesn't need one.

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";

const FEATURE_SERVER_URL =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Regions_December_2023_Boundaries_EN_BFC/FeatureServer/0/query";
const SOURCE_DATASET = "Regions_December_2023_Boundaries_EN_BFC";

type GeoJsonFeature = {
  properties: { RGN23CD: string; RGN23NM: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

async function fetchAllBoundaries(): Promise<GeoJsonFeature[]> {
  const url = `${FEATURE_SERVER_URL}?where=1=1&outFields=RGN23CD,RGN23NM&outSR=4326&f=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ONS FeatureServer query failed: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { features: GeoJsonFeature[] };
  return body.features;
}

// Same normalisation as ingest-la-boundaries.ts's own toMultiPolygonGeoJson -- a bare
// Polygon becomes a single-polygon MultiPolygon, matching region_boundaries.geom's
// column type.
function toMultiPolygonGeoJson(geom: GeoJsonFeature["geometry"]): { type: "MultiPolygon"; coordinates: unknown } {
  if (geom.type === "MultiPolygon") return geom as { type: "MultiPolygon"; coordinates: unknown };
  return { type: "MultiPolygon", coordinates: [geom.coordinates] };
}

async function main() {
  console.log("Fetching all English region boundaries from ONS Open Geography...");
  const features = await fetchAllBoundaries();
  console.log(`Fetched ${features.length} real features.`);
  if (features.length !== 9) {
    // Sanity check, not a guess -- this dataset is real, static, English-region-only
    // geography with an exactly-known real count (confirmed live before writing this
    // script). Any other count means the service returned something unexpected;
    // better to fail loudly than silently store a wrong set.
    throw new Error(`Expected exactly 9 English regions, got ${features.length}. Refusing to ingest.`);
  }

  const supabase = createServiceRoleSupabaseClient();
  console.log(`Writing ${features.length} rows via ingest_region_boundary()...`);
  let written = 0;
  for (const f of features) {
    const { error } = await supabase.rpc("ingest_region_boundary", {
      p_gss_code: f.properties.RGN23CD,
      p_name: f.properties.RGN23NM,
      p_geom_geojson: JSON.stringify(toMultiPolygonGeoJson(f.geometry)),
      p_source_dataset: SOURCE_DATASET,
    });
    if (error) throw new Error(`ingest_region_boundary(${f.properties.RGN23CD}) failed: ${error.message}`);
    written++;
  }
  console.log(`Done -- ${written} region boundary rows written to region_boundaries.`);
}

main().catch((e) => {
  console.error("[ingest-region-boundaries] failed:", e);
  process.exit(1);
});
