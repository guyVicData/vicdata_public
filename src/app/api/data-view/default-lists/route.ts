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

  const { data: approvedMembership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();

  // A discarded query error here previously looked identical to "not a member" --
  // same bug class already fixed in DataViewShell.tsx's own membership check
  // (2026-09-05 comment there), found live while verifying the Compared-with panel
  // round 4-6 work: a transient PostgREST error under load surfaced to the user as
  // "The Data View is available to verified school staff" for a genuine member.
  if (membershipError) {
    console.error("[data-view/default-lists] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json(
      { error: "The Data View is available to verified school staff." },
      { status: 403 },
    );
  }

  const lists = await buildDefaultComparatorLists(urn);
  return NextResponse.json(lists);
}
