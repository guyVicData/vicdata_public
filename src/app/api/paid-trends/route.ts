import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookupReferenceData } from "@/lib/vicdata-reference";
import { buildRollTrend } from "@/lib/roll-data";
import { estimateMarketShare } from "@/lib/market-share";

// Paid-tier data (rolls spec §2/§3: school-specific + trend-over-time is the one paid
// quadrant): roll/shape/gender/boarding trend line, and market share for both entry
// points. Gated behind an approved membership at THIS school specifically -- the
// user's own Supabase access token is passed through and checked against RLS
// (school_memberships' own policies), not re-implemented here as a parallel check.
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

  // school_memberships<->school_accounts has three FK relationships (the account-holder
  // and pending-handoff FKs on school_accounts point back to school_memberships too),
  // so PostgREST can't infer which one without an explicit hint (confirmed for real --
  // the unqualified embed returns PGRST201 "more than one relationship was found," which
  // silently produced null data and a false 403 for a genuinely approved member before
  // this was pinned down).
  const { data: approvedMembership } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();

  if (!approvedMembership) {
    return NextResponse.json(
      { error: "Detailed roll history is available to verified school staff." },
      { status: 403 },
    );
  }

  const [censusFacts, marketShareY7, marketShareSixthForm] = await Promise.all([
    lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] }),
    estimateMarketShare(urn, "y7"),
    estimateMarketShare(urn, "sixth_form"),
  ]);

  const trend = buildRollTrend(censusFacts, urn);

  return NextResponse.json({ trend, marketShareY7, marketShareSixthForm });
}
