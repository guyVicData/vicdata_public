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
//
// Round 5 adds a box title alongside the question: 2-4 words, because the question is a
// sentence and a box on the dashboard needs something it can carry in its corner. Both are
// built from the same facts (qualification, subject family), so the short title can never
// describe a different comparison from the question it sits above. The family is the real
// one from the platform's subject-family taxonomy -- see familyLabelFor -- so a Geography
// teacher's box reads "Vs. Humanities & Social Sciences", never a placeholder.
type TitleContext = { qualLabel: string; familyLabel: string | null };

export const AXES: {
  id: AxisId;
  question: (subject: string) => string;
  shortTitle: (c: TitleContext) => string;
  needsChoice?: boolean;
}[] = [
  { id: "vs_school_avg", question: (s) => `How is ${s} doing against the school average in this qualification?`, shortTitle: (c) => `Vs. ${c.qualLabel} average` },
  { id: "vs_category", question: (s) => `How is ${s} doing against the other subjects in its category?`, shortTitle: (c) => `Vs. ${c.familyLabel ?? "its category"}` },
  { id: "vs_all_subjects", question: (s) => `How is ${s} doing against every other subject here?`, shortTitle: () => "Vs. whole school" },
  { id: "vs_chosen", question: (s) => `How is ${s} doing against subjects I pick myself?`, shortTitle: () => "Vs. your comparison set", needsChoice: true },
  { id: "category_vs_categories", question: (s) => `How is ${s}'s whole category doing against every other category?`, shortTitle: (c) => `${c.familyLabel ?? "Its category"} vs. every category` },
];

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
// or a second mapping. It is also the resolution availableViews and computeView already
// use to decide what "its category" means, so the title and the figures agree.
export function familyLabelFor(headline: AcademicSubjectHeadlineEntry[], subject: string): string | null {
  return headline.find((h) => h.subject === subject)?.familyLabel ?? null;
}

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

// Round 5: views that are not one of §8's five axes. They are not per-subject comparisons,
// so computeView (which is) never sees them; the dashboard renders them from its own data.
//   - Candidates' "Entries, % of year group": the ticked subjects' entries as a share of
//     the whole exam cohort.
//   - Rankings' four other comparator sets, beside the Nearest 10 map default. Rankings had
//     no menu at all before this round.
export type SpecialViewId =
  | "share_of_cohort"
  | "rank_list"
  | "rank_same_sector"
  | "rank_local_rivals"
  | "rank_similar_size";

export function isAxisView(v: ViewDef): v is ViewDef & { axis: AxisId } {
  return AXES.some((a) => a.id === v.axis);
}

function specialView(columnId: ColumnId, axis: SpecialViewId, shortTitle: string, label: string, sublabel: string): ViewDef {
  return { id: viewId(columnId, axis, null, false), columnId, axis, subjectKey: null, trend: false, label, sublabel, shortTitle, subjectLabel: "" };
}

// Rankings' pinnable sets, in the round-5 brief's order. Each is a real selection from
// the same neighbour pool as the default Nearest 10 -- see teacher-view-rankings.ts.
// Similar-sized is GCSE/Post-16 only: KS2 publishes no exam-cohort size to match on.
function rankingsViews(phase: TeacherPhase): ViewDef[] {
  const out = [
    specialView("rankings", "rank_list", "Nearest 10, as a list", "How do we rank against the ten nearest schools, one by one?", "Ranked list · same ten as the map"),
    specialView("rankings", "rank_same_sector", "Nearest 10, same sector", "How do we rank against the nearest schools in our own sector?", "State with state, independent with independent"),
    specialView("rankings", "rank_local_rivals", "Local rivals", "How do we rank against the local schools families weigh us against?", "The five nearest state and five nearest independent schools"),
  ];
  if (phase !== "ks2") {
    out.push(
      specialView(
        "rankings",
        "rank_similar_size",
        phase === "ks5" ? "Similar-sized sixth forms" : "Similar-sized schools",
        phase === "ks5" ? "How do we rank against nearby sixth forms of a similar size?" : "How do we rank against nearby schools with a similar-sized GCSE year?",
        "The ten nearby schools with the closest exam cohort",
      ),
    );
  }
  return out;
}

export type ViewDef = {
  id: string;
  columnId: ColumnId;
  axis: AxisId | SpecialViewId;
  subjectKey: string | null;
  trend: boolean;
  label: string;
  sublabel: string;
  shortTitle: string;
  subjectLabel: string;
};

export function viewId(columnId: ColumnId, axis: AxisId | SpecialViewId, subjectKey: string | null, trend: boolean): string {
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
  // Rankings compares schools, not subjects, so it gets its comparator sets and no axis
  // menu -- and they do not depend on which subjects are ticked.
  if (columnId === "rankings") return rankingsViews(phase);
  const measure = COLUMN_MEASURE[columnId];
  if (!measure) return [];
  if (ticked.length === 0) return [];

  const out: ViewDef[] = [];
  // Every subject pick-list is empty at KS2 (no subject picker there), so this is
  // unreachable at KS2 in practice; the phase test states it rather than relying on it.
  if (columnId === "candidates" && phase !== "ks2") {
    out.push(specialView("candidates", "share_of_cohort", "Entries, % of year group", "What share of the whole year group takes the subjects I teach?", `Entries ÷ ${phase === "ks5" ? "the 16-18 exam cohort" : "the GCSE cohort"}`));
  }
  for (const s of ticked) {
    const bucket = phase === "ks5" ? comparabilityKey(phase, s.qualificationType) : null;
    const years = yearsOfData(headline, s.subject, bucket, measure.key);
    const qualLabel = comparabilityLabel(phase, s.qualificationType);
    const titleContext: TitleContext = { qualLabel, familyLabel: familyLabelFor(headline, s.subject) };
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
        shortTitle: axis.shortTitle(titleContext),
        subjectLabel: s.label,
      });
      if (years >= TREND_MIN_YEARS) {
        out.push({
          id: viewId(columnId, axis.id, s.key, true),
          columnId, axis: axis.id, subjectKey: s.key, trend: true,
          // The trend variant is a different question, not the same one with a suffix.
          label: axis.question(s.label).replace(/\?$/, "") + ", year on year?",
          sublabel: `${measure.label} · ${qualLabel} · ${years} years`,
          // The real span, not the mockup's fixed "5-year": trends are offered from
          // TREND_MIN_YEARS up, and a title claiming five years over three would be
          // the one place on the box that is wrong.
          shortTitle: `${axis.shortTitle(titleContext)}, ${years}-year trend`,
          subjectLabel: s.label,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Computing a pinned view against real data.
// ---------------------------------------------------------------------------

// `sublabel` and `color` are only used by the labelled layout (the Candidates default:
// "Geography" over "GCSE", bar in that qualification group's chip colour).
export type ComparisonRow = { label: string; value: number | null; isSubject: boolean; sublabel?: string; color?: string };
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
  if (!measure || !isAxisView(view)) return { rows: [] };
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
