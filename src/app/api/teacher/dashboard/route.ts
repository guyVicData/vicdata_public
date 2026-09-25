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
  headlineValueAt,
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

// Round 6 (§6.4): the real per-year history behind Comparisons' Trend and % change
// panels. It was already being fetched and thrown away -- fetchAcademicProfiles returns
// every school's whole `AcademicHeadlineYear[]`, ascending by period, and rankSets
// collapsed each one to latestMeasureAt() below. So the wireframe's fabricated
// genSeries() drift is not needed: this is the same real measure as `value`, just not
// reduced to its last point.
type YearValue = { period: number; value: number };

function seriesOf(profile: AcademicSchoolProfile | undefined, phase: KsStage): YearValue[] {
  if (!profile) return [];
  const years = phase === "ks2" ? profile.ks2 : phase === "ks4" ? profile.ks4 : profile.ks5;
  return years
    .map((y) => ({ period: y.period, value: headlineValueAt(years, y.period, HEADLINE_MEASURE[phase]) }))
    .filter((r): r is YearValue => r.value !== null)
    .sort((a, b) => a.period - b.period);
}

// Round 6 §4.3: both measures Comparisons' pills offer, per school, per year. Keyed by
// urn ONCE for the union of every set rather than inlined into each RankedRow -- the four
// sets overlap heavily (the nearest schools recur in most of them), so inlining would
// send the same history three or four times over.
type SchoolSeries = { results: YearValue[]; candidates: YearValue[] };

type RankedRow = {
  urn: string; name: string; value: number | null; isTarget: boolean; distanceKm: number | null;
  cohortSize?: number | null;
  // GCSE only, and only ever on the TARGET row now: an IGCSE-heavy independent's own
  // Attainment 8 is not comparable (DfE's tables exclude IGCSEs), and a school cannot be
  // left out of its own dashboard. Comparator schools that trip the same rule are dropped
  // from every set instead -- see rankSets.
  igcseExcluded?: boolean;
};

// The four sets, built from whichever pool schools are usable. A function rather than a
// value because rankSets may have to rebuild them: see below.
type SetBuilder = (pool: PoolSchool[]) => Partial<Record<RankingsSetId, PoolSchool[]>>;

// One fetchAcademicProfiles call per pass for every set's union, not one per set: the sets
// overlap heavily (the nearest schools recur in most of them), and these lookups are the
// ones that have hit statement timeouts when multiplied.
//
// Content round S4: at GCSE, a comparator school that igcseExclusionLikely flags is left
// OUT of every set, in both measures -- the rule 514e285 applies on the public pages
// ("omit, don't caveat"). Round 6 kept such schools in the set, unranked, which surfaced
// as real-looking candidate numbers (their entries series was never gated) and as "not
// comparable" placeholder rows. Dropping them after the sets were built would leave
// "Nearest 10" holding eight schools, so the sets are rebuilt from the pool minus the
// excluded schools, and any newly-admitted schools are fetched and checked in turn. Each
// pass only ever shrinks the pool, so this settles in a pass or two; the cap is a guard.
async function rankSets(
  targetUrn: string,
  pool: PoolSchool[],
  buildSets: SetBuilder,
  phase: KsStage,
  cohortSizes: Map<string, number> | null,
): Promise<{
  ranked: Partial<Record<RankingsSetId, RankedRow[]>>;
  targetProfile: AcademicSchoolProfile | null;
  targetSeries: YearValue[];
  seriesByUrn: Record<string, SchoolSeries>;
}> {
  const byUrn = new Map<string, AcademicSchoolProfile>();
  const fetched = new Set<string>();
  const excluded = (u: string) => phase === "ks4" && !!byUrn.get(u) && igcseExclusionLikely(byUrn.get(u)!);
  let usable = pool;
  let sets = buildSets(usable);
  for (let pass = 0; pass < 4; pass++) {
    // The target is always in the union, so its profile comes back even when it has no
    // neighbours -- Candidates' "% of year group" reads its cohort from it.
    const union = new Set<string>([targetUrn]);
    for (const set of Object.values(sets)) for (const p of set ?? []) union.add(p.urn);
    const missing = Array.from(union).filter((u) => !fetched.has(u));
    if (missing.length) {
      for (const p of await fetchAcademicProfiles(missing, { includePopulation: false })) byUrn.set(p.urn, p);
      for (const u of missing) fetched.add(u);
    }
    const drop = new Set(Array.from(union).filter((u) => u !== targetUrn && excluded(u)));
    if (drop.size === 0) break;
    usable = usable.filter((p) => !drop.has(p.urn));
    sets = buildSets(usable);
  }

  const valueFor = (u: string): number | null => {
    const prof = byUrn.get(u);
    if (!prof || excluded(u)) return null;
    const years = phase === "ks2" ? prof.ks2 : phase === "ks4" ? prof.ks4 : prof.ks5;
    return latestMeasureAt(years, HEADLINE_MEASURE[phase])?.value ?? null;
  };
  const sizeFor = (u: string) => (cohortSizes ? cohortSizes.get(u) ?? null : undefined);
  const out: Partial<Record<RankingsSetId, RankedRow[]>> = {};
  const members = new Set<string>([targetUrn]);
  for (const [id, set] of Object.entries(sets) as [RankingsSetId, PoolSchool[]][]) {
    // Belt and braces: the loop above has already rebuilt without them, unless it hit
    // its cap, in which case a still-flagged school is dropped here rather than shown.
    const kept = set.filter((p) => !excluded(p.urn));
    if (kept.length === 0) { out[id] = []; continue; }
    for (const p of kept) members.add(p.urn);
    out[id] = [
      { urn: targetUrn, name: "This school", value: valueFor(targetUrn), isTarget: true, distanceKm: 0, cohortSize: sizeFor(targetUrn), igcseExcluded: excluded(targetUrn) },
      ...kept.map((p) => ({ urn: p.urn, name: p.name, value: valueFor(p.urn), isTarget: false, distanceKm: p.distanceKm, cohortSize: sizeFor(p.urn) })),
    ];
  }
  // The target's own results history is withheld when it is excluded, as before: its
  // Attainment 8 is not comparable in any year, not just the latest one.
  const seriesByUrn: Record<string, SchoolSeries> = {};
  for (const urn of members) {
    const prof = byUrn.get(urn);
    seriesByUrn[urn] = {
      results: excluded(urn) ? [] : seriesOf(prof, phase),
      candidates: prof ? entriesSeries(prof, phase, null) : [],
    };
  }
  return { ranked: out, targetProfile: byUrn.get(targetUrn) ?? null, targetSeries: seriesOf(byUrn.get(targetUrn), phase), seriesByUrn };
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
