// Speed plan §4.2 item 2: the shared results cache's rules (results-cache.ts, build-trace.ts).
// npx tsx --test src/lib/results-cache.test.ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cachedResult, codeFor, dataVersionOf, postgresStore, resultKey, resultsCacheStats, setResultsCacheForTests, stableJson, viewKeyPattern, viewOfKey, type ResultsStore, type RowToWrite, type StoredRow, type Versions } from "./results-cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cachedReference, clearReferenceCache } from "./server-cache";
import { markDegraded, tracedFetch, traced, isDegraded } from "./build-trace";

// ---- a Map store and a clock ---------------------------------------------------------------------

type Row = RowToWrite & { created_at: number; last_read_at: number };
function memoryStore(clock: { t: number }) {
  const rows = new Map<string, Row>();
  const calls = { read: 0, write: 0, touch: 0, prune: 0 };
  let failRead = false;
  let failWrite = false;
  const store: ResultsStore = {
    async read(key, v, notBefore) {
      calls.read++;
      if (failRead) throw new Error("read down");
      const r = rows.get(key);
      if (!r || r.data_version !== v.data || r.code_version !== v.code || r.created_at < notBefore.getTime()) return null;
      return { value: r.value, created_at: new Date(r.created_at).toISOString(), last_read_at: new Date(r.last_read_at).toISOString() } satisfies StoredRow;
    },
    async write(row) {
      calls.write++;
      if (failWrite) throw new Error("write down");
      rows.set(row.key, { ...row, created_at: clock.t, last_read_at: clock.t });
    },
    async touch(key, at) {
      calls.touch++;
      const r = rows.get(key);
      if (r) r.last_read_at = at.getTime();
    },
    async prune() {
      calls.prune++;
    },
  };
  return { store, rows, calls, setFailRead: (b: boolean) => (failRead = b), setFailWrite: (b: boolean) => (failWrite = b) };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

let clock: { t: number };
let mem: ReturnType<typeof memoryStore>;
let versions: Versions;

function setup(o: { enabled?: boolean } = {}) {
  clearReferenceCache();
  setResultsCacheForTests({ store: mem.store, versions: async () => versions, now: () => clock.t, enabled: o.enabled ?? true, defer: (fn) => fn() });
}

/** A "new process": memory emptied, the store kept. */
function restart() {
  clearReferenceCache();
  setResultsCacheForTests({ store: mem.store, versions: async () => versions, now: () => clock.t, enabled: true, defer: (fn) => fn() });
}

/** A build that "takes" ms on the fake clock and counts its runs. */
function builder<T>(value: () => T, ms = 2_000) {
  const b = {
    runs: 0,
    fn: async () => {
      b.runs++;
      clock.t += ms;
      return value();
    },
  };
  return b;
}

beforeEach(() => {
  clock = { t: Date.parse("2026-11-20T12:00:00Z") };
  mem = memoryStore(clock);
  versions = { data: "d1", code: "c1", settled: true };
  setup();
});

// ---- keys ---------------------------------------------------------------------------------------

test("keys: object key order doesn't matter, array order does, and every input counts", () => {
  assert.equal(stableJson({ b: 1, a: { d: 2, c: 3 } }), stableJson({ a: { c: 3, d: 2 }, b: 1 }));
  assert.notEqual(resultKey("smt/academic", "110110", { set: { urns: ["1", "2"] } }), resultKey("smt/academic", "110110", { set: { urns: ["2", "1"] } }));
  const base = { set: { kind: "nearest", label: "10 nearest", urns: ["100001", "100002"] }, state: { phase: "gcse", mode: "results" } };
  const k = resultKey("smt/academic", "110110", base);
  assert.equal(k, resultKey("smt/academic", "110110", JSON.parse(JSON.stringify(base))));
  assert.match(k, /^smt\/academic\|110110\|[0-9a-f]{32}$/);
  assert.notEqual(k, resultKey("smt/academic", "138695", base), "another school");
  assert.notEqual(k, resultKey("smt/overview", "110110", base), "another view");
  assert.notEqual(k, resultKey("smt/academic", "110110", { ...base, set: { ...base.set, label: "Mine" } }), "the set's label shows in the answer");
  assert.notEqual(k, resultKey("smt/academic", "110110", { ...base, state: { ...base.state, mode: "entries" } }), "another state");
  assert.notEqual(resultKey("smt/overview", "1", { privateNote: null }), resultKey("smt/overview", "1", { privateNote: "Private to the school" }), "a head office the school doesn't share with");
  assert.notEqual(stableJson({ m: new Map([["a", 1]]) }), stableJson({ m: new Map([["a", 2]]) }), "Maps are keyed by content");
});

test("data version: from every stamp, the sync, the entry year and the epoch; null before any stamp", () => {
  const parts = { stamps: { a: "2026-10-01T00:00:00Z", b: "2026-10-02T00:00:00Z" }, sync: "2026-10-16T10:32:10Z", entryYear: 2027, epoch: "" };
  const at = Date.parse("2026-11-20T12:00:00Z");
  const v = dataVersionOf(parts, at, 30 * 60_000)!;
  assert.match(v.data, /^[0-9a-f]{16}$/);
  assert.equal(v.settled, true);
  assert.equal(dataVersionOf({ ...parts, stamps: { b: parts.stamps.b, a: parts.stamps.a } }, at, 0)!.data, v.data, "stamp order doesn't matter");
  for (const change of [{ stamps: { ...parts.stamps, a: "2026-11-20T11:00:00Z" } }, { sync: "2026-11-01T00:00:00Z" }, { entryYear: 2028 }, { epoch: "flush-1" }, { stamps: { ...parts.stamps, c: "2026-01-01T00:00:00Z" } }]) {
    assert.notEqual(dataVersionOf({ ...parts, ...change }, at, 0)!.data, v.data, JSON.stringify(change));
  }
  assert.equal(dataVersionOf({ ...parts, stamps: {} }, at, 0), null, "stamps unknown: no version");
  assert.equal(dataVersionOf({ ...parts, sync: "" }, at, 0), null, "sync unknown: no version");
  // A promote 10 minutes ago: not settled for 30 minutes.
  assert.equal(dataVersionOf({ ...parts, stamps: { ...parts.stamps, a: "2026-11-20T11:50:00Z" } }, at, 30 * 60_000)!.settled, false);
  assert.equal(dataVersionOf({ ...parts, sync: "2026-11-20T11:50:00Z" }, at, 30 * 60_000)!.settled, false);
});

// ---- the switch -----------------------------------------------------------------------------------

test("off (the default): every call builds, the store is never asked", async () => {
  setResultsCacheForTests({ store: mem.store, versions: async () => versions, now: () => clock.t, defer: (fn) => fn() });
  const prev = process.env.RESULTS_CACHE;
  delete process.env.RESULTS_CACHE;
  try {
    const b = builder(() => ({ x: 1 }));
    await cachedResult("k", b.fn);
    await cachedResult("k", b.fn);
    await flush();
    assert.equal(b.runs, 2);
    assert.deepEqual(mem.calls, { read: 0, write: 0, touch: 0, prune: 0 });
    process.env.RESULTS_CACHE = "yes";
    await cachedResult("k", b.fn);
    assert.equal(b.runs, 3, "only the exact word 'on' turns it on");
    process.env.RESULTS_CACHE = "on";
    await cachedResult("k", b.fn);
    await flush();
    assert.equal(mem.calls.write, 1, "RESULTS_CACHE=on");
  } finally {
    if (prev === undefined) delete process.env.RESULTS_CACHE;
    else process.env.RESULTS_CACHE = prev;
  }
});

test("no version (no build info, or the stamps unread): builds, stores nothing", async () => {
  setResultsCacheForTests({ store: mem.store, versions: async () => null, now: () => clock.t, enabled: true, defer: (fn) => fn() });
  const b = builder(() => 1);
  await cachedResult("k", b.fn);
  await cachedResult("k", b.fn);
  await flush();
  assert.equal(b.runs, 2);
  assert.equal(mem.calls.read + mem.calls.write, 0);
});

// ---- read-through ---------------------------------------------------------------------------------

test("a slow answer is stored, then served from memory, then from Postgres in a fresh process, byte for byte", async () => {
  const answer = { zeta: [3, 1, 2], alpha: { b: "x", a: null }, n: 0.1 + 0.2, d: new Date("2026-11-20T00:00:00Z"), u: undefined, arr: [undefined, NaN] };
  const b = builder(() => answer);
  const first = await cachedResult("smt/academic|110110|h", b.fn);
  await flush();
  assert.equal(b.runs, 1);
  assert.equal(mem.calls.write, 1);
  const row = mem.rows.get("smt/academic|110110|h")!;
  assert.equal(row.value, JSON.stringify(answer));
  assert.equal(row.bytes, Buffer.byteLength(row.value));
  assert.equal(row.built_ms, 2_000);
  assert.deepEqual([row.data_version, row.code_version], ["d1", "c1"]);
  const second = await cachedResult("smt/academic|110110|h", b.fn);
  assert.equal(second, first, "L1: the same value");
  assert.equal(mem.calls.read, 1, "L1 doesn't ask Postgres");
  restart();
  const third = await cachedResult("smt/academic|110110|h", b.fn);
  assert.equal(b.runs, 1, "L2: no build");
  assert.equal(JSON.stringify(third), JSON.stringify(first), "byte for byte");
  assert.equal(resultsCacheStats().l2, 1);
});

test("concurrent callers of one key share one build", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let runs = 0;
  const build = async () => {
    runs++;
    await gate;
    clock.t += 1_000;
    return { v: 1 };
  };
  const all = Promise.all([cachedResult("k", build), cachedResult("k", build), cachedResult("k", build)]);
  await flush();
  release();
  const [a, b, c] = await all;
  assert.equal(runs, 1);
  assert.ok(a === b && b === c);
});

test("versions are part of the lookup: another data or code version builds afresh", async () => {
  const b = builder(() => ({ v: versions.data + versions.code }));
  await cachedResult("k", b.fn);
  await flush();
  versions = { data: "d2", code: "c1", settled: true };
  restart();
  assert.deepEqual(await cachedResult("k", b.fn), { v: "d2c1" });
  assert.equal(b.runs, 2, "new data version");
  await flush();
  versions = { data: "d2", code: "c2", settled: true };
  restart();
  assert.deepEqual(await cachedResult("k", b.fn), { v: "d2c2" });
  assert.equal(b.runs, 3, "new code version");
  await flush();
  versions = { data: "d2", code: "c2", settled: true };
  restart();
  await cachedResult("k", b.fn);
  assert.equal(b.runs, 3, "same versions: from Postgres");
});

test("a row past the maximum age (24 h) isn't used", async () => {
  const b = builder(() => 1);
  await cachedResult("k", b.fn);
  await flush();
  clock.t += 25 * 60 * 60_000;
  restart();
  await cachedResult("k", b.fn);
  assert.equal(b.runs, 2);
});

// ---- what is stored ------------------------------------------------------------------------------

test("an answer built in under 500 ms isn't stored (nor kept in memory); opts.minBuildMs moves the line", async () => {
  const fast = builder(() => 1, 100);
  await cachedResult("fast", fast.fn);
  await cachedResult("fast", fast.fn);
  await flush();
  assert.equal(fast.runs, 2, "rebuilt: not kept in memory either");
  assert.equal(mem.calls.write, 0);
  assert.equal(resultsCacheStats().skips.fast, 2);
  const edge = builder(() => 1, 500);
  await cachedResult("edge", edge.fn);
  await flush();
  assert.equal(mem.calls.write, 1, "500 ms exactly is stored");
  const custom = builder(() => 1, 600);
  await cachedResult("custom", custom.fn, { minBuildMs: 1_000 });
  await flush();
  assert.equal(mem.calls.write, 1, "under a route's own minimum");
});

test("an answer over the size cap (5 MB, or opts.maxBytes) isn't stored", async () => {
  const big = builder(() => ({ s: "x".repeat(5 * 1024 * 1024) }));
  await cachedResult("big", big.fn);
  await flush();
  assert.equal(mem.calls.write, 0);
  assert.equal(resultsCacheStats().skips["too big"], 1);
  const small = builder(() => ({ s: "x".repeat(100) }));
  await cachedResult("small", small.fn, { maxBytes: 50 });
  await flush();
  assert.equal(mem.calls.write, 0, "opts.maxBytes");
  await cachedResult("small2", small.fn, { maxBytes: 200 });
  await flush();
  assert.equal(mem.calls.write, 1);
});

test("opts.shouldStore false (a fallback state) isn't stored", async () => {
  const b = builder(() => ({ state: "fallback" }));
  await cachedResult("map", b.fn, { shouldStore: (m) => m.state !== "fallback" });
  await flush();
  assert.equal(mem.calls.write, 0);
  assert.equal(resultsCacheStats().skips.refused, 1);
});

test("while the data settles (a promote under 30 minutes ago) nothing is stored", async () => {
  versions = { data: "d1", code: "c1", settled: false };
  const b = builder(() => 1);
  await cachedResult("k", b.fn);
  await flush();
  assert.equal(mem.calls.write, 0);
  assert.equal(resultsCacheStats().skips["data settling"], 1);
});

test("a build that carried past a failed read isn't stored -- directly, or through a kept value it read", async () => {
  const direct = builder(() => {
    markDegraded();
    return 1;
  });
  await cachedResult("direct", direct.fn);
  await flush();
  assert.equal(mem.calls.write, 0);
  // A sub-value kept in memory by an earlier, unrelated build that degraded it:
  await traced(() => cachedReference("sub:thin", async () => (markDegraded(), "thin"))).promise;
  const viaHit = builder(() => 1);
  await cachedResult("via-hit", async () => (await cachedReference("sub:thin", async () => "never"), viaHit.fn()));
  await flush();
  assert.equal(mem.calls.write, 0, "the kept value's mark carries to every build that reads it");
  const clean = builder(() => 1);
  await cachedResult("clean", async () => (await cachedReference("sub:whole", async () => "whole"), clean.fn()));
  await flush();
  assert.equal(mem.calls.write, 1);
  assert.equal(resultsCacheStats().skips["built past a failed read"], 2);
});

test("tracedFetch marks a build on a 5xx, 401/403/408/429 or a network failure, not on a 404/400", async () => {
  const realFetch = globalThis.fetch;
  const statusOf = (u: string) => Number(new URL(u).pathname.slice(1));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("down")) throw new TypeError("fetch failed");
    return new Response("{}", { status: statusOf(u) });
  }) as typeof fetch;
  try {
    for (const [path, degraded] of [["/200", false], ["/404", false], ["/400", false], ["/406", false], ["/500", true], ["/503", true], ["/401", true], ["/429", true], ["/408", true]] as const) {
      const { trace, promise } = traced(() => tracedFetch(`http://x${path}`));
      await promise;
      assert.equal(isDegraded(trace), degraded, path);
    }
    const { trace, promise } = traced(() => tracedFetch("http://down/"));
    await promise.catch(() => null);
    assert.equal(isDegraded(trace), true, "network failure");
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---- failures ------------------------------------------------------------------------------------

test("a failed read builds instead; a failed write never fails the request", async () => {
  mem.setFailRead(true);
  const b = builder(() => ({ ok: 1 }));
  assert.deepEqual(await cachedResult("k", b.fn), { ok: 1 });
  assert.equal(resultsCacheStats().readErrors, 1);
  mem.setFailRead(false);
  mem.setFailWrite(true);
  assert.deepEqual(await cachedResult("k2", b.fn), { ok: 1 });
  await flush();
  assert.equal(resultsCacheStats().storeErrors, 1);
  assert.equal(mem.rows.has("k2"), false);
  assert.equal(mem.rows.has("k"), true, "the first, read failing but write working, was stored");
});

test("a stored value that doesn't parse is rebuilt", async () => {
  mem.rows.set("k", { key: "k", value: "{not json", data_version: "d1", code_version: "c1", bytes: 9, built_ms: 1000, created_at: clock.t, last_read_at: clock.t });
  const b = builder(() => ({ v: 2 }));
  assert.deepEqual(await cachedResult("k", b.fn), { v: 2 });
  assert.equal(b.runs, 1);
});

test("a build that throws throws, is never stored, and the next call builds again", async () => {
  let n = 0;
  const failing = async () => {
    n++;
    clock.t += 2_000;
    throw new Error("upstream down");
  };
  await assert.rejects(cachedResult("k", failing), /upstream down/);
  await assert.rejects(cachedResult("k", failing), /upstream down/);
  await flush();
  assert.equal(n, 2);
  assert.equal(mem.calls.write, 0);
});

test("versions that move while an answer builds: it isn't stored", async () => {
  const b = builder(() => {
    versions = { data: "d2", code: "c1", settled: true };
    return 1;
  });
  await cachedResult("k", b.fn);
  await flush();
  assert.equal(mem.calls.write, 0);
  assert.equal(resultsCacheStats().skips["version moved"], 1);
});

// ---- upkeep --------------------------------------------------------------------------------------

test("last_read_at is updated at most hourly per key; prune runs at most hourly", async () => {
  const b = builder(() => 1);
  await cachedResult("k", b.fn);
  await flush();
  assert.equal(mem.calls.prune, 1, "the first call of a process prunes");
  for (let i = 0; i < 3; i++) {
    restart();
    await cachedResult("k", b.fn);
  }
  await flush();
  assert.equal(mem.calls.touch, 0, "stored just now: no touch yet");
  clock.t += 61 * 60_000;
  restart();
  await cachedResult("k", b.fn);
  await flush();
  assert.equal(mem.calls.touch, 1);
  // The same process, within the hour, reading it again from Postgres: no second touch.
  clearReferenceCache();
  await cachedResult("k", b.fn);
  await flush();
  assert.equal(mem.calls.touch, 1);
  // Prune: one per process start here (restart resets), and within a process at most hourly.
  const before = mem.calls.prune;
  await cachedResult("other", builder(() => 2).fn);
  clock.t += 10 * 60_000;
  await cachedResult("other2", builder(() => 2).fn);
  assert.equal(mem.calls.prune, before, "within the hour");
  clock.t += 51 * 60_000;
  await cachedResult("other3", builder(() => 2).fn);
  assert.equal(mem.calls.prune, before + 1, "an hour later");
});

test("a new (settled) data version empties the in-process values once", async () => {
  await cachedReference("sub:population", async () => "old population");
  const b = builder(() => 1);
  await cachedResult("k", b.fn);
  let reads = 0;
  await cachedReference("sub:population", async () => (reads++, "x"));
  assert.equal(reads, 0, "same version: kept");
  versions = { data: "d2", code: "c1", settled: true };
  await cachedResult("k", b.fn);
  assert.equal(await cachedReference("sub:population", async () => (reads++, "new population")), "new population", "dropped on the new version");
  await cachedResult("k", b.fn);
  assert.equal(await cachedReference("sub:population", async () => (reads++, "again")), "new population", "only once");
});

// ---- per-view code versions (scripts/write-build-info.mjs's view_code) --------------------------------

test("per-view code: a view's answers are kept under its own version; a change to one view's code leaves the others'", async () => {
  versions = { data: "d1", code: "server1", views: { "smt/overview": "ov1", "teacher/dashboard": "td1" }, settled: true };
  setup();
  const ov = builder(() => ({ v: "overview" }));
  const td = builder(() => ({ v: "dashboard" }));
  const other = builder(() => ({ v: "unlisted" }));
  const kOv = resultKey("smt/overview", "110110", { set: 1 });
  const kTd = resultKey("teacher/dashboard", "110110", { phase: "ks4" });
  const kOther = resultKey("not/listed", "110110", {});
  await cachedResult(kOv, ov.fn);
  await cachedResult(kTd, td.fn);
  await cachedResult(kOther, other.fn);
  await flush();
  assert.equal(mem.rows.get(kOv)?.code_version, "ov1", "stored under the view's own version");
  assert.equal(mem.rows.get(kTd)?.code_version, "td1");
  assert.equal(mem.rows.get(kOther)?.code_version, "server1", "a view the build has no version for: server_code");
  // A deploy that changes only the dashboard's code: a fresh process reads the overview from the store and
  // builds the dashboard again.
  versions = { ...versions, views: { "smt/overview": "ov1", "teacher/dashboard": "td2" } };
  restart();
  await cachedResult(kOv, ov.fn);
  await cachedResult(kTd, td.fn);
  await cachedResult(kOther, other.fn);
  await flush();
  assert.equal(ov.runs, 1, "the overview's code didn't change: from the store");
  assert.equal(td.runs, 2, "the dashboard's did: built again");
  assert.equal(other.runs, 1, "server_code unchanged");
  assert.equal(mem.rows.get(kTd)?.code_version, "td2");
  // The walk failed in a later build (no view_code): every view on server_code -- nothing old matches.
  versions = { data: "d1", code: "server2", views: null, settled: true };
  restart();
  await cachedResult(kOv, ov.fn);
  await cachedResult(kTd, td.fn);
  assert.equal(ov.runs, 2);
  assert.equal(td.runs, 3);
});

test("per-view code: in memory too (L1) the version is the view's own; the version-moved check is per view", async () => {
  versions = { data: "d1", code: "s", views: { a: "a1", b: "b1" }, settled: true };
  setup();
  const a = builder(() => 1);
  const b = builder(() => 2);
  await cachedResult(resultKey("a", "1", {}), a.fn);
  await cachedResult(resultKey("b", "1", {}), b.fn);
  versions = { ...versions, views: { a: "a1", b: "b2" } };
  await cachedResult(resultKey("a", "1", {}), a.fn);
  await cachedResult(resultKey("b", "1", {}), b.fn);
  assert.equal(a.runs, 1, "a: from memory");
  assert.equal(b.runs, 2, "b: its version moved");
  // b's version moves while it is being built: not stored; a's moving doesn't stop b's write.
  let after: Versions = { ...versions, views: { a: "a9", b: "b2" } };
  setResultsCacheForTests({ store: mem.store, versions: async () => after, now: () => clock.t, enabled: true, defer: (fn) => fn() });
  versions = after;
  const writes = mem.calls.write;
  await cachedResult(resultKey("b", "2", {}), b.fn);
  await flush();
  assert.equal(mem.calls.write, writes + 1, "another view's version moving doesn't matter");
  const before: Versions = { ...after };
  setResultsCacheForTests({
    store: mem.store,
    versions: (() => {
      let n = 0;
      return async () => (n++ === 0 ? before : { ...before, views: { a: "a9", b: "b3" } });
    })(),
    now: () => clock.t,
    enabled: true,
    defer: (fn) => fn(),
  });
  await cachedResult(resultKey("b", "3", {}), b.fn);
  await flush();
  assert.equal(mem.calls.write, writes + 1, "b's own version moving: not stored");
  assert.equal(resultsCacheStats().skips["version moved"], 1);
});

test("per-view code: keys and fallbacks", () => {
  assert.equal(viewOfKey(resultKey("smt/context/map", "1", {})), "smt/context/map");
  assert.equal(viewOfKey("no-pipe"), "");
  assert.equal(codeFor({ code: "s", views: { "smt/context": "c" } }, "smt/context/map"), "s", "smt/context's version isn't smt/context/map's");
  assert.equal(codeFor({ code: "s", views: { "smt/context": "c" } }, "smt/context"), "c");
  assert.equal(codeFor({ code: "s", views: null }, "smt/context"), "s");
  assert.equal(codeFor({ code: "s", views: { toString: "x" } as Record<string, string> }, "constructor"), "s", "only the view's own entry");
  assert.equal(viewKeyPattern("smt/context"), "smt/context|%");
  assert.equal(viewKeyPattern("a_b%c"), "a\\_b\\%c|%");
});

// The Postgres store's prune, through a stand-in client that applies the filters it is sent to rows in memory.
type PgRow = { key: string; data_version: string; code_version: string; created_at: string; last_read_at: string };
function fakeDb(rows: PgRow[]) {
  const like = (pattern: string) => new RegExp("^" + pattern.replace(/\\(.)|%|_|[.*+?^${}()|[\]\\/]/g, (m, esc) => (esc !== undefined ? esc.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") : m === "%" ? ".*" : m === "_" ? "." : "\\" + m)) + "$");
  const unq = (s: string) => s.replace(/^"|"$/g, "");
  const orTest = (expr: string) => {
    // data_version.neq."x",code_version.neq."y"  or  created_at.lt."t",last_read_at.lt."u"
    const parts = expr.split(/,(?=[a-z_]+\.)/).map((p) => p.match(/^([a-z_]+)\.(neq|lt)\.(.*)$/)!);
    return (r: PgRow) => parts.some(([, col, op, v]) => (op === "neq" ? r[col as keyof PgRow] !== unq(v) : r[col as keyof PgRow] < unq(v)));
  };
  const client = {
    from() {
      const tests: ((r: PgRow) => boolean)[] = [];
      const q = {
        delete: () => q,
        neq: (c: keyof PgRow, v: string) => (tests.push((r) => r[c] !== v), q),
        lt: (c: keyof PgRow, v: string) => (tests.push((r) => r[c] < v), q),
        like: (c: keyof PgRow, p: string) => (tests.push((r) => like(p).test(r[c])), q),
        or: (e: string) => (tests.push(orTest(e)), q),
        then(res: (x: { error: null }) => unknown) {
          for (let i = rows.length - 1; i >= 0; i--) if (tests.every((t) => t(rows[i]))) rows.splice(i, 1);
          return Promise.resolve({ error: null }).then(res);
        },
      };
      return q;
    },
  };
  return client as unknown as SupabaseClient;
}

test("per-view code: the Postgres prune compares each row with its OWN view's version", async () => {
  const old = "2026-11-20T10:00:00.000Z";
  const fresh = "2026-11-20T11:59:00.000Z";
  const row = (key: string, code: string, created = old, data = "d1"): PgRow => ({ key, data_version: data, code_version: code, created_at: created, last_read_at: created });
  const rows = [
    row("smt/overview|1|h", "ov1"), // current: kept
    row("smt/overview|2|h", "ov0"), // its view's old code: gone
    row("smt/overview|3|h", "ov0", fresh), // the same, but made in the last 15 minutes (a deploy overlapping): kept
    row("smt/context|1|h", "cx1"), // current: kept
    row("smt/context/map|1|h", "cx1"), // smt/context's version isn't smt/context/map's: gone
    row("smt/context/map|2|h", "map1"), // current: kept
    row("teacher/dashboard|1|h", "ov1"), // another view's version: gone
    row("teacher/dashboard|2|h", "server-old"), // a row from the single-version days: gone
    row("gone/view|1|h", "whatever"), // a view this build doesn't list: left to the age rules
    row("smt/overview|9|h", "ov1", old, "d0"), // another data version: gone
  ];
  setResultsCacheForTests({ db: fakeDb(rows) });
  const cut = { mismatchBefore: new Date("2026-11-20T11:45:00Z"), expiredBefore: new Date("2026-11-19T12:00:00Z"), unreadBefore: new Date("2026-09-21T12:00:00Z") };
  await postgresStore.prune({ data: "d1", code: "server-new", views: { "smt/overview": "ov1", "smt/context": "cx1", "smt/context/map": "map1", "teacher/dashboard": "td1" } }, cut);
  assert.deepEqual(rows.map((r) => r.key).sort(), ["gone/view|1|h", "smt/context/map|2|h", "smt/context|1|h", "smt/overview|1|h", "smt/overview|3|h"]);
  // Without view_code (the walk failed): the single version, as before.
  await postgresStore.prune({ data: "d1", code: "ov1", views: null }, cut);
  assert.deepEqual(rows.map((r) => r.key).sort(), ["smt/overview|1|h", "smt/overview|3|h"]);
  // The age rules, either way.
  rows.push(row("smt/overview|4|h", "ov1", "2026-11-18T00:00:00.000Z"));
  await postgresStore.prune({ data: "d1", code: "s", views: { "smt/overview": "ov1" } }, cut);
  assert.ok(!rows.some((r) => r.key === "smt/overview|4|h"), "past the maximum age");
  setResultsCacheForTests({});
});
