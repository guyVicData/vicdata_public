// VicData 0.6.1 S3: the series builder (src/lib/view-series) on real payloads -- every line,
// table and bar preset produces the numbers its host draws, "History, this school only"
// draws as D8 says, and the look options change the picture, never a figure.
// Fixtures: src/lib/view-series.fixtures.json (scripts/view-series-fixtures.ts, from the
// lift round's captured dashboards for 100053 GCSE and 117037 Post-16).
// Run: npx -y tsx --test src/lib/view-series.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { presetSpec, type ViewSpec } from "@/catalogue/viewspec";
import type { DataviewId } from "@/catalogue/types";
import { DATAVIEWS } from "@/catalogue/dataviews";
import { ENTRIES_MEASURE, formatChange, measureById, trendChartKind, type Measure, type MeasureId, type PanelData } from "@/lib/teacher-view-panels";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { bestScale, NON_GRADE_VALUES } from "@/lib/subject-grades";
import { buildSeries, type LeafSeries, type ViewFrame, type ViewSeries } from "./view-series";
import { resolveCompare } from "./view-series/compare";
import type { CandidatesFrame, ComparisonsFrame, SubjectsFrame } from "./view-series/frames";
import { averageOfShown, medianOf, orderRows, topTen, weightedMeanOf } from "./view-series/looks";

type Raw = Record<string, unknown> & { name: string; kind: string; phase: "ks4" | "ks5"; measureId?: MeasureId; periods: number[] };
const RAW = JSON.parse(readFileSync(new URL("./view-series.fixtures.json", import.meta.url), "utf8")) as Raw[];

const measureOf = (r: Raw): Measure => {
  if (!r.measureId || r.measureId === "entries") return ENTRIES_MEASURE;
  const m = measureById(r.phase, r.measureId);
  return r.bandLabel ? { ...m, noun: `share of entries at ${String(r.bandLabel).toLowerCase()}` } : m;
};
const latestIdxOf = (periods: number[], values: (number | null)[][]) => {
  for (let i = periods.length - 1; i >= 0; i--) if (values.some((v) => v[i] !== null)) return i;
  return -1;
};

function gradeBandOf(g: NonNullable<SubjectsFrame["gradeBand"]>): NonNullable<SubjectsFrame["gradeBand"]> {
  return g.range ? { ...g, range: { ...g.range, scale: bestScale([...g.range.scale]) } } : g;
}

function frameOf(r: Raw): ViewFrame {
  if (r.kind === "subjects") {
    const subjects = r.subjects as SubjectsFrame["subjects"];
    const ranked = r.host === "teacher.c2.context";
    return {
      kind: "subjects",
      host: r.host as SubjectsFrame["host"],
      periods: r.periods,
      subjects,
      measure: measureOf(r),
      focus: r.focus as string,
      groups: r.groups as SubjectsFrame["groups"],
      groupKind: r.groupKind as SubjectsFrame["groupKind"],
      benchmarkKind: (r.benchmarkKind ?? null) as SubjectsFrame["benchmarkKind"],
      benchmarkLabel: r.benchmarkLabel as string | undefined,
      deltaHeading: r.deltaHeading as string | undefined,
      rankedTable: ranked,
      rankedViews: ranked,
      spaciousBars: !ranked,
      categoryLabel: ranked ? undefined : (r.categoryLabel as string),
      compareAgainstLabel: r.compareAgainstLabel as string | undefined,
      changeScope: "individual",
      cardTrend: r.cardTrend as "focusVsGroup" | undefined,
      theme: "dark",
      accentHex: null,
      currentBlocked: !!r.currentBlocked,
      hasGeography: false,
      tiles: !ranked,
      // The range's scale is one of subject-grades' own scales (bandRate compares by identity).
      gradeBand: r.gradeBand ? gradeBandOf(r.gradeBand as NonNullable<SubjectsFrame["gradeBand"]>) : null,
      schoolName: "Test School",
      state: {
        trendStart: null,
        changeStart: null,
        showFit: false,
        latestIdx: latestIdxOf(r.periods, subjects.map((s) => s.values)),
        hiddenKeys: new Set(),
        sort: ranked ? { key: "value", dir: "desc" } : { key: "delta", dir: "desc" },
        onSort: () => {},
      },
    };
  }
  if (r.kind === "candidates") {
    return {
      kind: "candidates",
      periods: r.periods,
      subjects: r.subjects as CandidatesFrame["subjects"],
      focus: r.focus as string,
      groupLabel: r.groupLabel as string,
      categoryLabel: r.categoryLabel as string,
      theme: "dark",
      accentHex: null,
      hasGeography: false,
      schoolSubjects: r.schoolSubjects as CandidatesFrame["schoolSubjects"],
      schoolName: "Test School",
      state: { trendStart: null, changeStart: null, showFit: false },
    };
  }
  const measure = measureOf(r);
  const on = `${r.subjectLabel} ${measure.id === "entries" ? "entries" : measure.label.toLowerCase()}`;
  return {
    kind: "comparisons",
    periods: r.periods,
    schools: r.schools as ComparisonsFrame["schools"],
    measure,
    targetName: r.targetName as string,
    setLabel: r.setLabel as string,
    comparedOn: on,
    titleOn: on,
    versus: { urn: "average", label: `Average across ${String(r.setLabel).toLowerCase()}` },
    onRankingMeasure: false,
    ranking: null,
    setKind: "nearest",
    subjectLabel: r.subjectLabel as string,
    blocked: false,
    state: { trendStart: null, changeStart: null, showFit: false },
  };
}

const FRAMES = RAW.map((r) => ({ raw: r, frame: frameOf(r) }));
const ofHost = (pred: (r: Raw) => boolean) => FRAMES.filter((x) => pred(x.raw));
const build = (preset: string, frame: ViewFrame, fullscreen = false) => buildSeries(presetSpec(preset as DataviewId), frame, { fullscreen });
function leafOf<K extends LeafSeries["leaf"]>(s: ViewSeries | null, leaf: K): Extract<LeafSeries, { leaf: K }> {
  assert.ok(s, "builds");
  assert.equal(s.leaf.leaf, leaf);
  return s.leaf as Extract<LeafSeries, { leaf: K }>;
}

// ------------------------------------------------------------------ hand arithmetic

const real = (vs: (number | null)[]) => vs.filter((v): v is number => v !== null);
const mean = (vs: (number | null)[]) => (real(vs).length ? real(vs).reduce((a, b) => a + b, 0) / real(vs).length : null);
// The periods from the first to the last with any figure among `values`.
function trimmed(periods: number[], values: (number | null)[][]): number[] {
  const idx = periods.map((_, i) => i).filter((i) => values.some((v) => v[i] !== null));
  return idx.length ? periods.slice(idx[0], idx[idx.length - 1] + 1) : [];
}
const slice = (periods: number[], keep: number[], values: (number | null)[]) => keep.map((p) => values[periods.indexOf(p)] ?? null);
// The honest change (R-NUMBER-TYPE-HONESTY), first to last real figure.
function honest(m: Measure, vs: (number | null)[]): number | null {
  const r = real(vs);
  if (r.length < 2) return null;
  if (m.changeKind === "percent") return r[0] === 0 ? null : ((r[r.length - 1] - r[0]) / r[0]) * 100;
  return r[r.length - 1] - r[0];
}
const close = (a: number | null | undefined, b: number | null | undefined, msg?: string) =>
  a === null || a === undefined || b === null || b === undefined ? assert.equal(a ?? null, b ?? null, msg) : assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

// ------------------------------------------------------------------ the presets

const LTB = DATAVIEWS.filter((d) => ["line", "table", "bar"].includes(presetSpec(d.id).view.kind)).map((d) => d.id);

test("every line / table / bar preset is covered below (or left to its host)", () => {
  const covered = new Set([
    "DV-C1-RES-CUR-BAR", "DV-C1-RES-CUR-TABLE", "DV-C1-RES-TR-CHART", "DV-C1-RES-TR-TABLE",
    "DV-C2-CUR-BARS", "DV-C2-CUR-TABLE", "DV-C2-TR-INDEXED", "DV-C2-TR-ACTUAL", "DV-C2-TR-CHART", "DV-C2-TR-TABLE", "DV-C2-TR-CHANGELIST", "DV-C2-TR-CHANGETABLE",
    "DV-C1-CAND-TR-INDEXED", "DV-C1-CAND-TR-ACTUAL", "DV-C1-CAND-TR-TABLE", "DV-C1-CAND-TR-CHANGELIST", "DV-C1-CAND-TR-CHANGETABLE",
    "DV-C3-CUR-BAR", "DV-C3-TR-CHART", "DV-C3-TR-TABLE", "DV-C3-TR-CHANGELIST", "DV-C3-TR-CHANGETABLE",
  ]);
  // Host-drawn in this part: the geography views (their own fetch) and Grade counts' table.
  const hosts = new Set(["DV-C1-CAND-TR-GEO-CHART", "DV-C1-CAND-TR-GEO-TABLE", "DV-C1-RES-TR-GEO-CHART", "DV-C1-RES-TR-GEO-TABLE", "DV-C1-CNT-TR-CHANGETABLE"]);
  for (const id of LTB) assert.ok(covered.has(id) || hosts.has(id), id);
  for (const id of hosts) for (const { frame } of FRAMES) assert.equal(id === "DV-C1-CNT-TR-CHANGETABLE" ? null : build(id, frame), null, `${id} stays with its host`);
});

test("Results' Current bars: each subject's figure that year, largest first, England's marker on points", () => {
  for (const { raw, frame } of ofHost((r) => r.host === "teacher.c1.results" && !r.currentBlocked)) {
    const f = frame as SubjectsFrame;
    const leaf = leafOf(build("DV-C1-RES-CUR-BAR", f), "rowBars");
    const i = f.state.latestIdx;
    const want = [...f.subjects].sort((a, b) => (b.values[i] ?? -Infinity) - (a.values[i] ?? -Infinity));
    assert.deepEqual(leaf.rows.map((r) => r.label), want.map((s) => s.label), raw.name);
    assert.deepEqual(leaf.rows.map((r) => r.value), want.map((s) => s.values[i]), raw.name);
    for (const [k, r] of leaf.rows.entries()) assert.equal(r.marker ?? null, raw.measureId === "threshold" ? null : want[k].benchmark?.[i] ?? null, raw.name);
    assert.equal(leaf.markerLabel, raw.measureId === "threshold" ? undefined : "National average");
    assert.deepEqual(leaf.rows.filter((r) => r.emphasis).map((r) => r.label), [f.subjects.find((s) => s.key === f.focus)!.label]);
    assert.equal(leaf.spacious, true);
  }
});

test("Results' Current table: against England, else the subject's own previous year (R-PREV-YEAR-FALLBACK)", () => {
  for (const { raw, frame } of ofHost((r) => r.host === "teacher.c1.results" && !r.currentBlocked)) {
    const f = frame as SubjectsFrame;
    const leaf = leafOf(build("DV-C1-RES-CUR-TABLE", f), "sortTable");
    const i = f.state.latestIdx;
    for (const s of f.subjects) {
      const row = leaf.rows.find((r) => r.key === s.key)!;
      const v = s.values[i];
      let against: number | null;
      if (raw.measureId === "threshold") {
        against = null;
        for (let j = i - 1; j >= 0; j--) if (s.values[j] !== null) { against = s.values[j]; break; }
      } else against = s.benchmark?.[i] ?? null;
      close(row.delta, v !== null && against !== null ? v - against : null, raw.name);
    }
    assert.equal(leaf.columns.delta, raw.measureId === "threshold" ? "vs last year" : "vs National");
    assert.equal(leaf.leadingRank, false);
    assert.equal(leaf.showValue, true);
    assert.ok(leaf.hostSort, "the member's sort is the host's");
  }
});

test("Context's Current bars and table: the group's subjects, each read against the group's per-subject average", () => {
  for (const { raw, frame } of ofHost((r) => r.host === "teacher.c2.context")) {
    const f = frame as SubjectsFrame;
    const i = f.state.latestIdx;
    const bars = leafOf(build("DV-C2-CUR-BARS", f), "verticalBars");
    assert.deepEqual(bars.bars.map((b) => b.value), real(f.subjects.map((s) => s.values[i])).sort((a, b) => b - a).concat(f.subjects.filter((s) => s.values[i] === null).map(() => null as never)), raw.name);
    const table = leafOf(build("DV-C2-CUR-TABLE", f), "sortTable");
    const avg = f.groups[0].values[i];
    for (const s of f.subjects) close(table.rows.find((r) => r.key === s.key)!.delta, s.values[i] !== null && avg !== null ? s.values[i]! - avg : null, raw.name);
    assert.equal(table.columns.delta, "vs average");
    assert.equal(table.leadingRank, true);
    assert.equal(table.showValue, false);
    assert.equal(build("DV-C2-CUR-TABLE", f)!.title, `${raw.measureId === "entries" ? "Entries" : "Results"} by subject in ${raw.compareAgainstLabel}`);
  }
});

// The year-by-year figures every Trends view reads: each row's values over the trimmed span.
function assertSeries(data: PanelData, periods: number[], rows: { key: string; values: (number | null)[] }[], name: string) {
  const span = trimmed(periods, rows.map((r) => r.values));
  assert.deepEqual(data.periods, span, name);
  for (const r of rows) assert.deepEqual(data.series.find((s) => s.key === r.key)?.values, slice(periods, span, r.values), `${name} ${r.key}`);
}

test("Trends lines and tables (Results, Context): every subject's own line, over the real span", () => {
  for (const { raw, frame } of ofHost((r) => r.kind === "subjects")) {
    const f = frame as SubjectsFrame;
    const results = f.host === "teacher.c1.results";
    const chartIds = results ? ["DV-C1-RES-TR-CHART"] : raw.measureId === "entries" ? ["DV-C2-TR-INDEXED", "DV-C2-TR-ACTUAL"] : ["DV-C2-TR-CHART"];
    for (const id of chartIds) {
      const s = build(id, f, true)!;
      const leaf = leafOf(s, "multiTrend");
      assertSeries(leaf.data, f.periods, f.subjects, `${raw.name} ${id}`);
      // Indexed on a headcount (the measure's own rule); Actual says so; points are real.
      assert.equal(leaf.index, id === "DV-C2-TR-ACTUAL" ? false : undefined, id);
      const hasLine = trendChartKind(leaf.data) === "line";
      assert.deepEqual(leaf.scaleTitle?.view ?? null, raw.measureId === "entries" && hasLine ? (id === "DV-C2-TR-ACTUAL" ? "actual" : "indexed") : null, id);
    }
    const table = leafOf(build(results ? "DV-C1-RES-TR-TABLE" : "DV-C2-TR-TABLE", f), "yearTable");
    assertSeries(table.data, f.periods, f.subjects, raw.name);
    assert.equal(table.focusKey, f.focus);
  }
});

test("Context on All subjects: the card is the focused subject against the group's average; fullscreen every line", () => {
  for (const { raw, frame } of ofHost((r) => r.host === "teacher.c2.context" && r.cardTrend === "focusVsGroup")) {
    const f = frame as SubjectsFrame;
    const id = raw.measureId === "entries" ? "DV-C2-TR-INDEXED" : "DV-C2-TR-CHART";
    const card = leafOf(build(id, f, false), "multiTrend");
    assert.deepEqual(card.data.series.map((s) => s.key), [f.focus, "group-0"], raw.name);
    assert.ok(card.data.series[1].comparison);
    const full = leafOf(build(id, f, true), "multiTrend");
    assert.equal(full.data.series.length, f.subjects.length);
    assert.equal(full.seriesLegend, false, "fullscreen's rail lists the lines");
  }
});

test("Context's ranked change and change table: each subject's honest change, the group's as the reference line", () => {
  for (const { raw, frame } of ofHost((r) => r.host === "teacher.c2.context")) {
    const f = frame as SubjectsFrame;
    const span = trimmed(f.periods, [...f.subjects.map((s) => s.values), f.groups[0].values]);
    const list = leafOf(build("DV-C2-TR-CHANGELIST", f), "changeList");
    for (const s of f.subjects) close(list.rows.find((r) => r.key === s.key)!.value, honest(f.measure, slice(f.periods, span, s.values)), raw.name);
    close(list.group?.value, honest(f.measure, slice(f.periods, span, f.groups[0].values)), `${raw.name} group`);
    assert.equal(list.group?.label, f.groups[0].label);
    assert.equal(list.format, f.measure.changeKind === "percent" ? "percent" : "change");
    const table = leafOf(build("DV-C2-TR-CHANGETABLE", f), "yearTable");
    assert.equal(table.leadingRank, true);
    assert.deepEqual(table.data.periods, span);
    assert.ok(!table.data.series.some((s) => s.key.startsWith("group-")), "the group isn't a row");
  }
});

test("a Trends view's span follows its own half's From year", () => {
  for (const { frame } of ofHost((r) => r.host === "teacher.c2.context" && r.measureId === "entries")) {
    const f = frame as SubjectsFrame;
    const from = f.periods[2];
    const moved: SubjectsFrame = { ...f, state: { ...f.state, trendStart: from } };
    assert.equal(leafOf(build("DV-C2-TR-TABLE", moved), "yearTable").data.periods[0], from);
    assert.equal(leafOf(build("DV-C2-TR-CHANGETABLE", moved), "yearTable").data.periods[0], f.periods[0], "the change half keeps its own");
    const moved2: SubjectsFrame = { ...f, state: { ...f.state, changeStart: from } };
    assert.equal(leafOf(build("DV-C2-TR-CHANGETABLE", moved2), "yearTable").data.periods[0], from);
    // Context's scope is its group, as SubjectPanels names it ("Entries in all subjects").
    assert.equal(build("DV-C2-TR-CHANGELIST", moved2)!.title, `Entries in ${f.benchmarkLabel!.toLowerCase()}: % change since ${academicYearLabel(from)}, ranked`);
  }
});

test("Candidates: every category subject's entries (indexed / actual / table); the draft ranked change against the category average", () => {
  for (const { raw, frame } of ofHost((r) => r.kind === "candidates")) {
    const f = frame as CandidatesFrame;
    const ind = leafOf(build("DV-C1-CAND-TR-INDEXED", f), "multiTrend");
    assertSeries(ind.data, f.periods, f.subjects, raw.name);
    assert.equal(ind.index, undefined);
    assert.equal(leafOf(build("DV-C1-CAND-TR-ACTUAL", f), "multiTrend").index, false);
    assertSeries(leafOf(build("DV-C1-CAND-TR-TABLE", f), "yearTable").data, f.periods, f.subjects, raw.name);
    if (f.subjects.length < 2) continue;
    const avg = f.periods.map((_, i) => mean(f.subjects.map((s) => s.values[i])));
    const span = trimmed(f.periods, [...f.subjects.map((s) => s.values), avg]);
    const list = leafOf(build("DV-C1-CAND-TR-CHANGELIST", f), "changeList");
    for (const s of f.subjects) close(list.rows.find((r) => r.key === s.key)!.value, honest(ENTRIES_MEASURE, slice(f.periods, span, s.values)), raw.name);
    close(list.group?.value, honest(ENTRIES_MEASURE, slice(f.periods, span, avg)), `${raw.name} category average`);
    assert.equal(build("DV-C1-CAND-TR-CHANGELIST", f)!.title, `Entries in ${f.categoryLabel}: % change since ${academicYearLabel(span[0])}, ranked`);
  }
});

test("Comparisons: the set's schools; the school against the set's average (the mean of the others with a figure that year)", () => {
  for (const { raw, frame } of ofHost((r) => r.kind === "comparisons")) {
    const f = frame as ComparisonsFrame;
    const target = f.schools.find((s) => s.isTarget)!;
    const others = f.schools.filter((s) => !s.isTarget);
    const latest = latestIdxOf(f.periods, f.schools.map((s) => s.values));
    const bars = leafOf(build("DV-C3-CUR-BAR", f), "rowBars");
    const placed = [...f.schools].filter((s) => s.values[latest] !== null || s.isTarget);
    assert.deepEqual(
      bars.rows.filter((r) => r.value !== null).map((r) => r.value),
      real(placed.map((s) => s.values[latest])).sort((a, b) => b - a),
      raw.name,
    );
    assert.deepEqual(bars.rows.filter((r) => r.emphasis).map((r) => r.label), [f.targetName]);
    const avg = f.periods.map((_, i) => mean(others.map((s) => s.values[i])));
    const span = trimmed(f.periods, [target.values, avg]);
    const chart = leafOf(build("DV-C3-TR-CHART", f), "trendChart");
    assert.deepEqual(chart.data.periods, span);
    assert.deepEqual(chart.data.series.find((s) => s.key === "own")!.values, slice(f.periods, span, target.values));
    chart.data.series.find((s) => s.key === "versus")!.values.forEach((v, k) => close(v, slice(f.periods, span, avg)[k], `${raw.name} versus`));
    const table = leafOf(build("DV-C3-TR-TABLE", f), "yearTable");
    assert.equal(table.data.series.length, f.schools.length);
    assert.equal(table.nameHeading, "School");
    const list = leafOf(build("DV-C3-TR-CHANGELIST", f), "changeList");
    for (const s of f.schools) close(list.rows.find((r) => r.key === (s.isTarget ? "own" : s.urn))!.value, honest(f.measure, slice(f.periods, span, s.values)), raw.name);
    close(list.group?.value, honest(f.measure, slice(f.periods, span, avg)), `${raw.name} set average`);
    assert.equal(leafOf(build("DV-C3-TR-CHANGETABLE", f), "yearTable").leadingRank, true);
  }
});

// ------------------------------------------------------- History, this school only (D8)

const historyOnly = (): ViewSpec => {
  const s = presetSpec("DV-C1-RES-TR-CHART");
  delete s.data.rows;
  return { ...s, compare: [], view: { kind: "line", look: { trendLine: "member" } }, title: "[subject], this school only, year by year" };
};

test("History, this school only: a line on points; 2-year bars on Grade 4+ and bands (D8, R-TREND-LINE-4YR)", () => {
  const hist = ofHost((r) => r.host === "teacher.c1.results" && String(r.name).includes(" History "));
  assert.ok(hist.length >= 4);
  for (const { raw, frame } of hist) {
    const f = frame as SubjectsFrame;
    const s = buildSeries(historyOnly(), f, { fullscreen: false })!;
    const leaf = leafOf(s, "trendChart");
    assert.deepEqual(leaf.data.series.map((x) => x.key), [f.focus], "the school's own line alone");
    assert.equal(s.title, "History, each year");
    const focus = f.subjects.find((x) => x.key === f.focus)!;
    if (raw.measureId === "points") {
      assert.equal(trendChartKind(leaf.data), "line", raw.name);
      assert.ok(leaf.data.periods.length >= 4);
    } else if (real(focus.values).length) {
      assert.equal(trendChartKind(leaf.data), "bars", raw.name);
      assert.deepEqual(leaf.data.periods, [2023, 2024], raw.name);
    }
    // No England, no category line, no other subject: nothing it doesn't ask for.
    assert.ok(!leaf.data.series.some((x) => x.comparison));
  }
});

test("a spec of its own can ask for England on its line (Results on points)", () => {
  const { frame } = ofHost((r) => r.host === "teacher.c1.results" && r.measureId === "points")[0];
  const spec = { ...historyOnly(), compare: [{ kind: "england" as const, colour: "england" }] };
  const leaf = leafOf(buildSeries(spec, frame, { fullscreen: false }), "trendChart");
  assert.deepEqual(leaf.data.series.map((x) => x.key), [(frame as SubjectsFrame).focus, "england"]);
});

// ------------------------------------------------------------------ follows-page

test("compare follows-page resolves to what each host draws today", () => {
  const res = FRAMES.find((x) => x.raw.host === "teacher.c1.results" && x.raw.measureId === "points")!.frame;
  const thr = FRAMES.find((x) => x.raw.host === "teacher.c1.results" && x.raw.measureId === "threshold")!.frame;
  const ctx = FRAMES.find((x) => x.raw.host === "teacher.c2.context" && String(x.raw.name).endsWith("whole"))!.frame;
  const cand = FRAMES.find((x) => x.raw.kind === "candidates")!.frame;
  const cmp = FRAMES.find((x) => x.raw.kind === "comparisons")!.frame;
  const kinds = (id: string, f: ViewFrame) => resolveCompare(presetSpec(id as DataviewId), f).map((c) => `${c.kind}:${c.as ?? "line"}${c.at ? ":" + c.at : ""}`);
  assert.deepEqual(kinds("DV-C1-RES-CUR-BAR", res), ["england:marker"]);
  assert.deepEqual(kinds("DV-C1-RES-CUR-BAR", thr), []);
  assert.deepEqual(kinds("DV-C1-RES-CUR-TABLE", res), ["england:row"]);
  assert.deepEqual(kinds("DV-C1-RES-CUR-TABLE", thr), ["self:row:earlier-year"]);
  assert.deepEqual(kinds("DV-C1-RES-TR-CHART", res), []);
  assert.deepEqual(kinds("DV-C1-RES-TR-GEO-CHART", res), ["self:line", "la:line", "england:line"]);
  assert.deepEqual(kinds("DV-C2-CUR-TABLE", ctx), ["allSubjects:row"]);
  assert.deepEqual(kinds("DV-C2-TR-CHANGELIST", ctx), ["allSubjects:reference"]);
  assert.deepEqual(kinds("DV-C1-CAND-TR-CHANGELIST", cand), ["category:reference"]);
  assert.deepEqual(kinds("DV-C3-TR-CHART", cmp), ["nearest:line"]);
  assert.deepEqual(kinds("DV-C3-TR-CHART", { ...(cmp as ComparisonsFrame), versus: { urn: "100049", label: "X" } }), ["chosenSchool:line"]);
  assert.deepEqual(kinds("DV-C3-TR-CHANGELIST", cmp), ["nearest:reference"]);
  assert.deepEqual(kinds("DV-C3-TR-TABLE", cmp), []);
});

test("a host's own note states are left to the host (null): loading, no schools, a band with no range", () => {
  const cmp = FRAMES.find((x) => x.raw.kind === "comparisons")!.frame as ComparisonsFrame;
  assert.equal(build("DV-C3-TR-CHART", { ...cmp, blocked: true }), null);
  const res = FRAMES.find((x) => x.raw.host === "teacher.c1.results")!.frame as SubjectsFrame;
  assert.equal(build("DV-C1-RES-CUR-BAR", { ...res, currentBlocked: true }), null);
  assert.equal(build("DV-C1-RES-CUR-TABLE", { ...res, currentBlocked: true }), null);
  assert.notEqual(build("DV-C1-RES-TR-CHART", { ...res, currentBlocked: true }), null, "Trends doesn't wait for a range");
});

// ------------------------------------------------------------------ look options

const withLook = (preset: string, look: Record<string, unknown>): ViewSpec => {
  const s = presetSpec(preset as DataviewId);
  return { ...s, view: { ...s.view, look: { ...s.view.look, ...look } } as ViewSpec["view"] };
};

test("look: a View choice never changes a figure (every look, every preset, same numbers)", () => {
  const looks: Record<string, Record<string, unknown>[]> = {
    line: [{ trendLine: true }, { trendLine: false }, { fromZero: true }, { endLabels: true }],
    bar: [{ order: "az" }, { order: "above-comparison" }, { average: "mean" }, { average: "median" }, { average: "weighted" }, { top10: true }, { highlight: false }, { values: false }],
    table: [{ yearColumns: "every" }, { yearColumns: "latest" }, { extra: ["change", "rank", "n"] }, { sort: "listed" }, { sort: "change" }, { highlight: false }, { colourChange: false }, { memberSort: false }],
  };
  const figures = (s: ViewSeries | null): string => {
    if (!s) return "null";
    const l = s.leaf;
    const pairs: [string, number | null][] =
      l.leaf === "multiTrend" || l.leaf === "trendChart" || l.leaf === "yearTable"
        ? l.data.series.flatMap((x) => x.values.map((v, i) => [`${x.key}@${l.data.periods[i]}`, v] as [string, number | null]))
        : l.leaf === "sortTable"
          ? l.rows.flatMap((r) => [[`${r.key}.v`, r.value], [`${r.key}.d`, r.delta]] as [string, number | null][])
          : l.leaf === "changeList"
            ? [...l.rows.map((r) => [r.key, r.value] as [string, number | null]), ["group", l.group?.value ?? null]]
            : l.leaf === "rowBars"
              ? l.rows.map((r) => [`${r.label}`, r.value] as [string, number | null])
              : l.leaf === "verticalBars"
                ? l.bars.map((b) => [b.key, b.value] as [string, number | null])
                : [];
    return JSON.stringify(Object.fromEntries(pairs.sort((a, b) => a[0].localeCompare(b[0]))));
  };
  for (const { frame } of FRAMES)
    for (const id of LTB) {
      const base = build(id, frame);
      if (!base) continue;
      for (const look of looks[presetSpec(id).view.kind]) {
        const s = buildSeries(withLook(id, look), frame, { fullscreen: false });
        const top10 = look.top10 === true;
        if (top10) {
          // The top ten leaves rows out of the picture; the ones kept keep their figures.
          const keep = JSON.parse(figures(s));
          const all = JSON.parse(figures(base));
          for (const k of Object.keys(keep)) assert.equal(keep[k], all[k], `${id} top10 ${k}`);
        } else assert.equal(figures(s), figures(base), `${id} ${JSON.stringify(look)}`);
      }
    }
});

test("look, line: trend line follows the member (default) / always / never; axis from zero and end labels pass to the chart", () => {
  const f = FRAMES.find((x) => x.raw.host === "teacher.c1.results" && x.raw.measureId === "points")!.frame as SubjectsFrame;
  const on: SubjectsFrame = { ...f, state: { ...f.state, showFit: true } };
  assert.equal(leafOf(build("DV-C1-RES-TR-CHART", on), "multiTrend").showFit, true);
  assert.equal(leafOf(build("DV-C1-RES-TR-CHART", f), "multiTrend").showFit, false);
  assert.equal(leafOf(buildSeries(withLook("DV-C1-RES-TR-CHART", { trendLine: true }), f, { fullscreen: false }), "multiTrend").showFit, true);
  assert.equal(leafOf(buildSeries(withLook("DV-C1-RES-TR-CHART", { trendLine: false }), on, { fullscreen: false }), "multiTrend").showFit, false);
  const l = leafOf(buildSeries(withLook("DV-C1-RES-TR-CHART", { fromZero: true, endLabels: true }), f, { fullscreen: false }), "multiTrend");
  assert.equal(l.fromZero, true);
  assert.equal(l.endLabels, true);
  const c = FRAMES.find((x) => x.raw.kind === "comparisons")!.frame;
  const t = leafOf(buildSeries(withLook("DV-C3-TR-CHART", { fromZero: true, endLabels: true }), c, { fullscreen: false }), "trendChart");
  assert.equal(t.fromZero, true);
  assert.equal(t.endLabels, true);
});

test("look, bar: order, top ten with this subject, average line of the bars shown, highlight, values", () => {
  const ctx = FRAMES.find((x) => x.raw.host === "teacher.c2.context" && String(x.raw.name).includes("entries whole"))!.frame as SubjectsFrame;
  assert.ok(ctx.subjects.length > 10);
  const az = leafOf(buildSeries(withLook("DV-C2-CUR-BARS", { order: "az" }), ctx, { fullscreen: false }), "verticalBars");
  assert.deepEqual(az.bars.map((b) => b.label), [...az.bars.map((b) => b.label)].sort((a, b) => a.localeCompare(b)));
  // The focused subject (English Language, or History, never in the top ten) is always kept.
  for (const { frame } of ofHost((r) => String(r.name).includes("context entries whole"))) {
    const f = frame as SubjectsFrame;
    const top = leafOf(buildSeries(withLook("DV-C2-CUR-BARS", { top10: true }), f, { fullscreen: false }), "verticalBars");
    const i = f.state.latestIdx;
    const ranked = [...f.subjects].sort((a, b) => (b.values[i] ?? -Infinity) - (a.values[i] ?? -Infinity));
    const inTop = ranked.slice(0, 10).some((s) => s.key === f.focus);
    assert.equal(top.bars.length, inTop ? 10 : 11);
    assert.ok(top.bars.some((b) => b.key === f.focus));
  }
  const avgLeaf = leafOf(buildSeries(withLook("DV-C2-CUR-BARS", { average: "mean" }), ctx, { fullscreen: false }), "verticalBars");
  const vals = ctx.subjects.map((s) => s.values[ctx.state.latestIdx]);
  close(avgLeaf.average?.value, real(vals).reduce((a, b) => a + b, 0) / real(vals).length, "mean of the bars shown");
  assert.match(avgLeaf.average!.label, /^Average of the \d+ subjects shown$/);
  const med = leafOf(buildSeries(withLook("DV-C2-CUR-BARS", { average: "median" }), ctx, { fullscreen: false }), "verticalBars");
  close(med.average?.value, medianOf(vals));
  // Weighted needs the entries behind each bar: Comparisons has them, subjects don't.
  assert.equal(leafOf(buildSeries(withLook("DV-C2-CUR-BARS", { average: "weighted" }), ctx, { fullscreen: false }), "verticalBars").average, undefined);
  const cmp = FRAMES.find((x) => x.raw.kind === "comparisons" && x.raw.measureId === "points")!.frame as ComparisonsFrame;
  const w = leafOf(buildSeries(withLook("DV-C3-CUR-BAR", { average: "weighted" }), cmp, { fullscreen: false }), "rowBars");
  const li = latestIdxOf(cmp.periods, cmp.schools.map((s) => s.values));
  close(w.average?.value, weightedMeanOf(cmp.schools.map((s) => s.values[li]), cmp.schools.map((s) => s.counts?.[li] ?? null)));
  const res = FRAMES.find((x) => x.raw.host === "teacher.c1.results" && x.raw.measureId === "points")!.frame as SubjectsFrame;
  const plain = leafOf(buildSeries(withLook("DV-C1-RES-CUR-BAR", { highlight: false, values: false }), res, { fullscreen: false }), "rowBars");
  assert.ok(plain.rows.every((r) => !r.emphasis));
  assert.equal(plain.values, false);
  const above = leafOf(buildSeries(withLook("DV-C1-RES-CUR-BAR", { order: "above-comparison" }), res, { fullscreen: false }), "rowBars");
  const gaps = above.rows.map((r) => (r.value !== null && r.marker !== null && r.marker !== undefined ? r.value - r.marker : null));
  assert.deepEqual(gaps, [...gaps].sort((a, b) => (b ?? -Infinity) - (a ?? -Infinity)));
  const cl = leafOf(buildSeries(withLook("DV-C2-TR-CHANGELIST", { order: "az", values: false, highlight: false, average: "mean" }), ctx, { fullscreen: false }), "changeList");
  assert.equal(cl.order, "az");
  assert.equal(cl.values, false);
  assert.equal(cl.focusKey, null);
  close(cl.average?.value, mean(cl.rows.map((r) => r.value)));
});

test("look, table: year columns, extra columns (change, rank, n), sort, highlight, colour the change, members re-sort", () => {
  const ctx = FRAMES.find((x) => x.raw.host === "teacher.c2.context")!.frame;
  const yt = (look: Record<string, unknown>) => leafOf(buildSeries(withLook("DV-C2-TR-TABLE", look), ctx, { fullscreen: false }), "yearTable");
  assert.equal(yt({}).yearColumns, undefined, "the preset: first and latest (YearTable's default)");
  assert.equal(yt({ yearColumns: "every" }).yearColumns, "every");
  assert.equal(yt({ yearColumns: "latest" }).yearColumns, "latest");
  assert.equal(yt({ extra: [] }).showChange, false);
  assert.equal(yt({ extra: ["change", "rank"] }).rankColumn, "always");
  assert.equal(yt({ sort: "listed" }).initialSort, "listed");
  assert.equal(yt({ sort: "change" }).initialSort, "change");
  assert.equal(yt({ highlight: false }).highlight, false);
  assert.equal(yt({ colourChange: false }).colourChange, false);
  assert.equal(yt({ memberSort: false }).sortable, false);
  const cmp = FRAMES.find((x) => x.raw.kind === "comparisons" && x.raw.measureId === "points")!.frame as ComparisonsFrame;
  const n = leafOf(buildSeries(withLook("DV-C3-TR-TABLE", { extra: ["change", "n"] }), cmp, { fullscreen: false }), "yearTable");
  const last = n.data.periods[n.data.periods.length - 1];
  for (const s of cmp.schools) assert.equal(n.counts?.[s.isTarget ? "own" : s.urn], s.counts?.[cmp.periods.indexOf(last)] ?? null);
  const st = (look: Record<string, unknown>) => leafOf(buildSeries(withLook("DV-C1-RES-CUR-TABLE", look), FRAMES[0].frame, { fullscreen: false }), "sortTable");
  assert.ok(st({ colourChange: false }).rows.every((r) => r.deltaTone === "neutral"));
  assert.equal(st({ memberSort: false }).sortable, false);
  assert.equal(st({ sort: "latest" }).hostSort, null, "a different opening order keeps its own sort");
  assert.deepEqual(st({ sort: "latest" }).initialSort, { key: "value", dir: "desc" });
  assert.equal(st({ extra: [] }).showDelta, false);
  assert.equal(st({ highlight: false }).rows.some((r) => r.highlight), false);
});

test("looks.ts arithmetic", () => {
  assert.deepEqual(orderRows([{ key: "a", label: "b", value: 1 }, { key: "b", label: "a", value: 3 }, { key: "c", label: "c", value: null }]).map((r) => r.key), ["b", "a", "c"]);
  assert.deepEqual(orderRows([{ key: "a", label: "b", value: 1, against: 0 }, { key: "b", label: "a", value: 3, against: 4 }], "above-comparison").map((r) => r.key), ["a", "b"]);
  const twelve = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}` }));
  assert.deepEqual(topTen(twelve, "k11").map((r) => r.key), [...twelve.slice(0, 10).map((r) => r.key), "k11"]);
  assert.equal(topTen(twelve, "k3").length, 10);
  assert.equal(medianOf([3, null, 1, 2]), 2);
  assert.equal(medianOf([4, 1, 2, 3]), 2.5);
  assert.equal(weightedMeanOf([10, 20, null], [1, 3, 5]), 17.5);
  assert.equal(averageOfShown("none", [1, 2], null, "x"), null);
  assert.equal(averageOfShown("weighted", [1, 2], null, "x"), null);
  assert.deepEqual(averageOfShown("mean", [1, 2, null], null, "schools"), { value: 1.5, label: "Average of the 2 schools shown" });
});

// =============================================================== S3b: ranking, numbers, slope

const rankOf = (vals: (number | null)[], v: number) => 1 + real(vals).filter((x) => x > v).length;
const ordinalOf = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
const results = ofHost((r) => r.kind === "subjects" && r.host === "teacher.c1.results");
const context = ofHost((r) => r.kind === "subjects" && r.host === "teacher.c2.context");
const candidates = ofHost((r) => r.kind === "candidates");
const comparisons = ofHost((r) => r.kind === "comparisons");

test("every ranking / numbers preset is covered below", () => {
  const ids = DATAVIEWS.filter((d) => ["ranking", "numbers", "slope"].includes(presetSpec(d.id).view.kind)).map((d) => d.id).sort();
  assert.deepEqual(ids, ["DV-C1-CAND-CUR-TILES", "DV-C1-RES-CUR-TILES", "DV-C2-CUR-LIST", "DV-C3-CUR-RANKING", "DV-C3-CUR-TILES"]);
});

test("Results' number tiles: the focused subject's figure; rank in the category, England's figure and the gap (points); the range's own figures (bands); the rank only (Grade 4+)", () => {
  let n = 0;
  for (const { raw, frame } of results) {
    const f = frame as SubjectsFrame;
    const s = build("DV-C1-RES-CUR-TILES", f);
    if (f.currentBlocked) {
      assert.equal(s, null, raw.name);
      continue;
    }
    const leaf = leafOf(s, "numberTiles");
    assert.equal(s!.title, null);
    const i = f.state.latestIdx;
    const focus = f.subjects.find((x) => x.key === f.focus)!;
    const v = focus.values[i];
    assert.equal(leaf.main?.figure, v === null ? "—" : f.measure.format(v), raw.name);
    assert.equal(leaf.main?.label, `${focus.label} ${f.measure.noun} in ${academicYearLabel(f.periods[i])}`);
    if (v === null) {
      assert.deepEqual(leaf.tiles, []);
      continue;
    }
    const keys = leaf.tiles.map((t) => t.key);
    const bench = focus.benchmark?.[i] ?? null;
    if (raw.measureId === "bands") {
      const rows = f.gradeBand!.ownRows.filter((r) => r.period === f.periods[i] && !NON_GRADE_VALUES.has(r.grade));
      const scale = f.gradeBand!.range!.scale as string[];
      const inRange = (g: string) => scale.indexOf(g) >= scale.indexOf(f.gradeBand!.range!.top) && scale.indexOf(g) <= scale.indexOf(f.gradeBand!.range!.bottom);
      const met = rows.filter((r) => inRange(r.grade)).reduce((a, r) => a + r.entries, 0);
      const count = leaf.tiles.find((t) => t.key === "count");
      assert.equal(count?.figure, met.toLocaleString(), raw.name);
      assert.equal(count?.detail, `of ${rows.reduce((a, r) => a + r.entries, 0).toLocaleString()} graded entries at ${String(raw.bandLabel).toLowerCase()}`);
      assert.ok(!keys.includes("category"));
    } else {
      const vals = f.subjects.map((x) => x.values[i]);
      if (real(vals).length > 1) assert.equal(leaf.tiles.find((t) => t.key === "category")?.figure, ordinalOf(rankOf(vals, v)), raw.name);
    }
    if (raw.measureId === "threshold") assert.ok(!keys.includes("england") && !keys.includes("england-average"), "no England on a rate (R-NO-GRADE-RATE-GEO)");
    else if (bench !== null) {
      assert.equal(leaf.tiles.find((t) => t.key === "england-average")?.figure, f.measure.format(bench));
      assert.equal(leaf.tiles.find((t) => t.key === "england")?.figure, f.measure.formatDelta(v - bench));
    }
    n++;
  }
  assert.ok(n >= 10);
});

test("Candidates' number tiles: entries this year; rank in the category and among the school's subjects; % change since the first year", () => {
  for (const { raw, frame } of candidates) {
    const f = frame as CandidatesFrame;
    const s = build("DV-C1-CAND-CUR-TILES", f);
    const leaf = leafOf(s, "numberTiles");
    const last = f.periods.length - 1;
    const focus = f.subjects.find((x) => x.key === f.focus)!;
    assert.equal(s!.title, `${focus.label} Candidates: ${academicYearLabel(f.periods[last])}`);
    const v = focus.values[last]!;
    assert.equal(leaf.main?.figure, Math.round(v).toLocaleString(), raw.name);
    const cat = f.subjects.map((x) => x.values[last]);
    assert.deepEqual(leaf.tiles.find((t) => t.key === "category"), { key: "category", icon: "PodiumIcon", figure: ordinalOf(rankOf(cat, v)), detail: `of ${real(cat).length} in ${f.categoryLabel}`, vars: { total: real(cat).length } });
    const sch = f.schoolSubjects!.map((x) => x.values[last]);
    assert.equal(leaf.tiles.find((t) => t.key === "school")?.figure, ordinalOf(rankOf(sch, v)));
    const pct = Math.round(honest(ENTRIES_MEASURE, focus.values)!);
    assert.equal(leaf.tiles.find((t) => t.key === "change")?.figure, `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`);
    assert.deepEqual(leaf.tiles.map((t) => t.key), ["category", "school", "change"]);
  }
});

const RANKING_FIGURES = { ranked: 2873, targetRank: 41, target: { period: 2024, value: 61.2 }, averageLatest: 46.1, measure: measureById("ks4", "points"), measureName: "Attainment 8" };
const onRanking = (f: ComparisonsFrame): ComparisonsFrame => ({ ...f, setLabel: "National ranking", ranking: { averageAt: (p) => (p === 2024 ? 45.9 : null), figures: RANKING_FIGURES } });

test("Comparisons' number tiles: a ranking set only -- the rank in its whole population and its average, on its own measure (R-RANKING-SAMPLE)", () => {
  for (const { frame } of comparisons) {
    const f = frame as ComparisonsFrame;
    assert.equal(build("DV-C3-CUR-TILES", f), null, "a list of schools has no tiles");
    const s = build("DV-C3-CUR-TILES", onRanking(f));
    const leaf = leafOf(s, "numberTiles");
    assert.equal(s!.title, "This school's rank in the national ranking: Attainment 8");
    assert.deepEqual(leaf.main, { figure: RANKING_FIGURES.measure.format(61.2), label: `This school Attainment 8 in ${academicYearLabel(2024)}` });
    assert.deepEqual(leaf.tiles.map((t) => [t.key, t.figure, t.detail]), [["rank", "41st", "of 2,873 in this set"], ["average", RANKING_FIGURES.measure.format(45.9), "average across this set"]]);
    // Still drawn while the set's own schools are loading: the figures are the population's.
    assert.ok(build("DV-C3-CUR-TILES", { ...onRanking(f), blocked: true }));
  }
});

test("numbers: the instance's Figures pick, order, relabel and hide the tiles, and relabel the main figure (round 3); unset = the host's tiles", () => {
  const f = candidates[0].frame as CandidatesFrame;
  const spec = presetSpec("DV-C1-CAND-CUR-TILES");
  const base = leafOf(buildSeries(spec, f, { fullscreen: false }), "numberTiles");
  assert.deepEqual(leafOf(buildSeries(spec, f, { fullscreen: false, params: {} }), "numberTiles"), base);
  const params = { tiles: [{ figure: "change" }, { figure: "category", label: "ranked against [total] [category] subjects" }, { figure: "school", hidden: true }], mainLabel: "[subject] at [school]" };
  const leaf = leafOf(buildSeries(spec, f, { fullscreen: false, params }), "numberTiles");
  assert.deepEqual(leaf.tiles.map((t) => t.key), ["change", "category"]);
  const cat = base.tiles.find((t) => t.key === "category")!;
  assert.equal(leaf.tiles[1].detail, `ranked against ${cat.vars!.total} ${f.categoryLabel} subjects`);
  assert.equal(leaf.tiles[1].figure, cat.figure, "a relabel never changes the figure");
  assert.equal(leaf.main?.label, `${(f.subjects.find((x) => x.key === f.focus) ?? f.subjects[0]).label} at Test School`);
  assert.equal(leaf.main?.figure, base.main?.figure);
  // A figure this host doesn't build here is dropped, as the host drops it.
  assert.deepEqual(leafOf(buildSeries(spec, f, { fullscreen: false, params: { tiles: [{ figure: "england" }, { figure: "category" }] } }), "numberTiles").tiles.map((t) => t.key), ["category"]);
});

test("Context's Ranked list: the group's subjects, largest first, as the host lists them", () => {
  for (const { raw, frame } of context) {
    const f = frame as SubjectsFrame;
    const leaf = leafOf(build("DV-C2-CUR-LIST", f), "rankedList");
    const i = f.state.latestIdx;
    const want = [...f.subjects].map((x) => ({ key: x.key, value: x.values[i] })).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    assert.deepEqual(leaf.rows.map((r) => [r.key, r.value]), want.map((r) => [r.key, r.value]), raw.name);
    assert.ok(leaf.rows.every((r) => r.rank === undefined), "the host's own numbering");
    assert.equal(leaf.columns, undefined, "the preset's columns are the host's");
    assert.equal(leaf.focusKey, f.focus);
  }
});

test("Comparisons' Ranking: the set's schools with a latest figure (the school always), ranked, with sector and distance", () => {
  for (const { raw, frame } of comparisons) {
    const f = frame as ComparisonsFrame;
    const s = build("DV-C3-CUR-RANKING", f);
    const leaf = leafOf(s, "schoolRanking");
    assert.deepEqual(s!.title, `Schools ranked by ${f.titleOn} in the ${f.setLabel.toLowerCase()}`);
    const li = latestIdxOf(f.periods, f.schools.map((x) => x.values));
    const kept = f.schools.filter((x) => x.isTarget || x.values[li] !== null);
    assert.equal(leaf.rows.length, kept.length, raw.name);
    for (const r of leaf.rows) {
      const school = f.schools.find((x) => x.urn === r.key)!;
      assert.equal(r.value, school.values[li]);
      if (r.value !== null) assert.equal(r.rank, rankOf(kept.map((x) => x.values[li]), r.value));
      assert.equal(r.distanceKm, school.distanceKm ?? null);
      assert.equal(r.independent, school.independent ?? null);
    }
    assert.equal(leaf.valueHeading, f.measure.id === "entries" ? "Entries" : "Result");
    assert.equal(build("DV-C3-CUR-RANKING", { ...f, blocked: true }), null, "loading: the host's note");
  }
});

test("look, ranking: columns, top 5 / all / around this school, always show this school -- never a figure or a rank changed", () => {
  for (const { frame } of comparisons) {
    const f = frame as ComparisonsFrame;
    const all = leafOf(build("DV-C3-CUR-RANKING", f), "schoolRanking");
    const byKey = new Map(all.rows.map((r) => [r.key, r]));
    const self = all.rows.find((r) => r.isTarget)!;
    const sorted = [...all.rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    for (const look of [{ show: "top5" }, { show: "around" }, { show: "top5", alwaysSelf: false }, { columns: ["rank", "value", "change", "n", "bar"] }]) {
      const leaf = leafOf(buildSeries(withLook("DV-C3-CUR-RANKING", look), f, { fullscreen: false }), "schoolRanking");
      for (const r of leaf.rows) {
        assert.equal(r.value, byKey.get(r.key)!.value);
        assert.equal(r.rank, byKey.get(r.key)!.rank);
      }
      if (look.show === "top5") {
        assert.deepEqual(leaf.rows.slice(0, 5).map((r) => r.key), sorted.slice(0, 5).map((r) => r.key));
        assert.equal(leaf.rows.some((r) => r.isTarget), look.alwaysSelf !== false || sorted.slice(0, 5).includes(self));
      }
      if (look.show === "around") {
        assert.equal(leaf.rows.length, Math.min(5, sorted.length));
        assert.ok(leaf.rows.some((r) => r.isTarget));
      }
      if (look.columns) {
        assert.deepEqual(leaf.columns, look.columns);
        for (const r of leaf.rows) {
          const school = f.schools.find((x) => x.urn === r.key)!;
          const li = latestIdxOf(f.periods, f.schools.map((x) => x.values));
          assert.equal(r.n, school.counts?.[li] ?? null);
          const prev = [...school.values.slice(0, li)].reverse().find((x) => x !== null) ?? null;
          const c = r.value === null || prev === null ? null : honest(f.measure, [prev, r.value]);
          assert.equal(r.change, c === null ? null : formatChange(f.measure, c));
          assert.ok(r.share === null || (r.share! >= 0 && r.share! <= 1));
        }
      } else assert.equal(leaf.columns, undefined);
    }
  }
  // The list: a cut list numbers each row by its place in the whole list.
  for (const { frame } of context) {
    const f = frame as SubjectsFrame;
    const all = leafOf(build("DV-C2-CUR-LIST", f), "rankedList");
    if (all.rows.length <= 6) continue;
    const top = leafOf(buildSeries(withLook("DV-C2-CUR-LIST", { show: "top5" }), f, { fullscreen: false }), "rankedList");
    const at = all.rows.findIndex((r) => r.key === f.focus);
    assert.deepEqual(top.rows.map((r) => r.rank), at >= 5 ? [1, 2, 3, 4, 5, at + 1] : [1, 2, 3, 4, 5]);
    for (const r of top.rows) assert.equal(r.value, all.rows.find((x) => x.key === r.key)!.value);
  }
});

const SLOPE: ViewSpec = {
  data: { source: "follows-page", subject: "follows", per: "subject", rows: "follows-page", shownAs: "actual", years: { from: "first", rollOn: true, memberPick: true } },
  compare: "follows-page",
  view: { kind: "slope", look: {} },
  icon: "TrendLineIcon",
  title: "[subject]: then and now",
};

test("slope: a spec of its own renders from every frame -- each row's figure at the first year and the latest, unchanged", () => {
  for (const { raw, frame } of FRAMES) {
    const s = buildSeries(SLOPE, frame, { fullscreen: false });
    if (!s) continue;
    const leaf = leafOf(s, "slope");
    assert.ok(leaf.from < leaf.to, raw.name);
    const fi = frame.periods.indexOf(leaf.from);
    const ti = frame.periods.indexOf(leaf.to);
    const values = (key: string): (number | null)[] =>
      frame.kind === "comparisons" ? frame.schools.find((x) => (x.isTarget ? "own" : x.urn) === key)!.values : frame.subjects.find((x) => x.key === key)!.values;
    for (const r of leaf.rows) {
      assert.equal(r.from, values(r.key)[fi], `${raw.name} ${r.key}`);
      assert.equal(r.to, values(r.key)[ti]);
    }
    assert.ok(String(s.title).endsWith(`: ${academicYearLabel(leaf.from)} to ${academicYearLabel(leaf.to)}`), String(s.title));
  }
  // Results on points: every subject with a figure in both years, from the span's first year.
  const f = results.find((x) => x.raw.measureId === "points")!.frame as SubjectsFrame;
  const leaf = leafOf(buildSeries(SLOPE, f, { fullscreen: false }), "slope");
  const span = trimmed(f.periods, f.subjects.map((x) => x.values));
  assert.equal(leaf.from, span[0]);
  assert.equal(leaf.to, f.periods[f.state.latestIdx]);
  assert.deepEqual(leaf.rows.map((r) => r.key).sort(), f.subjects.filter((x) => x.values[f.periods.indexOf(leaf.from)] !== null && x.values[f.state.latestIdx] !== null).map((x) => x.key).sort());
  assert.equal(leaf.rows.filter((r) => r.emphasis).length, 1);
  // The members' From year moves the first year; { latest } is the year before Current's.
  const later = leafOf(buildSeries(SLOPE, { ...f, state: { ...f.state, trendStart: span[1] } }, { fullscreen: false }), "slope");
  assert.equal(later.from, span[1]);
  const lastTwo = leafOf(buildSeries({ ...SLOPE, data: { ...SLOPE.data, years: { latest: true } } }, f, { fullscreen: false }), "slope");
  assert.equal(lastTwo.to, f.periods[f.state.latestIdx]);
  assert.equal(lastTwo.from, f.periods[f.state.latestIdx - 1]);
  // The focused subject alone, against its category's average (a dashed comparison line).
  const own = leafOf(buildSeries({ ...SLOPE, data: { ...SLOPE.data, rows: undefined }, compare: [{ kind: "category", colour: "muted" }] }, f, { fullscreen: false }), "slope");
  assert.deepEqual(own.rows.map((r) => [r.key, !!r.comparison]), [[f.focus, false], ["group-0", true]]);
  assert.equal(own.rows[1].to, f.groups[0].values[f.state.latestIdx]);
  // One year only: nothing to slope; the host draws.
  assert.equal(buildSeries(SLOPE, { ...f, periods: f.periods.slice(0, 1), subjects: f.subjects.map((x) => ({ ...x, values: x.values.slice(0, 1) })), state: { ...f.state, latestIdx: 0 } }, { fullscreen: false }), null);
});

test("the renderer draws them: a slope ViewSpec renders (SlopeChart); ranking and numbers presets render their host's leaf", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { renderView } = await import("@/components/views");
  const f = results.find((x) => x.raw.measureId === "points")!.frame as SubjectsFrame;
  const slope = renderView(SLOPE, f, { fullscreen: false });
  assert.ok(slope, "slope is registered and builds");
  const html = renderToStaticMarkup(slope as React.ReactElement);
  assert.match(html, /data-view="slope"/);
  const leaf = leafOf(buildSeries(SLOPE, f, { fullscreen: false }), "slope");
  for (const r of leaf.rows.filter((x) => x.emphasis)) assert.ok(html.includes(f.measure.format(r.from)) && html.includes(f.measure.format(r.to)));
  assert.match(renderToStaticMarkup(renderView(presetSpec("DV-C1-RES-CUR-TILES"), f, { fullscreen: false }) as React.ReactElement), /text-\[80px\]/);
  assert.match(renderToStaticMarkup(renderView(presetSpec("DV-C2-CUR-LIST"), context[0].frame, { fullscreen: false }) as React.ReactElement), /<ol/);
  assert.match(renderToStaticMarkup(renderView(presetSpec("DV-C3-CUR-RANKING"), comparisons[0].frame, { fullscreen: false }) as React.ReactElement), /Distance/);
});
