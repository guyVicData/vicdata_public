// Every dashboard config seeded in code. VicData-owned dashboards live here as the seed
// for the `dashboards` table (S2 migration) and as the renderer's fallback while a
// dashboard has no published row.
import type { DashboardConfig } from "../types";
import { TEACHER_DASHBOARDS } from "./teacher";
import { ADMISSIONS_DASHBOARDS } from "./admissions";
import { SMT_DASHBOARDS } from "./smt";

// 0.7 admissions r2: the Admissions dashboards after Teacher's (Teacher's order is unchanged).
// 0.8 SMT round 1: the SMT dashboards after Admissions' (both unchanged).
export const DASHBOARDS: DashboardConfig[] = [...TEACHER_DASHBOARDS, ...ADMISSIONS_DASHBOARDS, ...SMT_DASHBOARDS];

export function dashboardById(id: string): DashboardConfig | undefined {
  return DASHBOARDS.find((d) => d.id === id);
}

// A group's dashboards in switcher order (scope brief §4.2).
export function groupOf(config: DashboardConfig): DashboardConfig[] {
  if (!config.group) return [config];
  return DASHBOARDS.filter((d) => d.group?.id === config.group!.id).sort((a, b) => a.group!.order - b.group!.order);
}

export { TEACHER_DASHBOARDS, teacherDashboardFor } from "./teacher";
export { ADMISSIONS_DASHBOARDS, ADMISSIONS_PIPELINES_ID, ADMISSIONS_MARKET_ID, isAdmissionsDashboard } from "./admissions";
export { SMT_DASHBOARDS, SMT_OVERVIEW_ID, SMT_ACADEMIC_ID, SMT_COMING, isSmtDashboard } from "./smt";
