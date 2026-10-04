// 0.6 snagging round 3 / 03: which Results pill states a view is shown on.
//
// A Results dashboard's panels list the views of all four pill states (Average points,
// Grade 4+ / A*-E rate, Grade bands, Grade counts) in one rail; which of them a member
// sees on each pill is:
//   - the dataview's default, Dataview.resultsMeasures (absent = all four), read from the
//     hosts as they draw today -- so a config without the new fields draws exactly as
//     before -- and also the most the view can be drawn on;
//   - narrowed (or restored) per instance by DataviewInstance.resultsMeasures, never wider
//     than the dataview's default;
//   - with the host's own rules (gating, honest number types, R-DONUT-COUNTS-ONLY) still
//     applied on top by the host.
// The panel opens on PanelConfig.defaultViewByResults[pill] when set, else defaultView.
// Pure, so the hosts, the editor and the tests share it.
import { DATAVIEWS } from "./dataviews";
import type { DashboardConfig, Dataview, DataviewInstance, PanelConfig, ResultsMeasure } from "./types";

export const RESULTS_MEASURES: ResultsMeasure[] = ["points", "threshold", "bands", "counts"];

const BY_ID = new Map(DATAVIEWS.map((d) => [d.id as string, d]));

// The pill states a dataview is offered on by default (and can be drawn on at most).
export function dataviewResults(dv: Dataview | undefined): ResultsMeasure[] {
  return dv?.resultsMeasures ?? RESULTS_MEASURES;
}

// The pill states an instance shows on: its override, within what its dataview can draw;
// else its dataview's default. Placeholders show on every state (super-admin only).
export function effectiveResults(v: DataviewInstance): ResultsMeasure[] {
  if (v.kind !== "view") return RESULTS_MEASURES;
  const can = dataviewResults(BY_ID.get(v.dataview));
  const own = v.resultsMeasures;
  return own ? RESULTS_MEASURES.filter((m) => can.includes(m) && own.includes(m)) : can;
}

export function showsOn(v: DataviewInstance, measure: ResultsMeasure): boolean {
  return effectiveResults(v).includes(measure);
}

// Does this dashboard follow a Results pill? (a Results column whose sub-measure is the
// pill's, as the seeded GCSE / Post-16 Results dashboards are)
export function followsResultsPill(config: DashboardConfig): boolean {
  return config.columns.some((c) => c.data.data === "academic.results" && (c.data.results ?? "pill") === "pill");
}

// The panel's views on one pill state, in config order.
export function viewsOnResults(panel: PanelConfig, measure: ResultsMeasure): DataviewInstance[] {
  return panel.dataviews.filter((v) => showsOn(v, measure));
}

// The view a panel opens on for a pill state, as configured: that state's entry when set
// (and still shown on it), else defaultView -- today's behaviour. undefined = none set.
export function configuredDefault(panel: PanelConfig, measure: ResultsMeasure | null): string | undefined {
  if (measure) {
    const id = panel.defaultViewByResults?.[measure];
    const v = id ? panel.dataviews.find((x) => x.id === id) : undefined;
    if (v && showsOn(v, measure)) return id;
  }
  return panel.defaultView;
}

// The default as the editor shows it (the tick, the tag, the rail dot): the configured
// default when it is on this pill's rail, else the first view on it.
export function defaultOnResults(panel: PanelConfig, measure: ResultsMeasure): string | undefined {
  const views = viewsOnResults(panel, measure);
  const id = configuredDefault(panel, measure);
  return views.some((v) => v.id === id) ? id : views[0]?.id;
}

// An instance as written: no override when it matches the dataview's default.
export function withResults(v: DataviewInstance, measures: ResultsMeasure[]): DataviewInstance {
  if (v.kind !== "view") return v;
  const can = dataviewResults(BY_ID.get(v.dataview));
  const next = RESULTS_MEASURES.filter((m) => can.includes(m) && measures.includes(m));
  const rest = { ...v };
  delete rest.resultsMeasures;
  return next.length === can.length ? rest : { ...rest, resultsMeasures: next };
}

// Adding a view while the editor's pill is on `measure`: the new instance is tagged for
// that state only, unless its dataview's default already says just that, or it can't be
// drawn there at all (then it keeps its default, and the editor says so).
export function tagForPill(v: DataviewInstance, measure: ResultsMeasure): DataviewInstance {
  if (v.kind !== "view" || v.resultsMeasures) return v;
  const can = dataviewResults(BY_ID.get(v.dataview));
  if (!can.includes(measure) || (can.length === 1 && can[0] === measure)) return v;
  return { ...v, resultsMeasures: [measure] };
}

// A view copied somewhere with no Results pill (another kind of dashboard, a meeting)
// leaves its measures behind.
export function withoutResults<T extends { resultsMeasures?: unknown }>(v: T): T {
  const out = { ...v };
  delete out.resultsMeasures;
  return out;
}
