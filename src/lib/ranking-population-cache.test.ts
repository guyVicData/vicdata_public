// The ranking population is kept until the next school sync (or six hours), and the sync stamp is
// read at most once a minute: after the 16 Oct 2026 GIAS refresh a running server ranked against the
// pre-sync population for hours (Leighton Park's GCSE Biology "=854th of 3,443" on Teacher where the
// synced data gives "=851st of 3,433").
// Run: npx -y tsx --test src/lib/ranking-population-cache.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRankingPopulationCache, POPULATION_CACHE_MS } from "./ranking-population-cache";
import { makeSchoolSyncStamp, SYNC_CHECK_MS } from "./school-sync-stamp";
import type { PopulationRow } from "./comparator-chooser";

const row = (urn: string): PopulationRow => [urn, `School ${urn}`, "Independent", null, null, null];

function harness() {
  let clock = 0;
  let stamp = "2026-10-15T09:00:00Z";
  const builds: string[] = [];
  let next = ["110110", "117018"];
  const get = makeRankingPopulationCache(
    async (regionCode, phase) => {
      builds.push(`${regionCode ?? "england"}|${phase}`);
      return next.map(row);
    },
    async () => stamp,
    () => clock,
  );
  return {
    get,
    builds,
    tick: (ms: number) => (clock += ms),
    sync: (s: string, urns: string[]) => {
      stamp = s;
      next = urns;
    },
  };
}

test("the same sync: one build, then the cached population", async () => {
  const h = harness();
  const a = await h.get(null, "ks4", null);
  h.tick(60 * 60_000);
  const b = await h.get(null, "ks4", null);
  assert.equal(h.builds.length, 1);
  assert.strictEqual(b, a);
});

test("a school sync clears it at once, however young the population is", async () => {
  const h = harness();
  assert.deepEqual((await h.get(null, "ks4", null)).map((r) => r[0]), ["110110", "117018"]);
  h.tick(60_000);
  h.sync("2026-10-16T10:45:00Z", ["110110"]); // A1: 117018 closed
  assert.deepEqual((await h.get(null, "ks4", null)).map((r) => r[0]), ["110110"]);
  assert.equal(h.builds.length, 2);
});

test("each scope and phase is its own entry; six hours still expire it", async () => {
  const h = harness();
  await h.get(null, "ks4", null);
  await h.get("E12000008", "ks4", null);
  await h.get(null, "ks5", null);
  assert.deepEqual(h.builds, ["england|ks4", "E12000008|ks4", "england|ks5"]);
  h.tick(POPULATION_CACHE_MS);
  await h.get(null, "ks4", null);
  assert.equal(h.builds.length, 4);
});

test("the sync stamp is read at most once a minute, and the last one stands if a read fails", async () => {
  let clock = 0;
  const reads: number[] = [];
  let answer: () => Promise<string> = async () => "2026-10-15T09:00:00Z";
  const stamp = makeSchoolSyncStamp(() => (reads.push(clock), answer()), () => clock);
  assert.equal(await stamp(), "2026-10-15T09:00:00Z");
  clock += SYNC_CHECK_MS - 1;
  answer = async () => "2026-10-16T10:45:00Z";
  assert.equal(await stamp(), "2026-10-15T09:00:00Z");
  assert.equal(reads.length, 1);
  clock += 1;
  assert.equal(await stamp(), "2026-10-16T10:45:00Z");
  clock += SYNC_CHECK_MS;
  answer = async () => {
    throw new Error("HTTP 500");
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await stamp(), "2026-10-16T10:45:00Z");
  } finally {
    console.warn = warn;
  }
  assert.equal(reads.length, 3);
});
