// The four VicData Teacher dashboards as config (night 1 S3; scope brief §5): GCSE
// Candidates / Results and Post-16 Candidates / Results, in two linked groups whose
// switcher replaces today's Candidates/Results toggle.
//
// Built from one function so the four can never drift apart: they differ only in phase
// (accent, phase-gated views) and in measure (Candidates or Results). Every panel lists
// its dataviews in today's rail order (audit §1); the column host still decides which of
// them a given school, subject and pill state can show (e.g. Comparisons' Number tiles
// only for a ranking set), exactly as the hand-coded panel does.
//
// Stable IDs (G1/G2): dashboards `vicdata.{phase}.{measure}`, columns c1-c3, rows
// `current` / `trends`, panels `{dashboard}.{column}.{row}`, view instances
// `{panel}/{dataview}`. Per-user state and notes resolve through `legacy` -- today's
// column keys and `{phase}:{column}:{panel}` note keys -- so nothing is migrated
// (audit §6.3: a key-mapping layer, not a chart_key rewrite).
import { COLUMN_TITLE } from "@/lib/teacher-view-catalogue";
import { PHASE_LABELS } from "@/lib/teacher-view-phases";
import {
  CONFIG_SCHEMA_VERSION,
  type ColumnHeader,
  type DashboardConfig,
  type DataviewId,
  type PanelConfig,
  type Phase,
  type RowConfig,
} from "../types";

type Mode = "candidates" | "results";

const ROWS: RowConfig[] = [
  // Current = latest year, Trends = over time (combinations F1).
  { id: "current", name: "Current", time: "latest", openByDefault: true, legacyPanelId: "current" },
  { id: "trends", name: "Trends", time: "over_time", openByDefault: false, legacyPanelId: "trend" },
];

// Rail order per host and row, from audit §1.2-1.6.
const VIEWS: Record<string, { current: DataviewId[]; trends: DataviewId[]; defaults: { current: DataviewId; trends: DataviewId } }> = {
  "c1.candidates": {
    current: ["DV-C1-CAND-CUR-TILES"],
    trends: ["DV-C1-CAND-TR-INDEXED", "DV-C1-CAND-TR-ACTUAL", "DV-C1-CAND-TR-TABLE", "DV-C1-CAND-TR-GEO-CHART", "DV-C1-CAND-TR-GEO-TABLE"],
    defaults: { current: "DV-C1-CAND-CUR-TILES", trends: "DV-C1-CAND-TR-INDEXED" },
  },
  "c1.results": {
    // Grade counts draws Column 1 with its own panels (GradeCountsPanels); its views sit
    // in the same two panels, chosen by the Results pill.
    current: ["DV-C1-RES-CUR-TILES", "DV-C1-RES-CUR-GRADES", "DV-C1-RES-CUR-BAR", "DV-C1-RES-CUR-TABLE", "DV-C1-CNT-CUR-DIST"],
    trends: [
      "DV-C1-RES-TR-CHART",
      "DV-C1-RES-TR-TABLE",
      "DV-C1-RES-TR-MAP",
      "DV-C1-RES-TR-GEO-CHART",
      "DV-C1-RES-TR-GEO-TABLE",
      "DV-C1-CNT-TR-SPREAD",
      "DV-C1-CNT-TR-CHANGETABLE",
    ],
    defaults: { current: "DV-C1-RES-CUR-TILES", trends: "DV-C1-RES-TR-CHART" },
  },
  "c2.candidates": {
    current: ["DV-C2-CUR-DONUT", "DV-C2-CUR-BARS", "DV-C2-CUR-LIST", "DV-C2-CUR-TABLE"],
    trends: ["DV-C2-TR-INDEXED", "DV-C2-TR-ACTUAL", "DV-C2-TR-TABLE", "DV-C2-TR-CHANGELIST", "DV-C2-TR-CHANGETABLE"],
    defaults: { current: "DV-C2-CUR-BARS", trends: "DV-C2-TR-INDEXED" },
  },
  "c2.results": {
    // The donut stays listed: on Grade bands with a range it is a share of counts and
    // is offered; on points and rates the host keeps it disabled (R-DONUT-COUNTS-ONLY).
    current: ["DV-C2-CUR-DONUT", "DV-C2-CUR-BARS", "DV-C2-CUR-LIST", "DV-C2-CUR-TABLE"],
    trends: ["DV-C2-TR-CHART", "DV-C2-TR-TABLE", "DV-C2-TR-CHANGELIST", "DV-C2-TR-CHANGETABLE"],
    defaults: { current: "DV-C2-CUR-BARS", trends: "DV-C2-TR-CHART" },
  },
  c3: {
    current: ["DV-C3-CUR-TILES", "DV-C3-CUR-MAP", "DV-C3-CUR-BAR", "DV-C3-CUR-RANKING"],
    trends: ["DV-C3-TR-CHART", "DV-C3-TR-TABLE", "DV-C3-TR-MAP", "DV-C3-TR-CHANGELIST", "DV-C3-TR-CHANGETABLE", "DV-C3-TR-CHANGEMAP"],
    defaults: { current: "DV-C3-CUR-MAP", trends: "DV-C3-TR-CHART" },
  },
};

function columns(phase: Phase, mode: Mode): ColumnHeader[] {
  const data = mode === "candidates" ? ("academic.candidates" as const) : ("academic.results" as const);
  const results = mode === "results" ? ("pill" as const) : undefined;
  return [
    {
      id: "c1",
      title: COLUMN_TITLE[mode],
      icon: mode,
      data: { data, phase, results },
      focus: { kind: "subject", subject: { mode: "follow-chips" } },
      // Column 1 ranks the focused subject within its category (audit §3, M1); in Results it
      // also reads it against England (tiles, the bar's marker, "vs National", the grade
      // ticks -- audit M2), so the Results column declares both.
      compare:
        mode === "candidates"
          ? { kinds: ["subjects"], subjects: "category" }
          : { kinds: ["subjects", "averages"], subjects: "category", averages: ["england"] },
      host: mode === "candidates" ? "teacher.c1.candidates" : "teacher.c1.results",
      legacyColumnKey: "candidates",
    },
    {
      id: "c2",
      title: COLUMN_TITLE.context,
      icon: "context",
      data: { data, phase, results },
      focus: { kind: "subject", subject: { mode: "follow-chips" } },
      // Context's compare-against pill: category (default) / all subjects / selected.
      compare: { kinds: ["subjects"], subjects: "pill" },
      host: "teacher.c2.context",
      legacyColumnKey: "context",
    },
    {
      id: "c3",
      title: COLUMN_TITLE.rankings,
      icon: "rankings",
      data: { data, phase, results },
      focus: { kind: "subject", subject: { mode: "follow-chips" } },
      // The compared-against set: a saved set or chooser choice, else 10 nearest.
      compare: { kinds: ["schools"], schools: "saved-or-chooser" },
      host: "teacher.c3.comparisons",
      legacyColumnKey: "rankings",
    },
  ];
}

function panel(dashboardId: string, phase: Phase, column: "c1" | "c2" | "c3", columnKey: string, viewsKey: string, row: RowConfig): PanelConfig {
  const set = VIEWS[viewsKey];
  const which = row.id === "current" ? "current" : "trends";
  const id = `${dashboardId}.${column}.${row.id}`;
  const panelId = row.legacyPanelId!;
  return {
    id,
    row: row.id,
    column,
    span: { cols: 1, rows: 1 },
    dataviews: set[which].map((dv) => ({ id: `${id}/${dv}`, kind: "view" as const, dataview: dv })),
    defaultView: `${id}/${set.defaults[which]}`,
    legacy: {
      columnKey,
      panelId,
      // The note key the page reads today, plus the pre-merge "change" key whose notes
      // the Trends row merge orphaned (audit A §1.8) -- listed so a later notes hub can
      // surface them; the renderer reads only the first.
      noteKeys: panelId === "trend" ? [`${phase}:${columnKey}:trend`, `${phase}:${columnKey}:change`] : [`${phase}:${columnKey}:${panelId}`],
    },
  };
}

function teacherDashboard(phase: Phase, mode: Mode): DashboardConfig {
  const id = `vicdata.${phase}.${mode}`;
  const panels: PanelConfig[] = [];
  for (const row of ROWS) {
    panels.push(panel(id, phase, "c1", "candidates", `c1.${mode}`, row));
    panels.push(panel(id, phase, "c2", "context", `c2.${mode}`, row));
    panels.push(panel(id, phase, "c3", "rankings", "c3", row));
  }
  // F2 (combinations doc; A4 "override in place for 0.6 parity"): Column 1's Trends
  // carries the "against the wider system" views, which compare with LA, region and
  // England while the column itself compares only within the school. Seeded as a marked
  // override until Guy's Trends pass moves them.
  const c1Trends = panels.find((p) => p.column === "c1" && p.row === "trends")!;
  c1Trends.override =
    mode === "candidates"
      ? {
          compare: { kinds: ["subjects", "averages"], subjects: "category", averages: ["la", "region", "england"] },
          badge: "overridden: LA, region, England",
          reason: "Combinations doc F2: Column 1's Trends shows its subject against LA, region and England (Area chart, Change table).",
        }
      : {
          compare: { kinds: ["subjects", "averages", "schools"], subjects: "category", averages: ["la", "region", "england"], schools: "saved-or-chooser" },
          badge: "overridden: LA, region, England; comparator schools",
          reason:
            "Combinations doc F2 plus audit M4: Results Trends also carries the comparator-school Map, and Grade counts' Spread and Change table, which compare with nothing (they follow the Results pill into this panel).",
        };
  // Comparisons' Number tiles show the school's headline whatever the subject chip (ranking
  // sets only, audit §1.6): a focus the column doesn't declare. Marked, not moved.
  const c3Current = panels.find((p) => p.column === "c3" && p.row === "current")!;
  c3Current.override = {
    badge: "overridden: whole-school headline (ranking sets)",
    reason: "DV-C3-CUR-TILES shows the school's headline rank in a ranking set, not the focused subject.",
  };
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id,
    name: `${PHASE_LABELS[phase]} ${mode === "candidates" ? "Candidates" : "Results"}`,
    kind: "dashboard",
    owner: "vicdata",
    colour: { key: phase },
    group: { id: `vicdata.${phase}`, label: PHASE_LABELS[phase], order: mode === "candidates" ? 0 : 1 },
    layout: { preset: "3", tracks: [1, 1, 1], accordion: "auto-close" },
    columns: columns(phase, mode),
    rows: ROWS,
    panels,
    features: { subjectChips: true, resultsPill: mode === "results", alignmentSpacer: true },
  };
}

export const TEACHER_DASHBOARDS: DashboardConfig[] = [
  teacherDashboard("ks4", "candidates"),
  teacherDashboard("ks4", "results"),
  teacherDashboard("ks5", "candidates"),
  teacherDashboard("ks5", "results"),
];

export function teacherDashboardFor(phase: Phase, mode: Mode): DashboardConfig {
  return TEACHER_DASHBOARDS.find((d) => d.id === `vicdata.${phase}.${mode}`)!;
}
