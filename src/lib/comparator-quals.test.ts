// 0.6.5 S3 (R-POINTS-SAME-QUAL): Post-16 Comparisons and maps on the exact qualification.
// Run: npx -y tsx --test src/lib/comparator-quals.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { exactQualificationLabel, qualificationShortLabel } from "./teacher-view-theme";
import { seriesFromQualificationRows } from "./teacher-view-comparator-quals";

test("a Post-16 qualification by its own short name; Column 1's bucket label is unchanged", () => {
  const cases: [string, string][] = [
    ["GCE A level", "A level"],
    ["GCE AS level", "AS level"],
    ["GCE AS level (Not continued to A2)", "AS level"],
    ["IBO Higher level component", "IB Higher level"],
    ["IBO Standard level component", "IB Standard level"],
    ["BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*", "BTEC Extended Diploma"],
    ["BTEC National Diploma L3 - Band J - PP-D*D*", "BTEC Diploma"],
    ["BTEC National Extended Certificate L3 - Band F - P-D*", "BTEC Extended Certificate"],
    ["BTEC National Foundation Diploma L3 - Band H - P-D*", "BTEC Foundation Diploma"],
    ["BTEC Level 3 National Certificate (Band D)", "BTEC Certificate"],
    ["OCR Cambridge Technical Extended Certificate at Level 3", "Cambridge Technical Extended Certificate"],
    ["T Level", "T Level"],
    ["Core Maths Qualifications at Level 3", "Core Maths"],
    ["Extended Project (Diploma)", "EPQ"],
  ];
  for (const [q, want] of cases) assert.equal(exactQualificationLabel(q), want, q);
  // The bucket label Column 1 and the picker use stays as it was.
  assert.equal(qualificationShortLabel("ks5", "GCE AS level"), qualificationShortLabel("ks5", "GCE A level"));
});

test("exact rows as Comparisons' series: points where published, entries where published", () => {
  const s = seriesFromQualificationRows([
    { period: 2021, entries: 28, avgPointScore: 31.16 },
    { period: 2022, entries: 28, avgPointScore: null },
    { period: 2023, entries: null, avgPointScore: 27.39 },
  ]);
  assert.deepEqual(s.results, [{ period: 2021, value: 31.16 }, { period: 2023, value: 27.39 }]);
  assert.deepEqual(s.candidates, [{ period: 2021, value: 28 }, { period: 2022, value: 28 }]);
});

// 0.6.5 S5: the Post-16 ranking headline is A-level points per entry; no A levels, a note.
test("the ranking tiles give way to the note when the school has no figure for a known reason", async () => {
  const { buildSeries } = await import("./view-series");
  const { presetSpec } = await import("@/catalogue/viewspec");
  const { headlineMeasure } = await import("./teacher-view-panels");
  const measure = headlineMeasure("ks5", "average points per A-level entry");
  const frame = (noFigureNote: string | null, target: { period: number; value: number } | null) => ({
    kind: "comparisons" as const, periods: [2024], schools: [], measure, targetName: "Sevenoaks School", setLabel: "National ranking", comparedOn: "x", titleOn: "x",
    versus: { urn: "average" as const, label: "Average" }, onRankingMeasure: true, setKind: "nearest" as const, subjectLabel: null, blocked: false, state: { trendStart: null, changeStart: null, showFit: false },
    ranking: { averageAt: () => 38.2, figures: { ranked: 2100, targetRank: target ? 12 : null, target, averageLatest: 38.2, measure, measureName: "average points per A-level entry", noFigureNote } },
  });
  const tilesSpec = presetSpec("DV-C3-CUR-TILES" as never);
  const note = "Sevenoaks School has no A-level entries. Post-16 rankings use A-level points per entry.";
  const withNote = buildSeries(tilesSpec, frame(note, null), { fullscreen: false });
  assert.equal(withNote?.leaf.leaf, "numberTiles");
  assert.equal((withNote?.leaf as { note?: string }).note, note);
  // A school with a figure: tiles as before, no note.
  const normal = buildSeries(tilesSpec, frame(note, { period: 2024, value: 41.2 }), { fullscreen: false });
  assert.equal((normal?.leaf as { note?: string }).note, undefined);
  assert.ok((normal?.leaf as { main: unknown }).main);
});
