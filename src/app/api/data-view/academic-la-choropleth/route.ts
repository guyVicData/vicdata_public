import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAcademicLaChoropleth } from "@/lib/academic-geography-choropleth";
import type { KsStage } from "@/lib/vicdata-reference";

// Academic Results LA/Region choropleth, round 1: the LA tier (zoomed in). Same
// membership-gate pattern as every other Academic route. Deliberately no `regionCode`
// param, unlike Rolls' own region-la-choropleth route -- Academic has no per-region
// comparator SET to scope by this round (a standalone toggle, not a Region/Nation-
// scale set), and the whole real LA-level data set is only ~153 rows nationally, so
// this always returns every real LA the aggregate has data for; the map's own
// zoom-driven tier switch (client-side, see AcademicMapView.tsx) decides which of
// the already-fetched region/LA tiers to actually draw, not a second server round-trip
// per region zoomed into.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const ksStage = request.nextUrl.searchParams.get("ksStage");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }
  if (ksStage !== "ks4" && ksStage !== "ks5") {
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
    console.error("[data-view/academic-la-choropleth] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const entries = await fetchAcademicLaChoropleth(ksStage as KsStage);
  return NextResponse.json({ entries });
}
