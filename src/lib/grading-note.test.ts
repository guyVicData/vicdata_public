// 0.6.2 S4 / S4b, R-TREND-FROM-2223 (replacing R-2122-GRADING-NOTE): a grade or points trend
// whose years include 2021/22 carries the note (trends are measured from 2022/23) after its
// source -- in the panel's "i", and printed as text in fullscreen and in "Print this graph"
// (the same fullscreen modal, printed). Never on a latest-year view, on entries, at KS2, or
// on a trend that starts after 2021/22. (What the rule measures: src/lib/trend-base.test.ts.)
// Run: npx -y tsx --test src/lib/grading-note.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TREND_BASE_NOTE, trendBaseApplies, trendNoteFor, specYears } from "@/catalogue/notes";
import { presetSpec } from "@/catalogue/viewspec";
import { ruleById } from "@/catalogue";
import { OpenInFullscreen } from "@/components/teacher/CardBox";
import { SubjectPanels } from "@/components/teacher/SubjectPanels";
import { GradeCountsPanels } from "@/components/teacher/GradeCountsPanels";
import { ComparisonsPanels } from "@/components/teacher/ComparisonsPanels";
import { ENTRIES_MEASURE, headlineMeasure, measuresFor, type PanelId } from "./teacher-view-panels";

const [POINTS, THRESHOLD, BANDS, COUNTS] = measuresFor("ks4");
const FOUR = [2021, 2022, 2023, 2024];
const NOTE = /Trends are measured from 2022\/23\. 2021\/22 is still shown, but its grades were awarded more generously \(Ofqual&#x27;s transition year after the pandemic\), so measuring from it would make most schools look as if results had fallen\./;
// The fullscreen modal's source line (CardBox): the same paragraph "Print this graph" prints.
const MODAL_SOURCE = /<p class="text-\[11px\] leading-relaxed text-\[var\(--source\)\]">(.*?)<\/p>/;

// Every CardBox opened in fullscreen (a server render can't click), as Print opens it.
const open = (el: ReactElement) => renderToStaticMarkup(createElement(OpenInFullscreen.Provider, { value: true }, el));
const modalSource = (html: string) => {
  assert.match(html, /role="dialog"/, "the fullscreen modal is drawn");
  return html.match(MODAL_SOURCE)?.[1] ?? "";
};

test("the rule and its wording: one constant, one rule", () => {
  assert.equal(TREND_BASE_NOTE, "Trends are measured from 2022/23. 2021/22 is still shown, but its grades were awarded more generously (Ofqual's transition year after the pandemic), so measuring from it would make most schools look as if results had fallen.");
  const rule = ruleById("R-TREND-FROM-2223");
  assert.ok(rule && rule.status === "active");
  assert.ok(rule.enforcedIn.some((e) => e.startsWith("src/catalogue/notes.ts")));
});

test("which figures: grades and points above KS2, never entries", () => {
  for (const m of ["points", "threshold", "bands", "counts"]) {
    assert.equal(trendBaseApplies(m, "ks4"), true, m);
    assert.equal(trendBaseApplies(m, "ks5"), true, m);
    assert.equal(trendBaseApplies(m, undefined), true, `${m}, no phase (SubjectPanels without a plan)`);
  }
  assert.equal(trendBaseApplies("entries", "ks4"), false);
  assert.equal(trendBaseApplies("points", "ks2"), false, "KS2's tests aren't in Ofqual's grading transition");
});

test("which years: a trend including 2021/22; not latest-year, not one trimmed to 2022/23 on", () => {
  assert.equal(trendNoteFor(FOUR), TREND_BASE_NOTE);
  assert.equal(trendNoteFor([2021, 2024]), TREND_BASE_NOTE, "two years, the first 2021/22 (Grade counts' spread, a slope)");
  assert.equal(trendNoteFor([2022, 2023, 2024]), null, "trimmed to 2022/23 on");
  assert.equal(trendNoteFor([2023, 2024]), null);
  assert.equal(trendNoteFor([2021]), null, "one year is not a trend");
  assert.equal(trendNoteFor(null), null);
  // Under views=v2: a latest-year spec has none; Grade counts' Spread by year (latest
  // against a picked year) keeps the host's years; a slope with a fixed first year uses it.
  assert.equal(specYears(presetSpec("DV-C1-RES-TR-CHART"), FOUR), FOUR);
  assert.equal(specYears(presetSpec("DV-C1-RES-CUR-BAR"), FOUR), null, "a latest-year view");
  assert.equal(specYears(presetSpec("DV-C1-RES-TR-MAP"), FOUR), null, "Results' Trend map plots one year");
  assert.deepEqual(specYears(presetSpec("DV-C1-CNT-TR-SPREAD"), [2021, 2024]), [2021, 2024]);
  const slope = presetSpec("DV-C1-RES-TR-CHART");
  const fixed = { ...slope, view: { kind: "slope" as const, look: {} }, data: { ...slope.data, years: { from: 2022, rollOn: true } } };
  assert.deepEqual(specYears(fixed as never, FOUR), [2022, 2024]);
  assert.equal(trendNoteFor(specYears(fixed as never, FOUR)), null);
});

// ------------------------------------------------------------- the hosts, in fullscreen

const subject = (values: (number | null)[]) => ({ key: "History::GCSE", label: "History", shortLabel: "History", colour: "#34d399", values });
const subjectPanels = (measure: typeof POINTS, periods: number[], values: (number | null)[], panels: PanelId[]) =>
  createElement(SubjectPanels, {
    columnId: "candidates",
    periods,
    subjects: [subject(values), { ...subject(values.map((v) => (v === null ? null : v * 0.9))), key: "Geography::GCSE", label: "Geography", shortLabel: "Geography" }],
    measure,
    focus: "History::GCSE",
    changeScope: "individual",
    questions: { current: "How well?", trend: "Moved?", change: "Most?" },
    source: (span?: string) => `Source: DfE${span ? `, ${span}` : ""}.`,
    panels,
    onPanelsChange: () => {},
    emptyText: "Pick a subject.",
  });

test("Results and Context: a points trend and a grade trend including 2021/22 print the note in fullscreen", () => {
  for (const [m, vals] of [[POINTS, [5.1, 4.8, 4.9, 5.0]], [THRESHOLD, [78, 71, 72, 74]], [BANDS, [40, 33, 35, 36]]] as const) {
    const src = modalSource(open(subjectPanels(m, FOUR, [...vals], ["trend"])));
    assert.match(src, /Source: DfE, 2021\/22–2024\/25\./, m.id);
    assert.match(src, NOTE, `${m.id}: the note follows the source`);
  }
});

test("Results and Context: no note on entries, on a trend from 2022/23, or on a latest-year (Current) view", () => {
  assert.doesNotMatch(open(subjectPanels(ENTRIES_MEASURE, FOUR, [30, 32, 31, 35], ["trend"])), NOTE, "entries");
  assert.doesNotMatch(open(subjectPanels(POINTS, [2022, 2023, 2024], [4.8, 4.9, 5.0], ["trend"])), NOTE, "from 2022/23");
  // Current open, Trends collapsed: the latest-year view's fullscreen carries no note.
  const current = open(subjectPanels(POINTS, FOUR, [5.1, 4.8, 4.9, 5.0], ["current"]));
  assert.match(modalSource(current), /Source: DfE/);
  assert.doesNotMatch(current, NOTE);
});

test("Grade counts: the spread against 2021/22 prints the note; against 2023/24, none", () => {
  const rows = (years: number[]) => years.flatMap((period) => ["9", "7", "4", "1"].map((grade, i) => ({ period, grade, entries: 10 + i + (period - 2021) })));
  const counts = (years: number[]) =>
    createElement(GradeCountsPanels, {
      columnId: "candidates", subjectLabel: "History", ownRows: rows(years), geography: null, colour: "#34d399",
      panels: ["trend"], onPanelsChange: () => {}, question: "How well?", source: (span?: string) => `Source: DfE${span ? `, ${span}` : ""}.`,
    });
  assert.equal(COUNTS.id, "counts");
  const from2122 = modalSource(open(counts([2021, 2024])));
  assert.match(from2122, /2021\/22–2024\/25/);
  assert.match(from2122, NOTE);
  // Four years: the spread compares with the year before the latest by default.
  assert.doesNotMatch(open(counts(FOUR)), NOTE);
});

test("Comparisons: Attainment 8 across schools from 2021/22 prints the note; candidates and KS2 don't", () => {
  const schools = [
    { urn: "1", name: "This school", isTarget: true, distanceKm: 0, independent: false },
    { urn: "2", name: "Other school", isTarget: false, distanceKm: 1.2, independent: false },
  ];
  const series = (v: number) => FOUR.map((period, i) => ({ period, value: v + i }));
  const seriesByUrn = { "1": { candidates: series(100), results: series(48) }, "2": { candidates: series(90), results: series(45) } };
  const comparisons = (phase: "ks4" | "ks2", measure: typeof POINTS) =>
    createElement(ComparisonsPanels, {
      phase, panels: ["trend"], onPanelsChange: () => {}, question: "Wider?", source: (span?: string) => `Source: DfE${span ? `, ${span}` : ""}.`,
      headlineLabel: "Attainment 8", setId: "nearest", activeSet: { id: "nearest", label: "10 nearest schools" } as never, setLabel: "10 nearest schools",
      schools: schools as never, seriesByUrn: seriesByUrn as never, measure, schoolUrn: "1", mapProfiles: null, activeMapChip: null,
      mapRank: null, onMapRank: () => {}, subjectLabel: null, seriesLoading: false, emptyText: "No schools.", targetName: "This school", threshold: null,
    } as never);
  const a8 = modalSource(open(comparisons("ks4", headlineMeasure("ks4", "Attainment 8"))));
  assert.match(a8, /2021\/22–2024\/25/);
  assert.match(a8, NOTE);
  assert.doesNotMatch(open(comparisons("ks4", ENTRIES_MEASURE)), NOTE, "candidates");
  assert.doesNotMatch(open(comparisons("ks2", headlineMeasure("ks2", "Expected standard"))), NOTE, "KS2");
});
