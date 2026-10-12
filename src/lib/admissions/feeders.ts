// VicData 0.7 admissions (A4): feeder flags for a pipeline's schools. Pure over a pipeline's
// census: each feeder's pupils across the rung ages it holds, now against two years ago, compared
// with the whole set's (the area's) -- a drop bigger than the area's is a red flag, rising or
// stable numbers a school to focus on (R-ADM-FLAG-FEEDER). Never from a small cohort.
import type { CohortTable } from "./cohort";
import { cohortAt } from "./cohort";
import { feederFlag, type Flag } from "./flags";

export function feederFlags(tables: Map<string, CohortTable>, ages: number[], period: number, minCohort: number): { urn: string; from: number | null; to: number | null; flag: Flag | null }[] {
  const sum = (t: CohortTable, p: number) => {
    let s: number | null = null;
    for (const a of ages) {
      const v = cohortAt(t, a, p);
      if (v !== null) s = (s ?? 0) + v;
    }
    return s;
  };
  let areaFrom = 0;
  let areaTo = 0;
  const per = Array.from(tables, ([urn, t]) => ({ urn, from: sum(t, period - 2), to: sum(t, period) }));
  for (const p of per) if (p.from !== null && p.to !== null) { areaFrom += p.from; areaTo += p.to; }
  return per.map((p) => ({ ...p, flag: areaFrom > 0 ? feederFlag(p, { from: areaFrom, to: areaTo }, minCohort) : null }));
}
