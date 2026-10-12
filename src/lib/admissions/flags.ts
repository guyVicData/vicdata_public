// VicData 0.7 admissions (A4): the flags. Pure. Every flag is a catalogue rule (R-ADM-FLAG-*)
// with a real-data test, returns the figures behind it for the hover, and never fires on one
// small cohort. Changes are TWO-YEAR % changes (the latest census or results year against two
// years before), against the national thresholds for the phase (top or bottom fifth, Guy 7 Oct).
// The rule constants below are the only knobs, in one place.
import type { Threshold } from "./thresholds";

export const FLAG_RULES = {
  // losing pupils: a fall in each of the last three year-on-year moves
  losingYears: 3,
  // a feeder's drop is a red flag when it is a fall, worse than the area's by this many points
  feederMarginPts: 5,
  // a feeder is "rising or stable" (focus) when its change is at least this (in %)
  feederStablePct: -2,
  // strengths: top / bottom third of the rivals with that area
  strengthShare: 1 / 3,
  // a new sixth form: no pupils at 16 until two years ago, at least the minimum cohort now
} as const;

export type FlagId =
  | "results_rising_fast" | "gaining_pupils" | "losing_pupils_3y" | "entry_year_shrinking" | "new_sixth_form" | "shape_changed"
  | "strength" | "strength_growing" | "weakness" | "weakness_widening"
  | "feeder_red" | "feeder_focus";

export type Flag = { id: FlagId; label: string; figures: Record<string, number | string | null> };

export const pctChange = (from: number | null | undefined, to: number | null | undefined): number | null =>
  from === null || from === undefined || to === null || to === undefined || from === 0 ? null : ((to - from) / from) * 100;

export const pointsChange = (from: number | null | undefined, to: number | null | undefined): number | null =>
  from === null || from === undefined || to === null || to === undefined ? null : to - from;

/** Results rising fast: the headline's two-year change (in points) in the national top fifth. */
export function resultsRisingFast(headline: { from: number | null; to: number | null; fromYear: number; toYear: number }, t: Threshold | null, cohort: number | null): Flag | null {
  const c = pointsChange(headline.from, headline.to);
  if (!t || c === null || cohort === null || cohort < t.minCohort || c < t.high) return null;
  return { id: "results_rising_fast", label: "Results rising fast", figures: { from: headline.from, to: headline.to, fromYear: headline.fromYear, toYear: headline.toYear, changePoints: c, threshold: t.high, cohort } };
}

/** Gaining pupils: the roll's two-year change in the national top fifth. */
export function gainingPupils(roll: { from: number | null; to: number | null; fromYear: number; toYear: number }, t: Threshold | null): Flag | null {
  const c = pctChange(roll.from, roll.to);
  if (!t || c === null || (roll.to ?? 0) < t.minCohort || c < t.high) return null;
  return { id: "gaining_pupils", label: "Gaining pupils", figures: { from: roll.from, to: roll.to, fromYear: roll.fromYear, toYear: roll.toYear, changePct: c, threshold: t.high } };
}

/** Losing pupils three years running: the roll fell in each of the last three moves. */
export function losingPupils(rolls: { year: number; roll: number | null }[], minCohort: number): Flag | null {
  const r = rolls.filter((x) => x.roll !== null).sort((a, b) => a.year - b.year).slice(-(FLAG_RULES.losingYears + 1));
  if (r.length < FLAG_RULES.losingYears + 1 || r[0].roll! < minCohort) return null;
  for (let i = 1; i < r.length; i++) if (r[i].year !== r[i - 1].year + 1 || r[i].roll! >= r[i - 1].roll!) return null;
  return { id: "losing_pupils_3y", label: "Losing pupils three years running", figures: Object.fromEntries(r.map((x) => [`roll${x.year}`, x.roll])) };
}

/** The entry year shrinking (Year 7 at 11+): its two-year change in the national bottom fifth. */
export function entryYearShrinking(entry: { from: number | null; to: number | null; fromYear: number; toYear: number; age: number }, t: Threshold | null): Flag | null {
  const c = pctChange(entry.from, entry.to);
  if (!t || c === null || (entry.from ?? 0) < t.minCohort || c > t.low) return null;
  const label = entry.age === 11 ? "Year 7 shrinking" : entry.age === 4 ? "Reception shrinking" : entry.age === 16 ? "Year 12 shrinking" : `Age-${entry.age} entry shrinking`;
  return { id: "entry_year_shrinking", label, figures: { from: entry.from, to: entry.to, fromYear: entry.fromYear, toYear: entry.toYear, changePct: c, threshold: t.low } };
}

/** A new sixth form: no pupils at 16 in any year up to two years ago; at least the minimum now. */
export function newSixthForm(at16: { year: number; count: number | null }[], latest: number, minCohort: number): Flag | null {
  const now = at16.find((x) => x.year === latest)?.count ?? null;
  const before = at16.filter((x) => x.year <= latest - 2);
  if (now === null || now < minCohort || before.length === 0 || before.some((x) => (x.count ?? 0) > 0)) return null;
  return { id: "new_sixth_form", label: "New sixth form", figures: { pupilsAt16: now, year: latest, firstYearWith: Math.min(...at16.filter((x) => (x.count ?? 0) > 0).map((x) => x.year)) } };
}

/** Shape changed, and lasting: the same shape in the last two years, different from three years
 * before (the shared classifier's labels; described, never ranked). */
export function shapeChanged(shapes: { year: number; shape: string | null }[], latest: number): Flag | null {
  const at = (y: number) => shapes.find((s) => s.year === y)?.shape ?? null;
  const [now, prev, before] = [at(latest), at(latest - 1), at(latest - 3)];
  if (!now || !prev || !before || now !== prev || now === before) return null;
  return { id: "shape_changed", label: "Shape changed", figures: { from: before, fromYear: latest - 3, to: now, since: latest - 1 } };
}

/** Strengths and weaknesses in one subject area, against the rivals that have it. */
/** myTwoYearChange is in points, as the subject-area thresholds are. */
export function strengthFlags(area: { mine: number; rivals: number[]; rank: number; gapNow: number; gapBase: number | null; myTwoYearChange: number | null }, t: Threshold | null): Flag[] {
  const n = area.rivals.length + 1;
  const third = Math.max(1, Math.floor(n * FLAG_RULES.strengthShare));
  const figures = { mine: area.mine, rivalsAverage: area.rivals.reduce((a, b) => a + b, 0) / area.rivals.length, rank: area.rank, of: n, gap: area.gapNow, gapSince2223: area.gapBase === null ? null : area.gapNow - area.gapBase, myTwoYearChange: area.myTwoYearChange, thresholdHigh: t?.high ?? null, thresholdLow: t?.low ?? null };
  const out: Flag[] = [];
  if (area.rivals.length < 2) return out;
  if (area.gapNow > 0 && area.rank <= third) {
    out.push({ id: "strength", label: "Strength", figures });
    if (t && area.gapBase !== null && area.gapNow > area.gapBase && area.myTwoYearChange !== null && area.myTwoYearChange >= t.high) out.push({ id: "strength_growing", label: "Strength growing", figures });
  }
  if (area.gapNow < 0 && area.rank > n - third) {
    out.push({ id: "weakness", label: "Weakness", figures });
    if (t && area.gapBase !== null && area.gapNow < area.gapBase && area.myTwoYearChange !== null && area.myTwoYearChange <= t.low) out.push({ id: "weakness_widening", label: "Weakness widening", figures });
  }
  return out;
}

/** A feeder's numbers against the area's (the whole feeder set): a drop bigger than the area's is
 * a red flag; rising or stable numbers mark a school to focus on. */
export function feederFlag(feeder: { from: number | null; to: number | null }, area: { from: number; to: number }, minCohort: number): Flag | null {
  const mine = pctChange(feeder.from, feeder.to);
  const theirs = pctChange(area.from, area.to);
  if (mine === null || theirs === null || (feeder.from ?? 0) < minCohort) return null;
  const figures = { from: feeder.from, to: feeder.to, changePct: mine, areaChangePct: theirs };
  if (mine < 0 && mine < theirs - FLAG_RULES.feederMarginPts) return { id: "feeder_red", label: "Falling faster than the area", figures };
  if (mine >= FLAG_RULES.feederStablePct) return { id: "feeder_focus", label: mine > -FLAG_RULES.feederStablePct ? "Rising" : "Stable", figures };
  return null;
}
