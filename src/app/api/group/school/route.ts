import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { isMissing, userFrom } from "@/lib/groups/server";
import { schoolGroups } from "@/lib/groups/production";
import { schoolSide, type Grant, type GroupAccount } from "@/lib/groups/access-rules";
import { canSeeSmt } from "@/lib/smt/auth-rules";

// VicData 0.8 groups r1 (G2): a school's own side. Its SMT and School-Admin learn which of its groups
// hold a VicData group account, whether the school's SMT has the group view, and whether the
// School-Admin shares the Admissions panels with head office -- nothing else about the group account.
// The grant counts only while the school is a current member (production, read here). GET ?urn=.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  if (!urn || !/^\d{5,7}$/.test(urn)) return NextResponse.json({ error: "urn is required" }, { status: 400 });
  try {
    const u = await userFrom(request);
    if (u instanceof NextResponse) return u;
    const { data: m } = await u.supabase
      .from("school_memberships")
      .select("id, roles, is_admin, school_account_id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id)")
      .eq("profile_id", u.userId)
      .eq("status", "approved")
      .eq("school_accounts.school_urn", urn)
      .limit(1)
      .maybeSingle<{ id: string; roles: string[] | null; is_admin: boolean; school_account_id: string; school_accounts: { account_holder_membership_id: string | null } }>();
    const holder = !!m && m.school_accounts.account_holder_membership_id === m.id;
    if (!m || !canSeeSmt({ roles: m.roles ?? [], isAdmin: m.is_admin, isAccountHolder: holder })) return NextResponse.json({ groups: [], schoolAdmin: false });
    const groups = await schoolGroups(urn);
    if (!groups.length) return NextResponse.json({ groups: [], schoolAdmin: m.is_admin || holder });
    const sb = createServiceRoleSupabaseClient();
    const { data: accs, error } = await sb.from("group_accounts").select("id, group_id, display_name, status").in("group_id", groups.map((g) => g.groupId));
    if (error) {
      if (isMissing(error)) return NextResponse.json({ groups: [], schoolAdmin: m.is_admin || holder });
      throw error;
    }
    const accounts = ((accs ?? []) as { id: string; group_id: string; display_name: string; status: "active" | "suspended" }[]).map((a): GroupAccount => ({ id: a.id, groupId: a.group_id, name: a.display_name, status: a.status }));
    const ids = accounts.map((a) => a.id);
    const grantsByAccount = new Map<string, Grant[]>();
    const shares = new Map<string, boolean>();
    if (ids.length) {
      const { data: gr } = await sb.from("group_view_grants").select("group_account_id, school_urn, granted_at, revoked_at, likely_member").eq("school_urn", urn).is("revoked_at", null).in("group_account_id", ids);
      for (const r of (gr ?? []) as { group_account_id: string; school_urn: string; granted_at: string; revoked_at: string | null; likely_member: boolean }[]) (grantsByAccount.get(r.group_account_id) ?? grantsByAccount.set(r.group_account_id, []).get(r.group_account_id)!).push({ schoolUrn: r.school_urn, grantedAt: r.granted_at, revokedAt: r.revoked_at, likely: r.likely_member });
      const { data: sh } = await sb.from("group_admissions_shares").select("group_account_id, shared").eq("school_account_id", m.school_account_id).in("group_account_id", ids);
      for (const r of (sh ?? []) as { group_account_id: string; shared: boolean }[]) shares.set(r.group_account_id, r.shared);
    }
    return NextResponse.json({ groups: schoolSide(urn, groups.map((g) => ({ groupId: g.groupId, name: g.name, confidence: g.confidence })), accounts, grantsByAccount, shares), schoolAdmin: m.is_admin || holder });
  } catch (err) {
    console.error("[group/school] failed:", err);
    return NextResponse.json({ error: "Could not read the school's groups." }, { status: 502 });
  }
}
