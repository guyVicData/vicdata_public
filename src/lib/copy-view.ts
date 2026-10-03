// VicData 0.6 S6: "Copy this view" (scope brief §7.4; boards docs/wireframes/v0.6/CopyTo
// and CopyToMeeting). The pure half: the slot map of a destination dashboard, the fit
// check, what the copy does to the destination config, a new dashboard made from a view,
// and the meeting slide picker's words. The dialog is src/components/copy-view/.
//
// To a dashboard, a view can go three places (the board's mini map):
//   rail     onto an existing panel's rail;
//   empty    into an empty cell of the grid (a new panel);
//   new-row  into a new row (a new panel in column 1, the row's Time from the view).
// The fit check is the chooser's own matching rule (matching.ts whyNot) against the slot's
// column + row context: a view that matches follows the column from then on; one that
// doesn't keeps its own settings and arrives marked "overridden" (a PanelOverride on its
// new panel). A panel is one context, so a view that doesn't fit an existing panel's
// column isn't put on that panel's rail -- the dialog offers an empty slot or a new row.
//
// To a meeting there is no fit check (a slot has nothing to inherit): the view goes in
// pinned, in the next free slot, and the slide re-arranges (meeting-ops addViewToMeeting).
import { dataviewById, whyNot, type MatchFailure } from "@/catalogue";
import { contextFromPanel, overrideBetween, settingsOf, toPickContext, type PanelLabels, type PickOverride, type PickPanelContext } from "@/catalogue/pick";
import {
  CONFIG_SCHEMA_VERSION,
  type ColumnHeader,
  type DashboardConfig,
  type Dataview,
  type DataviewInstance,
  type PanelConfig,
  type RowConfig,
  type RowTime,
  type SlideConfig,
} from "@/catalogue/types";
import type { DashboardRow } from "./dashboards-store";
import { arrangementName, MAX_SLOTS } from "./meeting-layout";
import { KIND_WORD, type PinInput, type PinnedSettings } from "./meeting-views";

// ---------------------------------------------------------------------------------
// The source: what a panel hands the dialog

export type ViewInstance = Extract<DataviewInstance, { kind: "view" }>;

export type CopyViewSource = {
  // The view instance as the panel holds it (its rail's active view).
  instance: ViewInstance;
  // The panel's resolved context (contextFromPanel, with the Results pill, subject chip
  // and set labels filled in).
  context: PickPanelContext;
  // The settings resolved from the panel's current state, for a meeting slot (S7).
  pinned: PinInput;
  // The resolved title, as the panel shows it ("Maths (General) points against 10
  // nearest, since 2021/22").
  title: string;
};

export function sourceDataview(source: CopyViewSource): Dataview | undefined {
  return dataviewById(source.instance.dataview);
}

// ---------------------------------------------------------------------------------
// Words

export const TIME_WORDS: Record<RowTime, string> = { latest: "latest year", over_time: "over time", either: "any time" };

const FAILURE_WORDS: Record<MatchFailure, string> = {
  data: "different data",
  phase: "a different phase",
  results: "a different measure",
  focus: "a different focus",
  compare: "a different comparison",
  time: "a different time",
  palette: "data your role doesn't add",
  status: "a view not offered here",
};

// "Mine · 2 columns · 2 rows" (the board's destination sub-line).
export function shapeLine(config: Pick<DashboardConfig, "columns" | "rows">): string {
  const c = config.columns.length;
  const r = config.rows.length;
  return `${c} column${c === 1 ? "" : "s"} · ${r} row${r === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------------
// Who can edit what (mirrors can_edit_dashboard in the S2 migration; RLS has the last word)

export type Me = { uid: string | null; superAdmin: boolean; adminAccountIds: string[] };

export function canEditRow(row: Pick<DashboardRow, "owner_scope" | "owner_profile_id" | "school_account_id">, me: Me): boolean {
  if (me.superAdmin) return true;
  if (row.owner_scope === "user") return !!me.uid && row.owner_profile_id === me.uid;
  if (row.owner_scope === "school") return !!row.school_account_id && me.adminAccountIds.includes(row.school_account_id);
  return false;
}

// ---------------------------------------------------------------------------------
// The slot map

export type SlotTarget = { kind: "rail"; panelId: string } | { kind: "empty"; columnId: string; rowId: string } | { kind: "new-row" };

export type MapCell =
  | { kind: "panel"; panelId: string; col: number; cols: number; label: string }
  | { kind: "empty"; columnId: string; rowId: string; col: number };

export type SlotMap = {
  columns: { id: string; title: string }[];
  rows: { id: string; name: string; time: RowTime; cells: MapCell[] }[];
};

// A panel's label on the map: its own name, else its default (or first) view's label.
export function panelLabel(panel: PanelConfig): string {
  if (panel.name) return panel.name;
  const v = panel.dataviews.find((x) => x.id === panel.defaultView) ?? panel.dataviews[0];
  if (!v) return "Empty panel";
  if (v.kind === "placeholder") return `Planned: ${v.description}`;
  return v.title ?? dataviewById(v.dataview)?.label ?? "View";
}

export function slotMap(config: DashboardConfig): SlotMap {
  const columns = config.columns.map((c) => ({ id: c.id, title: c.title }));
  const rows = config.rows.map((row) => {
    const cells: MapCell[] = [];
    for (let i = 0; i < config.columns.length; ) {
      const col = config.columns[i];
      const panel = config.panels.find((p) => p.row === row.id && p.column === col.id);
      if (panel) {
        const cols = Math.min(panel.span?.cols ?? 1, config.columns.length - i);
        cells.push({ kind: "panel", panelId: panel.id, col: i, cols, label: panelLabel(panel) });
        i += cols;
      } else {
        cells.push({ kind: "empty", columnId: col.id, rowId: row.id, col: i });
        i += 1;
      }
    }
    return { id: row.id, name: row.name, time: row.time, cells };
  });
  return { columns, rows };
}

// The first slot worth pre-picking: an empty cell whose row's Time suits the view, then
// any empty cell, then a new row.
export function defaultTarget(config: DashboardConfig, dv: Dataview | undefined): SlotTarget {
  const map = slotMap(config);
  const suits = (t: RowTime) => !dv || t === "either" || (t === "latest") === (dv.supports.dateMode === "single");
  const empties = map.rows.flatMap((r) => r.cells.filter((c): c is Extract<MapCell, { kind: "empty" }> => c.kind === "empty").map((c) => ({ c, t: r.time })));
  const best = empties.find((e) => suits(e.t)) ?? empties[0];
  return best ? { kind: "empty", columnId: best.c.columnId, rowId: best.c.rowId } : { kind: "new-row" };
}

export function sameTarget(a: SlotTarget | null, b: SlotTarget | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------------
// The slot's context and the fit check

function rowTimeFor(dv: Dataview | undefined): RowTime {
  return dv?.supports.dateMode === "single" ? "latest" : "over_time";
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

function idsOf(config: DashboardConfig): Set<string> {
  const s = new Set<string>();
  config.columns.forEach((c) => s.add(c.id));
  config.rows.forEach((r) => s.add(r.id));
  config.panels.forEach((p) => {
    s.add(p.id);
    p.dataviews.forEach((v) => s.add(v.id));
  });
  return s;
}

// The labels a slot's context is resolved with: the source panel's own, so the badge
// and the slot's column read in the same words.
export function labelsFrom(ctx: PickPanelContext): PanelLabels {
  return {
    results: ctx.data === "academic.results" ? ctx.results : undefined,
    subject: ctx.focus.subject?.label ? { label: ctx.focus.subject.label, key: ctx.focus.subject.key } : null,
    school: ctx.labels.school,
    category: ctx.labels.category,
    setLabel: ctx.compare.schools?.label,
    la: ctx.labels.la,
    region: ctx.labels.region,
  };
}

// Where a new panel for `target` would sit (the rail target is the panel itself).
function placementFor(config: DashboardConfig, target: SlotTarget, dv: Dataview | undefined): { columnId: string; row: RowConfig; isNewRow: boolean } | null {
  if (target.kind === "rail") {
    const p = config.panels.find((x) => x.id === target.panelId);
    const row = p && config.rows.find((r) => r.id === p.row);
    return p && row ? { columnId: p.column, row, isNewRow: false } : null;
  }
  if (target.kind === "empty") {
    const row = config.rows.find((r) => r.id === target.rowId);
    return row && config.columns.some((c) => c.id === target.columnId) ? { columnId: target.columnId, row, isNewRow: false } : null;
  }
  const first = config.columns[0];
  if (!first) return null;
  const time = rowTimeFor(dv);
  const row: RowConfig = { id: uniqueId(`row-${config.rows.length + 1}`, idsOf(config)), name: time === "latest" ? "Latest year" : "Over time", time, openByDefault: true };
  return { columnId: first.id, row, isNewRow: true };
}

// The slot's column + row context, resolved in the source's words. Null when the target
// isn't on this dashboard (or it has no columns).
export function slotContext(config: DashboardConfig, target: SlotTarget, source: CopyViewSource): PickPanelContext | null {
  const dv = sourceDataview(source);
  const at = placementFor(config, target, dv);
  if (!at) return null;
  const labels = labelsFrom(source.context);
  if (target.kind === "rail") return contextFromPanel(config, target.panelId, labels);
  const probe = "__copy-view-probe__";
  const withProbe: DashboardConfig = {
    ...config,
    rows: at.isNewRow ? [...config.rows, at.row] : config.rows,
    panels: [...config.panels, { id: probe, row: at.row.id, column: at.columnId, dataviews: [] }],
  };
  return contextFromPanel(withProbe, probe, labels);
}

export type FitResult = {
  fits: boolean;
  failure: MatchFailure | null;
  // The board's green (fits) or amber (doesn't) line.
  message: string;
  // What the new panel carries when the view doesn't fit.
  override?: PickOverride;
  // A rail target the view can't join (it doesn't fit that panel's column).
  blocked: boolean;
};

export function fitCheck(source: CopyViewSource, slot: PickPanelContext, target: SlotTarget, opts: { superAdmin?: boolean } = {}): FitResult {
  const dv = sourceDataview(source);
  if (!dv) return { fits: false, failure: "status", message: "This view is no longer in the catalogue.", blocked: true };
  const failure = whyNot(dv, toPickContext(slot, { superAdmin: opts.superAdmin }));
  if (!failure) {
    const compare = slot.compare.kinds.length ? "same comparison" : "no comparison";
    return { fits: true, failure: null, blocked: false, message: `Fits this slot: same data, ${compare}, ${TIME_WORDS[slot.time]}. It follows the column from now on.` };
  }
  const why = FAILURE_WORDS[failure];
  if (target.kind === "rail")
    return {
      fits: false,
      failure,
      blocked: true,
      message: `Doesn't fit this panel's column (${why}). Drop it in an empty slot or a new row, where it keeps its own settings and shows “overridden”.`,
    };
  const override = overrideBetween(slot, source.context, `Copied with Copy this view from ${source.context.labels.dashboard}, ${source.context.labels.column} · ${source.context.labels.row}`);
  return {
    fits: false,
    failure,
    blocked: false,
    override: override ?? { badge: "overridden", reason: "Copied with Copy this view" },
    message: `Doesn't fit this slot's column (${why}). It keeps its own settings and shows “overridden”.`,
  };
}

// ---------------------------------------------------------------------------------
// Copying into a dashboard config

export type CopyToDashboardResult =
  | { ok: true; config: DashboardConfig; panelId: string; instanceId: string; overridden: boolean }
  | { ok: false; reason: "no-such-slot" | "blocked" | "not-a-dashboard" };

export function copyToDashboard(config: DashboardConfig, target: SlotTarget, source: CopyViewSource, opts: { superAdmin?: boolean } = {}): CopyToDashboardResult {
  if (config.kind !== "dashboard") return { ok: false, reason: "not-a-dashboard" };
  const dv = sourceDataview(source);
  const slot = slotContext(config, target, source);
  const at = placementFor(config, target, dv);
  if (!slot || !at) return { ok: false, reason: "no-such-slot" };
  const fit = fitCheck(source, slot, target, opts);
  if (fit.blocked) return { ok: false, reason: "blocked" };
  const taken = idsOf(config);
  // A copy never brings the source panel's private notes (G2): it is a new instance.
  const { id: _old, ...rest } = source.instance;
  void _old;

  if (target.kind === "rail") {
    const panel = config.panels.find((p) => p.id === target.panelId)!;
    const instanceId = uniqueId(`${panel.id}/${source.instance.dataview}`, taken);
    const panels = config.panels.map((p) => (p.id === panel.id ? { ...p, dataviews: [...p.dataviews, { ...rest, id: instanceId }] } : p));
    return { ok: true, config: { ...config, panels }, panelId: panel.id, instanceId, overridden: false };
  }

  const panelId = uniqueId(`${config.id}.${at.columnId}.${at.row.id}`, taken);
  taken.add(panelId);
  const instanceId = uniqueId(`${panelId}/${source.instance.dataview}`, taken);
  const panel: PanelConfig = {
    id: panelId,
    row: at.row.id,
    column: at.columnId,
    span: { cols: 1, rows: 1 },
    dataviews: [{ ...rest, id: instanceId }],
    defaultView: instanceId,
    ...(fit.override ? { override: fit.override } : {}),
  };
  return {
    ok: true,
    config: { ...config, rows: at.isNewRow ? [...config.rows, at.row] : config.rows, panels: [...config.panels, panel] },
    panelId,
    instanceId,
    overridden: !fit.fits,
  };
}

// ---------------------------------------------------------------------------------
// A new dashboard from a view: the view's settings become column 1's

const COLUMN_ICON_FOR: Record<string, ColumnHeader["icon"]> = {
  "academic.candidates": "candidates",
  "academic.results": "results",
};

export function newDashboardFromView(source: CopyViewSource, opts: { id: string; name: string; owner?: DashboardConfig["owner"] }): DashboardConfig {
  const dv = sourceDataview(source);
  const ctx = source.context;
  const s = settingsOf(ctx);
  const time = rowTimeFor(dv);
  const column: ColumnHeader = {
    id: "c1",
    title: ctx.labels.column || "Column 1",
    icon: COLUMN_ICON_FOR[ctx.data] ?? "context",
    data: s.data,
    focus: s.focus,
    compare: s.compare,
  };
  const row: RowConfig = { id: time === "latest" ? "current" : "trends", name: time === "latest" ? "Current" : "Trends", time, openByDefault: true };
  const panelId = `${opts.id}.c1.${row.id}`;
  const instanceId = `${panelId}/${source.instance.dataview}`;
  const { id: _old, ...rest } = source.instance;
  void _old;
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id: opts.id,
    name: opts.name,
    kind: "dashboard",
    owner: opts.owner ?? "user",
    colour: { key: ctx.phase },
    icon: { source: "view", ref: source.instance.dataview },
    layout: { preset: "1", tracks: [1], accordion: "auto-close" },
    columns: [column],
    rows: [row],
    panels: [{ id: panelId, row: row.id, column: "c1", span: { cols: 1, rows: 1 }, dataviews: [{ ...rest, id: instanceId }], defaultView: instanceId }],
  };
}

// A name for it: the focused subject (or the measure), numbered past any you already have.
export function newDashboardName(source: CopyViewSource, taken: string[]): string {
  const base = (source.pinned.subjectLabel || source.context.focus.subject?.label || source.context.labels.column || "New dashboard").slice(0, 100);
  const names = new Set(taken.map((t) => t.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!names.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

// ---------------------------------------------------------------------------------
// To a meeting: the slide picker's words

export function kindWordOf(dataview: string | undefined): string {
  const dv = dataview ? dataviewById(dataview) : undefined;
  return dv ? KIND_WORD[dv.supports.viewType] : "view";
}

function slotKind(slot: SlideConfig["slots"][number]): string {
  if (!slot.view) return "text box";
  return slot.view.kind === "view" ? kindWordOf(slot.view.dataview) : "planned view";
}

// "Slide 3 · next to the graph" / "Slide 2 · full" / "Slide 1 · empty".
export function slideLabel(slide: SlideConfig, index: number): string {
  const n = slide.slots.length;
  const what = n >= MAX_SLOTS ? "full" : n === 0 ? "empty" : n === 1 ? `next to the ${slotKind(slide.slots[0])}` : `with ${n} views`;
  return `Slide ${index + 1} · ${what}`;
}

export function slideIsFull(slide: SlideConfig): boolean {
  return slide.slots.length >= MAX_SLOTS;
}

// The pre-picked slide: the last one with room, else a new slide.
export function defaultSlide(slides: SlideConfig[]): string | "new" {
  const open = [...slides].reverse().find((s) => !slideIsFull(s));
  return open ? open.id : "new";
}

// The blue line under the slide picker, in three parts so the arrangement can be bold.
export function meetingBanner(slides: SlideConfig[], slideId: string | "new", newKind: string): { lead: string; strong: string | null; tail: string } {
  const tail = " Slides re-arrange themselves as views arrive: 1 → 2 across → 3 across → 3 × 2.";
  const i = slides.findIndex((s) => s.id === slideId);
  const slide = i >= 0 ? slides[i] : null;
  if (!slide) return { lead: `A new slide, with the ${newKind} on its own.`, strong: null, tail };
  const n = slide.slots.length;
  if (n === 0) return { lead: `Slide ${i + 1} is empty. The ${newKind} fills it.`, strong: null, tail };
  const has = n === 1 ? `the ${slotKind(slide.slots[0])}` : `${n} views`;
  return { lead: `Slide ${i + 1} has ${has}. Adding the ${newKind} makes it `, strong: arrangementName(n + 1), tail: "." + tail };
}

// "Maths (General), 10 nearest schools, 2021/22 to 2024/25" -- what goes in pinned.
export function pinSummary(p: PinnedSettings & { keepLive?: boolean }): string {
  const parts = [p.subjectLabel || p.subject, p.compare?.name, p.yearRange ? `${p.yearRange.from} to ${p.yearRange.to}` : p.year].filter((x): x is string => !!x);
  if (p.keepLive) parts.push("kept live");
  return parts.join(", ");
}

// ---------------------------------------------------------------------------------
// Last used (pre-picks the destination). Storage is passed in so this stays testable;
// every access is guarded (private windows and blocked storage throw).

export const LAST_USED_KEY = "vicdata.copyView.lastUsed";

export type LastUsed = { mode: "dashboard" | "meeting"; dashboardId?: string | "new"; meetingId?: string };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readLastUsed(storage: StorageLike | null | undefined): LastUsed | null {
  try {
    const raw = storage?.getItem(LAST_USED_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastUsed;
    return v && (v.mode === "dashboard" || v.mode === "meeting") ? v : null;
  } catch {
    return null;
  }
}

export function writeLastUsed(storage: StorageLike | null | undefined, value: LastUsed): void {
  try {
    storage?.setItem(LAST_USED_KEY, JSON.stringify(value));
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}
