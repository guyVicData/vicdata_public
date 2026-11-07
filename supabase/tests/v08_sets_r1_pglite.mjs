// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_sets_r1_pglite.mjs
// VicData 0.8 sets round 1 (A1-A5, R-SETS-ONE-MODEL's conversion half and R-SETS-RLS), in PGlite.
// Local only (WASM Postgres): applies 0.6 S1, the 0.6 membership hardening, saved_sets (and its cap
// of 8), 0.7 admissions r1 and r2b over a stub of the live schema they depend on (as
// v07_admissions_rls_pglite.mjs does), seeds a copy of Leighton Park's 6 admissions_lists rows
// (supabase/tests/fixtures/sets_r1_leighton_lists.json, read from the app database on 7 Nov) and a
// personal and a shared saved_sets row, then applies 20261121090000_v08_sets_r1.sql and proves:
//   - the conversion: every row becomes a set with its members in order, the fuzzy rule, the LA
//     blend, the entry point, who changed it and when; a second run changes nothing;
//   - who reads: a personal set its owner only; a school set every approved member of its school;
//   - who writes, by kind: compared-against by SMT, Admissions and the School-Admin; feeders by
//     Admissions; a teacher never; no set moves school or changes hands;
//   - the cap: 8 active personal sets, archiving frees a slot;
//   - the creator is a role the writer holds; the stamp is the database's.
// Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/sets_r1_leighton_lists.json", import.meta.url), "utf8"));
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
alter table public.school_memberships enable row level security;
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
create policy school_memberships_insert_own on public.school_memberships for insert with check (profile_id = auth.uid());
alter table public.school_accounts enable row level security;
create policy school_accounts_select_member on public.school_accounts for select using (is_member_of_school_account(id));
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
process.on("unhandledRejection", (e) => { console.log("ERROR", e?.message ?? e); process.exit(1); });
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261104090000_v06_membership_insert_hardening.sql", "20260807093000_saved_sets.sql", "20260925232857_personal_comparator_cap_8.sql", "20261106090000_v07_admissions_r1.sql", "20261108090000_v07_admissions_r2b_school_admin_override.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
await ex(`grant all on all tables in schema public to authenticated, anon;`);

// Leighton Park (110110) as on the live database: its real account id and the lead who saved its
// lists (Guy, the updated_by on every row). Plus a second school (117037) for the cross-school checks.
const LP = fixture.rows[0].school_account_id;
const OTHER = "22222222-2222-2222-2222-222222222222";
const id = (c) => `00000000-0000-0000-0000-0000000000${c}`;
const GUY = fixture.rows[0].updated_by;
const P_ = { G: GUY, H: id("01"), L: id("03"), M: id("04"), S: id("05"), T: id("06"), P: id("08"), O: id("09"), OS: id("10") };
const asService = async (sql) => { await ex(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`); try { return await q(sql); } finally { await ex(`select set_config('request.jwt.claims', '', false)`); } };
const allUrns = Array.from(new Set(fixture.rows.flatMap((r) => r.members).concat(["110110", "117037", "100053"])));
await ex(`insert into profiles (id, full_name) values ${Object.entries(P_).map(([k, v]) => `('${v}','${k}')`).join(",")};
insert into schools (urn, current_name) values ${allUrns.map((u) => `('${u}','School ${u}')`).join(",")};
insert into school_accounts (id, school_urn) values ('${LP}','110110'), ('${OTHER}','117037');`);
const mem = async (who, school, roles, opts = {}) =>
  (await asService(`insert into school_memberships (school_account_id, profile_id, status, is_admin, roles, admissions_lead)
     values ('${school}','${P_[who]}','${opts.status ?? "approved"}',${opts.admin ? "true" : "false"}, array[${roles.map((r) => `'${r}'`).join(",")}]::text[], ${opts.lead ? "true" : "false"}) returning id`)).rows[0].id;
// G the Admissions lead (Guy's test), H the account holder and School-Admin, M Admissions (not the
// lead), S SMT, T a teacher, P a pending joiner; at the other school O a teacher and OS its SMT.
const M = {};
M.G = await mem("G", LP, ["admissions"], { lead: true });
M.H = await mem("H", LP, ["teacher"], { admin: true });
await ex(`update school_accounts set account_holder_membership_id = '${M.H}' where id = '${LP}'`);
M.M = await mem("M", LP, ["admissions"]);
M.S = await mem("S", LP, ["smt"]);
M.T = await mem("T", LP, ["teacher"]);
M.P = await mem("P", LP, ["teacher"], { status: "pending_approval" });
M.O = await mem("O", OTHER, ["teacher"]);
M.OS = await mem("OS", OTHER, ["smt"]);

// The 6 rows, exactly as read (the stamp and audit triggers off, so updated_by / updated_at stand).
await ex(`alter table admissions_lists disable trigger user;`);
for (const r of fixture.rows) {
  await q(`insert into admissions_lists (id, school_account_id, entry_point, kind, rung, members, fuzzy, la_blend, confirmed, updated_by, updated_at, updated_by_kind)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [r.id, r.school_account_id, r.entry_point, r.kind, r.rung, r.members, r.fuzzy, r.la_blend, r.confirmed, r.updated_by, r.updated_at, r.updated_by_kind]);
}
await ex(`alter table admissions_lists enable trigger user;`);
// Two saved_sets rows (none exist live): T's personal comparator set, and a shared one with an
// excluded member that must stay out.
const ssPersonal = (await asService(`insert into saved_sets (school_account_id, set_type, name, owner_membership_id, config) values ('${LP}','comparator','My rivals','${M.T}','{"startedFrom":"nearest"}') returning id`)).rows[0].id;
const ssShared = (await asService(`insert into saved_sets (school_account_id, set_type, name, owner_membership_id, config) values ('${LP}','comparator','Shared rivals',null,'{}') returning id`)).rows[0].id;
await asService(`insert into saved_set_members (saved_set_id, school_urn, member_status, added_at) values
  ('${ssPersonal}','117037','confirmed','2026-11-01'), ('${ssPersonal}','100053','candidate','2026-11-02'),
  ('${ssShared}','117037','confirmed','2026-11-01'), ('${ssShared}','100053','excluded','2026-11-02')`);

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (who, fn) => {
  const sub = P_[who];
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${sub}"}', false);`);
  try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
};
const asAnon = async (fn) => { await ex(`set role anon`); try { return await fn(); } finally { await ex(`reset role`); } };
const throws = async (fn) => { try { await fn(); return false; } catch (e) { return e.message; } };

console.log("\n-- the migration");
await ex(readFileSync(repo + "20261121090000_v08_sets_r1.sql", "utf8"));
console.log("applied 20261121090000_v08_sets_r1.sql");

console.log("\n-- the conversion: Leighton Park's 6 lists");
const sets = (await q(`select s.*, coalesce((select array_agg(m.urn order by m.position) from set_members m where m.set_id = s.id), '{}') urns,
                               (select bool_and(m.tier is null) from set_members m where m.set_id = s.id) untiered,
                               (select l.updated_at = s.updated_at from admissions_lists l where l.id = s.legacy_list_id) same_at
                        from sets s where legacy_list_id is not null order by entry_point, kind, audience`)).rows;
check("6 sets, one per row", sets.length === 6, String(sets.length));
const kindOf = (r) => (r.kind === "rivals" ? ["compared_against", null, "Rivals"] : r.kind === "day_feeders" ? ["feeders", "day", "Day feeders"] : r.kind === "boarding_feeders" ? ["feeders", "boarding", "Boarding feeders"] : ["feeders", null, `Feeders for age ${r.rung.slice(4)}`]);
for (const r of fixture.rows) {
  const s = sets.find((x) => x.legacy_list_id === r.id);
  const [kind, audience, name] = kindOf(r);
  // jsonb keeps its own key order, so compare with the keys sorted.
  const canon = (v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v ?? null);
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const ok = !!s && s.kind === kind && s.audience === audience && s.name === name && s.entry_point === r.entry_point
    && same(s.urns, r.members) && same(s.rule, r.fuzzy) && same(s.la_blend, r.la_blend)
    && s.owner_scope === "school" && s.school_account_id === r.school_account_id && s.focus_urn === "110110"
    && s.creator_kind === (r.updated_by_kind === "school_admin" ? "school_admin" : "admissions")
    && s.updated_by === r.updated_by && s.same_at === true
    && s.is_default === true && s.pinned === true && s.archived === false && s.untiered === true;
  check(`  ${r.entry_point} ${r.kind}: ${r.members.length} schools in order, rule ${r.fuzzy ? JSON.stringify(r.fuzzy) : "none"}, blend ${r.la_blend ? "kept" : "none"}, who and when kept`, ok, s ? `${s.kind}/${s.audience}/${s.urns.length}` : "missing");
}
check("  the member counts are 18, 27, 10, 16, 18 and 10", ["11+ day", "11+ boarding", "11+ null", "16+ day", "16+ boarding", "16+ null"].map((k) => sets.find((s) => `${s.entry_point} ${s.audience}` === k)?.urns.length).join() === "18,27,10,16,18,10");
check("  the old table is untouched", (await q(`select count(*)::int n, sum(cardinality(members))::int m from admissions_lists`)).rows[0].m === 99);

console.log("\n-- the conversion: saved_sets");
const cs = (await q(`select s.*, coalesce((select array_agg(m.urn order by m.position) from set_members m where m.set_id = s.id), '{}') urns from sets s where legacy_saved_set_id is not null order by name`)).rows;
const mine = cs.find((s) => s.legacy_saved_set_id === ssPersonal), shared = cs.find((s) => s.legacy_saved_set_id === ssShared);
check("the personal set is T's own, 'me', with both members in the order added and startedFrom as its recipe",
  mine?.owner_scope === "personal" && mine.owner_profile_id === P_.T && mine.creator_kind === "me" && mine.kind === "compared_against" && mine.urns.join() === "117037,100053" && mine.source_recipe === "nearest");
check("the shared set is a school set made by the School-Admin, its excluded member left out",
  shared?.owner_scope === "school" && shared.creator_kind === "school_admin" && shared.school_account_id === LP && shared.urns.join() === "117037");

console.log("\n-- run twice");
const snapshot = async () => JSON.stringify((await q(`select s.id, s.name, s.kind, s.audience, s.entry_point, s.rule, s.la_blend, s.updated_by, s.updated_at, s.is_default,
   (select json_agg(json_build_object('u', m.urn, 'p', m.position, 't', m.tier) order by m.position) from set_members m where m.set_id = s.id) mem from sets s order by s.id`)).rows);
const before = await snapshot();
check("the migration applies a second time over itself", (await throws(() => ex(readFileSync(repo + "20261121090000_v08_sets_r1.sql", "utf8")))) === false);
check("  and changes nothing (sets, members, order, rules, stamps)", (await snapshot()) === before);

console.log("\n-- who reads");
const lpSchoolSets = sets.length + 1; // the 6 lists + the shared saved set
const reads = async (who) => (await as(who, () => q(`select id, owner_scope from sets`))).rows;
for (const who of ["G", "H", "M", "S", "T"]) {
  const r = await reads(who);
  check(`${who} (approved at Leighton Park) reads every school set there`, r.filter((x) => x.owner_scope === "school").length === lpSchoolSets);
}
check("only T reads T's personal set", (await reads("T")).some((x) => x.id === mine.id) && !(await reads("G")).some((x) => x.id === mine.id) && !(await reads("H")).some((x) => x.id === mine.id));
check("a pending joiner reads nothing", (await reads("P")).length === 0);
check("another school reads nothing of Leighton Park's", (await reads("O")).length === 0 && (await reads("OS")).length === 0);
check("anon reads nothing (no grant)", !!(await throws(() => asAnon(() => q(`select id from sets`)))));
const rivalsId = sets.find((s) => s.kind === "compared_against" && s.entry_point === "11+").id;
const dayId = sets.find((s) => s.audience === "day" && s.entry_point === "11+").id;
check("members follow their set: T reads the rivals' 10, O none", (await as("T", () => q(`select urn from set_members where set_id = '${rivalsId}'`))).rows.length === 10
  && (await as("O", () => q(`select urn from set_members where set_id = '${rivalsId}'`))).rows.length === 0);

console.log("\n-- who writes: compared-against school sets (lead-only, Guy 7 Nov)");
const audits = async () => (await q(`select action, actor_profile_id, detail from platform_audit_log where action = 'admissions_lists_override' order by id`)).rows;
const newSchoolSet = (who, kind, creator) => as(who, () => q(`insert into sets (name, kind, entry_point, owner_scope, school_account_id, creator_kind) values ('${who} ${kind}', '${kind}', '11+', 'school', '${LP}', '${creator}') returning id`));
for (const [who, creator, label] of [["G", "admissions", "the Admissions lead"], ["S", "smt", "SMT"], ["H", "school_admin", "the School-Admin"]]) {
  const e = await throws(() => newSchoolSet(who, "compared_against", creator));
  check(`${who} (${label}) makes a compared-against school set`, e === false, e || "");
}
check("M (an Admissions member who isn't the lead) can't", !!(await throws(() => newSchoolSet("M", "compared_against", "admissions"))));
check("  nor change the rivals set or its schools", (await as("M", () => q(`update sets set name = 'x' where id = '${rivalsId}' returning id`))).rows.length === 0
  && (await as("M", () => q(`delete from set_members where set_id = '${rivalsId}' returning urn`))).rows.length === 0);
check("T (a teacher) can't", !!(await throws(() => newSchoolSet("T", "compared_against", "smt"))) && !!(await throws(() => newSchoolSet("T", "compared_against", "school_admin"))));
check("S can't claim to be Admissions (the creator is a role the writer holds; 'admissions' is the lead's)", !!(await throws(() => newSchoolSet("S", "compared_against", "admissions"))));
check("OS (SMT elsewhere) can't make one at Leighton Park", !!(await throws(() => newSchoolSet("OS", "compared_against", "smt"))));
let nAudit = (await audits()).length;
check("S changes the rivals set's schools, not audited (SMT's own right)", (await as("S", () => q(`update set_members set position = position where set_id = '${rivalsId}' returning urn`))).rows.length === 10
  && !(await throws(() => as("S", () => q(`insert into set_members (set_id, urn, position) values ('${rivalsId}', '117037', 10)`))))
  && (await audits()).length === nAudit);
check("T can't change a school set or its schools", (await as("T", () => q(`update sets set name = 'x' where id = '${rivalsId}' returning id`))).rows.length === 0
  && (await as("T", () => q(`delete from set_members where set_id = '${rivalsId}' returning urn`))).rows.length === 0
  && !!(await throws(() => as("T", () => q(`insert into set_members (set_id, urn) values ('${rivalsId}', '100053')`)))));
nAudit = (await audits()).length;
check("H (School-Admin) changes the rivals set's description: allowed, audited as an override", (await as("H", () => q(`update sets set description = 'H was here' where id = '${rivalsId}' returning id`))).rows.length === 1
  && (await audits()).length === nAudit + 1 && (await audits()).at(-1).actor_profile_id === P_.H && (await audits()).at(-1).detail.changed.includes("description") && (await audits()).at(-1).detail.kind === "rivals");

console.log("\n-- who writes: feeder school sets (the lead, and the School-Admin audited)");
check("G (the lead) makes a feeder school set", (await throws(() => newSchoolSet("G", "feeders", "admissions"))) === false);
check("M (an Admissions member who isn't the lead) can't make one", !!(await throws(() => newSchoolSet("M", "feeders", "admissions"))));
check("  nor change the day feeders' schools", (await as("M", () => q(`delete from set_members where set_id = '${dayId}' returning urn`))).rows.length === 0
  && !!(await throws(() => as("M", () => q(`insert into set_members (set_id, urn) values ('${dayId}', '100053')`)))));
check("  but keeps a personal feeder set of its own", (await throws(() => as("M", () => q(`insert into sets (name, kind, entry_point, owner_scope, owner_profile_id, school_account_id, creator_kind) values ('M preps','feeders','11+','personal','${P_.M}','${LP}','me')`)))) === false);
check("S (SMT) can't make or change feeder sets", !!(await throws(() => newSchoolSet("S", "feeders", "smt"))) && (await as("S", () => q(`delete from set_members where set_id = '${dayId}' returning urn`))).rows.length === 0);
nAudit = (await audits()).length;
check("G (the lead) tiers a day feeder, not audited", (await as("G", () => q(`update set_members set tier = 'main' where set_id = '${dayId}' and position = 0 returning tier`))).rows[0]?.tier === "main" && (await audits()).length === nAudit);
check("  which stamps the set as G's change", (await q(`select updated_by from sets where id = '${dayId}'`)).rows[0].updated_by === GUY);
await as("G", () => q(`update set_members set tier = null where set_id = '${dayId}'`));
nAudit = (await audits()).length;
const hFeeder = await throws(() => newSchoolSet("H", "feeders", "school_admin"));
check("H (School-Admin) makes a feeder school set: allowed, audited", hFeeder === false && (await audits()).length === nAudit + 1 && (await audits()).at(-1).detail.op === "insert", hFeeder || "");
nAudit = (await audits()).length;
check("H adds a school to the day feeders: allowed, audited with what joined", !(await throws(() => as("H", () => q(`insert into set_members (set_id, urn, position) values ('${dayId}', '100053', 99)`))))
  && (await audits()).length === nAudit + 1 && JSON.stringify((await audits()).at(-1).detail.added) === '["100053"]' && (await audits()).at(-1).detail.kind === "day_feeders" && (await audits()).at(-1).detail.entry_point === "11+");
nAudit = (await audits()).length;
check("  and takes it out again: audited with what left", (await as("H", () => q(`delete from set_members where set_id = '${dayId}' and urn = '100053' returning urn`))).rows.length === 1
  && (await audits()).length === nAudit + 1 && JSON.stringify((await audits()).at(-1).detail.removed) === '["100053"]');
check("a service-role write is never audited", await (async () => { const b = (await audits()).length; await asService(`update sets set description = 'svc' where id = '${dayId}'`); return (await audits()).length === b; })());

console.log("\n-- no set moves or changes hands");
check("S can't move the rivals set to another school", !!(await throws(() => as("S", () => q(`update sets set school_account_id = '${OTHER}' where id = '${rivalsId}'`)))));
check("S can't turn a school set into a personal one", !!(await throws(() => as("S", () => q(`update sets set owner_scope = 'personal', owner_profile_id = '${P_.S}', creator_kind = 'me' where id = '${rivalsId}'`)))));
check("S can't turn the rivals set into feeders (Admissions only)", !!(await throws(() => as("S", () => q(`update sets set kind = 'feeders' where id = '${rivalsId}'`)))));
check("G can't make a personal set for someone else", !!(await throws(() => as("G", () => q(`insert into sets (name, kind, owner_scope, owner_profile_id, creator_kind) values ('x','compared_against','personal','${P_.T}','me')`)))));
check("G can't take T's personal set", (await as("G", () => q(`update sets set owner_profile_id = '${GUY}' where id = '${mine.id}' returning id`))).rows.length === 0);
check("a personal set can't name a school its owner isn't approved at", !!(await throws(() => as("T", () => q(`insert into sets (name, kind, owner_scope, owner_profile_id, school_account_id, creator_kind) values ('x','compared_against','personal','${P_.T}','${OTHER}','me')`)))));
check("a personal set says 'me'", !!(await throws(() => as("T", () => q(`insert into sets (name, kind, owner_scope, owner_profile_id, creator_kind) values ('x','compared_against','personal','${P_.T}','smt')`)))));
check("legacy ids can't be rewritten", (await asService(`update sets set legacy_list_id = null where id = '${rivalsId}' returning legacy_list_id`)).rows[0].legacy_list_id !== null);

console.log("\n-- the cap: 8 active personal sets");
const personal = (who, name) => as(who, () => q(`insert into sets (name, kind, owner_scope, owner_profile_id, school_account_id, creator_kind) values ('${name}','compared_against','personal','${P_[who]}','${LP}','me') returning id`));
const tSets = [mine.id];
for (let i = 2; i <= 8; i++) tSets.push((await personal("T", `T ${i}`)).rows[0].id);
check("T has 8 (the converted one and 7 more)", (await as("T", () => q(`select count(*)::int n from sets where owner_scope = 'personal' and not archived`))).rows[0].n === 8);
check("a 9th is refused", /cap/.test((await throws(() => personal("T", "T 9"))) || ""));
check("archiving one frees a slot", (await throws(() => as("T", () => q(`update sets set archived = true where id = '${tSets[1]}'`)))) === false && (await throws(() => personal("T", "T 9"))) === false);
check("unarchiving with 8 active is refused", /cap/.test((await throws(() => as("T", () => q(`update sets set archived = false where id = '${tSets[1]}'`)))) || ""));
check("renaming an active one at the cap is fine", (await throws(() => as("T", () => q(`update sets set name = 'renamed' where id = '${tSets[2]}'`)))) === false);
check("the cap is per person: G still makes personal sets", (await throws(() => personal("G", "G 1"))) === false);
check("school sets don't count against it", (await throws(() => newSchoolSet("S", "compared_against", "smt"))) === false);

console.log("\n-- the stamp and the per-user state");
const stamped = (await as("S", () => q(`update sets set description = 'why these schools' where id = '${rivalsId}' returning updated_by, created_by, created_at, legacy_list_id`))).rows[0];
check("an update is stamped with the writer; created_by, created_at and the legacy id stay", stamped.updated_by === P_.S && stamped.created_by === GUY && stamped.legacy_list_id !== null);
check("a forged updated_by is overwritten", (await as("S", () => q(`update sets set updated_by = '${P_.T}' where id = '${rivalsId}' returning updated_by`))).rows[0].updated_by === P_.S);
check("T records using a set and a computed set", (await throws(() => as("T", () => q(`insert into set_user_state (profile_id, set_key, last_used_at, folder) values ('${P_.T}','${rivalsId}', now(), 'Mocks'), ('${P_.T}','adm:nearest-sector', now(), null)`)))) === false);
check("  only T reads T's state", (await as("T", () => q(`select * from set_user_state`))).rows.length === 2 && (await as("G", () => q(`select * from set_user_state`))).rows.length === 0);
check("  nobody writes someone else's", !!(await throws(() => as("G", () => q(`insert into set_user_state (profile_id, set_key) values ('${P_.T}','x')`)))));
check("one school default per page (a second default rivals set at 11+ is refused)", !!(await throws(() => asService(`insert into sets (name, kind, entry_point, owner_scope, school_account_id, creator_kind, is_default) values ('d2','compared_against','11+','school','${LP}','smt', true)`))));
check("the curate helper answers by kind: the lead, SMT and the School-Admin; never another Admissions member", (await as("S", () => q(`select can_curate_sets('${LP}','compared_against') a, can_curate_sets('${LP}','feeders') b`))).rows[0].a === true
  && (await as("G", () => q(`select can_curate_sets('${LP}','feeders') b`))).rows[0].b === true
  && (await as("M", () => q(`select can_curate_sets('${LP}','feeders') b, can_curate_sets('${LP}','compared_against') a`))).rows.every((r) => r.a === false && r.b === false)
  && (await as("S", () => q(`select can_curate_sets('${LP}','feeders') b`))).rows[0].b === false
  && (await as("H", () => q(`select can_curate_sets('${LP}','feeders') b`))).rows[0].b === true
  && (await as("T", () => q(`select can_curate_sets('${LP}','compared_against') a`))).rows[0].a === false);

console.log("\n-- save_set: a set and its schools in one call, under the caller's RLS");
const saved = await throws(() => as("S", () => q(`select save_set(null, '{"name":"Close rivals","kind":"compared_against","entry_point":"11+","owner_scope":"school","school_account_id":"${LP}","creator_kind":"smt","focus_urn":"110110"}'::jsonb, '[{"urn":"117037"},{"urn":"100053"}]'::jsonb) id`)));
check("S saves a new compared-against school set with two schools", saved === false);
const closeId = (await q(`select id from sets where name = 'Close rivals'`)).rows[0]?.id;
check("  in the order given", (await q(`select array_agg(urn order by position) u from set_members where set_id = '${closeId}'`)).rows[0].u.join() === "117037,100053");
check("  S changes its schools and description in one call", (await throws(() => as("S", () => q(`select save_set('${closeId}', '{"description":"why"}'::jsonb, '[{"urn":"100053"}]'::jsonb)`)))) === false
  && (await q(`select array_agg(urn) u, max(s.description) d from set_members m join sets s on s.id = m.set_id where set_id = '${closeId}'`)).rows[0].u.join() === "100053");
check("  a null member list leaves the schools alone", (await throws(() => as("S", () => q(`select save_set('${closeId}', '{"name":"Close rivals 2"}'::jsonb, null)`)))) === false
  && (await q(`select count(*)::int n from set_members where set_id = '${closeId}'`)).rows[0].n === 1);
check("T can't change it through save_set", !!(await throws(() => as("T", () => q(`select save_set('${closeId}', '{"name":"mine now"}'::jsonb, '[]'::jsonb)`)))));
check("  nor make a school set through it", !!(await throws(() => as("T", () => q(`select save_set(null, '{"name":"x","kind":"compared_against","owner_scope":"school","school_account_id":"${LP}","creator_kind":"smt"}'::jsonb, '[]'::jsonb)`)))));
check("  a refused member write leaves nothing behind (atomic)", await (async () => {
  const n = (await q(`select count(*)::int n from sets`)).rows[0].n;
  await throws(() => as("S", () => q(`select save_set(null, '{"name":"bad","kind":"compared_against","owner_scope":"school","school_account_id":"${LP}","creator_kind":"smt"}'::jsonb, '[{"urn":"not-a-urn"}]'::jsonb)`)));
  return (await q(`select count(*)::int n from sets`)).rows[0].n === n;
})());
nAudit = (await audits()).length;
check("H tiers one day feeder through save_set: one audit row naming only that school", !(await throws(() => as("H", () => q(`select save_set('${dayId}', '{}'::jsonb, (select jsonb_agg(jsonb_build_object('urn', urn, 'tier', case when position = 1 then 'occasional' end) order by position) from set_members where set_id = '${dayId}'))`))))
  && (await audits()).length === nAudit + 1 && JSON.stringify((await audits()).at(-1).detail.retiered) === JSON.stringify([(await q(`select urn from set_members where set_id = '${dayId}' and position = 1`)).rows[0].urn]) && (await audits()).at(-1).detail.added.length === 0);
check("G tiers feeders through it", (await throws(() => as("G", () => q(`select save_set('${dayId}', '{}'::jsonb, (select jsonb_agg(jsonb_build_object('urn', urn, 'tier', case when position < 6 then 'main' end) order by position) from set_members where set_id = '${dayId}'))`)))) === false
  && (await q(`select count(*) filter (where tier = 'main')::int m, count(*)::int n from set_members where set_id = '${dayId}'`)).rows[0].m === 6);
check("anon can't call it", /permission denied/.test((await throws(() => asAnon(() => q(`select save_set(null, '{}'::jsonb, '[]'::jsonb)`)))) || ""));

console.log(`\n${fails ? `${fails} FAILED` : "ALL PASS"}`);
process.exit(fails ? 1 : 0);
