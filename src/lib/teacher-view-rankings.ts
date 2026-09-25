// Teacher view, Phase 3: the "relative to wider comparisons?" card (design brief v2 §5).
//
// §5 points this question at a different axis per phase: comparator sets/rankings at
// KS4 and KS5, and the nearest 10 primaries at KS2 -- because "other schools like mine"
// is the meaningful wider frame for a primary, where "rankings" in the advanced view's
// sense is not.
//
// Both reuse `school_nearest_neighbours`, the neighbour table already built and used
// elsewhere on the platform, rather than a second distance computation. Verified against
// it directly: 6,902,194 rows covering 26,372 schools, with a `general` pool holding the
// nearest 100 per school and a separate `boarding` pool.
import { createBrowserSupabaseClient } from "@/lib/supabase";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// The phases that genuinely take KS2 tests. Checked against the real `phase` vocabulary
// rather than assumed: 'Middle deemed primary' is a real value and does take KS2, so
// filtering on 'Primary' alone would silently drop real neighbours.
export const KS2_PHASES = ["Primary", "All-through", "Middle deemed primary"];

// The same filtering is needed at KS4/KS5, and NOT doing it was a real bug caught by
// verification rather than code reading. The neighbour pool is purely geographic, so a
// secondary school's ten nearest schools are mostly primaries: Haverstock School's ten
// nearest contain ZERO secondaries (five Primary, five "Not applicable" independent
// preps), which left its Rankings card ranking it 1st of 2 -- technically true and
// completely useless. Phase-filtering both ends makes the comparison a real one.
export const KS4_KS5_PHASES = ["Secondary", "All-through", "16 plus", "Middle deemed secondary"];

export function phasesFor(stage: "ks2" | "ks4" | "ks5"): string[] {
  return stage === "ks2" ? KS2_PHASES : KS4_KS5_PHASES;
}

// Independent schools carry no real phase: all 1,588 open ones in `schools` are "Not
// applicable" (checked, round 5). So phasesFor alone silently dropped EVERY independent
// school from every Teacher view neighbour pool, which went unnoticed while Rankings
// only had a sector-blind Nearest 10, and would leave "same sector" empty for every
// independent school and "local rivals" with no independent half at all.
//
// For those schools the statutory age range is the real phase signal. It still keeps
// out the independent preps the Haverstock fix was about: a 3-13 prep does not reach
// GCSE age.
export function inStagePool(
  stage: "ks2" | "ks4" | "ks5",
  s: { phase: string | null; statutory_low_age: number | null; statutory_high_age: number | null },
): boolean {
  if (s.phase && phasesFor(stage).includes(s.phase)) return true;
  if (s.phase !== "Not applicable" || s.statutory_low_age === null || s.statutory_high_age === null) return false;
  const [lo, hi] = [s.statutory_low_age, s.statutory_high_age];
  if (stage === "ks2") return lo <= 10 && hi >= 11; // sits the Year 6 tests
  if (stage === "ks4") return lo <= 15 && hi >= 16; // reaches the GCSE year
  return hi >= 18; // has a sixth form
}

// `status` is lowercase in this database ('open', not 'Open') -- found the hard way, by a
// filter that silently returned nothing.
export const OPEN_STATUS = "open";

export type NeighbourSchool = {
  urn: string;
  name: string;
  phase: string | null;
  distanceKm: number | null;
  rank: number;
};

// §5's KS2 axis. Note the pool is not phase-filtered, so reaching 10 primaries can mean
// going well past rank 10 -- at a real Canterbury school it took 22 -- which is why the
// query asks for a generous slice and trims after filtering rather than limiting first.
export async function fetchNearestPrimaries(supabase: Supa, urn: string, limit = 10): Promise<NeighbourSchool[]> {
  const { data, error } = await supabase
    .from("school_nearest_neighbours")
    .select("rank, neighbour_urn, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status)")
    .eq("urn", urn)
    .eq("pool", "general")
    .order("rank", { ascending: true })
    .limit(100);
  if (error || !data) return [];
  const out: NeighbourSchool[] = [];
  for (const row of data as unknown as {
    rank: number; neighbour_urn: string; distance_km: number | null;
    schools: { urn: string; current_name: string; phase: string | null; status: string | null } | null;
  }[]) {
    const s = row.schools;
    if (!s || s.status !== OPEN_STATUS || !s.phase || !KS2_PHASES.includes(s.phase)) continue;
    out.push({ urn: s.urn, name: s.current_name, phase: s.phase, distanceKm: row.distance_km, rank: row.rank });
    if (out.length >= limit) break;
  }
  return out;
}

// §5's KS4/KS5 axis. Deliberately the same neighbour source, so "the schools near me" means
// one thing across the whole product rather than two subtly different lists -- and, since
// the Haverstock finding, filtered the same way at both ends. The 100-row slice matches
// fetchNearestPrimaries for the same reason: in a primary-dense area the tenth real
// secondary can sit a long way down the geographic list.
export async function fetchNearestSchools(supabase: Supa, urn: string, limit = 10): Promise<NeighbourSchool[]> {
  const { data, error } = await supabase
    .from("school_nearest_neighbours")
    .select("rank, neighbour_urn, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status)")
    .eq("urn", urn)
    .eq("pool", "general")
    .order("rank", { ascending: true })
    .limit(100);
  if (error || !data) return [];
  const out: NeighbourSchool[] = [];
  for (const row of data as unknown as {
    rank: number; neighbour_urn: string; distance_km: number | null;
    schools: { urn: string; current_name: string; phase: string | null; status: string | null } | null;
  }[]) {
    const s = row.schools;
    if (!s || s.status !== OPEN_STATUS || !s.phase || !KS4_KS5_PHASES.includes(s.phase)) continue;
    out.push({ urn: s.urn, name: s.current_name, phase: s.phase, distanceKm: row.distance_km, rank: row.rank });
    if (out.length >= limit) break;
  }
  return out;
}

// A ranked row: this school and its neighbours on one real headline measure, with the
// target marked. §14: the figure never appears alone -- position out of N is the anchor.
export type RankedSchool = { urn: string; name: string; value: number | null; isTarget: boolean };

export function rankOf(rows: RankedSchool[], urn: string): { position: number; outOf: number } | null {
  const scored = rows.filter((r) => r.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const idx = scored.findIndex((r) => r.urn === urn);
  return idx === -1 ? null : { position: idx + 1, outOf: scored.length };
}

// ---------------------------------------------------------------------------
// Round 5: the Rankings card's other comparator sets.
//
// Every set is drawn from the SAME phase-filtered, open neighbour pool the Nearest 10 is
// (the 100 nearest in school_nearest_neighbours' general pool). So "near me" keeps one
// meaning across all of them, and none of them can quietly reintroduce the Haverstock
// problem of a secondary being compared with primaries. They differ only in which of
// those neighbours they keep.
// ---------------------------------------------------------------------------

export type RankingsSetId = "nearest" | "same_sector" | "local_rivals" | "similar_size";

// `laName` (accordion round Part 3): the school's local authority, for the comparator
// chooser's grouping. Optional -- nothing that builds a set reads it.
export type PoolSchool = { urn: string; name: string; distanceKm: number | null; independent: boolean; laName?: string | null };

// The sector split every existing recipe uses: feeder_candidates partitions on exactly
// this equality, and the comparator builder's sector filter tests it the same way.
export function isIndependent(establishmentTypeGroup: string | null): boolean {
  return establishmentTypeGroup === "Independent schools";
}

export const SET_SIZE = 10;
// Local rivals: half of the set from each sector. See localRivals for why.
export const LOCAL_RIVALS_PER_SECTOR = SET_SIZE / 2;

// "State vs. state, independent vs. independent" -- the nearest ten of the target's own
// sector. The pool is geographic, so in a state-dense area an independent school's
// nearest ten independents can run out inside it; the set is then honestly short
// rather than padded with the other sector.
export function sameSector(pool: PoolSchool[], targetIndependent: boolean): PoolSchool[] {
  return pool.filter((p) => p.independent === targetIndependent).slice(0, SET_SIZE);
}

// "Local rivals" is the existing recipe's idea (the comparator builder's Local rivals
// mode: geography first, a target count PER SECTOR, as feeder_candidates does), applied
// to the phase-filtered pool rather than by calling feeder_candidates itself. That
// function has no phase filter, so for a secondary its nearest fifteen per sector are
// mostly primaries. What makes the set differ from Nearest 10 is the split: the schools
// a family would actually weigh against this one, from both sectors, even where one
// sector crowds the other out of the plain nearest ten.
export function localRivals(pool: PoolSchool[]): PoolSchool[] {
  const state = pool.filter((p) => !p.independent).slice(0, LOCAL_RIVALS_PER_SECTOR);
  const independent = pool.filter((p) => p.independent).slice(0, LOCAL_RIVALS_PER_SECTOR);
  return [...state, ...independent].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

// Similar-sized: the ten neighbours whose exam cohort is closest to this school's, on
// the ratio rather than the difference. A 100-pupil gap is a big one at a cohort of 80
// and a small one at a cohort of 300, and a ratio treats "twice the size" and "half
// the size" as equally far. Schools with no published cohort figure are left out
// rather than guessed at.
export function similarSize(pool: PoolSchool[], sizes: Map<string, number>, targetSize: number | null): PoolSchool[] {
  if (targetSize === null || targetSize <= 0) return [];
  return pool
    .filter((p) => sizes.has(p.urn))
    .map((p) => ({ p, gap: Math.abs(Math.log(sizes.get(p.urn)! / targetSize)) }))
    .sort((a, b) => a.gap - b.gap || (a.p.distanceKm ?? Infinity) - (b.p.distanceKm ?? Infinity))
    .slice(0, SET_SIZE)
    .map((x) => x.p);
}
