// 0.6.2 S4b (Guy's decisions A and B, 6 Oct 2026).
//   R-TREND-FROM-2223          a grade or points trend draws 2021/22 but measures every statement
//                              from 2022/23; a trend starting 2022/23 or later is unchanged
//   R-CURRENT-GRADES-FROM-2324 a latest-year view on a grade measure reads 2023/24 on only
// The note's placement (the "i", fullscreen, print): src/lib/grading-note.test.ts.
// Run: npx -y tsx --test src/lib/trend-base.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TREND_BASE_PERIOD, trendBaseFor, specYears } from "@/catalogue/notes";
import { presetSpec } from "@/catalogue/viewspec";
import { ruleById } from "@/catalogue";
import { OpenInFullscreen } from "@/components/teacher/CardBox";
import { SubjectPanels } from "@/components/teacher/SubjectPanels";
import { GradeCountsPanels } from "@/components/teacher/GradeCountsPanels";
import { ComparisonsPanels } from "@/components/teacher/ComparisonsPanels";
import { YearTable } from "@/components/teacher/SeriesViews";
import { gradeCounts } from "./grade-spread";
import {
  ENTRIES_MEASURE,
  countedValues,
  currentRowsWithDelta,
  headlineMeasure,
  latestYearFrom,
  latestYearSeries,
  leastSquares,
  measuresFor,
  sliceFrom,
  statementSpan,
  trimToData,
  withTrendBase,
  type PanelData,
  type PanelId,
} from "./teacher-view-panels";

const [POINTS, THRESHOLD, BANDS] = measuresFor("ks4");
const FOUR = [2021, 2022, 2023, 2024];
const open = (el: ReactElement) => renderToStaticMarkup(createElement(OpenInFullscreen.Provider, { value: true }, el));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/[▲▼]/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// 2021/22's generous grading: a fall from it (5.6 -> 5.0, -11%) where 2022/23 on rises (4.8 ->
// 5.0, +4.2%, past R-TREND-FLAT-4PCT's band).
const POINTS_VALUES = [5.6, 4.8, 4.9, 5.0];
const data = (periods: number[], values: (number | null)[], base: number | null = TREND_BASE_PERIOD): PanelData =>
  withTrendBase(trimToData({ periods, series: [{ key: "h", label: "History", colour: "#000", values }] }), base);

test("the rules: one base year, in one place; A and B are catalogue rules", () => {
  assert.equal(TREND_BASE_PERIOD, 2022, "2022/23");
  for (const id of ["R-TREND-FROM-2223", "R-CURRENT-GRADES-FROM-2324"] as const) assert.equal(ruleById(id)?.status, "active", id);
  assert.equal(ruleById("R-2122-GRADING-NOTE")?.status, "superseded");
  assert.equal(ruleById("R-2122-GRADING-NOTE")?.supersededBy, "R-TREND-FROM-2223");
  for (const m of ["points", "threshold", "bands", "counts"]) assert.equal(trendBaseFor(m, "ks4"), 2022, m);
  assert.equal(trendBaseFor("entries", "ks4"), null, "Candidates are unaffected");
  assert.equal(trendBaseFor("points", "ks2"), null, "KS2 is unaffected");
});

test("2021/22 is drawn, but excluded from the statements: base 2022/23", () => {
  const d = data(FOUR, POINTS_VALUES);
  assert.deepEqual(d.periods, FOUR, "every year is still drawn");
  assert.equal(d.statementFrom, 2022);
  const span = statementSpan(d);
  assert.deepEqual(span.periods, [2022, 2023, 2024]);
  assert.deepEqual(span.series[0].values, [4.8, 4.9, 5.0]);
  // A fitted line counts from 2022/23 at the drawn positions (x = 1..3).
  assert.deepEqual(countedValues(POINTS_VALUES, FOUR, d.statementFrom), [null, 4.8, 4.9, 5.0]);
  const fit = leastSquares(countedValues(POINTS_VALUES, FOUR, 2022))!;
  assert.ok(fit.slope > 0, "rising from 2022/23 (falling from 2021/22)");
  assert.ok(leastSquares(POINTS_VALUES)!.slope < 0);
  // The member's own "From" year still slices the drawing; the statement span follows it.
  assert.deepEqual(sliceFrom(d, 2022).periods, [2022, 2023, 2024]);
  assert.deepEqual(statementSpan(sliceFrom(d, 2023)).periods, [2023, 2024]);
});

test("a trend whose first year is 2022/23 or later is unchanged", () => {
  for (const periods of [[2022, 2023, 2024], [2023, 2024]]) {
    const values = periods.map((_, i) => 4.8 + i * 0.1);
    const plain = trimToData({ periods, series: [{ key: "h", label: "History", colour: "#000", values }] });
    const d = withTrendBase(plain, 2022);
    assert.equal(d, plain, `${periods[0]}: the same object, no statement year`);
    assert.equal(statementSpan(d), d);
  }
  // Entries and KS2 (base null): unchanged whatever the years.
  const entries = trimToData({ periods: FOUR, series: [{ key: "h", label: "History", colour: "#000", values: [30, 32, 31, 35] }] });
  assert.equal(withTrendBase(entries, null), entries);
  assert.equal(statementSpan(withTrendBase(entries, null)), entries);
});

test("YearTable: the Change column counts from 2022/23; the card's columns are its two ends, fullscreen every year", () => {
  const d = data(FOUR, [60, 50, 52, 55]);
  // Pinned across (0.6.3 S4: a one-row table would open years down by default).
  const card = text(renderToStaticMarkup(createElement(YearTable, { data: d, measure: THRESHOLD, focusKey: "h", years: "across" })));
  assert.match(card, /2022\/23 2024\/25/);
  assert.doesNotMatch(card, /2021\/22/);
  assert.match(card, /\+5pp/, "50 -> 55, not 60 -> 55");
  const full = text(renderToStaticMarkup(createElement(YearTable, { data: d, measure: THRESHOLD, focusKey: "h", fullscreen: true, years: "across" })));
  assert.match(full, /2021\/22 2022\/23 2023\/24 2024\/25/, "2021/22 still shown");
  assert.match(full, /60% 50% 52% 55% \+5pp/);
  // Without a statement year (entries; KS2): from the first year, as before.
  assert.match(text(renderToStaticMarkup(createElement(YearTable, { data: { ...d, statementFrom: null }, measure: THRESHOLD, focusKey: "h", years: "across" }))), /2021\/22 2024\/25 .*−5pp/);
  // 0.6.3 S4: one row opens years down -- every year on the card too, then the change, which
  // keeps R-TREND-FROM-2223's span.
  const down = text(renderToStaticMarkup(createElement(YearTable, { data: d, measure: THRESHOLD, focusKey: "h" })));
  assert.match(down, /2021\/22 60% 2022\/23 50% 2023\/24 52% 2024\/25 55% Change \+5pp/);
});

// ------------------------------------------------------------- the hosts (Results / Context)

const subjects = (rows: [string, (number | null)[]][]) =>
  rows.map(([label, values]) => ({ key: `${label}::GCSE`, label, shortLabel: label, colour: "#34d399", values }));
// No page runtime here, so no phase: the rule applies as at KS4 / Post-16 (KS2 has no
// SubjectPanels; its Comparisons are checked below).
const subjectPanels = (measure: typeof POINTS, periods: number[], rows: [string, (number | null)[]][], panels: PanelId[]) =>
  createElement(SubjectPanels, {
    columnId: "context",
    periods,
    subjects: subjects(rows),
    measure,
    focus: `${rows[0][0]}::GCSE`,
    changeScope: "individual",
    questions: { current: "How well?", trend: "Moved?", change: "Most?" },
    source: (span?: string) => `Source: DfE${span ? `, ${span}` : ""}.`,
    panels,
    onPanelsChange: () => {},
    emptyText: "Pick a subject.",
  });

test("Results / Context Trends: the sentence and direction word measured from 2022/23; the chart still from 2021/22", () => {
  const html = text(open(subjectPanels(POINTS, FOUR, [["History", POINTS_VALUES], ["Geography", [5.0, 4.6, 4.7, 4.7]]], ["trend"])));
  assert.match(html, /Source: DfE, 2021\/22–2024\/25\./, "the span drawn");
  assert.match(html, /Growing/, "the direction from 2022/23 (it was Declining from 2021/22)");
  assert.doesNotMatch(html, /Declining/);
  assert.match(html, /History's average points has grown from 4\.8 to 5\.0; a rise of 0\.2 points since 2022\/23/);
  assert.doesNotMatch(html, /since 2021\/22/);
  // A trend from 2022/23: exactly the same words.
  const from2223 = text(open(subjectPanels(POINTS, [2022, 2023, 2024], [["History", POINTS_VALUES.slice(1)], ["Geography", [4.6, 4.7, 4.7]]], ["trend"])));
  const said = (h: string) => h.match(/History's average points has[^.]*\./)?.[0];
  assert.equal(said(html), said(from2223));
});

test("the % change half: every change since 2022/23, 2021/22 still in the fullscreen change table", () => {
  const rows: [string, (number | null)[]][] = [["History", [80, 60, 62, 70]], ["Geography", [50, 52, 51, 53]]];
  // The host's Trends panel (opening on its chart) already says "since 2022/23".
  assert.match(text(open(subjectPanels(THRESHOLD, FOUR, rows, ["trend"]))), /since 2022\/23/);
  // The change table, as the change half hands it over (statementFrom set, every year drawn).
  const d = withTrendBase(trimToData({ periods: FOUR, series: subjects(rows).map((x) => ({ key: x.key, label: x.label, colour: x.colour, values: x.values })) }), 2022);
  assert.deepEqual(statementSpan(d).periods, [2022, 2023, 2024]);
  const full = text(renderToStaticMarkup(createElement(YearTable, { data: d, measure: THRESHOLD, focusKey: "History::GCSE", fullscreen: true, leadingRank: true, years: "across" })));
  assert.match(full, /2021\/22 2022\/23 2023\/24 2024\/25/);
  assert.match(full, /80% 60% 62% 70% \+10pp/, "History +10pp since 2022/23 (it was −10pp since 2021/22)");
});

test("entries keep their first year (Candidates are unaffected)", () => {
  const html = text(open(subjectPanels(ENTRIES_MEASURE, FOUR, [["History", [40, 30, 31, 32]], ["Geography", [20, 21, 22, 23]]], ["trend"])));
  assert.match(html, /since 2021\/22/);
});

test("latest-year views untouched: a subject with grades only before 2023/24 is not on Current; no 'vs last year' past a missing 2023/24", () => {
  // Turkish: 2021/22 only. Latin: 2022/23 and 2024/25 (no 2023/24). History: every year.
  const rows: [string, (number | null)[]][] = [["History", [70, 68, 69, 72]], ["Turkish", [90, null, null, null]], ["Latin", [null, 80, null, 68]]];
  const series = subjects(rows);
  const current = latestYearSeries(series, FOUR, latestYearFrom("threshold"), "History::GCSE");
  assert.deepEqual(current.map((s) => s.key), ["History::GCSE", "Latin::GCSE"], "Turkish leaves Current");
  const delta = currentRowsWithDelta(current, 3, false);
  assert.equal(delta.find((r) => r.s.key === "Latin::GCSE")!.delta, null, "no 2024/25 against 2022/23");
  assert.equal(delta.find((r) => r.s.key === "History::GCSE")!.delta, 3);
  // Points and entries read every year, as before.
  assert.equal(latestYearSeries(series, FOUR, latestYearFrom("points"), null), series);
  assert.equal(latestYearSeries(series, FOUR, latestYearFrom("entries"), null), series);
  // The host: Current's table on Grade 4+ lists History and Latin, Latin's "vs last year" a dash.
  const html = text(open(subjectPanels(THRESHOLD, FOUR, rows, ["current"])));
  assert.doesNotMatch(html, /Turkish/);
  assert.match(html, /Latin/);
  // ...and the Trends still draw Turkish's and Latin's 2021/22-2022/23 figures.
  const trends = text(open(subjectPanels(THRESHOLD, FOUR, rows, ["trend"])));
  assert.match(trends, /Turkish/);
  assert.match(trends, /2021\/22–2024\/25/);
});

test("Grade bands: the same rule on a rate", () => {
  const html = text(open(subjectPanels(BANDS, FOUR, [["History", [40, 30, 31, 33]], ["Geography", [30, 28, 28, 29]]], ["trend"])));
  assert.match(html, /since 2022\/23/);
  assert.doesNotMatch(html, /since 2021\/22/);
});

test("Grade counts: the latest year from 2023/24 on; the change table from 2022/23; the spread may still compare with 2021/22", () => {
  const rows = (years: number[]) => years.flatMap((period) => ["9", "7", "4", "1"].map((grade, i) => ({ period, grade, entries: 10 + i + (period - 2021) })));
  const g = gradeCounts(rows(FOUR), [], { compareFrom: null, changeFrom: null });
  assert.equal(g.latest, 2024);
  assert.deepEqual(g.earlier, [2021, 2022, 2023]);
  assert.deepEqual(g.changeEarlier, [2022, 2023]);
  assert.equal(g.chgYear, 2022, "the change table measures from 2022/23 by default");
  assert.equal(gradeCounts(rows(FOUR), [], { compareFrom: null, changeFrom: 2021 }).chgYear, 2022, "2021/22 isn't offered");
  assert.equal(gradeCounts(rows(FOUR), [], { compareFrom: 2021, changeFrom: null }).cmpYear, 2021, "the spread draws 2021/22 if asked");
  // A subject whose grades stop in 2022/23: no latest year (as before the rows reached back).
  assert.equal(gradeCounts(rows([2021, 2022]), [], { compareFrom: null, changeFrom: null }).latest, null);
  const host = text(
    open(
      createElement(GradeCountsPanels, {
        columnId: "candidates", subjectLabel: "History", ownRows: rows(FOUR), geography: null, colour: "#34d399",
        panels: ["current"], onPanelsChange: () => {}, question: "How well?", source: (span?: string) => `Source: DfE${span ? `, ${span}` : ""}.`,
      }),
    ),
  );
  assert.match(host, /2024\/25/);
});

test("Comparisons: the school's trend and the set's clause measured from 2022/23; the change half from 2022/23", () => {
  const schools = [
    { urn: "1", name: "This school", isTarget: true, distanceKm: 0, independent: false },
    { urn: "2", name: "Other school", isTarget: false, distanceKm: 1.2, independent: false },
  ];
  const series = (vals: number[]) => FOUR.map((period, i) => ({ period, value: vals[i] }));
  const seriesByUrn = { "1": { candidates: series([100, 100, 100, 100]), results: series([52, 47, 48, 49.5]) }, "2": { candidates: series([90, 90, 90, 90]), results: series([50, 46, 46.5, 47]) } };
  const comparisons = (phase: "ks4" | "ks2", measure: typeof POINTS) =>
    createElement(ComparisonsPanels, {
      phase, panels: ["trend"], onPanelsChange: () => {}, question: "Wider?", source: (span?: string) => `Source: DfE${span ? `, ${span}` : ""}.`,
      headlineLabel: "Attainment 8", setId: "nearest", activeSet: { id: "nearest", label: "10 nearest schools" } as never, setLabel: "10 nearest schools",
      schools: schools as never, seriesByUrn: seriesByUrn as never, measure, schoolUrn: "1", mapProfiles: null, activeMapChip: null,
      mapRank: null, onMapRank: () => {}, subjectLabel: null, seriesLoading: false, emptyText: "No schools.", targetName: "This school", threshold: null,
    } as never);
  const a8 = text(open(comparisons("ks4", headlineMeasure("ks4", "Attainment 8"))));
  assert.match(a8, /2021\/22–2024\/25/, "drawn from 2021/22");
  assert.match(a8, /has grown from 47\.0 to 49\.5; a rise of 2\.5 points since 2022\/23/);
  assert.match(a8, /own 46\.0 to 47\.0 over the same years/);
  assert.match(a8, /Growing/);
  // KS2: from its first year, as before.
  const ks2 = text(open(comparisons("ks2", headlineMeasure("ks2", "Expected standard"))));
  assert.match(ks2, /since 2021\/22/);
});

test("views=v2: a slope from the span's first year starts at 2022/23; a change map draws no 2021/22", () => {
  const slope = presetSpec("DV-C1-RES-TR-CHART");
  const first = { ...slope, view: { kind: "slope" as const, look: {} }, data: { ...slope.data, years: { from: "first" as const } } };
  assert.deepEqual(specYears(first as never, FOUR), [2022, 2024]);
  assert.deepEqual(specYears(presetSpec("DV-C3-TR-CHANGEMAP"), FOUR), [2022, 2023, 2024]);
  assert.deepEqual(specYears(presetSpec("DV-C3-TR-CHART"), FOUR), FOUR, "the Trend chart draws every year");
  assert.equal(specYears(presetSpec("DV-C3-CUR-MAP"), FOUR), null, "a latest-year view");
});

// 0.6.4 A (R-TREND-TABLE-YEARS): a trend table shows its chart's years.
test("a year table: the card across names the years it leaves out; years down and fullscreen show every year", async () => {
  const { yearColumnsShown } = await import("@/components/teacher/tableLayout");
  const d = data(FOUR, POINTS_VALUES);
  assert.deepEqual(yearColumnsShown(d.periods, d.statementFrom, { yearColumns: "first-latest", fullscreen: false, layout: "across" }), { shown: [1, 3], hidden: [0, 2] });
  assert.deepEqual(yearColumnsShown(d.periods, d.statementFrom, { yearColumns: "first-latest", fullscreen: true, layout: "across" }).hidden, []);
  assert.deepEqual(yearColumnsShown(d.periods, d.statementFrom, { yearColumns: "first-latest", fullscreen: false, layout: "down" }).shown, [0, 1, 2, 3]);
  assert.deepEqual(yearColumnsShown(d.periods, d.statementFrom, { yearColumns: "latest", fullscreen: false, layout: "across" }), { shown: [3], hidden: [] }, "a latest-year table names nothing");
  // Three rows open years across: the card shows 2022/23 and 2024/25 and the cue.
  const three: PanelData = { ...d, series: ["a", "b", "c"].map((k) => ({ ...d.series[0], key: k, label: k })) };
  const card = text(renderToStaticMarkup(createElement(YearTable, { data: three, measure: POINTS, focusKey: "a" })));
  assert.match(card, /2022\/23 2024\/25 Change/);
  assert.doesNotMatch(card, /2021\/22 /);
  assert.match(card, /\+2 more years/);
  const html = renderToStaticMarkup(createElement(YearTable, { data: three, measure: POINTS, focusKey: "a" }));
  assert.match(html, /title="Also 2021\/22, 2023\/24: swap to years down to see every year"/);
  const full = text(renderToStaticMarkup(createElement(YearTable, { data: three, measure: POINTS, focusKey: "a", fullscreen: true })));
  assert.match(full, /2021\/22 2022\/23 2023\/24 2024\/25 Change/);
  assert.doesNotMatch(full, /more year/);
  // Two years: nothing hidden, no cue (as before).
  const two = text(renderToStaticMarkup(createElement(YearTable, { data: { ...three, periods: [2023, 2024], statementFrom: undefined, series: three.series.map((s) => ({ ...s, values: [4.9, 5.0] })) }, measure: POINTS, focusKey: "a" })));
  assert.doesNotMatch(two, /more year/);
});

test("Grade counts' change table: every graded year from 2021/22, the change from 2022/23; a member's From year starts it", () => {
  const rows = (years: number[]) => years.flatMap((period) => ["9", "7", "4", "1"].map((grade, i) => ({ period, grade, entries: 10 + i + (period - 2021) })));
  const g = gradeCounts(rows(FOUR), [], { compareFrom: null, changeFrom: null }).changeDataIn("#000");
  assert.deepEqual(g.periods, FOUR);
  assert.equal(g.statementFrom, 2022);
  assert.deepEqual(g.series.find((s) => s.key === "9")?.values, [10, 11, 12, 13]);
  const from23 = gradeCounts(rows(FOUR), [], { compareFrom: null, changeFrom: 2023 }).changeDataIn("#000");
  assert.deepEqual(from23.periods, [2023, 2024]);
  assert.equal(from23.statementFrom, undefined);
  // The table: the card's two columns are still the change's ends; the change counts from 2022/23.
  const card = text(renderToStaticMarkup(createElement(YearTable, { data: g, measure: ENTRIES_MEASURE, focusKey: null, nameHeading: "Grade", showRank: false })));
  assert.match(card, /2022\/23 2024\/25 Change/);
  assert.match(card, /9 11 13 \+2/);
  assert.match(card, /\+2 more years/);
});
