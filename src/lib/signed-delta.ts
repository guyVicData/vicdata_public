// The one signed-change formatter (0.8 IGCSE subjects, follow-up 6; moved here from
// teacher-view-panels.ts in the year rules leftovers so every view can import it on its own).
// R-NO-NEGATIVE-ZERO: a change that rounds to zero prints as zero does, never "−0".

export type SignedDeltaStyle = {
  // What a printed zero carries, as each view has always printed an exact zero: "+" (Teacher's "+0%",
  // the default), "" (the Data View's "0%") or "±" (SMT's, Admissions' and the groups' "±0.0").
  zero?: "+" | "" | "±";
  // The sign a printed positive takes: "+" (the default) or "" (a value that prints only its minus).
  plus?: "+" | "";
};

// R-MINUS-SIGN (Guy, 17 Oct 2026: consistency): every figure's minus is "−" (U+2212), never the hyphen.
export const MINUS = "−";

/**
 * A change with its sign. `body` prints the unsigned magnitude from the SIGNED change, exactly as each
 * measure always rounded it (Math.abs(Math.round(d)): −6.5 stays 6); only the sign is decided here, from
 * what is printed -- a change that rounds to zero prints as zero does ("+0.0", "+0pp"), never "−0.0".
 */
export function signedDelta(d: number, body: (signed: number) => string, style: SignedDeltaStyle = {}): string {
  const printed = body(d);
  if (!/[1-9]/.test(printed)) return `${style.zero ?? "+"}${printed}`;
  return `${d < 0 ? MINUS : (style.plus ?? "+")}${printed}`;
}

// The figures that print an exact zero unsigned ("0%"): the Data View's, some SMT, Admissions and group
// tooltips, the narrative.
export const UNSIGNED_ZERO: SignedDeltaStyle = { zero: "" };
// A value rather than a change (a progress score, a range's ends): only a negative carries a sign.
export const VALUE_SIGN: SignedDeltaStyle = { zero: "", plus: "" };

/** A value with a true minus: −1.2, 0.4 (R-MINUS-SIGN). */
export function signedValue(v: number, dp: number): string {
  return signedDelta(v, (x) => Math.abs(x).toFixed(dp), VALUE_SIGN);
}

// ------------------------------------------------------------------------------------ R-FLAT-BAND

// R-FLAT-BAND (Guy, 17 Oct 2026: consistency): a change whose size rounds to 0 at the precision shown
// (under 0.5% for whole percents, under 0.05 for one decimal place) is steady: no ▲ or ▼, a "–", and the
// zero in that view's own style. A view may keep a wider steady band of its own (`band`), never a
// narrower one.
export type Direction = "up" | "down" | "flat";

export function roundsToZero(d: number, dp: number): boolean {
  return Math.round(Math.abs(d) * 10 ** dp) === 0;
}

export function flatBand(d: number, dp: number, band = 0): Direction {
  if (roundsToZero(d, dp) || Math.abs(d) <= band) return "flat";
  return d > 0 ? "up" : "down";
}

export const ARROW: Record<Direction, string> = { up: "▲", down: "▼", flat: "–" };

/** An arrowed change: "▲ 16%", "▼ 2.4 pts", or "– 0%" when it is steady. `body` prints the unsigned size. */
export function arrowed(d: number, body: (abs: number) => string, dp: number, band = 0): string {
  const dir = flatBand(d, dp, band);
  return `${ARROW[dir]} ${body(dir === "flat" ? 0 : Math.abs(d))}`;
}
