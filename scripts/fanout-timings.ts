// Read fan-outs (20 Nov): each big-set request's build, cold, ONE AT A TIME, against the live data, read-only,
// counting the reads that failed (HTTP 5xx: production's ~3 s statement timeout answers 500 / 57014) and how
// wide the reads ran at once.
//
//   npx tsx --env-file=.env --env-file=.env.local scripts/fanout-timings.ts            # every case, each in a fresh process
//   npx tsx --env-file=.env --env-file=.env.local scripts/fanout-timings.ts --only rivals   # cases whose name matches
//   npx tsx --env-file=.env --env-file=.env.local scripts/fanout-timings.ts --list
//
// Each case runs in its own process, so every in-process cache is empty (a restart's first request). The
// builders are called directly (not through the results cache), inside a build trace, so `degraded` is what the
// results cache would see. Reads the live databases only: the school's lists and catchment through the service
// role, as a platform admin's peek does. Run it at a quiet time: one build at a time, never in parallel.
import { execFileSync } from "node:child_process";
import { isDegraded, traced } from "../src/lib/build-trace";
import type { RankingFilters } from "../src/lib/comparator-chooser";

type Stat = { name: string; ms: number; status: number; n: number | null; at: number; inFlight: number; note?: string };
const reads: Stat[] = [];
let inFlight = 0;
let peak = 0;
const t0 = Date.now();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const m = url.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)/i);
  const name = m ? (m[1] ? "rpc:" : "table:") + m[2] : url.slice(0, 60);
  let n: number | null = null;
  let name2 = name;
  try {
    const b = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (b?.p_source_id) name2 = `${name}(${b.p_source_id}${b.p_breakdowns ? `,${b.p_breakdowns.length} breakdowns` : ""})`;
    const ids = b?.p_entity_ids ?? b?.p_urns ?? b?.p_lsoas ?? null;
    if (Array.isArray(ids)) n = ids.length;
  } catch {}
  const at = Date.now();
  inFlight++;
  peak = Math.max(peak, inFlight);
  const was = inFlight;
  try {
    const res = await realFetch(input, init);
    let note: string | undefined;
    if (res.status >= 500) note = (await res.clone().text()).slice(0, 120);
    reads.push({ name: name2, ms: Date.now() - at, status: res.status, n, at: at - t0, inFlight: was, note });
    return res;
  } catch (e) {
    reads.push({ name: name2, ms: Date.now() - at, status: 0, n, at: at - t0, inFlight: was, note: String(e).slice(0, 120) });
    throw e;
  } finally {
    inFlight--;
  }
}) as typeof fetch;

type Case = { name: string; run: () => Promise<unknown> };
const ranking = (sectors: ("Independent" | "State")[], scope: RankingFilters["scope"]): RankingFilters => ({ sectors, gender: null, boarding: "any", qualification: null, scope, sizes: [] });

async function cases(): Promise<Case[]> {
  const { smtSchool } = await import("../src/lib/smt/school");
  const { buildOverview } = await import("../src/lib/smt/overview");
  const { buildAcademic, academicOffer } = await import("../src/lib/smt/academic");
  const { parseAcademic } = await import("../src/lib/smt/qual-groups");
  const { buildPupils, readPupilsAdmissions } = await import("../src/lib/smt/pupils");
  const { parseLevel } = await import("../src/lib/smt/levels");
  const { resolveRankingPopulation } = await import("../src/lib/chooser-sets");
  const { createServiceRoleSupabaseClient } = await import("../src/lib/supabase");
  const { entryPoint } = await import("../src/lib/admissions/entry-points");
  const { filtersFrom } = await import("../src/lib/admissions/traits");
  const { listsForRoute } = await import("../src/lib/sets/admissions-route");
  const { marketView, pipelineView, rivalsView, shapeView } = await import("../src/lib/admissions/views-api");
  const { savedCatchmentKm } = await import("../src/lib/smt/catchment-server");
  const service = createServiceRoleSupabaseClient();
  const out: Case[] = [];

  // The SMT sets: [school, phase, label, filters]. Resolved lazily (inside the case, before the timer).
  const smtSets: [string, "ks4" | "ks5", string, RankingFilters][] = [
    ["110110", "ks4", "Independent schools in England", ranking(["Independent"], { kind: "nation", nation: "england" })],
    ["110110", "ks5", "Independent schools in England", ranking(["Independent"], { kind: "nation", nation: "england" })],
    ["110110", "ks5", "All sixth forms and colleges in the South East", ranking([], { kind: "region", code: "E12000008", name: "South East" })],
    ["138695", "ks4", "State schools in the West Midlands", ranking(["State"], { kind: "region", code: "E12000005", name: "West Midlands" })],
  ];
  for (const [urn, phase, label, filters] of smtSets) {
    const prep = async () => {
      const school = (await smtSchool(urn))!;
      const pop = await resolveRankingPopulation(urn, school.name, phase, filters, school.laName ?? null);
      const set = { kind: "ranking", label, urns: pop.rows.map((r) => r.urn).filter((u) => u !== urn) };
      console.log(`  set: ${set.urns.length} schools`);
      return { school, set };
    };
    const tag = `${urn} ${phase} ${label}`;
    out.push({ name: `smt/overview ${tag}`, run: async () => { const { school, set } = await prep(); return timed(() => buildOverview(school, set, { supabase: service })); } });
    out.push({ name: `smt/academic ${tag}`, run: async () => {
      const { school, set } = await prep();
      const st = parseAcademic(new URLSearchParams({ level: phase === "ks4" ? "gcse" : "post16" }), await academicOffer(school));
      return timed(() => buildAcademic(school, st, set));
    } });
    out.push({ name: `smt/pupils ${tag}`, run: async () => {
      const { school, set } = await prep();
      const level = parseLevel(new URLSearchParams({ level: phase === "ks4" ? "gcse" : "post16" }), school.phases, null);
      const adm = { supabase: service };
      const pre = await readPupilsAdmissions(school, adm);
      return timed(() => buildPupils(school, set, level, adm, pre));
    } });
  }

  const { buildContext } = await import("../src/lib/smt/context");
  const { resolveCatchment } = await import("../src/lib/smt/catchment");
  const { withDensity } = await import("../src/lib/smt/catchment-density");
  for (const urn of ["110110", "138695"]) {
    for (const area of ["around", "la"] as const) {
      out.push({ name: `smt/context ${urn} ${area}`, run: async () => {
        const school = (await smtSchool(urn))!;
        const level = parseLevel(new URLSearchParams(), school.phases, null).phase;
        const catchment = resolveCatchment(await withDensity(urn, school), null, await savedCatchmentKm({ supabase: service, headOffice: null } as never, urn));
        return timed(() => buildContext(school, area, level, catchment));
      } });
    }
  }
  // Teacher: the dashboard and the home (full), and a big set's lean profiles (chooser-set's answer) and the
  // Data View's academic profiles with subjects (the Rankings map), for the SMT big sets.
  {
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const { buildTeacherDashboard } = await import("../src/lib/teacher-dashboard-data");
    const { loadTeacherModel } = await import("../src/lib/front-door/teacher-data");
    const { fetchTeacherComparatorProfiles, profileUrnsFor } = await import("../src/lib/teacher-comparator-profiles");
    const { fetchAcademicProfiles } = await import("../src/lib/academic-data-view");
    const anon = createServerAnonSupabaseClient();
    for (const urn of ["110110", "138695"]) for (const p of ["ks4", "ks5"] as const) {
      out.push({ name: `teacher/dashboard ${urn} ${p}`, run: () => timed(() => buildTeacherDashboard(anon, urn, p)) });
      out.push({ name: `front-door/teacher ${urn} ${p} full`, run: () => timed(() => loadTeacherModel(anon, urn, p, { focusKey: null, ticked: [], full: true, lite: false })) });
    }
    for (const [urn, phase, label, filters] of smtSets) {
      const urnsOf = async () => {
        const school = (await smtSchool(urn))!;
        const pop = await resolveRankingPopulation(urn, school.name, phase, filters, school.laName ?? null);
        return pop.rows.map((r) => r.urn);
      };
      out.push({ name: `teacher/chooser-set profiles ${urn} ${phase} ${label}`, run: async () => { const u = await urnsOf(); return timed(() => fetchTeacherComparatorProfiles(profileUrnsFor(u, urn), phase)); } });
      out.push({ name: `data-view/academic-schools subjects ${urn} ${phase} ${label}`, run: async () => { const u = await urnsOf(); return timed(() => fetchAcademicProfiles([...u, urn], { includeSubjects: true })); } });
    }
  }
  out.push({ name: "platform/groups groupIndex", run: async () => {
    const { groupIndex } = await import("../src/lib/groups/production");
    return timed(() => groupIndex());
  } });

  for (const urn of ["110110"]) {
    const caller = { supabase: service, reader: service, userId: "00000000-0000-0000-0000-000000000000", urn, lead: false, roles: ["smt"], access: "peek", readOnly: true, viewAs: true } as never;
    const sp = new URLSearchParams();
    const filters = filtersFrom(sp);
    for (const id of ["11+", "16+"]) {
      const ep = entryPoint(id)!;
      out.push({ name: `admissions/pipeline ${urn} ${id}`, run: async () => {
        const { lists } = await listsForRoute(caller, ep, sp, ["feeders"]);
        const savedKm = await savedCatchmentKm({ supabase: service, headOffice: null, readOnly: true } as never, urn).catch(() => null);
        return timed(() => pipelineView(urn, ep, lists, { filters, sex: "all", projection: false, catchment: { km: null, savedKm } }));
      } });
      out.push({ name: `admissions/rivals ${urn} ${id}`, run: async () => {
        const { lists } = await listsForRoute(caller, ep, sp, ["compared_against"]);
        return timed(() => rivalsView(urn, ep, lists, { filters, subject: null, family: null, qual: null, measure: null }));
      } });
      out.push({ name: `admissions/market-share ${urn} ${id}`, run: async () => {
        const { lists } = await listsForRoute(caller, ep, sp, ["compared_against"]);
        return timed(() => marketView(urn, ep, lists, { filters, sex: "all" }));
      } });
      out.push({ name: `admissions/shape ${urn} ${id}`, run: async () => {
        const { lists } = await listsForRoute(caller, ep, sp, ["feeders", "compared_against"]);
        return timed(() => shapeView(urn, ep, lists, { filters }));
      } });
    }
  }
  return out;
}

let mark = 0;
async function timed<T>(fn: () => Promise<T>): Promise<T> {
  mark = reads.length;
  const start = Date.now();
  peak = 0;
  const { trace, promise } = traced(fn);
  const v = await promise;
  const ms = Date.now() - start;
  const mine = reads.slice(mark);
  const failed = mine.filter((r) => r.status >= 500 || r.status === 0);
  const by = new Map<string, { n: number; ok: number; failed: number; ms: number; maxAt: number; failedEntities: number }>();
  for (const r of mine) {
    const s = by.get(r.name) ?? { n: 0, ok: 0, failed: 0, ms: 0, maxAt: 0, failedEntities: 0 };
    s.n++;
    if (r.status >= 500 || r.status === 0) { s.failed++; s.failedEntities += r.n ?? 0; } else s.ok++;
    s.ms = Math.max(s.ms, r.ms);
    s.maxAt = Math.max(s.maxAt, r.inFlight);
    by.set(r.name, s);
  }
  console.log(`  BUILD ${ms} ms; ${mine.length} reads, ${failed.length} failed, most at once ${peak}; degraded: ${isDegraded(trace)}; ${JSON.stringify(v).length} bytes`);
  for (const [name, s] of Array.from(by).sort((a, b) => b[1].n - a[1].n)) console.log(`    ${name}: ${s.n} reads${s.failed ? `, ${s.failed} FAILED (${s.failedEntities} entities)` : ""}, slowest ${s.ms} ms, up to ${s.maxAt} in flight`);
  if (process.env.FANOUT_TIMELINE) {
    const span = new Map<string, [number, number]>();
    for (const r of mine) { const x = span.get(r.name) ?? [Infinity, 0]; span.set(r.name, [Math.min(x[0], r.at), Math.max(x[1], r.at + r.ms)]); }
    const base = Math.min(...mine.map((r) => r.at));
    for (const [name, [a, b]] of Array.from(span).sort((x, y) => x[1][0] - y[1][0])) console.log(`    ${String(a - base).padStart(6)}-${String(b - base).padEnd(6)} ${name}`);
  }
  if (process.env.FANOUT_READS) for (const r of mine.filter((x) => x.name.includes(process.env.FANOUT_READS!))) console.log(`      ${r.at} +${r.ms} n=${r.n} ${r.status} ${r.name}`);
  for (const f of failed.slice(0, 3)) console.log(`    e.g. ${f.name} n=${f.n} ${f.status} after ${f.ms} ms: ${f.note}`);
  return v;
}

async function main() {
  const args = process.argv.slice(2);
  const child = args.indexOf("--case");
  const all = await cases();
  if (child >= 0) {
    const c = all.find((x) => x.name === args[child + 1]);
    if (!c) throw new Error(`no case ${args[child + 1]}`);
    const v = await c.run();
    if (process.env.FANOUT_DUMP) (await import("node:fs")).writeFileSync(process.env.FANOUT_DUMP, JSON.stringify(v));
    return;
  }
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const pick = all.filter((c) => !only || c.name.includes(only));
  if (args.includes("--list")) return void pick.forEach((c) => console.log(c.name));
  for (const c of pick) {
    console.log(`== ${c.name}`);
    try {
      execFileSync(process.execPath, [...process.execArgv, process.argv[1], "--case", c.name], { stdio: "inherit", timeout: 180_000 });
    } catch (e) {
      console.log(`  FAILED: ${String(e).slice(0, 200)}`);
    }
  }
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
