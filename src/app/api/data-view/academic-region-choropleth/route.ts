import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAcademicRegionChoropleth } from "@/lib/academic-geography-choropleth";
import type { KsStage } from "@/lib/vicdata-reference";

// Academic Results LA/Region choropleth, round 1: the region tier (zoomed-out
// default). Same membership-gate pattern as every other Academic route (an approved
// membership at `urn`, the school being viewed) -- this new standalone "View by
// area" toggle is independent of the ticked/comparator set entirely, but still needs
// a real approved membership to call, same as academic-schools.
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
    console.error("[data-view/academic-region-choropleth] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const entries = await fetchAcademicRegionChoropleth(ksStage as KsStage);
  return NextResponse.json({ entries });
}
