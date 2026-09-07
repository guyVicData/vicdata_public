#!/usr/bin/env -S npx tsx
// Member Data View performance architecture v1, §3/§4. Recomputes the two derived
// tables that depend only on GEOGRAPHY/ATTRIBUTES already local to this project's own
// `schools` table -- school_nearest_neighbours and school_region_nation -- needing no
// cross-Supabase-project census fetch at all. Run this on every GIAS-affecting ingest
// promote (a school opens/closes/moves/changes LA); see
// docs/vicdata_data_view_open_questions.md for the promote-hook wiring.
//
// Usage: npx tsx --env-file=.env scripts/recompute-school-geo-derived.ts
// Usage (resume a partial run): RESUME_SKIP_DONE=1 npx tsx --env-file=.env scripts/recompute-school-geo-derived.ts
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
// 2026-10-09, real backfill run: even after the nearest_schools() spatial-index fix
// (20261009090000) and the boarding partial index (20261009091000), batch cost isn't
// perfectly uniform across schools -- an unlucky batch containing a genuinely
// slow-to-resolve target (a thin/isolated candidate pool the KNN scan has to walk
// further to fill, or simply an unlucky mix) can still hit the ~8s PostgREST
// statement-timeout ceiling even at a batch size that's comfortably fast on average.
// Retrying an IDENTICAL failing batch doesn't help (it contains the same slow
// school(s) and will just time out again) -- runBatchWithSplitRetry instead halves a
// timed-out batch and recurses, isolating whichever URN(s) are actually expensive
// rather than blindly retrying, down to a floor of 1 (a single truly pathological
// school is logged and skipped rather than blocking the whole run -- recoverable
// later via RESUME_SKIP_DONE, not silently lost).
//
// school_region_nation needs no chunked RPC at all -- it's a plain per-row upsert from
// a pure local computation (region-crosswalk.ts against schools.la_name), the same
// shape sync-schools.js's own upserts already use.

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { resolveRegionNation } from "../src/lib/region-crosswalk";

const PAGE_SIZE = 1000;
// Measured directly against the real post-index-fix, post-ANALYZE database
// (2026-10-09), across several different URN ranges, not just one: per-school KNN
// cost is NOT uniform -- a dense-urban target (Camden, Surrey) resolves a batch of
// 100+ in ~2s, but other URN ranges cost ~200ms EACH even in isolation (confirmed via
// ANALYZE public.schools ruling out stale planner statistics as the cause -- this is
// real, inherent cost variance: a KNN-with-filter scan for a target in a sparse area,
// or with a narrow sector/age-range match, has to walk much further through the index
// to fill LIMIT candidates than a dense-urban target does). A batch size safe for the
// fast case (100+) reliably times out in the slow case; 10 was the largest size that
// stayed comfortably inside the ~8s ceiling even in the slowest range found (~2.2s for
// 10 schools there, ~3.6x margin) -- the split-retry fallback below still absorbs any
// remaining outliers, but shouldn't need to split often at this size. Same reasoning
// for BOARDING_BATCH_SIZE, smaller still: 'boarding' has no LIMIT inside its own
// lateral (needs the FULL national ranking, not just the nearest few -- see
// school_nearest_neighbours' own migration comment), so its GiST index doesn't bound
// its cost the same way, and its true candidate pool (~2,344 -- NOT ~403, see
// docs/vicdata_data_view_open_questions.md for that real miscalculation, found and
// fixed this same run) is itself larger than a typical general-pool age/sector filter.
const GENERAL_BATCH_SIZE = 10;
const BOARDING_BATCH_SIZE = 5;
const RPC_CONCURRENCY = 5;
const MAX_RETRIES = 3;

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

// RESUME_SKIP_DONE=1 (opt-in, off by default -- doesn't change normal promote-hook
// behaviour): skip URNs a pool already has a rank=1 row for, so a run interrupted
// partway through (or one deliberately stopped after making partial progress against
// a time-boxed environment) can be re-run to make cumulative progress instead of
// redoing already-done schools. Kept post-index-fix: batch-level timeouts still
// happen occasionally (see the split-retry comment above), so resumability remains
// genuinely useful, not just a workaround for the pre-fix slowness.
async function fetchDoneUrns(pool: string): Promise<Set<string>> {
  const supabase = createServiceRoleSupabaseClient();
  const done = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("school_nearest_neighbours")
      .select("urn")
      .eq("pool", pool)
      .eq("rank", 1)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) done.add(row.urn as string);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return done;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isTimeoutError(message: string): boolean {
  return /timeout/i.test(message);
}

// Splits a timed-out batch in half and recurses rather than retrying an identical
// batch (which contains the same slow school(s) and would just time out again the
// same way) -- see this file's own header comment for the full reasoning. Non-timeout
// errors still use plain exponential-backoff retry (a real transient network/DB blip,
// where retrying the SAME batch is the right response).
async function runBatchWithSplitRetry(fn: string, urns: string[], label: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.rpc(fn, { p_urns: urns });
    if (!error) return;
    if (isTimeoutError(error.message) && urns.length > 1) {
      const mid = Math.floor(urns.length / 2);
      console.log(`  ${label}: batch of ${urns.length} timed out, splitting into ${mid} + ${urns.length - mid}...`);
      await runBatchWithSplitRetry(fn, urns.slice(0, mid), label);
      await runBatchWithSplitRetry(fn, urns.slice(mid), label);
      return;
    }
    if (attempt >= MAX_RETRIES) {
      if (urns.length === 1) {
        console.log(`  ${label}: giving up on urn ${urns[0]} after ${MAX_RETRIES} retries (${error.message}) -- skipped, not fatal to the run.`);
        return;
      }
      throw new Error(`${fn} failed after ${MAX_RETRIES} retries for a batch of ${urns.length}: ${error.message}`);
    }
    const delayMs = 1500 * 2 ** attempt;
    console.log(`  ${label}: retry ${attempt + 1}/${MAX_RETRIES} after error (${error.message}), waiting ${delayMs}ms...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function runBatchesWithConcurrency(batches: string[][], fn: string, label: string) {
  let done = 0;
  for (let i = 0; i < batches.length; i += RPC_CONCURRENCY) {
    const group = batches.slice(i, i + RPC_CONCURRENCY);
    await Promise.all(group.map((batch) => runBatchWithSplitRetry(fn, batch, label)));
    done += group.length;
    console.log(`  ${label}: ${done}/${batches.length} batches`);
  }
}

async function recomputeNearestNeighbours(schools: { urn: string; boarders_name: string | null; status: string }[]) {
  const openUrns = schools.filter((s) => s.status !== "closed").map((s) => s.urn);
  const boardingUrns = schools
    .filter((s) => s.status !== "closed" && s.boarders_name && s.boarders_name !== "No boarders")
    .map((s) => s.urn);

  const resumeSkipDone = process.env.RESUME_SKIP_DONE === "1";

  let generalTodo = openUrns;
  if (resumeSkipDone) {
    const doneGeneral = await fetchDoneUrns("general");
    generalTodo = openUrns.filter((u) => !doneGeneral.has(u));
    console.log(`  RESUME_SKIP_DONE=1: ${doneGeneral.size} already done, ${generalTodo.length} remaining`);
  }
  console.log(`recomputing 'general' nearest-neighbour pool for ${generalTodo.length} schools...`);
  await runBatchesWithConcurrency(chunk(generalTodo, GENERAL_BATCH_SIZE), "recompute_nearest_neighbours_general_batch", "general pool");

  let boardingTodo = boardingUrns;
  if (resumeSkipDone) {
    const doneBoarding = await fetchDoneUrns("boarding");
    boardingTodo = boardingUrns.filter((u) => !doneBoarding.has(u));
    console.log(`  RESUME_SKIP_DONE=1: ${doneBoarding.size} already done, ${boardingTodo.length} remaining`);
  }
  console.log(`recomputing 'boarding' nearest-neighbour pool for ${boardingTodo.length} boarding schools (true national boarding population -- see this file's own header comment for why this is ~2,344, not ~403)...`);
  await runBatchesWithConcurrency(chunk(boardingTodo, BOARDING_BATCH_SIZE), "recompute_nearest_neighbours_boarding_batch", "boarding pool");
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
