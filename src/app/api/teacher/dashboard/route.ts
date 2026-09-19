import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchSubjectLevelDataForSchools,
  fetchSubjectHeadlineForSchools,
  fetchAcademicProfiles,
  HEADLINE_AGE,
  HEADLINE_MEASURE,
  HEADLINE_LABEL,
  populationAtAge,
  latestMeasureAt,
  type AcademicSchoolProfile,
  type KsStage,
} from "@/lib/academic-data-view";
import { OPEN_STATUS, phasesFor } from "@/lib/teacher-view-rankings";

// Teacher view dashboard data (design brief v2 §5's four questions).
//
// One round trip for a dashboard, reusing the same fetchers the advanced view already
// uses rather than a parallel set that could drift. Serialised rather than Promise.all
// for the same reason the subject-comparison route is: these two lookups contend, and
// running them together is what produced a real statement timeout before.

// §5's "relative to wider comparisons?" card. Both axes -- KS4/KS5 rankings and KS2's
// nearest 10 primaries -- come from school_nearest_neighbours, the neighbour table
// already used elsewhere, so "the schools near me" means one thing across the product.
//
// The pool is not phase-filtered, so reaching 10 primaries can mean going well past rank
// 10 (22 at a real Canterbury school), which is why the caller asks for a generous slice
// and this trims after filtering rather than limiting first.
type NeighbourRow = {
  rank: number;
  distance_km: number | null;
  schools: { urn: string; current_name: string; phase: string | null; status: string | null } | null;
};

function pickNeighbours(rows: NeighbourRow[], phase: KsStage, limit = 10) {
  // Filtered at BOTH ends, not just KS2. The pool is purely geographic, so without this a
  // secondary's ten nearest schools are mostly primaries -- verified at Haverstock, whose
  // ten nearest contain zero secondaries.
  const allowed = phasesFor(phase);
  const picked: { urn: string; name: string; distanceKm: number | null }[] = [];
  for (const row of rows) {
    const s = row.schools;
    if (!s || s.status !== OPEN_STATUS) continue;
    if (!s.phase || !allowed.includes(s.phase)) continue;
    picked.push({ urn: s.urn, name: s.current_name, distanceKm: row.distance_km });
    if (picked.length >= limit) break;
  }
  return picked;
}

async function rankAgainst(
  targetUrn: string,
  picked: { urn: string; name: string; distanceKm: number | null }[],
  phase: KsStage,
) {
  if (picked.length === 0) return [];
  const profiles = await fetchAcademicProfiles([targetUrn, ...picked.map((p) => p.urn)], { includePopulation: false });
  const byUrn = new Map<string, AcademicSchoolProfile>(profiles.map((p) => [p.urn, p]));
  const valueFor = (u: string): number | null => {
    const prof = byUrn.get(u);
    if (!prof) return null;
    const years = phase === "ks2" ? prof.ks2 : phase === "ks4" ? prof.ks4 : prof.ks5;
    return latestMeasureAt(years, HEADLINE_MEASURE[phase])?.value ?? null;
  };
  return [
    { urn: targetUrn, name: "This school", value: valueFor(targetUrn), isTarget: true, distanceKm: 0 },
    ...picked.map((p) => ({ urn: p.urn, name: p.name, value: valueFor(p.urn), isTarget: false, distanceKm: p.distanceKm })),
  ];
}

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
  const { data: neighbourRows } = await supabase
    .from("school_nearest_neighbours")
    .select("rank, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status)")
    .eq("urn", urn)
    .eq("pool", "general")
    .order("rank", { ascending: true })
    .limit(100);
  const picked = pickNeighbours((neighbourRows ?? []) as unknown as NeighbourRow[], phase);

  if (phase === "ks2") {
    const profiles = await fetchAcademicProfiles([urn], { includePopulation: true });
    const profile = profiles.find((p) => p.urn === urn) ?? null;
    return NextResponse.json({
      phase,
      rollAtAge10: profile ? populationAtAge(profile, HEADLINE_AGE.ks2) : null,
      subjectData: { entries: [], valueAdded: [], gradeDistribution: [] },
      headline: [],
      neighbours: await rankAgainst(urn, picked, phase),
      headlineLabel: HEADLINE_LABEL[phase],
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
    neighbours: await rankAgainst(urn, picked, phase),
    headlineLabel: HEADLINE_LABEL[phase],
  });
}
