import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchSubjectLevelDataForSchools,
  fetchSubjectHeadlineForSchools,
  fetchAcademicProfiles,
  HEADLINE_AGE,
  populationAtAge,
  type KsStage,
} from "@/lib/academic-data-view";

// Teacher view dashboard data (design brief v2 §5's four questions).
//
// One round trip for a dashboard, reusing the same fetchers the advanced view already
// uses rather than a parallel set that could drift. Serialised rather than Promise.all
// for the same reason the subject-comparison route is: these two lookups contend, and
// running them together is what produced a real statement timeout before.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const phase = request.nextUrl.searchParams.get("phase") as KsStage | null;
  const authHeader = request.headers.get("authorization");
  if (!urn || !phase || !authHeader) {
    return NextResponse.json({ error: "urn, phase and Authorization are required" }, { status: 400 });
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
  if (membershipError) {
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });
  }

  // §5: KS2's "how many" question is the Year 6 cohort from roll data, NOT exam entries --
  // every pupil sits the same fixed tests, so there is no entries concept. Reuses
  // populationAtAge(profile, HEADLINE_AGE.ks2), which resolves age 10 from the age
  // breakdown; the census also carries a `year_group_10` field, which is the GCSE year and
  // would silently put a secondary cohort on a primary card (Q6).
  if (phase === "ks2") {
    const profiles = await fetchAcademicProfiles([urn], { includePopulation: true });
    const profile = profiles.find((p) => p.urn === urn) ?? null;
    return NextResponse.json({
      phase,
      rollAtAge10: profile ? populationAtAge(profile, HEADLINE_AGE.ks2) : null,
      subjects: [],
      headlineByUrn: {},
    });
  }

  const { byUrn } = await fetchSubjectLevelDataForSchools([urn], phase);
  // Every bucket at KS5, so a subject row can take the points belonging to its own
  // qualification rather than the whole-school 'all' row.
  const headlineByUrn = await fetchSubjectHeadlineForSchools([urn], phase, undefined, phase === "ks5" ? null : undefined);

  return NextResponse.json({
    phase,
    rollAtAge10: null,
    subjectData: byUrn.get(urn) ?? { entries: [], valueAdded: [], gradeDistribution: [] },
    headline: headlineByUrn.get(urn) ?? [],
  });
}
