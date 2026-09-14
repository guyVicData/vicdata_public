import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAcademicAggregateTrends } from "@/lib/academic-aggregate-trends";
import type { KsStage } from "@/lib/vicdata-reference";

// Academic Results round 2: Graphs' own aggregate-lines equivalent at Region/Nation
// scale -- national + the target's own region, from academic_geography_aggregate (see
// academic-aggregate-trends.ts's own header comment for why there's no sector line).
// Same membership-gate pattern as every other Data View route.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const ksStageParam = request.nextUrl.searchParams.get("ksStage");
  const startPeriodParam = request.nextUrl.searchParams.get("startPeriod");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }
  if (ksStageParam !== "ks4" && ksStageParam !== "ks5") {
    return NextResponse.json({ error: "ksStage must be 'ks4' or 'ks5' -- academic_geography_aggregate has no real KS2 data" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: approvedMembership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();

  if (membershipError) {
    console.error("[data-view/academic-aggregate-trends] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const startPeriod = startPeriodParam ? parseInt(startPeriodParam, 10) : 2019;
  const trends = await fetchAcademicAggregateTrends(urn, ksStageParam as KsStage, startPeriod);
  return NextResponse.json({ trends });
}
