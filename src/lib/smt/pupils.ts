// VicData 0.8 SMT round 2: Pupils (spec §2.3; wireframe Pupils). Server-only. Assembled from the
// reads round 1 and Admissions already make -- the census (roll, year groups, gender, boarding),
// the school page's XS-XL, the shared shape classifier, Admissions' pipeline, entry points and
// market share -- read-only where Admissions owns them. Nothing is ranked by shape (R-ADM-SHAPE-NOT-RANKED).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmtAdmissionsReader } from "./auth-rules";
import { CENSUS_FIRST_PERIOD, CURRENT_CENSUS_PERIOD, periodLabel } from "@/catalogue/years";
import { ADMISSIONS_NOTES, smtNote } from "@/catalogue/notes";
import { lookupAgeBandDistributions } from "../age-band-distributions";
import { AGE_BANDS } from "../roll-data";
import { cachedCensus, fetchSchoolInfo } from "../admissions/data";
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
import { laPopulation } from "./area-data";
import type { SmtSchool } from "./school";
import { marketAt11, rollAt, type Overview, type Pt, type SmtFilters, type SmtSet } from "./overview";

// The ages each level highlights (R-SMT-PUPILS-LEVEL): GCSE 11-16, Post-16 16-18, Primary 4-11.
export const LEVEL_AGES: Record<SmtLevel["phase"], [number, number] | null> = { whole: null, primary: [4, 11], gcse: [11, 16], post16: [16, 18] };

export type YearGroup = { age: number; label: string; female: number; male: number; total: number };
export type EntrySummary = { entry: string; label: string; age: number; cohort: number | null; pool: number | null; poolYear: number | null; poolSource: string | null };

export type Pupils = {
  urn: string;
  set: { kind: string; label: string; size: number };
  filters: SmtFilters;
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
  trends: {
    phases: { key: string; label: string; pts: Pt[] }[];
    base: number | null;
    pool: { status: "ready"; entry: string; counted: Pt[]; births: Pt[] } | { status: "empty"; reason: string };
    // 0.8 SMT r3 (K5): the LA's residents of the ages (ONS mid-year estimates), not census pupils.
    area: { laName: string | null; pts: Pt[]; ages: [number, number]; agesWord: string };
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

export async function buildPupils(school: SmtSchool, set: SmtSet, filters: SmtFilters, level: SmtLevel, caller: SmtAdmissionsReader | null): Promise<Pupils> {
  const urn = school.urn;
  const setUrns = Array.from(new Set(set.urns.filter((u) => u !== urn)));
  const f: SmtFilters = { sex: school.mixed ? filters.sex : "all", boarding: school.boarding ? filters.boarding : "all" };
  const census = school.census;
  const now = census.at(-1) ?? null;
  const P = now?.period ?? null;
  const [own, setCensus, info] = await Promise.all([cachedCensus([urn]), cachedCensus(setUrns), fetchSchoolInfo([urn])]);
  const mine = own.get(urn);
  const roll = P === null ? null : rollAt(census, P, f);
  const base = rollAt(census, CENSUS_FIRST_PERIOD, f);

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
        return { year: y, year11: y11, year12: y12, leaving: y11 !== null && y12 !== null ? y11 - y12 : null, stayingPct: y11 && y12 !== null ? (y12 / y11) * 100 : null };
      })
    : [];

  // ------------------------------------------------------------ row 2
  const bands = AGE_BANDS.filter((b) => b.key === "primary" || b.key === "secondary" || b.key === "sixth_form");
  const bandRoll = (y: number, b: (typeof AGE_BANDS)[number]) => {
    const c = mine?.ageGenderByPeriod.get(y);
    if (!c) return null;
    let t = 0;
    for (const [age, v] of c) if (age >= b.minAge && age <= b.maxAge) t += f.sex === "female" ? v.female : f.sex === "male" ? v.male : v.male + v.female;
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
  const phases = [...phaseLines.map((l, i) => ({ ...l, pts: ix.out[i] })), { key: "england", label: "England", pts: ix.out[phaseLines.length] }];

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

  const market = (await marketAt11(school, caller)).trend;
  const highlight = LEVEL_AGES[level.phase];
  void info;
  return {
    urn,
    set: { kind: set.kind, label: set.label, size: setUrns.length },
    filters: f,
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
    trends: { phases, base: ix.base, pool, area: { laName: school.laName, pts: areaPts, ages: areaAges, agesWord: agesWordOf(areaAges) } },
  };
}

export const PUPILS_NOTES = { leaving16: ADMISSIONS_NOTES.leaving16, shape: ADMISSIONS_NOTES.shape, census: (P: number) => `January ${P + 1} census (${periodLabel(P)})` };
