// 0.8 SMT feedback round 1 (F-3): every comparison set's short name, for wherever a header is tight
// (the Scorecard's set column). The full name stays in the pill and the (i). Client-safe, no imports.
//
//   "10 nearest with a sixth form or 16+ provision"  -> "10 nearest"
//   "10 nearest schools"                             -> "10 nearest"
//   "Schools in Reading"                             -> "Reading"
//   anything else (a saved set's or a ranking's own name): as it is when short, else its first
//   words to SET_SHORT_MAX characters, with an ellipsis.
export const SET_SHORT_MAX = 16;

export function setShortName(label: string): string {
  const t = label.trim().replace(/\s+/g, " ");
  const near = /^(\d+) nearest\b/i.exec(t);
  if (near) return `${near[1]} nearest`;
  const inLa = /^Schools in (.+)$/i.exec(t);
  if (inLa && inLa[1].length <= SET_SHORT_MAX) return inLa[1];
  if (t.length <= SET_SHORT_MAX) return t;
  const words = t.split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > SET_SHORT_MAX - 1) break;
    out = next;
  }
  return `${out || t.slice(0, SET_SHORT_MAX - 1)}…`;
}
