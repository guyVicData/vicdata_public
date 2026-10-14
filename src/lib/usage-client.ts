"use client";

// VicData 0.8 shell + SMT r1, B7: the browser's half of the usage log. A page reports what it showed
// (product, school, dashboard, view, level, set kind); the server adds who (/api/usage). Fire and
// forget: no await, no error, no retry, nothing drawn.
import { createContext, createElement, useContext, useEffect, useRef, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "./supabase";
import { getActiveViewAs } from "./view-as";
import type { UsageReport } from "./usage";
import { createPageViewGate, pageViewKey, type PageViewScope } from "./usage-gate";

export function reportUsage(r: UsageReport): void {
  // A platform admin viewing as someone is not the school's usage: never logged.
  if (typeof window === "undefined" || getActiveViewAs()) return;
  void (async () => {
    try {
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch("/api/usage", { method: "POST", keepalive: true, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(r) });
    } catch {
      // Not logged.
    }
  })();
}

// What the page in view is: set once by the page (its root), read by the shell's CardBox when a
// panel opens in full screen. Absent = nothing is logged (a meeting slide, the editor, a preview).
// `resolved: false` while the page's level or set is still being read (G0, groups r1).
export type UsageScope = PageViewScope;
export const UsageScopeContext = createContext<UsageScope | null>(null);
export const useUsageScope = () => useContext(UsageScopeContext);

/** One page view per load, once the level and set are resolved; then one more only when the
 * dashboard, level or set kind changes (usage-gate.ts). The gate lives as long as the page. */
export function useUsagePageView(scope: UsageScope | null): void {
  const gate = useRef<ReturnType<typeof createPageViewGate> | null>(null);
  const key = scope ? JSON.stringify([scope.resolved !== false, pageViewKey(scope)]) : "";
  useEffect(() => {
    if (!scope) return;
    gate.current ??= createPageViewGate();
    const r = gate.current(scope);
    if (r) reportUsage(r);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The page's scope and its page view, as an element that draws nothing: a page whose hooks can't
 * move (an early return before them) renders this instead. */
export function UsageReporter({ scope, children }: { scope: UsageScope | null; children: ReactNode }) {
  useUsagePageView(scope);
  return createElement(UsageScopeContext.Provider, { value: scope }, children);
}
