import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchNationRegionChoropleth } from "@/lib/la-choropleth";

// Map round (2026-09-12), Part 2 Stage B. Real region-tier choropleth data for
// Nation scope (English regions only -- see fetchNationRegionChoropleth's own
// comment for why Wales isn't part of this tier's output). Same membership-gate
// pattern and query-param shape as region-la-choropleth/route.ts, minus regionCode
// (this tier IS "every region," there's nothing to scope to) and minus urn-based
// region resolution -- this route doesn't need to know the target's own region at
// all, only that the caller is a real, approved member of SOME school (still
// membership-gated on their own target urn, same as every other Data View route).
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const sectorsParam = request.nextUrl.searchParams.get("sectors");
  const phaseBandsParam = request.nextUrl.searchParams.get("phaseBands");
  const boardingModeParam = request.nextUrl.searchParams.get("boardingMode");
  const genderParam = request.nextUrl.searchParams.get("gender");
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
    console.error("[data-view/nation-region-choropleth] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const sectors = sectorsParam ? sectorsParam.split(",").filter(Boolean) : null;
  const phaseBands = phaseBandsParam ? phaseBandsParam.split(",").filter(Boolean) : null;
  const entries = await fetchNationRegionChoropleth(sectors, phaseBands, genderParam, boardingModeParam);
  return NextResponse.json({ entries });
}
