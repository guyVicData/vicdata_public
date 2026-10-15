// VicData 0.8 groups r2 (A): who opens the group dashboards, every path positive and negative.
// Run: npx -y tsx --test src/lib/groups/dash-access.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupDashAccess } from "./dash-access";
import type { Grant, GroupAccount, HeadOffice } from "./access-rules";
import type { GroupMember } from "./production";

const m = (urn: string, joined: string | null = null, confidence: "confirmed" | "likely" = "confirmed"): GroupMember => ({ groupId: "3320", urn, name: urn, status: "open", source: "gias_groups", confidence, joined, lastSeen: "2026-10-13" });
const HARRIS_MEMBERS = [m("140985", "2015-09-01"), m("137121", "2012-09-01"), m("150001", null, "likely")];
const harris: GroupAccount = { id: "acc-h", groupId: "3320", name: "Harris Federation", status: "active" };
const dukes: GroupAccount = { id: "acc-d", groupId: "club_iss:dukes-education", name: "Dukes Education", status: "active" };
const office = (a: GroupAccount, role: HeadOffice["role"] = "head_office"): HeadOffice => ({ ...a, role });
const g = (urn: string, grantedAt: string, revokedAt: string | null = null): Grant => ({ schoolUrn: urn, grantedAt, revokedAt, likely: false });
const none = { account: null, seats: [], members: [], grants: [] };

test("head office opens its own group's dashboards, by id or as its first account", () => {
  const r = groupDashAccess({ accountId: "acc-h", offices: [office(harris)], viewAs: false, ...none });
  assert.ok(r.ok && r.viewer.as === "head_office" && r.viewer.groupId === "3320");
  const r2 = groupDashAccess({ accountId: null, offices: [office(harris)], viewAs: false, ...none });
  assert.ok(r2.ok && r2.viewer.groupId === "3320");
});

test("another group's head office reads not found", () => {
  const r = groupDashAccess({ accountId: "acc-h", offices: [office(dukes)], viewAs: false, ...none });
  assert.deepEqual(r, { ok: false, reason: "not-found" });
});

test("a suspended account's head office reads nothing; View as still can (read-only)", () => {
  const susp = { ...harris, status: "suspended" as const };
  assert.deepEqual(groupDashAccess({ accountId: "acc-h", offices: [office(susp)], viewAs: false, ...none }), { ok: false, reason: "not-found" });
  const v = groupDashAccess({ accountId: "acc-h", offices: [office(susp, "head_office_admin")], viewAs: true, ...none });
  assert.ok(v.ok && v.viewer.as === "view_as");
});

test("View as without that account reads not found, never falls through to a school", () => {
  assert.deepEqual(groupDashAccess({ accountId: "acc-h", offices: [], viewAs: true, account: harris, seats: [{ urn: "140985", canSeeSmt: true }], members: HARRIS_MEMBERS, grants: [g("140985", "2026-10-01")] }), { ok: false, reason: "not-found" });
});

test("a member school's SMT with a live grant opens the dashboards", () => {
  const r = groupDashAccess({ accountId: "acc-h", offices: [], viewAs: false, account: harris, seats: [{ urn: "140985", canSeeSmt: true }], members: HARRIS_MEMBERS, grants: [g("140985", "2026-10-01")] });
  assert.ok(r.ok && r.viewer.as === "school" && r.viewer.urn === "140985");
});

test("a member school's staff without SMT, a non-member school, a revoked grant, a school that left: not found", () => {
  const base = { accountId: "acc-h", offices: [], viewAs: false, account: harris, members: HARRIS_MEMBERS };
  assert.deepEqual(groupDashAccess({ ...base, seats: [{ urn: "140985", canSeeSmt: false }], grants: [g("140985", "2026-10-01")] }), { ok: false, reason: "not-found" });
  assert.deepEqual(groupDashAccess({ ...base, seats: [{ urn: "999999", canSeeSmt: true }], grants: [g("999999", "2026-10-01")] }), { ok: false, reason: "not-found" });
  assert.deepEqual(groupDashAccess({ ...base, seats: [{ urn: "140985", canSeeSmt: true }], grants: [g("140985", "2026-09-01", "2026-10-01")] }), { ok: false, reason: "not-found" });
  // Left the group: no longer in production's current members, its grant still open.
  assert.deepEqual(groupDashAccess({ ...base, members: HARRIS_MEMBERS.filter((x) => x.urn !== "137121"), seats: [{ urn: "137121", canSeeSmt: true }], grants: [g("137121", "2026-10-01")] }), { ok: false, reason: "not-found" });
  // Left and rejoined: a grant from before this membership doesn't count.
  assert.deepEqual(groupDashAccess({ ...base, members: [m("137121", "2026-10-10")], seats: [{ urn: "137121", canSeeSmt: true }], grants: [g("137121", "2026-09-01")] }), { ok: false, reason: "not-found" });
});

test("a grant on another group's account doesn't open this one", () => {
  const r = groupDashAccess({ accountId: "acc-h", offices: [], viewAs: false, account: dukes, seats: [{ urn: "140985", canSeeSmt: true }], members: HARRIS_MEMBERS, grants: [g("140985", "2026-10-01")] });
  assert.deepEqual(r, { ok: false, reason: "not-found" });
});

test("a suspended account opens nothing for its schools", () => {
  const r = groupDashAccess({ accountId: "acc-h", offices: [], viewAs: false, account: { ...harris, status: "suspended" }, seats: [{ urn: "140985", canSeeSmt: true }], members: HARRIS_MEMBERS, grants: [g("140985", "2026-10-01")] });
  assert.deepEqual(r, { ok: false, reason: "not-found" });
});

test("signed in with no group and no SMT seat: no account", () => {
  assert.deepEqual(groupDashAccess({ accountId: null, offices: [], viewAs: false, ...none }), { ok: false, reason: "no-account" });
});
