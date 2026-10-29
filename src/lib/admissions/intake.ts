// VicData 0.8 Admissions feedback round 1 (F-13): the data behind "Why did our intake change?" and "Local
// births" -- one area, the school's catchment radius (src/lib/smt/catchment.ts: the view's own ?km=, else
// the school's saved catchment, else 15 km for an independent school or a state school's density radius),
// the same area SMT Context draws. Never the feeder list. Server-only.
//
//   births / cohort size   ONS small-area population (LSOAs whose population-weighted centre is within
//                          the radius: the ingest's area_context), at age 0 -- or, where the LSOA years
//                          don't reach the base cohort's birth year, the youngest age held (birthsAge)
//   area Y6 (16+: Y11)     the same LSOAs at the age a year below entry, the mid-year before entry
//   the school's Y7 (Y12)  its own January census at the entry age (cohort.ts)
//
// Local births: the LSOAs' age 0 by mid-year, indexed to the first year against the school's region and
// England (ONS mid-year estimates at age 0, the LAs summed), with the Year 7 (Year 12) entry year each
// birth year reaches. R-ADM-INTAKE-CHANGE, R-ADM-LOCAL-BIRTHS.
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";
import { lookupReferenceData } from "../vicdata-reference";
import { areaContext, englandPopulation, laCodes, type AreaContextData } from "../smt/area-data";
import { catchmentHowWords, catchmentPresets, kmWord, resolveCatchment, type Catchment, type DensityPhase } from "../smt/catchment";
import { withDensity } from "../smt/catchment-density";
import { englandSchools } from "./ranks";
import { cachedCensus } from "./data";
import { cohortAt, type CohortTable } from "./cohort";
import { fetchSchoolTraits } from "./traits";
import type { EntryPoint } from "./entry-points";
import { CENSUS_FIRST_PERIOD, CURRENT_CENSUS_PERIOD } from "@/catalogue/years";
import { birthsAge, endYears, isSmallIntake, meanOf, midYearAt, splitIntake, type IntakeEnd, type IntakeSplit } from "./intake-change";

export type IntakeArea = {
  km: number;
  usualKm: number; // the school's saved catchment (within its cap), else its default
  capKm: number;
  presets: number[];
  schoolName: string;
  from: Catchment["from"];
  rule: Catchment["rule"] | null;
  how: string; // the (i)'s sentence on how the radius was set
  label: string; // "15 km around Leighton Park School"
  lsoaCount: number;
  firstYear: number | null; // the earliest LSOA mid-year held
  lastYear: number | null;
  suppressed: boolean;
  boarding: boolean;
  independent: boolean;
};

export type IntakeChangeView =
  | {
      status: "ok";
      area: IntakeArea;
      entryAge: number;
      areaAge: number; // the age a year below entry (Y6 = 10, Y11 = 15)
      birthsAge: number; // 0, or the youngest age held standing in for births
      baseYear: number;
      latestYear: number;
      averaged: boolean;
      years: { base: number[]; latest: number[] }; // census periods averaged at each end
      birthYears: { base: number[]; latest: number[] }; // the LSOA mid-years read for births at each end
      ends: { base: IntakeEnd; latest: IntakeEnd };
      split: IntakeSplit;
    }
  | { status: "none"; reason: string; area: IntakeArea | null };

export type LocalBirthsView =
  | {
      status: "ok";
      area: IntakeArea;
      entryAge: number;
      regionName: string | null;
      base: number; // the year indexed to 100
      rows: { year: number; entryYear: number; catchment: number | null; region: number | null; england: number | null }[];
      indexed: { catchment: { year: number; value: number | null }[]; region: { year: number; value: number | null }[]; england: { year: number; value: number | null }[] };
    }
  | { status: "none"; reason: string; area: IntakeArea | null };

type AreaRead = { area: IntakeArea; ctx: AreaContextData | null; table: CohortTable; latestCensus: number | null };

async function readArea(urn: string, opts: { km?: unknown; savedKm: number | null }): Promise<AreaRead | null> {
  const [traits, census] = await Promise.all([fetchSchoolTraits([urn]), cachedCensus([urn])]);
  const t = traits.get(urn);
  if (!t) return null;
  const independent = t.sector === "independent";
  const school = await withDensity(urn, { independent, low: t.low, high: t.high, phases: { post16: (t.high ?? 0) >= 18 } });
  const c = resolveCatchment(school, opts.km ?? null, opts.savedKm);
  const ctx = await areaContext(urn, c.km).catch(() => null);
  const years = ctx?.years.map((y) => y.year) ?? [];
  return {
    area: {
      km: c.km,
      usualKm: c.savedKm !== null ? Math.min(c.savedKm, c.capKm) : c.defaultKm,
      capKm: c.capKm,
      presets: catchmentPresets(school),
      schoolName: t.name,
      from: c.from,
      rule: c.rule ?? null,
      how: catchmentHowWords(c, school.densityPhase as DensityPhase | null),
      label: `${kmWord(c.km)} around ${t.name}`,
      lsoaCount: ctx?.lsoaCount ?? 0,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      suppressed: ctx?.suppressed ?? false,
      boarding: t.boarding,
      independent,
    },
    ctx,
    table: census.get(urn)?.table ?? new Map(),
    latestCensus: census.get(urn)?.latestPeriod ?? null,
  };
}

/** "Why did our intake change?" for one entry point. 4+ has no funnel. */
export async function intakeChange(urn: string, ep: EntryPoint, opts: { km?: unknown; savedKm: number | null }): Promise<IntakeChangeView> {
  if (ep.age <= 4) return { status: "none", reason: "No funnel at 4+.", area: null };
  const r = await readArea(urn, opts);
  if (!r) return { status: "none", reason: "This school isn't in the schools list.", area: null };
  const { area, ctx, table } = r;
  if (!ctx || area.firstYear === null || area.lastYear === null) return { status: "none", reason: "No small-area population figures around this school.", area };
  const A = ep.age;
  const areaAge = A - 1;
  const at = (mid: number, age: number) => ctx.years.find((y) => y.year === mid)?.children[age] ?? null;
  const baseYear = CENSUS_FIRST_PERIOD;
  // The latest entry year with both the school's census and the area's year before it.
  const latestYear = Math.min(CURRENT_CENSUS_PERIOD, r.latestCensus ?? CURRENT_CENSUS_PERIOD, area.lastYear + 1);
  const bAge = birthsAge(A, baseYear, area.firstYear);
  if (bAge === null) return { status: "none", reason: "The area's population figures don't go back far enough for this entry point.", area };
  const averaged = isSmallIntake(cohortAt(table, A, baseYear), cohortAt(table, A, latestYear));
  const years = endYears(baseYear, latestYear, averaged);
  const endOf = (ys: number[]): IntakeEnd | null => {
    const births = meanOf(ys.map((E) => at(midYearAt(E, A, bAge), bAge)));
    const areaY = meanOf(ys.map((E) => at(E - 1, areaAge)));
    const school = meanOf(ys.map((E) => cohortAt(table, A, E)));
    return births === null || areaY === null || school === null ? null : { births, area: areaY, school };
  };
  const base = endOf(years.base);
  const latest = endOf(years.latest);
  const split = base && latest ? splitIntake(base, latest) : null;
  if (!base || !latest || !split) return { status: "none", reason: "A figure is missing at one end (the school's census, or the area's population).", area };
  return {
    status: "ok",
    area,
    entryAge: A,
    areaAge,
    birthsAge: bAge,
    baseYear,
    latestYear,
    averaged,
    years,
    birthYears: { base: years.base.map((E) => midYearAt(E, A, bAge)), latest: years.latest.map((E) => midYearAt(E, A, bAge)) },
    ends: { base, latest },
    split,
  };
}

/** ONS mid-year estimates at age 0, the LAs summed, per year: the school's region. */
function regionBirths(regionName: string): Promise<Map<number, number>> {
  return cachedReference(`adm:region-age0:${regionName}`, async () => {
    const { data } = await createServerAnonSupabaseClient().from("la_gss_crosswalk").select("dfe_code").eq("region", regionName);
    const dfe = Array.from(new Set(((data ?? []) as { dfe_code: string }[]).map((r) => r.dfe_code)));
    const districts = Array.from(new Set((await Promise.all(dfe.map((d) => laCodes(d)))).flatMap((c) => c.districts)));
    const out = new Map<number, number>();
    if (!districts.length) return out;
    const facts = await lookupReferenceData({ sourceId: "ons_population_age", entityIds: districts, breakdowns: ["age:0"] });
    const seen = new Map<number, Set<string>>();
    for (const f of facts) {
      if (f.value_numeric === null) continue;
      out.set(f.period, (out.get(f.period) ?? 0) + f.value_numeric);
      (seen.get(f.period) ?? seen.set(f.period, new Set()).get(f.period)!).add(f.entity_id);
    }
    // A year only where every district has it.
    for (const [y, s] of seen) if (s.size < districts.length) out.delete(y);
    return out;
  });
}

/** Local births: the catchment's age 0 by mid-year, against the region and England, indexed. */
export async function localBirths(urn: string, ep: EntryPoint, opts: { km?: unknown; savedKm: number | null }): Promise<LocalBirthsView> {
  const r = await readArea(urn, opts);
  if (!r) return { status: "none", reason: "This school isn't in the schools list.", area: null };
  if (!r.ctx || !r.ctx.years.length) return { status: "none", reason: "No small-area population figures around this school.", area: r.area };
  const regionName = (await englandSchools()).get(urn)?.regionName ?? null;
  const [region, england] = await Promise.all([regionName ? regionBirths(regionName).catch(() => new Map<number, number>()) : Promise.resolve(new Map<number, number>()), englandPopulation().catch(() => new Map<number, number[]>())]);
  const catchment = new Map(r.ctx.years.map((y) => [y.year, y.children[0] ?? null] as const));
  const years = Array.from(catchment.keys()).sort((a, b) => a - b);
  // Indexed to the first year every line has (the catchment's first, where the region and England have it).
  const base = years.find((y) => catchment.get(y) && (region.size === 0 || region.has(y)) && (england.size === 0 || england.has(y))) ?? years[0];
  const ix = (v: number | null | undefined, b: number | null | undefined) => (v === null || v === undefined || !b ? null : (100 * v) / b);
  const rows = years.map((y) => ({ year: y, entryYear: y + ep.age, catchment: catchment.get(y) ?? null, region: region.get(y) ?? null, england: england.get(y)?.[0] ?? null }));
  const b = rows.find((x) => x.year === base)!;
  return {
    status: "ok",
    area: r.area,
    entryAge: ep.age,
    regionName,
    base,
    rows,
    indexed: {
      catchment: rows.map((x) => ({ year: x.year, value: ix(x.catchment, b.catchment) })),
      region: rows.map((x) => ({ year: x.year, value: ix(x.region, b.region) })),
      england: rows.map((x) => ({ year: x.year, value: ix(x.england, b.england) })),
    },
  };
}
