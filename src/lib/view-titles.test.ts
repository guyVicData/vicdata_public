// 0.6 snagging round 4 / 01: a view's own title (Customise's Title, placeholders and all) is
// used wherever the view's title appears, resolved for the reader's own context; with no
// override, today's titles. Run: npx -y tsx --test src/lib/view-titles.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataviewById } from "@/catalogue";
import { teacherDashboardFor } from "@/catalogue/dashboards";
import { contextFromPanel, instanceTitle, titleOverrideOf, titleTemplateOf, viewTitle } from "@/catalogue/pick";
import type { DataviewId, DataviewInstance, SlideConfig } from "@/catalogue/types";
import { copySourceFor, panelTitleOverride, type RuntimeLabels } from "./pin-context";
import { slotTitle } from "./meeting-views";
import { changeSummary } from "./editor-ops";
import { oneViewConfig } from "@/components/dashboard-config/embed";

type View = Extract<DataviewInstance, { kind: "view" }>;
const view = (dataview: string, extra: Partial<View> = {}): View => ({ id: `x/${dataview}`, kind: "view", dataview: dataview as DataviewId, ...extra });
const rt: RuntimeLabels = {
  school: { urn: "100053", name: "Acland Burghley School" },
  results: "points",
  focus: { key: "History::GCSE (9-1) Full Course", label: "History" },
  category: "Humanities & Social Sciences",
  contextAgainst: "selected",
  contextGroupLabel: "Selected subjects",
  setLabel: "10 nearest schools",
  latestYear: "2024/25",
  firstYear: "2020/21",
};

test("an override is Customise's title only when it differs from the dataview's template", () => {
  const dv = dataviewById("DV-C2-CUR-BARS")!;
  assert.equal(titleOverrideOf(view(dv.id)), null, "ready-made: none");
  // Customise saves the template even when the title wasn't touched: not an override.
  assert.equal(titleOverrideOf(view(dv.id, { title: titleTemplateOf(dv), params: { title: titleTemplateOf(dv) } })), null);
  assert.equal(titleOverrideOf(view(dv.id, { title: "[subject] against [comparison-group]", params: { title: "[subject] against [comparison-group]" } })), "[subject] against [comparison-group]");
  // A tiles view has no template of its own: Customise starts from "[subject]: label".
  assert.equal(titleOverrideOf(view("DV-C1-RES-CUR-TILES", { title: titleTemplateOf(dataviewById("DV-C1-RES-CUR-TILES")!) })), null);
  assert.equal(titleOverrideOf({ id: "p", kind: "placeholder", description: "x", shape: null }), null);
});

test("the override resolves for the member's own subject, school, group, set and years", () => {
  const d = teacherDashboardFor("ks4", "results");
  const c2 = d.panels.find((p) => p.column === "c2" && p.row === "current")!;
  const v = view("DV-C2-CUR-BARS", { id: `${c2.id}/custom`, title: "[subject] at [school] against [comparison-group] in [year]", params: { title: "[subject] at [school] against [comparison-group] in [year]" } });
  assert.equal(panelTitleOverride(d, c2.id, v, rt), "History at Acland Burghley School against Selected subjects in 2024/25");
  const c3 = d.panels.find((p) => p.column === "c3" && p.row === "trends")!;
  const t = view("DV-C3-TR-CHART", { title: "[measure] since [year] against the [comparison-set]" });
  assert.equal(panelTitleOverride(d, c3.id, t, rt), "Average points since 2021/22 against the 10 nearest schools", "a trend starts where its honest series does (as the panel and Customise)");
  // No override: nothing replaces the host's own title.
  assert.equal(panelTitleOverride(d, c2.id, view("DV-C2-CUR-BARS"), rt), null);
});

test("Copy this view carries the resolved title, never a bracketed template", () => {
  const d = teacherDashboardFor("ks4", "results");
  const c2 = d.panels.find((p) => p.column === "c2" && p.row === "current")!;
  const dv = dataviewById("DV-C2-CUR-BARS")!;
  const unedited = view(dv.id, { title: titleTemplateOf(dv), params: { title: titleTemplateOf(dv) } });
  const src = copySourceFor(d, c2.id, unedited, rt);
  assert.equal(src.title, viewTitle(dv, src.context), "unedited: the dataview's own title");
  const edited = copySourceFor(d, c2.id, view(dv.id, { title: "[subject] beside its neighbours" }), rt);
  assert.equal(edited.title, "History beside its neighbours");
});

test("instanceTitle: the override resolved, else the dataview's title", () => {
  const d = teacherDashboardFor("ks4", "candidates");
  const p = d.panels.find((x) => x.column === "c1" && x.row === "current")!;
  const ctx = contextFromPanel(d, p.id, { subject: { label: "History" }, school: "Acland Burghley School" });
  const dv = dataviewById("DV-C1-CAND-CUR-TILES")!;
  assert.equal(instanceTitle(view(dv.id), ctx), viewTitle(dv, ctx));
  assert.equal(instanceTitle(view(dv.id, { title: "[school]: [subject] entries" }), ctx), "Acland Burghley School: History entries");
});

test("meeting slots: a title with placeholders is filled from the pin; a plain one stays", () => {
  const s = (title?: string): SlideConfig["slots"][number] => ({
    id: "s",
    view: { id: "v", kind: "view", dataview: "DV-C2-CUR-BARS", ...(title ? { title } : {}), pinned: { phase: "ks4", data: "academic.candidates", subjectLabel: "History", schoolName: "Acland Burghley School", compare: { kind: "subjects", name: "Humanities" }, year: "2024/25" }, keepLive: false },
  });
  assert.equal(slotTitle(s("[subject] at [school], [year]")), "History at Acland Burghley School, 2024/25");
  assert.equal(slotTitle(s("Our history entries")), "Our history entries");
  assert.match(slotTitle(s()), /^Entries by subject in Humanities$/);
});

test("a one-view embed (meeting slot, live preview) carries the view's params and title", () => {
  const dv = dataviewById("DV-C1-RES-CUR-TILES")!;
  const c = oneViewConfig(dv, { phase: "ks4" }, "slot.x", { title: "[subject]!", tiles: [{ figure: "count" }] }, "[subject]!");
  const v = c.panels[0].dataviews[0] as View;
  assert.deepEqual(v.params, { title: "[subject]!", tiles: [{ figure: "count" }] });
  assert.equal(v.title, "[subject]!");
  assert.equal("title" in (oneViewConfig(dv, { phase: "ks4" }, "slot.y").panels[0].dataviews[0] as View), false, "none set: none carried");
});

test("History's change summary says when a view's title changes", () => {
  const prev = teacherDashboardFor("ks4", "results");
  const next = structuredClone(prev);
  const p = next.panels.find((x) => x.column === "c2" && x.row === "current")!;
  const i = p.dataviews.findIndex((v) => v.kind === "view" && v.dataview === "DV-C2-CUR-BARS");
  p.dataviews[i] = { ...(p.dataviews[i] as View), title: "[subject] beside the rest", params: { title: "[subject] beside the rest" } };
  assert.match(changeSummary(prev, next), /Retitled \*Bar chart\* “\[subject\] beside the rest” in /);
  assert.match(changeSummary(next, prev), /\*Bar chart\* in .* has its own title again/);
});
