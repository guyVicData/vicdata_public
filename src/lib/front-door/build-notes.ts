// VicData 0.8 feedback B3 (Admissions 6, Admissions 7, SMT 4; R-NO-BUILD-NOTES): no text written for the
// builders reaches the page. A teacher reads every caption, note and tooltip; rule IDs, file names, "empty
// state", "harness", "placement mismatch" or a line about the dashboard's rail mean nothing to them.
//
// Two scans, shared by the unit test and the rule runner:
//   - userTextFindings: any string the app shows (a rendered walk's words, a catalogue title or method);
//   - sourceFindings (build-notes-scan.ts, tests and the rule runner only): every string and piece of JSX
//     text in a component's source, read with the TypeScript parser, so a comment never counts and text in
//     JSX, a title="" or a string the component renders is caught where it is written.
// Pure.

/** The builders' words, each with what it is. */
export const BUILD_NOTE_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /\bR-[A-Z0-9]{2,}(?:-[A-Z0-9]+)+\b/, what: "a rule ID" },
  { re: /\bDV-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/, what: "a view ID" },
  { re: /\b[A-Za-z][\w-]*\.(?:tsx|ts|mjs|py|sql)\b/, what: "a file name" },
  { re: /\bempty state\b/i, what: "\"empty state\"" },
  { re: /\bharness\b/i, what: "\"harness\"" },
  { re: /\bplacement mismatch\b/i, what: "\"placement mismatch\"" },
  { re: /dashboard[’']s rail|rail on the dashboard|panel[’']s rail on the dashboard/i, what: "the dashboard's rail" },
  { re: /same views, in the same order/i, what: "the rail's build note" },
  { re: /\bsame method, earlier censuses\b/i, what: "\"same method, earlier censuses\"" },
  { re: /\bno base map in the walk\b/i, what: "\"no base map in the walk\"" },
  { re: /\bdocs\/[\w./-]+/, what: "a document path" },
  { re: /\b0\.\d+(?:\.\d+)?\s*(?:r\d|s\d|round|SMT|feedback|front door|review|audit|snag|admissions editor)\b/i, what: "a build round" },
];

export type Finding = { where: string; what: string; text: string };

/** Builders' words in one piece of text the app shows. */
export function userTextFindings(where: string, text: string | null | undefined): Finding[] {
  if (!text) return [];
  return BUILD_NOTE_PATTERNS.filter((p) => p.re.test(text)).map((p) => ({ where, what: p.what, text: text.length > 140 ? `${text.slice(0, 140)}…` : text }));
}
