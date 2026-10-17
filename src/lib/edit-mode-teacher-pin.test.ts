// VicData 0.8 View as (editing half): Teacher's editing is the reference, and must behave
// identically before and after this round. edit-mode.ts itself is DOM-bound (hooks,
// localStorage) and is not changed by the editing work; what the editing work DID change is
// the pure path every Teacher edit and publish goes through: editor-ops (the ops, the change
// summary, the publish gate) and the store's read upgrade. This pins that path.
//
// The fixture supabase/tests/fixtures/teacher-edit-pin.json was written by THIS script with the
// editor-ops.ts as it stood BEFORE the round's changes (PIN_WRITE=1), on the four Teacher
// dashboards as published live on 17 Oct (supabase/tests/fixtures). The test replays the same
// script of edits on the current code and asserts every step's output config, change summary
// and error message is byte-identical.
//
// Run: npx -y tsx --test src/lib/edit-mode-teacher-pin.test.ts
// Rewrite the pin (only on purpose, before a change to Teacher's editing): PIN_WRITE=1 npx -y tsx src/lib/edit-mode-teacher-pin.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DashboardConfig } from "@/catalogue/types";
import { upgradeConfig } from "@/catalogue/viewspec";
import * as ops from "./editor-ops";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "..", "supabase", "tests", "fixtures", "vicdata_published_configs_2026-10-17.json");
const PIN = join(here, "..", "..", "supabase", "tests", "fixtures", "teacher-edit-pin.json");
const TEACHER = ["vicdata.ks4.candidates", "vicdata.ks4.results", "vicdata.ks5.candidates", "vicdata.ks5.results"];

type Row = { slug: string; config: DashboardConfig };
const live = (): Row[] => (JSON.parse(readFileSync(FIXTURE, "utf8")).rows as Row[]).filter((r) => TEACHER.includes(r.slug));

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// One Teacher editing session per dashboard: every op the editor's menus call, in order, each
// on the previous step's result (or recorded as the refusal it gives).
export function teacherScript(start: DashboardConfig): { step: string; out: string }[] {
  const steps: { step: string; out: string }[] = [];
  let c = upgradeConfig(start);
  const run = (step: string, fn: (x: DashboardConfig) => DashboardConfig) => {
    try {
      const next = fn(c);
      steps.push({ step, out: sha(JSON.stringify(next)) + " | " + ops.changeSummary(c, next) });
      c = next;
    } catch (e) {
      steps.push({ step, out: `refused: ${(e as Error).message}` });
    }
  };
  const p0 = c.panels[0];
  const p1 = c.panels[1];
  const trend = c.panels.find((p) => p.row !== p0.row && p.column === p0.column)!;
  run("open (no change)", (x) => x);
  run("rename panel", (x) => ops.renamePanel(x, p0.id, "Pinned name"));
  run("clear panel name", (x) => ops.renamePanel(x, p0.id, ""));
  if (p0.dataviews.length > 1) {
    run("set default view", (x) => ops.setDefaultView(x, p0.id, x.panels.find((p) => p.id === p0.id)!.dataviews[1].id));
    run("reorder views", (x) => ops.reorderView(x, p0.id, 0, 1));
    run("move view down", (x) => ops.moveViewWithinPanel(x, x.panels.find((p) => p.id === p0.id)!.dataviews[0].id, 1));
  }
  run("copy view to next panel", (x) => ops.copyView(x, x.panels.find((p) => p.id === p0.id)!.dataviews[0].id, p1.id).config);
  run("move view back", (x) => {
    const last = x.panels.find((p) => p.id === p1.id)!.dataviews.at(-1)!;
    return ops.moveView(x, last.id, p0.id).config;
  });
  run("remove that view", (x) => ops.removeView(x, x.panels.find((p) => p.id === p0.id)!.dataviews.at(-1)!.id));
  run("swap two panels (move)", (x) => ops.movePanel(x, p0.id, trend.row, trend.column));
  run("swap them back", (x) => ops.movePanel(x, p0.id, p0.row, p0.column));
  run("widen a filled panel (refused)", (x) => ops.setSpan(x, p0.id, 2));
  run("add a row", (x) => ops.addRow(x, { structure: [2, 1], name: "Extra" }));
  run("rename that row", (x) => ops.updateRow(x, x.rows.at(-1)!.id, { name: "Extra 2", time: "latest", openByDefault: false }));
  run("move it up", (x) => ops.moveRow(x, x.rows.at(-1)!.id, -1));
  run("copy a row", (x) => ops.copyRow(x, p0.row));
  run("delete the copy", (x) => ops.deleteRow(x, x.rows[x.rows.findIndex((r) => r.id === p0.row) + 1].id));
  run("restructure the extra row", (x) => ops.setRowStructure(x, x.rows.find((r) => r.name === "Extra 2")!.id, [1, 1, 1]));
  run("delete the extra row", (x) => ops.deleteRow(x, x.rows.find((r) => r.name === "Extra 2")!.id));
  run("add a column", (x) => ops.addColumn(x, { title: "Four", icon: "results", data: x.columns[0].data, focus: x.columns[0].focus, compare: null }));
  run("remove it", (x) => ops.removeColumn(x, x.columns.at(-1)!.id));
  run("settings", (x) => ops.updateSettings(x, { accordion: x.layout.accordion === "auto-close" ? "independent" : "auto-close" }));
  run("settings back", (x) => ops.updateSettings(x, { accordion: start.layout.accordion }));
  steps.push({ step: "validate", out: JSON.stringify(ops.validateConfig(c)) });
  steps.push({ step: "summary vs start", out: ops.changeSummary(upgradeConfig(start), c) });
  return steps;
}

function current(): Record<string, { step: string; out: string }[]> {
  return Object.fromEntries(live().map((r) => [r.slug, teacherScript(r.config)]));
}

if (process.env.PIN_WRITE === "1") {
  if (!existsSync(dirname(PIN))) mkdirSync(dirname(PIN), { recursive: true });
  writeFileSync(PIN, JSON.stringify(current(), null, 1) + "\n");
  console.log("wrote", PIN);
} else {
  test("Teacher's editing path is byte-identical to before the View as round", () => {
    const pinned = JSON.parse(readFileSync(PIN, "utf8")) as Record<string, { step: string; out: string }[]>;
    const now = current();
    assert.deepEqual(Object.keys(now).sort(), TEACHER.slice().sort());
    for (const slug of TEACHER) assert.deepEqual(now[slug], pinned[slug], slug);
  });

  test("Teacher's four dashboards pass the publish gate unchanged (no new refusal for Teacher)", () => {
    for (const r of live()) {
      const c = upgradeConfig(r.config);
      assert.deepEqual(ops.publishBlockers(c), [], r.slug);
      assert.equal(ops.changeSummary(c, c), "No changes.");
    }
  });
}
