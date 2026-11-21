// Review pack 22 Nov, issue 2 (R-NO-TICKET-CODES): users never read the team's ticket codes or round names.
// "Admissions feedback round 1 (F-12 to F-21): the intake waterfall, ..." reads "The intake waterfall, ...".
// The codes stay where they are written (change summaries, changelog rows, the source); this is how they
// are drawn. Used by "Updated — what's changed" (UpdatedNotice) and What's new (first-visit.tsx).

const CODE = String.raw`(?:F-\d+|R-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)`;
const CODES = String.raw`${CODE}(?:\s*(?:to|–|-|,|and|&)\s*${CODE})*`;
const ROUND = String.raw`\bround\s+\d+(?:,?\s*item\s+\d+)?\b`;

/** Text as users see it: no ticket codes (F-12, R-IGCSE-GCSE-ONLY), no "… feedback round 1 (…):" lead-ins. */
export function plainWords(text: string): string {
  if (!text) return text;
  let s = text;
  // A lead-in naming a round or a ticket, up to its colon: "Admissions feedback round 1 (F-12 to F-21): ".
  s = s.replace(new RegExp(String.raw`^\s*[^:.]*?(?:${ROUND}|${CODE})[^:.]*:\s*`, "i"), "");
  // Brackets holding codes or a round: "(F-17)", "(F-12 to F-21)", "(round 2)".
  s = s.replace(new RegExp(String.raw`\s*\((?:[^()]*?(?:${CODE}|${ROUND})[^()]*?)\)`, "gi"), "");
  // Codes left in running text.
  s = s.replace(new RegExp(String.raw`\s*\b${CODES}\b`, "g"), "");
  // Tidy what was left behind.
  s = s
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=[,;:.])/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:–-]+/, "")
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
