// VicData 0.8 sets round 1 (C16, R-SET-HOW-CLOSE): "How close is this set to [school]?", from real
// figures only. Pure: the editor recomputes it as schools are ticked and unticked.
//   Distance     the range and the median of the ticked schools' distances
//   Results      how many have GCSE and how many have Post-16 results; the switch starts on the
//                measure the dashboard uses (results-coverage.ts: the one rule, F25), so the editor and
//                Market share agree
//   Population   how many board (and whether the school does), their pupils at the age against the
//                school's, and how many share its gender
// No closeness score is given: the data has no agreed scale for one. Counts are shown, and say so.
import { resultsMeasureFor, type ResultsMeasure } from "./results-coverage";

export type ClosenessSchool = { urn: string; km: number | null; boarding: boolean; gender: "mixed" | "girls" | "boys"; pupils: number | null; hasGcse: boolean; hasPost16: boolean; igcse: boolean };

export type Closeness = {
  n: number;
  distance: { min: number; max: number; median: number; withDistance: number } | null;
  results: { gcse: number; post16: number; startsOn: ResultsMeasure["measure"]; rule: ResultsMeasure };
  population: {
    boards: number;
    focusBoards: boolean;
    sameGender: number;
    focusGender: ClosenessSchool["gender"];
    medianPupils: number | null;
    focusPupils: number | null;
    withPupils: number;
  };
};

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function closeness(focus: Pick<ClosenessSchool, "boarding" | "gender" | "pupils"> | null, schools: ClosenessSchool[], entryAge: number): Closeness {
  const kms = schools.map((s) => s.km).filter((k): k is number => k !== null);
  const pupils = schools.map((s) => s.pupils).filter((p): p is number => p !== null);
  const rule = resultsMeasureFor(entryAge, schools.map((s) => ({ urn: s.urn, hasGcse: s.hasGcse, hasPost16: s.hasPost16, igcse: s.igcse })));
  return {
    n: schools.length,
    distance: kms.length ? { min: Math.min(...kms), max: Math.max(...kms), median: median(kms)!, withDistance: kms.length } : null,
    results: { gcse: schools.filter((s) => s.hasGcse).length, post16: schools.filter((s) => s.hasPost16).length, startsOn: rule.measure, rule },
    population: {
      boards: schools.filter((s) => s.boarding).length,
      focusBoards: !!focus?.boarding,
      sameGender: focus ? schools.filter((s) => s.gender === focus.gender).length : 0,
      focusGender: focus?.gender ?? "mixed",
      medianPupils: median(pupils),
      focusPupils: focus?.pupils ?? null,
      withPupils: pupils.length,
    },
  };
}

// To a tenth, halves up (5.95 is 6, not binary's 5.9).
const km1 = (k: number) => `${Math.round(k * 10 + 1e-9) / 10} km`;

/** The words under each heading, as the editor and the set view print them. */
export function closenessWords(c: Closeness, focusName: string): { distance: string; results: string; population: string } {
  const distance = c.distance ? `All within ${km1(c.distance.max)} · median ${km1(c.distance.median)}${c.distance.withDistance < c.n ? ` (${c.distance.withDistance} of ${c.n} located)` : ""}` : "No distances: the schools have no location.";
  const results = `${c.results.post16} of ${c.n} have Post-16 results; ${c.results.gcse} have GCSE results${c.results.rule.noGcseIgcse ? ` (${c.results.rule.noGcseIgcse} sit IGCSEs)` : ""}. Starts on ${c.results.startsOn === "post16" ? "Post-16" : c.results.startsOn === "gcse" ? "GCSE" : "KS2"}, the measure the dashboard uses.`;
  const p = c.population;
  const gender = p.focusGender === "mixed" ? `${p.sameGender} of ${c.n} mixed, as you are` : `${p.sameGender} of ${c.n} ${p.focusGender}' schools, as you are`;
  const size = p.medianPupils !== null && p.focusPupils !== null ? `median ${Math.round(p.medianPupils)} pupils at the age against your ${p.focusPupils}` : p.medianPupils !== null ? `median ${Math.round(p.medianPupils)} pupils at the age` : "no pupil counts";
  const population = `${p.boards} of ${c.n} board${p.focusBoards ? ", as you do" : ""} · ${gender} · ${size}. Counts only: there is no agreed scale for a closeness score.`;
  void focusName;
  return { distance, results, population };
}
