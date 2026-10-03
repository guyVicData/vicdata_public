// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v06_s7_meetings_pglite.mjs
// (or point PGLITE_PATH at an installed copy's dist/index.js).
// Local only (WASM Postgres): stubs the live schema the S1/S2 migrations and the old meetings
// tables need (the old tables exactly as audit C §7.1 records them), applies S1 + S2, then
// the S7 meetings migration twice, and checks the mapping, owner-only access, versions,
// idempotency and the cap. Never touches a real database.
import { readFileSync } from "node:fs";

const { PGlite } = await import(process.env.PGLITE_PATH ?? "@electric-sql/pglite");
const repo = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";
const E = "00000000-0000-0000-0000-00000000000e";
const S1 = "11111111-1111-1111-1111-111111111111";
const S2 = "22222222-2222-2222-2222-222222222222";

await ex(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table public.profiles (id uuid primary key, email text, full_name text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.schools (urn text primary key, current_name text, establishment_type_group text, establishment_type text, website text);
create table public.school_accounts (id uuid primary key default gen_random_uuid(), school_urn text unique, account_holder_membership_id uuid, pending_account_holder_membership_id uuid, tier text default 'individual', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid references public.school_accounts(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, status text default 'pending_verification', is_admin bool default false, role text default 'teacher' check (role in ('teacher','hod','smt','finance','admissions')), individual_tier_active bool, requested_at timestamptz, approved_at timestamptz, approved_by uuid, unique (school_account_id, profile_id));
create table public.vc_comparator_sets (id uuid primary key default gen_random_uuid(), name text);
create table public.vc_set_school_visibility (school_account_id uuid, vc_set_id uuid, primary key (school_account_id, vc_set_id));
create function public.is_member_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved') $$;
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved' and is_admin) $$;
alter table public.school_memberships enable row level security;
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
alter table public.school_accounts enable row level security;
create policy school_accounts_select_all on public.school_accounts for select using (true);

-- The old Meetings tables, as live (audit C §7.1).
create table public.meetings (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, name text not null, meeting_date date, delete_by date not null, created_at timestamptz default now());
create table public.meeting_slides (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.meetings(id) on delete cascade, position int not null, chart_key text not null, caption text, unique (meeting_id, position));
create index meeting_slides_meeting_idx on public.meeting_slides (meeting_id);
alter table public.meetings enable row level security;
alter table public.meeting_slides enable row level security;
create policy meetings_own on public.meetings for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy meeting_slides_own on public.meeting_slides for all using (meeting_id in (select id from public.meetings where profile_id = auth.uid()));

grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
insert into public.profiles (id, full_name) values ('${GUY}','Guy'), ('${A}','Teacher A'), ('${B}','Admin B'), ('${C}','Busy C'), ('${E}','Two-school E');
insert into public.schools values ('100053','Acland Burghley School','Local authority maintained schools','Community school',null), ('117037','The King''s School','Independent schools','Other independent school',null);
insert into public.school_accounts (id, school_urn) values ('${S1}','100053'), ('${S2}','117037');
insert into public.school_memberships (school_account_id, profile_id, status, is_admin, role) values
 ('${S1}','${A}','approved',false,'teacher'), ('${S1}','${B}','approved',true,'teacher'), ('${S2}','${C}','approved',false,'teacher'),
 ('${S1}','${E}','approved',false,'teacher'), ('${S2}','${E}','approved',false,'teacher');
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261103100000_v06_s2_dashboards.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}

// Old meetings: Guy's one live row (its key has no "::", audit C §7.2), a teacher's deck with
// every mapping case and position gaps, an undated meeting with no slides, six upcoming for
// one owner (over the cap of 5), and an owner at two schools.
await ex(`
insert into public.meetings (id, profile_id, name, meeting_date, delete_by, created_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001','${GUY}','Autumn governors', current_date + 30, current_date + 200, '2026-09-01'),
 ('aaaaaaaa-0000-0000-0000-000000000002','${A}','Maths department review', current_date + 10, current_date + 200, '2026-09-02'),
 ('aaaaaaaa-0000-0000-0000-000000000003','${A}','Old undated deck', null, current_date + 200, '2025-01-15 10:00+00'),
 ('aaaaaaaa-0000-0000-0000-000000000004','${E}','Two-school deck', current_date + 5, current_date + 200, '2026-09-03');
insert into public.meetings (profile_id, name, meeting_date, delete_by) select '${C}', 'C deck ' || g, current_date + g, current_date + 200 from generate_series(1, 6) g;
insert into public.meeting_slides (id, meeting_id, position, chart_key, caption) values
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', 1, 'ks4:results:Biology', 'Biology results this year'),
 ('bbbbbbbb-0000-0000-0000-000000000010','aaaaaaaa-0000-0000-0000-000000000002', 8, 'ks4::context|vs_all_subjects|Maths::GCSE (9-1) Full Course|now', null),
 ('bbbbbbbb-0000-0000-0000-000000000011','aaaaaaaa-0000-0000-0000-000000000002', 0, 'ks4::results|vs_category|Biology::GCSE (9-1) Full Course|trend', null),
 ('bbbbbbbb-0000-0000-0000-000000000012','aaaaaaaa-0000-0000-0000-000000000002', 2, 'ks5::rankings|rank_similar_size|-|now', 'Sixth forms like us'),
 ('bbbbbbbb-0000-0000-0000-000000000013','aaaaaaaa-0000-0000-0000-000000000002', 5, 'ks4::candidates|share_of_cohort|-|now', null),
 ('bbbbbbbb-0000-0000-0000-000000000014','aaaaaaaa-0000-0000-0000-000000000002', 7, 'ks2::results|vs_category|Maths::KS2|now', 'Primary maths'),
 ('bbbbbbbb-0000-0000-0000-000000000015','aaaaaaaa-0000-0000-0000-000000000002', 9, 'ks4::candidates|vs_chosen|Maths::GCSE (9-1) Full Course|now', null),
 ('bbbbbbbb-0000-0000-0000-000000000016','aaaaaaaa-0000-0000-0000-000000000002', 11, 'ks5::candidates|vs_school_avg|Physics::GCE A level|trend', null),
 ('bbbbbbbb-0000-0000-0000-000000000017','aaaaaaaa-0000-0000-0000-000000000002', 12, 'ks4::results|category_vs_categories|Maths::GCSE (9-1) Full Course|now', null);
`);

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (sub, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };
const oldCounts = async () => (await q(`select (select count(*) from meetings)::int m, (select count(*) from meeting_slides)::int s`)).rows[0];

const before = await oldCounts();
const migration = readFileSync(repo + "20261104110000_v06_s7_meetings_migration.sql", "utf8");
await ex(migration);
console.log("applied 20261104110000_v06_s7_meetings_migration.sql");

const migrated = (await q(`select d.*, v.config, v.version, v.label, v.created_by as v_by from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug like 'legacy-meeting:%' order by d.slug`)).rows;
check("every old meeting has a presentation dashboard", migrated.length === before.m, `${migrated.length} of ${before.m}`);
check("all kind presentation, owner scope user, version 1 published", migrated.every((r) => r.kind === "presentation" && r.owner_scope === "user" && r.version === 1 && r.published_version_id));
const bySlug = (id) => migrated.find((r) => r.slug === `legacy-meeting:${id}`);

const guy = bySlug("aaaaaaaa-0000-0000-0000-000000000001");
check("owner is the meeting's owner", guy.owner_profile_id === GUY && guy.created_by === GUY && guy.v_by === GUY);
const gs = guy.config.presentation.slides;
check("the live slide (no '::') becomes a text slot keeping its caption", gs.length === 1 && gs[0].slots.length === 1 && !gs[0].slots[0].view && gs[0].slots[0].text.startsWith("Biology results this year") && /no longer available/.test(gs[0].slots[0].text), JSON.stringify(gs[0]));
check("its slide title is the caption", gs[0].title === "Biology results this year");
check("delete_by kept in the legacy block", !!guy.config.legacy.deleteBy && guy.config.legacy.meetingId === "aaaaaaaa-0000-0000-0000-000000000001");
check("config carries the dashboard id and meeting date", guy.config.id === guy.id && guy.config.presentation.meetingDate === guy.meeting_date.toISOString().slice(0, 10));

const a = bySlug("aaaaaaaa-0000-0000-0000-000000000002");
const as2 = a.config.presentation.slides;
check("slides in position order, gaps renumbered", as2.map((s) => s.id.slice(-2)).join() === "11,12,13,14,10,15,16,17", as2.map((s) => s.id.slice(-2)).join());
const slotOf = (i) => as2[i].slots[0];
check("every slide: auto layout, one slot", as2.every((s) => s.layout === "auto" && s.slots.length === 1 && s.notes === ""));
check("results trend -> DV-C2-TR-CHART, live", slotOf(0).view?.dataview === "DV-C2-TR-CHART" && slotOf(0).view.keepLive === true && !slotOf(0).view.pinned.year);
check("trend slide keeps the round-5 question as its title", as2[0].title === "How is Biology doing against the other subjects in its category, year on year?", as2[0].title);
const p0 = slotOf(0).view.pinned;
check("pinned settings resolved", p0.subject === "Biology" && p0.subjectLabel === "Biology" && p0.qualificationType === "GCSE (9-1) Full Course" && p0.schoolUrn === "100053" && p0.phase === "ks4" && p0.data === "academic.results" && p0.results === "points" && p0.compare.name === "its subject category" && p0.legacy.chartKey.startsWith("ks4::results"), JSON.stringify(p0));
check("rankings similar-size (KS5) -> DV-C3-CUR-RANKING, set named", slotOf(1).view?.dataview === "DV-C3-CUR-RANKING" && slotOf(1).view.pinned.compare.name === "Similar-sized sixth forms" && slotOf(1).view.pinned.compare.kind === "schools" && as2[1].title === "Sixth forms like us");
check("share_of_cohort -> text slot", !slotOf(2).view && /no longer available/.test(slotOf(2).text));
check("KS2 -> text slot keeping its caption", !slotOf(3).view && slotOf(3).text.startsWith("Primary maths"));
check("context now -> DV-C2-CUR-DONUT, candidates data", slotOf(4).view?.dataview === "DV-C2-CUR-DONUT" && slotOf(4).view.pinned.data === "academic.candidates" && slotOf(4).view.pinned.compare.name === "all subjects");
check("candidates now (vs_chosen) -> DV-C2-CUR-BARS", slotOf(5).view?.dataview === "DV-C2-CUR-BARS" && slotOf(5).view.pinned.compare.name === "your selected subjects" && !slotOf(5).view.pinned.results);
check("candidates trend (KS5) -> DV-C2-TR-INDEXED", slotOf(6).view?.dataview === "DV-C2-TR-INDEXED" && slotOf(6).view.pinned.phase === "ks5" && slotOf(6).view.pinned.qualificationType === "GCE A level");
check("category_vs_categories -> text slot", !slotOf(7).view);
check("school from the owner's single approved membership", a.school_account_id === S1);

const undated = bySlug("aaaaaaaa-0000-0000-0000-000000000003");
check("null meeting_date takes created_at's date", undated.meeting_date.toISOString().slice(0, 10) === "2025-01-15" && undated.config.legacy.meetingDateWasNull === true);
check("a meeting with no slides gets one empty slide", undated.config.presentation.slides.length === 1 && undated.config.presentation.slides[0].slots.length === 0);
const two = bySlug("aaaaaaaa-0000-0000-0000-000000000004");
check("owner at two schools: no school set, none pinned", two.school_account_id === null);

const cRows = (await q(`select count(*)::int n from dashboards where owner_profile_id = '${C}' and kind = 'presentation'`)).rows[0].n;
check("six upcoming meetings for one owner all migrate (cap suspended for the migration)", cRows === 6);
check("cap trigger back on afterwards", await throws(() => as(C, () => q(`insert into dashboards (owner_scope, owner_profile_id, name, kind, meeting_date) values ('user','${C}','seventh','presentation', current_date + 40)`))));
check("helper function dropped", (await q(`select count(*)::int n from pg_proc where proname = 'v06_s7_legacy_slot'`)).rows[0].n === 0);

// Owner-only, as before.
check("A sees her two migrated meetings", (await as(A, () => q(`select id from dashboards where slug like 'legacy-meeting:%'`))).rows.length === 2);
check("A can't see Guy's", (await as(A, () => q(`select id from dashboards where owner_profile_id = '${GUY}'`))).rows.length === 0);
check("B (admin at A's school) can't see A's", (await as(B, () => q(`select id from dashboards where owner_profile_id = '${A}'`))).rows.length === 0);
check("A reads her published version", (await as(A, () => q(`select v.id from dashboard_versions v join dashboards d on d.id = v.dashboard_id where d.owner_profile_id = '${A}'`))).rows.length === 2);
check("A can edit (draft) her migrated meeting", !(await throws(() => as(A, () => q(`insert into dashboard_drafts (dashboard_id, config) values ('${a.id}', '{"schema_version":1}')`)))));
check("A publishes v2", (await as(A, () => q(`select publish_dashboard('${a.id}', '{"schema_version":1}'::jsonb) v`))).rows.length === 1 && (await q(`select max(version)::int v from dashboard_versions where dashboard_id = '${a.id}'`)).rows[0].v === 2);

// Old tables untouched; a second run adds nothing.
const after = await oldCounts();
check("old tables not dropped or altered", after.m === before.m && after.s === before.s && (await q(`select count(*)::int n from information_schema.columns where table_name = 'meetings'`)).rows[0].n === 6);
const nBefore = (await q(`select (select count(*) from dashboards)::int d, (select count(*) from dashboard_versions)::int v`)).rows[0];
await ex(migration);
const nAfter = (await q(`select (select count(*) from dashboards)::int d, (select count(*) from dashboard_versions)::int v`)).rows[0];
check("idempotent: second run inserts nothing", nBefore.d === nAfter.d && nBefore.v === nAfter.v, JSON.stringify([nBefore, nAfter]));
await ex(`insert into meetings (profile_id, name, meeting_date, delete_by) values ('${GUY}', 'Added later', current_date + 3, current_date + 100)`);
await ex(migration);
check("a meeting added later migrates on the next run", (await q(`select count(*)::int n from dashboards where name = 'Added later'`)).rows[0].n === 1);

console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
