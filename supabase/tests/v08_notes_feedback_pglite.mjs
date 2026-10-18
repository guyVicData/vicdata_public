// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_notes_feedback_pglite.mjs
// VicData 0.8 notes and feedback: 20261117090000_v08_notes_per_view.sql and 20261117100000_v08_feedback.sql
// over a stub of the live tables they read (profiles, platform_admins, teacher_view_notes with its live
// RLS), with Supabase's roles and auth.uid() from the request's JWT claim. Local only (WASM Postgres);
// never touches a real database.
//   R-NOTES-MIGRATION     the 3 old notes go; View as' ~sets rows, meeting notes and new view notes stay;
//                         a second run does nothing more.
//   R-FEEDBACK-AUDIENCE   at "admins" a member's insert is refused; at "beta" a named tester's isn't; at
//                         "all" anyone signed in; anon never.
//   R-FEEDBACK-RLS        a member reads only their own items; only platform admins update, and only the
//                         triage fields; nobody deletes; authors can't edit what they sent.
//   R-FEEDBACK-COVERAGE   feedback_coverage reflects a "Looks good" and an open item on two views at two
//                         schools.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const NOTES = readFileSync(`${repo}20261117090000_v08_notes_per_view.sql`, "utf8");
const FEEDBACK = readFileSync(`${repo}20261117100000_v08_feedback.sql`, "utf8");

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const MEMBER = "00000000-0000-0000-0000-0000000000b1";
const OTHER = "00000000-0000-0000-0000-0000000000b2";
const TESTER = "00000000-0000-0000-0000-0000000000b3";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok || !detail ? "" : ` -- ${detail}`}`);
};

const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
create table public.profiles (id uuid primary key, email text not null, full_name text);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create table public.platform_admins (profile_id uuid primary key references public.profiles (id));
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.platform_admins where profile_id = auth.uid()) $$;
-- teacher_view_notes as live (20261101100000_teacher_view_persistence): creator-only RLS.
create table public.teacher_view_notes (profile_id uuid not null references public.profiles (id), school_urn text not null, chart_key text not null, body text not null, updated_at timestamptz not null default now(), primary key (profile_id, school_urn, chart_key));
alter table public.teacher_view_notes enable row level security;
create policy teacher_view_notes_own on public.teacher_view_notes using (profile_id = auth.uid()) with check (profile_id = auth.uid());
insert into public.profiles values ('${GUY}', 'guy@example.test', 'Guy'), ('${MEMBER}', 'm@example.test', 'A Member'), ('${OTHER}', 'o@example.test', 'Other Member'), ('${TESTER}', 't@example.test', 'Beta Tester');
insert into public.platform_admins values ('${GUY}');
-- The live rows (18 Oct 2026): 3 notes; then what must stay.
insert into public.teacher_view_notes (profile_id, school_urn, chart_key, body) values
  ('${GUY}', '100053', 'ks4:results:Biology', 'n1'),
  ('${GUY}', '100053', 'ks5:results', 'n2'),
  ('${MEMBER}', '137625', 'ks4:candidates', 'n3'),
  ('${GUY}', '110110~trial~smt~sets', 'set:abc', '{"name":"Rivals","urns":["137625"]}'),
  ('${GUY}', '110110~trial~smt~sets', 'ranking:def', '{"name":"Top","filters":{}}'),
  ('${MEMBER}', '137625', 'meeting:m1:v1', 'slide note'),
  ('${MEMBER}', '137625', 'view:vicdata.smt.overview:p-now:v-now', 'a new note');
`);

const asUser = async (uid, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await ex(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
};
const asAnon = async (fn) => {
  await ex(`set role anon;`);
  try {
    return await fn();
  } finally {
    await ex(`reset role;`);
  }
};
const refused = async (fn) => {
  try {
    await fn();
    return false;
  } catch (e) {
    return /permission denied|row-level security|only a platform admin|can't be changed/i.test(e.message) ? true : e.message;
  }
};

// ---------------------------------------------------------------------------- R-NOTES-MIGRATION
console.log("\n-- R-NOTES-MIGRATION");
const listed = (await q(`select school_urn, chart_key from public.teacher_view_notes where school_urn !~ '~sets$' and chart_key !~ '^(view|meeting|set|ranking):' order by 1, 2`)).rows;
check("what it will delete, listed first: exactly the 3 old notes", JSON.stringify(listed.map((r) => r.chart_key)) === JSON.stringify(["ks4:results:Biology", "ks5:results", "ks4:candidates"]), JSON.stringify(listed));
await ex(NOTES);
const left = (await q(`select chart_key from public.teacher_view_notes order by chart_key`)).rows.map((r) => r.chart_key);
check("the 3 old notes are deleted", !left.some((k) => /^ks[45]:/.test(k)), left.join(","));
check("View as' ~sets rows are untouched", left.includes("set:abc") && left.includes("ranking:def"));
check("meeting slide notes and new per-view notes stay", left.includes("meeting:m1:v1") && left.includes("view:vicdata.smt.overview:p-now:v-now"));
// R-NOTE-PER-VIEW's database half: a view's note is its author's only (the table's RLS, unchanged).
await asUser(GUY, () => q(`insert into public.teacher_view_notes (profile_id, school_urn, chart_key, body) values ($1, '110110~trial~smt', 'view:vicdata.smt.academic:p-large:v-subjects', 'mine')`, [GUY]));
check("R-NOTE-PER-VIEW: another member can't read a view's note", (await asUser(MEMBER, () => q(`select count(*)::int n from public.teacher_view_notes where profile_id = '${GUY}'`))).rows[0].n === 0);
check("R-NOTE-PER-VIEW: nor write one as its author", (await refused(() => asUser(MEMBER, () => q(`insert into public.teacher_view_notes (profile_id, school_urn, chart_key, body) values ('${GUY}', '110110', 'view:x:y:z', 'forged')`)))) === true);
const before = (await q(`select count(*)::int n from public.teacher_view_notes`)).rows[0].n;
await ex(NOTES);
check("a second run does nothing more (the new view note stays too)", (await q(`select count(*)::int n from public.teacher_view_notes`)).rows[0].n === before);

// ---------------------------------------------------------------------------- the feedback migration
await ex(FEEDBACK);
await ex(FEEDBACK);
check("the feedback migration runs twice cleanly, one setting row", (await q(`select count(*)::int n from public.app_settings where key = 'feedback_audience'`)).rows[0].n === 1);
check("the audience starts at admins", (await q(`select public.feedback_audience() a`)).rows[0].a === "admins");

const item = (o = {}) => {
  const f = { product: "smt", school_urn: "110110", school_name: "Leighton Park School", dashboard_id: "vicdata.smt.academic", dashboard_name: "Academic", panel_id: "p-large", view_instance_id: "v-subjects", dataview_id: "DV-SMT-A-SUBJECTS", view_label: "Subjects", view_key: "vicdata.smt.academic:p-large:v-subjects", body: "The figure looks off", looks_good: false, kinds: "{wrong_figure}", role: "smt", view_as: true, ...o };
  const cols = Object.keys(f);
  return { sql: `insert into public.feedback_items (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id, number, author_id, status`, params: Object.values(f) };
};
const insertAs = (uid, o) => {
  const { sql, params } = item(o);
  return asUser(uid, () => q(sql, params));
};

// ---------------------------------------------------------------------------- R-FEEDBACK-AUDIENCE
console.log("\n-- R-FEEDBACK-AUDIENCE");
check("admins: a member's insert is refused", (await refused(() => insertAs(MEMBER))) === true);
check("admins: anon's insert is refused", (await refused(() => asAnon(() => q(item().sql, item().params)))) === true);
const g1 = (await insertAs(GUY)).rows[0];
check("admins: a platform admin's insert is taken, numbered, author the caller, status new", g1.number > 0 && g1.author_id === GUY && g1.status === "new", JSON.stringify(g1));
await insertAs(GUY, { status: "done", type: "fix", triage_note: "pre-triaged", author_id: MEMBER });
const forged = (await q(`select author_id, status, type, triage_note from public.feedback_items order by number desc limit 1`)).rows[0];
check("an insert can't set triage fields or another author: the row is the caller's, new, untriaged", forged.author_id === GUY && forged.status === "new" && forged.type === null && forged.triage_note === null, JSON.stringify(forged));
await ex(`update public.app_settings set value = '"beta"' where key = 'feedback_audience'`);
check("beta: a member who isn't a named tester is refused", (await refused(() => insertAs(MEMBER))) === true);
await ex(`insert into public.feedback_beta_testers values ('${TESTER}')`);
check("beta: a named tester's insert is taken", (await insertAs(TESTER, { school_urn: "137625", school_name: "The Chase" })).rows.length === 1);
await ex(`update public.app_settings set value = '"all"' where key = 'feedback_audience'`);
check("all: any signed-in member's insert is taken", (await insertAs(MEMBER, { school_urn: "137625", school_name: "The Chase", role: "teacher", view_as: false })).rows.length === 1);
check("all: anon is still refused", (await refused(() => asAnon(() => q(item().sql, item().params)))) === true);
check("an item needs text or Looks good", (await insertAs(GUY, { body: "  ", kinds: "{}" }).then(() => false).catch((e) => /text_or_looks_good/.test(e.message))) === true);
await ex(`update public.app_settings set value = '"nonsense"' where key = 'feedback_audience'`);
check("an unknown setting reads as admins", (await q(`select public.feedback_audience() a`)).rows[0].a === "admins" && (await refused(() => insertAs(MEMBER))) === true);
check("members can't read or change the setting", (await asUser(MEMBER, () => q(`select count(*)::int n from public.app_settings`))).rows[0].n === 0 && (await refused(() => asUser(MEMBER, () => q(`update public.app_settings set value = '"all"'`)))) === true);
await ex(`update public.app_settings set value = '"admins"' where key = 'feedback_audience'`);

// ---------------------------------------------------------------------------- R-FEEDBACK-RLS
console.log("\n-- R-FEEDBACK-RLS");
const mine = (await asUser(MEMBER, () => q(`select author_id from public.feedback_items`))).rows;
check("a member reads only their own items", mine.length === 1 && mine.every((r) => r.author_id === MEMBER), JSON.stringify(mine));
check("another member reads none of them", (await asUser(OTHER, () => q(`select count(*)::int n from public.feedback_items`))).rows[0].n === 0);
check("…nor through the triage or coverage views", (await asUser(OTHER, () => q(`select (select count(*) from public.feedback_for_triage)::int + (select count(*) from public.feedback_coverage)::int n`))).rows[0].n === 0);
const all = (await asUser(GUY, () => q(`select count(*)::int n from public.feedback_items`))).rows[0].n;
check("a platform admin reads every item", all === 4, String(all));
const { id: memberItem, number: memberNo } = (await q(`select id, number from public.feedback_items where author_id = '${MEMBER}'`)).rows[0];
// An update RLS filters out changes no row; count that as refused too.
const updateRefused = (uid, sql, params) => refused(async () => {
  const r = await asUser(uid, () => q(sql, params));
  if (!r.rows.length) throw new Error("row-level security: no row");
});
check("the author can't edit what they sent", (await updateRefused(MEMBER, `update public.feedback_items set body = 'changed' where id = $1 returning id`, [memberItem])) === true);
check("the author can't triage their own item", (await updateRefused(MEMBER, `update public.feedback_items set status = 'done' where id = $1 returning id`, [memberItem])) === true);
check("nobody deletes, not even a platform admin", (await refused(() => asUser(GUY, () => q(`delete from public.feedback_items where id = $1`, [memberItem])))) === true && (await refused(() => asUser(MEMBER, () => q(`delete from public.feedback_items where id = $1`, [memberItem])))) === true);
const tri = (await asUser(GUY, () => q(`update public.feedback_items set type = 'fix', priority = 'high', status = 'planned', planned_version = '0.85', triage_note = 'Seen' where id = $1 returning triaged_by, triaged_at, status`, [memberItem]))).rows[0];
check("a platform admin triages: type, priority, planned with a version; who and when kept", tri.status === "planned" && tri.triaged_by === GUY && tri.triaged_at !== null, JSON.stringify(tri));
check("a platform admin can't change what was recorded", (await refused(() => asUser(GUY, () => q(`update public.feedback_items set body = 'rewritten' where id = $1`, [memberItem])))) === true && (await refused(() => asUser(GUY, () => q(`update public.feedback_items set school_urn = '100000' where id = $1`, [memberItem])))) === true);
const done = (await asUser(GUY, () => q(`update public.feedback_items set status = 'done', resolved_commit = 'abc1234' where id = $1 returning resolved_at`, [memberItem]))).rows[0];
check("done stamps the date when none is given", done.resolved_at !== null);
const dup = g1.id;
check("duplicate_of links another item, never itself", (await asUser(GUY, () => q(`update public.feedback_items set duplicate_of = $1 where id = $2 returning id`, [dup, memberItem]))).rows.length === 1 && (await asUser(GUY, () => q(`update public.feedback_items set duplicate_of = id where id = $1`, [dup])).then(() => false).catch(() => true)));
const row = (await asUser(GUY, () => q(`select ref, author_name, school_or_group, duplicate_of_ref, created_london from public.feedback_for_triage where id = $1`, [memberItem]))).rows[0];
check("feedback_for_triage has readable names for a platform admin", row.ref === `F-${memberNo}` && row.author_name === "A Member" && row.school_or_group === "The Chase" && row.duplicate_of_ref === `F-${g1.number}` && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(row.created_london), JSON.stringify(row));
check("…and the author reads their own name, nobody else's", (await asUser(MEMBER, () => q(`select author_name from public.feedback_for_triage`))).rows[0].author_name === "A Member");

// ---------------------------------------------------------------------------- R-FEEDBACK-COVERAGE
console.log("\n-- R-FEEDBACK-COVERAGE");
await ex(`truncate public.feedback_items cascade`);
// Two views (Subjects, Areas) at two schools (Leighton Park, The Chase).
const SUBJ = { view_instance_id: "v-subjects", view_label: "Subjects", view_key: "vicdata.smt.academic:p-large:v-subjects" };
const AREAS = { view_instance_id: "v-areas", view_label: "Subject areas", view_key: "vicdata.smt.academic:p-large:v-areas" };
const LP = { school_urn: "110110", school_name: "Leighton Park School" };
const CH = { school_urn: "137625", school_name: "The Chase" };
await insertAs(GUY, { ...SUBJ, ...LP, body: "", looks_good: true, kinds: "{looks_good}" });
await insertAs(GUY, { ...SUBJ, ...CH, body: "Mathematics is missing" });
await insertAs(GUY, { ...AREAS, ...LP, body: "Label reads oddly", kinds: "{wording}" });
await insertAs(GUY, { ...AREAS, ...LP, body: "", looks_good: true, kinds: "{looks_good}" });
await insertAs(GUY, { ...AREAS, ...CH, body: "", looks_good: true, kinds: "{looks_good}" });
const cov = Object.fromEntries((await asUser(GUY, () => q(`select view_instance_id || '@' || scope_id k, state, items, open_items, last_looks_good_at is not null lg, last_open_at is not null op from public.feedback_coverage`))).rows.map((r) => [r.k, r]));
check("Subjects at Leighton Park: looks good", cov["v-subjects@110110"]?.state === "looks good" && cov["v-subjects@110110"].lg && !cov["v-subjects@110110"].op, JSON.stringify(cov["v-subjects@110110"]));
check("Subjects at The Chase: open", cov["v-subjects@137625"]?.state === "open" && cov["v-subjects@137625"].open_items === 1);
check("Subject areas at Leighton Park: open wins over looks good", cov["v-areas@110110"]?.state === "open" && cov["v-areas@110110"].lg && cov["v-areas@110110"].items === 2);
check("Subject areas at The Chase: looks good", cov["v-areas@137625"]?.state === "looks good");
check("four rows, one per view per school", Object.keys(cov).length === 4, Object.keys(cov).join(","));
const openId = (await q(`select id from public.feedback_items where body = 'Mathematics is missing'`)).rows[0].id;
await asUser(GUY, () => q(`update public.feedback_items set status = 'done' where id = $1`, [openId]));
const after = (await asUser(GUY, () => q(`select state from public.feedback_coverage where view_instance_id = 'v-subjects' and scope_id = '137625'`))).rows[0];
check("once its item is done, Subjects at The Chase is no longer open", after.state === "none", JSON.stringify(after));

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
