// VicData 0.8 audit fixes (10): the expected values of the rules that depend on the latest results
// year, one row per year. Each rule reads the latest year from src/catalogue/years.ts (filled from the
// data, academic_current_periods) and its expected value from here, so a new release adds a row here
// rather than breaking the rule. A year with no row fails as "no expected value for 2026/27", never
// with a wrong number (R-YEARS-ROLLOVER). Each value was found in production with SQL against the
// rollup tables the app reads (docs/v0.8/audit_fixes_report_v1.md, "The five rules").
// Rules that can assert a relationship instead (R-THRESHOLD-PERIODS, R-TREND-TABLE-YEARS) take no row.
import { periodLabel } from "../src/catalogue/years";

export const YEAR_FIXTURES = {
  // Acland Burghley (100053) GCSE Mathematics: years with average points, and with Grade 4+ (grade rows).
  "R-TREND-LINE-4YR": {
    2024: { pointsYears: 4, grade4Years: 4 },
    2025: { pointsYears: 5, grade4Years: 5 },
  },
  // Acland Burghley's Latin, Grade 4+ "vs last year" on the latest-year view: none in 2024/25 (no
  // 2023/24 to compare with; never reaching back to 2022/23), 81.82% against 87.50% in 2025/26.
  "R-CURRENT-GRADES-FROM-2324": {
    2024: { latinDelta: null },
    2025: { latinDelta: 81.8182 - 87.5 },
  },
  // The Chase (137625) against its 10 nearest: Attainment 8's two-year change against the set's
  // median change. 2024/25: past the 2-point gap, flagged. 2025/26: +1.0 against -0.6, a gap of 1.6,
  // not flagged.
  "R-SMT-FLAGS": {
    2024: { flagged: true },
    2025: { flagged: false, change: 1.0, setMedian: -0.6 },
  },
} as const;

type Rule = keyof typeof YEAR_FIXTURES;

/** The rule's expected value for `year`, or the one failure a missing year may give. */
export function expectedFor<R extends Rule>(rule: R, year: number | null): { ok: true; value: (typeof YEAR_FIXTURES)[R][keyof (typeof YEAR_FIXTURES)[R]] } | { ok: false; detail: string } {
  if (year === null) return { ok: false, detail: "no latest year read (academic_current_periods)" };
  const rows = YEAR_FIXTURES[rule] as Record<number, unknown>;
  if (!(year in rows)) return { ok: false, detail: missingFor(year) };
  return { ok: true, value: rows[year] as (typeof YEAR_FIXTURES)[R][keyof (typeof YEAR_FIXTURES)[R]] };
}

export const missingFor = (year: number) => `no expected value for ${periodLabel(year)}`;
