// VicData 0.8 Admissions feedback round 1 (F-13, R-ADM-VIEW-INTAKE-CHANGE): "Why did our intake change?", the
// pure split. Run: npx -y tsx --test src/lib/admissions/intake-change.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { birthsAge, endYears, isSmallIntake, logMean, meanOf, midYearAt, roundToTotal, splitIntake } from "./intake-change";

describe("the split: births x families moving x your share", () => {
  // Leighton Park at 11+, 15 km, 29 Oct 2026 (children aged 3 standing in for births).
  const base = { births: 7112, area: 7332, school: 47 };
  const latest = { births: 6754, area: 7713, school: 57 };
  it("adds up to the change exactly, before and after rounding", () => {
    const s = splitIntake(base, latest)!;
    assert.equal(s.change, 10);
    assert.ok(Math.abs(s.parts.reduce((t, p) => t + p.exact, 0) - (57 - 47)) < 1e-9);
    assert.equal(s.parts.reduce((t, p) => t + p.value, 0), 10);
    assert.deepEqual(s.parts.map((p) => [p.key, p.value]), [["births", -3], ["moving", 5], ["share", 8]]);
  });
  it("each part is L x ln(factor now / factor then)", () => {
    const s = splitIntake(base, latest)!;
    const L = logMean(57, 47);
    assert.ok(Math.abs(s.parts[0].exact - L * Math.log(6754 / 7112)) < 1e-12);
    assert.ok(Math.abs(s.parts[2].exact - L * Math.log(57 / 7713 / (47 / 7332))) < 1e-12);
  });
  it("nothing changes: every part is 0", () => {
    assert.deepEqual(splitIntake(base, base)!.parts.map((p) => p.value), [0, 0, 0]);
  });
  it("a zero or missing figure: no split", () => {
    assert.equal(splitIntake(base, { ...latest, school: 0 }), null);
    assert.equal(splitIntake({ ...base, births: NaN }, latest), null);
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
  it("births are age 0, else the youngest age the LSOA years hold for the base cohort", () => {
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
