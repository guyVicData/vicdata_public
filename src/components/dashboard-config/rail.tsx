"use client";

// VicData 0.6 E: rail subsets. Under a config, a panel shows only its config's dataviews,
// in config order, and opens on its defaultView (scope brief §4; night 1's "subset or
// reorder within a panel's rail" to-do).
//
// The hosts build their rail as a run of IconButtons (CandidatesPanels, SubjectPanels,
// GradeCountsPanels, ComparisonsPanels), each labelled with the rail label the catalogue
// registers its view under (Dataview.host.rail). So a rail entry maps to its dataview id
// through dataviewForRail(host, panel, label) -- the catalogue's own field, not a second
// hand-kept map -- and the config renderer keeps, reorders or drops entries by that id.
// Nothing here runs without a plan: unflagged pages never call it.
import { Children, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { dataviewForRail } from "@/catalogue/dataviews";
import type { DataviewId, HostId, PanelConfig } from "@/catalogue/types";
import { IconButton } from "@/components/teacher/PanelIcons";

type ButtonProps = ComponentProps<typeof IconButton>;

export type RailEntry = {
  dataview: DataviewId | null;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick?: () => void;
  element: ReactElement<ButtonProps>;
};

// Every IconButton in a host's `actions`, in rail order (fragments flattened; falsy
// children -- a button the host doesn't offer for this state -- skipped).
export function railEntries(actions: ReactNode, host: HostId, panel: "current" | "trend"): RailEntry[] {
  const out: RailEntry[] = [];
  const walk = (node: ReactNode) =>
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) return walk((child.props as { children?: ReactNode }).children);
      if (child.type !== IconButton) return;
      const el = child as ReactElement<ButtonProps>;
      const label = el.props.railLabel ?? el.props.label;
      out.push({
        dataview: dataviewForRail(host, panel, label)?.id ?? null,
        label,
        active: !!el.props.active,
        disabled: !!el.props.disabled,
        onClick: el.props.onClick,
        element: el,
      });
    });
  walk(actions);
  return out;
}

// The panel's dataview ids in config order (placeholders left out).
export function configViewIds(cfg: PanelConfig): DataviewId[] {
  return cfg.dataviews.flatMap((v) => (v.kind === "view" ? [v.dataview] : []));
}

// The rail a configured panel shows: only entries whose dataview the config lists, in the
// config's order. A panel with exactly one view shows no rail at all.
export function configuredRail(entries: RailEntry[], cfg: PanelConfig): ReactNode {
  const ids = configViewIds(cfg);
  if (cfg.dataviews.length === 1) return undefined;
  const kept = entries
    .filter((e) => e.dataview !== null && ids.includes(e.dataview))
    .sort((a, b) => ids.indexOf(a.dataview!) - ids.indexOf(b.dataview!));
  if (kept.length === 0) return undefined;
  return kept.map((e) => <Fragment key={e.dataview}>{e.element}</Fragment>);
}

// The entry to switch to when the panel first shows: its defaultView when the host offers
// it, else (when what the host opened on isn't one of the config's views) the first of
// the config's views it does offer. null = leave the host where it is.
export function defaultEntry(entries: RailEntry[], cfg: PanelConfig): RailEntry | null {
  const ids = configViewIds(cfg);
  const usable = (e: RailEntry | undefined) => (e && !e.disabled && e.onClick ? e : null);
  const defaultId = cfg.dataviews.find((v) => v.id === cfg.defaultView && v.kind === "view");
  const wanted = defaultId && defaultId.kind === "view" ? usable(entries.find((e) => e.dataview === defaultId.dataview)) : null;
  if (wanted) return wanted.active ? null : wanted;
  const active = entries.find((e) => e.active);
  if (active && active.dataview && ids.includes(active.dataview)) return null;
  const first = ids.map((id) => usable(entries.find((e) => e.dataview === id))).find((e) => e);
  return first && !first.active ? first : null;
}
