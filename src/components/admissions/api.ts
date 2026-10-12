"use client";

// VicData 0.7 admissions r2: the browser's only way to Admissions data -- the round 1 routes
// (/api/admissions/*) with the member's own token. Responses are drawn as they come; the page
// never recomputes a figure (the prompt's rule). Cached for the visit (fetch-cache.ts), keyed by
// the token's subject, and dropped after a save.
import { useEffect, useState } from "react";
import { cachedFetchJson, invalidateFetchCache } from "@/lib/fetch-cache";
import type { MarketView, PipelineView, RivalsView, ShapeView } from "@/lib/admissions/views-api";
import { freshToken } from "./member";

export type { MarketView, PipelineView, RivalsView, ShapeView };
export type PipelineOk = Exclude<PipelineView, { empty: string }>;

export type Filters = { lists: "both" | "day" | "boarding"; sex: "all" | "female" | "male"; sector: "all" | "state" | "independent"; boardingOnly: boolean };
export const DEFAULT_FILTERS: Filters = { lists: "both", sex: "all", sector: "all", boardingOnly: false };

export type Load<T> = { status: "loading" } | { status: "error"; code: number; message: string } | { status: "ready"; data: T };

const MESSAGES: Record<number, string> = {
  401: "Sign in again to see Admissions.",
  403: "Admissions is available to the school's Admissions and SMT staff.",
  503: "Admissions isn't set up on this database yet.",
};

export function query(urn: string, entry: string, f: Filters, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ urn, entry });
  if (f.sex !== "all") p.set("sex", f.sex);
  if (f.lists !== "both") p.set("lists", f.lists);
  if (f.sector !== "all") p.set("sector", f.sector);
  if (f.boardingOnly) p.set("boarding", "1");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

export async function getJson<T>(url: string): Promise<Load<T>> {
  const token = await freshToken();
  if (!token) return { status: "error", code: 401, message: MESSAGES[401] };
  try {
    const r = await cachedFetchJson<T>(url, { token, ttlMs: 10 * 60_000 });
    if (r.ok && r.body) return { status: "ready", data: r.body };
    return { status: "error", code: r.status, message: MESSAGES[r.status] ?? "Couldn't load this. Try again." };
  } catch {
    return { status: "error", code: 0, message: "Couldn't reach VicData. Check the connection and try again." };
  }
}

/** One route's answer, refetched when its URL changes. `null` URL = don't load (yet). */
export function useRoute<T>(url: string | null): Load<T> {
  const [state, setState] = useState<{ url: string | null; load: Load<T> }>({ url: null, load: { status: "loading" } });
  useEffect(() => {
    if (!url) return;
    let live = true;
    getJson<T>(url).then((load) => live && setState({ url, load }));
    return () => {
      live = false;
    };
  }, [url]);
  return state.url === url ? state.load : { status: "loading" };
}

export async function sendJson(url: string, method: "PUT" | "POST" | "DELETE", body: unknown): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
  const token = await freshToken();
  if (!token) return { ok: false, status: 401, body: { error: MESSAGES[401] } };
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  // Every Admissions answer can change after a save: the lists feed every view.
  if (res.ok) invalidateFetchCache("/api/admissions/");
  return { ok: res.ok, status: res.status, body: json };
}

// ---------------------------------------------------------------------------- the lists route
export type ListRow = { id: string; entry_point: string; kind: "day_feeders" | "boarding_feeders" | "rivals" | "rung"; rung: string; members: string[] | null; fuzzy: Record<string, unknown> | null; la_blend: Record<string, number> | null; confirmed: boolean; updated_by: string | null; updated_at: string | null; updated_by_kind?: "lead" | "school_admin" | null };
export type ListsAnswer = { lead: boolean; entryPoints: { entry_point: string; sort_order: number; updated_by: string | null; updated_at: string | null; updated_by_kind?: "lead" | "school_admin" | null }[]; lists: ListRow[]; names?: Record<string, string> };

export type CandidateRow = {
  urn: string; name: string; sector: "state" | "independent"; gender: "mixed" | "girls" | "boys"; boarding: boolean; laCode: string | null; laName: string | null; town: string | null; high: number | null;
  distanceKm: number | null; pupils: number | null; before: number | null; changePct: number | null; flag: { id: string; label: string; figures: Record<string, number | string | null> } | null; size: string | null; easting: number | null; northing: number | null;
};
export type CandidatesAnswer = { kind: "day" | "boarding" | "rivals"; mode: string; age: number; period: number; school: { urn: string; name: string; easting: number | null; northing: number | null; laCode: string | null; laName: string | null; gender: string } | null; rows: CandidateRow[] };
