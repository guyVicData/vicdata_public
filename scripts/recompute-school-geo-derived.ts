#!/usr/bin/env -S npx tsx
// Member Data View performance architecture v1, §3/§4. Recomputes the two derived
// tables that depend only on GEOGRAPHY/ATTRIBUTES already local to this project's own
// `schools` table -- school_nearest_neighbours and school_region_nation -- needing no
// cross-Supabase-project census fetch at all. Run this on every GIAS-affecting ingest
// promote (a school opens/closes/moves/changes LA); see
// docs/vicdata_data_view_open_questions.md for the promote-hook wiring.
//
// Usage: npx tsx --env-file=.env scripts/recompute-school-geo-derived.ts
//
// school_nearest_neighbours is populated via the batch SQL RPC functions defined in
// that table's own migration, called in bounded urn[] chunks rather than one giant
// all-schools query -- a single set-based LATERAL join across all ~52,500 schools is a
// valid SQL statement, but this project has no way to raise the PostgREST/pooler
// statement timeout from application code (no direct Postgres connection available,
// only the REST/RPC interface), so a single huge call risks timing out even though the
// underlying query would eventually finish. Chunking is the same discipline every
// other sync-*.ts script here already applies to reads, extended to a bulk write.
//
// school_region_nation needs no chunked RPC at all -- it's a plain per-row upsert from
// a pure local computation (region-crosswalk.ts against schools.la_name), the same
// shape sync-schools.js's own upserts already use.

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { resolveRegionNation } from "../src/lib/region-crosswalk";

const PAGE_SIZE = 1000;
const GENERAL_BATCH_SIZE = 200;
const BOARDING_BATCH_SIZE = 100;
const RPC_CONCURRENCY = 5;
const MAX_RETRIES = 5;

async function fetchAllSchools(): Promise<{ urn: string; la_name: string | null; boarders_name: string | null; status: string }[]> {
  const supabase = createServiceRoleSupabaseClient();
  const rows: { urn: string; la_name: string | null; boarders_name: string | null; status: string }[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("schools")
      .select("urn, la_name, boarders_name, status")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function rpcWithRetry(fn: string, args: Record<string, unknown>): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.rpc(fn, args);
    if (!error) return;
    if (attempt >= MAX_RETRIES) throw new Error(`${fn} failed after ${MAX_RETRIES} retries: ${error.message}`);
    const delayMs = 2000 * 2 ** attempt;
    console.log(`  retry ${attempt + 1}/${MAX_RETRIES} for ${fn} after error (${error.message}), waiting ${delayMs}ms...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function runBatchesWithConcurrency(batches: string[][], fn: string, label: string) {
  let done = 0;
  for (let i = 0; i < batches.length; i += RPC_CONCURRENCY) {
    const group = batches.slice(i, i + RPC_CONCURRENCY);
    await Promise.all(group.map((batch) => rpcWithRetry(fn, { p_urns: batch })));
    done += group.length;
    console.log(`  ${label}: ${done}/${batches.length} batches`);
  }
}

async function recomputeNearestNeighbours(schools: { urn: string; boarders_name: string | null; status: string }[]) {
  const openUrns = schools.filter((s) => s.status !== "closed").map((s) => s.urn);
  const boardingUrns = schools
    .filter((s) => s.status !== "closed" && s.boarders_name && s.boarders_name !== "No boarders")
    .map((s) => s.urn);

  console.log(`recomputing 'general' nearest-neighbour pool for ${openUrns.length} schools...`);
  await runBatchesWithConcurrency(chunk(openUrns, GENERAL_BATCH_SIZE), "recompute_nearest_neighbours_general_batch", "general pool");

  console.log(`recomputing 'boarding' nearest-neighbour pool for ${boardingUrns.length} boarding schools...`);
  await runBatchesWithConcurrency(chunk(boardingUrns, BOARDING_BATCH_SIZE), "recompute_nearest_neighbours_boarding_batch", "boarding pool");
}

async function recomputeRegionNation(schools: { urn: string; la_name: string | null }[]) {
  const supabase = createServiceRoleSupabaseClient();
  const rows = schools.map((s) => {
    const { regionName, regionCode, nation } = resolveRegionNation(s.la_name);
    return { urn: s.urn, region_name: regionName, region_code: regionCode, nation, computed_at: new Date().toISOString() };
  });
  console.log(`writing ${rows.length} school_region_nation rows...`);
  for (const batch of chunk(rows, PAGE_SIZE)) {
    const { error } = await supabase.from("school_region_nation").upsert(batch, { onConflict: "urn" });
    if (error) throw error;
  }
}

async function main() {
  console.log("loading schools...");
  const schools = await fetchAllSchools();
  console.log(`  ${schools.length} schools loaded`);

  await recomputeNearestNeighbours(schools);
  await recomputeRegionNation(schools);

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
