import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findSurroundingSchools } from "@/lib/surrounding-schools";
import { computeTypology } from "@/lib/typology";
import { buildRollSnapshot, CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";
import { lookupReferenceData } from "@/lib/vicdata-reference";

// Member-tier named surrounding-schools list (chart palette doc, "Public View
// rebuild"): the tagged, named version of the free-tier aggregate summary --
// "verification, not just scanning," a member should be able to see the 10 schools'
// tags and visually confirm the aggregate is genuinely like-with-like. Gated behind
// an approved membership at THIS school specifically, same pattern as
// /api/paid-trends (the user's own access token passed through and checked against
// school_memberships' RLS, not re-implemented here as a parallel check).
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: approvedMembership } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();

  if (!approvedMembership) {
    return NextResponse.json(
      { error: "The named surrounding-schools list is available to verified school staff." },
      { status: 403 },
    );
  }

  const targetFacts = await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] });
  const targetRoll = buildRollSnapshot(targetFacts, urn);
  const period = targetRoll?.period ?? CURRENT_CENSUS_PERIOD;

  const matched = await findSurroundingSchools(urn, period);

  const schools = matched.map((m) => ({
    urn: m.urn,
    currentName: m.currentName,
    town: m.town,
    postcode: m.postcode,
    totalRoll: m.totalRoll,
    easting: m.easting,
    northing: m.northing,
    typology: computeTypology(
      {
        establishment_type_group: m.establishmentTypeGroup,
        // findSurroundingSchools' own candidates are already restricted to the
        // mainstream sector groups (nearest_schools' own filter -- Guy did not ask to
        // extend surrounding-schools matching to FE institutions, only the map's
        // bounds query) -- null is always safe/correct here, this population can
        // never actually resolve to the "FE" sector.
        establishment_type: null,
        boarders_name: m.boardersName,
        statutory_low_age: m.statutoryLowAge,
        statutory_high_age: m.statutoryHighAge,
        gender: m.gender,
      },
      m.boarding,
    ),
  }));

  return NextResponse.json({ schools });
}
