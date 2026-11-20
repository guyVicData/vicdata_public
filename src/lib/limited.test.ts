import { test } from "node:test";
import assert from "node:assert/strict";
import { limiter, mapLimited, pagesLimited, retryOnce } from "./limited";
import { isDegraded, markDegraded, traced } from "./build-trace";

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("limiter: never more than n at once, every call answered", async () => {
  const run = limiter(3);
  let now = 0;
  let most = 0;
  const got = await Promise.all(Array.from({ length: 20 }, (_, i) => run(async () => {
    now++;
    most = Math.max(most, now);
    await tick(2);
    now--;
    return i;
  })));
  assert.equal(most, 3);
  assert.deepEqual(got, Array.from({ length: 20 }, (_, i) => i));
});

test("mapLimited: results in item order; a read that fails once is tried again", async () => {
  const tries = new Map<number, number>();
  const got = await mapLimited([1, 2, 3, 4, 5], 2, async (x) => {
    tries.set(x, (tries.get(x) ?? 0) + 1);
    await tick(6 - x);
    if (x === 3 && tries.get(x) === 1) throw new Error("HTTP 500 57014");
    return x * 10;
  });
  assert.deepEqual(got, [10, 20, 30, 40, 50]);
  assert.equal(tries.get(3), 2);
});

test("mapLimited: an item failing both tries rejects", async () => {
  await assert.rejects(mapLimited([1, 2], 2, async (x) => {
    if (x === 2) throw new Error("down");
    return x;
  }), /down/);
});

test("retryOnce: a failed first try that the second replaces doesn't mark the build; two failures do", async () => {
  let n = 0;
  const ok = traced(() => retryOnce(async () => {
    if (n++ === 0) {
      markDegraded(); // what tracedFetch does on a 500
      throw new Error("timeout");
    }
    return "whole";
  }, 1));
  assert.equal(await ok.promise, "whole");
  assert.equal(isDegraded(ok.trace), false);

  const bad = traced(() => retryOnce(async () => {
    markDegraded();
    throw new Error("timeout");
  }, 1).catch(() => "carried past"));
  assert.equal(await bad.promise, "carried past");
  assert.equal(isDegraded(bad.trace), true);

  // A first try that succeeds but read something degraded still marks the build.
  const thin = traced(() => retryOnce(async () => {
    markDegraded();
    return "thin";
  }, 1));
  await thin.promise;
  assert.equal(isDegraded(thin.trace), true);
});

test("pagesLimited: the same rows, in page order, as reading one page after another", async () => {
  const rows = Array.from({ length: 2345 }, (_, i) => i);
  const reads: number[] = [];
  const got = await pagesLimited(async (p) => {
    reads.push(p);
    await tick(Math.random() * 5);
    return rows.slice(p * 100, p * 100 + 100);
  }, 4, 100);
  assert.deepEqual(got, rows);
  assert.ok(reads.length <= 24 + 3, `read ${reads.length} pages`);
  // An exact multiple of the page size ends on an empty page.
  const even = Array.from({ length: 300 }, (_, i) => i);
  assert.deepEqual(await pagesLimited(async (p) => even.slice(p * 100, p * 100 + 100), 3, 100), even);
  assert.deepEqual(await pagesLimited(async () => [] as number[], 3, 100), []);
});

test("pagesLimited: a page failing both tries rejects", async () => {
  await assert.rejects(pagesLimited(async (p) => {
    if (p === 2) throw new Error("down");
    return Array.from({ length: 10 }, () => p);
  }, 2, 10, 8), /down/);
});
