import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSchoolTypeCategory } from "@/lib/default-comparator-lists";
import { adjacentLaCandidates } from "@/lib/la-comparator-picker";

// Member Data View (UX refinements round 1, B3): candidate LAs for the "Compared
// with" multi-LA picker's "Select all" list -- the target's own LA (always first,
// pre-selected) plus real nearby LAs derived from the target's own nearest schools
// (see la-comparator-picker.ts's own comment for why this is the honest choice
// absent a real geographic-adjacency dataset).
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
      { error: "The Data View is available to verified school staff." },
      { status: 403 },
    );
  }

  const resolved = await resolveSchoolTypeCategory(urn);
  if (!resolved || !resolved.target.la_name) {
    return NextResponse.json({ ownLaName: null, adjacent: [] });
  }
  const adjacent = await adjacentLaCandidates(urn, resolved.target.la_name);
  return NextResponse.json({ ownLaName: resolved.target.la_name, adjacent });
}
