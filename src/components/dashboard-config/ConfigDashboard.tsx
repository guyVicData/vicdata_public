"use client";

// VicData 0.6 S2: the generic dashboard renderer (scope brief §0), behind
// ?renderer=config. Config + registry -> the dashboard you see today.
//
// Night 1 composes through the existing column hosts ("wrap, don't rewrite", night 1
// prompt): each config column names a registered host (teacher.c1/c2/c3), the host
// still owns its data and view state, and the plan in context tells the shared shells
// (DashboardColumn, ColumnPanels) which rows to draw, in what order, under what names,
// with which accordion behaviour, and what to do when a panel throws. So every hosted
// panel keeps its standard elements -- title, source, note, export, fullscreen -- because
// CardBox attaches them (G7), and fullscreen is the same panel instance (§7.3).
//
// What it adds over the hand-coded grid:
//   - columns, rows and panels come from the config, in config order;
//   - one error boundary per panel (G3), at the panel unit;
//   - placeholder panels, dashed "Planned", super-admin only (§4.6a);
//   - phone: columns become a tab strip, one column at a time (G4, PhoneDash board).
import { Component, Children, useMemo, useState, type ReactNode } from "react";
import { DashboardGrid } from "@/components/teacher/DashboardGrid";
import { PANEL_HEIGHT } from "@/components/teacher/CardBox";
import type { DashboardConfig, PanelConfig } from "@/catalogue/types";
import { buildPlan, DashboardPlanContext } from "./plan";

export function ConfigDashboard({
  config,
  superAdmin = false,
  columnKeys,
  children,
}: {
  config: DashboardConfig;
  superAdmin?: boolean;
  // VicData 0.6 E: for a config whose columns don't carry today's legacy keys (a custom
  // dashboard), the column key each one's host draws under, by column id. Given, the grid
  // also takes the config's own track weights instead of today's three columns.
  columnKeys?: Record<string, string>;
  // One element per config column, in config column order: the column hosts.
  children: ReactNode;
}) {
  const plan = useMemo(() => buildPlan(config, superAdmin, { columnKeys }), [config, superAdmin, columnKeys]);
  const columns = Children.toArray(children);
  const [tab, setTab] = useState(0);
  return (
    <DashboardPlanContext.Provider value={plan}>
      <div data-dashboard-id={config.id} data-renderer="config">
        {/* PhoneDash: columns as tabs below md. Every column stays mounted (hidden), so
            switching tabs keeps each column's state, as switching columns on a laptop does. */}
        {config.columns.length > 1 && (
          <div role="tablist" aria-label="Columns" className="mt-4 flex gap-1.5 overflow-x-auto border-b border-[var(--border)] pb-3 md:hidden print:hidden">
            {config.columns.map((c, i) => {
              const on = i === tab;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(i)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-[7px] text-[12.5px] font-bold ${
                    on ? "border border-transparent bg-[var(--accent,var(--fg))] text-[#06120c]" : "border border-[var(--panel-border2)] bg-transparent text-[var(--muted2)]"
                  }`}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
        )}
        <DashboardGrid tracks={columnKeys ? config.layout.tracks : undefined}>
          {columns.map((col, i) => (
            <div key={config.columns[i]?.id ?? i} data-column-id={config.columns[i]?.id} className={i === tab ? "" : "hidden md:block"}>
              {col}
            </div>
          ))}
        </DashboardGrid>
      </div>
    </DashboardPlanContext.Provider>
  );
}

// One error boundary per panel (G3): a failing view shows its own error at the panel's
// own size and never blanks the dashboard.
export class PanelBoundary extends Component<{ panelId: string; title: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(`[dashboard] panel ${this.props.panelId} failed`, error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        data-panel-error={this.props.panelId}
        className="mt-3 flex flex-col items-center justify-center gap-2 rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] p-3 text-center"
        style={{ height: PANEL_HEIGHT }}
      >
        <p className="text-[13px] font-semibold text-[var(--fg)]">{this.props.title} couldn&rsquo;t be drawn</p>
        <p className="max-w-[260px] text-xs text-[var(--muted2)]">The rest of the dashboard is unaffected. Try again, or reload the page.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-1 rounded-full border border-[var(--panel-border2)] px-3 py-1 text-xs font-semibold text-[var(--muted2)] hover:text-[var(--fg)]"
        >
          Try again
        </button>
      </div>
    );
  }
}

// A placeholder panel (scope brief §4.6a; Skeleton board): dashed, "Planned", super-admin
// only. Its description and shape are what Export planned views will list (night 2).
export function PlannedPanel({ panel }: { panel: PanelConfig }) {
  const first = panel.dataviews.find((v) => v.kind === "placeholder");
  if (!first || first.kind !== "placeholder") return null;
  return (
    <div
      data-panel-id={panel.id}
      data-planned=""
      className="mt-3 flex flex-col gap-2 rounded-[10px] border border-dashed border-[var(--panel-border2)] bg-transparent p-3"
      style={{ height: PANEL_HEIGHT }}
    >
      <span className="w-fit rounded-full border border-dashed border-[var(--panel-border2)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted2)]">
        Planned
      </span>
      <p className="text-[13px] font-semibold text-[var(--fg)]">{first.description}</p>
      <p className="text-xs text-[var(--muted2)]">Shape: {first.shape}</p>
      {first.notes && <p className="text-xs leading-relaxed text-[var(--muted3)]">{first.notes}</p>}
    </div>
  );
}

// The linked-dashboard switcher (scope brief §4.2): the group's dashboards in group order,
// replacing the Candidates/Results toggle. Drawn with MeasureToggle's own classes so a
// flagged page and an unflagged one look the same; the label is the dashboard's name with
// the group's own label taken off ("GCSE Candidates" -> "Candidates").
export function GroupSwitcher({
  dashboards,
  activeId,
  onSwitch,
}: {
  dashboards: DashboardConfig[];
  activeId: string;
  onSwitch: (next: DashboardConfig) => void;
}) {
  if (dashboards.length < 2) return null;
  return (
    <div className="inline-flex shrink-0 rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] p-[3px] print:hidden" role="group" aria-label="Dashboard">
      {dashboards.map((d) => {
        const label = d.group && d.name.startsWith(`${d.group.label} `) ? d.name.slice(d.group.label.length + 1) : d.name;
        const on = d.id === activeId;
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSwitch(d)}
            className={[
              "rounded-full px-4 py-1.5 text-[13px] font-bold",
              on ? "bg-[var(--accent,var(--fg))] text-[#06120c]" : "text-[var(--muted)] hover:text-[var(--fg)]",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// The page's grid: the hand-coded DashboardGrid, exactly as before, unless a config is
// given (the flag is on), in which case the same column hosts render through the config.
export function DashboardFrame({
  config,
  superAdmin,
  columnKeys,
  children,
}: {
  config: DashboardConfig | null;
  superAdmin?: boolean;
  columnKeys?: Record<string, string>;
  children: ReactNode;
}) {
  if (!config) return <DashboardGrid>{children}</DashboardGrid>;
  return (
    <ConfigDashboard config={config} superAdmin={superAdmin} columnKeys={columnKeys}>
      {children}
    </ConfigDashboard>
  );
}
