// "Ask for this view": log the request with its exact context (view_requests, migration
// 20261104100000_v06_s4_view_requests.sql). RLS lets any signed-in user insert their own;
// only platform admins read them.
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { PickPanelContext } from "@/catalogue/pick";

export async function logViewRequest(description: string, context: PickPanelContext): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("view_requests").insert({
      description: description.trim().slice(0, 2000),
      context,
      dashboard_slug: context.source?.dashboardId ?? null,
      panel_id: context.source?.panelId ?? null,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't send the request" };
  }
}
