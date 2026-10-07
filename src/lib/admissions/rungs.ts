// VicData 0.7 admissions (A1): the default rung sets -- "nearby schools" until the Admissions
// lead confirms a list (admissions_lists). Server-only (anon key, the nearest_schools RPC, all
// sectors: p_relax_sector).
//
//   11+   the nearest DEFAULT_FEEDERS state schools teaching Reception to Year 6 (one set for every
//         primary rung)
//   16+   ages 11-15: the nearest secondaries, 11-16 schools (no sixth form, their pupils must
//         move) first, up to DEFAULT_SECONDARIES, plus the school itself (its own Year 11);
//         ages 4-10: the nearest primaries, as for 11+
//   4+ and other young entries: the nearest schools holding Reception (the births calibration)
// A custom age uses the same rule by the kind of school holding each rung age.
import { createServerAnonSupabaseClient } from "../supabase";
import { holderOf, type EntryPoint } from "./entry-points";

export const DEFAULT_FEEDERS = 15;
export const DEFAULT_SECONDARIES = 10;
const CANDIDATES = 400;

type Candidate = { urn: string; current_name: string; establishment_type_group: string | null; statutory_low_age: number; statutory_high_age: number; distance_metres: number };
// The data plan's defaults are STATE schools ("state primaries nearest the school"; local
// secondaries); independent preps join through a fuzzy set the lead builds.
const isState = (c: Candidate) => c.establishment_type_group !== "Independent schools";

export async function nearbyCandidates(urn: string): Promise<Candidate[]> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase.rpc("nearest_schools", { p_urn: urn, p_limit: CANDIDATES, p_relax_sector: true });
  if (error) throw error;
  return (data ?? []) as Candidate[];
}

const holds = (c: Candidate, age: number) => c.statutory_low_age <= age && c.statutory_high_age >= age;

export type RungSets = Map<number, string[]>; // rung age -> URNs (nearest first)

/** The default set for each rung age of an entry point (ages 4 .. E-1). One set per kind of
 * school, used at every age that kind holds, so a cohort is followed through the SAME schools
 * (infant and junior schools both in, so a move between them stays inside the set). */
export function defaultRungSets(urn: string, ep: EntryPoint, candidates: Candidate[]): RungSets {
  const out: RungSets = new Map();
  const holdsAny = (c: Candidate, lo: number, hi: number) => c.statutory_low_age <= hi && c.statutory_high_age >= lo;
  // Primary rungs: the nearest schools teaching any of Reception to Year 6 (not 11-18 schools).
  const primaries = candidates.filter((c) => isState(c) && holdsAny(c, 4, 10) && c.statutory_low_age <= 10).slice(0, DEFAULT_FEEDERS).map((c) => c.urn);
  const secondaries = (() => {
    const holding = candidates.filter((c) => isState(c) && holds(c, 11) && holds(c, 15));
    const elevenToSixteen = holding.filter((c) => c.statutory_high_age <= 16);
    const rest = holding.filter((c) => c.statutory_high_age > 16);
    return [...elevenToSixteen, ...rest].slice(0, DEFAULT_SECONDARIES).map((c) => c.urn);
  })();
  for (let age = 4; age < Math.max(ep.age, 5); age++) {
    const kind = holderOf(age);
    if (kind === "secondary") out.set(age, ep.age >= 16 ? Array.from(new Set([...secondaries, urn])) : secondaries);
    else out.set(age, primaries);
  }
  return out;
}

/** Rivals by default: the nearest schools (either sector) that teach the entry year itself --
 * their range covers the entry age and the year after it, so a primary that ends at 11 is not an
 * 11+ rival. The school itself excluded. */
export function defaultRivals(ep: EntryPoint, candidates: Candidate[], n = 10): string[] {
  return candidates.filter((c) => holds(c, ep.age) && holds(c, ep.age + 1)).slice(0, n).map((c) => c.urn);
}
