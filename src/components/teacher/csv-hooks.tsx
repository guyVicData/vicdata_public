"use client";

// Panel menu "Save as CSV" (21 Nov): how a Teacher leaf registers its rows (csv.ts has the
// builders). One wrapper over the shell's usePanelCsv, so every leaf adds what its panel rests on:
//
//   TeacherCsvAbout -- the panel's data year (Current's "Data 2024/25", the year its year menu is
//   on) and comparison set (Comparisons' set), provided by ColumnPanels from the host's
//   PanelRender.csvAbout around the body, wherever the body is drawn (card, full screen, a meeting
//   slot's figure). A trend leaf (it has its own Year column) writes no data year.
//
// Outside a panel (no CardBox registry) the shell's hook does nothing.
import { createContext, useContext } from "react";
import type { CsvTable } from "@/lib/csv";
import { usePanelCsv } from "@/components/shell/panel-csv";

export type TeacherCsvAboutValue = { year?: string | null; set?: string | null };
export const TeacherCsvAbout = createContext<TeacherCsvAboutValue>({});

// The tests' seam (src/lib/panel-csv-teacher.test.ts): a server render runs no effects, so the shell's
// registry never sees a builder there; with a probe provided, each leaf hands its builder over as it
// renders, and the test calls it once the markup is drawn. Absent everywhere else.
export const TeacherCsvProbe = createContext<((build: () => CsvTable | null) => void) | null>(null);

/** A leaf's rows, with the panel's year and set. `trend`: the table has its own Year column. */
export function useTeacherCsv(build: () => CsvTable | null, kind: "year" | "trend" = "year"): void {
  const about = useContext(TeacherCsvAbout);
  const probe = useContext(TeacherCsvProbe);
  const withAbout = () => {
    const t = build();
    if (!t || !t.rows.length) return null;
    const own = t.about ?? {};
    const year = kind === "trend" ? null : own.year !== undefined ? own.year : about.year;
    const set = own.set !== undefined ? own.set : about.set;
    return { ...t, about: { ...(year !== undefined ? { year } : {}), ...(set !== undefined ? { set } : {}) } };
  };
  probe?.(withAbout);
  usePanelCsv(withAbout);
}

/** A host's rows where no leaf holds them (a map drawn by another product's component): draws nothing. */
export function TeacherCsvRows({ build, kind = "year" }: { build: () => CsvTable | null; kind?: "year" | "trend" }) {
  useTeacherCsv(build, kind);
  return null;
}
