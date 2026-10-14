// VicData 0.8 groups r1 (G0): one page view per load (usage-gate.ts).
// Run: npx -y tsx --test src/lib/usage-gate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPageViewGate, type PageViewScope } from "./usage-gate";

const adm = (level: string | null, resolved: boolean, dashboard = "vicdata.admissions.pipelines"): PageViewScope => ({ product: "admissions", urn: "137625", dashboard, level, setKind: null, resolved });

test("Admissions: the load that used to log twice (level null, then 11+) logs once, with 11+", () => {
  const gate = createPageViewGate();
  const sent = [adm(null, false), adm("11+", false), adm("11+", true), adm("11+", true)].map(gate).filter(Boolean);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.level, "11+");
  assert.equal(sent[0]!.event, "page_view");
});

test("a change of level, set or dashboard is a new page view; re-renders and re-reads are not", () => {
  const gate = createPageViewGate();
  const t = (level: string | null, setKind: string, dashboard = "teacher.ks4", resolved = true): PageViewScope => ({ product: "teacher", urn: "137625", dashboard, level, setKind, resolved });
  const steps = [
    t(null, "nearest", "teacher.ks4", false), // before the subjects and saved set are read
    t("Mathematics", "saved"), // resolved: one
    t("Mathematics", "saved"), // a re-render
    t("Mathematics", "saved", "teacher.ks4", false), // the saved sets re-read after a save
    t("Mathematics", "saved"), // back, unchanged: not again
    t("English Language", "saved"), // level changed: two
    t("English Language", "nearest"), // set changed: three
    t("English Language", "nearest", "teacher.ks5"), // dashboard changed: four
  ];
  const sent = steps.map(gate).filter(Boolean);
  assert.deepEqual(sent.map((r) => [r!.dashboard, r!.level, r!.setKind]), [
    ["teacher.ks4", "Mathematics", "saved"],
    ["teacher.ks4", "English Language", "saved"],
    ["teacher.ks4", "English Language", "nearest"],
    ["teacher.ks5", "English Language", "nearest"],
  ]);
});

test("SMT: nothing while the set resolves; no scope (View as, a preview) is never logged", () => {
  const gate = createPageViewGate();
  const smt = (setKind: string | null, resolved: boolean): PageViewScope => ({ product: "smt", urn: "110110", dashboard: "vicdata.smt.overview", level: "whole", setKind, resolved });
  assert.equal(gate(null), null);
  assert.equal(gate(smt(null, false)), null);
  assert.equal(gate(smt("nearest", true))?.setKind, "nearest");
  assert.equal(gate(smt(null, false)), null); // choosing another set
  assert.equal(gate(smt("saved", true))?.setKind, "saved");
});

test("a scope without the flag counts as resolved (pages that settle at once)", () => {
  const gate = createPageViewGate();
  assert.ok(gate({ product: "smt", urn: "110110", dashboard: "d", level: "whole", setKind: "nearest" }));
});
