// Run: npx tsx --test --test-force-exit src/lib/front-door/smt-sets-panel.test.tsx
// Leighton Park prep (20 Nov): the SMT home's comparison panel -- says what the set is for, lists the choices
// with the one in use ticked, words a large set (the map is for small ones), opens the builder unless read-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRankings, SmtSetsPanel } from "@/components/front-door/smt-sets-panel";
import type { SmtSetState } from "@/components/smt/useSmtSet";
import type { SavedSetsPayload } from "@/lib/teacher-view-saved-sets";

const saved = {
  me: { membershipId: "m", schoolAccountId: "a", canEditShared: false },
  cap: 8,
  personalCount: 1,
  sets: [
    { id: "s1", name: "Berkshire independents", shared: true, mine: false, editable: false, config: {}, members: Array.from({ length: 7 }, (_, i) => ({ urn: `${i}` })), rows: [] },
    { id: "s2", name: "My boarding rivals", shared: false, mine: true, editable: true, config: {}, members: Array.from({ length: 5 }, (_, i) => ({ urn: `${i}` })), rows: [] },
  ],
  seriesByUrn: {},
  excludedUrns: [],
  candidates: [],
} as unknown as SavedSetsPayload;

const state = (choice: SmtSetState["choice"], urns: number): SmtSetState => ({ choice, set: { kind: choice.kind, label: "Berkshire independents", urns: Array.from({ length: urns }, (_, i) => `${i}`) }, savedSets: saved, linked: false, choose: () => undefined, reloadSaved: async () => undefined, rankTable: null, failed: false, retry: () => undefined });
const school = { independent: true, regionCode: "E12000008", regionName: "South East" };
const draw = (sets: SmtSetState, readOnly = false) => renderToStaticMarkup(createElement(SmtSetsPanel, { urn: "110110", schoolName: "Leighton Park School", school, phase: "ks5", sets, o: null, readOnly, theme: "dark" }));
const ticked = (html: string) => [...html.matchAll(/aria-checked="true"[^>]*data-smt-set-row="([^"]+)"/g)].map((m) => m[1]);

test("SMT sets panel: explains the set, lists every choice by group, ticks the one in use", () => {
  const html = draw(state({ kind: "saved", id: "s1" }, 7));
  assert.match(html, /benchmark Leighton Park School against a comparison set/);
  for (const g of ["VicData default", "School sets", "My sets"]) assert.match(html, new RegExp(g));
  const on = [...html.matchAll(/aria-checked="true"[^>]*data-smt-set-row="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(on, ["saved:s1"]);
  assert.match(html, /data-smt-set-build=""[^>]*href="\/sets\/guided|href="\/sets\/guided[^"]*"[^>]*data-smt-set-build/);
});

test("SMT sets panel: a large set is worded, not mapped; read-only hides the builder", () => {
  const html = draw(state({ kind: "nearest" }, 412), true);
  assert.match(html, /412 schools/);
  assert.match(html, /too many to map/);
  assert.doesNotMatch(html, /data-smt-set-build/);
  assert.deepEqual([...html.matchAll(/aria-checked="true"[^>]*data-smt-set-row="([^"]+)"/g)].map((m) => m[1]), ["nearest"]);
});

test("SMT sets panel: the 10 nearest ticks however it was chosen; the region and England rankings are defaults; anything else shows as In use now", () => {
  // The dashboard's chooser stores the 10 nearest as a list of schools.
  assert.deepEqual(ticked(draw(state({ kind: "urns", label: "10 nearest schools", urns: [] }, 10))), ["nearest"]);
  const html = draw(state({ kind: "ranking", label: "Independent schools in the South East", filters: {} as never, rankingId: null }, 212));
  assert.match(html, /Independent schools in England/);
  assert.match(html, /All sixth forms and colleges in the South East/);
  assert.deepEqual(ticked(html), ["default:region"]);
  const other = draw(state({ kind: "urns", label: "Schools in Wokingham", urns: [] }, 30));
  assert.match(other, /In use now/);
  assert.deepEqual(ticked(other), ["current"]);
  assert.match(draw(state({ kind: "nearest" }, 10)), /Make your own set/);
});

test("SMT sets panel: Schools in the LA (every sector) is a default, ticked when in use", async () => {
  const html = renderToStaticMarkup(createElement(SmtSetsPanel, { urn: "110110", schoolName: "Leighton Park School", school: { ...school, laName: "Reading" }, phase: "ks5", sets: state({ kind: "urns", label: "Schools in Reading", urns: [] }, 14), o: null, readOnly: false, theme: "dark" }));
  assert.match(html, /Schools in Reading/);
  assert.deepEqual(ticked(html), ["default:la"]);
  assert.doesNotMatch(html, /In use now/);
});

test("SMT sets panel: a ranking is its whole population -- the school's real place, Teacher's ranking table, no top-15 wording", () => {
  const ranking = Array.from({ length: 135 }, (_, i) => ({ urn: `${1000 + i}`, name: i === 37 ? "Leighton Park School" : `School ${i + 1}`, value: 50 - i * 0.1, rank: i + 1, isTarget: i === 37 }));
  const sets = { ...state({ kind: "ranking", label: "Independent schools in the South East", filters: {} as never, rankingId: null }, 134), rankTable: { ranking, targetRank: 38, ranked: 135, measure: "A level::aps_per_entry", period: 2025 } };
  const html = draw(sets);
  assert.match(html, /This set includes all 134 independent schools in the South East with published academic results \(A level, IB or Pre-U\)\. Leighton Park School ranks 38th of 135 by academic points per entry \(A level, IB, Pre-U\)/);
  assert.match(html, /compare it with the middle of them, not the top/);
  assert.doesNotMatch(html, /top 15/);
  assert.match(html, /data-smt-rank-table/);
  assert.match(html, /Leighton Park School: 38 of 135/);
  assert.match(html, /Top 10/);
  assert.match(html, /Bottom 3/);
  assert.equal((html.match(/data-rank-row="you"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Edit a copy|Edit this set/);
});

test("SMT sets panel: a large set's rolls -- growing, steady and shrinking on the map's rule, the middle school's change against ours", async () => {
  const { setRollSummary } = await import("@/components/front-door/smt-sets-panel");
  const t = (dir: "up" | "flat" | "down", pct: number) => ({ roll: 500, year: 2025, trend: { dir, word: dir, pct, from: 2022, to: 2025 } });
  const rolls = { "110110": t("up", 4), a: t("up", 6), b: t("flat", 0.2), c: t("down", -3), d: t("down", -8), e: { roll: null, year: null, trend: null } };
  const r = setRollSummary({ rolls } as never, "110110", Object.keys(rolls));
  assert.deepEqual(r.count, { up: 1, flat: 1, down: 2 });
  assert.equal(r.schools, 4);
  assert.equal(r.median, -1.4);
  assert.equal(r.mine?.pct, 4);
});

test("SMT sets panel: a state school isn't offered State schools in England (too many to benchmark); an independent school keeps its England set", () => {
  const birmingham = { independent: false, regionCode: "E12000005", regionName: "West Midlands" };
  for (const phase of ["ks4", "ks5"] as const) {
    assert.deepEqual(defaultRankings(birmingham, phase).map((d) => d.key), ["default:region", "default:region-all"]);
    assert.deepEqual(defaultRankings(school, phase).map((d) => d.key), ["default:region", "default:nation", "default:region-all"]);
  }
  const html = renderToStaticMarkup(createElement(SmtSetsPanel, { urn: "138695", schoolName: "George Dixon Academy", school: birmingham, phase: "ks4", sets: state({ kind: "nearest" }, 10), o: null, readOnly: false, theme: "dark" }));
  assert.match(html, /State schools in the West Midlands/);
  assert.doesNotMatch(html, /data-smt-set-row="default:nation"/);
  assert.match(html, /data-smt-set-note="nation"[^>]*>State schools in England isn’t a set here/);
  assert.match(html, /The Overview sets George Dixon Academy against England’s figures and ranks instead/);
  // The independent school's panel has no such note.
  assert.doesNotMatch(draw(state({ kind: "nearest" }, 10)), /data-smt-set-note/);
});
