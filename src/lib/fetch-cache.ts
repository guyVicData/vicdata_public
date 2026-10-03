// VicData 0.6 E (Guy's decision 10; audit B §2-4): one small in-memory promise cache for
// the Teacher view's client fetchers -- the dashboard route, saved sets, chooser-set,
// academic-schools, subject-geography, subject-grade-geography and comparator-grades.
//
// Why: each panel host keeps its fetched payload in its own component state, so toggling
// Candidates/Results (which swaps Column 1's host) or drawing several embedded views for
// one school (meeting slots, the chooser's live preview, a custom dashboard) asked the
// same route for the same payload again and again. Now concurrent and repeat calls for
// the same request share one promise.
//
// The rules:
//   - keyed by method + URL + body + the caller's auth subject (the JWT's `sub`), so two
//     people signed in on one browser never share a payload;
//   - kept ~5 minutes, then fetched afresh;
//   - errors are never cached: a non-2xx response or a network failure is dropped from
//     the cache as soon as it settles, so the next call tries again;
//   - `fresh: true` skips (and replaces) the cached entry -- for reads straight after a
//     write, such as the saved sets after the chooser saves one.
// It changes no rendered output: the same request returns the same JSON either way.
// Payloads are shared between callers, so callers must treat them as read-only.

export type CachedResponse<T = unknown> = { ok: boolean; status: number; body: T | null };

type Entry = { at: number; promise: Promise<CachedResponse> };

export const FETCH_CACHE_TTL_MS = 5 * 60_000;

const cache = new Map<string, Entry>();

// The JWT's subject, or the token itself when it isn't a readable JWT.
function authSubject(token: string): string {
  try {
    const part = token.split(".")[1];
    if (!part) return token;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
    return json.sub ?? token;
  } catch {
    return token;
  }
}

export function fetchCacheKey(url: string, token: string, method = "GET", body = ""): string {
  return `${method} ${url} ${body} ${authSubject(token)}`;
}

export function cachedFetchJson<T = unknown>(
  url: string,
  opts: { token: string; method?: "GET" | "POST"; body?: string; fresh?: boolean; ttlMs?: number },
): Promise<CachedResponse<T>> {
  const method = opts.method ?? "GET";
  const key = fetchCacheKey(url, opts.token, method, opts.body ?? "");
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && !opts.fresh && now - hit.at < (opts.ttlMs ?? FETCH_CACHE_TTL_MS)) return hit.promise as Promise<CachedResponse<T>>;

  const promise: Promise<CachedResponse> = (async () => {
    const headers: Record<string, string> = { Authorization: `Bearer ${opts.token}` };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(url, { method, headers, body: opts.body });
    return { ok: res.ok, status: res.status, body: res.ok ? ((await res.json()) as unknown) : null };
  })();
  const entry: Entry = { at: now, promise };
  cache.set(key, entry);
  const drop = () => {
    if (cache.get(key) === entry) cache.delete(key);
  };
  promise.then((r) => (r.ok ? undefined : drop()), drop);
  return promise as Promise<CachedResponse<T>>;
}

// Forget every cached response whose URL starts with `prefix` (e.g. after a write).
export function invalidateFetchCache(prefix: string): void {
  for (const key of cache.keys()) {
    const url = key.slice(key.indexOf(" ") + 1);
    if (url.startsWith(prefix)) cache.delete(key);
  }
}
