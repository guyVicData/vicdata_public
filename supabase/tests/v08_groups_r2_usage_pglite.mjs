// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_groups_r2_usage_pglite.mjs
// VicData 0.8 groups r2: 20261114090000_v08_groups_r2_usage.sql on top of the usage log
// (20261109090000). Local only (WASM Postgres). Checks: it applies twice; "groups" events are accepted;
// the old products still are; anything else is still refused; anon and members still can't write or read.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create table public.school_memberships (id uuid primary key default gen_random_uuid(), roles text[] not null default array['teacher']);
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on sequences to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
`);
process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
await ex(readFileSync(repo + "20261109090000_v08_usage_log.sql", "utf8"));
const M = readFileSync(repo + "20261114090000_v08_groups_r2_usage.sql", "utf8");
await ex(M);
await ex(M);
let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
check("applies twice", true);
const as = async (role, fn) => { await ex(`set role ${role}`); try { return await fn(); } finally { await ex("reset role"); } };
const tryIns = async (role, product) => { try { await as(role, () => q(`insert into usage_events (role, school_urn, product, event, dashboard, level, set_kind) values ('smt', '140985', '${product}', 'page_view', 'vicdata.groups.overview', 'all/at_time', 'peer_band')`)); return null; } catch (e) { return e.message; } };
check("the server role writes a groups event", (await tryIns("service_role", "groups")) === null);
for (const p of ["teacher", "admissions", "smt"]) check(`still accepts ${p}`, (await tryIns("service_role", p)) === null);
check("still refuses anything else", /check/i.test((await tryIns("service_role", "group")) ?? ""));
for (const role of ["anon", "authenticated"]) {
  check(`${role} can't write a groups event`, /permission denied|row-level security/i.test((await tryIns(role, "groups")) ?? ""));
  let read = null; try { await as(role, () => q(`select * from usage_events`)); } catch (e) { read = e.message; }
  check(`${role} can't read events`, /permission denied|row-level security/i.test(read ?? ""));
}
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
