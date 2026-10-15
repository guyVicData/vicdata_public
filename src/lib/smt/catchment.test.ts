// VicData 0.8 SMT round 4 (R-SMT-RADIUS, R-SMT-FORWARD): the catchment rules and the authority-mix line,
// pure. Guy's decisions of 15 Oct 2026: km; 5 km state / 15 km independent by default; capped at 15 km
// for a state school without a sixth form, 30 km otherwise.
// Run: npx -y tsx --test src/lib/smt/catchment.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catchmentCapKm, catchmentDefaultKm, catchmentPresets, catchmentRights, clampKm, hasSixthForm, kmToMiles, resolveCatchment } from "./catchment";
import { mixLine } from "./context";

const state1116 = { independent: false, high: 16, phases: { post16: false } };
const state1118 = { independent: false, high: 18, phases: { post16: true } };
const primary = { independent: false, high: 11, phases: { post16: false } };
const independentPrep = { independent: true, high: 13, phases: { post16: false } };

describe("catchment: defaults and caps by the school's type", () => {
  it("5 km for a state school, 15 km for an independent one", () => {
    assert.equal(catchmentDefaultKm(state1116), 5);
    assert.equal(catchmentDefaultKm(primary), 5);
    assert.equal(catchmentDefaultKm(independentPrep), 15);
  });
  it("15 km for a state school without a sixth form, 30 km for an independent school or any with one", () => {
    assert.equal(catchmentCapKm(state1116), 15);
    assert.equal(catchmentCapKm(primary), 15);
    assert.equal(catchmentCapKm(state1118), 30);
    assert.equal(catchmentCapKm(independentPrep), 30);
    assert.equal(hasSixthForm({ independent: false, high: 16, phases: { post16: true } }), true);
  });
  it("presets stop at the cap", () => {
    assert.deepEqual(catchmentPresets(state1116), [2, 3, 5, 8, 10, 15]);
    assert.deepEqual(catchmentPresets(state1118), [2, 3, 5, 8, 10, 15, 20, 30]);
  });
});

describe("catchment: which radius a board draws", () => {
  it("the view's own, else the saved, else the default", () => {
    assert.deepEqual(resolveCatchment(state1118, null, null), { km: 5, savedKm: null, defaultKm: 5, capKm: 30, from: "default", capped: false });
    assert.equal(resolveCatchment(state1118, null, 8).km, 8);
    assert.equal(resolveCatchment(state1118, null, 8).from, "saved");
    assert.equal(resolveCatchment(state1118, "3", 8).km, 3);
    assert.equal(resolveCatchment(state1118, "3", 8).from, "view");
    assert.equal(resolveCatchment(state1118, "", 8).from, "saved");
  });
  it("never past the cap; a saved catchment over it draws at the cap, marked", () => {
    const r = resolveCatchment(state1116, null, 20);
    assert.equal(r.km, 15);
    assert.equal(r.capped, true);
    assert.equal(resolveCatchment(state1116, "25", null).km, 15);
  });
  it("whole km from 2; nonsense is no radius", () => {
    assert.equal(clampKm("7.6", state1118), 8);
    assert.equal(clampKm(1, state1118), 2);
    assert.equal(clampKm("x", state1118), null);
    assert.equal(clampKm(undefined, state1118), null);
  });
  it("km to the ingest's miles", () => {
    assert.ok(Math.abs(kmToMiles(5 * 1.609344) - 5) < 1e-12);
  });
});

describe("the authority mix line (R5)", () => {
  const mix = [
    { lad: "E06000041", name: "Wokingham", share: { "11-15": 49.3, "16-18": 30, "0-18": 47 } },
    { lad: "E06000038", name: "Reading", share: { "11-15": 46.1, "16-18": 60, "0-18": 46 } },
    { lad: "E06000037", name: "West Berkshire", share: { "11-15": 4.1, "16-18": 9.6, "0-18": 6 } },
    { lad: "E07000179", name: "South Oxfordshire", share: { "11-15": 0.5, "16-18": 0.4, "0-18": 1 } },
  ];
  it("a band the lookup gives: under 1% folds into other", () => {
    assert.deepEqual(mixLine(mix, [11, 15], () => null, "5 km"), { line: "Within 5 km: Wokingham 49%, Reading 46%, West Berkshire 4%, other 1%", ages: "children aged 11–15" });
  });
  it("two bands that make up the ages, weighted by the area's children in each", () => {
    // 11-18 = 11-15 (100 children) + 16-18 (300): Reading (46.1 x 100 + 60 x 300) / 400 = 56.5%.
    const r = mixLine(mix, [11, 18], (k) => (k === "11-15" ? 100 : k === "16-18" ? 300 : null), "5 km");
    assert.equal(r?.line, "Within 5 km: Reading 57%, Wokingham 35%, West Berkshire 8%");
    assert.equal(r?.ages, "children aged 11–18");
  });
  it("anything else: all ages 0-18, said", () => {
    assert.equal(mixLine(mix, [5, 15], () => null, "5 km")?.ages, "children aged 0–18");
  });
  it("at most five authorities; the rest are other", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ lad: `L${i}`, name: `LA ${i}`, share: { "11-15": 11.1 } }));
    assert.equal(mixLine(many, [11, 15], () => null, "30 km")?.line, "Within 30 km: LA 0 11%, LA 1 11%, LA 2 11%, LA 3 11%, LA 4 11%, other 44%");
  });
  it("no mix (the LA, or no neighbourhoods): no line", () => {
    assert.equal(mixLine([], [11, 15], () => null, "5 km"), null);
  });
});

describe("head office and the saved catchment (0.8 audit fixes, 9)", () => {
  it("head office reads the school's saved catchment through the server, and never saves it", () => {
    assert.deepEqual(catchmentRights({ headOffice: { groupName: "Harris Federation" } }), { read: "server", mayTrySave: false });
  });
  it("the school's own members read with their own token; saving is left to RLS (its School-Admin)", () => {
    assert.deepEqual(catchmentRights({ headOffice: null }), { read: "own-token", mayTrySave: true });
  });
});
