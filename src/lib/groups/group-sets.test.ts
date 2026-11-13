// VicData 0.8 group sets, M4: comparison sets of groups (R-GROUP-SET-PICKER, R-GROUP-SET-DEFAULT,
// R-GROUP-SET-SIDE-BY-SIDE, R-GROUP-SET-TRENDS, R-GROUP-RANK-SAME-TYPE), on the Harris and Dukes fixtures
// (each group's own figures, production's group_comparison_lookup) and small hand-made cases.
//   VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures npx tsx --test src/lib/groups/group-sets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOverview, displayName, englandWords, kindsFor, type GroupSetInput } from "./dash";
import { buildAcademic, buildPupils } from "./dash-r3";
import type { ComparisonRow, GroupAggregate, SchoolYearRow } from "./aggregates";
import type { GroupIndex } from "./library";
import {
  BAND_MIN_GROUPS, CAP_WORDS, GROUP_SET_CAP, groupDefaultOf, groupSaveMode, medianOf, namedList, nearestInSize, normaliseCompare, notPublished, pageDefault, pooledKind, quantile, setTrend, type GroupSetRow,
} from "./group-sets";
import { groupMembersPayload } from "../sets/group-store";
import { dashboardLabel, returnLabel, safeDashboardReturn, safeReturnTo } from "../sets/return-to";
import { GroupSetPicker } from "../../components/groups/dash/GroupSetPicker";
import { AgainstOthers, ResultsTrend, RollTrend } from "../../components/groups/dash/views";

const FX = path.join(__dirname, "../../../docs/v0.8/groups_fixtures");
const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(FX, f), "utf8")) as T;
const index = read<GroupIndex>("group_index_lookup.json");
const card = new Map(index.groups.map((c) => [c.group_id, c]));
const meta = (id: string) => ({ id, label: displayName(card.get(id)!.name), type: card.get(id)!.type, schools: card.get(id)!.schools });
const load = (tag: "harris" | "dukes") => ({
  agg: read<GroupAggregate>(`${tag}_group_aggregate_lookup_at_time.json`),
  comps: [...read<ComparisonRow[]>(`${tag}_group_comparison_lookup.json`), ...read<ComparisonRow[]>(`${tag}_group_comparison_lookup_named.json`)],
  schools: read<SchoolYearRow[]>(`${tag}_group_schools_year_lookup.json`),
});
const H = load("harris");
const D = load("dukes");
const usOf = (id: string) => card.get(id)!;
const setOf = (ids: string[], name = "Our set"): GroupSetInput => ({ key: "set:00000000-0000-4000-8000-000000000001", name, source: "set", setId: "00000000-0000-4000-8000-000000000001", scope: "group", groups: ids.map(meta) });
const compsFor = (c: ComparisonRow[], ids: string[]) => c.filter((r) => kindsFor(`peer_named:${ids.join(",")}` as never).includes(r.kind) || (r.kind === "peer_named" && ids.includes(r.variant)));

// ---------------------------------------------------------------------------- keys and defaults

test("R-GROUP-SET-PICKER: old ?compare= links map onto today's keys", () => {
  const ctx = { bandKey: "peer:mat:41+", sector: "state" as const };
  assert.equal(normaliseCompare("peer_band", ctx), "peer:mat:41+");
  assert.equal(normaliseCompare("non_group", ctx), "non_group:state");
  assert.equal(normaliseCompare("mix_matched", ctx), "non_group:state", "mix-matched opens on non-group (its row stays in Against others)");
  assert.equal(normaliseCompare("areas", ctx), "areas:la");
  assert.equal(normaliseCompare("england", ctx), "england:all");
  assert.equal(normaliseCompare("peer_named:2157,5143", ctx), "peer_named:2157,5143", "an unsaved set of those groups");
  assert.equal(normaliseCompare("peer_named:2157,2157,<x>,5143", ctx), "peer_named:2157,5143", "distinct, well-formed ids only");
  assert.equal(normaliseCompare(`peer_named:${Array.from({ length: 12 }, (_, i) => i + 1).join(",")}`, ctx)!.split(",").length, GROUP_SET_CAP);
  assert.equal(normaliseCompare("peer:mat:6-10", ctx), "peer:mat:41+", "only our own band is offered");
  assert.equal(normaliseCompare("sat:all", { bandKey: null, sector: "independent" }), "non_group:independent", "no SAT pool for an independent group");
  assert.equal(normaliseCompare("non_group:state", { bandKey: null, sector: "independent" }), "non_group:independent", "non-group is our sector's");
  assert.equal(normaliseCompare("set:not-a-uuid", ctx), null);
  assert.equal(normaliseCompare("javascript:alert(1)", ctx), null);
  assert.equal(normaliseCompare(null, ctx), null, "absent: the page's default");
  assert.equal(pooledKind("peer:foundation_trust:all"), "peer_band");
  assert.equal(pooledKind("sat:all"), "sat");
  assert.equal(pooledKind("nearest"), null);
});

test("R-GROUP-SET-DEFAULT (D8): the size band until an admin makes a group set the default; a deleted default falls back", () => {
  const set = (o: Partial<GroupSetRow>): GroupSetRow => ({ id: "00000000-0000-4000-8000-00000000000a", name: "x", description: null, kind: "group_peers", scope: "group", isDefault: false, pinned: false, archived: false, ownerProfileId: null, members: [], updatedAt: "", ...o });
  assert.equal(pageDefault(null, "peer:mat:41+", "state"), "peer:mat:41+");
  assert.equal(pageDefault(null, "peer:foundation_trust:all", "state"), "peer:foundation_trust:all", "all foundation trusts for them (D4)");
  const d = set({ isDefault: true });
  assert.equal(groupDefaultOf([set({}), d], "group_peers")?.id, d.id);
  assert.equal(pageDefault(groupDefaultOf([d], "group_peers"), "peer:mat:41+", "state"), `set:${d.id}`);
  assert.equal(groupDefaultOf([set({ isDefault: true, archived: true })], "group_peers"), null, "an archived default is no default");
  assert.equal(groupDefaultOf([set({ isDefault: true, scope: "personal" })], "group_peers"), null, "only a group set is the group's default");
  assert.equal(pageDefault(groupDefaultOf([], "group_peers"), "peer:mat:41+", "state"), "peer:mat:41+", "deleted: back to the band");
});

test("the Default block: Harris (state) and Dukes (independent), counts and England by sector", () => {
  const nearest = nearestInSize(index.groups, usOf("3320")).map((c) => ({ id: c.group_id }));
  const o = buildOverview({ agg: H.agg, comps: H.comps.filter((r) => r.kind !== "peer_named"), compare: "peer_band", focus: "all", addressKey: "peer:mat:41+", nearest });
  assert.deepEqual(o.picker.defaults.map((x) => x.key), ["peer:mat:41+", "non_group:state", "sat:all", "areas:la", "england:all", "nearest"]);
  assert.equal(o.picker.defaults[0].name, "MATs with 41+ schools");
  assert.equal(o.picker.defaults[0].countText, "16 groups");
  assert.equal(o.picker.defaults[4].name, englandWords("state").label);
  assert.equal(o.picker.name, "MATs with 41+ schools");
  assert.equal(o.picker.countText, "16 groups");
  assert.equal(o.picker.defaults[5].countText, "5 groups");
  const dn = nearestInSize(index.groups, usOf("club_iss:dukes-education")).map((c) => ({ id: c.group_id }));
  const od = buildOverview({ agg: D.agg, comps: D.comps.filter((r) => r.kind !== "peer_named"), compare: "peer_band", focus: "all", nearest: dn });
  assert.deepEqual(od.picker.defaults.map((x) => x.key), ["peer:independent_company:21-40", "non_group:independent", "areas:la", "england:all", "nearest"], "no SAT pool for an independent group");
  assert.equal(od.picker.defaults.find((x) => x.key === "england:all")!.name, "England, independent mainstream", "E1, E2");
});

test("nearest in size, same type: Harris's five, and the named-candidates sort fixed (never smallest first)", () => {
  const n = nearestInSize(index.groups, usOf("3320")).map((c) => c.group_id);
  assert.deepEqual(n, ["4076", "2053", "4474", "4127", "4320"]);
  for (const id of n) assert.equal(card.get(id)!.type, "mat");
  assert.ok(!n.includes("3320"));
  const twelve = nearestInSize(index.groups, usOf("3320"), 12);
  const d = twelve.map((c) => Math.abs(c.schools - 59));
  assert.deepEqual(d, [...d].sort((a, b) => a - b), "nearest first");
  assert.ok(twelve.every((c) => c.schools >= 40), "not the smallest MATs (the old Academic/Pupils bug sorted from 0)");
  // The index holds out non-mainstream groups (LF3, N2), so neither picker nor Nearest can offer one.
  assert.equal(index.groups.length, 1642);
});

// ------------------------------------------------------------------------------ side by side

test("R-GROUP-SET-SIDE-BY-SIDE: ours first, each group, then the median of the groups' own figures", () => {
  const ids = ["4076", "2053", "4474", "4127", "4320"];
  const o = buildOverview({ agg: H.agg, comps: compsFor(H.comps, ids), compare: `peer_named:${ids.join(",")}` as never, focus: "all", groupSet: setOf(ids) });
  const t = o.sideBySide!;
  assert.ok(t, "a set of groups is shown side by side");
  assert.equal(t.rows[0].ours, true);
  assert.equal(t.rows[0].label, "Harris Federation");
  assert.deepEqual(t.rows.slice(1).map((r) => r.key), ids.map((id) => `peer_named:${id}`));
  assert.equal(t.rows[0].typeSize, "MAT · 59 schools", "type and size on every row");
  assert.equal(t.rows[1].typeSize, "MAT · 57 schools");
  // The median: one vote per group with a figure, never ours, never re-weighted.
  for (const m of t.columns) {
    const vals = t.rows.slice(1).map((r) => r.cells[m]?.value ?? null);
    assert.equal(t.median.cells[m].value, medianOf(vals), m);
    assert.equal(t.median.cells[m].n, vals.filter((v) => v !== null).length);
    assert.equal(t.median.cells[m].of, 5);
  }
  assert.equal(t.median.mixed, false);
  assert.match(t.median.label, /5 of 5 groups/);
  // Each group's own figure is production's, as it comes (A8 for Oasis in its latest year).
  const oasis = H.comps.find((r) => r.kind === "peer_named" && r.variant === "4076" && r.reading === "at_time" && r.phase === "secondary" && r.period === o.years.results.ks4_a8)!;
  assert.equal(t.rows[1].cells.ks4_a8.value, oasis.figures.results.ks4_a8.weighted);
  assert.equal(t.england?.label, "England, mainstream state-funded");
  assert.equal(o.picker.name, "Our set");
  assert.equal(o.picker.countText, "5 groups");
});

test("R-GROUP-RANK-SAME-TYPE and mixed types: each row ranks within its own type; the median says 'mixed types'", () => {
  const ids = ["2157", "1337"]; // Ark (MAT) and North Tyneside (foundation trust)
  const o = buildOverview({ agg: H.agg, comps: compsFor(H.comps, ids), compare: "peer_named:2157,1337", focus: "all", groupSet: setOf(ids) });
  const t = o.sideBySide!;
  assert.equal(t.median.mixed, true);
  assert.match(t.rows[0].rank ?? "", /^\d+(st|nd|rd|th) of \d+ MATs with 41\+ schools$/);
  assert.match(t.rows[1].rank ?? "", /MATs with 41\+ schools$/);
  assert.match(t.rows[2].rank ?? "", /of \d+ foundation trusts$/, "a foundation trust ranks among all foundation trusts (D4)");
  assert.equal(t.rows[2].typeSize, "Foundation trust · 30 schools");
});

test("'not published': a measure a type never publishes keeps its row (Dukes against independents)", () => {
  assert.equal(notPublished("independent_company", "ks4_p8"), true);
  assert.equal(notPublished("mat", "ks4_p8"), false);
  const ids = ["ch:01550681", "club_iss:girls-day-school-trust"];
  const o = buildOverview({ agg: D.agg, comps: compsFor(D.comps, ids), compare: `peer_named:${ids.join(",")}` as never, focus: "secondary", groupSet: setOf(ids) });
  const t = o.sideBySide!;
  assert.ok(t.columns.includes("ks4_p8"));
  for (const r of t.rows) {
    assert.ok(r.notPublished.includes("ks4_p8"), `${r.label}: Progress 8 not published`);
    assert.equal(r.cells.ks4_p8?.value ?? null, null);
  }
  assert.equal(t.median.mixed, true, "a company and a charity");
  const html = renderToStaticMarkup(createElement(AgainstOthers, { o, average: false }));
  assert.match(html, /not published/);
  assert.match(html, /mixed types/);
  assert.equal(t.england?.label, "England, independent mainstream");
});

test("the Weighting switch applies to every row, and the median follows it", () => {
  const ids = ["4076", "2053", "4474", "4127"];
  const o = buildOverview({ agg: H.agg, comps: compsFor(H.comps, ids), compare: `peer_named:${ids.join(",")}` as never, focus: "secondary", groupSet: setOf(ids) });
  const t = o.sideBySide!;
  assert.equal(t.median.cells.ks4_a8.average, medianOf(t.rows.slice(1).map((r) => r.cells.ks4_a8.average)));
  const pupil = renderToStaticMarkup(createElement(AgainstOthers, { o, average: false }));
  const avg = renderToStaticMarkup(createElement(AgainstOthers, { o, average: true }));
  assert.notEqual(pupil, avg);
  assert.match(avg, /average school/);
});

test("Academic and Pupils: our group against the median and England, the set side by side", () => {
  const ids = ["4076", "2053", "4474", "4127", "4320"];
  const input = { agg: H.agg, comps: compsFor(H.comps, ids), schools: H.schools, compare: `peer_named:${ids.join(",")}` as never, focus: "all" as const, groupSet: setOf(ids) };
  const a = buildAcademic(input);
  const sec = a.headlines.find((h) => h.phase === "secondary")!;
  assert.equal(sec.groups?.length, 5);
  assert.equal(sec.measures[0].median?.value, medianOf(sec.groups!.map((g) => g.value)));
  assert.equal(sec.measures[0].median?.of, 5);
  assert.equal(a.ranked.set?.label, "Set median");
  const p = buildPupils(input);
  assert.ok(p.overview.sideBySide);
  assert.equal(p.overview.sideBySide!.rows[0].pupils, H.agg.rows.find((r) => r.phase === "all" && r.period === p.overview.years.census)!.figures.roll);
});

// ------------------------------------------------------------------------------------ trends

test("R-GROUP-SET-TRENDS (D3): median and middle half; no band under 4 groups, and the (i) says why", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2);
  const line = (vs: (number | null)[]) => ({ pts: vs.map((value, i) => ({ year: 2020 + i, value })) });
  const three = setTrend([line([1, 2]), line([3, 4]), line([5, 6])]);
  assert.equal(three.band, null);
  assert.match(three.bandNote, new RegExp(`at least ${BAND_MIN_GROUPS} groups, and this set has 3`));
  assert.deepEqual(three.median.map((p) => p.value), [3, 4]);
  const four = setTrend([line([1, 2]), line([3, 4]), line([5, 6]), line([7, null])]);
  assert.ok(four.band);
  assert.deepEqual(four.band![0], { x: 2020, lo: 2.5, hi: 5.5 });
  assert.deepEqual(four.band![1], { x: 2021, lo: null, hi: null }, "a year with fewer than 4 figures has no band");
  assert.match(four.bandNote, /middle half of the 4 groups in this set/);
  // Drawn: the panel has ours, the median and the band; full screen lists every group to bring forward.
  const ids = ["4076", "2053", "4474", "4127", "4320"];
  const o = buildOverview({ agg: H.agg, comps: compsFor(H.comps, ids), compare: `peer_named:${ids.join(",")}` as never, focus: "all", groupSet: setOf(ids) });
  const panel = renderToStaticMarkup(createElement(RollTrend, { o, fullscreen: false }));
  assert.match(panel, /Median of 5 groups/);
  assert.match(panel, /Middle half/);
  assert.doesNotMatch(panel, /data-set-trend-item/, "no hover or pinning on the panel");
  const large = renderToStaticMarkup(createElement(ResultsTrend, { o, average: false, fullscreen: true, room: 500 }));
  for (const id of ids) assert.match(large, new RegExp(`data-set-trend-item="peer_named:${id}"`));
  assert.match(large, /Median and band: on/);
  const two = buildOverview({ agg: H.agg, comps: compsFor(H.comps, ["4076", "2053"]), compare: "peer_named:4076,2053", focus: "all", groupSet: setOf(["4076", "2053"]) });
  assert.match(renderToStaticMarkup(createElement(RollTrend, { o: two, fullscreen: false })), /No band under 4 groups/);
});

// ------------------------------------------------------------------------------------ picker

test("R-GROUP-SET-PICKER: three blocks; Group sets by Head office; a school's SMT gets Default and the group's sets, read-only", () => {
  const nearest = nearestInSize(index.groups, usOf("3320")).map((c) => ({ id: c.group_id }));
  const o = buildOverview({ agg: H.agg, comps: H.comps.filter((r) => r.kind !== "peer_named"), compare: "peer_band", focus: "all", nearest });
  const gs: GroupSetRow = { id: "00000000-0000-4000-8000-0000000000b1", name: "London trusts", description: null, kind: "group_peers", scope: "group", isDefault: false, pinned: false, archived: false, ownerProfileId: null, members: ["2157", "5143"], updatedAt: "2026-11-13T00:00:00Z" };
  const mine: GroupSetRow = { ...gs, id: "00000000-0000-4000-8000-0000000000b2", name: "Mine", scope: "personal", ownerProfileId: "u" };
  const info = (canKeep: boolean, admin: boolean) => ({ sets: canKeep ? [gs, mine] : [gs], notSetUp: false, personalActive: 1, cap: 8, admin, canKeep, defaults: { group_peers: null, group_schools: null } });
  const ho = renderToStaticMarkup(createElement(GroupSetPicker, { picker: o.picker, sets: info(true, true), account: "acc", phone: false, onPick: () => undefined, onChanged: () => undefined, defaultOpen: true }));
  assert.match(ho, /Compared against/);
  assert.match(ho, /MATs with 41\+ schools/);
  assert.match(ho, /16 groups/);
  assert.match(ho, /Group sets/);
  assert.match(ho, /data-set-creator="group"[^>]*>Head office/);
  assert.match(ho, /My sets/);
  assert.match(ho, /1 of 8/);
  assert.match(ho, /New set…/);
  assert.match(ho, /Manage sets/);
  const school = renderToStaticMarkup(createElement(GroupSetPicker, { picker: o.picker, sets: info(false, false), account: "acc", phone: false, onPick: () => undefined, onChanged: () => undefined, defaultOpen: true }));
  assert.match(school, /London trusts/, "the group's sets");
  assert.doesNotMatch(school, /My sets/, "no My sets (D2)");
  assert.doesNotMatch(school, /New set…|Edit this set…|Manage sets|Make default/, "read-only");
});

test("the cap: 8 groups, one setting", () => {
  assert.equal(GROUP_SET_CAP, 8);
  assert.equal(CAP_WORDS, "8 is the most a set holds");
  assert.equal(namedList("a,b,c,d,e,f,g,h,i,j").length, 8);
  assert.equal(groupMembersPayload("group_peers", ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).length, 8);
  assert.deepEqual(groupMembersPayload("group_peers", ["2157", "2157", "x y"]), [{ group_id: "2157" }]);
  assert.deepEqual(groupMembersPayload("group_schools", ["137625", "abc"]), [{ urn: "137625" }]);
});

test("the editor's save modes: your own set, a group set for admins; anything else is a copy", () => {
  assert.equal(groupSaveMode(null, { userId: "u", admin: false, copy: false }), "new");
  assert.equal(groupSaveMode(null, { userId: "u", admin: false, copy: true }), "copy");
  assert.equal(groupSaveMode({ scope: "personal", ownerProfileId: "u" }, { userId: "u", admin: false, copy: false }), "save");
  assert.equal(groupSaveMode({ scope: "personal", ownerProfileId: "v" }, { userId: "u", admin: true, copy: false }), "copy");
  assert.equal(groupSaveMode({ scope: "group", ownerProfileId: null }, { userId: "u", admin: true, copy: false }), "save");
  assert.equal(groupSaveMode({ scope: "group", ownerProfileId: null }, { userId: "u", admin: false, copy: false }), "copy", "a member duplicates instead");
});

test("R-SETS-WAY-BACK: the Group pages are a way back from the editor and Manage sets", () => {
  const back = "/teacher/group/overview?account=a1&compare=nearest";
  assert.equal(safeReturnTo(back), back);
  assert.equal(safeDashboardReturn(back), back);
  assert.equal(safeReturnTo("/teacher/groupX"), null);
  assert.equal(returnLabel(back, { kind: "group_peers", entry: "", phase: null, product: "group", urn: "", schoolName: "Harris Federation" }), "Back to Harris Federation · Overview");
  assert.equal(returnLabel("/teacher/group/groups?account=a1", { kind: "group_peers", entry: "", phase: null, product: "group", urn: "", schoolName: "Harris Federation" }), "Back to Harris Federation · Groups library");
  assert.equal(dashboardLabel("/teacher/group/academic?account=a1"), "Back to Academic");
});

test("the dash route's resolution: the default set opens the page; a set that has gone falls back to the band", async () => {
  const { resolveCompare } = await import("./group-sets");
  const s: GroupSetRow = { id: "00000000-0000-4000-8000-0000000000c1", name: "London trusts", description: null, kind: "group_peers", scope: "group", isDefault: true, pinned: false, archived: false, ownerProfileId: null, members: ["2157", "3320", "5143"], updatedAt: "" };
  const ctx = { bandKey: "peer:mat:41+", sector: "state" as const, ourId: "3320", sets: [s], defaultId: s.id, nearest: ["4076", "2053"].map(meta), meta };
  const r = resolveCompare(null, ctx);
  assert.equal(r.key, `set:${s.id}`, "D8: the group's default");
  assert.deepEqual(r.groupSet?.groups.map((g) => g.id), ["2157", "5143"], "our own group never sits in its own set");
  assert.equal(r.compare, "peer_named:2157,5143");
  assert.equal(resolveCompare(null, { ...ctx, sets: [], defaultId: null }).key, "peer:mat:41+", "no default: the band");
  assert.equal(resolveCompare(`set:${s.id}`, { ...ctx, sets: [] }).key, "peer:mat:41+", "deleted: the band");
  assert.equal(resolveCompare(`set:${s.id}`, { ...ctx, sets: [{ ...s, archived: true }] }).key, "peer:mat:41+", "archived: the band");
  assert.equal(resolveCompare("peer_band", ctx).compare, "peer_band", "an old link still opens the band");
  assert.equal(resolveCompare("nearest", ctx).groupSet?.source, "nearest");
  assert.equal(resolveCompare("nearest", { ...ctx, nearest: [] }).key, "peer:mat:41+");
  assert.equal(resolveCompare("peer_named:3320", ctx).key, "peer:mat:41+", "a set of only ourselves is no set");
  assert.equal(resolveCompare("peer_named:2157,5143", ctx).groupSet?.name, "Unsaved set");
  assert.equal(resolveCompare("sat:all", ctx).compare, "sat");
});
