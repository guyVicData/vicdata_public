"use client";

// VicData 0.6.1 S3: a configured panel's rail under the v2 renderer -- its config's view
// instances, in config order, for the panel's current state. (Under v1, rail.tsx in
// dashboard-config filters the host's own buttons by dataview instead; it stays for v1.)
//
// The panel's frame -- its tag, "From" menu, summary sentence, Trend line toggle, source --
// is still the host's in this part, and follows the view the host is on. So each instance
// keeps the host on its preset: a translated preset IS its host button (the same element,
// label, icon and enabled state, so a page of presets draws exactly as v1 does); a spec of
// its own (a different compare, rows or look -- "History, this school only") gets its own
// button with its spec's icon, and while it is showing the host is kept on its preset, so the
// frame around it is that preset's.
import { cloneElement, Fragment, type ReactNode } from "react";
import { presetSpec } from "@/catalogue/viewspec";
import type { DataviewInstance, PanelConfig } from "@/catalogue/types";
import { configuredDefaultFor, defaultOnState, viewsOnState, type VariantState } from "@/catalogue/variants";
import { DATAVIEWS } from "@/catalogue/dataviews";
import * as Icons from "@/components/teacher/PanelIcons";
import type { RailEntry } from "@/components/dashboard-config/rail";

export type ViewInstance = Extract<DataviewInstance, { kind: "view" }>;

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

// Is this instance its preset, unchanged? (A spec with no known preset is its own.)
export function isPresetInstance(v: ViewInstance): boolean {
  if (!v.spec?.preset) return !v.spec;
  try {
    return same(v.spec, presetSpec(v.spec.preset));
  } catch {
    return false;
  }
}

const viewsOf = (cfg: PanelConfig, state: VariantState | null): ViewInstance[] =>
  (state ? viewsOnState(cfg, state) : cfg.dataviews).flatMap((v) => (v.kind === "view" ? [v] : []));

// The instance of its own the member has open, while it is still on the panel's rail.
export function liveOwnView(cfg: PanelConfig, state: VariantState | null, chosen: string | null | undefined): ViewInstance | null {
  if (!chosen) return null;
  return viewsOf(cfg, state).find((v) => v.id === chosen && !isPresetInstance(v)) ?? null;
}

// The panel's default for this state, when it is a spec of its own (the first show opens it).
export function ownDefault(cfg: PanelConfig, state: VariantState | null): ViewInstance | null {
  const id = configuredDefaultFor(cfg, state ?? {});
  return viewsOf(cfg, state).find((v) => v.id === id && !isPresetInstance(v)) ?? null;
}

// The instance the panel is showing: the member's own-spec view, else the preset the host is
// on (a preset instance first, where two instances share it), else the default (or first).
export function shownInstance(cfg: PanelConfig, entries: RailEntry[], state: VariantState | null, own: ViewInstance | null): ViewInstance | undefined {
  if (own) return own;
  const all = cfg.dataviews.flatMap((v) => (v.kind === "view" ? [v] : []));
  const shown = viewsOf(cfg, state);
  const active = entries.find((e) => e.active)?.dataview;
  const pick = (list: ViewInstance[]) => list.find((v) => v.dataview === active && isPresetInstance(v)) ?? list.find((v) => v.dataview === active);
  // S3d: a host with no rail of its own (Grade counts' Current) has no active entry: the
  // state's own default, or its first view (not a view another state shows).
  const onState = state ? defaultOnState(cfg, state) : undefined;
  return pick(shown) ?? pick(all) ?? (onState ? shown.find((v) => v.id === onState) : undefined) ?? all.find((v) => v.id === cfg.defaultView) ?? all[0];
}

function iconOf(name: string): ReactNode {
  const glyph = (Icons as unknown as Record<string, ReactNode>)[name];
  return glyph && typeof glyph === "object" ? glyph : Icons.TrendLineIcon;
}

// The rail: one button per instance on this state's rail. A panel with one view shows none.
export function instanceRail(
  entries: RailEntry[],
  cfg: PanelConfig,
  state: VariantState | null,
  own: ViewInstance | null,
  choose: (id: string | null) => void,
  labelOf: (v: ViewInstance) => string,
): ReactNode {
  if (cfg.dataviews.length === 1) return undefined;
  const views = viewsOf(cfg, state);
  const hasOwn = views.some((v) => !isPresetInstance(v));
  const seen = new Set<string>();
  const out: ReactNode[] = [];
  for (const v of views) {
    // The host's own button for the preset: absent = the host doesn't offer it here.
    const entry = entries.find((e) => e.dataview === v.dataview);
    if (!entry) continue;
    if (isPresetInstance(v)) {
      if (seen.has(v.dataview)) continue;
      seen.add(v.dataview);
      out.push(
        <Fragment key={v.dataview}>
          {hasOwn
            ? cloneElement(entry.element, {
                active: !own && entry.active,
                onClick: () => {
                  choose(null);
                  entry.onClick?.();
                },
              })
            : entry.element}
        </Fragment>,
      );
      continue;
    }
    out.push(
      <Fragment key={v.id}>
        <Icons.IconButton
          label={labelOf(v)}
          active={own?.id === v.id}
          disabled={entry.disabled}
          onClick={() => {
            choose(v.id);
            if (!entry.active) entry.onClick?.();
          }}
        >
          {iconOf(v.spec.icon)}
        </Icons.IconButton>
      </Fragment>,
    );
  }
  return out.length ? out : undefined;
}

// A rail button's words for a spec of its own: its title, else its preset's rail label.
export function ownViewLabel(v: ViewInstance): string {
  return v.title ?? v.spec.title ?? DATAVIEWS.find((d) => d.id === v.dataview)?.host.rail ?? "View";
}
