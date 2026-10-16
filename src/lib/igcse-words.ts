// VicData 0.8 audit fixes (1, R-IGCSE-EVERYWHERE): the words for the one IGCSE rule, the same in every
// product. Pure (the client imports it; lib/igcse is the server's loader).

/** The school itself: in place of a GCSE rank, "out of" or gap. */
export const IGCSE_NOT_RANKED = "not ranked at GCSE (IGCSE)";
export const igcseTargetLine = (name: string) => `${name} is ${IGCSE_NOT_RANKED}.`;

/** The line a GCSE list carries where IGCSE schools would have shown (null when none). */
export function igcseNotRankedLine(n: number): string | null {
  return n > 0 ? `${n.toLocaleString("en-GB")} ${n === 1 ? "school" : "schools"} not ranked at GCSE (mostly IGCSE)` : null;
}

// ------------------------------------------------------------------ 0.8 IGCSE subjects (Guy, 16 Oct)
//
// Which GCSE rankings an IGCSE school is in (R-IGCSE-EVERYWHERE, R-IGCSE-SUBJECT):
//   - whole-school GCSE measures (Attainment 8, English and maths, EBacc, Progress 8): never;
//   - a subject group (family) across schools: only where the school's group is complete;
//   - a single subject it entered as GCSE 9-1: like any other school.
// There is no IGCSE data, so what a school took as IGCSE is inferred, here and nowhere else:
//   - English Language and Mathematics, which every school teaches: an IGCSE-flagged school with no GCSE
//     entries in one in a year is taken to have sat it as IGCSE that year;
//   - never any other subject: a school that simply doesn't offer one hasn't "taken it as IGCSE".
// A family is incomplete where it lacks a subject taken as IGCSE, or a subject the family requires.
// No family has required subjects (subject_families: family_id, display_label, ssa_tier1_areas,
// sort_order; checked 16 Oct 2026), so today only Sciences & Maths (maths) and Languages & Literature
// (English Language) can be incomplete.

/** The family each inferable subject belongs to. */
export const IGCSE_INFERRED: Readonly<Record<string, string>> = { sciences_maths: "Mathematics", languages_literature: "English Language" };
/** Subjects a family requires (none today; see above). */
export const FAMILY_REQUIRED_SUBJECTS: Readonly<Record<string, readonly string[]>> = {};

/** The subjects an IGCSE-flagged school took as IGCSE in a year, from its GCSE subjects with entries that year. */
export function igcseTakenAsIgcse(igcse: boolean, gcseSubjects: Iterable<string>): Set<string> {
  if (!igcse) return new Set();
  const has = new Set(gcseSubjects);
  return new Set(Object.values(IGCSE_INFERRED).filter((s) => !has.has(s)));
}

/** Is the school's family incomplete at GCSE that year (left out of that family's ranking across schools)? */
export function igcseFamilyIncomplete(familyId: string, igcse: boolean, gcseSubjects: Iterable<string>): boolean {
  if (!igcse) return false;
  const has = new Set(gcseSubjects);
  const needs = [IGCSE_INFERRED[familyId], ...(FAMILY_REQUIRED_SUBJECTS[familyId] ?? [])].filter((s): s is string => !!s);
  return needs.some((s) => !has.has(s));
}

/** What the family lacks, for the label and the note (null when complete or not an IGCSE school). */
function missingOf(familyId: string, subjects: Iterable<string>, igcse: boolean): { short: string; full: string } | null {
  if (!igcse) return null;
  const has = new Set(subjects);
  if (familyId === "sciences_maths" && !has.has("Mathematics")) {
    const otherMaths = has.has("Statistics") || has.has("Mathematics (Additional)");
    return otherMaths ? { short: "no Mathematics", full: "no Mathematics: taken as IGCSE" } : { short: "no maths", full: "sciences only: maths taken as IGCSE" };
  }
  if (familyId === "languages_literature") {
    const lang = has.has("English Language"), lit = has.has("English Literature");
    if (!lang && !lit) return { short: "no English", full: "no English: taken as IGCSE" };
    if (!lang) return { short: "no English Language", full: "no English Language: taken as IGCSE" };
  }
  return null;
}

/**
 * The school's own category name (0.8 audit fixes R-IGCSE-GROUP-LABEL; shortened in 0.8 IGCSE subjects,
 * follow-up 1): everywhere a category name appears for an IGCSE school whose category lacks a subject it
 * takes as IGCSE, the short form, "Sciences & Maths · no maths (IGCSE)"; the full sentence is the view's
 * (i), igcseGroupNote. Judged on the school's subjects with entries in its latest GCSE year. Unchanged when
 * nothing is missing, or for a school the rule doesn't take out.
 */
export function igcseGroupLabel(familyId: string, label: string, subjects: Iterable<string>, igcse: boolean): string {
  const m = missingOf(familyId, subjects, igcse);
  return m ? `${label} · ${m.short} (IGCSE)` : label;
}

/**
 * The rank tile's own form of the label (follow-up 1: the tile must not grow beyond two lines). At 11px in
 * a third of Column 1, "of 4 in Sciences & Maths" already fills two lines, so the tile names the category
 * by what it is at the school: "of 4 in Sciences (maths: IGCSE)", "of 7 in Languages (English: IGCSE)".
 * Read from igcseGroupLabel's short form; any other label is returned unchanged.
 */
export function igcseTileName(label: string): string {
  const m = /^(.+?) · no (maths|Mathematics|English|English Language) \(IGCSE\)$/.exec(label);
  if (!m) return label;
  const what = m[2] === "maths" || m[2] === "Mathematics" ? "maths" : "English";
  return `${m[1].split(" & ")[0]} (${what}: IGCSE)`;
}

/** The (i)'s full sentence for the same category (null when the label is unchanged). */
export function igcseGroupNote(familyId: string, label: string, subjects: Iterable<string>, igcse: boolean): string | null {
  const m = missingOf(familyId, subjects, igcse);
  return m
    ? `${label} (${m.full}). DfE's tables hold GCSE results only, so this category at the school is its GCSE subjects alone: it isn't ranked against other schools' ${label}, while each subject it entered as GCSE is ranked like any other school's.`
    : null;
}

type HeadlineRow = { subject: string; familyId: string; familyLabel: string; period: number; entriesTotal: number };
function familyOf(headline: HeadlineRow[], subject: string): { own: HeadlineRow; subjects: string[] } | null {
  const own = headline.find((r) => r.subject === subject);
  if (!own) return null;
  const latest = Math.max(...headline.map((r) => r.period));
  return { own, subjects: headline.filter((r) => r.period === latest && r.familyId === own.familyId && r.entriesTotal > 0).map((r) => r.subject) };
}

/** The label, read from the school's headline rows for the focused subject's group (its latest year). */
export function igcseGroupLabelFor(headline: HeadlineRow[], subject: string, igcse: boolean): string | null {
  const f = familyOf(headline, subject);
  return f ? igcseGroupLabel(f.own.familyId, f.own.familyLabel, f.subjects, igcse) : null;
}

/** The note, read the same way. */
export function igcseGroupNoteFor(headline: HeadlineRow[], subject: string, igcse: boolean): string | null {
  const f = familyOf(headline, subject);
  return f ? igcseGroupNote(f.own.familyId, f.own.familyLabel, f.subjects, igcse) : null;
}
