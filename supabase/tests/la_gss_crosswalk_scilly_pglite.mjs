// GIAS refresh, 16 Oct 2026: la_gss_crosswalk's Isles of Scilly row renamed to GIAS's new spelling
// (20261115090000_la_gss_crosswalk_isles_of_scilly.sql). Local only (WASM Postgres); never touches a
// real database. The crosswalk is built by its own migrations (table, seed, region column) and
// region_nation_la_rollup is production's (20261013090000); schools, school_region_nation and
// school_current_snapshot are stubs with only the columns the rollup reads.
//
// Checks:
//   - the migration renames the one 420 row and leaves its codes and region alone; nothing else changes;
//   - it can be applied twice;
//   - a school with la_name 'Isles of Scilly' joins, and the LA rollup gives exactly one Scilly row,
//     named 'Isles of Scilly', counting both Scilly schools;
//   - before the migration (schools synced, crosswalk not yet renamed) Scilly is missing from the
//     rollup, which is why it is applied straight after sync-schools.js.
//
//   PGLITE_DIR=~/dev/vicdata_public node supabase/tests/la_gss_crosswalk_scilly_pglite.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = process.env.PGLITE_DIR;
if (!dir) throw new Error("PGLITE_DIR is not set (see the header)");
const { PGlite } = await import(pathToFileURL(path.join(dir, "node_modules", "@electric-sql/pglite/dist/index.js")).href);

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const mig = (f) => readFileSync(path.join(MIGRATIONS, f), "utf8");

let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond || !detail ? "" : ` -- ${detail}`}`);
  if (!cond) failed++;
};

const db = new PGlite();
await db.exec(`create role anon; create role authenticated;
  create table public.schools (urn text primary key, la_name text, status text, statutory_low_age int, statutory_high_age int);
  create table public.school_region_nation (urn text primary key, region_name text, region_code text, nation text);
  create table public.school_current_snapshot (urn text primary key, sector text, current_period int, anchor_period int,
    age_gender_counts jsonb, anchor_age_gender_counts jsonb, total_roll int, female_total int, boarding jsonb, boarders_gender_split jsonb);`);
for (const f of ["20260807107000_la_gss_crosswalk.sql", "20260807107500_la_gss_crosswalk_seed.sql",
  "20260828130000_la_gss_crosswalk_region.sql", "20261013090000_region_nation_la_rollup_all_regions.sql"]) {
  await db.exec(mig(f));
}
const FIX = mig("20261115090000_la_gss_crosswalk_isles_of_scilly.sql");

// Two Scilly schools as sync-schools.js leaves them after the 16 Oct promote, and a Cornwall one.
await db.exec(`
  insert into public.schools values ('108887', 'Isles of Scilly', 'open', 4, 16), ('108888', 'Isles of Scilly', 'open', 4, 11),
    ('111111', 'Cornwall', 'open', 11, 18);
  insert into public.school_region_nation select urn, 'South West', 'E12000009', 'england' from public.schools;
  insert into public.school_current_snapshot select urn, 'state', 2025, 2019, '[[10, 5, 6]]'::jsonb, '[[10, 4, 4]]'::jsonb, 11, 6, null, null
    from public.schools;`);

const all = async () => (await db.query("select dfe_code, la_name, gss_code, region from public.la_gss_crosswalk order by dfe_code")).rows;
const scillyRows = (rollup) => rollup.filter((r) => r.gssCode === "E06000053");
const rollup = async () => (await db.query("select public.region_nation_la_rollup('E12000009', null, null, null, null) r")).rows[0].r;

const before = await all();
const before420 = before.find((r) => r.dfe_code === "420");
ok("seed has the old spelling", before420?.la_name === "Isles Of Scilly", JSON.stringify(before420));
ok("before the migration, Scilly is missing from the rollup", scillyRows(await rollup()).length === 0);

await db.exec(FIX);
const after = await all();
const after420 = after.find((r) => r.dfe_code === "420");
ok("420 renamed, codes and region unchanged",
  after420.la_name === "Isles of Scilly" && after420.gss_code === before420.gss_code && after420.region === before420.region,
  JSON.stringify(after420));
ok("no other row changes", JSON.stringify(after.filter((r) => r.dfe_code !== "420")) === JSON.stringify(before.filter((r) => r.dfe_code !== "420")));
ok("same row count", after.length === before.length);

await db.exec(FIX);
ok("applies twice", JSON.stringify(await all()) === JSON.stringify(after));

const joined = (await db.query("select s.urn from public.schools s join public.la_gss_crosswalk l on l.la_name = s.la_name where s.la_name = 'Isles of Scilly'")).rows;
ok("a school with la_name 'Isles of Scilly' joins", joined.length === 2, JSON.stringify(joined));

const scilly = scillyRows(await rollup());
ok("LA rollup gives one Scilly row", scilly.length === 1, JSON.stringify(scilly));
ok("named 'Isles of Scilly', both schools counted", scilly[0]?.laName === "Isles of Scilly" && scilly[0]?.schoolCount === 2, JSON.stringify(scilly));

await db.close();
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
