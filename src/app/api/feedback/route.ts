import { NextRequest, NextResponse } from "next/server";
import { userFrom } from "@/lib/groups/server";
import { appVersion, feedbackAllowed, feedbackMissing, feedbackRow } from "@/lib/feedback-server";

// VicData 0.8 notes and feedback (decision 4): the author's side. GET: may this person give feedback
// (the audience setting, read by the database), and their own items, for the icons' colours and the
// popover's list. POST: one new item, through the caller's own session, so RLS decides
// (feedback_items_insert_allowed: the setting allows them, and the author is them). Never usage.
export async function GET(request: NextRequest) {
  const u = await userFrom(request);
  if (u instanceof NextResponse) return u;
  try {
    const allowed = await feedbackAllowed(u.supabase);
    if (!allowed) return NextResponse.json({ allowed: false, items: [] });
    // Only the caller's own: a platform admin's RLS would return everyone's.
    const { data, error } = await u.supabase
      .from("feedback_items")
      .select("id, number, created_at, view_key, school_urn, school_name, group_id, group_name, status, looks_good, kinds, body")
      .eq("author_id", u.userId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      if (feedbackMissing(error)) return NextResponse.json({ allowed: false, items: [] });
      throw error;
    }
    const items = ((data ?? []) as { body: string }[]).map(({ body, ...r }) => ({ ...r, has_text: body.trim().length > 0, excerpt: body.trim().slice(0, 140) }));
    return NextResponse.json({ allowed: true, items });
  } catch (err) {
    console.error("[feedback] read failed:", err);
    return NextResponse.json({ error: "Could not read your feedback." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const u = await userFrom(request);
  if (u instanceof NextResponse) return u;
  const built = feedbackRow(await request.json().catch(() => null), appVersion());
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });
  try {
    const { data, error } = await u.supabase.from("feedback_items").insert({ ...built.row, author_id: u.userId }).select("id, number, created_at, status").single();
    if (error) {
      if (feedbackMissing(error)) return NextResponse.json({ error: "Feedback needs the database update (20261117100000_v08_feedback)." }, { status: 503 });
      if (error.code === "42501" || /row-level security/i.test(error.message)) return NextResponse.json({ error: "Feedback isn't open to you yet." }, { status: 403 });
      throw error;
    }
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("[feedback] send failed:", err);
    return NextResponse.json({ error: "Could not send your feedback. Try again." }, { status: 502 });
  }
}
