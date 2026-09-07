// Member Data View performance architecture v1, §5: the Region ("London schools") and
// Nation ("England schools") comparator sets, backed by the precomputed
// school_region_nation table -- previously disabled placeholders (Compared-with panel
// redesign spec §1: "Greyed out/disabled until the backend infrastructure to compute
// it exists"). A plain indexed `where region_code = ...` / `where nation = ...` query,
// not a live computed join -- the whole point of precomputing region/nation membership
// once per GIAS-affecting promote rather than deriving it per request.
//
// Real, unavoidable constraint this module works around: this project's own
// supabase/config.toml caps every PostgREST response at max_rows = 1000, regardless of
// how many rows actually match -- a naive single .select() for Nation (tens of
// thousands of schools at full data build) would silently truncate, exactly the
// "silently capped or sampled" outcome the brief explicitly rules out for the map.
// fetchAllRows below pages through the FULL result set via parallel .range() calls
// (count first, then every page fetched concurrently) rather than one call or a
// sequential loop, so Nation-scale reads still land close to the ~1s target instead of
// paying for (rowCount / 1000) round trips one at a time.

import { createServerAnonSupabaseClient } from "./supabase";
import type { DefaultList, DefaultListEntry } from "./default-comparator-lists";

const PAGE_SIZE = 1000;
// Real bug found live (2026-10-09): the original version of this function asked every
// single page for `count: "exact"`, not just the first -- for Nation (tens of
// thousands of rows, ~25+ pages), that meant ~25 CONCURRENT requests each separately
// re-running an expensive exact COUNT(*) over the whole filtered join, on top of the
// join itself, all at once. Reproduced live against production: Region (a few hundred
// rows, 1 page, count computed once) returned in 709ms; Nation 500'd outright. Fixed
// two ways: count is now fetched exactly ONCE (a cheap head-only request, before any
// data page), and remaining pages are fetched with a bounded concurrency (matching the
// same "don't fire dozens of concurrent requests at once" discipline the geo-recompute
// scripts already use) rather than firing all ~25+ at the same time.
const PAGE_CONCURRENCY = 5;

async function fetchAllRows<T>(
  countOnly: () => Promise<{ count: number | null; error: unknown }>,
  build: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const { count, error: countError } = await countOnly();
  if (countError) throw countError;
  const total = count ?? 0;
  if (total === 0) return [];

  const ranges: [number, number][] = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) ranges.push([offset, offset + PAGE_SIZE - 1]);

  const rows: T[] = [];
  for (let i = 0; i < ranges.length; i += PAGE_CONCURRENCY) {
    const group = ranges.slice(i, i + PAGE_CONCURRENCY);
    const results = await Promise.all(group.map(([from, to]) => build(from, to)));
    for (const r of results) {
      if (r.error) throw r.error;
      rows.push(...(r.data ?? []));
    }
  }
  return rows;
}

export type RegionNationScope = { kind: "region"; regionCode: string; regionName: string } | { kind: "nation"; nation: "england" | "wales" };

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
): Promise<DefaultList> {
  const supabase = createServerAnonSupabaseClient();
  const label = scope.kind === "region" ? `${scope.regionName} schools` : scope.nation === "england" ? "England schools" : "Wales schools";
  const key = scope.kind === "region" ? "ons_region" : "nation";

  // Embedded-resource join (school_region_nation.urn -> schools.urn, the table's own
  // single FK, no ambiguous-relationship hint needed) rather than a separate
  // .in("urn", urns) fetch -- a region/nation membership list can run to tens of
  // thousands of URNs, and PostgREST/supabase-js builds .in() filters as a GET query
  // string, which would blow well past any sane URL length at that size. Letting
  // Postgres do the join server-side avoids ever materialising that array at all.
  type Row = { urn: string; schools: { current_name: string } | { current_name: string }[] | null };

  const rows = await fetchAllRows<Row>(
    async () => {
      let q = supabase.from("school_region_nation").select("urn", { count: "exact", head: true });
      q = scope.kind === "region" ? q.eq("region_code", scope.regionCode) : q.eq("nation", scope.nation);
      const { count, error } = await q.neq("urn", target.urn);
      return { count, error };
    },
    async (from, to) => {
      let q = supabase.from("school_region_nation").select("urn, schools(current_name)");
      q = scope.kind === "region" ? q.eq("region_code", scope.regionCode) : q.eq("nation", scope.nation);
      const { data, error } = await q.neq("urn", target.urn).range(from, to);
      return { data: data as Row[] | null, error };
    },
  );

  // Member Data View at scale: distance-from-target isn't a meaningful ordering for a
  // whole region/nation (unlike Nearest-10/LA-any), and computing it for tens of
  // thousands of rows client-side buys nothing the map needs -- MapView clusters by
  // real lat/lng, not by a precomputed distance figure. Left null rather than
  // computed-but-unused.
  const schools: DefaultListEntry[] = [];
  for (const r of rows) {
    const nameRow = Array.isArray(r.schools) ? r.schools[0] : r.schools;
    if (nameRow) schools.push({ urn: r.urn, name: nameRow.current_name, distanceKm: null });
  }
  return { key, label, schools };
}
