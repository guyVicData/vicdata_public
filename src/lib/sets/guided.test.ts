// Run: npx -y tsx --test --test-force-exit src/lib/sets/guided.test.ts
// VicData 0.8 front door, part 2 (D21-D22): the guided sets editor's model (R-GUIDED-SETS) -- the chips
// filter the suggestions and the map, "This set now" is exact for a known set, the IGCSE count and the
// measure use the shared constant, and the editor saves through the round-1 library only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyChips, chipCounts, chipsFor, defaultChips, describe, feederType, guidedHref, guidedKindOf, guidedWords, resultsWords, setNow, SIMILAR_SIZE_BAND, toggleChip, yearWord, type GuidedRow } from "./guided";
import { IGCSE_SWITCH_SHARE } from "./results-coverage";

const row = (o: Partial<GuidedRow> & { urn: string }): GuidedRow => ({
  name: `School ${o.urn}`,
  km: 1,
  sector: "state",
  boarding: false,
  gender: "mixed",
  low: 4,
  high: 11,
  roll: 400,
  gcse: null,
  post16: null,
  igcse: false,
  hasGcse: false,
  hasPost16: false,
  easting: 1,
  northing: 1,
  ...o,
});

const feederPool = [
  row({ urn: "1", km: 1.8, sector: "independent", low: 3, high: 13 }), // prep, has Year 6
  row({ urn: "2", km: 2.0, low: 7, high: 11 }), // junior
  row({ urn: "3", km: 2.4 }), // primary
  row({ urn: "4", km: 3.1, low: 4, high: 7 }), // infant: primary, no Year 6
  row({ urn: "5", km: 16.0 }), // beyond 15 km
];

test("R-GUIDED-SETS: feeder chips filter the suggestions (and so the map), with faceted counts", () => {
  const ctx = { focus: null, entryAge: 11, maxKm: 15 };
  assert.equal(yearWord(10), "Year 6");
  assert.deepEqual(chipsFor("feeders", 11).map((c) => c.label), ["State", "Independent", "Primary", "Junior", "Prep", "Has Year 6"]);
  assert.deepEqual(applyChips(feederPool, [], ctx).map((r) => r.urn), ["1", "2", "3", "4"], "no chips: every school within the distance, nearest first");
  assert.deepEqual(applyChips(feederPool, ["entry_year"], ctx).map((r) => r.urn), ["1", "2", "3"], "Has Year 6 drops the infant school");
  assert.deepEqual(applyChips(feederPool, ["state", "entry_year"], ctx).map((r) => r.urn), ["2", "3"], "AND across groups");
  assert.deepEqual(applyChips(feederPool, ["state", "independent", "entry_year"], ctx).map((r) => r.urn), ["1", "2", "3"], "OR within a group");
  assert.deepEqual(applyChips(feederPool, ["junior"], ctx).map((r) => r.urn), ["2"]);
  assert.deepEqual(applyChips(feederPool, [], { ...ctx, maxKm: 20 }).map((r) => r.urn), ["1", "2", "3", "4", "5"], "the slider widens it");
  const counts = chipCounts(feederPool, ["state", "entry_year"], ctx, ["state", "independent", "primary", "prep", "entry_year"]);
  assert.deepEqual(counts, { state: 2, independent: 1, primary: 1, prep: 0, entry_year: 2 }, "each chip counts what it would show, the other groups as they are");
  assert.deepEqual(toggleChip(toggleChip(["state"], "state"), "prep"), ["prep"], "one tap to undo");
  assert.equal(feederType(row({ urn: "x", sector: "independent" })), "prep");
  assert.equal(describe(feederPool[0], "feeders"), "1.8 km · Independent prep");
});

test("R-GUIDED-SETS: suggestions start pre-filtered to the school's own profile", () => {
  assert.deepEqual(defaultChips("feeders", { sector: "state", gender: "mixed", boarding: false, roll: 900, gcse: null, post16: null }), ["state", "entry_year"]);
  assert.deepEqual(defaultChips("feeders", { sector: "independent", gender: "mixed", boarding: true, roll: 500, gcse: null, post16: null }), ["state", "independent", "entry_year"]);
  assert.deepEqual(defaultChips("rivals", { sector: "independent", gender: "girls", boarding: true, roll: 500, gcse: null, post16: null }), ["independent", "girls", "similar_size"]);
  assert.deepEqual(defaultChips("smt", { sector: "state", gender: "mixed", boarding: false, roll: null, gcse: null, post16: null }), ["state", "mixed"], "no roll, no size chip");
});

test("R-GUIDED-SETS: rival chips -- sector, day/boarding, gender, similar size (a band around the roll)", () => {
  const focus = { sector: "independent" as const, gender: "mixed" as const, boarding: true, roll: 600, gcse: 60, post16: 40 };
  const pool = [
    row({ urn: "a", sector: "independent", boarding: true, roll: 600 * SIMILAR_SIZE_BAND.low }),
    row({ urn: "b", sector: "independent", roll: 600 * SIMILAR_SIZE_BAND.high + 1, km: 2 }),
    row({ urn: "c", sector: "independent", gender: "girls", roll: 650, km: 3 }),
    row({ urn: "d", roll: 610, km: 4 }),
  ];
  const ctx = { focus, entryAge: 11, maxKm: 15 };
  assert.deepEqual(applyChips(pool, defaultChips("rivals", focus), ctx).map((r) => r.urn), ["a"]);
  assert.deepEqual(applyChips(pool, ["boarding"], ctx).map((r) => r.urn), ["a"]);
  assert.deepEqual(applyChips(pool, ["day", "similar_size"], ctx).map((r) => r.urn), ["c", "d"]);
  assert.equal(describe(pool[2], "rivals"), "3.0 km · Independent, day, girls");
});

test("R-GUIDED-SETS: This set now is exact for a known set", () => {
  const set = [
    row({ urn: "1", km: 1.8, sector: "independent", boarding: true }),
    row({ urn: "2", km: 2.0 }),
    row({ urn: "3", km: 13.9 }),
    row({ urn: "4", km: 6.1, sector: "independent" }),
    row({ urn: "5", km: null }),
  ];
  const now = setNow("feeders", set, { "1": "main", "3": "main", "4": null }, null, 11);
  assert.deepEqual(now, { schools: 5, km: { min: 1.8, max: 13.9, median: 4.1, located: 4 }, mix: { a: 3, b: 2, aWord: "state", bWord: "independent" }, main: 2, results: null });
  const rivals = setNow("rivals", set, {}, null, 11);
  assert.deepEqual(rivals.mix, { a: 4, b: 1, aWord: "day", bWord: "boarding" });
});

test("R-GUIDED-SETS: the rivals' results and IGCSE count use the shared 40% constant (R-ADM-MOMENTUM-IGCSE)", () => {
  assert.equal(IGCSE_SWITCH_SHARE, 0.4);
  const focus = { sector: "independent" as const, gender: "mixed" as const, boarding: false, roll: 600, gcse: 51, post16: 40 };
  // 2 of 5 without GCSE (40%, not over): stays on GCSE; the average is of the three with a figure.
  const five = [
    row({ urn: "1", gcse: 50, hasGcse: true, post16: 38, hasPost16: true }),
    row({ urn: "2", gcse: 46, hasGcse: true, post16: 36, hasPost16: true }),
    row({ urn: "3", gcse: 48.1, hasGcse: true }),
    row({ urn: "4", igcse: true, post16: 42, hasPost16: true }),
    row({ urn: "5", igcse: true, post16: 44, hasPost16: true }),
  ];
  const a = setNow("rivals", five, {}, focus, 11).results!;
  assert.deepEqual(a, { measure: "gcse", switched: false, avg: 48, withFigure: 3, you: 51, igcse: 2 });
  assert.equal(resultsWords(a).words, "avg Attainment 8 (you 51.0) · 2 sit IGCSE");
  // A third IGCSE school: 3 of 6 (50%, over), post-16 covers more: post-16 points.
  const six = [...five, row({ urn: "6", igcse: true, post16: 40, hasPost16: true })];
  const b = setNow("rivals", six, {}, focus, 11).results!;
  assert.equal(b.measure, "post16");
  assert.equal(b.switched, true);
  assert.equal(b.igcse, 3);
  assert.equal(b.you, 40);
  assert.equal(b.avg, 40);
  assert.equal(setNow("smt", six, {}, focus, 16).results!.measure, "post16", "at 16+ post-16 as before");
});

test("R-GUIDED-SETS: the questions, and the addresses the homes open", () => {
  assert.equal(guidedKindOf("feeders", "admissions"), "feeders");
  assert.equal(guidedKindOf("compared_against", "admissions"), "rivals");
  assert.equal(guidedKindOf("compared_against", "smt"), "smt");
  assert.equal(guidedWords("feeders", "11+").title, "Who feeds us at 11+?");
  assert.equal(guidedWords("rivals", "11+").title, "Who do we compete with at 11+?");
  assert.equal(guidedWords("smt", "11+").title, "Who do we measure ourselves against?");
  assert.equal(guidedHref({ urn: "110110", kind: "feeders", product: "admissions", entry: "11+", fromHome: true }), "/sets/guided?urn=110110&kind=feeders&product=admissions&entry=11%2B&from=home");
  assert.equal(guidedHref({ urn: "110110", kind: "compared_against", product: "smt" }), "/sets/guided?urn=110110&kind=compared_against&product=smt&phase=ks4");
});

test("R-GUIDED-SETS: the editor saves through the round-1 library only (same model and permissions)", () => {
  const editor = readFileSync(new URL("../../components/sets/GuidedSetEditor.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../app/sets/guided/page.tsx", import.meta.url), "utf8");
  assert.match(editor, /import \{ saveSet \} from "@\/lib\/sets\/store"/, "saveSet from store.ts (save_set)");
  for (const src of [editor, page]) {
    assert.doesNotMatch(src, /\.from\("sets"\)\.(insert|update|upsert|delete)|\.from\("set_members"\)|rpc\("save_set"/, "no second write path");
    assert.doesNotMatch(src, /SERVICE_ROLE|service_role/, "never a server key");
  }
  assert.match(page, /canCurate\(curator, kind\)/, "who curates: the round-1 rule");
  assert.match(page, /creatorFor\(curator, kind/, "saved under the round-1 creator");
  assert.match(page, /saveModeOf\(set/, "a copy for someone who can't change it");
  assert.match(editor, /tier: x\.tier === "main" \? null : "main"/, "Main / Close is the round-1 main tier");
  const route = readFileSync(new URL("../../app/api/sets/editor/route.ts", import.meta.url), "utf8");
  assert.match(route, /wide: sp\.get\("wide"\) === "1"/, "the guided editor reads the round-1 editor route");
});
