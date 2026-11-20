// VicData speed plan §4.2 item 1, extended to SMT's Overview: each school's census figures, as the Overview reads
// them of a set school. Server-only. Pure: no reads here.
//
// The Overview compares the school with every school in its set. Of a set school it needs only:
//   - its roll each census year, with its day and boarding split (the set's average lines; the map's dots and
//     roll direction), from the school census by year (school.ts schoolCensus / schoolCensuses);
//   - its latest census's pupils in each age band (the set's size by phase), and its Year 7 entry cohort each
//     year (the market share at 11+), from Admissions' age-by-age census (admissions/data.ts cachedCensus).
// `overviewFigures` works those out from the school's own census; the Overview (overview.ts) reads every school
// through `OverviewMembers`, which is either
//   - overviewMembersFromRaw: today's reads, each school worked out by overviewFigures on first use; or
//   - the store (overview-figures-store.ts): the same overviewFigures output, built ahead by
//     scripts/build-smt-figures.ts --stage census into smt_school_figures.
// One implementation of every per-school figure, so the two can't disagree (the parity rule, as Academic's
// school-figures.ts).
import type { RollSnapshot } from "../roll-data";
import type { SchoolCensus } from "../admissions/data";
import { sizeByBand } from "../admissions/shape";
import { cohortSeries } from "../admissions/shares";
import { entryPoint } from "../admissions/entry-points";

/** The market share's entry age (Admissions' 11+ entry point). */
export const ENTRY_AGE = entryPoint("11+")!.age;

/** One census year of a school as the Overview reads it: the roll, and the day/boarding split where the census
 * counts boarders. */
export type CensusYear = { period: number; totalRoll: number; boarding: { day: number; boarders: number } | null };

/** One school's Overview figures. Short keys: stored once per school. */
export type OverviewFigures = {
  /** each census year, in the census's own order: [period, roll] or, with boarders counted, [period, roll, day, boarders] */
  c: number[][];
  /** the latest census with pupils (Admissions' age table): pupils in each age band with any */
  b: Record<string, number>;
  /** the entry cohort (ENTRY_AGE) each year of Admissions' age table: [period, pupils or null] */
  k: [number, number | null][];
};

/** A school's Overview figures, from its own census by year and its age-by-age census (absent: none). */
export function overviewFigures(census: readonly RollSnapshot[], adm: Pick<SchoolCensus, "table" | "ageGender"> | undefined): OverviewFigures {
  const b: Record<string, number> = {};
  for (const x of sizeByBand(adm?.ageGender ?? new Map(), new Map())) b[x.key] = x.total;
  return {
    c: census.map((s) => (s.boarding ? [s.period, s.totalRoll, s.boarding.day, s.boarding.boarders] : [s.period, s.totalRoll])),
    b,
    k: Array.from(cohortSeries(adm?.table ?? new Map(), [ENTRY_AGE])),
  };
}

/** Every school as the Overview reads it. */
export type OverviewMembers = {
  census(u: string): readonly CensusYear[];
  /** age band key -> pupils (bands with none left out) */
  bands(u: string): ReadonlyMap<string, number>;
  /** census year -> the entry cohort (null: no pupils counted that year) */
  entry(u: string): ReadonlyMap<number, number | null>;
};

/** Members over each school's figures (worked out or read), each decoded once. */
export function overviewMembers(figuresOf: (u: string) => OverviewFigures): OverviewMembers {
  const memo = new Map<string, { census: CensusYear[]; bands: Map<string, number>; entry: Map<number, number | null> }>();
  const of = (u: string) => {
    let m = memo.get(u);
    if (!m) {
      const f = figuresOf(u);
      m = {
        census: f.c.map((x) => ({ period: x[0], totalRoll: x[1], boarding: x.length > 2 ? { day: x[2], boarders: x[3] } : null })),
        bands: new Map(Object.entries(f.b)),
        entry: new Map(f.k),
      };
      memo.set(u, m);
    }
    return m;
  };
  return { census: (u) => of(u).census, bands: (u) => of(u).bands, entry: (u) => of(u).entry };
}

/** Today's reads as members: each school worked out on first use (a school missing from a read has none). */
export function overviewMembersFromRaw(censusBy: ReadonlyMap<string, RollSnapshot[]>, adm: ReadonlyMap<string, Pick<SchoolCensus, "table" | "ageGender">>): OverviewMembers {
  return overviewMembers((u) => overviewFigures(censusBy.get(u) ?? [], adm.get(u)));
}
