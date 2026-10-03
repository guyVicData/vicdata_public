// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v06_rls_pglite.mjs
// Local only (WASM Postgres): applies the S1 + S2 migrations over a stub of the live schema they
// depend on, then checks RLS, caps, immutability and publishing. Never touches a real database.
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
`);

process.on("uncaughtException",(e)=>{console.log("ERROR",e.message);process.exit(1)});
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261103100000_v06_s2_dashboards.sql"]) {
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
const GUY = "52a08818-9132-48a0-8665-8362361eff11", A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";

// S1
const roles = (await q(`select role, roles from school_memberships order by role`)).rows;
check("roles backfilled from role", roles.every((r) => r.roles.length === 1 && r.roles[0] === r.role), JSON.stringify(roles));
check("auto teams seeded", (await q(`select count(*)::int n from teams`)).rows[0].n === 6);
check("Guy is platform admin", (await as(GUY, () => q(`select is_platform_admin() v`))).rows[0].v === true);
check("teacher is not platform admin", (await as(A, () => q(`select is_platform_admin() v`))).rows[0].v === false);
check("non-admin can't read overview", await throws(() => as(A, () => q(`select * from platform_school_overview()`))));
check("Guy reads overview", (await as(GUY, () => q(`select * from platform_school_overview()`))).rows.length === 2);
check("admin B sets A's roles", !(await throws(() => as(B, () => q(`update school_memberships set roles = array['smt','teacher'] where profile_id = '${A}'`)))));
check("role synced to most senior", (await q(`select role from school_memberships where profile_id='${A}'`)).rows[0].role === "smt");
check("teacher A can't change roles (RLS: 0 rows)", (await as(A, () => q(`update school_memberships set roles = array['admissions'] where profile_id = '${A}' returning id`))).rows.length === 0);
const ins = await as(C, () => q(`insert into school_memberships (school_account_id, profile_id, status, roles) values ('11111111-1111-1111-1111-111111111111','${C}','pending_approval', array['smt']) returning roles`));
check("self-insert forced to teacher", ins.rows[0].roles.join() === "teacher");
await q(`delete from school_memberships where profile_id='${C}' and school_account_id='11111111-1111-1111-1111-111111111111'`);
check("A in SMT auto team", (await as(A, () => q(`select is_in_team(id) v from teams where auto_key='smt' and school_account_id='11111111-1111-1111-1111-111111111111'`))).rows[0].v === true);
check("B not in SMT auto team", (await as(B, () => q(`select is_in_team(id) v from teams where auto_key='smt' and school_account_id='11111111-1111-1111-1111-111111111111'`))).rows[0].v === false);
const team = await as(B, () => q(`insert into teams (school_account_id, name) values ('11111111-1111-1111-1111-111111111111','Maths department') returning id`));
check("admin creates named team", team.rows.length === 1);
check("teacher can't create team", await throws(() => as(A, () => q(`insert into teams (school_account_id, name) values ('11111111-1111-1111-1111-111111111111','X')`))));
check("admin can't rename auto team", (await as(B, () => q(`update teams set name='Z' where auto_key='smt' returning id`))).rows.length === 0);
await as(B, () => q(`select record_sign_in()`));
check("sign-in recorded", (await q(`select count(*)::int n from sign_in_events`)).rows[0].n === 1);
check("sign-in events not readable by admin", (await as(B, () => q(`select * from sign_in_events`))).rows.length === 0);
check("Guy toggles VC (no sets: no rows, but logged)", !(await throws(() => as(GUY, () => q(`select platform_set_vc_visibility('100053', true)`)))));
check("audit row written", (await q(`select count(*)::int n from platform_audit_log`)).rows[0].n === 1);

// S2
const vic = await as(GUY, () => q(`insert into dashboards (slug, owner_scope, name) values ('vicdata.ks4.candidates','vicdata','GCSE Candidates') returning id`));
const vid = vic.rows[0].id;
check("teacher can't create VicData dashboard", await throws(() => as(A, () => q(`insert into dashboards (owner_scope, name) values ('vicdata','x')`))));
await as(GUY, () => q(`select publish_dashboard('${vid}', '{"schema_version":1,"id":"vicdata.ks4.candidates"}'::jsonb, 'seed', 'Seeded')`));
check("teacher can't see unassigned VicData dashboard", (await as(A, () => q(`select id from dashboards`))).rows.length === 0);
await as(GUY, () => q(`insert into dashboard_assignments (dashboard_id, target_kind, role, is_key) values ('${vid}','role','teacher',true)`));
check("teacher role sees VicData dashboard at any school (C)", (await as(C, () => q(`select id from dashboards`))).rows.length === 1);
check("teacher sees published version", (await as(C, () => q(`select id from dashboard_versions`))).rows.length === 1);
await as(GUY, () => q(`insert into dashboard_drafts (dashboard_id, config) values ('${vid}', '{"schema_version":1,"draft":true}')`));
check("recipient can't see draft", (await as(C, () => q(`select * from dashboard_drafts`))).rows.length === 0);
check("versions immutable (update)", await throws(() => q(`update dashboard_versions set label='x'`)));
check("versions immutable (delete)", await throws(() => q(`delete from dashboard_versions`)));
await as(GUY, () => q(`select publish_dashboard('${vid}', '{"schema_version":1,"v":2}'::jsonb)`));
check("publish makes v2, clears draft", (await q(`select max(version)::int v from dashboard_versions`)).rows[0].v === 2 && (await q(`select count(*)::int n from dashboard_drafts`)).rows[0].n === 0);
check("recipient sees only the published version", (await as(C, () => q(`select version from dashboard_versions`))).rows.map((r) => r.version).join() === "2");
// caps
let made = 0;
for (let i = 0; i < 6; i++) { try { await as(A, () => q(`insert into dashboards (owner_scope, owner_profile_id, name) values ('user','${A}','mine ${i}')`)); made++; } catch {} }
check("teacher cap 5", made === 5, `made ${made}`);
made = 0;
for (let i = 0; i < 21; i++) { try { await as(B, () => q(`insert into dashboards (owner_scope, owner_profile_id, name) values ('user','${B}','mine ${i}')`)); made++; } catch {} }
check("school-admin cap 20", made === 20, `made ${made}`);
made = 0;
for (let i = 0; i < 25; i++) { try { await as(GUY, () => q(`insert into dashboards (owner_scope, owner_profile_id, name) values ('user','${GUY}','mine ${i}')`)); made++; } catch {} }
check("super-admin unlimited", made === 25);
made = 0;
for (let i = 0; i < 7; i++) { try { await as(A, () => q(`insert into dashboards (owner_scope, owner_profile_id, name, kind, meeting_date) values ('user','${A}','m ${i}','presentation', current_date + 3)`)); made++; } catch {} }
check("teacher upcoming meetings cap 5", made === 5, `made ${made}`);
check("archived meeting not capped", !(await throws(() => as(A, () => q(`insert into dashboards (owner_scope, owner_profile_id, name, kind, meeting_date) values ('user','${A}','old','presentation', current_date - 3)`)))));
check("A can't read B's personal dashboards", (await as(A, () => q(`select id from dashboards where owner_profile_id='${B}'`))).rows.length === 0);
// school dashboard shared to a team
const sd = await as(B, () => q(`insert into dashboards (owner_scope, school_account_id, name) values ('school','11111111-1111-1111-1111-111111111111','Maths watchlist') returning id`));
const sid = sd.rows[0].id;
const mA = (await q(`select id from school_memberships where profile_id='${A}'`)).rows[0].id;
await as(B, () => q(`insert into team_members (team_id, membership_id) values ('${team.rows[0].id}','${mA}')`));
check("A not yet shared", (await as(A, () => q(`select id from dashboards where id='${sid}'`))).rows.length === 0);
await as(B, () => q(`insert into dashboard_assignments (dashboard_id, target_kind, team_id) values ('${sid}','team','${team.rows[0].id}')`));
check("team share reaches team member", (await as(A, () => q(`select id from dashboards where id='${sid}'`))).rows.length === 1);
check("team share doesn't reach other school", (await as(C, () => q(`select id from dashboards where id='${sid}'`))).rows.length === 0);
check("teacher can't assign", await throws(() => as(A, () => q(`insert into dashboard_assignments (dashboard_id, target_kind, role) values ('${sid}','role','teacher')`))));
// personal version retention
const pd = (await as(GUY, () => q(`insert into dashboards (owner_scope, owner_profile_id, name) values ('user','${GUY}','retain') returning id`))).rows[0].id;
for (let i = 0; i < 33; i++) await as(GUY, () => q(`select publish_dashboard('${pd}', '{"schema_version":1}'::jsonb)`));
check("personal keeps last 30", (await q(`select count(*)::int n from dashboard_versions where dashboard_id='${pd}'`)).rows[0].n === 30);
// S3b fix 2: a school with two approved members (A and B at school 1). The pages' old query
// (approved rows, no profile filter) returns both, so maybeSingle() errors; the fix filters
// to the caller (pages) or takes any one row (routes: any visible approved row at the
// school proves membership, because RLS only shows colleagues to members).
const unfiltered = await as(A, () => q(`select m.id from school_memberships m where m.status = 'approved'`));
check("fix 2: unfiltered approved rows at a 2-member school (the bug)", unfiltered.rows.length >= 2, `${unfiltered.rows.length} rows`);
const own = await as(A, () => q(`select m.id from school_memberships m where m.status = 'approved' and m.profile_id = '${A}'`));
check("fix 2: filtered to the caller -> exactly one", own.rows.length === 1);
const outsider = await as(C, () => q(`select m.id from school_memberships m join school_accounts a on a.id = m.school_account_id where m.status = 'approved' and a.school_urn = '100053' limit 1`));
check("fix 2: a non-member sees no approved row at the school (route gate still holds)", outsider.rows.length === 0);

// S3b fix 1: the membership INSERT hole, before and after the hardening migration.
const D = "00000000-0000-0000-0000-00000000000d";
const S1 = "11111111-1111-1111-1111-111111111111";
const holeOpen = !(await throws(() => as(D, () => q(`insert into school_memberships (school_account_id, profile_id, status, is_admin) values ('${S1}','${D}','approved', true)`))));
check("before hardening: the hole is real (direct approved admin insert succeeds)", holeOpen);
await q(`delete from school_memberships where profile_id='${D}'`);
await ex(readFileSync(repo + "20261104090000_v06_membership_insert_hardening.sql", "utf8"));
console.log("applied 20261104090000_v06_membership_insert_hardening.sql");
check("after: direct approved insert refused", await throws(() => as(D, () => q(`insert into school_memberships (school_account_id, profile_id, status) values ('${S1}','${D}','approved')`))));
check("after: direct admin insert refused", await throws(() => as(D, () => q(`insert into school_memberships (school_account_id, profile_id, status, is_admin) values ('${S1}','${D}','pending_approval', true)`))));
check("after: direct insert for someone else refused", await throws(() => as(D, () => q(`insert into school_memberships (school_account_id, profile_id, status) values ('${S1}','${C}','pending_approval')`))));
check("after: own pending request still allowed", !(await throws(() => as(D, () => q(`insert into school_memberships (school_account_id, profile_id, status) values ('${S1}','${D}','pending_approval')`)))));
await q(`delete from school_memberships where profile_id='${D}'`);
const joined = await as(D, () => q(`select * from join_school('100053', 'smt')`));
check("after: join_school still works (later joiner -> pending)", joined.rows[0]?.membership_status === "pending_approval", JSON.stringify(joined.rows[0]));
check("after: join_school ignores the client's role", (await q(`select roles from school_memberships where profile_id='${D}'`)).rows[0].roles.join() === "teacher");
check("after: account insert with a holder refused", await throws(() => as(D, () => q(`insert into school_accounts (school_urn, account_holder_membership_id) values ('999999', gen_random_uuid())`))));
check("after: plain account insert allowed", !(await throws(() => as(D, () => q(`insert into school_accounts (school_urn) values ('999998')`)))));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
