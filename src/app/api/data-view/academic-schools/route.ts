import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAcademicProfiles, serializeAcademicProfile } from "@/lib/academic-data-view";

// Academic Results Data View tab (frontend build brief, Part B): the batched
// per-school data fetch behind AcademicMapView/AcademicGraphsView/AcademicRankingsView
// -- same shape and same membership gate as /api/data-view/schools (an approved
// membership at `anchorUrn`, the school being VIEWED -- comparator-set schools don't
// need their own separate membership, same convention that route's own comment
// documents).
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

  const { data: approvedMembership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", anchorUrn)
    .maybeSingle();

  if (membershipError) {
    console.error("[data-view/academic-schools] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }

  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter(Boolean)));
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);
  if (urns.length === 0) {
    return NextResponse.json({ error: "no urns requested" }, { status: 400 });
  }

  const profiles = await fetchAcademicProfiles(urns);
  return NextResponse.json({ profiles: profiles.map(serializeAcademicProfile) });
}
