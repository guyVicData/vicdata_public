import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTargetRegionNation } from "@/lib/region-nation-comparator";
import { fetchLaChoropleth } from "@/lib/la-choropleth";

// Map round (2026-09-12), Part 2 Stage A (2c). Real LA-level choropleth data for
// Region scope -- same membership-gate pattern as every other Data View route
// (region-nation-set, region-nation-rank, la-set), same query-param shape as
// region-nation-rank/route.ts (sectors/boardingMode/gender), plus phaseBands (new
// here -- region_nation_rank() deliberately never replicated phase/age slicing in
// SQL, this function does, see region_nation_la_rollup()'s own migration comment).
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const sectorsParam = request.nextUrl.searchParams.get("sectors"); // comma-separated SectorTag values, optional
  const phaseBandsParam = request.nextUrl.searchParams.get("phaseBands"); // comma-separated PhaseBandKey values, optional
  const boardingModeParam = request.nextUrl.searchParams.get("boardingMode"); // "boarders" | "day" | "whole", optional
  const genderParam = request.nextUrl.searchParams.get("gender"); // "Girls" | "Boys", optional
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }
  if (boardingModeParam !== null && boardingModeParam !== "boarders" && boardingModeParam !== "day" && boardingModeParam !== "whole") {
    return NextResponse.json({ error: "boardingMode must be 'boarders', 'day' or 'whole'" }, { status: 400 });
  }
  if (genderParam !== null && genderParam !== "Girls" && genderParam !== "Boys") {
    return NextResponse.json({ error: "gender must be 'Girls' or 'Boys'" }, { status: 400 });
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
    console.error("[data-view/region-la-choropleth] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  // Region-scope only, per Stage A's own explicit scope -- the target's own real
  // region membership, resolved server-side exactly like region-nation-set/rank
  // already do, never a client-supplied region code (a member has no legitimate
  // reason to ask for a choropleth over a region their own target school isn't in).
  const targetRegionNation = await resolveTargetRegionNation(urn);
  if (!targetRegionNation || !targetRegionNation.regionCode) {
    return NextResponse.json({ entries: [] });
  }

  const sectors = sectorsParam ? sectorsParam.split(",").filter(Boolean) : null;
  const phaseBands = phaseBandsParam ? phaseBandsParam.split(",").filter(Boolean) : null;
  const entries = await fetchLaChoropleth(targetRegionNation.regionCode, sectors, phaseBands, genderParam, boardingModeParam);
  return NextResponse.json({ entries });
}
