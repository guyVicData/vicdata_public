// VicData 0.8 groups r1 (G2): the server's access rules, every path positive and negative -- another
// group's head office, a non-member school, a revoked grant, a school that left the group, a likely
// member, a school without VicData, a suspended account, View as. RLS is tested apart
// (supabase/tests/v08_groups_r1_pglite.mjs).
// Run: npx -y tsx --test src/lib/groups/access-rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { accessTable, canManageAccess, grantable, headOfficeSchoolAccess, liveGrant, opensLabel, predates, rollSummary, schoolSide, seeingCount, type Grant, type HeadOffice } from "./access-rules";
import type { GroupMember } from "./production";

const m = (groupId: string, urn: string, name: string, confidence: "confirmed" | "likely" = "confirmed"): GroupMember => ({ groupId, urn, name, status: "open", source: confidence === "likely" ? "companies_house" : "gias_groups", confidence, joined: null, lastSeen: "2026-10-13" });
const HARRIS = [m("3320", "140985", "Harris Academy Battersea"), m("3320", "137121", "Harris Academy Beckenham"), m("3320", "150001", "Harris Likely", "likely")];
const DUKES = [m("club_iss:dukes-education", "110921", "Sancton Wood School")];
const byGroup = new Map([["3320", HARRIS], ["club_iss:dukes-education", DUKES]]);
const harrisAdmin: HeadOffice = { id: "a1", groupId: "3320", name: "Harris Federation", status: "active", role: "head_office_admin" };
const harrisReader: HeadOffice = { ...harrisAdmin, role: "head_office" };
const dukesAdmin: HeadOffice = { id: "b1", groupId: "club_iss:dukes-education", name: "Dukes Education", status: "active", role: "head_office_admin" };
const g = (urn: string, grantedAt: string, revokedAt: string | null = null, likely = false): Grant => ({ schoolUrn: urn, grantedAt, revokedAt, likely });

test("head office opens a current member school's SMT, read-only, only where the school has VicData", () => {
  assert.deepEqual(headOfficeSchoolAccess([harrisReader], byGroup, "140985", true), { ok: true, office: harrisReader, likely: false });
  assert.deepEqual(headOfficeSchoolAccess([harrisReader], byGroup, "140985", false), { ok: false, reason: "no-vicdata-account" });
});

test("another group's head office, a non-member school and a non-head-office caller are refused", () => {
  assert.deepEqual(headOfficeSchoolAccess([dukesAdmin], byGroup, "140985", true), { ok: false, reason: "not-a-member" });
  assert.deepEqual(headOfficeSchoolAccess([harrisAdmin], byGroup, "999999", true), { ok: false, reason: "not-a-member" });
  assert.deepEqual(headOfficeSchoolAccess([], byGroup, "140985", true), { ok: false, reason: "not-head-office" });
});

test("a suspended account opens nothing; a likely member opens, labelled", () => {
  assert.deepEqual(headOfficeSchoolAccess([{ ...harrisAdmin, status: "suspended" }], byGroup, "140985", true), { ok: false, reason: "suspended" });
  const r = headOfficeSchoolAccess([harrisAdmin], byGroup, "150001", true);
  assert.equal(r.ok && r.likely, true);
});

test("a grant counts only while open, on an active account, for a current member", () => {
  const grants = [g("140985", "2026-10-01"), g("137121", "2026-09-01", "2026-10-02"), g("200000", "2026-08-01")];
  assert.ok(liveGrant(harrisAdmin, grants, "140985", HARRIS));
  assert.equal(liveGrant(harrisAdmin, grants, "137121", HARRIS), null, "revoked");
  assert.equal(liveGrant(harrisAdmin, grants, "200000", HARRIS), null, "left the group: open, but no longer counts");
  assert.equal(liveGrant({ status: "suspended" }, grants, "140985", HARRIS), null, "suspended account");
  assert.deepEqual(seeingCount(harrisAdmin, HARRIS, grants), { seeing: 1, of: 3 });
});

test("a school that left and rejoined starts again: an older grant doesn't count (nor show as on)", () => {
  const rejoined = [{ ...HARRIS[0], joined: "2026-09-15" }, ...HARRIS.slice(1)];
  const grants = [g("140985", "2026-05-01")];
  assert.equal(liveGrant(harrisAdmin, grants, "140985", rejoined), null);
  assert.ok(liveGrant(harrisAdmin, [g("140985", "2026-09-20")], "140985", rejoined));
  const t = accessTable(rejoined, grants, new Map([["140985", { smtMembers: 2 }]]), new Map(), new Map());
  assert.equal(t.current.find((r) => r.urn === "140985")!.on, false);
  assert.equal(predates("2026-05-01T09:00:00Z", "2026-09-15"), true);
  assert.equal(predates("2026-05-01T09:00:00Z", null), false, "no join date: can't tell, so it counts");
});

test("grants are made only for current members; a likely member is labelled", () => {
  assert.deepEqual(grantable(HARRIS, "140985"), { ok: true, likely: false });
  assert.deepEqual(grantable(HARRIS, "150001"), { ok: true, likely: true });
  assert.deepEqual(grantable(HARRIS, "110921"), { ok: false }, "another group's school");
  assert.deepEqual(grantable(HARRIS, "200000"), { ok: false }, "left");
});

test("only an active account's head-office admin changes access; never plain head office, never View as", () => {
  assert.equal(canManageAccess(harrisAdmin, false), true);
  assert.equal(canManageAccess(harrisReader, false), false);
  assert.equal(canManageAccess(harrisAdmin, true), false, "View as is read-only");
  assert.equal(canManageAccess({ ...harrisAdmin, status: "suspended" }, false), false);
  assert.equal(canManageAccess(null, false), false);
});

test("the Access table: current, likely and left; no switch without VicData; small counts hidden", () => {
  const grants = [g("140985", "2026-10-01"), g("200000", "2026-05-01", "2026-06-01"), g("200000", "2026-08-01")];
  const t = accessTable(HARRIS, grants, new Map([["140985", { smtMembers: 3 }], ["150001", { smtMembers: 1 }]]), new Map([["140985", { times: 12, staff: 3 }]]), new Map([["200000", "Harris Left School"]]));
  assert.deepEqual(t.current.map((r) => [r.name, r.member, r.on, r.smtMembers, r.opened]), [
    ["Harris Academy Battersea", true, true, 3, "12 times by fewer than 5 staff"],
    ["Harris Academy Beckenham", false, false, null, "—"],
  ]);
  assert.deepEqual(t.likely.map((r) => [r.urn, r.likely, r.on]), [["150001", true, false]]);
  assert.deepEqual(t.left, [{ urn: "200000", name: "Harris Left School", grantedAt: "2026-08-01", revokedAt: null }]);
  assert.equal(opensLabel({ times: 4, staff: 2 }), "fewer than 5 times");
  assert.equal(opensLabel({ times: 30, staff: 7 }), "30 times by 7 staff");
  assert.equal(opensLabel(null), "—");
});

test("a school's own view: its groups with an active account, its grant and share, nothing else", () => {
  const accounts = [{ id: "a1", groupId: "3320", name: "Harris Federation", status: "active" as const }, { id: "s1", groupId: "9999", name: "Suspended Trust", status: "suspended" as const }];
  const out = schoolSide("140985", [{ groupId: "3320", name: "Harris Federation", confidence: "confirmed" }, { groupId: "9999", name: "Suspended Trust", confidence: "confirmed" }, { groupId: "7777", name: "No account", confidence: "likely" }], accounts, new Map([["a1", [g("140985", "2026-10-01")]]]), new Map());
  assert.deepEqual(out, [{ accountId: "a1", groupId: "3320", name: "Harris Federation", likely: false, groupView: { since: "2026-10-01" }, shared: false }]);
});

test("the home's summary line: combined roll this census against last, and how many grew", () => {
  assert.deepEqual(rollSummary([{ urn: "1", now: 110, before: 100 }, { urn: "2", now: 90, before: 100 }, { urn: "3", now: 50, before: null }]), { schools: 3, changePct: 0, growing: 1, compared: 2 });
});
