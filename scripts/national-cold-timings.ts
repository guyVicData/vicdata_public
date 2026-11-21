#!/usr/bin/env -S npx tsx
// The first views after a restart, timed in a fresh process (docs/v0.8/smt_national_preload_v1.md), with and
// without the national preload. Read-only against live data, one view at a time, the results cache off (as a miss).
//
//   npx tsx --env-file=.env --env-file=.env.local scripts/national-cold-timings.ts [--preload] [--urn 110110] [--entry 11+] [--keys]
//
// The steps, in the order the pages ask: /api/smt/school (smtSchool), the SMT home's set (the 10 nearest), the
// Overview, then the Teacher home's /api/admissions/pipeline (pipelineView with the school's own lists, read as a
// platform-admin peek would). --preload runs the boot preload first (as NATIONAL_PRELOAD=on would, before the first
// visitor). --keys lists every cache miss each step waited on, national or the school's own, slowest first.
import { observeReferenceMisses } from "../src/lib/server-cache";
import { NATIONAL_LOADS } from "../src/lib/national-loads";

const args = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const URN = opt("--urn", "110110");
const ENTRY = opt("--entry", "11+");
const PRELOAD = args.includes("--preload");
const KEYS = args.includes("--keys");
const PIPELINE_FIRST = args.includes("--pipeline-first"); // the Teacher home's order: Admissions before SMT
const national = new Set(NATIONAL_LOADS.map((l) => l.key));
const mb = (b: number) => Math.round(b / 1024 / 1024);

type Miss = { key: string; ms: number; ok: boolean };
let misses: Miss[] = [];
observeReferenceMisses((key, ms, ok) => misses.push({ key, ms: Math.round(ms), ok }));

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  misses = [];
  const t0 = performance.now();
  const v = await fn();
  const ms = Math.round(performance.now() - t0);
  const nat = misses.filter((m) => national.has(m.key));
  const own = misses.filter((m) => !national.has(m.key));
  console.log(`${name}: ${ms} ms; national misses ${nat.length} (${nat.map((m) => `${m.key} ${m.ms}`).join(", ") || "none"}); other misses ${own.length}`);
  if (KEYS) for (const m of [...misses].sort((a, b) => b.ms - a.ms).slice(0, 25)) console.log(`    ${national.has(m.key) ? "N" : " "} ${String(m.ms).padStart(6)} ms  ${m.key.slice(0, 110)}${m.ok ? "" : "  (failed)"}`);
  return v;
}

async function main() {
  delete process.env.RESULTS_CACHE;
  const warn = console.warn;
  console.warn = (...a: unknown[]) => (String(a[0]).startsWith("[roll-data]") ? undefined : warn(...a));
  const { smtSchool } = await import("../src/lib/smt/school");
  const { buildOverview } = await import("../src/lib/smt/overview");
  const { resolveDefaultNearest } = await import("../src/lib/chooser-sets");
  const { createServiceRoleSupabaseClient } = await import("../src/lib/supabase");
  const { entryPoint } = await import("../src/lib/admissions/entry-points");
  const { listsForRoute } = await import("../src/lib/sets/admissions-route");
  const { pipelineView } = await import("../src/lib/admissions/views-api");
  const { filtersFrom } = await import("../src/lib/admissions/traits");
  const service = createServiceRoleSupabaseClient();

  const t0 = performance.now();
  if (PRELOAD) {
    const { preloadNational } = await import("../src/lib/national-preload");
    const r = await step("preload (before the first visitor)", () => preloadNational());
    if (r.failed.length) console.log("  failed:", r.failed);
  }
  const m0 = process.memoryUsage();
  console.log(`memory after ${PRELOAD ? "the preload" : "start"}: heap ${mb(m0.heapUsed)} MB, rss ${mb(m0.rss)} MB`);

  const ep = entryPoint(ENTRY);
  if (!ep) throw new Error(`no entry ${ENTRY}`);
  const caller = { supabase: service, reader: service, userId: "00000000-0000-0000-0000-000000000000", urn: URN, lead: false, roles: ["admissions"], access: "full", readOnly: true, isAdmin: true } as never;
  const sp = new URLSearchParams();
  const pipeline = async () => {
    const chosen = await step(`admissions sets (${ENTRY})`, () => listsForRoute(caller, ep, sp, ["feeders"]));
    await step(`/api/admissions/pipeline (${ENTRY}, ${chosen.lists.length} lists)`, () => pipelineView(URN, ep, chosen.lists, { filters: filtersFrom(sp), sex: "all", projection: false, catchment: { km: null, savedKm: null } }));
  };
  const tv = performance.now();
  if (PIPELINE_FIRST) await pipeline();
  const school = await step(`/api/smt/school ${URN}`, () => smtSchool(URN));
  if (!school) throw new Error(`no school ${URN}`);
  const stage = school.phases.post16 ? "ks5" : "ks4";
  const nearest = await step(`chooser-set nearest (${stage})`, () => resolveDefaultNearest(URN, stage));
  const set = { kind: "nearest" as const, label: "10 nearest schools", urns: nearest.rows.map((r) => r.urn).filter((u) => u !== URN) };
  await step(`/api/smt/overview (nearest, ${set.urns.length})`, () => buildOverview(school, set, { supabase: service } as never));
  if (!PIPELINE_FIRST) await pipeline();
  const m1 = process.memoryUsage();
  console.log(`views: ${Math.round(performance.now() - tv)} ms (all, from the first visitor); total ${Math.round(performance.now() - t0)} ms; heap ${mb(m1.heapUsed)} MB, rss ${mb(m1.rss)} MB`);
}
main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
