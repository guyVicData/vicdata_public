import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { accountGrants, groupCaller, groupViewUsage, NOT_FOUND, officeFor, schoolAccounts } from "@/lib/groups/server";
import { groupMembers } from "@/lib/groups/production";
import { accessTable, canManageAccess, grantable } from "@/lib/groups/access-rules";

// VicData 0.8 groups r1 (G4): the Access page. GET ?account= -- the table (head-office admin, or a
// platform admin in View as, read-only; plain head office sees only the home's count). POST
// { account, urn, on } or { account, all: true, on } -- grants and revokes, head-office admin only,
// for the group's CURRENT member schools only (checked here in production, then written by the
// service role: no user can write a grant row).
export async function GET(request: NextRequest) {
  try {
    const caller = await groupCaller(request);
    if (caller instanceof NextResponse) return caller;
    const office = officeFor(caller, request.nextUrl.searchParams.get("account"));
    if (!office || (office.role !== "head_office_admin" && !caller.viewAs)) return NOT_FOUND();
    const members = await groupMembers(office.groupId);
    const grants = await accountGrants(office.id);
    const urns = Array.from(new Set([...members.map((m) => m.urn), ...grants.map((g) => g.schoolUrn)]));
    const [accounts, usage] = await Promise.all([schoolAccounts(members.map((m) => m.urn)), groupViewUsage(members.map((m) => m.urn))]);
    const leftUrns = urns.filter((u) => !members.some((m) => m.urn === u));
    const names = new Map<string, string>();
    if (leftUrns.length) {
      const { data } = await createServiceRoleSupabaseClient().from("schools").select("urn, current_name").in("urn", leftUrns);
      for (const r of (data ?? []) as { urn: string; current_name: string }[]) names.set(r.urn, r.current_name);
    }
    const table = accessTable(members, grants, new Map(Array.from(accounts).map(([u, a]) => [u, { smtMembers: a.smtMembers }])), usage, names);
    // Head office itself (G2: the admin invites, changes and removes members). Names and addresses
    // only for this account's own admin (or a platform admin in View as).
    const sb = createServiceRoleSupabaseClient();
    const { data: hm } = await sb.from("group_memberships").select("id, profile_id, role, approved_at").eq("group_account_id", office.id).order("approved_at");
    const hmRows = (hm ?? []) as { id: string; profile_id: string; role: string; approved_at: string }[];
    const { data: profs } = hmRows.length ? await sb.from("profiles").select("id, full_name, email").in("id", hmRows.map((r) => r.profile_id)) : { data: [] };
    const who = new Map(((profs ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));
    const headOffice = hmRows.map((r) => ({ id: r.id, name: who.get(r.profile_id)?.full_name || who.get(r.profile_id)?.email || "—", email: who.get(r.profile_id)?.email ?? null, role: r.role, self: r.profile_id === caller.userId }));
    const { data: inv } = await sb.from("group_invitations").select("id, email, role, invited_at").eq("group_account_id", office.id).is("accepted_at", null).is("cancelled_at", null).order("invited_at");
    return NextResponse.json({ office, viewAs: caller.viewAs, canManage: canManageAccess(office, caller.viewAs), total: members.length, ...table, headOffice, invitations: inv ?? [] });
  } catch (err) {
    console.error("[group/access] failed:", err);
    return NextResponse.json({ error: "Could not read access." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { account?: unknown; urn?: unknown; all?: unknown; on?: unknown } | null;
  if (!body || typeof body.account !== "string" || typeof body.on !== "boolean" || (body.all !== true && (typeof body.urn !== "string" || !/^\d{5,7}$/.test(body.urn)))) return NextResponse.json({ error: "account, on and urn (or all) are required" }, { status: 400 });
  try {
    const caller = await groupCaller(request);
    if (caller instanceof NextResponse) return caller;
    const office = officeFor(caller, body.account);
    if (!office) return NOT_FOUND();
    if (!canManageAccess(office, caller.viewAs)) return NextResponse.json({ error: caller.viewAs ? "View as: read-only" : office.status !== "active" ? "This group account is suspended." : "Only the group's head-office admin can change access." }, { status: 403 });
    const members = await groupMembers(office.groupId);
    const accounts = await schoolAccounts(members.map((m) => m.urn));
    // A school without its own VicData membership has no staff to sign in: no switch, no grant.
    // "Give all schools access": confirmed members with VicData (a likely member is switched on by
    // itself, so its label is read first). "Remove all": every current member.
    const targets = body.all === true ? members.filter((m) => !body.on || (accounts.has(m.urn) && m.confidence === "confirmed")).map((m) => m.urn) : [body.urn as string];
    const sb = createServiceRoleSupabaseClient();
    const results: Record<string, string> = {};
    for (const urn of targets) {
      const ok = grantable(members, urn);
      if (!ok.ok) return NextResponse.json({ error: "That school isn't a current member of the group." }, { status: 409 });
      if (body.on && !accounts.has(urn)) return NextResponse.json({ error: "That school doesn't have its own VicData membership yet." }, { status: 409 });
      const { data, error } = await sb.rpc("group_set_view_grant", { p_actor: caller.userId, p_account: office.id, p_urn: urn, p_on: body.on, p_likely: ok.likely });
      if (error) throw error;
      results[urn] = data as string;
    }
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[group/access] change failed:", err);
    return NextResponse.json({ error: "Could not change access. Try again." }, { status: 502 });
  }
}
