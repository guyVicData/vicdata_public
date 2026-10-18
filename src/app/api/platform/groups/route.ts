import { NextRequest, NextResponse } from "next/server";
import { isMissing, userFrom } from "@/lib/groups/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { groupIndex, groupMembers } from "@/lib/groups/production";
import { isPlatformAdmin } from "@/lib/view-as";

// VicData 0.8 groups r1 (G5): the Platform page's group search and account creation, platform admins
// only (anyone else: "not found", as the Platform page itself). GET ?q= searches every group with a
// current member by name or id (type, source, school count). POST { groupId } creates the account
// through platform_create_group_account (which re-checks platform admin and audits), once the group
// is confirmed to exist in production.
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

export async function GET(request: NextRequest) {
  try {
    const u = await userFrom(request);
    if (u instanceof NextResponse || !(await isPlatformAdmin(u.supabase))) return notFound();
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    if (q.length < 2) return NextResponse.json({ groups: [] });
    const idx = await groupIndex();
    const hits = idx.filter((g) => g.groupId.toLowerCase() === q || g.groupId.toLowerCase().includes(q) || g.name.toLowerCase().includes(q));
    hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || b.schools - a.schools);
    const top = hits.slice(0, 20);
    // 0.8 View as fixes: each group's account where it has one (the View as switcher opens that; a group
    // without one opens read-only from the group lookups). Platform's own search ignores the extra fields.
    const accounts = new Map<string, { id: string; status: string }>();
    if (top.length) {
      const { data, error } = await createServiceRoleSupabaseClient().from("group_accounts").select("id, group_id, status").eq("preview", false).in("group_id", top.map((g) => g.groupId));
      if (error && !isMissing(error)) throw error;
      for (const a of (data ?? []) as { id: string; group_id: string; status: string }[]) accounts.set(a.group_id, { id: a.id, status: a.status });
    }
    return NextResponse.json({ groups: top.map((g) => ({ ...g, accountId: accounts.get(g.groupId)?.id ?? null, status: accounts.get(g.groupId)?.status ?? null })) });
  } catch (err) {
    console.error("[platform/groups] search failed:", err);
    return NextResponse.json({ error: "Could not search groups." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { groupId?: unknown } | null;
  if (!body || typeof body.groupId !== "string" || !/^[A-Za-z0-9_:.-]{1,80}$/.test(body.groupId)) return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  try {
    const u = await userFrom(request);
    if (u instanceof NextResponse || !(await isPlatformAdmin(u.supabase))) return notFound();
    const members = await groupMembers(body.groupId);
    const entry = (await groupIndex()).find((g) => g.groupId === body.groupId);
    if (!members.length) return NextResponse.json({ error: "No current member schools for that group in VicData." }, { status: 409 });
    const { data, error } = await u.supabase.rpc("platform_create_group_account", { p_group_id: body.groupId, p_display_name: entry?.name ?? body.groupId });
    if (error) return NextResponse.json({ error: error.message }, { status: /already/.test(error.message) ? 409 : 502 });
    return NextResponse.json({ id: data });
  } catch (err) {
    console.error("[platform/groups] create failed:", err);
    return NextResponse.json({ error: "Could not create the group account." }, { status: 502 });
  }
}
