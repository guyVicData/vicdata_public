"use client";

// 0.8 shell (Part A): the linked-dashboard switcher -- Teacher's Candidates | Results, Admissions'
// Pipelines | Market share, SMT's Overview | Academic -- moved here from
// src/components/dashboard-config/ConfigDashboard.tsx, which re-exports it.
import type { DashboardConfig } from "@/catalogue/types";

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
