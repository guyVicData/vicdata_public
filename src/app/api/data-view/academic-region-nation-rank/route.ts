import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTargetRegionNation } from "@/lib/region-nation-comparator";
import { fetchAcademicRegionNationRank } from "@/lib/academic-region-nation-rank";
import type { KsStage } from "@/lib/vicdata-reference";

// Academic Results round 2: Rankings at Region/Nation scale -- same membership-gate
// pattern as every other Data View route, and the same shape as
// /api/data-view/region-nation-rank/route.ts (scope resolved server-side via
// resolveTargetRegionNation, reused directly rather than re-derived -- see
// academic-region-nation-rank.ts's own header comment for why that's safe to share
// across topics). Only ever called by AcademicDataView once the active comparator set
// is a real Region/Nation-scale one (DataViewShell's own LARGE_SET_PROFILE_THRESHOLD,
// same gate Rolls' own large-set path uses) -- for a small/medium set, AcademicRankingsView
// stays entirely client-side over its own ticked group, exactly as before this round.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const scopeParam = request.nextUrl.searchParams.get("scope"); // "region" | "nation"
  const ksStageParam = request.nextUrl.searchParams.get("ksStage"); // "ks4" | "ks5"
  const authHeader = request.headers.get("authorization");
  if (!urn || !scopeParam || !ksStageParam || !authHeader) {
    return NextResponse.json({ error: "urn, scope, ksStage and Authorization are required" }, { status: 400 });
  }
  if (scopeParam !== "region" && scopeParam !== "nation") {
    return NextResponse.json({ error: "scope must be 'region' or 'nation'" }, { status: 400 });
  }
  if (ksStageParam !== "ks4" && ksStageParam !== "ks5") {
    return NextResponse.json({ error: "ksStage must be 'ks4' or 'ks5' -- academic_headline_snapshot has no real KS2 data" }, { status: 400 });
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
    console.error("[data-view/academic-region-nation-rank] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const targetRegionNation = await resolveTargetRegionNation(urn);
  if (!targetRegionNation || !targetRegionNation.nation) {
    return NextResponse.json({ rank: null });
  }

  const scope =
    scopeParam === "region" && targetRegionNation.regionCode && targetRegionNation.regionName
      ? ({ kind: "region", regionCode: targetRegionNation.regionCode, regionName: targetRegionNation.regionName } as const)
      : ({ kind: "nation", nation: targetRegionNation.nation } as const);

  const rank = await fetchAcademicRegionNationRank(urn, ksStageParam as KsStage, scope);
  // Real bug found live (Guy, 2026-09-14): the Map needs to know the target's own
  // resolved region NAME too (to default the choropleth straight to that region's own
  // LAs instead of the national overview) -- this route already resolves it above for
  // the ranking's own scope object, so surfacing it costs nothing extra rather than a
  // second resolveTargetRegionNation round-trip elsewhere. Null for Nation scope.
  return NextResponse.json({ rank, regionName: scope.kind === "region" ? scope.regionName : null });
}
