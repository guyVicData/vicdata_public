"use client";

// VicData 0.6 integration: the dashboard's runtime state, as a panel needs it to say what
// "Copy this view…" copies -- the school, the focus subject, the Candidates/Results toggle
// and Results measure, Context's live group and the Comparisons set, and the real data
// years. TeacherDashboard provides it only under a plan (flag on, or a stored dashboard),
// so unflagged pages never see it; ColumnPanels reads it to build each panel's
// CopyViewSourceContext.
import { createContext, useContext } from "react";
import type { Phase } from "@/catalogue/types";
import type { RuntimeLabels } from "@/lib/pin-context";

export type DashboardRuntime = RuntimeLabels & {
  phase: Phase;
  measure: "candidates" | "results";
  // The focused item's raw subject and qualification (for the pin).
  focusSubject: { subject: string; qualificationType: string } | null;
  // The Comparisons column's set id (saved set key / chooser / default).
  setId: string | null;
  superAdmin: boolean;
};

export const DashboardRuntimeContext = createContext<DashboardRuntime | null>(null);

export function useDashboardRuntime(): DashboardRuntime | null {
  return useContext(DashboardRuntimeContext);
}
