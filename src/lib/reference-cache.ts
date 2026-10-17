// VicData 0.8 database load: production reference reads, cached per process until their source changes.
//
// Reference data (canonical_facts_current, read through reference_data_lookup and
// reference_data_age_gender_totals) only changes when a source is promoted or retracted. So a read is
// kept until its source's stamp moves -- production's reference_source_stamps(), each source's latest
// promote or retraction -- the same pattern as the ranking-population cache and the school-sync stamp:
// the stamps are read at most once a minute, and if that read fails the last stamps read stand. With no
// stamp (the function not applied yet, or a source never promoted) a read is kept for the old hour
// (REFERENCE_TTL_MS), as before.
//
// Every caller gets its own copies of the rows (a caller that edits a row can't change another's), an
// answer over MAX_CACHED_ROWS rows is not kept, and a caller's abort signal stops only its own wait.

export const STAMP_CHECK_MS = 60_000;
export const REFERENCE_FALLBACK_TTL_MS = 60 * 60_000;
// Even with an unchanged stamp, nothing is kept longer than a day.
export const REFERENCE_MAX_AGE_MS = 24 * 60 * 60_000;
export const MAX_CACHED_READS = 500;
export const MAX_CACHED_ROWS = 50_000;

export type StampMap = Record<string, string>;

/** Each source's stamp, read through `load` at most once every `checkMs`; null when unknown. */
export function makeSourceStamps(load: () => Promise<StampMap>, now: () => number = Date.now, checkMs = STAMP_CHECK_MS): (sourceId: string) => Promise<string | null> {
  let last: StampMap = {};
  let checked: { at: number; promise: Promise<StampMap> } | null = null;
  return async (sourceId) => {
    const t = now();
    if (!checked || t - checked.at >= checkMs) {
      const promise = load().then(
        (m) => (last = m),
        (e) => {
          console.warn("[reference-stamps] could not read the source stamps; keeping the last read", e instanceof Error ? e.message : e);
          return last;
        },
      );
      checked = { at: t, promise };
    }
    return (await checked.promise)[sourceId] ?? null;
  };
}

type Entry = { stamp: string | null; at: number; promise: Promise<readonly object[]> };

/** A cache of reference reads: get(sourceId, key, load) answers from the cache while the source is unchanged. */
export function makeReferenceCache(opts: {
  stamp: (sourceId: string) => Promise<string | null>;
  now?: () => number;
  ttlMs?: number;
  maxAgeMs?: number;
  maxEntries?: number;
  maxRows?: number;
}) {
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? REFERENCE_FALLBACK_TTL_MS;
  const maxAgeMs = opts.maxAgeMs ?? REFERENCE_MAX_AGE_MS;
  const maxEntries = opts.maxEntries ?? MAX_CACHED_READS;
  const maxRows = opts.maxRows ?? MAX_CACHED_ROWS;
  const entries = new Map<string, Entry>();
  const fresh = (e: Entry, stamp: string | null, t: number) =>
    t - e.at < maxAgeMs && (stamp !== null ? e.stamp === stamp : e.stamp === null && t - e.at < ttlMs);
  return {
    async get<T extends object>(sourceId: string, key: string, load: () => Promise<T[]>, signal?: AbortSignal): Promise<T[]> {
      const stamp = await opts.stamp(sourceId);
      const t = now();
      const k = `${sourceId}\u0000${key}`;
      let e = entries.get(k);
      if (!e || !fresh(e, stamp, t)) {
        const promise = load();
        e = { stamp, at: t, promise };
        entries.delete(k);
        entries.set(k, e);
        if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
        const mine = e;
        promise.then(
          (rows) => { if (rows.length > maxRows && entries.get(k) === mine) entries.delete(k); },
          () => { if (entries.get(k) === mine) entries.delete(k); },
        );
      }
      const rows = await withSignal(e.promise, signal);
      return rows.map((r) => ({ ...r }) as T);
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}

function withSignal<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (err) => { signal.removeEventListener("abort", onAbort); reject(err); },
    );
  });
}
