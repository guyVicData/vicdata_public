// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_subject_entry_size_pglite.mjs
// VicData 0.8 SMT Academic, Entries mode (R-SMT-ENTRIES-SIZE): 20261122090000_v08_subject_entry_size_fifths.sql
// in PGlite (local WASM Postgres). Proves the table and its key, the unique index, that anon and
// authenticated read it under RLS and can't write it, and that the sync's upsert (on the key) is
// idempotent. Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
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
const fails_ = async (fn) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

process.on("unhandledRejection", (e) => {
  console.log("ERROR", e?.message ?? e);
  process.exit(1);
});

await ex(`create role anon; create role authenticated; create role service_role; grant usage on schema public to anon, authenticated, service_role;`);
await ex(readFileSync(repo + "20261122090000_v08_subject_entry_size_fifths.sql", "utf8"));
// The sync writes as service_role (which bypasses RLS on Supabase); here the table owner stands in.
console.log("applied 20261122090000_v08_subject_entry_size_fifths.sql");

console.log("-- table and index");
const cols = (await q(`select column_name, data_type, is_nullable from information_schema.columns where table_name = 'subject_entry_size_fifths' order by ordinal_position`)).rows;
const want = ["id", "ks_stage", "qualification", "subject", "period", "schools", "p20", "p40", "p60", "p80", "computed_at"];
check("columns", JSON.stringify(cols.map((c) => c.column_name)) === JSON.stringify(want), cols.map((c) => c.column_name).join(","));
const idx = (await q(`select indexname, indexdef from pg_indexes where tablename = 'subject_entry_size_fifths' order by indexname`)).rows;
check("unique index on (ks_stage, qualification, subject, period)", idx.some((i) => /UNIQUE INDEX subject_entry_size_fifths_key_idx .*\(ks_stage, qualification, subject, period\)/.test(i.indexdef)));
check("index on (ks_stage, period)", idx.some((i) => /subject_entry_size_fifths_stage_period_idx .*\(ks_stage, period\)/.test(i.indexdef)));
check("RLS enabled", (await q(`select relrowsecurity from pg_class where relname = 'subject_entry_size_fifths'`)).rows[0].relrowsecurity === true);
check("ks_stage check refuses ks2", await fails_(() => q(`insert into subject_entry_size_fifths (ks_stage, qualification, subject, period, schools, p20, p40, p60, p80) values ('ks2','x','y',2024,1,1,1,1,1)`)));
check("schools > 0 check", await fails_(() => q(`insert into subject_entry_size_fifths (ks_stage, qualification, subject, period, schools, p20, p40, p60, p80) values ('ks5','x','y',2024,0,1,1,1,1)`)));

console.log("-- upsert (the sync's onConflict key) is idempotent");
// Real dry-run figures, 8 Nov: KS5 2024 GCE A level Psychology and the qualification's total; GCSE 2024 Mathematics.
const UPSERT = (computed) => `insert into subject_entry_size_fifths (ks_stage, qualification, subject, period, schools, p20, p40, p60, p80, computed_at) values
  ('ks5','GCE A level','Psychology',2024,2317,10,17,26,40,'${computed}'),
  ('ks5','GCE A level','All subjects',2024,2620,82.8,156,255,416,'${computed}'),
  ('ks4','GCSE (9-1) Full Course','Mathematics',2024,4333,22.4,129,175,218,'${computed}')
  on conflict (ks_stage, qualification, subject, period) do update set schools = excluded.schools, p20 = excluded.p20, p40 = excluded.p40, p60 = excluded.p60, p80 = excluded.p80, computed_at = excluded.computed_at`;
await q(UPSERT("2026-11-08T10:00:00Z"));
const first = (await q(`select id, ks_stage, qualification, subject, period, schools, p20::float8, p40::float8, p60::float8, p80::float8 from subject_entry_size_fifths order by ks_stage, subject`)).rows;
await q(UPSERT("2026-11-08T11:00:00Z"));
const second = (await q(`select id, ks_stage, qualification, subject, period, schools, p20::float8, p40::float8, p60::float8, p80::float8 from subject_entry_size_fifths order by ks_stage, subject`)).rows;
check("a second identical upsert keeps 3 rows, the same ids and figures", first.length === 3 && JSON.stringify(first) === JSON.stringify(second), `${first.length} -> ${second.length} rows`);
check("the second run's computed_at wins", (await q(`select count(*)::int n from subject_entry_size_fifths where computed_at = '2026-11-08T11:00:00Z'`)).rows[0].n === 3);
check("a plain duplicate insert is refused by the key", await fails_(() => q(`insert into subject_entry_size_fifths (ks_stage, qualification, subject, period, schools, p20, p40, p60, p80) values ('ks5','GCE A level','Psychology',2024,1,1,1,1,1)`)));
// The sync's stale-row sweep: a row the run no longer produced (older computed_at) goes; this run's stay.
await q(`insert into subject_entry_size_fifths (ks_stage, qualification, subject, period, schools, p20, p40, p60, p80, computed_at) values ('ks5','GCE A level','Old name',2024,5,1,1,1,1,'2026-11-01T00:00:00Z')`);
await q(`delete from subject_entry_size_fifths where ks_stage = 'ks5' and computed_at < '2026-11-08T11:00:00Z'`);
check("the stale-row sweep removes only rows the run didn't write", (await q(`select string_agg(subject, ',' order by subject) s from subject_entry_size_fifths where ks_stage = 'ks5'`)).rows[0].s === "All subjects,Psychology");

console.log("-- who reads (RLS)");
for (const role of ["anon", "authenticated"]) {
  const rows = await as(role, async () => (await q(`select subject, schools, p20::float8 from subject_entry_size_fifths where ks_stage = 'ks5' and period = 2024 order by subject`)).rows);
  check(`${role} reads every row`, rows.length === 2 && rows[1].subject === "Psychology" && rows[1].schools === 2317 && rows[1].p20 === 10, JSON.stringify(rows));
  check(`${role} can't insert`, await as(role, () => fails_(() => q(`insert into subject_entry_size_fifths (ks_stage, qualification, subject, period, schools, p20, p40, p60, p80) values ('ks5','x','y',2024,1,1,1,1,1)`))));
  const upd = await as(role, async () => {
    try {
      return (await q(`update subject_entry_size_fifths set schools = 1`)).affectedRows ?? 0;
    } catch {
      return 0;
    }
  });
  check(`${role} can't update`, upd === 0 && (await q(`select min(schools)::int m from subject_entry_size_fifths`)).rows[0].m > 1);
  const del = await as(role, async () => {
    try {
      return (await q(`delete from subject_entry_size_fifths`)).affectedRows ?? 0;
    } catch {
      return 0;
    }
  });
  check(`${role} can't delete`, del === 0 && (await q(`select count(*)::int n from subject_entry_size_fifths`)).rows[0].n === 3);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
