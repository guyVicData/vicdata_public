// VicData 0.8 SMT round 2: Pupils (spec §2.3; wireframe Pupils). Server-only. Assembled from the
// reads round 1 and Admissions already make -- the census (roll, year groups, gender, boarding),
// the school page's XS-XL, the shared shape classifier, Admissions' pipeline, entry points and
// market share -- read-only where Admissions owns them. Nothing is ranked by shape (R-ADM-SHAPE-NOT-RANKED).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmtAdmissionsReader } from "./auth-rules";
import { CENSUS_FIRST_PERIOD, CURRENT_CENSUS_PERIOD, periodLabel } from "@/catalogue/years";
import { ADMISSIONS_NOTES, smtNote } from "@/catalogue/notes";
import { lookupAgeBandDistributions } from "../age-band-distributions";
import { AGE_BANDS, type AgeGenderCounts, type RollSnapshot } from "../roll-data";
import { cachedCensus, fetchSchoolInfo, type SchoolCensus } from "../admissions/data";
import { cohortAt } from "../admissions/cohort";
import { areaByAge, indexTo } from "../admissions/screens";
import { shapeOf, sizeByBand } from "../admissions/shape";
import { savedLists } from "../admissions/auth";
import { entryPoint, type EntryPoint } from "../admissions/entry-points";
import { pipelineView } from "../admissions/views-api";
import { nearbyCandidates } from "../admissions/rungs";
import { percentile } from "../admissions/stats";
import { englandSchools } from "../admissions/ranks";
import { agesWordOf, levelAges, type SmtLevel } from "./levels";
import { laAreaProjection, laPopulation } from "./area-data";
import { schoolCensus, type SmtSchool } from "./school";
import { yearOnYear } from "./entry-net";
import { marketAt11, rollAt, type Overview, type Pt, type SmtSet } from "./overview";
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";

// The ages each level highlights (R-SMT-PUPILS-LEVEL), first and last inclusive, as Context counts
// them (levelAges): GCSE 11-15 (Years 7 to 11), Post-16 16-17 (Years 12 and 13), Primary 4-10
// (Reception to Year 6). 0.8 audit fixes (3, S2): these were the ages each level ends at (11-16,
// 16-18, 4-11), read as inclusive, so GCSE lit Year 12 and Primary Year 7.
export const LEVEL_AGES: Record<SmtLevel["phase"], [number, number] | null> = { whole: null, primary: levelAges("primary", null, null), gcse: levelAges("gcse", null, null), post16: levelAges("post16", null, null) };

export type YearGroup = { age: number; label: string; female: number; male: number; total: number };
export type EntrySummary = { entry: string; label: string; age: number; cohort: number | null; pool: number | null; poolYear: number | null; poolSource: string | null };

export type Pupils = {
  urn: string;
  set: { kind: string; label: string; size: number };
  level: SmtLevel;
  highlight: [number, number] | null;
  now: {
    census: number | null;
    roll: number | null;
    changePct: number | null;
    girls: number | null;
    boys: number | null;
    boarding: { day: number; boarders: number } | null;
    stayingOn: { pct: number; from: number; to: number; year: number } | null;
    sizes: { key: string; label: string; total: number; badge: string | null; laMean: number | null; englandMean: number | null }[];
    mainBand: string | null;
    laName: string | null;
  };
  shape: {
    yearGroups: YearGroup[];
    label: string | null;
    sinceYear: number | null;
    was: string | null;
    around: { la: { label: string; shape: string | null; schools: number; of: number } | null; set: { shape: string; schools: number }[]; stayingOnSet: { pct: number | null; schools: number } };
  };
  entries: { status: "ready"; rows: EntrySummary[] } | { status: "empty"; reason: string };
  leaving: { year: number; year11: number | null; year12: number | null; leaving: number | null; stayingPct: number | null }[];
  market: Overview["trends"]["market"];
  // 0.8 SMT Academic (R-SMT-NO-PILLS): girls and boys, and day and boarding, are views, not pills. Null
  // where the view has nothing to show (a single-sex school; a school with no boarders).
  girlsBoys: GirlsBoys | null;
  dayBoarding: DayBoarding | null;
  trends: {
    phases: { key: string; label: string; pts: Pt[]; actual: Pt[] }[]; // pts indexed; actual the pupils
    base: number | null;
    pool: { status: "ready"; entry: string; counted: Pt[]; births: Pt[] } | { status: "empty"; reason: string };
    // 0.8 SMT r3 (K5): the LA's residents of the ages (ONS mid-year estimates), not census pupils.
    // 0.8 SMT r4 (F6): `forward` is the same middle line as Context's forward view (the LA's, these ages),
    // from the latest count to the horizon; the years whose ages include children not yet born from unbornFrom.
    area: { laName: string | null; pts: Pt[]; ages: [number, number]; agesWord: string; forward: { pts: Pt[]; unbornFrom: number | null } | null };
  };
};

const yearLabel = (age: number) => (age <= 3 ? `Age ${age}` : age === 4 ? "R" : `Y${age - 4}`);
// Shapes travel as the classifier's keys; the page words them (ShapeIcon's SHAPE_LABELS).
const shapeWord = (s: string | null) => s;

/** Staying on at 16 at a school: its Year 12 (age 16) this census against its Year 11 (age 15)
 * the census before -- the same pupils a year on, an estimate of net staying-on (ADMISSIONS_NOTES.leaving16). */
export function stayingOnAt(table: Map<number, Map<number, { male: number; female: number }>>, P: number): { pct: number; from: number; to: number; year: number } | null {
  const y11 = cohortAt(table, 15, P - 1);
  const y12 = cohortAt(table, 16, P);
  if (!y11 || y12 === null) return null;
  return { pct: (y12 / y11) * 100, from: y11, to: y12, year: P };
}

/** The school's saved Admissions entry points (RLS decides; none before setup or without access). */
async function savedEntryPoints(supabase: SupabaseClient, urn: string): Promise<string[]> {
  const { data: acc } = await supabase.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>();
  if (!acc) return [];
  const { data, error } = await supabase.from("admissions_entry_points").select("entry_point, sort_order").eq("school_account_id", acc.id).order("sort_order");
  if (error) return [];
  return ((data ?? []) as { entry_point: string }[]).map((r) => r.entry_point);
}

export async function buildPupils(school: SmtSchool, set: SmtSet, level: SmtLevel, caller: SmtAdmissionsReader | null): Promise<Pupils> {
  const urn = school.urn;
  const setUrns = Array.from(new Set(set.urns.filter((u) => u !== urn)));
  const census = school.census;
  const now = census.at(-1) ?? null;
  const P = now?.period ?? null;
  const [own, setCensus, info] = await Promise.all([cachedCensus([urn]), cachedCensus(setUrns), fetchSchoolInfo([urn])]);
  const mine = own.get(urn);
  const roll = P === null ? null : rollAt(census, P);
  const base = rollAt(census, CENSUS_FIRST_PERIOD);

  // ------------------------------------------------------------ column 1
  const dist = await lookupAgeBandDistributions(school.laName, P ?? CURRENT_CENSUS_PERIOD);
  const sizes = sizeByBand(mine?.ageGender ?? new Map(), dist).map((b) => {
    const d = dist.get(b.key);
    return { key: b.key, label: AGE_BANDS.find((x) => x.key === b.key)?.label ?? b.label, total: b.total, badge: b.badge, laMean: d?.regionalMean ?? null, englandMean: d?.nationalMean ?? null };
  });
  const mainBand = school.phases.gcse ? "secondary" : school.phases.primary ? "primary" : school.phases.post16 ? "sixth_form" : null;
  const stayingOn = mine && P !== null && school.phases.gcse && school.phases.post16 ? stayingOnAt(mine.table, P) : null;

  // ------------------------------------------------------------ shape and size (described, never ranked)
  const counts = mine?.ageGender ?? new Map<number, { male: number; female: number }>();
  const yearGroups: YearGroup[] = Array.from(counts)
    .filter(([age, v]) => age >= 4 && age <= 17 && v.male + v.female > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([age, v]) => ({ age, label: yearLabel(age), female: v.female, male: v.male, total: v.male + v.female }));
  const byYear = mine ? Array.from(mine.ageGenderByPeriod, ([year, c]) => ({ year, shape: shapeOf(c) })).sort((a, b) => a.year - b.year) : [];
  const shapeNow = byYear.at(-1)?.shape ?? null;
  const changed = [...byYear].reverse().find((y) => y.shape !== shapeNow);
  const sinceYear = changed ? changed.year + 1 : (byYear[0]?.year ?? null);

  // The LA's schools of the same age range (low and high), from Admissions' nearby pool (all
  // sectors): the most common shape among them. Then the set's shapes, counted, never ranked.
  const nearby = await nearbyCandidates(urn);
  const laInfo = await fetchSchoolInfo(nearby.map((c) => c.urn));
  const sameType = nearby.filter((c) => c.urn !== urn && c.statutory_low_age === school.low && c.statutory_high_age === school.high && laInfo.get(c.urn)?.laName === school.laName).map((c) => c.urn);
  const laCensus = await cachedCensus(sameType);
  const laShapes = sameType.map((u) => (laCensus.get(u) ? shapeOf(laCensus.get(u)!.ageGender) : null)).filter((x): x is NonNullable<typeof x> => !!x);
  const mostCommon = (xs: string[]) => {
    const c = new Map<string, number>();
    for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
    return Array.from(c).sort((a, b) => b[1] - a[1]);
  };
  const laTop = mostCommon(laShapes)[0];
  const setShapes = mostCommon(setUrns.map((u) => (setCensus.get(u) ? shapeOf(setCensus.get(u)!.ageGender) : null)).filter((x): x is NonNullable<typeof x> => !!x)).map(([shape, schools]) => ({ shape: shapeWord(shape) ?? shape, schools }));
  // Staying on in the set: only its schools with a sixth form (GIAS top age 17 or more); an 11-16
  // school has no staying on to count (its census can still hold a few pupils aged 16).
  const england = await englandSchools();
  const setStaying = setUrns.map((u) => {
    const t = setCensus.get(u)?.table;
    if (!t || P === null || (england.get(u)?.high ?? 0) < 17) return null;
    return stayingOnAt(t, P)?.pct ?? null;
  }).filter((x): x is number => x !== null);

  // ------------------------------------------------------------ entry points at a glance (Admissions, read-only)
  let entries: Pupils["entries"] = { status: "empty", reason: smtNote("entryPointsNone") };
  const sb = caller?.supabase ?? null;
  if (caller?.privateNote) entries = { status: "empty", reason: caller.privateNote };
  else if (sb) {
    const eps = (await savedEntryPoints(sb, urn)).map((id) => entryPoint(id)).filter((e): e is EntryPoint => !!e);
    if (eps.length) {
      const rows = await Promise.all(
        eps.map(async (ep): Promise<EntrySummary> => {
          const pv = await pipelineView(urn, ep, await savedLists(sb, urn, ep.id));
          if ("empty" in pv) return { entry: ep.id, label: ep.label, age: ep.age, cohort: null, pool: null, poolYear: null, poolSource: null };
          const next = pv.ladder.future[0];
          return { entry: ep.id, label: ep.label.replace(/ \(.*\)$/, ""), age: ep.age, cohort: pv.now.cohort, pool: next?.pool ?? null, poolYear: next?.entryYear ?? null, poolSource: next?.source ?? null };
        }),
      );
      entries = { status: "ready", rows };
    }
  }

  // ------------------------------------------------------------ leaving at 16 (the census, year by year)
  const years = census.map((c) => c.period).filter((y) => y >= CENSUS_FIRST_PERIOD);
  const leaving = mine && school.phases.gcse && school.phases.post16
    ? years.slice(1).map((y) => {
        const y11 = cohortAt(mine.table, 15, y - 1);
        const y12 = cohortAt(mine.table, 16, y);
        // F-8: the one calculation Overview's "Net change at 16" reads too (entry-net.ts): leaving = -net.
        const yy = yearOnYear(mine.table, 16, y);
        return { year: y, year11: y11, year12: y12, leaving: yy ? -yy.net : null, stayingPct: y11 && y12 !== null ? (y12 / y11) * 100 : null };
      })
    : [];

  // ------------------------------------------------------------ row 2
  const bands = AGE_BANDS.filter((b) => b.key === "primary" || b.key === "secondary" || b.key === "sixth_form");
  const bandRoll = (y: number, b: (typeof AGE_BANDS)[number]) => {
    const c = mine?.ageGenderByPeriod.get(y);
    if (!c) return null;
    let t = 0;
    for (const [age, v] of c) if (age >= b.minAge && age <= b.maxAge) t += v.male + v.female;
    return t > 0 ? t : null;
  };
  const phaseLines = bands.filter((b) => sizes.some((s) => s.key === b.key)).map((b) => ({ key: b.key, label: b.key === "secondary" ? "Senior" : b.key === "sixth_form" ? "16+" : "Primary", pts: years.map((y) => ({ year: y, value: bandRoll(y, b) })) }));
  // England: pupils aged 5-15 in every mainstream school (the nine regions' census aggregates, as
  // Overview's roll line). roll_aggregates' national series jumps 11% from 2019/20 to 2020/21 (its
  // first year looks partial), so it isn't used here.
  const areaRows = await areaByAge();
  const engPts = years.map((y) => {
    const rs = areaRows.filter((r) => r.scope === "region" && r.period === y);
    if (rs.length !== 9) return { year: y, value: null };
    let t = 0;
    for (const r of rs) for (let a = 5; a <= 15; a++) t += r.byAge[String(a)] ?? 0;
    return { year: y, value: t };
  });
  const ix = indexTo([...phaseLines.map((l) => l.pts), engPts]);
  const phases = [...phaseLines.map((l, i) => ({ ...l, pts: ix.out[i], actual: l.pts })), { key: "england", label: "England", pts: ix.out[phaseLines.length], actual: engPts }];

  // The pool for the main entry point: Admissions' ladder -- counted, then from births.
  const mainEntry = school.phases.gcse && (school.low ?? 11) <= 11 ? "11+" : school.phases.primary ? "4+" : school.phases.post16 ? "16+" : null;
  let pool: Pupils["trends"]["pool"] = { status: "empty", reason: "No entry point to follow." };
  if (mainEntry) {
    const ep = entryPoint(mainEntry)!;
    // The lead's saved lists where the caller can read them; else Admissions' nearby defaults.
    const pv = await pipelineView(urn, ep, sb ? await savedLists(sb, urn, ep.id) : []);
    if (!("empty" in pv)) {
      const counted = [...pv.ladder.past, ...pv.ladder.future.filter((x) => x.source === "counted")].map((x) => ({ year: x.entryYear, value: x.pool }));
      const births = pv.ladder.future.filter((x) => x.source === "births").map((x) => ({ year: x.entryYear, value: x.pool }));
      // The births line starts from the last counted year, so the two join.
      const joined = counted.length && births.length ? [counted[counted.length - 1], ...births] : births;
      pool = { status: "ready", entry: ep.label.replace(/ \(.*\)$/, ""), counted, births: joined };
    } else pool = { status: "empty", reason: "No pool to draw: no feeder schools with a census for this entry point." };
  }

  // The area's school-age population (K5): the LA's residents aged 5-15 -- or the level's ages -- by
  // mid-year (ONS estimates; a shire county is its districts summed), from the census's first year.
  const areaAges: [number, number] = level.phase === "whole" ? [5, 15] : levelAges(level.phase, school.low, school.high);
  const laPop = await laPopulation(school.laCode);
  const areaPts = Array.from(laPop.keys())
    .filter((y) => y >= CENSUS_FIRST_PERIOD)
    .sort((a, b) => a - b)
    .map((y) => {
      const row = laPop.get(y)!;
      let t = 0;
      for (let a = areaAges[0]; a <= areaAges[1]; a++) t += row[a] ?? 0;
      return { year: y, value: t };
    });

  const proj = await laAreaProjection(school.laCode, areaAges).catch(() => null);
  const fwdRows = proj ? proj.rows.filter((r) => r.ageFrom === areaAges[0] && r.ageTo === areaAges[1]).sort((a, b) => a.year - b.year) : [];
  const forward = fwdRows.length > 1 ? { pts: fwdRows.map((r) => ({ year: r.year, value: r.middle })), unbornFrom: fwdRows.find((r) => r.includesUnborn)?.year ?? null } : null;

  const market = (await marketAt11(school, caller)).trend;
  const [girlsBoys, dayBoarding] = await Promise.all([
    school.mixed && mine ? girlsAndBoys(mine.ageGenderByPeriod, setUrns, setCensus) : Promise.resolve(null),
    school.boarding ? dayAndBoarding(census, setUrns) : Promise.resolve(null),
  ]);
  const highlight = LEVEL_AGES[level.phase];
  void info;
  return {
    urn,
    set: { kind: set.kind, label: set.label, size: setUrns.length },
    level,
    highlight,
    now: {
      census: P,
      roll,
      changePct: base && roll !== null ? ((roll - base) / base) * 100 : null,
      girls: now && now.gender.sumMatchesTotal ? now.gender.female : null,
      boys: now && now.gender.sumMatchesTotal ? now.gender.male : null,
      boarding: school.boarding && now?.boarding ? { day: now.boarding.day, boarders: now.boarding.boarders } : null,
      stayingOn,
      sizes,
      mainBand,
      laName: school.laName,
    },
    shape: {
      yearGroups,
      label: shapeWord(shapeNow),
      sinceYear,
      was: changed ? shapeWord(changed.shape) : null,
      around: {
        la: laTop ? { label: `${school.laName ?? "The LA"} ${school.low}–${school.high} schools`, shape: shapeWord(laTop[0]), schools: laTop[1], of: laShapes.length } : null,
        set: setShapes,
        stayingOnSet: { pct: percentile(setStaying, 50), schools: setStaying.length },
      },
    },
    entries,
    leaving,
    market,
    girlsBoys,
    dayBoarding,
    trends: { phases, base: ix.base, pool, area: { laName: school.laName, pts: areaPts, ages: areaAges, agesWord: agesWordOf(areaAges), forward } },
  };
}

// ------------------------------------------------------------ 0.8 SMT Academic (R-SMT-NO-PILLS): the two views

/** The set's middle (median) and how many schools it is over. */
export type SetMiddle = { median: number | null; schools: number };
const middleOf = (xs: (number | null)[]): SetMiddle => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return { median: percentile(v, 50), schools: v.length };
};

export type GirlsBoys = {
  year: number;
  // Each year group in the latest census: its girls and boys, girls' share (%), and the middle of the
  // set's mixed schools' girls' share in that year group (those with pupils in it).
  years: { age: number; label: string; girls: number; boys: number; share: number | null; set: SetMiddle }[];
  // The whole school's girls' share now and in `baseYear` (CENSUS_FIRST_PERIOD, or the school's first census
  // after it), its change in percentage points, and the same for the set's mixed schools (each school's own
  // change; the middle of them).
  whole: { share: number | null; baseYear: number | null; base: number | null; change: number | null; set: { share: SetMiddle; change: SetMiddle } };
  // Where the balance moves: Year 7 (the newest intake) against Years 8 to 11; the sixth form (Years 12 and
  // 13) against Years 7 to 11. Percentage points; the set's middle of the same shift.
  shifts: { key: "year7" | "sixth"; label: string; against: string; share: number | null; againstShare: number | null; shift: number | null; set: SetMiddle }[];
  // Girls' share year by year, the school's and the middle of the set's mixed schools with a census in every year.
  trend: { school: Pt[]; set: Pt[]; setSchools: number };
  // The set's schools left out: single-sex (GIAS), or with no girls or no boys in the census (never a 0).
  leftOut: number;
};

export type DayBoarding = {
  year: number;
  now: { boarders: number; day: number; share: number };
  baseYear: number | null;
  change: number | null; // percentage points since baseYear
  // The school's boarders, day pupils and boarders' share, census by census.
  years: { year: number; boarders: number | null; day: number | null; share: number | null }[];
  // The set's boarding schools (boarders in the census): the middle of their boarders' share now, of their
  // change since baseYear, and year by year over those with boarders in every year shown.
  set: { share: SetMiddle; change: SetMiddle; trend: Pt[]; trendSchools: number; boardingSchools: number; of: number };
};

const SHIFT_AGES = { year7: { at: [11, 11], against: [12, 15] }, sixth: { at: [16, 17], against: [11, 15] } } as const;

/** Girls' share (%) of the pupils aged `lo` to `hi` in one census year's counts; null with nobody. */
export function girlsShare(c: AgeGenderCounts | undefined, lo = 0, hi = 19): number | null {
  if (!c) return null;
  let g = 0;
  let t = 0;
  for (const [age, v] of c) {
    if (age < lo || age > hi) continue;
    g += v.female;
    t += v.female + v.male;
  }
  return t > 0 ? (g / t) * 100 : null;
}

/** A school that counts in a set's girls' share in a year: GIAS mixed, with girls and boys in that census. A
 * single-sex school is left out, never counted as 0 (the third pill bug, R-SMT-NO-PILLS). */
export function countsAsMixed(gender: string | null | undefined, c: AgeGenderCounts | undefined): boolean {
  if (gender !== "Mixed" || !c) return false;
  let g = 0;
  let b = 0;
  for (const v of c.values()) {
    g += v.female;
    b += v.male;
  }
  return g > 0 && b > 0;
}

/** GIAS gender of entry ("Mixed", "Girls", "Boys") for each school. Public data, cached an hour. */
function giasGender(urns: string[]): Promise<Map<string, string | null>> {
  const key = Array.from(new Set(urns)).sort();
  return cachedReference(`smt:gias-gender:${key.join(",")}`, async () => {
    const supabase = createServerAnonSupabaseClient();
    const out = new Map<string, string | null>();
    for (let i = 0; i < key.length; i += 300) {
      const { data, error } = await supabase.from("schools").select("urn, gender").in("urn", key.slice(i, i + 300));
      if (error) throw error;
      for (const r of (data ?? []) as { urn: string; gender: string | null }[]) out.set(r.urn, r.gender);
    }
    return out;
  });
}

/** Girls and boys (a mixed school only): from the census's sex x single-age counts, the school's and every set
 * school's (the reads buildPupils already makes, cachedCensus). */
export async function girlsAndBoys(own: Map<number, AgeGenderCounts>, setUrns: string[], setCensus: Map<string, SchoolCensus>): Promise<GirlsBoys | null> {
  const years = Array.from(own.keys()).filter((y) => y >= CENSUS_FIRST_PERIOD && girlsShare(own.get(y)) !== null).sort((a, b) => a - b);
  const P = years.at(-1);
  if (P === undefined) return null;
  const now = own.get(P)!;
  const gender = await giasGender(setUrns);
  // Each set school's counts in a year, only where it counts as mixed that year.
  const mixedAt = (u: string, y: number) => {
    const c = setCensus.get(u)?.ageGenderByPeriod.get(y);
    return countsAsMixed(gender.get(u), c) ? c! : undefined;
  };
  const counted = setUrns.filter((u) => mixedAt(u, P));
  const ages = Array.from(now).filter(([age, v]) => age >= 4 && age <= 17 && v.male + v.female > 0).sort((a, b) => a[0] - b[0]);
  const yearRows = ages.map(([age, v]) => ({
    age,
    label: yearLabel(age),
    girls: v.female,
    boys: v.male,
    share: girlsShare(now, age, age),
    set: middleOf(counted.map((u) => girlsShare(mixedAt(u, P), age, age))),
  }));
  const baseYear = years[0] ?? null;
  const share = girlsShare(now);
  const base = baseYear !== null && baseYear < P ? girlsShare(own.get(baseYear)) : null;
  const setChange = baseYear !== null && baseYear < P ? counted.map((u) => {
    const a = girlsShare(mixedAt(u, baseYear));
    const b = girlsShare(mixedAt(u, P));
    return a === null || b === null ? null : b - a;
  }) : [];
  const shiftOf = (c: AgeGenderCounts | undefined, k: keyof typeof SHIFT_AGES) => {
    const a = girlsShare(c, ...SHIFT_AGES[k].at);
    const b = girlsShare(c, ...SHIFT_AGES[k].against);
    return a === null || b === null ? null : a - b;
  };
  const shifts = (["year7", "sixth"] as const)
    .map((key) => ({
      key,
      label: key === "year7" ? "Year 7" : "Sixth form",
      against: key === "year7" ? "Years 8 to 11" : "Years 7 to 11",
      share: girlsShare(now, ...SHIFT_AGES[key].at),
      againstShare: girlsShare(now, ...SHIFT_AGES[key].against),
      shift: shiftOf(now, key),
      set: middleOf(counted.map((u) => shiftOf(mixedAt(u, P), key))),
    }))
    .filter((x) => x.shift !== null);
  // The set's line: its mixed schools with a census in every year shown, so a school joining doesn't move it.
  const steady = setUrns.filter((u) => years.every((y) => mixedAt(u, y)));
  return {
    year: P,
    years: yearRows,
    whole: { share, baseYear: base === null ? null : baseYear, base, change: share !== null && base !== null ? share - base : null, set: { share: middleOf(counted.map((u) => girlsShare(mixedAt(u, P)))), change: middleOf(setChange) } },
    shifts,
    trend: { school: years.map((y) => ({ year: y, value: girlsShare(own.get(y)) })), set: steady.length ? years.map((y) => ({ year: y, value: middleOf(steady.map((u) => girlsShare(mixedAt(u, y)))).median })) : [], setSchools: steady.length },
    leftOut: setUrns.length - counted.length,
  };
}

const boardersShare = (c: RollSnapshot | undefined) => (c?.boarding && c.boarding.boarders > 0 && c.totalRoll > 0 ? (c.boarding.boarders / c.totalRoll) * 100 : null);

/** Day and boarding (a boarding school only): boarders, day pupils and boarders' share census by census, against
 * the set's boarding schools (those with boarders in the census). The census counts boarders for the whole
 * school only (and by sex), not by year group, so there is no split by phase. */
export async function dayAndBoarding(census: RollSnapshot[], setUrns: string[]): Promise<DayBoarding | null> {
  const mine = census.filter((c) => c.period >= CENSUS_FIRST_PERIOD);
  const last = [...mine].reverse().find((c) => boardersShare(c) !== null);
  if (!last || !last.boarding) return null;
  const P = last.period;
  const shown = mine.filter((c) => c.period <= P);
  const years = shown.map((c) => c.period);
  const sets = await Promise.all(setUrns.map((u) => schoolCensus(u).catch(() => [] as RollSnapshot[])));
  const at = (cs: RollSnapshot[], y: number) => cs.find((c) => c.period === y);
  const first = shown.find((c) => boardersShare(c) !== null)!;
  const baseYear = first.period < P ? first.period : null;
  const shareNow = boardersShare(last)!;
  const boardingNow = sets.filter((cs) => boardersShare(at(cs, P)) !== null);
  const steady = sets.filter((cs) => years.every((y) => boardersShare(at(cs, y)) !== null));
  return {
    year: P,
    now: { boarders: last.boarding.boarders, day: last.boarding.day, share: shareNow },
    baseYear,
    change: baseYear === null ? null : shareNow - boardersShare(first)!,
    years: shown.map((c) => ({ year: c.period, boarders: c.boarding?.boarders ?? null, day: c.boarding?.day ?? null, share: boardersShare(c) })),
    set: {
      share: middleOf(boardingNow.map((cs) => boardersShare(at(cs, P)))),
      change: middleOf(baseYear === null ? [] : boardingNow.map((cs) => {
        const a = boardersShare(at(cs, baseYear));
        const b = boardersShare(at(cs, P));
        return a === null || b === null ? null : b - a;
      })),
      trend: steady.length ? years.map((y) => ({ year: y, value: middleOf(steady.map((cs) => boardersShare(at(cs, y)))).median })) : [],
      trendSchools: steady.length,
      boardingSchools: boardingNow.length,
      of: setUrns.length,
    },
  };
}

export const PUPILS_NOTES ={ leaving16: ADMISSIONS_NOTES.leaving16, shape: ADMISSIONS_NOTES.shape, census: (P: number) => `January ${P + 1} census (${periodLabel(P)})` };
