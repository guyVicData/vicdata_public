#!/usr/bin/env -S npx tsx
// Precomputes real DfE ILR under-19 FE participation totals, summed to region and
// national scope, into sixth_form_sector_aggregates as sector='fe' rows (Prompt B's
// characterization -> this build -- see that table's own migration comment for why
// sector='fe' shares the table with state/independent, and for the measurement
// caveat every caller reading across sectors must carry). LA scope is deliberately
// NOT written here -- item 1's own local pie already reads the LA-level FE total live
// via la-sector-composition.ts's computeLaSectorComposition(), which exists and works
// today; duplicating it into a precomputed row here would be a second, potentially
// diverging source for the same number.
//
// A genuinely different aggregation shape from Prompt A's own
// sync-fe-participation-distributions.ts (national QUINTILE distribution, for the
// XS-XL size-badge card) -- this is a plain SUM per scope, the shape item 1/6's pie
// and stacked-bar charts actually need. Not a variant of that script; the two share
// only the "latest non-suppressed total per institution" extraction logic (reimplemented
// here, not imported -- that script's own function returns a period alongside each
// total, this one doesn't need it) and the open-institution filter
// (scripts/lib/fe-open-institutions.ts, shared -- see that module's own comment for
// why duplicating it a third time isn't the move).
//
// Usage: npx tsx --env-file=.env scripts/sync-fe-participation-region-national.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { lookupReferenceData } from "../src/lib/vicdata-reference";
import { CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";
import { loadOpenFeParticipationInstitutions, excludeClosedInstitutions } from "./lib/fe-open-institutions";

const TARGET_PERIOD = CURRENT_CENSUS_PERIOD;
const UNDER_19_TOTAL_BREAKDOWN = "education_and_training_under_19_total";

type Accumulator = { total: number; schoolUrns: Set<string> };
function newAccumulator(): Accumulator {
  return { total: 0, schoolUrns: new Set() };
}

// Latest-period, non-suppressed total per URN -- same discipline as
// fe-participation-roll.ts's own latestNonZeroTotal, reimplemented here (not imported)
// since that module returns a period alongside each total for the map-dot use case,
// which this aggregation doesn't need.
function latestNonZeroTotalPerUrn(
  facts: { entity_id: string; period: number; breakdown: string; value_numeric: number | null }[],
): Map<string, number> {
  const latest = new Map<string, { period: number; value: number }>();
  for (const f of facts) {
    if (f.breakdown !== UNDER_19_TOTAL_BREAKDOWN || f.value_numeric === null || f.value_numeric <= 0) continue;
    const cur = latest.get(f.entity_id);
    if (!cur || f.period > cur.period) latest.set(f.entity_id, { period: f.period, value: f.value_numeric });
  }
  const result = new Map<string, number>();
  for (const [urn, v] of latest) result.set(urn, v.value);
  return result;
}

async function main() {
  const supabase = createServiceRoleSupabaseClient();

  console.log("loading LA -> region map...");
  const regionByLaCode = new Map<string, string>();
  {
    const { data, error } = await supabase.from("la_gss_crosswalk").select("dfe_code, region").not("region", "is", null);
    if (error) throw error;
    for (const row of data as { dfe_code: string; region: string }[]) regionByLaCode.set(row.dfe_code, row.region);
  }
  console.log(`  ${regionByLaCode.size} LAs with a region`);

  console.log("loading FE-participation-scope school -> LA map (open institutions only)...");
  const laCodeByUrn = await loadOpenFeParticipationInstitutions(supabase);
  console.log(`  ${laCodeByUrn.size} open FE-participation-scope institutions loaded`);

  console.log("fetching dfe_fe_participation under-19 totals...");
  const facts = await lookupReferenceData({
    sourceId: "dfe_fe_participation",
    breakdowns: [UNDER_19_TOTAL_BREAKDOWN],
  });
  const totalByUrnRaw = latestNonZeroTotalPerUrn(facts);
  // Real find, checked before this script's first real run: dfe_fe_participation
  // carries facts for institutions that have SINCE closed in GIAS's own current data
  // (e.g. Newham Sixth Form College, Richmond-upon-Thames College -- real, recognisable
  // closures, not junk data) -- latestNonZeroTotalPerUrn happily returns their last real
  // pre-closure figure. Filtered to loadOpenFeParticipationInstitutions' own keys (open
  // institutions only) BEFORE accumulating either scope, so region and national both
  // read the exact same population and can never silently disagree -- same "one pass,
  // one population, region+national filled together" discipline
  // sync-age-profile-aggregates.ts already established for LA+region.
  const { open: totalByUrn, excludedCount: closedInstitutionCount } = excludeClosedInstitutions(totalByUrnRaw, laCodeByUrn);
  console.log(
    `  ${totalByUrnRaw.size} institutions with a real under-19 total, ${closedInstitutionCount} excluded as since-closed, ${totalByUrn.size} used`,
  );

  const regionAcc = new Map<string, Accumulator>();
  const nationalAcc = newAccumulator();

  for (const [urn, total] of totalByUrn) {
    nationalAcc.total += total;
    nationalAcc.schoolUrns.add(urn);

    const laCode = laCodeByUrn.get(urn);
    const region = laCode ? regionByLaCode.get(laCode) : undefined;
    if (region) {
      if (!regionAcc.has(region)) regionAcc.set(region, newAccumulator());
      const acc = regionAcc.get(region)!;
      acc.total += total;
      acc.schoolUrns.add(urn);
    }
  }

  console.log(`accumulated: ${regionAcc.size} regions, national ${nationalAcc.schoolUrns.size} institutions / ${nationalAcc.total} under-19 students`);

  function toRow(scope: "region" | "national", scopeKey: string, acc: Accumulator) {
    return {
      scope,
      scope_key: scopeKey,
      sector: "fe" as const,
      period: TARGET_PERIOD,
      total: acc.total,
      school_count: acc.schoolUrns.size,
      computed_at: new Date().toISOString(),
    };
  }

  const rows = [
    ...Array.from(regionAcc.entries()).map(([region, acc]) => toRow("region", region, acc)),
    toRow("national", "", nationalAcc),
  ];

  console.log(`writing ${rows.length} rows to sixth_form_sector_aggregates...`);
  const { error } = await supabase
    .from("sixth_form_sector_aggregates")
    .upsert(rows, { onConflict: "scope,scope_key,sector,period" });
  if (error) throw error;

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
