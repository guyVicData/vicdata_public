// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_groups_r1_pglite.mjs
// VicData 0.8 groups r1 (G1, G2): head-office accounts, members, invitations, the group-view grants and
// the Admissions share (20261110090000_v08_groups_r1_accounts.sql). Local only (WASM Postgres), over a
// stub of the live schema it depends on, with 0.6 S1 (platform admins, the audit log) and the 0.6
// membership hardening applied first, as v07_admissions_rls_pglite.mjs does. Never touches a real
// database. The production membership check (current members only) is the app server's: see
// src/lib/groups/access-rules.test.ts.
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
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104090000_v06_membership_insert_hardening.sql", "20261110090000_v08_groups_r1_accounts.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}

// People. HA: Harris head-office admin; HO: Harris head office (reads); HB: Dukes head-office admin;
// PA: a platform admin; SA: School-Admin at Harris school X (100001); SS: SMT at X; ST: teacher at X;
// OA: School-Admin at another school Y (100002); NB: signed in, nothing; IV / IU / IX: invitees.
const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
const P = { HA: id(1), HO: id(2), HB: id(3), PA: id(4), SA: id(5), SS: id(6), ST: id(7), OA: id(8), NB: id(9), IV: id(10), IU: id(11), IX: id(12) };
const email = (k) => `${k.toLowerCase()}@example.org`;
await ex(`insert into profiles (id, email, full_name) values ${Object.entries(P).map(([k, v]) => `('${v}','${email(k)}','${k}')`).join(",")};
insert into auth.users (id, email, email_confirmed_at) values ${Object.entries(P).map(([k, v]) => `('${v}','${email(k)}', ${k === "IU" ? "null" : "now()"})`).join(",")};
insert into platform_admins (profile_id) values ('${P.PA}');
insert into schools values ('100001','Harris school X',null,null,null), ('100002','School Y',null,null,null);`);
const SX = "11111111-1111-1111-1111-111111111111", SY = "22222222-2222-2222-2222-222222222222";
await ex(`insert into school_accounts (id, school_urn) values ('${SX}','100001'), ('${SY}','100002');`);
const asService = async (fn) => { await ex(`set role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', false)`); try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claims', '', false)`); } };
const smem = async (who, school, roles, admin = false) => (await asService(() => q(`insert into school_memberships (school_account_id, profile_id, status, is_admin, roles) values ('${school}','${P[who]}','approved',${admin}, array[${roles.map((r) => `'${r}'`).join(",")}]::text[]) returning id`))).rows[0].id;
await smem("SA", SX, ["teacher"], true);
await smem("SS", SX, ["smt"]);
await smem("ST", SX, ["teacher"]);
await smem("OA", SY, ["teacher"], true);

let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (ok) passes++; else fails++; };
const as = async (who, fn) => {
  const sub = P[who];
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const asAnon = async (fn) => { await ex(`set role anon`); try { return await fn(); } finally { await ex(`reset role`); } };
const err = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
const denied = (m) => !!m && /permission denied/.test(m);
const rows = async (who, sql) => (await as(who, () => q(sql))).rows;
const audits = async () => (await q(`select action from platform_audit_log order by id`)).rows.map((r) => r.action);

console.log("\n-- platform admins create accounts and invite the first admin");
let e = await err(() => as("HA", () => q(`select platform_create_group_account('3320', 'Harris Federation')`)));
check("a signed-in non-admin can't create a group account", !!e && /platform admin only/.test(e), e);
check("anon can't create one (permission denied)", denied(await err(() => asAnon(() => q(`select platform_create_group_account('3320', 'x')`)))));
const GA = (await as("PA", () => q(`select platform_create_group_account('3320', 'Harris Federation') id`))).rows[0].id;
const GB = (await as("PA", () => q(`select platform_create_group_account('club_iss:dukes-education', 'Dukes Education') id`))).rows[0].id;
check("a platform admin creates Harris and Dukes", !!GA && !!GB);
e = await err(() => as("PA", () => q(`select platform_create_group_account('3320', 'Harris again')`)));
check("one account per group", !!e && /already has an account/.test(e), e);
check("creating is audited", (await audits()).filter((a) => a === "group_account_created").length === 2);
// An invitation's one-time token comes back to the inviter only; acceptance needs it AND the address.
const invite = async (by, acc, who, role) => (await as(by, () => q(`select group_invite_member('${acc}', '${who}', '${role}') t`))).rows[0].t;
const accept = (who, token) => as(who, () => q(`select group_accept_invitation('${token}') a`));
const tHA = await invite("PA", GA, "HA@Example.org ", "head_office_admin");
const tHB = await invite("PA", GB, email("HB"), "head_office_admin");
check("the invitation stores the address lower-cased and trimmed", (await q(`select email from group_invitations where group_account_id='${GA}'`)).rows[0].email === email("HA"));
check("the token is returned once and stored only as a hash", /^[0-9a-f]{64}$/.test(tHA) && (await q(`select count(*)::int n from group_invitations where token_hash = '${tHA}'`)).rows[0].n === 0);
check("inviting is audited for a platform admin", (await audits()).includes("group_member_invited"));

console.log("\n-- accepting an invitation (its link AND the invited address; an explicit act)");
e = await err(() => accept("NB", tHA));
check("TAKEOVER: someone else (confirmed email, the link in hand) can't accept HA's invitation", !!e && /isn't valid/.test(e) && (await q(`select count(*)::int n from group_memberships where profile_id='${P.NB}'`)).rows[0].n === 0, e);
e = await err(() => accept("HA", "0".repeat(64)));
check("the right address with a wrong token is refused", !!e && /isn't valid/.test(e), e);
e = await err(() => accept("HA", tHB));
check("the right person with another group's link is refused", !!e && /isn't valid/.test(e), e);
check("nothing is taken up without the act: HA isn't a member yet", (await q(`select count(*)::int n from group_memberships where profile_id='${P.HA}'`)).rows[0].n === 0);
check("HA accepts with the link: Harris head-office admin", (await accept("HA", tHA)).rows[0].a === GA && (await q(`select role from group_memberships where profile_id='${P.HA}' and group_account_id='${GA}'`)).rows[0]?.role === "head_office_admin");
check("  the platform admin who invited is the approver", (await q(`select approved_by from group_memberships where profile_id='${P.HA}'`)).rows[0].approved_by === P.PA);
await accept("HB", tHB);
e = await err(() => accept("HA", tHA));
check("a used link can't be used again", !!e, e);

console.log("\n-- the head-office admin invites and manages members");
const tHO = await invite("HA", GA, email("HO"), "head_office");
await accept("HO", tHO);
check("HA invites HO (reads) to Harris; HO accepts", (await q(`select role from group_memberships where profile_id='${P.HO}' and group_account_id='${GA}'`)).rows[0]?.role === "head_office");
e = await err(() => as("HO", () => q(`select group_invite_member('${GA}', '${email("IV")}', 'head_office')`)));
check("plain head office can't invite", !!e && /head-office admin/.test(e), e);
e = await err(() => as("HB", () => q(`select group_invite_member('${GA}', '${email("IV")}', 'head_office_admin')`)));
check("another group's admin can't invite to Harris", !!e && /head-office admin/.test(e), e);
e = await err(() => as("SA", () => q(`select group_invite_member('${GA}', '${email("SA")}', 'head_office_admin')`)));
check("a member school's School-Admin can't make themselves head office", !!e, e);
e = await err(() => as("HA", () => q(`select group_invite_member('${GA}', '${email("HO")}', 'head_office')`)));
check("an existing member isn't invited again", !!e && /already/.test(e), e);
const tIU = await invite("HA", GA, email("IU"), "head_office");
e = await err(() => accept("IU", tIU));
check("an unconfirmed address can't accept, even with the link", !!e && (await q(`select count(*)::int n from group_memberships where profile_id='${P.IU}'`)).rows[0].n === 0, e);
const tIX1 = await invite("HA", GA, email("IX"), "head_office");
const tIX = await invite("HA", GA, email("IX"), "head_office");
e = await err(() => accept("IX", tIX1));
check("inviting again replaces the link: the first stops working", !!e, e);
const inv = (await q(`select id from group_invitations where email='${email("IX")}'`)).rows[0].id;
e = await err(() => as("HB", () => q(`select group_cancel_invitation('${inv}')`)));
check("another group's admin can't cancel Harris's invitation", !!e, e);
await as("HA", () => q(`select group_cancel_invitation('${inv}')`));
e = await err(() => accept("IX", tIX));
check("a cancelled invitation can't be accepted", !!e, e);
const HOm = (await q(`select id from group_memberships where profile_id='${P.HO}'`)).rows[0].id;
const HAm = (await q(`select id from group_memberships where profile_id='${P.HA}'`)).rows[0].id;
e = await err(() => as("HO", () => q(`select group_set_member_role('${HOm}', 'head_office_admin')`)));
check("plain head office can't promote itself", !!e, e);
e = await err(() => as("HB", () => q(`select group_remove_member('${HOm}')`)));
check("another group's admin can't remove a Harris member", !!e, e);
e = await err(() => as("HA", () => q(`select group_set_member_role('${HAm}', 'head_office')`)));
check("an admin can't change their own role (no lockout)", !!e && /another admin/.test(e), e);
e = await err(() => as("HA", () => q(`select group_remove_member('${HAm}')`)));
check("an admin can't remove themselves", !!e, e);
check("HA promotes and demotes HO", (await err(() => as("HA", () => q(`select group_set_member_role('${HOm}', 'head_office_admin')`)))) === null && (await q(`select role from group_memberships where id='${HOm}'`)).rows[0].role === "head_office_admin" && (await err(() => as("HA", () => q(`select group_set_member_role('${HOm}', 'head_office')`)))) === null && (await q(`select role from group_memberships where id='${HOm}'`)).rows[0].role === "head_office");

console.log("\n-- reads: own group only");
check("HA reads Harris's account, not Dukes'", JSON.stringify((await rows("HA", `select group_id from group_accounts`)).map((r) => r.group_id)) === '["3320"]');
check("HO reads Harris's account", (await rows("HO", `select group_id from group_accounts`)).map((r) => r.group_id).join() === "3320");
check("HB reads Dukes', not Harris'", (await rows("HB", `select group_id from group_accounts`)).map((r) => r.group_id).join() === "club_iss:dukes-education");
check("HB reads no Harris member", (await rows("HB", `select * from group_memberships where group_account_id='${GA}'`)).length === 0);
check("HA reads Harris's members (2)", (await rows("HA", `select * from group_memberships where group_account_id='${GA}'`)).length === 2);
check("a member school's SMT reads no account", (await rows("SS", `select * from group_accounts`)).length === 0);
check("a member school's School-Admin reads no account or member", (await rows("SA", `select * from group_accounts`)).length === 0 && (await rows("SA", `select * from group_memberships`)).length === 0);
check("NB reads nothing", (await rows("NB", `select * from group_accounts`)).length === 0 && (await rows("NB", `select * from group_memberships`)).length === 0);
check("invitations (email addresses): HA sees Harris's", (await rows("HA", `select * from group_invitations`)).length >= 3 && (await rows("HA", `select * from group_invitations where group_account_id='${GB}'`)).length === 0);
check("  plain head office sees none", (await rows("HO", `select * from group_invitations`)).length === 0);
check("  another group's admin sees none of Harris's", (await rows("HB", `select * from group_invitations where group_account_id='${GA}'`)).length === 0);
check("the platform admin reads both accounts", (await rows("PA", `select * from group_accounts`)).length === 2);
for (const t of ["group_accounts", "group_memberships", "group_invitations", "group_view_grants", "group_admissions_shares"])
  check(`anon can't read ${t}`, denied(await err(() => asAnon(() => q(`select * from ${t}`)))));

console.log("\n-- writes: never directly");
check("HA can't insert a grant row", denied(await err(() => as("HA", () => q(`insert into group_view_grants (group_account_id, school_urn) values ('${GA}','100001')`)))));
check("HA can't unsuspend or rename the account directly", denied(await err(() => as("HA", () => q(`update group_accounts set display_name='x' where id='${GA}'`)))));
check("HO can't make itself admin directly", denied(await err(() => as("HO", () => q(`update group_memberships set role='head_office_admin' where id='${HOm}'`)))));
check("HB can't add itself to Harris directly", denied(await err(() => as("HB", () => q(`insert into group_memberships (group_account_id, profile_id, role) values ('${GA}','${P.HB}','head_office_admin')`)))));
check("NB can't write an invitation directly", denied(await err(() => as("NB", () => q(`insert into group_invitations (group_account_id, email, role) values ('${GA}','nb@example.org','head_office_admin')`)))));
check("SA can't write a share directly", denied(await err(() => as("SA", () => q(`insert into group_admissions_shares (school_account_id, group_account_id, shared) values ('${SX}','${GA}', true)`)))));

console.log("\n-- grants: the service role only, for the account's admin");
check("HA can't call the grant writer (permission denied)", denied(await err(() => as("HA", () => q(`select group_set_view_grant('${P.HA}','${GA}','100001',true)`)))));
check("the platform admin can't either", denied(await err(() => as("PA", () => q(`select group_set_view_grant('${P.HA}','${GA}','100001',true)`)))));
check("anon can't either", denied(await err(() => asAnon(() => q(`select group_set_view_grant('${P.HA}','${GA}','100001',true)`)))));
const grant = (actor, acc, urn, on, likely = false) => asService(() => q(`select group_set_view_grant('${P[actor]}','${acc}','${urn}',${on},${likely}) r`));
check("the server grants Harris's view to school X for HA", (await grant("HA", GA, "100001", true)).rows[0].r === "granted");
check("  again: unchanged, one open grant", (await grant("HA", GA, "100001", true)).rows[0].r === "unchanged" && (await q(`select count(*)::int n from group_view_grants where revoked_at is null`)).rows[0].n === 1);
e = await err(() => grant("HO", GA, "100002", true));
check("not for plain head office", !!e && /head-office admin/.test(e), e);
e = await err(() => grant("HB", GA, "100002", true));
check("not for another group's admin", !!e && /head-office admin/.test(e), e);
e = await err(() => grant("SA", GA, "100002", true));
check("not for a school's School-Admin", !!e, e);
check("a likely member's grant is labelled", (await grant("HA", GA, "100002", true, true)).rows[0].r === "granted" && (await q(`select likely_member from group_view_grants where school_urn='100002' and revoked_at is null`)).rows[0].likely_member === true);
check("HA reads Harris's grants (2)", (await rows("HA", `select * from group_view_grants`)).length === 2);
check("HO reads them too", (await rows("HO", `select * from group_view_grants`)).length === 2);
check("HB reads none of them", (await rows("HB", `select * from group_view_grants`)).length === 0);
check("school X's SMT and School-Admin read no grant row (the server answers them)", (await rows("SS", `select * from group_view_grants`)).length === 0 && (await rows("SA", `select * from group_view_grants`)).length === 0);
check("a teacher reads none", (await rows("ST", `select * from group_view_grants`)).length === 0);
check("revoking keeps the row", (await grant("HA", GA, "100002", false)).rows[0].r === "revoked" && (await q(`select count(*)::int n from group_view_grants where school_urn='100002' and revoked_at is not null and revoked_by='${P.HA}'`)).rows[0].n === 1);
check("granting again opens a new row (history: 2 rows)", (await grant("HA", GA, "100002", true)).rows[0].r === "granted" && (await q(`select count(*)::int n from group_view_grants where school_urn='100002'`)).rows[0].n === 2);
e = await err(() => asService(() => q(`delete from group_view_grants where school_urn='100002'`)));
check("history: even the service role can't delete a grant", !!e && /never delete|permission denied/.test(e), e);
e = await err(() => asService(() => q(`update group_view_grants set revoked_at = null where revoked_at is not null`)));
check("history: a revoke can't be undone", !!e && /only be revoked/.test(e), e);
e = await err(() => asService(() => q(`update group_view_grants set school_urn = '100009' where revoked_at is null and school_urn='100001'`)));
check("history: a grant can't be moved to another school", !!e && /only be revoked/.test(e), e);

console.log("\n-- suspended accounts: head office is locked out");
e = await err(() => as("HA", () => q(`select platform_set_group_account_status('${GA}', 'suspended')`)));
check("head office can't suspend (or unsuspend) its own account", !!e && /platform admin only/.test(e), e);
const tIV = await invite("PA", GA, email("IV"), "head_office");
await as("PA", () => q(`select platform_set_group_account_status('${GA}', 'suspended')`));
check("a platform admin suspends Harris (audited)", (await q(`select status from group_accounts where id='${GA}'`)).rows[0].status === "suspended" && (await audits()).includes("group_account_suspended"));
e = await err(() => grant("HA", GA, "100003", true));
check("no grant on a suspended account", !!e && /suspended/.test(e), e);
e = await err(() => as("HA", () => q(`select group_invite_member('${GA}', '${email("IT")}', 'head_office')`)));
check("no invitation on a suspended account", !!e, e);
check("suspended: head office reads no account, grant or other member", (await rows("HA", `select * from group_accounts`)).length === 0 && (await rows("HA", `select * from group_view_grants`)).length === 0 && (await rows("HA", `select * from group_memberships`)).length === 1 && (await rows("HA", `select * from group_invitations`)).length === 0);
e = await err(() => as("HA", () => q(`select group_set_member_role('${HOm}', 'head_office_admin')`)));
check("suspended: the admin can't change members", !!e, e);
e = await err(() => accept("IV", tIV));
check("suspended: an invitation can't be accepted", !!e, e);
check("the platform admin still reads it", (await rows("PA", `select * from group_view_grants where group_account_id='${GA}'`)).length === 3);
await as("PA", () => q(`select platform_set_group_account_status('${GA}', 'active')`));
check("reactivated: head office reads again", (await rows("HA", `select * from group_accounts`)).length === 1);

console.log("\n-- the Admissions share: the school's School-Admin decides; default off");
check("no row means not shared", (await q(`select count(*)::int n from group_admissions_shares`)).rows[0].n === 0);
e = await err(() => as("SS", () => q(`select school_set_group_admissions_share('100001','${GA}', true)`)));
check("SMT can't share", !!e && /School-Admin/.test(e), e);
e = await err(() => as("ST", () => q(`select school_set_group_admissions_share('100001','${GA}', true)`)));
check("a teacher can't share", !!e, e);
e = await err(() => as("OA", () => q(`select school_set_group_admissions_share('100001','${GA}', true)`)));
check("another school's School-Admin can't share X's", !!e, e);
e = await err(() => as("HA", () => q(`select school_set_group_admissions_share('100001','${GA}', true)`)));
check("head office can't share it for the school", !!e, e);
check("X's School-Admin shares with Harris", (await err(() => as("SA", () => q(`select school_set_group_admissions_share('100001','${GA}', true)`)))) === null);
check("  Harris head office reads it", (await rows("HO", `select shared from group_admissions_shares`)).map((r) => r.shared).join() === "true");
check("  Dukes head office doesn't", (await rows("HB", `select * from group_admissions_shares`)).length === 0);
check("  X's teacher reads the setting; Y's School-Admin doesn't", (await rows("ST", `select * from group_admissions_shares`)).length === 1 && (await rows("OA", `select * from group_admissions_shares`)).length === 0);
check("  and turns it off again", (await err(() => as("SA", () => q(`select school_set_group_admissions_share('100001','${GA}', false)`)))) === null && (await q(`select shared from group_admissions_shares`)).rows[0].shared === false);

console.log("\n-- preview accounts (the testing route) never take a real group's place");
e = await err(() => asService(() => q(`insert into group_accounts (group_id, display_name, preview, preview_of) values ('club_iss:dukes-education', 'Dukes (preview)', true, 'club_iss:dukes-education')`)));
check("a preview account can't hold a real group id", !!e, e);
e = await err(() => asService(() => q(`insert into group_accounts (group_id, display_name) values ('preview:9999', 'Fake')`)));
check("only a preview account has a preview: id", !!e, e);
const GP = (await asService(() => q(`insert into group_accounts (group_id, display_name, preview, preview_of) values ('preview:3320', 'Harris (preview)', true, '3320') returning id`))).rows[0].id;
check("the preview account sits beside the real Harris account", !!GP && (await q(`select count(*)::int n from group_accounts where preview_of = '3320' or group_id = '3320'`)).rows[0].n === 2);
e = await err(() => as("PA", () => q(`select platform_create_group_account('preview:4000', 'Fake')`)));
check("a platform admin can't make a preview account", !!e && /testing route/.test(e), e);
e = await err(() => as("SA", () => q(`select school_set_group_admissions_share('100001','${GP}', true)`)));
check("a School-Admin can't share Admissions with a preview account", !!e && /no such group account/.test(e), e);

console.log("\n-- the Platform page's overview");
e = await err(() => as("HA", () => q(`select * from platform_group_accounts_overview()`)));
check("head office can't read the platform overview", !!e && /platform admin only/.test(e), e);
const ov = (await rows("PA", `select * from platform_group_accounts_overview()`)).find((r) => r.group_id === "3320");
check("the platform admin sees Harris: 1 admin, 2 members, 2 open grants", ov?.admins === 1 && ov?.members === 2 && ov?.open_grants === 2, JSON.stringify(ov));

console.log("\n-- the helpers and functions aren't anon's");
for (const f of ["is_group_member(null)", "is_group_admin(null)", "group_accept_invitation('x')", "platform_group_accounts_overview()", `school_set_group_admissions_share('100001', null, true)`])
  check(`anon can't call ${f.replace(/\(.*/, "")}`, denied(await err(() => asAnon(() => q(`select ${f}`)))));

console.log(fails ? `\n${passes} passed, ${fails} FAILED` : `\nALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
