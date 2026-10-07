"use client";

// VicData 0.6.3 S4: a year table's layout -- years across (one row per subject or school,
// the years as columns; as before) or years down (one row per year, every year, then the
// change row). The member's own choice per view is remembered with their other page
// settings (TeacherDashboard provides the store); the view's own (the editor's "Years
// across / Years down") is the default; with neither, a table of one or two rows opens
// years down (a single subject, or the school beside England).
import { createContext, useContext } from "react";

export type YearsLayout = "across" | "down";

export type TableLayoutStore = { get: (key: string) => YearsLayout | null; set: (key: string, layout: YearsLayout) => void };

export const TableLayoutContext = createContext<TableLayoutStore | null>(null);

export function useTableLayoutStore(): TableLayoutStore | null {
  return useContext(TableLayoutContext);
}

/** The layout a table opens in: the member's, else the view's, else by its row count. */
export function yearsLayoutFor(member: YearsLayout | null, view: YearsLayout | undefined, rows: number): YearsLayout {
  return member ?? view ?? (rows <= 2 ? "down" : "across");
}

/**
 * 0.6.4 A (R-TREND-TABLE-YEARS): the years a year table shows, by index into `periods`, and
 * the years it leaves out. Years down and fullscreen show every year (the trend chart's own);
 * a card across shows the change's two ends (from `statementFrom`, R-TREND-FROM-2223) when it
 * has more than two, and names the rest (`hidden`, the "+N more years" cue).
 */
export function yearColumnsShown(
  periods: readonly number[],
  statementFrom: number | null | undefined,
  opts: { yearColumns: "first-latest" | "every" | "latest"; fullscreen: boolean; layout: YearsLayout },
): { shown: number[]; hidden: number[] } {
  const all = periods.map((_, i) => i);
  if (opts.layout === "down") return { shown: all, hidden: [] };
  if (opts.yearColumns === "latest") return { shown: periods.length ? [periods.length - 1] : [], hidden: [] };
  if (opts.yearColumns === "every" || opts.fullscreen || periods.length <= 2) return { shown: all, hidden: [] };
  const fromIdx = Math.max(0, statementFrom === null || statementFrom === undefined ? 0 : periods.findIndex((p) => p >= statementFrom));
  const shown = [fromIdx < periods.length - 1 ? fromIdx : 0, periods.length - 1];
  return { shown, hidden: all.filter((i) => !shown.includes(i)) };
}
