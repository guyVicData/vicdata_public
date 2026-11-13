// Run: npx -y tsx --test --test-force-exit src/lib/front-door/walks.test.tsx
// VicData 0.8 front door: R-WALK-RHYTHM, R-WALK-KEYS and R-DUMBBELL on a fixture model (the rule runners run
// the same checks on real schools). No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WALKS, walkById } from "./walks";
import { buildTeacherModel, type TeacherModelInput } from "./teacher-model";
import { dumbbellRows, teacherScreen } from "./teacher-screens";
import { dumbbellProblems, keyProblems, walkConfigProblems, walkScreenProblems } from "./walks-check";
import { palette, WalkChart } from "../../components/front-door/charts";

const G = "GCSE (9-1) Full Course";
const row = (subject: string, family: string, byYear: [number, number, number | null][]) =>
  byYear.map(([period, entriesTotal, avgPointScore]) => ({ subject, familyId: family, familyLabel: family === "humanities_social" ? "Humanities" : "Sciences", period, entriesTotal, entriesShareOfSchoolPercent: null, entriesShareOfFamilyPercent: null, avgPointScore, pointsCoveragePercent: null }));
const subjects: [string, string, number[], (number | null)[]][] = [
  ["Geography", "humanities_social", [62, 70, 74, 84], [null, 5.1, 5.2, 5.4]],
  ["History", "humanities_social", [95, 90, 88, 92], [null, 5.0, 5.1, 5.2]],
  ["Religious Studies", "humanities_social", [50, 55, 58, 61], [null, 4.8, 4.9, 5.0]],
  ["Maths", "sciences_maths", [176, 178, 179, 180], [null, 5.0, 5.0, 5.1]],
  ["French", "languages", [80, 72, 66, 64], [null, 5.5, 5.4, 5.3]],
];
const P = [2021, 2022, 2023, 2024];
const input: TeacherModelInput = {
  phase: "ks4",
  school: { urn: "1", name: "Test School" },
  entries: subjects.flatMap(([s, , e]) => e.map((v, i) => ({ subject: s, qualificationType: G, period: P[i], entries: v }))),
  gradeRows: [{ subject: "Geography", qualificationType: G, period: 2024, grade: "9", entries: 6 }, { subject: "Geography", qualificationType: G, period: 2024, grade: "5", entries: 30 }, { subject: "Geography", qualificationType: G, period: 2024, grade: "4", entries: 48 }] as TeacherModelInput["gradeRows"],
  headline: subjects.flatMap(([s, f, e, p]) => row(s, f, e.map((v, i) => [P[i], v, p[i]] as [number, number, number | null]))),
  qualificationHeadline: [],
  england: { basis: "subject", values: P.slice(1).map((p) => ({ key: "Geography", period: p, value: 5.0 })) },
  area: {
    la: { name: "Shire", rows: P.map((p, i) => ({ period: p, entries: 1000 + i * 20, avgPointScore: i ? 4.9 : null })) },
    region: { name: "South East", rows: P.map((p, i) => ({ period: p, entries: 9000 + i * 100, avgPointScore: i ? 4.9 : null })) },
    england: { name: "England", rows: P.map((p, i) => ({ period: p, entries: 100000 + i * 900, avgPointScore: i ? 4.85 : null })) },
  },
  nearest: [
    { urn: "2", name: "Near A", distanceKm: 1.2, headline: row("Geography", "humanities_social", P.map((p, i) => [p, 50 + i, i ? 5.6 : null])), qualificationHeadline: [] },
    { urn: "3", name: "Near B", distanceKm: 2.5, headline: row("Geography", "humanities_social", P.map((p, i) => [p, 40, i ? 4.9 : null])), qualificationHeadline: [] },
  ],
  nearestNote: null,
  englandGradeShare: { "9": 0.04, "5": 0.15, "4": 0.17 },
  coords: { "1": { easting: 450000, northing: 250000 }, "2": { easting: 451000, northing: 251000 }, "3": { easting: 449000, northing: 248000 } },
};
const m = buildTeacherModel(input, `Geography::${G}`);

test("R-WALK-RHYTHM: every walk's screens are real views, in the one rhythm; Results walks on Average points", () => {
  assert.deepEqual(walkConfigProblems(), []);
  for (const id of ["gcse-many", "gcse-well", "gcse-nearby", "post16-many", "post16-well", "post16-nearby"]) assert.ok(walkById(id), id);
  assert.equal(walkById("gcse-many")!.screens.length, 6);
  assert.equal(walkById("gcse-well")!.screens.length, 6);
  assert.equal(walkById("gcse-nearby")!.screens.length, 5);
  assert.ok(WALKS.filter((w) => w.product === "smt" || w.product === "admissions" || w.product === "group").every((w) => w.screens.length >= 5), "one walk per role home card");
});

test("R-WALK-RHYTHM: on data, every screen answers in a sentence; region is never a line", () => {
  assert.deepEqual(walkScreenProblems(m), []);
  const many1 = teacherScreen(m, walkById("gcse-many")!, 0);
  assert.equal(many1.answer, "84 pupils took Geography in 2024/25, 10 more than the year before.");
  const area = teacherScreen(m, walkById("gcse-many")!, 5).chart;
  assert.equal(area.kind, "lines");
  if (area.kind === "lines") {
    assert.deepEqual(area.series.map((s) => s.role), ["focus", "nearest", "la", "england"]);
    assert.deepEqual(area.extraRows?.map((r) => r.label), ["South East"], "region in the table only");
  }
  // An unpublished year is dotted and labelled (and keyed).
  const trend = teacherScreen(m, walkById("gcse-well")!, 4);
  assert.equal(trend.chart.kind, "lines");
});

test("R-WALK-KEYS: every walk chart has a key entry for every colour and mark; line labels are HTML", () => {
  for (const w of WALKS.filter((x) => x.product === "gcse")) {
    w.screens.forEach((_, i) => {
      const c = teacherScreen(m, w, i).chart;
      assert.deepEqual(keyProblems(c), [], `${w.id} ${i + 1}`);
      const html = renderToStaticMarkup(createElement(WalkChart, { chart: c, p: palette({ dark: false, accent: { hex: "#34d399", light: "#12a05c" }, categoryId: m.category.id }) }));
      if (c.kind === "lines") {
        assert.doesNotMatch(html, /<text[\s>]/, `${w.id} ${i + 1}: no SVG text`);
        assert.match(html, /data-html-label="end"/, `${w.id} ${i + 1}: end labels`);
        assert.match(html, /data-html-label="year"/);
        assert.match(html, /vector-effect="non-scaling-stroke"/);
      }
      if (c.keys.length) assert.match(html, /data-chart-key=""/);
    });
  }
  // Peers: shades of their category colour, each with its own marker shape.
  const peers = teacherScreen(m, walkById("gcse-many")!, 3).chart;
  if (peers.kind === "lines") {
    const p = peers.series.filter((s) => s.role === "peer");
    assert.ok(p.length >= 2);
    assert.equal(new Set(p.map((s) => s.marker)).size, p.length);
    assert.equal(new Set(p.map((s) => s.shade)).size, p.length);
  }
});

test("R-DUMBBELL: ordered by the latest entries, the focus tinted, the school average last, the change the data's", () => {
  assert.deepEqual(dumbbellProblems(m), []);
  const d = dumbbellRows(m)!;
  assert.deepEqual(d.rows.map((r) => r.label), ["Maths", "History", "Geography", "French", "Religious Studies", "School average"]);
  assert.equal(d.rows.find((r) => r.role === "focus")!.label, "Geography");
  assert.deepEqual(d.rows.filter((r) => r.role === "peer").map((r) => r.label), ["History", "Religious Studies"], "same-category subjects in the category colour");
  const geo = d.rows.find((r) => r.label === "Geography")!;
  assert.equal(geo.latest - geo.first, 22);
  const html = renderToStaticMarkup(createElement(WalkChart, { chart: teacherScreen(m, walkById("gcse-many")!, 4).chart, p: palette({ dark: false, accent: { hex: "#34d399", light: "#12a05c" }, categoryId: "humanities_social" }) }));
  assert.match(html, /data-dumbbell-row="focus"[^>]*style="background:/, "the focus row tinted");
  assert.match(html, /▲ 22/);
  assert.doesNotMatch(html, /#(15803d|b91c1c|dc2626|16a34a)/, "no green/red for change");
  assert.match(html, /data-dumbbell-row="average"/);
});
