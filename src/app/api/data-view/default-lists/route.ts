import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDefaultComparatorLists } from "@/lib/default-comparator-lists";

// Member Data View (brief §6): default comparator-list generation for the school
// being viewed. Same gate as /api/data-view/schools and /api/paid-trends -- an
// approved membership at the URN this Data View is FOR.
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

  const lists = await buildDefaultComparatorLists(urn);
  return NextResponse.json(lists);
}
