// 0.6 snagging round 4 / 02: one "variant" mechanism -- which of a panel's views show in each
// state of the page, generalising round 3's Results pill (results.ts) to every axis a host
// varies by.
//
//   axis            states                                  varies
//   results         points / threshold / bands / counts     every panel on a Results dashboard
//   compareAgainst  category / whole / selected             Context's panels (its Compare against pill)
//   comparator      schools / ranking                       Comparisons' panels (a set of schools or a ranking)
//
// For each axis a view shows on:
//   - its dataview's default (Dataview.resultsMeasures for results, Dataview.variants for the
//     others; absent = every state), read from the hosts as they draw today -- so a config
//     without the new fields draws exactly as before -- and also the most it can be drawn on;
//   - narrowed (or restored) per instance (DataviewInstance.resultsMeasures / .variants),
//     never wider than its dataview's default;
//   - with the host's own rules still applied on top by the host.
// A panel shows the views that apply to the current state of EVERY axis it varies by, and
// opens on its default for that state: PanelConfig.defaultViewByState[stateKey] where the
// panel varies by more than Results alone, else defaultViewByResults[pill] (round 3's,
// unchanged), else defaultView.
//
// The Results axis keeps round 3's storage (resultsMeasures, defaultViewByResults), so
// configs already published read exactly as they did (schema_version 2 since 0.6.1 S2 only
// added each view's spec). Pure, so the
// hosts, the editor and the tests share it.
import { DATAVIEWS } from "./dataviews";
import type { ComparatorState, CompareAgainstState, DashboardConfig, Dataview, DataviewInstance, HostId, PanelConfig, ResultsMeasure, VariantSets } from "./types";

export type VariantAxis = "results" | "compareAgainst" | "comparator";
export type AxisStateMap = { results: ResultsMeasure; compareAgainst: CompareAgainstState; comparator: ComparatorState };
// The current state of each axis that applies (a panel's, or the whole page's).
export type VariantState = { [A in VariantAxis]?: AxisStateMap[A] };

export const VARIANT_AXES: VariantAxis[] = ["results", "compareAgainst", "comparator"];
export const AXIS_STATES: { [A in VariantAxis]: AxisStateMap[A][] } = {
  results: ["points", "threshold", "bands", "counts"],
  compareAgainst: ["category", "whole", "selected"],
  comparator: ["schools", "ranking"],
};

// The host whose views an axis varies; Results varies every view on a Results dashboard.
const AXIS_HOST: Partial<Record<VariantAxis, HostId>> = { compareAgainst: "teacher.c2.context", comparator: "teacher.c3.comparisons" };

const BY_ID = new Map(DATAVIEWS.map((d) => [d.id as string, d]));

type ViewInstance = Extract<DataviewInstance, { kind: "view" }>;
type States = string[];

// The states a dataview is offered on by default (and can be drawn on at most).
export function dataviewStates<A extends VariantAxis>(dv: Dataview | undefined, axis: A): AxisStateMap[A][] {
  const own = axis === "results" ? dv?.resultsMeasures : dv?.variants?.[axis as Exclude<VariantAxis, "results">];
  return (own as AxisStateMap[A][] | undefined) ?? AXIS_STATES[axis];
}

function ownStates(v: ViewInstance, axis: VariantAxis): States | undefined {
  return axis === "results" ? v.resultsMeasures : v.variants?.[axis];
}

// The states an instance shows on: its override, within what its dataview can draw; else
// its dataview's default. Placeholders show on every state (super-admin only).
export function effectiveStates<A extends VariantAxis>(v: DataviewInstance, axis: A): AxisStateMap[A][] {
  const all = AXIS_STATES[axis];
  if (v.kind !== "view") return all;
  const can = dataviewStates(BY_ID.get(v.dataview), axis) as States;
  const own = ownStates(v, axis);
  return (own ? all.filter((s) => can.includes(s) && own.includes(s)) : can) as AxisStateMap[A][];
}

// Does the instance show in this state (every axis given)?
export function showsOnState(v: DataviewInstance, state: VariantState): boolean {
  return VARIANT_AXES.every((a) => state[a] === undefined || (effectiveStates(v, a) as States).includes(state[a]!));
}

// An instance as written: no override for an axis when it matches the dataview's default.
export function withStates<A extends VariantAxis>(v: DataviewInstance, axis: A, states: AxisStateMap[A][]): DataviewInstance {
  if (v.kind !== "view") return v;
  const can = dataviewStates(BY_ID.get(v.dataview), axis) as States;
  const next = (AXIS_STATES[axis] as States).filter((s) => can.includes(s) && (states as States).includes(s));
  const full = next.length === can.length;
  if (axis === "results") {
    const rest = { ...v };
    delete rest.resultsMeasures;
    return full ? rest : { ...rest, resultsMeasures: next as ResultsMeasure[] };
  }
  const variants: VariantSets = { ...(v.variants ?? {}) };
  if (full) delete variants[axis as keyof VariantSets];
  else (variants as Record<string, States>)[axis] = next;
  const rest = { ...v };
  delete rest.variants;
  return Object.keys(variants).length ? { ...rest, variants } : rest;
}

// A view copied somewhere that varies by nothing (a meeting) leaves every axis behind.
export function withoutVariants<T extends { resultsMeasures?: unknown; variants?: unknown }>(v: T): T {
  const out = { ...v };
  delete out.resultsMeasures;
  delete out.variants;
  return out;
}

// ------------------------------------------------------------------ which axes, which state

// Does this dashboard follow a Results pill? (a Results column whose sub-measure is the
// pill's, as the seeded GCSE / Post-16 Results dashboards are)
export function followsResultsPill(config: Pick<DashboardConfig, "columns">): boolean {
  return config.columns.some((c) => c.data.data === "academic.results" && (c.data.results ?? "pill") === "pill");
}

// The axes a panel varies by: Results on a Results dashboard; Context's and Comparisons'
// own axes on the panels their hosts draw (by the panel's views' dataviews).
export function panelAxes(config: Pick<DashboardConfig, "columns">, panel: PanelConfig): VariantAxis[] {
  const hosts = new Set(panel.dataviews.flatMap((v) => (v.kind === "view" ? [BY_ID.get(v.dataview)?.host.id] : [])));
  return VARIANT_AXES.filter((a) => (a === "results" ? followsResultsPill(config) : hosts.has(AXIS_HOST[a])));
}

// Every axis any panel of the dashboard varies by (the editor's pills).
export function configAxes(config: DashboardConfig): VariantAxis[] {
  const used = new Set(config.panels.flatMap((p) => panelAxes(config, p)));
  return VARIANT_AXES.filter((a) => used.has(a));
}

// The panel's own state: the page's (or the editor's) state on the axes the panel varies by.
export function panelState(config: Pick<DashboardConfig, "columns">, panel: PanelConfig, page: VariantState | null): VariantState {
  const out: VariantState = {};
  if (!page) return out;
  for (const a of panelAxes(config, panel)) if (page[a] !== undefined) (out as Record<string, string>)[a] = page[a]!;
  return out;
}

// "results:counts|compareAgainst:selected" -- the key defaultViewByState is written under.
export function stateKey(state: VariantState): string {
  return VARIANT_AXES.filter((a) => state[a] !== undefined).map((a) => `${a}:${state[a]}`).join("|");
}

function axesOf(state: VariantState): VariantAxis[] {
  return VARIANT_AXES.filter((a) => state[a] !== undefined);
}

// Results alone (round 3's case) keeps its own map; any other axis uses the state map.
function usesStateMap(state: VariantState): boolean {
  const axes = axesOf(state);
  return axes.length > 1 || (axes.length === 1 && axes[0] !== "results");
}

// ------------------------------------------------------------------ views and defaults

// The panel's views in one state, in config order.
export function viewsOnState(panel: PanelConfig, state: VariantState): DataviewInstance[] {
  return panel.dataviews.filter((v) => showsOnState(v, state));
}

// The state's own default, when one is set and still shown in it; undefined = none.
export function stateDefault(panel: PanelConfig, state: VariantState): string | undefined {
  const shown = (id: string | undefined) => {
    const v = id ? panel.dataviews.find((x) => x.id === id) : undefined;
    return v && showsOnState(v, state) ? id : undefined;
  };
  if (usesStateMap(state)) {
    const id = shown(panel.defaultViewByState?.[stateKey(state)]);
    if (id) return id;
  }
  return state.results ? shown(panel.defaultViewByResults?.[state.results]) : undefined;
}

// The view a panel opens on in a state, as configured: the state's own entry, else
// defaultView -- today's behaviour. undefined = none set.
export function configuredDefaultFor(panel: PanelConfig, state: VariantState): string | undefined {
  return stateDefault(panel, state) ?? panel.defaultView;
}

// The default as the editor shows it (the tick, the tag, the rail dot): the configured
// default when it is on this state's rail, else the first view on it.
export function defaultOnState(panel: PanelConfig, state: VariantState): string | undefined {
  const views = viewsOnState(panel, state);
  const id = configuredDefaultFor(panel, state);
  return views.some((v) => v.id === id) ? id : views[0]?.id;
}

// "Make this the default for …": written for this state only; the panel's own defaultView
// is left as it is. (Mutates `panel`, an editor op's clone.)
export function setStateDefault(panel: PanelConfig, state: VariantState, instanceId: string): void {
  if (usesStateMap(state)) panel.defaultViewByState = { ...(panel.defaultViewByState ?? {}), [stateKey(state)]: instanceId };
  else if (state.results) panel.defaultViewByResults = { ...(panel.defaultViewByResults ?? {}), [state.results]: instanceId };
}

// Rewrite the per-state default maps when instance ids change (move, copy, swap, remove):
// `map` gives the new id for an entry (and the state it is the default for), or undefined
// to drop it. Empty maps are removed. (Mutates `panel`, an editor op's clone.)
export function remapStateDefaults(panel: PanelConfig, map: (id: string, state: VariantState) => string | undefined): void {
  const byResults: NonNullable<PanelConfig["defaultViewByResults"]> = {};
  for (const m of AXIS_STATES.results) {
    const id = panel.defaultViewByResults?.[m] ? map(panel.defaultViewByResults[m]!, { results: m }) : undefined;
    if (id) byResults[m] = id;
  }
  if (Object.keys(byResults).length) panel.defaultViewByResults = byResults;
  else delete panel.defaultViewByResults;
  const byState: Record<string, string> = {};
  for (const [k, old] of Object.entries(panel.defaultViewByState ?? {})) {
    const id = old ? map(old, parseStateKey(k)) : undefined;
    if (id) byState[k] = id;
  }
  if (Object.keys(byState).length) panel.defaultViewByState = byState;
  else delete panel.defaultViewByState;
}

// Parse a defaultViewByState key back into its state.
export function parseStateKey(key: string): VariantState {
  const out: Record<string, string> = {};
  for (const part of key.split("|")) {
    const [a, s] = part.split(":");
    if (a && s && (VARIANT_AXES as string[]).includes(a)) out[a] = s;
  }
  return out as VariantState;
}

// Round 3's callers pass the Results pill alone; everything else a whole state.
export function asState(x: VariantState | ResultsMeasure | null | undefined): VariantState {
  if (!x) return {};
  return typeof x === "string" ? { results: x } : x;
}
