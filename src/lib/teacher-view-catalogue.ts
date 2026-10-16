// Teacher view, Phases 4 and 5: what a column is called, its default box title, a subject's family,
// and the comparability key (design brief v2 §7, §8, §9), plus the shape ViewChart draws.
//
// The round-5 axis catalogue that used to live here (AXES, availableViews, computeView: the slide
// picker's views and their "N-year trend" gate) was deleted in the year rules leftovers (16 Oct 2026):
// no page had called it since the 0.8 meetings work, whose S4 chooser offers each view's own forms.
import { bucketFor, KS5_BUCKET_LABEL, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";
import type { AcademicSubjectHeadlineEntry } from "@/lib/academic-data-view";
import type { TeacherPhase } from "@/lib/teacher-view-phases";

export type ColumnId = "candidates" | "results" | "context" | "rankings";

// Each column's own name, as a person reads it. One source, shared by the dashboard's
// header row and onboarding step 4, so the two can never name a card differently.
// "Comparisons" is round 6 §6.2's copy-only rename -- the ColumnId stays `rankings`.
export const COLUMN_TITLE: Record<ColumnId, string> = {
  candidates: "Candidates",
  results: "Results",
  context: "Context",
  rankings: "Comparisons",
};

// The box title for what each column shows before anything is pinned. These are the
// columns' own default content, not catalogue entries -- there is nothing to tick to get
// them -- but they are titled from here rather than in the page so every box title on
// the dashboard comes from one place.
//
// KS2 differs where the GCSE/Post-16 wording would be false rather than merely
// different: a primary has no entries (every pupil sits the same tests, §5), and its
// third card lists the nearest primaries rather than a share of entries.
export function defaultBoxTitle(columnId: ColumnId, phase: TeacherPhase): string {
  switch (columnId) {
    case "candidates":
      return phase === "ks2" ? "Year 6 cohort" : "Entries this year";
    case "results":
      return "Average point score";
    case "context":
      return phase === "ks2" ? "Nearest primaries" : "Share of entries";
    case "rankings":
      return "10 nearest schools";
  }
}

// The subject's family, from the headline rows Teacher view already loads. Those rows come
// from academic_subject_headline, which is keyed on the same subject_family_map that
// academic_subject_family_map_lookup exposes to CategoryFilter and SubjectAreaSection -- so
// this is that taxonomy, read from data already on the page rather than a second lookup
// or a second mapping.
export function familyLabelFor(headline: AcademicSubjectHeadlineEntry[], subject: string): string | null {
  return familyFor(headline, subject)?.label ?? null;
}

// The same resolution with the family_id as well, for places that need the category's
// site-wide colour (SUBJECT_FAMILY_COLOURS is keyed by family_id) as well as its name.
export function familyFor(headline: AcademicSubjectHeadlineEntry[], subject: string): { id: string; label: string } | null {
  const h = headline.find((r) => r.subject === subject);
  return h ? { id: h.familyId, label: h.familyLabel } : null;
}

// §7's third gate. At KS5 comparability is the bucket (an A level and a BTec in the same
// subject are not comparable on points); at KS4 the qualification type itself is the
// grain. Deliberately reuses bucketFor rather than restating the rule -- the Python and
// TypeScript twins of that rule are already kept in step, and a third copy here would be
// a third thing to drift.
// R-POINTS-SAME-QUAL
export function comparabilityKey(phase: TeacherPhase, qualificationType: string): string {
  if (phase !== "ks5") return qualificationType;
  return bucketFor(qualificationType) ?? "other";
}

export function comparabilityLabel(phase: TeacherPhase, qualificationType: string): string {
  if (phase !== "ks5") return qualificationType;
  const b = bucketFor(qualificationType) as Ks5Bucket | null;
  return b ? KS5_BUCKET_LABEL[b] : qualificationType;
}

// `sublabel` and `color` are only used by the labelled layout (the Candidates default:
// "Geography" over "GCSE", bar in that qualification group's chip colour).
// Round 6 adds two optional fields, both only read by the new `row` layout:
//   - `marker`: the benchmark this row is read against -- the England average in Results,
//     the comparison group's own average in Context. Drawn as a tick ON the row's track,
//     so the comparison is inside the bar rather than in a tooltip beside it.
//   - `emphasis`: draw this row heavier. Comparisons uses it for your own school among
//     the comparator set, where `isSubject` would be the wrong word for the same idea.
export type ComparisonRow = {
  label: string;
  value: number | null;
  isSubject: boolean;
  sublabel?: string;
  color?: string;
  marker?: number | null;
  emphasis?: boolean;
};
export type TrendSeries = { label: string; values: (number | null)[]; isSubject: boolean };
// A view is EITHER a current-position comparison (rows) or a trend (periods+series) --
// never both, so the renderer never has to guess which half is authoritative.
export type ComputedView = { rows: ComparisonRow[]; periods?: number[]; series?: TrendSeries[] };
