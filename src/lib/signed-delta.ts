// The one signed-change formatter (0.8 IGCSE subjects, follow-up 6; moved here from
// teacher-view-panels.ts in the year rules leftovers so every view can import it on its own).
// R-NO-NEGATIVE-ZERO: a change that rounds to zero prints as zero does, never "−0".

export type SignedDeltaStyle = {
  // What a printed zero carries, as each view has always printed an exact zero: "+" (Teacher's "+0%",
  // the default), "" (the Data View's "0%") or "±" (SMT's, Admissions' and the groups' "±0.0").
  zero?: "+" | "" | "±";
  // The sign a printed positive takes: "+" (the default) or "" (a figure that prints only its minus).
  plus?: "+" | "";
  // The minus: "−" (U+2212, the default) or "-" (the Data View's charts, which have always used the
  // hyphen; a separate typographic call, left for Guy).
  minus?: "−" | "-";
};

/**
 * A change with its sign. `body` prints the unsigned magnitude from the SIGNED change, exactly as each
 * measure always rounded it (Math.abs(Math.round(d)): −6.5 stays 6); only the sign is decided here, from
 * what is printed -- a change that rounds to zero prints as zero does ("+0.0", "+0pp"), never "−0.0".
 */
export function signedDelta(d: number, body: (signed: number) => string, style: SignedDeltaStyle = {}): string {
  const printed = body(d);
  if (!/[1-9]/.test(printed)) return `${style.zero ?? "+"}${printed}`;
  return `${d < 0 ? (style.minus ?? "−") : (style.plus ?? "+")}${printed}`;
}

// The look of the figures that print toFixed's own minus (the Data View's charts and tooltips, some
// SMT, Admissions and group tooltips, the narrative): the hyphen, and an exact zero unsigned ("0%").
export const HYPHEN_SIGN: SignedDeltaStyle = { zero: "", minus: "-" };
// The same, for the figures that have always printed an exact zero with "+" ("+0% since …").
export const HYPHEN_SIGN_PLUS_ZERO: SignedDeltaStyle = { zero: "+", minus: "-" };
