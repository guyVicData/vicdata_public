// Teacher view: which subjects a figure is compared with (VicData 0.6 S2).
//
// Every population a Teacher view column compares the focused subject against -- Column 1's
// category, the "rank among every subject at school" list, Context's group members and the
// subjects Context draws -- with the rules that decide membership, lifted VERBATIM out of
// src/app/teacher/[phase]/page.tsx so a view moved out of its panel cannot widen or narrow
// its population by accident (catalogue design doc §1). Pure and client-safe. Every
// enforcement point carries its rule ID.
//
// S3b fixes: on Post-16 points "All subjects" keeps to the focus's qualification family
// (R-POINTS-SAME-QUAL, contextItemsOf), and a focused AS or AEA item counts itself into
// its own Context group (R-FOCUS-NEVER-FILTERED, R-SELF-INCLUSIVE-GROUP; Part D decision 1).
import type { AcademicSubjectHeadlineEntry } from "./academic-data-view";
import { isAsLevelOrAea } from "./dfe-qualification-buckets";
import { familyFor } from "./teacher-view-catalogue";
import { meanOf } from "./teacher-view-panels";
import type { TeacherPhase } from "./teacher-view-phases";
import { qualificationFamilyOf } from "./teacher-view-theme";

// The page's SubjectItem, structurally: one (subject, qualification) this school runs.
export type PopulationItem = { key: string; subject: string; qualificationType: string; entries: number };

/**
 * R-KS5-ASAEA-EXCL: AS level and AEA are left out of comparison lists, group totals and
 * averages -- never out of the focused item's own figure.
 */
export function isComparablePeer(item: { qualificationType: string }): boolean {
  return !isAsLevelOrAea(item.qualificationType);
}

/**
 * R-QUAL-FAMILY-MATCH: the focused item's qualification family (at Post-16 the display
 * bucket, so A level with A level, never with Core Maths, EPQ or Pre-U in Other) and the
 * test Column 1's category and Context's Selected subjects both apply. KS2 has no
 * qualifications, so everything matches there.
 */
export function focusQualificationFamily(phase: TeacherPhase, focusItem: { qualificationType: string } | null) {
  const focusQualFamily = focusItem && phase !== "ks2" ? qualificationFamilyOf(phase, focusItem.qualificationType) : null;
  const inFocusQualFamily = (i: { qualificationType: string }) =>
    focusQualFamily === null || qualificationFamilyOf(phase as "ks4" | "ks5", i.qualificationType) === focusQualFamily;
  return { focusQualFamily, inFocusQualFamily };
}

/**
 * Column 1's category: the focused item, then the school's other items in the same
 * taxonomy category, by entries.
 * R-FOCUS-NEVER-FILTERED: the focus is always first and never filtered.
 * R-KS5-ASAEA-EXCL: AS/AEA peers are left out (before the GCSE dedup, candidateItemsOf).
 * R-QUAL-FAMILY-MATCH: peers share the focus's qualification family.
 */
export function categoryItemsOf<T extends PopulationItem>(
  focusItem: T | null,
  items: T[],
  headline: AcademicSubjectHeadlineEntry[],
  inFocusQualFamily: (i: T) => boolean,
): T[] {
  if (!focusItem) return [];
  const focusFamilyId = familyFor(headline, focusItem.subject)?.id ?? null;
  return [
    focusItem,
    ...items
      .filter(
        (i) =>
          i.key !== focusItem.key &&
          isComparablePeer(i) &&
          inFocusQualFamily(i) &&
          focusFamilyId !== null &&
          familyFor(headline, i.subject)?.id === focusFamilyId,
      )
      .sort((a, b) => b.entries - a.entries),
  ];
}

/**
 * R-KS4-SUBJECT-DEDUP: at GCSE one category row per SUBJECT (entries rows are per subject,
 * so two items in one subject would both show its whole total); focus first. At Post-16
 * every item has its own exact-qualification row, so nothing is merged.
 */
export function candidateItemsOf<T extends PopulationItem>(categoryItems: T[], phase: TeacherPhase): T[] {
  return categoryItems.filter(
    (i, idx) => phase === "ks5" || categoryItems.findIndex((o) => o.subject === i.subject) === idx,
  );
}

/**
 * Column 1 Candidates' "rank of N subjects at school" population: every comparable subject
 * with entries, focused subject first, one entry per subject at GCSE.
 * R-FOCUS-NEVER-FILTERED, R-KS5-ASAEA-EXCL, R-KS4-SUBJECT-DEDUP.
 */
export function schoolSubjectsOf<T extends PopulationItem>(items: T[], focusItem: T | null, focusKey: string | null, phase: TeacherPhase): T[] {
  return items
    .filter((i) => focusItem !== null && (i.key === focusItem.key || (i.entries > 0 && isComparablePeer(i))))
    .sort((a, b) => (a.key === focusKey ? -1 : b.key === focusKey ? 1 : 0))
    .filter((i, idx, all) => phase === "ks5" || all.findIndex((o) => o.subject === i.subject) === idx);
}

/**
 * R-FOCUS-NEVER-FILTERED: a peer with no figure at all on the active measure (at GCSE, a
 * BTEC on points) is left out rather than drawn as an empty row; the focus always stays.
 */
export function keepFocusOrFigured<S extends { key: string; values: (number | null)[] }>(series: S[], focusKey: string | null): S[] {
  return series.filter((r) => r.key === focusKey || r.values.some((v) => v !== null));
}

/**
 * R-SELF-INCLUSIVE-GROUP: a group's per-subject average per period, over every member
 * including the focused subject (meanOf ignores members with no figure that year).
 */
export function memberMeans(periods: unknown[], series: { values: (number | null)[] }[]): (number | null)[] {
  return periods.map((_, i) => meanOf(series.map((s) => s.values[i])));
}

// ------------------------------------------------------------------ Context

// The focused item, structurally: the one (subject, qualification) Context compares.
type FocusRef = { subject: string; qualificationType: string } | null | undefined;

/**
 * R-FOCUS-NEVER-FILTERED, R-SELF-INCLUSIVE-GROUP (S3b, Part D decision 1): whether a
 * (subject, qualification) is the focused item itself -- which always counts into its own
 * group, even as AS level or AEA.
 */
function isFocusQualification(focus: FocusRef, subject: string | undefined, qualificationType: string | null | undefined): boolean {
  return !!focus && subject === focus.subject && (qualificationType ?? "") === focus.qualificationType;
}

/**
 * R-KS5-ASAEA-EXCL: the rows Context's group figures are built from. GCSE: the subject
 * rows. Post-16: the exact-qualification rows without AS level and AEA (not the bucket
 * rows, which double-counted and had AS baked into A level) -- except the focused item's
 * own row: an AS or AEA focus counts itself into its own group (R-FOCUS-NEVER-FILTERED,
 * R-SELF-INCLUSIVE-GROUP, S3b).
 */
export function contextGroupRows(
  phase: TeacherPhase,
  headline: AcademicSubjectHeadlineEntry[],
  qualificationHeadline: AcademicSubjectHeadlineEntry[],
  focus?: FocusRef,
): AcademicSubjectHeadlineEntry[] {
  return phase === "ks5"
    ? qualificationHeadline.filter((h) => !isAsLevelOrAea(h.qualificationType ?? "") || isFocusQualification(focus, h.subject, h.qualificationType))
    : headline;
}

/**
 * R-KS5-ASAEA-EXCL: whether a qualification's grade rows count towards Context's group.
 * R-FOCUS-NEVER-FILTERED (S3b): the focused item's own rows always do.
 */
export function inContextGroup(phase: TeacherPhase, qualificationType: string, subject?: string, focus?: FocusRef): boolean {
  return phase !== "ks5" || !isAsLevelOrAea(qualificationType) || isFocusQualification(focus, subject, qualificationType);
}

/**
 * R-KS5-ASAEA-EXCL: subjects this school runs ONLY as AS level or AEA -- never group
 * members, except the focused item's own subject (R-FOCUS-NEVER-FILTERED, S3b).
 */
export function asOrAeaOnlySubjects(items: PopulationItem[], focus?: FocusRef): Set<string> {
  return new Set(
    items
      .map((i) => i.subject)
      .filter((n) => n !== focus?.subject && items.every((i) => i.subject !== n || isAsLevelOrAea(i.qualificationType))),
  );
}

/** R-QUAL-FAMILY-MATCH: what Context's "Selected subjects" picker offers. */
export function contextOfferOf<T extends PopulationItem>(items: T[], inFamily: (i: T) => boolean): T[] {
  return items.filter((i) => i.entries > 0 && inFamily(i));
}

/** R-KS5-ASAEA-EXCL: every subject at the school, by name -- Context's All subjects group. */
export function schoolSubjectNamesOf(groupRows: AcademicSubjectHeadlineEntry[], asOrAeaOnly: Set<string>): string[] {
  return Array.from(new Set(groupRows.map((h) => h.subject))).filter((n) => !asOrAeaOnly.has(n));
}

export type ContextAgainst = "category" | "whole" | "selected";

/**
 * Context's group members, by subject name.
 * R-SELF-INCLUSIVE-GROUP: the group contains the subject being compared (Selected adds the
 * focus to a non-empty selection). R-KS5-ASAEA-EXCL: AS/AEA-only subjects are never
 * members -- except an AS-only focus, which `asOrAeaOnly` (asOrAeaOnlySubjects with the
 * focus) no longer holds, so it counts itself in (R-FOCUS-NEVER-FILTERED, S3b).
 * R-QUAL-FAMILY-MATCH: Selected is within the focus's family; All subjects is not.
 * Category is Column 1's own list (candidateItems), by name.
 */
export function contextMembersOf<T extends PopulationItem>(p: {
  against: ContextAgainst;
  schoolSubjectNames: string[];
  candidateItems: T[];
  contextOffer: T[];
  selected: string[];
  focusItem: T | null;
  inFamily: (i: T) => boolean;
  asOrAeaOnly: Set<string>;
  tickedItems: T[];
}): string[] {
  const every = p.schoolSubjectNames;
  if (p.against === "category") return Array.from(new Set(p.candidateItems.map((i) => i.subject)));
  if (p.against === "selected") {
    const names = new Set(p.contextOffer.filter((i) => p.selected.includes(i.key)).map((i) => i.subject));
    // Snagging round 1 Part 1: the group is self-inclusive in this mode too.
    if (names.size && p.focusItem && p.inFamily(p.focusItem) && !p.asOrAeaOnly.has(p.focusItem.subject)) names.add(p.focusItem.subject);
    // Nothing ticked yet falls back to the subjects this person teaches.
    return names.size
      ? every.filter((n) => names.has(n))
      : Array.from(new Set(p.tickedItems.filter(p.inFamily).map((i) => i.subject))).filter((n) => !p.asOrAeaOnly.has(n));
  }
  return every;
}

/**
 * The subjects Context draws: Column 1's own list on "category"; otherwise the focus then
 * every other item with entries (Selected: only the members).
 * R-FOCUS-NEVER-FILTERED, R-KS5-ASAEA-EXCL.
 * R-POINTS-SAME-QUAL: with `keepToFamily` (contextKeepsToFamily: Post-16 points) the peers
 * are only the focus's qualification family on every group, All subjects included, so A
 * level, BTEC and IB points never share one chart. (Category and Selected already are.)
 */
export function contextItemsOf<T extends PopulationItem>(p: {
  focusItem: T | null;
  against: ContextAgainst;
  candidateItems: T[];
  items: T[];
  contextMembers: string[];
  inFamily?: (i: T) => boolean;
  keepToFamily?: boolean;
}): T[] {
  const { focusItem } = p;
  return !focusItem
    ? []
    : p.against === "category"
      ? p.candidateItems
      : [
          focusItem,
          ...p.items.filter(
            (i) =>
              i.key !== focusItem.key &&
              i.entries > 0 &&
              isComparablePeer(i) &&
              (!p.keepToFamily || (p.inFamily?.(i) ?? false)) &&
              (p.against !== "selected" || p.contextMembers.includes(i.subject)),
          ),
        ];
}
