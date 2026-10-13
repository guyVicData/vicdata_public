// Notes a view carries after its source (the caveat line in the panel's "i", printed as text
// in fullscreen and in "Print this graph"), and the one trend rule they explain. One place for
// the wording and the base year, so either can be edited without touching a component.
//
// R-TREND-FROM-2223 (0.6.2 S4b, Guy's decision of 6 Oct 2026; it replaces S4's
// R-2122-GRADING-NOTE): 2021/22 (summer 2022, Ofqual's transition year) stays on a grade or
// points trend's graphs and tables, but every trend statement is measured from 2022/23 --
// direction words, "change since", change tables, ranked change lists, change maps, fitted
// lines, slopes, captions and summaries. A view whose drawn years include 2021/22 carries the
// note saying so. Never on a latest-year view, on Candidates (entries) or at KS2 (its tests
// aren't graded by Ofqual's GCSE / A-level transition).
import type { ViewSpec } from "./viewspec";
import { CENSUS_FIRST_PERIOD, GRADING_2122_PERIOD, periodLabel, TREND_BASE_PERIOD } from "./years";

// The wording. Edit here; every view reads it.
export const TREND_BASE_NOTE =
  `Trends are measured from ${periodLabel(TREND_BASE_PERIOD)}. ${periodLabel(GRADING_2122_PERIOD)} is still shown, but its grades were awarded more generously (Ofqual's transition year after the pandemic), so measuring from it would make most schools look as if results had fallen.`;

// 2021/22 (the summer-2022 results) and the year every trend statement is measured from,
// 2022/23 (the summer-2023 results): both set in years.ts, with the app's other fixed years.
export { GRADING_2122_PERIOD, TREND_BASE_PERIOD };

// The measures a view's figure can be on (teacher-view-panels' MeasureId): grades and points
// follow the rule, entries ("Candidates") don't.
const GRADED = new Set(["points", "threshold", "bands", "counts"]);

// Whether a view's figure is a grade or points one -- the panel's measure, at its phase.
export function trendBaseApplies(measureId: string, phase: string | null | undefined): boolean {
  return GRADED.has(measureId) && phase !== "ks2";
}

// The year statements on this measure are measured from, or null (entries, KS2: from the
// first year, as before).
export function trendBaseFor(measureId: string, phase: string | null | undefined): number | null {
  return trendBaseApplies(measureId, phase) ? TREND_BASE_PERIOD : null;
}

// The note for a view over `years` (the periods it draws, after any "From" trim), or null.
// A trend: two or more years, one of them 2021/22. `years` null = not a grade or points
// view, or a latest-year one.
export function trendNoteFor(years: readonly number[] | null | undefined): string | null {
  if (!years || years.length < 2) return null;
  return years.includes(GRADING_2122_PERIOD) ? TREND_BASE_NOTE : null;
}

// Under views=v2, the years the panel's showing view draws: its host's (the Trends "From"
// year, Grade counts' compare year), except a latest-year spec (none; one the member moves
// with a year menu -- Grade counts' Spread by year, latest against a picked year -- keeps
// the host's) and a slope with a fixed first year (that year and the latest; slope.ts is
// the one builder that reads a numeric `from`).
export function specYears(spec: ViewSpec | null | undefined, hostYears: readonly number[] | null | undefined): readonly number[] | null {
  if (!hostYears) return null;
  if (!spec) return hostYears;
  const years = spec.data.years;
  if ("latest" in years) return years.memberPick ? hostYears : null;
  // R-TREND-FROM-2223: a change map colours each school by its change from 2022/23 at the
  // earliest, so it draws no 2021/22 figure.
  if (spec.view.kind === "map") return hostYears.filter((p) => p >= TREND_BASE_PERIOD);
  if (spec.view.kind === "slope") {
    const last = hostYears[hostYears.length - 1];
    if (last === undefined) return null;
    // R-TREND-FROM-2223: a slope from the span's first year starts at 2022/23 at the
    // earliest (slope.ts), so it draws 2021/22 only when its first year is fixed there.
    const from = typeof years.from === "number" ? years.from : hostYears.find((p) => p >= TREND_BASE_PERIOD);
    return from === undefined || last < from ? null : [from, last];
  }
  return hostYears;
}

// ------------------------------------------------------------------ admissions (0.7 r1)
// The honesty wording for the Admissions dashboards (src/lib/admissions/), in one place like the
// trend notes above, so a view never words a pool, a share or an estimate on its own.
export const ADMISSIONS_NOTES = {
  // R-ADM-POOL-NOT-INTAKE
  pool: "This is the pool, not an intake: the children in these schools, or born in these areas, who will reach this entry point. It does not say how many will come.",
  // R-ADM-LADDER: the certainty of each year, by its source
  counted: "Counted: children in these schools now (the January census), followed forward.",
  births: "From births: the area's calendar-year births, scaled to these schools by how many of them have reached Reception in past years. A range, not a count.",
  projection: "From ONS projections (age 10, by local authority): a wider band, shown only on request.",
  // R-ADM-BIRTH-SPLIT
  birthSplit: "Births are counted by calendar year; a school year runs September to August, so each year's pool is 8/12 of one year's births plus 4/12 of the year before.",
  birthSex: "Births have no boy/girl split: a girls' or boys' pool from births is an estimate (49% / 51%).",
  // R-ADM-DRIFT-RANGE
  drift: `The range is how much these schools' year groups have actually grown or shrunk from one year to the next since ${periodLabel(CENSUS_FIRST_PERIOD)} (the middle 80% of those changes), applied for each year still to go -- so it widens the further ahead it looks.`,
  // R-ADM-HOLD-SHARE
  holdShare: "The share needed to hold numbers steady: this year's intake as a share of each future pool. A requirement, not a forecast.",
  // R-ADM-GROUP-SHARE
  groupShare: "A share of this group: your pupils at this age as a share of the same age across these schools. Not a share of the local market.",
  // R-ADM-JOINERS-ESTIMATE
  joiners: "An estimate: the growth in a year group from one January to the next. It counts net arrivals, not every pupil who joined.",
  leaving16: "Leaving at 16: the fall from Year 11 to Year 12 at the same school, a year apart. An estimate of net leavers.",
  // R-ADM-SHAPE-NOT-RANKED
  shape: "Shapes describe a school's year groups; they are not better or worse, so they are never ranked.",
  // 0.7 r2: the short forms the panels' bottom rows and keys carry (the same rules, fewer words).
  poolShort: "A pipeline shows the pool of children, not who will join. Ranges widen with distance.",
  requirement: "A requirement, not a forecast",
  groupShort: "Share of this group only",
  cohortShort: "Cohort size, not new joiners",
  estimate: "An estimate",
  shapesShort: "Described, not ranked",
  localShape: "A narrowing base means smaller year groups are on the way.",
  flagsRule: "Flags appear only when a change is large and lasting (fixed national thresholds, over two or more years), never from one small cohort. Hover a flag for the figures behind it.",
  flagsMissing: "Flags not available yet: the national thresholds aren't loaded, and no flag is ever guessed.",
  feederFlags: "Flags compare each school's trend with the area's (the whole set's).",
  boardingCensus: "International boarders aren't in the school census. Your pipeline shows national new joiners to ISC schools by country as context.",
  // 0.7 r2b (E3): the LA and England pool-trend lines for past years (age_profile_aggregates,
  // backfilled from today's schools table). Shown only when a past year is drawn.
  areaUndercount: "Earlier years count only schools still open, so they slightly undercount.",
  // 0.7 r3 (F7): the funnel's note (behind the panel's caption button, F1), and each bar's label
  // after its bold lead word ({area}: "Worcestershire", or "Worcestershire 70% · Herefordshire 30%").
  funnelNote: "Each bar is its own count from its own source, for the same area: not a flow of the same children.",
  funnelBirths: "in {area} · born Sept {from} – Aug {to} · worked out from calendar-year births",
  funnelPoolOne: "in all {area} schools, state and independent · {year}",
  funnelPoolBlend: "in all schools in {area}, state and independent · {year}",
  funnelEntry: "entry cohort · {year}",
  funnelPoolMethod: "January census: every pupil aged {age} at 31 August in every mainstream school in the area -- academies, LA-maintained, free and independent -- weighted as the births are.",
  funnelPoolBySex: "Not held by girls or boys: the area's counts have no split.",
} as const;

// ------------------------------------------------------------------------- SMT (0.8 round 1)
// The honesty wording for the SMT dashboards (src/lib/smt/, src/components/smt/), in one place like
// the notes above: every SMT view takes its caveats from here (R-SMT-NOTES), never its own words.
// {placeholders} are filled by smtNote().
export const SMT_NOTES = {
  // Ranks (R-SMT-SET-RANKS): who is counted.
  ranks: "Ranks are among the schools with that result: highest first, ties share a place. The count says how many were ranked.",
  setRank: "{rank} of {of} {setLabel} with {stage} results",
  // R-IGCSE-EXCL, said for SMT.
  igcseChip: "No published GCSE results: this school sits IGCSEs, which DfE's tables don't count, so its GCSE figures aren't comparable.",
  igcseView: "{school} sits IGCSEs, which DfE's GCSE tables don't count. Its GCSE figures would read near zero, so it isn't compared or ranked at GCSE. Post-16 results are compared as usual.",
  igcseRow: "not ranked: IGCSE",
  // Progress 8 (R-SMT-P8-REASON): which reason applies, never a blank.
  p8Independent: "Progress 8 is not published for independent schools.",
  p8NoBaseline: "Progress 8 is not published for {years}: those pupils sat no KS2 tests (2020 and 2021), so there is no baseline.",
  p8Published: "Progress 8, {year}: the latest DfE published. None for {years} (no KS2 baseline).",
  p8NoGcse: "No GCSE results, so no Progress 8.",
  // A-level value added (R-SMT-VA-HONEST).
  alevelVa: "A-level value added compares each student's results with others nationally who started from similar GCSEs. 0 is the national average; the range is DfE's 95% confidence interval -- a figure whose range crosses 0 isn't clearly different from average.",
  vaNotKs2: "Value added isn't published for KS2.",
  vaNoGcseSubjects: "DfE has never published GCSE value added by subject. When Progress 8 returns, the whole-school figure shows here, never a subject one.",
  vaNotPublished: "No value added is published for this school at Post-16.",
  // Trends (R-TREND-FROM-2223 is the shared note; these are SMT's own lines).
  sinceBase: "Change is measured from {base}, the first year graded on the normal scale.",
  middleHalf: "The band is the middle half of {setLabel} with results that year (the 25th to the 75th percentile). Schools without results are left out.",
  rollIndexed: "Each line is indexed to 100 in {base}. {la} and England count pupils aged 5 to 15 in every mainstream school (age_profile_aggregates), so they are a like-for-like trend for the area, not a total roll.",
  rollAreaUndercount: "Earlier area years count only schools still open, so they slightly undercount.",
  // Entries (the year rules: change in entries counts from the first year).
  entriesMix: "Each subject's share of the entries, year by year. Entries change counts from the first year shown (entries aren't graded, so the 2021/22 note doesn't apply).",
  // Market share from Admissions, read-only.
  marketNoLists: "The Admissions lead hasn't chosen rivals at 11+ yet, so there is no market share to show. Admissions sets them.",
  marketNoEntry: "This school has no 11+ entry, so it has no market share at 11+.",
  marketShort: "A share of the rivals Admissions chose: not a share of the local market.",
  // Flags (R-SMT-FLAGS).
  flagsRule: "Flags appear only when a change is large and lasting: three years of falling roll, results moving at least {gap} faster than the set's middle over two years, or an entry year shrinking past the national threshold. Hover a flag for the figures.",
  flagsNone: "No flags: nothing has moved far enough, for long enough.",
  // The size badges, as the school page says them.
  size: "XS to XL: this school's pupils in each phase against every school with that phase in England (fifths). The school page's Roll by phase.",
  // Results by band (reserved).
  bandReserved: "Arrives with the results-by-band round: the top 25%, middle 50% and bottom 25% of pupils, once the data is built.",
  // Small numbers.
  smallEntries: "Subjects with fewer than {min} entries aren't ranked: one or two pupils would decide the rank.",
} as const;

/** An SMT note with its {placeholders} filled. */
export function smtNote(key: keyof typeof SMT_NOTES, vars: Record<string, string | number> = {}): string {
  return SMT_NOTES[key].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
