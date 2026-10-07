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
import type { Phase } from "@/catalogue/types";
import type { Measure } from "@/lib/teacher-view-panels";
import type { GradeRange } from "@/lib/subject-grades";
import type { GradeCountRow } from "@/lib/grade-spread";
import type { GeographyMetric, GeographyPayload } from "@/lib/teacher-view-geography";
import type { AcademicSchoolProfile, KsStage } from "@/lib/academic-data-view";
import type { MapSeries, TeacherMapSpec } from "@/lib/teacher-map";

// S3c: the geography comparison (the focused subject against its LA, region and England) as
// the host already fetched it (useSubjectGeography) -- the frame never fetches. `own` is the
// school's figure the area figures are read beside (points-eligible entries on Candidates,
// R-GEO-POINTS-ELIGIBLE), aligned to the frame's periods; `payload` undefined = loading.
export type FrameGeography = {
  label: string;
  applies: boolean;
  notApplicableText: string;
  metric: GeographyMetric;
  own: (number | null)[];
  payload: GeographyPayload | null | undefined;
  // What the host fetched it for (the CentredOnTarget key the host's table uses).
  id: string;
};

// S3c: "Add an average" on a subject column (1 · Data, an average of things NOT drawn) --
// the page's own populations, built on demand only when a view of its own asks:
//   at this school    a group of the school's subjects (category / all subjects / selected
//                     subjects, as Context's pill would draw them: contextItemsOf), each
//                     subject's figure on the column's measure and its entries (the weights)
//   across schools    the page's Compared against set (the comparator schools' own figures
//                     for the focused subject, as Comparisons reads them), the school left out
// Both aligned to the frame's periods. null = the page has no such figure (a ranking's
// sample, a rate the page has no comparator grades for).
export type FrameGroupMember = { key: string; values: (number | null)[]; counts?: (number | null)[] };
export type FrameGroup = { label: string; members: FrameGroupMember[] };
export type FrameSchoolGroup = (kind: "category" | "allSubjects" | "selectedSubjects") => FrameGroup | null;
export type FrameSet = { label: string; schools: FrameGroupMember[] };
// 0.6.2 S3: the Compared-against set's other schools' own grade rows for the focused subject
// and exact qualification (/api/teacher/comparator-grades), every year they have them -- what
// "Add an average" across schools reads on a grade spread (R-COMPARATOR-GRADE-SHARE).
export type FrameSetGrades = { label: string; schools: { urn: string; rows: GradeCountRow[] }[] };

// S3c: Context's donut, as SubjectPanels is handed it (the group's own totals; on Grade
// bands the group's entries in the range, of all its graded entries).
export type FrameDonut = {
  enabled: boolean;
  groupLabel: string;
  groupTotals: (number | null)[];
  shareOf?: string;
  share?: { values: (number | null)[]; totals: (number | null)[]; label: string; otherLabel: string; format: (v: number) => string };
};

// S3c: what a map draws on -- the page's already-loaded map profiles, the plotted subject
// (the chip's), the phase accent -- and the host's own callbacks (the card map hands its
// caption and the school's rank up to the panel's summary).
export type FrameMapChip = { subject: string | null; legend: string | null; bucket: string | null; familyId: string | null };
export type FrameMap = {
  profiles: AcademicSchoolProfile[] | null;
  targetUrn: string | null;
  stage: KsStage;
  chip: FrameMapChip | null;
  accentHex: string | null;
  // R-RANKING-SAMPLE: no map of a ranking's sample.
  allowed: boolean;
  onCaption?: (caption: string) => void;
  onTargetRank?: (info: { rank: number; total: number } | null) => void;
  // 0.6.3 S2: the Teacher maps' encoding (src/lib/teacher-map.ts): the panel's per-school
  // figures for a Trends map's change, Current's spec, and the set's own profiles.
  teacher?: { series: MapSeries; current?: TeacherMapSpec; trend?: TeacherMapSpec; profiles?: AcademicSchoolProfile[] | null } | null;
};

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
  // 0.6.3 S1: Context on a Grade counts selection -- Current's titles lead with it
  // ("Share at grade 9, by subject in …").
  titleLead?: string;
  changeScope: "all" | "individual";
  cardTrend?: "focusVsGroup";
  theme: "dark" | "light";
  accentHex: string | null;
  // The host draws its own note in Current instead of any view (no subjects; Grade bands
  // with no range picked yet).
  currentBlocked: boolean;
  // Results' % change half is the geography comparison (its own fetch, `geography`).
  hasGeography: boolean;
  // S3b: Results' number tiles. `tiles` = the host offers them (Column 1 Results); on Grade
  // bands, the range and the focused subject's own per-grade rows (bandRate's input).
  tiles?: boolean;
  // S3d: the Grade distribution view's inputs too (was "Grades (pick a range)") --
  // England's per-grade rows (the host's fetch, [] until it arrives) and the subject's
  // colour. `pending` / `onGradeClick` (click two grades to pick the range) are no longer
  // passed by the page since 0.6.1 S5: the range is picked in the top bar.
  gradeBand?: {
    range: GradeRange | null;
    rangeLabel: string | null;
    ownRows: GradeCountRow[];
    englandRows?: GradeCountRow[];
    colour?: string;
    pending?: string | null;
    onGradeClick?: (grade: string) => void;
  } | null;
  // The school's name (a tile scope line's [school]).
  schoolName?: string;
  // S3c: the phase (the catalogue's honest options, D7), Context's donut, Results' %
  // change geography comparison, and Results' Trend map (the focused subject at each
  // comparator school).
  phase?: Phase;
  donut?: FrameDonut | null;
  geography?: FrameGeography | null;
  // 0.6.3 S2: `title` -- the host's title for the map on Results' measure.
  trendMap?: (FrameMap & { subjectLabel: string; title?: string }) | null;
  schoolGroup?: FrameSchoolGroup;
  schoolSet?: () => FrameSet | null;
  // 0.6.2 S3: the set's grade rows (null while they load, or with no set), built on demand.
  schoolSetGrades?: () => FrameSetGrades | null;
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
  // S3c: the phase, the column's measure (entries) and the % change geography comparison.
  phase?: Phase;
  measure?: Measure;
  geography?: FrameGeography | null;
  schoolGroup?: FrameSchoolGroup;
  schoolSet?: () => FrameSet | null;
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
  // 0.6.5 S5: the school has no figure on the ranking's measure for a known reason (no A-level
  // entries at Post-16): the tiles give way to this note.
  noFigureNote?: string | null;
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
  // S3c: the phase, the page's theme (compare colours) and the maps' inputs.
  phase?: Phase;
  theme?: "dark" | "light";
  map?: FrameMap | null;
  state: FrameMemberState;
  // 0.6.3 S1 (R-COUNTS-SELECTION): on Grade counts with a grade selected, Current's views
  // are titled by the selection ("Share at grade 9, by school (10 nearest schools)").
  titleLead?: string;
  // 0.6.3 S1 (R-MIN-ENTRIES): schools publishing the subject below the small-entries rule,
  // listed by the ranking as "too few entries" rather than a %. Current's frame only.
  tooFew?: FrameSchool[];
};

/** 0.6.3 S1: Current's title on a Grade counts selection, every view (map included). */
export function comparisonsLeadTitle(f: ComparisonsFrame): string | null {
  return f.titleLead ? `${f.titleLead}, by school (${f.setLabel.toLowerCase()})` : null;
}

// S3d: Column 1 Results on Grade counts (GradeCountsPanels) -- the focused subject's own
// per-grade rows, every year it has them, and England's (the host's own fetch, [] until it
// arrives or where there is none), and the members' own picks: the Trends "From" years (the
// spread's earlier year, the change table's first) and Current's click-two-grades highlight.
export type GradesFrame = {
  kind: "grades";
  phase?: Phase;
  subjectLabel: string;
  ownRows: GradeCountRow[];
  englandRows: GradeCountRow[];
  colour: string;
  // 0.6.2 S3: the set's grade rows (null while they load, or with no set), built on demand.
  schoolSetGrades?: () => FrameSetGrades | null;
  state: {
    compareFrom: number | null;
    changeFrom: number | null;
    // 0.6.3 S1: the selection is the page's band:range (one click a grade, a second widens);
    // `clickable` / `clickTitle` keep U / Fail / Unclassified from being range ends.
    highlight: {
      range: GradeRange | null;
      pending: string | null;
      onGradeClick: (grade: string) => void;
      clickable?: (grade: string) => boolean;
      clickTitle?: (grade: string) => string;
    };
  };
};

export type ViewFrame = SubjectsFrame | CandidatesFrame | ComparisonsFrame | GradesFrame;
// The frames with one value per period (every builder but the grades one reads these).
export type SeriesFrame = SubjectsFrame | CandidatesFrame | ComparisonsFrame;
