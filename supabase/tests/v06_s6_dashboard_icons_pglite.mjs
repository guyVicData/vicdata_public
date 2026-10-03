// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v06_s6_dashboard_icons_pglite.mjs
// Local only (WASM Postgres): applies S1 (is_platform_admin) and the S6 dashboard-icons
// Storage migration over the same stub of the live schema as v06_s4_view_requests_pglite.mjs,
// plus a stub of Supabase's `storage` schema (buckets, objects with RLS on, as every
// Supabase project has it). PGlite has no Storage API, so what is checked is the policies
// on storage.objects -- the layer the Storage API enforces through. Never touches a real
// database.
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
 ('00000000-0000-0000-0000-00000000000b','Admin B');
insert into public.schools values ('100053','Acland Burghley School','Local authority maintained schools','Community school','https://www.aclandburghley.camden.sch.uk');
insert into public.school_accounts (id, school_urn) values ('11111111-1111-1111-1111-111111111111','100053');
insert into public.school_memberships (school_account_id, profile_id, status, is_admin, role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','approved',false,'teacher'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','approved',true,'smt');

-- Stub of Supabase's storage schema (the columns the policies and the bucket row use).
create schema storage;
create table storage.buckets (id text primary key, name text not null unique, owner uuid, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid(), metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant all on storage.objects to authenticated, anon;
grant select on storage.buckets to authenticated, anon;
-- Another bucket's existing policy, to prove this migration leaves it alone.
insert into storage.buckets (id, name, public) values ('other', 'other', false);
create policy other_bucket_own on storage.objects for all to authenticated using (bucket_id = 'other' and owner = auth.uid()) with check (bucket_id = 'other' and owner = auth.uid());
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104130000_v06_s6_dashboard_icons.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
await ex(readFileSync(repo + "20261104130000_v06_s6_dashboard_icons.sql", "utf8"));
console.log("re-applied 20261104130000_v06_s6_dashboard_icons.sql");

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (sub, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const asAnon = async (fn) => { await ex(`set role anon;`); try { return await fn(); } finally { await ex(`reset role;`); } };
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };
const GUY = "52a08818-9132-48a0-8665-8362361eff11", A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
const put = (name, bucket = "dashboard-icons") => q(`insert into storage.objects (bucket_id, name, metadata) values ('${bucket}', '${name}', '{"mimetype":"image/png"}')`);

const bucket = (await q(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'dashboard-icons'`)).rows[0];
check("bucket exists and is public", bucket?.public === true);
check("bucket limit 512 KB, PNG and SVG only", bucket?.file_size_limit === 524288 && JSON.stringify(bucket?.allowed_mime_types) === JSON.stringify(["image/png", "image/svg+xml"]));
check("re-applying kept one bucket row", (await q(`select count(*)::int n from storage.buckets where id = 'dashboard-icons'`)).rows[0].n === 1);

check("platform admin uploads", !(await throws(() => as(GUY, () => put("mine-1/a.png")))));
check("teacher can't upload", await throws(() => as(A, () => put("mine-1/b.png"))));
check("School-Admin can't upload", await throws(() => as(B, () => put("school/c.png"))));
check("anon can't upload", await throws(() => asAnon(() => put("x/d.png"))));
check("anyone signed in reads (lists) icons", (await as(A, () => q(`select name from storage.objects where bucket_id = 'dashboard-icons'`))).rows.length === 1);
check("anon reads icons", (await asAnon(() => q(`select name from storage.objects where bucket_id = 'dashboard-icons'`))).rows.length === 1);
check("teacher can't rename (0 rows)", (await as(A, () => q(`update storage.objects set name = 'evil.png' where bucket_id = 'dashboard-icons' returning id`))).rows.length === 0);
check("teacher can't delete (0 rows)", (await as(A, () => q(`delete from storage.objects where bucket_id = 'dashboard-icons' returning id`))).rows.length === 0);
check("platform admin replaces (update)", (await as(GUY, () => q(`update storage.objects set metadata = '{"mimetype":"image/svg+xml"}' where bucket_id = 'dashboard-icons' returning id`))).rows.length === 1);
check("platform admin deletes", (await as(GUY, () => q(`delete from storage.objects where bucket_id = 'dashboard-icons' returning id`))).rows.length === 1);
// The other bucket keeps its own rules.
check("other bucket: owner still writes there", !(await throws(() => as(A, () => put("mine.txt", "other")))));
check("other bucket: not readable through the icons policy", (await asAnon(() => q(`select name from storage.objects where bucket_id = 'other'`))).rows.length === 0);
const policies = (await q(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' order by 1`)).rows.map((r) => r.policyname);
check("exactly four icon policies plus the other bucket's", JSON.stringify(policies) === JSON.stringify(["dashboard_icons_delete", "dashboard_icons_insert", "dashboard_icons_read", "dashboard_icons_update", "other_bucket_own"]), JSON.stringify(policies));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
