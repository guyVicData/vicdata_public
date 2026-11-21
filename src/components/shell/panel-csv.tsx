"use client";

// Panel menu "Save as CSV" (Guy, 21 Nov): how a panel says what its rows are.
//
// ONE pattern, everywhere (docs/v0.8/panel_menu_csv_v1.md): the view that draws the figure
// registers its rows with usePanelCsv(() => table). CardBox -- every panel in every product,
// Teacher, SMT, Admissions, group, custom dashboards and meeting slides -- holds a registry
// (PanelCsvRegistry), and the panel's ··· menu (PanelExport) offers "Save as CSV" only when the
// view inside it has registered rows. A view that registers nothing gets no row (never a
// disabled one).
//
// Why the view and not the panel's host: the view is the one place that holds exactly the rows
// it draws -- after the set, filters, year and suppression are applied -- so the CSV can't drift
// from the screen. The builder runs only when the menu opens (and again on the click), so a
// panel pays nothing for it until then.
//
// Full screen mounts a view twice (the card underneath and the modal): both register the same
// rows into the same registry, and closing the modal leaves the card's.
//
// The page names who the figures are for (the school or group) with PanelCsvScope, for the file
// name; a view may name the comparison set and the data year in its table's `about`, and the page
// may give defaults for both in the scope.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CsvTable } from "@/lib/csv";

export type PanelCsvBuild = () => CsvTable | null;

export type Registry = { add: (entry: { current: PanelCsvBuild | null }) => () => void; get: () => CsvTable | null; title: string };

const RegistryContext = createContext<Registry | null>(null);

/** The page's scope: who the figures are for, and the set and year a view doesn't name itself. */
export type CsvScope = { who: string | null; set?: string | null; year?: string | null };
export const PanelCsvScope = createContext<CsvScope | null>(null);
export const usePanelCsvScope = () => useContext(PanelCsvScope);

/** The registry itself, pure (R-PANEL-CSV-ROWS tests it): views add a builder and take it away on
 * unmount; get() is the latest-added builder that has rows -- the modal's while full screen is open,
 * the card's again once it closes. */
export function createCsvRegistry(title: string): Registry {
  let entries: { current: PanelCsvBuild | null }[] = [];
  return {
    title,
    add: (entry) => {
      entries.push(entry);
      return () => {
        entries = entries.filter((e) => e !== entry);
      };
    },
    get: () => {
      for (let i = entries.length - 1; i >= 0; i--) {
        const t = entries[i].current?.();
        if (t) return t;
      }
      return null;
    },
  };
}

/** CardBox's: the panel's registry. */
export function PanelCsvRegistry({ title, children }: { title: string; children: ReactNode }) {
  // One registry for the panel's life; the title is read live (a rail switch renames the panel).
  const [reg] = useState(() => createCsvRegistry(title));
  const value = useMemo<Registry>(() => ({ ...reg, title }), [reg, title]);
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

/** A view's: "these are my rows". Call it unconditionally, before any early return; return null
 * from the builder when the view draws nothing (an empty state, still loading). Outside a panel
 * (a page that draws a view bare) it does nothing. */
export function usePanelCsv(build: PanelCsvBuild | null): void {
  const reg = useContext(RegistryContext);
  const ref = useRef<PanelCsvBuild | null>(build);
  useEffect(() => {
    ref.current = build;
  });
  useEffect(() => {
    if (!reg) return;
    return reg.add(ref);
  }, [reg]);
}

/** The menu's: the panel's rows now, its title and the page's scope -- or null with no rows. */
export function usePanelCsvSource(): { get: () => CsvTable | null; title: string; scope: CsvScope | null } | null {
  const reg = useContext(RegistryContext);
  const scope = useContext(PanelCsvScope);
  if (!reg) return null;
  return {
    title: reg.title,
    scope,
    get: () => {
      const t = reg.get();
      if (!t || !t.rows.length) return null;
      // The page's set and year, where the view didn't name its own.
      const set = t.about?.set !== undefined ? t.about.set : (scope?.set ?? null);
      const year = t.about?.year !== undefined ? t.about.year : (scope?.year ?? null);
      return { ...t, about: { set, year } };
    },
  };
}
