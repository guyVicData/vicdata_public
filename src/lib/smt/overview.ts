// VicData 0.8 SMT round 1: Overview (spec §2.3; wireframes Main, LeightonLight, Phone). Server-only.
// Everything here is assembled from existing reads: the census (roll, gender, boarding, bands), the
// school page's XS-XL (sizeByBand), 0.6.6's whole-population ranks (population.ts), Admissions'
// flags, area aggregates and market share. Nothing is computed in the browser.
//
// The comparison set arrives as URNs (the set Teacher's chooser resolved). Every set rank is
// level-aware: only the set's schools with the figure are ranked, and the count says so.
import { indexBaseWords } from "../index-base";
import type { SmtAdmissionsReader } from "./auth-rules";
import { CENSUS_FIRST_PERIOD, GRADING_2122_PERIOD, HISTORIC_GRADE_FROM, PROGRESS8_LAST_PERIOD, SIXTH_FORM_VA_FROM, TREND_BASE_PERIOD, periodLabel, rollDirection } from "@/catalogue/years";
import { setShortName } from "../set-short-name";
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";
import { lookupReferenceData } from "../vicdata-reference";
import { BOARDING_SCHOOL_VALUE } from "../admissions/boarding";
import { smtNote } from "@/catalogue/notes";
import { lookupAgeBandDistributions } from "../age-band-distributions";
import { AGE_BANDS, CURRENT_CENSUS_PERIOD, type RollSnapshot } from "../roll-data";
import { englandSchools, rankIn } from "../admissions/ranks";
import { igcseEngland } from "../igcse";
import { cachedCensus, fetchSchoolInfo } from "../admissions/data";
import { cohortAt } from "../admissions/cohort";
import { indexTo } from "../admissions/screens";
import { sizeByBand } from "../admissions/shape";
import { savedLists } from "../admissions/auth";
import { rivalsFromLists } from "../admissions/lists";
import { buildMarketShare } from "../admissions/market";
import { entryPoint } from "../admissions/entry-points";
import { loadThresholds, phaseForEntryAge } from "../admissions/thresholds";
import { percentile } from "../admissions/stats";
import { figure, placesOn, population, setPlace, SMT_MEASURES, type Population } from "./population";
import { schoolCensus, type SmtSchool } from "./school";
import { entryTiles, type EntryTile } from "./entry-net";
import { entryShrinking, resultsAgainstSet, rollFalling, type SmtFlag } from "./flags";

export type SmtSet = { kind: string; label: string; urns: string[] };
export type SmtFilters = { sex: "all" | "female" | "male"; boarding: "all" | "day" | "boarding" };
export const DEFAULT_SMT_FILTERS: SmtFilters = { sex: "all", boarding: "all" };

export type Rank = { rank: number; of: number };
export type Stage = "ks2" | "ks4" | "ks5";
export type Unit = "pupils" | "points" | "pct" | "va" | "share";

export type ScoreRow = {
  key: string;
  label: string;
  stage: Stage | null;
  unit: Unit;
  value: number | null;
  period: number | null;
  set: (Rank & { label: string }) | null;
  region: (Rank & { name: string }) | null;
  england: Rank | null;
  // 0.8 SMT feedback round 1 (F-3, R-TREND-PERIOD-PER-CELL): each row's trend over its own years --
  // `period` words them ("since 2022/23"; value added and Progress 8 "2023/24 → 2024/25").
  since: Trend | null;
  // Why a row has no figure or rank: "none" (no published results). F-3: an IGCSE school's GCSE rows
  // (never ranked) are left out of the table, not shown as "not ranked".
  note: "igcse" | "none" | null;
};

export type SetSize = { key: string; label: string; total: number; rank: number; of: number; median: number | null; schools: number };

/** F-10: one phase's size against the set: the school's place among the set's schools with pupils in it
 * (largest first, ties share), and the set's median. Pure. */
export function setSizeOf(own: number, set: number[]): { rank: number; of: number; median: number | null; schools: number } {
  const vals = set.filter((v) => v > 0);
  const r = rankIn([own, ...vals], own);
  return { rank: r.rank, of: r.of, median: percentile(vals, 50), schools: vals.length };
}

/** F-11: the set's average roll year by year, over its schools with a figure in every year shown (so a
 * school joining or leaving the census doesn't move the line); null with none. */
export function setAverage(series: (number | null)[][], years: number[]): { pts: Pt[]; schools: number } | null {
  const full = series.filter((s) => s.length === years.length && s.every((v) => v !== null && v > 0)) as number[][];
  if (!full.length) return null;
  return { pts: years.map((y, i) => ({ year: y, value: full.reduce((t, s) => t + s[i], 0) / full.length })), schools: full.length };
}

export type Trend = { from: number; to: number; change: number; unit: "pct" | "points" | "pp" | "va"; period: string };

/** A row's trend from `from` to `to`: "since {from}" for a series that keeps growing from a fixed start
 * (results, rolls), "{from} → {to}" for one bounded by what DfE published (value added, Progress 8). */
export function trendOf(from: number, to: number, change: number, unit: Trend["unit"], bounded = false): Trend {
  return { from, to, change, unit, period: bounded ? `${periodLabel(from)} → ${periodLabel(to)}` : `since ${periodLabel(from)}` };
}

export type Pt = { year: number; value: number | null };
export type BandPt = { year: number; p25: number | null; p75: number | null; n: number };

export type P8 =
  | { status: "published"; value: number; lo: number | null; hi: number | null; period: number; text: string }
  | { status: "independent" | "no_baseline" | "no_gcse"; text: string };

export type Overview = {
  urn: string;
  // `short`: the set's short name (setShortName), for the Scorecard's column header (F-3).
  set: { kind: string; label: string; short: string; size: number };
  // F-3: the school sits IGCSEs (its GCSE rows are left out of the Scorecard).
  igcse: boolean;
  // The school and the set's schools: names and locations (the map, the hovers).
  schools: Record<string, { name: string; easting: number | null; northing: number | null }>;
  // F-2: the map's dots and labels -- each school's whole-school roll (latest census) and its roll
  // direction (the shared 3-year rule, rollDirection: ROLL_DIRECTION_SPAN and the flat band).
  rolls: Record<string, { roll: number | null; year: number | null; trend: { dir: "up" | "down" | "flat"; word: string; pct: number; from: number; to: number } | null }>;
  filters: SmtFilters;
  now: {
    census: number | null;
    roll: number | null;
    base: { period: number; roll: number | null };
    changePct: number | null;
    girls: number | null;
    boys: number | null;
    boarding: { day: number; boarders: number } | null;
    // F-8: an independent school's entry tiles (entry-net.ts), in place of GCSE and Progress 8's.
    entry: EntryTile[] | null;
    // The school page's Roll by phase: the badge, and the means its caption compares with.
    sizes: { key: string; label: string; total: number; badge: string | null; laMean: number | null; englandMean: number | null }[];
    // 0.8 SMT feedback round 2 (F-10): each phase against the selected set -- the school's place by size
    // among the set's schools with that phase (largest first), and the set's median (school excluded).
    setSizes: SetSize[];
    laName: string | null;
  };
  rows: ScoreRow[];
  p8: P8;
  va: { value: number; lo: number | null; hi: number | null; period: number } | null;
  flags: SmtFlag[];
  flagsLoaded: boolean;
  trends: {
    // pts indexed to `base` = 100; actual the pupils behind them (the table shows both, 0.8 audit fixes, 3).
    roll: { lines: { key: string; label: string; pts: Pt[]; actual: Pt[] }[]; base: number | null; laName: string | null };
    results: { stage: "ks4" | "ks5"; label: string; school: Pt[]; band: BandPt[] }[];
    // F-7: `defaultRivals` -- Admissions hasn't chosen rivals at 11+, so they are its default, the 10
    // nearest schools teaching Year 7 (defaultRivals, the same as Admissions' own Market share).
    // 0.8 SMT feedback round 2 (F-9, R-MARKET-FOLLOWS-SET): on Overview the rivals are the selected set;
    // `setRivals` is its name. Pupils keeps round 1's (Admissions' saved rivals, else its default).
    market: { status: "ready"; school: Pt[]; rival: Pt[]; rivalName: string | null; rivals: number; defaultRivals: boolean; setRivals: string | null } | { status: "empty"; reason: string };
  };
  notes: { since: string; middleHalf: string; rollIndexed: string; trendYears: string };
};

const LAST_P8_PERIOD = PROGRESS8_LAST_PERIOD;

/** F-3: every GIAS boarding school's boarders in one census year (R-ADM-BOARDING-ONLY-WHERE-BOARDERS's
 * one test), for the boarders row's regional and national ranks. Public data, cached. */
export function boardersByUrn(period: number): Promise<Map<string, number>> {
  return cachedReference(`smt:boarders:${period}`, async () => {
    const supabase = createServerAnonSupabaseClient();
    const urns: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("schools").select("urn").eq("boarders_name", BOARDING_SCHOOL_VALUE).order("urn").range(from, from + 999);
      if (error) throw error;
      urns.push(...((data ?? []) as { urn: string }[]).map((r) => r.urn));
      if (!data || data.length < 1000) break;
    }
    const facts = urns.length ? await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: urns, periodMin: period, periodMax: period, breakdowns: ["boarders_total"] }) : [];
    const out = new Map<string, number>();
    for (const f of facts) if (f.breakdown === "boarders_total" && f.value_numeric !== null && (f.value_numeric as number) > 0) out.set(String(f.entity_id), f.value_numeric as number);
    return out;
  }) as Promise<Map<string, number>>;
}

/** F-3: the boarders row's places -- among the set's boarding schools, in the region and in England. */
export function boarderPlaces(boarders: Map<string, number>, england: Map<string, { regionCode: string; regionName: string }>, urn: string, setUrns: string[], own: number): { set: Rank | null; region: (Rank & { name: string }) | null; england: Rank } {
  const all = new Map(boarders);
  all.set(urn, own);
  const reg = england.get(urn);
  const vals = Array.from(all);
  const set = setUrns.filter((u) => all.has(u));
  return {
    set: set.length ? rankIn([own, ...set.map((u) => all.get(u)!)], own) : null,
    region: reg ? { ...rankIn(vals.filter(([u]) => england.get(u)?.regionCode === reg.regionCode).map(([, v]) => v), own), name: reg.regionName } : null,
    england: rankIn(vals.map(([, v]) => v), own),
  };
}

/** F-4: a value-added series' trend -- from its first published year (SIXTH_FORM_VA_FROM, or whatever
 * the school has) to its latest, read from the data. Null with one year. */
export function vaTrend(valueAt: (p: number) => number | null, latest: number, firstFrom = SIXTH_FORM_VA_FROM): Trend | null {
  const to = valueAt(latest);
  if (to === null) return null;
  for (let p = firstFrom; p < latest; p++) {
    const v = valueAt(p);
    if (v !== null) return trendOf(p, latest, to - v, "va", true);
  }
  return null;
}

/** Progress 8: which reason applies (R-SMT-P8-REASON). Never a blank, never a zero. */
export function p8Of(school: Pick<SmtSchool, "independent" | "phases" | "latest">, pop: Population, urn: string, igcse: boolean): P8 {
  const latest = school.latest.ks4?.period ?? null;
  const gap = latest !== null && latest > LAST_P8_PERIOD ? Array.from({ length: Math.max(0, latest - LAST_P8_PERIOD) }, (_, i) => periodLabel(LAST_P8_PERIOD + 1 + i)) : [];
  const years = gap.length ? (gap.length === 1 ? gap[0] : `${gap.slice(0, -1).join(", ")} or ${gap.at(-1)}`) : periodLabel(LAST_P8_PERIOD + 1);
  if (!school.phases.gcse) return { status: "no_gcse", text: smtNote("p8NoGcse") };
  if (school.independent || igcse) return { status: "independent", text: smtNote("p8Independent") };
  for (let p = LAST_P8_PERIOD; p >= HISTORIC_GRADE_FROM; p--) {
    const v = figure(pop, urn, p, SMT_MEASURES.ks4.p8);
    if (v !== null) return { status: "published", value: v, lo: figure(pop, urn, p, SMT_MEASURES.ks4.p8lo), hi: figure(pop, urn, p, SMT_MEASURES.ks4.p8hi), period: p, text: smtNote("p8Published", { year: periodLabel(p), years }) };
  }
  return { status: "no_baseline", text: smtNote("p8NoBaseline", { years }) };
}

export const rollAt = (census: RollSnapshot[], year: number, f: SmtFilters): number | null => {
  const c = census.find((s) => s.period === year);
  if (!c) return null;
  if (f.boarding === "boarding" && c.boarding) return c.boarding.boarders;
  if (f.boarding === "day" && c.boarding) return c.boarding.day;
  if (f.sex === "female" && c.gender.sumMatchesTotal) return c.gender.female;
  if (f.sex === "male" && c.gender.sumMatchesTotal) return c.gender.male;
  return c.totalRoll > 0 ? c.totalRoll : null;
};

/** The set's schools' rolls now (whole school, every age), from the per-region census sets. */
async function setRolls(urns: string[]): Promise<Map<string, number | null>> {
  const england = await englandSchools();
  return new Map(urns.map((u) => [u, england.get(u)?.roll ?? null]));
}

/** The middle half of a set on one measure, year by year (schools with the figure). */
export function middleHalf(pop: Population, urns: string[], key: string, years: number[], exclude: Set<string>): BandPt[] {
  return years.map((y) => {
    const vals = urns.filter((u) => !exclude.has(u)).map((u) => figure(pop, u, y, key)).filter((v): v is number => v !== null);
    return { year: y, p25: percentile(vals, 25), p75: percentile(vals, 75), n: vals.length };
  });
}

/** Every school the IGCSE rule takes out of GCSE rankings (R-IGCSE-EVERYWHERE): all of England's, so
 * national and regional places leave them out as the set does (0.8 audit fixes, 1). A copy: callers add
 * to it. */
export async function igcseExcluded(): Promise<Set<string>> {
  return new Set(await igcseEngland());
}

const STAGE_LABEL: Record<Stage, string> = { ks2: "KS2", ks4: "GCSE", ks5: "Post-16" };

export async function buildOverview(school: SmtSchool, set: SmtSet, filters: SmtFilters, caller: SmtAdmissionsReader | null): Promise<Overview> {
  const urn = school.urn;
  const setUrns = Array.from(new Set(set.urns.filter((u) => u !== urn)));
  const all = [urn, ...setUrns];
  const f = school.boarding ? filters : { ...filters, boarding: "all" as const };
  const ff: SmtFilters = school.mixed ? f : { ...f, sex: "all" };
  const noKs2: Population = new Map();
  const [ks2, ks4, ks5, igcse, rolls, england] = await Promise.all([school.phases.primary && school.results.ks2 ? population("ks2") : Promise.resolve(noKs2), population("ks4"), population("ks5"), igcseExcluded(), setRolls(all), englandSchools()]);
  const schoolIgcse = !!school.phases.igcse;
  if (schoolIgcse) igcse.add(urn);
  const census = school.census;
  const now = census.at(-1) ?? null;
  const P = now?.period ?? null;

  // ------------------------------------------------------------ column 1, the school now
  const roll = P === null ? null : rollAt(census, P, ff);
  const baseRoll = rollAt(census, CENSUS_FIRST_PERIOD, ff);
  const dist = await lookupAgeBandDistributions(school.laName, P ?? CURRENT_CENSUS_PERIOD);
  const counts = new Map<number, { male: number; female: number }>();
  const own = (await cachedCensus([urn])).get(urn);
  for (const [age, v] of own?.ageGender ?? []) counts.set(age, v);
  const sizes = sizeByBand(counts, dist).map((b) => {
    const d = dist.get(b.key);
    return { key: b.key, label: AGE_BANDS.find((x) => x.key === b.key)?.label ?? b.label, total: b.total, badge: b.badge, laMean: d?.regionalMean ?? null, englandMean: d?.nationalMean ?? null };
  });
  // F-10: the same bands, counted the same way, for each of the set's schools.
  const setCensus = await cachedCensus(setUrns);
  const bandTotals = (u: string) => new Map(sizeByBand(setCensus.get(u)?.ageGender ?? new Map(), dist).map((b) => [b.key, b.total]));
  // A sixth form only where GIAS's top age is 17 or more, as Pupils' staying on (an 11-16 school's census
  // can hold a few pupils aged 16).
  const setBands = setUrns.map((u) => {
    const m = bandTotals(u);
    if ((england.get(u)?.high ?? 0) < 17) m.delete("sixth_form" as never);
    return m;
  });
  const setSizes: SetSize[] = sizes.map((b) => ({ key: b.key, label: b.label, total: b.total, ...setSizeOf(b.total, setBands.map((m) => m.get(b.key as never) ?? 0)) }));

  // ------------------------------------------------------------ the scorecard
  const setLabel = set.label;
  const rows: ScoreRow[] = [];
  const pctChange = (a: number | null, b: number | null) => (a === null || b === null || a === 0 ? null : ((b - a) / a) * 100);

  // Roll: among the set's schools with a census; in the region and England among schools teaching
  // the school's main phase (a roll is only comparable within a phase).
  {
    const main = school.phases.gcse ? AGE_BANDS[2] : school.phases.primary ? AGE_BANDS[1] : AGE_BANDS[3];
    const teaches = (u: string) => {
      const c = england.get(u)?.counts;
      if (!c) return false;
      for (const [age, v] of c) if (age >= main.minAge && age <= main.maxAge && v.male + v.female > 0) return true;
      return false;
    };
    const wholeRoll = now?.totalRoll ?? null;
    const pool = Array.from(england).filter(([u, s]) => s.roll !== null && teaches(u));
    const region = england.get(urn);
    const nat = wholeRoll === null ? null : rankIn(pool.map(([, s]) => s.roll!), wholeRoll);
    const reg = wholeRoll === null || !region ? null : { ...rankIn(pool.filter(([, s]) => s.regionCode === region.regionCode).map(([, s]) => s.roll!), wholeRoll), name: region.regionName };
    const sr = wholeRoll === null ? null : setPlace(new Map([...rolls].map(([u, v]) => [u, u === urn ? wholeRoll : v])), urn);
    rows.push({ key: "roll", label: ff.sex !== "all" || ff.boarding !== "all" ? `Roll (${ff.boarding !== "all" ? ff.boarding : ff.sex === "female" ? "girls" : "boys"})` : "Roll", stage: null, unit: "pupils", value: roll, period: P, set: sr ? { ...sr, label: setLabel } : null, region: ff.sex === "all" && ff.boarding === "all" ? reg : null, england: ff.sex === "all" && ff.boarding === "all" ? nat : null, since: baseRoll !== null && roll !== null && P !== null && pctChange(baseRoll, roll) !== null ? trendOf(CENSUS_FIRST_PERIOD, P, pctChange(baseRoll, roll)!, "pct") : null, note: null });
  }
  // F-3: the boarders row, for a boarding school only, ranked among boarding schools in the set, the
  // region and England.
  if (school.boarding && now?.boarding && P !== null) {
    const b0 = census.find((c) => c.period === CENSUS_FIRST_PERIOD)?.boarding?.boarders ?? null;
    const bc = pctChange(b0, now.boarding.boarders);
    const places = now.boarding.boarders > 0 ? boarderPlaces(await boardersByUrn(P), england, urn, setUrns, now.boarding.boarders) : null;
    rows.push({ key: "boarders", label: "Boarders", stage: null, unit: "pupils", value: now.boarding.boarders, period: P, set: places?.set ? { ...places.set, label: `${setLabel} with boarders` } : null, region: places?.region ?? null, england: places?.england ?? null, since: bc !== null ? trendOf(CENSUS_FIRST_PERIOD, P, bc, "pct") : null, note: null });
  }

  const results: { stage: Stage; key: string; label: string; unit: Unit; pop: Population; trend: boolean }[] = [];
  if (school.phases.gcse) {
    results.push({ stage: "ks4", key: SMT_MEASURES.ks4.a8, label: "Attainment 8", unit: "points", pop: ks4, trend: true });
    results.push({ stage: "ks4", key: SMT_MEASURES.ks4.em5, label: "Grade 5+ in English and maths", unit: "pct", pop: ks4, trend: false });
  }
  if (school.phases.post16) {
    results.push({ stage: "ks5", key: SMT_MEASURES.ks5.aps, label: "A level: points per entry", unit: "points", pop: ks5, trend: true });
    results.push({ stage: "ks5", key: SMT_MEASURES.ks5.va, label: "A-level value added", unit: "va", pop: ks5, trend: false });
  }
  if (school.phases.primary && school.results.ks2) results.push({ stage: "ks2", key: SMT_MEASURES.ks2.rwm, label: "KS2: reading, writing and maths", unit: "pct", pop: ks2, trend: false });

  for (const r of results) {
    const period = school.latest[r.stage]?.period ?? null;
    if (period === null) continue;
    const exclude = r.stage === "ks4" ? igcse : new Set<string>();
    // F-3: an IGCSE school isn't ranked on its whole-school GCSE figures, so the rows are left out.
    if (r.stage === "ks4" && schoolIgcse) continue;
    // A-level value added: the latest year it is published (2023/24 and 2024/25 so far).
    const p = r.unit === "va" ? [period, period - 1].find((y) => figure(r.pop, urn, y, r.key) !== null) ?? period : period;
    const places = await placesOn(r.pop, p, r.key, [urn], exclude);
    const place = places.get(urn)!;
    const values = new Map(all.map((u) => [u, figure(r.pop, u, p, r.key)]));
    const sr = setPlace(values, urn, exclude);
    const from = figure(r.pop, urn, TREND_BASE_PERIOD, r.key);
    const since = r.unit === "va" ? vaTrend((y) => figure(r.pop, urn, y, r.key), p) : r.stage !== "ks2" && place.value !== null && from !== null && p > TREND_BASE_PERIOD ? trendOf(TREND_BASE_PERIOD, p, place.value - from, r.unit === "pct" ? "pp" : "points") : null;
    rows.push({ key: r.key, label: r.label, stage: r.stage, unit: r.unit, value: place.value, period: p, set: sr ? { ...sr, label: `${setLabel} with ${STAGE_LABEL[r.stage]} results` } : null, region: place.regional ? { rank: place.regional.rank, of: place.regional.of, name: place.regional.region } : null, england: place.national, since, note: place.value === null ? "none" : null });
  }

  // F-3: Progress 8, where DfE published it (state schools, to PROGRESS8_LAST_PERIOD), over its own years.
  const p8 = p8Of(school, ks4, urn, schoolIgcse);
  if (p8.status === "published") {
    const key = SMT_MEASURES.ks4.p8;
    const place = (await placesOn(ks4, p8.period, key, [urn], igcse)).get(urn)!;
    const sr = setPlace(new Map(all.map((u) => [u, figure(ks4, u, p8.period, key)])), urn, igcse);
    rows.push({ key, label: "Progress 8", stage: "ks4", unit: "va", value: p8.value, period: p8.period, set: sr ? { ...sr, label: `${setLabel} with GCSE results` } : null, region: place.regional ? { rank: place.regional.rank, of: place.regional.of, name: place.regional.region } : null, england: place.national, since: vaTrend((y) => figure(ks4, urn, y, key), p8.period, TREND_BASE_PERIOD), note: null });
  }

  // ------------------------------------------------------------ market share at 11+ (Admissions, read-only)
  const m11 = await marketAt11(school, caller, { label: setLabel, urns: setUrns });
  const market = m11.trend;
  if (m11.row) rows.push(m11.row);

  // ------------------------------------------------------------ flags on the school
  const flags: SmtFlag[] = [];
  const thresholds = await loadThresholds();
  if (P !== null) {
    const f1 = rollFalling([P - 3, P - 2, P - 1, P].map((y) => ({ year: y, roll: census.find((c) => c.period === y)?.totalRoll ?? null })));
    if (f1) flags.push(f1);
    const entryAge = school.phases.gcse && (school.low ?? 11) <= 11 ? 11 : school.phases.primary ? Math.max(4, school.low ?? 4) : 16;
    const t = own?.table;
    if (t && thresholds) {
      const f3 = entryShrinking({ from: cohortAt(t, entryAge, P - 2), to: cohortAt(t, entryAge, P), fromYear: P - 2, toYear: P, age: entryAge }, thresholds.get(phaseForEntryAge(entryAge), "entry_cohort"), `${entryAge}+`);
      if (f3) flags.push(f3);
    }
  }
  for (const r of results.filter((x) => x.trend)) {
    if (r.stage === "ks4" && schoolIgcse) continue;
    const period = school.latest[r.stage]?.period;
    if (period === undefined) continue;
    const from = Math.max(period - 2, TREND_BASE_PERIOD);
    const ch = (u: string) => {
      const a = figure(r.pop, u, from, r.key);
      const b = figure(r.pop, u, period, r.key);
      return a === null || b === null ? null : b - a;
    };
    const setChanges = setUrns.filter((u) => !(r.stage === "ks4" && igcse.has(u))).map(ch).filter((v): v is number => v !== null);
    const fl = resultsAgainstSet(r.stage, r.stage === "ks4" ? "GCSE results" : "Post-16 results", { from: figure(r.pop, urn, from, r.key), to: figure(r.pop, urn, period, r.key), fromYear: from, toYear: period }, setChanges);
    if (fl) flags.push(fl);
  }

  // ------------------------------------------------------------ row 2: trends
  const years = census.map((c) => c.period).filter((y) => y >= CENSUS_FIRST_PERIOD);
  const lines: { key: string; label: string; pts: Pt[] }[] = [];
  if (school.boarding && ff.boarding === "all" && census.some((c) => c.boarding)) {
    lines.push({ key: "day", label: "Day", pts: years.map((y) => ({ year: y, value: rollAt(census, y, { ...ff, boarding: "day" }) })) });
    lines.push({ key: "boarding", label: "Boarding", pts: years.map((y) => ({ year: y, value: rollAt(census, y, { ...ff, boarding: "boarding" }) })) });
  } else {
    lines.push({ key: "school", label: school.name, pts: years.map((y) => ({ year: y, value: rollAt(census, y, ff) })) });
  }
  // F-11 (R-ROLL-INDEXED-SET): against the selected set, not the LA and England -- the set's average day
  // roll, and its average boarding roll (grey, dotted) where the set has boarders; the same filters.
  const setCensuses = await Promise.all(setUrns.map((u) => schoolCensus(u).catch(() => [] as RollSnapshot[])));
  const at = (cs: RollSnapshot[], y: number) => cs.find((c) => c.period === y) ?? null;
  const daySeries = setCensuses.map((cs) => years.map((y) => {
    const c = at(cs, y);
    if (!c) return null;
    return c.boarding ? rollAt(cs, y, { ...ff, boarding: "day" }) : rollAt(cs, y, { ...ff, boarding: "all" });
  }));
  const boardSeries = setCensuses.map((cs) => years.map((y) => {
    const b = at(cs, y)?.boarding?.boarders ?? null;
    return b !== null && b > 0 ? b : null;
  }));
  const setDay = ff.boarding === "boarding" ? null : setAverage(daySeries, years);
  const setBoard = ff.boarding === "day" ? null : setAverage(boardSeries, years);
  const anyBoarders = school.boarding || !!setBoard;
  const short = setShortName(setLabel);
  const setLines = [
    ...(setDay ? [{ key: "set-day", label: anyBoarders ? `${short} average, day` : `${short} average`, pts: setDay.pts, schools: setDay.schools }] : []),
    ...(setBoard ? [{ key: "set-boarding", label: `${short} average, boarding`, pts: setBoard.pts, schools: setBoard.schools }] : []),
  ];
  const ix = indexTo([...lines.map((l) => l.pts), ...setLines.map((l) => l.pts)]);
  const rollLines = [...lines.map((l, i) => ({ ...l, pts: ix.out[i], actual: l.pts })), ...setLines.map((l, i) => ({ key: l.key, label: l.label, pts: ix.out[lines.length + i], actual: l.pts }))];

  const resultTrends: Overview["trends"]["results"] = [];
  for (const r of results.filter((x) => x.trend && x.stage !== "ks2") as { stage: "ks4" | "ks5"; key: string; label: string; pop: Population }[]) {
    if (r.stage === "ks4" && schoolIgcse) continue;
    const latest = school.latest[r.stage]?.period;
    if (latest === undefined) continue;
    const ys = Array.from({ length: latest - HISTORIC_GRADE_FROM + 1 }, (_, i) => HISTORIC_GRADE_FROM + i);
    resultTrends.push({ stage: r.stage, label: r.label, school: ys.map((y) => ({ year: y, value: figure(r.pop, urn, y, r.key) })), band: middleHalf(r.pop, setUrns, r.key, ys, r.stage === "ks4" ? igcse : new Set()) });
  }

  const va = (() => {
    const k = SMT_MEASURES.ks5;
    const latest = school.latest.ks5?.period;
    if (latest === undefined) return null;
    for (const p of [latest, latest - 1]) {
      const v = figure(ks5, urn, p, k.va);
      if (v !== null) return { value: v, lo: figure(ks5, urn, p, k.valo), hi: figure(ks5, urn, p, k.vahi), period: p };
    }
    return null;
  })();

  return {
    urn,
    set: { kind: set.kind, label: setLabel, short: setShortName(setLabel), size: setUrns.length },
    igcse: schoolIgcse,
    schools: await setNames(all),
    rolls: await mapRolls(all),
    filters: ff,
    now: {
      census: P,
      roll,
      base: { period: CENSUS_FIRST_PERIOD, roll: baseRoll },
      changePct: pctChange(baseRoll, roll),
      girls: now && now.gender.sumMatchesTotal ? now.gender.female : null,
      boys: now && now.gender.sumMatchesTotal ? now.gender.male : null,
      boarding: school.boarding && now?.boarding ? { day: now.boarding.day, boarders: now.boarding.boarders } : null,
      entry: school.independent && own?.table && P !== null ? entryTiles(own.table, P, CENSUS_FIRST_PERIOD, school.low) : null,
      sizes,
      setSizes,
      laName: school.laName,
    },
    rows,
    p8,
    va,
    flags,
    flagsLoaded: !!thresholds,
    trends: { roll: { lines: rollLines, base: ix.base, laName: school.laName }, results: resultTrends, market },
    notes: {
      since: smtNote("sinceBase", { base: periodLabel(TREND_BASE_PERIOD) }),
      middleHalf: smtNote("middleHalf", { setLabel }),
      rollIndexed: smtNote("rollIndexedSet", { base: indexBaseWords(ix.base), set: setLabel, day: setDay?.schools ?? 0, boarding: setBoard ? ` and ${setBoard.schools} with boarders for the boarding line` : "" }),
      trendYears: trendYearsNote(),
    },
  };
}

/** F-2: each school's whole-school roll by census year (the school page's roll), its latest and its
 * 3-year direction. */
export async function mapRolls(urns: string[]): Promise<Overview["rolls"]> {
  const out: Overview["rolls"] = {};
  await Promise.all(
    urns.map(async (u) => {
      const census = await schoolCensus(u).catch(() => [] as RollSnapshot[]);
      const pts = census.filter((c) => c.period >= CENSUS_FIRST_PERIOD).map((c) => ({ year: c.period, value: c.totalRoll > 0 ? c.totalRoll : null }));
      const last = [...pts].reverse().find((p) => p.value !== null) ?? null;
      const d = rollDirection(pts, 0);
      out[u] = { roll: last?.value ?? null, year: last?.year ?? null, trend: d ? { dir: d.dir, word: d.word, pct: d.pct, from: d.from, to: d.to } : null };
    }),
  );
  return out;
}

/** F-3, F-4: the one (i) note on why the Scorecard's trends cover different years, its years from years.ts. */
export function trendYearsNote(): string {
  return smtNote("trendYears", { base: periodLabel(TREND_BASE_PERIOD), grading: periodLabel(GRADING_2122_PERIOD), vaFrom: periodLabel(SIXTH_FORM_VA_FROM), p8Last: periodLabel(PROGRESS8_LAST_PERIOD), census: periodLabel(CENSUS_FIRST_PERIOD) });
}

// The school's info for the set (names), for the map and the hovers.
export async function setNames(urns: string[]): Promise<Record<string, { name: string; easting: number | null; northing: number | null }>> {
  const info = await fetchSchoolInfo(urns);
  return Object.fromEntries(urns.map((u) => [u, { name: info.get(u)?.name ?? u, easting: info.get(u)?.easting ?? null, northing: info.get(u)?.northing ?? null }]));
}


/** Market share at 11+, from Admissions, read-only: the school's share against its saved 11+ rivals,
 * year by year, and the scorecard's row. Empty, with the reason, where the school has no 11+ entry.
 * F-7 (R-MARKET-DEFAULT-RIVALS): where Admissions hasn't chosen rivals (or the caller can't read its
 * lists), the rivals are Admissions' own default -- the 10 nearest schools teaching Year 7 -- and the
 * panel says so. Shared by Overview and Pupils. */
export async function marketAt11(school: SmtSchool, caller: SmtAdmissionsReader | null, set: { label: string; urns: string[] } | null = null): Promise<{ trend: Overview["trends"]["market"]; row: ScoreRow | null }> {
  const urn = school.urn;
  let row: ScoreRow | null = null;
  const takes11 = (school.low ?? 99) <= 11 && (school.high ?? 0) >= 11 && school.phases.gcse;
  let market: Overview["trends"]["market"] = { status: "empty", reason: smtNote(takes11 ? "marketNoLists" : "marketNoEntry") };
  if (takes11 && caller?.privateNote) market = { status: "empty", reason: caller.privateNote };
  else if (takes11) {
    const ep = entryPoint("11+")!;
    // F-9: with a set (Overview), its schools are the rivals, whatever Admissions has chosen.
    const lists = !set && caller?.supabase ? await savedLists(caller.supabase, urn, ep.id) : [];
    const rivals = set ? set.urns.filter((u) => u !== urn) : rivalsFromLists(lists);
    {
      // No saved rivals: buildMarketShare's default (defaultRivals: the 10 nearest teaching Year 7).
      const m = await buildMarketShare(urn, ep, rivals ? { rivals } : {});
      const byUrn = new Map<string, Pt[]>();
      for (const r of m.entryAge.rows) (byUrn.get(r.urn) ?? byUrn.set(r.urn, []).get(r.urn)!).push({ year: r.period, value: r.share });
      const latest = m.entryAge.periods.at(-1);
      const largest = m.entryAge.rows.filter((r) => r.urn !== urn && r.period === latest && r.share !== null).sort((a, b) => (b.share ?? 0) - (a.share ?? 0))[0];
      market = { status: "ready", school: byUrn.get(urn) ?? [], rival: largest ? (byUrn.get(largest.urn) ?? []) : [], rivalName: largest ? (m.schools[largest.urn]?.name ?? largest.urn) : null, rivals: m.rivals.length, defaultRivals: !rivals, setRivals: set ? set.label : null };
      const mine = m.entryAge.rows.find((r) => r.urn === urn && r.period === latest);
      const first = m.entryAge.rows.find((r) => r.urn === urn && r.period === m.entryAge.periods[0]);
      // groupShare's shares are already per cent.
      const pct = (s: number | null | undefined) => (s === null || s === undefined ? null : s);
      if (mine) row = ({ key: "market11", label: "Market share at 11+", stage: null, unit: "share", value: pct(mine.share), period: latest ?? null, set: mine.rank !== null ? { rank: mine.rank, of: m.rivals.length + 1, label: set ? set.label : rivals ? "Admissions' rivals" : smtNote("marketDefaultShort") } : null, region: null, england: null, since: first && latest !== undefined && pct(first.share) !== null && pct(mine.share) !== null ? trendOf(m.entryAge.periods[0], latest, pct(mine.share)! - pct(first.share)!, "pp") : null, note: null });
    }
  }

  return { trend: market, row };
}
