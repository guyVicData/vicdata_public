// VicData 0.8 groups r1 (G0): one page view per load. A page's scope settles in steps (Admissions'
// entry point arrives after its lists; Teacher's saved set after the sets are read), and each step
// used to log a page view. A page now says when its level and set are resolved; the gate logs the
// first resolved scope, then only a change of dashboard, level or set. Pure, so it is unit-tested.
import type { UsageReport } from "./usage";

export type PageViewScope = Omit<UsageReport, "event" | "view"> & { resolved?: boolean };

/** What makes two page views the same page view. */
export function pageViewKey(s: PageViewScope): string {
  return JSON.stringify([s.product, s.urn, s.dashboard ?? "", s.level ?? "", s.setKind ?? ""]);
}

/** A gate over a stream of scopes: the report to send, or null (not yet resolved, or no change). */
export function createPageViewGate(): (scope: PageViewScope | null) => UsageReport | null {
  let last: string | null = null;
  return (scope) => {
    if (!scope || scope.resolved === false) return null;
    const key = pageViewKey(scope);
    if (key === last) return null;
    last = key;
    return { product: scope.product, event: "page_view", urn: scope.urn, dashboard: scope.dashboard ?? null, level: scope.level ?? null, setKind: scope.setKind ?? null };
  };
}
