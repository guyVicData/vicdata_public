import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAggregateTrends, fetchSectorAggregatesForMany } from "@/lib/aggregate-trends";

// Member Data View large-set design v1, item 5: Graphs' new aggregate-lines chart at
// Region/Nation scale -- national + the target's own ons_region + the target's own
// sector (establishment_type_group), all from roll_aggregates. Same membership-gate
// pattern as every other Data View route.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const startPeriodParam = request.nextUrl.searchParams.get("startPeriod");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
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
    console.error("[data-view/aggregate-trends] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const { data: schoolRow } = await supabase.from("schools").select("establishment_type_group").eq("urn", urn).maybeSingle();
  const startPeriod = startPeriodParam ? parseInt(startPeriodParam, 10) : 2019;

  const trends = await fetchAggregateTrends(urn, schoolRow?.establishment_type_group ?? null, startPeriod);

  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graphs 5/6/10: an
  // optional second payload, only computed when the caller passes `sectors` (the
  // distinct establishment_type_group values present in the currently visible
  // comparator set) -- the existing `trends.sector` above stays exactly what it
  // always was (the TARGET's own single sector, for Section 01's large-set chart),
  // this is additive, not a replacement.
  const sectorsParam = request.nextUrl.searchParams.get("sectors");
  const sectorAggregates = sectorsParam
    ? await fetchSectorAggregatesForMany(
        sectorsParam.split(",").map((s) => s.trim()).filter(Boolean),
        startPeriod,
      )
    : undefined;

  return NextResponse.json({ trends, ...(sectorAggregates ? { sectorAggregates } : {}) });
}
