import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSchoolTypeCategory } from "@/lib/default-comparator-lists";
import { resolveTargetRegionNation, buildRegionOrNationComparatorSet } from "@/lib/region-nation-comparator";

// Member Data View performance architecture v1, §5: brings the previously-disabled
// Region ("London schools") and Nation ("England schools") comparator buttons live,
// backed entirely by the precomputed school_region_nation table (indexed
// region_code/nation lookups) -- no live cross-school computation, matching every
// other Data View route's membership-gate pattern exactly.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const scopeParam = request.nextUrl.searchParams.get("scope"); // "region" | "nation"
  const authHeader = request.headers.get("authorization");
  if (!urn || !scopeParam || !authHeader) {
    return NextResponse.json({ error: "urn, scope and Authorization are required" }, { status: 400 });
  }
  if (scopeParam !== "region" && scopeParam !== "nation") {
    return NextResponse.json({ error: "scope must be 'region' or 'nation'" }, { status: 400 });
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

  // See default-lists/route.ts -- same discarded-query-error bug class, fixed the
  // same way across every Data View route as part of this fix.
  if (membershipError) {
    console.error("[data-view/region-nation-set] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const resolved = await resolveSchoolTypeCategory(urn);
  if (!resolved) {
    return NextResponse.json({ error: "Could not load this school." }, { status: 404 });
  }

  const targetRegionNation = await resolveTargetRegionNation(urn);
  if (!targetRegionNation || !targetRegionNation.nation) {
    // Precomputed row missing (recompute hasn't run yet) or a genuine non-standard LA
    // (BFPO/overseas -- see region-crosswalk.ts) -- either way, there's no real
    // region/nation membership to build a set from.
    return NextResponse.json({ rows: null });
  }

  // Payload-cleanup round (2026-09-09): returns the raw positional rows straight
  // through, no server-side re-keying into a DefaultList + RegionNationPoint[] pair --
  // see buildRegionOrNationComparatorSet's own comment for the real payload
  // regression this fixes (26.96MB re-keyed vs. 11.98MB raw, Nation scope). The
  // client (DataViewShell.tsx) unpacks these tuples itself into whatever shapes
  // MapView/SetOption actually need.
  const { key, label, rows } = await buildRegionOrNationComparatorSet(
    { urn, easting: resolved.target.easting, northing: resolved.target.northing },
    scopeParam === "region" && targetRegionNation.regionCode && targetRegionNation.regionName
      ? { kind: "region", regionCode: targetRegionNation.regionCode, regionName: targetRegionNation.regionName }
      : { kind: "nation", nation: targetRegionNation.nation },
  );
  return NextResponse.json({ key, label, rows });
}
