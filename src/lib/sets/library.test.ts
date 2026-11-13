// Run: npx -y tsx --test src/lib/sets/library.test.ts
// VicData 0.8 sets round 1 (D18): the library's sections, search, filters and sort; the entry points.
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterLibrary, foldersOf, sectionCounts, sortLibrary, usedWords, type LibraryItem } from "./library-view";
import { entriesFor } from "./library";

const item = (o: Partial<LibraryItem>): LibraryItem => ({ key: o.id ? `set:${o.id}` : "default:x", id: null, name: "x", description: null, kind: "compared_against", entry: "11+", phase: null, block: "school", creator: "smt", count: 10, urns: [], pinned: false, archived: false, lastUsedAt: null, folder: null, schoolNames: [], canChange: false, ...o });
const items = [
  item({ id: "a", name: "Rivals", block: "school", schoolNames: ["The Abbey School"], lastUsedAt: "2026-11-05", count: 10 }),
  item({ id: "b", name: "Day feeders", kind: "feeders", block: "school", count: 18, folder: "Boarding" }),
  item({ name: "10 nearest | independent", block: "default", creator: "default", count: 10 }),
  item({ id: "c", name: "My preps", block: "mine", creator: "me", kind: "feeders", entry: "16+", lastUsedAt: "2026-11-06", count: 4 }),
  item({ id: "d", name: "Old list", block: "mine", creator: "me", archived: true }),
];

test("sections: All leaves archived out; Archived shows them only; folders", () => {
  const f = { query: "", kind: "all" as const, entry: null };
  assert.deepEqual(filterLibrary(items, { ...f, section: "all" }).map((x) => x.name), ["Rivals", "Day feeders", "10 nearest | independent", "My preps"]);
  assert.deepEqual(filterLibrary(items, { ...f, section: "archived" }).map((x) => x.name), ["Old list"]);
  assert.deepEqual(filterLibrary(items, { ...f, section: "mine" }).map((x) => x.name), ["My preps"]);
  assert.deepEqual(filterLibrary(items, { ...f, section: "default" }).map((x) => x.name), ["10 nearest | independent"]);
  assert.deepEqual(filterLibrary(items, { ...f, section: "folder:Boarding" }).map((x) => x.name), ["Day feeders"]);
  assert.deepEqual(sectionCounts(items), { all: 4, default: 1, school: 2, mine: 1, archived: 1 });
  assert.deepEqual(foldersOf(items), ["Boarding"]);
});

test("search by a set or a school in it; kind and entry point; sort", () => {
  const f = { section: "all" as const, kind: "all" as const, entry: null };
  assert.deepEqual(filterLibrary(items, { ...f, query: "abbey" }).map((x) => x.name), ["Rivals"], "a school in it");
  assert.deepEqual(filterLibrary(items, { ...f, query: "prep" }).map((x) => x.name), ["My preps"]);
  assert.deepEqual(filterLibrary(items, { ...f, query: "", kind: "feeders" }).map((x) => x.name), ["Day feeders", "My preps"]);
  assert.deepEqual(filterLibrary(items, { ...f, query: "", entry: "16+" }).map((x) => x.name), ["My preps"]);
  const active = filterLibrary(items, { ...f, query: "" });
  assert.deepEqual(sortLibrary(active, "recent").map((x) => x.name).slice(0, 2), ["My preps", "Rivals"]);
  assert.deepEqual(sortLibrary(active, "az").map((x) => x.name), ["10 nearest | independent", "Day feeders", "My preps", "Rivals"]);
  assert.deepEqual(sortLibrary(active, "size").map((x) => x.name)[0], "Day feeders");
  assert.equal(usedWords(null), "never");
  assert.equal(usedWords("2026-11-05T00:00:00Z", new Date("2026-11-07T12:00:00Z")), "2 days ago");
});

test("entry points: the school's saved ones, else its age range's", () => {
  assert.deepEqual(entriesFor(["11+", "16+"], 3, 18), ["11+", "16+"]);
  assert.deepEqual(entriesFor([], 11, 18), ["11+", "16+"]);
  assert.deepEqual(entriesFor([], 3, 11), ["4+"]);
  assert.deepEqual(entriesFor([], 16, 19), ["16+"]);
});

// 0.8 front door part 2 (D23, R-SETS-MAKER-COLOURS): who made a set, as the library colours it.
test("R-SETS-MAKER-COLOURS: makers -- School orange for curated compared-against sets, Admissions sky for feeders, head office, VC, Mine, Default", async () => {
  const { makerOf, MAKERS, MAKER_WORD } = await import("./library-view");
  assert.equal(makerOf({ creator: "smt", kind: "compared_against" }), "school");
  assert.equal(makerOf({ creator: "admissions", kind: "compared_against" }), "school", "a curated compared-against set is the school's, whoever curated it");
  assert.equal(makerOf({ creator: "school_admin", kind: "compared_against" }), "school");
  assert.equal(makerOf({ creator: "admissions", kind: "feeders" }), "admissions");
  assert.equal(makerOf({ creator: "school_admin", kind: "feeders" }), "admissions");
  assert.equal(makerOf({ creator: "group", kind: "compared_against" }), "head_office");
  assert.equal(makerOf({ creator: "victoria_consultancy", kind: "compared_against" }), "vc");
  assert.equal(makerOf({ creator: "me", kind: "feeders" }), "mine");
  assert.equal(makerOf({ creator: "default", kind: "feeders" }), "default");
  assert.deepEqual(MAKERS.map((m) => MAKER_WORD[m]), ["School", "Head office", "Admissions", "Victoria Consultancy", "Mine", "Default"], "the Who made it key");
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const { tokensOf, makerPairs, contrast, AA } = await import("../front-door/contrast");
  const t = tokensOf(css, "#teacher-root");
  assert.equal(t["--maker-school-from"], "#fb923c", "School orange");
  assert.equal(t["--maker-head_office-to"], "#6b431e", "Head office bronze");
  assert.equal(t["--maker-admissions-to"], "#1596db", "Admissions sky");
  for (const p of makerPairs(css)) assert.ok(contrast(p.fg, p.bg) >= AA[p.kind], `${p.name}: ${contrast(p.fg, p.bg).toFixed(2)}`);
  const lib = readFileSync(new URL("../../components/sets/SetsLibrary.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(lib, /CreatorPill|creatorColours/, "the library draws maker pills and tiles, not round 1's tinted pills");
  assert.match(lib, /data-library-key/, "the sidebar's Who made it key");
});
