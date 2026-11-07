// Run: npx -y tsx --test src/lib/sets/sets.test.ts
// VicData 0.8 sets round 1: the model's pure rules (which sets fit a page, who curates), the
// Admissions adapter (the old list kinds read from sets, figures unchanged) and the recipes' pure
// parts (R-SET-DEFAULTS-ADMISSIONS's shapes; the live half is in scripts/catalogue-rule-tests.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { activePersonalCount, canCurate, creatorFor, setFitsPage, tierOf, type StoredSet } from "./model";
import { legacyKindOf, listRowsFromSets, savedListsFromSets, setShapeOfList } from "./admissions-lists";
import { feederRecipes, rivalRecipes, FEEDER_RECIPE_MAX, FEEDER_RECIPE_MIN } from "./recipes";
import { fromRow, type SetRow } from "./store";
import { entryPoint } from "../admissions/entry-points";
import type { SchoolTraits } from "../admissions/traits";

const set = (o: Partial<StoredSet>): StoredSet => ({
  id: "s1", name: "x", description: null, kind: "compared_against", entryPoint: null, phase: null, focusUrn: "110110", ownerScope: "school", schoolAccountId: "acc", ownerProfileId: null,
  creatorKind: "admissions", audience: null, rungAge: null, isDefault: false, pinned: false, folder: null, tags: [], archived: false, rule: null, sourceRecipe: null, laBlend: null, config: {},
  members: [], createdBy: null, createdAt: "2026-11-06T00:00:00Z", updatedBy: null, updatedAt: "2026-11-06T00:00:00Z", ...o,
});

test("a set fits a page by kind, and by entry point or phase (11+ is GCSE, 16+ Post-16)", () => {
  const ca11 = set({ entryPoint: "11+" });
  assert.equal(setFitsPage(ca11, { kind: "compared_against", entryPoint: "11+" }), true);
  assert.equal(setFitsPage(ca11, { kind: "compared_against", entryPoint: "16+" }), false);
  assert.equal(setFitsPage(ca11, { kind: "compared_against", phase: "ks4" }), true, "11+ sets on GCSE pages");
  assert.equal(setFitsPage(set({ entryPoint: "16+" }), { kind: "compared_against", phase: "ks5" }), true, "16+ sets on Post-16 pages");
  assert.equal(setFitsPage(set({ entryPoint: "16+" }), { kind: "compared_against", phase: "ks4" }), false);
  assert.equal(setFitsPage(set({ kind: "feeders", entryPoint: "11+" }), { kind: "compared_against", phase: "ks4" }), false, "feeder sets never in Teacher");
  assert.equal(setFitsPage(set({}), { kind: "compared_against", phase: "ks5" }), true, "a whole-school set fits any page of its kind");
  assert.equal(setFitsPage(set({ phase: "ks4" }), { kind: "compared_against", entryPoint: "11+" }), true, "a GCSE set on Admissions 11+");
  assert.equal(setFitsPage(set({ phase: "ks4" }), { kind: "compared_against", entryPoint: "4+" }), false);
});

test("who curates: compared-against by SMT, Admissions and the School-Admin; feeders by Admissions", () => {
  assert.equal(canCurate({ roles: ["smt"], isAdmin: false }, "compared_against"), true);
  assert.equal(canCurate({ roles: ["admissions"], isAdmin: false }, "compared_against"), true);
  assert.equal(canCurate({ roles: ["teacher"], isAdmin: true }, "compared_against"), true);
  assert.equal(canCurate({ roles: ["teacher"], isAdmin: false, isAccountHolder: true }, "compared_against"), true);
  assert.equal(canCurate({ roles: ["teacher"], isAdmin: false }, "compared_against"), false);
  assert.equal(canCurate({ roles: ["admissions"], isAdmin: false }, "feeders"), true);
  assert.equal(canCurate({ roles: ["smt"], isAdmin: true }, "feeders"), false);
  assert.equal(creatorFor({ roles: ["smt", "admissions"], isAdmin: false }, "compared_against"), "admissions");
  assert.equal(creatorFor({ roles: ["smt", "admissions"], isAdmin: false }, "compared_against", "smt"), "smt");
  assert.equal(creatorFor({ roles: ["smt", "admissions"], isAdmin: false }, "feeders", "smt"), "admissions");
  assert.equal(creatorFor({ roles: ["teacher"], isAdmin: true }, "compared_against"), "school_admin");
  assert.equal(creatorFor({ roles: ["teacher"], isAdmin: false }, "compared_against"), null);
});

test("the cap counts active personal sets only; untiered counts as Regular", () => {
  const mine = [set({ ownerScope: "personal", ownerProfileId: "p", creatorKind: "me" }), set({ ownerScope: "personal", ownerProfileId: "p", creatorKind: "me", archived: true }), set({})];
  assert.equal(activePersonalCount(mine, "p"), 1);
  assert.equal(tierOf(null), "regular");
  assert.equal(tierOf("main"), "main");
});

test("Admissions reads the school's default sets as the old lists, members in order", () => {
  const sets = [
    set({ id: "r", kind: "compared_against", entryPoint: "11+", isDefault: true, members: [{ urn: "2", position: 0, tier: null }, { urn: "1", position: 1, tier: null }], rule: { n: 10 } }),
    set({ id: "d", kind: "feeders", audience: "day", entryPoint: "11+", isDefault: true, members: [{ urn: "3", position: 0, tier: "main" }], laBlend: { "871": 1 } }),
    set({ id: "b", kind: "feeders", audience: "boarding", entryPoint: "11+", isDefault: true }),
    set({ id: "g", kind: "feeders", rungAge: 14, entryPoint: "16+", isDefault: true }),
    set({ id: "not-default", kind: "compared_against", entryPoint: "11+" }),
    set({ id: "personal", kind: "compared_against", entryPoint: "11+", ownerScope: "personal", creatorKind: "me", ownerProfileId: "p", schoolAccountId: null }),
  ];
  const lists = savedListsFromSets(sets, "11+");
  assert.deepEqual(lists.map((l) => l.kind), ["rivals", "day_feeders", "boarding_feeders"]);
  assert.deepEqual(lists[0].members, ["2", "1"]);
  assert.deepEqual(lists[1].la_blend, { "871": 1 });
  assert.deepEqual(savedListsFromSets(sets, "16+").map((l) => [l.kind, l.rung]), [["rung", "age:14"]]);
  const rows = listRowsFromSets(sets);
  assert.deepEqual(rows.map((r) => r.id), ["r", "d", "b", "g"]);
  assert.deepEqual(rows[0].fuzzy, { n: 10 });
  assert.equal(rows[0].updated_by_kind, "lead");
  assert.equal(legacyKindOf(set({ kind: "feeders" })), null, "a feeder set with no audience or rung isn't an old list");
  assert.deepEqual(setShapeOfList("rung", "age:13"), { kind: "feeders", audience: null, rungAge: 13, name: "Feeders for age 13" });
});

test("a database row reads as a set, members by position", () => {
  const row = { id: "x", name: "n", description: null, kind: "feeders", entry_point: "11+", phase: null, focus_urn: "110110", owner_scope: "school", school_account_id: "a", owner_profile_id: null, creator_kind: "admissions", audience: "day", rung_age: null, is_default: true, pinned: true, folder: null, tags: null, archived: false, rule: null, source_recipe: null, la_blend: null, config: null, created_by: null, created_at: "c", updated_by: "u", updated_at: "t", set_members: [{ urn: "b", position: 1, tier: null }, { urn: "a", position: 0, tier: "main" }] } as SetRow;
  const s = fromRow(row);
  assert.deepEqual(s.members.map((m) => m.urn), ["a", "b"]);
  assert.deepEqual(s.tags, []);
  assert.deepEqual(s.config, {});
});

// ------------------------------------------------------------------ recipes (pure parts)

const school = (urn: string, o: Partial<SchoolTraits>): SchoolTraits => ({ urn, name: `S${urn}`, sector: "state", gender: "mixed", boarding: false, low: 11, high: 18, laCode: "871", laName: "Reading", town: null, easting: 0, northing: 0, typeGroup: null, ...o });
const ring = (n: number, o: (i: number) => Partial<SchoolTraits>) => Array.from({ length: n }, (_, i) => school(String(200000 + i), { easting: (i + 1) * 1000, ...o(i) }));
const e11 = entryPoint("11+")!, e16 = entryPoint("16+")!;

test("rival recipes: the same sector's nearest ten teaching the entry year; boarding only for a boarding school; the LA set", () => {
  const me = school("110110", { sector: "independent", boarding: true });
  const near = ring(30, (i) => ({ sector: i % 2 ? "independent" : "state", boarding: i % 3 === 0, low: i === 1 ? 4 : 11, high: i === 3 ? 11 : 18 }));
  const r = rivalRecipes(me, e11, near, near, "bottom_three");
  assert.deepEqual(r.map((x) => x.key), ["adm:nearest-sector", "adm:nearest-boarding", "adm:la"]);
  assert.equal(r[0].name, "10 nearest | independent");
  assert.ok(r[0].urns.every((u) => near.find((s) => s.urn === u)!.sector === "independent"));
  assert.ok(!r[0].urns.includes("200003"), "a school ending at 11 doesn't teach the year after 11+");
  assert.equal(r[0].urns.length, 10);
  assert.ok(r[1].urns.every((u) => near.find((s) => s.urn === u)!.boarding));
  assert.equal(r[2].name, "Schools in Reading | all sectors");
  assert.equal(r.find((x) => x.isDefaultChoice)!.key, "adm:nearest-sector", "the third fifth defaults to the same-sector set");
  assert.equal(rivalRecipes(me, e11, near, near, "top_two").find((x) => x.isDefaultChoice)!.key, "adm:nearest-boarding", "the top two fifths default to the boarding set");
  const day = rivalRecipes(school("1", { boarding: false }), e11, near, near, "top_two");
  assert.ok(!day.some((x) => x.key === "adm:nearest-boarding"), "a day school has no boarding set");
  assert.equal(day.find((x) => x.isDefaultChoice)!.key, "adm:nearest-sector");
  assert.equal(rivalRecipes(me, e16, near, near, null).find((x) => x.key === "adm:la")!.name, "All post-16 in Reading");
});

test("feeder recipes: named by what they hold, sized by the radius (10 to 40), boarding versions for a boarding school", () => {
  const me = school("110110", { sector: "independent", boarding: true });
  const primaries = ring(60, (i) => ({ low: 4, high: 11, sector: i % 4 === 0 ? "independent" : "state", boarding: i % 8 === 0 }));
  const r = feederRecipes(me, e11, primaries, { day: 15, boarding: 30 });
  assert.deepEqual(r.map((x) => x.name), ["Day | all sectors", "Day | state", "Day | independent", "Boarding | all sectors", "Boarding | state", "Boarding | independent"]);
  assert.equal(r.find((x) => x.isDefaultChoice)!.name, "Day | all sectors");
  assert.equal(r[0].urns.length, 15, "the 15 within 15 km (one per km)");
  assert.equal(r[3].urns.length, 30, "boarding reaches to the cap");
  assert.ok(r[5].urns.some((u) => !primaries.find((s) => s.urn === u)!.boarding), "a boarding set suggests independent preps day or boarding, not boarding-only");
  const dense = feederRecipes(me, e11, ring(100, () => ({ low: 4, high: 11, easting: 100 })), { day: 15, boarding: 30 });
  assert.equal(dense[0].urns.length, FEEDER_RECIPE_MAX, "a dense area is capped");
  const sparse = feederRecipes(me, e11, ring(20, (i) => ({ low: 4, high: 11, easting: (i + 1) * 20000 })), { day: 15, boarding: 30 });
  assert.equal(sparse[0].urns.length, FEEDER_RECIPE_MIN, "a sparse area still gets the nearest ten");
  assert.equal(feederRecipes(school("1", { boarding: false }), e11, primaries, { day: 5, boarding: 15 }).length, 3, "a day school has day sets only");
  assert.ok(feederRecipes(me, e16, ring(20, () => ({ low: 11, high: 16 })), { day: 30, boarding: 30 })[0].urns.length === 20, "16+ feeders teach 15-year-olds");
});

// ------------------------------------------------------------------ the page's choice (B6-B11)
import { buildMenu, COMBO_KEY, resolveChoice } from "./admissions-page";
import type { RecipeSet } from "./recipes";

test("a page's choice: the school's own sets as before, a stored or default set by key, a stale key falls back", () => {
  const m = (urns: string[]) => urns.map((u, i) => ({ urn: u, position: i, tier: i === 0 ? ("main" as const) : null }));
  const day = set({ id: "day", kind: "feeders", audience: "day", entryPoint: "11+", isDefault: true, members: m(["1", "2"]) });
  const board = set({ id: "brd", kind: "feeders", audience: "boarding", entryPoint: "11+", isDefault: true, members: m(["3"]) });
  const other = set({ id: "oth", name: "Close preps", kind: "feeders", audience: "day", entryPoint: "11+", members: m(["9"]) });
  const mine = set({ id: "mine", kind: "feeders", entryPoint: "11+", ownerScope: "personal", creatorKind: "me", ownerProfileId: "p", schoolAccountId: null, members: m(["8"]) });
  const recipes: RecipeSet[] = [{ key: "adm:feeders:day:all", name: "Day | all sectors", kind: "feeders", entryPoint: "11+", urns: ["5", "6"], isDefaultChoice: true, how: "" }];
  const base = savedListsFromSets([day, board], "11+");
  const ps = { stored: [day, board, other, mine], recipes, boardingSchool: true };
  const own = resolveChoice(ps, e11, "feeders", null, base, "p", true);
  assert.equal(own.choice.key, COMBO_KEY, "a boarding school's day and boarding feeders together");
  assert.equal(own.lists, base, "exactly the old lists, so the figures can't change");
  assert.equal(own.choice.main, 2);
  const picked = resolveChoice(ps, e11, "feeders", "set:oth", base, "p", true);
  assert.deepEqual(picked.lists.map((l) => [l.kind, l.members]), [["day_feeders", ["9"]]]);
  assert.equal(resolveChoice(ps, e11, "feeders", "set:mine", base, "p", true).choice.block, "mine");
  assert.equal(resolveChoice(ps, e11, "feeders", "set:mine", base, "someone-else", true).choice.key, COMBO_KEY, "another person's set never resolves");
  assert.equal(resolveChoice(ps, e11, "feeders", "set:gone", base, "p", true).choice.key, COMBO_KEY, "a stale key falls back to the page's default");
  assert.deepEqual(resolveChoice(ps, e11, "feeders", "default:adm:feeders:day:all", base, "p", true).urns, ["5", "6"]);
  const fresh = resolveChoice({ stored: [], recipes, boardingSchool: false }, e11, "feeders", null, [], null, false);
  assert.equal(fresh.choice.name, "Day | all sectors", "no sets of its own: the default recipe");
  const dayOnly = resolveChoice({ ...ps, boardingSchool: false }, e11, "feeders", null, base, "p", true);
  assert.equal(dayOnly.choice.key, "set:day", "a day school never draws a boarding list");
  const menu = buildMenu(ps, e11, "feeders", own.choice, { profileId: "p", canCurate: true });
  assert.equal(menu.school[0].key, COMBO_KEY);
  assert.deepEqual(menu.school.slice(1).map((r) => r.key), ["set:day", "set:brd", "set:oth"]);
  assert.deepEqual(menu.mine.map((r) => r.key), ["set:mine"]);
  assert.equal(menu.label, "Feeder schools");
  assert.equal(menu.default[0].name, "Day | all sectors");
});
