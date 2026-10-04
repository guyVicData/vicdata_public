"use client";

// The config renderer's plan, read by the shared column shells (DashboardColumn,
// ColumnPanels) when a dashboard is drawn from config (?renderer=config). With no plan in
// context -- every unflagged page -- those shells render exactly as before.
import { createContext, useContext } from "react";
import type { ColumnHeader, DashboardConfig, PanelConfig, RowConfig } from "@/catalogue/types";

export type PlanRow = { row: RowConfig; panel: PanelConfig | undefined };
export type PlanColumn = { column: ColumnHeader; rows: PlanRow[] };

// VicData 0.6 E: a view drawn outside the dashboard page (TeacherDashboard mode "embed",
// one panel): "card" draws the whole panel as the dashboard does; "figure" draws the
// figure alone, for a frame that brings its own card (a meeting slot). Either way the
// column's own pills stay off -- an embedded view's settings are pinned.
export type PlanEmbed = { frame: "card" | "figure"; fullscreen: boolean };

export type DashboardPlan = {
  config: DashboardConfig;
  // Keyed by the column's legacy persistence key ("candidates" / "context" / "rankings"),
  // which is the id the column hosts already pass to ColumnPanels.
  byColumnKey: Map<string, PlanColumn>;
  superAdmin: boolean;
  embed?: PlanEmbed | null;
};

// `columnKeys` (0.6 E): where a config's columns don't carry today's legacy keys (a
// custom dashboard), the key each one's host is drawn under, by column id.
export function buildPlan(config: DashboardConfig, superAdmin: boolean, opts: { embed?: PlanEmbed | null; columnKeys?: Record<string, string> } = {}): DashboardPlan {
  const byColumnKey = new Map<string, PlanColumn>();
  for (const column of config.columns) {
    const rows = config.rows.map((row) => ({ row, panel: config.panels.find((p) => p.column === column.id && p.row === row.id) }));
    byColumnKey.set(opts.columnKeys?.[column.id] ?? column.legacyColumnKey ?? column.id, { column, rows });
  }
  return { config, byColumnKey, superAdmin, embed: opts.embed ?? null };
}

export const DashboardPlanContext = createContext<DashboardPlan | null>(null);

export function usePlanColumn(columnKey: string): { plan: DashboardPlan; column: PlanColumn } | null {
  const plan = useContext(DashboardPlanContext);
  const column = plan?.byColumnKey.get(columnKey);
  return plan && column ? { plan, column } : null;
}

// 0.6 snagging round 3 / 01: a view's own settings (DataviewInstance.params) as the config
// holds them. 0.6.1 S2 (D10): looked up by INSTANCE id -- the view the panel is showing,
// which ColumnPanels provides (ActiveViewContext) -- not by (column, dataview), so two views
// on the same renderer never share Figures. null with no plan (every unflagged page) or no
// such instance, so a host reading it draws exactly as before.
export function viewParamsFor(config: DashboardConfig, instanceId: string | null | undefined): Record<string, unknown> | null {
  if (!instanceId) return null;
  for (const panel of config.panels) {
    const v = panel.dataviews.find((x) => x.id === instanceId);
    if (v) return v.kind === "view" ? (v.params ?? null) : null;
  }
  return null;
}

export function usePlanViewParams(instanceId: string | null | undefined): Record<string, unknown> | null {
  const plan = useContext(DashboardPlanContext);
  return plan ? viewParamsFor(plan.config, instanceId) : null;
}

// The instance id of the view a configured panel is showing, provided by ColumnPanels around
// the panel's body (null outside a plan).
export const ActiveViewContext = createContext<string | null>(null);

// The showing view's own params, for a leaf drawn inside a panel body (ConfiguredNumberTiles).
export function useActiveViewParams(): Record<string, unknown> | null {
  return usePlanViewParams(useContext(ActiveViewContext));
}

// Is the config renderer switched on? `?renderer=config` on the URL, or the build-time
// env flag. Off by default everywhere, branch included (night 1 prompt, "Live site
// untouched").
export function configRendererRequested(search: URLSearchParams | null): boolean {
  if (process.env.NEXT_PUBLIC_DASHBOARD_RENDERER === "config") return true;
  return search?.get("renderer") === "config";
}
