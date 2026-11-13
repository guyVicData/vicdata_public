// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_front_door_r2_membership_pglite.mjs
// VicData 0.8 front door, part 2 (F28-F29; R-MEMBERSHIP's tables): the migration
// 20261124090000_v08_front_door_r2_membership.sql and the pilot seed (supabase/seeds/membership_pilots.sql)
// over a stub of the live schema they depend on -- auth.uid() from the request.jwt.claim.sub GUC; profiles,
// platform_admins and is_platform_admin (0.6 S1); schools, school_accounts and school_memberships with
// is_admin_of_school_account / is_account_holder_of_school_account / is_school_admin_or_holder (as
// 20260807092000 and 0.7 r1 define them); group_accounts, group_memberships and is_group_admin (0.8 groups r1).
// Local only (WASM Postgres); never touches a real database.
// Checks: the plans and their prices; a school's School-Admin and its account holder read its record and its
// invoices, a teacher, a pending admin, another school's admin and anon read nothing; head office's admins
// read the group's own record only; only platform admins write; no card number column exists and a card
// summary is four digits only; the record's rules (one holder, a pilot's end date, covered by a group); the
// seed makes every school account a pilot from its join date on its phase's plan, keeps an existing record
// and leaves preview group accounts out; the migration and the seed run twice.
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
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.profiles (id uuid primary key, email text);
create table public.platform_admins (profile_id uuid primary key references public.profiles (id));
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where profile_id = auth.uid()); $$;
create table public.schools (urn text primary key, current_name text, statutory_high_age int);
create table public.school_accounts (id uuid primary key default gen_random_uuid(), school_urn text not null unique references public.schools (urn), account_holder_membership_id uuid, created_at timestamptz not null default now());
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid not null references public.school_accounts (id) on delete cascade, profile_id uuid not null references public.profiles (id), status text not null, is_admin boolean not null default false, roles text[] not null default '{}');
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_memberships where school_account_id = p and profile_id = auth.uid() and status = 'approved' and is_admin = true); $$;
create function public.is_account_holder_of_school_account(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_accounts a join public.school_memberships m on m.id = a.account_holder_membership_id where a.id = p and m.profile_id = auth.uid() and m.status = 'approved'); $$;
create function public.is_school_admin_or_holder(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_of_school_account(p) or public.is_account_holder_of_school_account(p); $$;
create table public.group_accounts (id uuid primary key default gen_random_uuid(), group_id text not null unique, display_name text not null, status text not null default 'active', preview boolean not null default false, created_at timestamptz not null default now());
create table public.group_memberships (group_account_id uuid not null references public.group_accounts (id), profile_id uuid not null references public.profiles (id), role text not null, primary key (group_account_id, profile_id));
create function public.is_group_admin(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_memberships m join public.group_accounts a on a.id = m.group_account_id where m.group_account_id = p and m.profile_id = auth.uid() and m.role = 'head_office_admin' and a.status = 'active'); $$;
grant execute on all functions in schema public to authenticated;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
const M = "migrations/20261124090000_v08_front_door_r2_membership.sql";
await ex(readFileSync(repo + M, "utf8"));
await ex(readFileSync(repo + M, "utf8"));
console.log("applied", M, "twice");

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (role, uid, fn) => {
  await ex(`set role ${role}`);
  await ex(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
  try { return await fn(); } finally { await ex("reset role"); await ex(`select set_config('request.jwt.claim.sub', '', false)`); }
};
const refused = async (fn) => { try { const r = await fn(); return r.rows?.length === 0; } catch (e) { return /permission denied|row-level security|violates/i.test(e.message); } };

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [ADMIN, HOLDER, TEACHER, PENDING, OTHER, HO, PLAT] = [1, 2, 3, 4, 5, 6, 7].map(id);
const [SA, SB, SP] = [101, 102, 103].map(id);
const [GA, GP] = [201, 202].map(id);
await ex(`
insert into profiles (id) values ('${ADMIN}'), ('${HOLDER}'), ('${TEACHER}'), ('${PENDING}'), ('${OTHER}'), ('${HO}'), ('${PLAT}');
insert into platform_admins values ('${PLAT}');
insert into schools values ('110110', 'Leighton Park School', 18), ('137625', 'The Chase', 18), ('142990', 'A primary academy', 11);
insert into school_accounts (id, school_urn, created_at) values ('${SA}', '110110', '2026-09-01'), ('${SB}', '137625', '2026-10-15'), ('${SP}', '142990', '2026-11-02');
insert into school_memberships (id, school_account_id, profile_id, status, is_admin, roles) values
  ('${id(301)}', '${SA}', '${ADMIN}', 'approved', true, '{teacher}'),
  ('${id(302)}', '${SA}', '${HOLDER}', 'approved', false, '{smt}'),
  ('${id(303)}', '${SA}', '${TEACHER}', 'approved', false, '{teacher}'),
  ('${id(304)}', '${SA}', '${PENDING}', 'pending_approval', true, '{}'),
  ('${id(305)}', '${SB}', '${OTHER}', 'approved', true, '{}');
update school_accounts set account_holder_membership_id = '${id(302)}' where id = '${SA}';
insert into group_accounts (id, group_id, display_name, created_at, preview) values ('${GA}', '3320', 'Harris Federation', '2026-11-10', false), ('${GP}', 'preview:x', 'Preview', '2026-11-11', true);
insert into group_memberships values ('${GA}', '${HO}', 'head_office_admin');
`);

console.log("\n-- the plans");
const plans = (await as("authenticated", TEACHER, () => q(`select code, price_month_pence m, price_year_pence y, per_school_month_pence s from membership_plans order by code`))).rows;
check("secondary £10 a month, £120 a year; primary £5, £60; group: its own rate unset, £10 a school", JSON.stringify(plans) === JSON.stringify([{ code: "group", m: null, y: null, s: 1000 }, { code: "primary", m: 500, y: 6000, s: null }, { code: "secondary", m: 1000, y: 12000, s: null }]), JSON.stringify(plans));
check("every signed-in member reads the plans", plans.length === 3);
check("only a platform admin changes a price", await refused(() => as("authenticated", ADMIN, () => q(`update membership_plans set price_month_pence = 1 where code = 'secondary' returning code`))));
check("a volume band (bulk discount) is a row, written by a platform admin", (await as("authenticated", PLAT, () => q(`insert into membership_volume_bands values ('group', 20, 900) returning min_schools`))).rows.length === 1);
await q(`delete from membership_volume_bands`);

console.log("\n-- the seed");
const S = readFileSync(repo + "seeds/membership_pilots.sql", "utf8");
await ex(S);
await ex(S);
const seeded = (await q(`select s.school_urn, m.plan_code, m.status, m.joined_on::text j, m.pilot_ends_on::text e from account_memberships m join school_accounts s on s.id = m.school_account_id order by s.school_urn`)).rows;
check("every school account a pilot from its join date, 6 months free, on its phase's plan", JSON.stringify(seeded) === JSON.stringify([{ school_urn: "110110", plan_code: "secondary", status: "pilot", j: "2026-09-01", e: "2027-03-01" }, { school_urn: "137625", plan_code: "secondary", status: "pilot", j: "2026-10-15", e: "2027-04-15" }, { school_urn: "142990", plan_code: "primary", status: "pilot", j: "2026-11-02", e: "2027-05-02" }]), JSON.stringify(seeded));
const groups = (await q(`select group_account_id, plan_code, status from account_memberships where group_account_id is not null`)).rows;
check("pilot groups too, on the group plan; preview accounts left out", groups.length === 1 && groups[0].group_account_id === GA && groups[0].plan_code === "group", JSON.stringify(groups));
await q(`update account_memberships set status = 'active', pilot_ends_on = null, card_brand = 'Visa', card_last4 = '4417', card_exp_month = 8, card_exp_year = 2029 where school_account_id = '${SB}'`);
await ex(S);
check("a second run keeps an existing record", (await q(`select status from account_memberships where school_account_id = '${SB}'`)).rows[0].status === "active");
const mid = (await q(`select id from account_memberships where school_account_id = '${SA}'`)).rows[0].id;
await q(`insert into membership_invoices (membership_id, period_start, period_end, amount_pence, status) values ('${mid}', '2026-09-01', '2027-03-01', 0, 'free')`);

console.log("\n-- who reads a school's record");
const read = (who) => as("authenticated", who, () => q(`select school_account_id from account_memberships where school_account_id = '${SA}'`));
check("its School-Admin", (await read(ADMIN)).rows.length === 1);
check("its account holder", (await read(HOLDER)).rows.length === 1);
check("and both read its invoices", (await as("authenticated", ADMIN, () => q(`select id from membership_invoices`))).rows.length === 1 && (await as("authenticated", HOLDER, () => q(`select id from membership_invoices`))).rows.length === 1);
check("not a teacher", (await read(TEACHER)).rows.length === 0 && (await as("authenticated", TEACHER, () => q(`select id from membership_invoices`))).rows.length === 0);
check("not a pending admin", (await read(PENDING)).rows.length === 0);
check("not another school's admin (who reads their own)", (await read(OTHER)).rows.length === 0 && (await as("authenticated", OTHER, () => q(`select school_account_id from account_memberships`))).rows.length === 1);
check("not head office", (await read(HO)).rows.length === 0);
check("head office's admin reads the group's own record", (await as("authenticated", HO, () => q(`select group_account_id from account_memberships where group_account_id = '${GA}'`))).rows.length === 1);
check("a platform admin reads every record", (await as("authenticated", PLAT, () => q(`select id from account_memberships`))).rows.length === 4);
let anonOk = false;
try { await as("anon", null, () => q(`select * from account_memberships`)); } catch (e) { anonOk = /permission denied/.test(e.message); }
check("anon reads nothing", anonOk);

console.log("\n-- who writes");
check("a School-Admin can't change their record (no payments: platform admins set it)", await refused(() => as("authenticated", ADMIN, () => q(`update account_memberships set status = 'active' where school_account_id = '${SA}' returning id`))));
check("…nor add an invoice", await refused(() => as("authenticated", ADMIN, () => q(`insert into membership_invoices (membership_id, period_start, period_end, amount_pence, status) values ('${mid}', '2027-03-01', '2028-03-01', 12000, 'due') returning id`))));
check("a platform admin sets the real dates", (await as("authenticated", PLAT, () => q(`update account_memberships set pilot_ends_on = '2027-06-30', renews_on = '2027-07-01' where school_account_id = '${SA}' returning id`))).rows.length === 1);

console.log("\n-- the card: never its number");
const cols = (await q(`select column_name from information_schema.columns where table_name in ('account_memberships', 'membership_invoices')`)).rows.map((r) => r.column_name);
check("no card number column (only brand, last four, expiry)", !cols.some((c) => /card_?number|^pan$|cvc|cvv|card_no/i.test(c)) && cols.includes("card_last4"), cols.filter((c) => c.startsWith("card")).join(","));
const bad = async (sql) => { try { await q(sql); return false; } catch (e) { return /violates/.test(e.message); } };
check("a card summary is four digits, never a number", await bad(`update account_memberships set card_brand = 'Visa', card_last4 = '4111111111111111' where school_account_id = '${SA}'`));
check("a brand without its four digits is refused", await bad(`update account_memberships set card_brand = 'Visa', card_last4 = null where school_account_id = '${SA}'`));

console.log("\n-- the record's rules");
check("one holder: a school or a group, not both", await bad(`insert into account_memberships (school_account_id, group_account_id, plan_code, status, joined_on, pilot_ends_on) values ('${SP}', '${GA}', 'primary', 'pilot', now(), now())`));
check("a pilot has its end date", await bad(`update account_memberships set pilot_ends_on = null where school_account_id = '${SA}'`));
check("covered by a group names the group", await bad(`update account_memberships set status = 'covered_by_group' where school_account_id = '${SA}'`));
check("…and covered works when it does", (await q(`update account_memberships set status = 'covered_by_group', covered_by_group_account_id = '${GA}' where school_account_id = '${SA}' returning id`)).rows.length === 1);
check("a lapsed record is a status", (await q(`update account_memberships set status = 'lapsed', covered_by_group_account_id = null where school_account_id = '${SA}' returning id`)).rows.length === 1);
check("RLS on all four tables", (await q(`select bool_and(relrowsecurity) ok from pg_class where relname in ('membership_plans', 'membership_volume_bands', 'account_memberships', 'membership_invoices')`)).rows[0].ok === true);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
