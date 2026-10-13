// VicData 0.8 SMT round 1: flags on the school itself (spec §2.3, Overview's Flags view), in the
// Admissions style -- large and lasting changes only, each with the figures behind it. Pure.
//
// The thresholds live here and nowhere else (R-SMT-FLAGS). Two of the three flags are Admissions'
// own functions with Admissions' own national thresholds (src/lib/admissions/flags.ts): a roll
// falling three years running (losingPupils) and an entry year shrinking (entryYearShrinking).
// The third is SMT's: results moving faster than the comparison set's middle.
import { losingPupils, entryYearShrinking, type Flag } from "../admissions/flags";
import type { Threshold } from "../admissions/thresholds";
import { percentile } from "../admissions/stats";

import { SMT_FLAG_RULES } from "./flags-rules";
export { SMT_FLAG_RULES };

export type SmtFlag = Omit<Flag, "id"> & { id: string; tone: "up" | "down" };

export function rollFalling(rolls: { year: number; roll: number | null }[]): SmtFlag | null {
  const f = losingPupils(rolls, SMT_FLAG_RULES.rollMinPupils);
  return f ? { ...f, label: "Roll falling three years running", tone: "down" } : null;
}

export function entryShrinking(entry: { from: number | null; to: number | null; fromYear: number; toYear: number; age: number }, t: Threshold | null, word: string): SmtFlag | null {
  const f = entryYearShrinking(entry, t);
  return f ? { ...f, label: `${word} entry cohort shrinking`, tone: "down" } : null;
}

/** Results moving faster than the set: `mine` the school's change, `set` each set school's change
 * over the same two years (schools without both left out). */
export function resultsAgainstSet(stage: "ks2" | "ks4" | "ks5", what: string, mine: { from: number | null; to: number | null; fromYear: number; toYear: number }, set: number[]): SmtFlag | null {
  if (mine.from === null || mine.to === null || set.length < SMT_FLAG_RULES.resultsMinSchools) return null;
  const change = mine.to - mine.from;
  const middle = percentile(set, 50);
  if (middle === null) return null;
  const gap = change - middle;
  const limit = SMT_FLAG_RULES.resultsGap[stage];
  if (Math.abs(gap) < limit) return null;
  const up = gap > 0;
  return {
    id: up ? "results_rising" : "results_falling",
    label: `${what} ${up ? "rising" : "falling"} faster than the set`,
    tone: up ? "up" : "down",
    figures: { from: mine.from, to: mine.to, fromYear: mine.fromYear, toYear: mine.toYear, change: Math.round(change * 100) / 100, setMiddle: Math.round(middle * 100) / 100, schools: set.length, threshold: limit },
  };
}
