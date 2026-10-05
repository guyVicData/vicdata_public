// VicData 0.6.1 S4: the honest options -- what the Add a view / Edit view screens may offer
// for one measure, and why anything else is greyed (D7: "The honest options come from the
// catalogue, never from examples").
//
// Every answer is read from the catalogue: a measure's `geographies` (measures.ts) and the
// rules that narrow them (rules.ts) -- R-NO-GRADE-RATE-GEO, R-BANDS-ENGLAND-BENCH,
// R-GEO-POINTS-ELIGIBLE, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-KS5-ENGLAND-EXACT,
// R-INDEX-HEADCOUNTS, R-NUMBER-TYPE-HONESTY, R-DONUT-COUNTS-ONLY (shareApplies),
// R-MEASURE-FALLBACK, R-MIN-SCHOOLS. The prompt's D7 table, as data:
//
//   Measure          Self  Category / all / selected   LA / region / England               10 nearest / saved set
//   Points           yes   yes                         yes                                  yes
//   Grade 4+ / A*-E  yes   yes                         greyed (R-NO-GRADE-RATE-GEO)         Comparisons only (S3d)
//   Bands            yes   yes                         England only, latest year, 5 schools Comparisons only (S3d)
//   Counts           yes   no                          England ticks only                   none
//   Entries          yes   yes                         points-eligible / scored quals only  yes
//
// Pure (no React), so scripts and src/lib/view-editor.test.ts can pin it.
import { MEASURES } from "./measures";
import { measureFor } from "./pick";
import type { CompareSeriesKind, ViewKind, ViewPer, ViewRows, ViewShownAs, ViewSpec } from "./viewspec";
import type { Geography, GeographyAvailability, HostId, Measure, Phase, ResultsMeasure, RuleId } from "./types";
import { shareApplies } from "@/lib/teacher-view-measures";

// What is measured: Candidates' entries, or one of the four Results measures.
export type HonestMeasure = "entries" | ResultsMeasure;

export type HonestContext = {
  phase: Phase;
  measure: HonestMeasure;
  // The column host the view is drawn in. Comparisons (teacher.c3.comparisons) is the only
  // one with a set of other schools (D6); the rest are subject columns.
  host: HostId;
  // Grade bands with a range picked (the top bar's band choice). Absent = picked: the page
  // always draws bands on a range once one is chosen.
  hasBandRange?: boolean;
};

// One option's verdict. `ok: false` = greyed, with the reason; `note` = offered, with a
// caveat the screen shows beside it.
export type Honest = { ok: boolean; reason?: string; note?: string; rule?: RuleId };

const yes = (note?: string, rule?: RuleId): Honest => ({ ok: true, ...(note ? { note } : {}), ...(rule ? { rule } : {}) });
const no = (reason: string, rule?: RuleId): Honest => ({ ok: false, reason, ...(rule ? { rule } : {}) });

export const schoolSetHost = (host: HostId) => host === "teacher.c3.comparisons";

// The catalogue measure behind a context (MEASURES), never the whole-school headline.
export function catalogueMeasure(phase: Phase, measure: HonestMeasure): Measure {
  const m =
    measure === "entries"
      ? MEASURES.find((x) => x.data === "academic.candidates" && x.phase === phase)
      : measureFor({ data: "academic.results", phase, results: measure, focus: { kind: "subject" } });
  if (!m) throw new Error(`honest: no catalogue measure for ${phase} ${measure}`);
  return m;
}

export function measureWord(phase: Phase, measure: HonestMeasure): string {
  if (measure === "entries") return "Entries";
  if (measure === "points") return "Average points";
  if (measure === "threshold") return phase === "ks5" ? "A*–E rate" : "Grade 4+ rate";
  return measure === "bands" ? "Grade bands" : "Grade counts";
}

// ------------------------------------------------------------------------ compared with

// Where each compare kind's figure comes from, in the catalogue's geography words.
export const GEOGRAPHY_OF: Record<CompareSeriesKind, Geography> = {
  self: "school",
  category: "subject_area",
  allSubjects: "subject_area",
  selectedSubjects: "subject_area",
  la: "la",
  region: "region",
  england: "england",
  nearest: "set",
  savedSet: "set",
  chosenSchool: "set",
  otherSubject: "school",
};

const geography = (m: Measure, g: Geography): GeographyAvailability => m.geographies[g];

// One compare kind for a measure. `span`: the view runs over several years (a line, a
// change) rather than the latest year alone.
export function compareHonest(ctx: HonestContext, kind: CompareSeriesKind, opts: { span?: boolean } = {}): Honest {
  const m = catalogueMeasure(ctx.phase, ctx.measure);
  const ks5 = ctx.phase === "ks5";
  const word = measureWord(ctx.phase, ctx.measure);
  const set = schoolSetHost(ctx.host);
  if (kind === "self") return yes();
  // Not in the ViewSpec yet: CompareSeries carries no school or subject to name.
  if (kind === "chosenSchool") return no("Choosing one named school isn't in a view's settings yet.");
  if (kind === "otherSubject") return no("Another subject's line isn't in a view's settings yet.");

  const geo = geography(m, GEOGRAPHY_OF[kind]);
  switch (GEOGRAPHY_OF[kind]) {
    case "subject_area": {
      if (set) return no("Comparisons compares schools: a subject group belongs to a subject column.");
      if (!geo.ok) return no(`${word}: ${geo.reason ?? "no group figure"}.`);
      if (ks5) {
        if (kind === "allSubjects" && ctx.measure === "points")
          return yes("Keeps to the subject's qualification family: points sit on a different scale per family.", "R-QUAL-FAMILY-MATCH");
        return yes("AS and AEA are left out of the group (never out of the subject's own figure).", "R-KS5-ASAEA-EXCL");
      }
      return yes();
    }
    case "la":
    case "region":
    case "england": {
      const place = kind === "la" ? "LA" : kind === "region" ? "Region" : "England";
      if (ctx.measure === "threshold") return no(`No LA, region or England figure is wired for the ${word.replace(/ rate$/, " rate")}.`, "R-NO-GRADE-RATE-GEO");
      if (ctx.measure === "bands") {
        if (kind !== "england") return no(`Grade bands are benchmarked against England only: no ${place === "LA" ? "LA" : "region"} figure.`, "R-BANDS-ENGLAND-BENCH");
        if (opts.span) return no("England's band share is for the latest year only.", "R-BANDS-ENGLAND-BENCH");
        return yes("For the focused subject, latest year; each grade needs 5 schools.", "R-BANDS-ENGLAND-BENCH");
      }
      if (ctx.measure === "counts") {
        if (kind !== "england") return no(`Grade counts carry England's share ticks only: no ${place === "LA" ? "LA" : "region"} figure.`);
        return yes("Drawn as England's share ticks on each grade; each grade needs 5 schools.", "R-MIN-SCHOOLS");
      }
      if (!geo.ok) return no(`${word}: ${geo.reason ?? "no area figure"}.`);
      if (ctx.measure === "entries")
        return ks5 ? yes("Scored qualifications only, per exact qualification.", "R-GEO-POINTS-ELIGIBLE") : yes("Points-eligible entries only (GCSE 9–1 Full Course).", "R-GEO-POINTS-ELIGIBLE");
      if (ks5 && kind === "england") return yes("The exact qualification's figure, or none.", "R-KS5-ENGLAND-EXACT");
      return yes(kind === "england" ? undefined : "Areas with fewer than 5 schools have no figure.", kind === "england" ? undefined : "R-MIN-SCHOOLS");
    }
    case "set": {
      if (!geo.ok) return no(ctx.measure === "counts" ? "No comparator grade counts: other schools are compared on points." : `${word}: ${geo.reason ?? "no set figure"}.`, ctx.measure === "counts" ? "R-MEASURE-FALLBACK" : undefined);
      // S3d: a school's Grade 4+ / band rate is scored from its own grade counts
      // (R-COMPARATOR-RATE-PER-QUAL), and the page loads the other schools' only in
      // Comparisons -- a subject column has no such figure to average or draw.
      if (!set && (ctx.measure === "threshold" || ctx.measure === "bands"))
        return no("Needs the other schools' grade counts, which are only loaded in Comparisons.", "R-COMPARATOR-RATE-PER-QUAL");
      return yes();
    }
    default:
      return yes();
  }
}

// The lines a subject column offers to add (AddView1's "+ Add a place or a school"), in the
// board's order. Averages of subjects (all / selected) are offered by "Add an average".
export const LINE_KINDS: CompareSeriesKind[] = ["category", "la", "region", "england", "chosenSchool", "otherSubject"];

// "Add an average": At this school (a group of subjects) / Across schools (a set).
export const AVERAGE_AT_SCHOOL: CompareSeriesKind[] = ["allSubjects", "selectedSubjects", "category"];
export const AVERAGE_ACROSS_SCHOOLS: CompareSeriesKind[] = ["nearest", "savedSet"];

export function averageHow(ctx: HonestContext, how: "mean" | "median" | "weighted"): Honest {
  if (how !== "weighted") return yes();
  if (ctx.measure === "entries" || ctx.measure === "counts") return no("Entries are already totals: there is nothing to weight them by.");
  return yes();
}

// --------------------------------------------------------------------------- the numbers

export function perHonest(ctx: HonestContext, per: ViewPer): Honest {
  const set = schoolSetHost(ctx.host);
  switch (per) {
    case "year":
      if (ctx.measure === "counts") return no("Grade counts are one value per grade: a year has no single number. Use Grade 4+ or bands for a trend.");
      return yes();
    case "subject":
      if (set) return no("Comparisons compares schools: one value per subject belongs to a subject column.");
      if (ctx.measure === "counts") return no("Grade counts are per subject: a group of subjects has no single grade scale.");
      return yes();
    case "grade":
      if (ctx.measure === "entries") return no("Candidates counts entries, not grades: grades come from Results.");
      if (set) return no("Grades are per school and subject: one value per grade belongs to a subject column.", "R-MEASURE-FALLBACK");
      return yes("School grade rows cover 2023/24 and 2024/25 only.");
    case "school":
      if (!set) return no("Needs a set of other schools: a Comparisons column.");
      if (ctx.measure === "counts") return no("No comparator grade counts: other schools are compared on points.", "R-MEASURE-FALLBACK");
      return yes();
  }
}

// The words for "change" on this measure (R-NUMBER-TYPE-HONESTY: points on a mean, percentage
// points on a rate, % on a count).
export function changeLabel(measure: HonestMeasure): string {
  if (measure === "points") return "Change in points";
  if (measure === "threshold" || measure === "bands") return "Change in percentage points";
  return "% change";
}

export function shownAsHonest(ctx: HonestContext, shownAs: ViewShownAs, per: ViewPer): Honest {
  if (shownAs === "actual") return yes();
  if (shownAs === "indexed") {
    if (ctx.measure !== "entries") return no("Indexed (100 = the first year) is for counts of entries only.", "R-INDEX-HEADCOUNTS");
    if (per !== "year") return no("Indexed needs one value per year.");
    return yes();
  }
  if (per === "grade" && ctx.measure !== "counts") return no("A grade's share changes in percentage points: set the measure to Grade counts.");
  return yes();
}

// The change kind a measure must NOT be shown in, drawn greyed beside the honest one (the
// board's dashed "% change" on points).
export function dishonestChange(measure: HonestMeasure): { label: string; reason: string } | null {
  if (measure === "entries" || measure === "counts") return null;
  return { label: "% change", reason: `A ${measure === "points" ? "mean" : "rate"} changes in ${measure === "points" ? "points" : "percentage points"}, never in %.` };
}

// The rows one value per subject / year draws, per host: what the host's frame supplies.
// (Results' frame carries the subject's category; Context's the page's Compare against
// group; Comparisons draws schools.)
export function rowsOptions(host: HostId): { rows: ViewRows | null; label: string }[] {
  if (host === "teacher.c2.context") return [{ rows: null, label: "This subject" }, { rows: "follows-page", label: "Follows the page" }];
  if (host === "teacher.c3.comparisons") return [];
  return [{ rows: null, label: "This subject" }, { rows: "category", label: "Its category" }];
}

// ---------------------------------------------------------------------------- the view

export const VIEW_KINDS: ViewKind[] = ["line", "bar", "table", "ranking", "numbers", "spread", "slope", "donut", "map"];

export const VIEW_LABEL: Record<ViewKind, string> = {
  line: "Line graph",
  bar: "Bar chart",
  table: "Table",
  ranking: "Ranking",
  numbers: "Numbers",
  spread: "Grade spread",
  slope: "Slope",
  donut: "Donut",
  map: "Map",
};

// Whether a View can draw this data at all. A View never changes a figure, so one that
// would need different numbers is greyed and points back to 1 · Data.
export function viewHonest(ctx: HonestContext, kind: ViewKind, data: Pick<ViewSpec["data"], "per" | "years" | "rows">): Honest {
  const per = data.per;
  const span = "from" in data.years;
  switch (kind) {
    case "line":
      return per === "year" ? yes() : no("A line needs one value per year: set One value per to Year in 1 · Data.");
    case "bar":
    case "table":
    case "numbers":
      return yes();
    case "ranking":
      return per === "subject" || per === "school" ? yes() : no("Ranks subjects or schools: set One value per to Subject or School in 1 · Data.");
    case "spread":
      return per === "grade" ? yes() : no("Grade spread needs one value per grade (1 · Data).");
    case "slope":
      return span ? yes() : no("Slope joins a first year to the latest: pick a first year in 1 · Data.");
    case "donut":
      if (!shareApplies(ctx.measure === "entries" ? "entries" : ctx.measure, ctx.hasBandRange ?? true)) return no("Share of entries: counts only (entries, or grade bands with a range).", "R-DONUT-COUNTS-ONLY");
      return per === "subject" ? yes() : no("A donut needs a group of subjects: one value per subject (1 · Data).", "R-DONUT-COUNTS-ONLY");
    case "map":
      return schoolSetHost(ctx.host) && per === "school" ? yes() : no("Needs a set of other schools: a Comparisons column.");
  }
}

// ----------------------------------------------------------------- 3 · Show this view for

export type ShowFor = { measure: ResultsMeasure; label: string } & Honest;

// Which host draws a view of this column on one Results measure: Column 1's Results draw
// Grade counts through their own panels (teacher.c1.counts); every other host draws all
// four (Context and Comparisons fall back to points on counts, R-MEASURE-FALLBACK).
export function hostOnMeasure(columnHost: HostId, measure: ResultsMeasure): HostId {
  if (columnHost === "teacher.c1.results" || columnHost === "teacher.c1.counts") return measure === "counts" ? "teacher.c1.counts" : "teacher.c1.results";
  return columnHost;
}

const COUNTS_KIND_REASON: Partial<Record<ViewKind, string>> = {
  line: "A line needs one number a year. Use Grade spread instead.",
  bar: "Grade counts are drawn per grade: use Grade spread instead.",
  table: "Grade counts draw their own grade-by-grade table.",
  ranking: "Grade counts have no ranking: other schools are compared on points.",
  numbers: "Grade counts have no number tiles.",
};

// Each Results measure, for a spec drawn by `presetHost` (the host of the instance's
// preset): greyed where the view can't honestly be drawn on it, with the reason; on the
// others a note of what it draws there (lines the measure has no figure for drop out).
export function showForOptions(spec: ViewSpec, base: Omit<HonestContext, "measure">, presetHost: HostId, presetMeasures: ResultsMeasure[]): ShowFor[] {
  const all: ResultsMeasure[] = ["points", "threshold", "bands", "counts"];
  return all.map((m) => {
    const label = measureWord(base.phase, m);
    // Context and Comparisons draw Grade counts as points (R-MEASURE-FALLBACK).
    const fallback = (base.host === "teacher.c2.context" || base.host === "teacher.c3.comparisons") && m === "counts";
    const ctx: HonestContext = { ...base, measure: fallback ? "points" : m };
    const host = hostOnMeasure(base.host, m);
    if (host !== presetHost) {
      if (m === "counts") return { measure: m, label, ...no(COUNTS_KIND_REASON[spec.view.kind] ?? "Grade counts are drawn by their own panels.") };
      return { measure: m, label, ...no(`${label} isn't drawn by Grade counts' panels: this view is made for Grade counts.`) };
    }
    if (!presetMeasures.includes(m)) return { measure: m, label, ...no(`This view can't be drawn on ${label}.`) };
    for (const verdict of [perHonest(ctx, spec.data.per), shownAsHonest(ctx, spec.data.shownAs, spec.data.per), viewHonest(ctx, spec.view.kind, spec.data)]) if (!verdict.ok) return { measure: m, label, ...verdict };
    if (fallback) return { measure: m, label, ...yes("Falls back to Average points here.", "R-MEASURE-FALLBACK") };
    // The "against the wider system" views (LA, region, England) follow the page, which
    // shows them only on Average points: on any other Results measure the panel draws the
    // not-applicable note (resultsGeographyApplies), so they can't honestly be ticked there.
    if (spec.compare === "follows-page" && /^DV-C1-RES-TR-GEO-/.test(spec.preset ?? "") && m !== "points") {
      return { measure: m, label, ...no(`LA, regional and national figures are published for average points only, not ${label.toLowerCase()}.`, "R-NO-GRADE-RATE-GEO") };
    }
    if (spec.compare === "follows-page") return { measure: m, label, ...yes("Follows the page") };
    const span = "from" in spec.data.years;
    const lines = spec.compare.filter((c) => !c.average);
    const dropped = spec.compare.filter((c) => !compareHonest(ctx, c.kind, { span }).ok);
    if (dropped.length) {
      const kept = spec.compare.filter((c) => !dropped.includes(c));
      return { measure: m, label, ...yes(`${kept.map((c) => SHORT_KIND[c.kind]).join(" + ")} only: ${dropped.map((c) => SHORT_KIND[c.kind]).join(" & ")} ${dropped.length === 1 ? "isn't" : "aren't"} published for ${label.toLowerCase()}`) };
    }
    const n = lines.length;
    // Rows drawn as their own lines (each subject in the group) come before the comparisons.
    if (spec.data.rows && spec.data.per === "year") return { measure: m, label, ...yes(n <= 1 ? "Every subject in the group" : `Every subject in the group + ${lines.filter((c) => c.kind !== "self").map((c) => SHORT_KIND[c.kind]).join(" + ")}`) };
    return { measure: m, label, ...yes(n <= 1 ? "This school only" : `All ${NUMBER_WORD[n] ?? n} lines`) };
  });
}

const NUMBER_WORD: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };

export const SHORT_KIND: Record<CompareSeriesKind, string> = {
  self: "School",
  category: "category",
  allSubjects: "all subjects",
  selectedSubjects: "selected subjects",
  la: "LA",
  region: "region",
  england: "England",
  nearest: "10 nearest",
  savedSet: "saved set",
  chosenSchool: "a chosen school",
  otherSubject: "another subject",
};
