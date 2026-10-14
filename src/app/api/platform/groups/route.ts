import { NextRequest, NextResponse } from "next/server";
import { userFrom } from "@/lib/groups/server";
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
    return NextResponse.json({ groups: hits.slice(0, 20) });
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
