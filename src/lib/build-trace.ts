// Speed plan §4.2 item 2 (the shared results cache): was this answer built whole? Server-only.
//
// Several builders catch a failed read and carry on with less (`.catch(() => null)`: no projection, the
// 5 km fallback catchment, an empty area). That is right for the page in front of the user, and wrong to
// keep: the results cache would serve the thinner answer to everyone until the data changed. So a catch
// site that degrades an answer calls markDegraded(), and the results cache doesn't store (or keep) an
// answer whose build, or anything it read, was marked.
//
// Each build runs in a trace (AsyncLocalStorage, so it follows the build's awaits). The in-process cache
// (server-cache.ts) gives each kept value its own trace and links it into whichever build reads it, a
// hit included, so a degraded value kept an hour still marks every answer built from it.
//
// Browser-safe: some modules that import this (supabase.ts, the reference readers) are also in client
// bundles, so there is no static node:async_hooks import. On the server AsyncLocalStorage comes from
// Next's global (node-environment-baseline.js sets globalThis.AsyncLocalStorage) or, outside Next (tests,
// scripts), process.getBuiltinModule; in a browser there is none and every call here is a no-op.

export type BuildTrace = { degraded: boolean; deps: BuildTrace[] };

type Als<T> = { getStore(): T | undefined; run<R>(store: T, fn: () => R): R };

function makeAls(): Als<BuildTrace> | null {
  if (typeof window !== "undefined") return null;
  const g = globalThis as { AsyncLocalStorage?: new () => Als<BuildTrace> };
  if (g.AsyncLocalStorage) return new g.AsyncLocalStorage();
  const load = typeof process !== "undefined" ? (process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule : undefined;
  const mod = load?.("node:async_hooks") as { AsyncLocalStorage?: new () => Als<BuildTrace> } | undefined;
  return mod?.AsyncLocalStorage ? new mod.AsyncLocalStorage() : null;
}

const als = makeAls();

/** Run `fn` in a new trace, linked into the current one (if any). */
export function traced<T>(fn: () => Promise<T>): { trace: BuildTrace; promise: Promise<T> } {
  const trace: BuildTrace = { degraded: false, deps: [] };
  if (!als) return { trace, promise: fn() };
  als.getStore()?.deps.push(trace);
  return { trace, promise: als.run(trace, fn) };
}

/** The answer being built has less in it than it should (a read failed and was carried past). */
export function markDegraded(): void {
  const t = als?.getStore();
  if (t) t.degraded = true;
}

/** The current build read a value built under `trace` (a cache hit). */
export function dependOn(trace: BuildTrace | undefined): void {
  if (!trace) return;
  const t = als?.getStore();
  if (t && t !== trace) t.deps.push(trace);
}

/** Whether the trace, or anything it read, was marked. */
export function isDegraded(trace: BuildTrace): boolean {
  const seen = new Set<BuildTrace>();
  const stack = [trace];
  while (stack.length) {
    const t = stack.pop()!;
    if (seen.has(t)) continue;
    seen.add(t);
    if (t.degraded) return true;
    stack.push(...t.deps);
  }
  return false;
}

/** Once a build has settled, fold its deps into one flag, so a long-kept value holds no chain. */
export function settle(trace: BuildTrace): void {
  trace.degraded = isDegraded(trace);
  trace.deps = [];
}

/** Statuses that say this read failed now, not that the request is wrong: a build that saw one (even
 * one its code carried past) isn't stored. A 404 (a function not applied yet, which has a fallback),
 * 400 or 406 is the same on every try, so it doesn't count. */
export const transientStatus = (s: number) => s >= 500 || s === 401 || s === 403 || s === 408 || s === 429;

/** fetch, marking the current build degraded on a network failure or a transient status. For the server's
 * Supabase clients (global.fetch) and the reference API's calls; outside a build it is plain fetch. */
export const tracedFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init);
    if (transientStatus(res.status)) markDegraded();
    return res;
  } catch (e) {
    markDegraded();
    throw e;
  }
};
