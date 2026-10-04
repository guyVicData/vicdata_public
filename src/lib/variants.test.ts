// 0.6 snagging round 4 / 02: one variant mechanism (src/catalogue/variants.ts) -- the Results
// pill generalised to Context's Compare against and Comparisons' comparator kind -- its
// rails, defaults per state and editor ops. Run: npx -y tsx --test src/lib/variants.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEACHER_DASHBOARDS, teacherDashboardFor } from "@/catalogue/dashboards";
import { configuredDefault, viewsOnResults } from "@/catalogue/results";
import {
  AXIS_STATES,
  configAxes,
  configuredDefaultFor,
  defaultOnState,
  effectiveStates,
  panelAxes,
  panelState,
  parseStateKey,
  showsOnState,
  stateKey,
  viewsOnState,
  withStates,
  withoutVariants,
  type VariantState,
} from "@/catalogue/variants";
import type { DashboardConfig, DataviewId, DataviewInstance } from "@/catalogue/types";
import { configViewIds } from "@/components/dashboard-config/rail";
import * as ops from "./editor-ops";

const view = (dataview: string, extra: Partial<Extract<DataviewInstance, { kind: "view" }>> = {}): DataviewInstance => ({ id: `x/${dataview}`, kind: "view", dataview: dataview as DataviewId, ...extra });
const panel = (c: DashboardConfig, id: string) => c.panels.find((p) => p.id === id)!;
const ids = (vs: DataviewInstance[]) => vs.map((v) => (v.kind === "view" ? v.dataview : v.id));
const gcse = () => teacherDashboardFor("ks4", "results");
const C2C = "vicdata.ks4.results.c2.current";
const C2T = "vicdata.ks4.results.c2.trends";
const C3C = "vicdata.ks4.results.c3.current";

test("effective states per axis: the dataview's default, or the instance's own within it", () => {
  // Context: every Compare against set by default (the pre-0.6 page never varied by it).
  assert.deepEqual(effectiveStates(view("DV-C2-CUR-BARS"), "compareAgainst"), ["category", "whole", "selected"]);
  assert.deepEqual(effectiveStates(view("DV-C2-CUR-BARS", { variants: { compareAgainst: ["selected", "category"] } }), "compareAgainst"), ["category", "selected"], "in pill order");
  // Comparisons: Number tiles only for a ranking, the maps only for a set of schools.
  assert.deepEqual(effectiveStates(view("DV-C3-CUR-TILES"), "comparator"), ["ranking"]);
  assert.deepEqual(effectiveStates(view("DV-C3-CUR-MAP"), "comparator"), ["schools"]);
  assert.deepEqual(effectiveStates(view("DV-C3-TR-CHANGEMAP"), "comparator"), ["schools"]);
  assert.deepEqual(effectiveStates(view("DV-C3-CUR-BAR"), "comparator"), ["schools", "ranking"]);
  // Never wider than the dataview can draw.
  assert.deepEqual(effectiveStates(view("DV-C3-CUR-TILES", { variants: { comparator: ["schools", "ranking"] } }), "comparator"), ["ranking"]);
  // Written without an override when it matches the default; other axes kept.
  const both = withStates(view("DV-C2-CUR-BARS", { variants: { compareAgainst: ["whole"] }, resultsMeasures: ["counts"] }), "compareAgainst", ["category", "whole", "selected"]);
  assert.equal("variants" in both, false);
  assert.deepEqual(both.kind === "view" && both.resultsMeasures, ["counts"]);
  assert.deepEqual((withStates(view("DV-C2-CUR-BARS"), "compareAgainst", ["selected"]) as { variants?: unknown }).variants, { compareAgainst: ["selected"] });
  assert.deepEqual(withoutVariants({ ...view("DV-C2-CUR-BARS"), resultsMeasures: ["counts"], variants: { compareAgainst: ["whole"] } }), view("DV-C2-CUR-BARS"));
});

test("which axes a panel varies by", () => {
  const r = gcse();
  assert.deepEqual(panelAxes(r, panel(r, "vicdata.ks4.results.c1.current")), ["results"]);
  assert.deepEqual(panelAxes(r, panel(r, C2C)), ["results", "compareAgainst"]);
  assert.deepEqual(panelAxes(r, panel(r, C3C)), ["results", "comparator"]);
  assert.deepEqual(configAxes(r), ["results", "compareAgainst", "comparator"]);
  const c = teacherDashboardFor("ks4", "candidates");
  assert.deepEqual(panelAxes(c, panel(c, "vicdata.ks4.candidates.c2.current")), ["compareAgainst"]);
  assert.deepEqual(panelAxes(c, panel(c, "vicdata.ks4.candidates.c1.current")), []);
  const page: VariantState = { results: "counts", compareAgainst: "whole", comparator: "ranking" };
  assert.deepEqual(panelState(r, panel(r, C2C), page), { results: "counts", compareAgainst: "whole" });
  assert.deepEqual(panelState(c, panel(c, "vicdata.ks4.candidates.c3.current"), page), { comparator: "ranking" });
  assert.equal(stateKey({ compareAgainst: "selected", results: "counts" }), "results:counts|compareAgainst:selected");
  assert.deepEqual(parseStateKey("results:counts|compareAgainst:selected"), { results: "counts", compareAgainst: "selected" });
});

test("configs without the new fields give today's rails and defaults, in every state", () => {
  for (const c of TEACHER_DASHBOARDS) {
    for (const p of c.panels) {
      const axes = panelAxes(c, p);
      const states: VariantState[] = [{}];
      for (const a of axes) {
        const next: VariantState[] = [];
        for (const s of states) for (const v of AXIS_STATES[a]) next.push({ ...s, [a]: v });
        states.splice(0, states.length, ...next);
      }
      for (const st of states) {
        const shown = viewsOnState(p, st);
        // Results: round 3's rails. Compare against: no change at all. Comparator: only the
        // views the host itself never offers in that state (R-RANKING-SAMPLE) drop out.
        const expected = (st.results ? viewsOnResults(p, st.results) : p.dataviews).filter(
          (v) => !(v.kind === "view" && ((st.comparator === "schools" && v.dataview === "DV-C3-CUR-TILES") || (st.comparator === "ranking" && ["DV-C3-CUR-MAP", "DV-C3-TR-MAP", "DV-C3-TR-CHANGEMAP"].includes(v.dataview)))),
        );
        assert.deepEqual(ids(shown), ids(expected), `${p.id} ${stateKey(st)}`);
        assert.equal(configuredDefaultFor(p, st), configuredDefault(p, st.results ?? null), `${p.id} ${stateKey(st)} default`);
        assert.equal(configuredDefaultFor(p, st), p.defaultView);
      }
    }
  }
});

test("two axes at once: Context on a Results dashboard (results x compareAgainst)", () => {
  let c = gcse();
  c = ops.setViewResults(c, `${C2T}/DV-C2-TR-TABLE`, ["counts"]);
  c = ops.setViewStates(c, `${C2T}/DV-C2-TR-TABLE`, "compareAgainst", ["selected"]);
  c = ops.setViewStates(c, `${C2T}/DV-C2-TR-CHART`, "compareAgainst", ["category", "whole"]);
  const p = panel(c, C2T);
  const on = (results: "points" | "counts", compareAgainst: "category" | "whole" | "selected") => configViewIds(p, { results, compareAgainst });
  assert.ok(on("counts", "selected").includes("DV-C2-TR-TABLE"));
  assert.ok(!on("counts", "whole").includes("DV-C2-TR-TABLE"), "not on another set");
  assert.ok(!on("points", "selected").includes("DV-C2-TR-TABLE"), "not on another measure");
  assert.ok(on("points", "whole").includes("DV-C2-TR-CHART") && !on("points", "selected").includes("DV-C2-TR-CHART"));
  // Round 3's single-measure call still works.
  assert.ok(configViewIds(p, "counts").includes("DV-C2-TR-TABLE"));
  assert.ok(showsOnState(p.dataviews.find((v) => v.id === `${C2T}/DV-C2-TR-TABLE`)!, { results: "counts" }), "an axis not given doesn't filter");
});

test("defaults per state", () => {
  let c = gcse();
  const table = `${C2T}/DV-C2-TR-TABLE`;
  const st = { results: "counts", compareAgainst: "selected" } as const;
  c = ops.setDefaultView(c, C2T, table, st);
  let p = panel(c, C2T);
  assert.deepEqual(p.defaultViewByState, { "results:counts|compareAgainst:selected": table });
  assert.equal(p.defaultViewByResults, undefined, "Results-only map untouched");
  assert.equal(p.defaultView, `${C2T}/DV-C2-TR-CHART`, "the panel's own default untouched");
  assert.equal(configuredDefaultFor(p, st), table);
  assert.equal(configuredDefaultFor(p, { results: "counts", compareAgainst: "whole" }), p.defaultView, "another set: falls back");
  assert.ok(ops.isDefaultView(p, table, st) && !ops.isDefaultView(p, table, { results: "points", compareAgainst: "selected" }));
  // A round-3 per-measure default still applies to every set, under a per-state one.
  c = ops.setDefaultView(c, C2T, `${C2T}/DV-C2-TR-CHANGELIST`, "counts");
  p = panel(c, C2T);
  assert.equal(configuredDefaultFor(p, { results: "counts", compareAgainst: "whole" }), `${C2T}/DV-C2-TR-CHANGELIST`);
  assert.equal(configuredDefaultFor(p, st), table);
  // A Results-only panel keeps writing round 3's map.
  const c1 = ops.setDefaultView(gcse(), "vicdata.ks4.results.c1.trends", "vicdata.ks4.results.c1.trends/DV-C1-CNT-TR-CHANGETABLE", { results: "counts" });
  assert.deepEqual(panel(c1, "vicdata.ks4.results.c1.trends").defaultViewByResults, { counts: "vicdata.ks4.results.c1.trends/DV-C1-CNT-TR-CHANGETABLE" });
  assert.equal(panel(c1, "vicdata.ks4.results.c1.trends").defaultViewByState, undefined);
  // Leaving the state drops its entry; so does removing the view; ids follow a swap.
  assert.equal(panel(ops.setViewStates(c, table, "compareAgainst", ["whole"]), C2T).defaultViewByState, undefined);
  assert.equal(panel(ops.removeView(c, table), C2T).defaultViewByState, undefined);
  const sw = ops.replaceView(c, table, view("DV-C2-TR-CHANGETABLE"));
  assert.deepEqual(panel(sw.config, C2T).defaultViewByState, { "results:counts|compareAgainst:selected": sw.instanceId });
  assert.throws(() => ops.setDefaultView(ops.setViewStates(gcse(), table, "compareAgainst", ["whole"]), C2T, table, st), ops.EditorError);
  assert.throws(() => ops.setViewStates(gcse(), table, "compareAgainst", []), ops.EditorError);
  assert.equal(ops.validateConfig(c).problems.length, 0);
  // Comparisons: the comparator's own default (Bar chart on a ranking).
  const r = ops.setDefaultView(gcse(), C3C, `${C3C}/DV-C3-CUR-BAR`, { results: "points", comparator: "ranking" });
  assert.equal(defaultOnState(panel(r, C3C), { results: "points", comparator: "ranking" }), `${C3C}/DV-C3-CUR-BAR`);
  assert.equal(defaultOnState(panel(r, C3C), { results: "points", comparator: "schools" }), panel(r, C3C).defaultView);
});

test("swap keeps the instance's states; History names them", () => {
  const c0 = ops.setViewStates(gcse(), `${C2T}/DV-C2-TR-TABLE`, "compareAgainst", ["whole"]);
  const sw = ops.replaceView(c0, `${C2T}/DV-C2-TR-TABLE`, view("DV-C2-TR-CHANGETABLE"));
  assert.deepEqual(effectiveStates(panel(sw.config, C2T).dataviews.find((v) => v.id === sw.instanceId)!, "compareAgainst"), ["whole"]);
  assert.match(ops.changeSummary(gcse(), c0), /Subject category, Selected subjects: removed \*Trend table\* from Context · Trends/);
  const d = ops.setDefaultView(gcse(), C2T, `${C2T}/DV-C2-TR-TABLE`, { results: "counts", compareAgainst: "selected" });
  assert.match(ops.changeSummary(gcse(), d), /Grade counts · Selected subjects: \*Trend table\* is now the default in Context · Trends/);
  assert.equal(ops.stateLabel({ results: "counts", compareAgainst: "category" }, "ks4", "Sciences & Maths"), "Grade counts · Sciences & Maths subjects");
});
