// VicData 0.6 S5: the dashboard editor's config operations (scope brief §4; combinations
// doc F3, F5, §6). Pure functions over DashboardConfig: every op takes a config and returns
// a NEW one (the seeded Teacher configs share their row objects, so nothing is mutated),
// or throws an EditorError whose message is the line the editor shows.
//
//   rows      add (structure presets), rename/settings, copy, delete, move, structure
//   columns   edit (data/focus/compare) with F5 revalidation: keep / remove / swap
//   panels    rename, override, delete, move, span (+ F3's span question)
//   views     add (chooser output, incl. override), reorder, move, copy, remove,
//             placeholders, swap a placeholder for a matching draft view
//   history   undo/redo, the last 30 actions (G8)
//   summary   diff two configs into the version's change summary (§4.8)
//
// Tests: npx -y tsx --test src/lib/editor-ops.test.ts
import { DATAVIEWS, DATAVIEW_IDS, dataviewById, whyNot } from "@/catalogue";
import { summaryViewName } from "@/lib/change-summary";
import { validateConfig as validateCore, type ConfigProblem } from "@/catalogue/config";
import {
  DATA_LABEL,
  FOCUS_LABEL,
  PHASE_LABEL,
  compareFromSpec,
  compareLabel,
  contextFromPanel,
  describeDiff,
  measureLabel,
  pickResults,
  readyMadeInstance,
  settingsOf,
  summaryLine,
  titleOverrideOf,
  toPickContext,
  type PanelLabels,
  type PickPanelContext,
  type PlaceholderRequest,
} from "@/catalogue/pick";
import type {
  ColumnHeader,
  CompareSpec,
  DashboardConfig,
  DataId,
  Dataview,
  DataviewId,
  DataviewInstance,
  LayoutPreset,
  PanelConfig,
  PanelOverride,
  Phase,
  PlaceholderContext,
  RowConfig,
  RowTime,
} from "@/catalogue/types";
import { CONFIG_SCHEMA_VERSION, type ResultsMeasure } from "@/catalogue/types";
import { RESULTS_MEASURES, effectiveResults, followsResultsPill, withResults } from "@/catalogue/results";
import {
  VARIANT_AXES,
  asState,
  defaultOnState,
  effectiveStates,
  parseStateKey,
  remapStateDefaults,
  setStateDefault,
  showsOnState,
  withStates,
  type AxisStateMap,
  type VariantAxis,
  type VariantState,
} from "@/catalogue/variants";
import { measuresFor } from "./teacher-view-panels";

export class EditorError extends Error {}

const fail = (message: string): never => {
  throw new EditorError(message);
};

const clone = <T>(v: T): T => structuredClone(v);

// ---------------------------------------------------------------------------------
// Validation

const KNOWN = new Set<DataviewId>(DATAVIEW_IDS);
const EMPTY_PANEL = "a panel holds at least one dataview or placeholder";

// The catalogue's structural checks, except that an empty panel is allowed in a draft (the
// board's "Empty panel + Add a view"): it is reported in `empty` instead, and Publish is
// held back until each is filled or deleted, so a published config always passes the
// catalogue's own validateConfig.
export function validateConfig(config: DashboardConfig): { problems: ConfigProblem[]; empty: string[] } {
  const all = validateCore(config, KNOWN);
  const empty = config.panels.filter((p) => p.dataviews.length === 0).map((p) => p.id);
  return { problems: all.filter((p) => p.message !== EMPTY_PANEL), empty };
}

function checked(config: DashboardConfig): DashboardConfig {
  const { problems } = validateConfig(config);
  if (problems.length) fail(`${problems[0].path}: ${problems[0].message}`);
  return config;
}

// ---------------------------------------------------------------------------------
// Ids

function allIds(config: DashboardConfig): Set<string> {
  const ids = new Set<string>();
  config.columns.forEach((c) => ids.add(c.id));
  config.rows.forEach((r) => ids.add(r.id));
  config.panels.forEach((p) => {
    ids.add(p.id);
    p.dataviews.forEach((v) => ids.add(v.id));
  });
  return ids;
}

// `base` if free, else base~2, base~3...
export function freeId(config: DashboardConfig, base: string, taken = allIds(config)): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}~${n}`)) return `${base}~${n}`;
}

function nextRowId(config: DashboardConfig): string {
  for (let n = config.rows.length + 1; ; n++) if (!allIds(config).has(`row${n}`)) return `row${n}`;
}

const panelBase = (config: DashboardConfig, columnId: string, rowId: string) => `${config.id}.${columnId}.${rowId}`;

// ---------------------------------------------------------------------------------
// Geometry: which column index a panel starts at and how many it covers.

export const colIndex = (config: DashboardConfig, columnId: string) => config.columns.findIndex((c) => c.id === columnId);
export const spanOf = (p: PanelConfig) => p.span?.cols ?? 1;

export function rowPanels(config: DashboardConfig, rowId: string): PanelConfig[] {
  return config.panels.filter((p) => p.row === rowId).sort((a, b) => colIndex(config, a.column) - colIndex(config, b.column));
}

// A row's cells left to right: each panel, and each uncovered column as a gap.
export type Cell = { start: number; span: number; panel: PanelConfig | null };
export function rowCells(config: DashboardConfig, rowId: string): Cell[] {
  const cells: Cell[] = [];
  const panels = rowPanels(config, rowId);
  for (let c = 0; c < config.columns.length; ) {
    const p = panels.find((x) => colIndex(config, x.column) === c);
    if (p) {
      cells.push({ start: c, span: spanOf(p), panel: p });
      c += spanOf(p);
    } else {
      cells.push({ start: c, span: 1, panel: null });
      c += 1;
    }
  }
  return cells;
}

function setSpanField(p: PanelConfig, cols: number) {
  if (cols < 1 || cols > 4 || !Number.isInteger(cols)) fail("Spans are whole columns, 1 to 4.");
  p.span = { cols: cols as 1 | 2 | 3 | 4, rows: 1 };
}

function emptyPanel(config: DashboardConfig, rowId: string, columnId: string, cols: number): PanelConfig {
  const p: PanelConfig = { id: freeId(config, panelBase(config, columnId, rowId)), row: rowId, column: columnId, dataviews: [] };
  setSpanField(p, cols);
  return p;
}

// ---------------------------------------------------------------------------------
// Row structures (the email/CMS-style icons): spans per cell, snapped to the columns.

export type Structure = number[];

// Every way to split the dashboard's columns into 1-4 whole-column cells, widest first.
export function structuresFor(columns: number): Structure[] {
  const out: Structure[] = [];
  const walk = (left: number, acc: number[]) => {
    if (left === 0) return void out.push(acc);
    if (acc.length === 4) return;
    for (let s = left; s >= 1; s--) walk(left - s, [...acc, s]);
  };
  walk(columns, []);
  return out.sort((a, b) => a.length - b.length);
}

export function structureOf(config: DashboardConfig, rowId: string): Structure {
  return rowCells(config, rowId).map((c) => c.span);
}

// ---------------------------------------------------------------------------------
// Rows

export type NewRow = { structure: Structure; name?: string; time?: RowTime; openByDefault?: boolean; at?: number };

export function addRow(config: DashboardConfig, opts: NewRow): DashboardConfig {
  const c = clone(config);
  const total = opts.structure.reduce((a, b) => a + b, 0);
  if (total !== c.columns.length) fail(`A row's cells must cover the dashboard's ${c.columns.length} columns.`);
  const id = nextRowId(c);
  // A new row defaults to Either (combinations F1) and opens by default (§4.4).
  const row: RowConfig = { id, name: opts.name ?? `Row ${c.rows.length + 1}`, time: opts.time ?? "either", openByDefault: opts.openByDefault ?? true };
  const at = opts.at ?? c.rows.length;
  c.rows.splice(at, 0, row);
  let start = 0;
  for (const span of opts.structure) {
    c.panels.push(emptyPanel(c, id, c.columns[start].id, span));
    start += span;
  }
  return checked(c);
}

export function updateRow(config: DashboardConfig, rowId: string, patch: Partial<Pick<RowConfig, "name" | "time" | "openByDefault">>): DashboardConfig {
  const c = clone(config);
  const row = c.rows.find((r) => r.id === rowId) ?? fail("That row has gone.");
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) fail("A row needs a name.");
    row.name = name;
  }
  if (patch.time) row.time = patch.time;
  if (patch.openByDefault !== undefined) row.openByDefault = patch.openByDefault;
  return c;
}

function cloneViews(c: DashboardConfig, views: DataviewInstance[], panelId: string, taken: Set<string>): DataviewInstance[] {
  return views.map((v) => {
    const tail = v.id.includes("/") ? v.id.slice(v.id.indexOf("/") + 1) : v.id;
    const id = freeId(c, `${panelId}/${tail.replace(/~\d+$/, "")}`, taken);
    taken.add(id);
    return { ...clone(v), id };
  });
}

export function copyRow(config: DashboardConfig, rowId: string): DashboardConfig {
  const c = clone(config);
  const i = c.rows.findIndex((r) => r.id === rowId);
  if (i < 0) fail("That row has gone.");
  const src = c.rows[i];
  const id = nextRowId(c);
  // A copy carries no legacy keys: its notes and open state are its own.
  c.rows.splice(i + 1, 0, { id, name: `${src.name} (copy)`, time: src.time, openByDefault: src.openByDefault });
  const taken = allIds(c);
  for (const p of rowPanels(config, rowId)) {
    const pid = freeId(c, panelBase(c, p.column, id), taken);
    taken.add(pid);
    const views = cloneViews(c, p.dataviews, pid, taken);
    const def = p.defaultView ? views[p.dataviews.findIndex((v) => v.id === p.defaultView)]?.id : undefined;
    const copy: PanelConfig = { id: pid, row: id, column: p.column, dataviews: views };
    if (p.span) copy.span = { ...p.span };
    if (p.name) copy.name = p.name;
    if (p.override) copy.override = clone(p.override);
    if (def) copy.defaultView = def;
    if (p.defaultViewByResults) copy.defaultViewByResults = { ...p.defaultViewByResults };
    if (p.defaultViewByState) copy.defaultViewByState = { ...p.defaultViewByState };
    remapStateDefaults(copy, (id) => views[p.dataviews.findIndex((v) => v.id === id)]?.id);
    c.panels.push(copy);
  }
  return checked(c);
}

export function deleteRow(config: DashboardConfig, rowId: string): DashboardConfig {
  const c = clone(config);
  if (!c.rows.some((r) => r.id === rowId)) fail("That row has gone.");
  if (c.rows.length === 1) fail("A dashboard needs at least one row.");
  c.rows = c.rows.filter((r) => r.id !== rowId);
  c.panels = c.panels.filter((p) => p.row !== rowId);
  return c;
}

export function moveRow(config: DashboardConfig, rowId: string, dir: -1 | 1): DashboardConfig {
  const c = clone(config);
  const i = c.rows.findIndex((r) => r.id === rowId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.rows.length) return config;
  [c.rows[i], c.rows[j]] = [c.rows[j], c.rows[i]];
  return c;
}

// Re-lay a row's cells (RowSettings' "Panels in this row"): existing panels keep their
// order and fill the new cells left to right; extra cells start empty; panels with no cell
// left are removed (the dialog says how many before Done).
export function setRowStructure(config: DashboardConfig, rowId: string, structure: Structure): DashboardConfig {
  const c = clone(config);
  if (structure.reduce((a, b) => a + b, 0) !== c.columns.length) fail(`A row's cells must cover the dashboard's ${c.columns.length} columns.`);
  const existing = rowPanels(c, rowId);
  c.panels = c.panels.filter((p) => p.row !== rowId);
  let start = 0;
  structure.forEach((span, i) => {
    const p = existing[i];
    if (p) {
      p.column = c.columns[start].id;
      setSpanField(p, span);
      c.panels.push(p);
    } else c.panels.push(emptyPanel(c, rowId, c.columns[start].id, span));
    start += span;
  });
  return checked(c);
}

export function panelsLostBy(config: DashboardConfig, rowId: string, structure: Structure): number {
  return Math.max(0, rowPanels(config, rowId).filter((p) => p.dataviews.length).length - structure.length);
}

// ---------------------------------------------------------------------------------
// Columns

export type ColumnSettings = Pick<ColumnHeader, "data" | "focus" | "compare">;
export type ColumnPatch = Partial<Pick<ColumnHeader, "title" | "icon" | "data" | "focus" | "compare">>;

// "Data: Candidates · subject · Compared to: nothing" (the editor's column header).
export function columnLine(col: Pick<ColumnHeader, "data" | "focus" | "compare">, labels: PanelLabels = {}): string {
  const r = col.data.results;
  const measure = col.data.data === "academic.results" && r && r !== "pill" ? measureLabel({ data: col.data.data, phase: col.data.phase, results: r }) : DATA_LABEL[col.data.data];
  const focus = col.focus.kind === "subject" ? (col.focus.subject?.mode === "always" ? col.focus.subject.subject : "subject") : FOCUS_LABEL[col.focus.kind].toLowerCase();
  return `Data: ${measure} · ${focus} · Compared to: ${compareText(col.compare, labels)}`;
}

export function compareText(spec: CompareSpec | null, labels: PanelLabels = {}): string {
  if (!spec || !spec.kinds.length) return "nothing";
  const parts: string[] = [];
  const c = compareFromSpec(spec, labels);
  if (c.subjects) parts.push(spec.subjects === "category" || spec.subjects === "pill" ? "subject category" : c.subjects.label);
  if (c.schools) parts.push(c.schools.label);
  if (c.averages) parts.push(c.averages.map((a) => (a === "la" ? "LA" : a === "region" ? "region" : "England")).join(", "));
  return parts.join(" + ");
}

export type Misfit = {
  panelId: string;
  instanceId: string;
  dataview: DataviewId;
  // "Current · Bar chart"
  where: string;
  title: string;
  nearest: DataviewId | null;
};

export type ColumnImpact = {
  misfits: Misfit[];
  // Placeholder instances whose planned context moves with the column.
  placeholders: string[];
  // Panels with their own override: not touched (C17).
  skipped: string[];
};

const VIEW_TYPE_WORD: Record<string, string> = { numerical: "Numbers", donut: "Donut", graph: "Graph", map: "Map", ranking: "Ranking", table: "Table" };

function patched(config: DashboardConfig, columnId: string, patch: ColumnPatch): DashboardConfig {
  const c = clone(config);
  const col = c.columns.find((x) => x.id === columnId) ?? fail("That column has gone.");
  Object.assign(col, clone(patch));
  return c;
}

const fits = (dv: Dataview, ctx: PickPanelContext) => !whyNot(dv, toPickContext(ctx, { superAdmin: true }));

// The nearest equivalent under the new context (F5's "Swap"): same look, same date mode
// (years), and the most number types in common.
export function nearestEquivalent(dv: Dataview, ctx: PickPanelContext): Dataview | null {
  let best: Dataview | null = null;
  let bestScore = 0;
  for (const cand of DATAVIEWS) {
    if (cand.id === dv.id || !fits(cand, ctx) || cand.status !== "live") continue;
    let score = 0;
    if (cand.supports.viewType === dv.supports.viewType) score += 4;
    if (cand.supports.dateMode === dv.supports.dateMode) score += 4;
    score += cand.supports.numberType.filter((t) => dv.supports.numberType.includes(t)).length;
    if (score > bestScore && cand.supports.dateMode === dv.supports.dateMode) {
      best = cand;
      bestScore = score;
    }
  }
  return best;
}

export function placeholderContextOf(ctx: PickPanelContext): PlaceholderContext {
  const pc = toPickContext(ctx);
  return {
    data: pc.data,
    phase: pc.phase,
    ...(pc.results ? { results: pc.results } : {}),
    focus: pc.focus,
    compare: [...pc.compare],
    time: pc.time,
    summary: summaryLine(ctx, true),
    where: [ctx.labels.dashboard, ctx.labels.column, ctx.labels.row].filter(Boolean).join(" · "),
  };
}

// F5: what a column change does to the views already in it. A view counts only when it
// fitted before and doesn't after (a view that never fitted is not this change's doing).
export function columnChangeImpact(config: DashboardConfig, columnId: string, patch: ColumnPatch, labels: PanelLabels = {}): ColumnImpact {
  const next = patched(config, columnId, patch);
  const out: ColumnImpact = { misfits: [], placeholders: [], skipped: [] };
  for (const p of config.panels.filter((x) => x.column === columnId)) {
    if (p.override && (p.override.data || p.override.focus || p.override.compare !== undefined)) {
      out.skipped.push(p.id);
      continue;
    }
    const before = contextFromPanel(config, p.id, labels);
    const after = contextFromPanel(next, p.id, labels);
    const row = config.rows.find((r) => r.id === p.row)!;
    for (const v of p.dataviews) {
      if (v.kind === "placeholder") {
        out.placeholders.push(v.id);
        continue;
      }
      const dv = dataviewById(v.dataview);
      if (!dv || !fits(dv, before) || fits(dv, after)) continue;
      out.misfits.push({
        panelId: p.id,
        instanceId: v.id,
        dataview: dv.id,
        where: `${p.name ?? row.name} · ${VIEW_TYPE_WORD[dv.supports.viewType] ?? dv.supports.viewType}`,
        title: v.title ?? dv.label,
        nearest: nearestEquivalent(dv, after)?.id ?? null,
      });
    }
  }
  return out;
}

export type MisfitChoice = "keep" | "remove" | "swap";

// Apply a column change with a decision per misfit (default: keep). "Keep" belongs to the
// panel -- an override is per panel -- so any kept view keeps its whole panel on the old
// settings, marked overridden, and that panel's other misfits stay with it.
export function applyColumnChange(
  config: DashboardConfig,
  columnId: string,
  patch: ColumnPatch,
  choices: Record<string, MisfitChoice> = {},
  labels: PanelLabels = {},
): DashboardConfig {
  const impact = columnChangeImpact(config, columnId, patch, labels);
  const c = patched(config, columnId, patch);
  const col = config.columns.find((x) => x.id === columnId)!;
  const choice = (m: Misfit): MisfitChoice => choices[m.instanceId] ?? "keep";
  const keptPanels = new Set(impact.misfits.filter((m) => choice(m) === "keep").map((m) => m.panelId));

  for (const panelId of keptPanels) {
    const p = c.panels.find((x) => x.id === panelId)!;
    const base = contextFromPanel(c, panelId, labels);
    const old = contextFromPanel(config, panelId, labels);
    const diff = describeDiff(base, old);
    const o: PanelOverride = { badge: `overridden: ${diff.join("; ") || "previous column settings"}`, reason: `Kept when column “${col.title}” changed (F5).` };
    if (JSON.stringify(col.data) !== JSON.stringify(c.columns.find((x) => x.id === columnId)!.data)) o.data = clone(col.data);
    if (JSON.stringify(col.focus) !== JSON.stringify(c.columns.find((x) => x.id === columnId)!.focus)) o.focus = clone(col.focus);
    if (JSON.stringify(col.compare) !== JSON.stringify(c.columns.find((x) => x.id === columnId)!.compare)) o.compare = clone(col.compare);
    p.override = o;
  }
  for (const m of impact.misfits) {
    if (keptPanels.has(m.panelId)) continue;
    const p = c.panels.find((x) => x.id === m.panelId)!;
    const i = p.dataviews.findIndex((v) => v.id === m.instanceId);
    if (choice(m) === "swap" && m.nearest) {
      const id = freeId(c, `${p.id}/${m.nearest}`);
      if (p.defaultView === m.instanceId) p.defaultView = id;
      p.dataviews[i] = { id, kind: "view", dataview: m.nearest };
    } else {
      p.dataviews.splice(i, 1);
      if (p.defaultView === m.instanceId) delete p.defaultView;
    }
  }
  for (const id of impact.placeholders) {
    const p = c.panels.find((x) => x.dataviews.some((v) => v.id === id))!;
    const v = p.dataviews.find((x) => x.id === id)!;
    if (v.kind === "placeholder") v.context = placeholderContextOf(contextFromPanel(c, p.id, labels));
  }
  return checked(c);
}

// Layout: add a column at the end (max 4) or remove one (its panels go; spans across it
// shrink).
export function addColumn(config: DashboardConfig, col: Omit<ColumnHeader, "id"> & { id?: string }): DashboardConfig {
  const c = clone(config);
  if (c.columns.length >= 4) fail("Four columns is the most a dashboard holds.");
  const id = col.id ?? freeId(c, `c${c.columns.length + 1}`);
  c.columns.push({ ...clone(col), id });
  c.layout.tracks.push(1);
  c.layout.preset = presetFor(c.layout.tracks);
  for (const r of c.rows) c.panels.push(emptyPanel(c, r.id, id, 1));
  return checked(c);
}

export function removeColumn(config: DashboardConfig, columnId: string): DashboardConfig {
  const c = clone(config);
  const i = colIndex(c, columnId);
  if (i < 0) fail("That column has gone.");
  if (c.columns.length === 1) fail("A dashboard needs at least one column.");
  const next = c.columns[i + 1]?.id;
  c.panels = c.panels.flatMap((p) => {
    const s = colIndex(c, p.column);
    const n = spanOf(p);
    if (s === i && n === 1) return [];
    if (s === i) {
      p.column = next!;
      setSpanField(p, n - 1);
    } else if (s < i && s + n > i) setSpanField(p, n - 1);
    return [p];
  });
  c.columns.splice(i, 1);
  c.layout.tracks.splice(i, 1);
  c.layout.preset = presetFor(c.layout.tracks);
  return checked(c);
}

// ---------------------------------------------------------------------------------
// Panels

const panelOf = (c: DashboardConfig, panelId: string) => c.panels.find((p) => p.id === panelId) ?? fail("That panel has gone.");

export function renamePanel(config: DashboardConfig, panelId: string, name: string): DashboardConfig {
  const c = clone(config);
  const p = panelOf(c, panelId);
  if (name.trim()) p.name = name.trim();
  else delete p.name;
  return c;
}

export function setOverride(config: DashboardConfig, panelId: string, override: PanelOverride | null): DashboardConfig {
  const c = clone(config);
  const p = panelOf(c, panelId);
  if (override) p.override = clone(override);
  else delete p.override;
  return c;
}

// "Change data / compared to…": the override that takes the panel from its column's
// settings to `next` (null = back to inheriting).
export function overrideTo(config: DashboardConfig, panelId: string, next: PickPanelContext, labels: PanelLabels = {}): PanelOverride | null {
  const p = config.panels.find((x) => x.id === panelId);
  if (!p) return null;
  const bare = { ...config, panels: config.panels.map((x) => (x.id === panelId ? { ...x, override: undefined } : x)) };
  const base = contextFromPanel(bare, panelId, labels);
  const diff = describeDiff(base, next);
  if (!diff.length) return null;
  const s = settingsOf(next);
  const b = settingsOf(base);
  const o: PanelOverride = { badge: `overridden: ${diff.join("; ")}`, reason: "Set in the editor (Change data / compared to…)." };
  if (JSON.stringify(s.data) !== JSON.stringify(b.data)) o.data = s.data;
  if (JSON.stringify(s.focus) !== JSON.stringify(b.focus)) o.focus = s.focus;
  if (JSON.stringify(s.compare) !== JSON.stringify(b.compare)) o.compare = s.compare;
  return o;
}

export function deletePanel(config: DashboardConfig, panelId: string): DashboardConfig {
  const c = clone(config);
  panelOf(c, panelId);
  c.panels = c.panels.filter((p) => p.id !== panelId);
  return c;
}

// The cells a panel would cover at (row, start, span), and who's there now.
function occupants(c: DashboardConfig, rowId: string, start: number, span: number, ignore: string): PanelConfig[] {
  return c.panels.filter((p) => {
    if (p.row !== rowId || p.id === ignore) return false;
    const s = colIndex(c, p.column);
    return s < start + span && s + spanOf(p) > start;
  });
}

// Move a panel to another cell (any row). Empty panels in the way are cleared; a filled
// panel of the same span sitting exactly there swaps places; anything else is refused.
export function movePanel(config: DashboardConfig, panelId: string, toRow: string, toColumn: string): DashboardConfig {
  const c = clone(config);
  const p = panelOf(c, panelId);
  if (!c.rows.some((r) => r.id === toRow)) fail("That row has gone.");
  const start = colIndex(c, toColumn);
  const span = spanOf(p);
  if (start < 0) fail("That column has gone.");
  if (start + span > c.columns.length) fail(`This panel spans ${span} columns and doesn't fit there.`);
  const from = { row: p.row, column: p.column };
  const there = occupants(c, toRow, start, span, p.id);
  const filled = there.filter((x) => x.dataviews.length);
  if (filled.length > 1 || (filled[0] && (filled[0].column !== toColumn || spanOf(filled[0]) !== span))) fail("Something's already there. Move or delete it first.");
  const drop = new Set(there.filter((x) => !x.dataviews.length).map((x) => x.id));
  c.panels = c.panels.filter((x) => !drop.has(x.id));
  if (filled[0]) {
    filled[0].row = from.row;
    filled[0].column = from.column;
  }
  p.row = toRow;
  p.column = toColumn;
  return checked(c);
}

// F3: a span over columns set up differently asks once which to follow. null = they all
// match (nothing to ask); otherwise one option per spanned column, left-most first.
export type SpanOption = { columnId: string; title: string; line: string; leftMost: boolean };
export function spanQuestion(config: DashboardConfig, panelId: string, cols: number, labels: PanelLabels = {}): SpanOption[] | null {
  const p = config.panels.find((x) => x.id === panelId);
  if (!p || cols <= 1) return null;
  const start = colIndex(config, p.column);
  const spanned = config.columns.slice(start, start + cols);
  const key = (col: ColumnHeader) => JSON.stringify([col.data, col.focus, col.compare]);
  if (new Set(spanned.map(key)).size <= 1) return null;
  return spanned.map((col, i) => ({ columnId: col.id, title: col.title, line: spanLine(col, labels), leftMost: i === 0 }));
}

// "My subject · compared with 10 nearest schools" (SpanAsk's option line).
function spanLine(col: ColumnHeader, labels: PanelLabels): string {
  const focus = col.focus.kind === "subject" ? (col.focus.subject?.mode === "always" ? col.focus.subject.subject : "My subject") : FOCUS_LABEL[col.focus.kind];
  const cmp = compareText(col.compare, labels);
  return `${focus} · ${cmp === "nothing" ? "no comparison" : `compared with ${cmp === "10 nearest" ? "10 nearest schools" : cmp}`}`;
}

// Set a panel's span (whole columns). Empty panels it grows over are cleared; filled ones
// refuse. `follow` answers the span question: a column other than the left-most becomes
// the panel's override.
export function setSpan(config: DashboardConfig, panelId: string, cols: number, follow?: string, labels: PanelLabels = {}): DashboardConfig {
  const c = clone(config);
  const p = panelOf(c, panelId);
  const start = colIndex(c, p.column);
  if (start + cols > c.columns.length) fail("That's past the last column.");
  const there = occupants(c, p.row, start, cols, p.id);
  if (there.some((x) => x.dataviews.length)) fail("A panel with views is in the way. Move or delete it first.");
  const drop = new Set(there.map((x) => x.id));
  c.panels = c.panels.filter((x) => !drop.has(x.id));
  setSpanField(p, cols);
  const isSpanFollow = p.override?.reason.startsWith("Span:");
  if (follow && follow !== p.column) {
    const col = c.columns.find((x) => x.id === follow) ?? fail("That column has gone.");
    p.override = { data: clone(col.data), focus: clone(col.focus), compare: clone(col.compare), badge: `overridden: follows ${col.title}`, reason: `Span: follows ${col.title} (F3).` };
  } else if (isSpanFollow && (follow === p.column || cols === 1)) delete p.override;
  void labels;
  return checked(c);
}

// ---------------------------------------------------------------------------------
// Views

export type Target = string | { row: string; column: string };

// The panel at a target, creating an empty one in a gap.
function targetPanel(c: DashboardConfig, target: Target): PanelConfig {
  if (typeof target === "string") return panelOf(c, target);
  const existing = c.panels.find((p) => p.row === target.row && p.column === target.column);
  if (existing) return existing;
  const start = colIndex(c, target.column);
  if (start < 0 || !c.rows.some((r) => r.id === target.row)) fail("That cell has gone.");
  if (occupants(c, target.row, start, 1, "").length) fail("That cell is covered by a spanning panel.");
  const p = emptyPanel(c, target.row, target.column, 1);
  c.panels.push(p);
  return p;
}

export function panelAt(config: DashboardConfig, target: Target): PanelConfig | null {
  if (typeof target === "string") return config.panels.find((p) => p.id === target) ?? null;
  return config.panels.find((p) => p.row === target.row && p.column === target.column) ?? null;
}

// Add the chooser's output. An override is the panel's (it carries the badge): adding an
// overridden view to a panel that already holds views overrides the whole panel.
export function addView(config: DashboardConfig, target: Target, instance: DataviewInstance, override?: PanelOverride): { config: DashboardConfig; panelId: string; instanceId: string } {
  const c = clone(config);
  const p = targetPanel(c, target);
  const base = instance.kind === "view" ? `${p.id}/${instance.dataview}` : `${p.id}/planned`;
  const id = freeId(c, instance.id.startsWith(`${p.id}/`) ? instance.id : base);
  p.dataviews.push({ ...clone(instance), id });
  if (override) p.override = clone(override);
  return { config: checked(c), panelId: p.id, instanceId: id };
}

// The placeholder instance the chooser's "Add placeholder" form describes.
export function placeholderInstance(req: PlaceholderRequest): DataviewInstance {
  return {
    id: "planned",
    kind: "placeholder",
    description: req.description.trim() || "Planned view",
    shape: req.shape,
    ...(req.notes.trim() ? { notes: req.notes.trim() } : {}),
    context: placeholderContextOf(req.context),
  };
}

export function addPlaceholder(config: DashboardConfig, target: Target, req: PlaceholderRequest): { config: DashboardConfig; panelId: string; instanceId: string } {
  return addView(config, target, placeholderInstance(req));
}

const findView = (c: DashboardConfig, instanceId: string) => {
  const p = c.panels.find((x) => x.dataviews.some((v) => v.id === instanceId)) ?? fail("That view has gone.");
  return { panel: p, index: p.dataviews.findIndex((v) => v.id === instanceId) };
};

export function removeView(config: DashboardConfig, instanceId: string): DashboardConfig {
  const c = clone(config);
  const { panel, index } = findView(c, instanceId);
  panel.dataviews.splice(index, 1);
  if (panel.defaultView === instanceId) delete panel.defaultView;
  dropDefaults(panel, instanceId);
  return c;
}

export function reorderView(config: DashboardConfig, panelId: string, from: number, to: number): DashboardConfig {
  const c = clone(config);
  const p = panelOf(c, panelId);
  if (from < 0 || from >= p.dataviews.length || to < 0 || to >= p.dataviews.length || from === to) return config;
  const [v] = p.dataviews.splice(from, 1);
  p.dataviews.splice(to, 0, v);
  return c;
}

// `state` (0.6 snag 3 / 03; every axis since snag 4 / 02): the default for that state only
// (defaultViewByResults on the Results pill alone, else defaultViewByState); the panel's
// own defaultView is left as it is. Round 3's Results pill alone is still accepted.
export function setDefaultView(config: DashboardConfig, panelId: string, instanceId: string, state: VariantState | ResultsMeasure | null = null): DashboardConfig {
  const c = clone(config);
  const p = panelOf(c, panelId);
  const v = p.dataviews.find((x) => x.id === instanceId) ?? fail("That view has gone.");
  const st = asState(state);
  if (Object.keys(st).length) {
    if (!showsOnState(v, st)) fail(`That view isn't shown on ${stateLabel(st, dashPhase(c))}.`);
    setStateDefault(p, st, instanceId);
  } else p.defaultView = instanceId;
  return c;
}

// 0.6 snag 3 / 03: "Show on…" -- the Results pill states an instance shows on, written as
// its override (none when it matches the dataview's default). A state it leaves stops
// opening on it. Snag 4 / 02: any axis (setViewStates); this is its Results name.
export function setViewResults(config: DashboardConfig, instanceId: string, measures: ResultsMeasure[]): DashboardConfig {
  return setViewStates(config, instanceId, "results", measures);
}

const AXIS_NOUN: Record<VariantAxis, string> = { results: "Results measure", compareAgainst: "Compare against set", comparator: "kind of comparison" };

export function setViewStates<A extends VariantAxis>(config: DashboardConfig, instanceId: string, axis: A, states: AxisStateMap[A][]): DashboardConfig {
  const c = clone(config);
  const { panel, index } = findView(c, instanceId);
  const next = withStates(panel.dataviews[index], axis, states);
  const shown = effectiveStates(next, axis) as string[];
  if (!shown.length) fail(`A view shows on at least one ${AXIS_NOUN[axis]}.`);
  panel.dataviews[index] = next;
  // A state the view leaves stops opening on it.
  remapStateDefaults(panel, (id, st) => (id === instanceId && st[axis] !== undefined && !shown.includes(st[axis]!) ? undefined : id));
  return c;
}

// The states' names as the pills say them, joined: "Grade counts · Selected subjects".
// `category` names Context's category option ("Arts, Media & Design subjects") when known.
export function stateLabel(state: VariantState, phase: Phase, category?: string | null): string {
  return VARIANT_AXES.flatMap((a) => (state[a] === undefined ? [] : [axisStateLabel(a, state[a]!, phase, category)])).join(" · ");
}

export function axisStateLabel(axis: VariantAxis, s: string, phase: Phase, category?: string | null): string {
  if (axis === "results") return resultsLabel(s as ResultsMeasure, phase);
  if (axis === "compareAgainst") return s === "category" ? (category ? `${category} subjects` : "Subject category") : s === "whole" ? "All subjects" : "Selected subjects";
  return s === "ranking" ? "A ranking" : "A set of schools";
}

// The Results measures' names as the pill says them ("Grade 4+ rate" / "A*–E rate").
export function resultsLabel(m: ResultsMeasure, phase: Phase): string {
  return measuresFor(phase).find((x) => x.id === m)?.label ?? m;
}

const dashPhase = (c: DashboardConfig): Phase => c.columns[0]?.data.phase ?? "ks4";

function dropDefaults(panel: PanelConfig, instanceId: string) {
  remapStateDefaults(panel, (id) => (id === instanceId ? undefined : id));
}

// Snag 3 / 02: is this the panel's default view -- its defaultView, or (none set, or one
// that has gone) its first view, which is what the page opens on. In a state (03; every
// axis since snag 4 / 02), the default for that state, among the views shown in it.
export function isDefaultView(panel: PanelConfig, instanceId: string, state: VariantState | ResultsMeasure | null = null): boolean {
  const st = asState(state);
  if (Object.keys(st).length) return defaultOnState(panel, st) === instanceId;
  const def = panel.dataviews.some((v) => v.id === panel.defaultView) ? panel.defaultView : panel.dataviews[0]?.id;
  return def === instanceId;
}

// Snag 1 / 03: the view menu's "Move up" / "Move down" (the rail's order).
export function moveViewWithinPanel(config: DashboardConfig, instanceId: string, dir: -1 | 1): DashboardConfig {
  const { panel, index } = findView(config, instanceId);
  return reorderView(config, panel.id, index, index + dir);
}

// Snag 1 / 03: "Edit this view…" and "Swap for another view…" replace an instance in place:
// same rail position, the panel's opening view following it. The instance id is kept when
// the replacement is the same dataview (or both are placeholders), so per-user state keyed
// on it survives (G1); a different dataview gets a fresh id, as Add a view would give it.
// An override is the panel's, exactly as addView sets it.
export function replaceView(config: DashboardConfig, instanceId: string, instance: DataviewInstance, override?: PanelOverride): { config: DashboardConfig; panelId: string; instanceId: string } {
  const c = clone(config);
  const { panel, index } = findView(c, instanceId);
  const old = panel.dataviews[index];
  const same = old.kind === instance.kind && (old.kind === "placeholder" || (instance.kind === "view" && old.dataview === instance.dataview));
  let id = instanceId;
  if (!same) {
    const taken = allIds(c);
    taken.delete(instanceId);
    id = freeId(c, `${panel.id}/${instance.kind === "view" ? instance.dataview : "planned"}`, taken);
  }
  // A swap or an edit keeps the instance's states on every axis (within what the new view
  // draws).
  let next: DataviewInstance = { ...clone(instance), id };
  if (old.kind === "view" && old.resultsMeasures && next.kind === "view" && !next.resultsMeasures) next = withResults(next, old.resultsMeasures);
  if (old.kind === "view" && old.variants && next.kind === "view" && !next.variants)
    for (const a of ["compareAgainst", "comparator"] as const) if (old.variants[a]) next = withStates(next, a, old.variants[a]!);
  panel.dataviews[index] = next;
  if (panel.defaultView === instanceId) panel.defaultView = id;
  remapStateDefaults(panel, (x, st) => (x === instanceId ? (showsOnState(next, st) ? id : undefined) : x));
  if (override) panel.override = clone(override);
  return { config: checked(c), panelId: panel.id, instanceId: id };
}

export function moveView(config: DashboardConfig, instanceId: string, target: Target): { config: DashboardConfig; panelId: string; instanceId: string } {
  const c = clone(config);
  const { panel, index } = findView(c, instanceId);
  const to = targetPanel(c, target);
  if (to.id === panel.id) return { config, panelId: panel.id, instanceId };
  const [v] = panel.dataviews.splice(index, 1);
  if (panel.defaultView === instanceId) delete panel.defaultView;
  dropDefaults(panel, instanceId);
  const id = freeId(c, `${to.id}/${v.kind === "view" ? v.dataview : "planned"}`);
  to.dataviews.push({ ...v, id });
  return { config: checked(c), panelId: to.id, instanceId: id };
}

export function copyView(config: DashboardConfig, instanceId: string, target: Target): { config: DashboardConfig; panelId: string; instanceId: string } {
  const c = clone(config);
  const { panel, index } = findView(c, instanceId);
  const to = targetPanel(c, target);
  const v = clone(panel.dataviews[index]);
  const id = freeId(c, `${to.id}/${v.kind === "view" ? v.dataview : "planned"}`);
  to.dataviews.push({ ...v, id });
  return { config: checked(c), panelId: to.id, instanceId: id };
}

// §6.5: draft views that match a placeholder's saved context, by placeholder id.
export function readyToSwap(config: DashboardConfig, catalogue: Dataview[] = DATAVIEWS): Record<string, Dataview[]> {
  const out: Record<string, Dataview[]> = {};
  for (const p of config.panels)
    for (const v of p.dataviews) {
      if (v.kind !== "placeholder" || !v.context) continue;
      const ctx = { ...v.context, superAdmin: true };
      const hits = catalogue.filter((dv) => dv.status === "draft" && !whyNot(dv, ctx));
      if (hits.length) out[v.id] = hits;
    }
  return out;
}

export function swapInPlaceholder(config: DashboardConfig, instanceId: string, dataview: DataviewId): DashboardConfig {
  const c = clone(config);
  const { panel, index } = findView(c, instanceId);
  if (panel.dataviews[index].kind !== "placeholder") fail("That isn't a planned view.");
  const id = freeId(c, `${panel.id}/${dataview}`);
  panel.dataviews[index] = { id, kind: "view", dataview };
  if (panel.defaultView === instanceId) panel.defaultView = id;
  remapStateDefaults(panel, (x) => (x === instanceId ? id : x));
  return checked(c);
}

// ---------------------------------------------------------------------------------
// Dashboard settings

export const LAYOUT_PRESETS: { id: Exclude<LayoutPreset, "custom">; tracks: number[]; label: string }[] = [
  { id: "1", tracks: [1], label: "1" },
  { id: "2", tracks: [1, 1], label: "2" },
  { id: "3", tracks: [1, 1, 1], label: "3" },
  { id: "4", tracks: [1, 1, 1, 1], label: "4" },
  { id: "2:1", tracks: [2, 1], label: "2 : 1" },
  { id: "1:2", tracks: [1, 2], label: "1 : 2" },
  { id: "1:1:2", tracks: [1, 1, 2], label: "1 : 1 : 2" },
];

export function presetFor(tracks: number[]): LayoutPreset {
  return LAYOUT_PRESETS.find((p) => p.tracks.join(":") === tracks.join(":"))?.id ?? "custom";
}

export function updateSettings(
  config: DashboardConfig,
  patch: Partial<Pick<DashboardConfig, "name" | "colour" | "group" | "features" | "icon">> & { accordion?: DashboardConfig["layout"]["accordion"] },
): DashboardConfig {
  const c = clone(config);
  if (patch.icon) c.icon = clone(patch.icon);
  if (patch.name !== undefined) {
    if (!patch.name.trim()) fail("A dashboard needs a name.");
    c.name = patch.name.trim();
  }
  if (patch.colour) c.colour = clone(patch.colour);
  if ("group" in patch) {
    if (patch.group) c.group = clone(patch.group);
    else delete c.group;
  }
  if (patch.features) c.features = { ...c.features, ...patch.features };
  if (patch.accordion) c.layout.accordion = patch.accordion;
  return c;
}

// ---------------------------------------------------------------------------------
// Undo / redo (G8): the last 30 actions. Consecutive edits with the same key (typing a
// name) coalesce into one step.

export const UNDO_DEPTH = 30;

export type History = { past: DashboardConfig[]; present: DashboardConfig; future: DashboardConfig[]; lastKey: string | null };

export const initHistory = (config: DashboardConfig): History => ({ past: [], present: config, future: [], lastKey: null });

export function record(h: History, next: DashboardConfig, key: string | null = null): History {
  if (next === h.present) return h;
  const coalesce = key !== null && key === h.lastKey && h.past.length > 0;
  return { past: coalesce ? h.past : [...h.past, h.present].slice(-UNDO_DEPTH), present: next, future: [], lastKey: key };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future].slice(0, UNDO_DEPTH), lastKey: null };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present].slice(-UNDO_DEPTH), present: h.future[0], future: h.future.slice(1), lastKey: null };
}

// ---------------------------------------------------------------------------------
// The change summary (§4.8): "Added *Maths points vs 10 nearest* to Comparisons · Trends;
// renamed row “Trends” to “Over time”".

// 0.6.1 S1 (pinch point 1): a view's member-facing name -- its title (its own, else its
// dataview's) resolved for its panel with no school (change-summary.ts), never a raw
// placeholder or the catalogue's internal label ("Area chart").
const viewName = summaryViewName;

function placeOf(c: DashboardConfig, p: PanelConfig): string {
  const col = c.columns.find((x) => x.id === p.column)?.title ?? p.column;
  const row = c.rows.find((r) => r.id === p.row)?.name ?? p.row;
  return `${col} · ${row}`;
}

export function diffConfigs(prev: DashboardConfig, next: DashboardConfig): string[] {
  // Views first (what people notice), then panels, rows, columns and settings. Places are
  // named as they were, so "added X to Comparisons · Trends; renamed row “Trends”…" reads
  // in order.
  const head: string[] = [];
  const out: string[] = [];
  const where = (p: PanelConfig) => (prev.panels.some((x) => x.id === p.id && x.row === p.row && x.column === p.column) && prev.rows.some((r) => r.id === p.row) ? placeOf(prev, p) : placeOf(next, p));
  if (prev.name !== next.name) out.push(`renamed the dashboard “${prev.name}” to “${next.name}”`);
  if (JSON.stringify(prev.colour) !== JSON.stringify(next.colour)) out.push("changed its colour");
  if (JSON.stringify(prev.group ?? null) !== JSON.stringify(next.group ?? null)) out.push(next.group ? `linked it with “${next.group.label}”` : "unlinked it");
  if (prev.layout.accordion !== next.layout.accordion) out.push(next.layout.accordion === "auto-close" ? "rows now close the others" : "rows now stay open");

  // Columns
  const pc = new Map(prev.columns.map((c) => [c.id, c]));
  const nc = new Map(next.columns.map((c) => [c.id, c]));
  for (const c of next.columns) {
    const o = pc.get(c.id);
    if (!o) out.push(`added column “${c.title}”`);
    else {
      if (o.title !== c.title) out.push(`renamed column “${o.title}” to “${c.title}”`);
      if (JSON.stringify([o.data, o.focus, o.compare]) !== JSON.stringify([c.data, c.focus, c.compare])) out.push(`changed column “${c.title}” (${columnLine(c).replace(/^Data: /, "")})`);
    }
  }
  for (const c of prev.columns) if (!nc.has(c.id)) out.push(`removed column “${c.title}”`);

  // Rows
  const pr = new Map(prev.rows.map((r) => [r.id, r]));
  const nr = new Map(next.rows.map((r) => [r.id, r]));
  for (const r of next.rows) {
    const o = pr.get(r.id);
    if (!o) out.push(`added row “${r.name}”`);
    else {
      if (o.name !== r.name) out.push(`renamed row “${o.name}” to “${r.name}”`);
      if (o.time !== r.time) out.push(`row “${r.name}” now shows ${r.time === "latest" ? "the latest year" : r.time === "over_time" ? "change over time" : "either"}`);
      if (o.openByDefault !== r.openByDefault) out.push(`row “${r.name}” ${r.openByDefault ? "opens" : "starts closed"} by default`);
    }
  }
  for (const r of prev.rows) if (!nr.has(r.id)) out.push(`deleted row “${r.name}”`);
  const order = (rows: RowConfig[]) => rows.filter((r) => pr.has(r.id) && nr.has(r.id)).map((r) => r.id).join(",");
  if (order(prev.rows) !== order(next.rows)) out.push("reordered rows");

  // Panels and views
  const pp = new Map(prev.panels.map((p) => [p.id, p]));
  const np = new Map(next.panels.map((p) => [p.id, p]));
  const prevView = new Map<string, { v: DataviewInstance; p: PanelConfig }>();
  const nextView = new Map<string, { v: DataviewInstance; p: PanelConfig }>();
  prev.panels.forEach((p) => p.dataviews.forEach((v) => prevView.set(v.id, { v, p })));
  next.panels.forEach((p) => p.dataviews.forEach((v) => nextView.set(v.id, { v, p })));
  for (const p of next.panels) {
    const o = pp.get(p.id);
    if (!o) continue;
    if (o.row !== p.row || o.column !== p.column) out.push(`moved a panel to ${placeOf(next, p)}`);
    if (spanOf(o) !== spanOf(p)) out.push(`${placeOf(next, p)} now spans ${spanOf(p)} column${spanOf(p) === 1 ? "" : "s"}`);
    if ((o.name ?? "") !== (p.name ?? "")) out.push(p.name ? `named a panel “${p.name}”` : "cleared a panel's name");
    if ((o.override?.badge ?? "") !== (p.override?.badge ?? "")) out.push(p.override ? `${placeOf(next, p)} ${p.override.badge}` : `${placeOf(next, p)} inherits its column again`);
    const shared = (list: DataviewInstance[]) => list.filter((v) => o.dataviews.some((x) => x.id === v.id) && p.dataviews.some((x) => x.id === v.id)).map((v) => v.id).join(",");
    if (shared(o.dataviews) !== shared(p.dataviews)) out.push(`reordered the views in ${placeOf(next, p)}`);
  }
  for (const p of prev.panels) if (!np.has(p.id) && p.dataviews.length) out.push(`deleted the panel at ${placeOf(prev, p)}`);
  // 0.6 snag 3 / 03: on a Results dashboard, measure changes in plain words: "Grade
  // counts: added *Trend table* to Results · Trends".
  const results = followsResultsPill(next);
  const phase = dashPhase(next);
  const names = (ms: ResultsMeasure[]) => ms.map((m) => resultsLabel(m, phase)).join(", ");
  // 0.6 snag 4 / 02: the other axes are named where a view has its own states on them.
  const axisNames = (a: VariantAxis, ss: string[]) => ss.map((s) => axisStateLabel(a, s, phase)).join(", ");
  const ownAxes = (v: DataviewInstance) => (v.kind === "view" ? (["compareAgainst", "comparator"] as const).filter((a) => v.variants?.[a]) : []);
  const tagged = (v: DataviewInstance) =>
    [
      ...(results && effectiveResults(v).length < RESULTS_MEASURES.length ? [names(effectiveResults(v))] : []),
      ...ownAxes(v).map((a) => axisNames(a, effectiveStates(v, a))),
    ].map((t) => `${t}: `).join("");
  for (const p of next.panels) {
    const o = pp.get(p.id);
    if (!o) continue;
    const name = (id: string | undefined) => {
      const v = p.dataviews.find((x) => x.id === id);
      return v ? viewName(next, p, v) : null;
    };
    if (o.defaultView !== p.defaultView && name(p.defaultView)) out.push(`*${name(p.defaultView)}* is now the default view in ${where(p)}`);
    // 0.6 snag 4 / 02: a default for a state of several axes ("Grade counts · Selected subjects").
    for (const k of new Set([...Object.keys(o.defaultViewByState ?? {}), ...Object.keys(p.defaultViewByState ?? {})])) {
      const a = o.defaultViewByState?.[k];
      const b = p.defaultViewByState?.[k];
      if (a === b) continue;
      const label = stateLabel(parseStateKey(k), phase);
      if (b && name(b)) out.push(`${label}: *${name(b)}* is now the default in ${where(p)}`);
      else if (!b) out.push(`${label}: ${where(p)} opens on its default view again`);
    }
    if (!results) continue;
    for (const m of RESULTS_MEASURES) {
      const a = o.defaultViewByResults?.[m];
      const b = p.defaultViewByResults?.[m];
      if (a === b) continue;
      if (b && name(b)) out.push(`${resultsLabel(m, phase)}: *${name(b)}* is now the default in ${where(p)}`);
      else if (!b) out.push(`${resultsLabel(m, phase)}: ${where(p)} opens on its default view again`);
    }
  }
  for (const [id, { v, p }] of nextView) {
    const was = prevView.get(id);
    if (was && was.p.id === p.id && results) {
      const before = effectiveResults(was.v);
      const after = effectiveResults(v);
      const added = after.filter((m) => !before.includes(m));
      const gone = before.filter((m) => !after.includes(m));
      if (added.length) head.push(`${names(added)}: added *${viewName(next, p, v, added[0])}* to ${where(p)}`);
      if (gone.length) head.push(`${names(gone)}: removed *${viewName(next, p, v, gone[0])}* from ${where(p)}`);
    }
    if (was && was.p.id === p.id)
      for (const a of ["compareAgainst", "comparator"] as const) {
        const before = effectiveStates(was.v, a) as string[];
        const after = effectiveStates(v, a) as string[];
        const added = after.filter((s) => !before.includes(s));
        const gone = before.filter((s) => !after.includes(s));
        if (added.length) head.push(`${axisNames(a, added)}: added *${viewName(next, p, v)}* to ${where(p)}`);
        if (gone.length) head.push(`${axisNames(a, gone)}: removed *${viewName(next, p, v)}* from ${where(p)}`);
      }
    if (!was) {
      // A placeholder swapped for a view in the same slot reads as one change.
      const swapped = prev.panels.find((x) => x.id === p.id)?.dataviews.find((x) => x.kind === "placeholder" && !nextView.has(x.id));
      if (swapped && v.kind === "view") head.push(`swapped in *${viewName(next, p, v)}* for the planned “${viewName(prev, p, swapped)}” in ${where(p)}`);
      else if (v.kind === "placeholder") head.push(`planned *${viewName(next, p, v)}* in ${where(p)}`);
      else head.push(`${tagged(v)}added *${viewName(next, p, v)}* to ${where(p)}`);
    } else if (was.p.id !== p.id) head.push(`moved *${viewName(next, p, v)}* to ${where(p)}`);
    // 0.6 snag 4 / 01: a view's own title, set, changed or cleared.
    if (was && (titleOverrideOf(was.v) ?? "") !== (titleOverrideOf(v) ?? "")) {
      // Named as it read before, then as it reads now -- both resolved.
      out.push(titleOverrideOf(v) ? `retitled *${viewName(prev, was.p, was.v)}* “${viewName(next, p, v)}” in ${where(p)}` : `*${viewName(prev, was.p, was.v)}* in ${where(p)} is called “${viewName(next, p, v)}” again`);
    }
  }
  for (const [id, { v, p }] of prevView) {
    if (nextView.has(id)) continue;
    const swappedOut = v.kind === "placeholder" && next.panels.find((x) => x.id === p.id)?.dataviews.some((x) => !prevView.has(x.id) && x.kind === "view");
    if (!swappedOut && np.has(p.id)) head.push(`${tagged(v)}removed *${viewName(prev, p, v)}* from ${placeOf(prev, p)}`);
  }
  return [...head, ...out];
}

export function changeSummary(prev: DashboardConfig | null, next: DashboardConfig): string {
  if (!prev) return "First version.";
  const lines = diffConfigs(prev, next);
  if (!lines.length) return "No changes.";
  const s = lines.join("; ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

// ---------------------------------------------------------------------------------
// New dashboard (New 1-4)

export type MainData = "ks4" | "ks5" | "rolls" | "social";

export const MAIN_DATA: { id: MainData; label: string; sub: string; data: DataId; phase: Phase }[] = [
  { id: "ks4", label: "GCSE", sub: "Candidates and results", data: "academic.candidates", phase: "ks4" },
  { id: "ks5", label: "Post-16", sub: "Candidates and results", data: "academic.candidates", phase: "ks5" },
  { id: "rolls", label: "Rolls", sub: "Pupil numbers, here and nearby", data: "rolls", phase: "ks4" },
  { id: "social", label: "Social context", sub: "Live births, with more to follow", data: "social.births", phase: "ks4" },
];

export type NewColumn = { title: string; icon: ColumnHeader["icon"]; data: ColumnHeader["data"]; focus: ColumnHeader["focus"]; compare: CompareSpec | null };

// Step 3's starting columns for a main data and a column count: the first shows the data
// on its own, the second against context, the third against comparator schools, the
// fourth against England -- the Teacher dashboard's own pattern.
export function defaultColumns(main: MainData, count: number): NewColumn[] {
  const m = MAIN_DATA.find((x) => x.id === main)!;
  const academic = m.data.startsWith("academic");
  const area = m.data === "social.births";
  const focus: ColumnHeader["focus"] = academic ? { kind: "subject", subject: { mode: "follow-chips" } } : area ? { kind: "around_school" } : { kind: "school" };
  const data: ColumnHeader["data"] = { data: m.data, phase: m.phase };
  const all: NewColumn[] = [
    // Academic column 1 ranks the subject within its category, as Teacher's Column 1 does
    // (its tiles compare); every other data starts with no comparison.
    { title: academic ? "Candidates" : area ? "Our area" : "Our roll", icon: "candidates", data, focus, compare: academic ? { kinds: ["subjects"], subjects: "category" } : null },
    {
      title: academic ? "Context" : area ? "Around us" : "Our area",
      icon: "context",
      data,
      focus,
      compare: academic ? { kinds: ["subjects"], subjects: "pill" } : { kinds: ["averages"], averages: ["region", "england"] },
    },
    { title: area ? "Wider area" : academic ? "Comparisons" : "Local schools", icon: "rankings", data, focus, compare: area ? { kinds: ["averages"], averages: ["la", "region", "england"] } : { kinds: ["schools"], schools: "10-nearest" } },
    { title: "Against England", icon: "results", data, focus, compare: { kinds: ["averages"], averages: ["england"] } },
  ];
  return Array.from({ length: count }, (_, i) => clone(all[i] ?? all[all.length - 1]));
}

// New 4's question under each column, written from its data and comparison.
export function columnQuestion(col: Pick<ColumnHeader, "data" | "compare">): string {
  const k = col.compare?.kinds ?? [];
  const d = col.data.data;
  const what = d === "rolls" ? "our roll" : d === "social.births" ? "births near us" : d === "academic.results" ? "our results" : "our entries";
  if (k.includes("schools")) return `How does ${what} compare with the 10 nearest schools?`;
  if (k.includes("averages")) return `How does ${what} compare with ${(col.compare?.averages ?? ["england"]).map((a) => (a === "la" ? "the LA" : a === "region" ? "the region" : "England")).join(", ").replace(/, ([^,]*)$/, " and $1")}?`;
  if (k.includes("subjects")) return d === "academic.results" ? "How do results compare with other subjects here?" : "How big is it next to other subjects here?";
  if (d === "rolls") return "How many pupils do we have, and is that changing?";
  if (d === "social.births") return "How many children are being born near us?";
  if (d === "academic.results") return "How well do our candidates do?";
  return "How many candidates do we have, and is that changing?";
}

export type NewDashboardInput = {
  id: string;
  name: string;
  owner: DashboardConfig["owner"];
  main: MainData;
  colour: DashboardConfig["colour"];
  tracks: number[];
  rows: number;
  accordion: DashboardConfig["layout"]["accordion"];
  group?: DashboardConfig["group"];
  columns: NewColumn[];
};

// The config a new dashboard starts as: its columns, Current (latest) and Trends (over
// time) rows plus any further rows (Either), and in every panel the first view Add a view
// would offer there ("Each panel opens with one view") -- empty where nothing is built yet.
export function newDashboardConfig(input: NewDashboardInput): DashboardConfig {
  if (input.columns.length !== input.tracks.length) fail("One track per column.");
  const rows: RowConfig[] = Array.from({ length: Math.max(1, input.rows) }, (_, i) =>
    i === 0
      ? { id: "current", name: "Current", time: "latest", openByDefault: true }
      : i === 1
        ? { id: "trends", name: "Trends", time: "over_time", openByDefault: input.accordion !== "auto-close" }
        : { id: `row${i + 1}`, name: `Row ${i + 1}`, time: "either", openByDefault: false },
  );
  const config: DashboardConfig = {
    schema_version: CONFIG_SCHEMA_VERSION,
    id: input.id,
    name: input.name.trim() || "Untitled dashboard",
    kind: "dashboard",
    owner: input.owner,
    colour: clone(input.colour),
    layout: { preset: presetFor(input.tracks), tracks: [...input.tracks], accordion: input.accordion },
    columns: input.columns.map((c, i) => ({ id: `c${i + 1}`, title: c.title.trim() || `Column ${i + 1}`, icon: c.icon, data: clone(c.data), focus: clone(c.focus), compare: clone(c.compare) })),
    rows,
    panels: [],
    features: { subjectChips: input.columns.some((c) => c.focus.kind === "subject" && c.focus.subject?.mode !== "always") },
  };
  if (input.group) config.group = clone(input.group);
  for (const r of rows)
    for (const col of config.columns) {
      const p: PanelConfig = { id: `${config.id}.${col.id}.${r.id}`, row: r.id, column: col.id, span: { cols: 1, rows: 1 }, dataviews: [] };
      config.panels.push(p);
      const ctx = contextFromPanel(config, p.id);
      const first = pickResults(ctx, { superAdmin: false })[0];
      if (first) {
        const inst = readyMadeInstance(first.dataview, ctx);
        p.dataviews.push({ ...inst, id: `${p.id}/${first.dataview.id}` });
      }
    }
  return checked(config);
}

// Copy a dashboard as a new one's start: fresh id, its own name and owner, no legacy keys
// (a copy's notes and open state are its own).
export function copyAsNew(source: DashboardConfig, id: string, name: string, owner: DashboardConfig["owner"]): DashboardConfig {
  const c = clone(source);
  const rename = (s: string) => (s.startsWith(`${source.id}.`) ? `${id}.${s.slice(source.id.length + 1)}` : s);
  c.id = id;
  c.name = name.trim() || `${source.name} (copy)`;
  c.owner = owner;
  delete c.group;
  for (const r of c.rows) delete r.legacyPanelId;
  for (const col of c.columns) delete col.legacyColumnKey;
  for (const p of c.panels) {
    p.id = rename(p.id);
    delete p.legacy;
    p.dataviews = p.dataviews.map((v) => ({ ...v, id: rename(v.id) }));
    if (p.defaultView) p.defaultView = rename(p.defaultView);
  }
  return checked(c);
}

// "Current · latest year · 3 panels · opens by default" (the row band).
export function rowLine(config: DashboardConfig, row: RowConfig): string {
  const cells = rowCells(config, row.id);
  const panels = cells.filter((c) => c.panel).length;
  const time = row.time === "latest" ? "latest year" : row.time === "over_time" ? "over time" : "latest year or over time";
  const spanning = cells.filter((c) => c.panel && c.span > 1);
  const spans = spanning.length ? `, ${cells[0].span > 1 ? "first" : spanning.length === 1 ? "one" : `${spanning.length}`} spans ${spanning[0].span} columns` : "";
  return `· ${time} · ${panels} panel${panels === 1 ? "" : "s"}${spans}${row.openByDefault ? " · opens by default" : ""}`;
}

// Planned views on a dashboard (placeholders), and how many are ready to swap in.
export function plannedCount(config: DashboardConfig): { planned: number; ready: number } {
  const ready = readyToSwap(config);
  let planned = 0;
  config.panels.forEach((p) => p.dataviews.forEach((v) => v.kind === "placeholder" && planned++));
  return { planned, ready: Object.keys(ready).length };
}

export { PHASE_LABEL, compareLabel };
