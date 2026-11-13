// VicData 0.8 front door (B8, B12): the Teacher home's figures and the walks' data for one school, phase
// and focus subject -- the dashboard's own rows shaped by src/lib/front-door/teacher-model.ts. The same
// gate as the dashboard route: a member of the school, or a platform admin's View as or peek (read-only).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveCaller } from "@/lib/view-as-server";
import { loadTeacherModel } from "@/lib/front-door/teacher-data";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const urn = q.get("urn");
  const phase = q.get("phase");
  const authHeader = request.headers.get("authorization");
  if (!urn || (phase !== "ks4" && phase !== "ks5") || !authHeader) return NextResponse.json({ error: "urn, phase (ks4 or ks5) and Authorization are required" }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const caller = await resolveCaller(request, urn, { visibleRow: true, supabase, refusal: "Teacher view is available to verified school staff." });
  if (caller instanceof NextResponse) return caller;
  const ticked = (q.get("ticked") ?? "").split("|").filter(Boolean);
  try {
    const model = await loadTeacherModel(supabase, urn, phase, { focusKey: q.get("focus"), ticked, full: q.get("full") === "1", lite: q.get("lite") === "1" });
    return NextResponse.json(model);
  } catch {
    return NextResponse.json({ error: "Could not load this school's figures." }, { status: 502 });
  }
}
