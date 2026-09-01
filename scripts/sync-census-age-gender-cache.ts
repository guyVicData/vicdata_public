#!/usr/bin/env -S npx tsx
// Precomputes per-school, per-age, per-sex DfE census headcounts into
// census_age_gender_cache (narrative generator Topic 3 LA-average mechanism, round
// 10 performance fix -- see that table's own migration comment for the full root-
// cause diagnosis). Same fetch/accumulate shape as sync-age-profile-aggregates.ts,
// but per-school rather than pre-summed by geography: computeTopic3SizeSentence
// needs each peer's own individual headcount (to run the same per-tag/per-split
// reliable-headcount logic it already runs client-side) before averaging, not a
// geography-level total.
//
// Usage: npx tsx --env-file=.env scripts/sync-census-age-gender-cache.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";

const PAGE_SIZE = 1000;
const BATCH_SIZE = 10;
const MAX_PAGES = 3000;
const ENTITY_BATCH_SIZE = 100;
const TARGET_PERIOD = CURRENT_CENSUS_PERIOD;

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;
// Same four groups Topic 3 actually queries peers from (State's three raw GIAS
// groups, plus Independent) -- FE/other groups never reach computeTopic3SizeSentence
// (paragraph2SectorSize already gates on a resolved sector), so caching them here
// would be dead weight.
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

async function main() {
  const supabase = createServiceRoleSupabaseClient();

  console.log("loading mainstream school URNs...");
  const mainstreamUrns = new Set<string>();
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("schools")
        .select("urn, establishment_type_group")
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (MAINSTREAM_GROUPS.includes(row.establishment_type_group ?? "")) mainstreamUrns.add(row.urn);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  console.log(`  ${mainstreamUrns.size} mainstream schools loaded`);

  // urn -> age -> { male, female }
  const perSchool = new Map<string, Map<number, { male: number; female: number }>>();

  function accumulate(urn: string, breakdown: string, value: number) {
    const match = AGE_BREAKDOWN_RE.exec(breakdown);
    if (!match) return;
    if (!mainstreamUrns.has(urn)) return;
    const [, , sex, ageStr] = match;
    const age = Number(ageStr);
    if (!perSchool.has(urn)) perSchool.set(urn, new Map());
    const byAge = perSchool.get(urn)!;
    const cur = byAge.get(age) ?? { male: 0, female: 0 };
    cur[sex as "male" | "female"] += value;
    byAge.set(age, cur);
  }

  const urnList = Array.from(mainstreamUrns);
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
  console.log(`done fetching: ${totalRows} rows, ${perSchool.size} schools with real age data`);

  type CacheRow = { urn: string; age: number; male_total: number; female_total: number; period: number };
  const rows: CacheRow[] = [];
  for (const [urn, byAge] of perSchool) {
    for (const [age, counts] of byAge) {
      if (counts.male === 0 && counts.female === 0) continue; // same zero-drop as the columnar RPC -- real signal only
      rows.push({ urn, age, male_total: counts.male, female_total: counts.female, period: TARGET_PERIOD });
    }
  }
  console.log(`writing ${rows.length} cache rows...`);

  // Delete this period's existing rows first (a school's real per-age counts can
  // shrink between syncs, e.g. an amalgamation or closure -- an upsert alone would
  // leave stale ages behind that a fresh fetch no longer reports).
  const { error: deleteError } = await supabase.from("census_age_gender_cache").delete().eq("period", TARGET_PERIOD);
  if (deleteError) throw deleteError;

  const WRITE_BATCH = 5000;
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    const chunk = rows.slice(i, i + WRITE_BATCH);
    const { error } = await supabase.from("census_age_gender_cache").insert(chunk);
    if (error) throw error;
    console.log(`  wrote ${Math.min(i + WRITE_BATCH, rows.length)}/${rows.length}...`);
  }

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
