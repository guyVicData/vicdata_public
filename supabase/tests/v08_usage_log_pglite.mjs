// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_usage_log_pglite.mjs
// VicData 0.8 shell + SMT r1, B7: the usage log (20261109090000_v08_usage_log.sql). Local only
// (WASM Postgres) over a stub of the live membership table; never touches a real database.
// Checks: the server role writes and counts; anon and members can neither read nor write either
// table, nor call the counter; the counter adds one per call per school per day.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);

// Supabase's roles: anon and authenticated are subject to RLS; service_role bypasses it.
await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create table public.school_memberships (id uuid primary key default gen_random_uuid(), roles text[] not null default array['teacher']);
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on sequences to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
const M = "20261109090000_v08_usage_log.sql";
await ex(readFileSync(repo + M, "utf8"));
console.log("applied", M);

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (role, fn) => { await ex(`set role ${role}`); try { return await fn(); } finally { await ex("reset role"); } };
const denied = async (role, sql) => { try { await as(role, () => q(sql)); return false; } catch (e) { return /permission denied|row-level security/i.test(e.message); } };

const mid = (await q(`insert into school_memberships default values returning id`)).rows[0].id;
const ev = `insert into usage_events (membership_id, role, school_urn, product, event, dashboard, view, level, set_kind) values ('${mid}', 'smt', '137625', 'smt', 'page_view', 'vicdata.smt.overview', null, 'whole', 'nearest')`;

console.log("\n-- the server role");
check("writes an event", (await as("service_role", () => q(ev + " returning id"))).rows.length === 1);
check("counts a public page view", (await as("service_role", () => q(`select count_public_page_view('137625')`))).rows.length === 1);
await as("service_role", () => q(`select count_public_page_view('137625')`));
await as("service_role", () => q(`select count_public_page_view('110110')`));
const counts = (await q(`select school_urn, views from public_page_daily_views order by school_urn`)).rows;
check("one row per school per day, one more per view", JSON.stringify(counts) === JSON.stringify([{ school_urn: "110110", views: 1 }, { school_urn: "137625", views: 2 }]), JSON.stringify(counts));

for (const role of ["anon", "authenticated"]) {
  console.log(`\n-- ${role}`);
  check("can't write an event", await denied(role, ev));
  check("can't read events", await denied(role, `select * from usage_events`));
  check("can't change or delete events", (await denied(role, `update usage_events set role = 'x'`)) && (await denied(role, `delete from usage_events`)));
  check("can't read the page counts", await denied(role, `select * from public_page_daily_views`));
  check("can't write the page counts", await denied(role, `insert into public_page_daily_views values ('1', current_date, 99)`));
  check("can't call the counter", await denied(role, `select count_public_page_view('137625')`));
}

console.log("\n-- the shape");
check("RLS is on for both tables", (await q(`select bool_and(relrowsecurity) ok from pg_class where relname in ('usage_events', 'public_page_daily_views')`)).rows[0].ok === true);
check("neither table has a policy (nobody reads through the API)", (await q(`select count(*)::int n from pg_policies where tablename in ('usage_events', 'public_page_daily_views')`)).rows[0].n === 0);
const bad = async (sql) => { try { await q(sql); return false; } catch { return true; } };
check("an unknown product or event is refused", (await bad(ev.replace("'smt', 'page_view'", "'public', 'page_view'"))) && (await bad(ev.replace("'page_view'", "'click'"))));
await q(`delete from school_memberships where id = '${mid}'`);
check("deleting a membership keeps its events, unlinked", (await q(`select count(*)::int n from usage_events where membership_id is null and role = 'smt'`)).rows[0].n === 1);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
