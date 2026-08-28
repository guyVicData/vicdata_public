#!/usr/bin/env -S npx tsx
// Precomputes single-year-age (5-15) DfE census pupil totals into
// age_profile_aggregates, by LA and by ONS region (dashboard rebuild, Shape card's
// "population trend in the area" piece -- see that table's own migration comment for
// why this is real school-enrolment data, not true population data, and why it's
// precomputed rather than live). Same fetch/accumulate shape as
// sync-roll-aggregates.ts/sync-age-band-distributions.ts.
//
// Usage: npx tsx --env-file=.env scripts/sync-age-profile-aggregates.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";

const PAGE_SIZE = 1000;
const BATCH_SIZE = 10;
const MAX_PAGES = 3000;
const ENTITY_BATCH_SIZE = 100;
const TARGET_PERIOD = CURRENT_CENSUS_PERIOD;
const MIN_AGE = 5;
const MAX_AGE = 15;

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;
const MAINSTREAM_GROUPS = ["Academies", "Local authority maintained schools", "Independent schools", "Free Schools"];
const MAX_RETRIES = 5;

async function fetchPage(
  entityIds: string[],
  offset: number,
): Promise<{ entity_id: string; breakdown: string; value_numeric: number | null }[]> {
  const apiUrl = process.env.VICDATA_API_URL!;
  const anonKey = process.env.VICDATA_ANON_KEY!;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${apiUrl}/rest/v1/rpc/reference_data_lookup`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_source_id: "dfe_school_census",
        p_entity_ids: entityIds,
        p_period_min: TARGET_PERIOD,
        p_period_max: TARGET_PERIOD,
        p_limit: PAGE_SIZE,
        p_offset: offset,
        p_breakdowns: null,
      }),
    });
    if (res.ok) return res.json();
    const body = await res.text();
    if (attempt >= MAX_RETRIES) {
      throw new Error(`reference_data_lookup failed after ${MAX_RETRIES} retries: HTTP ${res.status} ${body}`);
    }
    const delayMs = 2000 * 2 ** attempt;
    console.log(`  retry ${attempt + 1}/${MAX_RETRIES} after HTTP ${res.status} (offset ${offset}), waiting ${delayMs}ms...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

type Accumulator = { byAge: Map<number, number>; schoolUrns: Set<string> };
function newAccumulator(): Accumulator {
  return { byAge: new Map(), schoolUrns: new Set() };
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

  console.log("loading school -> LA map...");
  const laByUrn = new Map<string, { laName: string | null; laCode: string | null }>();
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("schools")
        .select("urn, la_name, la_code, establishment_type_group")
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (MAINSTREAM_GROUPS.includes(row.establishment_type_group ?? "")) {
          laByUrn.set(row.urn, { laName: row.la_name, laCode: row.la_code });
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  console.log(`  ${laByUrn.size} mainstream schools loaded`);

  const laAcc = new Map<string, Accumulator>();
  const regionAcc = new Map<string, Accumulator>();

  function accumulate(urn: string, breakdown: string, value: number) {
    const match = AGE_BREAKDOWN_RE.exec(breakdown);
    if (!match) return;
    const [, , , ageStr] = match;
    const age = Number(ageStr);
    if (age < MIN_AGE || age > MAX_AGE) return;
    const school = laByUrn.get(urn);
    if (!school) return;

    if (school.laName) {
      if (!laAcc.has(school.laName)) laAcc.set(school.laName, newAccumulator());
      const acc = laAcc.get(school.laName)!;
      acc.byAge.set(age, (acc.byAge.get(age) ?? 0) + value);
      acc.schoolUrns.add(urn);
    }
    const region = school.laCode ? regionByLaCode.get(school.laCode) : undefined;
    if (region) {
      if (!regionAcc.has(region)) regionAcc.set(region, newAccumulator());
      const acc = regionAcc.get(region)!;
      acc.byAge.set(age, (acc.byAge.get(age) ?? 0) + value);
      acc.schoolUrns.add(urn);
    }
  }

  const urnList = Array.from(laByUrn.keys());
  const entityBatches: string[][] = [];
  for (let i = 0; i < urnList.length; i += ENTITY_BATCH_SIZE) {
    entityBatches.push(urnList.slice(i, i + ENTITY_BATCH_SIZE));
  }
  console.log(`fetching dfe_school_census for period ${TARGET_PERIOD} in ${entityBatches.length} entity batches...`);

  async function fetchBatch(batch: string[]): Promise<number> {
    let offset = 0;
    let rowCount = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = await fetchPage(batch, offset);
      for (const row of rows) {
        if (row.value_numeric !== null) accumulate(row.entity_id, row.breakdown, row.value_numeric);
      }
      rowCount += rows.length;
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return rowCount;
  }

  let totalRows = 0;
  for (let i = 0; i < entityBatches.length; i += BATCH_SIZE) {
    const group = entityBatches.slice(i, i + BATCH_SIZE);
    const counts = await Promise.all(group.map(fetchBatch));
    totalRows += counts.reduce((a, b) => a + b, 0);
    console.log(`  batches ${i + group.length}/${entityBatches.length}, ${totalRows} rows so far...`);
  }
  console.log(`done fetching: ${totalRows} rows, ${laAcc.size} LAs, ${regionAcc.size} regions`);

  function toRow(scope: "la" | "region", scopeKey: string, acc: Accumulator) {
    const byAge: Record<string, number> = {};
    for (let age = MIN_AGE; age <= MAX_AGE; age++) byAge[String(age)] = acc.byAge.get(age) ?? 0;
    return {
      scope,
      scope_key: scopeKey,
      period: TARGET_PERIOD,
      by_age: byAge,
      school_count: acc.schoolUrns.size,
      computed_at: new Date().toISOString(),
    };
  }

  const rows = [
    ...Array.from(laAcc.entries()).map(([la, acc]) => toRow("la", la, acc)),
    ...Array.from(regionAcc.entries()).map(([region, acc]) => toRow("region", region, acc)),
  ];

  console.log(`writing ${rows.length} age-profile rows...`);
  const { error } = await supabase
    .from("age_profile_aggregates")
    .upsert(rows, { onConflict: "scope,scope_key,period" });
  if (error) throw error;

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
