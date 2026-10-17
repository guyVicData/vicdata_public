// VicData 0.8 database load: reference reads cached until their source's promote stamp moves.
// Run: npx -y tsx --test src/lib/reference-cache.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeReferenceCache, makeSourceStamps, REFERENCE_FALLBACK_TTL_MS } from "./reference-cache";

const clock = () => {
  let t = 0;
  return { now: () => t, add: (ms: number) => (t += ms) };
};

test("a read is kept while its source's stamp is unchanged, and read again when it moves", async () => {
  const c = clock();
  let stamp: string | null = "s1";
  let loads = 0;
  const cache = makeReferenceCache({ stamp: async () => stamp, now: c.now });
  const load = async () => (loads++, [{ v: 1 }]);
  await cache.get("src", "k", load);
  c.add(3 * 60 * 60_000);
  await cache.get("src", "k", load);
  assert.equal(loads, 1, "unchanged stamp: one read, even after the old hour");
  stamp = "s2";
  await cache.get("src", "k", load);
  assert.equal(loads, 2, "a new promote: read again");
});

test("with no stamp, a read is kept for the old hour", async () => {
  const c = clock();
  let loads = 0;
  const cache = makeReferenceCache({ stamp: async () => null, now: c.now });
  const load = async () => (loads++, [{ v: 1 }]);
  await cache.get("src", "k", load);
  c.add(REFERENCE_FALLBACK_TTL_MS - 1);
  await cache.get("src", "k", load);
  assert.equal(loads, 1);
  c.add(2);
  await cache.get("src", "k", load);
  assert.equal(loads, 2);
});

test("a failed read isn't kept; callers get their own copies; big answers aren't kept", async () => {
  const cache = makeReferenceCache({ stamp: async () => "s", maxRows: 2 });
  let n = 0;
  await assert.rejects(cache.get("src", "bad", async () => { n++; throw new Error("57014"); }));
  await assert.rejects(cache.get("src", "bad", async () => { n++; throw new Error("57014"); }));
  assert.equal(n, 2);
  const a = await cache.get("src", "k", async () => [{ v: 1 }]);
  a[0].v = 99;
  const b = await cache.get("src", "k", async () => [{ v: 2 }]);
  assert.equal(b[0].v, 1, "the cached row is untouched and the second caller doesn't read again");
  let big = 0;
  for (let i = 0; i < 2; i++) await cache.get("src", "big", async () => (big++, [{}, {}, {}]));
  assert.equal(big, 2, "over maxRows: not kept");
});

test("an aborted caller stops waiting; the shared read still serves the others", async () => {
  const cache = makeReferenceCache({ stamp: async () => "s" });
  let release!: (v: { v: number }[]) => void;
  const pending = new Promise<{ v: number }[]>((r) => (release = r));
  const ctl = new AbortController();
  const first = cache.get("src", "k", () => pending, ctl.signal);
  const second = cache.get("src", "k", async () => [{ v: 2 }]);
  ctl.abort();
  await assert.rejects(first);
  release([{ v: 1 }]);
  assert.deepEqual(await second, [{ v: 1 }]);
});

test("source stamps: read at most once a minute; a failed read keeps the last stamps", async () => {
  const c = clock();
  let reads = 0;
  let fail = false;
  const stamps = makeSourceStamps(async () => { reads++; if (fail) throw new Error("down"); return { a: `t${reads}` }; }, c.now);
  assert.equal(await stamps("a"), "t1");
  assert.equal(await stamps("a"), "t1");
  assert.equal(await stamps("b"), null);
  assert.equal(reads, 1);
  c.add(60_000);
  fail = true;
  assert.equal(await stamps("a"), "t1", "kept when the read fails");
  assert.equal(reads, 2);
});
