import { competitionRanks } from "../rank";
// VicData 0.7 admissions (A1): small shared statistics. Pure.

/** Percentile with linear interpolation between order statistics (numpy's default, "type 7"). */
export function percentile(values: number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  if (v.length === 1) return v[0];
  const h = (v.length - 1) * (p / 100);
  const lo = Math.floor(h);
  return v[lo] + (h - lo) * (v[Math.min(lo + 1, v.length - 1)] - v[lo]);
}

/** Ranks, highest first; ties share a rank and the next skips (R-RANK-TIES). */
export function ranksOf<K>(items: { key: K; value: number | null }[]): Map<K, number> {
  return new Map(Array.from(competitionRanks(items), ([k, p]) => [k, p.rank]));
}
