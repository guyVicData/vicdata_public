// VicData 0.8 SMT round 3 (K0): lsoa_boundaries, its load RPC and its two read RPCs
// (20261111090000_v08_smt_r3_lsoa_boundaries.sql). Local only (WASM Postgres with PostGIS); never
// touches a real database.
//
// PostGIS needs a newer PGlite than the other tests here (0.2 has no PostGIS), so install the two
// packages into a folder of their own and point PGLITE_DIR at it:
//   d=$(mktemp -d) && (cd $d && npm i --no-audit --no-fund @electric-sql/pglite@0.5.5 @electric-sql/pglite-postgis@0.2.5) && PGLITE_DIR=$d node supabase/tests/v08_smt_r3_lsoa_boundaries_pglite.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = process.env.PGLITE_DIR;
if (!dir) throw new Error("PGLITE_DIR is not set (see the header)");
const mod = (p) => import(pathToFileURL(path.join(dir, "node_modules", p)).href);
const { PGlite } = await mod("@electric-sql/pglite/dist/index.js");
const { postgis } = await mod("@electric-sql/pglite-postgis/dist/index.js");

const db = await PGlite.create({ extensions: { postgis } });
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const as = async (role, fn) => {
  await ex(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await ex("reset role");
  }
};
const denied = async (role, sql, p) => {
  try {
    await as(role, () => q(sql, p));
    return false;
  } catch {
    return true;
  }
};

await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
`);
await ex(readFileSync(new URL("../migrations/20261111090000_v08_smt_r3_lsoa_boundaries.sql", import.meta.url), "utf8"));

// Three made-up neighbourhoods near Acland Burghley (NW5 1UJ, BNG 529090 185690), each a square
// drawn in British National Grid metres and stored in WGS84, as the load script stores ONS's.
const square = (e, n, side) => `ST_AsGeoJSON(ST_Transform(ST_MakeEnvelope(${e}, ${n}, ${e + side}, ${n + side}, 27700), 4326))`;
const SCHOOL = { e: 529090, n: 185690 };
const cases = [
  { code: "E01000001", name: "Camden 001A", e: SCHOOL.e - 250, n: SCHOOL.n - 250, side: 500 }, // round the school: 25 ha
  { code: "E01000002", name: "Camden 001B", e: SCHOOL.e + 7000, n: SCHOOL.n, side: 400 }, // 7 km east
  { code: "E01000003", name: "Islington 001A", e: SCHOOL.e + 12000, n: SCHOOL.n, side: 400 }, // 12 km east
];
for (const c of cases) {
  const g = (await q(`select ${square(c.e, c.n, c.side)} g`)).rows[0].g;
  await as("service_role", () => q("select public.ingest_lsoa_boundary($1, $2, $3, 'test')", [c.code, c.name, g]));
}

ok("RLS is on", (await q("select relrowsecurity r from pg_class where relname = 'lsoa_boundaries'")).rows[0].r === true);
ok("GiST index on geom", (await q("select count(*)::int n from pg_indexes where tablename = 'lsoa_boundaries' and indexdef ilike '%gist%'")).rows[0].n === 1);
ok("service role loads three rows", (await q("select count(*)::int n from public.lsoa_boundaries")).rows[0].n === 3);
ok("geometry is MultiPolygon, 4326", (await q("select bool_and(GeometryType(geom) = 'MULTIPOLYGON' and ST_SRID(geom) = 4326) b from public.lsoa_boundaries")).rows[0].b === true);

// The load RPC: service role only, English LSOA codes only, a re-run replaces.
ok("anon can't call the load RPC", await denied("anon", "select public.ingest_lsoa_boundary('E01000009', 'x', '{\"type\":\"Point\",\"coordinates\":[0,51]}', 't')"));
ok("authenticated can't call the load RPC", await denied("authenticated", "select public.ingest_lsoa_boundary('E01000009', 'x', '{\"type\":\"Point\",\"coordinates\":[0,51]}', 't')"));
const gw = (await q(`select ${square(300000, 200000, 100)} g`)).rows[0].g;
ok("a Welsh code is refused", await denied("service_role", "select public.ingest_lsoa_boundary('W01000001', 'x', $1, 't')", [gw]));
const g1 = (await q(`select ${square(cases[0].e, cases[0].n, 500)} g`)).rows[0].g;
await as("service_role", () => q("select public.ingest_lsoa_boundary('E01000001', 'Camden 001A (renamed)', $1, 'test2')", [g1]));
ok("a re-run replaces, never duplicates", (await q("select count(*)::int n, max(name) m from public.lsoa_boundaries where gss_code = 'E01000001'")).rows[0].m === "Camden 001A (renamed)");

// Anyone reads; nobody but the service role writes.
ok("anon reads the table", (await as("anon", () => q("select count(*)::int n from public.lsoa_boundaries"))).rows[0].n === 3);
ok("anon can't insert", await denied("anon", "insert into public.lsoa_boundaries (gss_code, name, geom) values ('E01000009', 'x', ST_Multi(ST_GeomFromText('POLYGON((0 51,0 51.1,0.1 51.1,0 51))', 4326)))"));
const upd = await as("authenticated", () => q("update public.lsoa_boundaries set name = 'x' returning gss_code"));
ok("authenticated can't update (no policy: nothing changes)", upd.rows.length === 0 && (await q("select count(*)::int n from public.lsoa_boundaries where name = 'x'")).rows[0].n === 0);
const del = await as("anon", () => q("delete from public.lsoa_boundaries returning gss_code"));
ok("anon can't delete", del.rows.length === 0 && (await q("select count(*)::int n from public.lsoa_boundaries")).rows[0].n === 3);

// lsoa_boundaries_geojson: only what's asked for, with its area.
const gj = (await as("anon", () => q("select * from public.lsoa_boundaries_geojson($1)", [["E01000001", "E01000003", "E01999999"]]))).rows;
ok("geojson: only the codes asked for", gj.map((r) => r.gss_code).sort().join() === "E01000001,E01000003");
const a = gj.find((r) => r.gss_code === "E01000001");
ok("geojson: area in hectares (a 500 m square is 25 ha)", Math.abs(a.area_ha - 25) < 0.5, `${a.area_ha.toFixed(2)} ha`);
const parsed = JSON.parse(a.geojson);
ok("geojson: valid MultiPolygon at 5 dp", parsed.type === "MultiPolygon" && parsed.coordinates[0][0].every(([x, y]) => String(x).split(".")[1]?.length <= 5 && String(y).split(".")[1]?.length <= 5));
ok("geojson: more than 5,000 codes answers nothing", (await as("anon", () => q("select count(*)::int n from public.lsoa_boundaries_geojson($1)", [Array.from({ length: 5001 }, (_, i) => `E01${String(i).padStart(6, "0")}`)]))).rows[0].n === 0);

// lsoa_boundaries_near: by distance from a BNG point, capped.
const near = async (m) => (await as("anon", () => q("select gss_code from public.lsoa_boundaries_near($1, $2, $3) order by 1", [SCHOOL.e, SCHOOL.n, m]))).rows.map((r) => r.gss_code).join();
ok("near: 1 km finds the school's own", (await near(1000)) === "E01000001");
ok("near: 6 miles (9,656 m) finds the two within it", (await near(6 * 1609.344)) === "E01000001,E01000002");
ok("near: 13 km finds all three", (await near(13000)) === "E01000001,E01000002,E01000003");
ok("near: over 20 km answers nothing", (await near(20001)) === "");
ok("near: a non-positive radius answers nothing", (await near(0)) === "");

console.log(`\n${pass} / ${pass + fail} passed`);
process.exit(fail ? 1 : 0);
