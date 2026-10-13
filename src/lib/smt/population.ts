// VicData 0.8 SMT round 1: every school's headline figures by year, for the measures SMT ranks --
// read once an hour per key stage (server-cache.ts), never per user or school. Server-only.
//
// Ranks follow 0.6.6's rule, as Admissions' do (src/lib/admissions/ranks.ts): every school with a
// figure that year, highest first, ties share a place; regional ranks within the school's own
// region. Nothing here is new arithmetic: placesOf is ranks.ts' rankIn over a population.
import { cachedReference } from "../server-cache";
import { lookupAcademicHeadline, lookupReferenceData } from "../vicdata-reference";
import { englandSchools, rankIn, type Place } from "../admissions/ranks";
import { KS2_HEADLINE } from "../admissions/ranks";
import { HISTORIC_GRADE_FROM } from "@/catalogue/years";

// The measures SMT reads, by key stage, as academic_headline_snapshot names them.
export const SMT_MEASURES = {
  ks4: { a8: "attainment8_average", em5: "engmath_95_percent", em4: "engmath_94_percent", p8: "progress8_average", p8lo: "progress8_lower_95_ci", p8hi: "progress8_upper_95_ci" },
  ks5: { aps: "A level::aps_per_entry", va: "A level::value_added", valo: "A level::value_added_lower_ci", vahi: "A level::value_added_upper_ci", band: "A level::progress_banding" },
  ks2: { rwm: KS2_HEADLINE },
} as const;

// The qualification types DfE publishes A-level-stage value added for (the headline's prefixes).
export const VA_QUALS = ["A level", "Academic", "Applied general", "Tech level"] as const;

type ByYear = Map<number, Record<string, number | string>>;
export type Population = Map<string, ByYear>;

/** Every school's headline measures by year at one key stage, from 2021/22 (the first year SMT's
 * trends draw). KS2 is dfe_ks2_attainment's reading, writing and maths figure. */
export function population(stage: "ks2" | "ks4" | "ks5"): Promise<Population> {
  return cachedReference(`smt:population:${stage}`, () => readPopulation(stage).catch(() => readPopulation(stage)));
}

// One national read; population() tries it twice (a cold national read can hit the statement timeout).
function readPopulation(stage: "ks2" | "ks4" | "ks5"): Promise<Population> {
  return (async () => {
    const out: Population = new Map();
    const put = (u: string, p: number, k: string, v: number | string) => {
      const by = out.get(u) ?? out.set(u, new Map()).get(u)!;
      (by.get(p) ?? by.set(p, {}).get(p)!)[k] = v;
    };
    if (stage === "ks2") {
      const facts = await lookupReferenceData({ sourceId: "dfe_ks2_attainment", breakdowns: [KS2_HEADLINE], periodMin: HISTORIC_GRADE_FROM + 1 });
      for (const f of facts) if (f.value_numeric !== null) put(f.entity_id, f.period, KS2_HEADLINE, f.value_numeric);
      return out;
    }
    const keep = new Set<string>(Object.values(SMT_MEASURES[stage]));
    if (stage === "ks5") for (const q of VA_QUALS) for (const k of ["value_added", "value_added_lower_ci", "value_added_upper_ci", "progress_banding"]) keep.add(`${q}::${k}`);
    const rows = await lookupAcademicHeadline({ ksStage: stage, periodMin: HISTORIC_GRADE_FROM });
    for (const r of rows) for (const [k, v] of Object.entries(r.measures)) if (keep.has(k) && v !== null && v !== undefined && v !== "") put(r.entity_id, r.period, k, v);
    return out;
  })();
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** One measure for one school in one year. */
export function figure(pop: Population, urn: string, period: number, key: string): number | null {
  return num(pop.get(urn)?.get(period)?.[key]);
}

/** Each school's national and regional place on one measure in one year: every school with a
 * figure (`exclude` taken out of the population, e.g. IGCSE schools at GCSE). */
export async function placesOn(pop: Population, period: number, key: string, urns: string[], exclude: Set<string> = new Set()): Promise<Map<string, Place>> {
  const england = await englandSchools();
  const all: number[] = [];
  const byRegion = new Map<string, number[]>();
  for (const u of pop.keys()) {
    if (exclude.has(u)) continue;
    const v = figure(pop, u, period, key);
    if (v === null) continue;
    all.push(v);
    const r = england.get(u)?.regionCode;
    if (r) (byRegion.get(r) ?? byRegion.set(r, []).get(r)!).push(v);
  }
  return new Map(urns.map((u): [string, Place] => {
    const value = figure(pop, u, period, key);
    if (value === null || exclude.has(u)) return [u, { value, period, national: null, regional: null }];
    const region = england.get(u);
    return [u, { value, period, national: rankIn(all, value), regional: region ? { ...rankIn(byRegion.get(region.regionCode) ?? [], value), region: region.regionName } : null }];
  }));
}

/** The school's rank among a set on one measure: only the set's schools with the figure (the school
 * counted too), `exclude` left out. Null when the school has no figure. */
export function setPlace(values: Map<string, number | null>, urn: string, exclude: Set<string> = new Set()): { rank: number; of: number } | null {
  const mine = values.get(urn);
  if (mine === null || mine === undefined || exclude.has(urn)) return null;
  const ranked = Array.from(values).filter(([u, v]) => v !== null && !exclude.has(u)).map(([, v]) => v as number);
  return rankIn(ranked, mine);
}

export type { Place };
