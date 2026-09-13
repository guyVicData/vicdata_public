import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSubjectLevelData, type KsStage } from "@/lib/academic-data-view";

// Academic Results Data View, Round 2 Part C: subject-level entries + KS5
// value-added, for ONE school (the target being viewed, always -- the subject table
// is a single-school view inside Overview, spec §6, not a ticked-set comparison the
// way family level is) -- kept as its own route, not folded into
// /api/data-view/academic-schools, so this heavier per-subject fetch is never made
// for every ticked/added school, only the one whose table is actually showing. Same
// membership gate as every other Data View route.
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const stage = request.nextUrl.searchParams.get("stage") as KsStage | null;
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !stage || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, stage and Authorization are required" }, { status: 400 });
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
    .eq("school_accounts.school_urn", anchorUrn)
    .maybeSingle();

  if (membershipError) {
    console.error("[data-view/academic-subject] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const data = await fetchSubjectLevelData(anchorUrn, stage);
  return NextResponse.json(data);
}
