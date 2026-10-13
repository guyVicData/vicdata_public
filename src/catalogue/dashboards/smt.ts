// VicData 0.8 SMT round 1 (B1): the SMT dashboards, linked by the Overview | Academic switch as GCSE
// Candidates | Results and Admissions' Pipelines | Market share are (group "vicdata.smt").
// Layout, from the wireframes (docs/wireframes/smt, Main and Academic), Admissions' grid:
//   row "now"     column 1 the school (or the level) now; columns 2-3 ONE spanning large view
//   row "trends"  three panels
// Every view follows the level chips (focus "level"). Pupils and Context are registered here as
// coming (SMT round 2): the switch shows the two built dashboards only, because the editor and the
// switcher have no "coming" state (logged, 0.8 shell + SMT r1). Code fallback for the seed, as
// teacher.ts and admissions.ts are.
import { CONFIG_SCHEMA_VERSION, type ColumnHeader, type DashboardConfig, type DataviewId, type PanelConfig, type RowConfig, type SmtDataId, type SmtHostId } from "../types";
import { viewInstance } from "../viewspec";

export const SMT_GROUP = { id: "vicdata.smt", label: "SMT" } as const;
export const SMT_OVERVIEW_ID = "vicdata.smt.overview";
export const SMT_ACADEMIC_ID = "vicdata.smt.academic";

// SMT round 2 (spec §2.3, §4): drawn nowhere yet; the home's "The school" card lists them as coming.
export const SMT_COMING = [
  { id: "vicdata.smt.pupils", name: "Pupils" },
  { id: "vicdata.smt.context", name: "Context" },
] as const;

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
];

export const isSmtDashboard = (id: string | null | undefined): boolean => !!id && id.startsWith(`${SMT_GROUP.id}.`);

// Who the seed assigns them to (scripts/dashboards-seed-sql.ts): SMT. The School-Admin and platform
// admins reach the pages by role (src/lib/smt/auth.ts); Teachers never get them.
export const SMT_SEED_ROLES = ["smt"] as const;
