// Reads sixth_form_sector_aggregates (Prompt B's characterization -> this build; see
// that table's own migration comment for the scope-naming rationale and the
// state/independent-vs-fe measurement caveat every caller here must carry forward).
// Written by two genuinely separate sync scripts: sync-sixth-form-sector-aggregates.ts
// (sector='state'/'independent', all three scopes) and
// sync-fe-participation-region-national.ts (sector='fe', region/national only -- LA-
// level FE stays live via la-sector-composition.ts's computeLaSectorComposition,
// deliberately not duplicated into this table).

import { createServerAnonSupabaseClient } from "./supabase";

export type SectorTotal = { total: number; schoolCount: number };
export type SixthFormSectorTotals = {
  state: SectorTotal | null;
  independent: SectorTotal | null;
  fe: SectorTotal | null;
};

type Row = { scope_key: string; sector: "state" | "independent" | "fe"; total: number; school_count: number };

function toTotals(rows: Row[]): SixthFormSectorTotals {
  const bySector = new Map(rows.map((r) => [r.sector, { total: r.total, schoolCount: r.school_count }]));
  return {
    state: bySector.get("state") ?? null,
    independent: bySector.get("independent") ?? null,
    fe: bySector.get("fe") ?? null,
  };
}

// LA-level state/independent only -- deliberately no `fe` key populated here (always
// null); item 1's own caller pairs this with la-sector-composition.ts's live FE total
// instead of expecting it from this table.
export async function lookupLaSixthFormSectorTotals(
  laName: string,
  period: number,
): Promise<{ state: SectorTotal | null; independent: SectorTotal | null }> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("sixth_form_sector_aggregates")
    .select("scope_key, sector, total, school_count")
    .eq("scope", "la")
    .eq("scope_key", laName)
    .eq("period", period);
  if (error || !data) return { state: null, independent: null };
  const totals = toTotals(data as Row[]);
  return { state: totals.state, independent: totals.independent };
}

// A single region, all three sectors.
export async function lookupRegionSixthFormSectorTotals(region: string, period: number): Promise<SixthFormSectorTotals> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("sixth_form_sector_aggregates")
    .select("scope_key, sector, total, school_count")
    .eq("scope", "region")
    .eq("scope_key", region)
    .eq("period", period);
  if (error || !data) return { state: null, independent: null, fe: null };
  return toTotals(data as Row[]);
}

// National, all three sectors.
export async function lookupNationalSixthFormSectorTotals(period: number): Promise<SixthFormSectorTotals> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("sixth_form_sector_aggregates")
    .select("scope_key, sector, total, school_count")
    .eq("scope", "national")
    .eq("scope_key", "")
    .eq("period", period);
  if (error || !data) return { state: null, independent: null, fe: null };
  return toTotals(data as Row[]);
}

// Every region, all three sectors -- one query, for item 6's ranked stacked bar (don't
// call lookupRegionSixthFormSectorTotals in a loop for this).
export async function lookupAllRegionsSixthFormSectorTotals(period: number): Promise<Map<string, SixthFormSectorTotals>> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("sixth_form_sector_aggregates")
    .select("scope_key, sector, total, school_count")
    .eq("scope", "region")
    .eq("period", period);
  if (error || !data) return new Map();

  const byRegion = new Map<string, Row[]>();
  for (const row of data as Row[]) {
    if (!byRegion.has(row.scope_key)) byRegion.set(row.scope_key, []);
    byRegion.get(row.scope_key)!.push(row);
  }
  const result = new Map<string, SixthFormSectorTotals>();
  for (const [region, rows] of byRegion) result.set(region, toTotals(rows));
  return result;
}
