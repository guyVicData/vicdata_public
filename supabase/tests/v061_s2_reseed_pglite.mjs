// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v061_s2_reseed_pglite.mjs
// (or point PGLITE_PATH at an installed copy's dist/index.js).
// 0.6.1 S2, the re-seed (D9). Local only (WASM Postgres), never a real database: stubs the
// live schema the 0.6 migrations need, applies S1 / S2 / hardening / S4 / S7 / S6 / snag-2 as
// live has them, seeds the four Teacher dashboards in v1 exactly as 0.6 S3 did
// (scripts/dashboards-seed-sql.ts --legacy-v1), adds a v1 meeting with a text slide and a v1
// custom dashboard, then runs the re-seed (scripts/dashboards-seed-sql.ts) twice. Checks:
// each Teacher dashboard publishes a NEW version in schema_version 2 over its v1 (which stays,
// immutable), running it again publishes nothing, only old-format drafts are cleared, and the
// meeting, the custom dashboard and members' state are untouched.
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

// 1. Live as it is today: the v1 seed of the four Teacher dashboards.
await ex(tsx("scripts/dashboards-seed-sql.ts", "--legacy-v1"));
const SLUGS = ["vicdata.ks4.candidates", "vicdata.ks4.results", "vicdata.ks5.candidates", "vicdata.ks5.results"];
check("the v1 seed: four dashboards, each on version 1 in schema_version 1",
  (await n(`select count(*)::int n from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug like 'vicdata.%' and v.version = 1 and v.schema_version = 1 and v.config->>'schema_version' = '1'`)) === 4);

// Guy's meeting, "Autumn department meeting", with a view slide and a text-box slide (v1), and
// a v1 custom dashboard of a teacher's own; a v1 draft and a v2 draft on two Teacher dashboards;
// a member's per-user state.
const view = { id: "slot-v/DV-C2-CUR-BARS", kind: "view", dataview: "DV-C2-CUR-BARS", pinned: { year: "2024/25", subject: "History" }, keepLive: false };
const meeting = {
  schema_version: 1, id: "m", name: "Autumn department meeting", kind: "presentation", owner: "user", colour: { key: "neutral" },
  layout: { preset: "1", tracks: [1], accordion: "independent" }, columns: [], rows: [], panels: [],
  presentation: { meetingDate: "2026-10-20", slides: [
    { id: "s1", title: "History results", layout: "auto", slots: [{ id: "a", view }] },
    { id: "s2", title: "Actions", layout: "1+text", slots: [{ id: "t", text: "1. Revisit the Year 11 mocks\n2. Share with SLT" }] },
  ] },
};
const custom = {
  schema_version: 1, id: "c", name: "My History board", kind: "dashboard", owner: "user", colour: { key: "ks4" },
  layout: { preset: "1", tracks: [1], accordion: "auto-close" },
  columns: [{ id: "c1", title: "Results", icon: "results", data: { data: "academic.results", phase: "ks4", results: "pill" }, focus: { kind: "subject", subject: { mode: "follow-chips" } }, compare: null }],
  rows: [{ id: "r1", name: "Current", time: "latest", openByDefault: true }],
  panels: [{ id: "p1", row: "r1", column: "c1", dataviews: [{ id: "p1/DV-C1-RES-CUR-TILES", kind: "view", dataview: "DV-C1-RES-CUR-TILES", params: { tiles: [{ figure: "category" }] }, resultsMeasures: ["points"] }], defaultView: "p1/DV-C1-RES-CUR-TILES" }],
};
await q(`insert into dashboards (id, kind, owner_scope, owner_profile_id, name, meeting_date) values ('aaaaaaaa-0000-0000-0000-0000000000a1','presentation','user','${GUY}','Autumn department meeting','2026-10-20'), ('aaaaaaaa-0000-0000-0000-0000000000a2','dashboard','user','${A}','My History board',null)`);
await q(`insert into dashboard_versions (id, dashboard_id, version, schema_version, config, label) values ('bbbbbbbb-0000-0000-0000-0000000000b1','aaaaaaaa-0000-0000-0000-0000000000a1',1,1,$1,'Created'), ('bbbbbbbb-0000-0000-0000-0000000000b2','aaaaaaaa-0000-0000-0000-0000000000a2',1,1,$2,'Created')`, [meeting, custom]);
await q(`update dashboards set published_version_id = 'bbbbbbbb-0000-0000-0000-0000000000b1' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'`);
await q(`update dashboards set published_version_id = 'bbbbbbbb-0000-0000-0000-0000000000b2' where id = 'aaaaaaaa-0000-0000-0000-0000000000a2'`);
await q(`insert into dashboard_drafts (dashboard_id, config) select id, '{"schema_version":1,"name":"old draft"}'::jsonb from dashboards where slug = 'vicdata.ks4.candidates'`);
await q(`insert into dashboard_drafts (dashboard_id, config) select id, '{"schema_version":2,"name":"new draft"}'::jsonb from dashboards where slug = 'vicdata.ks5.results'`);
await q(`insert into dashboard_user_state (dashboard_id, profile_id, school_urn, state) select id, '${A}', '100053', '{"version":"1","panels":{"vicdata.ks4.results.c1.trends":{"open":true,"view":"vicdata.ks4.results.c1.trends/DV-C1-RES-TR-TABLE"}}}'::jsonb from dashboards where slug = 'vicdata.ks4.results'`).catch((e) => console.log("(no user state row:", e.message, ")"));
const others = async () => JSON.stringify((await q(`select d.id, d.published_version_id, v.config from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug is null order by d.id`)).rows);
const othersBefore = await others();
const stateBefore = JSON.stringify((await q(`select * from dashboard_user_state`).catch(() => ({ rows: [] }))).rows);

// 2. The re-seed.
const reseed = tsx("scripts/dashboards-seed-sql.ts");
await ex(reseed);
const code = JSON.parse(tsx("-e", "import { DASHBOARDS } from './src/catalogue/dashboards'; console.log(JSON.stringify(DASHBOARDS.filter((d) => d.owner === 'vicdata')))"));
const published = async () => (await q(`select d.slug, d.published_version_id, v.version, v.schema_version, v.config, v.label from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug like 'vicdata.%' order by d.slug`)).rows;
const after1 = await published();
check("each Teacher dashboard now publishes version 2", after1.length === 4 && after1.every((r) => r.version === 2), JSON.stringify(after1.map((r) => [r.slug, r.version])));
check("in schema_version 2 (row and config)", after1.every((r) => r.schema_version === 2 && r.config.schema_version === 2));
// jsonb keeps its own key order, so compare canonical forms.
const canon = (x) => (Array.isArray(x) ? `[${x.map(canon).join(",")}]` : x && typeof x === "object" ? `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canon(x[k])}`).join(",")}}` : JSON.stringify(x));
check("each published config is the code copy", SLUGS.every((s) => canon(after1.find((r) => r.slug === s)?.config) === canon(code.find((d) => d.id === s))));
check("every view instance carries its preset's spec, same ids as v1", after1.every((r) => r.config.panels.every((p) => p.dataviews.every((v) => v.kind !== "view" || (v.spec?.preset === v.dataview && v.id === `${p.id}/${v.dataview}`)))));
check("the v1 versions are kept (immutable)", (await n(`select count(*)::int n from dashboard_versions v join dashboards d on d.id = v.dashboard_id where d.slug like 'vicdata.%' and v.version = 1 and v.schema_version = 1`)) === 4);
check("the old-format draft is cleared", (await n(`select count(*)::int n from dashboard_drafts x join dashboards d on d.id = x.dashboard_id where d.slug = 'vicdata.ks4.candidates'`)) === 0);
check("a draft already in the new format is kept", (await n(`select count(*)::int n from dashboard_drafts x join dashboards d on d.id = x.dashboard_id where d.slug = 'vicdata.ks5.results'`)) === 1);
check("the meeting and the custom dashboard are untouched", (await others()) === othersBefore);
check("the meeting still has its text-box slide", (await q(`select v.config from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.name = 'Autumn department meeting'`)).rows[0].config.presentation.slides[1].slots[0].text.startsWith("1. Revisit"));
check("members' state rows are untouched", JSON.stringify((await q(`select * from dashboard_user_state`).catch(() => ({ rows: [] }))).rows) === stateBefore);
check("one key Teacher assignment each", (await n(`select count(*)::int n from dashboard_assignments a join dashboards d on d.id = a.dashboard_id where d.slug like 'vicdata.%' and a.role = 'teacher' and a.is_key`)) === 4);

// 3. Idempotent: again publishes nothing.
const versionsBefore = await n(`select count(*)::int n from dashboard_versions`);
await ex(reseed);
const after2 = await published();
check("running it twice publishes no new version", (await n(`select count(*)::int n from dashboard_versions`)) === versionsBefore);
check("and the published pointers don't move", JSON.stringify(after2.map((r) => r.published_version_id)) === JSON.stringify(after1.map((r) => r.published_version_id)));
check("still one assignment each, one group each", (await n(`select count(*)::int n from dashboard_assignments`)) === 4 && (await n(`select count(*)::int n from dashboard_groups where slug like 'vicdata.%'`)) === 2);

// 4. On an empty database the re-seed alone seeds the four in v2 (version 1).
const fresh = new PGlite();
await fresh.exec(`create table public.dashboard_groups (id uuid primary key default gen_random_uuid(), slug text unique, label text, owner_scope text);
create table public.dashboards (id uuid primary key default gen_random_uuid(), slug text unique, kind text, owner_scope text, name text, group_id uuid, group_order int, published_version_id uuid, updated_at timestamptz default now());
create table public.dashboard_versions (id uuid primary key default gen_random_uuid(), dashboard_id uuid, version int, schema_version int, config jsonb, label text, change_summary text, unique (dashboard_id, version));
create table public.dashboard_drafts (dashboard_id uuid primary key, config jsonb);
create table public.dashboard_assignments (id uuid primary key default gen_random_uuid(), dashboard_id uuid, target_kind text, role text, mode text, is_key bool);`);
await fresh.exec(reseed);
check("on an empty database it seeds the four at version 1, schema_version 2", (await fresh.query(`select count(*)::int n from dashboards d join dashboard_versions v on v.id = d.published_version_id where v.version = 1 and v.schema_version = 2`)).rows[0].n === 4);

console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
