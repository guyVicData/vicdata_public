import { NextRequest, NextResponse } from "next/server";
import { userFrom } from "@/lib/groups/server";
import { isPlatformAdmin } from "@/lib/view-as";
import { feedbackMissing, triagePatch } from "@/lib/feedback-server";
import { parseFeedbackNumber } from "@/lib/view-ref";

// VicData 0.8 notes and feedback (decision 4): the inbox's side, platform admins only (anyone else:
// "not found", as the Platform page itself). Through the caller's own session, so the database's RLS
// and its triage guard (only the triage fields change) decide as well.
//   GET   ?number=F-12          one item (the Open banner)
//   GET   ?coverage=1           feedback_coverage
//   GET   (filters)             feedback_for_triage, newest first: status, type, priority, product,
//                               dashboard, school (URN or group id), author (profile id), q (text)
//   PATCH { ids: [...], ...triage fields }   one item or many (bulk status changes)
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
const LIST = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) : []);

export async function GET(request: NextRequest) {
  const u = await userFrom(request);
  if (u instanceof NextResponse || !(await isPlatformAdmin(u.supabase))) return notFound();
  const sp = request.nextUrl.searchParams;
  try {
    if (sp.get("coverage") === "1") {
      const { data, error } = await u.supabase.from("feedback_coverage").select("*").order("dashboard_id").limit(5000);
      if (error) {
        if (feedbackMissing(error)) return NextResponse.json({ missing: true, rows: [] });
        throw error;
      }
      return NextResponse.json({ rows: data ?? [] });
    }
    let query = u.supabase.from("feedback_for_triage").select("*").order("created_at", { ascending: false }).limit(1000);
    const number = parseFeedbackNumber(sp.get("number"));
    if (number !== null) query = query.eq("number", number);
    const filters: [string, string][] = [["status", "status"], ["type", "type"], ["priority", "priority"], ["product", "product"], ["dashboard", "dashboard_id"]];
    for (const [param, col] of filters) {
      const v = LIST(sp.get(param));
      if (v.length) query = query.in(col, v);
    }
    const school = sp.get("school");
    if (school) query = query.or(`school_urn.eq.${school.replace(/[^A-Za-z0-9:_-]/g, "")},group_id.eq.${school.replace(/[^A-Za-z0-9:_-]/g, "")}`);
    const author = sp.get("author");
    if (author && /^[0-9a-f-]{36}$/i.test(author)) query = query.eq("author_id", author);
    if (sp.get("looksGood") === "hide") query = query.eq("is_open", true);
    const { data, error } = await query;
    if (error) {
      if (feedbackMissing(error)) return NextResponse.json({ missing: true, items: [] });
      throw error;
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error("[platform/feedback] read failed:", err);
    return NextResponse.json({ error: "Could not read the feedback." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const u = await userFrom(request);
  if (u instanceof NextResponse || !(await isPlatformAdmin(u.supabase))) return notFound();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: "Which items?" }, { status: 400 });
  const built = triagePatch(body);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });
  if (typeof built.patch.duplicate_of === "string" && ids.includes(built.patch.duplicate_of)) return NextResponse.json({ error: "An item can't be a duplicate of itself." }, { status: 400 });
  try {
    const { data, error } = await u.supabase.from("feedback_items").update(built.patch).in("id", ids).select("id, number, status");
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: error.message }, { status: 403 });
      throw error;
    }
    return NextResponse.json({ updated: data ?? [] });
  } catch (err) {
    console.error("[platform/feedback] triage failed:", err);
    return NextResponse.json({ error: "Could not save the triage." }, { status: 502 });
  }
}
