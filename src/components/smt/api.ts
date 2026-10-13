"use client";

// VicData 0.8 SMT round 1: the page's reads. GET /api/smt/school; POST /api/smt/overview and
// /api/smt/academic with the comparison set as URNs (as Teacher's chooser-set). Each answer is kept
// for the visit by its request (fetch-cache.ts), so switching back to a level redraws at once.
import { useEffect, useState } from "react";
import { cachedFetchJson } from "@/lib/fetch-cache";
import { freshToken } from "@/components/admissions/member";
import type { Academic } from "@/lib/smt/academic";
import type { Overview, SmtFilters } from "@/lib/smt/overview";
import type { SmtSchool } from "@/lib/smt/school";

export type { Academic, Overview, SmtFilters, SmtSchool };
export type Load<T> = { status: "loading" } | { status: "error"; code: number; message: string } | { status: "ready"; data: T };
export type SmtSetChoice = { kind: string; label: string; urns: string[] };

export function useSmt<T>(url: string | null, body: unknown | null): Load<T> {
  const key = url ? `${url} ${body === null ? "" : JSON.stringify(body)}` : null;
  const [state, setState] = useState<{ key: string | null; load: Load<T> }>({ key: null, load: { status: "loading" } });
  useEffect(() => {
    if (!key || !url) return;
    let live = true;
    (async () => {
      const token = await freshToken();
      if (!token) {
        if (live) setState({ key, load: { status: "error", code: 401, message: "Sign in again." } });
        return;
      }
      const res = await cachedFetchJson<T & { error?: string }>(url, body === null ? { token } : { token, method: "POST", body: JSON.stringify(body) });
      if (!live) return;
      if (res.ok && res.body) setState({ key, load: { status: "ready", data: res.body } });
      else setState({ key, load: { status: "error", code: res.status, message: (res.body as { error?: string } | null)?.error ?? "Could not load." } });
    })();
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state.key === key ? state.load : { status: "loading" };
}
