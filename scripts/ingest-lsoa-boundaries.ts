#!/usr/bin/env -S npx tsx
// VicData 0.8 SMT round 3 (K0): load ONS's LSOA (December 2021) boundaries for England into
// lsoa_boundaries (20261111090000_v08_smt_r3_lsoa_boundaries.sql), once. Static geography: re-run
// only when ONS changes the boundaries. Follows scripts/ingest-la-boundaries.ts.
//
// Usage (Guy, after the migration is applied): npx tsx --env-file=.env scripts/ingest-lsoa-boundaries.ts
//
// Source: ONS Open Geography Portal, "Lower layer Super Output Areas (December 2021) Boundaries EW
// BGC (V5)" -- generalised to 20 m, the version that keeps an inner-London LSOA readable at the
// 5-mile zoom (the super-generalised BSC draws it in about 8 points). England only (E01...,
// 33,755); the service caps a page at 2,000, so it is read in pages, in a fixed order. Requested in
// WGS84 (outSR=4326), as Leaflet plots. Writes through ingest_lsoa_boundary(), the only write path
// (service role), a few at a time. Nothing is written unless all 33,755 arrive.

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";

const SOURCE_DATASET = "Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5";
const FEATURE_SERVER_URL = `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/${SOURCE_DATASET}/FeatureServer/0/query`;
const EXPECTED_ENGLAND = 33_755;
const PAGE = 2000;
const IN_FLIGHT = 12;

type Feature = {
  properties: { LSOA21CD: string; LSOA21NM: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } | null;
};

async function page(offset: number): Promise<Feature[]> {
  const qs = new URLSearchParams({
    where: "LSOA21CD LIKE 'E01%'",
    outFields: "LSOA21CD,LSOA21NM",
    outSR: "4326",
    f: "geojson",
    orderByFields: "LSOA21CD",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
  });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${FEATURE_SERVER_URL}?${qs}`);
    if (res.ok) {
      const body = (await res.json()) as { features?: Feature[]; error?: unknown };
      if (body.features) return body.features;
      if (attempt >= 3) throw new Error(`ONS page at ${offset}: ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
    } else if (attempt >= 3) throw new Error(`ONS page at ${offset}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const toMulti = (g: NonNullable<Feature["geometry"]>) => (g.type === "MultiPolygon" ? g : { type: "MultiPolygon", coordinates: [g.coordinates] });

async function main() {
  console.log(`Reading ${SOURCE_DATASET} (England) from ONS Open Geography...`);
  const features: Feature[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const f = await page(offset);
    features.push(...f);
    process.stdout.write(`  ${features.length.toLocaleString()} read\r`);
    if (f.length < PAGE) break;
  }
  console.log();
  const codes = new Set(features.map((f) => f.properties.LSOA21CD));
  const withGeometry = features.filter((f) => f.geometry && /^E01\d{6}$/.test(f.properties.LSOA21CD));
  if (codes.size !== EXPECTED_ENGLAND || withGeometry.length !== EXPECTED_ENGLAND) {
    throw new Error(`Expected ${EXPECTED_ENGLAND} English LSOAs with boundaries; read ${features.length} (${codes.size} distinct, ${withGeometry.length} with a geometry). Nothing written.`);
  }

  const supabase = createServiceRoleSupabaseClient();
  let written = 0;
  let next = 0;
  const worker = async () => {
    while (next < withGeometry.length) {
      const f = withGeometry[next++];
      const { error } = await supabase.rpc("ingest_lsoa_boundary", {
        p_gss_code: f.properties.LSOA21CD,
        p_name: f.properties.LSOA21NM,
        p_geom_geojson: JSON.stringify(toMulti(f.geometry!)),
        p_source_dataset: SOURCE_DATASET,
      });
      if (error) throw new Error(`ingest_lsoa_boundary(${f.properties.LSOA21CD}) failed: ${error.message}`);
      if (++written % 1000 === 0) process.stdout.write(`  ${written.toLocaleString()} written\r`);
    }
  };
  await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
  console.log(`\nDone: ${written.toLocaleString()} LSOA boundaries written to lsoa_boundaries.`);
}

main().catch((e) => {
  console.error("[ingest-lsoa-boundaries] failed:", e);
  process.exit(1);
});
