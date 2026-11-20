// Speed plan §4.2 item 2: the shared results cache. Server-only.
//
// A slow view (SMT against a 488-school set: 16 s cold) is built once and kept in Postgres
// (public.results_cache, 20261125090000_v08_results_cache.sql), so it survives deploys and restarts and
// is the same for every instance: the next person to open it, after any number of deploys that leave
// the server code alone, reads it in milliseconds.
//
//   cachedResult(key, build, opts)
//     L1  the in-process cache (server-cache.ts): callers of one key share one build or one read;
//     L2  results_cache, through the service role (RLS on, no policies: anon and authenticated can't
//         read it); read-through, a read that fails or is slow (READ_TIMEOUT_MS) builds instead;
//     a miss builds, and the answer is stored (fire-and-forget: a failed write never fails the page)
//     only when the build took at least opts.minBuildMs (500 ms), its JSON is at most opts.maxBytes
//     (5 MB), nothing in it was built past a failed read (build-trace.ts), opts.shouldStore agrees,
//     and the data has settled (below).
//
// THE KEY is what the answer is built from, resolved -- the school, the view's state, the set's URNs,
// the school's own saved lists or catchment as this caller read them -- never who is asking. Each
// route checks the caller first, on every request, then reads what it reads with the caller's own
// rights, and only then asks here (resultKey). Anything that differs by caller and isn't in the key is
// added by the route after, per request.
//
// VERSIONS: a row is used only when both match (and are part of the L1 key):
//   data_version  a hash of production's source stamps (reference_source_stamps: each source's latest
//                 promote or retraction), the last school sync (schools.synced_at), next September's
//                 entry year (Admissions' ladder starts there) and RESULTS_CACHE_EPOCH (set it to
//                 anything new in Render to drop every stored answer at once);
//   code_version  the build's server_code (scripts/write-build-info.mjs): a hash of every file the
//                 API routes import, so a design-only deploy keeps the answers and any server change
//                 drops them.
// The app's own derived tables (the census cache, nearest neighbours, roll aggregates) are recomputed
// just after a promote and carry no stamp of their own, so nothing is stored until the newest stamp is
// RESULTS_CACHE_SETTLE_MIN (30) minutes old -- and when a process sees the data version change, its
// in-process values are dropped once, so no answer under the new version is built from older reads.
// A row is used for at most RESULTS_CACHE_MAX_AGE_H (24) hours, for anything that changes unstamped.
//
// Pruning, at most hourly per process: rows of another version (made more than 15 minutes ago, so two
// instances overlapping in a deploy don't delete each other's), rows past the maximum age, and rows
// unread for 60 days. last_read_at is updated at most hourly per key.
//
// Off unless RESULTS_CACHE=on (Render's environment), so it can be turned off at once. Without a code
// version (a dev server has no build-info.json) or before the stamps can be read, it builds as today.
// One log line at most every ten minutes: hits (L1, L2), misses, stores and why answers weren't stored.
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isDegraded, traced } from "./build-trace";
import { cachedReference, clearReferenceValues, forgetReference } from "./server-cache";
import { allSourceStamps } from "./vicdata-reference";
import { schoolSyncStamp } from "./school-sync-stamp";
import { buildInfo } from "./build-info";
import { firstEntryYear } from "./admissions/entry-points";

export const MIN_BUILD_MS = 500;
export const MAX_BYTES = 5 * 1024 * 1024;
export const READ_TIMEOUT_MS = 2_000;
export const TOUCH_EVERY_MS = 60 * 60_000;
export const PRUNE_EVERY_MS = 60 * 60_000;
export const UNREAD_DAYS = 60;
export const MISMATCH_GRACE_MS = 15 * 60_000;
const LOG_EVERY_MS = 10 * 60_000;
const L1_TTL_MS = 60 * 60_000;
const DEFAULT_MAX_AGE_H = 24;
const DEFAULT_SETTLE_MIN = 30;
const TOUCHED_CAP = 10_000;

export type Versions = { data: string; code: string; /** the newest stamp is old enough to store under */ settled: boolean };
export type StoredRow = { value: string; created_at: string; last_read_at: string | null };
export type RowToWrite = { key: string; value: string; data_version: string; code_version: string; bytes: number; built_ms: number };

/** Where answers are kept: Postgres in the app, PGlite or a Map in tests. */
export interface ResultsStore {
  read(key: string, v: { data: string; code: string }, notBefore: Date): Promise<StoredRow | null>;
  write(row: RowToWrite): Promise<void>;
  touch(key: string, at: Date): Promise<void>;
  prune(v: { data: string; code: string }, cut: { mismatchBefore: Date; expiredBefore: Date; unreadBefore: Date }): Promise<void>;
}

export type ResultOpts<T> = {
  /** Store only answers that took at least this long to build (ms). */
  minBuildMs?: number;
  /** Store only answers whose JSON is at most this many bytes. */
  maxBytes?: number;
  /** A last say: false keeps this answer out (a pending or fallback state). */
  shouldStore?: (value: T) => boolean;
};

// ---- keys --------------------------------------------------------------------------------------

/** JSON with object keys sorted (arrays keep their order: a set's order can show in the answer). */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) => {
    if (x instanceof Map) return { __map: [...x.entries()] };
    if (x instanceof Set) return { __set: [...x.values()] };
    if (x && typeof x === "object" && !Array.isArray(x)) return Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]));
    return x;
  });
}

/** A results key: the view's name, the school, and a hash of everything else the answer is built from. */
export function resultKey(view: string, urn: string, inputs: unknown): string {
  const h = createHash("sha256").update(stableJson(inputs)).digest("hex").slice(0, 32);
  return `${view}|${urn}|${h}`;
}

// ---- configuration and test hooks --------------------------------------------------------------

type Overrides = { store?: ResultsStore; versions?: () => Promise<Versions | null>; now?: () => number; enabled?: boolean; defer?: (fn: () => void) => void; minBuildMs?: number };
let overrides: Overrides = {};

/** Tests and scripts/results-cache-parity.ts only: replace the store, the versions, the clock, the switch,
 * the deferral or the default minimum build time; {} resets. */
export function setResultsCacheForTests(o: Overrides): void {
  overrides = o;
  resetState();
}

const now = () => (overrides.now ?? Date.now)();
const enabled = () => overrides.enabled ?? process.env.RESULTS_CACHE === "on";
const defer = (fn: () => void) => (overrides.defer ?? ((f) => setTimeout(f, 0)))(fn);
const hours = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
};
const maxAgeMs = () => hours("RESULTS_CACHE_MAX_AGE_H", DEFAULT_MAX_AGE_H) * 60 * 60_000;
const settleMs = () => hours("RESULTS_CACHE_SETTLE_MIN", DEFAULT_SETTLE_MIN) * 60_000;

// ---- versions ----------------------------------------------------------------------------------

/** The data version from its parts; null when the stamps are unknown (none read yet). */
export function dataVersionOf(parts: { stamps: Record<string, string>; sync: string; entryYear: number; epoch: string }, at: number, settleFor: number): { data: string; settled: boolean } | null {
  const entries = Object.entries(parts.stamps).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!entries.length || !parts.sync) return null;
  const data = createHash("sha256").update(JSON.stringify({ s: entries, y: parts.sync, e: parts.entryYear, x: parts.epoch })).digest("hex").slice(0, 16);
  const times = [...entries.map(([, t]) => Date.parse(t)), Date.parse(parts.sync)].filter((t) => Number.isFinite(t));
  const newest = times.length ? Math.max(...times) : at;
  return { data, settled: at - newest >= settleFor };
}

/** The live versions: production's stamps, the school sync, and this build's server_code. */
export async function liveVersions(): Promise<Versions | null> {
  const code = buildInfo().server_code;
  if (!code) return null;
  const [stamps, sync] = await Promise.all([allSourceStamps(), schoolSyncStamp()]);
  const t = now();
  const d = dataVersionOf({ stamps, sync, entryYear: firstEntryYear(new Date(t)), epoch: process.env.RESULTS_CACHE_EPOCH ?? "" }, t, settleMs());
  return d ? { ...d, code } : null;
}

const versionsNow = () => (overrides.versions ?? liveVersions)();

// ---- the Postgres store ------------------------------------------------------------------------

// Its own service-role client, with plain fetch: the store's own errors are counted here, never marked
// against an answer being built (build-trace.ts's tracedFetch is on the app's other server clients).
let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }));
const quoted = (s: string) => `"${s.replace(/"/g, "")}"`;

export const postgresStore: ResultsStore = {
  async read(key, v, notBefore) {
    const { data, error } = await db()
      .from("results_cache")
      .select("value, created_at, last_read_at")
      .eq("key", key)
      .eq("data_version", v.data)
      .eq("code_version", v.code)
      .gte("created_at", notBefore.toISOString())
      .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
      .maybeSingle<StoredRow>();
    if (error) throw new Error(error.message);
    return data ?? null;
  },
  async write(row) {
    const at = new Date(now()).toISOString();
    const { error } = await db().from("results_cache").upsert({ ...row, created_at: at, last_read_at: at }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  },
  async touch(key, at) {
    const { error } = await db().from("results_cache").update({ last_read_at: at.toISOString() }).eq("key", key);
    if (error) throw new Error(error.message);
  },
  async prune(v, cut) {
    const a = await db().from("results_cache").delete().or(`data_version.neq.${quoted(v.data)},code_version.neq.${quoted(v.code)}`).lt("created_at", cut.mismatchBefore.toISOString());
    if (a.error) throw new Error(a.error.message);
    const b = await db().from("results_cache").delete().or(`created_at.lt.${quoted(cut.expiredBefore.toISOString())},last_read_at.lt.${quoted(cut.unreadBefore.toISOString())}`);
    if (b.error) throw new Error(b.error.message);
  },
};
const store = () => overrides.store ?? postgresStore;

// ---- state, stats and the log line -------------------------------------------------------------

type Stats = { l1: number; l2: number; misses: number; stores: number; storeErrors: number; readErrors: number; skips: Record<string, number> };
const emptyStats = (): Stats => ({ l1: 0, l2: 0, misses: 0, stores: 0, storeErrors: 0, readErrors: 0, skips: {} });
// `stats` since the last log line; `totals` since the process started (tests read them).
let stats = emptyStats();
let totals = emptyStats();
let lastLogAt = 0;
let lastPruneAt = 0;
let seenData: string | null = null;
const touched = new Map<string, number>();

function resetState(): void {
  stats = emptyStats();
  totals = emptyStats();
  lastLogAt = 0;
  lastPruneAt = 0;
  seenData = null;
  touched.clear();
}

type Counter = Exclude<keyof Stats, "skips">;
const bump = (k: Counter) => {
  stats[k]++;
  totals[k]++;
};
const skip = (why: string) => {
  for (const s of [stats, totals]) s.skips[why] = (s.skips[why] ?? 0) + 1;
};

/** Since the process started. */
export function resultsCacheStats(): Stats {
  return { ...totals, skips: { ...totals.skips } };
}

function maybeLog(): void {
  const t = now();
  if (t - lastLogAt < LOG_EVERY_MS) return;
  const s = stats;
  const any = s.l1 + s.l2 + s.misses + s.storeErrors + s.readErrors + Object.keys(s.skips).length > 0;
  if (!any) return;
  lastLogAt = t;
  const skips = Object.entries(s.skips).map(([k, n]) => `${k} ${n}`).join(", ") || "none";
  console.log(`[results-cache] hits L1 ${s.l1}, L2 ${s.l2}; misses ${s.misses}; stored ${s.stores}; not stored: ${skips}; read errors ${s.readErrors}, write errors ${s.storeErrors}`);
  stats = emptyStats();
}

let warnedAt = 0;
function warn(what: string, e: unknown): void {
  const t = now();
  if (t - warnedAt < LOG_EVERY_MS) return;
  warnedAt = t;
  console.warn(`[results-cache] ${what}:`, e instanceof Error ? e.message : e);
}

function noteVersion(v: Versions): void {
  // A new data version: what this process holds in memory was read under the old one.
  if (!v.settled) return;
  if (seenData !== null && seenData !== v.data) {
    clearReferenceValues();
    console.log(`[results-cache] data version ${seenData} -> ${v.data}: in-process values dropped`);
  }
  seenData = v.data;
}

function maybePrune(v: Versions): void {
  const t = now();
  if (t - lastPruneAt < PRUNE_EVERY_MS) return;
  lastPruneAt = t;
  store()
    .prune(v, { mismatchBefore: new Date(t - MISMATCH_GRACE_MS), expiredBefore: new Date(t - maxAgeMs()), unreadBefore: new Date(t - UNREAD_DAYS * 24 * 60 * 60_000) })
    .catch((e) => warn("prune failed", e));
}

function maybeTouch(key: string, row: StoredRow): void {
  const t = now();
  const last = Math.max(row.last_read_at ? Date.parse(row.last_read_at) : 0, touched.get(key) ?? 0);
  if (t - last < TOUCH_EVERY_MS) return;
  if (touched.size >= TOUCHED_CAP) touched.clear();
  touched.set(key, t);
  store()
    .touch(key, new Date(t))
    .catch((e) => warn("last_read_at update failed", e));
}

// ---- the read-through --------------------------------------------------------------------------

type Loaded<T> = { value: T; keep: boolean };

async function loadThrough<T>(key: string, v: Versions, build: () => Promise<T>, opts: ResultOpts<T>): Promise<Loaded<T>> {
  let row: StoredRow | null = null;
  try {
    row = await store().read(key, v, new Date(now() - maxAgeMs()));
  } catch (e) {
    bump("readErrors");
    warn("read failed; building instead", e);
  }
  if (row) {
    try {
      const value = JSON.parse(row.value) as T;
      bump("l2");
      maybeTouch(key, row);
      return { value, keep: true };
    } catch (e) {
      bump("readErrors");
      warn("a stored answer didn't parse; building instead", e);
    }
  }
  bump("misses");
  const t0 = now();
  const { trace, promise } = traced(build);
  const value = await promise;
  const builtMs = Math.round(now() - t0);

  const why = (() => {
    if (builtMs < (opts.minBuildMs ?? overrides.minBuildMs ?? MIN_BUILD_MS)) return "fast";
    if (!v.settled) return "data settling";
    if (isDegraded(trace)) return "built past a failed read";
    if (opts.shouldStore && !opts.shouldStore(value)) return "refused";
    return null;
  })();
  if (why) {
    skip(why);
    return { value, keep: false };
  }
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (e) {
    skip("not JSON");
    warn("an answer couldn't be serialised", e);
    return { value, keep: false };
  }
  const bytes = Buffer.byteLength(text);
  if (bytes > (opts.maxBytes ?? MAX_BYTES)) {
    skip("too big");
    return { value, keep: false };
  }
  defer(() => {
    void (async () => {
      // Not if the data or the code moved while it was being built.
      const after = await versionsNow().catch(() => null);
      if (!after || after.data !== v.data || after.code !== v.code) {
        skip("version moved");
        return;
      }
      await store().write({ key, value: text, data_version: v.data, code_version: v.code, bytes, built_ms: builtMs });
      bump("stores");
    })().catch((e) => {
      bump("storeErrors");
      warn("write failed", e);
    });
  });
  return { value, keep: true };
}

/** The answer for `key`: from memory, from results_cache, or built (and then kept, by the rules above).
 * Callers must have checked the caller first, and must treat the value as read-only (it is shared). */
export async function cachedResult<T>(key: string, build: () => Promise<T>, opts: ResultOpts<T> = {}): Promise<T> {
  if (!enabled()) return build();
  let v: Versions | null = null;
  try {
    v = await versionsNow();
  } catch (e) {
    warn("versions unreadable; building", e);
  }
  if (!v) {
    skip("no version");
    maybeLog();
    return build();
  }
  noteVersion(v);
  maybePrune(v);
  const l1Key = `results:${v.code}:${v.data}:${key}`;
  let ran = false;
  const loaded = cachedReference(l1Key, () => {
    ran = true;
    return loadThrough(key, v, build, opts);
  }, L1_TTL_MS);
  if (!ran) bump("l1");
  // An answer that isn't stored isn't kept in memory either (once its callers have it).
  loaded.then((r) => { if (!r.keep) forgetReference(l1Key, loaded); }, () => undefined);
  const r = await loaded;
  maybeLog();
  return r.value;
}
