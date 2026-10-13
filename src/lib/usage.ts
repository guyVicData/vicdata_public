// VicData 0.8 shell + SMT r1, B7: the usage log (docs/v0.8/vicdata_usage_tracking_note_v1.md, steps
// 1-2). Server-only: the service role writes; nothing reads in this round.
//
// Every write is fire-and-forget. A missing table (before 20261109090000_v08_usage_log.sql is
// applied), a slow database or a bad row never reaches the page: the caller gets nothing back
// and nothing throws.
import { createServiceRoleSupabaseClient } from "./supabase";

export const USAGE_PRODUCTS = ["teacher", "admissions", "smt"] as const;
export const USAGE_EVENTS = ["page_view", "fullscreen"] as const;
export type UsageProduct = (typeof USAGE_PRODUCTS)[number];
export type UsageEventKind = (typeof USAGE_EVENTS)[number];

// What a page reports (the browser's half, src/lib/usage-client.ts). Who it is comes from the
// session on the server, never from the browser.
export type UsageReport = {
  product: UsageProduct;
  event: UsageEventKind;
  urn: string;
  dashboard?: string | null;
  view?: string | null;
  level?: string | null;
  setKind?: string | null;
};

const clip = (s: unknown, n: number): string | null => (typeof s === "string" && s.trim() ? s.trim().slice(0, n) : null);

/** A report from the browser, checked: null when it isn't one. */
export function parseUsageReport(body: unknown): UsageReport | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!USAGE_PRODUCTS.includes(b.product as UsageProduct) || !USAGE_EVENTS.includes(b.event as UsageEventKind)) return null;
  if (typeof b.urn !== "string" || !/^\d{5,7}$/.test(b.urn)) return null;
  return {
    product: b.product as UsageProduct,
    event: b.event as UsageEventKind,
    urn: b.urn,
    dashboard: clip(b.dashboard, 120),
    view: clip(b.view, 120),
    level: clip(b.level, 120),
    setKind: clip(b.setKind, 40),
  };
}

/** One member event. `membershipId` null with role "platform_admin" for View as. */
export async function writeUsageEvent(r: UsageReport, who: { membershipId: string | null; role: string | null }): Promise<void> {
  try {
    await createServiceRoleSupabaseClient().from("usage_events").insert({
      membership_id: who.membershipId,
      role: who.role,
      school_urn: r.urn,
      product: r.product,
      event: r.event,
      dashboard: r.dashboard ?? null,
      view: r.view ?? null,
      level: r.level ?? null,
      set_kind: r.setKind ?? null,
    });
  } catch {
    // Not logged is never an error a reader sees.
  }
}

// The public school page's count lives in usage-public.ts (the proxy imports it, without supabase-js).
export { countablePublicView, countPublicPageView, publicPageUrn } from "./usage-public";
