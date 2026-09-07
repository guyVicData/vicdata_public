import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildBoardingQuintileList } from "@/lib/default-comparator-lists";

// Member Data View (brief §6.1): List 3's boarding-quintile recipe, split into its
// own lazy endpoint -- real, measured at ~41s even after parallelising the batched
// census fetch (see default-comparator-lists.ts's own comment) -- the sidebar's
// initial load (/api/data-view/default-lists) never blocks on this; it's only called
// once a member actually selects the boarding-quintile option.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }
  // 2026-09-08, Compared-with panel round 4: optional ?count, for the Boarding
  // schools button's own "+5 more" control -- defaults to the original 10 when
  // absent, so every existing caller is unaffected.
  const countParam = request.nextUrl.searchParams.get("count");
  const count = countParam ? Math.max(10, parseInt(countParam, 10) || 10) : 10;

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
    console.error("[data-view/boarding-quintile-list] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json(
      { error: "The Data View is available to verified school staff." },
      { status: 403 },
    );
  }

  const list3 = await buildBoardingQuintileList(urn, count);
  return NextResponse.json({ list3 });
}
