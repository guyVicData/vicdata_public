// VicData 0.6.1 S3: 2 · View's look options that need a little arithmetic -- an order, the
// top ten, an average of the bars DRAWN. None of them changes a figure: they reorder, leave
// rows out of the picture, or add a line at an average of what is shown (an average of
// things not drawn is 1 · Data's compare, never a look).
import type { BarLook, LineLook } from "@/catalogue/viewspec";
import { meanOf } from "@/lib/teacher-view-panels";

export type Orderable = { key: string; label: string; value: number | null; against?: number | null };

const desc = (a: number | null | undefined, b: number | null | undefined) => (b ?? -Infinity) - (a ?? -Infinity);

// "highest": largest first (nulls last), the hosts' order; "az": by name; "above-comparison":
// furthest above what each row is read against first (rows with nothing to read against last).
export function orderRows<T extends Orderable>(rows: T[], order: BarLook["order"] = "highest"): T[] {
  if (order === "az") return [...rows].sort((a, b) => a.label.localeCompare(b.label));
  if (order === "above-comparison") {
    const gap = (r: T) => (r.value !== null && r.against !== null && r.against !== undefined ? r.value - r.against : null);
    return [...rows].sort((a, b) => desc(gap(a), gap(b)));
  }
  return [...rows].sort((a, b) => desc(a.value, b.value));
}

// The first ten in the order given, with the focused row always kept (in its place).
export function topTen<T extends { key: string }>(rows: T[], focusKey: string | null): T[] {
  if (rows.length <= 10) return rows;
  const keep = new Set(rows.slice(0, 10).map((r) => r.key));
  if (focusKey) keep.add(focusKey);
  return rows.filter((r) => keep.has(r.key));
}

export function medianOf(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!real.length) return null;
  const mid = Math.floor(real.length / 2);
  return real.length % 2 ? real[mid] : (real[mid - 1] + real[mid]) / 2;
}

// Weighted by each row's own count (entries); null where no row has both.
export function weightedMeanOf(values: (number | null)[], weights: (number | null)[]): number | null {
  let sum = 0;
  let w = 0;
  values.forEach((v, i) => {
    const wt = weights[i];
    if (v === null || wt === null || wt === undefined || wt <= 0) return;
    sum += v * wt;
    w += wt;
  });
  return w > 0 ? sum / w : null;
}

const AVERAGE_WORD = { mean: "Average", median: "Median", weighted: "Weighted average" } as const;

// The look's average line over the bars drawn: its value and its key's words. null = none
// asked for, or nothing to average (a weighted average needs the counts behind the bars).
export function averageOfShown(
  average: BarLook["average"],
  values: (number | null)[],
  weights: (number | null)[] | null,
  noun: string,
): { value: number; label: string } | null {
  if (!average || average === "none") return null;
  const value = average === "mean" ? meanOf(values) : average === "median" ? medianOf(values) : weights ? weightedMeanOf(values, weights) : null;
  if (value === null) return null;
  const n = values.filter((v) => v !== null).length;
  return { value, label: `${AVERAGE_WORD[average]} of the ${n} ${noun} shown` };
}

// The line look's Trend line: the members' own toggle ("member"), always, or never.
export function fitOn(trendLine: LineLook["trendLine"], memberToggle: boolean): boolean {
  return trendLine === "member" ? memberToggle : trendLine === true;
}
