import { NextRequest, NextResponse } from "next/server";
import { lookupAcademicGeography, lookupAcademicSubjectGeography } from "@/lib/vicdata-reference";
import { NATIONAL_GROUPING_KEY } from "@/lib/academic-aggregate-trends";
import { createClient } from "@supabase/supabase-js";
import {
  fetchSubjectLevelDataForSchools,
  fetchSubjectHeadlineForSchools,
  fetchAcademicProfiles,
  HEADLINE_AGE,
  HEADLINE_LABEL,
  populationAtAge,
  entriesSeries,
  fetchLatestCohortSizes,
  type KsStage,
} from "@/lib/academic-data-view";
import { neighbourPool, rankSets, type NeighbourRow, type SetBuilder } from "@/lib/teacher-view-comparator-series";
import {
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

// The comparator pool, rows and series now live in teacher-view-comparator-series.ts,
// shared with the saved-comparator-sets route (accordion round Part 3).

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
    .select("rank, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status, establishment_type_group, statutory_low_age, statutory_high_age, la_name)")
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
  const buildSets: SetBuilder = (usable) => {
    const sets: Partial<Record<RankingsSetId, PoolSchool[]>> = {
      nearest: usable.slice(0, SET_SIZE),
      same_sector: sameSector(usable, targetIndependent),
      local_rivals: localRivals(usable),
    };
    if (cohortSizes) sets.similar_size = similarSize(usable, cohortSizes, cohortSizes.get(urn) ?? null);
    return sets;
  };
  const { ranked: comparatorSets, targetProfile, targetSeries, seriesByUrn } = await rankSets(urn, pool, buildSets, phase, cohortSizes);
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
      // Round 6: this school's own headline measure per year, for Comparisons' Trend and
      // % change panels (§6.4). Real published figures only -- years with no figure are
      // absent rather than carried forward.
      ownSeries: targetSeries,
      seriesByUrn,
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
    ownSeries: targetSeries,
    seriesByUrn,
    headlineLabel: HEADLINE_LABEL[phase],
  });
}
