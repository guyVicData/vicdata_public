// VicData 0.8 Sets round 1 (F25, Guy 7 Nov, F-40 / F-41): which results a set of schools is compared
// on, GCSE or post-16 -- the one rule, shared by Admissions' Rivals' momentum at 11+ (rivalsView's
// `momentum`) and the set editor's "How close" results switch (C16), so the two always agree.
//
//   - At 11+, count the set's schools with no GCSE (KS4) results in the latest year (for independents
//     mostly IGCSE entry: a school the IGCSE rule lists but never ranks counts as having none).
//   - Over IGCSE_SWITCH_SHARE (40%) of them, and post-16 results cover more of the set than GCSE does
//     (the editor's switch starts on the measure with more coverage): compare on post-16 results
//     instead, and say so.
//   - At or below it: stay on GCSE and name the schools left out (`leftOut`).
//   - At 16+: post-16, as before (nothing changes). Below 11: KS2, as before.
//
// Pure and dependency-free (server, client and the rule tests import it). The caller decides who is in
// the set (Admissions passes the rivals, the school itself not counted) and what "has results" means
// for its data; this module only applies the threshold.

/** Over this share of a set's schools without GCSE results, an 11+ comparison uses post-16 results. */
export const IGCSE_SWITCH_SHARE = 0.4;

export type ResultsCoverageSchool = {
  urn: string;
  /** A usable GCSE (KS4) headline in the latest results year (not an IGCSE-excluded school's). */
  hasGcse: boolean;
  /** A post-16 (KS5) headline in the latest results year. */
  hasPost16: boolean;
  /** Optional: the school has no GCSE figure because of IGCSE entry (for the "(mostly IGCSE)" words). */
  igcse?: boolean;
};

export type ResultsMeasure = {
  /** The results the comparison uses. */
  measure: "gcse" | "post16" | "ks2";
  /** True only at 11+ when the share without GCSE is over IGCSE_SWITCH_SHARE and post-16 covers more. */
  switched: boolean;
  /** The set's schools without GCSE results, of `of`. */
  noGcse: number;
  /** ...of which IGCSE (where the caller says). */
  noGcseIgcse: number;
  /** The set's schools without post-16 results, of `of`. */
  noPost16: number;
  of: number;
  /** The schools the chosen measure leaves out (no figure on it), in the order given. */
  leftOut: string[];
};

/** The results measure for a set at an entry age (4, 11, 16...), by the share without GCSE. */
export function resultsMeasureFor(entryAge: number, schools: ResultsCoverageSchool[]): ResultsMeasure {
  const noGcse = schools.filter((s) => !s.hasGcse);
  const noPost16 = schools.filter((s) => !s.hasPost16);
  const base = { noGcse: noGcse.length, noGcseIgcse: noGcse.filter((s) => s.igcse).length, noPost16: noPost16.length, of: schools.length };
  if (entryAge <= 10) return { measure: "ks2", switched: false, ...base, leftOut: [] };
  if (entryAge >= 16) return { measure: "post16", switched: false, ...base, leftOut: noPost16.map((s) => s.urn) };
  // Over the share, and post-16 covers more of the set than GCSE does (C16: the measure with more
  // coverage): a set whose GCSE gaps are preps or schools without a sixth form stays on GCSE.
  const switched = schools.length > 0 && noGcse.length / schools.length > IGCSE_SWITCH_SHARE && noPost16.length < noGcse.length;
  return switched
    ? { measure: "post16", switched, ...base, leftOut: noPost16.map((s) => s.urn) }
    : { measure: "gcse", switched, ...base, leftOut: noGcse.map((s) => s.urn) };
}

/** The line under the title when an 11+ comparison switched: "Post-16 results: 6 of 10 rivals have no
 * GCSE results (mostly IGCSE)". `noun` names the set's schools ("rivals", "schools"). */
export function switchedLine(r: Pick<ResultsMeasure, "switched" | "noGcse" | "noGcseIgcse" | "of">, noun = "rivals"): string | null {
  if (!r.switched) return null;
  const why = r.noGcseIgcse * 2 > r.noGcse ? " (mostly IGCSE)" : r.noGcseIgcse > 0 ? ` (${r.noGcseIgcse} IGCSE)` : "";
  return `Post-16 results: ${r.noGcse} of ${r.of} ${noun} ${r.noGcse === 1 ? "has" : "have"} no GCSE results${why}`;
}
