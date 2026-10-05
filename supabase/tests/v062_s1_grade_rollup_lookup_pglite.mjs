// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v062_s1_grade_rollup_lookup_pglite.mjs
// (or point PGLITE_PATH at an installed copy's dist/index.js).
// 0.6.2 S1: the PROPOSED academic_subject_grade_rollup_lookup (docs/v0.6/proposed_sql/
// vicdata_academic_subject_grade_rollup_lookup.sql, for the vicdata data database). Local
// only (WASM Postgres), never a real database: stubs the two live tables it reads with their
// live columns, applies the function, and checks as `anon`: direct rows, the subject filter,
// the per-era single-predecessor fallback (and that a URN with rows of its own in an era never
// falls back in it, whatever the subject), no fallback for a URN with two predecessors, and
// that anon still cannot read the table itself.
import { readFileSync } from "node:fs";

const { PGlite } = await import(process.env.PGLITE_PATH ?? "@electric-sql/pglite");
const root = new URL("../../", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`);
  if (!ok) failed++;
};

await ex(`
create role anon; create role authenticated;
create table public.academic_subject_grade_rollup (
  entity_id text not null, ks_stage text not null, subject text not null, qualification_type text not null,
  grade text not null, family_id text, period integer not null, entries numeric not null, computed_at timestamptz default now(),
  primary key (entity_id, ks_stage, subject, qualification_type, grade, period));
alter table public.academic_subject_grade_rollup enable row level security;
create policy academic_subject_grade_rollup_select on public.academic_subject_grade_rollup for select to authenticated using (true);
grant select on public.academic_subject_grade_rollup to authenticated;
create table public.school_lineage (urn text not null, link_urn text not null, link_type text not null);
`);
await ex(readFileSync(root + "docs/v0.6/proposed_sql/vicdata_academic_subject_grade_rollup_lookup.sql", "utf8"));

// A: own rows, all four years. B: new academy, modern rows only; its predecessor PB has all
// four years. C: no rows of its own; predecessor PC has modern rows. D: two predecessors.
// E: own historic rows in another subject only (so no historic fallback for History).
const G = "GCSE (9-1) Full Course";
const rows = [];
for (const p of [2021, 2022, 2023, 2024]) {
  rows.push(["A", "History", p, 10], ["PB", "History", p, 20], ["PD1", "History", p, 30]);
  if (p >= 2023) rows.push(["B", "History", p, 11], ["PC", "History", p, 40], ["E", "History", p, 50]);
  else rows.push(["E", "Geography", p, 5], ["PE", "History", p, 60]);
}
for (const [e, s, p, n] of rows) {
  await q(`insert into public.academic_subject_grade_rollup (entity_id, ks_stage, subject, qualification_type, grade, period, entries) values ($1,'ks4',$2,$3,'4',$4,$5)`, [e, s, G, p, n]);
}
await ex(`insert into public.school_lineage values ('B','PB','Predecessor'),('C','PC','Predecessor'),('D','PD1','Predecessor'),('D','PD2','Predecessor'),('E','PE','Predecessor'),('A','PB','Merged')`);

await ex(`set role anon`);
const call = async (urns, subject = "History") =>
  (await q(`select entity_id, period, entries::int as n from public.academic_subject_grade_rollup_lookup($1::text[], 'ks4', $2)`, [urns, subject])).rows;
const sig = (rs, urn) => rs.filter((r) => r.entity_id === urn).map((r) => `${r.period}:${r.n}`).join(",");

const all = await call(["A", "B", "C", "D", "E"]);
check("A: own rows, four years", sig(all, "A") === "2021:10,2022:10,2023:10,2024:10", sig(all, "A"));
check("B: own modern rows, historic from its single predecessor", sig(all, "B") === "2021:20,2022:20,2023:11,2024:11", sig(all, "B"));
check("C: no rows of its own -> predecessor's modern rows", sig(all, "C") === "2023:40,2024:40", sig(all, "C"));
check("D: two predecessors -> no fallback", sig(all, "D") === "", sig(all, "D"));
check("E: own historic rows in another subject -> no historic fallback for History", sig(all, "E") === "2023:50,2024:50", sig(all, "E"));
check("A 'Merged' link is never followed", !all.some((r) => r.entity_id === "A" && r.n === 20));
const geo = await call(["E"], "Geography");
check("subject filter", sig(geo, "E") === "2021:5,2022:5", sig(geo, "E"));
let denied = false;
try {
  await q(`select count(*) from public.academic_subject_grade_rollup`);
} catch {
  denied = true;
}
check("anon still cannot read the table directly", denied);
await ex(`reset role`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
