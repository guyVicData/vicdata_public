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
