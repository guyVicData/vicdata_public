// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v06_snag4_view_as_pglite.mjs
// 0.6 snagging round 4 (View as). No new migration: this applies the same S1/S2/hardening/
// snag-2 migrations over the same stub of the live schema as v06_snag2_trials_pglite.mjs
// (teacher_view_preferences now with the live phase CHECK), and checks what View as relies
// on: only a platform admin can enter it (log 'view_as', keep its recent list, reset it);
// its state never lands in Guy's own rows or the school's; and the comparator sets it saves
// (Guy's own teacher_view_notes rows under "{state key}~sets") are invisible to the school
// and to Guy-as-himself, and survive Start fresh. Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);

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
create policy school_memberships_delete_admin_or_holder on public.school_memberships for delete using (is_admin_of_school_account(school_account_id));
create policy school_memberships_insert_own on public.school_memberships for insert with check (profile_id = auth.uid());
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
alter table public.school_accounts enable row level security;
create policy school_accounts_select_all on public.school_accounts for select using (true);
create policy school_accounts_insert_authenticated on public.school_accounts for insert with check (auth.uid() is not null);
create policy school_memberships_update_admin_or_holder on public.school_memberships for update using (is_admin_of_school_account(school_account_id));
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
insert into public.profiles (id, full_name) values
 ('52a08818-9132-48a0-8665-8362361eff11','Guy'),
 ('00000000-0000-0000-0000-00000000000a','Teacher A'),
 ('00000000-0000-0000-0000-00000000000b','Admin B'),
 ('00000000-0000-0000-0000-00000000000c','Other C'),
 ('00000000-0000-0000-0000-00000000000d','Joiner D');
insert into public.schools values ('100053','Acland Burghley School','Local authority maintained schools','Community school','https://www.aclandburghley.camden.sch.uk'), ('117037','The King''s School','Independent schools','Other independent school','https://ksw.org.uk');
insert into public.school_accounts (id, school_urn) values ('11111111-1111-1111-1111-111111111111','100053'), ('22222222-2222-2222-2222-222222222222','117037');
insert into public.school_memberships (school_account_id, profile_id, status, is_admin, role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','approved',false,'smt'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','approved',true,'teacher'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000c','approved',false,'teacher');
-- Live shapes per docs/v0.6/audit_v1.md Part C §6 (school_urn text, no FK, ALL-own RLS).
create table public.teacher_view_preferences (profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, phase text not null check (phase = any (array['ks2','ks4','ks5'])), subjects jsonb not null default '[]', columns jsonb not null default '{}', last_seen_period int, updated_at timestamptz, primary key (profile_id, school_urn, phase));
create table public.teacher_view_notes (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, chart_key text not null, body text not null, created_at timestamptz default now(), updated_at timestamptz, unique (profile_id, school_urn, chart_key));
create table public.teacher_view_onboarding (profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, phase text not null, completed_at timestamptz default now(), primary key (profile_id, school_urn, phase));
create table public.recruitment_jobs (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, title text not null, subject text, ks_stage text, delete_by date not null, created_at timestamptz default now());
alter table public.teacher_view_preferences enable row level security;
alter table public.teacher_view_notes enable row level security;
alter table public.teacher_view_onboarding enable row level security;
alter table public.recruitment_jobs enable row level security;
create policy teacher_view_preferences_own on public.teacher_view_preferences for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy teacher_view_notes_own on public.teacher_view_notes for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy teacher_view_onboarding_own on public.teacher_view_onboarding for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy recruitment_jobs_own on public.recruitment_jobs for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
for (const f of [
  "20261103090000_v06_s1_roles_teams_platform.sql",
  "20261103100000_v06_s2_dashboards.sql",
  "20261104090000_v06_membership_insert_hardening.sql",
  "20261105090000_v06_snag2_trials.sql",
]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
await ex(`grant all on all tables in schema public to authenticated, anon;`);

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (sub, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };


const GUY = "52a08818-9132-48a0-8665-8362361eff11", A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
const KEY = "100053~trial~teacher", SETS = `${KEY}~sets`;
await ex(`create table public.saved_sets (id uuid primary key default gen_random_uuid(), school_account_id uuid, owner_membership_id uuid, set_type text, name text);
grant all on public.saved_sets to authenticated;`);
// Guy's own normal rows at a real URN (as himself), and an old try_as log row.
await ex(`
insert into teacher_view_preferences (profile_id, school_urn, phase, subjects) values ('${GUY}','100053','ks4','["Maths::GCSE"]');
insert into teacher_view_notes (profile_id, school_urn, chart_key, body) values ('${GUY}','100053','ks4:candidates:current','mine');
insert into platform_audit_log (actor_profile_id, action, school_urn, detail) values ('${GUY}','try_as','137625','{"role":"teacher","fresh":false}');
`);
const n = async (sql) => (await q(sql)).rows[0].n;
const own = async () => JSON.stringify((await q(`select school_urn, phase, subjects from teacher_view_preferences where profile_id='${GUY}' and school_urn='100053'`)).rows) + JSON.stringify((await q(`select chart_key, body from teacher_view_notes where profile_id='${GUY}' and school_urn='100053'`)).rows);
const before = await own();

// 1. Only a platform admin can enter View as.
check("non-admin can't log view_as", await throws(() => as(A, () => q(`select log_platform_action('view_as','100053','{"role":"teacher","fresh":true}'::jsonb)`))));
check("Guy logs view_as", !(await throws(() => as(GUY, () => q(`select log_platform_action('view_as','100053','{"role":"teacher","fresh":true}'::jsonb)`)))));
check("the view_as row says role and fresh", (await q(`select detail from platform_audit_log where action='view_as'`)).rows[0]?.detail?.role === "teacher");
check("old try_as rows untouched", (await n(`select count(*)::int n from platform_audit_log where action='try_as'`)) === 1);
check("non-admin can't keep a recent list", await throws(() => as(A, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${A}','100053','teacher')`))));
check("non-admin can't Start fresh", await throws(() => as(A, () => q(`select reset_trial('100053','teacher')`))));
check("non-admin can't read the audit log", (await as(A, () => q(`select * from platform_audit_log`))).rows.length === 0);

// 2. View as state goes under the state key, never into Guy's own rows or the school's.
await as(GUY, () => q(`insert into teacher_view_preferences (profile_id, school_urn, phase, subjects) values ('${GUY}','${KEY}','ks4','["History::GCSE"]') on conflict (profile_id, school_urn, phase) do update set subjects = excluded.subjects`));
await as(GUY, () => q(`insert into teacher_view_onboarding (profile_id, school_urn, phase) values ('${GUY}','${KEY}','ks4')`));
check("Guy's own rows unchanged by View as writes", (await own()) === before);
check("a colleague at the school sees none of Guy's View as rows", (await as(B, () => q(`select * from teacher_view_preferences where school_urn like '100053%'`))).rows.length === 0);

// 3. Comparator sets saved in View as.
const save = (id, name) => as(GUY, () => q(`insert into teacher_view_notes (profile_id, school_urn, chart_key, body) values ('${GUY}','${SETS}','set:${id}', $1) on conflict (profile_id, school_urn, chart_key) do update set body = excluded.body`, [JSON.stringify({ name, urns: ["100050", "100059"], config: {}, createdAt: "2026-10-04T10:00:00Z" })]));
check("Guy saves a View as set", !(await throws(() => save("va-1", "Rivals"))));
check("and edits it in place", !(await throws(() => save("va-1", "Rivals 2"))) && (await n(`select count(*)::int n from teacher_view_notes where school_urn='${SETS}'`)) === 1);
check("a member of the school can't read it", (await as(B, () => q(`select * from teacher_view_notes where school_urn='${SETS}'`))).rows.length === 0);
check("nor any other user", (await as(A, () => q(`select * from teacher_view_notes where chart_key like 'set:%'`))).rows.length === 0);
check("Guy as himself (notes by real URN) doesn't get it", (await as(GUY, () => q(`select * from teacher_view_notes where school_urn='100053'`))).rows.every((r) => !r.chart_key.startsWith("set:")));
check("the View as's own page notes (by state key) don't include it", (await as(GUY, () => q(`select * from teacher_view_notes where school_urn='${KEY}'`))).rows.length === 0);
check("someone else can't write into Guy's set rows", await throws(() => as(A, () => q(`insert into teacher_view_notes (profile_id, school_urn, chart_key, body) values ('${GUY}','${SETS}','set:x','{}')`))));
check("nothing in the school's saved_sets", (await n(`select count(*)::int n from saved_sets`)) === 0);
check("the prefs phase CHECK refuses a non-phase row (why sets live in notes)", await throws(() => as(GUY, () => q(`insert into teacher_view_preferences (profile_id, school_urn, phase) values ('${GUY}','${KEY}','comparator_sets')`))));

// 4. Start fresh clears the View as's state but keeps its sets (things made are kept).
check("Guy Starts fresh", !(await throws(() => as(GUY, () => q(`select reset_trial('100053','teacher')`)))));
check("its state is cleared", (await n(`select count(*)::int n from teacher_view_preferences where school_urn='${KEY}'`)) === 0 && (await n(`select count(*)::int n from teacher_view_onboarding where school_urn='${KEY}'`)) === 0);
check("its sets are kept", (await n(`select count(*)::int n from teacher_view_notes where school_urn='${SETS}'`)) === 1);
check("Guy's own rows still unchanged", (await own()) === before);
check("no membership written", (await n(`select count(*)::int n from school_memberships where profile_id='${GUY}'`)) === 0);

console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
