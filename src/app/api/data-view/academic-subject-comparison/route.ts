import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSubjectLevelDataForSchools, fetchSubjectHeadlineForSchools, type KsStage } from "@/lib/academic-data-view";

// Subject deep-dive round, Part 1: the batched comparator-set sibling of
// /api/data-view/academic-subject -- same membership-gate pattern as
// /api/data-view/academic-schools (an approved membership at `anchorUrn`, the school
// being VIEWED; comparator schools need no separate membership). Two real sources in
// one round trip: the raw-fact batched fetch (entries/KS5 value-added/grade
// distribution -- fetchSubjectLevelDataForSchools) and vicdata's new multi-period
// subject headline rollup (fetchSubjectHeadlineForSchools) -- SubjectAreaSection.tsx's
// own comparison-set computations need both together (entries/value-added/grade
// profile from the first, real avg-point-score and a genuine 2020/21+ trend from the
// second), so one route serving both avoids two separate round trips for what one
// user action (opening subject-mode comparison, or the deep-dive drawer) always
// needs at once.
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const urnsParam = request.nextUrl.searchParams.get("urns");
  const stage = request.nextUrl.searchParams.get("stage") as KsStage | null;
  const familyId = request.nextUrl.searchParams.get("familyId");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !urnsParam || !stage || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, urns, stage and Authorization are required" }, { status: 400 });
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
    console.error("[data-view/academic-subject-comparison] membership check failed:", membershipError);
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

  // Sequential, not Promise.all, deliberately -- and this is the second half of the
  // 2026-09-17 timeout fix, not a style preference.
  //
  // These two lookups hit the same database, and both are heavy for a real
  // comparison set. Run concurrently they contend, and the headline lookup crosses
  // that database's statement timeout and fails with Postgres 57014: a 25-school
  // headline chunk that takes ~90ms on its own still timed out here purely because
  // the raw-fact lookup was in flight beside it. Chunking the headline lookup alone
  // (see lookupAcademicSubjectHeadline) was not enough while this Promise.all
  // remained.
  //
  // The cost of serialising is small and bounded -- the raw-fact lookup is the fast
  // one -- and a request that takes slightly longer is strictly better than one that
  // returns a 500 the UI reads as "no data".
  const { byUrn: subjectByUrn } = await fetchSubjectLevelDataForSchools(urns, stage);
  const headlineByUrnMap = await fetchSubjectHeadlineForSchools(urns, stage, familyId ?? undefined, stage === "ks5" ? null : undefined);

  return NextResponse.json({
    subjectByUrn: Object.fromEntries(subjectByUrn),
    headlineByUrn: Object.fromEntries(headlineByUrnMap),
  });
}
