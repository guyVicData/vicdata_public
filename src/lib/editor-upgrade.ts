// VicData 0.6 S5, G1: a published VicData dashboard is an upgrade. Per-user state (open
// rows, chosen views, a panel's own settings) survives wherever its panel survives
// unchanged; anything whose layout or view set changed comes back at the new default.
// The rule is carryUserState (src/catalogue/config.ts); this applies it to the viewer's
// own dashboard_user_state row. The live renderer calls upgradeUserState when it sees a
// version newer than the one the state was written against (RLS: each viewer can only
// upgrade their own row, so it runs on their visit, not at publish).
import type { SupabaseClient } from "@supabase/supabase-js";
import { carryUserState, type DashboardUserState } from "@/catalogue/config";
import type { DashboardConfig } from "@/catalogue/types";
import { loadUserState, saveUserState } from "./dashboards-store";

// The stored `state` jsonb is a DashboardUserState; anything else is treated as empty.
export function carryStateJson(prev: DashboardConfig, next: DashboardConfig, state: unknown, nextVersion: number): DashboardUserState {
  const s = state as Partial<DashboardUserState> | null;
  const panels = s && typeof s === "object" && s.panels && typeof s.panels === "object" ? s.panels : {};
  return carryUserState(prev, next, { version: String(s?.version ?? ""), panels }, String(nextVersion));
}

export async function upgradeUserState(
  supabase: SupabaseClient,
  dashboardId: string,
  schoolUrn: string,
  prev: DashboardConfig,
  next: DashboardConfig,
  nextVersion: number,
): Promise<DashboardUserState | null> {
  const row = await loadUserState(supabase, dashboardId, schoolUrn);
  if (!row) return null;
  const carried = carryStateJson(prev, next, row.state, nextVersion);
  await saveUserState(supabase, dashboardId, schoolUrn, { state: carried as unknown as Record<string, unknown> });
  return carried;
}
