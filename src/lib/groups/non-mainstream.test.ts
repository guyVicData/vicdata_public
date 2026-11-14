// VicData 0.8 non-mainstream groups: the library's section (NM10), the line (R-NM-LINE), the set rule
// (R-NM-SETS), the dashboard (R-NM-NO-RESULTS, R-NM-FSM-NURSERY, R-NM-POOLS, R-NM-COUNTING) and the
// Schools table's placing (R-NM-OWN-SCHOOLS), over the production fixtures (build 7: Harris, Dukes, Nexus,
// the Birmingham nursery federation and Shaw). Run with the fixture switch:
//   VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures \
//     npx tsx --env-file=.env.local --test --test-force-exit src/lib/groups/non-mainstream.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupAggregate, groupComparisons, groupLibraryIndex, groupSchoolsYear, NM_COMPARISON_KINDS } from "./aggregates";
import { buildOverview, buildSchools, kindsFor } from "./dash";
import { DEFAULT_FILTER, filterFromQuery, filterToQuery, libraryCards } from "./library";
import { cardFsmWords, familyOf, placeSchool, schoolsByKindWords, setRefusal } from "./non-mainstream";
import { resolveCompare } from "./group-sets";
import { libraryGroupPage } from "./library-page";

const NM_KINDS = ["special", "ap", "pru", "nursery"] as const;
const nmShare = (by: Record<string, number> = {}) => {
  const all = Object.values(by).reduce((a, b) => a + b, 0);
  const nm = NM_KINDS.reduce((a, k) => a + (by[k] ?? 0), 0);
  return { all, nm };
};

test("R-NM-LINE: a card is non-mainstream exactly when more than half its current schools are special, AP, PRU or nursery; its family is its majority kind", async () => {
  const index = await groupLibraryIndex();
  const nm = index.non_mainstream ?? [];
  assert.equal(nm.length, 140);
  assert.equal(index.groups.length, 1642);
  for (const c of nm) {
    const { all, nm: n } = nmShare(c.schools_by_kind as Record<string, number>);
    assert.ok(2 * n > all, `${c.name}: ${n} of ${all}`);
    const by = c.schools_by_kind as Record<string, number>;
    const nursery = by.nursery ?? 0;
    const sap = (by.special ?? 0) + (by.ap ?? 0) + (by.pru ?? 0);
    assert.equal(c.kind, nursery > sap ? "nursery" : "special_ap", c.name);
  }
  for (const c of index.groups) {
    const { all, nm: n } = nmShare(c.schools_by_kind as Record<string, number>);
    assert.ok(2 * n <= all, `${c.name} is mainstream on ${n} of ${all}`);
    assert.equal(familyOf(c.kind), "mainstream");
  }
  // The one tie (The Orchards: 1 nursery, 1 special, 1 mainstream) is a special and AP trust.
  assert.equal(nm.find((c) => c.group_id === "1768")?.kind, "special_ap");
  assert.equal(nm.filter((c) => c.schools === 2).length, 57);
});

test("library: the Special, AP and nursery section lists only non-mainstream cards, filters by family and its own bands, and keeps its state in the address", async () => {
  const index = await groupLibraryIndex();
  const nm = index.non_mainstream ?? [];
  const us = index.groups.find((c) => c.group_id === "3320")!;
  const f = { ...DEFAULT_FILTER, section: "nm" as const, likeUs: false, sort: "size" as const };
  const cards = libraryCards(nm, us, f);
  assert.equal(cards.length, 140);
  assert.ok(cards.every((c) => familyOf(c.kind) !== "mainstream"));
  assert.equal(libraryCards(nm, us, { ...f, families: ["nursery"] }).length, 34);
  assert.equal(libraryCards(nm, us, { ...f, families: ["special_ap"], bands: ["11+"] }).length, 11);
  // A mainstream group's "like us" never filters the other section; a special trust's is its family.
  assert.equal(libraryCards(nm, us, { ...f, likeUs: true }).length, 140);
  const nexus = nm.find((c) => c.group_id === "16125")!;
  assert.equal(libraryCards(nm, nexus, { ...f, likeUs: true }).length, 105);
  const q = filterToQuery({ ...f, families: ["special_ap"], bands: ["6–10"] });
  assert.equal(q.get("section"), "nm");
  const back = filterFromQuery(q);
  assert.deepEqual([back.section, back.families, back.bands], ["nm", ["special_ap"], ["6–10"]]);
  // The mainstream section's address is unchanged (no new keys).
  assert.equal(filterToQuery(DEFAULT_FILTER).toString(), "");
  // Its cards: schools by kind, FSM against its kind's England (a nursery federation: nursery only).
  assert.equal(schoolsByKindWords(nexus.schools_by_kind), "21 special · 1 AP · 1 mainstream");
  assert.equal(cardFsmWords(nexus), "FSM 53.4% · state-funded special schools, England 50.9%");
  const bham = nm.find((c) => c.group_id === "17126")!;
  assert.equal(cardFsmWords(bham), "FSM 31.5% · state-funded nursery schools, England 10.1%");
  assert.deepEqual(Object.keys(bham.fsm!.england as object), ["nursery"]);
});

test("library page: a non-mainstream group shows no result, its schools by kind and FSM, and reads its schools the other way round", async () => {
  const index = await groupLibraryIndex();
  const card = (index.non_mainstream ?? []).find((c) => c.group_id === "16125")!;
  const p = libraryGroupPage(card, await groupAggregate("16125", "at_time"), await groupSchoolsYear("16125"), null);
  assert.equal(p.rank, null);
  assert.equal(p.nm?.noResults, "Results aren't compared for special and AP schools");
  assert.ok(p.schools.every((s) => s.headline === null));
  assert.equal(p.schools.find((s) => s.name === "Crags Community School")?.note, "Mainstream · in the mainstream line");
  assert.ok(p.schools.filter((s) => s.name !== "Crags Community School").every((s) => !/not in group figures/.test(s.note ?? "")));
});

test("R-NM-SETS: a non-mainstream group never shares a set with a mainstream group, by any route", async () => {
  assert.equal(setRefusal("mainstream", "special_ap", "Nexus"), "Nexus is a special and AP trust: mainstream groups are compared only with mainstream groups.");
  assert.equal(setRefusal("special_ap", "mainstream", "Ark"), "Ark is a mainstream group: special and AP trusts are compared only with special and AP trusts.");
  assert.ok(setRefusal("nursery", "special_ap"));
  assert.equal(setRefusal("special_ap", "special_ap"), null);
  assert.equal(setRefusal(undefined, "mainstream"), null);
  // The picker's route: a stored or unsaved set drops another family's groups, and says how many.
  const index = await groupLibraryIndex();
  const all = [...index.groups, ...(index.non_mainstream ?? [])];
  const card = new Map(all.map((c) => [c.group_id, c]));
  const meta = (id: string) => ({ id, label: id, type: card.get(id)?.type ?? "unknown", schools: card.get(id)?.schools ?? 0 });
  const allowed = (id: string) => familyOf(card.get(id)?.kind) === "special_ap";
  const sets = [{ id: "b8888888-8888-4888-8888-888888888888", name: "Old", description: null, kind: "group_peers" as const, scope: "personal" as const, isDefault: false, pinned: false, archived: false, ownerProfileId: null, members: ["5252", "17050", "2157"], updatedAt: "" }];
  const r = resolveCompare("set:b8888888-8888-4888-8888-888888888888", { bandKey: "peer:special_ap:11+", sector: "state", ourId: "16125", sets, defaultId: null, nearest: [], meta, nm: true, allowed });
  assert.deepEqual(r.groupSet?.groups.map((g) => g.id), ["5252", "17050"]);
  assert.equal(r.groupSet?.refused, 1);
  const u = resolveCompare("peer_named:5252,2157", { bandKey: "peer:special_ap:11+", sector: "state", ourId: "16125", sets: [], defaultId: null, nearest: [], meta, nm: true, allowed });
  assert.deepEqual(u.groupSet?.groups.map((g) => g.id), ["5252"]);
  // The editor's Add groups offers only our family; Nearest in size is our family's, of any type.
  const { sameFamily } = await import("./non-mainstream");
  const { nearestInSize } = await import("./group-sets");
  const nexusCard = card.get("16125")!;
  assert.ok(sameFamily("special_ap", all).every((c) => c.kind === "special_ap"));
  assert.equal(sameFamily("special_ap", all).length, 106);
  assert.equal(sameFamily("mainstream", all).length, 1642);
  assert.equal(sameFamily(undefined, all).length, 1642);
  const near = nearestInSize(all, nexusCard, 5, (c) => familyOf(c.kind) === "special_ap");
  assert.equal(near.length, 5);
  assert.ok(near.every((c) => c.kind === "special_ap" && c.group_id !== "16125"));
  // A mainstream group's own set drops a special trust too, by the same rule.
  const h = resolveCompare("peer_named:2157,16125", { bandKey: "peer:mat:41+", sector: "state", ourId: "3320", sets: [], defaultId: null, nearest: [], meta, allowed: (id) => familyOf(card.get(id)?.kind) === "mainstream" });
  assert.deepEqual(h.groupSet?.groups.map((g) => g.id), ["2157"]);
  assert.equal(h.groupSet?.refused, 1);
  // A mainstream group never takes a pool key; a non-mainstream group's mainstream keys open on its peer set.
  assert.equal(resolveCompare("pools:england:special", { bandKey: "peer:mat:41+", sector: "state", ourId: "3320", sets: [], defaultId: null, nearest: [], meta }).key, "peer:mat:41+");
  assert.equal(resolveCompare("non_group:state", { bandKey: "peer:special_ap:11+", sector: "state", ourId: "16125", sets: [], defaultId: null, nearest: [], meta, nm: true }).key, "peer:special_ap:11+");
  assert.equal(resolveCompare("pools:england:special", { bandKey: "peer:special_ap:11+", sector: "state", ourId: "16125", sets: [], defaultId: null, nearest: [], meta, nm: true }).compare, "pools:england:special");
});

test("R-NM-NO-RESULTS and R-NM-COUNTING: a non-mainstream group's page has no result anywhere; its figures are over its special, AP and nursery schools, its mainstream schools in their own line", async () => {
  for (const id of ["16125", "17126"]) {
    const agg = (await groupAggregate(id, "at_time"))!;
    const comps = await groupComparisons(id, [...NM_COMPARISON_KINDS]);
    const o = buildOverview({ agg, comps, compare: "peer_band", focus: "secondary" });
    assert.equal(o.focus, "all");
    assert.deepEqual(o.against.columns, []);
    assert.equal(o.trends.results.length, 0);
    assert.equal(o.against.place, null);
    assert.equal(o.against.counts, "");
    assert.deepEqual(o.peerPlaces, {});
    assert.ok(Object.values(o.years.results).every((v) => v === null));
    assert.ok(o.nm);
    assert.match(o.nm!.noResults.title, /Results aren't compared/);
  }
  const agg = (await groupAggregate("16125", "at_time"))!;
  const o = buildOverview({ agg, comps: await groupComparisons("16125", [...NM_COMPARISON_KINDS]), compare: "peer_band", focus: "all" });
  assert.equal(o.now.schools, 18);
  assert.equal(o.now.roll, 2808);
  assert.equal(o.nm!.fsm.pct, 53.39);
  assert.deepEqual(o.now.notCounted, { n: 1, total: 19, words: "1 mainstream school in its mainstream line" });
  assert.equal(o.nm!.line?.schools, 1);
  assert.equal(o.nm!.line?.rows[0].pupils, 409);
  // Its Schools table: the special and AP schools count, the mainstream school is its line, no headline.
  const s = buildSchools({ agg, schools: await groupSchoolsYear("16125"), focus: "all", pools: await groupComparisons("16125", ["pools"]) });
  assert.ok(s.rows.every((r) => r.headline === null && r.va === null && r.vaNote === null && r.inGroup === null));
  assert.equal(s.rows.find((r) => r.name === "Crags Community School")?.reason, "Mainstream · in the mainstream line");
  assert.ok(s.rows.filter((r) => r.kindTag !== "Mainstream").every((r) => !r.reason?.includes("not in group figures")));
});

test("R-NM-POOLS and R-NM-FSM-NURSERY: each set holds only its kind; R-MIN-SCHOOLS withholds small pools; a nursery federation meets only nursery figures", async () => {
  const nexus = (await groupAggregate("16125", "at_time"))!;
  const nc = await groupComparisons("16125", [...NM_COMPARISON_KINDS]);
  const o = buildOverview({ agg: nexus, comps: nc, compare: "peer_band", focus: "all" });
  const keys = o.nm!.against.map((r) => r.key);
  assert.ok(keys.every((k) => k === "group" || k === "peer_band:band" || k === "kind_areas:region" || k.startsWith("pools:")), keys.join(","));
  assert.ok(!keys.some((k) => k.startsWith("non_group") || k.startsWith("england") || k.startsWith("sat") || k.startsWith("areas")));
  // LA pools exist for special schools only.
  assert.ok(nc.filter((r) => r.kind === "pools" && r.variant.startsWith("la:")).every((r) => r.variant === "la:special"));
  // Every pool's label names its kind; the mainstream pools appear only in the mainstream line.
  assert.ok(o.nm!.against.filter((r) => r.kind === "pools").every((r) => /State-funded (special schools|alternative provision and PRUs|nursery schools)/.test(r.label)));
  assert.ok(o.nm!.line!.rows.some((r) => r.key === "england:england"));
  // R-MIN-SCHOOLS: a pool under 5 schools is withheld (Shaw's LA special pools include some).
  const shaw = (await groupAggregate("4499", "at_time"))!;
  const sp = await groupComparisons("4499", ["pools"]);
  const small = sp.filter((r) => r.kind === "pools" && r.phase === "all" && r.figures.n_schools < 5);
  assert.ok(small.length > 0);
  const ob = buildOverview({ agg: { ...shaw, group: { ...shaw.group, kind: "special_ap" } }, comps: sp, compare: "peer_band", focus: "all" });
  for (const r of ob.nm!.against.filter((x) => x.kind === "pools" && (x.schools ?? 0) > 0 && (x.schools ?? 0) < 5)) {
    assert.equal(r.tooFew, true);
    assert.equal(r.fsm, null);
    assert.equal(r.change1, null);
  }
  // Nursery: every FSM the page shows is a nursery figure.
  const b = (await groupAggregate("17126", "at_time"))!;
  const bo = buildOverview({ agg: b, comps: await groupComparisons("17126", [...NM_COMPARISON_KINDS]), compare: "peer_band", focus: "all" });
  assert.equal(bo.nm!.line, null);
  for (const r of bo.nm!.against.filter((x) => x.kind !== "group" && x.kind !== "kind_areas")) assert.match(r.label, /nursery/i, r.label);
  for (const l of bo.nm!.fsmTrend.lines) assert.ok(l.key === "group" || /nursery/i.test(l.label), l.label);
  assert.ok(bo.nm!.notes.nurseryFsm);
  assert.ok(bo.picker.defaults.every((d) => /nursery|Same kinds/i.test(d.name)), bo.picker.defaults.map((d) => d.name).join(" | "));
});

test("R-NM-OWN-SCHOOLS: a mainstream group's special, AP and nursery schools are placed against their region's pool of their kind; the pooled line only at 5 or more of a kind", async () => {
  const agg = (await groupAggregate("4499", "at_time"))!;
  const schools = await groupSchoolsYear("4499");
  const pools = await groupComparisons("4499", ["pools"]);
  const s = buildSchools({ agg, schools, focus: "all", pools });
  const placed = s.rows.filter((r) => r.placing);
  assert.equal(placed.length, 13); // 12 special, 1 AP
  for (const r of placed) {
    assert.ok(r.placing!.pool, r.name);
    assert.ok(r.placing!.pool!.label.startsWith(r.placing!.kind === "ap" ? "State-funded alternative provision and PRUs, " : "State-funded special schools, "), r.placing!.pool!.label);
    assert.ok(!/England$/.test(r.placing!.pool!.label), "a region's pool, not England's");
  }
  const walton = s.rows.find((r) => r.name === "Walton Hall Academy")!;
  assert.match(walton.placingText!, /^Special, not in group figures · FSM 47\.5% \(region \d+\.\d%\) · roll \+16\.8% \(region [+−]\d+\.\d%\) over 3 years$/);
  assert.equal(walton.placing!.pool!.label, "State-funded special schools, West Midlands");
  // A mainstream school is never placed.
  assert.ok(s.rows.filter((r) => !r.placing).every((r) => !r.placingText));
  // Its results are unchanged (it stays a mainstream group).
  assert.ok(s.rows.some((r) => r.headline));
  // The pooled line: production writes it only at 5+ of a kind (Shaw: 12 special; its 1 AP school none).
  const all = agg.rows.find((r) => r.phase === "all" && r.period === Math.max(...agg.rows.map((x) => x.period)))!.figures;
  assert.deepEqual(Object.keys(all.kind_lines ?? {}), ["special"]);
  assert.equal(all.kind_lines!.special!.n_schools, 12);
  // The page's pooled line, beside England's pool of the kind; Harris has none.
  assert.equal(s.kindLines?.length, 1);
  assert.deepEqual([s.kindLines![0].kind, s.kindLines![0].schools, s.kindLines![0].roll, s.kindLines![0].fsm], ["special", 12, 1727, 49.85]);
  assert.equal(s.kindLines![0].england?.fsm, 50.91);
  assert.ok(placed.every((r) => r.placingText!.includes(", not in group figures · ")));
  // Harris has one AP school, and no kind line.
  const h = (await groupAggregate("3320", "at_time"))!;
  const hs = buildSchools({ agg: h, schools: await groupSchoolsYear("3320"), focus: "all", pools: await groupComparisons("3320", ["pools"]) });
  assert.equal(hs.rows.filter((r) => r.placing).length, 1);
  assert.equal(hs.kindLines, undefined);
  assert.equal(h.rows.find((r) => r.phase === "all" && r.figures.kind_lines)?.figures.kind_lines ?? null, null);
  // placeSchool is null for a mainstream school.
  const ms = schools.find((x) => x.years.some((y) => y.figures?.kind === "mainstream"))!;
  assert.equal(placeSchool(ms.years.find((y) => y.figures)!.figures, "E12000005", pools, 2025, "at_time"), null);
  assert.deepEqual(kindsFor("peer_band"), ["peer_band", "non_group", "sat", "areas", "england", "mix_matched"]);
});
