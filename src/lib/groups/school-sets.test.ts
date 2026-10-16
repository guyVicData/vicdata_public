// VicData 0.8 groups r3 (S): a member school's groups as comparison sets.
//   R-GROUP-SET          members only; the count is phase-filtered; nothing for a school in no group
//   R-GROUP-SET-SOURCES  likely members labelled; a self-declared group only for the school that made it
// Run: npx -y tsx --test src/lib/groups/school-sets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSetLabel, groupSetsFor } from "./school-sets";
import { groupSetCount, groupSetWithResults } from "./set-count";
import type { GroupMember, SchoolGroup } from "./production";

const sg = (groupId: string, name: string, type: string, source = "gias_groups", confidence: "confirmed" | "likely" = "confirmed"): SchoolGroup => ({ urn: "140985", groupId, type, name, officialName: name, status: "open", source, confidence, joined: null, lastSeen: "2026-10-13" });
const mem = (groupId: string, urn: string, name: string, confidence: "confirmed" | "likely" = "confirmed"): GroupMember => ({ groupId, urn, name, status: "open", source: "gias_groups", confidence, joined: null, lastSeen: "2026-10-13" });
const MEMBERS: Record<string, GroupMember[]> = {
  "3320": [mem("3320", "140985", "Harris Academy Battersea"), mem("3320", "137121", "Harris Academy Beckenham"), mem("3320", "150001", "Harris Likely", "likely")],
  // Harris' sponsor record: the same schools (the same body), shown once.
  "3319": [mem("3319", "140985", "Harris Academy Battersea"), mem("3319", "137121", "Harris Academy Beckenham"), mem("3319", "150001", "Harris Likely", "likely")],
  sat1: [mem("sat1", "140985", "Harris Academy Battersea")],
  "self:1": [mem("self:1", "140985", "Harris Academy Battersea"), mem("self:1", "100001", "A neighbour")],
};
const membersOf = async (id: string) => MEMBERS[id] ?? [];
const info = async (urns: string[]) => new Map(urns.map((u) => [u, { laName: "Wandsworth", independent: false }]));

test("labels: 'All Dukes schools', 'All Harris Federation schools'", () => {
  assert.equal(groupSetLabel("Dukes Education"), "All Dukes schools");
  assert.equal(groupSetLabel("HARRIS FEDERATION"), "All Harris Federation schools");
  assert.equal(groupSetLabel("ARK SCHOOLS"), "All Ark Schools");
});

test("R-GROUP-SET: a member school gets its groups; SATs and groups of no other school don't count; the same body once", async () => {
  const sets = await groupSetsFor("140985", [sg("3320", "HARRIS FEDERATION", "mat"), sg("3319", "Harris Federation", "sponsor"), sg("sat1", "HARRIS ACADEMY BATTERSEA", "sat")], membersOf, info);
  assert.deepEqual(sets.map((s) => s.id), ["group:3320"]);
  assert.equal(sets[0].name, "All Harris Federation schools");
  assert.deepEqual(sets[0].members.map((m) => m.urn).sort(), ["137121", "150001"], "the school itself left out of its own set");
  assert.equal(sets[0].editable, false);
});

test("R-GROUP-SET: a school in no group gets nothing (its chooser is unchanged)", async () => {
  assert.deepEqual(await groupSetsFor("999999", [], membersOf, info), []);
});

test("R-GROUP-SET-SOURCES: likely members are included and labelled with the source", async () => {
  const [s] = await groupSetsFor("140985", [sg("3320", "HARRIS FEDERATION", "mat")], membersOf, info);
  assert.equal(s.members.find((m) => m.urn === "150001")?.likely, true);
  assert.equal(s.group.likelyMembers, 1);
  assert.equal(s.group.sourceLabel, "GIAS");
  const [ch] = await groupSetsFor("140985", [sg("3320", "Some Group", "independent_company", "companies_house", "likely")], membersOf, info);
  assert.equal(ch.group.likely, true);
  assert.equal(ch.group.sourceLabel, "Companies House");
});

test("R-GROUP-SET-SOURCES: a self-declared group is offered only to the school that made it (fixture)", async () => {
  const self = { ...sg("self:1", "Our partnership", "self_declared", "self_declared"), madeBy: "140985" };
  assert.deepEqual((await groupSetsFor("140985", [self], membersOf, info)).map((s) => s.id), ["group:self:1"]);
  assert.deepEqual(await groupSetsFor("100001", [{ ...self, urn: "100001" }], membersOf, info), [], "another member school never sees it");
});

test("R-GROUP-SET: the count is phase-filtered ('9 with GCSE results · 26 in all'): preps and IGCSE schools don't count", () => {
  const s = {
    members: Array.from({ length: 26 }, (_, i) => ({ urn: String(100000 + i), name: `S${i}`, laName: null, independent: true })),
    rows: [{ urn: "t", name: "This school", isTarget: true, value: 50 }, ...Array.from({ length: 25 }, (_, i) => ({ urn: String(100000 + i), name: `S${i}`, isTarget: false, value: i < 9 ? 50 : null }))] as never,
    group: { groupId: "club_iss:dukes-education", source: "club_iss", sourceLabel: "Club ISS", likely: false, likelyMembers: 0, type: "independent_company", selfDeclared: false },
  };
  assert.equal(groupSetWithResults(s), 9);
  assert.equal(groupSetCount(s, "ks4"), "9 with GCSE results · 26 in all");
});
