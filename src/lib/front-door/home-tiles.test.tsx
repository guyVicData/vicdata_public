// Run: npx -y tsx --test --test-force-exit src/lib/front-door/home-tiles.test.tsx
// VicData 0.8 front door: R-HOME-TILES -- every home tile has a question, a real figure or none, an icon
// row matching its walk's screens (each the view's own rail icon and name), and one arrow action. No
// database: the tiles render on the server; the figures come from a model built from synthetic rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionTile, walkHref } from "../../components/front-door/home";
import { GROUP_VIEW_META, screenMeta, WALKS } from "./walks";
import { buildTeacherModel, teacherTileFigures, type TeacherModelInput } from "./teacher-model";

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

test("R-HOME-TILES: every walk's tile has its question, an icon per screen in order, and one arrow", () => {
  for (const walk of WALKS.filter((w) => w.screens.length)) {
    for (const figure of [{ figure: "84", unit: "pupils this year" }, null]) {
      const html = renderToStaticMarkup(createElement(QuestionTile, { walk, figure, ctx: { subject: "Geography", category: "Humanities", entry: "11+" }, href: walkHref(walk, { subject: "Geography::GCSE (9-1) Full Course" }) }));
      assert.match(html, /<h3[^>]*>[^<]{8,}<\/h3>/, `${walk.id}: a question`);
      assert.doesNotMatch(html, /\[(subject|category|entry)\]/, `${walk.id}: the template filled`);
      assert.equal(count(html, /data-tile-action=""/g), 1, `${walk.id}: one arrow action`);
      const icons = Array.from(html.matchAll(/data-screen-icon="([^"]+)"/g)).map((m) => m[1]);
      assert.deepEqual(icons, walk.screens.map((s) => s.view), `${walk.id}: icon row = the walk's screens, in order`);
      for (const s of walk.screens) {
        const meta = screenMeta(s.view);
        assert.ok(meta, `${walk.id}: ${s.view} is a real view`);
        assert.ok(html.includes(`title="${meta!.label.replace(/'/g, "&#x27;")}"`), `${walk.id}: ${s.view} named on hover`);
      }
      assert.equal(count(html, /data-tile-figure=""/g), figure ? 1 : 0, `${walk.id}: a figure only when real`);
    }
  }
});

test("R-HOME-TILES: the group views' names match the group dashboard's own (GROUP_VIEWS)", () => {
  const src = readFileSync(path.join(__dirname, "../../components/groups/dash/GroupDashboard.tsx"), "utf8");
  for (const [id, meta] of Object.entries(GROUP_VIEW_META)) {
    const m = new RegExp(`"${id}": \\{ label: "([^"]+)", icon: "([^"]+)" \\}`).exec(src);
    assert.ok(m, `${id} in GROUP_VIEWS`);
    assert.equal(m![1], meta.label, `${id} label`);
    assert.equal(m![2], meta.icon, `${id} icon`);
  }
});

const ROWS = (subject: string, family: string, byYear: [number, number, number | null][]) =>
  byYear.map(([period, entriesTotal, avgPointScore]) => ({ subject, familyId: family.toLowerCase(), familyLabel: family, period, entriesTotal, entriesShareOfSchoolPercent: null, entriesShareOfFamilyPercent: null, avgPointScore, pointsCoveragePercent: null }));
const GCSE = "GCSE (9-1) Full Course";
function input(over: Partial<TeacherModelInput> = {}): TeacherModelInput {
  return {
    phase: "ks4",
    school: { urn: "1", name: "Test School" },
    entries: [
      { subject: "Geography", qualificationType: GCSE, period: 2024, entries: 78 },
      { subject: "Geography", qualificationType: GCSE, period: 2025, entries: 84 },
      { subject: "History", qualificationType: GCSE, period: 2025, entries: 92 },
    ],
    gradeRows: [],
    headline: [...ROWS("Geography", "Humanities", [[2024, 78, 5.1], [2025, 84, 5.4]]), ...ROWS("History", "Humanities", [[2024, 90, 5.0], [2025, 92, 5.2]])],
    qualificationHeadline: [],
    england: null,
    area: { la: null, region: null, england: null },
    nearest: [
      { urn: "2", name: "Near A", distanceKm: 1, headline: ROWS("Geography", "Humanities", [[2025, 60, 5.6]]), qualificationHeadline: [] },
      { urn: "3", name: "Near B", distanceKm: 2, headline: ROWS("Geography", "Humanities", [[2025, 40, 4.9]]), qualificationHeadline: [] },
    ],
    nearestNote: null,
    ...over,
  };
}

test("R-HOME-TILES: Teacher's figures are the data's, or none -- never a placeholder", () => {
  const m = buildTeacherModel(input(), "Geography::" + GCSE);
  const f = teacherTileFigures(m);
  assert.deepEqual(f.many, { figure: "84", unit: "pupils this year" });
  assert.deepEqual(f.well, { figure: "5.4", unit: "average points" });
  assert.equal(f.nearby?.figure, "2nd");
  // No points published: no figure, not "0" or "—".
  const none = teacherTileFigures(buildTeacherModel(input({ headline: ROWS("Geography", "Humanities", [[2025, 84, null]]), nearest: [] }), "Geography::" + GCSE));
  assert.equal(none.well, null);
  assert.equal(none.nearby, null);
  // A school with no subjects at all: no focus, no figures.
  const empty = teacherTileFigures(buildTeacherModel(input({ entries: [], headline: [] }), null));
  assert.deepEqual(empty, { many: null, well: null, nearby: null });
});
