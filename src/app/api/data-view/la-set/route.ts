import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSchoolTypeCategory, buildLaComparatorSet } from "@/lib/default-comparator-lists";
import { genderTag } from "@/lib/typology";

// Member Data View (UX refinements round 1, B3): "allow adding additional/adjacent
// Local Authorities as choices, not limited to a single LA at a time." Given a set
// of LA names (the target's own, plus whichever adjacent ones the member has ticked
// in the new multi-LA picker), returns the same real, phase/gender-filtered school
// list the original single-LA default list already computed -- buildLaComparatorSet
// generalises that exact logic rather than duplicating it.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const lasParam = request.nextUrl.searchParams.get("las");
  const authHeader = request.headers.get("authorization");
  if (!urn || !lasParam || !authHeader) {
    return NextResponse.json({ error: "urn, las and Authorization are required" }, { status: 400 });
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
      { error: "The Data View is available to verified school staff." },
      { status: 403 },
    );
  }

  const resolved = await resolveSchoolTypeCategory(urn);
  if (!resolved) {
    return NextResponse.json({ error: "Could not load this school." }, { status: 404 });
  }
  const laNames = lasParam.split(",").map((s) => s.trim()).filter(Boolean);
  const set = await buildLaComparatorSet(resolved.target, laNames, resolved.targetPhase, genderTag(resolved.target.gender));
  return NextResponse.json({ set });
}
