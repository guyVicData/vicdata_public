// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v07_sync_roles_nullif_pglite.mjs
// VicData 0.7 admissions r2, D1. Local only (WASM Postgres): applies 0.6 S1 and the membership
// hardening over a stub of the live schema (the same stub as v07_admissions_rls_pglite.mjs), shows
// sync_membership_roles() failing on an EMPTY claims setting, applies the D1 migration, then shows
// the same writes succeeding with the trigger's behaviour otherwise unchanged. Never touches a
// real database.
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
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid references public.school_accounts(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, status text default 'pending_verification', is_admin bool not null default false, role text default 'teacher' check (role in ('teacher','hod','smt','finance','admissions')), individual_tier_active bool, requested_at timestamptz, approved_at timestamptz, approved_by uuid, unique (school_account_id, profile_id));
create table public.vc_comparator_sets (id uuid primary key default gen_random_uuid(), name text);
create table public.vc_set_school_visibility (school_account_id uuid, vc_set_id uuid, primary key (school_account_id, vc_set_id));
create function public.is_member_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved') $$;
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved' and is_admin) $$;
create function public.is_account_holder_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_accounts sa join school_memberships sm on sm.id = sa.account_holder_membership_id where sa.id = p and sm.profile_id = auth.uid()) $$;
-- the live is_admin guard (20260807102000_account_holder_handoff.sql)
create function public.enforce_is_admin_change_by_account_holder_only() returns trigger language plpgsql as $$
begin
    if new.is_admin is distinct from old.is_admin and not public.is_account_holder_of_school_account(new.school_account_id) then
        raise exception 'only the account holder can change admin status';
    end if;
    return new;
end; $$;
create trigger school_memberships_is_admin_guard before update on public.school_memberships for each row execute function public.enforce_is_admin_change_by_account_holder_only();
alter table public.school_memberships enable row level security;
create policy school_memberships_delete_admin_or_holder on public.school_memberships for delete using (is_admin_of_school_account(school_account_id) or is_account_holder_of_school_account(school_account_id));
create policy school_memberships_insert_own on public.school_memberships for insert with check (profile_id = auth.uid());
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
create policy school_memberships_update_admin_or_holder on public.school_memberships for update using (is_admin_of_school_account(school_account_id) or is_account_holder_of_school_account(school_account_id));
alter table public.school_accounts enable row level security;
create policy school_accounts_select_member on public.school_accounts for select using (is_member_of_school_account(id));
create policy school_accounts_insert_authenticated on public.school_accounts for insert with check (auth.uid() is not null);
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104090000_v06_membership_insert_hardening.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
const D1 = "20261107090000_v07_admissions_r2_sync_roles_nullif.sql";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const throws = async (fn) => { try { await fn(); return false; } catch (e) { return e.message; } };
const claims = (v) => ex(`select set_config('request.jwt.claims', '${v}', false)`);
const id = (c) => `00000000-0000-0000-0000-0000000000${c}`;
const S1 = "11111111-1111-1111-1111-111111111111";
await ex(`insert into profiles (id, full_name) values ${Array.from({ length: 12 }, (_, i) => `('${id(String(i + 1).padStart(2, "0"))}','p${i + 1}')`).join(",")};
insert into schools values ('100053','Acland Burghley School','Local authority maintained schools','Community school',null);
insert into school_accounts (id, school_urn) values ('${S1}','100053');`);
const insert = (n, roles) => q(`insert into school_memberships (school_account_id, profile_id, status, roles) values ('${S1}','${id(n)}','approved', array[${roles.map((r) => `'${r}'`).join(",")}]::text[]) returning id, roles, role`);
const body = async () => (await q(`select prosrc from pg_proc where proname = 'sync_membership_roles'`)).rows[0].prosrc;
const s1Body = await body();

console.log("\n-- before D1 (the 0.6 S1 trigger as applied)");
await claims("");
const e1 = await throws(() => insert("01", ["teacher"]));
check("an empty claims setting: an insert fails", typeof e1 === "string" && /json/i.test(e1), `(${e1})`);
await claims('{"role":"service_role"}');
const seeded = (await insert("02", ["smt"])).rows[0];
check("the service role still writes a role set as given", seeded.roles.join() === "smt" && seeded.role === "smt");
await claims("");
const e2 = await throws(() => q(`update school_memberships set role = 'admissions' where id = '${seeded.id}'`));
check("an empty claims setting: an update fails too", typeof e2 === "string" && /json/i.test(e2), `(${e2})`);

await ex(readFileSync(repo + D1, "utf8"));
console.log("\napplied", D1);

console.log("\n-- after D1");
await claims("");
const r1 = await throws(() => insert("03", ["smt"]));
check("an empty claims setting: the insert succeeds", r1 === false);
const row3 = (await q(`select roles, role from school_memberships where profile_id = '${id("03")}'`)).rows[0];
check("...and is treated as not the service role (a joiner's set is Teacher)", row3?.roles.join() === "teacher" && row3?.role === "teacher");
check("an empty claims setting: an update of `role` alone succeeds and syncs roles", (await throws(() => q(`update school_memberships set role = 'admissions' where id = '${seeded.id}'`))) === false
  && (await q(`select roles, role from school_memberships where id = '${seeded.id}'`)).rows[0].roles.join() === "admissions");
await ex(`reset "request.jwt.claims"`);
check("claims never set (NULL): an insert succeeds, Teacher", (await insert("04", ["smt"])).rows[0].roles.join() === "teacher");
await claims('{"role":"service_role"}');
check("the service role: the role set as given, duplicates out, sorted", (await insert("05", ["smt", "admissions", "smt"])).rows[0].roles.join() === "admissions,smt");
await claims('{"role":"authenticated","sub":"x"}');
check("an authenticated joiner: Teacher whatever was asked", (await insert("06", ["smt"])).rows[0].roles.join() === "teacher");
await claims("");
const d1Body = await body();
const norm = (s) => s.replace(/nullif\(current_setting\('request\.jwt\.claims', true\), ''\)/, "current_setting('request.jwt.claims', true)");
check("the function body differs from S1's only by the nullif guard", norm(d1Body) === s1Body && d1Body !== s1Body);
check("the trigger still points at the function", (await q(`select count(*)::int n from pg_trigger where tgname = 'school_memberships_sync_roles'`)).rows[0].n === 1);
check("re-running D1 is safe", (await throws(() => ex(readFileSync(repo + D1, "utf8")))) === false);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
