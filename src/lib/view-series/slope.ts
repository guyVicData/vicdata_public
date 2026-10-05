// VicData 0.6.1 S3b: the series builder for a slope -- each row's figure in two years, joined
// by a line. A new view type: no translated preset uses it yet; S4's editor offers it.
//
// The two years (1 · Data's `years`):
//   { latest }          the year Current shows and the row set's previous year with a figure
//   { from: "first" }   the panel's "From" year (the members' own, as every Trends view
//                       follows it), else the first year with a figure, to the latest
//   { from: <year> }    that year (where the span has it) to the latest
// The rows are the frame's own (the page's subjects or the set's schools), in the colours the
// Trends lines use; without `rows`, the focused subject (this school) alone. A row without a
// figure at both ends is left out: a slope needs both. `compare` adds a dashed line per
// series the frame can honestly supply ("follows-page" adds nothing: no host draws a slope).
// Every figure is the frame's own value at that year, unchanged.
import type { CompareSeries, ViewSpec } from "@/catalogue/viewspec";
import { ENTRIES_MEASURE, type Measure } from "@/lib/teacher-view-panels";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { basics as candidateBasics } from "./candidates";
import { onChangeHalf, resolveCompare } from "./compare";
import { compareLinesFor, type CompareLine } from "./compare-lines";
import type { SeriesFrame } from "./frames";
import type { SlopeRowData, ViewSeries } from "./series";
import { currentRows } from "./subjects";

type Line = { key: string; label: string; colour: string; values: (number | null)[]; emphasis: boolean; comparison?: boolean };

const OWN = "var(--accent,var(--fg))";
const OTHER = "var(--muted3)";

// S3c: the compare lines (compare-lines.ts: the catalogue's honest ones, in their own colours).
const asLines = (ls: CompareLine[]): Line[] => ls.map((l) => ({ key: l.key, label: l.label, colour: l.colour, values: l.values, emphasis: false, comparison: true }));

// The frame's rows and compare lines, its measure, the year Current shows, and the title's
// subject / scope words.
function linesOf(spec: ViewSpec, f: SeriesFrame, compare: CompareSeries[], allRows: boolean) {
  const explicit = spec.compare !== "follows-page";
  if (f.kind === "subjects") {
    if (f.subjects.length === 0) return null;
    const c = currentRows(f, !!f.benchmarkLabel);
    const rows: Line[] = c.barRows
      .filter((r) => allRows || r.s.key === c.focusedKey)
      .map((r) => ({ key: r.s.key, label: r.s.label, colour: c.trendColours.get(r.s.key) ?? c.colourFor(r.s), values: r.s.values, emphasis: r.s.key === c.focusedKey }));
    const extra = explicit ? asLines(compareLinesFor(f, compare, { focusedKey: c.focusedKey, span: true, as: ["line"] })) : [];
    const latest = f.state.latestIdx >= 0 ? f.periods[f.state.latestIdx] : null;
    return { lines: [...rows, ...extra], measure: f.measure, latest, name: allRows ? c.scope ?? c.scopeNoun : c.focusedSubject?.label ?? c.scopeNoun };
  }
  if (f.kind === "candidates") {
    if (f.subjects.length === 0) return null;
    const b = candidateBasics(f);
    const rows: Line[] = b.trendSubjectSeries
      .filter((s) => allRows || s.key === b.focused?.key)
      .map((s) => ({ ...s, emphasis: s.key === b.focused?.key }));
    const extra = explicit ? asLines(compareLinesFor(f, compare, { focusedKey: b.focused?.key ?? null, span: true, as: ["line"] })) : [];
    return { lines: [...rows, ...extra], measure: ENTRIES_MEASURE as Measure, latest: null, name: allRows ? b.inCategory ?? "Entries" : b.focused?.label ?? "Entries" };
  }
  if (f.blocked || f.schools.length === 0) return null;
  const rows: Line[] = f.schools
    .filter((s) => allRows || s.isTarget)
    .map((s) => ({ key: s.isTarget ? "own" : s.urn, label: s.isTarget ? f.targetName : s.name, colour: s.isTarget ? OWN : OTHER, values: s.values, emphasis: s.isTarget }));
  // One named school is already a row when every school is drawn.
  const extra = explicit ? asLines(compareLinesFor(f, compare, { focusedKey: "own", span: true, as: ["line"] }).filter((l) => !(allRows && l.kind === "chosenSchool"))) : [];
  return { lines: [...rows, ...extra], measure: f.measure, latest: null, name: allRows ? `Every school in the ${f.setLabel.toLowerCase()}: ${f.comparedOn}` : `This school’s ${f.comparedOn}` };
}

// The two years, as indexes into the frame's periods.
export function slopeYears(spec: ViewSpec, f: SeriesFrame, lines: Line[], latest: number | null): { from: number; to: number } | null {
  const has = (i: number) => lines.some((l) => !l.comparison && l.values[i] !== null);
  const real = f.periods.map((_, i) => i).filter(has);
  if (real.length < 2) return null;
  const toIdx = latest !== null && real.includes(f.periods.indexOf(latest)) ? f.periods.indexOf(latest) : real[real.length - 1];
  const before = real.filter((i) => i < toIdx);
  if (!before.length) return null;
  const years = spec.data.years;
  let fromIdx: number;
  if ("latest" in years) fromIdx = before[before.length - 1];
  else {
    const start = typeof years.from === "number" ? years.from : onChangeHalf(spec) ? f.state.changeStart : f.state.trendStart;
    const at = start === null ? -1 : f.periods.indexOf(start);
    fromIdx = at >= 0 && before.includes(at) ? at : before[0];
  }
  return { from: fromIdx, to: toIdx };
}

export function buildSlope(spec: ViewSpec, f: SeriesFrame): ViewSeries | null {
  if (spec.view.kind !== "slope") return null;
  const compare = resolveCompare(spec, f);
  const got = linesOf(spec, f, compare, !!spec.data.rows);
  if (!got) return null;
  const span = slopeYears(spec, f, got.lines, got.latest);
  if (!span) return null;
  const rows: SlopeRowData[] = got.lines.flatMap((l) => {
    const from = l.values[span.from];
    const to = l.values[span.to];
    if (from === null || from === undefined || to === null || to === undefined) return [];
    return [{ key: l.key, label: l.label, colour: l.colour, from, to, emphasis: l.emphasis, ...(l.comparison ? { comparison: true } : {}) }];
  });
  if (!rows.some((r) => !r.comparison)) return null;
  const fromYear = f.periods[span.from];
  const toYear = f.periods[span.to];
  return {
    kind: "slope",
    heading: null,
    title: `${got.name}: ${academicYearLabel(fromYear)} to ${academicYearLabel(toYear)}`,
    leaf: { leaf: "slope", from: fromYear, to: toYear, rows, measure: got.measure },
  };
}
