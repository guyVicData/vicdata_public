// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/chart-titles.test.tsx
// VicData 0.8 review fixes (14 Nov, M5): R-CHART-TITLES. Every view on every seeded dashboard has a catalogue
// title naming its measure, phase or cohort, and comparator; no two views on one dashboard share one; no
// title is a bare "Trends" or "Change"; one chart has one name on every dashboard; the walk's titles are the
// catalogue's, filled. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DASHBOARDS } from "@/catalogue/dashboards";
import { dataviewById } from "@/catalogue/dataviews";
import { GROUP_LAYOUT_IDS } from "@/lib/groups/dash-layout";
import { GROUP_VIEW_META, WALKS } from "./walks";
import { teacherScreen, walkTitle } from "./teacher-screens";
import type { TeacherModel } from "./teacher-model";

const BARE = /^(Trends?|Change|Chart|Table|Map|Results|Entries)$/i;

test("R-CHART-TITLES: every view on every seeded dashboard has a title; none bare; none shared on one dashboard", () => {
  const bad: string[] = [];
  for (const d of DASHBOARDS) {
    const seen = new Map<string, string>();
    for (const p of d.panels) {
      if (BARE.test(p.name ?? "x") && p.name !== "Results") bad.push(`${d.id} panel ${p.id}: "${p.name}"`);
      for (const v of p.dataviews) {
        if (v.kind !== "view") continue;
        const dv = dataviewById(v.dataview);
        const t = dv?.titleTemplate?.trim() ?? "";
        if (!t) bad.push(`${d.id} ${v.dataview}: no title`);
        if (BARE.test(t)) bad.push(`${d.id} ${v.dataview}: bare "${t}"`);
        if (seen.has(t) && seen.get(t) !== v.dataview) bad.push(`${d.id}: ${v.dataview} and ${seen.get(t)} share "${t}"`);
        seen.set(t, v.dataview);
      }
    }
  }
  assert.deepEqual(bad, []);
  // The three untitled Teacher views now have titles.
  for (const id of ["DV-C1-RES-CUR-TILES", "DV-C1-RES-CUR-GRADES", "DV-C1-CNT-CUR-DIST"]) assert.ok(dataviewById(id)!.titleTemplate, id);
  // Indexed and actual read differently.
  assert.notEqual(dataviewById("DV-C1-CAND-TR-INDEXED")!.titleTemplate, dataviewById("DV-C1-CAND-TR-ACTUAL")!.titleTemplate);
  assert.match(dataviewById("DV-C1-CAND-TR-INDEXED")!.titleTemplate, /indexed/);
});

test("R-CHART-TITLES: head office's views -- one chart, one name; no panel tag is a bare 'Trends'; SMT's market title says what it draws", () => {
  const label = (id: string) => GROUP_VIEW_META[id]?.label;
  assert.equal(label("GRP-O-ROLL"), label("GRP-P-ROLL"), "the same RollTrend, one name");
  assert.equal(label("GRP-O-RESULTS"), label("GRP-A-TREND"), "the same ResultsTrend, one name");
  const src = readFileSync("src/components/groups/dash/GroupDashboard.tsx", "utf8");
  assert.doesNotMatch(src, /tag: "Trends"/);
  for (const [dash, L] of Object.entries(GROUP_LAYOUT_IDS)) {
    const names = [...L.now, ...L.trends].flatMap((c) => c.views).map((v) => label(v)).filter(Boolean);
    assert.equal(new Set(names).size, names.length, `${dash}: no two views share a name`);
  }
  assert.match(readFileSync("src/components/smt/views/Lines.tsx", "utf8"), /Market share at 11\+: you and your largest rival/);
  assert.match(dataviewById("DV-SMT-O-MARKET-LINE")!.titleTemplate, /largest rival/);
});

test("R-CHART-TITLES: the Teacher walk's titles are the catalogue's, filled (no placeholder, the measure named)", () => {
  for (const name of ["teacher_137625_ks4_geography", "teacher_110110_ks5"]) {
    const m = JSON.parse(readFileSync(`docs/v0.8/review_14nov/fixtures/${name}.json`, "utf8")) as TeacherModel;
    for (const w of WALKS.filter((x) => x.product === (m.phase === "ks4" ? "gcse" : "post16")))
      w.screens.forEach((s, i) => {
        const t = teacherScreen(m, w, i).title;
        assert.doesNotMatch(t, /\[|\]/, `${w.id} ${i + 1}: ${t}`);
        if (dataviewById(s.view)?.titleTemplate) assert.notEqual(t, "", `${w.id} ${i + 1}`);
      });
    const many = WALKS.find((x) => x.id === `${m.phase === "ks4" ? "gcse" : "post16"}-many`)!;
    assert.match(teacherScreen(m, many, 0).title, /entries, \d{4}\/\d{2}$/);
    const well = WALKS.find((x) => x.id === `${m.phase === "ks4" ? "gcse" : "post16"}-well`)!;
    assert.match(teacherScreen(m, well, 2).title, /^Average points by subject in /);
  }
  assert.equal(walkTitle("DV-C2-CUR-BARS", { subject: "Geography", category: "Humanities", points: true, whole: true, first: "2021/22", latest: "2025/26", set: "10 nearest schools", school: "The Chase" }, "x"), "Average points by subject in the whole school, 2025/26");
});
