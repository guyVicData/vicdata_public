// 0.6.4 C2: the server's public reference cache (src/lib/server-cache.ts).
// Run: npx -y tsx --test src/lib/server-cache.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cachedReference, clearReferenceCache } from "./server-cache";

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
