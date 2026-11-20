// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_results_cache_pglite.mjs
// VicData 0.8 speed plan §4.2 item 2: 20261125090000_v08_results_cache.sql in PGlite (local WASM Postgres),
// through supabase/ops/results_cache/apply_results_cache.sql (the migration and its schema_migrations row).
// Proves: the table, its columns and indexes; RLS on with no policies; anon and authenticated can neither
// read nor write it, even where Supabase's default privileges grant every new public table to them (and
// even if a grant came back, RLS shows them nothing); the service role (BYPASSRLS, as on Supabase) reads
// and writes; the store's lookup, upsert, last_read_at touch and prune (src/lib/results-cache.ts,
// postgresStore) as SQL; applying twice is harmless; the rollback removes it. Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
let fails = 0;
const check = (name, ok, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};
const as = async (role, fn) => {
  await ex(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await ex(`reset role`);
  }
};
const error = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
};
process.on("unhandledRejection", (e) => {
  console.log("ERROR", e?.message ?? e);
  process.exit(1);
});

// Supabase's shape: the three API roles, schema_migrations, and default privileges that grant every new
// public table to anon and authenticated (which the migration must take back).
await ex(`create role anon; create role authenticated; create role service_role bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text);`);
const apply = readFileSync(root + "supabase/ops/results_cache/apply_results_cache.sql", "utf8");
const migration = readFileSync(root + "supabase/migrations/20261125090000_v08_results_cache.sql", "utf8");
check("apply_results_cache.sql holds the migration verbatim", apply.includes(migration.trim()));
await ex(apply);
console.log("applied supabase/ops/results_cache/apply_results_cache.sql");

console.log("-- table");
const cols = (await q(`select column_name, data_type, is_nullable from information_schema.columns where table_name = 'results_cache' order by ordinal_position`)).rows;
check("columns", cols.map((c) => `${c.column_name}:${c.data_type}`).join(",") === "key:text,value:text,data_version:text,code_version:text,bytes:integer,built_ms:integer,created_at:timestamp with time zone,last_read_at:timestamp with time zone", cols.map((c) => c.column_name).join(","));
check("every column not null", cols.every((c) => c.is_nullable === "NO"));
const idx = (await q(`select indexname from pg_indexes where tablename = 'results_cache' order by indexname`)).rows.map((r) => r.indexname);
check("primary key and three indexes", idx.join(",") === "results_cache_created_idx,results_cache_last_read_idx,results_cache_pkey,results_cache_versions_idx", idx.join(","));
check("RLS enabled", (await q(`select relrowsecurity from pg_class where relname = 'results_cache'`)).rows[0].relrowsecurity === true);
check("no policies", (await q(`select count(*)::int n from pg_policies where tablename = 'results_cache'`)).rows[0].n === 0);
check("recorded in schema_migrations", (await q(`select name from supabase_migrations.schema_migrations where version = '20261125090000'`)).rows[0]?.name === "v08_results_cache");
check("value is text, stored EXTENDED (compressed when large)", (await q(`select attstorage from pg_attribute where attrelid = 'public.results_cache'::regclass and attname = 'value'`)).rows[0].attstorage === "x");

console.log("-- the service role (the app's server) writes and reads");
const VAL = JSON.stringify({ zeta: 1, alpha: [3, 1, 2], nested: { b: "x", a: null } });
await as("service_role", () => q(`insert into results_cache (key, value, data_version, code_version, bytes, built_ms) values ('smt/academic|110110|abc', $1, 'd1', 'c1', $2, 9000)`, [VAL, Buffer.byteLength(VAL)]));
const read = await as("service_role", async () => (await q(`select value from results_cache where key = $1 and data_version = $2 and code_version = $3 and created_at >= $4`, ["smt/academic|110110|abc", "d1", "c1", new Date(Date.now() - 86400_000).toISOString()])).rows);
check("the lookup (key + both versions + max age) finds it", read.length === 1);
check("the value comes back byte for byte (key order kept: text, not jsonb)", read[0]?.value === VAL, read[0]?.value);
for (const [dv, cv] of [["d2", "c1"], ["d1", "c2"]]) {
  const r = await as("service_role", async () => (await q(`select 1 from results_cache where key = $1 and data_version = $2 and code_version = $3`, ["smt/academic|110110|abc", dv, cv])).rows);
  check(`another version (${dv}, ${cv}) misses`, r.length === 0);
}
const tooOld = await as("service_role", async () => (await q(`select 1 from results_cache where key = $1 and data_version = 'd1' and code_version = 'c1' and created_at >= $2`, ["smt/academic|110110|abc", new Date(Date.now() + 1000).toISOString()])).rows);
check("past the maximum age misses", tooOld.length === 0);
// The upsert on conflict (key): a new version replaces the old row in place.
await as("service_role", () => q(`insert into results_cache (key, value, data_version, code_version, bytes, built_ms, created_at, last_read_at) values ('smt/academic|110110|abc', '{"v":2}', 'd2', 'c1', 7, 800, now(), now())
  on conflict (key) do update set value = excluded.value, data_version = excluded.data_version, code_version = excluded.code_version, bytes = excluded.bytes, built_ms = excluded.built_ms, created_at = excluded.created_at, last_read_at = excluded.last_read_at`));
const after = (await q(`select value, data_version from results_cache where key = 'smt/academic|110110|abc'`)).rows;
check("the upsert replaces the row (one per key)", after.length === 1 && after[0].value === '{"v":2}' && after[0].data_version === "d2");
await as("service_role", () => q(`update results_cache set last_read_at = $1 where key = $2`, ["2026-11-20T12:00:00Z", "smt/academic|110110|abc"]));
check("the touch updates last_read_at", (await q(`select last_read_at = '2026-11-20T12:00:00Z'::timestamptz ok from results_cache where key = 'smt/academic|110110|abc'`)).rows[0].ok === true);

console.log("-- anon and authenticated: nothing");
for (const role of ["anon", "authenticated"]) {
  check(`${role} can't select`, /permission denied/.test((await as(role, () => error(() => q(`select * from results_cache`)))) ?? ""));
  check(`${role} can't insert`, /permission denied/.test((await as(role, () => error(() => q(`insert into results_cache (key, value, data_version, code_version, bytes, built_ms) values ('x','{}','d','c',2,1)`)))) ?? ""));
  check(`${role} can't update`, /permission denied/.test((await as(role, () => error(() => q(`update results_cache set value = '{}'`)))) ?? ""));
  check(`${role} can't delete`, /permission denied/.test((await as(role, () => error(() => q(`delete from results_cache`)))) ?? ""));
}
// Belt and braces: even if a grant came back (a later blanket grant), RLS with no policies shows nothing.
await ex(`grant select, insert, update, delete on public.results_cache to anon, authenticated`);
for (const role of ["anon", "authenticated"]) {
  const rows = await as(role, async () => (await q(`select * from results_cache`)).rows);
  check(`${role} with a grant still reads no rows (RLS)`, rows.length === 0);
  check(`${role} with a grant still can't insert (RLS)`, /row-level security/.test((await as(role, () => error(() => q(`insert into results_cache (key, value, data_version, code_version, bytes, built_ms) values ('y','{}','d','c',2,1)`)))) ?? ""));
  const del = await as(role, async () => (await q(`delete from results_cache returning key`)).rows);
  check(`${role} with a grant deletes nothing (RLS)`, del.length === 0);
}
await ex(`revoke all on public.results_cache from anon, authenticated`);
check("the row is still there", (await q(`select count(*)::int n from results_cache`)).rows[0].n === 1);

console.log("-- prune (postgresStore.prune's two deletes)");
await ex(`delete from results_cache`);
const ins = (key, dv, cv, created, read) => q(`insert into results_cache (key, value, data_version, code_version, bytes, built_ms, created_at, last_read_at) values ($1, '{}', $2, $3, 2, 900, $4, $5)`, [key, dv, cv, created, read]);
const T = Date.parse("2026-11-20T12:00:00Z");
const ago = (ms) => new Date(T - ms).toISOString();
const H = 3600_000;
await ins("current", "d", "c", ago(H), ago(H));
await ins("old-code", "d", "c-old", ago(H), ago(H));
await ins("old-data", "d-old", "c", ago(H), ago(H));
await ins("new-other-instance", "d", "c-next", ago(5 * 60_000), ago(5 * 60_000));
await ins("expired", "d", "c", ago(25 * H), ago(H));
await ins("unread", "d", "c", ago(H), ago(61 * 24 * H));
await as("service_role", async () => {
  await q(`delete from results_cache where (data_version <> $1 or code_version <> $2) and created_at < $3`, ["d", "c", ago(15 * 60_000)]);
  await q(`delete from results_cache where created_at < $1 or last_read_at < $2`, [ago(24 * H), ago(60 * 24 * H)]);
});
const left = (await q(`select key from results_cache order by key`)).rows.map((r) => r.key).join(",");
check("prune keeps the current row and another version's row made in the last 15 minutes", left === "current,new-other-instance", left);

console.log("-- idempotent, then rollback");
await ex(apply);
check("applying twice is harmless", (await q(`select count(*)::int n from results_cache`)).rows[0].n === 2 && (await q(`select count(*)::int n from supabase_migrations.schema_migrations`)).rows[0].n === 1);
await ex(readFileSync(root + "supabase/ops/results_cache/rollback_results_cache.sql", "utf8"));
check("rollback drops the table", (await q(`select to_regclass('public.results_cache') r`)).rows[0].r === null);
check("rollback removes the schema_migrations row", (await q(`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261125090000'`)).rows[0].n === 0);
await ex(apply);
check("and it applies again after the rollback", (await q(`select to_regclass('public.results_cache') r`)).rows[0].r === "results_cache");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
