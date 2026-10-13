// VicData 0.8 SMT round 1 (B1): the SMT dashboards, linked by the Overview | Academic switch as GCSE
// Candidates | Results and Admissions' Pipelines | Market share are (group "vicdata.smt").
// Layout, from the wireframes (docs/wireframes/smt, Main and Academic), Admissions' grid:
//   row "now"     column 1 the school (or the level) now; columns 2-3 ONE spanning large view
//   row "trends"  three panels
// Every view follows the level chips (focus "level"). 0.8 SMT round 2 adds Pupils and Context, so
// the switch shows all four. Code fallback for the seed, as teacher.ts and admissions.ts are.
import { CONFIG_SCHEMA_VERSION, type ColumnHeader, type DashboardConfig, type DataviewId, type PanelConfig, type RowConfig, type SmtDataId, type SmtHostId } from "../types";
import { viewInstance } from "../viewspec";

export const SMT_GROUP = { id: "vicdata.smt", label: "SMT" } as const;
export const SMT_OVERVIEW_ID = "vicdata.smt.overview";
export const SMT_ACADEMIC_ID = "vicdata.smt.academic";
export const SMT_PUPILS_ID = "vicdata.smt.pupils";
export const SMT_CONTEXT_ID = "vicdata.smt.context";

// Dashboards still to come (round 1 listed Pupils and Context here; round 2 built them).
export const SMT_COMING: readonly { id: string; name: string }[] = [];

const ROWS: RowConfig[] = [
  { id: "now", name: "Now", time: "latest", openByDefault: true, legacyPanelId: "current" },
  { id: "trends", name: "Trends", time: "over_time", openByDefault: true, legacyPanelId: "trend" },
];

type Cell = { column: "c1" | "c2" | "c3"; row: "now" | "trends"; span?: 2; name: string; views: DataviewId[]; defaultView: DataviewId };

const OVERVIEW: Cell[] = [
  { column: "c1", row: "now", name: "Current", views: ["DV-SMT-O-NOW"], defaultView: "DV-SMT-O-NOW" },
  { column: "c2", row: "now", span: 2, name: "Scorecard", views: ["DV-SMT-O-SCORECARD", "DV-SMT-O-MAP", "DV-SMT-O-FLAGS"], defaultView: "DV-SMT-O-SCORECARD" },
  { column: "c1", row: "trends", name: "Trends", views: ["DV-SMT-O-ROLL-LINE", "DV-SMT-O-ROLL-TABLE"], defaultView: "DV-SMT-O-ROLL-LINE" },
  { column: "c2", row: "trends", name: "Trends", views: ["DV-SMT-O-RESULTS-LINE", "DV-SMT-O-RESULTS-TABLE"], defaultView: "DV-SMT-O-RESULTS-LINE" },
  { column: "c3", row: "trends", name: "From Admissions", views: ["DV-SMT-O-MARKET-LINE", "DV-SMT-O-MARKET-TABLE"], defaultView: "DV-SMT-O-MARKET-LINE" },
];

const ACADEMIC: Cell[] = [
  { column: "c1", row: "now", name: "Current", views: ["DV-SMT-A-NOW"], defaultView: "DV-SMT-A-NOW" },
  { column: "c2", row: "now", span: 2, name: "Subjects", views: ["DV-SMT-A-AREAS", "DV-SMT-A-SUBJECTS", "DV-SMT-A-VA", "DV-SMT-A-GRADES"], defaultView: "DV-SMT-A-AREAS" },
  { column: "c1", row: "trends", name: "Trends", views: ["DV-SMT-A-TREND-LINE", "DV-SMT-A-TREND-TABLE"], defaultView: "DV-SMT-A-TREND-LINE" },
  { column: "c2", row: "trends", name: "Trends", views: ["DV-SMT-A-BANDS"], defaultView: "DV-SMT-A-BANDS" },
  { column: "c3", row: "trends", name: "Trends", views: ["DV-SMT-A-MIX", "DV-SMT-A-MIX-TABLE"], defaultView: "DV-SMT-A-MIX" },
];

const PUPILS: Cell[] = [
  { column: "c1", row: "now", name: "Current", views: ["DV-SMT-P-NOW"], defaultView: "DV-SMT-P-NOW" },
  { column: "c2", row: "now", span: 2, name: "Shape and size", views: ["DV-SMT-P-SHAPE", "DV-SMT-P-ENTRIES", "DV-SMT-P-LEAVING", "DV-SMT-P-MARKET"], defaultView: "DV-SMT-P-SHAPE" },
  { column: "c1", row: "trends", name: "Trends", views: ["DV-SMT-P-PHASES", "DV-SMT-P-PHASES-TABLE"], defaultView: "DV-SMT-P-PHASES" },
  { column: "c2", row: "trends", name: "From Admissions", views: ["DV-SMT-P-POOL"], defaultView: "DV-SMT-P-POOL" },
  { column: "c3", row: "trends", name: "Area", views: ["DV-SMT-P-AREA"], defaultView: "DV-SMT-P-AREA" },
];

const CONTEXT: Cell[] = [
  { column: "c1", row: "now", name: "Current", views: ["DV-SMT-C-NOW"], defaultView: "DV-SMT-C-NOW" },
  { column: "c2", row: "now", span: 2, name: "Map", views: ["DV-SMT-C-MAP", "DV-SMT-C-BYAGE", "DV-SMT-C-BIRTHS"], defaultView: "DV-SMT-C-MAP" },
  { column: "c1", row: "trends", name: "Trends", views: ["DV-SMT-C-BIRTHS-INDEXED", "DV-SMT-C-BIRTHS-TABLE"], defaultView: "DV-SMT-C-BIRTHS-INDEXED" },
  { column: "c2", row: "trends", name: "Forward", views: ["DV-SMT-C-PROJECTION"], defaultView: "DV-SMT-C-PROJECTION" },
  { column: "c3", row: "trends", name: "Area", views: ["DV-SMT-C-AGES"], defaultView: "DV-SMT-C-AGES" },
];

function columns(host: SmtHostId, data: [SmtDataId, SmtDataId, SmtDataId], titles: [string, string, string]): ColumnHeader[] {
  const icons: ColumnHeader["icon"][] = ["context", "results", "rankings"];
  return (["c1", "c2", "c3"] as const).map((id, i) => ({
    id,
    title: titles[i],
    icon: icons[i],
    data: { data: data[i], phase: "ks4" },
    focus: { kind: "level" },
    compare: i === 0 ? null : { kinds: ["schools"], schools: "saved-or-chooser" },
    host,
  }));
}

function smtDashboard(id: string, name: string, order: number, host: SmtHostId, cells: Cell[], cols: ColumnHeader[]): DashboardConfig {
  const panels: PanelConfig[] = cells.map((c) => {
    const pid = `${id}.${c.column}.${c.row}`;
    return { id: pid, row: c.row, column: c.column, span: { cols: c.span ?? 1, rows: 1 }, name: c.name, dataviews: c.views.map((dv) => viewInstance(`${pid}/${dv}`, dv)), defaultView: `${pid}/${c.defaultView}` };
  });
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id,
    name,
    kind: "dashboard",
    owner: "vicdata",
    colour: { key: "neutral" },
    group: { id: SMT_GROUP.id, label: SMT_GROUP.label, order },
    layout: { preset: "3", tracks: [1, 1, 1], accordion: "independent" },
    columns: cols,
    rows: ROWS,
    panels,
    features: { levelChips: true },
  };
}

export const SMT_DASHBOARDS: DashboardConfig[] = [
  smtDashboard(SMT_OVERVIEW_ID, "SMT Overview", 0, "smt.overview", OVERVIEW, columns("smt.overview", ["smt.school", "smt.results", "smt.school"], ["The school now", "Scorecard", "From Admissions"])),
  smtDashboard(SMT_ACADEMIC_ID, "SMT Academic", 1, "smt.academic", ACADEMIC, columns("smt.academic", ["smt.results", "smt.subjects", "smt.subjects"], ["The level now", "Subjects", "Entries"])),
  smtDashboard(SMT_PUPILS_ID, "SMT Pupils", 2, "smt.pupils", PUPILS, columns("smt.pupils", ["smt.school", "smt.school", "smt.school"], ["Your pupils now", "Shape and size", "Area"])),
  smtDashboard(SMT_CONTEXT_ID, "SMT Context", 3, "smt.context", CONTEXT, columns("smt.context", ["smt.area", "smt.area", "smt.area"], ["The area now", "Map", "Area"])),
];

export const isSmtDashboard = (id: string | null | undefined): boolean => !!id && id.startsWith(`${SMT_GROUP.id}.`);

// Who the seed assigns them to (scripts/dashboards-seed-sql.ts): SMT. The School-Admin and platform
// admins reach the pages by role (src/lib/smt/auth.ts); Teachers never get them.
export const SMT_SEED_ROLES = ["smt"] as const;
