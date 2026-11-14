"use client";

// VicData 0.8 front door 2b (M1): a home tile's figure fetched late -- in the browser, after the home has
// drawn and its own reads have settled -- through the same route and parameters the tile's walk uses, so
// the walk's first screen then opens from the same answer (fetch-cache.ts shares the promise in this page).
//
// The tile shows its question at once; the figure fades in when it arrives (.fd-late-figure); on an error
// or no data the tile stays as it is (never a placeholder number).
//
// Cached for the session (these figures change once a year): the figure itself (not the route's answer) in
// sessionStorage, keyed by the address, the signed-in person and any peek in the address, so a second visit
// to the home in this tab -- a reload included -- reads it without asking the route. fetch-cache.ts is the
// app's client cache, but it lives in memory for 5 minutes, so it can't carry a figure across a reload: this
// is the small session-scoped layer on top of it (logged in OPEN_QUESTIONS, front door 2b). Errors are
// never cached; a successful answer with no figure is (it is no data, not a failure).
import { useEffect, useState } from "react";
import { authSubject, cachedFetchJson } from "@/lib/fetch-cache";
import { freshToken } from "@/components/admissions/member";
import type { LateTileFigure } from "@/lib/front-door/tile-figures";

const PREFIX = "vicdata:fd-tile:v1:";

/** The session cache's key: the address, the person, and a peek's lookAs/as (never shared between them). */
export function lateFigureKey(url: string, sub: string, search: string): string {
  const q = new URLSearchParams(search);
  const peek = q.get("peek") === "1" ? `${q.get("lookAs") ?? ""}/${q.get("as") ?? ""}` : "";
  return `${PREFIX}${sub}|${peek}|${url}`;
}

function readCache(key: string): { hit: boolean; figure: LateTileFigure } {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return { hit: false, figure: null };
    return { hit: true, figure: JSON.parse(raw) as LateTileFigure };
  } catch {
    return { hit: false, figure: null };
  }
}

function writeCache(key: string, figure: LateTileFigure) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(figure));
  } catch {
    /* storage blocked or full: the figure still shows, it is just fetched again next visit */
  }
}

/** After the browser has painted and is idle (or 600 ms at most), so the home is never held up. */
function afterPaint(fn: () => void): () => void {
  let idle: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const raf = requestAnimationFrame(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 600 });
    else timer = setTimeout(fn, 0);
  });
  return () => {
    cancelAnimationFrame(raf);
    const w = window as Window & { cancelIdleCallback?: (h: number) => void };
    if (idle !== null) w.cancelIdleCallback?.(idle);
    if (timer !== null) clearTimeout(timer);
  };
}

/**
 * A tile's late figure. `url` is the walk's own address (null until it is known); `ready` is the home's own
 * reads having settled (so the heavier read never competes with them); `derive` picks the figure from the
 * route's answer (tile-figures.ts). Returns the figure once it has arrived, else null.
 */
export function useLateTileFigure<T>(url: string | null, ready: boolean, derive: (d: T) => LateTileFigure): LateTileFigure {
  const [got, setGot] = useState<{ url: string; figure: LateTileFigure } | null>(null);
  useEffect(() => {
    if (!url || !ready) return;
    let live = true;
    let cancel: (() => void) | null = null;
    (async () => {
      const token = await freshToken();
      if (!token || !live) return;
      const key = lateFigureKey(url, authSubject(token), window.location.search);
      const cached = readCache(key);
      if (cached.hit) {
        setGot({ url, figure: cached.figure });
        return;
      }
      cancel = afterPaint(async () => {
        const res = await cachedFetchJson<T>(url, { token }).catch(() => null);
        if (!res || !res.ok || !res.body) return; // an error: the tile stays as it is, and nothing is cached
        let figure: LateTileFigure = null;
        try {
          figure = derive(res.body);
        } catch {
          return;
        }
        writeCache(key, figure);
        if (live) setGot({ url, figure });
      });
    })();
    return () => {
      live = false;
      cancel?.();
    };
  }, [url, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return got?.url === url ? got.figure : null;
}
