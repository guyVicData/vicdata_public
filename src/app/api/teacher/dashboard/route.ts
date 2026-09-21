import { NextRequest, NextResponse } from "next/server";
import { lookupAcademicGeography, lookupAcademicSubjectGeography } from "@/lib/vicdata-reference";
import { NATIONAL_GROUPING_KEY } from "@/lib/academic-aggregate-trends";
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
  entriesSeries,
  fetchLatestCohortSizes,
  igcseExclusionLikely,
  type AcademicSchoolProfile,
  type KsStage,
} from "@/lib/academic-data-view";
import {
  OPEN_STATUS,
  inStagePool,
  isIndependent,
  sameSector,
  localRivals,
  similarSize,
  SET_SIZE,
  type PoolSchool,
  type RankingsSetId,
} from "@/lib/teacher-view-rankings";

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
  schools: {
    urn: string; current_name: string; phase: string | null; status: string | null;
    establishment_type_group: string | null; statutory_low_age: number | null; statutory_high_age: number | null;
  } | null;
};

// The whole phase-filtered, open pool, in distance order. Every Rankings set -- Nearest
// 10 and round 5's other four -- is a selection from this one list (see
// teacher-view-rankings.ts), so "near me" means one thing across all of them.
function neighbourPool(rows: NeighbourRow[], phase: KsStage): PoolSchool[] {
  // Filtered at BOTH ends, not just KS2. The pool is purely geographic, so without this a
  // secondary's ten nearest schools are mostly primaries -- verified at Haverstock, whose
  // ten nearest contain zero secondaries.
  // Independent schools are admitted by age range -- see inStagePool.
  const pool: PoolSchool[] = [];
  for (const row of rows) {
    const s = row.schools;
    if (!s || s.status !== OPEN_STATUS) continue;
    if (!inStagePool(phase, s)) continue;
    pool.push({ urn: s.urn, name: s.current_name, distanceKm: row.distance_km, independent: isIndependent(s.establishment_type_group) });
  }
  return pool;
}

type RankedRow = {
  urn: string; name: string; value: number | null; isTarget: boolean; distanceKm: number | null;
  cohortSize?: number | null;
  // GCSE only: DfE's tables exclude IGCSEs, so an IGCSE-heavy independent's Attainment 8
  // is not comparable. Same rule the advanced dashboard applies (igcseExclusionLikely):
  // the school stays in the set, unranked, with the reason shown.
  igcseExcluded?: boolean;
};

// One fetchAcademicProfiles call for the union of every set, not one per set: the sets
// overlap heavily (the nearest schools recur in most of them), and these lookups are
// the ones that have hit statement timeouts when multiplied.
async function rankSets(
  targetUrn: string,
  sets: Partial<Record<RankingsSetId, PoolSchool[]>>,
  phase: KsStage,
  cohortSizes: Map<string, number> | null,
): Promise<{ ranked: Partial<Record<RankingsSetId, RankedRow[]>>; targetProfile: AcademicSchoolProfile | null }> {
  // The target is always in the union, so its profile comes back even when it has no
  // neighbours -- Candidates' "% of year group" reads its cohort from it.
  const union = new Set<string>([targetUrn]);
  for (const set of Object.values(sets)) for (const p of set ?? []) union.add(p.urn);
  const profiles = await fetchAcademicProfiles(Array.from(union), { includePopulation: false });
  const byUrn = new Map<string, AcademicSchoolProfile>(profiles.map((p) => [p.urn, p]));
  const excluded = (u: string) => phase === "ks4" && !!byUrn.get(u) && igcseExclusionLikely(byUrn.get(u)!);
  const valueFor = (u: string): number | null => {
    const prof = byUrn.get(u);
    if (!prof || excluded(u)) return null;
    const years = phase === "ks2" ? prof.ks2 : phase === "ks4" ? prof.ks4 : prof.ks5;
    return latestMeasureAt(years, HEADLINE_MEASURE[phase])?.value ?? null;
  };
  const sizeFor = (u: string) => (cohortSizes ? cohortSizes.get(u) ?? null : undefined);
  const out: Partial<Record<RankingsSetId, RankedRow[]>> = {};
  for (const [id, set] of Object.entries(sets) as [RankingsSetId, PoolSchool[]][]) {
    if (set.length === 0) { out[id] = []; continue; }
    out[id] = [
      { urn: targetUrn, name: "This school", value: valueFor(targetUrn), isTarget: true, distanceKm: 0, cohortSize: sizeFor(targetUrn), igcseExcluded: excluded(targetUrn) },
      ...set.map((p) => ({ urn: p.urn, name: p.name, value: valueFor(p.urn), isTarget: false, distanceKm: p.distanceKm, cohortSize: sizeFor(p.urn), igcseExcluded: excluded(p.urn) })),
    ];
  }
  return { ranked: out, targetProfile: byUrn.get(targetUrn) ?? null };
}

// The Results card's anchor: the England average for the same subject or qualification,
// from vicdata's national aggregate rows.
//   - GCSE: per SUBJECT, from academic_subject_geography_aggregate via
//     academic_subject_geography_lookup. Until 2026-09-21 no national figure existed per
//     subject, and this used the England average for the subject's whole family instead;
//     the backend round of that date added the subject-grain aggregate (the national
//     roll-up of academic_subject_rollup), so a subject is now compared with itself. Only
//     "GCSE (9-1) Full Course" carries points at KS4, so this is the England GCSE average
//     for that subject. Keyed by subject name, spelt as the headline rows spell it.
//   - Post-16: per comparability bucket ("bucket:alevel::aps_per_entry" and so on), from
//     academic_geography_aggregate -- the same points-per-entry scale as a subject's own
//     bucket-scoped score. Bucket grain for now; a later round may take it to subject.
type EnglandAverage = { key: string; period: number; value: number };

async function englandAverages(phase: "ks4" | "ks5"): Promise<{ basis: "bucket" | "subject"; values: EnglandAverage[] }> {
  if (phase === "ks5") {
    const rows = await lookupAcademicGeography({ ksStage: "ks5", groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY], familyId: "whole_school" });
    const values: EnglandAverage[] = [];
    for (const r of rows) {
      const m = /^bucket:(.+)::aps_per_entry$/.exec(r.measure);
      if (m && r.avg_value !== null) values.push({ key: m[1], period: r.period, value: r.avg_value });
    }
    return { basis: "bucket", values };
  }
  const rows = await lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY] });
  return {
    basis: "subject",
    values: rows.filter((r) => r.avg_value !== null).map((r) => ({ key: r.subject, period: r.period, value: Number(r.avg_value) })),
  };
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
    .select("rank, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status, establishment_type_group, statutory_low_age, statutory_high_age)")
    .eq("urn", urn)
    .eq("pool", "general")
    .order("rank", { ascending: true })
    .limit(100);
  const pool = neighbourPool((neighbourRows ?? []) as unknown as NeighbourRow[], phase);
  const { data: targetRow } = await supabase.from("schools").select("establishment_type_group").eq("urn", urn).maybeSingle();
  const targetIndependent = isIndependent((targetRow as { establishment_type_group: string | null } | null)?.establishment_type_group ?? null);

  // Similar-sized needs every pool school's cohort, so it is the one set that costs an
  // extra lookup -- a single batched headline call. Not offered at KS2: there is no
  // published KS2 exam-cohort figure, only the census Year 6 count, and the brief only
  // defines this set for GCSE and Post-16.
  const cohortSizes = phase === "ks2" ? null : await fetchLatestCohortSizes([urn, ...pool.map((p) => p.urn)], phase);
  const sets: Partial<Record<RankingsSetId, PoolSchool[]>> = {
    nearest: pool.slice(0, SET_SIZE),
    same_sector: sameSector(pool, targetIndependent),
    local_rivals: localRivals(pool),
  };
  if (cohortSizes) sets.similar_size = similarSize(pool, cohortSizes, cohortSizes.get(urn) ?? null);
  const { ranked: comparatorSets, targetProfile } = await rankSets(urn, sets, phase, cohortSizes);
  const setInfo = { targetIndependent, targetCohortSize: cohortSizes?.get(urn) ?? null };

  if (phase === "ks2") {
    const profiles = await fetchAcademicProfiles([urn], { includePopulation: true });
    const profile = profiles.find((p) => p.urn === urn) ?? null;
    return NextResponse.json({
      phase,
      rollAtAge10: profile ? populationAtAge(profile, HEADLINE_AGE.ks2) : null,
      subjectData: { entries: [], valueAdded: [], gradeDistribution: [] },
      headline: [],
      neighbours: comparatorSets.nearest ?? [],
      comparatorSets,
      setInfo,
      cohortSeries: [],
      headlineLabel: HEADLINE_LABEL[phase],
    });
  }

  const { byUrn } = await fetchSubjectLevelDataForSchools([urn], phase);
  // Every bucket at KS5, so a subject row can take the points belonging to its own
  // qualification rather than the whole-school 'all' row.
  const headlineByUrn = await fetchSubjectHeadlineForSchools([urn], phase, undefined, phase === "ks5" ? null : undefined);
  const england = await englandAverages(phase);

  return NextResponse.json({
    phase,
    rollAtAge10: null,
    subjectData: byUrn.get(urn) ?? { entries: [], valueAdded: [], gradeDistribution: [] },
    headline: headlineByUrn.get(urn) ?? [],
    neighbours: comparatorSets.nearest ?? [],
    comparatorSets,
    setInfo,
    // Candidates' "Entries, % of year group": the whole exam cohort per year -- the
    // same figure the map sizes this school's dot by.
    englandAverages: england,
    cohortSeries: targetProfile ? entriesSeries(targetProfile, phase, null) : [],
    headlineLabel: HEADLINE_LABEL[phase],
  });
}
