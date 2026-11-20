// Run from the repo root: node supabase/tests/v08_smt_census_figures_pglite.mjs   (ROLLBACK=1 also runs the rollback)
// Speed plan 4.2 item 1, extended to the Overview: smt_school_figures' census stage (20261125110000_v08_smt_census_figures.sql,
// over 20261125100000). Local only (WASM Postgres); never touches a real database. Checks: the census stage is
// accepted and any other unknown stage still refused; the read answers null until the census build is complete,
// only the asked schools, the figures exactly as written (jsonb round trip: nulls, arrays, keys); a census build
// doesn't answer as ks4/ks5 and isn't touched by their builds; anon and authenticated still can't read, write or
// call; the rollback removes only the census builds and leaves SMT Academic's figures.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
`);
process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
const BASE = "20261125100000_v08_smt_school_figures.sql";
const M = "20261125110000_v08_smt_census_figures.sql";
await ex(readFileSync(repo + "migrations/" + BASE, "utf8"));
await ex(readFileSync(repo + "migrations/" + M, "utf8"));
console.log("applied", BASE, M);

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (role, fn) => { await ex(`set role ${role}`); try { return await fn(); } finally { await ex("reset role"); } };
const denied = async (role, sql) => { try { await as(role, () => q(sql)); return false; } catch (e) { return /permission denied|row-level security/i.test(e.message); } };
const refused = async (sql) => { try { await as("service_role", () => q(sql)); return false; } catch (e) { return /check constraint/i.test(e.message); } };
const read = (role, stage, version, urns) => as(role, () => q(`select smt_school_figures_read($1, $2, $3, 0, null, null, null) as r`, [stage, version, urns])).then((x) => x.rows[0].r);

const figs = {
  "100001": { c: [[2019, 650, 480, 170], [2020, 655, 490, 165], [2024, 700, 520, 180]], b: { secondary: 420, sixth_form: 280 }, k: [[2019, 80], [2020, null], [2024, 92]] },
  "100002": { c: [[2023, 1200], [2024, 1180]], b: { secondary: 1180 }, k: [[2023, 240], [2024, 236]] },
  "100003": { c: [], b: {}, k: [] },
};
console.log("\n-- the service role writes a census build");
await as("service_role", async () => {
  await q(`insert into smt_figures_builds (stage, data_version, status) values ('census', 'c1', 'building')`);
  await q(`insert into smt_figures_builds (stage, data_version, status) values ('ks5', 'k1', 'complete')`);
  const rows = Object.entries(figs).map(([urn, figures]) => ({ urn, period: 0, figures, subjects: null, va: null }));
  await q(`insert into smt_school_figures (stage, data_version, urn, period, figures, subjects, va)
           select 'census', 'c1', r.urn, r.period, r.figures, r.subjects, r.va from json_to_recordset($1::json) as r(urn text, period int, figures jsonb, subjects jsonb, va jsonb)`, [JSON.stringify(rows)]);
  await q(`insert into smt_school_figures (stage, data_version, urn, period, figures) values ('ks5', 'k1', '100001', 0, '{"e":0}')`);
});
check("an unknown stage is still refused", await refused(`insert into smt_figures_builds (stage, data_version, status) values ('ks2', 'x', 'building')`));
check("null while the census build isn't complete", (await read("service_role", "census", "c1", ["100001"])) === null);
await as("service_role", () => q(`update smt_figures_builds set status = 'complete' where stage = 'census' and data_version = 'c1'`));
const got = await read("service_role", "census", "c1", ["100001", "100002", "100003", "999999"]);
check("complete: one row per asked school that was built", got.length === 3 && got.every((g) => g.p === 0), JSON.stringify(got.map((g) => [g.u, g.p])));
// jsonb keeps its own key order (the app reads figures by key, never by order); arrays and numbers come back as written.
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
check("figures come back exactly as written (keys in any order)", got.every((g) => JSON.stringify(canon(g.f)) === JSON.stringify(canon(figs[g.u]))), JSON.stringify(got.find((g) => g.u === "100001").f));
check("no subject or value-added rows", got.every((g) => g.s === null && g.v === null));
check("another version reads null", (await read("service_role", "census", "c2", ["100001"])) === null);
check("the census build doesn't answer as ks5", JSON.stringify((await read("service_role", "ks5", "c1", ["100001"]))) === "null");
check("ks5's build answers only its own rows", (await read("service_role", "ks5", "k1", ["100001"])).every((g) => g.f.e === 0 && g.f.c === undefined));

console.log("\n-- anon and authenticated: nothing");
for (const role of ["anon", "authenticated"]) {
  check(`${role} can't read figures`, await denied(role, `select * from smt_school_figures`));
  check(`${role} can't write a census build`, await denied(role, `insert into smt_figures_builds (stage, data_version, status) values ('census', 'x', 'complete')`));
  check(`${role} can't call the read`, await denied(role, `select smt_school_figures_read('census', 'c1', array['100001'], 0, null, null, null)`));
}
check("RLS still on both tables", (await q(`select bool_and(relrowsecurity) as on from pg_class where oid in ('public.smt_school_figures'::regclass, 'public.smt_figures_builds'::regclass)`)).rows[0].on === true);
check("still no policies", (await q(`select count(*)::int as n from pg_policies where tablename in ('smt_school_figures', 'smt_figures_builds')`)).rows[0].n === 0);

console.log("\n-- a ks5 build's clean-up leaves the census build");
await as("service_role", () => q(`delete from smt_figures_builds where stage = 'ks5' and data_version <> 'k2'`));
check("census rows survive another stage's clean-up", (await q(`select count(*)::int as n from smt_school_figures where stage = 'census'`)).rows[0].n === 3);

if (process.env.ROLLBACK === "1") {
  console.log("\n-- rollback");
  await as("service_role", () => q(`insert into smt_figures_builds (stage, data_version, status) values ('ks4', 'k4', 'complete')`));
  await as("service_role", () => q(`insert into smt_school_figures (stage, data_version, urn, period, figures) values ('ks4', 'k4', '100001', 0, '{"e":0}')`));
  await ex(`create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, name text); insert into supabase_migrations.schema_migrations values ('20261125110000', 'v08_smt_census_figures') on conflict do nothing;`);
  await ex(readFileSync(repo + "ops/smt_census_figures/rollback_smt_census_figures.sql", "utf8"));
  const left = (await q(`select (select count(*)::int from smt_school_figures where stage = 'census') as census, (select count(*)::int from smt_school_figures where stage = 'ks4') as ks4, (select count(*)::int from supabase_migrations.schema_migrations where version = '20261125110000') as rec`)).rows[0];
  check("rollback removes the census figures and the record, keeps Academic's", left.census === 0 && left.ks4 === 1 && left.rec === 0, JSON.stringify(left));
  check("after the rollback the census stage is refused", await refused(`insert into smt_figures_builds (stage, data_version, status) values ('census', 'x', 'building')`));
  await ex(readFileSync(repo + "ops/smt_census_figures/apply_smt_census_figures.sql", "utf8"));
  check("the apply runs again after the rollback", !(await refused(`insert into smt_figures_builds (stage, data_version, status) values ('census', 'x', 'building')`)));
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
