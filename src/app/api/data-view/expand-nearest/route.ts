import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSchoolTypeCategory } from "@/lib/default-comparator-lists";
import { findSurroundingSchools } from "@/lib/surrounding-schools";
import { findNearestFeColleges } from "@/lib/surrounding-fe-colleges";
import { CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";

// Member Data View (UX refinements round 1, B3): "for the Nearest 10 default set,
// add a button to expand it by 5 more schools at a time (Nearest 15, Nearest 20,
// ...)." Re-runs the SAME real matching pipeline (findSurroundingSchools /
// findNearestFeColleges, whichever the target's own schoolTypeCategory uses for its
// own List 1) with a wider targetCount, rather than a separate "load 5 more and
// append" mechanism -- keeps the result consistent with List 1's own real ordering
// (nearest-first) at every size, not just the first 10.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const countParam = request.nextUrl.searchParams.get("count");
  const authHeader = request.headers.get("authorization");
  const count = Number(countParam);
  if (!urn || !countParam || !Number.isFinite(count) || count <= 0 || !authHeader) {
    return NextResponse.json({ error: "urn, a positive count, and Authorization are required" }, { status: 400 });
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
    console.error("[data-view/expand-nearest] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json(
      { error: "The Data View is available to verified school staff." },
      { status: 403 },
    );
  }

  const resolved = await resolveSchoolTypeCategory(urn);
  if (!resolved) {
    return NextResponse.json({ error: "Could not load this school." }, { status: 404 });
  }

  if (resolved.schoolTypeCategory === "fe_college") {
    const colleges = await findNearestFeColleges(urn, count);
    return NextResponse.json({
      list: { key: "fe_nearest_10", label: `Nearest ${colleges.length} FE colleges`, schools: colleges.map((c) => ({ urn: c.urn, name: c.name, distanceKm: c.distanceKm })) },
    });
  }

  const matched = await findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { genderMode: "relaxed", targetCount: count });
  const target = resolved.target;
  const schools = matched.map((m) => ({
    urn: m.urn,
    name: m.currentName,
    distanceKm: target.easting !== null && target.northing !== null && m.easting !== null && m.northing !== null
      ? Math.sqrt((m.easting - target.easting) ** 2 + (m.northing - target.northing) ** 2) / 1000
      : null,
  }));
  return NextResponse.json({ list: { key: "nearest_10", label: `Nearest ${schools.length} (any LA)`, schools } });
}
