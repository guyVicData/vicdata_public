// VicData 0.8 audit fixes (1, R-IGCSE-EVERYWHERE): the words for the one IGCSE rule, the same in every
// product. Pure (the client imports it; lib/igcse is the server's loader).

/** The school itself: in place of a GCSE rank, "out of" or gap. */
export const IGCSE_NOT_RANKED = "not ranked at GCSE (IGCSE)";
export const igcseTargetLine = (name: string) => `${name} is ${IGCSE_NOT_RANKED}.`;

/** The line a GCSE list carries where IGCSE schools would have shown (null when none). */
export function igcseNotRankedLine(n: number): string | null {
  return n > 0 ? `${n.toLocaleString("en-GB")} ${n === 1 ? "school" : "schools"} not ranked at GCSE (mostly IGCSE)` : null;
}
