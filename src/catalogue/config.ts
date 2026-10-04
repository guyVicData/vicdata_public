// Dashboard config: validation, the panel unit, and the per-user state layer's keys.
//
// The panel unit (scope brief §7.1, corrected by the S0 audit §5): today's real panel is
// the column track at the 1280px cap -- 385px -- holding a CardBox 351px wide (the
// column's 1px borders and p-4 padding off) and PANEL_HEIGHT (384px) tall, panels 12px
// apart (mt-3) and columns 18 + 2 + 18px apart (DashboardGrid's gap and divider). The
// docs' "about 385 x 256, 24px gaps" predates the accordion round, which raised the
// height to 384.
import { CONFIG_SCHEMA_VERSION, type DashboardConfig, type DataviewId } from "./types";

export const PANEL_UNIT = {
  columnTrack: 385,
  width: 351,
  // CardBox's PANEL_HEIGHT. Copied, not imported, so scripts can load the catalogue
  // without a client component; scripts/catalogue-unit-tests.ts asserts they agree.
  height: 384,
  rowGap: 12,
  columnGap: 18,
  divider: 2,
} as const;

// Width in px of a panel spanning `cols` units (whole units only).
export function spanWidth(cols: number): number {
  return cols * PANEL_UNIT.columnTrack + (cols - 1) * (2 * PANEL_UNIT.columnGap + PANEL_UNIT.divider) - (PANEL_UNIT.columnTrack - PANEL_UNIT.width);
}

export function spanHeight(rows: number): number {
  return rows * PANEL_UNIT.height + (rows - 1) * PANEL_UNIT.rowGap;
}

export type ConfigProblem = { path: string; message: string };

// Structural checks. `knownDataviews` is the catalogue's ID set (passed in so this file
// stays free of the catalogue's size).
export function validateConfig(config: DashboardConfig, knownDataviews: Set<DataviewId>): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const p = (path: string, message: string) => problems.push({ path, message });

  if (config.schema_version !== CONFIG_SCHEMA_VERSION) p("schema_version", `expected ${CONFIG_SCHEMA_VERSION}, got ${config.schema_version}`);
  const n = config.columns.length;
  if (n < 1 || n > 4) p("columns", `1-4 columns, got ${n}`);
  if (config.layout.tracks.length !== n) p("layout.tracks", `one track weight per column (${n}), got ${config.layout.tracks.length}`);
  if (config.layout.tracks.some((t) => !(t > 0))) p("layout.tracks", "track weights must be positive");

  const ids = new Set<string>();
  const unique = (id: string, path: string) => {
    if (ids.has(id)) p(path, `duplicate id ${id}`);
    ids.add(id);
  };
  config.columns.forEach((c, i) => unique(c.id, `columns[${i}]`));
  config.rows.forEach((r, i) => unique(r.id, `rows[${i}]`));

  const colIndex = new Map(config.columns.map((c, i) => [c.id, i]));
  const rowIds = new Set(config.rows.map((r) => r.id));
  const occupied = new Map<string, string>();

  config.panels.forEach((panel, i) => {
    const path = `panels[${i}]`;
    unique(panel.id, path);
    if (!rowIds.has(panel.row)) p(path, `unknown row ${panel.row}`);
    const start = colIndex.get(panel.column);
    if (start === undefined) {
      p(path, `unknown column ${panel.column}`);
      return;
    }
    const cols = panel.span?.cols ?? 1;
    const rows = panel.span?.rows ?? 1;
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) p(`${path}.span`, "spans are whole units");
    if (start + cols > n) p(`${path}.span`, `spans past the last column`);
    if (rows !== 1) p(`${path}.span`, "row spans are reserved for meeting slides; a dashboard row holds one panel height");
    for (let c = start; c < start + cols; c++) {
      const cell = `${panel.row}:${c}`;
      if (occupied.has(cell)) p(path, `overlaps ${occupied.get(cell)}`);
      occupied.set(cell, panel.id);
    }
    if (panel.dataviews.length === 0) p(path, "a panel holds at least one dataview or placeholder");
    panel.dataviews.forEach((v, j) => {
      unique(v.id, `${path}.dataviews[${j}]`);
      if (v.kind === "view" && !knownDataviews.has(v.dataview)) p(`${path}.dataviews[${j}]`, `unknown dataview ${v.dataview}`);
    });
    if (panel.defaultView && !panel.dataviews.some((v) => v.id === panel.defaultView)) p(`${path}.defaultView`, `not one of the panel's dataviews`);
    for (const [m, id] of Object.entries(panel.defaultViewByResults ?? {}))
      if (id && !panel.dataviews.some((v) => v.id === id)) p(`${path}.defaultViewByResults.${m}`, `not one of the panel's dataviews`);
  });

  if (config.kind === "presentation" && !config.presentation) p("presentation", "a presentation needs its slides");
  return problems;
}

// The per-user state layer (G1). State is keyed by stable panel and view IDs and stored
// apart from the dashboard, so a published upgrade keeps it wherever the panel survives
// and drops it where the panel's layout or view set changed.
export type PanelUserState = { open?: boolean; view?: string; params?: Record<string, unknown> };
export type DashboardUserState = { version: string; panels: Record<string, PanelUserState> };

export function panelSignature(config: DashboardConfig, panelId: string): string {
  const panel = config.panels.find((p) => p.id === panelId);
  if (!panel) return "";
  return JSON.stringify([panel.row, panel.column, panel.span ?? null, panel.dataviews.map((v) => (v.kind === "view" ? v.dataview : v.id))]);
}

// G1's upgrade rule: keep a panel's state only when the panel still exists with the same
// signature; anything changed comes back at the new default.
export function carryUserState(prev: DashboardConfig, next: DashboardConfig, state: DashboardUserState, nextVersion: string): DashboardUserState {
  const panels: Record<string, PanelUserState> = {};
  for (const [id, s] of Object.entries(state.panels)) {
    const sig = panelSignature(next, id);
    if (sig && sig === panelSignature(prev, id)) panels[id] = s;
  }
  return { version: nextVersion, panels };
}
