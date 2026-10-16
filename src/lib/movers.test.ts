// VicData 0.8 IGCSE subjects (follow-up 6): no negative zero, and the movers worded from what's printed.
// Run: npx -y tsx --test src/lib/movers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENTRIES_MEASURE, formatChange, headlineMeasure, measuresFor, moversSentence, signedDelta } from "./teacher-view-panels";

test("a change that rounds to zero prints as zero does, never −0", () => {
  assert.equal(signedDelta(-0.04, (x) => x.toFixed(1)), "+0.0");
  assert.equal(signedDelta(0, (x) => x.toFixed(1)), "+0.0");
  assert.equal(signedDelta(-0.06, (x) => x.toFixed(1)), "−0.1");
  assert.equal(signedDelta(-0.4, (x) => `${Math.round(x)}pp`), "+0pp");
  assert.equal(signedDelta(-0.4, (x) => `${Math.round(x)}%`), "+0%");
  assert.equal(signedDelta(2.25, (x) => x.toFixed(1)), "+2.3");
  const all = [...measuresFor("ks4"), ...measuresFor("ks5"), ENTRIES_MEASURE, headlineMeasure("ks4", "Attainment 8"), headlineMeasure("ks2", "RWM")];
  for (const m of all) assert.ok(!m.formatDelta(-0.0001).startsWith("−"), `${m.id}: ${m.formatDelta(-0.0001)}`);
  assert.ok(!formatChange({ changeKind: "percent", formatDelta: String }, -0.3).startsWith("−"));
});

test("the movers: grown the most only when the top change prints above zero", () => {
  assert.equal(moversSentence({ label: "Maths", printed: "+0.4" }, { label: "Art", printed: "−0.2" }, "2022/23"), "Maths has grown the most (+0.4); Art has declined the most (−0.2) since 2022/23.");
  assert.equal(moversSentence({ label: "Maths", printed: "−0.1" }, { label: "Art", printed: "−0.9" }, "2022/23"), "Maths has fallen the least (−0.1); Art has declined the most (−0.9) since 2022/23.");
  assert.equal(moversSentence({ label: "Maths", printed: "+0.0" }, { label: "Art", printed: "−0.3" }, "2022/23"), "Maths has held steady (+0.0); Art has declined the most (−0.3) since 2022/23.");
  assert.equal(moversSentence({ label: "Maths", printed: "+0.9" }, { label: "Art", printed: "+0.2" }, "2022/23"), "Maths has grown the most (+0.9); Art has grown the least (+0.2) since 2022/23.");
});
