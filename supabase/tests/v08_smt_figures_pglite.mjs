// Run from the repo root: node supabase/tests/v08_smt_figures_pglite.mjs   (ROLLBACK=1 also runs the rollback)
// Speed plan 4.2 item 1: smt_school_figures (20261125090000_v08_smt_school_figures.sql). Local only (WASM
// Postgres); never touches a real database. Checks: anon and authenticated can neither read nor write either
// table nor call the read; the service role writes and reads; the read answers null until the build is
// complete, only the asked schools and years, subject rows only for the school itself and the subject year;
// numbers come back exactly as written (the jsonb round trip); deleting a build deletes its rows.
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
const M = "20261125090000_v08_smt_school_figures.sql";
await ex(readFileSync(repo + "migrations/" + M, "utf8"));
console.log("applied", M);

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (role, fn) => { await ex(`set role ${role}`); try { return await fn(); } finally { await ex("reset role"); } };
const denied = async (role, sql) => { try { await as(role, () => q(sql)); return false; } catch (e) { return /permission denied|row-level security/i.test(e.message); } };
const read = (role, args) => as(role, () => q(`select smt_school_figures_read($1, $2, $3, $4, $5, $6, $7) as r`, args.length === 7 ? args : [...args, null])).then((x) => x.rows[0].r);

// Awkward doubles: shortest round-trip forms, an exponent, a long fraction.
const pts = [33.333333333333336, 0.1 + 0.2, 1e-7, 123456.78901234567, -0.4];
console.log("\n-- the service role writes a build");
await as("service_role", async () => {
  await q(`insert into smt_figures_builds (stage, data_version, status) values ('ks5', 'v1', 'building')`);
  const rows = [
    { urn: "100001", period: 0, figures: { e: 0 }, subjects: null, va: null },
    { urn: "100001", period: 2023, figures: { e: 10, g: { alevel: [10, pts[0]] } }, subjects: [["GCE A level", "Biology", "science", 10, pts[1], 0]], va: [] },
    { urn: "100001", period: 2024, figures: { e: 12, g: { alevel: [12, pts[2]] } }, subjects: [["GCE A level", "Biology", "science", 12, pts[3], 1]], va: [["GCE A level", "Biology", "", pts[4], -1, 0.2, 12, 0]] },
    { urn: "100002", period: 0, figures: { e: 0 }, subjects: null, va: null },
    { urn: "100002", period: 2024, figures: { e: 5 }, subjects: [["GCE A level", "Chemistry", null, 5, null, 0]], va: [] },
    { urn: "100002", period: 2020, figures: { e: 3 }, subjects: [], va: [] },
  ];
  await q(`insert into smt_school_figures (stage, data_version, urn, period, figures, subjects, va)
           select 'ks5', 'v1', r.urn, r.period, r.figures, r.subjects, r.va from json_to_recordset($1::json) as r(urn text, period int, figures jsonb, subjects jsonb, va jsonb)`, [JSON.stringify(rows)]);
});
check("null while the build isn't complete", (await read("service_role", ["ks5", "v1", ["100001"], 2021, 2024, "100001"])) === null);
await as("service_role", () => q(`update smt_figures_builds set status = 'complete' where data_version = 'v1'`));
const got = await read("service_role", ["ks5", "v1", ["100001", "100002", "999999"], 2021, 2024, "100001"]);
check("complete: every asked school's rows from the first year, markers included", got.length === 5, JSON.stringify(got.map((g) => [g.u, g.p])));
check("a year before the first is left out", !got.some((g) => g.u === "100002" && g.p === 2020));
check("the school itself: subject rows every year", got.filter((g) => g.u === "100001" && g.p > 0).every((g) => Array.isArray(g.s)));
check("a set school: subject rows for the subject year only", got.find((g) => g.u === "100002" && g.p === 2024).s.length === 1);
const other = await read("service_role", ["ks5", "v1", ["100001"], 2021, 2024, null]);
check("not the school itself: no subject rows outside the subject year", other.find((g) => g.p === 2023).s === null && Array.isArray(other.find((g) => g.p === 2024).s));
const a = got.find((g) => g.u === "100001" && g.p === 2023);
const b = got.find((g) => g.u === "100001" && g.p === 2024);
const back = [a.f.g.alevel[1], a.s[0][4], b.f.g.alevel[1], b.s[0][4], b.v[0][3]];
check("numbers come back exactly as written", back.every((v, i) => Object.is(v, pts[i])), JSON.stringify(back));
const dropped = await read("service_role", ["ks5", "v1", ["100001", "100002"], 2021, 2024, "100002", ["g"]]);
check("p_drop leaves those figure keys out for set schools", dropped.filter((g) => g.u === "100001" && g.p > 0).every((g) => g.f.g === undefined && g.f.e > 0));
check("p_drop keeps the school itself whole", dropped.find((g) => g.u === "100002" && g.p === 2024).f.e === 5);
check("another version reads null", (await read("service_role", ["ks5", "v2", ["100001"], 2021, 2024, null])) === null);
check("another key stage reads null", (await read("service_role", ["ks4", "v1", ["100001"], 2021, 2024, null])) === null);

console.log("\n-- anon and authenticated: nothing");
for (const role of ["anon", "authenticated"]) {
  check(`${role} can't read figures`, await denied(role, `select * from smt_school_figures`));
  check(`${role} can't read builds`, await denied(role, `select * from smt_figures_builds`));
  check(`${role} can't write figures`, await denied(role, `insert into smt_school_figures (stage, data_version, urn, period, figures) values ('ks5', 'v1', '1', 1, '{}')`));
  check(`${role} can't mark a build complete`, await denied(role, `update smt_figures_builds set status = 'complete'`));
  check(`${role} can't call the read`, await denied(role, `select smt_school_figures_read('ks5', 'v1', array['100001'], 2021, 2024, null, null)`));
}
check("RLS on both tables", (await q(`select bool_and(relrowsecurity) as on from pg_class where oid in ('public.smt_school_figures'::regclass, 'public.smt_figures_builds'::regclass)`)).rows[0].on === true);

console.log("\n-- a build's rows go with it");
await as("service_role", () => q(`delete from smt_figures_builds where data_version = 'v1'`));
check("deleting the build deletes its rows", (await q(`select count(*)::int as n from smt_school_figures`)).rows[0].n === 0);

if (process.env.ROLLBACK === "1") {
  console.log("\n-- rollback");
  await ex(`create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key); insert into supabase_migrations.schema_migrations values ('20261125090000') on conflict do nothing;`);
  await ex(readFileSync(repo + "ops/smt_figures/rollback_smt_figures.sql", "utf8"));
  const left = (await q(`select to_regclass('public.smt_school_figures') as a, to_regclass('public.smt_figures_builds') as b, to_regprocedure('public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])') as f, (select count(*)::int from supabase_migrations.schema_migrations where version = '20261125090000') as rec`)).rows[0];
  check("rollback removes both tables, the read and the record", !left.a && !left.b && !left.f && left.rec === 0, JSON.stringify(left));
  await ex(readFileSync(repo + "migrations/" + M, "utf8"));
  check("the migration applies again after the rollback", !!(await q(`select to_regclass('public.smt_school_figures') as a`)).rows[0].a);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
