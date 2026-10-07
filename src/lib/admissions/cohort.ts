// VicData 0.7 admissions (A1): one school's (or a set's) pupils at each single age, per
// census year, as the admissions maths reads them. Pure.
//
// Source: DfE school census facts (dfe_school_census), breakdowns
// `{full_time|part_time}_{female|male}_aged_{age}`, the period being the academic year whose
// January census it is, ages at 31 August of that year (period 2025 = the 2025/26 census).
//
// What counts as a pupil (call, logged): FULL-TIME pupils for ages 4 and up -- a Reception
// child or older is full-time at school, and part-time rows at those ages are a handful of
// edge cases; at nursery ages (2 and 3) full-time PLUS part-time headcount, because most
// nursery places are part-time. Ages 0-1 (early years) are never a rung. This differs from
// the school page's roll (full- plus part-time at every age) on purpose: the roll is "who is
// on the books", the cohort is "who will move up". The derived table school_cohort_flow (ingest
// repo) uses the same definition.
import type { ReferenceFact } from "../vicdata-reference";

const AGE_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;
export const NURSERY_AGE_MAX = 3;

export type SexCount = { male: number; female: number };
// period -> age -> count (both sexes, and by sex)
export type CohortTable = Map<number, Map<number, SexCount>>;

export function cohortTable(facts: ReferenceFact[]): CohortTable {
  const out: CohortTable = new Map();
  for (const f of facts) {
    const m = AGE_RE.exec(f.breakdown);
    if (!m || f.value_numeric === null) continue;
    const [, mode, sex, ageStr] = m;
    const age = Number(ageStr);
    if (mode === "part_time" && age > NURSERY_AGE_MAX) continue;
    const byAge = out.get(f.period) ?? out.set(f.period, new Map()).get(f.period)!;
    const c = byAge.get(age) ?? byAge.set(age, { male: 0, female: 0 }).get(age)!;
    if (sex === "male") c.male += f.value_numeric;
    else c.female += f.value_numeric;
  }
  return out;
}

export type Sex = "all" | "male" | "female";
const pick = (c: SexCount | undefined, sex: Sex): number | null => (c === undefined ? null : sex === "all" ? c.male + c.female : c[sex]);

/** The count at one age in one census year, or null where the school has no census that year
 * (no rows at all, or a year whose rows are all zero -- the Reigate quirk, see roll-data.ts). */
export function cohortAt(table: CohortTable, age: number, period: number, sex: Sex = "all"): number | null {
  const byAge = table.get(period);
  if (!byAge) return null;
  let any = 0;
  for (const c of byAge.values()) any += c.male + c.female;
  if (any === 0) return null;
  return pick(byAge.get(age), sex) ?? 0;
}

/** A set's tables summed per age and year (a school missing a year adds nothing that year). */
export function sumTables(tables: CohortTable[]): CohortTable {
  const out: CohortTable = new Map();
  for (const t of tables) {
    for (const [period, byAge] of t) {
      const o = out.get(period) ?? out.set(period, new Map()).get(period)!;
      for (const [age, c] of byAge) {
        const x = o.get(age) ?? o.set(age, { male: 0, female: 0 }).get(age)!;
        x.male += c.male;
        x.female += c.female;
      }
    }
  }
  return out;
}

export function periodsOf(table: CohortTable): number[] {
  return Array.from(table.keys()).sort((a, b) => a - b);
}
