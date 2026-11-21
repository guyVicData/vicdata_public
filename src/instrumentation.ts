// Next.js calls register() once when a server starts, and serves nothing until it returns: so it only sets timers.
//
// The national preload (src/lib/national-preload.ts, docs/v0.8/smt_national_preload_v1.md): Node.js only, off
// unless NATIONAL_PRELOAD=on. NATIONAL_PRELOAD_DELAY_MS (default 3000) after boot it loads the preload module --
// not before, so boot loads nothing more than it did -- and runs it in the background. Nothing here can throw into
// the server: a failure is logged once and the server carries on as before.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NATIONAL_PRELOAD !== "on") return;
  const n = Number(process.env.NATIONAL_PRELOAD_DELAY_MS);
  const delay = Number.isFinite(n) && n >= 0 ? n : 3_000;
  const timer = setTimeout(() => {
    import("./lib/national-preload")
      .then((m) => m.runNationalPreload())
      .catch((e) => console.warn("[national-preload] not started:", e instanceof Error ? e.message : e));
  }, delay);
  timer.unref?.();
}
