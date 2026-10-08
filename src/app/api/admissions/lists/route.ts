import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";

// VicData 0.7 admissions r1 (A5): the school's entry points and shared lists (school-level).
//   GET  ?urn                         entry points and every list (RLS: Admissions, SMT, School-Admin,
//                                     share targets)
//   PUT  ?urn  { entryPoints: [...] } replace the school's entry points           (the lead only)
//   PUT  ?urn  { list: {...} }        create or replace one list (entry point, kind, rung) (the lead only)
// Writes go through the caller's own token: the database refuses anyone but the Admissions lead
// (RLS, admissions_lists / admissions_entry_points). Who changed it and when is stamped by the
// database. Before the 0.7 r1 migration is applied, every call says "not set up yet" (503).
const KINDS = new Set(["day_feeders", "boarding_feeders", "rivals", "rung"]);
const URN = /^\d{5,7}$/;
const notSetUp = (msg: string) => /admissions_(lists|entry_points)|does not exist|schema cache/i.test(msg);

async function accountId(caller: { supabase: import("@supabase/supabase-js").SupabaseClient; urn: string }): Promise<string | null> {
  const { data } = await caller.supabase.from("school_accounts").select("id").eq("school_urn", caller.urn).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET(request: NextRequest) {
  const caller = await admissionsCaller(request, request.nextUrl.searchParams.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const acc = await accountId(caller);
  if (!acc) return NextResponse.json({ error: "No school account." }, { status: 404 });
  const [eps, lists] = await Promise.all([
    caller.supabase.from("admissions_entry_points").select("entry_point, sort_order, updated_by, updated_at").eq("school_account_id", acc).order("sort_order"),
    caller.supabase.from("admissions_lists").select("id, entry_point, kind, rung, members, fuzzy, la_blend, confirmed, updated_by, updated_at").eq("school_account_id", acc),
  ]);
  const err = eps.error ?? lists.error;
  if (err) return NextResponse.json({ error: notSetUp(err.message) ? "Admissions lists are not set up yet." : "Could not read the lists." }, { status: notSetUp(err.message) ? 503 : 502 });
  return NextResponse.json({ lead: caller.lead, entryPoints: eps.data, lists: lists.data });
}

type ListBody = { entry_point: string; kind: string; rung?: string; members?: string[]; fuzzy?: Record<string, unknown> | null; la_blend?: Record<string, number> | null; confirmed?: boolean };

export async function PUT(request: NextRequest) {
  const caller = await admissionsCaller(request, request.nextUrl.searchParams.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const body = (await request.json().catch(() => null)) as { entryPoints?: string[]; list?: ListBody } | null;
  const acc = await accountId(caller);
  if (!acc || !body) return NextResponse.json({ error: "A body and a school account are required." }, { status: 400 });
  if (body.entryPoints) {
    const ids = body.entryPoints.map((e) => entryPoint(e)?.id ?? null);
    if (ids.some((x) => x === null) || new Set(ids).size !== ids.length) return NextResponse.json({ error: "entryPoints: 4+, 11+, 16+ or age:2-17, each once" }, { status: 400 });
    const del = await caller.supabase.from("admissions_entry_points").delete().eq("school_account_id", acc).not("entry_point", "in", `(${ids.map((x) => `"${x}"`).join(",")})`);
    const up = await caller.supabase.from("admissions_entry_points").upsert(ids.map((entry_point, sort_order) => ({ school_account_id: acc, entry_point, sort_order })), { onConflict: "school_account_id,entry_point" }).select("entry_point");
    const err = del.error ?? up.error;
    if (err) return NextResponse.json({ error: notSetUp(err.message) ? "Admissions lists are not set up yet." : err.code === "42501" ? "Only the Admissions lead can change this." : "Could not save." }, { status: notSetUp(err.message) ? 503 : err.code === "42501" ? 403 : 502 });
    if ((up.data ?? []).length !== ids.length) return NextResponse.json({ error: "Only the Admissions lead can change this." }, { status: 403 });
    return NextResponse.json({ entryPoints: ids });
  }
  const l = body.list;
  if (!l || !entryPoint(l.entry_point) || !KINDS.has(l.kind) || (l.kind === "rung") !== !!l.rung || (l.rung && !/^age:(\d|1[0-7])$/.test(l.rung)))
    return NextResponse.json({ error: "list: entry_point, kind (day_feeders|boarding_feeders|rivals|rung), rung for kind rung" }, { status: 400 });
  const members = Array.from(new Set(l.members ?? [])).filter((u) => URN.test(u)).slice(0, 500);
  const row = { school_account_id: acc, entry_point: entryPoint(l.entry_point)!.id, kind: l.kind, rung: l.rung ?? "", members, fuzzy: l.fuzzy ?? null, la_blend: l.la_blend ?? null, confirmed: !!l.confirmed };
  const existing = await caller.supabase.from("admissions_lists").select("id").eq("school_account_id", acc).eq("entry_point", row.entry_point).eq("kind", row.kind).eq("rung", row.rung).maybeSingle();
  if (existing.error) return NextResponse.json({ error: notSetUp(existing.error.message) ? "Admissions lists are not set up yet." : "Could not save." }, { status: notSetUp(existing.error.message) ? 503 : 502 });
  const res = existing.data
    ? await caller.supabase.from("admissions_lists").update(row).eq("id", (existing.data as { id: string }).id).select("id, updated_by, updated_at")
    : await caller.supabase.from("admissions_lists").insert(row).select("id, updated_by, updated_at");
  if (res.error) return NextResponse.json({ error: res.error.code === "42501" ? "Only the Admissions lead can change the lists." : "Could not save." }, { status: res.error.code === "42501" ? 403 : 502 });
  if (!res.data?.length) return NextResponse.json({ error: "Only the Admissions lead can change the lists." }, { status: 403 });
  return NextResponse.json({ list: res.data[0] });
}
