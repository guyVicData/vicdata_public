// VicData 0.8 year rules leftovers: R-NO-NEGATIVE-ZERO, in every style the views use.
// Run: npx -y tsx --test src/lib/signed-delta.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { HYPHEN_SIGN, HYPHEN_SIGN_PLUS_ZERO, signedDelta } from "./signed-delta";
import { entriesFirstPeriod, changeStartFor, TREND_BASE_PERIOD } from "../catalogue/years";

const pct = (x: number) => `${Math.abs(x).toFixed(0)}%`;

test("a change that rounds to zero prints as an exact zero does, in each style", () => {
  assert.equal(signedDelta(-0.3, pct), "+0%");
  assert.equal(signedDelta(-0.3, pct, HYPHEN_SIGN), "0%");
  assert.equal(signedDelta(0, pct, HYPHEN_SIGN), "0%");
  assert.equal(signedDelta(-0.3, pct, HYPHEN_SIGN_PLUS_ZERO), "+0%");
  assert.equal(signedDelta(-0.04, (x) => `${Math.abs(x).toFixed(1)}%`, { zero: "±" }), "±0.0%");
  assert.equal(signedDelta(-0.04, (x) => Math.abs(x).toFixed(1), { ...HYPHEN_SIGN, plus: "" }), "0.0");
});

test("a real change keeps its sign, in each style", () => {
  assert.equal(signedDelta(-3, pct), "−3%");
  assert.equal(signedDelta(-3, pct, HYPHEN_SIGN), "-3%");
  assert.equal(signedDelta(3, pct, HYPHEN_SIGN), "+3%");
  assert.equal(signedDelta(3, pct, { ...HYPHEN_SIGN, plus: "" }), "3%");
  assert.equal(signedDelta(-0.6, pct, HYPHEN_SIGN), "-1%");
});

test("R-ENTRIES-FIRST-YEAR: entries start at the first year with data; results at 2022/23", () => {
  assert.equal(entriesFirstPeriod([2023, 2020, 2021]), 2020);
  assert.equal(entriesFirstPeriod([]), null);
  assert.equal(changeStartFor("entries", [2021, 2020, 2024]), 2020);
  assert.equal(changeStartFor("entries", []), TREND_BASE_PERIOD);
  assert.equal(changeStartFor("results", [2020, 2021]), TREND_BASE_PERIOD);
});
