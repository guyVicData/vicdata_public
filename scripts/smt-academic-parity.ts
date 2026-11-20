#!/usr/bin/env -S npx tsx
// SMT Academic parity harness (speed plan §4.2 item 1): builds every Academic state for a school against a
// set and writes each answer's JSON (one file per state) plus timings, so two runs -- SMT_FIGURES off and on --
// can be compared byte for byte. Read-only against live data.
//
// Usage:
//   npx tsx --env-file=.env --env-file=.env.local scripts/smt-academic-parity.ts --out DIR CASE [CASE...]
//   CASE  urn:phase:set   phase gcse|post16; set nearest | nation:Independent | nation:State | region:Independent |
//                         region:State | region:all   (the SMT sets panel's VicData defaults)
//   --only-mode results|entries|va   one mode only
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { smtSchool } from "../src/lib/smt/school";
import { academicOffer, buildAcademic } from "../src/lib/smt/academic";
import { parseAcademic, type AcademicMode, type AcademicState } from "../src/lib/smt/qual-groups";
import { resolveRankingPopulation } from "../src/lib/chooser-sets";
import { defaultRankingFilters, NATIONAL, type RankingFilters } from "../src/lib/comparator-chooser";
import { englandSchools } from "../src/lib/admissions/ranks";
import { createServerAnonSupabaseClient } from "../src/lib/supabase";

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const OUT = opt("--out") ?? "parity-out";
const ONLY_MODE = opt("--only-mode") as AcademicMode | undefined;
const RANDOM = Number(opt("--random") ?? 0);
const SEED = Number(opt("--seed") ?? 20261120);
const cases = args;

// --random N: N secondary schools with sixth forms (a GCSE Attainment 8 and an A level points figure in the
// latest years), drawn with a fixed seed, each at GCSE and Post-16 against its nearest and its own sector's region.
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
  return picked.flatMap((u) => ["gcse", "post16"].flatMap((ph) => [`${u}:${ph}:nearest`, `${u}:${ph}:region:own`]));
}

async function setFor(urn: string, phase: "gcse" | "post16", spec: string, regionCode: string | null, regionName: string | null) {
  if (spec === "nearest") return { kind: "nearest", label: "10 nearest schools", urns: [] as string[] };
  const [scopeKind, sector] = spec.split(":");
  const scope: RankingFilters["scope"] = scopeKind === "nation" ? NATIONAL : ({ kind: "region", code: regionCode!, name: regionName! } as RankingFilters["scope"]);
  const filters: RankingFilters = { ...defaultRankingFilters(scope), sectors: sector === "all" ? [] : ([sector] as RankingFilters["sectors"]) };
  const stage = phase === "gcse" ? "ks4" : "ks5";
  const { data } = await createServerAnonSupabaseClient().from("schools").select("current_name, la_name").eq("urn", urn).maybeSingle();
  const r = await resolveRankingPopulation(urn, (data as { current_name?: string } | null)?.current_name ?? "This school", stage, filters, (data as { la_name?: string } | null)?.la_name ?? null);
  return { kind: "ranking", label: spec, urns: r.rows.map((x) => x.urn).filter((u) => u !== urn) };
}

function statesFor(offer: Awaited<ReturnType<typeof academicOffer>>, phase: "gcse" | "post16"): AcademicState[] {
  const out: AcademicState[] = [];
  const modes: AcademicMode[] = ONLY_MODE ? [ONLY_MODE] : ["results", "entries", "va"];
  for (const mode of modes) {
    const q = (o: Record<string, string>) => parseAcademic(new URLSearchParams({ level: phase, mode, ...o }), offer);
    if (phase === "post16") {
      out.push(q({ group: "all" }));
      for (const g of offer.groups) {
        if (g === "applied") for (const a of offer.applied.length ? offer.applied : ["ag"]) out.push(q({ group: g, applied: a }));
        else out.push(q({ group: g }));
      }
    } else {
      out.push(q({}));
      if (mode !== "va") for (const a of offer.areas.gcse) out.push(q({ area: a }));
    }
  }
  const seen = new Set<string>();
  return out.filter((s) => s.phase === phase && !seen.has(JSON.stringify(s)) && seen.add(JSON.stringify(s)));
}

async function main() {
  const summary: { case: string; states: number; setSize: number; setMs: number; firstMs: number; totalMs: number }[] = [];
  const eng = await englandSchools();
  if (RANDOM) cases.push(...(await randomCases(RANDOM)));
  for (const c of cases) {
    const [urn, phase, ...rest] = c.split(":");
    const spec = rest.join(":");
    const school = await smtSchool(urn);
    if (!school) throw new Error(`no school ${urn}`);
    const offer = await academicOffer(school);
    const e = eng.get(urn);
    const t0 = Date.now();
    const resolvedSpec = spec === "region:own" ? `region:${school.independent ? "Independent" : "State"}` : spec;
    if (!offer.phases[phase === "gcse" ? "gcse" : "post16"]) {
      console.log(`${c}  skipped: no ${phase}`);
      continue;
    }
    const set = await setFor(urn, phase as "gcse" | "post16", resolvedSpec, e?.regionCode ?? null, e?.regionName ?? null);
    const setMs = Date.now() - t0;
    const dir = join(OUT, c.replace(/:/g, "_"));
    mkdirSync(dir, { recursive: true });
    const states = statesFor(offer, phase as "gcse" | "post16");
    let firstMs = 0;
    const t1 = Date.now();
    for (const [i, st] of states.entries()) {
      const s0 = Date.now();
      const a = await buildAcademic(school, st, set);
      const ms = Date.now() - s0;
      if (i === 0) firstMs = ms;
      const name = [st.mode, st.phase === "post16" ? st.group + (st.group === "applied" ? "-" + st.applied : "") : (st.area ?? "whole")].join("_");
      writeFileSync(join(dir, name + ".json"), JSON.stringify(a));
      console.log(`${c}  ${name}  ${ms} ms`);
    }
    summary.push({ case: c, states: states.length, setSize: set.urns.length, setMs, firstMs, totalMs: Date.now() - t1 });
  }
  console.table(summary);
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
