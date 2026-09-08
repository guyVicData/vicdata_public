import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTargetRegionNation, fetchRegionNationRank } from "@/lib/region-nation-comparator";

// Member Data View large-set design v1, item 3: Rankings at Region/Nation scale --
// same membership-gate pattern as every other Data View route (region-nation-set,
// schools, boarding-quintile-list), scoped to the school genuinely being viewed
// (`urn`), same as those. Only ever called by RankingsView.tsx once the active
// comparator set is a real Region/Nation-scale one (DataViewShell's own
// LARGE_SET_PROFILE_THRESHOLD) -- for a small/medium set, ranking stays entirely
// client-side over `tickedProfiles`, exactly as before this round.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const scopeParam = request.nextUrl.searchParams.get("scope"); // "region" | "nation"
  const sectorsParam = request.nextUrl.searchParams.get("sectors"); // comma-separated SectorTag values, optional
  const boardingModeParam = request.nextUrl.searchParams.get("boardingMode"); // "boarders" | "day" | "whole", optional
  const genderParam = request.nextUrl.searchParams.get("gender"); // "Girls" | "Boys", optional
  const authHeader = request.headers.get("authorization");
  if (!urn || !scopeParam || !authHeader) {
    return NextResponse.json({ error: "urn, scope and Authorization are required" }, { status: 400 });
  }
  if (scopeParam !== "region" && scopeParam !== "nation") {
    return NextResponse.json({ error: "scope must be 'region' or 'nation'" }, { status: 400 });
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
    console.error("[data-view/region-nation-rank] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const targetRegionNation = await resolveTargetRegionNation(urn);
  if (!targetRegionNation || !targetRegionNation.nation) {
    return NextResponse.json({ rank: null });
  }

  const sectors = sectorsParam ? sectorsParam.split(",").filter(Boolean) : null;
  const rank = await fetchRegionNationRank(
    urn,
    scopeParam === "region" && targetRegionNation.regionCode && targetRegionNation.regionName
      ? { kind: "region", regionCode: targetRegionNation.regionCode, regionName: targetRegionNation.regionName }
      : { kind: "nation", nation: targetRegionNation.nation },
    sectors,
    boardingModeParam,
    genderParam,
  );
  return NextResponse.json({ rank });
}
