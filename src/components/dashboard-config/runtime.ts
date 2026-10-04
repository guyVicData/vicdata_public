"use client";

// VicData 0.6 integration: the dashboard's runtime state, as a panel needs it to say what
// "Copy this view…" copies -- the school, the focus subject, the Candidates/Results toggle
// and Results measure, Context's live group and the Comparisons set, and the real data
// years. TeacherDashboard provides it only under a plan (flag on, or a stored dashboard),
// so unflagged pages never see it; ColumnPanels reads it to build each panel's
// CopyViewSourceContext.
import { createContext, useContext } from "react";
import type { ComparatorState, Phase } from "@/catalogue/types";
import type { VariantState } from "@/catalogue/variants";
import type { RuntimeLabels } from "@/lib/pin-context";

export type DashboardRuntime = RuntimeLabels & {
  phase: Phase;
  measure: "candidates" | "results";
  // The focused item's raw subject and qualification (for the pin).
  focusSubject: { subject: string; qualificationType: string } | null;
  // The Comparisons column's set id (saved set key / chooser / default).
  setId: string | null;
  // 0.6 snag 4 / 02: whether Comparisons is on a ranking or a set of schools (the host's own
  // R-RANKING-SAMPLE distinction), for the views shown on each.
  comparator: ComparatorState;
  superAdmin: boolean;
};

export const DashboardRuntimeContext = createContext<DashboardRuntime | null>(null);

export function useDashboardRuntime(): DashboardRuntime | null {
  return useContext(DashboardRuntimeContext);
}

// 0.6 snag 4 / 02: the page's state on every variant axis (catalogue/variants.ts): the
// Results pill (on a Results dashboard), Context's Compare against and Comparisons'
// comparator kind. Each panel reads the axes it varies by (panelState).
export function runtimeState(runtime: DashboardRuntime | null, resultsPill: boolean): VariantState | null {
  if (!runtime) return null;
  return { ...(resultsPill ? { results: runtime.results } : {}), compareAgainst: runtime.contextAgainst, comparator: runtime.comparator };
}
