// VicData 0.8 groups r2 (A): who may open a group's dashboards (Overview, Schools, and round 3's
// Academic and Pupils). Spec §3.2 and round 1's rules:
//   - head office of that group (an active account);
//   - a member school's SMT or School-Admin, only while the school holds a live grant from that account
//     (current member of the group, grant open, made during this membership: liveGrant);
//   - a platform admin through View as (read-only, never logged).
// Anyone else -- another group's head office, a non-member school, a revoked grant, a school that left
// the group -- reads "not found". Pure: the route gathers the facts, this decides (dash-access.test.ts).
import { liveGrant, membersOf, type Grant, type GroupAccount, type HeadOffice } from "./access-rules";
import type { GroupMember } from "./production";

export type DashViewer = { as: "head_office" | "view_as"; account: GroupAccount; groupId: string } | { as: "school"; account: GroupAccount; groupId: string; urn: string };
export type DashRefusal = "no-account" | "not-found";

export type SchoolSeat = { urn: string; canSeeSmt: boolean };

export function groupDashAccess(input: {
  accountId: string | null;
  offices: HeadOffice[];
  viewAs: boolean;
  // For the school path: the account asked for (by id), the caller's schools, the group's current
  // members and the account's grants.
  account: GroupAccount | null;
  seats: SchoolSeat[];
  members: GroupMember[];
  grants: Grant[];
}): { ok: true; viewer: DashViewer } | { ok: false; reason: DashRefusal } {
  const { accountId, offices } = input;
  // Head office (or View as): its own account, by id or its first.
  const o = accountId ? offices.find((x) => x.id === accountId) : offices[0];
  if (o && (o.status === "active" || input.viewAs)) return { ok: true, viewer: { as: input.viewAs ? "view_as" : "head_office", account: o, groupId: membersOf(o) } };
  if (input.viewAs) return { ok: false, reason: "not-found" };
  // A member school's SMT: the account must be named, active, and hold a live grant for one of the
  // caller's SMT schools.
  const a = input.account;
  if (!a || (accountId && a.id !== accountId)) return { ok: false, reason: offices.length || input.seats.length ? "not-found" : "no-account" };
  if (a.status !== "active") return { ok: false, reason: "not-found" };
  for (const s of input.seats) {
    if (!s.canSeeSmt) continue;
    if (liveGrant(a, input.grants, s.urn, input.members)) return { ok: true, viewer: { as: "school", account: a, groupId: membersOf(a), urn: s.urn } };
  }
  return { ok: false, reason: "not-found" };
}
