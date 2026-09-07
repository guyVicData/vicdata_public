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
import type { DefaultList, DefaultListEntry } from "./default-comparator-lists";

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
export type RegionNationPoint = {
  urn: string;
  easting: number | null;
  northing: number | null;
  establishmentTypeGroup: string | null;
  establishmentType: string | null;
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

export async function buildRegionOrNationComparatorSet(
  target: { urn: string; easting: number | null; northing: number | null },
  scope: RegionNationScope,
): Promise<{ list: DefaultList; points: RegionNationPoint[] }> {
  const supabase = createServerAnonSupabaseClient();
  const label = scope.kind === "region" ? `${scope.regionName} schools` : scope.nation === "england" ? "England schools" : "Wales schools";
  const key = scope.kind === "region" ? "ons_region" : "nation";

  const { data, error } = await supabase.rpc("region_nation_set", {
    p_region_code: scope.kind === "region" ? scope.regionCode : null,
    p_nation: scope.kind === "region" ? null : scope.nation,
    p_exclude_urn: target.urn,
  });
  if (error) throw error;

  // Member Data View at scale: distance-from-target isn't a meaningful ordering for a
  // whole region/nation (unlike Nearest-10/LA-any), and computing it for tens of
  // thousands of rows client-side buys nothing the map needs -- MapView clusters by
  // real lat/lng, not by a precomputed distance figure. Left null rather than
  // computed-but-unused.
  type Row = { urn: string; name: string; easting: number | null; northing: number | null; establishmentTypeGroup: string | null; establishmentType: string | null };
  const rows = (data ?? []) as Row[];
  const schools: DefaultListEntry[] = rows.map((r) => ({ urn: r.urn, name: r.name, distanceKm: null }));
  const points: RegionNationPoint[] = rows.map((r) => ({
    urn: r.urn,
    easting: r.easting,
    northing: r.northing,
    establishmentTypeGroup: r.establishmentTypeGroup,
    establishmentType: r.establishmentType,
  }));
  return { list: { key, label, schools }, points };
}
