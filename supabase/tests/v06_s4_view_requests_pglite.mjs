// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v06_s4_view_requests_pglite.mjs
// Local only (WASM Postgres): applies S1 (is_platform_admin) and the S4 view_requests migration
// over the same stub of the live schema as v06_rls_pglite.mjs, then checks its RLS. Never
// touches a real database.
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

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104100000_v06_s4_view_requests.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
// Re-applying is safe (create if not exists / drop policy if exists).
await ex(readFileSync(repo + "20261104100000_v06_s4_view_requests.sql", "utf8"));
console.log("re-applied 20261104100000_v06_s4_view_requests.sql");

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (sub, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const asAnon = async (fn) => { await ex(`set role anon;`); try { return await fn(); } finally { await ex(`reset role;`); } };
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };
const GUY = "52a08818-9132-48a0-8665-8362361eff11", A = "00000000-0000-0000-0000-00000000000a", C = "00000000-0000-0000-0000-00000000000c";

// The chooser's PickPanelContext, as the client sends it. No RETURNING: the asker has no
// SELECT, so (as with PostgREST's return=minimal, which the client uses) the insert can't
// read its own row back.
const ctx = JSON.stringify({
  data: "rolls", phase: "ks4", focus: { kind: "school" }, compare: { kinds: ["schools"], schools: { spec: "10-nearest", label: "10 nearest" } }, time: "over_time",
  labels: { dashboard: "Admissions overview", column: "Our roll", row: "Trends" }, source: { dashboardId: "d1", columnId: "c1", rowId: "trends", panelId: "d1.c1.trends" },
});
const ins = (who, extra = "") => as(who, () => q(`insert into view_requests (description, context, dashboard_slug, panel_id${extra ? ", " + extra.split("=")[0] : ""}) values ('Roll by year group', '${ctx}'::jsonb, 'd1', 'd1.c1.trends'${extra ? ", " + extra.split("=")[1] : ""})`));

check("teacher A inserts a request", !(await throws(() => ins(A))));
const r1 = await q(`select profile_id, status from view_requests`);
check("profile_id defaults to the caller", r1.rows[0]?.profile_id === A);
check("status defaults to open", r1.rows[0]?.status === "open");
check("insert ... returning is refused to the asker (no read-back)", await throws(() => as(A, () => q(`insert into view_requests (context) values ('{}'::jsonb) returning id`))));
check("context stored verbatim", (await q(`select context->'labels'->>'column' c from view_requests`)).rows[0].c === "Our roll");
await ins(C);
check("teacher C (another school) inserts too", (await q(`select count(*)::int n from view_requests`)).rows[0].n === 2);
check("insert as someone else refused", await throws(() => as(A, () => q(`insert into view_requests (profile_id, context) values ('${C}', '{}'::jsonb)`))));
check("insert pre-marked built refused", await throws(() => ins(A, "status='built'")));
check("non-object context refused", await throws(() => as(A, () => q(`insert into view_requests (context) values ('[1,2]'::jsonb)`))));
check("over-long description refused", await throws(() => as(A, () => q(`insert into view_requests (description, context) values (repeat('x', 2001), '{}'::jsonb)`))));
check("anon can't insert", await throws(() => asAnon(() => q(`insert into view_requests (context) values ('{}'::jsonb)`))));
check("anon can't read", await throws(() => asAnon(() => q(`select * from view_requests`))));
check("teacher A can't read requests (not even own)", (await as(A, () => q(`select id from view_requests`))).rows.length === 0);
check("teacher A can't update (0 rows)", (await as(A, () => q(`update view_requests set status='built' returning id`))).rows.length === 0);
check("teacher A can't delete", await throws(() => as(A, () => q(`delete from view_requests`))));
check("platform admin reads every request", (await as(GUY, () => q(`select id from view_requests`))).rows.length === 2);
check("platform admin moves status", (await as(GUY, () => q(`update view_requests set status='planned' returning id`))).rows.length === 2);
check("bad status refused", await throws(() => as(GUY, () => q(`update view_requests set status='nope'`))));
check("platform admin can't delete either", await throws(() => as(GUY, () => q(`delete from view_requests`))));
check("deleting the profile removes its requests", (await q(`delete from profiles where id='${C}' returning id`)).rows.length === 1 && (await q(`select count(*)::int n from view_requests`)).rows[0].n === 1);
console.log(fails ? `${fails} FAILED` : "ALL PASS");
