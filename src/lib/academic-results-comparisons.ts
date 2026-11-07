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
// sets/set_members tables (0.8 sets round 1) directly, the same real shape DataViewShell.tsx's
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

import { readSet } from "./sets/store";
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
// DataViewShell.tsx's own load already does (0.8 sets round 1: public.sets + set_members) -- not a fresh proximity search, and not a second
// comparator-set mechanism of Academic Results' own.
export async function getPaidAcademicComparatorSet(
  savedSetId: string,
  ksStage: KsStage,
): Promise<SchoolAcademicComparison[] | null> {
  // 0.8 sets round 1 (A5): the one sets model (public.sets), under the same anon client as before
  // (RLS: it sees what that client may see).
  const supabase = createServerAnonSupabaseClient();
  const set = await readSet(supabase, savedSetId);
  if (!set || set.kind !== "compared_against") return null;
  const urns = set.members.map((m) => m.urn);
  const { data: names } = urns.length ? await supabase.from("schools").select("urn, current_name").in("urn", urns) : { data: [] };
  const nameBy = new Map(((names ?? []) as { urn: string; current_name: string }[]).map((r) => [r.urn, r.current_name]));
  const schools = urns.map((u) => ({ urn: u, name: nameBy.get(u) ?? u, distanceKm: null }));
  return attachAcademicFacts(schools, ksStage);
}
