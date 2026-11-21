// Run: node --env-file=.env --env-file=.env.local --import tsx --test --test-force-exit src/lib/panel-csv-teacher.test.ts
// Panel menu "Save as CSV" (21 Nov), Teacher: the GCSE and Post-16 dashboards' leaves (and so the custom
// dashboards, meeting slides and v2 views drawn from them) register their own rows
// (src/components/teacher/csv.ts, csv-hooks.tsx).
//   R-PANEL-CSV-ROWS        a leaf's CSV is the rows it draws, in the order drawn, each figure at the
//                           precision printed (a number, its unit in the header).
//   R-PANEL-CSV-SUPPRESSED  a figure the screen withholds keeps the screen's words, never the number.
// Each leaf is drawn on the server with a probe (TeacherCsvProbe) that hands over the builder it
// registers; the test compares that builder's rows with the leaf's own markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CsvTable } from "./csv";
import { toCsv, parseCsv } from "./csv";
import { ENTRIES_MEASURE, measuresFor, type PanelData } from "./teacher-view-panels";
import { TeacherCsvAbout, TeacherCsvProbe } from "@/components/teacher/csv-hooks";
import { BENCH_WITHHELD, figureColumn, readFigure } from "@/components/teacher/csv";
import { SortTable, type SortRow } from "@/components/teacher/SortTable";
import { YearTable, ChangeList } from "@/components/teacher/SeriesViews";
import { SchoolRankingTable, type SchoolRankingRow } from "@/components/teacher/SchoolRankingTable";
import { GradeDistribution } from "@/components/teacher/GradeDistribution";
import { NumberTiles } from "@/components/teacher/NumberTiles";
import { ViewChart } from "@/components/teacher/ViewChart";
import { TrendChart } from "@/components/teacher/TrendChart";
import { ShareDonut } from "@/components/teacher/ShareDonut";

const POINTS = measuresFor("ks4").find((m) => m.id === "points")!;
const RATE = measuresFor("ks4").find((m) => m.id === "threshold")!;

/** Draw a leaf; return its markup and the table it registers (the last builder handed over). */
function drawn(node: ReactElement, about?: { year?: string | null; set?: string | null }): { html: string; table: CsvTable | null } {
  let build: (() => CsvTable | null) | null = null;
  const wrapped = about ? createElement(TeacherCsvAbout.Provider, { value: about }, node) : node;
  const html = renderToStaticMarkup(createElement(TeacherCsvProbe.Provider, { value: (b) => (build = b) }, wrapped));
  return { html, table: build ? (build as () => CsvTable | null)() : null };
}

const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, "")).trim();
/** The <td> texts of each body <tr>. */
function tableCells(html: string): string[][] {
  const body = html.slice(html.indexOf("<tbody"));
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textOf(c[1])));
}
/** A cell as the CSV writes it, as text (what a spreadsheet reads back). */
const asText = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// ------------------------------------------------------------------ the figures, read back

test("R-PANEL-CSV-ROWS: a printed figure is read back at its own precision, its unit in the header", () => {
  assert.deepEqual(readFigure("45%"), { n: 45, unit: "%" });
  assert.deepEqual(readFigure("+3pp"), { n: 3, unit: "pp" });
  assert.deepEqual(readFigure("−0.4"), { n: -0.4, unit: "" });
  assert.deepEqual(readFigure("±0"), { n: 0, unit: "" });
  assert.deepEqual(readFigure("1,204"), { n: 1204, unit: "" });
  assert.deepEqual(readFigure("=3rd"), { n: 3, unit: "rank" });
  assert.equal(readFigure("—"), null);
  assert.equal(readFigure("too few entries"), null);
  assert.deepEqual(figureColumn("Result", ["45%", "—", "12%"]), { header: "Result (%)", cells: [45, "—", 12] });
  assert.deepEqual(figureColumn("vs National", ["+3pp", "−1pp"]), { header: "vs National (percentage points)", cells: [3, -1] });
});

// ------------------------------------------------------------------ SortTable (Results' and Context's table)

test("R-PANEL-CSV-ROWS: SortTable -- the rows in the order drawn, each figure as printed", () => {
  const rows: SortRow[] = [
    { key: "maths", label: "Maths", value: 5.3, valueLabel: POINTS.format(5.3), delta: 0.4, deltaLabel: POINTS.formatDelta(0.4) },
    { key: "physics", label: "Physics", value: null, valueLabel: "—", delta: null, deltaLabel: "—" },
    { key: "art", label: "Art & Design", value: 6.1, valueLabel: POINTS.format(6.1), delta: -0.2, deltaLabel: POINTS.formatDelta(-0.2) },
  ];
  const { html, table } = drawn(createElement(SortTable, { rows, sort: { key: "value", dir: "desc" }, onSort: () => {}, columns: { name: "Subject", value: "Result", delta: "vs National" } }), { year: "2024/25" });
  assert.ok(table);
  assert.deepEqual(table!.columns, ["Subject", "Result", "vs National"]);
  // The screen's rows: each name then its two figures, in the drawn order (value descending, the
  // figureless row last).
  const screen = ["Art & Design", "Maths", "Physics"].map((name) => {
    const at = html.indexOf(`title="${name.replace("&", "&amp;")}"`);
    return textOf(html.slice(html.indexOf(">", at) + 1, html.indexOf("</div>", at))).replace(name, "").trim();
  });
  assert.deepEqual(table!.rows.map((r) => r[0]), ["Art & Design", "Maths", "Physics"]);
  assert.deepEqual(screen, ["6.1−0.2", "5.3+0.4", "——"]);
  assert.deepEqual(table!.rows, [["Art & Design", 6.1, -0.2], ["Maths", 5.3, 0.4], ["Physics", "—", "—"]]);
  assert.deepEqual(table!.about, { year: "2024/25" }, "a Current table rests on its panel's year");
  // The file: the year leads, the figures are numbers.
  assert.deepEqual(parseCsv(toCsv(table!))[1], ["2024/25", "Art & Design", "6.1", "-0.2"]);
});

// ------------------------------------------------------------------ YearTable (every Trends table)

test("R-PANEL-CSV-ROWS: YearTable -- every year's figure and the change, as the full-screen table draws them", () => {
  const data: PanelData = {
    periods: [2022, 2023, 2024],
    series: [
      { key: "maths", label: "Maths", colour: "#000", values: [120, 131, 140] },
      { key: "art", label: "Art", colour: "#111", values: [40, null, 32] },
      { key: "music", label: "Music", colour: "#222", values: [null, 10, 10] },
    ],
  };
  const { html, table } = drawn(createElement(YearTable, { data, measure: ENTRIES_MEASURE, focusKey: "maths", fullscreen: true }), { year: "2024/25" });
  assert.ok(table);
  assert.deepEqual(table!.columns, ["Rank", "Subject", "2022/23", "2023/24", "2024/25", "Change", "Change (%)"]);
  assert.equal(table!.about?.year, null, "a trend table has its own years: no Data year column");
  const cells = tableCells(html);
  assert.equal(cells.length, 3);
  for (const [i, row] of table!.rows.entries()) {
    const screen = cells[i];
    assert.equal(screen[0], row[1], "the name");
    assert.equal(screen[1], `${row[0]} of 3`, "the rank");
    assert.deepEqual(screen.slice(2, 5), row.slice(2, 5).map((v) => (typeof v === "number" ? ENTRIES_MEASURE.format(v) : asText(v))), "each year");
    assert.equal(screen[5], `${ENTRIES_MEASURE.formatDelta(row[5] as number)}${row[6] === "—" ? "" : `${(row[6] as number) > 0 ? "+" : row[6] === 0 ? "±" : "−"}${Math.abs(row[6] as number)}%`}`, "the change and its %");
  }
  assert.deepEqual(table!.rows[1], [2, "Art", 40, "—", 32, -8, -20], "a year with no figure stays the screen's dash");
  assert.deepEqual(table!.rows[2], [3, "Music", "—", 10, 10, 0, 0]);
});

// ------------------------------------------------------------------ SchoolRankingTable (Comparisons' Ranking)

test("R-PANEL-CSV-SUPPRESSED: Comparisons' ranking -- a school with too few entries keeps the words, never a number", () => {
  const rows: SchoolRankingRow[] = [
    { key: "1", name: "Leighton Park", rank: 2, value: 62, valueLabel: RATE.format(62), distanceKm: null, independent: true, isTarget: true },
    { key: "2", name: "Reading Blue Coat", rank: 1, value: 71, valueLabel: RATE.format(71), distanceKm: 3.24, independent: true, isTarget: false },
    // R-MIN-ENTRIES: listed, not placed -- the figure exists upstream, the screen withholds it.
    { key: "3", name: "Small School", rank: null, value: null, valueLabel: "too few entries", distanceKm: 5.06, independent: false, isTarget: false },
  ];
  const { html, table } = drawn(createElement(SchoolRankingTable, { rows, valueHeading: RATE.label, targetName: "Leighton Park" }), { year: "2024/25", set: "10 nearest schools" });
  assert.ok(table);
  assert.deepEqual(table!.columns, ["Rank", "School", "Sector", `${RATE.label} (%)`, "Distance from Leighton Park (km)"]);
  assert.deepEqual(table!.about, { year: "2024/25", set: "10 nearest schools" });
  const cells = tableCells(html);
  assert.deepEqual(cells.map((c) => c[1].replace(/(Independent|State-funded)$/, "")), table!.rows.map((r) => r[1]), "the order drawn");
  assert.deepEqual(cells.map((c) => c[2]), ["71%", "62%", "too few entries"]);
  assert.deepEqual(table!.rows.map((r) => r[3]), [71, 62, "too few entries"]);
  assert.deepEqual(table!.rows.map((r) => r[4]), [3.2, "—", 5.1], "the distance at the screen's one place; the school's own row a dash");
  assert.ok(toCsv(table!).includes("Small School,State-funded,too few entries,5.1"));
});

// ------------------------------------------------------------------ GradeDistribution (Grade bands, Grade counts)

test("R-PANEL-CSV-SUPPRESSED: a grade England withholds (fewer than 5 schools) is written as the words, not a share", () => {
  const rows = [
    { grade: "9", ownCount: 6, benchPct: null },
    { grade: "8", ownCount: 10, benchPct: 11.6 },
    { grade: "7", ownCount: 4, benchPct: 14.2 },
  ];
  const { html, table } = drawn(createElement(GradeDistribution, { rows, total: 20, colour: "#000", range: null, pending: null, benchLabel: "England" }), { year: "2024/25" });
  assert.ok(table);
  assert.deepEqual(table!.columns, ["Grade", "Entries", "Share of graded entries (%)", "England (%)"]);
  assert.deepEqual(table!.rows, [["9", 6, 30, BENCH_WITHHELD], ["8", 10, 50, 12], ["7", 4, 20, 14]]);
  // The screen: each row's "share% · count", and the withheld grade's tick missing with the same words.
  const figures = [...html.matchAll(/<span class="[^"]*w-16[^"]*">([\s\S]*?)<\/span>/g)].map((m) => textOf(m[1]).split(" · ")).map(([share, n]) => [Number(n), Number(share.replace("%", ""))]);
  assert.deepEqual(figures, table!.rows.map((r) => [r[1], r[2]]));
  assert.ok(html.includes("not shown for this grade (fewer than 5 schools)"));
  assert.ok(!html.includes('title="England: 0%"'), "no tick drawn at a withheld grade");
});

// ------------------------------------------------------------------ NumberTiles, ViewChart, ShareDonut, TrendChart

test("R-PANEL-CSV-ROWS: number tiles -- the main figure and each tile, figures as numbers with their unit", () => {
  const main = { figure: "5.3", label: "Maths average points in 2024/25" };
  const tiles = [
    { key: "category", icon: null, figure: "=2nd", detail: "of 5 in Sciences" },
    { key: "england", icon: null, figure: "+0.4", detail: "above the England average" },
  ];
  const { html, table } = drawn(createElement(NumberTiles, { main, tiles }));
  assert.ok(table);
  for (const t of [main.figure, ...tiles.map((t) => t.figure)]) assert.ok(html.includes(`>${t}</`), `the screen draws ${t}`);
  assert.deepEqual(table!.rows, [
    ["Maths average points in 2024/25", 5.3, ""],
    ["of 5 in Sciences", 2, "place (shared)"],
    ["above the England average", 0.4, ""],
  ]);
});

test("R-PANEL-CSV-ROWS: bars -- each bar's printed figure, a bar with no figure the screen's dash, the marker", () => {
  const computed = { rows: [{ label: "Maths", value: 62, isSubject: true, marker: 55 }, { label: "Art", value: null, isSubject: true, marker: null }] };
  const { html, table } = drawn(createElement(ViewChart, { computed, unit: "", layout: "row", formatValue: RATE.format, markerLabel: "National average", csvHeadings: { name: "Subject", value: "Result" } }));
  assert.ok(table);
  assert.ok(html.includes(">62%</span>") && html.includes(">—</span>"));
  assert.deepEqual(table!.columns, ["Subject", "Result (%)", "National average (%)"]);
  assert.deepEqual(table!.rows, [["Maths", 62, 55], ["Art", "—", null]]);
});

test("R-PANEL-CSV-ROWS: the donut -- the two slices with the figures and shares it prints", () => {
  const { html, table } = drawn(createElement(ShareDonut, { percent: 23.6, label: "Maths", groupLabel: "All subjects", valueLabel: "1,204", groupValueLabel: "3,900", colour: "#000" }));
  assert.ok(html.includes(">24<!-- -->%</text>") || html.includes(">24%</text>"));
  assert.deepEqual(table!.rows, [["Maths", 1204, 24], ["All other entries", 3900, 76]]);
});

test("R-PANEL-CSV-ROWS: a trend chart -- a row per year, a column per line, at the measure's precision", () => {
  const data: PanelData = { periods: [2022, 2023, 2024], series: [{ key: "own", label: "Your school", colour: "#000", values: [5.24, null, 5.61] }, { key: "versus", label: "Average", colour: "#111", values: [5.0, 5.1, 5.2] }] };
  const { table } = drawn(createElement(TrendChart, { data, measure: POINTS }), { year: "2024/25" });
  assert.deepEqual(table!.columns, ["Year", "Your school", "Average"]);
  assert.deepEqual(table!.rows, [["2022/23", 5.2, 5], ["2023/24", "—", 5.1], ["2024/25", 5.6, 5.2]]);
  assert.equal(table!.about?.year, null);
});

test("R-PANEL-CSV-ROWS: ranked change -- the order drawn, each change as printed, the set's average last ('no figure' as words)", () => {
  const rows = [
    { key: "a", label: "Maths", colour: "#000", value: 12.4 },
    { key: "b", label: "Art", colour: "#111", value: -3 },
  ];
  const { html, table } = drawn(createElement(ChangeList, { rows, focusKey: "a", group: { label: "Average across the 10 nearest schools", value: null } }));
  assert.ok(html.includes("+12%") && html.includes("−3%") && html.includes("no figure"));
  assert.deepEqual(table!.columns, ["Rank", "Name", "Change (%)"]);
  assert.deepEqual(table!.rows, [[1, "Maths", 12], [2, "Art", -3], [null, "Average across the 10 nearest schools", "no figure"]]);
});
