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
