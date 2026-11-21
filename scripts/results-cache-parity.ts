// Speed plan §4.2 item 2: parity for the shared results cache, against the live data, read-only.
//
//   npm i --no-save @electric-sql/pglite@0.2
//   npx tsx --env-file=.env --env-file=.env.local scripts/results-cache-parity.ts OUT_DIR
//   PARITY_ONLY='^(smt/school|chooser/)' ... the same, only the requests whose names match (a regex)
//
// For real requests (Leighton Park 110110 and George Dixon 138695: SMT Overview, Academic, Pupils,
// Context and its map against the nearest set and the big ranking sets; Admissions' four views at
// 110110; Teacher's dashboard and home), through the same functions the routes call
// (src/lib/cached-views/, one module per view), with the inputs resolved as the routes resolve them:
//   1. a first process, the cache ON over a local PGlite stand-in for public.results_cache (the
//      migration applied; never the live table): each answer is built cold and stored; then the cache
//      OFF: each built again; the two JSONs must be equal byte for byte;
//   2. a FRESH process, the cache ON over the same PGlite files: every answer must come from the store
//      (L2), none built, and equal the first process's cache-off JSON byte for byte.
// The data version is the live one (production's stamps and the school sync); the code version is a
// stand-in (a dev checkout has no build-info.json). Every answer is stored here (minimum build time 0)
// so every route's answer is checked, not only the slow ones. Reads the live databases only: the
// school's lists and catchment through the service role, as a platform admin's peek does.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { liveVersions, resultsCacheStats, setResultsCacheForTests, viewKeyPattern, type ResultsStore, type Versions } from "../src/lib/results-cache";
import { cachedSmtSchool } from "../src/lib/cached-views/smt-school";
import { cachedOverview } from "../src/lib/cached-views/smt-overview";
import { cachedAcademic } from "../src/lib/cached-views/smt-academic";
import { cachedPupils } from "../src/lib/cached-views/smt-pupils";
import { cachedContext } from "../src/lib/cached-views/smt-context";
import { cachedContextMap } from "../src/lib/cached-views/smt-context-map";
import { cachedPipeline } from "../src/lib/cached-views/admissions-pipeline";
import { cachedMarket } from "../src/lib/cached-views/admissions-market-share";
import { cachedRivals } from "../src/lib/cached-views/admissions-rivals";
import { cachedShape } from "../src/lib/cached-views/admissions-shape";
import { cachedTeacherModel } from "../src/lib/cached-views/front-door-teacher";
import { cachedTeacherDashboard } from "../src/lib/cached-views/teacher-dashboard";
import { cachedNearestSet } from "../src/lib/cached-views/chooser-nearest";
import { cachedFixedSet } from "../src/lib/cached-views/chooser-urns";
import { cachedRankingSet } from "../src/lib/cached-views/chooser-ranking";
import { cachedRankingPopulationSet } from "../src/lib/cached-views/chooser-ranking-full";
import { cachedFixedSetRanks } from "../src/lib/cached-views/teacher-saved-set-ranks";
import { smtSchool, type SmtSchool } from "../src/lib/smt/school";
import { academicOffer } from "../src/lib/smt/academic";
import { parseAcademic } from "../src/lib/smt/qual-groups";
import { parseLevel } from "../src/lib/smt/levels";
import { resolveCatchment } from "../src/lib/smt/catchment";
import { savedCatchmentKm } from "../src/lib/smt/catchment-server";
import { withDensity } from "../src/lib/smt/catchment-density";
import { resolveDefaultNearest, resolveRankingPopulation } from "../src/lib/chooser-sets";
import { createServerAnonSupabaseClient, createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { entryPoint } from "../src/lib/admissions/entry-points";
import { filtersFrom } from "../src/lib/admissions/traits";
import { listsForRoute } from "../src/lib/sets/admissions-route";
import type { AdmissionsCaller } from "../src/lib/admissions/auth";
import type { SmtSet } from "../src/lib/smt/overview";
import type { RankingFilters } from "../src/lib/comparator-chooser";

// A local test tool, not one of the app's packages (Render doesn't install it, and the build's type check
// must not need it): loaded at run time, only when a local run asks for PGlite.
type PGliteDb = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown>; close(): Promise<void> };
async function newPGlite(dir: string): Promise<PGliteDb> {
  const spec = "@electric-sql/pglite";
  const { PGlite } = (await import(spec)) as { PGlite: new (dir: string) => PGliteDb };
  return new PGlite(dir);
}


const out = process.argv[2];
const phase = process.argv[3] ?? "parent";
if (!out) throw new Error("usage: results-cache-parity.ts OUT_DIR");
mkdirSync(join(out, "off"), { recursive: true });

// ---- the PGlite stand-in for public.results_cache (the store's own SQL, as the PGlite test runs it) ----
async function pgliteStore(dir: string): Promise<{ store: ResultsStore; close: () => Promise<void>; count: () => Promise<number> }> {
  const fresh = !existsSync(join(dir, "PG_VERSION"));
  const db = await newPGlite(dir);
  if (fresh) {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text);`);
    await db.exec(readFileSync("supabase/ops/results_cache/apply_results_cache.sql", "utf8"));
  }
  const store: ResultsStore = {
    async read(key, v, notBefore) {
      const r = await db.query<{ value: string; created_at: Date; last_read_at: Date }>(`select value, created_at, last_read_at from results_cache where key = $1 and data_version = $2 and code_version = $3 and created_at >= $4`, [key, v.data, v.code, notBefore.toISOString()]);
      const row = r.rows[0];
      return row ? { value: row.value, created_at: new Date(row.created_at).toISOString(), last_read_at: new Date(row.last_read_at).toISOString() } : null;
    },
    async write(row) {
      await db.query(
        `insert into results_cache (key, value, data_version, code_version, bytes, built_ms, created_at, last_read_at) values ($1, $2, $3, $4, $5, $6, now(), now())
         on conflict (key) do update set value = excluded.value, data_version = excluded.data_version, code_version = excluded.code_version, bytes = excluded.bytes, built_ms = excluded.built_ms, created_at = excluded.created_at, last_read_at = excluded.last_read_at`,
        [row.key, row.value, row.data_version, row.code_version, row.bytes, row.built_ms],
      );
    },
    async touch(key, at) {
      await db.query(`update results_cache set last_read_at = $1 where key = $2`, [at.toISOString(), key]);
    },
    async prune(v, cut) {
      const views = v.views ? Object.entries(v.views) : [];
      if (!views.length) await db.query(`delete from results_cache where (data_version <> $1 or code_version <> $2) and created_at < $3`, [v.data, v.code, cut.mismatchBefore.toISOString()]);
      else {
        await db.query(`delete from results_cache where data_version <> $1 and created_at < $2`, [v.data, cut.mismatchBefore.toISOString()]);
        for (const [view, code] of views) await db.query(`delete from results_cache where key like $1 and code_version <> $2 and created_at < $3`, [viewKeyPattern(view), code, cut.mismatchBefore.toISOString()]);
      }
      await db.query(`delete from results_cache where created_at < $1 or last_read_at < $2`, [cut.expiredBefore.toISOString(), cut.unreadBefore.toISOString()]);
    },
  };
  return { store, close: () => db.close(), count: async () => (await db.query<{ n: number }>(`select count(*)::int n from results_cache`)).rows[0].n };
}

// ---- the requests, resolved as the routes resolve them ---------------------------------------------
type Case = { name: string; run: () => Promise<unknown> };

const service = createServiceRoleSupabaseClient();
const anon = createServerAnonSupabaseClient();
const ranking = (sector: "Independent" | "State", scope: RankingFilters["scope"]): RankingFilters => ({ sectors: [sector], gender: null, boarding: "any", qualification: null, scope, sizes: [] });

async function smtCases(urn: string): Promise<Case[]> {
  const school = (await smtSchool(urn)) as SmtSchool;
  if (!school) throw new Error(`no school ${urn}`);
  const name = school.name;
  const independent = school.independent;
  const nearest = await resolveDefaultNearest(urn, "ks4");
  const sets: SmtSet[] = [{ kind: "nearest", label: "10 nearest schools", urns: nearest.rows.map((r) => r.urn).filter((u) => u !== urn) }];
  const sector = independent ? "Independent" : "State";
  const place = school;
  if (independent) {
    const pop = await resolveRankingPopulation(urn, name, "ks4", ranking(sector, { kind: "nation", nation: "england" }), place.laName ?? null);
    sets.push({ kind: "ranking", label: `${sector} schools in England`, urns: pop.rows.map((r) => r.urn).filter((u) => u !== urn) });
  }
  if (place.regionCode && place.regionName) {
    const pop = await resolveRankingPopulation(urn, name, "ks4", ranking(sector, { kind: "region", code: place.regionCode, name: place.regionName }), place.laName ?? null);
    sets.push({ kind: "ranking", label: `${sector} schools in the ${place.regionName}`, urns: pop.rows.map((r) => r.urn).filter((u) => u !== urn) });
  }
  const admissions = { supabase: service };
  const offer = await academicOffer(school);
  const states = [parseAcademic(new URLSearchParams(), offer)];
  for (const level of ["gcse", "post16"]) {
    const st = parseAcademic(new URLSearchParams({ level }), offer);
    if (!states.some((x) => JSON.stringify(x) === JSON.stringify(st))) states.push(st);
  }
  const level = parseLevel(new URLSearchParams(), school.phases, null);
  const catchment = resolveCatchment(await withDensity(urn, school), null, await savedCatchmentKm({ supabase: service, headOffice: null }, urn));
  const cases: Case[] = [];
  for (const set of sets) {
    const tag = `${urn} ${set.label} (${set.urns.length})`;
    cases.push({ name: `smt/overview ${tag}`, run: () => cachedOverview(school, set, admissions) });
    for (const st of states) cases.push({ name: `smt/academic ${st.phase} ${tag}`, run: () => cachedAcademic(school, st, set) });
    cases.push({ name: `smt/pupils ${tag}`, run: () => cachedPupils(school, set, level, admissions) });
  }
  // A head office the school doesn't share its Admissions with: its own key, its own answer.
  cases.push({ name: `smt/overview ${urn} nearest, head office (Admissions private)`, run: () => cachedOverview(school, sets[0], { supabase: null, privateNote: "This school keeps its Admissions private." }) });
  cases.push({ name: `smt/pupils ${urn} nearest, head office (Admissions private)`, run: () => cachedPupils(school, sets[0], level, { supabase: null, privateNote: "This school keeps its Admissions private." }) });
  cases.push({ name: `smt/context ${urn} around`, run: () => cachedContext(school, "around", level.phase, catchment) });
  cases.push({ name: `smt/context ${urn} la`, run: () => cachedContext(school, "la", level.phase, catchment) });
  cases.push({ name: `smt/context/map ${urn}`, run: () => cachedContextMap(school, level.phase, catchment) });
  return cases;
}

async function admissionsCases(urn: string): Promise<Case[]> {
  const caller: AdmissionsCaller = { supabase: service, reader: service, userId: "00000000-0000-0000-0000-000000000000", urn, lead: false, roles: ["smt"], access: "peek", readOnly: true, viewAs: true };
  const savedKm = await savedCatchmentKm({ supabase: service, headOffice: null, readOnly: true }, urn).catch(() => null);
  const sp = new URLSearchParams();
  const filters = filtersFrom(sp);
  const cases: Case[] = [];
  for (const id of ["11+", "16+"]) {
    const ep = entryPoint(id)!;
    const feeders = await listsForRoute(caller, ep, sp, ["feeders"]);
    const rivals = await listsForRoute(caller, ep, sp, ["compared_against"]);
    const both = await listsForRoute(caller, ep, sp, ["feeders", "compared_against"]);
    cases.push({ name: `admissions/pipeline ${urn} ${id}`, run: () => cachedPipeline(urn, ep, feeders.lists, { filters, sex: "all", projection: false, catchment: { km: null, savedKm } }) });
    cases.push({ name: `admissions/pipeline ${urn} ${id} projection`, run: () => cachedPipeline(urn, ep, feeders.lists, { filters, sex: "all", projection: true, catchment: { km: null, savedKm } }) });
    cases.push({ name: `admissions/market-share ${urn} ${id}`, run: () => cachedMarket(urn, ep, rivals.lists, { filters, sex: "all" }) });
    cases.push({ name: `admissions/rivals ${urn} ${id}`, run: () => cachedRivals(urn, ep, rivals.lists, { filters, subject: null, family: null, qual: null, measure: null }) });
    cases.push({ name: `admissions/shape ${urn} ${id}`, run: () => cachedShape(urn, ep, both.lists, { filters }) });
  }
  return cases;
}

function teacherCases(urn: string): Case[] {
  const cases: Case[] = [];
  for (const p of ["ks4", "ks5"] as const) {
    cases.push({ name: `teacher/dashboard ${urn} ${p}`, run: () => cachedTeacherDashboard(anon, urn, p) });
    cases.push({ name: `front-door/teacher ${urn} ${p}`, run: () => cachedTeacherModel(anon, urn, p, { focusKey: null, ticked: [], full: false, lite: false }) });
    cases.push({ name: `front-door/teacher ${urn} ${p} full`, run: () => cachedTeacherModel(anon, urn, p, { focusKey: null, ticked: [], full: true, lite: false }) });
  }
  return cases;
}

// /api/smt/school and /api/teacher/chooser-set: the route's gate (member, View as / peek, head office)
// decides only whether to answer; the answer is built from the request alone, so a head-office or
// peek request is the same call with the same key as a member's.
const region = (code: string, name: string): RankingFilters["scope"] => ({ kind: "region", code, name });
const anyRanking = (sectors: RankingFilters["sectors"], scope: RankingFilters["scope"]): RankingFilters => ({ sectors, gender: null, boarding: "any", qualification: null, scope, sizes: [] });
async function chooserCases(): Promise<Case[]> {
  const cases: Case[] = [];
  for (const urn of ["110110", "138695"]) cases.push({ name: `smt/school ${urn}`, run: () => cachedSmtSchool(urn) });
  // The school's name and LA as the route reads them (the schools table, public).
  const target = async (urn: string) => {
    const { data } = await anon.from("schools").select("current_name, la_name").eq("urn", urn).maybeSingle<{ current_name: string; la_name: string | null }>();
    return { name: data?.current_name ?? "This school", la: data?.la_name ?? null };
  };
  const lp = await target("110110");
  const gd = await target("138695");
  for (const p of ["ks4", "ks5"] as const) cases.push({ name: `chooser/nearest 110110 ${p}`, run: () => cachedNearestSet("110110", p) });
  cases.push({ name: `chooser/nearest 138695 ks4`, run: () => cachedNearestSet("138695", "ks4") });
  const se = region("E12000008", "South East");
  const wm = region("E12000005", "West Midlands");
  const rankings: { tag: string; urn: string; t: { name: string; la: string | null }; phase: "ks4" | "ks5"; f: RankingFilters }[] = [
    { tag: "110110 ks5 Independent in England", urn: "110110", t: lp, phase: "ks5", f: anyRanking(["Independent"], { kind: "nation", nation: "england" }) },
    { tag: "110110 ks5 Independent in the South East", urn: "110110", t: lp, phase: "ks5", f: anyRanking(["Independent"], se) },
    { tag: "110110 ks5 all in the South East", urn: "110110", t: lp, phase: "ks5", f: anyRanking([], se) },
    { tag: "138695 ks4 State in the West Midlands", urn: "138695", t: gd, phase: "ks4", f: anyRanking(["State"], wm) },
  ];
  for (const r of rankings) cases.push({ name: `chooser/ranking-full ${r.tag}`, run: () => cachedRankingPopulationSet(r.urn, r.t.name, r.phase, r.f, r.t.la) });
  for (const r of [rankings[0], rankings[3]]) cases.push({ name: `chooser/ranking ${r.tag}`, run: () => cachedRankingSet(r.urn, r.t.name, r.phase, r.f, r.t.la) });
  const near = await cachedNearestSet("110110", "ks4");
  cases.push({ name: `chooser/urns 110110 ks4 (the nearest ten as a list)`, run: () => cachedFixedSet("110110", "ks4", near.rows.map((r) => r.urn).filter((u) => u !== "110110")) });
  // /api/teacher/saved-comparator-sets' ranking: a pure function of the school, the phase and each set's id and URNs.
  const nearUrns = near.rows.map((r) => r.urn).filter((u) => u !== "110110");
  for (const p of ["ks4", "ks5"] as const) cases.push({ name: `teacher/saved-set-ranks 110110 ${p}`, run: () => cachedFixedSetRanks("110110", [{ id: "near", urns: nearUrns }, { id: "half", urns: nearUrns.slice(0, 5) }], p) });
  return cases;
}

async function allCases(): Promise<Case[]> {
  const only = process.env.PARITY_ONLY ? new RegExp(process.env.PARITY_ONLY) : null;
  const keep = (cases: Case[]) => (only ? cases.filter((c) => only.test(c.name)) : cases);
  // Only the groups a filter can match are resolved (each group reads the live data to set itself up).
  const want = (...prefixes: string[]) => !only || prefixes.some((p) => only.test(p));
  return keep([
    ...(want("smt/overview", "smt/academic", "smt/pupils", "smt/context") ? [...(await smtCases("110110")), ...(await smtCases("138695"))] : []),
    ...(want("admissions/") ? await admissionsCases("110110") : []),
    ...(want("teacher/dashboard", "front-door/teacher") ? [...teacherCases("110110"), ...teacherCases("138695")] : []),
    ...(want("smt/school", "chooser/", "teacher/saved-set-ranks") ? await chooserCases() : []),
  ]);
}

const file = (name: string) => join(out, "off", name.replace(/[^a-z0-9+.-]+/gi, "_") + ".json");

async function versionsFor(): Promise<Versions> {
  const pinned = join(out, "versions.json");
  if (existsSync(pinned)) return JSON.parse(readFileSync(pinned, "utf8")) as Versions;
  setResultsCacheForTests({});
  // The live data version (the stamps and the school sync); a stand-in code version.
  const live = await liveVersions().catch(() => null);
  const { allSourceStamps } = await import("../src/lib/vicdata-reference");
  const { schoolSyncStamp } = await import("../src/lib/school-sync-stamp");
  const { dataVersionOf } = await import("../src/lib/results-cache");
  const { firstEntryYear } = await import("../src/lib/admissions/entry-points");
  const d = dataVersionOf({ stamps: await allSourceStamps(), sync: await schoolSyncStamp(), entryYear: firstEntryYear(new Date()), epoch: "" }, Date.now(), 30 * 60_000);
  if (!d) throw new Error("couldn't read the live stamps");
  const v: Versions = { data: d.data, code: `parity-${Date.now()}`, settled: true };
  console.log(`data version ${d.data} (live; settled: ${d.settled}); liveVersions() here: ${live ? "has a build" : "null (no build-info.json in a dev checkout: the cache would stay off)"}`);
  writeFileSync(pinned, JSON.stringify(v));
  return v;
}

async function first() {
  const v = await versionsFor();
  const pg = await pgliteStore(join(out, "pg"));
  const pending: Promise<void>[] = [];
  const opts = { store: pg.store, versions: async () => v, minBuildMs: 0, defer: (fn: () => void) => void pending.push(Promise.resolve().then(fn)) };
  const cases = await allCases();
  console.log(`${cases.length} requests`);
  let bad = 0;
  for (const c of cases) {
    setResultsCacheForTests({ ...opts, enabled: true });
    const t0 = Date.now();
    const on = JSON.stringify(await c.run());
    const onMs = Date.now() - t0;
    const s = resultsCacheStats();
    setResultsCacheForTests({ ...opts, enabled: false });
    const t1 = Date.now();
    const off = JSON.stringify(await c.run());
    const offMs = Date.now() - t1;
    writeFileSync(file(c.name), off);
    const same = on === off;
    if (!same) bad++;
    const why = Object.keys(s.skips).join(",");
    console.log(`${same ? "SAME" : "DIFF"}  ${c.name}: ${on.length} bytes; on (built, ${s.misses ? "miss" : "hit"}${why ? `, not stored: ${why}` : ""}) ${onMs} ms, off ${offMs} ms`);
  }
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  await Promise.all(pending);
  await new Promise((r) => setTimeout(r, 500));
  console.log(`stored rows: ${await pg.count()}`);
  await pg.close();
  console.log(bad ? `${bad} DIFFERENT (cache on, first build, vs off)` : "every cache-on first build equals cache-off, byte for byte");
  return bad;
}

async function second() {
  const v = await versionsFor();
  const pg = await pgliteStore(join(out, "pg"));
  const cases = await allCases();
  let bad = 0;
  let built = 0;
  for (const c of cases) {
    setResultsCacheForTests({ store: pg.store, versions: async () => v, minBuildMs: 0, enabled: true, defer: () => undefined });
    const t0 = Date.now();
    const got = JSON.stringify(await c.run());
    const ms = Date.now() - t0;
    const s = resultsCacheStats();
    const want = readFileSync(file(c.name), "utf8");
    const same = got === want;
    if (!same) bad++;
    if (s.misses) built++;
    const from = s.l2 ? "from the store (L2)" : s.l1 ? "from memory (L1)" : `BUILT (miss${Object.keys(s.skips).length ? `, not stored: ${Object.keys(s.skips).join(",")}` : ""})`;
    console.log(`${same ? "SAME" : "DIFF"}  ${c.name}: ${from} in ${ms} ms`);
  }
  await pg.close();
  console.log(`${cases.length - built} of ${cases.length} served without a build in a fresh process; ${bad ? `${bad} DIFFERENT` : "every one equals cache-off, byte for byte"}`);
  return bad + built;
}

async function main() {
  if (phase === "first") process.exit((await first()) ? 1 : 0);
  if (phase === "second") process.exit((await second()) ? 1 : 0);
  // The parent: two separate processes, one after the other.
  const run = (p: string) => {
    try {
      execFileSync(process.execPath, [...process.execArgv, process.argv[1], out, p], { stdio: "inherit" });
      return 0;
    } catch {
      return 1;
    }
  };
  console.log("== process 1: cache on (first build, stored), then off");
  const a = run("first");
  console.log("\n== process 2 (fresh): cache on, from the store");
  const b = run("second");
  process.exit(a || b ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
