// Shared by every FE-participation sync script: the real, OPEN
// (status != 'closed') FE_PARTICIPATION_ESTABLISHMENT_TYPES institution population.
// dfe_fe_participation/_adult carry real historical facts for institutions that have
// SINCE closed in GIAS's own current data (confirmed real, not junk data: Newham
// Sixth Form College, Richmond-upon-Thames College, and 20 others -- found while
// building sync-fe-participation-region-national.ts, whose own national sum silently
// included them before this filter existed). Every FE-participation aggregate needs
// the exact same open-only population, or two sibling aggregates covering the "same"
// real number can silently diverge (as sync-fe-participation-distributions.ts's own
// national-average figure did against sixth_form_sector_aggregates', until this fix)
// -- factored out here rather than reimplemented per script, per Guy's own
// instruction.

import type { SupabaseClient } from "@supabase/supabase-js";
import { FE_PARTICIPATION_ESTABLISHMENT_TYPES } from "../../src/lib/typology";

// urn -> la_code (null when the institution has no real la_code) -- the richer shape
// sync-fe-participation-region-national.ts needs for its own region attribution;
// callers that only need membership (sync-fe-participation-distributions.ts) just
// check `.has(urn)` on the same map, not a second, narrower query.
export async function loadOpenFeParticipationInstitutions(supabase: SupabaseClient): Promise<Map<string, string | null>> {
  const { data, error } = await supabase
    .from("schools")
    .select("urn, la_code")
    .in("establishment_type", FE_PARTICIPATION_ESTABLISHMENT_TYPES)
    .neq("status", "closed");
  if (error) throw error;
  const result = new Map<string, string | null>();
  for (const row of data as { urn: string; la_code: string | null }[]) result.set(row.urn, row.la_code);
  return result;
}

// Filters an already-extracted per-URN value map down to the open-institution
// population, reporting how many were excluded as since-closed (for the sync
// script's own console log, same visibility every other script in this project
// already gives its own filtering steps).
export function excludeClosedInstitutions<T>(
  values: Map<string, T>,
  openInstitutions: Map<string, string | null>,
): { open: Map<string, T>; excludedCount: number } {
  const open = new Map(Array.from(values).filter(([urn]) => openInstitutions.has(urn)));
  return { open, excludedCount: values.size - open.size };
}
