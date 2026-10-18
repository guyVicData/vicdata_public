// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_feedback_page_pglite.mjs
// VicData 0.8 SMT feedback round 2, section 6: 20261118090000_v08_feedback_page.sql over the live feedback schema
// (20261117100000_v08_feedback.sql, on the same stub of profiles and platform admins as v08_notes_feedback_pglite)
// with items already in it, as live. Local only (WASM Postgres); never touches a real database.
//   R-FEEDBACK-PAGE  a page item (no panel or view, view_key page:…) with area chips is taken, and the
//                    existing view items still are; areas are checked; a page item's shape is held; the new
//                    products ('home', 'dataview') are allowed; feedback_for_triage shows area and is_page;
//                    feedback_coverage counts the page apart from its views; RLS as before.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const FEEDBACK = readFileSync(`${repo}20261117100000_v08_feedback.sql`, "utf8");
const PAGE = readFileSync(`${repo}20261118090000_v08_feedback_page.sql`, "utf8");

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const MEMBER = "00000000-0000-0000-0000-0000000000b1";

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

const asUser = async (uid, fn) => {
  await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await ex(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
};
const refused = async (fn) => {
  try {
    await fn();
    return false;
  } catch (e) {
    return /permission denied|row-level security|violates check constraint|only a platform admin|can't be changed/i.test(e.message) ? true : e.message;
  }
};
const insert = (uid, o) => {
  const cols = Object.keys(o);
  return asUser(uid, () => q(`insert into public.feedback_items (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id, number`, Object.values(o)));
};
const VIEW = { product: "smt", school_urn: "110110", school_name: "Leighton Park School", dashboard_id: "vicdata.smt.overview", dashboard_name: "SMT Overview", panel_id: "p-large", view_instance_id: "v-score", dataview_id: "DV-SMT-O-SCORECARD", view_label: "Scorecard", view_key: "vicdata.smt.overview:p-large:v-score", body: "A view item", role: "smt", view_as: true };
const PAGE_ITEM = { product: "smt", school_urn: "110110", school_name: "Leighton Park School", dashboard_id: "vicdata.smt.overview", dashboard_name: "SMT Overview", view_key: "page:vicdata.smt.overview", body: "The set bar is hard to find", kinds: "{layout}", area: "{set_bar,level_pills}", role: "smt", view_as: true, page_path: "/teacher/smt", state: JSON.stringify({ set: "10 nearest with a sixth form or 16+ provision" }) };

// The live schema, with live-shaped items (F-1 to F-11 are all view items), before the page migration.
await ex(FEEDBACK);
await insert(GUY, VIEW);
await insert(GUY, { ...VIEW, panel_id: "p-now", view_instance_id: "v-now", dataview_id: "DV-SMT-O-NOW", view_label: "The school now", view_key: "vicdata.smt.overview:p-now:v-now", body: "", looks_good: true, kinds: "{looks_good}" });
const before = (await q(`select count(*)::int n from public.feedback_items`)).rows[0].n;

// ---------------------------------------------------------------------------- the migration
console.log("\n-- the migration");
await ex(PAGE);
await ex(PAGE);
check("it runs twice cleanly over live-shaped items, and changes none", (await q(`select count(*)::int n, bool_and(area = '{}') a from public.feedback_items`)).rows[0].n === before && (await q(`select bool_and(area = '{}') a from public.feedback_items`)).rows[0].a === true);

// ---------------------------------------------------------------------------- R-FEEDBACK-PAGE
console.log("\n-- R-FEEDBACK-PAGE");
const p1 = (await insert(GUY, PAGE_ITEM)).rows[0];
check("a page item with area chips is taken (no panel, view or dataview)", p1.number > 0);
const row = (await asUser(GUY, () => q(`select ref, is_page, area, panel_id, view_instance_id, dataview_id, view_key, state->>'set' set, is_open from public.feedback_for_triage where number = $1`, [p1.number]))).rows[0];
check("feedback_for_triage shows it as a page, with its areas and state", row.is_page === true && JSON.stringify(row.area) === JSON.stringify(["set_bar", "level_pills"]) && row.panel_id === null && row.view_instance_id === null && row.dataview_id === null && row.view_key === "page:vicdata.smt.overview" && row.set === "10 nearest with a sixth form or 16+ provision" && row.is_open === true, JSON.stringify(row));
check("view items still read as views", (await asUser(GUY, () => q(`select bool_and(not is_page) v from public.feedback_for_triage where panel_id is not null`))).rows[0].v === true);
check("a view item is still taken after the migration", (await insert(GUY, { ...VIEW, body: "Another" })).rows.length === 1);
check("an unknown area is refused", (await refused(() => insert(GUY, { ...PAGE_ITEM, area: "{colour}" }))) === true);
check("a page item must have a page key", (await refused(() => insert(GUY, { ...PAGE_ITEM, view_key: "vicdata.smt.overview::" }))) === true);
check("a view item can't carry areas", (await refused(() => insert(GUY, { ...VIEW, area: "{layout}" }))) === true);
check("a view item can't take a page key", (await refused(() => insert(GUY, { ...VIEW, view_key: "page:vicdata.smt.overview" }))) === true);
check("the role homes and the group home ('home') are a product", (await insert(GUY, { ...PAGE_ITEM, product: "home", dashboard_id: "home:smt", dashboard_name: "SMT home", view_key: "page:home:smt", page_path: "/teacher" })).rows.length === 1);
check("the Data View ('dataview') is a product", (await insert(GUY, { ...PAGE_ITEM, product: "dataview", dashboard_id: "dataview", dashboard_name: "Data View", view_key: "page:dataview", page_path: "/schools/110110/data" })).rows.length === 1);
check("an unknown product is still refused", (await refused(() => insert(GUY, { ...PAGE_ITEM, product: "website" }))) === true);
const cov = (await asUser(GUY, () => q(`select kind, view_key, state from public.feedback_coverage where dashboard_id = 'vicdata.smt.overview' and scope_id = '110110' order by view_key`))).rows;
check("feedback_coverage counts the page apart from its views", cov.find((r) => r.view_key === "page:vicdata.smt.overview")?.kind === "page" && cov.filter((r) => r.kind === "view").length === 2 && cov.find((r) => r.view_key.endsWith("v-now"))?.state === "looks good", JSON.stringify(cov));
// RLS as before: at "admins" a member can't send a page item, and reads none of Guy's.
check("RLS: at admins, a member's page item is refused", (await refused(() => insert(MEMBER, PAGE_ITEM))) === true);
check("RLS: a member reads none of Guy's items", (await asUser(MEMBER, () => q(`select count(*)::int n from public.feedback_for_triage`))).rows[0].n === 0);
check("an author can't change a page item's areas once sent", (await refused(() => asUser(GUY, () => q(`update public.feedback_items set area = '{other}' where number = $1`, [p1.number])))) === true);
check("a platform admin still triages a page item", (await asUser(GUY, () => q(`update public.feedback_items set status = 'triaged', type = 'design' where number = $1 returning status`, [p1.number]))).rows[0].status === "triaged");

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
