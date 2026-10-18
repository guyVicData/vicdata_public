// VicData 0.8 SMT feedback round 1 (F-8): the independent school's entry tiles on Overview's "The school
// now" -- "Joining at 11" or "Net change at 11", and "Net change at 16" -- in place of the GCSE and
// Progress 8 tiles DfE publishes nothing for. Pure.
//
// One calculation with SMT Pupils' "Leaving at 16" (R-INDEP-ENTRY-TILES): a year group this census
// against the year below it the census before, the same pupils a year on, from the same cohort table
// (cohortAt: full-time pupils by age at 31 August, day and boarding together, both sexes). Net change at
// 16 is exactly minus Pupils' "leaving" for the same year; a plus means the sixth form gained on what
// came up from Year 11.
import { cohortAt, type CohortTable } from "../admissions/cohort";

/** The year group at `age` this census against the year below it (age - 1) the census before. */
export function yearOnYear(table: CohortTable, age: number, P: number): { now: number; before: number; net: number } | null {
  const before = cohortAt(table, age - 1, P - 1);
  const now = cohortAt(table, age, P);
  if (before === null || now === null) return null;
  return { now, before, net: now - before };
}

export type EntryTile = {
  key: "join11" | "net11" | "net16";
  label: string;
  // The tile's figure: Year 7 (joining at 11), or the net change.
  value: number;
  year: number;
  // The year group's own count this census and the year below last census (for the (i)).
  now: number;
  before: number | null;
  // The % change in the year group's roll (Year 7, or Year 12) since `base` (F-8's suggested
  // definition, logged for Guy): null without a count that year.
  since: { base: number; pct: number } | null;
};

const pctSince = (table: CohortTable, age: number, base: number, now: number) => {
  const b = cohortAt(table, age, base);
  return b ? { base, pct: ((now - b) / b) * 100 } : null;
};

/** The school's entry tiles, latest census P: at 11 when it has a Year 7, at 16 when it has a Year 12
 * and a Year 11 to come up from. "Joining at 11" when the school's first year is Year 7 -- GIAS's
 * statutory low age is 11 or more (`low`), so every Year 7 pupil is a joiner -- else "Net change at 11"
 * (Year 7 against last year's Year 6). GIAS decides, not the census: an 11-18 school's census can hold a
 * pupil or two aged 10 (Leighton Park's 2024/25 has one), which isn't a Year 6. */
export function entryTiles(table: CohortTable, P: number, base: number, low: number | null): EntryTile[] {
  const out: EntryTile[] = [];
  const y7 = cohortAt(table, 11, P);
  if (y7) {
    const hasY6 = low !== null ? low <= 10 : (cohortAt(table, 10, P - 1) ?? 0) > 0;
    const yy = hasY6 ? yearOnYear(table, 11, P) : null;
    if (!hasY6) out.push({ key: "join11", label: "Joining at 11", value: y7, year: P, now: y7, before: null, since: pctSince(table, 11, base, y7) });
    else if (yy) out.push({ key: "net11", label: "Net change at 11", value: yy.net, year: P, now: yy.now, before: yy.before, since: pctSince(table, 11, base, yy.now) });
  }
  const y12 = yearOnYear(table, 16, P);
  if (y12 && y12.now > 0 && y12.before > 0) out.push({ key: "net16", label: "Net change at 16", value: y12.net, year: P, now: y12.now, before: y12.before, since: pctSince(table, 16, base, y12.now) });
  return out;
}
