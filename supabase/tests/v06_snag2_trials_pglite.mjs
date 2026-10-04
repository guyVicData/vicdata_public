// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v06_snag2_trials_pglite.mjs
// Local only (WASM Postgres): applies S1, S2 and the membership hardening over the same stub
// of the live schema v06_rls_pglite.mjs uses (plus minimal teacher_view_* and
// recruitment_jobs tables, which have no repo migration), then the snag-2 trials migration,
// and checks who can create, read and reset trial state. Never touches a real database.
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
create table public.teacher_view_preferences (profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, phase text not null, subjects jsonb not null default '[]', columns jsonb not null default '{}', last_seen_period int, updated_at timestamptz, primary key (profile_id, school_urn, phase));
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
const GUY = "52a08818-9132-48a0-8665-8362361eff11", A = "00000000-0000-0000-0000-00000000000a";
const KEY = "130432~trial~smt", OTHER = "130432~trial~teacher";

// Seed (as the table owner): Guy's own normal rows at a real URN, his trial rows for two
// trials, and teacher A's rows -- A's even under the same text as Guy's trial key.
await ex(`
insert into teacher_view_preferences (profile_id, school_urn, phase, subjects) values
 ('${GUY}','100053','ks4','["Maths::GCSE"]'), ('${GUY}','${KEY}','ks4','["Biology::GCSE"]'), ('${GUY}','${OTHER}','ks4','["Art::GCSE"]'),
 ('${A}','100053','ks4','[]'), ('${A}','${KEY}','ks4','[]');
insert into teacher_view_notes (profile_id, school_urn, chart_key, body) values
 ('${GUY}','100053','ks4:candidates:current','mine'), ('${GUY}','${KEY}','ks4:candidates:current','trial'), ('${A}','${KEY}','ks4:candidates:current','A');
insert into teacher_view_onboarding (profile_id, school_urn, phase) values
 ('${GUY}','100053','ks4'), ('${GUY}','${KEY}','ks4'), ('${GUY}','${KEY}','ks5'), ('${GUY}','${OTHER}','ks4'), ('${A}','${KEY}','ks4');
`);

// trial_contexts
check("non-admin can't create a trial_contexts row", await throws(() => as(A, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${A}','130432','teacher')`))));
check("non-admin can't create one for Guy either", await throws(() => as(A, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${GUY}','130432','teacher')`))));
check("Guy creates his own trial_contexts row", !(await throws(() => as(GUY, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${GUY}','130432','smt')`)))));
check("state_key is generated", (await q(`select state_key from trial_contexts`)).rows[0]?.state_key === KEY);
check("Guy can't create a row for someone else", await throws(() => as(GUY, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${A}','130432','smt')`))));
check("bad role rejected", await throws(() => as(GUY, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${GUY}','130432','finance')`))));
check("Guy reads his rows", (await as(GUY, () => q(`select * from trial_contexts`))).rows.length === 1);
check("non-admin reads none", (await as(A, () => q(`select * from trial_contexts`))).rows.length === 0);
check("non-admin updates none", (await as(A, () => q(`update trial_contexts set last_used_at = now() returning 1`))).rows.length === 0);
check("non-admin deletes none", (await as(A, () => q(`delete from trial_contexts returning 1`))).rows.length === 0 && (await q(`select count(*)::int n from trial_contexts`)).rows[0].n === 1);
check("Guy upserts last_used_at", !(await throws(() => as(GUY, () => q(`insert into trial_contexts (profile_id, school_urn, role) values ('${GUY}','130432','smt') on conflict (profile_id, school_urn, role) do update set last_used_at = now()`)))));

// reset_trial
check("non-admin calling reset_trial fails", await throws(() => as(A, () => q(`select reset_trial('130432','smt')`))));
check("reset_trial rejects a bad role", await throws(() => as(GUY, () => q(`select reset_trial('130432','finance')`))));
check("Guy calls reset_trial", !(await throws(() => as(GUY, () => q(`select reset_trial('130432','smt')`)))));
const n = async (t, who, urn) => (await q(`select count(*)::int n from ${t} where profile_id = '${who}' and school_urn = '${urn}'`)).rows[0].n;
check("Guy's trial prefs cleared", (await n("teacher_view_preferences", GUY, KEY)) === 0);
check("Guy's trial notes cleared", (await n("teacher_view_notes", GUY, KEY)) === 0);
check("Guy's trial onboarding cleared", (await n("teacher_view_onboarding", GUY, KEY)) === 0);
check("Guy's own normal rows survive", (await n("teacher_view_preferences", GUY, "100053")) === 1 && (await n("teacher_view_notes", GUY, "100053")) === 1 && (await n("teacher_view_onboarding", GUY, "100053")) === 1);
check("Guy's other trial survives", (await n("teacher_view_preferences", GUY, OTHER)) === 1 && (await n("teacher_view_onboarding", GUY, OTHER)) === 1);
check("another user's rows survive (even under the same key text)", (await n("teacher_view_preferences", A, KEY)) === 1 && (await n("teacher_view_notes", A, KEY)) === 1 && (await n("teacher_view_onboarding", A, KEY)) === 1 && (await n("teacher_view_preferences", A, "100053")) === 1);

// trial_key columns
check("trial_key columns exist, existing rows null", (await q(`select count(*)::int n from dashboards where trial_key is not null`)).rows[0].n === 0);
const mine = await as(GUY, () => q(`insert into dashboards (owner_scope, owner_profile_id, name, trial_key) values ('user','${GUY}','Trial dash','${KEY}') returning id`));
check("Guy saves a trial personal dashboard", mine.rows.length === 1);
check("a VicData row can't carry a trial_key", await throws(() => as(GUY, () => q(`insert into dashboards (owner_scope, name, trial_key) values ('vicdata','x','${KEY}')`))));
check("Guy's normal list (trial_key is null) hides it", (await as(GUY, () => q(`select id from dashboards where owner_scope='user' and owner_profile_id='${GUY}' and trial_key is null`))).rows.length === 0);
check("non-admin can't see Guy's trial dashboard", (await as(A, () => q(`select id from dashboards where trial_key is not null`))).rows.length === 0);
check("recruitment job with trial_key", !(await throws(() => as(GUY, () => q(`insert into recruitment_jobs (profile_id, title, delete_by, trial_key) values ('${GUY}','Head of Maths', current_date + 30, '${KEY}')`)))));
check("non-admin can't see it", (await as(A, () => q(`select id from recruitment_jobs`))).rows.length === 0);
check("no membership written by any of it", (await q(`select count(*)::int n from school_memberships where profile_id='${GUY}'`)).rows[0].n === 0);

console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
