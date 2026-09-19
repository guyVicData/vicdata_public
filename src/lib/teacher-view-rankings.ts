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
