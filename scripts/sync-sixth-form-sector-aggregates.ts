#!/usr/bin/env -S npx tsx
// Precomputes real DfE census sixth-form (16-18) roll, split State vs Independent, at
// LA/region/national scope, into sixth_form_sector_aggregates (Prompt B's
// characterization -> this build -- see that table's own migration comment for the
// scope-naming rationale). Writes sector='state'/'independent' rows only -- sector='fe'
// rows come from a genuinely separate script (sync-fe-participation-region-national.ts,
// a SUM over dfe_fe_participation, not a re-derivation of census data).
//
// Reads census_age_gender_cache (per-school, per-age, per-sex, MAINSTREAM_GROUPS-scoped,
// scripts/sync-census-age-gender-cache.ts) rather than re-fetching dfe_school_census live
// via the paginated reference_data_lookup RPC the way sync-age-profile-aggregates.ts
// does -- that cache already carries the exact same real per-school age totals this
// needs, confirmed against it directly during Prompt B's own characterization (2,757
// State / 735 Independent schools with real non-zero 16-18 data, matching this script's
// own real run below). A single indexed table read instead of ~231 paginated RPC
// batches for the same ~23,114-school population -- same reasoning narrative-lookup.ts's
// own round-10 performance fix already established for reading this cache over live
// fetching.
//
// LA -> region rollup follows sync-age-profile-aggregates.ts's own pattern exactly
// (la_gss_crosswalk.region, one pass, LA and region accumulators filled together so
// they can never silently disagree) -- with a national accumulator added, which that
// sibling script doesn't have.
//
// Usage: npx tsx --env-file=.env scripts/sync-sixth-form-sector-aggregates.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";

const TARGET_PERIOD = CURRENT_CENSUS_PERIOD;
const MIN_AGE = 16;
const MAX_AGE = 18;

const STATE_GROUPS = new Set(["Academies", "Local authority maintained schools", "Free Schools"]);
const INDEPENDENT_GROUP = "Independent schools";
type Sector = "state" | "independent";

type Accumulator = { total: number; schoolUrns: Set<string> };
function newAccumulator(): Accumulator {
  return { total: 0, schoolUrns: new Set() };
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

  console.log("loading school -> sector/LA map...");
  const schoolByUrn = new Map<string, { sector: Sector; laName: string | null; laCode: string | null }>();
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("schools")
        .select("urn, la_name, la_code, establishment_type_group")
        .neq("status", "closed")
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data as { urn: string; la_name: string | null; la_code: string | null; establishment_type_group: string | null }[]) {
        const sector: Sector | null = STATE_GROUPS.has(row.establishment_type_group ?? "")
          ? "state"
          : row.establishment_type_group === INDEPENDENT_GROUP
            ? "independent"
            : null;
        if (sector) schoolByUrn.set(row.urn, { sector, laName: row.la_name, laCode: row.la_code });
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  console.log(`  ${schoolByUrn.size} mainstream (State+Independent) schools loaded`);

  console.log(`loading census_age_gender_cache ages ${MIN_AGE}-${MAX_AGE}, period ${TARGET_PERIOD}...`);
  const perSchoolTotal = new Map<string, number>();
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("census_age_gender_cache")
        .select("urn, age, male_total, female_total")
        .eq("period", TARGET_PERIOD)
        .gte("age", MIN_AGE)
        .lte("age", MAX_AGE)
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data as { urn: string; male_total: number; female_total: number }[]) {
        perSchoolTotal.set(row.urn, (perSchoolTotal.get(row.urn) ?? 0) + row.male_total + row.female_total);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  console.log(`  ${perSchoolTotal.size} schools with any age ${MIN_AGE}-${MAX_AGE} cache row`);

  const laAcc = new Map<string, Record<Sector, Accumulator>>();
  const regionAcc = new Map<string, Record<Sector, Accumulator>>();
  const nationalAcc: Record<Sector, Accumulator> = { state: newAccumulator(), independent: newAccumulator() };

  for (const [urn, total] of perSchoolTotal) {
    if (total <= 0) continue; // real, non-zero only -- same "don't dilute with schools that have no sixth form at all" discipline as age_band_pupil_distributions
    const school = schoolByUrn.get(urn);
    if (!school) continue; // not a mainstream State/Independent school (or closed) -- shouldn't happen given the cache's own MAINSTREAM_GROUPS scope, defensive only

    nationalAcc[school.sector].total += total;
    nationalAcc[school.sector].schoolUrns.add(urn);

    if (school.laName) {
      if (!laAcc.has(school.laName)) laAcc.set(school.laName, { state: newAccumulator(), independent: newAccumulator() });
      const acc = laAcc.get(school.laName)![school.sector];
      acc.total += total;
      acc.schoolUrns.add(urn);
    }

    const region = school.laCode ? regionByLaCode.get(school.laCode) : undefined;
    if (region) {
      if (!regionAcc.has(region)) regionAcc.set(region, { state: newAccumulator(), independent: newAccumulator() });
      const acc = regionAcc.get(region)![school.sector];
      acc.total += total;
      acc.schoolUrns.add(urn);
    }
  }

  console.log(`accumulated: ${laAcc.size} LAs, ${regionAcc.size} regions`);
  console.log(
    `national: state ${nationalAcc.state.schoolUrns.size} schools/${nationalAcc.state.total} pupils, ` +
      `independent ${nationalAcc.independent.schoolUrns.size} schools/${nationalAcc.independent.total} pupils`,
  );

  function toRow(scope: "la" | "region" | "national", scopeKey: string, sector: Sector, acc: Accumulator) {
    return {
      scope,
      scope_key: scopeKey,
      sector,
      period: TARGET_PERIOD,
      total: acc.total,
      school_count: acc.schoolUrns.size,
      computed_at: new Date().toISOString(),
    };
  }

  const rows = [
    ...Array.from(laAcc.entries()).flatMap(([la, bySector]) =>
      (["state", "independent"] as Sector[])
        .filter((s) => bySector[s].schoolUrns.size > 0)
        .map((s) => toRow("la", la, s, bySector[s])),
    ),
    ...Array.from(regionAcc.entries()).flatMap(([region, bySector]) =>
      (["state", "independent"] as Sector[])
        .filter((s) => bySector[s].schoolUrns.size > 0)
        .map((s) => toRow("region", region, s, bySector[s])),
    ),
    ...(["state", "independent"] as Sector[]).map((s) => toRow("national", "", s, nationalAcc[s])),
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
