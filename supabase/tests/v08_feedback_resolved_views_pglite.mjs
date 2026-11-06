// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_feedback_resolved_views_pglite.mjs
// VicData 0.8 Admissions feedback round 2, items 3 and 4: 20261120090000_v08_feedback_resolved_views.sql over the
// live feedback schema (20261117100000_v08_feedback, 20261118090000_v08_feedback_page,
// 20261119090000_v08_feedback_deploy_gate), on the same stub of profiles and platform admins as the deploy gate's
// suite. Local only (WASM Postgres); never touches a real database.
//   R-FEEDBACK-RESOLVED-VIEWS  a platform admin's "Looks good" on any of a deployed item's resolved_views, at the
//                              same school after deployed_at, closes it (F-16, F-21: fixed by new views); one
//                              on an unrelated view, another school, before the deploy, or by a member doesn't;
//                              resolved_views is a triage field (a non-admin can't set it, a new item has none);
//                              feedback_for_triage has it, last.
//   R-FEEDBACK-FOLLOWS-VIEW    the insert check: an item whose state and page_query disagree on the dashboard,
//                              the entry point or the level is refused with the window's message (F-31: entry
//                              11+ recorded, entry=16%2B in the address); an address without the parameter, or
//                              a state without the key, says nothing.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const FEEDBACK = readFileSync(`${repo}20261117100000_v08_feedback.sql`, "utf8");
const PAGE = readFileSync(`${repo}20261118090000_v08_feedback_page.sql`, "utf8");
const GATE = readFileSync(`${repo}20261119090000_v08_feedback_deploy_gate.sql`, "utf8");
const RESOLVED = readFileSync(`${repo}20261120090000_v08_feedback_resolved_views.sql`, "utf8");

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const MEMBER = "00000000-0000-0000-0000-0000000000b1";
const BUILD = "abcabcabcabc";
const FIX = "fe16fe16fe16";

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
// The error itself (message and hint), or null if it went through.
const errorOf = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};
const insert = (uid, o) => {
  const cols = Object.keys(o);
  return as(uid, () => q(`insert into public.feedback_items (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`, Object.values(o)));
};
const D = "vicdata.admissions.pipelines";
const view = (panel, inst, label, over = {}) => ({ product: "admissions", school_urn: "110110", school_name: "Leighton Park School", dashboard_id: D, dashboard_name: "Pipelines", panel_id: panel, view_instance_id: inst, view_label: label, view_key: `${D}:${panel}:${inst}`, body: `On ${label}`, role: "admissions", view_as: true, ...over });
const lg = (panel, inst, over = {}) => view(panel, inst, inst, { body: "", looks_good: true, kinds: "{looks_good}", ...over });
const status = async (n) => (await q(`select status, resolved_views, checked_live_at, triaged_by, triaged_at from public.feedback_items where number = $1`, [n])).rows[0];
const deploy = async (numbers, views) => {
  await ex(`update public.feedback_items set status = 'fixed', resolved_commit = '${FIX}' where number in (${numbers.join(",")})`);
  if (views) await as(GUY, () => q(`update public.feedback_items set resolved_views = $1 where number in (${numbers.join(",")})`, [views]));
  await asService(() => q(`select public.record_app_build($1, $2, null)`, [BUILD, [BUILD, FIX]]));
};

// ---------------------------------------------------------------------------- the live schema, with items
await ex(FEEDBACK);
await ex(PAGE);
await ex(GATE);
// F-1 F-16-like: "add a girls and boys graph" on the cohort view; F-2 F-21-like on Shape and size; F-3 an
// unrelated item; F-4 at another school; F-5 kept for the before-deploy case; F-6 kept for the member's case.
await insert(GUY, view("c1.trends", "cohort", "Your cohort"));
await insert(GUY, view("c1.shape", "shape", "Shape and size"));
await insert(GUY, view("c2.funnel", "funnel", "Why did our intake change?"));
await insert(GUY, view("c1.trends", "cohort", "Your cohort", { school_urn: "137625", school_name: "The Chase" }));
await insert(GUY, view("c1.trends", "cohort", "Your cohort"));
await insert(GUY, view("c1.trends", "cohort", "Your cohort"));
const before = (await q(`select count(*)::int n from public.feedback_items`)).rows[0].n;

console.log("\n-- the migration");
await ex(RESOLVED);
await ex(RESOLVED);
check("it runs twice cleanly and adds no items", (await q(`select count(*)::int n from public.feedback_items`)).rows[0].n === before);
check("existing items get resolved_views '{}' (not null)", (await q(`select bool_and(resolved_views = '{}') ok from public.feedback_items`)).rows[0].ok === true);
const cols = (await q(`select column_name from information_schema.columns where table_name = 'feedback_for_triage' order by ordinal_position`)).rows.map((r) => r.column_name);
check("feedback_for_triage: resolved_views appended last; the deploy gate's columns keep their places", cols.at(-1) === "resolved_views" && cols.indexOf("is_page") === cols.length - 7 && cols.slice(-6, -1).join() === "deployed_at,deployed_build,checked_live_at,follows_up,follows_up_ref" && cols[0] === "ref", cols.slice(-8).join());
check("resolved_views is a triage field", (await q(`select 'resolved_views' = any (public.feedback_items_triage_columns()) ok`)).rows[0].ok === true);

// ---------------------------------------------------------------------------- R-FEEDBACK-RESOLVED-VIEWS
console.log("\n-- R-FEEDBACK-RESOLVED-VIEWS: who sets it");
const created = (await insert(GUY, { ...view("c1.trends", "cohort", "Your cohort"), resolved_views: `{${D}:c9:sneaked}` })).rows[0];
check("a new item starts with none, whatever was sent", created.resolved_views.length === 0, JSON.stringify(created.resolved_views));
await ex(`update public.app_settings set value = '"all"' where key = 'feedback_audience'`);
const own = (await insert(MEMBER, view("c1.trends", "cohort", "Your cohort", { body: "A member's item" }))).rows[0];
const memberOwn = await errorOf(() => as(MEMBER, () => q(`update public.feedback_items set resolved_views = $1 where id = $2`, [[`${D}:c1.trends:sex`], own.id])));
const memberOwnRow = (await q(`select resolved_views from public.feedback_items where id = $1`, [own.id])).rows[0];
check("a non-admin can't set resolved_views, even on their own item", memberOwnRow.resolved_views.length === 0, memberOwn?.message ?? "no error, row unchanged");
const memberOther = await as(MEMBER, () => q(`update public.feedback_items set resolved_views = $1 where number = 1`, [[`${D}:c1.trends:sex`]]));
check("a non-admin's update of another item reaches no row (RLS)", memberOther.affectedRows === 0 && (await status(1)).resolved_views.length === 0);
const anon = await errorOf(async () => {
  await ex(`set role anon;`);
  try {
    await q(`update public.feedback_items set resolved_views = '{x}' where number = 1`);
  } finally {
    await ex(`reset role;`);
  }
});
check("anon can't touch it", !!anon && /permission denied/i.test(anon.message), anon?.message);
const set = (await as(GUY, () => q(`update public.feedback_items set resolved_views = $1 where number = 1 returning resolved_views, triaged_by, triaged_at`, [[` ${D}:c1.trends:sex `, `${D}:c1.trends:sex`, "", `${D}:c1.trends:cohort`, `${D}:c1.shape:share`]]))).rows[0];
check("a platform admin sets it: trimmed, no blanks or repeats, never the item's own view, in order", JSON.stringify(set.resolved_views) === JSON.stringify([`${D}:c1.trends:sex`, `${D}:c1.shape:share`]), JSON.stringify(set.resolved_views));
check("setting it counts as triage (triaged_by and triaged_at stamped)", set.triaged_by === GUY && set.triaged_at !== null);
check("an admin still can't change what was recorded alongside it", !!(await errorOf(() => as(GUY, () => q(`update public.feedback_items set resolved_views = '{a}', body = 'x' where number = 1`)))));
check("feedback_for_triage shows it", JSON.stringify((await as(GUY, () => q(`select resolved_views from public.feedback_for_triage where number = 1`))).rows[0].resolved_views) === JSON.stringify([`${D}:c1.trends:sex`, `${D}:c1.shape:share`]));
check("a member reads only their own items in feedback_for_triage, as before", (await as(MEMBER, () => q(`select count(*)::int n from public.feedback_for_triage`))).rows[0].n === 1);
check("scripts/feedback-set-fixed.sh --view's update (as the CLI runs it) adds, keeps what was there, and skips done items", await (async () => {
  const sql = (list) => `update public.feedback_items set resolved_views = array(select distinct v from unnest(resolved_views || array[${list}]::text[]) v order by v) where number in (3, 1) and status not in ('done', 'wont_do')`;
  await ex(`update public.feedback_items set status = 'done' where number = 3`);
  await ex(sql(`'${D}:c2.funnel:funnel','${D}:c1.trends:sex'`));
  await ex(sql(`'${D}:c2.funnel:funnel'`));
  const r1 = (await status(1)).resolved_views;
  const r3 = (await status(3)).resolved_views;
  // Back as it was, for the checks below.
  await q(`update public.feedback_items set status = 'new', resolved_views = $1 where number = 1`, [[`${D}:c1.trends:sex`, `${D}:c1.shape:share`]]);
  await ex(`update public.feedback_items set status = 'new' where number = 3`);
  return JSON.stringify(r1) === JSON.stringify([`${D}:c1.shape:share`, `${D}:c1.trends:sex`, `${D}:c2.funnel:funnel`]) && r3.length === 0;
})());

console.log("\n-- R-FEEDBACK-RESOLVED-VIEWS: the live check");
// F-1 (cohort; resolved: the new girls-and-boys view) and F-2 (Shape and size; resolved: a new share view).
await deploy([1, 2]);
await as(GUY, () => q(`update public.feedback_items set resolved_views = $1 where number = 2`, [[`${D}:c1.shape:share1115`]]));
check("both are deployed", (await status(1)).status === "deployed" && (await status(2)).status === "deployed");
await insert(GUY, lg("c2.funnel", "funnel"));
check("a Looks good on an unrelated view doesn't close it", (await status(1)).status === "deployed" && (await status(2)).status === "deployed");
await insert(GUY, lg("c1.trends", "sex", { school_urn: "137625", school_name: "The Chase" }));
check("a Looks good on a resolved view at another school doesn't close it", (await status(1)).status === "deployed");
await insert(MEMBER, lg("c1.trends", "sex"));
check("a member's Looks good on a resolved view doesn't close it", (await status(1)).status === "deployed");
const g1 = (await insert(GUY, lg("c1.trends", "sex"))).rows[0];
const s1 = await status(1);
check("a platform admin's Looks good on a resolved view (same school, after the deploy) closes it, stamped", s1.status === "done" && s1.checked_live_at?.getTime() === g1.created_at.getTime(), JSON.stringify(s1));
check("…and only the items that name that view: F-2 (another resolved view) stays deployed", (await status(2)).status === "deployed");
await insert(GUY, lg("c1.shape", "share1115"));
check("F-2 closes on its own resolved view", (await status(2)).status === "done");
// Before deployed_at: F-5 deployed "in the future" relative to the Looks good.
await deploy([5], [`${D}:c1.trends:sex`]);
await ex(`select set_config('vicdata.feedback_auto', 'on', false); update public.feedback_items set deployed_at = now() + interval '1 hour' where number = 5; select set_config('vicdata.feedback_auto', '', false);`);
await insert(GUY, lg("c1.trends", "sex"));
check("a Looks good on a resolved view before deployed_at doesn't close it", (await status(5)).status === "deployed");
// The item's own view still closes it, resolved views or not.
await deploy([6], [`${D}:c1.trends:sex`]);
await insert(GUY, lg("c1.trends", "cohort"));
check("its own view still closes it (as the deploy gate)", (await status(6)).status === "done");
check("a text item on a resolved view doesn't close anything", await (async () => {
  await ex(`select set_config('vicdata.feedback_auto', 'on', false); update public.feedback_items set status = 'deployed', deployed_at = now() - interval '1 minute' where number = 4; select set_config('vicdata.feedback_auto', '', false);`);
  await as(GUY, () => q(`update public.feedback_items set resolved_views = $1 where number = 4`, [[`${D}:c1.trends:sex`]]));
  await insert(GUY, view("c1.trends", "sex", "sex", { school_urn: "137625", school_name: "The Chase", body: "Still wrong" }));
  const mid = (await status(4)).status;
  await insert(GUY, lg("c1.trends", "sex", { school_urn: "137625", school_name: "The Chase" }));
  return mid === "deployed" && (await status(4)).status === "done";
})());

// ---------------------------------------------------------------------------- the insert check (item 3)
console.log("\n-- R-FEEDBACK-FOLLOWS-VIEW: the insert check");
const f31 = { ...view("c1.trends", "cohort", "Your cohort, girls and boys"), body: "Why did our intake change? at 16+", page_path: "/teacher/admissions", state: { dashboard: "pipelines", entry: "11+", rivals: null }, page_query: "view=pipelines&entry=16%2B" };
const e31 = await errorOf(() => insert(GUY, f31));
check("F-31 as sent (entry 11+ recorded, entry=16%2B in the address) is refused", !!e31 && /entry point 11\+ is recorded, but the address says 16\+/.test(e31.message), e31?.message);
check("…with the window's message and the hint the route reads", !!e31 && e31.message === "This item's settings don't match its address: entry point 11+ is recorded, but the address says 16+. Nothing was sent. Move the window to the view on screen and send again." && (e31.hint === undefined || e31.hint === "feedback_state_mismatch"), `${e31?.message} / ${e31?.hint}`);
const e31hint = e31?.hint;
if (e31hint !== undefined) check("the hint is feedback_state_mismatch", e31hint === "feedback_state_mismatch", e31hint);
check("nothing was recorded", (await q(`select count(*)::int n from public.feedback_items where body = 'Why did our intake change? at 16+'`)).rows[0].n === 0);
const eDash = await errorOf(() => insert(GUY, { ...f31, state: { dashboard: "market-share", entry: "16+" } }));
check("a dashboard that disagrees (market-share recorded, view=pipelines) is refused", !!eDash && /dashboard market-share is recorded, but the address says pipelines/.test(eDash.message), eDash?.message);
const eLevel = await errorOf(() => insert(GUY, { product: "smt", school_urn: "110110", dashboard_id: "vicdata.smt.overview", panel_id: "p", view_key: "vicdata.smt.overview:p:v", body: "x", state: { level: "gcse", area: null }, page_query: "level=post16" }));
check("an SMT level that disagrees (gcse recorded, level=post16) is refused", !!eLevel && /level gcse is recorded, but the address says post16/.test(eLevel.message), eLevel?.message);
const ok16 = await errorOf(() => insert(GUY, { ...f31, state: { dashboard: "pipelines", entry: "16+" }, body: "B at 16+" }));
check("the same item at 16+ (state and address agree) is taken", ok16 === null, ok16?.message);
const okRaw = await errorOf(() => insert(GUY, { ...f31, state: { dashboard: "pipelines", entry: "16+" }, page_query: "view=pipelines&entry=16+", body: "raw plus" }));
check("an address with a bare '+' (typed by hand) still agrees with 16+", okRaw === null, okRaw?.message);
const okNoParam = await errorOf(() => insert(GUY, { product: "smt", school_urn: "110110", dashboard_id: "vicdata.smt.overview", panel_id: "p", view_key: "vicdata.smt.overview:p:v", body: "remembered level", state: { level: "gcse" }, page_query: "" }));
check("an address without the parameter (SMT's remembered level) says nothing", okNoParam === null, okNoParam?.message);
const okNoState = await errorOf(() => insert(GUY, { ...f31, state: {}, body: "no state" }));
check("a state without the key (or the deploy gate's items, with no state) says nothing", okNoState === null, okNoState?.message);
const okOther = await errorOf(() => insert(GUY, { ...f31, state: { dashboard: "pipelines", entry: "11+" }, page_query: "view=pipelines&entry=11%2B&fbItem=F-3&lookAs=110110", body: "11+ agrees" }));
check("A at 11+ with its own address (the window's 'send as it was') is taken", okOther === null, okOther?.message);
check("a page item is checked the same way", !!(await errorOf(() => insert(GUY, { product: "admissions", school_urn: "110110", dashboard_id: D, view_key: `page:${D}`, body: "page", state: { dashboard: "pipelines", entry: "11+" }, page_query: "view=pipelines&entry=16%2B" }))));
check("the address is decoded as URLSearchParams writes it (%C3%A9, +, %2B)", (await q(`select public.feedback_query_param('a=caf%C3%A9&b=x+y&c=16%2B', 'a') a, public.feedback_query_param('a=caf%C3%A9&b=x+y&c=16%2B', 'b') b, public.feedback_query_param('a=caf%C3%A9&b=x+y&c=16%2B', 'c') c, public.feedback_query_param('a=1', 'z') z`)).rows.every((r) => r.a === "café" && r.b === "x y" && r.c === "16+" && r.z === null));
check("a malformed escape doesn't break the insert", (await q(`select public.feedback_url_decode('%E2%28') v`)).rows[0].v !== undefined);

// ---------------------------------------------------------------------------- permissions
console.log("\n-- permissions");
const fns = ["feedback_items_triage_columns", "feedback_items_on_insert", "feedback_items_on_update", "feedback_items_live_check", "feedback_url_decode", "feedback_query_param", "feedback_state_mismatch"];
const sp = (await q(`select bool_and(proconfig::text like '%search_path=public%') ok, string_agg(proname, ',') filter (where proconfig is null) missing from pg_proc where proname = any ($1)`, [fns])).rows[0];
check("every function the migration creates or replaces has a fixed search_path", sp.ok === true, sp.missing);
const priv = (await q(`select
  has_function_privilege('anon', 'public.feedback_items_live_check()', 'execute') la,
  has_function_privilege('authenticated', 'public.feedback_items_live_check()', 'execute') lu,
  (select prosecdef from pg_proc where proname = 'feedback_items_live_check') ldef,
  has_function_privilege('anon', 'public.feedback_state_mismatch(jsonb, text)', 'execute') ma,
  has_function_privilege('authenticated', 'public.feedback_state_mismatch(jsonb, text)', 'execute') mu,
  (select reloptions::text from pg_class where relname = 'feedback_for_triage') topt,
  has_table_privilege('anon', 'public.feedback_for_triage', 'select') ta`)).rows[0];
check("feedback_items_live_check: security definer, no execute for anon or authenticated (as the deploy gate)", priv.ldef === true && !priv.la && !priv.lu, JSON.stringify(priv));
check("the insert check's helpers: no anon execute; authenticated can (the trigger runs as the sender)", !priv.ma && priv.mu, JSON.stringify(priv));
check("feedback_for_triage: still security_invoker, no anon read", /security_invoker=true/.test(priv.topt) && !priv.ta, JSON.stringify(priv));
check("deployed still can't be set by hand", !!(await errorOf(() => as(GUY, () => q(`update public.feedback_items set status = 'deployed' where number = 3`)))));
check("feedback_deploy_gaps still reads (it is built on feedback_for_triage)", (await as(GUY, () => q(`select count(*)::int n from public.feedback_deploy_gaps`))).rows[0].n >= 0);

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
