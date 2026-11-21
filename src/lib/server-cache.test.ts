// 0.6.4 C2: the server's public reference cache (src/lib/server-cache.ts).
// 20 Nov: bounded by memory too (the instance ran out of heap).
// Run: npx -y tsx --test src/lib/server-cache.test.ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  cachedReference,
  clearReferenceCache,
  estimateBytes,
  hasReference,
  referenceCacheStats,
  setReferenceCacheLimitsForTests,
} from "./server-cache";

const tick = () => new Promise((r) => setImmediate(r));
// A string of about `kb` KB in the estimate (2 bytes a character).
const blob = (kb: number) => "x".repeat(kb * 512);
// Is the key kept? A kept key answers without calling load. (A miss inserts a probe entry.)
const isKept = (key: string) => {
  let loaded = false;
  void cachedReference(key, async () => {
    loaded = true;
    return null;
  });
  return !loaded;
};

beforeEach(() => {
  clearReferenceCache();
  setReferenceCacheLimitsForTests();
});

test("one load per key while fresh; the same value to every caller", async () => {
  clearReferenceCache();
  let loads = 0;
  const load = async () => ({ n: ++loads });
  const [a, b] = await Promise.all([cachedReference("k", load), cachedReference("k", load)]);
  assert.equal(loads, 1, "concurrent callers share one load");
  assert.equal(a, b);
  assert.equal(await cachedReference("k", load), a);
  assert.equal(loads, 1);
  await cachedReference("other", load);
  assert.equal(loads, 2, "another key loads on its own");
});

test("stale after its time; errors are never kept", async () => {
  clearReferenceCache();
  let loads = 0;
  await cachedReference("t", async () => ++loads, 0);
  await cachedReference("t", async () => ++loads, 0);
  assert.equal(loads, 2, "a ttl of 0 always reloads");
  await assert.rejects(cachedReference("e", async () => { throw new Error("down"); }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await cachedReference("e", async () => "back"), "back", "the next call tries again");
});

test("evicts least recently used once over the byte budget", async () => {
  setReferenceCacheLimitsForTests(110 * 1024); // 110 KB: five ~20 KB values fit, a sixth does not
  for (const k of ["a", "b", "c", "d", "e"]) await cachedReference(k, async () => blob(20));
  await tick();
  assert.equal(referenceCacheStats().evictions, 0);
  await cachedReference("f", async () => blob(20));
  await tick();
  const s = referenceCacheStats();
  assert.ok(s.evictions >= 1, JSON.stringify(s));
  assert.ok(s.approxBytes <= 110 * 1024, JSON.stringify(s));
    assert.equal(isKept("f"), true);
  assert.equal(isKept("e"), true);
  assert.equal(isKept("a"), false, "the oldest goes first");
});

test("a hit refreshes recency", async () => {
  setReferenceCacheLimitsForTests(110 * 1024);
  for (const k of ["a", "b", "c", "d", "e"]) await cachedReference(k, async () => blob(20));
  await tick();
  let reloaded = false;
  await cachedReference("a", async () => {
    reloaded = true;
    return blob(20);
  });
  assert.equal(reloaded, false, "a is a hit");
  await cachedReference("f", async () => blob(20));
  await tick();
    assert.equal(isKept("a"), true, "a was used, so b goes instead");
  assert.equal(isKept("b"), false);
});

test("the key cap still holds", async () => {
  setReferenceCacheLimitsForTests(undefined, 3);
  for (const k of ["a", "b", "c", "d"]) await cachedReference(k, async () => 1);
  await tick();
  assert.equal(referenceCacheStats().entries, 3);
  assert.equal(isKept("a"), false);
});

test("a value over a quarter of the budget is returned but not kept", async () => {
  setReferenceCacheLimitsForTests(100 * 1024);
  const big = blob(30);
  assert.equal(await cachedReference("big", async () => big), big);
  await tick();
  const s = referenceCacheStats();
  assert.equal(s.oversizedSkips, 1);
  assert.equal(s.entries, 0);
  assert.equal(s.approxBytes, 0);
});

test("errors are never kept", async () => {
  await assert.rejects(cachedReference("err", async () => Promise.reject(new Error("boom"))));
  await tick();
  assert.equal(referenceCacheStats().entries, 0);
  assert.equal(await cachedReference("err", async () => "ok"), "ok");
});

test("callers of a key still loading share one promise", async () => {
  let calls = 0;
  let release!: (v: string) => void;
  const load = () => {
    calls++;
    return new Promise<string>((r) => (release = r));
  };
  const p1 = cachedReference("k", load);
  const p2 = cachedReference("k", load);
  assert.equal(p1, p2);
  release("v");
  assert.equal(await p1, "v");
  assert.equal(calls, 1);
});

test("TTL: a value older than ttlMs is fetched afresh, and the bytes are not double-counted", async () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    let calls = 0;
    const load = async () => {
      calls++;
      return blob(10);
    };
    await cachedReference("t", load, 1000);
    await tick();
    const first = referenceCacheStats().approxBytes;
    now += 999;
    await cachedReference("t", load, 1000);
    assert.equal(calls, 1, "still fresh");
    now += 1;
    await cachedReference("t", load, 1000);
    assert.equal(calls, 2, "expired");
    await tick();
    assert.equal(referenceCacheStats().approxBytes, first);
    assert.equal(referenceCacheStats().entries, 1);
  } finally {
    Date.now = realNow;
  }
});

test("size estimate: roughly right, cheap on big arrays, safe on cycles", () => {
  assert.equal(estimateBytes("abcd"), 16 + 8);
  const rows = Array.from({ length: 200_000 }, (_, i) => ({ urn: i, name: "School name here", score: i / 3 }));
  const t0 = performance.now();
  const est = estimateBytes(rows);
  const ms = performance.now() - t0;
  const exact = 32 + 8 * rows.length + rows.length * (32 + 8 * 3 + 8 + (16 + 32) + 8);
  assert.ok(Math.abs(est - exact) / exact < 0.01, `${est} vs ${exact}`);
  assert.ok(ms < 50, `${ms} ms`);
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  assert.ok(Number.isFinite(estimateBytes(cyclic)));
});

test("national, same-for-everyone keys keep 12 hours by default; a school's own keep the hour", async () => {
  const { defaultTtlFor, NATIONAL_TTL_MS, REFERENCE_TTL_MS } = await import("./server-cache");
  for (const k of ["smt:population:ks5", "igcse:england", "years:latest", "dashboard:england:ks4", "adm:england-schools:2025", "smt:family-map:ks4"]) assert.equal(defaultTtlFor(k), NATIONAL_TTL_MS, k);
  for (const k of ["smt:census:110110", "school:la:110110", "smt:qrows:ks5:2016:abc", "geo:grades:ks4:x"]) assert.equal(defaultTtlFor(k), REFERENCE_TTL_MS, k);
});

// 21 Nov (the national preload): Next builds instrumentation.ts apart from the routes, so each gets its own copy of
// this module. A second copy is loaded here (a different module URL is a different instance) and must share the
// one store, its byte total, its LRU order and its caps -- the copy the preload fills is the copy a request reads.
test("one store per process: a second copy of the module shares the cache, its LRU and its budget", async () => {
  const other = (await import(`./server-cache.ts?copy=${Date.now()}`)) as typeof import("./server-cache");
  assert.notEqual(other.cachedReference, cachedReference, "a separate module instance");
  setReferenceCacheLimitsForTests(400 * 1024);
  let loads = 0;
  const v = await other.cachedReference("shared:a", async () => (loads++, "x".repeat(20 * 1024)));
  assert.equal(await cachedReference("shared:a", async () => (loads++, "y")), v, "the preload's copy fills, the route's copy hits");
  assert.equal(loads, 1);
  await tick();
  assert.deepEqual(other.referenceCacheStats(), referenceCacheStats(), "one set of counters");
  assert.ok(referenceCacheStats().approxBytes > 40 * 1024, "the value is counted once, in the shared total");
  // The budget (set through the first copy) holds across both: twelve more ~40 KB values, alternately through each
  // copy, into a 400 KB budget.
  for (let i = 0; i < 12; i++) {
    await (i % 2 ? other : { cachedReference }).cachedReference(`shared:${i}`, async () => "z".repeat(20 * 1024));
    await tick();
  }
  assert.ok(referenceCacheStats().approxBytes <= 400 * 1024, "under the one budget");
  assert.ok(referenceCacheStats().evictions >= 1, "least recently used dropped");
  assert.equal(other.hasReference("shared:a"), false, "the oldest went first, whichever copy stored it");
  assert.equal(hasReference("shared:11"), true);
  other.clearReferenceCache();
  assert.equal(referenceCacheStats().entries, 0, "one store");
});
