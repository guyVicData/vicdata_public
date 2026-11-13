// VicData 0.8 group sets, M3: the groups library (R-GROUP-LIBRARY), on the ingest's real index (the
// fixtures: every listed group, 8 Nov) and on small hand-made cards for the edge cases.
//   VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures npx tsx --test src/lib/groups/library.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupLibraryIndex } from "./aggregates";
import { DEFAULT_FILTER, filterFromQuery, filterToQuery, headlineWords, libraryCards, likeUsWords, mainRegions, regionWords, rollWords, sizeBandOf, typeAndSize, type IndexCard } from "./library";

const card = (o: Partial<IndexCard>): IndexCard => ({
  group_id: "x", name: "X", type: "mat", source: "gias_groups", schools: 10, likely: 0, census: 2025, regions: {}, schools_by_phase: { primary: 0, secondary: 0, post16: 0 },
  roll_by_phase: { primary: 0, secondary: 0, post16: 0 }, main_phase: null, roll: 1000, change_3: { from_period: 2022, combined_pct: null, same_schools_pct: null, same_schools: null }, headline: {}, peer: null, ...o,
});

test("R-GROUP-LIBRARY: the index lists each listed group once, of the six types, 2+ schools; Harris once, its sponsor record and non-mainstream groups not", async () => {
  const ix = await groupLibraryIndex();
  const ids = ix.groups.map((c) => c.group_id);
  assert.ok(ids.length > 1500, String(ids.length));
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.includes("3320") && !ids.includes("3319"));
  assert.ok(ix.groups.every((c) => ["mat", "federation", "foundation_trust", "independent_company", "independent_charity", "independent_other"].includes(c.type) && c.schools >= 2));
  // The Eden Academy: a special-school trust, held out (LF3) until its own milestone.
  assert.ok(!ix.groups.some((c) => c.name.toUpperCase() === "THE EDEN ACADEMY"));
});

test("groups like us: same type; our peer set first, then nearest in size; never our own card", async () => {
  const ix = await groupLibraryIndex();
  const us = ix.groups.find((c) => c.group_id === "3320")!;
  const out = libraryCards(ix.groups, us, DEFAULT_FILTER);
  assert.ok(!out.some((c) => c.group_id === "3320"));
  assert.ok(out.every((c) => c.type === "mat"));
  const peers = out.filter((c) => c.peer?.set_id === "peer:mat:41+");
  assert.equal(peers.length, 15, "the other 15 MATs with 41+ schools");
  assert.deepEqual(out.slice(0, 15).map((c) => c.group_id).sort(), peers.map((c) => c.group_id).sort(), "they come first");
  const gaps = out.slice(0, 15).map((c) => Math.abs(c.schools - us.schools));
  assert.deepEqual(gaps, [...gaps].sort((a, b) => a - b), "nearest in size first");
  assert.match(likeUsWords(us)!, /MATs with 41\+ schools first/);
  assert.ok(libraryCards(ix.groups, us, { ...DEFAULT_FILTER, likeUs: false }).some((c) => c.type !== "mat"), "all types when like-us is off");
});

test("region: most schools in (a tie counts in both), or has a school in; main region named first", () => {
  const tie = card({ group_id: "t", regions: { E12000007: 3, E12000008: 3, E12000006: 1 } });
  const lon = card({ group_id: "l", regions: { E12000007: 50, E12000006: 5 } });
  assert.deepEqual(mainRegions(tie).sort(), ["E12000007", "E12000008"]);
  assert.equal(regionWords(lon), "London · also East of England");
  assert.equal(regionWords(tie), "London and South East · also East of England");
  const most = libraryCards([tie, lon], null, { ...DEFAULT_FILTER, likeUs: false, regions: ["E12000008"] });
  assert.deepEqual(most.map((c) => c.group_id), ["t"]);
  const has = libraryCards([tie, lon], null, { ...DEFAULT_FILTER, likeUs: false, regions: ["E12000006"], regionMode: "has" });
  assert.deepEqual(has.map((c) => c.group_id).sort(), ["l", "t"]);
  assert.deepEqual(libraryCards([tie, lon], null, { ...DEFAULT_FILTER, likeUs: false, regions: ["E12000006"] }), [], "nobody's main region");
});

test("D7: the headline for the phase in view against England; on All phases the main phase, labelled; independents without results say so", () => {
  const sec = card({ main_phase: "secondary", schools_by_phase: { primary: 2, secondary: 3, post16: 1 }, headline: { secondary: { measure: "ks4_a8", period: 2025, weighted: 46.23, n_with_figure: 3, england: 47.63 }, primary: { measure: "ks2_rwm", period: 2024, weighted: 70, n_with_figure: 2, england: 63.84 } } });
  assert.equal(headlineWords(sec, "all").text, "Secondary · A8 46.2, England 47.6");
  assert.equal(headlineWords(sec, "primary").text, "Primary · KS2 RWM 70%, England 64%");
  const indie = card({ type: "independent_company", main_phase: "secondary", schools_by_phase: { primary: 0, secondary: 4, post16: 0 }, headline: { secondary: { measure: "ks4_a8", period: null, weighted: null, n_with_figure: 0, england: null } } });
  assert.equal(headlineWords(indie, "all").text, "Results not published");
  assert.equal(headlineWords(sec, "post16").text, "No results published");
  assert.equal(headlineWords(card({ schools_by_phase: { primary: 0, secondary: 3, post16: 0 } }), "primary").text, "No primary schools");
});

test("card words: type and size, likely members, roll and 3-year change, size bands", () => {
  assert.deepEqual(typeAndSize(card({ type: "mat", schools: 41, likely: 2 })), { line: "MAT · 41 schools", likely: "+2 likely" });
  assert.equal(rollWords(card({ roll: 48960, change_3: { from_period: 2022, combined_pct: 6.21, same_schools_pct: -1.4, same_schools: 50 } })), "48,960 pupils · +6.2% over 3 years");
  assert.equal(sizeBandOf(41), "41+");
  assert.equal(sizeBandOf(5), "2–5");
});

test("the filter round-trips through the address; junk is dropped", () => {
  const f = { ...DEFAULT_FILTER, likeUs: false, types: ["foundation_trust"], bands: ["21–40"], regions: ["E12000007"], regionMode: "has" as const, phases: ["post16" as const], search: "ark", sort: "size" as const, focus: "secondary" as const };
  assert.deepEqual(filterFromQuery(filterToQuery(f)), f);
  assert.deepEqual(filterFromQuery(new URLSearchParams("type=sat,mat&band=99&region=XX&sort=evil&focus=nursery")), { ...DEFAULT_FILTER, types: ["mat"] });
});

test("search finds a group by its tidied or its registered name", async () => {
  const ix = await groupLibraryIndex();
  const out = libraryCards(ix.groups, null, { ...DEFAULT_FILTER, likeUs: false, search: "united learning" });
  assert.ok(out.some((c) => /united learning/i.test(c.name)), out.map((c) => c.name).join("; "));
});

test("a group's page: Harris's tracklist (current members), its AP school tagged, its same-type rank (R-GROUP-RANK-SAME-TYPE)", async () => {
  const { groupAggregate, groupSchoolsYear } = await import("./aggregates");
  const { libraryGroupPage } = await import("./library-page");
  const ix = await groupLibraryIndex();
  const card = ix.groups.find((c) => c.group_id === "3320")!;
  const page = libraryGroupPage(card, await groupAggregate("3320", "at_time"), await groupSchoolsYear("3320"), card);
  assert.equal(page.isUs, true);
  assert.equal(page.schools.length, 59, "every current member, likely ones included");
  const ap = page.schools.filter((s) => s.note === "AP · not in group figures");
  assert.equal(ap.length, 1);
  assert.equal(ap[0].headline, null);
  assert.match(page.rank!.text, /^\d+(st|nd|rd|th)(=)? of \d+ MATs with 41\+ schools$/);
  assert.ok(page.schools.every((s, i, a) => i === 0 || (a[i - 1].roll ?? -1) >= (s.roll ?? -1)), "largest first");
});
