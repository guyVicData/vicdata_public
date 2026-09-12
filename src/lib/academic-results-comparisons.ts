// Academic Results topic: read-path wiring for the free nearest-N default and the
// paid Comparator Set (docs/vicdata_phase3_academic_results_backend_followup_brief_v1.md
// Part B, vicdata's own docs/vicdata_phase3_academic_results_build_report_v1.md §3).
//
// Real, confirmed finding this module builds on (§3 of that build report): the free
// nearest-N default is genuinely session-only, recomputed live every page load via
// buildDefaultComparatorLists() (default-comparator-lists.ts) -- there is no persisted
// "member's current nearest-N selection" table to read. So Academic Results' own free
// tier calls the SAME real function directly (not a second, possibly-diverging
// proximity search) to get the real, phase/sector-matched URN list, then attaches real
// academic data for those URNs. The paid tier reads the genuinely-persisted
// saved_sets/saved_set_members tables directly, the same real shape DataViewShell.tsx's
// own comparator-set load already uses.
//
// This is read-path wiring only -- no new UI, no new page, no new API route (a real
// route would wrap one of these two functions with the same membership check
// default-lists/route.ts already applies, exactly as buildDefaultComparatorLists()
// itself has no membership check of its own and relies on its caller for that).
//
// Fetches real academic data via academic_headline_lookup (vicdata-reference.ts's own
// lookupAcademicHeadline) -- the RPC bridge round
// (docs/vicdata_phase3_academic_results_rpc_bridge_brief_v1.md) closed the gap this
// header used to document here: this now reads vicdata's precomputed
// academic_headline_snapshot table (one row per school/key-stage/year, canonicalized
// across the modern/historic column-naming split) instead of raw dfe_ks4_headline/
// dfe_ks5_headline fact rows via the generic reference_data_lookup RPC. The
// academic_subject_family_rollup/academic_geography_aggregate tables also have RPCs now
// (academic_subject_family_lookup, academic_geography_lookup) but no real call site in
// this codebase needs subject-family or geography comparisons yet -- not wired in here
// until one does.

import { createServerAnonSupabaseClient } from "./supabase";
import { buildDefaultComparatorLists, type DefaultList } from "./default-comparator-lists";
import { lookupAcademicHeadline, type AcademicHeadlineRow, type KsStage } from "./vicdata-reference";

export type { KsStage };

export type SchoolAcademicComparison = {
  urn: string;
  name: string;
  distanceKm: number | null;
  facts: AcademicHeadlineRow[];
};

async function attachAcademicFacts(
  schools: { urn: string; name: string; distanceKm: number | null }[],
  ksStage: KsStage,
): Promise<SchoolAcademicComparison[]> {
  if (schools.length === 0) return [];
  const rows = await lookupAcademicHeadline({
    entityIds: schools.map((s) => s.urn),
    ksStage,
  });
  const rowsByUrn = new Map<string, AcademicHeadlineRow[]>();
  for (const row of rows) {
    const existing = rowsByUrn.get(row.entity_id);
    if (existing) existing.push(row);
    else rowsByUrn.set(row.entity_id, [row]);
  }
  return schools.map((s) => ({ ...s, facts: rowsByUrn.get(s.urn) ?? [] }));
}

// Free tier: the exact same real nearest-N (or FE-college-nearest, or LA-comparator)
// recipe rolls' own Data View already builds for this school -- reused directly, not
// re-derived. Returns null if the target school itself can't be resolved (same
// contract as buildDefaultComparatorLists/resolveSchoolTypeCategory).
export async function getFreeAcademicNearestSchools(
  urn: string,
  ksStage: KsStage,
): Promise<SchoolAcademicComparison[] | null> {
  const lists = await buildDefaultComparatorLists(urn);
  const list1: DefaultList | null = lists.list1;
  if (!list1) return null;
  return attachAcademicFacts(list1.schools, ksStage);
}

// Paid tier: the member's own saved Comparator Set, read the same real way
// DataViewShell.tsx's own load already does (saved_sets + saved_set_members, only
// member_status = 'confirmed' rows) -- not a fresh proximity search, and not a second
// comparator-set mechanism of Academic Results' own.
export async function getPaidAcademicComparatorSet(
  savedSetId: string,
  ksStage: KsStage,
): Promise<SchoolAcademicComparison[] | null> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("saved_sets")
    .select("id, name, saved_set_members(school_urn, member_status, schools(current_name))")
    .eq("set_type", "comparator")
    .eq("id", savedSetId)
    .maybeSingle();
  if (error || !data) return null;

  type SavedSetRow = {
    saved_set_members: { school_urn: string; member_status: string; schools: { current_name: string } | null }[];
  };
  const row = data as unknown as SavedSetRow;
  const schools = row.saved_set_members
    .filter((m) => m.member_status === "confirmed")
    .map((m) => ({ urn: m.school_urn, name: m.schools?.current_name ?? m.school_urn, distanceKm: null }));
  return attachAcademicFacts(schools, ksStage);
}
