// Run: npx -y tsx --test src/lib/sets/editor.test.ts
// VicData 0.8 sets round 1 (C13-C17, E22): the editor's tick list, its save mode, "How close" and the
// tiers' effects on the feeder views -- the pure parts (R-SET-EDITOR-TICK, R-SET-HOW-CLOSE, R-FEEDER-TIERS).
import { test } from "node:test";
import assert from "node:assert/strict";
import { add, changed, feederSummary, groupItems, initItems, isBigFeederSet, isLondonLa, saveModeOf, setTier, sortByTier, toSave, toggle } from "./editor-state";
import { closeness, closenessWords, median } from "./closeness";
import { mainFalling, mainFallingWords, mainFirst } from "./tiers";

test("a tick means in the set: untick and retick restores; save drops the unticked", () => {
  const start = [{ urn: "1" }, { urn: "2", tier: "main" as const }, { urn: "3" }];
  let items = initItems(start);
  items = toggle(items, "2");
  assert.equal(items.find((x) => x.urn === "2")!.ticked, false, "unticked stays listed, greyed");
  assert.equal(items.length, 3);
  assert.deepEqual(toSave(items).map((x) => x.urn), ["1", "3"], "save drops it");
  items = toggle(items, "2");
  assert.deepEqual(toSave(items), [{ urn: "1", tier: null }, { urn: "2", tier: "main" }, { urn: "3", tier: null }], "ticking again restores it, tier and all");
  assert.equal(changed(items, start), false, "back to where it started");
  items = add(items, "4");
  items = add(items, "1");
  assert.deepEqual(toSave(items).map((x) => x.urn), ["1", "2", "3", "4"], "adding a listed school just ticks it");
  assert.equal(setTier(items, "4", "occasional").find((x) => x.urn === "4")!.tier, "occasional");
});

test("you can't change a default set or another's: a copy, saved only as your own", () => {
  const school = { ownerScope: "school" as const, ownerProfileId: null };
  assert.equal(saveModeOf(school, { profileId: "p", canCurate: true }), "save");
  assert.equal(saveModeOf(school, { profileId: "p", canCurate: false }), "copy", "a teacher can't change a school set");
  assert.equal(saveModeOf({ ownerScope: "personal", ownerProfileId: "p" }, { profileId: "p", canCurate: false }), "save");
  assert.equal(saveModeOf({ ownerScope: "personal", ownerProfileId: "q" }, { profileId: "p", canCurate: true }), "copy");
  assert.equal(saveModeOf(null, { profileId: "p", canCurate: true, isDefault: true }), "copy", "a default set");
  assert.equal(saveModeOf(null, { profileId: "p", canCurate: false }), "new");
});

test("tiers sort the list; big feeder sets group, Occasional and Untiered collapsed; the summary", () => {
  const items = initItems([{ urn: "a" }, { urn: "b", tier: "occasional" }, { urn: "c", tier: "main" }, { urn: "d", tier: "regular" }, { urn: "e", tier: "main" }]);
  assert.deepEqual(sortByTier(items).map((x) => x.urn), ["c", "e", "d", "b", "a"]);
  const info = (u: string) => ({ laName: u < "c" ? "Reading" : "Wokingham", sector: u === "a" ? ("independent" as const) : ("state" as const) });
  const g = groupItems(sortByTier(items), "tier", info);
  assert.deepEqual(g.map((x) => [x.label, x.items.length, x.collapsedAtStart]), [["Main", 2, false], ["Regular", 1, false], ["Occasional", 1, true], ["Untiered", 1, true]]);
  assert.deepEqual(groupItems(items, "borough", info).map((x) => x.label), ["Reading", "Wokingham"]);
  assert.deepEqual(groupItems(items, "sector", info).map((x) => x.label), ["Independent", "State"]);
  assert.equal(feederSummary(items, (u) => (u === "c" ? "falling" : null)), "5 schools · 2 main · 1 main feeder falling");
  assert.equal(isBigFeederSet(25, null), true);
  assert.equal(isBigFeederSet(22, { sector: "state", laCode: "305" }), true, "a London state school from 20");
  assert.equal(isBigFeederSet(22, { sector: "independent", laCode: "305" }), false);
  assert.equal(isLondonLa("871"), false);
});

test("how close: the exact range and median, the results switch's start and counts, the population", () => {
  const s = (urn: string, km: number | null, o: Partial<{ boarding: boolean; hasGcse: boolean; hasPost16: boolean; igcse: boolean; pupils: number; gender: "mixed" | "girls" | "boys" }> = {}) => ({ urn, km, boarding: false, gender: "mixed" as const, pupils: 60, hasGcse: true, hasPost16: false, igcse: false, ...o });
  const set = [s("1", 2.5), s("2", 4.8, { boarding: true }), s("3", 12.4, { hasGcse: false, igcse: true, hasPost16: true }), s("4", 7.1, { hasPost16: true })];
  const c = closeness({ boarding: true, gender: "mixed", pupils: 90 }, set, 11);
  assert.deepEqual(c.distance, { min: 2.5, max: 12.4, median: (4.8 + 7.1) / 2, withDistance: 4 });
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(c.results.gcse, 3);
  assert.equal(c.results.post16, 2);
  assert.equal(c.results.startsOn, "gcse", "GCSE covers more: it starts there");
  const ig = [s("1", 1, { hasGcse: false, igcse: true, hasPost16: true }), s("2", 2, { hasGcse: false, igcse: true, hasPost16: true }), s("3", 3, { hasGcse: false, hasPost16: true }), s("4", 4, { hasPost16: false })];
  assert.equal(closeness(null, ig, 11).results.startsOn, "post16", "most sit IGCSEs and post-16 covers more: it starts on Post-16");
  assert.equal(closeness(null, ig, 16).results.startsOn, "post16");
  const w = closenessWords(c, "Leighton Park");
  assert.match(w.distance, /^All within 12\.4 km · median 6 km$/);
  assert.match(w.results, /2 of 4 have Post-16 results; 3 have GCSE results \(1 sit IGCSEs\)/);
  assert.match(w.population, /^1 of 4 board, as you do · 4 of 4 mixed, as you are · median 60 pupils at the age against your 90\. Counts only/);
});

test("tiers drive the feeder views: Main first, a falling Main feeder raises the alert", () => {
  const rows = [{ urn: "a", name: "A", flag: null }, { urn: "b", name: "B", flag: { id: "feeder_red" } }, { urn: "c", name: "C", flag: { id: "feeder_red" } }, { urn: "d", name: "D", flag: null }];
  const tiers = { a: "regular" as const, b: "main" as const, c: "occasional" as const, d: "main" as const };
  assert.deepEqual(mainFirst(rows, tiers).map((r) => r.urn), ["b", "d", "a", "c"]);
  assert.deepEqual(mainFirst(rows, { a: "regular" as const }).map((r) => r.urn), ["a", "b", "c", "d"], "no Main: the order stands");
  assert.deepEqual(mainFalling(rows, tiers).map((r) => r.urn), ["b"], "an Occasional feeder never alerts");
  assert.equal(mainFallingWords(mainFalling(rows, tiers)), "Main feeder falling: B");
  assert.equal(mainFallingWords([]), null);
});
