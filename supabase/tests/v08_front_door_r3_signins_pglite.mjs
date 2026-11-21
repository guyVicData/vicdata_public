// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_front_door_r3_signins_pglite.mjs
// VicData 0.8 front door, part 3 (E24, E25, F27; R-SIGNINS-RLS, R-JOIN-DOMAIN, and the tables behind R-DEVICE-CODES
// and R-DEVICE-CAP): the migration 20261126090000_v08_front_door_r3_signins.sql and its ops apply/rollback, over a
// stub of the live schema it depends on -- auth.uid() and auth.jwt() from GUCs, auth.sessions; profiles,
// platform_admins; schools, school_accounts and school_memberships with their live RLS policies and helpers
// (20260807092000, 0.7 r1's is_school_admin_or_holder). Local only (WASM Postgres); never touches a real database.
// Checks: who reads devices and sign-ins (the person, their school's School-Admin or account holder, nobody else;
// never the token hash or session id); nobody but the service role writes them or reads codes; revoke_auth_session
// is the service role's only and ends the session; the domains list (admin-only, no personal domains, seeded from the
// first School-Admin); join_school marks an off-domain request, an on-domain one is ordinary; an exception needs
// explicit approval; existing members are unaffected; the migration runs twice; the rollback removes it all.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);

await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table auth.sessions (id uuid primary key, user_id uuid);
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.profiles (id uuid primary key, email text not null, full_name text);
create table public.platform_admins (profile_id uuid primary key references public.profiles (id));
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where profile_id = auth.uid()); $$;
create table public.schools (urn text primary key, current_name text, website text);
create table public.school_accounts (id uuid primary key default gen_random_uuid(), school_urn text not null unique references public.schools (urn), account_holder_membership_id uuid, tier text not null default 'individual', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid not null references public.school_accounts (id) on delete cascade, profile_id uuid not null references public.profiles (id) on delete cascade, status text not null, is_admin boolean not null default false, role text, roles text[] not null default '{}', requested_at timestamptz not null default now(), approved_at timestamptz, approved_by uuid references public.school_memberships (id), unique (school_account_id, profile_id));
create function public.is_member_of_school_account(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_memberships where school_account_id = p and profile_id = auth.uid() and status = 'approved'); $$;
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_memberships where school_account_id = p and profile_id = auth.uid() and status = 'approved' and is_admin = true); $$;
create function public.is_account_holder_of_school_account(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_accounts a join public.school_memberships m on m.id = a.account_holder_membership_id where a.id = p and m.profile_id = auth.uid()); $$;
create function public.is_school_admin_or_holder(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_of_school_account(p) or public.is_account_holder_of_school_account(p); $$;
alter table public.school_memberships enable row level security;
create policy school_memberships_select_own_or_school on public.school_memberships for select using (profile_id = auth.uid() or public.is_member_of_school_account(school_account_id));
create policy school_memberships_update_admin_or_holder on public.school_memberships for update using (public.is_admin_of_school_account(school_account_id) or public.is_account_holder_of_school_account(school_account_id));
grant select, update on public.school_memberships to authenticated;
grant execute on all functions in schema public to authenticated;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });

let fails = 0;
let passes = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (ok) passes++; else fails++; };
const as = async (role, uid, fn, email = null) => {
  await ex(`set role ${role}`);
  await ex(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
  await ex(`select set_config('request.jwt.claims', '${JSON.stringify(uid ? { sub: uid, email: email ?? "" } : {})}', false)`);
  try { return await fn(); } finally { await ex("reset role"); await ex(`select set_config('request.jwt.claim.sub', '', false)`); await ex(`select set_config('request.jwt.claims', '', false)`); }
};
const refused = async (fn) => { try { const r = await fn(); return (r.rows?.length ?? 0) === 0 && (r.affectedRows ?? 0) === 0; } catch (e) { return /permission denied|row-level security|violates|outside the school|set by join_school/i.test(e.message); } };
const errorOf = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [ADMIN, HOLDER, TEACHER, PENDING, OTHER_ADMIN, STRANGER, PLAT, GMAIL_ADMIN, NEWBIE, OUTSIDER, SUB] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(id);
const [SA, SB, SC] = [101, 102, 103].map(id);
await ex(`
insert into profiles (id, email) values ('${ADMIN}', 'head@leightonpark.com'), ('${HOLDER}', 'bursar@leightonpark.com'), ('${TEACHER}', 'teacher@leightonpark.com'),
  ('${PENDING}', 'pending@leightonpark.com'), ('${OTHER_ADMIN}', 'admin@thechase.org.uk'), ('${STRANGER}', 'someone@example.org'), ('${PLAT}', 'guy@vicdata.co.uk'),
  ('${GMAIL_ADMIN}', 'someone@gmail.com'), ('${NEWBIE}', 'new.teacher@leightonpark.com'), ('${OUTSIDER}', 'governor@gmail.com'), ('${SUB}', 'staff@mail.leightonpark.com');
insert into platform_admins values ('${PLAT}');
insert into schools values ('110110', 'Leighton Park School', 'https://www.leightonpark.com/'), ('137625', 'The Chase', 'https://www.thechase.org.uk'), ('100001', 'A gmail school', null), ('100002', 'A new school', 'https://newschool.sch.uk');
insert into school_accounts (id, school_urn) values ('${SA}', '110110'), ('${SB}', '137625'), ('${SC}', '100001');
insert into school_memberships (id, school_account_id, profile_id, status, is_admin, roles, approved_at) values
  ('${id(301)}', '${SA}', '${ADMIN}', 'approved', true, '{teacher}', '2026-09-02'),
  ('${id(302)}', '${SA}', '${HOLDER}', 'approved', false, '{smt}', '2026-09-01'),
  ('${id(303)}', '${SA}', '${TEACHER}', 'approved', false, '{teacher}', '2026-09-03'),
  ('${id(304)}', '${SA}', '${PENDING}', 'pending_approval', false, '{}', null),
  ('${id(305)}', '${SB}', '${OTHER_ADMIN}', 'approved', true, '{}', '2026-10-01'),
  ('${id(306)}', '${SC}', '${GMAIL_ADMIN}', 'approved', true, '{}', '2026-10-02');
update school_accounts set account_holder_membership_id = '${id(302)}' where id = '${SA}';
`);

await ex(`create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text);`);
const M = "migrations/20261126090000_v08_front_door_r3_signins.sql";
await ex(readFileSync(repo + M, "utf8"));
await ex(readFileSync(repo + M, "utf8"));
console.log("applied", M, "twice");

console.log("\n-- the domain lists, seeded");
const domains = async (acc) => (await q(`select domain from school_email_domains where school_account_id = '${acc}' order by domain`)).rows.map((r) => r.domain);
check("R-JOIN-DOMAIN: Leighton Park's list is its account holder's domain", JSON.stringify(await domains(SA)) === '["leightonpark.com"]', JSON.stringify(await domains(SA)));
check("R-JOIN-DOMAIN: The Chase's is its School-Admin's", JSON.stringify(await domains(SB)) === '["thechase.org.uk"]');
check("R-JOIN-DOMAIN: a School-Admin on a personal address seeds nothing", (await domains(SC)).length === 0);
check("R-JOIN-DOMAIN: existing members are unaffected (none off-domain)", (await q(`select count(*)::int n from school_memberships where off_domain`)).rows[0].n === 0);

console.log("\n-- who changes the list");
check("R-JOIN-DOMAIN: the School-Admin adds a domain", (await as("authenticated", ADMIN, () => q(`insert into school_email_domains (school_account_id, domain, added_by) values ('${SA}', 'lpstaff.org.uk', '${ADMIN}') returning domain`))).rows.length === 1);
check("R-JOIN-DOMAIN: the account holder reads it", (await as("authenticated", HOLDER, () => q(`select domain from school_email_domains where school_account_id = '${SA}'`))).rows.length === 2);
check("R-JOIN-DOMAIN: a teacher reads nothing and adds nothing", (await as("authenticated", TEACHER, () => q(`select domain from school_email_domains`))).rows.length === 0 && await refused(() => as("authenticated", TEACHER, () => q(`insert into school_email_domains (school_account_id, domain, added_by) values ('${SA}', 'evil.com', '${TEACHER}') returning id`))));
check("R-JOIN-DOMAIN: another school's admin can't touch it", await refused(() => as("authenticated", OTHER_ADMIN, () => q(`delete from school_email_domains where school_account_id = '${SA}' returning id`))));
check("R-JOIN-DOMAIN: a personal domain can't be added", await refused(() => as("authenticated", ADMIN, () => q(`insert into school_email_domains (school_account_id, domain, added_by) values ('${SA}', 'gmail.com', '${ADMIN}') returning id`))));
check("R-JOIN-DOMAIN: the School-Admin removes one", (await as("authenticated", ADMIN, () => q(`delete from school_email_domains where school_account_id = '${SA}' and domain = 'lpstaff.org.uk' returning id`))).rows.length === 1);

console.log("\n-- joining");
const join = (uid, email, urn) => as("authenticated", uid, () => q(`select * from join_school('${urn}', 'teacher')`), email);
const row = async (uid, acc) => (await q(`select id, status, off_domain from school_memberships where profile_id = '${uid}' and school_account_id = '${acc}'`)).rows[0];
const j1 = (await join(NEWBIE, "new.teacher@leightonpark.com", "110110")).rows[0];
check("R-JOIN-DOMAIN: an on-domain request is ordinary (pending approval, not an exception)", j1.membership_status === "pending_approval" && (await row(NEWBIE, SA)).off_domain === false);
await join(SUB, "staff@mail.leightonpark.com", "110110");
check("R-JOIN-DOMAIN: a subdomain of a listed domain is on-domain", (await row(SUB, SA)).off_domain === false);
await join(OUTSIDER, "governor@gmail.com", "110110");
check("R-JOIN-DOMAIN: an off-domain request is held as an exception", (await row(OUTSIDER, SA)).off_domain === true && (await row(OUTSIDER, SA)).status === "pending_approval");
await join(STRANGER, "someone@example.org", "100001");
check("R-JOIN-DOMAIN: a school with no list holds every request as an exception", (await row(STRANGER, SC)).off_domain === true);

console.log("\n-- approving");
const approve = (uid, mid, extra = "") => as("authenticated", uid, () => q(`update school_memberships set status = 'approved', approved_at = now(), approved_by = '${id(301)}'${extra} where id = '${mid}' returning id`));
check("R-JOIN-DOMAIN: an on-domain request is approved as before", (await approve(ADMIN, (await row(NEWBIE, SA)).id)).rows.length === 1);
const outsiderId = (await row(OUTSIDER, SA)).id;
const plain = await errorOf(() => approve(ADMIN, outsiderId));
check("R-JOIN-DOMAIN: a plain approve of an exception is refused, saying why", /approve it as an exception/.test(plain ?? ""), plain ?? "");
check("R-JOIN-DOMAIN: nobody signed in can clear the exception mark", /set by join_school/.test((await errorOf(() => as("authenticated", ADMIN, () => q(`update school_memberships set off_domain = false where id = '${outsiderId}'`)))) ?? ""));
check("R-JOIN-DOMAIN: approved explicitly as an exception, it is", (await approve(ADMIN, outsiderId, `, exception_approved_at = now(), exception_approved_by = '${id(301)}'`)).rows.length === 1 && (await row(OUTSIDER, SA)).status === "approved");
const subId = (await row(SUB, SA)).id;
check("R-JOIN-DOMAIN: a teacher can't approve anyone", await refused(() => approve(TEACHER, subId)));

console.log("\n-- a first member verified on the website seeds the list");
const NEWSCHOOL_HEAD = id(12);
await q(`insert into profiles (id, email) values ('${NEWSCHOOL_HEAD}', 'head@newschool.sch.uk')`);
const first = (await join(NEWSCHOOL_HEAD, "head@newschool.sch.uk", "100002")).rows[0];
const acc2 = (await q(`select id from school_accounts where school_urn = '100002'`)).rows[0].id;
check("R-JOIN-DOMAIN: first member approved on the website match, and the list is their domain", first.membership_status === "approved" && JSON.stringify(await domains(acc2)) === '["newschool.sch.uk"]');

console.log("\n-- devices and sign-ins: who reads them");
const tokenHash = (n) => String(n).repeat(64).slice(0, 64);
await ex(`
insert into account_devices (id, profile_id, token_hash, label, place, session_id, signed_in_at) values
  ('${id(501)}', '${TEACHER}', '${tokenHash(1)}', 'Chrome on Mac', 'Reading, GB', '${id(901)}', now()),
  ('${id(502)}', '${ADMIN}', '${tokenHash(2)}', 'Safari on iPhone', 'Reading, GB', '${id(902)}', now()),
  ('${id(503)}', '${OTHER_ADMIN}', '${tokenHash(3)}', 'Edge on Windows', 'Leeds, GB', '${id(903)}', now()),
  ('${id(504)}', '${PENDING}', '${tokenHash(4)}', 'Firefox on Linux', null, '${id(904)}', now());
insert into account_sign_ins (profile_id, device_id, place) values ('${TEACHER}', '${id(501)}', 'Reading, GB'), ('${OTHER_ADMIN}', '${id(503)}', 'Leeds, GB');
insert into auth.sessions values ('${id(901)}', '${TEACHER}'), ('${id(902)}', '${ADMIN}');
`);
const devs = async (uid) => (await as("authenticated", uid, () => q(`select id from account_devices order by id`))).rows.map((r) => r.id);
check("R-SIGNINS-RLS: a person sees their own devices", JSON.stringify(await devs(TEACHER)) === JSON.stringify([id(501)]));
check("R-SIGNINS-RLS: the School-Admin sees their school's staff (their own, the teacher's), not a pending requester's", JSON.stringify(await devs(ADMIN)) === JSON.stringify([id(501), id(502)]), JSON.stringify(await devs(ADMIN)));
check("R-SIGNINS-RLS: the account holder too", JSON.stringify(await devs(HOLDER)) === JSON.stringify([id(501), id(502)]));
check("R-SIGNINS-RLS: another school's admin sees only their own", JSON.stringify(await devs(OTHER_ADMIN)) === JSON.stringify([id(503)]));
check("R-SIGNINS-RLS: a stranger sees nothing", (await devs(STRANGER)).length === 0);
check("R-SIGNINS-RLS: a platform admin's own session sees nothing of others (the platform pages use the service role)", (await devs(PLAT)).length === 0);
check("R-SIGNINS-RLS: sign-ins follow the same rule", (await as("authenticated", ADMIN, () => q(`select profile_id from account_sign_ins`))).rows.length === 1 && (await as("authenticated", OTHER_ADMIN, () => q(`select profile_id from account_sign_ins`))).rows.length === 1);
check("R-SIGNINS-RLS: never the token hash or the session id, even to the owner", await refused(() => as("authenticated", TEACHER, () => q(`select token_hash from account_devices`))) && await refused(() => as("authenticated", TEACHER, () => q(`select session_id from account_devices`))));
let anonOk = false;
try { await as("anon", null, () => q(`select id from account_devices`)); } catch (e) { anonOk = /permission denied/.test(e.message); }
check("R-SIGNINS-RLS: anon reads nothing", anonOk);
check("R-SIGNINS-RLS: nobody signed in writes a device (not even their own)", await refused(() => as("authenticated", TEACHER, () => q(`update account_devices set signed_out_at = now() where id = '${id(501)}' returning id`))) && await refused(() => as("authenticated", TEACHER, () => q(`insert into account_devices (profile_id, token_hash) values ('${TEACHER}', '${tokenHash(7)}') returning id`))));
check("R-SIGNINS-RLS: codes are the service role's only", await refused(() => as("authenticated", TEACHER, () => q(`select id from device_codes`))));
check("R-SIGNINS-RLS: revoke_auth_session is the service role's only", await refused(() => as("authenticated", ADMIN, () => q(`select revoke_auth_session('${id(901)}')`))));
await as("service_role", null, () => q(`select revoke_auth_session('${id(901)}')`));
check("R-SIGNINS-RLS: and it ends the session", (await q(`select count(*)::int n from auth.sessions where id = '${id(901)}'`)).rows[0].n === 0 && (await q(`select count(*)::int n from auth.sessions`)).rows[0].n === 1);
check("R-DEVICE-CODES: a code is stored only as a hash (a 64-hex value), never the code", !!(await errorOf(() => q(`insert into device_codes (device_id, profile_id, code_hash, expires_at) values ('${id(501)}', '${TEACHER}', '123456', now())`))));

console.log("\n-- the rollback, then apply again");
await ex(readFileSync(repo + "ops/front_door_r3/rollback_front_door_r3.sql", "utf8"));
const left = (await q(`select to_regclass('public.account_devices') a, to_regclass('public.device_codes') b, to_regclass('public.account_sign_ins') c, to_regclass('public.school_email_domains') d`)).rows[0];
const cols = (await q(`select count(*)::int n from information_schema.columns where table_name = 'school_memberships' and column_name in ('off_domain', 'exception_approved_at', 'exception_approved_by')`)).rows[0].n;
check("the rollback removes the tables, the columns and the functions", !left.a && !left.b && !left.c && !left.d && cols === 0 && (await q(`select count(*)::int n from pg_proc where proname in ('revoke_auth_session', 'is_school_admin_of_profile', 'email_on_school_domain', 'seed_school_email_domain')`)).rows[0].n === 0);
await q(`insert into profiles (id, email) values ('${id(13)}', 'x@leightonpark.com')`);
const jAfter = (await join(id(13), "x@leightonpark.com", "110110").catch((e) => ({ rows: [{ err: e.message }] }))).rows[0];
check("after the rollback, join_school is the previous one again", !!jAfter && !jAfter.err, JSON.stringify(jAfter));
await ex(readFileSync(repo + "ops/front_door_r3/apply_front_door_r3.sql", "utf8"));
check("the ops apply runs on the rolled-back schema and records its version", !!(await q(`select to_regclass('public.account_devices') a`)).rows[0].a && (await q(`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261126090000'`)).rows[0].n === 1);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
