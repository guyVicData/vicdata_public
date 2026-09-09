// Member Data View performance architecture v1, §5: the Region ("London schools") and
// Nation ("England schools") comparator sets, backed by the precomputed
// school_region_nation table -- previously disabled placeholders (Compared-with panel
// redesign spec §1: "Greyed out/disabled until the backend infrastructure to compute
// it exists").
//
// 2026-10-09, real fix found live-verifying against production: this used to page
// through the result set application-side (PostgREST caps every response at
// config.toml's max_rows=1000, so Nation-scale needs ~25+ pages) -- first with an
// exact COUNT(*) re-run on every page (500'd outright), then with the count fixed to
// run once and pages fetched at bounded concurrency (no longer crashed, but still
// ~7.6s for Nation on real production -- 25+ round trips is inherently too slow for
// the ~1s target, concurrency tuning wasn't going to close that gap). Replaced with a
// single Postgres function (region_nation_set, in that migration) that joins schools
// to school_region_nation and aggregates the WHOLE result into one jsonb array
// server-side -- one request, one round trip, and PostgREST's row-count cap doesn't
// apply at all (the function's own return shape is exactly one row containing an
// array, regardless of how many schools are in scope). Verified live: Nation dropped
// from ~7.6s to comfortably under a second.

import { createServerAnonSupabaseClient } from "./supabase";
import type { AgeGenderCountsCompact } from "./data-view-serialize";

export type RegionNationScope = { kind: "region"; regionCode: string; regionName: string } | { kind: "nation"; nation: "england" | "wales" };

// 2026-10-09, real bug found live ("London schools and England schools don't load"):
// the set itself selected correctly (A3's sentence, the button, the Add/subtract
// count all updated with the real school_count), but the MAP showed zero markers --
// MapView.tsx's whole drawing pipeline only plots a school with a full
// DataViewSchoolProfile in profilesByUrn, and DataViewShell's own
// LARGE_SET_PROFILE_THRESHOLD guard (this same round, deliberately) never fetches
// those for a Region/Nation-scale set. Real geometry + sector returned alongside the
// plain urn/name here specifically so MapView can plot a real, positioned,
// sector-coloured marker for every school even without a full multi-year profile --
// see MapView.tsx's own buildLightweightProfile for how this gets used.
//
// Large-set design v1, item 2: extended with real current-period filterable data
// (statutoryLowAge/High, currentPeriod/totalRoll/femaleTotal/ageGenderCounts/
// boarding/boardersGenderSplit, anchorPeriod/anchorAgeGenderCounts) -- everything
// data-view-filters.ts's filteredCount() needs, sourced from the new
// school_current_snapshot table via region_nation_set()'s own extended join. Every
// one of these is null for a school with no real school_current_snapshot row (no
// real current-period census data at all, or the recompute hasn't run yet) -- honest
// absence, same convention buildLightweightProfile already established for the
// pre-this-round all-null stub case.
export type RegionNationPoint = {
  urn: string;
  easting: number | null;
  northing: number | null;
  establishmentTypeGroup: string | null;
  establishmentType: string | null;
  statutoryLowAge: number | null;
  statutoryHighAge: number | null;
  currentPeriod: number | null;
  totalRoll: number | null;
  femaleTotal: number | null;
  ageGenderCounts: AgeGenderCountsCompact | null;
  boarding: { boarders: number; day: number; total: number } | null;
  boardersGenderSplit: { male: number; female: number } | null;
  anchorPeriod: number | null;
  anchorAgeGenderCounts: AgeGenderCountsCompact | null;
};

// The target's own region/nation membership -- looked up once per Data View load
// (same shape as resolveSchoolTypeCategory's own single-target lookup), not folded
// into that function since region/nation membership is orthogonal to the sector/
// boarding classification it already computes.
export async function resolveTargetRegionNation(urn: string): Promise<{ regionCode: string | null; regionName: string | null; nation: "england" | "wales" | null } | null> {
  const supabase = createServerAnonSupabaseClient();
  const { data } = await supabase.from("school_region_nation").select("region_code, region_name, nation").eq("urn", urn).maybeSingle();
  if (!data) return null;
  return { regionCode: data.region_code, regionName: data.region_name, nation: data.nation as "england" | "wales" | null };
}

// Member Data View at scale: distance-from-target isn't a meaningful ordering for a
// whole region/nation (unlike Nearest-10/LA-any), so there's no distanceKm field here
// at all (unlike DefaultListEntry) -- the client synthesises a null one when it needs
// the DefaultListEntry shape (see DataViewShell.tsx's own row-unpacker).
//
// Large-set design v1, item 2, real regression fix (2026-10-10): region_nation_set()
// returns a POSITIONAL array per school, not a keyed object -- a live-network
// measurement found the keyed-object shape cost ~221 bytes of pure per-school
// overhead (repeated JSON key names) even with every new field null, on top of
// whatever real data the fields carry. This fixed field order is the ONLY contract
// between this function and that migration's own SQL -- keep them in sync by hand;
// Postgres has no way to enforce a TS tuple type at the SQL end.
//
// Payload-cleanup round (2026-09-09), real regression found live: this function used
// to unpack every one of these tuples into a fully-keyed RegionNationPoint (plus a
// SEPARATE keyed DefaultListEntry array duplicating urn/name) before returning to
// route.ts, which then JSON-serialised the keyed result straight to the browser --
// reintroducing almost exactly the per-school key-name overhead the positional-array
// migration above was written to eliminate, one hop further down the pipe (measured:
// 11.98MB raw RPC rows vs. 26.96MB of re-keyed response actually sent). Fixed by
// returning the raw rows themselves -- route.ts and DataViewShell.tsx are now BOTH
// part of this same positional-tuple contract; the unpacker that used to live here
// moved to DataViewShell.tsx (see its own row-unpacker for the RegionNationPoint/
// DefaultListEntry shapes this produces client-side instead).
export type RegionNationRow = [
  urn: string,
  name: string,
  easting: number | null,
  northing: number | null,
  establishmentTypeGroup: string | null,
  establishmentType: string | null,
  statutoryLowAge: number | null,
  statutoryHighAge: number | null,
  currentPeriod: number | null,
  totalRoll: number | null,
  femaleTotal: number | null,
  ageGenderCounts: AgeGenderCountsCompact | null,
  boarding: [boarders: number, day: number, total: number] | null,
  boardersGenderSplit: [male: number, female: number] | null,
  anchorPeriod: number | null,
  anchorAgeGenderCounts: AgeGenderCountsCompact | null,
];

export async function buildRegionOrNationComparatorSet(
  target: { urn: string; easting: number | null; northing: number | null },
  scope: RegionNationScope,
): Promise<{ key: string; label: string; rows: RegionNationRow[] }> {
  const supabase = createServerAnonSupabaseClient();
  const label = scope.kind === "region" ? `${scope.regionName} schools` : scope.nation === "england" ? "England schools" : "Wales schools";
  const key = scope.kind === "region" ? "ons_region" : "nation";

  const { data, error } = await supabase.rpc("region_nation_set", {
    p_region_code: scope.kind === "region" ? scope.regionCode : null,
    p_nation: scope.kind === "region" ? null : scope.nation,
    p_exclude_urn: target.urn,
  });
  if (error) throw error;

  return { key, label, rows: (data ?? []) as RegionNationRow[] };
}

// Member Data View large-set design v1, item 3: Rankings at Region/Nation scale.
// One RPC call (region_nation_rank(), same "one round trip regardless of scale"
// principle region_nation_set() already established) computes all three of
// RankingsView.tsx's METRICS (roll/girls_pct/boarding_pct) at once -- target's real
// rank/percentile, the top 15, and a neighbour window either side of the target --
// over school_current_snapshot joined to the requested scope. See that migration's
// own comment for the deliberate, logged scope limit (whole-school totals, no
// phase/age-band slicing).
export type RegionNationRankEntry = { urn: string; name: string; value: number; rank: number };
export type RegionNationRankMetric = { total: number; targetRank: number | null; top15: RegionNationRankEntry[]; neighbours: RegionNationRankEntry[] };
export type RegionNationRankResult = { roll: RegionNationRankMetric; girlsPct: RegionNationRankMetric; boardingPct: RegionNationRankMetric };

const EMPTY_RANK_METRIC: RegionNationRankMetric = { total: 0, targetRank: null, top15: [], neighbours: [] };

export async function fetchRegionNationRank(
  targetUrn: string,
  scope: RegionNationScope,
  sectors: string[] | null,
  boardingMode: "boarders" | "day" | "whole" | null,
  gender: "Girls" | "Boys" | null,
): Promise<RegionNationRankResult> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase.rpc("region_nation_rank", {
    p_region_code: scope.kind === "region" ? scope.regionCode : null,
    p_nation: scope.kind === "region" ? null : scope.nation,
    p_target_urn: targetUrn,
    p_sectors: sectors && sectors.length > 0 ? sectors : null,
    p_boarding_mode: boardingMode,
    p_gender: gender,
  });
  if (error) throw error;
  const result = (data ?? {}) as Partial<RegionNationRankResult>;
  return {
    roll: result.roll ?? EMPTY_RANK_METRIC,
    girlsPct: result.girlsPct ?? EMPTY_RANK_METRIC,
    boardingPct: result.boardingPct ?? EMPTY_RANK_METRIC,
  };
}
