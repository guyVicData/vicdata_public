// VicData 0.8 groups r1 (G2): the group routes' server half. Who the caller is (their own token, so
// RLS shows them only their own group accounts), and the reads the routes make with the service role
// AFTER the caller is checked: grants, the member schools' VicData accounts and SMT counts, usage
// counts. Server-only. Every read treats the tables' absence (before the G1 migration is applied) as
// "no group accounts", so the app works before and after the apply.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleSupabaseClient } from "../supabase";
import { isPlatformAdmin, parsePeekHeader, PEEK_HEADER } from "../view-as";
import { canSeeSmt } from "../smt/auth-rules";
import { parseViewAsGroupCookie } from "./view-as-group";
import { groupMembers, type GroupMember } from "./production";
import { headOfficeSchoolAccess, membersOf, predates, type Grant, type GroupAccount, type HeadOffice, type SchoolAccessRefusal } from "./access-rules";

export type GroupCaller = { userId: string; supabase: SupabaseClient; offices: HeadOffice[]; viewAs: boolean };

export const NOT_FOUND = () => NextResponse.json({ error: "Not found." }, { status: 404 });

/** The tables (or a relationship between them) don't exist yet: the G1 migration isn't applied. */
export function isMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ["42P01", "PGRST205", "PGRST200", "42883", "PGRST202"].includes(error.code ?? "") || /does not exist|schema cache|could not find/i.test(error.message ?? "");
}

export async function userFrom(request: NextRequest): Promise<{ userId: string; supabase: SupabaseClient } | NextResponse> {
  const auth = request.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!data.user?.id) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  return { userId: data.user.id, supabase };
}

type AccountRow = { id: string; group_id: string; display_name: string; status: "active" | "suspended"; preview_of?: string | null };
const toAccount = (a: AccountRow): GroupAccount => ({ id: a.id, groupId: a.group_id, name: a.display_name, status: a.status, membersOf: a.preview_of ?? a.group_id });

/** The caller's own head-office memberships (RLS: their own rows only). */
export async function officesOf(supabase: SupabaseClient, userId: string): Promise<HeadOffice[]> {
  const { data, error } = await supabase.from("group_memberships").select("role, group_accounts!inner(id, group_id, display_name, status, preview_of)").eq("profile_id", userId);
  if (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return ((data ?? []) as unknown as { role: HeadOffice["role"]; group_accounts: AccountRow }[]).map((r) => ({ ...toAccount(r.group_accounts), role: r.role }));
}

/** Head office, or a platform admin in View as for one account (read-only). */
export async function groupCaller(request: NextRequest): Promise<GroupCaller | NextResponse> {
  const u = await userFrom(request);
  if (u instanceof NextResponse) return u;
  // The head-office View as (the one View as cookie), or a head-office peek (?lookAs={account}&as=head_office&peek=1).
  const peek = parsePeekHeader(request.headers.get(PEEK_HEADER))?.group ?? null;
  const v = parseViewAsGroupCookie(request.headers.get("cookie")) ?? peek;
  if (v && (await isPlatformAdmin(u.supabase))) {
    const { data, error } = await createServiceRoleSupabaseClient().from("group_accounts").select("id, group_id, display_name, status, preview_of").eq("id", v.accountId).maybeSingle<AccountRow>();
    if (error && !isMissing(error)) throw error;
    // View as is read-only whatever the role: canManageAccess refuses it.
    return { ...u, offices: data ? [{ ...toAccount(data), role: "head_office_admin" }] : [], viewAs: true };
  }
  return { ...u, offices: await officesOf(u.supabase, u.userId), viewAs: false };
}

/** The caller's office for this account, or null -- another group's account reads as "not found". */
export function officeFor(caller: GroupCaller, accountId: string | null): HeadOffice | null {
  const o = accountId ? caller.offices.find((x) => x.id === accountId) : caller.offices[0];
  // A suspended account's head office reads nothing (RLS hides it too); a platform admin in View as can.
  if (!o || (o.status !== "active" && !caller.viewAs)) return null;
  return o;
}

/** An account's grants, history included (service role: the caller's office is already checked). */
export async function accountGrants(accountId: string): Promise<Grant[]> {
  const { data, error } = await createServiceRoleSupabaseClient().from("group_view_grants").select("school_urn, granted_at, revoked_at, likely_member").eq("group_account_id", accountId).order("granted_at");
  if (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return ((data ?? []) as { school_urn: string; granted_at: string; revoked_at: string | null; likely_member: boolean }[]).map((r) => ({ schoolUrn: r.school_urn, grantedAt: r.granted_at, revokedAt: r.revoked_at, likely: r.likely_member }));
}

/** Which member schools hold their own VicData membership, and how many SMT (SMT role, School-Admin or
 * the account holder) each has. Counts only. */
export async function schoolAccounts(urns: string[]): Promise<Map<string, { accountId: string; smtMembers: number }>> {
  const out = new Map<string, { accountId: string; smtMembers: number }>();
  if (!urns.length) return out;
  const sb = createServiceRoleSupabaseClient();
  const { data: accs, error } = await sb.from("school_accounts").select("id, school_urn, account_holder_membership_id").in("school_urn", urns);
  if (error) throw error;
  const rows = (accs ?? []) as { id: string; school_urn: string; account_holder_membership_id: string | null }[];
  if (!rows.length) return out;
  const { data: mems, error: e2 } = await sb.from("school_memberships").select("id, school_account_id, roles, is_admin").in("school_account_id", rows.map((r) => r.id)).eq("status", "approved");
  if (e2) throw e2;
  for (const a of rows) {
    const smt = ((mems ?? []) as { id: string; school_account_id: string; roles: string[] | null; is_admin: boolean }[]).filter((m) => m.school_account_id === a.id && canSeeSmt({ roles: m.roles ?? [], isAdmin: m.is_admin, isAccountHolder: m.id === a.account_holder_membership_id })).length;
    out.set(a.school_urn, { accountId: a.id, smtMembers: smt });
  }
  return out;
}

/** "Opened, last 30 days" per school: group-view page views (product 'groups', from round 2) by that
 * school's staff. Counts only, never who. None until the group dashboards exist. */
export async function groupViewUsage(urns: string[], days = 30): Promise<Map<string, { times: number; staff: number }>> {
  const out = new Map<string, { times: number; staff: number }>();
  if (!urns.length) return out;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await createServiceRoleSupabaseClient().from("usage_events").select("school_urn, membership_id").eq("product", "groups").eq("event", "page_view").gte("occurred_at", since).in("school_urn", urns).limit(50_000);
  if (error) return out; // no usage log yet (or not this product yet): no counts
  const staff = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { school_urn: string; membership_id: string | null }[]) {
    const c = out.get(r.school_urn) ?? { times: 0, staff: 0 };
    c.times++;
    out.set(r.school_urn, c);
    if (r.membership_id) (staff.get(r.school_urn) ?? staff.set(r.school_urn, new Set()).get(r.school_urn)!).add(r.membership_id);
  }
  for (const [u, s] of staff) out.get(u)!.staff = s.size;
  return out;
}

/** May this signed-in user open `urn`'s SMT as head office? Their own memberships (RLS), the group's
 * current members (production), and the school's own VicData account. Used by the SMT routes, the
 * chooser-set route and the SMT page. */
export async function headOfficeAccess(supabase: SupabaseClient, userId: string, urn: string, given?: HeadOffice[]): Promise<{ ok: true; office: HeadOffice; likely: boolean; schoolName: string; shared: boolean } | { ok: false; reason: SchoolAccessRefusal }> {
  const offices = given ?? (await officesOf(supabase, userId));
  if (!offices.length) return { ok: false, reason: "not-head-office" };
  const byGroup = new Map<string, GroupMember[]>();
  await Promise.all(offices.map(async (o) => byGroup.set(membersOf(o), await groupMembers(membersOf(o)))));
  const accounts = await schoolAccounts([urn]);
  const r = headOfficeSchoolAccess(offices, byGroup, urn, accounts.has(urn));
  if (!r.ok) return r;
  const schoolName = byGroup.get(membersOf(r.office))?.find((m) => m.urn === urn)?.name ?? urn;
  const { data } = await createServiceRoleSupabaseClient().from("group_admissions_shares").select("shared, set_at").eq("school_account_id", accounts.get(urn)!.accountId).eq("group_account_id", r.office.id).maybeSingle<{ shared: boolean; set_at: string }>();
  // A share set before the school's current membership began (it left and rejoined) is a decision about
  // a different membership: not shared until the School-Admin decides again.
  const joined = byGroup.get(membersOf(r.office))?.find((m) => m.urn === urn)?.joined ?? null;
  return { ...r, schoolName, shared: data?.shared === true && !predates(data.set_at, joined) };
}
