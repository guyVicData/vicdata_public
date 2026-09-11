// Member Data View large-set design v1, item 5: Graphs at Region/Nation scale. Per
// the design doc's own framing, aggregation isn't a performance workaround here (a
// per-school chart wouldn't crash at this scale, since only ticked schools are ever
// fetched -- large-set design v1's item 6) -- it's the only comparison that MEANS
// anything against a 49,000-school set. Reads the SAME roll_aggregates table the
// public site's own Regional/National cards already read (national/ons_region rows)
// plus the new 'sector' scope (this round's item 4) -- no new precompute, just a new
// query shape against data that already exists for two of the three lines.
//
// Deliberately whole-school totals, not filtered by the active phase/gender/boarding
// filter: roll_aggregates only carries a FIXED 5-band age breakdown (early_years/
// primary/secondary/sixth_form/nineteen_plus, scripts/recompute-census-derived.ts's
// own AGE_BANDS) and gender/boarding totals, not the full PhaseBandKey taxonomy
// data-view-filters.ts's filteredCount() slices by -- reimplementing that mapping a
// second time against a coarser, fixed-band source would be a real drift risk for
// comparatively little value at this specific chart's own scale. Logged as a decision
// in docs/vicdata_data_view_open_questions.md; the chart itself states this basis
// explicitly rather than silently comparing filtered-vs-unfiltered numbers.
import { createServerAnonSupabaseClient } from "./supabase";
import { resolveTargetRegionNation } from "./region-nation-comparator";

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graphs 5/6/10: a
// genuinely separate, much smaller threshold than LARGE_SET_PROFILE_THRESHOLD
// (200, DataViewShell.tsx -- gates the Region/Nation-scale large-set redesign
// entirely) -- per direct instruction not to conflate the two. Shared between
// DataViewShell.tsx (decides whether to fetch sector aggregates at all) and
// GraphsView.tsx (decides whether to render the fallback), one source of truth.
export const GRAPH_SECTOR_FALLBACK_THRESHOLD = 20;

export type AggregateTrendPoint = {
  period: number;
  totalRoll: number;
  schoolCount: number;
  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graph 10: the SAME
  // roll_aggregates row already carries real gender_male/gender_female totals
  // (20260807112000_roll_aggregates.sql), written by the same aggregation loop as
  // total_roll (scripts/recompute-census-derived.ts) -- added here rather than a
  // second query, so the sector-aggregate fallback used by Graphs 5/6 (roll only)
  // and Graph 10 (gender split) shares one fetch, not two near-duplicate ones.
  genderMale: number;
  genderFemale: number;
};
export type AggregateTrendSeries = { label: string; points: AggregateTrendPoint[] };
export type AggregateTrends = {
  national: AggregateTrendSeries | null;
  region: AggregateTrendSeries | null;
  sector: AggregateTrendSeries | null;
};

type RollAggregateRow = { period: number; total_roll: number; school_count: number; gender_male: number; gender_female: number };

async function fetchScopeSeries(scope: "national" | "ons_region" | "sector", scopeKey: string, startPeriod: number): Promise<AggregateTrendPoint[]> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("roll_aggregates")
    .select("period, total_roll, school_count, gender_male, gender_female")
    .eq("scope", scope)
    .eq("scope_key", scopeKey)
    .gte("period", startPeriod)
    .order("period", { ascending: true });
  if (error) {
    console.error(`[aggregate-trends] fetch failed for scope=${scope} scope_key=${scopeKey}:`, error);
    return [];
  }
  return ((data ?? []) as RollAggregateRow[]).map((r) => ({
    period: r.period,
    totalRoll: r.total_roll,
    schoolCount: r.school_count,
    genderMale: r.gender_male,
    genderFemale: r.gender_female,
  }));
}

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graphs 5/6/10: "Need the
// SAME underlying table queried for EVERY distinct sector present in the visible
// set" (direct instruction) -- reuses fetchScopeSeries per sector, in parallel, at
// the exact same scope_key granularity (the real establishment_type_group string)
// the existing single-target-sector fetchAggregateTrends already reads, not a new
// coarser bucketing. A sector with no real roll_aggregates row (Special Schools/FE
// aren't populated yet -- see 20261010091000_roll_aggregates_sector_scope.sql's own
// comment) is simply omitted, not shown as a fabricated zero -- "only ones with real
// representation" per direct instruction.
export async function fetchSectorAggregatesForMany(sectors: string[], startPeriod: number): Promise<Record<string, AggregateTrendSeries>> {
  const unique = Array.from(new Set(sectors.filter(Boolean)));
  const results = await Promise.all(
    unique.map(async (sector) => [sector, await fetchScopeSeries("sector", sector, startPeriod)] as const),
  );
  const out: Record<string, AggregateTrendSeries> = {};
  for (const [sector, points] of results) {
    if (points.length > 0) out[sector] = { label: sector, points };
  }
  return out;
}

export async function fetchAggregateTrends(targetUrn: string, establishmentTypeGroup: string | null, startPeriod: number): Promise<AggregateTrends> {
  const targetRegionNation = await resolveTargetRegionNation(targetUrn);

  const [nationalPoints, regionPoints, sectorPoints] = await Promise.all([
    fetchScopeSeries("national", "", startPeriod),
    targetRegionNation?.regionCode ? fetchScopeSeries("ons_region", targetRegionNation.regionCode, startPeriod) : Promise.resolve([]),
    establishmentTypeGroup ? fetchScopeSeries("sector", establishmentTypeGroup, startPeriod) : Promise.resolve([]),
  ]);

  return {
    national: nationalPoints.length > 0 ? { label: "England", points: nationalPoints } : null,
    region: targetRegionNation?.regionName && regionPoints.length > 0 ? { label: targetRegionNation.regionName, points: regionPoints } : null,
    sector: establishmentTypeGroup && sectorPoints.length > 0 ? { label: establishmentTypeGroup, points: sectorPoints } : null,
  };
}
