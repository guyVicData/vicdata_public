// VicData 0.6.1 S3: what a configured panel hands the view renderer -- the page's data for
// that panel, as the page has ALREADY derived it, and the members' own settings on it.
//
// A frame is not a second derivation. Every number in it comes from where it comes from
// today: the page's populations, measures, comparisons and geography (src/lib/teacher-view-
// *.ts) resolve the subjects, their values per period, the benchmarks and the group lines,
// and the column hosts (SubjectPanels, CandidatesPanels, ComparisonsPanels) hand them over
// as the props they already receive, plus the members' own controls (the "From" year, the
// Trend line toggle, the year menu, a table's sort). The series builder (./index.ts) turns a
// ViewSpec and a frame into one leaf's props; the leaf draws them.
//
// Three shapes, one per kind of host data:
//   subjects     one value per subject per period, with a benchmark per subject and group
//                lines (Column 1 Results, Context) -- SubjectPanels' props
//   candidates   each subject's entries per period (Column 1 Candidates)
//   comparisons  each school's value per period in the page's comparison set (Comparisons)
import type { CompareSeriesKind } from "@/catalogue/viewspec";
import type { Measure } from "@/lib/teacher-view-panels";
import type { GradeRange } from "@/lib/subject-grades";

export type FrameSubject = {
  key: string;
  label: string;
  shortLabel: string;
  // The host's own colour for it (Results' qualification colours; Context's are re-tinted
  // in Current's order, as the host does).
  colour: string;
  values: (number | null)[];
  // What it is read against, per period: England (Results), the group's per-subject average
  // (Context). Aligned to `periods`.
  benchmark?: (number | null)[];
};

// The members' own controls the host owns (they survive a view switch, as today).
export type FrameMemberState = {
  // The Trends "From" year of each half (null = the first year with a figure).
  trendStart: number | null;
  changeStart: number | null;
  // The footer's Trend line toggle.
  showFit: boolean;
};

export type SortKey = "name" | "value" | "delta";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

export type SubjectsFrame = {
  kind: "subjects";
  host: "teacher.c1.results" | "teacher.c2.context";
  periods: number[];
  subjects: FrameSubject[];
  measure: Measure;
  // The dashboard's focus subject (the chips), as the host resolves it.
  focus: string | null;
  // The group lines the page derived (Results: the category average, then England's
  // category average; Context: the compare-against group's per-subject average).
  groups: { label: string; values: (number | null)[]; colour?: string }[];
  // What groups[0] is, in a ViewSpec's compare words (Results "category"; Context the pill:
  // "category" / "allSubjects" / "selectedSubjects").
  groupKind: CompareSeriesKind | null;
  // What each subject's benchmark is ("england" on Results, the group on Context) and its
  // label ("National", "Whole school"); absent = no benchmark for this measure.
  benchmarkKind: CompareSeriesKind | null;
  benchmarkLabel?: string;
  deltaHeading?: string;
  rankedTable: boolean;
  rankedViews: boolean;
  spaciousBars: boolean;
  categoryLabel?: string;
  compareAgainstLabel?: string;
  changeScope: "all" | "individual";
  cardTrend?: "focusVsGroup";
  theme: "dark" | "light";
  accentHex: string | null;
  // The host draws its own note in Current instead of any view (no subjects; Grade bands
  // with no range picked yet).
  currentBlocked: boolean;
  // Results' % change half is the geography comparison (its own fetch, a later part).
  hasGeography: boolean;
  // S3b: Results' number tiles. `tiles` = the host offers them (Column 1 Results); on Grade
  // bands, the range and the focused subject's own per-grade rows (bandRate's input).
  tiles?: boolean;
  gradeBand?: { range: GradeRange | null; rangeLabel: string | null; ownRows: { period: number; grade: string; entries: number }[] } | null;
  // The school's name (a tile scope line's [school]).
  schoolName?: string;
  state: FrameMemberState & {
    // The year Current shows (Context's year menu), as an index into `periods`.
    latestIdx: number;
    // Keys the fullscreen "Subjects shown" list has switched off.
    hiddenKeys: ReadonlySet<string>;
    // Current's sortable table, sorted by the member (owned by the host).
    sort: SortState;
    onSort: (key: SortKey) => void;
  };
};

export type CandidatesFrame = {
  kind: "candidates";
  periods: number[];
  subjects: { key: string; label: string; shortLabel: string; values: (number | null)[] }[];
  focus: string | null;
  // The category's per-subject average line's name ("Sciences & Maths average").
  groupLabel?: string;
  categoryLabel?: string;
  theme: "dark" | "light";
  accentHex: string | null;
  hasGeography: boolean;
  // S3b: the number tiles' inputs -- the column's word ("Candidates"), every comparable
  // subject at the school (the "rank among the school's subjects" population), the school.
  currentLabel?: string;
  schoolSubjects?: { key: string; values: (number | null)[] }[];
  schoolName?: string;
  state: FrameMemberState;
};

export type FrameSchool = {
  urn: string;
  name: string;
  isTarget: boolean;
  igcseExcluded?: boolean;
  // Aligned to the frame's periods: the figure, and (where the page has it) the entries
  // behind it -- a table's "n" and a weighted average's weights.
  values: (number | null)[];
  counts?: (number | null)[];
  // S3b: the ranking table's sector icon and distance column.
  distanceKm?: number | null;
  independent?: boolean | null;
};

// S3b: a national / regional ranking's own figures (RankingFigures, as the chooser-set route
// resolved them), on the ranking's own measure -- the tiles' rank and average.
export type FrameRankingFigures = {
  ranked: number;
  targetRank: number | null;
  target: { period: number; value: number } | null;
  averageLatest: number | null;
  measure: Measure;
  measureName: string;
};

export type ComparisonsFrame = {
  kind: "comparisons";
  periods: number[];
  // The set's schools with a figure for what is compared (comparisonSchools), the school
  // itself included.
  schools: FrameSchool[];
  measure: Measure;
  targetName: string;
  setLabel: string;
  // What is compared, in a sentence ("Maths avg. point score", or the phase headline).
  comparedOn: string;
  // The same for a title ("Maths entries").
  titleOn: string;
  // The members' "vs:" choice on Trend: the set's average, or one school in it.
  versus: { urn: string | "average"; label: string };
  // The set is a national / regional ranking, and the figure is its own measure: the
  // population's own average per period stands in for the sample's (R-RANKING-SAMPLE).
  onRankingMeasure: boolean;
  ranking: { averageAt: (period: number | null) => number | null; figures?: FrameRankingFigures } | null;
  // The chip's subject, if any (a tile scope line's [subject]).
  subjectLabel?: string | null;
  setKind: "nearest" | "savedSet";
  // The per-subject rows are still loading, or the host draws a note (no schools).
  blocked: boolean;
  state: FrameMemberState;
};

export type ViewFrame = SubjectsFrame | CandidatesFrame | ComparisonsFrame;
