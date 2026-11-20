#!/usr/bin/env -S npx tsx
// SMT Overview parity harness (speed plan §4.2 item 1, extended to the Overview): builds the Overview for each
// case and writes its JSON (one file per case) plus timings, so two runs -- today's reads, and the census figures
// (SMT_OVERVIEW_FIGURES=on) -- can be compared byte for byte. Read-only against live data, one build at a time.
//
// Usage:
//   npx tsx --env-file=.env --env-file=.env.local scripts/smt-overview-parity.ts --out DIR [--sets FILE] [--figures-pglite DIR] [--random N --seed S] CASE...
//   CASE  urn:stage:set[:private]   stage ks4|ks5 (the phase the set is resolved for); set
//         nearest                    the chooser's 10 nearest (resolveDefaultNearest)
//         nation:Independent|State   the sector in England
//         region:Independent|State|all|own   the school's own region (own: its own sector)
//         region@E12000008:all|...   a named region
//         list:URN,URN,...           a fixed set, as a saved set arrives (the school may be in it)
//         :private  as a head office the school doesn't share Admissions with (the market's privateNote)
//   --sets FILE   the resolved sets: read when there, else resolved and written, so both runs build the same sets
//   --random N    N schools with sixth forms (seed --seed), each ks4 and ks5 × nearest and region:own
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { smtSchool } from "../src/lib/smt/school";
import { buildOverview, type SmtSet } from "../src/lib/smt/overview";
import { resolveDefaultNearest, resolveRankingPopulation } from "../src/lib/chooser-sets";
import { NATIONAL, type RankingFilters } from "../src/lib/comparator-chooser";
import { englandSchools } from "../src/lib/admissions/ranks";
import { createServiceRoleSupabaseClient } from "../src/lib/supabase";

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const OUT = opt("--out") ?? "overview-parity-out";
const SETS = opt("--sets");
const FIGURES_PGLITE = opt("--figures-pglite");
const RANDOM = Number(opt("--random") ?? 0);
const SEED = Number(opt("--seed") ?? 20261120);
const cases = args;
const REGION_NAMES: Record<string, string> = { E12000008: "South East", E12000005: "West Midlands", E12000002: "North West" };
const PRIVATE_NOTE = "This school keeps its Admissions private.";

async function randomCases(n: number): Promise<string[]> {
  const { population, SMT_MEASURES } = await import("../src/lib/smt/population");
  const [p4, p5, eng] = await Promise.all([population("ks4"), population("ks5"), englandSchools()]);
  const latest = (p: Awaited<ReturnType<typeof population>>, k: string) => Math.max(...Array.from(p.values()).flatMap((by) => Array.from(by.entries()).filter(([, m]) => m[k] !== undefined).map(([y]) => y)));
  const y4 = latest(p4, SMT_MEASURES.ks4.a8);
  const y5 = latest(p5, "A level::aps_per_entry");
  const pool = Array.from(p4.keys()).filter((u) => p4.get(u)?.get(y4)?.[SMT_MEASURES.ks4.a8] !== undefined && p5.get(u)?.get(y5)?.["A level::aps_per_entry"] !== undefined && eng.has(u)).sort();
  let s = SEED >>> 0;
  const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 2 ** 32);
  const picked: string[] = [];
  while (picked.length < n && picked.length < pool.length) {
    const u = pool[Math.floor(rnd() * pool.length)];
    if (!picked.includes(u)) picked.push(u);
  }
  console.log(`random schools (seed ${SEED}, of ${pool.length}): ${picked.join(" ")}`);
  return picked.flatMap((u) => ["ks4", "ks5"].flatMap((st) => [`${u}:${st}:nearest`, `${u}:${st}:region:own`]));
}

const ranking = (sectors: string[], scope: RankingFilters["scope"]): RankingFilters => ({ sectors: sectors as RankingFilters["sectors"], gender: null, boarding: "any", qualification: null, scope, sizes: [] });

async function resolveSet(urn: string, stage: "ks4" | "ks5", spec: string): Promise<SmtSet> {
  const school = (await smtSchool(urn))!;
  if (spec.startsWith("list:")) return { kind: "urns", label: "Fixed list", urns: spec.slice(5).split(",") };
  if (spec === "nearest") return { kind: "nearest", label: "10 nearest schools", urns: (await resolveDefaultNearest(urn, stage)).rows.map((r) => r.urn).filter((u) => u !== urn) };
  const [where, sectorSpec] = spec.split(":");
  const sector = sectorSpec === "own" ? (school.independent ? "Independent" : "State") : sectorSpec;
  const sectors = sector === "all" ? [] : [sector];
  let scope: RankingFilters["scope"];
  let place: string;
  if (where === "nation") {
    scope = NATIONAL;
    place = "England";
  } else {
    const code = where.startsWith("region@") ? where.slice(7) : school.regionCode!;
    const name = where.startsWith("region@") ? REGION_NAMES[code] ?? code : school.regionName!;
    scope = { kind: "region", code, name } as RankingFilters["scope"];
    place = `the ${name}`;
  }
  const pop = await resolveRankingPopulation(urn, school.name, stage, ranking(sectors, scope), school.laName ?? null);
  const label = sector === "all" ? `All ${stage === "ks5" ? "sixth forms and colleges" : "schools"} in ${place}` : `${sector} schools in ${place}`;
  return { kind: "ranking", label, urns: pop.rows.map((r) => r.urn).filter((u) => u !== urn) };
}

async function main() {
  if (FIGURES_PGLITE) {
    const { openFiguresPglite, pgliteFiguresRpc } = await import("./lib/smt-figures-pglite");
    const { setFiguresRpc } = await import("../src/lib/smt/smt-figures-store");
    process.env.SMT_OVERVIEW_FIGURES = "on";
    setFiguresRpc(pgliteFiguresRpc(await openFiguresPglite(FIGURES_PGLITE)));
  }
  if (RANDOM) cases.push(...(await randomCases(RANDOM)));
  const sets: Record<string, SmtSet> = SETS && existsSync(SETS) ? JSON.parse(readFileSync(SETS, "utf8")) : {};
  const resolving = !(SETS && existsSync(SETS));
  mkdirSync(OUT, { recursive: true });
  const service = createServiceRoleSupabaseClient();
  const summary: { case: string; setSize: number; coldMs: number; warmMs: number; bytes: number }[] = [];
  for (const c of cases) {
    const parts = c.split(":");
    const priv = parts.at(-1) === "private";
    if (priv) parts.pop();
    const [urn, stage, ...rest] = parts;
    const spec = rest.join(":");
    const school = await smtSchool(urn);
    if (!school) throw new Error(`no school ${urn}`);
    const setKey = `${urn}:${stage}:${spec}`;
    if (!sets[setKey]) {
      if (!resolving) throw new Error(`${setKey}: not in ${SETS}`);
      sets[setKey] = await resolveSet(urn, stage as "ks4" | "ks5", spec);
    }
    const set = sets[setKey];
    const admissions = priv ? { supabase: null, privateNote: PRIVATE_NOTE } : { supabase: service };
    const t0 = Date.now();
    const o = await buildOverview(school, set, admissions as never);
    const coldMs = Date.now() - t0;
    const t1 = Date.now();
    await buildOverview(school, set, admissions as never);
    const warmMs = Date.now() - t1;
    const json = JSON.stringify(o);
    writeFileSync(join(OUT, c.replace(/[:@,]/g, "_").slice(0, 120) + ".json"), json);
    summary.push({ case: c, setSize: set.urns.length, coldMs, warmMs, bytes: json.length });
    console.log(`${c}  set ${set.urns.length}  cold ${coldMs} ms  warm ${warmMs} ms`);
  }
  if (SETS && resolving) writeFileSync(SETS, JSON.stringify(sets));
  console.table(summary);
  try {
    const { overviewReads } = await import("../src/lib/smt/overview-figures-store");
    console.log(`overview inputs: ${overviewReads.store} from the figures, ${overviewReads.live} from today's reads`);
  } catch {
    // main before the figures: nothing to count
  }
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
