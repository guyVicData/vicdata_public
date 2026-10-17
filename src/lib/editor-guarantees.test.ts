// VicData 0.8 View as, the editing half: "Editing must never damage a dashboard" (prompt
// docs/v0.8/vicdata_0_8_view_as_claude_code_prompt_v1.md), guarantees 2-6 as pure tests on the
// ten VicData dashboards as published live on 17 Oct (supabase/tests/fixtures, a read-only
// select). Guarantees 1, 7 and R-EDIT-PUBLISH-ALL run in PGlite:
// supabase/tests/v08_view_as_editing_pglite.mjs.
//
// Run: npx -y tsx --test src/lib/editor-guarantees.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardConfig, DataviewInstance, PanelConfig } from "@/catalogue/types";
import { DATAVIEWS } from "@/catalogue/dataviews";
import { contextFromPanel, pickResults } from "@/catalogue/pick";
import { upgradeConfig, viewInstance } from "@/catalogue/viewspec";
import * as ops from "./editor-ops";
import { columnHostOf, presetsOf, sideOf } from "@/components/view-editor/model";
import { publish } from "./dashboards-store";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
type Row = { slug: string; version: number; config: DashboardConfig };
const ROWS = (JSON.parse(readFileSync(join(repo, "supabase/tests/fixtures/vicdata_published_configs_2026-10-17.json"), "utf8")).rows as Row[]).map((r) => ({ ...r, config: upgradeConfig(r.config) }));
const live = (slug: string) => structuredClone(ROWS.find((r) => r.slug === slug)!.config);
const SMT = ROWS.filter((r) => r.slug.startsWith("vicdata.smt.")).map((r) => r.slug);
const ADM = ROWS.filter((r) => r.slug.startsWith("vicdata.admissions.")).map((r) => r.slug);
const TEACHER = ROWS.filter((r) => /^vicdata\.ks[45]\./.test(r.slug)).map((r) => r.slug);

test("the fixture holds the 10 VicData dashboards: Teacher's 4, SMT's 4, Admissions' 2", () => {
  assert.equal(TEACHER.length, 4);
  assert.equal(SMT.length, 4);
  assert.equal(ADM.length, 2);
  for (const r of ROWS) assert.deepEqual(ops.validateConfig(r.config), { problems: [], empty: [] }, r.slug);
});

// ------------------------------------------------------------------------------------
// Guarantee 2: nothing dropped. Every panel with two or more views gets every optional
// field the configs can carry, plus unknown keys at every level; each op must carry every
// field it doesn't change.

const UNKNOWN = { futureKey: { nested: [1, "two", { three: true }] } };

function decorate(c: DashboardConfig): DashboardConfig {
  const d = structuredClone(c) as DashboardConfig & Record<string, unknown>;
  Object.assign(d, { unknownTop: UNKNOWN });
  d.features = { ...(d.features ?? {}), levelChips: d.features?.levelChips ?? false, ...({ futureFeature: true } as object) };
  d.columns.forEach((col) => Object.assign(col, { unknownCol: UNKNOWN }));
  d.rows.forEach((r) => Object.assign(r, { unknownRow: UNKNOWN }));
  for (const p of d.panels) {
    Object.assign(p, { unknownPanel: UNKNOWN });
    p.name ??= `Panel ${p.id.split(".").slice(-2).join(" ")}`;
    p.span ??= { cols: 1, rows: 1 };
    if (p.dataviews.length < 2) continue;
    const [a, b] = p.dataviews.map((v) => v.id);
    p.override ??= { badge: "overridden: test", reason: "Guarantee 2 fixture" };
    p.legacy ??= { columnKey: "col", panelId: "current", noteKeys: ["k1"] };
    p.defaultView = b;
    p.defaultViewByResults = { points: a, counts: b };
    p.defaultViewByState = { "results:counts": b, "compareAgainst:selected": a };
    p.dataviews = p.dataviews.map((v) => (v.kind === "view" ? ({ ...v, params: { mainLabel: "x", deep: { y: [1] } }, variants: { compareAgainst: ["category", "whole", "selected"], comparator: ["schools", "ranking"] }, unknownView: UNKNOWN } as DataviewInstance) : v));
  }
  return d;
}

const omit = (o: object, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const views = (c: DashboardConfig) => new Map(c.panels.flatMap((p) => p.dataviews.map((v) => [v.id, v] as const)));

// Everything the op was not meant to change is deep-equal before and after.
function assertCarried(prev: DashboardConfig, next: DashboardConfig, allow: { top?: string[]; panels?: Record<string, string[]>; rows?: Record<string, string[]>; columns?: Record<string, string[]> } = {}, label = "") {
  assert.deepEqual(omit(next, ["columns", "rows", "panels", ...(allow.top ?? [])]), omit(prev, ["columns", "rows", "panels", ...(allow.top ?? [])]), `${label}: dashboard fields`);
  for (const col of prev.columns) {
    const n = next.columns.find((x) => x.id === col.id);
    if (n) assert.deepEqual(omit(n, allow.columns?.[col.id] ?? []), omit(col, allow.columns?.[col.id] ?? []), `${label}: column ${col.id}`);
  }
  for (const r of prev.rows) {
    const n = next.rows.find((x) => x.id === r.id);
    if (n) assert.deepEqual(omit(n, allow.rows?.[r.id] ?? []), omit(r, allow.rows?.[r.id] ?? []), `${label}: row ${r.id}`);
  }
  for (const p of prev.panels) {
    const n = next.panels.find((x) => x.id === p.id);
    if (!n) continue;
    const keys = allow.panels?.[p.id] ?? [];
    assert.deepEqual(omit(n, ["dataviews", ...keys]), omit(p, ["dataviews", ...keys]), `${label}: panel ${p.id}`);
  }
  const pv = views(prev);
  for (const [id, v] of views(next)) if (pv.has(id)) assert.deepEqual(v, pv.get(id), `${label}: view ${id}`);
}

const firstMulti = (c: DashboardConfig): PanelConfig => c.panels.find((p) => p.dataviews.length >= 3) ?? c.panels.find((p) => p.dataviews.length >= 2)!;

for (const slug of ["vicdata.ks4.results", "vicdata.smt.overview", "vicdata.admissions.pipelines"]) {
  test(`guarantee 2 (${slug}): every op carries the fields it doesn't change`, () => {
    const c = decorate(live(slug));
    assert.deepEqual(ops.validateConfig(c).problems, [], "the decorated fixture is itself valid");
    const p = firstMulti(c);
    const other = c.panels.find((x) => x.id !== p.id && x.row === p.row) ?? c.panels.find((x) => x.id !== p.id)!;
    const [v0, v1] = p.dataviews;

    // rename
    let n = ops.renamePanel(c, p.id, "Renamed");
    assert.equal(n.panels.find((x) => x.id === p.id)!.name, "Renamed");
    assertCarried(c, n, { panels: { [p.id]: ["name"] } }, "rename");
    // set default (no state, and on a state)
    n = ops.setDefaultView(c, p.id, v0.id);
    assertCarried(c, n, { panels: { [p.id]: ["defaultView"] } }, "set default");
    // reorder / move within panel: the panel's other fields and each view object unchanged
    n = ops.reorderView(c, p.id, 0, 1);
    assert.deepEqual(n.panels.find((x) => x.id === p.id)!.dataviews.map((v) => v.id).slice(0, 2), [v1.id, v0.id]);
    assertCarried(c, n, {}, "reorder");
    n = ops.moveViewWithinPanel(c, v0.id, 1);
    assertCarried(c, n, {}, "move within panel");
    // remove: only the defaults that pointed at the removed view change
    n = ops.removeView(c, v1.id);
    assertCarried(c, n, { panels: { [p.id]: ["defaultView", "defaultViewByResults", "defaultViewByState"] } }, "remove");
    const np = n.panels.find((x) => x.id === p.id)!;
    assert.ok(!JSON.stringify([np.defaultView, np.defaultViewByResults, np.defaultViewByState]).includes(v1.id), "no default left pointing at the removed view");
    // add: the new view carries every field it was given
    const extra = { ...viewInstance("tmp", (v0 as Extract<DataviewInstance, { kind: "view" }>).dataview), params: { a: 1 }, variants: { compareAgainst: ["whole"] }, unknownView: UNKNOWN } as DataviewInstance;
    const added = ops.addView(c, other.id, extra);
    assertCarried(c, added.config, {}, "add");
    assert.deepEqual(omit(views(added.config).get(added.instanceId)!, ["id"]), omit(extra, ["id"]), "added view carried whole");
    // move / copy a view to another panel: the instance moves whole (new id only)
    const moved = ops.moveView(c, v0.id, other.id);
    assert.deepEqual(omit(views(moved.config).get(moved.instanceId)!, ["id"]), omit(v0, ["id"]), "moved view carried whole");
    assertCarried(c, moved.config, { panels: { [p.id]: ["defaultView", "defaultViewByResults", "defaultViewByState"] } }, "move view");
    const copied = ops.copyView(c, v0.id, other.id);
    assert.deepEqual(omit(views(copied.config).get(copied.instanceId)!, ["id"]), omit(v0, ["id"]), "copied view carried whole");
    assertCarried(c, copied.config, {}, "copy view");
    // move a panel (swap with a same-span filled panel): only row/column change
    const swapWith = c.panels.find((x) => x.id !== p.id && x.row !== p.row && x.dataviews.length && (x.span?.cols ?? 1) === (p.span?.cols ?? 1));
    if (swapWith) {
      n = ops.movePanel(c, p.id, swapWith.row, swapWith.column);
      assertCarried(c, n, { panels: { [p.id]: ["row", "column"], [swapWith.id]: ["row", "column"] } }, "move panel");
    }
    // resize: only span changes (shrink the 2-wide, or grow into an emptied cell)
    const wide = c.panels.find((x) => (x.span?.cols ?? 1) === 2);
    if (wide) {
      n = ops.setSpan(c, wide.id, 1);
      assertCarried(c, n, { panels: { [wide.id]: ["span"] } }, "resize");
      assert.equal(n.panels.find((x) => x.id === wide.id)!.dataviews.length, wide.dataviews.length);
    }
    // rows: rename, settings, move, copy, add, delete another
    n = ops.updateRow(c, p.row, { name: "New name", time: "either", openByDefault: false });
    assertCarried(c, n, { rows: { [p.row]: ["name", "time", "openByDefault"] } }, "row settings");
    n = ops.moveRow(c, c.rows[0].id, 1);
    assertCarried(c, n, {}, "move row");
    n = ops.addRow(c, { structure: c.columns.map(() => 1) });
    assertCarried(c, n, {}, "add row");
    n = ops.copyRow(c, p.row);
    assertCarried(c, n, {}, "copy row (originals)");
    const copyRowId = n.rows[n.rows.findIndex((r) => r.id === p.row) + 1].id;
    assert.deepEqual(omit(n.rows.find((r) => r.id === copyRowId)!, ["id", "name", "legacyPanelId"]), omit(c.rows.find((r) => r.id === p.row)!, ["id", "name", "legacyPanelId"]), "row copy carries the row's other keys");
    const pc = n.panels.find((x) => x.row === copyRowId && x.column === p.column)!;
    assert.deepEqual(omit(pc, ["id", "row", "dataviews", "defaultView", "defaultViewByResults", "defaultViewByState", "legacy"]), omit(p, ["id", "row", "dataviews", "defaultView", "defaultViewByResults", "defaultViewByState", "legacy"]), "panel copy carries span, name, override and unknown keys");
    assert.deepEqual(pc.dataviews.map((v) => omit(v, ["id"])), p.dataviews.map((v) => omit(v, ["id"])), "views copied whole");
    assert.equal(pc.legacy, undefined, "a copy has its own notes (no legacy keys), as before");
    n = ops.deleteRow(ops.addRow(c, { structure: c.columns.map(() => 1) }), "row" + (c.rows.length + 1));
    assertCarried(c, n, {}, "delete another row");
    // dashboard settings: features merge, nothing else moves
    n = ops.updateSettings(c, { accordion: c.layout.accordion === "auto-close" ? "independent" : "auto-close", features: { subjectChips: true } });
    assertCarried(c, n, { top: ["layout", "features"] }, "settings");
    assert.deepEqual(omit(n.features!, ["subjectChips"]), omit(c.features!, ["subjectChips"]), "features merged, none dropped");
    assert.deepEqual(omit(n.layout, ["accordion"]), omit(c.layout, ["accordion"]));
    // override: set and clear touch only override
    n = ops.setOverride(c, other.id, { badge: "overridden: x", reason: "y" });
    assertCarried(c, n, { panels: { [other.id]: ["override"] } }, "set override");
    // Show on (variants): only that view's own states change
    if (v0.kind === "view" && slug === "vicdata.ks4.results") {
      n = ops.setViewStates(c, v0.id, "results", ["points", "counts"]);
      const after = views(n).get(v0.id)!;
      assert.deepEqual(omit(after, ["resultsMeasures"]), omit(v0, ["resultsMeasures"]), "Show on keeps params, variants and unknown keys");
    }
  });
}

// ------------------------------------------------------------------------------------
// Guarantee 3: large panels. SMT and Admissions each have one 2-wide panel (row "now",
// columns 2-3 of 3). Every move, resize or reorder either keeps it 2-wide and valid, or is
// refused with a message; none shrinks or drops a panel quietly.

const ok = (c: DashboardConfig) => assert.deepEqual(ops.validateConfig(c).problems, []);
const viewCount = (c: DashboardConfig) => c.panels.reduce((n, p) => n + p.dataviews.length, 0);
const refusal = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ops.EditorError, `an EditorError, got ${e}`);
    assert.ok((e as Error).message.length > 10, "with a message");
    return (e as Error).message;
  }
  assert.fail("expected a refusal");
};

for (const slug of [...SMT, ...ADM]) {
  test(`guarantee 3 (${slug}): the 2-wide panel stays valid or the change is refused`, () => {
    const c = live(slug);
    const wide = c.panels.find((p) => p.span?.cols === 2)!;
    assert.ok(wide, "has a 2-wide panel");
    const n0 = viewCount(c);
    const narrow = c.panels.find((p) => p.row === wide.row && p.id !== wide.id)!;
    const otherRow = c.rows.find((r) => r.id !== wide.row)!.id;
    const msgs: string[] = [];
    // moves that can't fit
    msgs.push(refusal(() => ops.movePanel(c, wide.id, wide.row, c.columns[2].id))); // off the edge
    msgs.push(refusal(() => ops.movePanel(c, wide.id, wide.row, c.columns[0].id))); // onto the 1-wide
    for (const col of c.columns) msgs.push(refusal(() => ops.movePanel(c, wide.id, otherRow, col.id))); // a full row of 1-wides
    msgs.push(refusal(() => ops.movePanel(c, narrow.id, wide.row, wide.column))); // a 1-wide onto the 2-wide
    // resizes that can't fit
    msgs.push(refusal(() => ops.setSpan(c, wide.id, 3)));
    msgs.push(refusal(() => ops.setSpan(c, narrow.id, 2)));
    // removing a column it spans (Settings' fewer columns)
    msgs.push(refusal(() => ops.removeColumn(c, c.columns[2].id)));
    msgs.push(refusal(() => ops.removeColumn(c, c.columns[1].id)));
    assert.ok(msgs.every((m) => !/undefined/.test(m)), msgs.join(" | "));
    // changes that fit keep it 2-wide and drop nothing
    const fits: [string, DashboardConfig][] = [
      ["reorder its views", ops.reorderView(c, wide.id, 0, wide.dataviews.length - 1)],
      ["move rows", ops.moveRow(c, wide.row, 1)],
      ["swap two 1-wide panels", ops.movePanel(c, narrow.id, otherRow, narrow.column)],
      ["add a row", ops.addRow(c, { structure: [1, 2] })],
      ["copy its row", ops.copyRow(c, wide.row)],
    ];
    for (const [what, n] of fits) {
      ok(n);
      assert.equal(n.panels.find((p) => p.id === wide.id)!.span?.cols, 2, what);
      assert.ok(viewCount(n) >= n0, `${what}: no view dropped`);
      assert.ok(c.panels.every((p) => n.panels.some((x) => x.id === p.id)), `${what}: no panel dropped`);
    }
    // a 2-wide panel can move into an empty 2-wide space (a new [1, 2] row)
    const withRow = ops.addRow(c, { structure: [1, 2] });
    const newRow = withRow.rows.at(-1)!.id;
    const movedWide = ops.movePanel(withRow, wide.id, newRow, c.columns[1].id);
    ok(movedWide);
    assert.equal(movedWide.panels.find((p) => p.id === wide.id)!.span?.cols, 2);
    assert.equal(viewCount(movedWide), n0);
    // narrowing it is an explicit resize, never a side effect: span 1, every view kept
    const narrowed = ops.setSpan(c, wide.id, 1);
    ok(narrowed);
    assert.equal(narrowed.panels.find((p) => p.id === wide.id)!.dataviews.length, wide.dataviews.length);
  });
}

// ------------------------------------------------------------------------------------
// Guarantee 4: only views the panel can draw.

// Add a view opens one of two pickers (DashboardEditor's handlers.addView): on a column with a
// registered host -- all ten dashboards' columns have one -- the View editor, whose choices are
// the host's presets (view-editor/model.ts presetsOf: host.id === the column's host); with no
// host, the catalogue chooser (pick.ts pickResults). Both are checked, and neither vacuously.
for (const r of ROWS) {
  test(`guarantee 4 (${r.slug}): the pickers offer only this family's views`, () => {
    const c = live(r.slug);
    let offeredCount = 0;
    for (const p of c.panels) {
      const want = ops.columnFamily(c.columns.find((x) => x.id === p.column)!);
      const host = columnHostOf(c, p.id);
      assert.ok(host, `${p.id}: the column has a registered host, so Add a view opens the View editor`);
      const presets = presetsOf(host!, sideOf(c, p.id));
      for (const d of presets) assert.equal(ops.familyOfHost(d.host.id), want, `${p.id} View editor offers ${d.id}`);
      const offered = pickResults(contextFromPanel(c, p.id), { superAdmin: true });
      for (const o of offered) assert.equal(ops.familyOfHost(o.dataview.host.id), want, `${p.id} chooser offers ${o.dataview.id}`);
      offeredCount += presets.length + offered.length;
    }
    assert.ok(offeredCount > 0, "the pickers offer something here");
  });
}

test("guarantee 4: every registered dataview's data belongs to its host's family (so data-matching is family-matching)", () => {
  for (const dv of DATAVIEWS) {
    const fam = ops.familyOfHost(dv.host.id);
    for (const d of dv.supports.data) assert.equal(ops.columnFamily({ data: { data: d, phase: "ks4" } }), fam, `${dv.id} supports ${d}`);
  }
});

test("guarantee 4: validateConfig and the ops refuse another family's view, and an unregistered one", () => {
  const families = { teacher: "DV-C1-CAND-CUR-TILES", smt: "DV-SMT-O-FLAGS", admissions: "DV-ADM-M-FLAGS" } as const;
  for (const id of Object.values(families)) assert.ok(DATAVIEWS.some((d) => d.id === id), `${id} is registered`);
  for (const slug of [TEACHER[0], SMT[0], ADM[0]]) {
    const c = live(slug);
    const p = c.panels[0];
    const fam = ops.columnFamily(c.columns.find((x) => x.id === p.column)!);
    for (const [other, dvId] of Object.entries(families)) {
      if (other === fam) continue;
      const bad = structuredClone(c);
      bad.panels[0].dataviews.push(viewInstance(`${p.id}/${dvId}`, dvId as never));
      const { problems } = ops.validateConfig(bad);
      assert.ok(problems.some((x) => x.message.includes(" view; this panel draws ")), `${slug}: ${dvId} refused`);
      assert.ok(ops.publishBlockers(bad).some((m) => m.includes(dvId) || m.includes("can't draw")), "publish held back");
      assert.throws(() => ops.addView(c, p.id, viewInstance("x", dvId as never)), ops.EditorError, "addView refuses it");
    }
    const unknown = structuredClone(c);
    unknown.panels[0].dataviews.push({ ...viewInstance(`${p.id}/DV-NOPE`, (c.panels[0].dataviews[0] as unknown as { dataview: never }).dataview), dataview: "DV-NOPE" as never });
    assert.ok(ops.validateConfig(unknown).problems.some((x) => /unknown dataview DV-NOPE/.test(x.message)));
    assert.ok(ops.publishBlockers(unknown).some((m) => /DV-NOPE isn't a registered view/.test(m)));
  }
});

if (!DATAVIEWS.some((d) => d.id === "DV-C1-CAND-CUR-TILES")) {
  // Keep the family test honest if the Teacher id above is ever renamed.
  test("guarantee 4 fixture: a Teacher dataview id", () => assert.fail("DV-C1-CAND-CUR-TILES isn't registered: pick another Teacher dataview for the test"));
}

// ------------------------------------------------------------------------------------
// Guarantee 5: the preview draws what members will see.

test("guarantee 5: every registered SMT and Admissions dataview has a case in its family's renderer (the one the preview and the page share)", () => {
  const smtSrc = readFileSync(join(repo, "src/components/smt/SmtDashboard.tsx"), "utf8");
  const admSrc = readFileSync(join(repo, "src/components/admissions/AdmissionsDashboard.tsx"), "utf8");
  const cases = (src: string) => new Set([...src.matchAll(/case "(DV-[A-Z0-9-]+)"/g)].map((m) => m[1]));
  const smtCases = cases(smtSrc.slice(smtSrc.indexOf("export function ViewBody")));
  const admCases = cases(admSrc.slice(admSrc.indexOf("function viewBody")));
  const missing = DATAVIEWS.filter((d) => (ops.familyOfHost(d.host.id) === "smt" && !smtCases.has(d.id)) || (ops.familyOfHost(d.host.id) === "admissions" && !admCases.has(d.id))).map((d) => d.id);
  assert.deepEqual(missing, []);
  // The preview routes by the view's host family to those same bodies.
  const live = readFileSync(join(repo, "src/components/editor/LivePanelPreview.tsx"), "utf8");
  assert.match(live, /dv\.host\.id\.startsWith\("admissions\."\)[\s\S]*AdmissionsViewPreview/);
  assert.match(live, /dv\.host\.id\.startsWith\("smt\."\)\) return <SmtViewPreview/);
  assert.match(smtSrc.slice(smtSrc.indexOf("export function SmtViewPreview")), /<ViewBody dv=\{dataview\}/);
  assert.match(admSrc.slice(admSrc.indexOf("export function AdmissionsViewPreview")), /<InstanceBody dv=\{dataview\}/);
});

test("guarantee 5: every view on the ten dashboards is drawable by the preview; one that isn't blocks publishing, named", () => {
  for (const r of ROWS) assert.deepEqual(ops.previewGaps(r.config), [], r.slug);
  const c = live(SMT[0]);
  const bad = structuredClone(c);
  const p = bad.panels.find((x) => x.span?.cols === 2)!;
  p.dataviews.push({ ...structuredClone(p.dataviews[0]), id: `${p.id}/DV-SMT-O-GONE`, dataview: "DV-SMT-O-GONE" as never, title: "A view from a later build" } as DataviewInstance);
  const lines = ops.publishBlockers(bad);
  assert.ok(lines.some((m) => m.includes("The preview can't draw “A view from a later build”") && m.includes("DV-SMT-O-GONE") && m.includes(p.name!)), lines.join(" | "));
});

// ------------------------------------------------------------------------------------
// Guarantee 6: before publish, the change summary; publish needs one.

test("guarantee 6: the change summary names what was added, removed, moved and renamed", () => {
  const c = live(SMT[0]);
  assert.equal(ops.changeSummary(c, c), "No changes.");
  const wide = c.panels.find((p) => p.span?.cols === 2)!;
  const other = c.panels.find((p) => p.row !== wide.row)!;
  let n = ops.renamePanel(c, wide.id, "Headlines");
  n = ops.updateRow(n, c.rows[1].id, { name: "Over time" });
  n = ops.removeView(n, wide.dataviews.at(-1)!.id);
  n = ops.moveView(n, wide.dataviews[0].id, other.id).config;
  n = ops.addView(n, other.id, viewInstance("x", (other.dataviews[0] as unknown as { dataview: never }).dataview)).config;
  const s = ops.changeSummary(c, n);
  for (const word of ["named a panel “Headlines”", "renamed row", "removed", "moved", "added"]) assert.ok(s.includes(word), `${word} in: ${s}`);
});

test("guarantee 6: a publish without a change summary is refused before anything is written", async () => {
  const calls: unknown[] = [];
  const fake = { rpc: async (name: string, args: unknown) => (calls.push([name, args]), { data: "v-id", error: null }) } as unknown as SupabaseClient;
  const c = live(SMT[0]);
  await assert.rejects(() => publish(fake, "d", c, undefined, undefined), /change summary/);
  await assert.rejects(() => publish(fake, "d", c, undefined, "   "), /change summary/);
  assert.equal(calls.length, 0);
  assert.equal(await publish(fake, "d", c, undefined, "No changes."), "v-id");
  assert.equal((calls[0] as [string, { p_summary: string }])[1].p_summary, "No changes.");
});

test("guarantee 6: the editor's Publish dialog shows the summary and is held by blockers (source)", () => {
  const ed = readFileSync(join(repo, "src/components/editor/DashboardEditor.tsx"), "utf8");
  const dlg = readFileSync(join(repo, "src/components/editor/Dialogs.tsx"), "utf8");
  // the summary passed to publish is the one the dialog shows
  assert.match(ed, /const summary = ops\.changeSummary\(published\.config, config\);/);
  assert.match(ed, /publish\(supabase, row\.id, config, label \|\| undefined, summary\)/);
  assert.match(ed, /<PublishDialog[\s\S]*summary=\{summary\.replace/);
  assert.match(ed, /const held = ops\.publishBlockers\(config\);\s*if \(held\.length\)/);
  assert.match(dlg, /What&apos;s changed/);
  assert.match(dlg, /disabled=\{busy \|\| empty > 0 \|\| blockers\.length > 0 \|\| !available\}/);
});
