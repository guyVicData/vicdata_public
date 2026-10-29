// VicData 0.7 admissions r2: what each screen draws, built on the server from the round 1
// libraries (cohort, ladder, shares, flags, ranks, shape). The browser never recomputes a figure:
// it draws these. Server-only. Every figure is public census, births or results data; nothing
// here is per user (the lists that choose the sets arrive from the caller's own token).
import { CURRENT_CENSUS_PERIOD, type AgeGenderCounts } from "../roll-data";
import { lookupReferenceData } from "../vicdata-reference";
import { createServerAnonSupabaseClient } from "../supabase";
import { cachedReference } from "../server-cache";
import { TREND_BASE_PERIOD } from "@/catalogue/notes";
import { cohortAt, type CohortTable, type Sex } from "./cohort";
import { CENSUS_FIRST_PERIOD, cachedCensus, fetchBirthsByLa, type SchoolCensus } from "./data";
import type { EntryPoint } from "./entry-points";
import { academicBirths, BIRTH_SEX_SHARE, type Ladder } from "./ladder";
import { blendBirths } from "./blend";
import { feederFlags } from "./feeders";
import { pctChange, type Flag } from "./flags";
import { sizePlaces } from "./ranks";
import { shapeOf } from "./shape";
import { indexTo } from "../index-base";
import type { SchoolTraits } from "./traits";
import { ROLL_DIRECTION_SPAN } from "@/catalogue/years";

const P = CURRENT_CENSUS_PERIOD;
type Pt = { year: number; value: number | null };

/** A single school's roll in one census year (every age, both sexes), as the shape and size
 * pieces read it; null where it has no census that year. */
export function rollOf(c: SchoolCensus | undefined, year: number, sex: Sex = "all"): number | null {
  const counts = c?.ageGenderByPeriod.get(year);
  if (!counts) return null;
  let t = 0;
  for (const v of counts.values()) t += sex === "female" ? v.female : sex === "male" ? v.male : v.male + v.female;
  return t > 0 ? t : null;
}

// 0.7 r3 (F3): the profiles Admissions draws (column 1's mini profile, Shape and size, the rivals'
// and the local shape) leave out age 18 and over: Year 14, always tiny. Drawing only -- the shape
// itself is the shared classifier, which already reads ages 5-17 (roll-data.ts
// SHAPE_CLASSIFICATION_MAX_AGE), so no school's shape changes and the public page is untouched.
export const PROFILE_MAX_AGE = 17;
export const profileOf = (counts: AgeGenderCounts | undefined): { age: number; female: number; male: number }[] =>
  counts ? Array.from(counts, ([age, v]) => ({ age, female: v.female, male: v.male })).filter((r) => r.age <= PROFILE_MAX_AGE).sort((a, b) => a.age - b.age) : [];

// ---------------------------------------------------------------------------------------------
// Row 1, column 1 of Pipelines: the entry point now.
export type EntryNow = {
  age: number;
  period: number;
  cohort: number | null; // the school's own count at the entry age now
  base: { period: number; cohort: number | null }; // 2019/20
  changePct: number | null;
  girls: number | null;
  boys: number | null;
  boarders: number | null; // whole school (the census has no boarders by age)
  roll: number | null;
  day: number | null; // roll - boarders
  girlsPct: number | null;
  boysPct: number | null;
  series: { period: number; cohort: number | null; female: number | null; male: number | null }[]; // the entry-cohort trend (row 2)
};

// 0.8 audit fixes (6): with the girls/boys filter on, every figure on the entry tiles and in the entry
// trend is girls' or boys' (the cohort, its change, the roll, boarders and day pupils); the girls and
// boys split itself still shows both.
export async function entryNow(urn: string, ep: EntryPoint, own: SchoolCensus | undefined, sex: Sex = "all"): Promise<EntryNow> {
  const t: CohortTable = own?.table ?? new Map();
  const series = Array.from({ length: P - CENSUS_FIRST_PERIOD + 1 }, (_, i) => CENSUS_FIRST_PERIOD + i).map((period) => ({
    period,
    cohort: cohortAt(t, ep.age, period, sex),
    female: cohortAt(t, ep.age, period, "female"),
    male: cohortAt(t, ep.age, period, "male"),
  }));
  const now = series.find((s) => s.period === P)!;
  const base = series.find((s) => s.period === CENSUS_FIRST_PERIOD)!;
  const boarders = await boardersOf(urn, sex);
  return {
    age: ep.age,
    period: P,
    cohort: now.cohort,
    base: { period: CENSUS_FIRST_PERIOD, cohort: base.cohort },
    changePct: pctChange(base.cohort, now.cohort),
    girls: now.female,
    boys: now.male,
    boarders,
    roll: rollOf(own, P, sex),
    day: rollOf(own, P, sex) !== null && boarders !== null ? rollOf(own, P, sex)! - boarders : null,
    girlsPct: (now.female ?? 0) + (now.male ?? 0) ? ((now.female ?? 0) / ((now.female ?? 0) + (now.male ?? 0))) * 100 : null,
    boysPct: (now.female ?? 0) + (now.male ?? 0) ? ((now.male ?? 0) / ((now.female ?? 0) + (now.male ?? 0))) * 100 : null,
    series,
  };
}

/** The school's boarders in the latest census (boarders_total, or male + female). */
function boardersOf(urn: string, sex: Sex = "all"): Promise<number | null> {
  return cachedReference(`adm:boarders:${urn}:${P}:${sex}`, async () => {
    const facts = await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn], breakdowns: ["boarders_total", "boarders_male", "boarders_female"], periodMin: P, periodMax: P });
    const at = (b: string) => facts.find((f) => f.breakdown === b && f.period === P)?.value_numeric ?? null;
    if (sex !== "all") return at(`boarders_${sex}`);
    const total = at("boarders_total");
    if (total !== null) return total;
    const m = at("boarders_male");
    const f = at("boarders_female");
    return m === null && f === null ? null : (m ?? 0) + (f ?? 0);
  });
}

// ---------------------------------------------------------------------------------------------
// The feeder table and map: each school in the nearest rung's set (the schools holding the
// cohort a year before entry; Reception's schools at 4+), its pupils at that age now and two
// years ago, its flag against the set (R-ADM-FLAG-FEEDER, the same function as the pipeline's
// feeder flags), distance, sector, gender and XS-XL.
export type FeederRow = {
  urn: string;
  name: string;
  pupils: number | null;
  before: number | null;
  changePct: number | null;
  flag: Flag | null;
  distanceKm: number | null;
  sector: "state" | "independent" | null;
  gender: "mixed" | "girls" | "boys" | null;
  boarding: boolean;
  laName: string | null;
  size: string | null; // XS-XL in the school's own phase band
  easting: number | null;
  northing: number | null;
  inLists: ("day" | "boarding")[];
};
export type FeederTable = { age: number; ages: number[]; area: { from: number; to: number; changePct: number | null }; rows: FeederRow[] };

export const distanceKm = (a: { easting: number | null; northing: number | null } | undefined, b: { easting: number | null; northing: number | null } | undefined): number | null =>
  a?.easting == null || a.northing == null || b?.easting == null || b.northing == null ? null : Math.hypot(a.easting - b.easting, a.northing - b.northing) / 1000;

export async function feederTable(
  urn: string,
  ep: EntryPoint,
  sets: { age: number; urns: string[] }[],
  traits: Map<string, SchoolTraits>,
  minCohort: number,
  lists: { day: string[]; boarding: string[] },
  sex: Sex = "all",
): Promise<FeederTable> {
  const age = Math.max(4, ep.age - 1);
  const set = sets.find((s) => s.age === age) ?? sets.find((s) => s.age === Math.min(...sets.map((x) => x.age)));
  const urns = (set?.urns ?? []).filter((u) => u !== urn);
  const ages = sets.filter((s) => s.urns.join() === (set?.urns ?? []).join()).map((s) => s.age);
  const census = await cachedCensus(urns);
  const tables = new Map(urns.map((u) => [u, census.get(u)?.table ?? new Map()]));
  const flags = feederFlags(tables, [age], P, minCohort, sex);
  let from = 0;
  let to = 0;
  for (const f of flags) if (f.from !== null && f.to !== null) { from += f.from; to += f.to; }
  const bandFor = (u: string) => {
    const t = traits.get(u);
    const hi = t?.high ?? 0;
    return hi <= 11 ? "primary" : hi <= 16 ? "secondary" : "secondary";
  };
  const byBand = new Map<string, string[]>();
  for (const u of urns) (byBand.get(bandFor(u)) ?? byBand.set(bandFor(u), []).get(bandFor(u))!).push(u);
  const sizes = new Map<string, string | null>();
  await Promise.all(Array.from(byBand, async ([band, list]) => {
    const p = await sizePlaces(band as "primary" | "secondary", list, traits.get(urn)?.laName ?? null);
    for (const u of list) sizes.set(u, p.get(u)?.badge ?? null);
  }));
  const me = traits.get(urn);
  const rows: FeederRow[] = flags.map((f) => {
    const t = traits.get(f.urn);
    return {
      urn: f.urn,
      name: t?.name ?? f.urn,
      pupils: f.to,
      before: f.from,
      changePct: pctChange(f.from, f.to),
      flag: f.flag,
      distanceKm: distanceKm(me, t),
      sector: t?.sector ?? null,
      gender: t?.gender ?? null,
      boarding: t?.boarding ?? false,
      laName: t?.laName ?? null,
      size: sizes.get(f.urn) ?? null,
      easting: t?.easting ?? null,
      northing: t?.northing ?? null,
      inLists: [...(lists.day.includes(f.urn) ? ["day" as const] : []), ...(lists.boarding.includes(f.urn) ? ["boarding" as const] : [])],
    };
  });
  rows.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  return { age, ages, area: { from, to, changePct: pctChange(from, to) }, rows };
}

// ---------------------------------------------------------------------------------------------
// 0.8 Admissions feedback round 1 (F-13): the funnel ("From births to your Year 7", one LA or the lead's
// blend) is rebuilt as "Why did our intake change?" over the school's catchment radius: intake.ts.

// ---------------------------------------------------------------------------------------------
// Pool trends, indexed: the feeders' pool (the past pools, same method) against the same age
// across the school's LA and England. LA and England come from age_profile_aggregates (pupils by
// single age 5-15, per LA and region, per census year) for the years it holds; England is the sum
// of the nine regions. Ages outside 5-15 (4+ reads age 3) have no area line.
// 0.7 r2b (E3): `pastAreaYears` -- the years before the latest that the LA or England line
// draws. The aggregates for past years were built from today's schools table, so they count only
// schools still open and slightly undercount (ADMISSIONS_NOTES.areaUndercount).
export type PoolTrends = { age: number; feeders: Pt[]; la: Pt[]; england: Pt[]; laName: string | null; areaYears: number[]; pastAreaYears: number[]; base: number | null; indexed: { feeders: Pt[]; la: Pt[]; england: Pt[] } };

/** Series indexed to 100 at their first common year: the one helper, in lib/index-base (0.8 audit fixes, 4). */
export { indexTo };

export async function poolTrends(ep: EntryPoint, ladder: Ladder, laName: string | null): Promise<PoolTrends> {
  const age = ep.age - 1;
  const feeders = ladder.past.filter((p) => p.source === "counted").map((p) => ({ year: (p.censusPeriod ?? p.entryYear - 1), value: p.pool }));
  const area = age >= 5 && age <= 15 ? await areaByAge() : [];
  const la = laName ? area.filter((r) => r.scope === "la" && r.key === laName).map((r) => ({ year: r.period, value: r.byAge[String(age)] ?? null })) : [];
  const years = Array.from(new Set(area.filter((r) => r.scope === "region").map((r) => r.period))).sort((a, b) => a - b);
  const england = years.map((y) => {
    const rows = area.filter((r) => r.scope === "region" && r.period === y);
    return { year: y, value: rows.length === 9 ? rows.reduce((s, r) => s + (r.byAge[String(age)] ?? 0), 0) : null };
  });
  const laSorted = la.sort((a, b) => a.year - b.year);
  const ix = indexTo([feeders, laSorted, england]);
  const latest = years.length ? years[years.length - 1] : null;
  const pastAreaYears = Array.from(new Set([...laSorted, ...england].filter((x) => x.value !== null && latest !== null && x.year < latest).map((x) => x.year))).sort((a, b) => a - b);
  return { age, feeders, la: laSorted, england, laName, areaYears: years, pastAreaYears, base: ix.base, indexed: { feeders: ix.out[0], la: ix.out[1], england: ix.out[2] } };
}

export function areaByAge(): Promise<{ scope: string; key: string; period: number; byAge: Record<string, number>; schools: number }[]> {
  return cachedReference("adm:age-profile-aggregates", async () => {
    const supabase = createServerAnonSupabaseClient();
    const out: { scope: string; key: string; period: number; byAge: Record<string, number>; schools: number }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("age_profile_aggregates").select("scope, scope_key, period, by_age, school_count").order("id").range(from, from + 999);
      if (error) throw error;
      for (const r of (data ?? []) as { scope: string; scope_key: string; period: number; by_age: Record<string, number>; school_count: number | null }[]) out.push({ scope: r.scope, key: r.scope_key, period: r.period, byAge: r.by_age, schools: r.school_count ?? 0 });
      if (!data || data.length < 1000) break;
    }
    return out;
  });
}

// ---------------------------------------------------------------------------------------------
// Market share and rivals: what the round 1 shares and ranks don't carry -- each school's whole
// roll (and its rank by it), its traits for "this group", and its change at the entry age over 3
// census years (R-ROLL-WORDS-3YR; the momentum scatter's x; the results change, its y, since 2022/23,
// is from the same headline population the flags read).
export type RivalExtra = {
  urn: string;
  roll: number | null;
  rollRank: number | null;
  entryNow: number | null;
  entryBase: number | null;
  entryBasePeriod: number | null; // 3 census years back, or the school's first if fewer (R-ROLL-WORDS-3YR)
  entryChangePct: number | null;
  // Girls and boys together whatever the filter: the momentum scatter, which sets pupils against
  // results (never split by sex), reads these (0.8 audit fixes, 6).
  entryChangePctAll: number | null;
  traits: Pick<SchoolTraits, "sector" | "gender" | "boarding" | "laName" | "easting" | "northing"> | null;
  distanceKm: number | null;
  shape: string | null;
  profile: { age: number; female: number; male: number }[];
};

export function rivalExtras(urn: string, urns: string[], census: Map<string, SchoolCensus>, traits: Map<string, SchoolTraits>, ep: EntryPoint, sex: Sex = "all"): RivalExtra[] {
  const rolls = urns.map((u) => ({ u, r: rollOf(census.get(u), P, sex) }));
  const me = traits.get(urn);
  return urns.map((u) => {
    const c = census.get(u);
    const t = traits.get(u);
    const roll = rolls.find((x) => x.u === u)!.r;
    const table = c?.table ?? new Map();
    const now = cohortAt(table, ep.age, P, sex);
    // R-ROLL-WORDS-3YR: 3 census years back, or the longest span the school has.
    const from = [...table.keys()].filter((y) => y >= P - ROLL_DIRECTION_SPAN && y < P && cohortAt(table, ep.age, y) !== null).sort((a, b) => a - b)[0] ?? null;
    const base = from === null ? null : cohortAt(table, ep.age, from, sex);
    return {
      urn: u,
      roll,
      rollRank: roll === null ? null : 1 + rolls.filter((x) => x.r !== null && x.r > roll).length,
      entryNow: now,
      entryBase: base,
      entryBasePeriod: from,
      entryChangePct: pctChange(base, now),
      entryChangePctAll: from === null ? null : pctChange(cohortAt(table, ep.age, from), cohortAt(table, ep.age, P)),
      traits: t ? { sector: t.sector, gender: t.gender, boarding: t.boarding, laName: t.laName, easting: t.easting, northing: t.northing } : null,
      distanceKm: u === urn ? 0 : distanceKm(me, t),
      shape: c ? shapeOf(c.ageGender) : null,
      profile: profileOf(c?.ageGender),
    };
  });
}

export { TREND_BASE_PERIOD };

// ---------------------------------------------------------------------------------------------
// FE colleges (Guy's round 2 decision 6): a college has no school census, so its own 16+ figures
// come from the existing FE participation data (ILR, dfe_fe_participation / _academy), labelled as
// that source. ILR counts every learner under 19 over a whole year; the census counts pupils of
// one age on one January day. They don't measure the same thing, so a college's ILR figure is
// shown as its own series and never divided into a census group's total (no share, no rank).
export type FeParticipation = { source: "ilr"; label: string; series: Pt[] } | null;
export const FE_SOURCE_LABEL = "FE participation data (ILR): learners under 19 over the whole year. A different source from the school census, so it is not compared with schools' Year 12.";

export function feParticipation(urn: string, typeGroup: string | null): Promise<FeParticipation> {
  return cachedReference(`adm:fe:${urn}`, async () => {
    if (typeGroup && !/college|further education|sixth form|post 16/i.test(typeGroup)) return null;
    const byYear = new Map<number, number>();
    for (const sourceId of ["dfe_fe_participation", "dfe_fe_participation_academy"]) {
      const facts = await lookupReferenceData({ sourceId, entityIds: [urn], breakdowns: ["education_and_training_under_19_total"] });
      for (const f of facts) if (f.value_numeric !== null && !byYear.has(f.period)) byYear.set(f.period, f.value_numeric);
    }
    if (!byYear.size) return null;
    return { source: "ilr", label: FE_SOURCE_LABEL, series: Array.from(byYear, ([year, value]) => ({ year, value })).sort((a, b) => a.year - b.year) };
  });
}
