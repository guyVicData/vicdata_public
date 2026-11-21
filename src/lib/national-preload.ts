// The boot preload (docs/v0.8/smt_national_preload_v1.md): after a deploy or restart the first SMT view used to
// pay for the national loads (~9 s: England's schools, the populations, the IGCSE lists). With NATIONAL_PRELOAD=on
// the server loads them itself, shortly after it starts, so the first visitor finds them in memory. Server-only.
//
// The rules:
//   - off unless NATIONAL_PRELOAD=on;
//   - it starts NATIONAL_PRELOAD_DELAY_MS (default 3 s) after boot and never holds boot up: register() only sets
//     a timer, and this module (and everything the loads import) is loaded only when it fires;
//   - ONE LOAD AT A TIME, in national-loads.ts' order, each the very call a page makes (same key, same loader):
//     a request that arrives meanwhile shares the load already under way, never starts a second. No fan-out of its
//     own (a parallel warm-up once broke live requests; production cancels wide read fan-outs, 57014). Each load's
//     own reads are as narrow as they are for a page (limited.ts);
//   - every error is caught: a failed load is left for the first page to build, as before, and the run carries on.
//     One log line at the end, with the time, the memory and what failed;
//   - it changes no figure: the values are what the first page would have built;
//   - it fills the routes' own cache: server-cache.ts keeps its state on globalThis, because Next builds
//     instrumentation.ts apart from the routes and a module-level Map there was a second, private cache.
import { NATIONAL_LOADS } from "./national-loads";
import { referenceCacheStats } from "./server-cache";
import { clearReferenceReads } from "./vicdata-reference";

const GAP_MS = 100; // between loads, so a request that arrives meanwhile is never queued behind two

export type PreloadReport = { loaded: number; failed: { key: string; error: string }[]; ms: number; each: Record<string, number> };

let started = false;
let last: PreloadReport | null = null;

export const preloadOn = () => process.env.NATIONAL_PRELOAD === "on";

const mb = (b: number) => Math.round(b / 1024 / 1024);

/** Every national load, one after another. Never rejects. */
export async function preloadNational(loads = NATIONAL_LOADS): Promise<PreloadReport> {
  const t0 = Date.now();
  const report: PreloadReport = { loaded: 0, failed: [], ms: 0, each: {} };
  for (const l of loads) {
    const t = Date.now();
    try {
      await l.load();
      report.loaded++;
    } catch (e) {
      report.failed.push({ key: l.key, error: e instanceof Error ? e.message : String(e) });
    }
    report.each[l.key] = Date.now() - t;
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  report.ms = Date.now() - t0;
  return report;
}

/** From instrumentation.ts, after its delay: the preload, once per process, then its one log line. Never rejects. */
export async function runNationalPreload(): Promise<void> {
  if (started || !preloadOn()) return;
  started = true;
  try {
    const r = await preloadNational();
    last = r;
    // The raw reads behind the values (reference-cache.ts) are this bundle's own copy -- instrumentation is built
    // apart from the routes, and only server-cache.ts's state is shared (globalThis) -- so no request would ever
    // read them: let them go.
    clearReferenceReads();
    const c = referenceCacheStats();
    const m = process.memoryUsage();
    const failed = r.failed.length ? `; failed (left for the first page): ${r.failed.map((f) => `${f.key} (${f.error.slice(0, 120)})`).join(", ")}` : "";
    console.log(
      `[national-preload] ${r.loaded}/${r.loaded + r.failed.length} loaded in ${(r.ms / 1000).toFixed(1)} s; ` +
        `cache ${c.entries} entries ~${mb(c.approxBytes)} MB; heap ${mb(m.heapUsed)} MB, rss ${mb(m.rss)} MB${failed}`,
    );
  } catch (e) {
    console.warn("[national-preload] stopped:", e instanceof Error ? e.message : e);
  }
}

/** The last run's report (null before it finished). */
export const lastPreload = () => last;
