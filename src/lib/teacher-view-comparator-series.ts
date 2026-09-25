// Teacher view: the comparator schools' rows and year series, shared by the dashboard
// route (the four algorithmic sets) and the saved-comparator-sets route (a teacher's own
// or the school's shared sets, accordion round Part 3). Moved here from the dashboard
// route unchanged, so a saved set's schools are ranked, gated and given history exactly
// the way a preset's are.
//
// Server-only: it calls fetchAcademicProfiles, which reads the reference data API.
import {
  fetchAcademicProfiles,
  HEADLINE_MEASURE,
  latestMeasureAt,
  headlineValueAt,
  entriesSeries,
  igcseExclusionLikely,
  type AcademicSchoolProfile,
  type KsStage,
} from "@/lib/academic-data-view";
import { OPEN_STATUS, inStagePool, isIndependent, type PoolSchool, type RankingsSetId } from "@/lib/teacher-view-rankings";

// §5's "relative to wider comparisons?" card. Both axes -- KS4/KS5 rankings and KS2's
// nearest 10 primaries -- come from school_nearest_neighbours, the neighbour table
// already used elsewhere, so "the schools near me" means one thing across the product.
//
// The pool is not phase-filtered, so reaching 10 primaries can mean going well past rank
// 10 (22 at a real Canterbury school), which is why the caller asks for a generous slice
// and this trims after filtering rather than limiting first.
export type NeighbourRow = {
  rank: number;
  distance_km: number | null;
  schools: {
    urn: string; current_name: string; phase: string | null; status: string | null; la_name?: string | null;
    establishment_type_group: string | null; statutory_low_age: number | null; statutory_high_age: number | null;
  } | null;
};

// The whole phase-filtered, open pool, in distance order. Every Rankings set -- Nearest
// 10 and round 5's other four -- is a selection from this one list (see
// teacher-view-rankings.ts), so "near me" means one thing across all of them.
export function neighbourPool(rows: NeighbourRow[], phase: KsStage): PoolSchool[] {
  // Filtered at BOTH ends, not just KS2. The pool is purely geographic, so without this a
  // secondary's ten nearest schools are mostly primaries -- verified at Haverstock, whose
  // ten nearest contain zero secondaries.
  // Independent schools are admitted by age range -- see inStagePool.
  const pool: PoolSchool[] = [];
  for (const row of rows) {
    const s = row.schools;
    if (!s || s.status !== OPEN_STATUS) continue;
    if (!inStagePool(phase, s)) continue;
    pool.push({ urn: s.urn, name: s.current_name, distanceKm: row.distance_km, independent: isIndependent(s.establishment_type_group), laName: s.la_name ?? null });
  }
  return pool;
}

// Round 6 (§6.4): the real per-year history behind Comparisons' Trend and % change
// panels. It was already being fetched and thrown away -- fetchAcademicProfiles returns
// every school's whole `AcademicHeadlineYear[]`, ascending by period, and rankSets
// collapsed each one to latestMeasureAt() below. So the wireframe's fabricated
// genSeries() drift is not needed: this is the same real measure as `value`, just not
// reduced to its last point.
export type YearValue = { period: number; value: number };

export function seriesOf(profile: AcademicSchoolProfile | undefined, phase: KsStage): YearValue[] {
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
export type SchoolSeries = { results: YearValue[]; candidates: YearValue[] };

export type RankedRow = {
  urn: string; name: string; value: number | null; isTarget: boolean; distanceKm: number | null;
  cohortSize?: number | null;
  // Accordion round Part 3: the chooser groups schools by local authority.
  laName?: string | null;
  // GCSE only, and only ever on the TARGET row now: an IGCSE-heavy independent's own
  // Attainment 8 is not comparable (DfE's tables exclude IGCSEs), and a school cannot be
  // left out of its own dashboard. Comparator schools that trip the same rule are dropped
  // from every set instead -- see rankSets.
  igcseExcluded?: boolean;
};

// The four sets, built from whichever pool schools are usable. A function rather than a
// value because rankSets may have to rebuild them: see below.
export type SetBuilder = (pool: PoolSchool[]) => Partial<Record<RankingsSetId, PoolSchool[]>>;

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
export async function rankSets(
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

// Accordion round Part 3: a SAVED comparator set -- a fixed list of schools a teacher or
// the school chose, rather than one built from the neighbour pool. Ranked and gated the
// same way as a preset (rankSets' own rules): at GCSE a school igcseExclusionLikely flags
// is left out, as it is everywhere else in Teacher view, and the school itself is always
// the first row. There is no pool to refill from, so a flagged member is simply omitted.
export async function rankFixedSets(
  targetUrn: string,
  sets: { id: string; urns: string[] }[],
  phase: KsStage,
): Promise<{ ranked: Record<string, RankedRow[]>; seriesByUrn: Record<string, SchoolSeries>; excludedUrns: string[] }> {
  const union = Array.from(new Set([targetUrn, ...sets.flatMap((s) => s.urns)]));
  const profiles = union.length ? await fetchAcademicProfiles(union, { includePopulation: false }) : [];
  const byUrn = new Map<string, AcademicSchoolProfile>(profiles.map((p) => [p.urn, p]));
  const excluded = (u: string) => phase === "ks4" && !!byUrn.get(u) && igcseExclusionLikely(byUrn.get(u)!);
  const valueFor = (u: string): number | null => {
    const prof = byUrn.get(u);
    if (!prof || excluded(u)) return null;
    const years = phase === "ks2" ? prof.ks2 : phase === "ks4" ? prof.ks4 : prof.ks5;
    return latestMeasureAt(years, HEADLINE_MEASURE[phase])?.value ?? null;
  };
  const ranked: Record<string, RankedRow[]> = {};
  for (const set of sets) {
    const kept = set.urns.filter((u) => u !== targetUrn && !excluded(u));
    ranked[set.id] = [
      { urn: targetUrn, name: "This school", value: valueFor(targetUrn), isTarget: true, distanceKm: 0, igcseExcluded: excluded(targetUrn) },
      ...kept.map((u) => ({ urn: u, name: byUrn.get(u)?.name ?? u, value: valueFor(u), isTarget: false, distanceKm: null })),
    ];
  }
  const seriesByUrn: Record<string, SchoolSeries> = {};
  for (const urn of union) {
    const prof = byUrn.get(urn);
    seriesByUrn[urn] = {
      results: excluded(urn) ? [] : seriesOf(prof, phase),
      candidates: prof ? entriesSeries(prof, phase, null) : [],
    };
  }
  return { ranked, seriesByUrn, excludedUrns: union.filter((u) => u !== targetUrn && excluded(u)) };
}
