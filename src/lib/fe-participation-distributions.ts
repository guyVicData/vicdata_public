// Reads the two FE-college size distributions (Prompt A, item 3) written by
// scripts/sync-fe-participation-distributions.ts -- band_key "fe_under_19"/
// "fe_19_plus", national scope only, in the SAME age_band_pupil_distributions table
// age-band-distributions.ts already reads for the mainstream phase-breakdown card.
// A separate, small lookup module rather than widening that one: its own type
// (AgeBandKey) is a closed union of the census AGE_BANDS keys, and its own module
// comment already establishes "different population, don't blend the code paths" for
// exactly this kind of adjacent-but-distinct figure (ilr-participation-data.ts's own
// precedent). sizeBadgeForValue() is reused directly, not reimplemented -- it's a pure
// function over an arbitrary value + quintile set, no dependency on the mainstream
// module's own types.

import { createServerAnonSupabaseClient } from "./supabase";
import { sizeBadgeForValue, type SizeBadge } from "./age-band-distributions";

export type FeParticipationDistribution = {
  meanTotal: number;
  quintiles: { p20: number; p40: number; p60: number; p80: number };
};

type DistributionRow = {
  band_key: "fe_under_19" | "fe_19_plus";
  mean_roll: number;
  p20: number;
  p40: number;
  p60: number;
  p80: number;
};

export async function lookupFeParticipationDistributions(
  period: number,
): Promise<{ under19: FeParticipationDistribution | null; adult: FeParticipationDistribution | null }> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("age_band_pupil_distributions")
    .select("band_key, mean_roll, p20, p40, p60, p80")
    .eq("scope", "national")
    .eq("scope_key", "")
    .eq("period", period)
    .in("band_key", ["fe_under_19", "fe_19_plus"]);
  if (error || !data) return { under19: null, adult: null };

  const rows = data as DistributionRow[];
  const toDistribution = (r: DistributionRow | undefined): FeParticipationDistribution | null =>
    r ? { meanTotal: r.mean_roll, quintiles: { p20: r.p20, p40: r.p40, p60: r.p60, p80: r.p80 } } : null;

  return {
    under19: toDistribution(rows.find((r) => r.band_key === "fe_under_19")),
    adult: toDistribution(rows.find((r) => r.band_key === "fe_19_plus")),
  };
}

export function feSizeBadge(value: number, distribution: FeParticipationDistribution): SizeBadge {
  return sizeBadgeForValue(value, distribution.quintiles);
}
