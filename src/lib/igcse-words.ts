// VicData 0.8 audit fixes (1, R-IGCSE-EVERYWHERE): the words for the one IGCSE rule, the same in every
// product. Pure (the client imports it; lib/igcse is the server's loader).

/** The school itself: in place of a GCSE rank, "out of" or gap. */
export const IGCSE_NOT_RANKED = "not ranked at GCSE (IGCSE)";
export const igcseTargetLine = (name: string) => `${name} is ${IGCSE_NOT_RANKED}.`;

/** The line a GCSE list carries where IGCSE schools would have shown (null when none). */
export function igcseNotRankedLine(n: number): string | null {
  return n > 0 ? `${n.toLocaleString("en-GB")} ${n === 1 ? "school" : "schools"} not ranked at GCSE (mostly IGCSE)` : null;
}

/**
 * Teacher Column 1 (0.8 audit fixes, R-IGCSE-GROUP-LABEL): an IGCSE school keeps its own GCSE subject
 * figures, but a subject group that is missing the subjects it takes as IGCSE says so. Only English and
 * maths: the IGCSE rule rests on them (0% English and maths grade 4+), so they are the subjects we know
 * are taken as IGCSE. Judged on the school's subjects with entries in its latest GCSE year. The label
 * unchanged when nothing is missing, or for a school the rule doesn't take out.
 */
export function igcseGroupLabel(familyId: string, label: string, subjects: Iterable<string>, igcse: boolean): string {
  if (!igcse) return label;
  const has = new Set(subjects);
  if (familyId === "sciences_maths" && !has.has("Mathematics")) {
    const otherMaths = has.has("Statistics") || has.has("Mathematics (Additional)");
    return `${label} (${otherMaths ? "no Mathematics: taken as IGCSE" : "sciences only: maths taken as IGCSE"})`;
  }
  if (familyId === "languages_literature") {
    const lang = has.has("English Language"), lit = has.has("English Literature");
    if (!lang && !lit) return `${label} (no English: taken as IGCSE)`;
    if (!lang) return `${label} (no English Language: taken as IGCSE)`;
  }
  return label;
}

/** The same, read from the school's headline rows for the focused subject's group (its latest year). */
export function igcseGroupLabelFor(headline: { subject: string; familyId: string; familyLabel: string; period: number; entriesTotal: number }[], subject: string, igcse: boolean): string | null {
  const own = headline.find((r) => r.subject === subject);
  if (!own) return null;
  const latest = Math.max(...headline.map((r) => r.period));
  const subjects = headline.filter((r) => r.period === latest && r.familyId === own.familyId && r.entriesTotal > 0).map((r) => r.subject);
  return igcseGroupLabel(own.familyId, own.familyLabel, subjects, igcse);
}
