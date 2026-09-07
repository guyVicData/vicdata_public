import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchDataViewProfiles } from "@/lib/data-view-profiles";
import { serializeProfile } from "@/lib/data-view-serialize";

// Member Data View (brief §4-§8): the shared per-school data fetch behind Map/
// Dashboard/Rankings alike -- one endpoint, one gate, so the three views can never
// silently see different data for the same URNs. Gated exactly like /api/paid-trends
// (an approved membership at the URN being VIEWED, i.e. `anchorUrn` -- the whole Data
// View is paid-member content as a unit, brief §1/§4, not per-school-in-the-set
// membership; a member can look at OTHER schools' figures as part of their own
// comparator set without separately being a member at each of them, same as the
// existing /api/comparator-set-peers route already allows for saved sets).
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const urnsParam = request.nextUrl.searchParams.get("urns");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !urnsParam || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, urns and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // Same ambiguous-embed fix as /api/paid-trends -- school_memberships<->
  // school_accounts has three FK relationships, PostgREST needs the explicit hint.
  const { data: approvedMembership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", anchorUrn)
    .maybeSingle();

  // Real bug found live while verifying the Compared-with panel round 4-6 boarding
  // recipe: a discarded query error here looked identical to "not a member" (the
  // exact bug class DataViewShell.tsx's own membership check was already fixed for,
  // 2026-09-05 comment there). Reproduced live -- after a slow ~36s boarding-quintile
  // load plus concurrent adjacent-las calls, this exact route 403'd for a genuinely
  // approved member on the very next request, for the same anchorUrn a moment-earlier
  // request had already succeeded for. Fixed the same way across every Data View
  // route (this file, default-lists, la-set, expand-nearest, boarding-quintile-list,
  // adjacent-las).
  if (membershipError) {
    console.error("[data-view/schools] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json(
      { error: "The Data View is available to verified school staff." },
      { status: 403 },
    );
  }

  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter(Boolean)));
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);
  if (urns.length === 0) {
    return NextResponse.json({ error: "no urns requested" }, { status: 400 });
  }

  const profiles = await fetchDataViewProfiles(urns);
  return NextResponse.json({ profiles: profiles.map(serializeProfile) });
}
