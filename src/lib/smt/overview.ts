// VicData 0.8 SMT round 1: Overview (spec §2.3; wireframes Main, LeightonLight, Phone). Server-only.
// Everything here is assembled from existing reads: the census (roll, gender, boarding, bands), the
// school page's XS-XL (sizeByBand), 0.6.6's whole-population ranks (population.ts), Admissions'
// flags, area aggregates and market share. Nothing is computed in the browser.
//
// The comparison set arrives as URNs (the set Teacher's chooser resolved). Every set rank is
// level-aware: only the set's schools with the figure are ranked, and the count says so.
import type { SmtAdmissionsReader } from "./auth-rules";
import { CENSUS_FIRST_PERIOD, HISTORIC_GRADE_FROM, TREND_BASE_PERIOD, periodLabel } from "@/catalogue/years";
import { smtNote } from "@/catalogue/notes";
import { lookupAgeBandDistributions } from "../age-band-distributions";
import { AGE_BANDS, CURRENT_CENSUS_PERIOD, type RollSnapshot } from "../roll-data";
import { englandSchools, rankIn } from "../admissions/ranks";
import { cachedCensus, fetchSchoolInfo } from "../admissions/data";
import { cohortAt } from "../admissions/cohort";
import { areaByAge, indexTo } from "../admissions/screens";
import { sizeByBand } from "../admissions/shape";
import { savedLists } from "../admissions/auth";
import { rivalsFromLists } from "../admissions/lists";
import { buildMarketShare } from "../admissions/market";
import { entryPoint } from "../admissions/entry-points";
import { loadThresholds, phaseForEntryAge } from "../admissions/thresholds";
import { percentile } from "../admissions/stats";
import { figure, placesOn, population, setPlace, SMT_MEASURES, type Population } from "./population";
import { sitsIgcse, type SmtSchool } from "./school";
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
  since: { from: number; change: number; unit: "pct" | "points" | "pp" } | null;
  // Why a row has no figure or rank: "igcse" (not ranked: IGCSE), "none" (no published results).
  note: "igcse" | "none" | null;
};

export type Pt = { year: number; value: number | null };
export type BandPt = { year: number; p25: number | null; p75: number | null; n: number };

export type P8 =
  | { status: "published"; value: number; lo: number | null; hi: number | null; period: number; text: string }
  | { status: "independent" | "no_baseline" | "no_gcse"; text: string };

export type Overview = {
  urn: string;
  set: { kind: string; label: string; size: number };
  // The school and the set's schools: names and locations (the map, the hovers).
  schools: Record<string, { name: string; easting: number | null; northing: number | null }>;
  filters: SmtFilters;
  now: {
    census: number | null;
    roll: number | null;
    base: { period: number; roll: number | null };
    changePct: number | null;
    girls: number | null;
    boys: number | null;
    boarding: { day: number; boarders: number } | null;
    // The school page's Roll by phase: the badge, and the means its caption compares with.
    sizes: { key: string; label: string; total: number; badge: string | null; laMean: number | null; englandMean: number | null }[];
    laName: string | null;
  };
  rows: ScoreRow[];
  p8: P8;
  va: { value: number; lo: number | null; hi: number | null; period: number } | null;
  flags: SmtFlag[];
  flagsLoaded: boolean;
  trends: {
    roll: { lines: { key: string; label: string; pts: Pt[] }[]; base: number | null; laName: string | null };
    results: { stage: "ks4" | "ks5"; label: string; school: Pt[]; band: BandPt[] }[];
    market: { status: "ready"; school: Pt[]; rival: Pt[]; rivalName: string | null; rivals: number } | { status: "empty"; reason: string };
  };
  notes: { since: string; middleHalf: string; rollIndexed: string };
};

const LAST_P8_PERIOD = 2023; // 2023/24: the last cohort with a KS2 baseline (summer 2019)

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

/** The set's IGCSE schools (R-IGCSE-EXCL), left out of every GCSE comparison. */
export async function igcseIn(urns: string[]): Promise<Set<string>> {
  const england = await englandSchools();
  const out = new Set<string>();
  await Promise.all(urns.map(async (u) => {
    const group = england.get(u)?.group ?? null;
    if (group === "Independent schools" && (await sitsIgcse(u, group))) out.add(u);
  }));
  return out;
}

const STAGE_LABEL: Record<Stage, string> = { ks2: "KS2", ks4: "GCSE", ks5: "Post-16" };

export async function buildOverview(school: SmtSchool, set: SmtSet, filters: SmtFilters, caller: SmtAdmissionsReader | null): Promise<Overview> {
  const urn = school.urn;
  const setUrns = Array.from(new Set(set.urns.filter((u) => u !== urn)));
  const all = [urn, ...setUrns];
  const f = school.boarding ? filters : { ...filters, boarding: "all" as const };
  const ff: SmtFilters = school.mixed ? f : { ...f, sex: "all" };
  const noKs2: Population = new Map();
  const [ks2, ks4, ks5, igcse, rolls, england] = await Promise.all([school.phases.primary && school.results.ks2 ? population("ks2") : Promise.resolve(noKs2), population("ks4"), population("ks5"), igcseIn(all), setRolls(all), englandSchools()]);
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
    rows.push({ key: "roll", label: ff.sex !== "all" || ff.boarding !== "all" ? `Roll (${ff.boarding !== "all" ? ff.boarding : ff.sex === "female" ? "girls" : "boys"})` : "Roll", stage: null, unit: "pupils", value: roll, period: P, set: sr ? { ...sr, label: setLabel } : null, region: ff.sex === "all" && ff.boarding === "all" ? reg : null, england: ff.sex === "all" && ff.boarding === "all" ? nat : null, since: baseRoll !== null && roll !== null ? { from: CENSUS_FIRST_PERIOD, change: pctChange(baseRoll, roll)!, unit: "pct" } : null, note: null });
  }
  if (school.boarding && now?.boarding) {
    const b0 = census.find((c) => c.period === CENSUS_FIRST_PERIOD)?.boarding?.boarders ?? null;
    rows.push({ key: "boarders", label: "Boarders", stage: null, unit: "pupils", value: now.boarding.boarders, period: P, set: null, region: null, england: null, since: b0 !== null ? { from: CENSUS_FIRST_PERIOD, change: pctChange(b0, now.boarding.boarders)!, unit: "pct" } : null, note: null });
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
    if (r.stage === "ks4" && schoolIgcse) {
      rows.push({ key: r.key, label: r.label, stage: r.stage, unit: r.unit, value: null, period, set: null, region: null, england: null, since: null, note: "igcse" });
      continue;
    }
    // A-level value added: the latest year it is published (2023/24 and 2024/25 so far).
    const p = r.unit === "va" ? [period, period - 1].find((y) => figure(r.pop, urn, y, r.key) !== null) ?? period : period;
    const places = await placesOn(r.pop, p, r.key, [urn], exclude);
    const place = places.get(urn)!;
    const values = new Map(all.map((u) => [u, figure(r.pop, u, p, r.key)]));
    const sr = setPlace(values, urn, exclude);
    const from = figure(r.pop, urn, TREND_BASE_PERIOD, r.key);
    const since = r.unit !== "va" && r.stage !== "ks2" && place.value !== null && from !== null && p > TREND_BASE_PERIOD ? { from: TREND_BASE_PERIOD, change: place.value - from, unit: (r.unit === "pct" ? "pp" : "points") as "pp" | "points" } : null;
    rows.push({ key: r.key, label: r.label, stage: r.stage, unit: r.unit, value: place.value, period: p, set: sr ? { ...sr, label: `${setLabel} with ${STAGE_LABEL[r.stage]} results` } : null, region: place.regional ? { rank: place.regional.rank, of: place.regional.of, name: place.regional.region } : null, england: place.national, since, note: place.value === null ? "none" : null });
  }

  // ------------------------------------------------------------ market share at 11+ (Admissions, read-only)
  const m11 = await marketAt11(school, caller);
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
  const area = await areaByAge();
  const areaSum = (scope: string, key: string | null, y: number) => {
    const rs = area.filter((r) => r.scope === scope && (key === null || r.key === key) && r.period === y);
    if (scope === "region" && rs.length !== 9) return null;
    if (!rs.length) return null;
    let t = 0;
    for (const r of rs) for (let a = 5; a <= 15; a++) t += r.byAge[String(a)] ?? 0;
    return t;
  };
  const lines: { key: string; label: string; pts: Pt[] }[] = [];
  if (school.boarding && ff.boarding === "all" && census.some((c) => c.boarding)) {
    lines.push({ key: "day", label: "Day", pts: years.map((y) => ({ year: y, value: rollAt(census, y, { ...ff, boarding: "day" }) })) });
    lines.push({ key: "boarding", label: "Boarding", pts: years.map((y) => ({ year: y, value: rollAt(census, y, { ...ff, boarding: "boarding" }) })) });
  } else {
    lines.push({ key: "school", label: school.name, pts: years.map((y) => ({ year: y, value: rollAt(census, y, ff) })) });
  }
  const laPts = years.map((y) => ({ year: y, value: school.laName ? areaSum("la", school.laName, y) : null }));
  const engPts = years.map((y) => ({ year: y, value: areaSum("region", null, y) }));
  const ix = indexTo([...lines.map((l) => l.pts), laPts, engPts]);
  const rollLines = [...lines.map((l, i) => ({ ...l, pts: ix.out[i] })), { key: "la", label: school.laName ?? "The LA", pts: ix.out[lines.length] }, { key: "england", label: "England", pts: ix.out[lines.length + 1] }];

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
    set: { kind: set.kind, label: setLabel, size: setUrns.length },
    schools: await setNames(all),
    filters: ff,
    now: {
      census: P,
      roll,
      base: { period: CENSUS_FIRST_PERIOD, roll: baseRoll },
      changePct: pctChange(baseRoll, roll),
      girls: now && now.gender.sumMatchesTotal ? now.gender.female : null,
      boys: now && now.gender.sumMatchesTotal ? now.gender.male : null,
      boarding: school.boarding && now?.boarding ? { day: now.boarding.day, boarders: now.boarding.boarders } : null,
      sizes,
      laName: school.laName,
    },
    rows,
    p8: p8Of(school, ks4, urn, schoolIgcse),
    va,
    flags,
    flagsLoaded: !!thresholds,
    trends: { roll: { lines: rollLines, base: ix.base, laName: school.laName }, results: resultTrends, market },
    notes: {
      since: smtNote("sinceBase", { base: periodLabel(TREND_BASE_PERIOD) }),
      middleHalf: smtNote("middleHalf", { setLabel }),
      rollIndexed: smtNote("rollIndexed", { base: ix.base === null ? periodLabel(CENSUS_FIRST_PERIOD) : periodLabel(ix.base), la: school.laName ?? "The LA" }),
    },
  };
}

// The school's info for the set (names), for the map and the hovers.
export async function setNames(urns: string[]): Promise<Record<string, { name: string; easting: number | null; northing: number | null }>> {
  const info = await fetchSchoolInfo(urns);
  return Object.fromEntries(urns.map((u) => [u, { name: info.get(u)?.name ?? u, easting: info.get(u)?.easting ?? null, northing: info.get(u)?.northing ?? null }]));
}


/** Market share at 11+, from Admissions, read-only: the school's share against its saved 11+ rivals,
 * year by year, and the scorecard's row. Empty, with the reason, where the school has no 11+ entry or
 * Admissions has no saved rivals there. Shared by Overview and Pupils. */
export async function marketAt11(school: SmtSchool, caller: SmtAdmissionsReader | null): Promise<{ trend: Overview["trends"]["market"]; row: ScoreRow | null }> {
  const urn = school.urn;
  let row: ScoreRow | null = null;
  const takes11 = (school.low ?? 99) <= 11 && (school.high ?? 0) >= 11 && school.phases.gcse;
  let market: Overview["trends"]["market"] = { status: "empty", reason: smtNote(takes11 ? "marketNoLists" : "marketNoEntry") };
  if (takes11 && caller?.privateNote) market = { status: "empty", reason: caller.privateNote };
  else if (takes11 && caller?.supabase) {
    const ep = entryPoint("11+")!;
    const lists = await savedLists(caller.supabase, urn, ep.id);
    const rivals = rivalsFromLists(lists);
    if (!rivals) market = { status: "empty", reason: smtNote("marketNoLists") };
    else {
      const m = await buildMarketShare(urn, ep, { rivals });
      const byUrn = new Map<string, Pt[]>();
      for (const r of m.entryAge.rows) (byUrn.get(r.urn) ?? byUrn.set(r.urn, []).get(r.urn)!).push({ year: r.period, value: r.share });
      const latest = m.entryAge.periods.at(-1);
      const largest = m.entryAge.rows.filter((r) => r.urn !== urn && r.period === latest && r.share !== null).sort((a, b) => (b.share ?? 0) - (a.share ?? 0))[0];
      market = { status: "ready", school: byUrn.get(urn) ?? [], rival: largest ? (byUrn.get(largest.urn) ?? []) : [], rivalName: largest ? (m.schools[largest.urn]?.name ?? largest.urn) : null, rivals: m.rivals.length };
      const mine = m.entryAge.rows.find((r) => r.urn === urn && r.period === latest);
      const first = m.entryAge.rows.find((r) => r.urn === urn && r.period === m.entryAge.periods[0]);
      // groupShare's shares are already per cent.
      const pct = (s: number | null | undefined) => (s === null || s === undefined ? null : s);
      if (mine) row = ({ key: "market11", label: "Market share at 11+", stage: null, unit: "share", value: pct(mine.share), period: latest ?? null, set: mine.rank !== null ? { rank: mine.rank, of: m.rivals.length + 1, label: "Admissions' rivals" } : null, region: null, england: null, since: first && pct(first.share) !== null && pct(mine.share) !== null ? { from: m.entryAge.periods[0], change: pct(mine.share)! - pct(first.share)!, unit: "pp" } : null, note: null });
    }
  }

  return { trend: market, row };
}
