// VicData 0.6.1 S3d: Grade counts and the grade spread from their ViewSpecs -- each preset
// against hand-counted figures on the real 100053 GCSE / 117037 Post-16 grade rows (the
// subject's own and England's, src/lib/view-series.fixtures.json), the note states left to
// the host, the spread's looks never changing a figure, an explicit compare kept to what a
// grade has (England, the subject's earlier year), and the average grade.
// Run: npx -y tsx --test src/lib/view-series-grades.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { presetSpec, type CompareSeries, type SpreadLook, type ViewSpec } from "@/catalogue/viewspec";
import type { DataviewId } from "@/catalogue/types";
import { averageGrade, gradeCounts, type GradeCountRow, type GradeRow } from "@/lib/grade-spread";
import { bestScale, GCSE_SCALE, NON_GRADE_VALUES, type GradeRange } from "@/lib/subject-grades";
import { ENTRIES_MEASURE, measureById } from "@/lib/teacher-view-panels";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { buildSeries, type LeafSeries, type ViewSeries } from "./view-series";
import type { GradesFrame, SubjectsFrame } from "./view-series/frames";

type Raw = Record<string, unknown> & { name: string; kind: string; phase: "ks4" | "ks5"; periods: number[] };
const RAW = JSON.parse(readFileSync(new URL("./view-series.fixtures.json", import.meta.url), "utf8")) as Raw[];

const noop = () => {};
const HIGHLIGHT_CLICK = (grade: string) => void grade;

function gradesFrame(r: Raw, state: Partial<GradesFrame["state"]> = {}): GradesFrame {
  return {
    kind: "grades",
    phase: r.phase,
    subjectLabel: r.subjectLabel as string,
    ownRows: r.ownRows as GradeCountRow[],
    englandRows: r.englandRows as GradeCountRow[],
    colour: "#34d399",
    state: { compareFrom: null, changeFrom: null, highlight: { range: null, pending: null, onGradeClick: HIGHLIGHT_CLICK }, ...state },
  };
}

// Results on Grade bands (the subjects frame the Grades view reads), with or without a range.
function bandsFrame(r: Raw, withRange: boolean): SubjectsFrame {
  const g = r.gradeBand as { range: GradeRange | null; rangeLabel: string | null; ownRows: GradeCountRow[]; englandRows: GradeCountRow[] };
  const range = withRange && g.range ? { ...g.range, scale: bestScale([...g.range.scale]) } : null;
  const subjects = r.subjects as SubjectsFrame["subjects"];
  let latestIdx = -1;
  for (let i = r.periods.length - 1; i >= 0 && latestIdx < 0; i--) if (subjects.some((s) => s.values[i] !== null)) latestIdx = i;
  return {
    kind: "subjects",
    host: "teacher.c1.results",
    periods: r.periods,
    subjects,
    measure: measureById(r.phase, "bands"),
    focus: r.focus as string,
    groups: [],
    groupKind: "category",
    benchmarkKind: "england",
    benchmarkLabel: "National",
    rankedTable: false,
    rankedViews: false,
    spaciousBars: true,
    changeScope: "individual",
    theme: "dark",
    accentHex: null,
    currentBlocked: !range,
    hasGeography: false,
    phase: r.phase,
    gradeBand: { range, rangeLabel: range ? g.rangeLabel : null, ownRows: g.ownRows, englandRows: g.englandRows, colour: "#34d399", pending: null, onGradeClick: noop },
    state: { trendStart: null, changeStart: null, showFit: false, latestIdx, hiddenKeys: new Set(), sort: { key: "delta", dir: "desc" }, onSort: noop },
  };
}

const COUNTS = RAW.filter((r) => r.kind === "grades");
const BANDS = RAW.filter((r) => r.kind === "subjects" && r.measureId === "bands" && r.host === "teacher.c1.results");
const build = (spec: ViewSpec, f: GradesFrame | SubjectsFrame) => buildSeries(spec, f, { fullscreen: false });
const preset = (id: string) => presetSpec(id as DataviewId);
function spreadOf(s: ViewSeries | null): Extract<LeafSeries, { leaf: "gradeSpread" }> {
  assert.ok(s, "builds");
  assert.equal(s.leaf.leaf, "gradeSpread");
  return s.leaf as Extract<LeafSeries, { leaf: "gradeSpread" }>;
}

// ------------------------------------------------------------------ hand arithmetic

const graded = (rows: GradeCountRow[]) => rows.filter((r) => !NON_GRADE_VALUES.has(r.grade));
const yearsOf = (rows: GradeCountRow[]) => [...new Set(graded(rows).map((r) => r.period))].sort((a, b) => a - b);
const count = (rows: GradeCountRow[], p: number, g: string) => graded(rows).filter((r) => r.period === p && r.grade === g).reduce((a, r) => a + r.entries, 0);
const total = (rows: GradeCountRow[], p: number) => graded(rows).filter((r) => r.period === p).reduce((a, r) => a + r.entries, 0);

test("fixtures: four Grade counts frames from the real grade rows (England's where captured) and the bands frames", () => {
  assert.deepEqual(COUNTS.map((r) => r.name), ["100053/ks4 English Language results counts", "100053/ks4 History results counts", "117037/ks5 Mathematics results counts", "117037/ks5 History results counts"]);
  assert.ok(COUNTS.slice(0, 3).every((r) => (r.englandRows as unknown[]).length > 0));
  assert.equal((COUNTS[3].englandRows as unknown[]).length, 0, "117037 History: no England rows captured -- no ticks");
  assert.ok(BANDS.length >= 4);
});

// ----------------------------------------------------------------- Grade counts' Current

test("Grade counts' Current (DV-C1-CNT-CUR-DIST): each grade's count and share this year, England's share as the tick", () => {
  for (const r of COUNTS) {
    const f = gradesFrame(r);
    const s = build(preset("DV-C1-CNT-CUR-DIST"), f);
    const leaf = spreadOf(s);
    const latest = yearsOf(f.ownRows).at(-1)!;
    assert.equal(leaf.total, total(f.ownRows, latest), r.name);
    const engTotal = total(f.englandRows, latest);
    for (const row of leaf.rows) {
      assert.equal(row.ownCount, count(f.ownRows, latest, row.grade), `${r.name} ${row.grade}`);
      const eng = graded(f.englandRows).some((x) => x.period === latest && x.grade === row.grade);
      assert.equal(row.benchPct, eng ? (count(f.englandRows, latest, row.grade) / engTotal) * 100 : null, `${r.name} ${row.grade} England`);
      assert.equal(row.compareCount, undefined);
    }
    // Every graded grade the school or England has that year (and the school the year
    // before, as the host's order has it), once, best first.
    const before = yearsOf(f.ownRows).at(-2);
    const grades = new Set([...graded(f.ownRows).filter((x) => x.period === latest || x.period === before), ...graded(f.englandRows).filter((x) => x.period === latest)].map((x) => x.grade));
    assert.deepEqual(new Set(leaf.rows.map((x) => x.grade)), grades, r.name);
    assert.equal(leaf.benchLabel, engTotal > 0 ? `England, ${academicYearLabel(latest)}` : null, r.name);
    assert.equal(s!.title, null, "no title of its own (the tag names it)");
    assert.equal(leaf.centred, null, "its own scroll box");
    // The members' click-two-grades highlight is the host's state, passed through.
    assert.equal(leaf.onGradeClick, HIGHLIGHT_CLICK);
    const range = { scale: GCSE_SCALE, top: "9", bottom: "7" };
    const hl = spreadOf(build(preset("DV-C1-CNT-CUR-DIST"), gradesFrame(r, { highlight: { range, pending: "5", onGradeClick: HIGHLIGHT_CLICK } })));
    assert.equal(hl.range, range);
    assert.equal(hl.pending, "5");
    assert.deepEqual(hl.rows, leaf.rows, "a highlight changes no figure");
  }
});

test("Grade counts' Current matches the host's own arithmetic (gradeCounts, which GradeCountsPanels reads)", () => {
  for (const r of COUNTS) {
    const f = gradesFrame(r);
    const g = gradeCounts(f.ownRows, f.englandRows, { compareFrom: null, changeFrom: null });
    const leaf = spreadOf(build(preset("DV-C1-CNT-CUR-DIST"), f));
    assert.deepEqual(leaf.rows, g.rowsFor(false), r.name);
    assert.equal(leaf.benchLabel, g.englandLabel);
  }
});

// ------------------------------------------------------------- Spread by year

test("Spread by year (DV-C1-CNT-TR-SPREAD): this year against the members' earlier year, no England, named in the title", () => {
  for (const r of COUNTS) {
    const f = gradesFrame(r);
    const [first, latest] = yearsOf(f.ownRows);
    const s = build(preset("DV-C1-CNT-TR-SPREAD"), f);
    const leaf = spreadOf(s);
    assert.equal(leaf.compareTotal, total(f.ownRows, first), r.name);
    assert.equal(leaf.compareLabel, academicYearLabel(first));
    for (const row of leaf.rows) {
      assert.equal(row.ownCount, count(f.ownRows, latest, row.grade));
      assert.equal(row.compareCount, count(f.ownRows, first, row.grade));
      assert.equal(row.benchPct, null, "no England on the year-on-year view");
    }
    assert.equal(leaf.benchLabel, null);
    assert.equal(leaf.onGradeClick, undefined, "nothing to click");
    assert.equal(leaf.range, null);
    assert.deepEqual(s!.title, [f.subjectLabel, "’s spread of grades: ", academicYearLabel(latest), " against ", academicYearLabel(first), ", grade by grade"]);
    // The members' pick of a year not on offer falls back to the year before.
    assert.equal(spreadOf(build(preset("DV-C1-CNT-TR-SPREAD"), gradesFrame(r, { compareFrom: 1999 }))).compareLabel, academicYearLabel(first));
  }
});

// ------------------------------------------------------------- the change table

test("Grade counts' change table (DV-C1-CNT-TR-CHANGETABLE): each grade's count, first year to latest, in grade order", () => {
  for (const r of COUNTS) {
    const f = gradesFrame(r);
    const [first, latest] = yearsOf(f.ownRows);
    const s = build(preset("DV-C1-CNT-TR-CHANGETABLE"), f);
    assert.ok(s && s.leaf.leaf === "yearTable");
    const leaf = s.leaf as Extract<LeafSeries, { leaf: "yearTable" }>;
    assert.deepEqual(leaf.data.periods, [first, latest]);
    for (const row of leaf.data.series) assert.deepEqual(row.values, [count(f.ownRows, first, row.key), count(f.ownRows, latest, row.key)], `${r.name} ${row.key}`);
    assert.equal(leaf.measure, ENTRIES_MEASURE);
    assert.equal(leaf.nameHeading, "Grade");
    assert.equal(leaf.showRank, false);
    assert.equal(leaf.focusKey, null);
    assert.equal(leaf.centred, null, "no scroll box, as the host draws it");
    assert.deepEqual(s.title, [f.subjectLabel, "’s entries at each grade: ", academicYearLabel(first), " against ", academicYearLabel(latest), ", with the change"]);
    // The grade order is the spread's.
    assert.deepEqual(leaf.data.series.map((x) => x.key), spreadOf(build(preset("DV-C1-CNT-CUR-DIST"), f)).rows.map((x) => x.grade));
  }
});

test("note states stay the host's: no published grades; one year only (Spread by year, the change table)", () => {
  const r = COUNTS[0];
  const none = gradesFrame({ ...r, ownRows: [] });
  for (const id of ["DV-C1-CNT-CUR-DIST", "DV-C1-CNT-TR-SPREAD", "DV-C1-CNT-TR-CHANGETABLE"]) assert.equal(build(preset(id), none), null, id);
  const latest = yearsOf(r.ownRows as GradeCountRow[]).at(-1);
  const one = gradesFrame({ ...r, ownRows: (r.ownRows as GradeCountRow[]).filter((x) => x.period === latest) });
  assert.ok(build(preset("DV-C1-CNT-CUR-DIST"), one), "Current still draws on one year");
  assert.equal(build(preset("DV-C1-CNT-TR-SPREAD"), one), null);
  assert.equal(build(preset("DV-C1-CNT-TR-CHANGETABLE"), one), null);
  // Not a grade view: nothing for a grades frame to draw (the editor greys these on counts).
  assert.equal(build(preset("DV-C1-RES-CUR-BAR"), gradesFrame(r)), null);
});

// ------------------------------------------------------------- Results' Grades view

test("Results' Grades view (DV-C1-RES-CUR-GRADES): the year Current shows, England's ticks, the page's range -- with and without a range", () => {
  for (const r of BANDS) {
    for (const withRange of [true, false]) {
      const f = bandsFrame(r, withRange);
      const s = build(preset("DV-C1-RES-CUR-GRADES"), f);
      const gb = f.gradeBand!;
      const latest = f.periods[f.state.latestIdx];
      const own = total(gb.ownRows, latest);
      if (own === 0) {
        assert.equal(s, null, `${r.name}: the host's "no published grades" note`);
        continue;
      }
      const leaf = spreadOf(s);
      assert.equal(leaf.total, own, r.name);
      const engTotal = total(gb.englandRows!, latest);
      for (const row of leaf.rows) {
        assert.equal(row.ownCount, count(gb.ownRows, latest, row.grade));
        const eng = graded(gb.englandRows!).some((x) => x.period === latest && x.grade === row.grade);
        assert.equal(row.benchPct, eng ? (count(gb.englandRows!, latest, row.grade) / engTotal) * 100 : null);
      }
      assert.equal(leaf.range, gb.range, "the page's range (or none yet)");
      assert.equal(leaf.onGradeClick, gb.onGradeClick, "two clicks pick the page's range");
      assert.equal(leaf.benchLabel, gb.englandRows!.length ? `England, ${academicYearLabel(latest)}` : null);
      assert.equal(s!.title, null);
      assert.equal(s!.heading, null);
      assert.match(String(leaf.centred), /^grades:/);
      assert.equal(leaf.shade, undefined, "the page's range is the selection, not a shade");
    }
  }
});

// --------------------------------------------------------------------- the looks

const withLook = (id: string, look: Partial<SpreadLook>): ViewSpec => {
  const s = preset(id);
  if (s.view.kind !== "spread") throw new Error("not a spread");
  return { ...s, view: { kind: "spread", look: { ...s.view.look, ...look } } };
};

test("the spread's looks (% or counts, average grade, shaded band, values) never change a figure", () => {
  for (const r of COUNTS) {
    const f = gradesFrame(r);
    for (const id of ["DV-C1-CNT-CUR-DIST", "DV-C1-CNT-TR-SPREAD"]) {
      const base = spreadOf(build(preset(id), f));
      for (const look of [{ show: "counts" }, { average: "mean" }, { average: "median" }, { bands: { top: "9", bottom: "4" } }, { values: false }] as Partial<SpreadLook>[]) {
        const leaf = spreadOf(build(withLook(id, look), f));
        assert.deepEqual(leaf.rows, base.rows, `${r.name} ${id} ${JSON.stringify(look)}`);
        assert.equal(leaf.total, base.total);
        assert.equal(leaf.compareTotal, base.compareTotal);
        assert.equal(leaf.benchLabel, base.benchLabel);
      }
      // Off by default: the preset draws exactly as the host.
      for (const k of ["show", "average", "shade", "shadeLabel", "values"] as const) assert.equal(base[k], undefined, `${id} ${k}`);
    }
  }
});

test("looks: counts, the average marker, a shaded band (on the subject's own scale only), values off", () => {
  const gcse = gradesFrame(COUNTS[0]);
  const alevel = gradesFrame(COUNTS[2]);
  assert.equal(spreadOf(build(withLook("DV-C1-CNT-CUR-DIST", { show: "counts" }), gcse)).show, "counts");
  assert.equal(spreadOf(build(withLook("DV-C1-CNT-CUR-DIST", { values: false }), gcse)).values, false);
  const shaded = spreadOf(build(withLook("DV-C1-CNT-CUR-DIST", { bands: { top: "9", bottom: "4" } }), gcse));
  assert.equal(shaded.shade?.scale, GCSE_SCALE);
  assert.equal(shaded.shadeLabel, "Shaded: grades 4–9");
  assert.equal(spreadOf(build(withLook("DV-C1-CNT-CUR-DIST", { bands: { top: "9", bottom: "4" } }), alevel)).shade, undefined, "9-4 isn't on an A level's scale");
  const mean = spreadOf(build(withLook("DV-C1-CNT-CUR-DIST", { average: "mean" }), gcse));
  assert.deepEqual(mean.average, averageGrade(mean.rows, "mean"));
  // Bands with a range: "the page's band" shades it when the range isn't picked here.
  const f = bandsFrame(BANDS.find((r) => (r.gradeBand as { range: unknown }).range)!, true);
  const s = withLook("DV-C1-RES-CUR-GRADES", { memberSpan: undefined });
  const leaf = spreadOf(build(s, f));
  assert.equal(leaf.shade, f.gradeBand!.range);
  assert.equal(leaf.range, null);
  assert.equal(leaf.onGradeClick, undefined);
});

test("averageGrade: the mean grade on a numbered scale (U as 0), the mean position on a named one, the median entry's grade", () => {
  const rows = (pairs: [string, number][]): GradeRow[] => pairs.map(([grade, ownCount]) => ({ grade, ownCount, benchPct: null }));
  const gcse = rows([["9", 1], ["8", 0], ["7", 1], ["6", 2], ["5", 0], ["4", 0], ["U", 0]]);
  // (9 + 7 + 6 + 6) / 4 = 7
  assert.deepEqual(averageGrade(gcse, "mean"), { position: 2, label: "Mean grade 7.0", value: "7.0" });
  // 6.5 sits halfway between 7 (row 2) and 6 (row 3).
  assert.deepEqual(averageGrade(rows([["7", 1], ["6", 1]]), "mean"), { position: 0.5, label: "Mean grade 6.5", value: "6.5" });
  assert.equal(averageGrade(rows([["4", 1], ["U", 1]]), "mean")!.label, "Mean grade 2.0");
  // 5.3 sits 70% of the way from 6 (row 0) to 5 (row 1): proportionally, not at the boundary.
  const m53 = averageGrade(rows([["6", 3], ["5", 7]]), "mean")!;
  assert.equal(m53.value, "5.3");
  assert.ok(Math.abs(m53.position - 0.7) < 1e-9, String(m53.position));
  // A level: positions A*=0, A=1, B=2 -> (0 + 2*1 + 2) / 4 = 1, "≈ A".
  assert.deepEqual(averageGrade(rows([["A*", 1], ["A", 2], ["B", 1]]), "mean"), { position: 1, label: "Mean grade ≈ A", value: "≈ A" });
  assert.deepEqual(averageGrade(rows([["A*", 1], ["A", 2], ["B", 1]]), "median"), { position: 1, label: "Median grade A", value: "A" });
  assert.deepEqual(averageGrade(gcse, "median"), { position: 2, label: "Median grade 7", value: "7" });
  assert.equal(averageGrade(rows([["9", 0]]), "mean"), null);
  // Double Award pairs aren't numbers: the mean position, named.
  assert.match(averageGrade(rows([["99", 1], ["98", 1], ["88", 1]]), "mean")!.label, /≈ 98/);
});

// ----------------------------------------------------------- an explicit compare

const own = (id: string, compare: CompareSeries[]): ViewSpec => ({ ...preset(id), compare, preset: undefined });

test("a spread of its own: England's ticks only where asked, the earlier year where asked; LA / region / sets drop out (D7)", () => {
  const f = gradesFrame(COUNTS[0]);
  const ticks = spreadOf(build(preset("DV-C1-CNT-CUR-DIST"), f)).rows.map((r) => r.benchPct);
  const self = spreadOf(build(own("DV-C1-CNT-CUR-DIST", [{ kind: "self", colour: "accent" }]), f));
  assert.ok(self.rows.every((r) => r.benchPct === null));
  assert.equal(self.benchLabel, null);
  const eng = spreadOf(build(own("DV-C1-CNT-CUR-DIST", [{ kind: "self", colour: "accent" }, { kind: "england", colour: "fg", as: "marker" }]), f));
  assert.deepEqual(eng.rows.map((r) => r.benchPct), ticks);
  const areas = spreadOf(build(own("DV-C1-CNT-CUR-DIST", [{ kind: "self", colour: "accent" }, { kind: "la", colour: "palette:0" }, { kind: "nearest", colour: "muted", average: "mean" }]), f));
  assert.ok(areas.rows.every((r) => r.benchPct === null), "no LA or set figure per grade");
  const both = spreadOf(build(own("DV-C1-CNT-CUR-DIST", [{ kind: "self", colour: "accent" }, { kind: "england", colour: "fg" }, { kind: "self", colour: "muted", at: "earlier-year" }]), f));
  assert.deepEqual(both.rows.map((r) => r.benchPct), ticks);
  assert.ok(both.rows.every((r) => typeof r.compareCount === "number"));
  // Results' bands view, its own earlier year.
  const bf = bandsFrame(BANDS[0], true);
  const earlier = spreadOf(build(own("DV-C1-RES-CUR-GRADES", [{ kind: "self", colour: "accent" }, { kind: "self", colour: "muted", at: "earlier-year" }]), bf));
  const latest = bf.periods[bf.state.latestIdx];
  const before = Math.max(...bf.gradeBand!.ownRows.map((r) => r.period).filter((p) => p < latest));
  assert.equal(earlier.compareLabel, academicYearLabel(before));
  for (const row of earlier.rows) assert.equal(row.compareCount, count(bf.gradeBand!.ownRows, before, row.grade));
});

// ------------------------------------------------------------------- the renderer

test("the renderer draws them: the spread (GradeDistribution) and Grade counts' change table", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { renderView, viewKindRegistered } = await import("@/components/views");
  assert.ok(viewKindRegistered("spread"));
  const f = gradesFrame(COUNTS[0]);
  const html = renderToStaticMarkup(renderView(preset("DV-C1-CNT-CUR-DIST"), f, { fullscreen: false }) as React.ReactElement);
  assert.match(html, /aria-label="Grades"/);
  assert.match(html, /England, 2024\/25/);
  const avg = renderToStaticMarkup(renderView(withLook("DV-C1-CNT-CUR-DIST", { average: "mean" }), f, { fullscreen: false }) as React.ReactElement);
  assert.match(avg, /Mean grade \d\.\d/);
  assert.match(avg, /border-dashed/);
  const counts = renderToStaticMarkup(renderView(withLook("DV-C1-CNT-CUR-DIST", { show: "counts", values: true }), f, { fullscreen: false }) as React.ReactElement);
  assert.match(counts, /\d · \d+%/);
  const table = renderToStaticMarkup(renderView(preset("DV-C1-CNT-TR-CHANGETABLE"), f, { fullscreen: false }) as React.ReactElement);
  assert.match(table, /<table/);
  assert.ok(!/overflow-y-auto/.test(table.split("<table")[0]), "no scroll box around the change table");
});
