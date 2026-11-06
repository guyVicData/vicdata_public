// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_feedback_deploy_gate_pglite.mjs
// VicData 0.8 feedback deploy gate: 20261119090000_v08_feedback_deploy_gate.sql over the live feedback schema
// (20261117100000_v08_feedback.sql + 20261118090000_v08_feedback_page.sql) holding the 6 Nov items as live:
// F-1 to F-11 done (41c4d26, 030d546), F-12 to F-21 planned "deploy 6bddb6d" (F-15 since done), F-22 new,
// F-23 and F-26 triaged. Local only (WASM Postgres); never touches a real database.
//   R-FEEDBACK-STATUSES     fixed -> deployed -> done; open (the icon yellow) until done; the backfill moves
//                           F-12 to F-21 to fixed once, and a second run changes nothing.
//   R-FEEDBACK-PROMOTE      a new build holding an item's commit moves it to deployed; one without leaves it.
//   R-FEEDBACK-DEPLOY-GAPS  the 6 Nov case (done at 6bddb6d, live build 030d546) is listed; once the live
//                           build holds 6bddb6d it isn't.
//   R-FEEDBACK-LIVE-CHECK   a platform admin's "Looks good" on the same view and school after deployed_at
//                           closes the item; one before deployed_at, on another school, or by a member doesn't.
//   plus: RLS on app_builds and record_app_build; "deployed" can't be set by hand; follows_up.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const FEEDBACK = readFileSync(`${repo}20261117100000_v08_feedback.sql`, "utf8");
const PAGE = readFileSync(`${repo}20261118090000_v08_feedback_page.sql`, "utf8");
const GATE = readFileSync(`${repo}20261119090000_v08_feedback_deploy_gate.sql`, "utf8");

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const MEMBER = "00000000-0000-0000-0000-0000000000b1";
// 12-character shas, as the build writes them.
const C_030 = "030d546fef79";
const C_6BD = "6bddb6dbe91e";
const C_41C = "41c4d26aaaaa";
const OLDER = ["0aaaaaaaaaaa", "0bbbbbbbbbbb"];

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok || !detail ? "" : ` -- ${detail}`}`);
};

const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
create table public.profiles (id uuid primary key, email text not null, full_name text);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create table public.platform_admins (profile_id uuid primary key references public.profiles (id));
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.platform_admins where profile_id = auth.uid()) $$;
insert into public.profiles values ('${GUY}', 'guy@example.test', 'Guy'), ('${MEMBER}', 'm@example.test', 'A Member');
insert into public.platform_admins values ('${GUY}');
`);

const as = async (uid, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await ex(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
};
const asService = async (fn) => {
  await ex(`set role service_role;`);
  try {
    return await fn();
  } finally {
    await ex(`reset role;`);
  }
};
const refused = async (fn) => {
  try {
    await fn();
    return false;
  } catch (e) {
    return /permission denied|row-level security|violates check constraint|only a platform admin|can't be changed|set by the live build/i.test(e.message) ? true : e.message;
  }
};
const insert = (uid, o) => {
  const cols = Object.keys(o);
  return as(uid, () => q(`insert into public.feedback_items (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id, number, created_at`, Object.values(o)));
};
const view = (n) => ({ product: "admissions", school_urn: "110110", school_name: "Leighton Park School", dashboard_id: "vicdata.admissions.pipelines", dashboard_name: "Pipelines", panel_id: `p${n}`, view_instance_id: `v${n}`, dataview_id: `DV-${n}`, view_label: `View ${n}`, view_key: `vicdata.admissions.pipelines:p${n}:v${n}`, body: `Item ${n}`, role: "admissions", view_as: true });
const status = async (n) => (await q(`select status, resolved_commit, deployed_build, deployed_at, checked_live_at, follows_up from public.feedback_items where number = $1`, [n])).rows[0];
const statuses = async (from, to) => (await q(`select number, status from public.feedback_items where number between $1 and $2 order by number`, [from, to])).rows.map((r) => r.status);

// ---------------------------------------------------------------------------- the 6 Nov state, as live
await ex(FEEDBACK);
await ex(PAGE);
// F-15, F-23, F-24, F-25 and F-26 are on one view (Shape and size), as live.
for (let n = 1; n <= 26; n++) await insert(GUY, { ...view(n >= 23 ? 15 : n), body: `Item ${n}` });
await ex(`update public.feedback_items set status = 'done', resolved_commit = case when number <= 6 then '41c4d26' else '030d546' end where number <= 11`);
await ex(`update public.feedback_items set status = 'planned', planned_version = 'deploy 6bddb6d', resolved_commit = '6bddb6d' where number between 12 and 21`);
await ex(`update public.feedback_items set status = 'done', planned_version = null, resolved_at = now() where number in (15, 24)`);
await ex(`update public.feedback_items set status = 'triaged', planned_version = '0.8 fb gate', triage_note = '6 Nov: F-23 and F-26 are one request.' where number in (23, 26)`);
const before = (await q(`select count(*)::int n from public.feedback_items`)).rows[0].n;

// ---------------------------------------------------------------------------- the migration, twice
console.log("\n-- the migration and its backfill");
await ex(GATE);
const after1 = await statuses(12, 21);
const notes1 = (await q(`select number, triage_note, follows_up from public.feedback_items where number in (15, 17, 22, 23, 26) order by number`)).rows;
await ex(GATE);
const after2 = await statuses(12, 21);
const notes2 = (await q(`select number, triage_note, follows_up from public.feedback_items where number in (15, 17, 22, 23, 26) order by number`)).rows;
check("it runs twice cleanly and adds no items", (await q(`select count(*)::int n from public.feedback_items`)).rows[0].n === before);
check("R-FEEDBACK-STATUSES: the backfill moves F-12 to F-21 (still planned) to fixed at 6bddb6d; F-15, already done, is left", JSON.stringify(after1) === JSON.stringify(["fixed", "fixed", "fixed", "done", "fixed", "fixed", "fixed", "fixed", "fixed", "fixed"]), JSON.stringify(after1));
check("R-FEEDBACK-STATUSES: their resolved_commit is 6bddb6d and resolved_at 30 Oct", (await q(`select bool_and(resolved_commit = '6bddb6d' and resolved_at::date = '2026-10-30') ok from public.feedback_items where number between 12 and 21 and number <> 15`)).rows[0].ok === true);
check("R-FEEDBACK-STATUSES: running it again changes nothing (statuses, notes, links)", JSON.stringify(after1) === JSON.stringify(after2) && JSON.stringify(notes1) === JSON.stringify(notes2));
check("F-1 to F-11 stay done", (await statuses(1, 11)).every((s) => s === "done"));
const n = Object.fromEntries(notes2.map((r) => [r.number, r]));
const id = async (num) => (await q(`select id from public.feedback_items where number = $1`, [num])).rows[0].id;
check("scope rule: F-17's and F-15's notes gain one 'Not covered:' line each", (n[17].triage_note.match(/Not covered:/g) ?? []).length === 1 && (n[15].triage_note.match(/Not covered:/g) ?? []).length === 1);
check("scope rule: F-22 follows up F-17 and is triaged; F-23 and F-26 follow up F-15", n[22].follows_up === (await id(17)) && (await status(22)).status === "triaged" && n[23].follows_up === (await id(15)) && n[26].follows_up === (await id(15)));
const fr = (await as(GUY, () => q(`select ref, follows_up_ref, deployed_at, deployed_build, checked_live_at from public.feedback_for_triage where number = 22`))).rows[0];
check("feedback_for_triage shows follows_up_ref and the new columns (appended)", fr.follows_up_ref === "F-17" && "deployed_build" in fr && "checked_live_at" in fr);
const cols = (await q(`select column_name from information_schema.columns where table_name = 'feedback_for_triage' order by ordinal_position`)).rows.map((r) => r.column_name);
check("feedback_for_triage's existing columns keep their places; the new ones are at the end", cols.indexOf("is_page") === cols.length - 6 && cols.slice(-5).join() === "deployed_at,deployed_build,checked_live_at,follows_up,follows_up_ref" && cols[0] === "ref", cols.slice(-7).join());
check("an item is still open (icon yellow) while fixed", (await as(GUY, () => q(`select is_open from public.feedback_for_triage where number = 12`))).rows[0].is_open === true);

// ---------------------------------------------------------------------------- R-FEEDBACK-DEPLOY-GAPS
console.log("\n-- R-FEEDBACK-DEPLOY-GAPS (the 6 Nov case)");
// The live build on 6 Nov: 030d546, before 6bddb6d. Items "done" at 6bddb6d (as the round 1 report's step 4 left them).
await asService(() => q(`select public.record_app_build($1, $2, null)`, [C_030, [C_030, C_41C, ...OLDER]]));
await ex(`select set_config('vicdata.feedback_auto', 'on', false); update public.feedback_items set status = 'done' where number between 12 and 21 and number <> 15; select set_config('vicdata.feedback_auto', '', false);`);
const gaps6 = (await as(GUY, () => q(`select number, gap, live_build from public.feedback_deploy_gaps order by number`))).rows;
check("the 6 Nov case is listed: F-12 to F-21 done at 6bddb6d, live build 030d546", JSON.stringify(gaps6.map((r) => r.number)) === JSON.stringify([12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) && gaps6.every((r) => r.gap === "not in the live build" && r.live_build === C_030), JSON.stringify(gaps6));
check("F-1 to F-11 (in the live build) aren't", !gaps6.some((r) => r.number <= 11));
await asService(() => q(`select public.record_app_build($1, $2, null)`, [C_6BD, [C_6BD, C_030, C_41C, ...OLDER]]));
const gapsNow = (await as(GUY, () => q(`select number from public.feedback_deploy_gaps`))).rows;
check("once the live build holds 6bddb6d, none is listed", gapsNow.length === 0, JSON.stringify(gapsNow));
check("a member reads no gaps and no builds (RLS)", (await as(MEMBER, () => q(`select count(*)::int n from public.feedback_deploy_gaps`))).rows[0].n === 0 && (await as(MEMBER, () => q(`select count(*)::int n from public.app_builds`))).rows[0].n === 0);
check("a fixed item older than 48 hours, not deployed, is listed", await (async () => {
  await ex(`update public.feedback_items set status = 'fixed', resolved_commit = 'deadbee', resolved_at = now() - interval '3 days' where number = 13`);
  const r = (await as(GUY, () => q(`select gap from public.feedback_deploy_gaps where number = 13`))).rows;
  await ex(`update public.feedback_items set resolved_at = now() - interval '1 day' where number = 13`);
  const r2 = (await as(GUY, () => q(`select gap from public.feedback_deploy_gaps where number = 13`))).rows;
  return r.length === 1 && r[0].gap === "fixed, not deployed after 48 hours" && r2.length === 0;
})());
// A rollback: the older build starting again is the live build once more.
await asService(() => q(`select public.record_app_build($1, null, null)`, [C_030]));
check("a rollback (030d546 starts again) makes it the live build, and the gap shows again", (await as(GUY, () => q(`select count(*)::int n from public.feedback_deploy_gaps where gap = 'not in the live build'`))).rows[0].n === 9);
check("a build recorded again without a list keeps its first list", (await q(`select cardinality(commits) n from public.app_builds where commit = $1`, [C_030])).rows[0].n === 4);
await asService(() => q(`select public.record_app_build($1, null, null)`, [C_6BD]));

// ---------------------------------------------------------------------------- R-FEEDBACK-PROMOTE
console.log("\n-- R-FEEDBACK-PROMOTE");
// Back to the backfilled state: F-12 to F-21 fixed at 6bddb6d.
await ex(`update public.feedback_items set status = 'fixed', resolved_commit = '6bddb6d', resolved_at = '2026-10-30T09:11:59Z' where number between 12 and 21 and number <> 15`);
const moved0 = (await asService(() => q(`select public.record_app_build($1, $2, null) n`, [C_030, [C_030, C_41C]]))).rows[0].n;
check("a build without the commit (030d546) leaves them fixed, and moves none", moved0 === 0 && (await statuses(12, 21)).filter((s) => s === "fixed").length === 9);
const moved = (await asService(() => q(`select public.record_app_build($1, $2, '2026-11-06T10:40:00Z') n`, ["777777777777", ["777777777777", C_6BD, C_030]]))).rows[0].n;
const s12 = await status(12);
check("a new build holding 6bddb6d moves F-12 to F-21 to deployed, and says how many", moved === 9 && (await statuses(12, 21)).filter((s) => s === "deployed").length === 9, `moved ${moved}`);
check("deployed is stamped with deployed_at and the build", s12.deployed_build === "777777777777" && s12.deployed_at !== null);
check("it is idempotent: the same build again moves none", (await asService(() => q(`select public.record_app_build($1, $2, null) n`, ["777777777777", ["777777777777", C_6BD]]))).rows[0].n === 0);
check("the server's move isn't anyone's triage (triaged_by and triaged_at kept)", (await q(`select triaged_at from public.feedback_items where number = 12`)).rows[0].triaged_at.getTime() < s12.deployed_at.getTime());
check("a short commit (7) matches the build's 12-character list, and a 6-character one never does", (await q(`select public.build_has_commit('6bddb6d', 'x', array['${C_6BD}']) a, public.build_has_commit('6bddb6', 'x', array['${C_6BD}']) b`)).rows[0].a === true && (await q(`select public.build_has_commit('6bddb6', 'x', array['${C_6BD}']) b`)).rows[0].b === false);
check("a member can't record a build", (await refused(() => as(MEMBER, () => q(`select public.record_app_build('${C_6BD}', null, null)`)))) === true);
check("a platform admin can't record a build from the client either", (await refused(() => as(GUY, () => q(`select public.record_app_build('${C_6BD}', null, null)`)))) === true);
check("nobody writes app_builds from the client", (await refused(() => as(GUY, () => q(`insert into public.app_builds (commit) values ('abcdef1')`)))) === true);
check("a platform admin reads app_builds", (await as(GUY, () => q(`select count(*)::int n from public.app_builds`))).rows[0].n === 3);
check("'deployed' can't be set by hand, even by a platform admin", (await refused(() => as(GUY, () => q(`update public.feedback_items set status = 'deployed' where number = 22`)))) === true);
check("a platform admin sets fixed with a commit (the report's step), and resolved_at is stamped", (await as(GUY, () => q(`update public.feedback_items set status = 'fixed', resolved_commit = 'abc1234' where number = 22 returning status, resolved_at`))).rows[0].resolved_at !== null);
check("still open while deployed (the icon stays yellow until done)", (await as(GUY, () => q(`select is_open from public.feedback_for_triage where number = 12`))).rows[0].is_open === true);

// ---------------------------------------------------------------------------- R-FEEDBACK-LIVE-CHECK
console.log("\n-- R-FEEDBACK-LIVE-CHECK");
const lg = (n, over = {}) => ({ ...view(n), body: "", looks_good: true, kinds: "{looks_good}", ...over });
// Before deployed_at: F-14 deployed "in the future" relative to the Looks good.
await ex(`select set_config('vicdata.feedback_auto', 'on', false); update public.feedback_items set deployed_at = now() + interval '1 hour' where number = 14; select set_config('vicdata.feedback_auto', '', false);`);
await insert(GUY, lg(14));
check("a Looks good before deployed_at doesn't close it", (await status(14)).status === "deployed");
await insert(GUY, lg(16, { school_urn: "137625", school_name: "The Chase" }));
check("a Looks good on another school doesn't close it", (await status(16)).status === "deployed");
await ex(`update public.app_settings set value = '"all"' where key = 'feedback_audience'`);
await insert(MEMBER, lg(16));
check("a member's Looks good doesn't close it (a platform admin's check only)", (await status(16)).status === "deployed");
await insert(GUY, { ...view(18), body: "Still wrong" });
check("an item that isn't a Looks good doesn't close it", (await status(18)).status === "deployed");
const lg16 = (await insert(GUY, lg(16))).rows[0];
const s16 = await status(16);
check("a platform admin's Looks good on the same view and school after deployed_at closes it (done, checked_live_at stamped)", s16.status === "done" && s16.checked_live_at?.getTime() === lg16.created_at.getTime(), JSON.stringify(s16));
check("done is no longer open (the icon leaves yellow)", (await as(GUY, () => q(`select is_open from public.feedback_for_triage where number = 16`))).rows[0].is_open === false);
check("other views' deployed items are untouched", (await status(17)).status === "deployed" && (await status(12)).status === "deployed");
const cl = (await as(GUY, () => q(`update public.feedback_items set status = 'done' where number = 17 returning status, checked_live_at`))).rows[0];
check("the inbox's Checked live: done, with the date stamped", cl.status === "done" && cl.checked_live_at !== null);
check("a page item's Looks good closes the page's deployed item", await (async () => {
  const p = (await insert(GUY, { product: "smt", school_urn: "110110", dashboard_id: "vicdata.smt.overview", view_key: "page:vicdata.smt.overview", body: "Set bar" })).rows[0];
  await ex(`update public.feedback_items set status = 'fixed', resolved_commit = '${C_6BD}' where id = '${p.id}'`);
  await asService(() => q(`select public.record_app_build('888888888888', $1, null)`, [["888888888888", C_6BD]]));
  const mid = (await q(`select status from public.feedback_items where id = $1`, [p.id])).rows[0].status;
  await insert(GUY, { product: "smt", school_urn: "110110", dashboard_id: "vicdata.smt.overview", view_key: "page:vicdata.smt.overview", body: "", looks_good: true, kinds: "{looks_good}" });
  const end = (await q(`select status, deployed_at, checked_live_at from public.feedback_items where id = $1`, [p.id])).rows[0];
  if (process.env.DEBUG) console.log(mid, end);
  return mid === "deployed" && end.status === "done";
})());
check("coverage still counts a Looks good as checked", (await as(GUY, () => q(`select state from public.feedback_coverage where view_key = 'vicdata.admissions.pipelines:p16:v16' and scope_id = '137625'`))).rows[0].state === "looks good");

// ---------------------------------------------------------------------------- permissions (the advisor's checks)
console.log("\n-- permissions");
const asAnon = async (fn) => {
  await ex(`set role anon;`);
  try {
    return await fn();
  } finally {
    await ex(`reset role;`);
  }
};
check("anon can't call record_app_build", (await refused(() => asAnon(() => q(`select public.record_app_build('${C_6BD}', null, null)`)))) === true);
check("an authenticated non-admin caller of record_app_build is refused", (await refused(() => as(MEMBER, () => q(`select public.record_app_build('${C_6BD}', null, null)`)))) === true);
check("an authenticated admin client can't set 'deployed' directly", (await refused(() => as(GUY, () => q(`update public.feedback_items set status = 'deployed' where number = 26`)))) === true);
check("an admin client can't set 'deployed' even with the server's flag set", (await refused(() => as(GUY, () => ex(`select set_config('vicdata.feedback_auto', 'on', false); update public.feedback_items set status = 'deployed' where number = 26;`)))) === true);
await ex(`select set_config('vicdata.feedback_auto', '', false)`);
// A non-admin's update reaches no row (RLS: feedback_items_update_admin), and the trigger would refuse it anyway.
const memberFixed = await as(MEMBER, () => q(`update public.feedback_items set status = 'fixed', resolved_commit = 'abc1234' where number = 26`));
const memberDeployed = await as(MEMBER, () => q(`update public.feedback_items set status = 'deployed' where number = 26`));
check("a non-admin client can't set 'fixed' or 'deployed' (RLS: no row reached; the item unchanged)", memberFixed.affectedRows === 0 && memberDeployed.affectedRows === 0 && (await status(26)).status === "triaged", JSON.stringify([memberFixed.affectedRows, memberDeployed.affectedRows, (await status(26)).status]));
check("the server role can: record_app_build moves a fixed item to deployed", await (async () => {
  await ex(`update public.feedback_items set status = 'fixed', resolved_commit = 'abcdef123456' where number = 26`);
  const n = (await asService(() => q(`select public.record_app_build('999999999999', $1, null) n`, [["999999999999", "abcdef123456"]]))).rows[0].n;
  return n === 1 && (await status(26)).status === "deployed";
})());
const priv = (await q(`select
  has_function_privilege('anon', 'public.record_app_build(text, text[], timestamptz)', 'execute') fa,
  has_function_privilege('authenticated', 'public.record_app_build(text, text[], timestamptz)', 'execute') fu,
  has_function_privilege('service_role', 'public.record_app_build(text, text[], timestamptz)', 'execute') fs,
  has_function_privilege('anon', 'public.feedback_items_live_check()', 'execute') la,
  has_function_privilege('authenticated', 'public.feedback_items_live_check()', 'execute') lu,
  (select prosecdef from pg_proc where proname = 'record_app_build') def,
  (select proconfig::text from pg_proc where proname = 'record_app_build') cfg,
  (select proconfig::text from pg_proc where proname = 'feedback_items_live_check') lcfg,
  has_table_privilege('anon', 'public.app_builds', 'select') ta,
  has_table_privilege('authenticated', 'public.app_builds', 'insert') ti,
  has_table_privilege('authenticated', 'public.app_builds', 'update') tu,
  has_table_privilege('authenticated', 'public.app_builds', 'delete') td,
  (select relrowsecurity from pg_class where relname = 'app_builds') rls,
  has_table_privilege('anon', 'public.feedback_deploy_gaps', 'select') ga,
  (select reloptions::text from pg_class where relname = 'feedback_deploy_gaps') gopt,
  (select reloptions::text from pg_class where relname = 'feedback_for_triage') topt`)).rows[0];
check("record_app_build: security definer, fixed search_path, execute for service_role only (not anon, not authenticated)", priv.def === true && /search_path=public/.test(priv.cfg) && !priv.fa && !priv.fu && priv.fs, JSON.stringify(priv));
check("feedback_items_live_check: fixed search_path, no execute for anon or authenticated", /search_path=public/.test(priv.lcfg) && !priv.la && !priv.lu, JSON.stringify(priv));
check("app_builds: RLS on, no anon read, no client insert, update or delete", priv.rls === true && !priv.ta && !priv.ti && !priv.tu && !priv.td, JSON.stringify(priv));
check("feedback_deploy_gaps and feedback_for_triage: security_invoker, no anon read", /security_invoker=true/.test(priv.gopt) && /security_invoker=true/.test(priv.topt) && !priv.ga, JSON.stringify(priv));

// ---------------------------------------------------------------------------- the rest
console.log("\n-- the rest");
check("an unknown status is still refused", (await refused(() => as(GUY, () => q(`update public.feedback_items set status = 'shipped' where number = 22`)))) === true);
check("an item can't follow itself up", (await refused(() => as(GUY, () => q(`update public.feedback_items set follows_up = id where number = 22`)))) === true);
check("an author still can't change what was recorded", (await refused(() => as(GUY, () => q(`update public.feedback_items set body = 'x' where number = 22`)))) === true);
check("a member still can't triage (no row reached)", (await as(MEMBER, () => q(`update public.feedback_items set status = 'triaged' where number = 26`))).affectedRows === 0 && (await status(26)).status === "deployed");
check("a new item starts with the deploy fields empty", await (async () => {
  const r = (await as(GUY, () => q(`insert into public.feedback_items (product, school_urn, dashboard_id, panel_id, view_key, body, deployed_at, deployed_build, follows_up) values ('smt', '110110', 'd', 'p', 'd:p:v', 'x', now(), 'zzz', null) returning deployed_at, deployed_build`))).rows[0];
  return r.deployed_at === null && r.deployed_build === null;
})());

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
