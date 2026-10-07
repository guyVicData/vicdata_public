// VicData 0.7 admissions (A1): shares. Pure.
//
//   hold share   the school's entry-age cohort now, divided by each future pool: the share it
//                would need to keep the same intake. A requirement, not a forecast
//                (R-ADM-HOLD-SHARE). The current share is the latest year's own.
//   group share  the school's count at the entry age divided by the sum over the rivals plus
//                the school, per census year -- a share of THIS GROUP, not of the local market
//                (R-ADM-GROUP-SHARE); the same for a whole age band; ranks within the set.
import type { CohortTable, Sex } from "./cohort";
import { cohortAt, periodsOf } from "./cohort";
import type { Ladder } from "./ladder";
import { ranksOf } from "./stats";

export type HoldShare = {
  current: { entryYear: number; cohort: number; pool: number; share: number } | null;
  needed: { entryYear: number; share: number | null; low: number | null; high: number | null; source: string }[];
};

export function holdShare(ladder: Ladder, school: CohortTable, censusPeriod: number, sex: Sex = "all"): HoldShare {
  const E = ladder.entry.age;
  const cohort = cohortAt(school, E, censusPeriod, sex);
  const pastNow = ladder.past.find((p) => p.entryYear === censusPeriod && p.pool);
  const current = cohort !== null && pastNow?.pool ? { entryYear: censusPeriod, cohort, pool: pastNow.pool, share: (cohort / pastNow.pool) * 100 } : null;
  return {
    current,
    needed: ladder.future.map((p) => ({
      entryYear: p.entryYear,
      share: cohort === null || !p.pool ? null : (cohort / p.pool) * 100,
      // a smaller pool needs a larger share: the high pool gives the low requirement
      low: cohort === null || !p.high ? null : (cohort / p.high) * 100,
      high: cohort === null || !p.low ? null : (cohort / p.low) * 100,
      source: p.source,
    })),
  };
}

export type GroupShareRow = { urn: string; period: number; count: number | null; share: number | null; rank: number | null };

/** Each school's share of the group's pupils at the given ages, per census year, with ranks. */
export function groupShare(tables: Map<string, CohortTable>, ages: number[], sex: Sex = "all"): { periods: number[]; rows: GroupShareRow[]; totals: Map<number, number> } {
  const periods = Array.from(new Set(Array.from(tables.values()).flatMap(periodsOf))).sort((a, b) => a - b);
  const rows: GroupShareRow[] = [];
  const totals = new Map<number, number>();
  for (const p of periods) {
    const counts = new Map<string, number | null>();
    let total = 0;
    for (const [urn, t] of tables) {
      let c: number | null = null;
      for (const a of ages) {
        const v = cohortAt(t, a, p, sex);
        if (v !== null) c = (c ?? 0) + v;
      }
      counts.set(urn, c);
      total += c ?? 0;
    }
    totals.set(p, total);
    const ranks = ranksOf(Array.from(counts, ([key, value]) => ({ key, value })));
    for (const [urn, c] of counts) rows.push({ urn, period: p, count: c, share: c === null || total === 0 ? null : (c / total) * 100, rank: ranks.get(urn) ?? null });
  }
  return { periods, rows, totals };
}
