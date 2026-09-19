// Teacher view, Phases 4 and 5: the catalogue of views a column can offer (design brief
// v2 §7, §8, §9).
//
// These are one mechanism, not two. §8 says the five comparison axes are "exactly what
// populates School Context's add/remove scrollable list (§7) -- it isn't a separate
// mechanism", so the axes are defined here once and the builder UI simply renders
// whatever this module says is available.
//
// §7 gates the add-list three ways, and all three are real filters here rather than
// decoration:
//   1. scoped to the column's own topic -- a Results column never offers a Rankings view;
//   2. scoped to the ticked subject(s);
//   3. scoped to the comparable qualification type, reusing the existing bucket logic, so
//      a subject entered under two qualifications only offers genuinely comparable views.
import { bucketFor, KS5_BUCKET_LABEL, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";
import type { AcademicSubjectHeadlineEntry } from "@/lib/academic-data-view";
import type { TeacherPhase } from "@/lib/teacher-view-phases";

export type ColumnId = "candidates" | "results" | "context" | "rankings";

// §9: "a trend history option in the expanded view once 3+ years of data exist". Not 2,
// and not "whatever we have" -- two points is a line, not a trend, and the brief is
// explicit about the number.
export const TREND_MIN_YEARS = 3;

// §8's five axes, in the brief's own order and wording. Axis 4 is the only one that needs
// further input from the user (which subjects to compare against), which is why it is
// flagged rather than just described.
export type AxisId = "vs_school_avg" | "vs_category" | "vs_all_subjects" | "vs_chosen" | "category_vs_categories";

// §14 makes natural-language questions "a fundamental, load-bearing principle, not one
// bullet among several", and names this menu explicitly: "every item in School Context's
// comparison menu ... named as the real question it answers, not a generic label".
//
// So an axis carries a question-builder rather than a noun phrase. "Biology -- vs the
// school average" and "How is Biology doing against the school average in this
// qualification?" describe the same computation; only the second tells someone who has
// not read a spec what they are about to find out.
export const AXES: { id: AxisId; question: (subject: string) => string; needsChoice?: boolean }[] = [
  { id: "vs_school_avg", question: (s) => `How is ${s} doing against the school average in this qualification?` },
  { id: "vs_category", question: (s) => `How is ${s} doing against the other subjects in its category?` },
  { id: "vs_all_subjects", question: (s) => `How is ${s} doing against every other subject here?` },
  { id: "vs_chosen", question: (s) => `How is ${s} doing against subjects I pick myself?`, needsChoice: true },
  { id: "category_vs_categories", question: (s) => `How is ${s}'s whole category doing against every other category?` },
];

// §8 applies the five axes to BOTH Results and Candidate numbers -- same axes, different
// measure -- which is why the measure is a property of the column rather than of the axis.
export const COLUMN_MEASURE: Record<string, { key: "points" | "entries"; label: string; unit: string }> = {
  results: { key: "points", label: "Average point score", unit: "points" },
  candidates: { key: "entries", label: "Entries", unit: "entries" },
  context: { key: "entries", label: "Entries", unit: "entries" },
};

export type SubjectRef = { key: string; subject: string; qualificationType: string; label: string };

// §7's third gate. At KS5 comparability is the bucket (an A level and a BTec in the same
// subject are not comparable on points); at KS4 the qualification type itself is the
// grain. Deliberately reuses bucketFor rather than restating the rule -- the Python and
// TypeScript twins of that rule are already kept in step, and a third copy here would be
// a third thing to drift.
export function comparabilityKey(phase: TeacherPhase, qualificationType: string): string {
  if (phase !== "ks5") return qualificationType;
  return bucketFor(qualificationType) ?? "other";
}

export function comparabilityLabel(phase: TeacherPhase, qualificationType: string): string {
  if (phase !== "ks5") return qualificationType;
  const b = bucketFor(qualificationType) as Ks5Bucket | null;
  return b ? KS5_BUCKET_LABEL[b] : qualificationType;
}

export type ViewDef = {
  id: string;
  columnId: ColumnId;
  axis: AxisId;
  subjectKey: string | null;
  trend: boolean;
  label: string;
  sublabel: string;
};

export function viewId(columnId: ColumnId, axis: AxisId, subjectKey: string | null, trend: boolean): string {
  return [columnId, axis, subjectKey ?? "-", trend ? "trend" : "now"].join("|");
}

// How many distinct periods this subject genuinely has a figure for -- the real gate on
// whether a trend view is offered at all. Counts periods with a non-null value, not
// periods that merely exist, so a subject with four years of rows but only two years of
// published points does NOT get offered a trend.
export function yearsOfData(
  headline: AcademicSubjectHeadlineEntry[],
  subject: string,
  bucket: string | null,
  measure: "points" | "entries",
): number {
  const periods = new Set<number>();
  for (const h of headline) {
    if (h.subject !== subject) continue;
    if (bucket !== null && (h.bucket ?? "all") !== bucket) continue;
    const v = measure === "points" ? h.avgPointScore : h.entriesTotal;
    if (v !== null && v !== undefined) periods.add(h.period);
  }
  return periods.size;
}

// The gated add-list for one column. Returns [] for a column whose topic has no axis
// menu -- §7's "a Results column never offers a Rankings-type view", enforced by the
// catalogue rather than trusted to the caller.
export function availableViews(
  columnId: ColumnId,
  phase: TeacherPhase,
  ticked: SubjectRef[],
  headline: AcademicSubjectHeadlineEntry[],
): ViewDef[] {
  const measure = COLUMN_MEASURE[columnId];
  if (!measure) return []; // rankings: compares schools, not subjects -- no axis menu.
  if (ticked.length === 0) return [];

  const out: ViewDef[] = [];
  for (const s of ticked) {
    const bucket = phase === "ks5" ? comparabilityKey(phase, s.qualificationType) : null;
    const years = yearsOfData(headline, s.subject, bucket, measure.key);
    const qualLabel = comparabilityLabel(phase, s.qualificationType);
    for (const axis of AXES) {
      // Axis 5 is about the category, not the subject, so it would be the identical view
      // repeated once per ticked subject in the same category. Offered once per category.
      if (axis.id === "category_vs_categories") {
        const famA = headline.find((h) => h.subject === s.subject)?.familyId;
        const alreadyOffered = out.some(
          (v) => v.axis === "category_vs_categories" &&
            headline.find((h) => h.subject === ticked.find((t) => t.key === v.subjectKey)?.subject)?.familyId === famA,
        );
        if (alreadyOffered) continue;
      }
      out.push({
        id: viewId(columnId, axis.id, s.key, false),
        columnId, axis: axis.id, subjectKey: s.key, trend: false,
        label: axis.question(s.label),
        sublabel: `${measure.label} · ${qualLabel}`,
      });
      if (years >= TREND_MIN_YEARS) {
        out.push({
          id: viewId(columnId, axis.id, s.key, true),
          columnId, axis: axis.id, subjectKey: s.key, trend: true,
          // The trend variant is a different question, not the same one with a suffix.
          label: axis.question(s.label).replace(/\?$/, "") + ", year on year?",
          sublabel: `${measure.label} · ${qualLabel} · ${years} years`,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Computing a pinned view against real data.
// ---------------------------------------------------------------------------

export type ComparisonRow = { label: string; value: number | null; isSubject: boolean };
export type TrendSeries = { label: string; values: (number | null)[]; isSubject: boolean };
// A view is EITHER a current-position comparison (rows) or a trend (periods+series) --
// never both, so the renderer never has to guess which half is authoritative.
export type ComputedView = { rows: ComparisonRow[]; periods?: number[]; series?: TrendSeries[] };

function valueOf(h: AcademicSubjectHeadlineEntry, measure: "points" | "entries"): number | null {
  return measure === "points" ? h.avgPointScore : h.entriesTotal;
}

function latestPeriodWithValue(rows: AcademicSubjectHeadlineEntry[], measure: "points" | "entries"): number | null {
  const ps = rows.filter((r) => valueOf(r, measure) !== null).map((r) => r.period);
  return ps.length ? Math.max(...ps) : null;
}

// Mean over rows that genuinely have a figure. Returns null rather than 0 for an empty
// set, because "no comparable subject has a published figure" and "the average is zero"
// are different statements and only one of them is ever true here.
function meanOf(vals: (number | null)[]): number | null {
  const real = vals.filter((v): v is number => v !== null);
  return real.length ? real.reduce((a, b) => a + b, 0) / real.length : null;
}

export function computeView(
  view: ViewDef,
  phase: TeacherPhase,
  ticked: SubjectRef[],
  allSubjects: SubjectRef[],
  headline: AcademicSubjectHeadlineEntry[],
  chosenKeys: string[],
): ComputedView {
  const measure = COLUMN_MEASURE[view.columnId];
  if (!measure) return { rows: [] };
  const subject = ticked.find((t) => t.key === view.subjectKey) ?? allSubjects.find((t) => t.key === view.subjectKey);
  if (!subject) return { rows: [] };

  const bucket = phase === "ks5" ? comparabilityKey(phase, subject.qualificationType) : null;
  const inBucket = (h: AcademicSubjectHeadlineEntry) => bucket === null || (h.bucket ?? "all") === bucket;
  const mine = headline.filter((h) => h.subject === subject.subject && inBucket(h));
  const myFamily = mine[0]?.familyId ?? null;

  // Which OTHER subjects this axis compares against. Every branch stays inside the
  // comparability bucket -- that is §7's third gate, and dropping it here would quietly
  // put A-level points beside BTec points, the exact error the bucket work exists to stop.
  const peers = (): AcademicSubjectHeadlineEntry[] => {
    switch (view.axis) {
      case "vs_category":
        return headline.filter((h) => inBucket(h) && h.familyId === myFamily && h.subject !== subject.subject);
      case "vs_all_subjects":
        return headline.filter((h) => inBucket(h) && h.subject !== subject.subject);
      case "vs_chosen": {
        const keys = new Set(chosenKeys);
        const names = new Set(allSubjects.filter((s) => keys.has(s.key)).map((s) => s.subject));
        return headline.filter((h) => inBucket(h) && names.has(h.subject) && h.subject !== subject.subject);
      }
      default:
        return headline.filter((h) => inBucket(h) && h.subject !== subject.subject);
    }
  };

  if (!view.trend) {
    const period = latestPeriodWithValue(mine, measure.key);
    const at = (rows: AcademicSubjectHeadlineEntry[]) => rows.filter((r) => r.period === period);
    const myValue = meanOf(at(mine).map((r) => valueOf(r, measure.key)));

    if (view.axis === "vs_school_avg") {
      return {
        rows: [
          { label: subject.label, value: myValue, isSubject: true },
          { label: `School average (${comparabilityLabel(phase, subject.qualificationType)})`, value: meanOf(at(peers()).map((r) => valueOf(r, measure.key))), isSubject: false },
        ],
      };
    }

    if (view.axis === "category_vs_categories") {
      // Axis 5 aggregates to category grain on both sides, so the subject's own category
      // is one row among all categories rather than a row on its own.
      const byFamily = new Map<string, { label: string; vals: (number | null)[] }>();
      for (const h of at(headline.filter(inBucket))) {
        const entry = byFamily.get(h.familyId) ?? { label: h.familyLabel, vals: [] };
        entry.vals.push(valueOf(h, measure.key));
        byFamily.set(h.familyId, entry);
      }
      return {
        rows: Array.from(byFamily.entries())
          .map(([fid, e]) => ({ label: e.label, value: meanOf(e.vals), isSubject: fid === myFamily }))
          .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
      };
    }

    const peerRows = at(peers()).map((r) => ({ label: r.subject, value: valueOf(r, measure.key), isSubject: false }));
    return {
      rows: [{ label: subject.label, value: myValue, isSubject: true }, ...peerRows]
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    };
  }

  // Trend. Only periods where the subject itself has a figure -- a comparison line that
  // extends past the subject's own data would invite reading a gap as a fall.
  const periods = Array.from(new Set(mine.filter((r) => valueOf(r, measure.key) !== null).map((r) => r.period))).sort((a, b) => a - b);
  const seriesFor = (label: string, rows: AcademicSubjectHeadlineEntry[], isSubject: boolean) => ({
    label,
    isSubject,
    values: periods.map((p) => meanOf(rows.filter((r) => r.period === p).map((r) => valueOf(r, measure.key)))),
  });

  if (view.axis === "category_vs_categories") {
    const families = new Map<string, { label: string; rows: AcademicSubjectHeadlineEntry[] }>();
    for (const h of headline.filter(inBucket)) {
      const e = families.get(h.familyId) ?? { label: h.familyLabel, rows: [] };
      e.rows.push(h);
      families.set(h.familyId, e);
    }
    return { rows: [], periods, series: Array.from(families.entries()).map(([fid, e]) => seriesFor(e.label, e.rows, fid === myFamily)) };
  }

  return {
    rows: [],
    periods,
    series: [
      seriesFor(subject.label, mine, true),
      seriesFor(
        view.axis === "vs_category" ? "Category average" : view.axis === "vs_chosen" ? "Chosen subjects" : "School average",
        peers(),
        false,
      ),
    ],
  };
}
