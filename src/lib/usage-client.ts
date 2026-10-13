"use client";

// VicData 0.8 shell + SMT r1, B7: the browser's half of the usage log. A page reports what it showed
// (product, school, dashboard, view, level, set kind); the server adds who (/api/usage). Fire and
// forget: no await, no error, no retry, nothing drawn.
import { createContext, createElement, useContext, useEffect, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "./supabase";
import { getActiveViewAs } from "./view-as";
import type { UsageReport } from "./usage";

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
export type UsageScope = Omit<UsageReport, "event" | "view">;
export const UsageScopeContext = createContext<UsageScope | null>(null);
export const useUsageScope = () => useContext(UsageScopeContext);

/** A page view, once per product, school, dashboard, level and set kind shown. */
export function useUsagePageView(scope: UsageScope | null): void {
  const key = scope ? JSON.stringify([scope.product, scope.urn, scope.dashboard ?? "", scope.level ?? "", scope.setKind ?? ""]) : "";
  useEffect(() => {
    if (!key) return;
    const [product, urn, dashboard, level, setKind] = JSON.parse(key) as [UsageReport["product"], string, string, string, string];
    reportUsage({ product, event: "page_view", urn, dashboard: dashboard || null, level: level || null, setKind: setKind || null });
  }, [key]);
}

/** The page's scope and its page view, as an element that draws nothing: a page whose hooks can't
 * move (an early return before them) renders this instead. */
export function UsageReporter({ scope, children }: { scope: UsageScope | null; children: ReactNode }) {
  useUsagePageView(scope);
  return createElement(UsageScopeContext.Provider, { value: scope }, children);
}
