// VicData 0.7 admissions (A4): the rivals -- each one's (and the school's own) regional and
// national ranks on results and size, its momentum flags, the school's strengths and
// weaknesses against them by subject area, and the rivals' academic view for the entry point
// (4+ -> KS2, 11+ -> GCSE, 16+ -> Post-16). Server-only.
//
// Honest gaps: a school with no published results for the entry point's stage says "no
// published results" (most preps at KS2); at 11+ an IGCSE-heavy independent school is listed
// but not ranked (igcseExclusionLikely, the existing GCSE rule).
import { cachedReference } from "../server-cache";
import { lookupAcademicCurrentPeriods, lookupAcademicHeadline } from "../vicdata-reference";
import { igcseExclusionLikely, type AcademicSchoolProfile, type KsStage } from "../academic-data-view";
import { CURRENT_CENSUS_PERIOD, type AgeBandKey } from "../roll-data";
import { TREND_BASE_PERIOD } from "@/catalogue/notes";
import { cohortAt } from "./cohort";
import { cachedCensus, fetchSchoolInfo } from "./data";
import type { EntryPoint } from "./entry-points";
import { familyPlaces, familyPopulation, headlinePlaces, headlinePopulation, sizePlaces, type Place, type SizePlace } from "./ranks";
import { defaultRivals, nearbyCandidates } from "./rungs";
import { shapeOf } from "./shape";
import { loadThresholds, phaseForEntryAge, type Thresholds } from "./thresholds";
import { subjectRanking, type RankMeasure } from "../subject-ranking";
import { cachedRankingPopulation } from "../chooser-sets";
import { defaultRankingFilters, matchesRanking, NATIONAL } from "../comparator-chooser";
import { entryYearShrinking, gainingPupils, losingPupils, newSixthForm, pointsChange, resultsRisingFast, shapeChanged, strengthFlags, type Flag } from "./flags";

export const MIN_AREA_ENTRIES = 10; // a subject area needs this many entries to be ranked

export const stageForEntry = (age: number): KsStage => (age <= 10 ? "ks2" : age <= 15 ? "ks4" : "ks5");
const bandForEntry = (age: number): AgeBandKey => (age <= 4 ? "early_years" : age <= 10 ? "primary" : age <= 15 ? "secondary" : "sixth_form");

export type RivalRow = {
  urn: string;
  name: string;
  isSchool: boolean;
  results: Place & { note: "no_published_results" | "igcse_not_ranked" | null };
  size: SizePlace | null;
  shape: string | null;
  momentum: Flag[];
};
export type AreaRow = { familyId: string; mine: number; rank: number; of: number; gap: number; gapSince2223: number | null; place: Place | null; flags: Flag[] };

export type Rivals = {
  urn: string;
  entry: EntryPoint;
  stage: KsStage;
  resultsPeriod: number | null;
  censusPeriod: number;
  rows: RivalRow[];
  areas: AreaRow[];
  thresholds: "loaded" | "not_loaded";
};

async function latestResultsPeriod(stage: KsStage): Promise<number | null> {
  if (stage === "ks2") {
    const pop = await headlinePopulation("ks2", CURRENT_CENSUS_PERIOD - 1);
    let max = -Infinity;
    for (const byP of pop.values()) for (const p of byP.keys()) max = Math.max(max, p);
    return Number.isFinite(max) ? max : null;
  }
  return (await cachedReference("phases:current-periods", () => lookupAcademicCurrentPeriods()))[stage] ?? null;
}

// opts.thresholds: tests pass the ingest dry run's values before the table is applied.
export async function buildRivals(urn: string, entry: EntryPoint, opts: { rivals?: string[]; thresholds?: Thresholds } = {}): Promise<Rivals> {
  const rivals = (opts.rivals ?? defaultRivals(entry, await nearbyCandidates(urn))).filter((u) => u !== urn);
  const urns = [urn, ...rivals];
  const stage = stageForEntry(entry.age);
  const phase = phaseForEntryAge(entry.age);
  const [period, census, info, thresholds] = await Promise.all([latestResultsPeriod(stage), cachedCensus(urns), fetchSchoolInfo(urns), opts.thresholds !== undefined ? Promise.resolve(opts.thresholds) : (loadThresholds() as Promise<Thresholds>)]);
  const P = CURRENT_CENSUS_PERIOD;
  const [heads, sizes, headPop] = await Promise.all([
    period === null ? Promise.resolve(new Map<string, Place>()) : headlinePlaces(stage, period, urns),
    sizePlaces(bandForEntry(entry.age), urns, info.get(urn)?.laName ?? null),
    period === null ? Promise.resolve(new Map<string, Map<number, number>>()) : headlinePopulation(stage, period),
  ]);

  // At 11+, the existing IGCSE rule on each school's own GCSE rows.
  const igcse = new Set<string>();
  if (stage === "ks4") {
    const key = [...urns].sort().join(",");
    const rows = await cachedReference(`adm:ks4-headline:${key}`, () => lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4" }));
    for (const u of urns) {
      const ks4 = rows.filter((r) => r.entity_id === u).map((r) => ({ period: r.period, measures: r.measures })).sort((a, b) => a.period - b.period);
      const profile = { establishmentTypeGroup: (await groupOf(u)) ?? null, ks4 } as unknown as AcademicSchoolProfile;
      if (igcseExclusionLikely(profile)) igcse.add(u);
    }
  }

  const rollOf = (u: string, y: number) => {
    const c = census.get(u)?.ageGenderByPeriod.get(y);
    if (!c) return null;
    let t = 0;
    for (const v of c.values()) t += v.male + v.female;
    return t > 0 ? t : null;
  };
  const rows: RivalRow[] = urns.map((u) => {
    const head = heads.get(u) ?? { value: null, period, national: null, regional: null };
    const note = igcse.has(u) ? ("igcse_not_ranked" as const) : head.value === null ? ("no_published_results" as const) : null;
    const results = note === "igcse_not_ranked" ? { ...head, national: null, regional: null, note } : { ...head, note };
    const t = census.get(u)?.table ?? new Map();
    const momentum: Flag[] = [];
    if (thresholds) {
      const hp = headPop.get(u);
      const entryNow = cohortAt(t, entry.age, P);
      const f1 = period === null ? null : resultsRisingFast({ from: hp?.get(period - 2) ?? null, to: hp?.get(period) ?? null, fromYear: period - 2, toYear: period }, thresholds.get(phase, "headline"), entryNow);
      const f2 = gainingPupils({ from: rollOf(u, P - 2), to: rollOf(u, P), fromYear: P - 2, toYear: P }, thresholds.get(phase, "roll"));
      const minCohort = thresholds.get(phase, "roll")?.minCohort ?? 10;
      const f3 = losingPupils(Array.from({ length: 4 }, (_, i) => ({ year: P - 3 + i, roll: rollOf(u, P - 3 + i) })), minCohort);
      const f4 = entryYearShrinking({ from: cohortAt(t, entry.age, P - 2), to: entryNow, fromYear: P - 2, toYear: P, age: entry.age }, thresholds.get(phase, "entry_cohort"));
      const f5 = entry.age >= 11 ? newSixthForm(Array.from({ length: 7 }, (_, i) => ({ year: P - 6 + i, count: cohortAt(t, 16, P - 6 + i) })), P, minCohort) : null;
      for (const f of [f1, f2, f3, f4, f5]) if (f) momentum.push(f);
    }
    const shapes = [P - 3, P - 2, P - 1, P].map((y) => ({ year: y, shape: census.get(u)?.ageGenderByPeriod.get(y) ? shapeOf(census.get(u)!.ageGenderByPeriod.get(y)!) : null }));
    const sc = shapeChanged(shapes, P);
    if (sc) momentum.push(sc); // a described change, not a threshold
    return { urn: u, name: info.get(u)?.name ?? u, isSchool: u === urn, results, size: sizes.get(u) ?? null, shape: shapes.at(-1)?.shape ?? null, momentum };
  });

  // Strengths and weaknesses by subject area (GCSE and Post-16 only: KS2 has no subject areas).
  const areas: AreaRow[] = [];
  if (period !== null && (stage === "ks4" || stage === "ks5")) {
    const fam = await familyPopulation(stage, period, Array.from(headPop.keys()).sort());
    const figure = (u: string, f: string, y: number) => {
      const x = fam.get(u)?.get(f)?.get(y);
      return x && x.avg !== null && x.entries >= MIN_AREA_ENTRIES ? x.avg : null;
    };
    const ranked = urns.filter((u) => !igcse.has(u));
    for (const f of Array.from(fam.get(urn)?.keys() ?? []).sort()) {
      const mine = figure(urn, f, period);
      if (mine === null) continue;
      const rivalVals = ranked.filter((u) => u !== urn).map((u) => figure(u, f, period)).filter((v): v is number => v !== null);
      if (rivalVals.length === 0) continue;
      const avg = rivalVals.reduce((a, b) => a + b, 0) / rivalVals.length;
      const baseMine = figure(urn, f, TREND_BASE_PERIOD);
      const baseRivals = ranked.filter((u) => u !== urn).map((u) => figure(u, f, TREND_BASE_PERIOD)).filter((v): v is number => v !== null);
      const gapBase = baseMine === null || baseRivals.length === 0 ? null : baseMine - baseRivals.reduce((a, b) => a + b, 0) / baseRivals.length;
      const rank = 1 + rivalVals.filter((v) => v > mine).length;
      const flags = strengthFlags({ mine, rivals: rivalVals, rank, gapNow: mine - avg, gapBase, myTwoYearChange: pointsChange(figure(urn, f, period - 2), mine) }, thresholds?.get(phase, "subject_area") ?? null);
      areas.push({ familyId: f, mine, rank, of: rivalVals.length + 1, gap: mine - avg, gapSince2223: gapBase === null ? null : mine - avg - gapBase, place: null, flags });
    }
    const places = await Promise.all(areas.map((a) => familyPlaces(stage, period, a.familyId, [urn], MIN_AREA_ENTRIES)));
    areas.forEach((a, i) => (a.place = places[i].get(urn) ?? null));
  }

  return { urn, entry, stage, resultsPeriod: period, censusPeriod: P, rows, areas, thresholds: thresholds ? "loaded" : "not_loaded" };
}

/** With a subject in view: each school's national and regional rank on it, from 0.6.6's
 * subjectRanking (the whole population, the measure in view), the school as the target. */
export async function subjectPlaces(urns: string[], phase: "ks4" | "ks5", subject: { subject: string; familyId: string | null; qualificationType: string | null; measure: RankMeasure }): Promise<Map<string, { national: { rank: number | null; of: number }; regional: { rank: number | null; of: number; region: string } | null; value: number | null }>> {
  const { englandSchools } = await import("./ranks");
  const england = await englandSchools();
  const nation = (await cachedRankingPopulation(null, phase, null)).filter((r) => matchesRanking(r, defaultRankingFilters(NATIONAL))).map((r) => r[0]);
  const out = new Map<string, { national: { rank: number | null; of: number }; regional: { rank: number | null; of: number; region: string } | null; value: number | null }>();
  for (const u of urns) {
    const base = { targetUrn: u, phase, subject: subject.subject, familyId: subject.familyId, qualificationType: subject.qualificationType, measure: subject.measure, period: null };
    const nat = await subjectRanking({ ...base, urns: nation }, `adm:nation:${phase}`);
    const place = england.get(u);
    let regional = null;
    if (place) {
      const reg = (await cachedRankingPopulation(place.regionCode, phase, null)).map((r) => r[0]);
      const r = await subjectRanking({ ...base, urns: reg }, `adm:region:${place.regionCode}:${phase}`);
      regional = { rank: r.targetRank, of: r.ranked, region: place.regionName };
    }
    out.set(u, { national: { rank: nat.targetRank, of: nat.ranked }, regional, value: nat.target?.value ?? null });
  }
  return out;
}

async function groupOf(urn: string): Promise<string | null> {
  const { englandSchools } = await import("./ranks");
  return (await englandSchools()).get(urn)?.group ?? null;
}
