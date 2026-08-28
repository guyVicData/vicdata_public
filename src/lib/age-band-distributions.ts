// Reads age_band_pupil_distributions (precomputed by
// scripts/sync-age-band-distributions.ts -- see that migration's own comment for why
// this can't be a live per-request query) for the dashboard's phase-breakdown
// size-badge card.
//
// Quintile reference population, first pass (flagged in docs/OPEN_QUESTIONS.md, not a
// final definition per the build instruction): the NATIONAL distribution for that
// band is the single scale every school is measured against, regardless of its own
// LA -- "regional" rows exist and are read here too, but only ever for the
// descriptive LA-average caption number, not a second quintile scale. "same-phase
// schools within the LA and nationally combined" (the original instruction's exact
// wording) is genuinely ambiguous between that reading and a literal pooled
// LA+national list; this build takes the reading that a school's LA population is
// already a subset of the national one, so "national" is the combined population.

import { createServerAnonSupabaseClient } from "./supabase";
import type { AgeBandKey } from "./roll-data";

export type SizeBadge = "XS" | "S" | "M" | "L" | "XL";

export function sizeBadgeForValue(value: number, q: { p20: number; p40: number; p60: number; p80: number }): SizeBadge {
  if (value < q.p20) return "XS";
  if (value < q.p40) return "S";
  if (value < q.p60) return "M";
  if (value < q.p80) return "L";
  return "XL";
}

export type BandDistribution = {
  nationalMean: number;
  regionalMean: number | null;
  quintiles: { p20: number; p40: number; p60: number; p80: number };
};

type DistributionRow = {
  scope: "national" | "regional";
  band_key: string;
  mean_roll: number;
  p20: number;
  p40: number;
  p60: number;
  p80: number;
};

// One query for both national ("") and regional (laName) rows for the current
// period -- the table's own unique index (scope, scope_key, band_key, period) makes
// this a small, indexed lookup, not a scan.
export async function lookupAgeBandDistributions(
  laName: string | null,
  period: number,
): Promise<Map<AgeBandKey, BandDistribution>> {
  const supabase = createServerAnonSupabaseClient();
  const scopeKeys = laName ? ["", laName] : [""];
  const { data, error } = await supabase
    .from("age_band_pupil_distributions")
    .select("scope, scope_key, band_key, mean_roll, p20, p40, p60, p80")
    .eq("period", period)
    .in("scope_key", scopeKeys);
  if (error || !data) return new Map();

  const rows = data as DistributionRow[];
  const national = new Map(rows.filter((r) => r.scope === "national").map((r) => [r.band_key, r]));
  const regional = new Map(rows.filter((r) => r.scope === "regional").map((r) => [r.band_key, r]));

  const result = new Map<AgeBandKey, BandDistribution>();
  for (const [bandKey, nat] of national) {
    const reg = regional.get(bandKey);
    result.set(bandKey as AgeBandKey, {
      nationalMean: nat.mean_roll,
      regionalMean: reg?.mean_roll ?? null,
      quintiles: { p20: nat.p20, p40: nat.p40, p60: nat.p60, p80: nat.p80 },
    });
  }
  return result;
}
