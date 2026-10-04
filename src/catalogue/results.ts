// 0.6 snagging round 3 / 03: which Results pill states a view is shown on.
//
// 0.6 snag 4 / 02: the Results pill is now one axis of the variant mechanism
// (src/catalogue/variants.ts), which also covers Context's Compare against and Comparisons'
// comparator kind. These are its Results-only names, kept for the callers and tests that
// speak only of the pill; each is the general function on the `results` axis.
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
import {
  AXIS_STATES,
  configuredDefaultFor,
  dataviewStates,
  defaultOnState,
  effectiveStates,
  followsResultsPill,
  showsOnState,
  viewsOnState,
  withStates,
  withoutVariants,
} from "./variants";
import { DATAVIEWS } from "./dataviews";
import type { Dataview, DataviewInstance, PanelConfig, ResultsMeasure } from "./types";

export { followsResultsPill, withoutVariants };

const BY_ID = new Map(DATAVIEWS.map((d) => [d.id as string, d]));
const dataviewOf = (v: Extract<DataviewInstance, { kind: "view" }>): Dataview | undefined => BY_ID.get(v.dataview);

export const RESULTS_MEASURES: ResultsMeasure[] = AXIS_STATES.results;

// The pill states a dataview is offered on by default (and can be drawn on at most).
export function dataviewResults(dv: Dataview | undefined): ResultsMeasure[] {
  return dataviewStates(dv, "results");
}

// The pill states an instance shows on: its override, within what its dataview can draw;
// else its dataview's default. Placeholders show on every state (super-admin only).
export function effectiveResults(v: DataviewInstance): ResultsMeasure[] {
  return effectiveStates(v, "results");
}

export function showsOn(v: DataviewInstance, measure: ResultsMeasure): boolean {
  return showsOnState(v, { results: measure });
}

// The panel's views on one pill state, in config order.
export function viewsOnResults(panel: PanelConfig, measure: ResultsMeasure): DataviewInstance[] {
  return viewsOnState(panel, { results: measure });
}

// The view a panel opens on for a pill state, as configured: that state's entry when set
// (and still shown on it), else defaultView -- today's behaviour. undefined = none set.
export function configuredDefault(panel: PanelConfig, measure: ResultsMeasure | null): string | undefined {
  return configuredDefaultFor(panel, measure ? { results: measure } : {});
}

// The default as the editor shows it (the tick, the tag, the rail dot): the configured
// default when it is on this pill's rail, else the first view on it.
export function defaultOnResults(panel: PanelConfig, measure: ResultsMeasure): string | undefined {
  return defaultOnState(panel, { results: measure });
}

// An instance as written: no override when it matches the dataview's default.
export function withResults(v: DataviewInstance, measures: ResultsMeasure[]): DataviewInstance {
  return withStates(v, "results", measures);
}

// Adding a view while the editor's pill is on `measure`: the new instance is tagged for
// that state only, unless its dataview's default already says just that, or it can't be
// drawn there at all (then it keeps its default, and the editor says so).
export function tagForPill(v: DataviewInstance, measure: ResultsMeasure): DataviewInstance {
  if (v.kind !== "view" || v.resultsMeasures) return v;
  const can = dataviewResults(dataviewOf(v));
  if (!can.includes(measure) || (can.length === 1 && can[0] === measure)) return v;
  return { ...v, resultsMeasures: [measure] };
}

// A view copied somewhere with no Results pill (another kind of dashboard, a meeting)
// leaves its measures behind. (A meeting leaves every axis: variants.ts withoutVariants.)
export function withoutResults<T extends { resultsMeasures?: unknown }>(v: T): T {
  const out = { ...v };
  delete out.resultsMeasures;
  return out;
}
