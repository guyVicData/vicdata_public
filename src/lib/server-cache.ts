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
//   - errors are never kept: a rejected promise is dropped as soon as it settles;
//   - values are shared between requests, so callers must treat them as read-only;
//   - at most MAX_ENTRIES keys; past that the oldest goes first.
// It changes no figure: the same request returns the same rows either way.

export const REFERENCE_TTL_MS = 60 * 60_000;
const MAX_ENTRIES = 2000;

type Entry = { at: number; promise: Promise<unknown> };
const store = new Map<string, Entry>();

export function cachedReference<T>(key: string, load: () => Promise<T>, ttlMs = REFERENCE_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = load();
  const entry: Entry = { at: now, promise };
  store.delete(key);
  store.set(key, entry);
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  promise.catch(() => {
    if (store.get(key) === entry) store.delete(key);
  });
  return promise;
}

/** Tests only. */
export function clearReferenceCache(): void {
  store.clear();
}
