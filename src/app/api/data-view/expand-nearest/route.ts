import { resolveCaller } from "@/lib/view-as-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSchoolTypeCategory, withKs5Results } from "@/lib/default-comparator-lists";
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

  // 0.8 View as: the one caller helper (src/lib/view-as-server.ts) -- a member of this school (the
  // query this route always made), a platform admin's View as or peek, read-only.
  const caller = await resolveCaller(request, urn, { visibleRow: true, supabase, refusal: "The Data View is available to verified school staff." });
  if (caller instanceof NextResponse) return caller;

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

  // 0.6.5 S4: post16=1 (the Teacher chooser's Post-16 stepper only) keeps the same rules and
  // adds the Post-16 provision filter; the Data View never sends it.
  const post16 = request.nextUrl.searchParams.get("post16") === "1";
  const matched = await findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { genderMode: "relaxed", targetCount: count, ...(post16 ? { extraFilterUrns: withKs5Results, filterBeforeFacts: true } : {}) });
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
