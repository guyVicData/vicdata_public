// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_admissions_fb1_republish_pglite.mjs
// (or point PGLITE_PATH at an installed copy's dist/index.js).
// 0.8 Admissions feedback round 1: the republish of the two Admissions dashboards only
// (scripts/dashboards-seed-sql.ts --only). Local only (WASM Postgres), never a real database: the same
// stub schema and 0.6 migrations as v061_s2_reseed_pglite.mjs, seeds every VicData dashboard as live
// has them, then stands in for live's state on 29 Oct 2026 -- the Admissions dashboards on an older
// config, and GCSE Results on an editor version (version 16 live) the code copy doesn't have -- and
// runs the --only republish twice. Checks: the two Admissions dashboards publish one new version each,
// equal to the code copy, with the round's label; every other dashboard's pointer and versions are
// untouched (the editor's GCSE Results stays published); a second run publishes nothing; role
// assignments and groups unchanged; an unknown slug is refused.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const { PGlite } = await import(process.env.PGLITE_PATH ?? "@electric-sql/pglite");
const root = new URL("../../", import.meta.url).pathname;
const repo = root + "supabase/migrations/";
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
const tsx = (...args) => execFileSync("npx", ["-y", "tsx", ...args], { cwd: root, encoding: "utf8", maxBuffer: 1e8 });

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const A = "00000000-0000-0000-0000-00000000000a";
const S1 = "11111111-1111-1111-1111-111111111111";

await ex(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table public.profiles (id uuid primary key, email text, full_name text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.schools (urn text primary key, current_name text, establishment_type_group text, establishment_type text, website text);
create table public.school_accounts (id uuid primary key default gen_random_uuid(), school_urn text unique, account_holder_membership_id uuid, pending_account_holder_membership_id uuid, tier text default 'individual', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid references public.school_accounts(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, status text default 'pending_verification', is_admin bool default false, role text default 'teacher' check (role in ('teacher','hod','smt','finance','admissions')), individual_tier_active bool, requested_at timestamptz, approved_at timestamptz, approved_by uuid, unique (school_account_id, profile_id));
create table public.vc_comparator_sets (id uuid primary key default gen_random_uuid(), name text);
create table public.vc_set_school_visibility (school_account_id uuid, vc_set_id uuid, primary key (school_account_id, vc_set_id));
create function public.is_member_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved') $$;
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved' and is_admin) $$;
alter table public.school_memberships enable row level security;
create policy school_memberships_delete_admin_or_holder on public.school_memberships for delete using (is_admin_of_school_account(school_account_id));
create policy school_memberships_insert_own on public.school_memberships for insert with check (profile_id = auth.uid());
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
create policy school_memberships_update_admin_or_holder on public.school_memberships for update using (is_admin_of_school_account(school_account_id));
alter table public.school_accounts enable row level security;
create policy school_accounts_select_all on public.school_accounts for select using (true);
create policy school_accounts_insert_authenticated on public.school_accounts for insert with check (auth.uid() is not null);
-- The old Meetings tables, as live (audit C §7.1), for the S7 migration.
create table public.meetings (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, name text not null, meeting_date date, delete_by date not null, created_at timestamptz default now());
create table public.meeting_slides (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.meetings(id) on delete cascade, position int not null, chart_key text not null, caption text, unique (meeting_id, position));
alter table public.meetings enable row level security;
alter table public.meeting_slides enable row level security;
create policy meetings_own on public.meetings for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy meeting_slides_own on public.meeting_slides for all using (meeting_id in (select id from public.meetings where profile_id = auth.uid()));
-- The Teacher view's own tables, as live (audit C §6), for the snag-2 migration.
create table public.teacher_view_preferences (profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, phase text not null check (phase = any (array['ks2','ks4','ks5'])), subjects jsonb not null default '[]', columns jsonb not null default '{}', last_seen_period int, updated_at timestamptz, primary key (profile_id, school_urn, phase));
create table public.teacher_view_notes (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, chart_key text not null, body text not null, created_at timestamptz default now(), updated_at timestamptz, unique (profile_id, school_urn, chart_key));
create table public.teacher_view_onboarding (profile_id uuid not null references public.profiles(id) on delete cascade, school_urn text not null, phase text not null, completed_at timestamptz default now(), primary key (profile_id, school_urn, phase));
create table public.recruitment_jobs (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, title text not null, subject text, ks_stage text, delete_by date not null, created_at timestamptz default now());
-- Supabase's storage schema (what the S6 icons migration touches).
create schema storage;
create table storage.buckets (id text primary key, name text not null unique, owner uuid, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid(), metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
insert into public.profiles (id, full_name) values ('${GUY}','Guy'), ('${A}','Teacher A');
insert into public.schools values ('100053','Acland Burghley School','Local authority maintained schools','Community school',null);
insert into public.school_accounts (id, school_urn) values ('${S1}','100053');
insert into public.school_memberships (school_account_id, profile_id, status, is_admin, role) values ('${S1}','${A}','approved',false,'teacher');
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
for (const f of [
  "20261103090000_v06_s1_roles_teams_platform.sql",
  "20261103100000_v06_s2_dashboards.sql",
  "20261104090000_v06_membership_insert_hardening.sql",
  "20261104100000_v06_s4_view_requests.sql",
  "20261104110000_v06_s7_meetings_migration.sql",
  "20261104130000_v06_s6_dashboard_icons.sql",
  "20261105090000_v06_snag2_trials.sql",
]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const n = async (sql) => (await q(sql)).rows[0].n;

const ONLY = "vicdata.admissions.pipelines,vicdata.admissions.market-share";
const ADM = ONLY.split(",");

// 1. Every VicData dashboard seeded as today's seed publishes it.
await ex(tsx("scripts/dashboards-seed-sql.ts"));
// 2. Live's state: the Admissions dashboards on an older config (a version with an old title and no
// new views), and an editor's version of GCSE Results.
for (const slug of ADM) await q(`with d as (select id, published_version_id p from dashboards where slug = $1),
  v as (insert into dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary)
    select d.id, (select max(version) from dashboard_versions x where x.dashboard_id = d.id) + 1, 2,
      jsonb_set((select config from dashboard_versions where id = d.p), '{name}', '"older live copy"'), 'Seed (0.7 admissions r2)', 'older' from d returning id, dashboard_id)
  update dashboards set published_version_id = v.id from v where dashboards.id = v.dashboard_id`, [slug]);
await q(`with d as (select id, published_version_id p from dashboards where slug = 'vicdata.ks4.results'),
  v as (insert into dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary, created_by)
    select d.id, (select max(version) from dashboard_versions x where x.dashboard_id = d.id) + 1, 2,
      jsonb_set((select config from dashboard_versions where id = d.p), '{name}', '"GCSE Results (Guy''s edit)"'), 'Edited', 'an editor publish', '${GUY}' from d returning id, dashboard_id)
  update dashboards set published_version_id = v.id from v where dashboards.id = v.dashboard_id`);
const snapshot = async () => (await q(`select d.slug, d.published_version_id::text p, (select count(*)::int from dashboard_versions v where v.dashboard_id = d.id) n from dashboards d where d.slug like 'vicdata.%' order by 1`)).rows;
const assignments = async () => (await q(`select count(*)::int n from dashboard_assignments`)).rows[0].n;
const groupsN = async () => (await q(`select count(*)::int n from dashboard_groups`)).rows[0].n;
const before = await snapshot();
const [a0, g0] = [await assignments(), await groupsN()];

// 3. The republish.
const sql = tsx("scripts/dashboards-seed-sql.ts", "--only", ONLY);
check("the SQL names only the two Admissions dashboards", (sql.match(/insert into public\.dashboard_versions/g) ?? []).length === 2 && !/vicdata\.(ks4|ks5|smt)\./.test(sql));
await ex(sql);
const after = await snapshot();
const changed = after.filter((r) => before.find((b) => b.slug === r.slug).p !== r.p).map((r) => r.slug).sort();
check("only the two Admissions dashboards move", JSON.stringify(changed) === JSON.stringify([...ADM].sort()), JSON.stringify(changed));
check("each publishes one new version", ADM.every((s) => after.find((r) => r.slug === s).n === before.find((r) => r.slug === s).n + 1));
const CODE = JSON.parse(tsx("-e", "import { ADMISSIONS_DASHBOARDS } from './src/catalogue/dashboards/admissions'; console.log(JSON.stringify(ADMISSIONS_DASHBOARDS))"));
for (const d of CODE) {
  const row = (await q(`select v.config, v.label from dashboards x join dashboard_versions v on v.id = x.published_version_id where x.slug = $1`, [d.id])).rows[0];
  check(`${d.id}: the published config is the code copy, labelled for the round`, (await q(`select $1::jsonb = $2::jsonb ok`, [JSON.stringify(row.config), JSON.stringify(d)])).rows[0].ok && row.label === "Republish (0.8 Admissions fb1)");
}
const views = (await q(`select jsonb_path_query_array(v.config, '$.panels[*].dataviews[*].dataview') a from dashboards x join dashboard_versions v on v.id = x.published_version_id where x.slug = 'vicdata.admissions.pipelines'`)).rows[0].a;
check("Pipelines now holds Local births and girls and boys", views.includes("DV-ADM-P-BIRTHS") && views.includes("DV-ADM-P-ENTRY-SEX") && views.indexOf("DV-ADM-P-BIRTHS") === views.indexOf("DV-ADM-P-FUNNEL") + 1);
const mviews = (await q(`select jsonb_path_query_array(v.config, '$.panels[*].dataviews[*].dataview') a from dashboards x join dashboard_versions v on v.id = x.published_version_id where x.slug = 'vicdata.admissions.market-share'`)).rows[0].a;
check("Market share's Trends rail ends with the share of Years 7-11", mviews.at(-1) === "DV-ADM-M-SHARE-BAND");
check("the editor's GCSE Results stays published", (await q(`select v.config->>'name' n from dashboards x join dashboard_versions v on v.id = x.published_version_id where x.slug = 'vicdata.ks4.results'`)).rows[0].n === "GCSE Results (Guy's edit)");
check("role assignments and groups unchanged", (await assignments()) === a0 && (await groupsN()) === g0);
// 4. Twice: nothing more.
await ex(tsx("scripts/dashboards-seed-sql.ts", "--only", ONLY));
check("running it again publishes nothing", JSON.stringify(await snapshot()) === JSON.stringify(after));
// 5. A slug the catalogue doesn't hold is refused.
let refused = false;
try { tsx("scripts/dashboards-seed-sql.ts", "--only", "vicdata.admissions.nope"); } catch { refused = true; }
check("an unknown slug is refused", refused);

console.log(fails ? `FAILED ${fails}` : "ALL PASS");
process.exit(fails ? 1 : 0);
