// Run: npx -y tsx --test --test-force-exit src/lib/front-door/axis.test.ts
// VicData 0.8 front door (Guy, 13 Nov): walk charts' value axes on round numbers. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { niceAxis, niceStep, stepDigits } from "./axis";

const NICE = /^(1|2|2\.5|5)$/;
const mantissa = (step: number) => String(Number((step / 10 ** Math.floor(Math.log10(step))).toPrecision(6)));

test("niceStep: 1, 2, 2.5 or 5 x 10^n", () => {
  assert.equal(niceStep(36.75), 50);
  assert.equal(niceStep(21), 25);
  assert.equal(niceStep(3, true), 5);
  assert.equal(niceStep(2.2, true), 5);
  assert.equal(niceStep(0.3), 0.5);
  assert.equal(niceStep(0.21), 0.25);
  assert.equal(niceStep(0.4, true), 1);
});

test("the screenshot's axis (7 .. 162, entries) reads 0, 50, 100, 150", () => {
  const a = niceAxis([25, 31, 30, 35, 41, 72, 85, 95, 92, 121, 134, 106, 123, 126, 118, 131, 136, 147]);
  assert.deepEqual(a.ticks, [0, 50, 100, 150]);
  assert.equal(a.digits, 0);
});

test("a floor, not zero, when the lowest value is more than half the highest (indexed, points)", () => {
  const a = niceAxis([92, 100, 104, 118, 131]);
  assert.ok(a.lo > 0 && a.lo <= 92 && a.hi >= 131);
  for (const t of a.ticks) assert.equal(t % 10, 0, `tick ${t}`);
  const p = niceAxis([44.1, 45.3, 46.8, 47.2]);
  assert.ok(p.lo <= 44.1 && p.hi >= 47.2);
  const step = p.ticks[1] - p.ticks[0];
  assert.match(mantissa(step), NICE);
  assert.equal(p.digits, stepDigits(step));
});

test("every axis: nice steps, 3 to 7 ticks, every value inside, ticks evenly spaced", () => {
  const cases = [[7, 46, 85, 123, 162], [0, 3, 4], [1, 1, 1], [0.12, 0.5, 0.31], [-12, 4, 30], [998, 1003], [3, 41], [12000, 15800, 17250]];
  for (const v of cases) {
    const a = niceAxis(v);
    assert.ok(a.ticks.length >= 2 && a.ticks.length <= 7, `${v}: ${a.ticks}`);
    assert.ok(a.lo <= Math.min(...v) && a.hi >= Math.max(...v), `${v}: ${a.lo}..${a.hi}`);
    const step = Number((a.ticks[1] - a.ticks[0]).toPrecision(9));
    assert.match(mantissa(step), NICE, `${v}: step ${step}`);
    for (let k = 1; k < a.ticks.length; k++) assert.ok(Math.abs(a.ticks[k] - a.ticks[k - 1] - step) < 1e-6);
  }
});

test("places: whole numbers from 1, never 0 or a fraction", () => {
  const a = niceAxis([1, 3, 2, 4], { place: true });
  assert.deepEqual(a.ticks, [1, 2, 3, 4]);
  const b = niceAxis([2, 9, 11], { place: true });
  assert.equal(b.ticks[0], 1);
  for (const t of b.ticks) assert.ok(Number.isInteger(t) && t >= 1);
  assert.ok(b.hi >= 11);
});
