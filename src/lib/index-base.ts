// VicData 0.8 audit fixes (4): every indexed chart's lines and the words for their base, from one
// place. The base is the first year every line has a figure (an index needs the same base on every
// line), so a label names that year -- never a fixed 2019/20 or 2012. With no shared year each line
// is indexed to its own first year, and the label says so. Pure (server and client).
import { periodLabel } from "@/catalogue/years";

type Pt = { year: number; value: number | null };

/** Series indexed to 100 at their first COMMON year; with no common year each line is indexed to
 * its own first year (base null). */
export function indexTo(series: Pt[][]): { base: number | null; out: Pt[][] } {
  const has = (s: Pt[]) => new Set(s.filter((p) => p.value !== null).map((p) => p.year));
  const sets = series.filter((s) => s.length).map(has);
  const common = sets.length ? [...sets[0]].filter((y) => sets.every((st) => st.has(y))).sort((a, b) => a - b)[0] ?? null : null;
  return {
    base: common,
    out: series.map((s) => {
      const b = (common !== null ? s.find((p) => p.year === common) : s.find((p) => p.value !== null))?.value ?? null;
      return s.map((p) => ({ year: p.year, value: p.value === null || !b ? null : (p.value / b) * 100 }));
    }),
  };
}

/** The base year in words: "2021/22" (census and results years), "2014" (births and ONS mid-year),
 * or "each line's first year" when the lines share none. */
export function indexBaseWords(base: number | null, years: "academic" | "calendar" = "academic"): string {
  if (base === null) return "each line's first year";
  return years === "calendar" ? String(base) : periodLabel(base);
}

/** "2021/22 = 100" */
export const indexedLabel = (base: number | null, years: "academic" | "calendar" = "academic") => `${indexBaseWords(base, years)} = 100`;
