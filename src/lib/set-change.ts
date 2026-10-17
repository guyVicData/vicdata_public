// R-SET-CHANGE-AVERAGE (Guy, 17 Oct 2026: consistency): a comparison set's % change is the change in
// the set's yearly average -- each year, the average over the schools with a figure that year -- from
// its start year to its latest. Entries start at the first year with entries (changeStartFor, R-ENTRIES-
// FIRST-YEAR); a measure with no fixed start at the set's own first year; points at the given year.
import { changeStartFor } from "@/catalogue/years";

export type YearValue = { period: number; value: number };

export function setAverageChange(series: readonly (readonly YearValue[])[], from: "entries" | "first" | number): number | null {
  const byPeriod = new Map<number, number[]>();
  for (const s of series) for (const { period, value } of s) byPeriod.set(period, [...(byPeriod.get(period) ?? []), value]);
  const periods = Array.from(byPeriod.keys()).sort((a, b) => a - b);
  if (periods.length === 0) return null;
  const mean = (p: number) => {
    const v = byPeriod.get(p)!;
    return v.reduce((a, x) => a + x, 0) / v.length;
  };
  const last = periods[periods.length - 1];
  const start = from === "entries" ? changeStartFor("entries", periods) : from === "first" ? periods[0] : from;
  if (!byPeriod.has(start) || last <= start) return null; // one year is not a change
  const a = mean(start);
  return a === 0 ? null : ((mean(last) - a) / Math.abs(a)) * 100;
}
