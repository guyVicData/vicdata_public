// Read fan-outs (20 Nov): a few reads at a time, each tried twice. Browser-safe, no dependencies.
//
// Production's reference database cancels any statement past ~3 s ("canceling statement due to statement
// timeout", HTTP 500 / 57014). Many reads fired at once (Promise.all over every chunk or every school) slow
// each other past it: a 488-school set's 13 census reads at once lost 11 (schoolCensuses, f803f1a). So a
// fan-out whose width grows with the set runs through mapLimited (or a limiter), a few at a time, and each
// read is tried once more after a short wait (retryOnce). What a read returns is unchanged; only how many run
// together, and that a failed one gets a second try.
import { dependOn, detached } from "./build-trace";

/** At most `n` of the calls handed to the returned function run at once; the rest wait, first come first served. */
export function limiter(n: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (running >= n) await new Promise<void>((r) => waiting.push(r));
    running++;
    try {
      return await fn();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

const aborted = (e: unknown) => e instanceof Error && e.name === "AbortError";

/** `fn`, and once more after `waitMs` if it fails (not when aborted). The first try runs in a trace of its own
 * (build-trace.ts detached): if it fails and the second try succeeds, the build isn't marked degraded, so the
 * results cache can keep a complete answer; if the second fails too, it marks the build as any failed read does. */
export async function retryOnce<T>(fn: () => Promise<T>, waitMs = 500): Promise<T> {
  const first = detached(fn);
  try {
    const v = await first.promise;
    dependOn(first.trace);
    return v;
  } catch (e) {
    if (aborted(e)) throw e;
    await new Promise((r) => setTimeout(r, waitMs));
    return fn();
  }
}

/** `fn` over every item, at most `n` at once, each tried twice (retryOnce); results in item order. Rejects as
 * Promise.all does when an item fails both tries. */
export function mapLimited<T, R>(items: readonly T[], n: number, fn: (item: T, i: number) => Promise<R>, opts: { retry?: boolean } = {}): Promise<R[]> {
  const run = limiter(n);
  const retry = opts.retry ?? true;
  return Promise.all(items.map((item, i) => run(() => (retry ? retryOnce(() => fn(item, i)) : fn(item, i)))));
}

/** Offset pages 0, 1, 2, ... read `n` at a time (each tried twice) until one comes back shorter than `size`;
 * the rows in page order, exactly as reading them one after another would give them. At most `maxPages`. */
export async function pagesLimited<R>(read: (page: number) => Promise<R[]>, n: number, size: number, maxPages = Infinity): Promise<R[]> {
  const pages: R[][] = [];
  let last = maxPages - 1; // the last page worth reading: lowered when a short page is seen
  let next = 0;
  let failed: unknown = null;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next <= last && failed === null) {
        const page = next++;
        try {
          const rows = await retryOnce(() => read(page));
          pages[page] = rows;
          if (rows.length < size) last = Math.min(last, page);
        } catch (e) {
          failed ??= e;
        }
      }
    }),
  );
  if (failed !== null) throw failed;
  const out: R[] = [];
  for (let p = 0; p <= Math.min(last, pages.length - 1); p++) out.push(...(pages[p] ?? []));
  return out;
}
