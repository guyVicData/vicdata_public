#!/usr/bin/env -S npx tsx
// The national loads, measured (docs/v0.8/smt_national_preload_v1.md). Read-only against live data, one read at a
// time. For each load in src/lib/national-loads.ts: its cold time in a fresh process, its JSON size, its heap size
// (after a GC, before and after) and the cache's own estimate (server-cache.ts estimateBytes).
//
//   npx tsx --env-file=.env --env-file=.env.local scripts/national-loads-measure.ts            each key in its own process
//   npx tsx --env-file=.env --env-file=.env.local scripts/national-loads-measure.ts --all      every key, one after another, one process
//   ... --one KEY                                                                              one key (what the first form runs)
import { spawnSync } from "node:child_process";
import { NATIONAL_LOADS } from "../src/lib/national-loads";
import { estimateBytes, hasReference } from "../src/lib/server-cache";
import { stableJson } from "../src/lib/results-cache";

const args = process.argv.slice(2);
const gc = (globalThis as { gc?: () => void }).gc;
const heap = () => {
  gc?.();
  gc?.();
  return process.memoryUsage().heapUsed;
};
const mb = (b: number) => (b / 1024 / 1024).toFixed(1);

async function measure(key: string) {
  const l = NATIONAL_LOADS.find((x) => x.key === key);
  if (!l) throw new Error(`no such load: ${key}`);
  const h0 = heap();
  const t0 = performance.now();
  const value = await l.load();
  const ms = Math.round(performance.now() - t0);
  const h1 = heap();
  const json = Buffer.byteLength(stableJson(value));
  return { key, ms, jsonMB: mb(json), heapMB: mb(h1 - h0), estMB: mb(estimateBytes(value)), keyHeld: hasReference(key) };
}

async function main() {
if (args[0] === "--one") {
  console.log(JSON.stringify(await measure(args[1])));
} else if (args[0] === "--all") {
  const t0 = performance.now();
  const h0 = heap();
  for (const l of NATIONAL_LOADS) console.log(JSON.stringify(await measure(l.key)));
  console.log(`all: ${Math.round(performance.now() - t0)} ms, heap +${mb(heap() - h0)} MB, rss ${mb(process.memoryUsage().rss)} MB`);
} else {
  for (const l of NATIONAL_LOADS) {
    const r = spawnSync(process.execPath, [...process.execArgv, "--expose-gc", process.argv[1], "--one", l.key], { encoding: "utf8", env: process.env });
    const line = r.stdout.trim().split("\n").filter((x) => x.startsWith("{")).at(-1);
    console.log(line ?? `${l.key}: failed ${r.stderr.slice(-400)}`);
  }
}
}
main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
