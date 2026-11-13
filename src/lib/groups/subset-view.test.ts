// VicData 0.8 group sets, M5: subsets of our own schools (R-GROUP-SUBSET-FILTER), on the Harris fixtures.
//   VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures npx tsx --test src/lib/groups/subset-view.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOverview, buildSchools } from "./dash";
import { buildAcademic, buildPupils } from "./dash-r3";
import type { ComparisonRow, GroupAggregate, SchoolYearRow } from "./aggregates";
import { filterDash, subsetOf } from "./subset-view";
import { normaliseShowing, showingWords, type GroupSetRow } from "./group-sets";
import { GroupShowingPicker } from "../../components/groups/dash/GroupSetPicker";

const FX = path.join(__dirname, "../../../docs/v0.8/groups_fixtures");
const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(FX, f), "utf8")) as T;
const agg = read<GroupAggregate>("harris_group_aggregate_lookup_at_time.json");
const comps = read<ComparisonRow[]>("harris_group_comparison_lookup.json");
const schools = read<SchoolYearRow[]>("harris_group_schools_year_lookup.json");
const current = schools.filter((s) => s.role === "member" && s.years.some((y) => y.listed_now)).map((s) => s.urn);
const secondaries = schools.filter((s) => s.role === "member" && s.years.at(-1)?.figures?.phases.includes("secondary")).map((s) => s.urn).slice(0, 18);
const LEFT = "100999"; // not (or no longer) a Harris school
const sub: GroupSetRow = { id: "00000000-0000-4000-8000-0000000000e1", name: "South London secondaries", description: null, kind: "group_schools", scope: "group", isDefault: false, pinned: false, archived: false, ownerProfileId: null, members: [...secondaries, LEFT], updatedAt: "" };

test("R-GROUP-SUBSET-FILTER: the line, and a school that has left drops out", () => {
  const a = subsetOf(sub, current, 59)!;
  assert.equal(a.n, 18);
  assert.deepEqual(a.left, [LEFT]);
  assert.equal(a.line, "Showing 18 of 59 schools · group figures are for all 59");
  assert.equal(showingWords(1, 1), "Showing 1 of 1 school · group figures are for all 1");
  assert.match(a.leftLine!, /1 school has left the group since this set was made: it drops out of the filter/);
  assert.equal(subsetOf(null, current, 59), null, "All schools: no filter");
  assert.equal(normaliseShowing("set:00000000-0000-4000-8000-0000000000e1"), "set:00000000-0000-4000-8000-0000000000e1");
  assert.equal(normaliseShowing("all"), null);
  assert.equal(normaliseShowing("set:nope"), null);
});

test("R-GROUP-SUBSET-FILTER: every list of schools is filtered; the group's figures stay whole-group", () => {
  const keep = subsetOf(sub, current, 59)!.kept;
  const now = buildOverview({ agg, comps: [], compare: "peer_band", focus: "all" });
  const membership = current.map((urn) => ({ urn, name: urn, confidence: "confirmed", joined: null, lastSeen: null, source: "gias_groups" }));
  const map = current.map((urn) => ({ urn, name: urn }));
  const sch = { membership, map, now, schools: buildSchools({ agg, schools, focus: "all" }) };
  const f = filterDash(sch, keep);
  assert.equal(f.schools!.rows.length, 18, "the Schools table");
  assert.ok(f.schools!.rows.every((r) => keep.has(r.urn)));
  assert.equal(f.schools!.counts.shown, 18);
  assert.equal(f.map!.length, 18, "the map");
  assert.equal(f.membership.length, 18, "Joined and left");
  assert.deepEqual(f.now, sch.now, "group-level figures untouched");
  const input = { agg, comps, schools, compare: "peer_band" as const, focus: "all" as const };
  const a = buildAcademic(input);
  const fa = filterDash({ membership, map, academic: a, overview: a.overview }, keep);
  assert.ok(fa.academic!.ranked.rows.length <= 18 && fa.academic!.ranked.rows.every((r) => keep.has(r.urn)), "Schools ranked");
  assert.ok(fa.academic!.va.p8.rows.every((r) => keep.has(r.urn)), "value added");
  assert.deepEqual(fa.academic!.headlines.map((h) => h.measures), a.headlines.map((h) => h.measures), "the group's results: whole-group");
  assert.equal(fa.academic!.ranked.groupMedian, a.ranked.groupMedian, "the group median stays the group's");
  const p = buildPupils(input);
  const fp = filterDash({ membership, map, pupils: p, overview: p.overview }, keep);
  assert.ok(fp.pupils!.entries.every((r) => keep.has(r.urn)) && fp.pupils!.market.rows.every((r) => keep.has(r.urn)) && fp.pupils!.leaving.every((r) => keep.has(r.urn)), "per-school lists");
  assert.deepEqual(fp.pupils!.stayingOn, p.stayingOn, "group totals stay whole");
  assert.deepEqual(fp.overview, p.overview);
});

test("the Showing selector: All 59 schools, the group's subsets, My subsets; read-only for a school's SMT", () => {
  const mine: GroupSetRow = { ...sub, id: "00000000-0000-4000-8000-0000000000e2", name: "My primaries", scope: "personal", ownerProfileId: "u", members: ["131747"] };
  const info = (canKeep: boolean) => ({ sets: canKeep ? [sub, mine] : [sub], notSetUp: false, personalActive: 1, cap: 8, admin: false, canKeep, defaults: { group_peers: null, group_schools: null } });
  const ho = renderToStaticMarkup(createElement(GroupShowingPicker, { showing: null, total: 59, sets: info(true), account: "acc", phone: false, onPick: () => undefined, defaultOpen: true }));
  assert.match(ho, /Showing/);
  assert.match(ho, /All 59 schools/);
  assert.match(ho, /Group subsets/);
  assert.match(ho, /South London secondaries/);
  assert.match(ho, /My primaries/);
  assert.match(ho, /New subset…/);
  const school = renderToStaticMarkup(createElement(GroupShowingPicker, { showing: sub, total: 59, sets: info(false), account: "acc", phone: false, onPick: () => undefined, defaultOpen: true }));
  assert.match(school, /South London secondaries/);
  assert.doesNotMatch(school, /My sets|New subset…|Manage sets|Edit this subset/);
});
