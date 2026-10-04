// VicData 0.6 E: how a stored config is drawn through TeacherDashboard outside the page --
// which column host draws each config column, what the 0.6 renderer can't draw yet (said
// plainly, never silently dropped), and the settings an embedded view starts from.
// Pure, so scripts/catalogue-unit-tests.ts can pin it.
import { CONFIG_SCHEMA_VERSION, type ColumnHeader, type DashboardConfig, type Dataview, type HostId, type PanelConfig, type Phase, type ResultsMeasure } from "@/catalogue/types";
import { DATAVIEWS } from "@/catalogue/dataviews";
import { againstKey, chosenKey, measureKey, writeList, writeSetting, type ColumnState } from "@/lib/teacher-view-data";
import type { PinnedSettings } from "@/lib/meeting-views";
import { viewInstance } from "@/catalogue/viewspec";

export type DashboardMeasure = "candidates" | "results";

// Which host draws a config column. A column that names its host (the seeded Teacher
// dashboards do) gets it. Otherwise, by its data and comparison:
//   compares schools          -> Comparisons (teacher.c3.comparisons)
//   compares subjects         -> Context (teacher.c2.context)
//   otherwise, Candidates     -> Column 1 Candidates (teacher.c1.candidates)
//   otherwise, Results        -> Column 1 Results (teacher.c1.results; on the Grade counts
//                                measure it draws through teacher.c1.counts, as today)
// Rolls and Live births have no host yet (no views exist): null.
export function hostForColumn(column: ColumnHeader): HostId | null {
  if (column.host) return column.host;
  const data = column.data.data;
  if (data !== "academic.candidates" && data !== "academic.results") return null;
  const kinds = column.compare?.kinds ?? [];
  if (kinds.includes("schools")) return "teacher.c3.comparisons";
  if (kinds.includes("subjects")) return "teacher.c2.context";
  return data === "academic.results" ? "teacher.c1.results" : "teacher.c1.candidates";
}

// The persistence key a host draws its column under (the page's column ids).
export function columnKeyOfHost(host: HostId): "candidates" | "context" | "rankings" {
  if (host === "teacher.c2.context") return "context";
  if (host === "teacher.c3.comparisons") return "rankings";
  return "candidates";
}

const PHASE_WORD: Record<Phase, string> = { ks4: "GCSE", ks5: "Post-16" };
const DATA_WORD: Record<string, string> = { rolls: "Rolls", "social.births": "Live births" };

export type EmbedColumn = {
  column: ColumnHeader;
  host: HostId | null;
  // The page's column key the host draws under (candidates / context / rankings).
  key: string;
  // Set when this column can't be drawn in 0.6; the column shows this note instead.
  problem: string | null;
  // Rolls / Live births: drawn as their placeholder panels only.
  placeholderOnly: boolean;
};

// The dashboard's one phase: the first column's (one phase per dashboard for now).
export function dashboardPhase(config: DashboardConfig): Phase {
  return config.columns[0]?.data.phase ?? "ks4";
}

// The dashboard's one Candidates/Results choice: the first academic column's data. The
// page's derivation reads one shared measure for every column, so 0.6 draws one per
// dashboard.
export function dashboardMeasure(config: DashboardConfig): DashboardMeasure {
  const first = config.columns.find((c) => hostForColumn(c) !== null);
  return first ? columnMeasure(first) : "candidates";
}

// A column's Candidates/Results: Column 1's hosts say it themselves; otherwise its data.
function columnMeasure(column: ColumnHeader): DashboardMeasure {
  if (column.host === "teacher.c1.results" || column.host === "teacher.c1.counts") return "results";
  if (column.host === "teacher.c1.candidates") return "candidates";
  return column.data.data === "academic.results" ? "results" : "candidates";
}

// Every config column with its host and, where 0.6 can't draw it, why. The limits:
//   - one phase per dashboard: a column on another phase shows a note;
//   - each host at most once per dashboard (Column 1 counts once, whichever of its
//     Candidates / Results / Grade counts hosts): a second instance shows a note;
//   - one of Candidates or Results per dashboard: a column on the other shows a note;
//   - Rolls and Live births: placeholder panels only (no views exist yet).
export function embedColumns(config: DashboardConfig): EmbedColumn[] {
  const phase = dashboardPhase(config);
  const measure = dashboardMeasure(config);
  const seen = new Set<string>();
  return config.columns.map((column) => {
    const host = hostForColumn(column);
    if (!host) {
      return { column, host, key: column.id, placeholderOnly: true, problem: null };
    }
    const key = columnKeyOfHost(host);
    let problem: string | null = null;
    if (column.data.phase !== phase) {
      problem = `One phase per dashboard for now: this column is ${PHASE_WORD[column.data.phase]}, and this dashboard is ${PHASE_WORD[phase]}.`;
    } else if (seen.has(key)) {
      problem = "Each kind of column appears once per dashboard for now, and this one is already on it.";
    } else if (columnMeasure(column) !== measure) {
      problem = `One of Candidates or Results per dashboard for now: this column is ${measure === "results" ? "Candidates" : "Results"}, and this dashboard shows ${measure === "results" ? "Results" : "Candidates"}.`;
    }
    if (!problem) seen.add(key);
    return { column, host, key, placeholderOnly: false, problem };
  });
}

export function placeholderOnlyNote(column: ColumnHeader): string {
  return `${DATA_WORD[column.data.data] ?? "This data"} has no views yet.`;
}

// Which of a host's panels (current / trend) a config panel is.
export function hostPanelOfConfig(panel: PanelConfig, rowLegacy?: "current" | "trend"): "current" | "trend" | undefined {
  if (panel.legacy?.panelId) return panel.legacy.panelId;
  if (rowLegacy) return rowLegacy;
  for (const v of panel.dataviews) {
    if (v.kind !== "view") continue;
    const dv = DATAVIEWS.find((d) => d.id === v.dataview);
    if (dv) return dv.host.panel;
  }
  return undefined;
}

// The panels open when the dashboard first shows: per column, the rows marked
// openByDefault (the first only, under auto-close; every one, under independent).
export function openPanelsOf(config: DashboardConfig, columnId: string): ("current" | "trend")[] {
  const open: ("current" | "trend")[] = [];
  for (const row of config.rows) {
    if (!row.openByDefault) continue;
    const panel = config.panels.find((p) => p.column === columnId && p.row === row.id);
    const id = panel ? hostPanelOfConfig(panel, row.legacyPanelId) : undefined;
    if (id && !open.includes(id)) open.push(id);
    if (open.length && config.layout.accordion === "auto-close") break;
  }
  // A one-panel config (a meeting slot, a preview) always shows its panel.
  if (!open.length && config.panels.length === 1) {
    const only = config.panels[0];
    const row = config.rows.find((r) => r.id === only.row);
    const id = hostPanelOfConfig(only, row?.legacyPanelId);
    if (id) open.push(id);
  }
  return open;
}

// "2024/25" -> 2024 (the period the page indexes years by); null when unreadable.
export function yearPeriodOf(year: string | null | undefined): number | null {
  const m = year ? /^(\d{4})/.exec(year) : null;
  return m ? Number(m[1]) : null;
}

// Context's compare-against from a pinned comparison's name (or an explicit param).
export function contextAgainstOf(pinned: PinnedSettings): "category" | "whole" | "selected" {
  const explicit = pinned.params?.against;
  if (explicit === "whole" || explicit === "selected" || explicit === "category") return explicit;
  const name = pinned.compare?.kind === "subjects" ? pinned.compare.name.toLowerCase() : "";
  if (name.includes("all subjects") || name.includes("whole school")) return "whole";
  if (name.includes("selected")) return "selected";
  return "category";
}

// The pinned comparison set's name when it is a saved set (anything other than the
// default nearest ten); null = the default "10 nearest schools".
export function pinnedSetName(pinned: PinnedSettings): string | null {
  if (pinned.compare?.kind !== "schools") return null;
  const name = pinned.compare.name.trim();
  return !name || /^10 nearest/i.test(name) ? null : name;
}

export function savedSetByName<T extends { name: string }>(sets: T[], name: string): T | undefined {
  const n = name.trim().toLowerCase();
  return sets.find((s) => s.name.trim().toLowerCase() === n);
}

// The focus item for a pinned subject: its exact (subject, qualification) key when the
// pin names the qualification, else the school's largest entry in that subject.
export function embedSubjectKey(items: { key: string; subject: string; qualificationType: string }[], pinned: PinnedSettings): string | null {
  if (!pinned.subject) return null;
  if (pinned.qualificationType) {
    const exact = items.find((i) => i.subject === pinned.subject && i.qualificationType === pinned.qualificationType);
    if (exact) return exact.key;
  }
  return items.find((i) => i.subject === pinned.subject)?.key ?? null;
}

// The column settings an embedded dashboard starts from (the same ColumnState keys the
// page persists), applied over `base` -- {} for pinned settings, or the person's saved
// preferences read for a custom dashboard. `pendingSetKey` holds the Comparisons pill on a
// saved set while saved sets load (see TeacherDashboard).
export function embedInitialColumns(
  config: DashboardConfig,
  pinned: PinnedSettings,
  base: ColumnState,
  opts: { pendingSetKey?: string | null; chooserKey: string; setKeyName: string },
): ColumnState {
  let next: ColumnState = { ...base };
  const measure = dashboardMeasure(config);
  next = writeSetting(next, measureKey("shared"), measure === "results" ? "results" : null);
  const fixed = config.columns.map((c) => c.data.results).find((r): r is ResultsMeasure => !!r && r !== "pill");
  const results = pinned.results ?? fixed;
  if (results) next = writeSetting(next, measureKey("results"), results);
  if (pinned.compare?.kind === "subjects" || pinned.params?.against) next = writeSetting(next, againstKey("context"), contextAgainstOf(pinned));
  const selected = pinned.params?.selected;
  if (Array.isArray(selected) && selected.every((k) => typeof k === "string")) next = writeList(next, chosenKey("context"), selected as string[]);
  const band = pinned.params?.bandRange as { top?: unknown; bottom?: unknown } | undefined;
  if (band && typeof band.top === "string" && typeof band.bottom === "string") next = writeSetting(next, "band:range", JSON.stringify({ top: band.top, bottom: band.bottom }));
  if (pinned.compare?.kind === "schools") {
    next = writeSetting(next, opts.chooserKey, null);
    next = writeSetting(next, opts.setKeyName, opts.pendingSetKey ?? null);
  }
  for (const col of embedColumns(config)) {
    if (!col.host || col.problem) continue;
    next[col.key] = openPanelsOf(config, col.column.id);
  }
  return next;
}

// ------------------------------------------------ one view (meeting slots, previews)

const COLUMN_ICON: Record<Dataview["host"]["id"], DashboardConfig["columns"][number]["icon"]> = {
  "teacher.c1.candidates": "candidates",
  "teacher.c1.results": "results",
  "teacher.c1.counts": "results",
  "teacher.c2.context": "context",
  "teacher.c3.comparisons": "rankings",
};

// Does this host offer a year control on this panel? (Context's Current: SubjectPanels'
// yearControl.) Elsewhere a pinned year can't be honoured yet.
export function hostHasYearControl(dv: Dataview): boolean {
  return dv.host.id === "teacher.c2.context" && dv.host.panel === "current";
}

// The Results sub-measure a view can draw with: Grade counts' own host is counts only;
// otherwise the pinned one when the view supports it, else its first.
function resultsFor(dv: Dataview, pinned: PinnedSettings): ResultsMeasure | undefined {
  if (dv.host.id === "teacher.c1.counts") return "counts";
  const supported = dv.supports.results;
  if (!supported?.length) return pinned.results;
  return pinned.results && supported.includes(pinned.results) ? pinned.results : supported[0];
}

// The one-view config a meeting slot or a preview is drawn with: one column (the view's
// own host), one row, one panel, one view.
// `params` (0.6 snag 3 / 01): the view instance's own settings, carried onto the one view
// so its host draws with them (the editor's live preview of a tiles view, a meeting slot).
// `title` (0.6 snag 4 / 01): the instance's own title, so the figure shows it as the page does.
export function oneViewConfig(dv: Dataview, pinned: PinnedSettings, id: string, params?: Record<string, unknown>, title?: string): DashboardConfig {
  const phase: Phase = pinned.phase && dv.supports.phases.includes(pinned.phase) ? pinned.phase : dv.supports.phases[0];
  const data = pinned.data && dv.supports.data.includes(pinned.data) ? pinned.data : dv.supports.data[0];
  const results = data === "academic.results" ? resultsFor(dv, pinned) : undefined;
  const panelId = dv.host.panel;
  const rowId = panelId === "current" ? "current" : "trends";
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id,
    name: dv.label,
    kind: "dashboard",
    owner: "user",
    colour: { key: phase },
    layout: { preset: "1", tracks: [1], accordion: "auto-close" },
    columns: [
      {
        id: "c1",
        title: dv.label,
        icon: COLUMN_ICON[dv.host.id],
        data: { data, phase, results },
        focus: { kind: "subject", subject: { mode: "follow-chips" } },
        compare: null,
        host: dv.host.id,
      },
    ],
    rows: [{ id: rowId, name: panelId === "current" ? "Current" : "Trends", time: panelId === "current" ? "latest" : "over_time", openByDefault: true, legacyPanelId: panelId }],
    panels: [{ id: `${id}.panel`, row: rowId, column: "c1", dataviews: [viewInstance(`${id}/${dv.id}`, dv.id, { ...(params ? { params } : {}), ...(title ? { title } : {}) })], defaultView: `${id}/${dv.id}` }],
  };
}

// The settings the embed draws with: the pin, with the measure resolved and the year kept
// only where it can be honoured.
export function oneViewPinned(dv: Dataview, pinned: PinnedSettings, keepLive: boolean): { pinned: PinnedSettings; yearNote: string | null } {
  const config = oneViewConfig(dv, pinned, "x");
  const col = config.columns[0].data;
  const next: PinnedSettings = { ...pinned, phase: col.phase, data: col.data, results: col.results === "pill" ? undefined : col.results };
  if (keepLive || !pinned.year) return { pinned: { ...next, year: null }, yearNote: null };
  if (hostHasYearControl(dv)) return { pinned: next, yearNote: null };
  return {
    pinned: { ...next, year: null },
    yearNote: `${dv.id} is pinned to ${pinned.year}, but its panel has no year control yet; showing the latest data.`,
  };
}
