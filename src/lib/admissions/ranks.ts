// VicData 0.7 admissions (A4): where each school sits regionally and nationally -- on results
// (the whole-school headline, a subject area, a subject) and on size (roll, XS-XL). Server-only.
//
// Ranks follow 0.6.6's rule (R-RANKING-MEASURE / R-RANK-TIES): every school with a figure that
// year, highest first, ties share a rank; regional ranks among the schools of the school's own
// region. A subject's rank comes from 0.6.6's subjectRanking itself. The populations are public
// reference data, read once an hour per phase (server-cache.ts), never per user or school.
import { cachedReference } from "../server-cache";
import { HEADLINE_MEASURE, type KsStage } from "../academic-data-view";
import { lookupAcademicHeadline, lookupAcademicSubjectFamily, lookupReferenceData } from "../vicdata-reference";
import { createServerAnonSupabaseClient } from "../supabase";
import { REGION_NAME_TO_ONS_CODE } from "../region-crosswalk";
import { ageGenderCountsFromCompact } from "../data-view-serialize";
import { lookupAgeBandDistributions, sizeBadgeForValue, type SizeBadge } from "../age-band-distributions";
import { AGE_BANDS, CURRENT_CENSUS_PERIOD, type AgeBandKey, type AgeGenderCounts } from "../roll-data";
import type { RegionNationRow } from "../region-nation-comparator";

export const KS2_HEADLINE = HEADLINE_MEASURE.ks2;
const FIGURE_YEARS = 3; // the latest year and the two before (two-year changes)

type ByPeriod = Map<number, number>;

/** Every school's whole-school headline by year: GCSE Attainment 8, Post-16 A-level points per
 * entry, KS2 reading/writing/maths expected standard (dfe_ks2_attainment). */
export function headlinePopulation(stage: KsStage, latest: number): Promise<Map<string, ByPeriod>> {
  return cachedReference(`adm:headline:${stage}:${latest}`, async () => {
    const out = new Map<string, ByPeriod>();
    const put = (u: string, p: number, v: number) => (out.get(u) ?? out.set(u, new Map()).get(u)!).set(p, v);
    if (stage === "ks2") {
      const facts = await lookupReferenceData({ sourceId: "dfe_ks2_attainment", breakdowns: [KS2_HEADLINE], periodMin: latest - FIGURE_YEARS + 1 });
      for (const f of facts) if (f.value_numeric !== null) put(f.entity_id, f.period, f.value_numeric);
    } else {
      const rows = await lookupAcademicHeadline({ ksStage: stage, periodMin: latest - FIGURE_YEARS + 1 });
      for (const r of rows) {
        const v = Number(r.measures[HEADLINE_MEASURE[stage]]);
        if (r.measures[HEADLINE_MEASURE[stage]] !== null && r.measures[HEADLINE_MEASURE[stage]] !== undefined && Number.isFinite(v)) put(r.entity_id, r.period, v);
      }
    }
    return out;
  });
}

export type FamilyFigure = { avg: number | null; entries: number };
/** Every school's subject-area (family) average points and entries by year, chunked by school
 * (one national read exceeds the lookup's timeout). */
export function familyPopulation(stage: "ks4" | "ks5", latest: number, urns: string[]): Promise<Map<string, Map<string, Map<number, FamilyFigure>>>> {
  return cachedReference(`adm:family:${stage}:${latest}`, async () => {
    const out = new Map<string, Map<string, Map<number, FamilyFigure>>>();
    const chunks: string[][] = [];
    for (let i = 0; i < urns.length; i += 150) chunks.push(urns.slice(i, i + 150));
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < chunks.length) {
        const c = chunks[next++];
        const rows = await lookupAcademicSubjectFamily({ entityIds: c, ksStage: stage, periodMin: latest - FIGURE_YEARS + 1 });
        for (const r of rows) {
          const byFam = out.get(r.entity_id) ?? out.set(r.entity_id, new Map()).get(r.entity_id)!;
          (byFam.get(r.family_id) ?? byFam.set(r.family_id, new Map()).get(r.family_id)!).set(r.period, { avg: r.avg_point_score === null ? null : Number(r.avg_point_score), entries: Number(r.entries_total) });
        }
      }
    }));
    return out;
  });
}

export type SchoolPlace = { regionCode: string; regionName: string; roll: number | null; counts: AgeGenderCounts; name: string; low: number | null; high: number | null; group: string | null };
/** Every school in England: its region (school_region_nation, the canonical map), and its roll
 * and age-gender counts where it has a census (region_nation_set, per region). */
export function englandSchools(): Promise<Map<string, SchoolPlace>> {
  return cachedReference(`adm:england-schools:${CURRENT_CENSUS_PERIOD}`, async () => {
    const supabase = createServerAnonSupabaseClient();
    const out = new Map<string, SchoolPlace>();
    const codes = Object.values(REGION_NAME_TO_ONS_CODE).filter((c) => c.startsWith("E12"));
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("school_region_nation").select("urn, region_code, region_name").in("region_code", codes).order("urn").range(from, from + 999);
      if (error) throw error;
      for (const r of (data ?? []) as { urn: string; region_code: string; region_name: string }[]) out.set(r.urn, { regionCode: r.region_code, regionName: r.region_name, roll: null, counts: new Map(), name: r.urn, low: null, high: null, group: null });
      if (!data || data.length < 1000) break;
    }
    await Promise.all(codes.map(async (code) => {
      const { data, error } = await supabase.rpc("region_nation_set", { p_region_code: code, p_nation: null, p_exclude_urn: "" });
      if (error) throw error;
      for (const r of (data ?? []) as RegionNationRow[]) {
        const place = out.get(r[0]);
        if (place) Object.assign(place, { roll: r[9], counts: ageGenderCountsFromCompact(r[11]), name: r[1], low: r[6], high: r[7], group: r[4] });
      }
    }));
    return out;
  });
}

/** 1-based rank of `value` among `values` (ties share; higher first), and how many there are. */
export function rankIn(values: number[], value: number): { rank: number; of: number } {
  return { rank: 1 + values.filter((v) => v > value).length, of: values.length };
}

export type Place = { value: number | null; period: number | null; national: { rank: number; of: number } | null; regional: { rank: number; of: number; region: string } | null };

// The population's values once per call; each school's national and regional place from them.
function placesOf(urns: string[], period: number, figure: (u: string) => number | null, england: Map<string, SchoolPlace>, pool: Iterable<string>): Map<string, Place> {
  const all: number[] = [];
  const byRegion = new Map<string, number[]>();
  for (const u of pool) {
    const v = figure(u);
    if (v === null) continue;
    all.push(v);
    const r = england.get(u)?.regionCode;
    if (r) (byRegion.get(r) ?? byRegion.set(r, []).get(r)!).push(v);
  }
  return new Map<string, Place>(urns.map((urn): [string, Place] => {
    const value = figure(urn);
    if (value === null) return [urn, { value: null, period, national: null, regional: null }];
    const region = england.get(urn);
    return [urn, { value, period, national: rankIn(all, value), regional: region ? { ...rankIn(byRegion.get(region.regionCode) ?? [], value), region: region.regionName } : null }];
  }));
}

/** Each school's place on the whole-school headline, nationally and in its region, in `period`. */
export async function headlinePlaces(stage: KsStage, period: number, urns: string[]): Promise<Map<string, Place>> {
  const [pop, england] = await Promise.all([headlinePopulation(stage, period), englandSchools()]);
  const fig = (u: string) => pop.get(u)?.get(period) ?? null;
  return placesOf(urns, period, fig, england, pop.keys());
}

/** Each school's place on one subject area (family average points; at least minEntries). */
export async function familyPlaces(stage: "ks4" | "ks5", period: number, familyId: string, urns: string[], minEntries: number): Promise<Map<string, Place>> {
  const [pop, england] = await Promise.all([headlinePopulation(stage, period), englandSchools()]);
  const fam = await familyPopulation(stage, period, Array.from(pop.keys()).sort());
  const fig = (u: string) => {
    const f = fam.get(u)?.get(familyId)?.get(period);
    return f && f.avg !== null && f.entries >= minEntries ? f.avg : null;
  };
  return placesOf(urns, period, fig, england, fam.keys());
}

export type SizePlace = Place & { band: AgeBandKey; badge: SizeBadge | null };
/** Each school's place by its roll in the entry point's age band (schools teaching that band),
 * with the school page's XS-XL badge for the band (national quintiles). */
export async function sizePlaces(band: AgeBandKey, urns: string[], laName: string | null): Promise<Map<string, SizePlace>> {
  const [england, dist] = await Promise.all([englandSchools(), lookupAgeBandDistributions(laName, CURRENT_CENSUS_PERIOD)]);
  const b = AGE_BANDS.find((x) => x.key === band)!;
  const bandRoll = (u: string) => {
    const c = england.get(u)?.counts;
    if (!c) return null;
    let t = 0;
    for (const [age, v] of c) if (age >= b.minAge && age <= b.maxAge) t += v.male + v.female;
    return t > 0 ? t : null;
  };
  const q = dist.get(band)?.quintiles ?? null;
  const rolls = new Map(Array.from(england.keys(), (u) => [u, bandRoll(u)]));
  const places = placesOf(urns, CURRENT_CENSUS_PERIOD, (u) => rolls.get(u) ?? null, england, england.keys());
  return new Map(urns.map((u) => {
    const p = places.get(u)!;
    return [u, { ...p, band, badge: p.value !== null && q ? sizeBadgeForValue(p.value, q) : null }];
  }));
}
