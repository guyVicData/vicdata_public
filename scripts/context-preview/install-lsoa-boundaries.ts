// VicData 0.8 SMT round 3 (K0, R-SMT-CONTEXT-GEOGRAPHY): Context's map "with the boundaries loaded",
// before they are. Preload into a capture or rule process:
//   npx -y tsx --env-file=.env --import ./scripts/context-preview/install-lsoa-boundaries.ts <script> ...
//
// Wraps fetch so the app database's two read RPCs answer as lsoa_boundaries would once
// scripts/ingest-lsoa-boundaries.ts has loaded it -- from ONS's own service, the same dataset
// (LSOA December 2021 BGC V5, England), read-only:
//   lsoa_boundaries_near(p_easting, p_northing, p_metres)  -> the LSOAs whose boundary comes within
//                                                            p_metres of the point (ONS's spatial query)
//   lsoa_boundaries_geojson(p_gss_codes)                   -> name, GeoJSON (5 dp), area in hectares
// The SQL itself is tested in PGlite with PostGIS (supabase/tests/v08_smt_r3_lsoa_boundaries_pglite.mjs);
// this only stands in for the table's rows. Every other request goes through untouched.

const DATASET = "Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5";
const QUERY = `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/${DATASET}/FeatureServer/0/query`;
const PAGE = 2000;

type Ring = [number, number][];
type Geom = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

async function ons(params: Record<string, string>, real: typeof fetch): Promise<{ features: { properties?: Record<string, string>; attributes?: Record<string, string>; geometry: Geom | null }[]; exceededTransferLimit?: boolean }> {
  for (let attempt = 1; ; attempt++) {
    const res = await real(QUERY, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
    const body = (await res.json()) as { features?: never[]; error?: unknown; exceededTransferLimit?: boolean };
    if (res.ok && body.features) return body as never;
    if (attempt >= 3) throw new Error(`ONS ${DATASET}: ${JSON.stringify(body.error ?? res.status).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

// A ring's area on the sphere (m²), for areas of a few km²: a local equirectangular projection.
function ringArea(ring: Ring): number {
  const R = 6371008.8;
  const lat0 = (ring.reduce((t, p) => t + p[1], 0) / ring.length) * (Math.PI / 180);
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [ring[i][0] * (Math.PI / 180) * R * Math.cos(lat0), ring[i][1] * (Math.PI / 180) * R];
    const [x2, y2] = [ring[i + 1][0] * (Math.PI / 180) * R * Math.cos(lat0), ring[i + 1][1] * (Math.PI / 180) * R];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
const polyArea = (rings: Ring[]) => rings.reduce((t, r, i) => t + (i === 0 ? ringArea(r) : -ringArea(r)), 0);
const round5 = (g: unknown): unknown => (typeof g === "number" ? Math.round(g * 1e5) / 1e5 : Array.isArray(g) ? g.map(round5) : g);

export function installLsoaBoundaries(): () => void {
  const app = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!app) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = url.startsWith(app) ? /\/rest\/v1\/rpc\/(lsoa_boundaries_near|lsoa_boundaries_geojson)\b/.exec(url) : null;
    if (!m || typeof init?.body !== "string") return real(input, init);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    if (m[1] === "lsoa_boundaries_near") {
      const e = Number(body.p_easting), n = Number(body.p_northing), metres = Number(body.p_metres);
      // The cap: 32 km from 0.8 SMT r4 (20261113090000_v08_smt_r4_catchment.sql; 20 km before).
      if (!(metres > 0 && metres <= 32000)) return Response.json([]);
      const codes: string[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const r = await ons({ where: "LSOA21CD LIKE 'E01%'", geometry: JSON.stringify({ x: e, y: n, spatialReference: { wkid: 27700 } }), geometryType: "esriGeometryPoint", inSR: "27700", distance: String(metres), units: "esriSRUnit_Meter", spatialRel: "esriSpatialRelIntersects", outFields: "LSOA21CD", returnGeometry: "false", orderByFields: "LSOA21CD", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" }, real);
        for (const f of r.features) codes.push(String((f.attributes ?? f.properties)!.LSOA21CD));
        if (r.features.length < PAGE) break;
      }
      // PostgREST's Range header (the app reads in pages of 1,000), honoured as the real API does.
      const hdr = new Headers(init?.headers).get("Range");
      const rg = hdr ? /^(\d+)-(\d+)$/.exec(hdr) : null;
      const rows = codes.map((gss_code) => ({ gss_code }));
      return Response.json(rg ? rows.slice(Number(rg[1]), Number(rg[2]) + 1) : rows);
    }
    const asked = ((body.p_gss_codes as string[]) ?? []).filter((c) => /^E01\d{6}$/.test(c));
    if (asked.length > 5000) return Response.json([]);
    const out: { gss_code: string; name: string; geojson: string; area_ha: number }[] = [];
    for (let i = 0; i < asked.length; i += 250) {
      const chunk = asked.slice(i, i + 250);
      const r = await ons({ where: `LSOA21CD IN (${chunk.map((c) => `'${c}'`).join(",")})`, outFields: "LSOA21CD,LSOA21NM", outSR: "4326", f: "geojson", resultRecordCount: String(PAGE) }, real);
      for (const f of r.features) {
        if (!f.geometry) continue;
        const multi = (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]) as Ring[][];
        out.push({ gss_code: f.properties!.LSOA21CD, name: f.properties!.LSOA21NM, geojson: JSON.stringify({ type: "MultiPolygon", coordinates: round5(multi) }), area_ha: multi.reduce((t, p) => t + polyArea(p), 0) / 10000 });
      }
    }
    return Response.json(out);
  };
  return () => {
    globalThis.fetch = real;
  };
}

installLsoaBoundaries();
