// Run from the repo root: PGLITE_PATH=<installed copy's dist/index.js> npx -y tsx supabase/tests/v08_subject_latest_names_pglite.mjs
// (tsx, because it checks the migration against the app's own src/lib/subject-latest-names.ts).
// Local only (WASM Postgres): stubs the four tables the subject latest names migration rewrites
// and dashboard_versions with its immutability trigger, loads one sample of each stored shape,
// applies 20261112090000_v08_subject_latest_names.sql twice, and checks:
//   - the inlined map is the app's SUBJECT_LATEST_NAMES, row for row, less the KS5 rows added after it;
//   - every rewritten value is exactly what the app's read-time mapping gives;
//   - ticked subjects are deduplicated in order; free text and unknown names are untouched;
//   - published versions are untouched; a second run changes nothing; updated_at is kept.
// Never touches a real database.
import { readFileSync } from "node:fs";
import { latestNamesInKey, latestNamesInSaved, SUBJECT_LATEST_NAMES } from "../../src/lib/subject-latest-names.ts";

const { PGlite } = await import(process.env.PGLITE_PATH ?? "@electric-sql/pglite");
const MIG = readFileSync(new URL("../migrations/20261112090000_v08_subject_latest_names.sql", import.meta.url), "utf8");
const db = new PGlite();
const q = async (sql, p) => (await db.query(sql, p)).rows;

// jsonb keeps keys in its own order: compare with keys sorted.
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));

let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond || !detail ? "" : ` -- ${detail}`}`);
  if (!cond) failed++;
};

await db.exec(`
create table public.teacher_view_preferences (profile_id uuid, school_urn text, phase text, subjects jsonb not null, columns jsonb not null,
  updated_at timestamptz not null, last_seen_period int, primary key (profile_id, school_urn, phase));
create table public.dashboard_drafts (dashboard_id uuid primary key, config jsonb not null, updated_at timestamptz not null);
create table public.dashboard_versions (id uuid primary key, dashboard_id uuid, version int, config jsonb not null);
create function public.dashboard_versions_immutable() returns trigger language plpgsql as $$ begin raise exception 'dashboard versions are immutable'; end $$;
create trigger dashboard_versions_immutable before update or delete on public.dashboard_versions for each row execute function public.dashboard_versions_immutable();
create table public.dashboard_user_state (profile_id uuid, dashboard_id uuid, school_urn text, seen_version int, state jsonb not null, updated_at timestamptz not null);
create table public.recruitment_jobs (id uuid primary key, title text not null, subject text);
`);

const P1 = "00000000-0000-0000-0000-000000000001";
const P2 = "00000000-0000-0000-0000-000000000002";
const D1 = "10000000-0000-0000-0000-000000000001";
const T0 = "2026-10-01T09:00:00Z";
const SUBJECTS = ["Maths (General)::GCSE (9-1) Full Course", "History::GCSE (9-1) Full Course", "Mathematics::GCSE (9-1) Full Course", "Science Double Award::GCSE (9-1) Full Course (Double Award)"];
const COLUMNS = {
  "chosen:results": ["Maths (General)::GCSE (9-1) Full Course", "D & T::GCSE (9-1) Full Course"],
  "measure:results": ["points"],
  pinned: ["results|subject|Science Double Award::GCSE (9-1) Full Course (Double Award)|now", "results|subject|History::GCSE (9-1) Full Course|trend"],
  note: "Maths (General) dipped in 2024",
};
const CONFIG = {
  schema_version: 2,
  title: "Tourism",
  panels: [{ id: "p1", dataviews: [{ kind: "view", params: { subject: "Maths (General)" }, focus: { subject: { mode: "always", subject: "Hospitality/Catering Studies" } } }] }],
  presentation: { slides: [{ slots: [{ view: { pinned: { subject: "Greek (Classic)", subjectLabel: "Greek (Classic)", params: { subject: "Greek (Classic)" } } } }, { text: "Science Double Award results" }] }] },
};
const STATE = { "results|subject|Maths (General)::GCSE (9-1) Full Course|trend": { open: true }, "results|subject|History::GCSE (9-1) Full Course|now": { open: false } };
const PLAIN = { panels: [{ dataviews: [{ params: { subject: "History" } }] }] };

await db.query(`insert into teacher_view_preferences values ($1, '137625', 'ks4', $2, $3, $4, 2025), ($5, '137625', 'ks4', '["History::GCSE (9-1) Full Course"]', '{}', $4, null)`,
  [P1, JSON.stringify(SUBJECTS), JSON.stringify(COLUMNS), T0, P2]);
await db.query(`insert into dashboard_drafts values ($1, $2, $3), ($4, $5, $3)`, [D1, JSON.stringify(CONFIG), T0, "10000000-0000-0000-0000-000000000002", JSON.stringify(PLAIN)]);
await db.query(`insert into dashboard_versions values ($1, $1, 1, $2)`, [D1, JSON.stringify(CONFIG)]);
await db.query(`insert into dashboard_user_state values ($1, $2, '137625', 1, $3, $4)`, [P1, D1, JSON.stringify(STATE), T0]);
await db.exec(`insert into recruitment_jobs values
  ('20000000-0000-0000-0000-000000000001', 'Maths teacher', 'Maths (General)'),
  ('20000000-0000-0000-0000-000000000002', 'Science lead', 'science double award'),
  ('20000000-0000-0000-0000-000000000003', 'History', 'History'),
  ('20000000-0000-0000-0000-000000000004', 'Open', null)`);

// The inlined map is the app's, less the KS5 rows the app gained after this migration (c65acfd,
// 15 Oct 2026: DfE's 2024/25 KS5 renames). No saved choice held an old KS5 name, so they needed no
// migration. Any other app row missing here (a GCSE rename added without a migration) fails.
const inlined = Object.fromEntries([...MIG.matchAll(/\('((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)].map((m) => [m[1].replaceAll("''", "'"), m[2].replaceAll("''", "'")]));
const KS5_AFTER = [
  "Accounting / Finance", "Additional Mathematics FSMQ", "Animal Care (Non-Agricultural)", "Applied Sciences",
  "Art and Design (3d Studies)", "Art and Design (Critical Studies)", "Art and Design (Fine Art)", "Art and Design (Graphics)",
  "Art and Design (Photography)", "Art and Design (Textiles)", "Business Studies:Single", "Computer Studies / Computing",
  "Electrical installation (Buildings / Construction)", "Finance / Accounting (General)", "Media/Film/Tv Studies", "Music performance (Group)",
];
const appAtMigration = Object.fromEntries(Object.entries(SUBJECT_LATEST_NAMES).filter(([k]) => !KS5_AFTER.includes(k)));
ok("the KS5 rows added after the migration are all in the app's map", KS5_AFTER.every((k) => k in SUBJECT_LATEST_NAMES), KS5_AFTER.filter((k) => !(k in SUBJECT_LATEST_NAMES)).join(", "));
ok("inlined map = the app's SUBJECT_LATEST_NAMES (less the later KS5 rows)", JSON.stringify(Object.entries(inlined).sort()) === JSON.stringify(Object.entries(appAtMigration).sort()),
  `${Object.keys(inlined).length} vs ${Object.keys(appAtMigration).length}`);

await db.exec(MIG);
const snap = async () => JSON.stringify({
  p: await q("select * from teacher_view_preferences order by profile_id"),
  d: await q("select * from dashboard_drafts order by dashboard_id"),
  s: await q("select * from dashboard_user_state"),
  j: await q("select * from recruitment_jobs order by id"),
});
const first = await snap();
await db.exec(MIG); // twice: idempotent
ok("a second run changes nothing", (await snap()) === first);

const [pref] = await q(`select subjects, columns, updated_at from teacher_view_preferences where profile_id = $1`, [P1]);
ok("ticked subjects: latest names, deduplicated, order kept", JSON.stringify(pref.subjects) === JSON.stringify(["Mathematics::GCSE (9-1) Full Course", "History::GCSE (9-1) Full Course", "Combined Science::GCSE (9-1) Full Course (Double Award)"]),
  JSON.stringify(pref.subjects));
ok("ticked subjects: what the app reads", JSON.stringify(pref.subjects) === JSON.stringify([...new Set(SUBJECTS.map(latestNamesInKey))]));
ok("columns: what the app reads", canon(pref.columns) === canon(latestNamesInSaved(COLUMNS)), JSON.stringify(pref.columns));
ok("columns: free text untouched", pref.columns.note === COLUMNS.note);
ok("updated_at kept", new Date(pref.updated_at).toISOString() === new Date(T0).toISOString());
const [draft] = await q(`select config from dashboard_drafts where dashboard_id = $1`, [D1]);
ok("draft config: what the app reads", canon(draft.config) === canon(latestNamesInSaved(CONFIG)), JSON.stringify(draft.config).slice(0, 300));
ok("draft config: subjects renamed", draft.config.panels[0].dataviews[0].params.subject === "Mathematics"
  && draft.config.panels[0].dataviews[0].focus.subject.subject === "Hospitality and Catering"
  && draft.config.presentation.slides[0].slots[0].view.pinned.subjectLabel === "Classical Greek");
ok("draft config: a title that is a whole old name reads as the latest (as in the app)", draft.config.title === "Travel and Tourism");
ok("draft config: text slot untouched", draft.config.presentation.slides[0].slots[1].text === "Science Double Award results");
const [plain] = await q(`select config from dashboard_drafts where dashboard_id = '10000000-0000-0000-0000-000000000002'`);
ok("a config with no old name is unchanged", canon(plain.config) === canon(PLAIN));
const [version] = await q(`select config from dashboard_versions`);
ok("published version untouched (immutable)", canon(version.config) === canon(CONFIG));
const [state] = await q(`select state from dashboard_user_state`);
ok("dashboard state: keys renamed, as the app reads them", canon(state.state) === canon(latestNamesInSaved(STATE)), JSON.stringify(state.state));
const jobs = await q(`select subject from recruitment_jobs order by id`);
ok("recruitment: exact old names only", JSON.stringify(jobs.map((j) => j.subject)) === JSON.stringify(["Mathematics", "science double award", "History", null]));
ok("the temporary map and functions are gone", (await q(`select count(*)::int n from pg_proc where proname like 'latest_names_in%'`))[0].n === 0);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
