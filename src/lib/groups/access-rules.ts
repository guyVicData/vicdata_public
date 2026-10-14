// VicData 0.8 groups r1 (G2): who may see and change what, as pure functions the routes call and the
// tests exercise (access-rules.test.ts). The database's RLS keeps every account's rows to its own head
// office (supabase/migrations/20261110090000_v08_groups_r1_accounts.sql); these add the one rule it
// can't check -- the school must be a CURRENT member of the group in production -- at grant time and
// at every read.
import type { GroupMember } from "./production";

export type GroupRole = "head_office_admin" | "head_office";
export type GroupAccount = { id: string; groupId: string; name: string; status: "active" | "suspended" };
export type HeadOffice = GroupAccount & { role: GroupRole };
export type Grant = { schoolUrn: string; grantedAt: string; revokedAt: string | null; likely: boolean };

/** The open grant for a school, whatever its membership (for the history). */
export const openGrant = (grants: Grant[], urn: string): Grant | null => grants.find((g) => g.schoolUrn === urn && g.revokedAt === null) ?? null;

/** Was this decision (a grant, a share) made before the school's current membership began? Then it
 * belonged to an earlier membership: a school that left and rejoined starts again. */
export const predates = (at: string, joined: string | null): boolean => !!joined && at.slice(0, 10) < joined;

/** The grant that counts now: open, on an active account, for a school that is still a current member
 * of the group, made during this membership. A school that left loses the group view without anyone
 * revoking it, and doesn't get it back by rejoining. */
export function liveGrant(account: Pick<GroupAccount, "status">, grants: Grant[], urn: string, members: GroupMember[]): Grant | null {
  if (account.status !== "active") return null;
  const m = members.find((x) => x.urn === urn);
  if (!m) return null;
  const g = openGrant(grants, urn);
  return g && !predates(g.grantedAt, m.joined) ? g : null;
}

/** Can a grant be made for this school now? Current members only; a likely member is labelled. */
export function grantable(members: GroupMember[], urn: string): { ok: true; likely: boolean } | { ok: false } {
  const m = members.find((x) => x.urn === urn);
  return m ? { ok: true, likely: m.confidence === "likely" } : { ok: false };
}

/** Grants change only for the account's head-office admin, on an active account, never in View as. */
export function canManageAccess(m: Pick<HeadOffice, "role" | "status"> | null, viewAs: boolean): boolean {
  return !!m && !viewAs && m.role === "head_office_admin" && m.status === "active";
}

export type SchoolAccessRefusal = "not-head-office" | "not-a-member" | "no-vicdata-account" | "suspended";

/** May head office open this school's SMT dashboards, read-only? Only a current member school of one of
 * the caller's active group accounts, and only where the school holds its own VicData membership. */
export function headOfficeSchoolAccess(
  offices: HeadOffice[],
  membersByGroup: Map<string, GroupMember[]>,
  urn: string,
  schoolHasAccount: boolean,
): { ok: true; office: HeadOffice; likely: boolean } | { ok: false; reason: SchoolAccessRefusal } {
  if (!offices.length) return { ok: false, reason: "not-head-office" };
  const holding = offices.filter((o) => (membersByGroup.get(o.groupId) ?? []).some((m) => m.urn === urn));
  if (!holding.length) return { ok: false, reason: "not-a-member" };
  const active = holding.find((o) => o.status === "active");
  if (!active) return { ok: false, reason: "suspended" };
  if (!schoolHasAccount) return { ok: false, reason: "no-vicdata-account" };
  return { ok: true, office: active, likely: (membersByGroup.get(active.groupId) ?? []).find((m) => m.urn === urn)?.confidence === "likely" };
}

/** "Opened, last 30 days": counts only; small numbers never shown (names never are). */
export function opensLabel(u: { times: number; staff: number } | null | undefined): string {
  if (!u || u.times === 0) return "—";
  if (u.times < 5) return "fewer than 5 times";
  return `${u.times} times by ${u.staff < 5 ? "fewer than 5" : u.staff} staff`;
}

export type AccessRow = {
  urn: string;
  name: string;
  likely: boolean;
  // The school holds its own VicData membership (a school account): only then has it staff to sign in.
  member: boolean;
  smtMembers: number | null;
  on: boolean;
  since: string | null;
  opened: string;
};
export type LeftRow = { urn: string; name: string; grantedAt: string; revokedAt: string | null };

/** The Access page: current members (confirmed), likely members, and schools that held a grant but have
 * left the group (read-only history: their grants no longer count). */
export function accessTable(
  members: GroupMember[],
  grants: Grant[],
  schools: Map<string, { smtMembers: number }>,
  usage: Map<string, { times: number; staff: number }>,
  names: Map<string, string>,
): { current: AccessRow[]; likely: AccessRow[]; left: LeftRow[] } {
  const row = (m: GroupMember): AccessRow => {
    const acc = schools.get(m.urn);
    const g0 = acc ? openGrant(grants, m.urn) : null;
    const g = g0 && !predates(g0.grantedAt, m.joined) ? g0 : null;
    return { urn: m.urn, name: m.name, likely: m.confidence === "likely", member: !!acc, smtMembers: acc ? acc.smtMembers : null, on: !!g, since: g?.grantedAt ?? null, opened: acc ? opensLabel(usage.get(m.urn)) : "—" };
  };
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const current = members.filter((m) => m.confidence === "confirmed").map(row).sort(byName);
  const likely = members.filter((m) => m.confidence === "likely").map(row).sort(byName);
  const now = new Set(members.map((m) => m.urn));
  const lastByUrn = new Map<string, Grant>();
  for (const g of grants) if (!now.has(g.schoolUrn) && (!lastByUrn.has(g.schoolUrn) || g.grantedAt > lastByUrn.get(g.schoolUrn)!.grantedAt)) lastByUrn.set(g.schoolUrn, g);
  const left = Array.from(lastByUrn.values()).map((g) => ({ urn: g.schoolUrn, name: names.get(g.schoolUrn) ?? g.schoolUrn, grantedAt: g.grantedAt, revokedAt: g.revokedAt })).sort(byName);
  return { current, likely, left };
}

/** How many current member schools see the group view now (the home's Access card). */
export function seeingCount(account: Pick<GroupAccount, "status">, members: GroupMember[], grants: Grant[]): { seeing: number; of: number } {
  return { seeing: members.filter((m) => liveGrant(account, grants, m.urn, members)).length, of: members.length };
}

/** "{n} schools · roll ▲ x% · {g} growing": the combined roll this census against last, over the
 * schools with both years; growing = schools whose roll rose. */
export function rollSummary(rolls: { urn: string; now: number | null; before: number | null }[]): { schools: number; changePct: number | null; growing: number; compared: number } {
  const both = rolls.filter((r) => r.now !== null && r.before !== null && r.before > 0);
  const now = both.reduce((s, r) => s + r.now!, 0);
  const before = both.reduce((s, r) => s + r.before!, 0);
  return { schools: rolls.length, changePct: before > 0 ? ((now - before) / before) * 100 : null, growing: both.filter((r) => r.now! > r.before!).length, compared: both.length };
}

/** A school's own view of its groups: each group with an active VicData group account, whether the
 * school's SMT has the group view, and whether its School-Admin shares the Admissions panels. Nothing
 * else about the group account. */
export function schoolSide(
  urn: string,
  groups: { groupId: string; name: string; confidence: "confirmed" | "likely" }[],
  accounts: GroupAccount[],
  grantsByAccount: Map<string, Grant[]>,
  shares: Map<string, boolean>,
): { accountId: string; groupId: string; name: string; likely: boolean; groupView: { since: string } | null; shared: boolean }[] {
  const out = [];
  for (const g of groups) {
    const a = accounts.find((x) => x.groupId === g.groupId && x.status === "active");
    if (!a) continue;
    const grant = openGrant(grantsByAccount.get(a.id) ?? [], urn);
    out.push({ accountId: a.id, groupId: g.groupId, name: g.name, likely: g.confidence === "likely", groupView: grant ? { since: grant.grantedAt } : null, shared: shares.get(a.id) ?? false });
  }
  return out;
}
