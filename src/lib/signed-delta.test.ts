// VicData 0.8: R-NO-NEGATIVE-ZERO (year rules leftovers), R-MINUS-SIGN and R-FLAT-BAND (consistency).
// Run: npx -y tsx --test src/lib/signed-delta.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { arrowed, flatBand, signedDelta, signedValue, UNSIGNED_ZERO } from "./signed-delta";
import { entriesFirstPeriod, changeStartFor, TREND_BASE_PERIOD } from "../catalogue/years";

const pct = (x: number) => `${Math.abs(x).toFixed(0)}%`;

test("a change that rounds to zero prints as an exact zero does, in each style", () => {
  assert.equal(signedDelta(-0.3, pct), "+0%");
  assert.equal(signedDelta(-0.3, pct, UNSIGNED_ZERO), "0%");
  assert.equal(signedDelta(0, pct, UNSIGNED_ZERO), "0%");
  assert.equal(signedDelta(-0.04, (x) => `${Math.abs(x).toFixed(1)}%`, { zero: "±" }), "±0.0%");
  assert.equal(signedValue(-0.04, 1), "0.0");
});

test("R-MINUS-SIGN: a real negative carries the true minus, in every style", () => {
  assert.equal(signedDelta(-3, pct), "−3%");
  assert.equal(signedDelta(-3, pct, UNSIGNED_ZERO), "−3%");
  assert.equal(signedDelta(3, pct, UNSIGNED_ZERO), "+3%");
  assert.equal(signedValue(-1.25, 1), "−1.3");
  assert.equal(signedValue(0.4, 1), "0.4");
  for (const s of [signedDelta(-0.6, pct, UNSIGNED_ZERO), signedValue(-2, 0)]) assert.ok(!s.includes("-"), s);
});

test("R-FLAT-BAND: steady when the size rounds to zero at the precision shown", () => {
  assert.equal(flatBand(-0.4, 0), "flat");
  assert.equal(flatBand(-0.5, 0), "down");
  assert.equal(flatBand(0.04, 1), "flat");
  assert.equal(flatBand(0.05, 1), "up");
  assert.equal(flatBand(1.5, 0, 2), "flat"); // a view's own wider band
  assert.equal(arrowed(-0.4, (x) => `${x.toFixed(0)}%`, 0), "– 0%");
  assert.equal(arrowed(-3.2, (x) => `${x.toFixed(0)}%`, 0), "▼ 3%");
  assert.equal(arrowed(16.2, (x) => `${x.toFixed(0)}%`, 0), "▲ 16%");
});

test("R-ENTRIES-FIRST-YEAR: entries start at the first year with data; results at 2022/23", () => {
  assert.equal(entriesFirstPeriod([2023, 2020, 2021]), 2020);
  assert.equal(entriesFirstPeriod([]), null);
  assert.equal(changeStartFor("entries", [2021, 2020, 2024]), 2020);
  assert.equal(changeStartFor("entries", []), TREND_BASE_PERIOD);
  assert.equal(changeStartFor("results", [2020, 2021]), TREND_BASE_PERIOD);
});

test("R-FLAT-BAND: a change inside a view's wider band is steady but keeps its size", () => {
  assert.equal(arrowed(0.03, (x) => x.toFixed(2), 2, 0.05), "– 0.03");
  assert.equal(arrowed(-0.004, (x) => x.toFixed(2), 2, 0.05), "– 0.00");
});
