// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_group_sets_pglite.mjs
// VicData 0.8 group sets, M2 (storage): 20261123090000_v08_group_sets.sql over sets round 1 and groups
// round 1, in PGlite (WASM Postgres), on the same stub of the live schema as v08_groups_r1_pglite.mjs.
// Proves R-GROUP-SETS-RLS: who reads and writes a head office's sets, personal sets for a group, the cap
// of 8 groups, Share with the group (moves), Duplicate (a personal copy), the group's one default, and
// that school sets and their save path are unchanged. Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);

await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create table public.profiles (id uuid primary key, email text, full_name text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.schools (urn text primary key, current_name text, establishment_type_group text, establishment_type text, website text);
create table public.school_accounts (id uuid primary key default gen_random_uuid(), school_urn text unique, account_holder_membership_id uuid, pending_account_holder_membership_id uuid, tier text default 'individual', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid references public.school_accounts(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, status text default 'pending_verification', is_admin bool not null default false, role text default 'teacher' check (role in ('teacher','hod','smt','finance','admissions')), individual_tier_active bool, requested_at timestamptz, approved_at timestamptz, approved_by uuid, unique (school_account_id, profile_id));
create table public.vc_comparator_sets (id uuid primary key default gen_random_uuid(), name text);
create table public.vc_set_school_visibility (school_account_id uuid, vc_set_id uuid, primary key (school_account_id, vc_set_id));
create function public.is_member_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved') $$;
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved' and is_admin) $$;
create function public.is_account_holder_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_accounts sa join school_memberships sm on sm.id = sa.account_holder_membership_id where sa.id = p and sm.profile_id = auth.uid()) $$;
alter table public.school_memberships enable row level security;
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
alter table public.school_accounts enable row level security;
create policy school_accounts_select_member on public.school_accounts for select using (is_member_of_school_account(id));
grant usage on schema public, auth to authenticated, anon, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on sequences to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
grant all on all tables in schema public to authenticated, anon, service_role;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
process.on("unhandledRejection", (e) => { console.log("ERROR", e?.message ?? e); process.exit(1); });
const MIGRATIONS = ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104090000_v06_membership_insert_hardening.sql", "20260807093000_saved_sets.sql",
  "20260925232857_personal_comparator_cap_8.sql", "20261106090000_v07_admissions_r1.sql", "20261108090000_v07_admissions_r2b_school_admin_override.sql",
  "20261110090000_v08_groups_r1_accounts.sql", "20261121090000_v08_sets_r1.sql"];
for (const f of MIGRATIONS) { await ex(readFileSync(repo + f, "utf8")); console.log("applied", f); }
const M2 = readFileSync(repo + "20261123090000_v08_group_sets.sql", "utf8");
await ex(M2);
await ex(M2);
console.log("applied 20261123090000_v08_group_sets.sql (twice)");
await ex(`grant all on all tables in schema public to authenticated, anon, service_role;`);
// The app's grants as live: anon reads no set tables.
await ex(`revoke all on public.sets, public.set_members, public.set_group_members from anon;`);

// People. HA: Harris head-office admin; HO: Harris head office (member); DA: Dukes head-office admin;
// PA: a platform admin; SS: SMT at a Harris school (no head-office seat); LL: Admissions lead at
// Leighton Park; NB: signed in, nothing.
const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
const P = { HA: id(1), HO: id(2), DA: id(3), PA: id(4), SS: id(5), LL: id(6), NB: id(7) };
await ex(`insert into profiles (id, email, full_name) values ${Object.entries(P).map(([k, v]) => `('${v}','${k.toLowerCase()}@example.org','${k}')`).join(",")};
insert into auth.users (id, email, email_confirmed_at) values ${Object.entries(P).map(([k, v]) => `('${v}','${k.toLowerCase()}@example.org', now())`).join(",")};
insert into platform_admins (profile_id) values ('${P.PA}');
insert into schools values ('100001','Harris school X',null,null,null), ('110110','Leighton Park',null,null,null);`);
const SX = "11111111-1111-1111-1111-111111111111", LP = "33333333-3333-3333-3333-333333333333";
await ex(`insert into school_accounts (id, school_urn) values ('${SX}','100001'), ('${LP}','110110');`);
const asService = async (fn) => { await ex(`set role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', false)`); try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claims', '', false)`); } };
await asService(() => q(`insert into school_memberships (school_account_id, profile_id, status, is_admin, roles) values ('${SX}','${P.SS}','approved',false,array['smt'])`));
await asService(() => q(`insert into school_memberships (school_account_id, profile_id, status, is_admin, roles, admissions_lead) values ('${LP}','${P.LL}','approved',false,array['admissions'],true)`));
const GA = (await q(`insert into group_accounts (group_id, display_name) values ('3320','Harris Federation') returning id`)).rows[0].id;
const GD = (await q(`insert into group_accounts (group_id, display_name) values ('club_iss:dukes-education','Dukes Education') returning id`)).rows[0].id;
await q(`insert into group_memberships (group_account_id, profile_id, role) values ('${GA}','${P.HA}','head_office_admin'), ('${GA}','${P.HO}','head_office'), ('${GD}','${P.DA}','head_office_admin')`);

let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, ok ? "" : extra); if (ok) passes++; else fails++; };
const as = async (who, fn) => {
  const sub = P[who];
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const asAnon = async (fn) => { await ex(`set role anon`); try { return await fn(); } finally { await ex(`reset role`); } };
const err = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
const save = (who, set, members, id = null) => as(who, () => q(`select save_set($1, $2, $3) id`, [id, JSON.stringify(set), members === null ? null : JSON.stringify(members)])).then((r) => r.rows[0].id);
const groupSet = (extra = {}) => ({ name: "Big London trusts", kind: "group_peers", owner_scope: "group", group_account_id: GA, creator_kind: "head_office", ...extra });
const mine = (who, extra = {}) => ({ name: "My peers", kind: "group_peers", owner_scope: "personal", owner_profile_id: P[who], group_account_id: GA, creator_kind: "me", ...extra });
const G = (ids) => ids.map((g) => ({ group_id: g }));
const count = async (who, sql) => Number((await as(who, () => q(sql))).rows[0].n);

console.log("\n-- a head office's sets: the admin writes, every member reads");
const S1 = await save("HA", groupSet(), G(["2157", "5143"]));
check("Harris's admin saves a group set of 2 groups", !!S1);
check("its groups are in order", JSON.stringify((await q(`select group_id from set_group_members where set_id = $1 order by position`, [S1])).rows.map((r) => r.group_id)) === '["2157","5143"]');
check("a Harris head-office member reads it", (await count("HO", `select count(*) n from sets where id = '${S1}'`)) === 1);
check("…and its groups", (await count("HO", `select count(*) n from set_group_members where set_id = '${S1}'`)) === 2);
check("a platform admin reads it", (await count("PA", `select count(*) n from sets where id = '${S1}'`)) === 1);
for (const who of ["DA", "SS", "LL", "NB"]) check(`${who} can't read it`, (await count(who, `select count(*) n from sets where id = '${S1}'`)) === 0);
check("anon can't read sets at all", !!(await err(() => asAnon(() => q(`select 1 from sets limit 1`)))));
let e = await err(() => save("HO", groupSet({ name: "Member's try" }), G(["2157"])));
check("a head-office member (not admin) can't create a group set", !!e, e);
e = await err(() => save("HO", { name: "renamed" }, null, S1));
check("…nor change one", !!e, e);
e = await err(() => save("DA", groupSet({ name: "Dukes into Harris" }), G(["2157"])));
check("another group's admin can't write Harris's sets", !!e, e);
e = await err(() => save("HA", { ...groupSet(), creator_kind: "smt" }, G(["2157"])));
check("a group set's creator is head_office, nothing else", !!e, e);
e = await err(() => save("HA", { ...groupSet(), school_account_id: SX }, G(["2157"])));
check("a group set can't belong to a school too", !!e, e);
e = await err(() => save("HA", { ...groupSet(), kind: "compared_against" }, G(["2157"])));
check("a school kind can't belong to a head office", !!e, e);
e = await err(() => save("HA", { ...groupSet(), phase: "ks4" }, G(["2157"])));
check("a group set carries no phase", !!e, e);
check("Harris's admin renames it", !(await err(() => save("HA", { name: "Big London trusts (2)" }, null, S1))));

console.log("\n-- the cap: 8 groups");
const eight = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
check("8 groups save", !(await err(() => save("HA", { name: "Eight" }, G(eight), S1))));
e = await err(() => save("HA", { name: "Nine" }, G([...eight, "a9"]), S1));
check("a ninth is refused (the database's backstop)", !!e && /at most 8/.test(e), e);
check("…and nothing changed", (await q(`select count(*)::int n from set_group_members where set_id = $1`, [S1])).rows[0].n === 8);
e = await err(() => save("HA", { name: "Mixed" }, [{ urn: "100001" }], S1));
check("a set of groups holds no schools", !!e && /groups, not schools/.test(e), e);

console.log("\n-- subsets of our own schools (group_schools)");
const SUB = await save("HA", { name: "Harris secondaries", kind: "group_schools", owner_scope: "group", group_account_id: GA, creator_kind: "head_office" }, [{ urn: "100001" }]);
check("an admin saves a subset of the group's schools", !!SUB);
e = await err(() => as("HA", () => q(`insert into set_group_members (set_id, group_id) values ($1, '2157')`, [SUB])));
check("a subset holds schools, not groups", !!e, e);

console.log("\n-- personal sets for a group (My sets)");
const MY = await save("HO", mine("HO"), G(["2157"]));
check("a head-office member saves a personal set for the group", !!MY);
check("only its owner reads it (not the admin)", (await count("HO", `select count(*) n from sets where id = '${MY}'`)) === 1 && (await count("HA", `select count(*) n from sets where id = '${MY}'`)) === 0);
e = await err(() => save("SS", mine("SS"), G(["2157"])));
check("someone outside the head office can't make one for it", !!e, e);
e = await err(() => save("HO", { ...mine("HO"), group_account_id: GD }, G(["2157"])));
check("nor for another head office", !!e, e);

console.log("\n-- Duplicate (a personal copy) and Share with the group (moves)");
const DUP = await save("HO", { ...mine("HO"), name: "Copy of Big London trusts" }, G(eight.slice(0, 3)));
check("a member duplicates a group set as their own", !!DUP && (await count("HO", `select count(*) n from set_group_members where set_id = '${DUP}'`)) === 3);
e = await err(() => as("HO", () => q(`select share_set_with_group($1)`, [DUP])));
check("a member (not admin) can't share with the group", !!e && /admins/.test(e), e);
const ADM = await save("HA", mine("HA", { name: "Admin's draft" }), G(["2157", "5143"]));
e = await err(() => as("HA", () => q(`select share_set_with_group($1)`, [DUP])));
check("an admin can't share someone else's set", !!e, e);
check("an admin shares their own", !(await err(() => as("HA", () => q(`select share_set_with_group($1)`, [ADM])))));
const moved = (await q(`select owner_scope, owner_profile_id, creator_kind, group_account_id from sets where id = $1`, [ADM])).rows[0];
check("…it moved: now the head office's, nobody's personal set", moved.owner_scope === "group" && moved.owner_profile_id === null && moved.creator_kind === "head_office" && moved.group_account_id === GA, JSON.stringify(moved));
check("…every member reads it now, with its groups", (await count("HO", `select count(*) n from set_group_members where set_id = '${ADM}'`)) === 2);

console.log("\n-- the group's default (Make default)");
check("an admin makes a set the group's default", !(await err(() => save("HA", { is_default: true }, null, S1))));
e = await err(() => save("HA", { is_default: true }, null, ADM));
check("one default per head office and kind", !!e, e);
e = await err(() => save("HO", { is_default: true }, null, MY));
check("a personal set is never the default", !!e, e);
check("deleting the default leaves none (the app falls back to the size band)", !(await err(() => as("HA", () => q(`delete from sets where id = $1`, [S1])))) && (await q(`select count(*)::int n from sets where group_account_id = $1 and is_default`, [GA])).rows[0].n === 0);
check("…and its groups went with it", (await q(`select count(*)::int n from set_group_members where set_id = $1`, [S1])).rows[0].n === 0);

console.log("\n-- school sets are unchanged");
const LS = await save("LL", { name: "Rivals 11+", kind: "compared_against", entry_point: "11+", owner_scope: "school", school_account_id: LP, creator_kind: "admissions" }, [{ urn: "100001" }, { urn: "110110", tier: null }]);
check("the Admissions lead still saves a school set with its schools", !!LS && (await count("LL", `select count(*) n from set_members where set_id = '${LS}'`)) === 2);
check("…a re-save keeps the unchanged rows (only the difference is written)", !(await err(() => save("LL", { name: "Rivals 11+" }, [{ urn: "100001" }], LS))) && (await count("LL", `select count(*) n from set_members where set_id = '${LS}'`)) === 1);
check("head office can't read a school's set", (await count("HA", `select count(*) n from sets where id = '${LS}'`)) === 0);
e = await err(() => save("LL", { name: "x", kind: "compared_against", owner_scope: "school", school_account_id: LP, group_account_id: GA, creator_kind: "admissions" }, []));
check("a school set can't carry a head office", !!e, e);

console.log("\n-- the rollback (supabase/ops/group_sets/rollback_group_sets.sql)");
await ex(`create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);`);
await ex(readFileSync(new URL("../ops/group_sets/rollback_group_sets.sql", import.meta.url), "utf8"));
check("rolled back: no group column, no group members table", (await q(`select count(*)::int n from information_schema.columns where table_name = 'sets' and column_name = 'group_account_id'`)).rows[0].n === 0 && (await q(`select to_regclass('public.set_group_members') t`)).rows[0].t === null);
check("…Leighton Park's school set and its school are still there", (await q(`select count(*)::int n from set_members where set_id = $1`, [LS])).rows[0].n === 1);
check("…and the school save path works as in sets round 1", !(await err(() => save("LL", { name: "Rivals 11+ again" }, [{ urn: "100001" }, { urn: "110110" }], LS))));
await ex(M2);
check("the migration applies again after the rollback", (await q(`select count(*)::int n from information_schema.columns where table_name = 'sets' and column_name = 'group_account_id'`)).rows[0].n === 1);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
