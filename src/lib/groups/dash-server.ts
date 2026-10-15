// VicData 0.8 groups r2 (A): the group dashboards' server half -- who the caller is (groupDashAccess
// decides), then the page's data from the three group lookups (aggregates.ts) and the pure builders
// (dash.ts). Every route checks access here first. Server-only.
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../supabase";
import { canSeeSmt } from "../smt/auth-rules";
import { accountGrants, groupCaller, isMissing, schoolAccounts } from "./server";
import { groupMembers, schoolGroups } from "./production";
import { groupDashAccess, type DashViewer, type SchoolSeat } from "./dash-access";
import type { GroupAccount } from "./access-rules";

type AccountRow = { id: string; group_id: string; display_name: string; status: "active" | "suspended" };
const toAccount = (a: AccountRow): GroupAccount => ({ id: a.id, groupId: a.group_id, name: a.display_name, status: a.status });

/** The caller's SMT seats: approved memberships whose roles see SMT (their own rows, RLS). */
async function seatsOf(supabase: SupabaseClient, userId: string): Promise<SchoolSeat[]> {
  const { data } = await supabase
    .from("school_memberships")
    .select("id, roles, is_admin, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id)")
    .eq("profile_id", userId)
    .eq("status", "approved");
  return ((data ?? []) as unknown as { id: string; roles: string[] | null; is_admin: boolean; school_accounts: { school_urn: string; account_holder_membership_id: string | null } }[]).map((m) => ({
    urn: m.school_accounts.school_urn,
    canSeeSmt: canSeeSmt({ roles: m.roles ?? [], isAdmin: m.is_admin, isAccountHolder: m.school_accounts.account_holder_membership_id === m.id }),
  }));
}

/** The viewer for ?account=, or the response to send instead (401 signed out; 404 for everyone else
 * not allowed -- another group's head office reads exactly as a group that doesn't exist). */
export async function dashViewer(request: NextRequest): Promise<{ viewer: DashViewer; userId: string } | NextResponse> {
  const caller = await groupCaller(request);
  if (caller instanceof NextResponse) return caller;
  const accountId = request.nextUrl.searchParams.get("account");
  const asOffice = groupDashAccess({ accountId, offices: caller.offices, viewAs: caller.viewAs, account: null, seats: [], members: [], grants: [] });
  if (asOffice.ok) return { viewer: asOffice.viewer, userId: caller.userId };
  if (caller.viewAs) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // A member school's SMT, through a live grant.
  const seats = (await seatsOf(caller.supabase, caller.userId)).filter((s) => s.canSeeSmt);
  if (!seats.length) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const sb = createServiceRoleSupabaseClient();
  let candidates: AccountRow[] = [];
  if (accountId) {
    const { data, error } = await sb.from("group_accounts").select("id, group_id, display_name, status").eq("id", accountId).eq("preview", false).limit(1);
    if (error && !isMissing(error)) throw error;
    candidates = (data ?? []) as AccountRow[];
  } else {
    const groups = (await Promise.all(seats.map((s) => schoolGroups(s.urn)))).flat();
    if (groups.length) {
      const { data, error } = await sb.from("group_accounts").select("id, group_id, display_name, status").eq("preview", false).in("group_id", Array.from(new Set(groups.map((g) => g.groupId))));
      if (error && !isMissing(error)) throw error;
      candidates = (data ?? []) as AccountRow[];
    }
  }
  for (const c of candidates) {
    const account = toAccount(c);
    const [members, grants] = await Promise.all([groupMembers(account.groupId), accountGrants(account.id)]);
    const r = groupDashAccess({ accountId, offices: [], viewAs: false, account, seats, members, grants });
    if (r.ok) return { viewer: r.viewer, userId: caller.userId };
  }
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

/** Which member schools hold their own VicData membership (the Schools table's SMT links). */
export async function vicdataSchools(urns: string[]): Promise<Set<string>> {
  return new Set((await schoolAccounts(urns)).keys());
}
