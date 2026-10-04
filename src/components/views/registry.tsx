"use client";

// VicData 0.6.1 S3: the view types the config-driven renderer draws, by `spec.view.kind`.
//
// A view type registers once: how to build its series from a spec and the panel's frame,
// and (optionally) how to draw them -- by default the shared leaf renderer (SeriesView),
// which knows every leaf a builder can return. A kind with no registration, or a build that
// returns null, is drawn by the panel's host as before; so later parts add ranking, numbers,
// slope, donut, the maps, the geography views, grade counts and the spread by registering
// their kind here, nothing else.
import type { ReactNode } from "react";
import type { ViewKind, ViewSpec } from "@/catalogue/viewspec";
import type { BuildContext, ViewFrame, ViewSeries } from "@/lib/view-series";
import { SeriesView } from "./SeriesView";

export type ViewKindDef = {
  kind: ViewKind;
  build: (spec: ViewSpec, frame: ViewFrame, ctx: BuildContext) => ViewSeries | null;
  render?: (series: ViewSeries, ctx: BuildContext) => ReactNode;
};

const KINDS = new Map<ViewKind, ViewKindDef>();

export function registerViewKind(def: ViewKindDef): void {
  KINDS.set(def.kind, def);
}

export function viewKindRegistered(kind: ViewKind): boolean {
  return KINDS.has(kind);
}

// The view drawn from its spec, or null when its host should draw it.
export function renderView(spec: ViewSpec, frame: ViewFrame | undefined, ctx: BuildContext): ReactNode | null {
  const def = KINDS.get(spec.view.kind);
  if (!def || !frame) return null;
  const series = def.build(spec, frame, ctx);
  if (!series) return null;
  return def.render ? def.render(series, ctx) : <SeriesView series={series} fullscreen={ctx.fullscreen} />;
}
