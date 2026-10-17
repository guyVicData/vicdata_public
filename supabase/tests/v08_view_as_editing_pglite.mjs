// VicData 0.8 View as, the editing half: guarantees 1 and 7 and R-EDIT-PUBLISH-ALL, in PGlite.
// Run from the repo root (tsx, because it drives the app's own store code in TypeScript):
//   npm i --no-save @electric-sql/pglite@0.2 && npx -y tsx supabase/tests/v08_view_as_editing_pglite.mjs
//
// Local only (WASM Postgres): applies the S1 + S2 migrations over a stub of the live schema
// they depend on (as v06_rls_pglite.mjs does), seeds the ten VicData dashboards with the REAL
// published configs (supabase/tests/fixtures/vicdata_published_configs_2026-10-17.json, read
// from lnhulykjlxmoneappnsp with one read-only select), and then runs the editor's own store
// calls -- src/lib/dashboards-store.ts loadDashboard / saveDraft / publish / listVersions and
// src/lib/published-vicdata.ts loadPublishedVicData -- through a small PostgREST-shaped client
// over PGlite that executes every call as `authenticated` with that person's
// request.jwt.claim.sub, so RLS and publish_dashboard decide exactly as they do live.
// Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { loadDashboard, saveDraft, publish, listVersions } from "../../src/lib/dashboards-store.ts";
import { loadPublishedVicData } from "../../src/lib/published-vicdata.ts";
import { changeSummary, publishBlockers, renamePanel } from "../../src/lib/editor-ops.ts";
import { DASHBOARDS } from "../../src/catalogue/dashboards/index.ts";

const repo = new URL("../migrations/", import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/vicdata_published_configs_2026-10-17.json", import.meta.url), "utf8"));
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
create table public.school_memberships (id uuid primary key default gen_random_uuid(), school_account_id uuid references public.school_accounts(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, status text default 'pending_verification', is_admin bool default false, role text default 'teacher' check (role in ('teacher','hod','smt','finance','admissions')), individual_tier_active bool, requested_at timestamptz, approved_at timestamptz, approved_by uuid, unique (school_account_id, profile_id));
create table public.vc_comparator_sets (id uuid primary key default gen_random_uuid(), name text);
create table public.vc_set_school_visibility (school_account_id uuid, vc_set_id uuid, primary key (school_account_id, vc_set_id));
create function public.is_member_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved') $$;
create function public.is_admin_of_school_account(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved' and is_admin) $$;
alter table public.school_memberships enable row level security;
create policy school_memberships_select_own_or_school on public.school_memberships for select using ((profile_id = auth.uid()) or is_member_of_school_account(school_account_id));
alter table public.school_accounts enable row level security;
create policy school_accounts_select_member on public.school_accounts for select using (is_member_of_school_account(id));
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
`);

// People. Guy is seeded as platform admin by S1 itself (by profile id); ADMIN2 is a second
// platform admin added with the exact statement docs/v0.8/view_as_editing_notes.md gives Guy.
const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const ADMIN2 = "00000000-0000-0000-0000-0000000000a2";
const SMT_OTHER = "00000000-0000-0000-0000-0000000000b1"; // SMT at Acland Burghley (a different school)
const SMT_LP = "00000000-0000-0000-0000-0000000000b2"; // SMT at Leighton Park
const TEACHER = "00000000-0000-0000-0000-0000000000c1"; // Teacher at Acland Burghley
const ADM = "00000000-0000-0000-0000-0000000000d1"; // Admissions at Acland Burghley
const LP = "33333333-3333-3333-3333-333333333333"; // Leighton Park's school account (URN 110110)
const AB = "11111111-1111-1111-1111-111111111111"; // Acland Burghley's (URN 100053)
await ex(`
insert into public.profiles (id, email, full_name) values
 ('${GUY}','guy@example.test','Guy'), ('${ADMIN2}','second.admin@example.test','Second admin'),
 ('${SMT_OTHER}','smt@ab.test','SMT AB'), ('${SMT_LP}','smt@lp.test','SMT LP'), ('${TEACHER}','t@ab.test','Teacher AB'), ('${ADM}','adm@ab.test','Admissions AB');
insert into public.schools (urn, current_name) values ('110110','Leighton Park School'), ('100053','Acland Burghley School');
insert into public.school_accounts (id, school_urn) values ('${LP}','110110'), ('${AB}','100053');
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
process.on("unhandledRejection", (e) => { console.log("ERROR", e?.message ?? e); process.exit(1); });
for (const f of ["20261103090000_v06_s1_roles_teams_platform.sql", "20261103100000_v06_s2_dashboards.sql"]) {
  await ex(readFileSync(repo + f, "utf8"));
  console.log("applied", f);
}
await ex(`grant all on all tables in schema public to authenticated, anon;`);
// The second-admin statement, exactly as given to Guy (run in the SQL editor / service role).
await ex(`insert into public.platform_admins (profile_id, note) select id, 'Platform admin, added by Guy' from public.profiles where email = 'second.admin@example.test' on conflict (profile_id) do nothing;`);
// Memberships, written as the service role (School-Admin-granted roles). ADMIN2 and Guy hold
// no membership anywhere: View as at Leighton Park is not a membership.
await ex(`select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into public.school_memberships (school_account_id, profile_id, status, roles) values
 ('${AB}','${SMT_OTHER}','approved', array['smt']), ('${LP}','${SMT_LP}','approved', array['smt']),
 ('${AB}','${TEACHER}','approved', array['teacher']), ('${AB}','${ADM}','approved', array['admissions']);
select set_config('request.jwt.claims', '', false);`);

let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (ok) passes++; else fails++; };

// ---------------------------------------------------------------- the client
// The PostgREST calls dashboards-store and published-vicdata make, as one person (uid), under
// RLS: from().select().eq().order().maybeSingle()/single()/await, insert/upsert/update/delete,
// rpc(), auth.getSession(). Each call is its own statement as `authenticated`.
const PK = { dashboard_drafts: ["dashboard_id"], dashboard_user_state: ["profile_id", "dashboard_id", "school_urn"] };
let lock = Promise.resolve();
function asUser(uid, fn) {
  const run = lock.then(async () => {
    await ex(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${uid}"}', false);`);
    try { return await fn(); } finally { await ex(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`); }
  });
  lock = run.catch(() => undefined);
  return run;
}
const val = (v) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
const iso = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
function client(uid) {
  const from = (table) => {
    const st = { op: "select", cols: "*", filters: [], orders: [], payload: null, returning: null, single: null };
    const exec = async () => {
      const params = [];
      const p = (v) => (params.push(val(v)), `$${params.length}`);
      const where = st.filters.length ? " where " + st.filters.map(([c, v, kind]) => (kind === "is" ? `${c} is null` : `${c} = ${p(v)}`)).join(" and ") : "";
      let sql;
      if (st.op === "select") sql = `select ${st.cols} from public.${table}${where}${st.orders.length ? " order by " + st.orders.map(([c, asc]) => `${c} ${asc ? "asc" : "desc"}`).join(", ") : ""}`;
      else if (st.op === "insert" || st.op === "upsert") {
        const rows = Array.isArray(st.payload) ? st.payload : [st.payload];
        const keys = Object.keys(rows[0]);
        sql = `insert into public.${table} (${keys.join(", ")}) values ${rows.map((r) => `(${keys.map((k) => p(r[k])).join(", ")})`).join(", ")}`;
        if (st.op === "upsert") sql += ` on conflict (${PK[table].join(", ")}) do update set ${keys.filter((k) => !PK[table].includes(k)).map((k) => `${k} = excluded.${k}`).join(", ")}`;
        if (st.returning) sql += ` returning ${st.returning}`;
      } else if (st.op === "update") sql = `update public.${table} set ${Object.keys(st.payload).map((k) => `${k} = ${p(st.payload[k])}`).join(", ")}${where}`;
      else if (st.op === "delete") sql = `delete from public.${table}${where}`;
      try {
        const res = await asUser(uid, () => q(sql, params));
        const rows = res.rows.map(iso);
        if (st.single === "maybe") return { data: rows[0] ?? null, error: rows.length > 1 ? { message: "multiple rows" } : null };
        if (st.single === "one") return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: `expected one row, got ${rows.length}` } };
        return { data: rows, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code } };
      }
    };
    const b = {
      select: (cols = "*") => { if (st.op === "select") st.cols = cols; else st.returning = cols; return b; },
      eq: (c, v) => (st.filters.push([c, v, "eq"]), b),
      is: (c) => (st.filters.push([c, null, "is"]), b),
      order: (c, o = {}) => (st.orders.push([c, o.ascending !== false]), b),
      insert: (row) => ((st.op = "insert"), (st.payload = row), b),
      upsert: (row) => ((st.op = "upsert"), (st.payload = row), b),
      update: (row) => ((st.op = "update"), (st.payload = row), b),
      delete: () => ((st.op = "delete"), b),
      maybeSingle: () => ((st.single = "maybe"), exec()),
      single: () => ((st.single = "one"), exec()),
      then: (ok, bad) => exec().then(ok, bad),
    };
    return b;
  };
  return {
    from,
    rpc: async (fn, args) => {
      const keys = Object.keys(args);
      try {
        const res = await asUser(uid, () => q(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, keys.map((k) => val(args[k]))));
        return { data: res.rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code } };
      }
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: uid } } } }) },
  };
}
const quiet = (fn) => async (...a) => { const w = console.warn; console.warn = () => {}; try { return await fn(...a); } finally { console.warn = w; } };
const loadPublished = quiet(loadPublishedVicData);

// ---------------------------------------------------------------- seed the ten dashboards
check("Guy is platform admin (S1 seed, by profile id)", (await asUser(GUY, () => q(`select is_platform_admin() v`))).rows[0].v === true);
check("second admin is platform admin (the one insert)", (await asUser(ADMIN2, () => q(`select is_platform_admin() v`))).rows[0].v === true);
check("an SMT member is not", (await asUser(SMT_OTHER, () => q(`select is_platform_admin() v`))).rows[0].v === false);

const ROLE = (slug) => (slug.startsWith("vicdata.smt.") ? "smt" : slug.startsWith("vicdata.admissions.") ? "admissions" : "teacher");
const ids = {};
for (const r of fixture.rows) {
  const d = (await asUser(GUY, () => q(`insert into dashboards (slug, owner_scope, name) values ($1, 'vicdata', $2) returning id`, [r.slug, r.name]))).rows[0].id;
  ids[r.slug] = d;
  // The seed: the published config, as live, as version 1 (published by Guy).
  await asUser(GUY, () => q(`select publish_dashboard($1, $2::jsonb, 'seed', 'Seeded from live, 17 Oct')`, [d, JSON.stringify(r.config)]));
  await asUser(GUY, () => q(`insert into dashboard_assignments (dashboard_id, target_kind, role, is_key) values ($1, 'role', $2, true)`, [d, ROLE(r.slug)]));
}
check("10 VicData dashboards seeded (Teacher 4, SMT 4, Admissions 2)", Object.keys(ids).length === 10 && fixture.rows.filter((r) => ROLE(r.slug) === "teacher").length === 4 && fixture.rows.filter((r) => ROLE(r.slug) === "smt").length === 4 && fixture.rows.filter((r) => ROLE(r.slug) === "admissions").length === 2);
const seededSame = (await q(`select bool_and(v.config = s.config::jsonb) ok from dashboard_versions v join dashboards d on d.id = v.dashboard_id join jsonb_to_recordset($1::jsonb) s(slug text, config text) on s.slug = d.slug`, [JSON.stringify(fixture.rows.map((r) => ({ slug: r.slug, config: JSON.stringify(r.config) })))])).rows[0].ok;
check("seeded versions equal the live configs", seededSame === true);

const versionOf = async (slug) => (await q(`select v.id, v.version, v.config::text as text, v.change_summary, v.created_by from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug = $1`, [slug])).rows[0];
const fallbackOf = (slug) => DASHBOARDS.find((d) => d.id === slug) ?? fixture.rows.find((r) => r.slug === slug).config;

// ---------------------------------------------------------------- guarantee 1: round trip
// Open in the editor (loadDashboard with its draft, as EditorScreen does), save the draft
// untouched (saveDraft, as the autosave and the Exit flush do), re-open (the editor then
// works from the draft), publish what it holds with the summary the dialog shows.
for (const r of fixture.rows) {
  const ed = client(GUY);
  const before = await versionOf(r.slug);
  const loaded = await loadDashboard(ed, r.slug, true);
  const working = loaded.draft ?? loaded.config;
  await saveDraft(ed, loaded.row.id, working, loaded.version?.id ?? null);
  const reopened = await loadDashboard(ed, r.slug, true);
  const draftRow = (await q(`select config::text t, updated_by from dashboard_drafts where dashboard_id = $1`, [loaded.row.id])).rows[0];
  const summary = changeSummary(reopened.version.config, reopened.draft);
  const blockers = publishBlockers(reopened.draft);
  await publish(ed, reopened.row.id, reopened.draft, undefined, summary);
  const after = await versionOf(r.slug);
  check(
    `G1 round trip ${r.slug}: v${before.version} -> v${after.version}, config byte-identical`,
    after.version === before.version + 1 && after.text === before.text && draftRow.t === before.text && summary === "No changes." && blockers.length === 0 && after.created_by === GUY,
    `summary="${summary}" blockers=${blockers.length} draft_by_guy=${draftRow.updated_by === GUY}`,
  );
  // And what members draw from it is the same config.
  const member = ROLE(r.slug) === "smt" ? SMT_OTHER : ROLE(r.slug) === "admissions" ? ADM : TEACHER;
  const drawn = await loadPublished(client(member), r.slug, fallbackOf(r.slug));
  const same = drawn.source === "store" && drawn.version === after.version && (await q(`select $1::jsonb = $2::jsonb ok`, [JSON.stringify(drawn.config), before.text])).rows[0].ok;
  check(`G1 ${r.slug}: a member draws v${after.version}, the same config`, same, `source=${drawn.source}${drawn.reason ? " " + drawn.reason : ""}`);
}
check("G1: no drafts left after publishing", (await q(`select count(*)::int n from dashboard_drafts`)).rows[0].n === 0);

// ---------------------------------------------------------------- guarantee 7: restore
{
  const slug = "vicdata.smt.context";
  const ed = client(GUY);
  const start = await versionOf(slug);
  const loaded = await loadDashboard(ed, slug, true);
  const wide = loaded.config.panels.find((p) => p.span?.cols === 2);
  const edited = renamePanel(loaded.config, wide.id, "Map and nearby (edited)");
  await saveDraft(ed, loaded.row.id, edited, loaded.version.id);
  await publish(ed, loaded.row.id, edited, undefined, changeSummary(loaded.config, edited));
  const changed = await versionOf(slug);
  // The History panel lists every version (newest first) to an editor...
  const list = await listVersions(ed, loaded.row.id);
  check("G7: earlier versions can be listed (editor sees the whole history, newest first)", list.map((v) => v.version).join(",") === [changed.version, start.version, start.version - 1].join(","), list.map((v) => `v${v.version}`).join(","));
  // ...and a member only the published one.
  const memberList = await listVersions(client(SMT_OTHER), loaded.row.id);
  check("G7: a member lists only the published version", memberList.map((v) => v.version).join(",") === String(changed.version));
  // Restore (HistoryPanel's onRestore: the old version's config becomes the draft), publish.
  const old = list.find((v) => v.version === start.version);
  const reopened = await loadDashboard(ed, slug, true);
  const restored = old.config;
  await saveDraft(ed, reopened.row.id, restored, reopened.version.id);
  await publish(ed, reopened.row.id, restored, undefined, changeSummary(reopened.config, restored));
  const back = await versionOf(slug);
  const v1 = (await q(`select v.config::text t from dashboard_versions v where v.dashboard_id = $1 and v.version = 1`, [loaded.row.id])).rows[0].t;
  check(
    `G7: restoring v${start.version} on SMT Context makes v${back.version}, byte-identical to it`,
    back.version === changed.version + 1 && back.text === start.text && back.text === v1 && changed.text !== start.text,
    `summary="${back.change_summary}"`,
  );
  check("G7: the versions in between are kept (immutable history)", (await q(`select count(*)::int n from dashboard_versions where dashboard_id = $1`, [loaded.row.id])).rows[0].n === back.version);
}

// ---------------------------------------------------------------- R-EDIT-PUBLISH-ALL
// The second platform admin, viewing as SMT at Leighton Park (View as is the browser's cookie
// and the editor's preview school; the client -- the session -- is the admin's own, which is
// all the store's writes take), edits SMT Overview and publishes. A different school's SMT
// member then loads the new version.
{
  const slug = "vicdata.smt.overview";
  const viewAs = { urn: "110110", name: "Leighton Park School", role: "smt" }; // only feeds the preview
  const ed = client(ADMIN2);
  const n = await versionOf(slug);
  const loaded = await loadDashboard(ed, slug, true);
  const wide = loaded.config.panels.find((p) => p.span?.cols === 2);
  const edited = renamePanel(loaded.config, wide.id, `Scorecard (edited in View as SMT at ${viewAs.name})`);
  await saveDraft(ed, loaded.row.id, edited, loaded.version.id);
  const draft = (await q(`select updated_by from dashboard_drafts where dashboard_id = $1`, [loaded.row.id])).rows[0];
  check("R-EDIT-PUBLISH-ALL: the draft is written as the admin (updated_by)", draft.updated_by === ADMIN2);
  check("R-EDIT-PUBLISH-ALL: the publish gate is clear and the summary names the change", publishBlockers(edited).length === 0 && /named a panel/i.test(changeSummary(loaded.config, edited)));
  const newId = await publish(ed, loaded.row.id, edited, undefined, changeSummary(loaded.config, edited));
  const n1 = await versionOf(slug);
  const row = (await q(`select published_version_id from dashboards where slug = $1`, [slug])).rows[0];
  check(`R-EDIT-PUBLISH-ALL: published as v${n1.version} = n+1 (n = ${n.version})`, n1.version === n.version + 1 && n1.id === newId);
  check("R-EDIT-PUBLISH-ALL: created_by is the admin's own uid", n1.created_by === ADMIN2);
  check("R-EDIT-PUBLISH-ALL: published_version_id moved to it", row.published_version_id === newId && n.id !== newId);
  check("R-EDIT-PUBLISH-ALL: no write names Leighton Park (no school-scoped row, no trial key)", (await q(`select count(*)::int n from dashboards where school_account_id is not null or owner_scope <> 'vicdata'`)).rows[0].n === 0);
  // A different school's SMT member (Acland Burghley) loads n+1 through the member path.
  const other = await loadPublished(client(SMT_OTHER), slug, fallbackOf(slug));
  check(`R-EDIT-PUBLISH-ALL: SMT at another school (Acland Burghley) loads v${other.version}`, other.source === "store" && other.version === n1.version && other.config.panels.find((p) => p.id === wide.id).name === `Scorecard (edited in View as SMT at ${viewAs.name})`);
  const lp = await loadPublished(client(SMT_LP), slug, fallbackOf(slug));
  check("R-EDIT-PUBLISH-ALL: SMT at Leighton Park loads the same version (one definition for all)", lp.source === "store" && lp.version === n1.version);
  check("R-EDIT-PUBLISH-ALL: RLS shows a member the new version only", (await asUser(SMT_OTHER, () => q(`select version from dashboard_versions where dashboard_id = $1`, [loaded.row.id]))).rows.map((r) => r.version).join() === String(n1.version));
  const t = await loadPublished(client(TEACHER), slug, fallbackOf(slug));
  check("R-EDIT-PUBLISH-ALL: a Teacher (not SMT) can't read the SMT dashboard (code copy fallback)", t.source === "code");
  // Members can't write: not a draft, not a version.
  const memberPublish = await client(SMT_OTHER).rpc("publish_dashboard", { p_dashboard: loaded.row.id, p_config: edited, p_label: null, p_summary: "x" });
  check("R-EDIT-PUBLISH-ALL: an SMT member can't publish", !!memberPublish.error && /not allowed/.test(memberPublish.error.message));
  const memberDraft = await client(SMT_LP).from("dashboard_drafts").upsert({ dashboard_id: loaded.row.id, config: edited, updated_by: SMT_LP });
  check("R-EDIT-PUBLISH-ALL: an SMT member can't write a draft (RLS)", !!memberDraft.error);
  // Platform admin is a role, not a person: Guy's session publishes on top just the same.
  const g = await loadDashboard(client(GUY), slug, true);
  await publish(client(GUY), g.row.id, g.config, undefined, changeSummary(g.config, g.config));
  check("R-EDIT-PUBLISH-ALL: either platform admin publishes (Guy then makes n+2)", (await versionOf(slug)).version === n.version + 2 && (await versionOf(slug)).created_by === GUY);
}

// The store's writes never consult View as: saveDraft and publish take only the session client.
{
  const src = readFileSync(new URL("../../src/lib/dashboards-store.ts", import.meta.url), "utf8");
  const body = (name) => src.slice(src.indexOf(`export async function ${name}(`), src.indexOf("\n}\n", src.indexOf(`export async function ${name}(`)));
  check("store: saveDraft / publish / listVersions don't read View as (no getActiveViewAs, stateKey or trial_key)", ["saveDraft", "publish", "listVersions"].every((f) => !/getActiveViewAs|stateKey|trial_key|stateUrn/.test(body(f))));
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL ${passes} PASSED`);
process.exit(fails ? 1 : 0);
