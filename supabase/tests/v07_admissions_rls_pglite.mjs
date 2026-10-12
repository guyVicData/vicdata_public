// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v07_admissions_rls_pglite.mjs
// Local only (WASM Postgres): applies 0.6 S1, the 0.6 membership hardening and 0.7 admissions
// r1 (A3) over a stub of the live schema they depend on (as v06_rls_pglite.mjs does), then
// signs in as each role on a test school and proves the Admissions lead's limits and the
// shared lists' read / write rules. Never touches a real database.
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
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104090000_v06_membership_insert_hardening.sql", "20261106090000_v07_admissions_r1.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
await ex(`grant all on all tables in schema public to authenticated, anon;`);

// The test schools. School 1 (100053): H account holder + School-Admin, A2 a second School-Admin,
// L the Admissions lead, M Admissions (granted by the School-Admin), S SMT, T and T2 teachers,
// P a pending joiner. School 2 (117037): O a teacher, OL its own Admissions lead.
const id = (c) => `00000000-0000-0000-0000-0000000000${c}`;
const P_ = { H: id("01"), A2: id("02"), L: id("03"), M: id("04"), S: id("05"), T: id("06"), T2: id("07"), P: id("08"), O: id("09"), OL: id("10"), S3: id("11"), T3: id("12") };
const S1 = "11111111-1111-1111-1111-111111111111", S2 = "22222222-2222-2222-2222-222222222222";
const asService = async (sql) => { await ex(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`); try { return await q(sql); } finally { await ex(`select set_config('request.jwt.claims', '', false)`); } };
await ex(`insert into profiles (id, full_name) values ${Object.entries(P_).map(([k, v]) => `('${v}','${k}')`).join(",")};
insert into schools values ('100053','Acland Burghley School','Local authority maintained schools','Community school',null), ('117037','The King''s School','Independent schools','Other independent school',null);
insert into school_accounts (id, school_urn) values ('${S1}','100053'), ('${S2}','117037');`);
const mem = async (who, school, roles, opts = {}) =>
  (await asService(`insert into school_memberships (school_account_id, profile_id, status, is_admin, roles, admissions_lead)
     values ('${school}','${P_[who]}','${opts.status ?? "approved"}',${opts.admin ? "true" : "false"}, array[${roles.map((r) => `'${r}'`).join(",")}]::text[], ${opts.lead ? "true" : "false"}) returning id`)).rows[0].id;
const M = {};
M.H = await mem("H", S1, ["teacher"], { admin: true });
await ex(`update school_accounts set account_holder_membership_id = '${M.H}' where id = '${S1}'`);
M.A2 = await mem("A2", S1, ["teacher"], { admin: true });
M.L = await mem("L", S1, ["admissions"], { lead: true });
M.M = await mem("M", S1, ["admissions"]);
M.S = await mem("S", S1, ["smt"]);
M.T = await mem("T", S1, ["teacher"]);
M.T2 = await mem("T2", S1, ["teacher", "hod"]);
M.P = await mem("P", S1, ["teacher"], { status: "pending_approval" });
M.S3 = await mem("S3", S1, ["smt"]);
M.T3 = await mem("T3", S1, ["teacher"]);
M.O = await mem("O", S2, ["teacher"]);
M.OL = await mem("OL", S2, ["admissions"], { lead: true });

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (who, fn) => {
  const sub = P_[who];
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const asAnon = async (fn) => { await ex(`set role anon`); try { return await fn(); } finally { await ex(`reset role`); } };
const throws = async (fn) => { try { await fn(); return false; } catch (e) { return e.message; } };
const roles = async (who) => (await q(`select roles, admissions_lead from school_memberships where id = '${M[who]}'`)).rows[0];
const grant = async (by, who, g = true) => as(by, () => q(`select admissions_set_member('${M[who]}', ${g})`));
const audits = async () => (await q(`select action from platform_audit_log order by id`)).rows.map((r) => r.action);

console.log("\n-- the lead flag");
await asService(`update school_memberships set admissions_lead = true where id = '${M.T}'`);
check("the flag needs the admissions role (the guard clears it; the constraint backs it)", (await roles("T")).admissions_lead === false);
check("a teacher can't make themselves lead (RLS: 0 rows)", (await as("T", () => q(`update school_memberships set admissions_lead = true where id = '${M.T}' returning id`))).rows.length === 0);
check("the lead can't make another admissions member lead (RLS: 0 rows)", (await as("L", () => q(`update school_memberships set admissions_lead = true where id = '${M.M}' returning id`))).rows.length === 0);
check("a self-insert can't arrive as lead", (await as("T", async () => {
  const r = await throws(() => q(`insert into school_memberships (school_account_id, profile_id, status, roles, admissions_lead) values ('${S2}','${P_.T}','pending_approval', array['admissions'], true)`));
  return r === false ? (await q(`select admissions_lead from school_memberships where profile_id='${P_.T}' and school_account_id='${S2}'`)).rows[0]?.admissions_lead === false : true;
})));
await asService(`delete from school_memberships where profile_id='${P_.T}' and school_account_id='${S2}'`);
check("the School-Admin (account holder) makes M lead", !(await throws(() => as("H", () => q(`update school_memberships set admissions_lead = true where id = '${M.M}'`)))) && (await roles("M")).admissions_lead === true);
check("a second School-Admin unmakes M", !(await throws(() => as("A2", () => q(`update school_memberships set admissions_lead = false where id = '${M.M}'`)))) && (await roles("M")).admissions_lead === false);
check("making / unmaking a lead is audited", (await audits()).join() === "admissions_lead_made,admissions_lead_unmade", (await audits()).join());

console.log("\n-- the lead adds and removes Admissions staff");
check("the lead grants Admissions to T2", (await throws(() => grant("L", "T2"))) === false);
let r = await roles("T2");
check("  T2 keeps their other roles and gains admissions only", r.roles.join() === "admissions,hod,teacher" && r.admissions_lead === false, r.roles.join());
check("  provenance: granted by the lead", (await q(`select granted_by_kind from admissions_grants where membership_id='${M.T2}'`)).rows[0]?.granted_by_kind === "lead");
check("  audited", (await audits()).at(-1) === "admissions_lead_grant");
check("granting again is a no-op (no extra audit row)", (await throws(() => grant("L", "T2"))) === false && (await audits()).length === 3);
check("the lead removes the Admissions they granted", (await throws(() => grant("L", "T2", false))) === false && (await roles("T2")).roles.join() === "hod,teacher" && (await audits()).at(-1) === "admissions_lead_remove");
check("  provenance cleared", (await q(`select count(*)::int n from admissions_grants where membership_id='${M.T2}'`)).rows[0].n === 0);
let e = await throws(() => grant("L", "M", false));
check("the lead can't remove a School-Admin's grant", !!e && (await roles("M")).roles.includes("admissions"), e);
e = await throws(() => grant("L", "P"));
check("the lead can't grant a pending (unapproved) member", !!e, e);
e = await throws(() => grant("L", "O"));
check("the lead can't act on another school's member", !!e && !(await roles("O")).roles.includes("admissions"), e);
e = await throws(() => grant("OL", "T"));
check("another school's lead can't act on this school", !!e && !(await roles("T")).roles.includes("admissions"), e);
e = await throws(() => grant("L", "L", false));
check("the lead can't remove their own role", !!e, e);
await as("H", () => q(`update school_memberships set admissions_lead = true where id = '${M.M}'`));
e = await throws(() => grant("L", "M", false));
check("the lead can't touch another lead", !!e, e);
await as("H", () => q(`update school_memberships set admissions_lead = false where id = '${M.M}'`));
for (const who of ["M", "S", "T", "H"]) {
  e = await throws(() => grant(who, "T"));
  check(`${who} (not a lead) can't use the lead's function`, !!e && !(await roles("T")).roles.includes("admissions"), e);
}
e = await throws(() => asAnon(() => q(`select admissions_set_member('${M.T}', true)`)));
check("anon can't call it (permission denied)", /permission denied/.test(e || ""), e);
e = await throws(() => as("L", () => q(`select admissions_set_member('${M.T}', null)`)));
check("a null p_grant is refused", !!e && !(await roles("T")).roles.includes("admissions"), e);
const eNone = await throws(() => as("L", () => q(`select admissions_set_member('99999999-9999-9999-9999-999999999999', true)`)));
const eOther = await throws(() => grant("L", "O"));
check("one message for 'no such membership' and 'not your school' (no oracle)", !!eNone && eNone === eOther, eNone);
check("the lead can't update memberships directly (roles: 0 rows)", (await as("L", () => q(`update school_memberships set roles = array['smt'] where id = '${M.T}' returning id`))).rows.length === 0);
check("the lead can't grant SMT or any other role: the function only adds admissions", (await grant("L", "T")) && (await roles("T")).roles.join() === "admissions,teacher");
check("the lead can't delete memberships (0 rows)", (await as("L", () => q(`delete from school_memberships where id = '${M.T}' returning id`))).rows.length === 0);

console.log("\n-- the guard itself, provenance and the School-Admin's audit");
e = await throws(async () => {
  // As the table owner (RLS bypassed) with a non-admin's claims: the trigger is the last line.
  await ex(`select set_config('request.jwt.claim.sub', '${P_.T}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${P_.T}"}', false);`);
  try { await q(`update school_memberships set admissions_lead = true where id = '${M.M}'`); } finally { await ex(`select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
});
check("the guard's own refusal (owner session, a teacher's claims)", /only the School-Admin can make or unmake/.test(e || ""), e);
// A session with no user and no role in its claims (as supabase db query): the guard refuses.
// (A claims value of '' would fail first in 0.6 S1's sync_membership_roles cast, which this
// migration doesn't change; the runbook below sets the claims, so it never meets either.)
e = await throws(async () => { await ex(`select set_config('request.jwt.claims', '{}', false)`); try { await q(`update school_memberships set admissions_lead = true where id = '${M.M}'`); } finally { await ex(`select set_config('request.jwt.claims', '', false)`); } });
check("  a session with no claims gets the guard's refusal", /only the School-Admin can make or unmake/.test(e || ""), e);
await ex(`begin; select set_config('request.jwt.claims', '{"role":"service_role"}', true); update school_memberships set admissions_lead = true where id = '${M.M}'; commit;`);
check("  the runbook (service role, transaction-local) makes a lead", (await roles("M")).admissions_lead === true);
await ex(`begin; select set_config('request.jwt.claims', '{"role":"service_role"}', true); update school_memberships set admissions_lead = false where id = '${M.M}'; commit;`);
check("direct writes to admissions_grants are refused", !!(await throws(() => as("H", () => q(`insert into admissions_grants (membership_id, school_account_id, granted_by_kind) values ('${M.T3}','${S1}','lead')`))))
  && (await as("L", () => q(`update admissions_grants set granted_by_kind = 'lead' returning membership_id`))).rows.length === 0
  && (await as("L", () => q(`delete from admissions_grants returning membership_id`))).rows.length === 0);
let n0 = (await audits()).length;
await as("H", () => ex(`select set_config('vicdata.admissions_grant_by_lead', 'on', false); update school_memberships set roles = array['admissions','teacher'] where id = '${M.T3}'; select set_config('vicdata.admissions_grant_by_lead', '', false);`));
check("a School-Admin setting the lead's marker still records a School-Admin grant", (await q(`select granted_by_kind from admissions_grants where membership_id='${M.T3}'`)).rows[0]?.granted_by_kind === "school_admin");
check("  and it's audited as the School-Admin's", (await audits()).slice(n0).join() === "admissions_admin_grant", (await audits()).slice(n0).join());
e = await throws(() => grant("L", "T3", false));
check("  so the lead can't remove it", !!e && (await roles("T3")).roles.includes("admissions"), e);
n0 = (await audits()).length;
await as("H", () => q(`update school_memberships set roles = array['teacher'] where id = '${M.T3}'`));
check("a School-Admin removal is audited", (await audits()).slice(n0).join() === "admissions_admin_remove");
// The legacy `role` column path: sync_membership_roles rewrites roles.
await grant("L", "T3");
check("the lead grants T3 (provenance: lead)", (await q(`select granted_by_kind from admissions_grants where membership_id='${M.T3}'`)).rows[0]?.granted_by_kind === "lead");
await as("H", () => q(`update school_memberships set role = 'teacher' where id = '${M.T3}'`));
check("  a School-Admin's legacy role='teacher' removes it and its provenance", (await roles("T3")).roles.join() === "teacher" && (await q(`select count(*)::int n from admissions_grants where membership_id='${M.T3}'`)).rows[0].n === 0);
await as("H", () => q(`update school_memberships set role = 'admissions' where id = '${M.T3}'`));
check("  the legacy re-grant is the School-Admin's", (await q(`select granted_by_kind from admissions_grants where membership_id='${M.T3}'`)).rows[0]?.granted_by_kind === "school_admin");
e = await throws(() => grant("L", "T3", false));
check("  so the lead can't remove it", !!e && (await roles("T3")).roles.includes("admissions"), e);

console.log("\n-- the School-Admin sees and overrides");
check("the School-Admin reads the school's admissions audit rows", (await as("H", () => q(`select action from platform_audit_log`))).rows.length === (await audits()).length);
await q(`insert into platform_audit_log (actor_profile_id, action, school_urn) values ('${P_.H}', 'vc_sets_visible', '100053')`);
check("  but not other platform rows", (await as("H", () => q(`select action from platform_audit_log where action = 'vc_sets_visible'`))).rows.length === 0);
check("  the lead can't read the audit log", (await as("L", () => q(`select action from platform_audit_log`))).rows.length === 0);
check("  another school's School-Admin can't", (await as("OL", () => q(`select action from platform_audit_log`))).rows.length === 0);
check("the School-Admin removes a lead's grant (override)", !(await throws(() => as("H", () => q(`update school_memberships set roles = array['teacher'] where id = '${M.T}'`)))) && (await roles("T")).roles.join() === "teacher");
n0 = (await audits()).length;
check("the School-Admin removing a lead's Admissions ends the lead", !(await throws(() => as("H", () => q(`update school_memberships set roles = array['teacher'] where id = '${M.L}'`)))) && (await roles("L")).admissions_lead === false);
check("  and the end of the lead is audited", (await audits()).slice(n0).sort().join() === "admissions_admin_remove,admissions_lead_unmade", (await audits()).slice(n0).join());
await as("H", () => q(`update school_memberships set roles = array['admissions'] where id = '${M.L}'`));
await as("H", () => q(`update school_memberships set admissions_lead = true where id = '${M.L}'`));
check("a School-Admin re-grant is recorded as the School-Admin's", (await q(`select granted_by_kind from admissions_grants where membership_id='${M.L}'`)).rows[0]?.granted_by_kind === "school_admin");

console.log("\n-- entry points and shared lists");
const list = await as("L", () => q(`insert into admissions_lists (school_account_id, entry_point, kind, members, updated_by) values ('${S1}','11+','day_feeders', array['100000','100001'], '${P_.M}') returning id, updated_by`));
check("the lead writes a list", list.rows.length === 1);
check("  'last changed by' is the database's, not the client's", list.rows[0].updated_by === P_.L);
check("the lead writes an entry point", (await as("L", () => q(`insert into admissions_entry_points (school_account_id, entry_point) values ('${S1}','11+') returning id`))).rows.length === 1);
check("  a bad entry point is refused", !!(await throws(() => as("L", () => q(`insert into admissions_entry_points (school_account_id, entry_point) values ('${S1}','age:1')`)))));
check("  a rung list needs its rung", !!(await throws(() => as("L", () => q(`insert into admissions_lists (school_account_id, entry_point, kind) values ('${S1}','16+','rung')`)))));
check("  the lead updates the list (LA blend override)", (await as("L", () => q(`update admissions_lists set la_blend = '{"Camden": 0.6, "Islington": 0.4}' where id = '${list.rows[0].id}' returning id`))).rows.length === 1);
const reads = {};
for (const who of ["L", "M", "S", "H", "A2", "T", "O", "OL"]) reads[who] = (await as(who, () => q(`select id from admissions_lists`))).rows.length;
check("read: lead, Admissions, SMT and School-Admins see the list", ["L", "M", "S", "H", "A2"].every((w) => reads[w] === 1), JSON.stringify(reads));
check("read: a teacher, another school's members and lead don't", ["T", "O", "OL"].every((w) => reads[w] === 0), JSON.stringify(reads));
check("read: anon sees nothing", (await asAnon(() => q(`select id from admissions_lists`))).rows.length === 0);
for (const who of ["M", "S", "H", "T", "OL"]) {
  const ins = await throws(() => as(who, () => q(`insert into admissions_lists (school_account_id, entry_point, kind) values ('${S1}','11+','rivals')`)));
  const upd = (await as(who, () => q(`update admissions_lists set members = array['999999'] where id = '${list.rows[0].id}' returning id`))).rows.length;
  const del = (await as(who, () => q(`delete from admissions_lists where id = '${list.rows[0].id}' returning id`))).rows.length;
  check(`write: ${who} can't insert, update or delete`, !!ins && upd === 0 && del === 0);
}
check("write: another school's lead can't write here", !!(await throws(() => as("OL", () => q(`insert into admissions_entry_points (school_account_id, entry_point) values ('${S1}','4+')`)))));
check("write: the lead can't move a list to another school", !!(await throws(() => as("L", () => q(`update admissions_lists set school_account_id = '${S2}' where id = '${list.rows[0].id}'`)))));
check("write: another school's lead writes its own school's lists", (await as("OL", () => q(`insert into admissions_lists (school_account_id, entry_point, kind) values ('${S2}','16+','rivals') returning id`))).rows.length === 1);
check("  which this school's lead can't see", (await as("L", () => q(`select id from admissions_lists where school_account_id = '${S2}'`))).rows.length === 0);

console.log("\n-- sharing through teams and roles (read-only)");
const team = (await as("H", () => q(`insert into teams (school_account_id, name) values ('${S1}','Heads of year') returning id`))).rows[0].id;
await as("H", () => q(`insert into team_members (team_id, membership_id) values ('${team}','${M.T}')`));
check("a teacher can't share the lists", !!(await throws(() => as("T", () => q(`insert into admissions_list_shares (school_account_id, target_kind, team_id) values ('${S1}','team','${team}')`)))));
const share = await as("S", () => q(`insert into admissions_list_shares (school_account_id, target_kind, team_id, created_by, created_at) values ('${S1}','team','${team}','${P_.H}','2000-01-01') returning id, created_by, created_at`));
check("SMT shares them with a team", share.rows.length === 1);
check("  'shared by' and 'when' are the database's, not the client's", share.rows[0].created_by === P_.S && new Date(share.rows[0].created_at).getFullYear() > 2000);
check("  and can't be rewritten later", (await as("S", () => q(`update admissions_list_shares set created_by = '${P_.H}' where id = '${share.rows[0].id}' returning created_by`))).rows[0]?.created_by === P_.S);
check("  another SMT member can't change or remove it", (await as("S3", () => q(`update admissions_list_shares set target_kind = 'role', team_id = null, role = 'teacher' where id = '${share.rows[0].id}' returning id`))).rows.length === 0
  && (await as("S3", () => q(`delete from admissions_list_shares where id = '${share.rows[0].id}' returning id`))).rows.length === 0);
const tmp = await as("S3", () => q(`insert into admissions_list_shares (school_account_id, target_kind, role) values ('${S1}','role','finance') returning id`));
check("  SMT removes its own share", (await as("S3", () => q(`delete from admissions_list_shares where id = '${tmp.rows[0].id}' returning id`))).rows.length === 1);
const tmp2 = await as("S3", () => q(`insert into admissions_list_shares (school_account_id, target_kind, role) values ('${S1}','role','finance') returning id`));
check("  the School-Admin removes anyone's share", (await as("H", () => q(`delete from admissions_list_shares where id = '${tmp2.rows[0].id}' returning id`))).rows.length === 1);
const tmp3 = await as("S3", () => q(`insert into admissions_list_shares (school_account_id, target_kind, role) values ('${S1}','role','finance') returning id`));
check("  and so does the lead", (await as("H", async () => q(`update school_memberships set roles = array['admissions'] where id = '${M.L}'`))) && (await as("H", () => q(`update school_memberships set admissions_lead = true where id = '${M.L}'`))) && (await as("L", () => q(`delete from admissions_list_shares where id = '${tmp3.rows[0].id}' returning id`))).rows.length === 1);
check("  the team member reads them", (await as("T", () => q(`select id from admissions_lists`))).rows.length === 1);
check("  but can't write them", (await as("T", () => q(`update admissions_lists set members = '{}' where id = '${list.rows[0].id}' returning id`))).rows.length === 0);
check("  a teacher outside the team doesn't read them", (await as("T2", () => q(`select id from admissions_lists`))).rows.length === 0);
check("a share can't point at another school's team", !!(await throws(async () => {
  const t2 = (await asService(`insert into teams (school_account_id, name) values ('${S2}','Other') returning id`)).rows[0].id;
  return as("S", () => q(`insert into admissions_list_shares (school_account_id, target_kind, team_id) values ('${S1}','team','${t2}')`));
})));
await as("H", () => q(`insert into admissions_list_shares (school_account_id, target_kind, role) values ('${S1}','role','hod')`));
check("a role share (HOD) reaches T2", (await as("T2", () => q(`select id from admissions_lists`))).rows.length === 1);
check("  but not another school's HOD-free members", (await as("O", () => q(`select id from admissions_lists`))).rows.length === 0);

console.log("\n-- re-runnable");
check("the migration applies a second time over itself", (await throws(() => ex(readFileSync(repo + "20261106090000_v07_admissions_r1.sql", "utf8")))) === false);
check("  and the lists and grants are intact", (await q(`select count(*)::int n from admissions_lists`)).rows[0].n === 2 && (await q(`select count(*)::int n from admissions_grants`)).rows[0].n > 0);

console.log(`\n${fails ? `${fails} FAILED` : "ALL PASS"}`);
process.exit(fails ? 1 : 0);
