// Run: npx tsx --test --test-force-exit src/lib/front-door/smt-sets-panel.test.tsx
// Leighton Park prep (20 Nov): the SMT home's comparison panel -- says what the set is for, lists the choices
// with the one in use ticked, words a large set (the map is for small ones), opens the builder unless read-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SmtSetsPanel } from "@/components/front-door/smt-sets-panel";
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

const state = (choice: SmtSetState["choice"], urns: number): SmtSetState => ({ choice, set: { kind: choice.kind, label: "Berkshire independents", urns: Array.from({ length: urns }, (_, i) => `${i}`) }, savedSets: saved, linked: false, choose: () => undefined, reloadSaved: async () => undefined });
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
  const html = draw(state({ kind: "ranking", label: "Independent schools in South East", filters: {} as never, rankingId: null }, 212));
  assert.match(html, /Independent schools in England/);
  assert.deepEqual(ticked(html), ["default:region"]);
  const other = draw(state({ kind: "urns", label: "Schools in Wokingham", urns: [] }, 30));
  assert.match(other, /In use now/);
  assert.deepEqual(ticked(other), ["current"]);
  assert.match(draw(state({ kind: "nearest" }, 10)), /Make your own set/);
});
