// VicData 0.8 Admissions feedback round 1 (F-13, R-ADM-VIEW-INTAKE-CHANGE): "Why did our intake change?", the
// pure split; round 2 (F-31): two steps and the "of which". Run: npx -y tsx --test src/lib/admissions/intake-change.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { birthsAge, endYears, isSmallIntake, logMean, meanOf, midYearAt, roundToTotal, splitIntake } from "./intake-change";

describe("the split: local cohort x your share (F-31)", () => {
  // Leighton Park at 16+, 15 km, 6 Nov 2026 (the same children counted at age 8 for the "of which").
  const base = { here: 5906, area: 6622, school: 82 };
  const latest = { here: 7310, area: 8134, school: 90 };
  it("two steps that add up to the change exactly, before and after rounding", () => {
    const s = splitIntake(base, latest)!;
    assert.equal(s.change, 8);
    assert.ok(Math.abs(s.parts.reduce((t, p) => t + p.exact, 0) - 8) < 1e-9);
    assert.equal(s.parts.reduce((t, p) => t + p.value, 0), 8);
    assert.deepEqual(s.parts.map((p) => p.key), ["cohort", "share"]);
  });
  it("each step is L x ln(factor now / factor then)", () => {
    const s = splitIntake(base, latest)!;
    const L = logMean(90, 82);
    assert.ok(Math.abs(s.parts[0].exact - L * Math.log(8134 / 6622)) < 1e-12);
    assert.ok(Math.abs(s.parts[1].exact - L * Math.log(90 / 8134 / (82 / 6622))) < 1e-12);
  });
  it("the of which shares the cohort step in proportion to each change, and adds up to it", () => {
    const s = splitIntake(base, latest)!;
    const o = s.ofWhich!;
    assert.equal(o.here + o.moved, s.parts[0].value);
    assert.ok(Math.abs(o.exactHere + o.exactMoved - s.parts[0].exact) < 1e-9);
    // here changed by 1,404 and moved in by 108, of 1,512: the shares follow.
    assert.ok(Math.abs(o.exactMoved / s.parts[0].exact - 108 / 1512) < 1e-12);
    assert.ok(o.moved >= 0 && o.moved < o.here);
  });
  it("opposite signs: more children here, more families leaving -- both signed, netting to the step", () => {
    // St Bonaventure's (102787) at 11+ shape: here up 153, moved in -206 -> -626.
    const s = splitIntake({ here: 2734, area: 2528, school: 208 }, { here: 2887, area: 2261, school: 199 })!;
    const o = s.ofWhich!;
    assert.ok(s.parts[0].value < 0);
    assert.ok(o.here > 0 && o.moved < 0);
    assert.equal(o.here + o.moved, s.parts[0].value);
  });
  it("the local cohort didn't change: each child is worth L / cohort, so a swap still shows", () => {
    const s = splitIntake({ here: 900, area: 1000, school: 50 }, { here: 1000, area: 1000, school: 60 })!;
    assert.equal(s.parts[0].value, 0);
    const o = s.ofWhich!;
    assert.ok(Math.abs(o.exactHere + o.exactMoved) < 1e-12);
    assert.ok(Math.abs(o.exactHere - (logMean(60, 50) / 1000) * 100) < 1e-12);
    assert.deepEqual([o.here, o.moved], [5, -5]);
  });
  it("nothing changes: every step is 0", () => {
    const s = splitIntake(base, base)!;
    assert.deepEqual(s.parts.map((p) => p.value), [0, 0]);
    assert.deepEqual([s.ofWhich!.here, s.ofWhich!.moved], [0, 0]);
  });
  it("no earliest age: the steps, without an of which", () => {
    const s = splitIntake({ ...base, here: null }, { ...latest, here: null })!;
    assert.equal(s.ofWhich, null);
    assert.equal(s.parts.reduce((t, p) => t + p.value, 0), 8);
  });
  it("a zero or missing figure: no split", () => {
    assert.equal(splitIntake(base, { ...latest, school: 0 }), null);
    assert.equal(splitIntake({ ...base, area: NaN }, latest), null);
  });
});

describe("rounding to a total", () => {
  it("largest remainders, both ways", () => {
    assert.deepEqual(roundToTotal([-2.68, 5.3, 7.37], 10), [-3, 5, 8]);
    assert.deepEqual(roundToTotal([1.5, 1.5, 1], 4), [2, 1, 1]);
    assert.deepEqual(roundToTotal([-1.4, -1.4, -0.2], -3), [-1, -2, 0]);
  });
  it("the log mean", () => {
    assert.equal(logMean(5, 5), 5);
    assert.ok(Math.abs(logMean(57, 47) - 10 / Math.log(57 / 47)) < 1e-12);
  });
});

describe("which years and ages", () => {
  it("the earliest age is 0 (born here), else the youngest the LSOA years hold for the base cohort", () => {
    assert.equal(birthsAge(11, 2019, 2011), 3); // born 2008; LSOA from 2011
    assert.equal(birthsAge(16, 2019, 2011), 8); // born 2003
    assert.equal(birthsAge(11, 2019, 2008), 0);
    assert.equal(birthsAge(11, 2019, 2018), null); // at the area-year age: no births part
  });
  it("mid-year ages line up with census ages", () => {
    assert.equal(midYearAt(2019, 11, 0), 2008);
    assert.equal(midYearAt(2025, 11, 10), 2024); // Year 6 the mid-year before entry
  });
  it("small intakes average three years at each end", () => {
    assert.equal(isSmallIntake(47, 57), false);
    assert.equal(isSmallIntake(29, 57), true);
    assert.equal(isSmallIntake(null, 57), true);
    assert.deepEqual(endYears(2019, 2025, true), { base: [2019, 2020, 2021], latest: [2023, 2024, 2025] });
    assert.deepEqual(endYears(2019, 2025, false), { base: [2019], latest: [2025] });
    assert.equal(meanOf([1, null, 3]), 2);
    assert.equal(meanOf([null]), null);
  });
});
