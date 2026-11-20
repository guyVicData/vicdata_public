import { resolveCaller } from "@/lib/view-as-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { KsStage } from "@/lib/academic-data-view";
import { tracedFetch } from "@/lib/build-trace";
import { cachedResult, resultKey } from "@/lib/results-cache";
import { buildTeacherDashboard } from "@/lib/teacher-dashboard-data";

// Teacher view dashboard data (design brief v2 §5's four questions). The builder is
// src/lib/teacher-dashboard-data.ts. Speed plan §4.2 item 2: the answer depends only on the school and
// the phase (public data), so after the caller check it is kept in the shared results cache.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const phase = request.nextUrl.searchParams.get("phase") as KsStage | null;
  const authHeader = request.headers.get("authorization");
  if (!urn || !phase || !authHeader) {
    return NextResponse.json({ error: "urn, phase and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader }, fetch: tracedFetch }, auth: { persistSession: false } },
  );

  // 0.8 View as: the one caller helper (src/lib/view-as-server.ts) -- a member of this school (the
  // query this route always made), a platform admin's View as or peek, read-only.
  const caller = await resolveCaller(request, urn, { visibleRow: true, supabase, refusal: "Teacher view is available to verified school staff." });
  if (caller instanceof NextResponse) return caller;

  return NextResponse.json(await cachedResult(resultKey("teacher/dashboard", urn, { phase }), () => buildTeacherDashboard(supabase, urn, phase)));
}
