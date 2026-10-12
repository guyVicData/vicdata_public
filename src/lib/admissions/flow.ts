// VicData 0.7 admissions (A1): following a cohort across census years, per school (rolls spec
// §7). Pure. The derived table school_cohort_flow (ingest repo) stores the same figures; the
// server reads it when present and computes them here otherwise -- one definition:
//   leaving share at 16, year t   (cohort(15, t-1) - cohort(16, t)) / cohort(15, t-1); null under
//                                 MIN_FLOW_COHORT at 15; not clamped (negative = net joiners)
//   joiners at age a, year t      max(0, cohort(a, t) - cohort(a-1, t-1)): a net-growth lower
//                                 bound, an ESTIMATE (R-ADM-JOINERS-ESTIMATE)
import type { CohortTable } from "./cohort";
import { cohortAt, periodsOf } from "./cohort";

export const MIN_FLOW_COHORT = 10;
export const JOINER_AGES: { from: number; to: number } = { from: 5, to: 18 };

export type FlowRow = { period: number; age: number; cohort: number | null; cohortPrevYounger: number | null; joinersEst: number | null; leavingShare16: number | null };

export function cohortFlow(t: CohortTable): FlowRow[] {
  const out: FlowRow[] = [];
  for (const p of periodsOf(t)) {
    if (!t.has(p - 1)) continue;
    for (let a = JOINER_AGES.from; a <= JOINER_AGES.to; a++) {
      const now = cohortAt(t, a, p);
      const prev = cohortAt(t, a - 1, p - 1);
      const joiners = now === null || prev === null ? null : Math.max(0, now - prev);
      let leaving: number | null = null;
      if (a === 16 && prev !== null && now !== null && prev >= MIN_FLOW_COHORT) leaving = (prev - now) / prev;
      out.push({ period: p, age: a, cohort: now, cohortPrevYounger: prev, joinersEst: joiners, leavingShare16: leaving });
    }
  }
  return out;
}

/** The latest leaving share at 16 (the "big leaving numbers at 16" criterion reads it). */
export function latestLeaving16(rows: FlowRow[]): { period: number; share: number } | null {
  const r = rows.filter((x) => x.age === 16 && x.leavingShare16 !== null).sort((a, b) => b.period - a.period)[0];
  return r ? { period: r.period, share: r.leavingShare16! } : null;
}
