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
import type { DataviewId, HostId, PanelConfig, ResultsMeasure } from "@/catalogue/types";
import { asState, configuredDefaultFor, showsOnState, type VariantState } from "@/catalogue/variants";
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

// The state a configured panel is drawn in: the current state of every axis it varies by
// (0.6 snag 4 / 02, catalogue/variants.ts) -- round 3's Results pill alone is still accepted.
type PanelStateArg = VariantState | ResultsMeasure | null;

// The panel's dataview ids in config order (placeholders left out). `state` (0.6 snag 3 /
// 03, generalised in snag 4 / 02): only the views shown in that state.
export function configViewIds(cfg: PanelConfig, state: PanelStateArg = null): DataviewId[] {
  const st = asState(state);
  return cfg.dataviews.flatMap((v) => (v.kind === "view" && showsOnState(v, st) ? [v.dataview] : []));
}

// The rail a configured panel shows: only entries whose dataview the config lists (for the
// panel's current state), in the config's order. A panel with exactly one view shows no
// rail at all.
export function configuredRail(entries: RailEntry[], cfg: PanelConfig, state: PanelStateArg = null): ReactNode {
  const ids = configViewIds(cfg, state);
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
// In a state (`state`), the state's own default when one is set, among the views shown in
// it; when the host is on a view the state's rail doesn't list, it moves.
export function defaultEntry(entries: RailEntry[], cfg: PanelConfig, state: PanelStateArg = null): RailEntry | null {
  const st = asState(state);
  const ids = configViewIds(cfg, st);
  const usable = (e: RailEntry | undefined) => (e && !e.disabled && e.onClick ? e : null);
  const wantedId = configuredDefaultFor(cfg, st);
  const defaultId = cfg.dataviews.find((v) => v.id === wantedId && v.kind === "view" && showsOnState(v, st));
  const wanted = defaultId && defaultId.kind === "view" ? usable(entries.find((e) => e.dataview === defaultId.dataview)) : null;
  if (wanted) return wanted.active ? null : wanted;
  const active = entries.find((e) => e.active);
  if (active && active.dataview && ids.includes(active.dataview)) return null;
  const first = ids.map((id) => usable(entries.find((e) => e.dataview === id))).find((e) => e);
  return first && !first.active ? first : null;
}

// 0.6.1 S1: whether the host already shows the panel's default for this state, so its
// first show has nothing to switch. The renderer then counts the default as applied: a
// member's first rail click away from it is theirs, not undone by a late "first show".
export function onDefault(entries: RailEntry[], cfg: PanelConfig, state: PanelStateArg = null): boolean {
  const st = asState(state);
  const wantedId = configuredDefaultFor(cfg, st);
  const def = cfg.dataviews.find((v) => v.id === wantedId && v.kind === "view" && showsOnState(v, st));
  return !!def && def.kind === "view" && entries.some((e) => e.active && e.dataview === def.dataview);
}

// 0.6 snag 3 / 03 (every axis since snag 4 / 02): when the host is showing a view the
// current state's rail doesn't list (its instance was taken off this state), the entry to
// move it to: the state's default, else its first offered view. null = nothing to do.
// 0.6.1 S1 (pinch point 2): the same when the host is on a view the config doesn't list at
// all -- a view removed from the panel that was its remembered open view, or the view an
// embed (the editor's live preview) was last drawing -- in any state, none included. A
// view that isn't in the config is never drawn. A host button with no registered dataview
// is left alone, as before.
export function offRailEntry(entries: RailEntry[], cfg: PanelConfig, state: PanelStateArg): RailEntry | null {
  const st = asState(state);
  const active = entries.find((e) => e.active);
  if (!active || !active.dataview) return null;
  const ids = configViewIds(cfg, st);
  if (ids.includes(active.dataview)) return null;
  const usable = (e: RailEntry | undefined) => (e && !e.disabled && e.onClick ? e : null);
  const def = cfg.dataviews.find((v) => v.id === configuredDefaultFor(cfg, st));
  const wanted = def && def.kind === "view" && ids.includes(def.dataview) ? usable(entries.find((e) => e.dataview === def.dataview)) : null;
  return wanted ?? ids.map((id) => usable(entries.find((e) => e.dataview === id))).find((e) => e) ?? null;
}
