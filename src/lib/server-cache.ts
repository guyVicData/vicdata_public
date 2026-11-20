// VicData 0.6.4 C2: a small in-process cache for PUBLIC reference reads on the server --
// England's, an LA's and a region's published figures, a school's LA and region, the latest
// published periods. These change only when the ingest runs, and are the same for every
// member, so one Render instance asks for each once an hour rather than once per page load.
//
// The rules:
//   - public data only: a key never holds a user, a token or a membership, and a value is
//     never anything a member's own access decides (membership checks still run first, per
//     request, in each route -- this sits after them);
//   - an hour (REFERENCE_TTL_MS), then fetched afresh, so an ingest shows within the hour;
//     a call can pass its own ttlMs, which decides whether that call takes what is kept;
//   - errors are never kept: a rejected promise is dropped as soon as it settles;
//   - values are shared between requests, so callers must treat them as read-only;
//   - callers asking for a key that is still loading share the one promise;
//   - bounded by memory, not just by count (20 Nov: the instance ran out of heap after two
//     hours, the cache holding 2000 entries of whole-set rows and boundary geometry). When a
//     value arrives its size is estimated once, roughly (a walk that samples long arrays and
//     big objects and scales up); the total is kept under SERVER_CACHE_MAX_MB (default 400 MB)
//     and MAX_ENTRIES keys, by dropping the least recently used first -- a hit counts as use;
//   - a single value over a quarter of that budget is handed back but not kept;
//   - when anything is dropped for room, one line goes to the log, at most every ten minutes.
// It changes no figure: the same request returns the same rows either way.

export const REFERENCE_TTL_MS = 60 * 60_000;
const MAX_ENTRIES = 2000;
const DEFAULT_MAX_MB = 400;
const OVERSIZE_FRACTION = 0.25;
const LOG_EVERY_MS = 10 * 60_000;

function budgetFromEnv(): number {
  const mb = Number(process.env.SERVER_CACHE_MAX_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_MB) * 1024 * 1024;
}

let maxBytes = budgetFromEnv();
let maxEntries = MAX_ENTRIES;

type Entry = { at: number; promise: Promise<unknown>; bytes: number };
// A Map keeps insertion order: the first key is the least recently used.
const store = new Map<string, Entry>();
let totalBytes = 0;
let evictions = 0;
let oversizedSkips = 0;
let lastLogAt = 0;

function remove(key: string, entry: Entry): void {
  if (store.get(key) !== entry) return;
  store.delete(key);
  totalBytes -= entry.bytes;
}

function maybeLog(): void {
  const now = Date.now();
  if (now - lastLogAt < LOG_EVERY_MS) return;
  lastLogAt = now;
  console.log(
    `[server-cache] ${store.size} entries, ~${Math.round(totalBytes / 1024 / 1024)} MB, ` +
      `${evictions} evicted, ${oversizedSkips} too big to keep, since start`,
  );
}

function evictForRoom(keep: string): void {
  let evicted = false;
  while (totalBytes > maxBytes || store.size > maxEntries) {
    const oldest = store.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === keep) break;
    remove(oldest, store.get(oldest)!);
    evictions++;
    evicted = true;
  }
  if (evicted) maybeLog();
}

export function cachedReference<T>(key: string, load: () => Promise<T>, ttlMs = REFERENCE_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) {
    // Refresh recency: move to the back of the Map.
    store.delete(key);
    store.set(key, hit);
    return hit.promise as Promise<T>;
  }
  if (hit) remove(key, hit);
  const promise = load();
  const entry: Entry = { at: now, promise, bytes: 0 };
  store.set(key, entry);
  evictForRoom(key);
  promise.then(
    (value) => {
      if (store.get(key) !== entry) return;
      const bytes = estimateBytes(value);
      if (bytes > maxBytes * OVERSIZE_FRACTION) {
        remove(key, entry);
        oversizedSkips++;
        maybeLog();
        return;
      }
      entry.bytes = bytes;
      totalBytes += bytes;
      evictForRoom(key);
    },
    () => remove(key, entry),
  );
  return promise;
}

// ---- size estimate -------------------------------------------------------------------------
// Rough V8 heap bytes: strings 2 per character, numbers 8, objects and arrays a header plus 8
// per slot. Arrays longer than SAMPLE and objects with more than SAMPLE keys are measured on
// SAMPLE evenly spaced members and scaled up; the walk stops at MAX_DEPTH and after MAX_VISITS
// nodes (anything past that counts as one slot), so even a multi-MB value costs a few
// thousand steps.
const SAMPLE = 32;
const MAX_DEPTH = 12;
const MAX_VISITS = 20_000;

export function estimateBytes(value: unknown): number {
  const state = { visits: 0 };
  return Math.round(walk(value, 0, state));
}

function walk(v: unknown, depth: number, state: { visits: number }): number {
  if (v === null || v === undefined) return 8;
  switch (typeof v) {
    case "string":
      return 16 + v.length * 2;
    case "number":
    case "bigint":
      return 8;
    case "boolean":
      return 4;
    case "object":
      break;
    default:
      return 8;
  }
  if (++state.visits > MAX_VISITS || depth >= MAX_DEPTH) return 8;
  if (ArrayBuffer.isView(v)) return 64 + v.byteLength;
  if (v instanceof ArrayBuffer) return 32 + v.byteLength;
  if (v instanceof Date) return 32;
  if (Array.isArray(v)) return 32 + 8 * v.length + sampled(v.length, (i) => v[i], depth, state);
  if (v instanceof Map) {
    const items = [...v.entries()];
    return 64 + 24 * items.length + sampled(items.length, (i) => walk(items[i][0], depth + 1, state) + walk(items[i][1], depth + 1, state), depth, state, true);
  }
  if (v instanceof Set) {
    const items = [...v.values()];
    return 64 + 16 * items.length + sampled(items.length, (i) => items[i], depth, state);
  }
  const keys = Object.keys(v as object);
  const obj = v as Record<string, unknown>;
  // Keys are mostly shared between rows (one hidden class), so only the slots count.
  return 32 + 8 * keys.length + sampled(keys.length, (i) => obj[keys[i]], depth, state);
}

function sampled(
  n: number,
  at: (i: number) => unknown,
  depth: number,
  state: { visits: number },
  precomputed = false,
): number {
  if (n === 0) return 0;
  const measure = (i: number) => (precomputed ? (at(i) as number) : walk(at(i), depth + 1, state));
  if (n <= SAMPLE) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += measure(i);
    return sum;
  }
  let sum = 0;
  const step = n / SAMPLE;
  for (let s = 0; s < SAMPLE; s++) sum += measure(Math.floor(s * step));
  return (sum / SAMPLE) * n;
}

// ---- stats and tests -----------------------------------------------------------------------

export function referenceCacheStats(): { entries: number; approxBytes: number; evictions: number; oversizedSkips: number } {
  return { entries: store.size, approxBytes: totalBytes, evictions, oversizedSkips };
}

/** Tests only. */
export function clearReferenceCache(): void {
  store.clear();
  totalBytes = 0;
  evictions = 0;
  oversizedSkips = 0;
  lastLogAt = 0;
}

/** Tests only: set the byte budget and key cap (omit both to go back to the defaults). */
export function setReferenceCacheLimitsForTests(bytes?: number, entries?: number): void {
  maxBytes = bytes ?? budgetFromEnv();
  maxEntries = entries ?? MAX_ENTRIES;
}
