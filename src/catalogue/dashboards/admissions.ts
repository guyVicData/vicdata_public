// VicData 0.7 admissions r2 (D2): the two published Admissions dashboards, linked by the
// Pipelines | Market share switch as GCSE Candidates | Results are (group "vicdata.admissions").
// Layout, from the wireframes (docs/wireframes/admissions, Main and MarketShare):
//   row "now"     column 1 the entry point now; columns 2-3 ONE spanning large view (span 2)
//   row "trends"  three panels
// Every view follows the entry-point chips (focus "entry_point"), which play the part Teacher's
// subject chips play. Seeded by scripts/dashboards-seed-sql.ts (assigned to Admissions and SMT,
// never to Teacher); this file is the code fallback, as teacher.ts is for Teacher.
// 0.8 Admissions fb1: Local births beside the funnel (F-13), girls and boys after the cohort table (F-16),
// the share of Years 7-11 as the Market share Trends rail's last view (F-21). Republished by the seed.
import { CONFIG_SCHEMA_VERSION, type AdmissionsDataId, type AdmissionsHostId, type ColumnHeader, type DashboardConfig, type DataviewId, type PanelConfig, type RowConfig } from "../types";
import { viewInstance } from "../viewspec";

export const ADMISSIONS_GROUP = { id: "vicdata.admissions", label: "Admissions" } as const;
export const ADMISSIONS_PIPELINES_ID = "vicdata.admissions.pipelines";
export const ADMISSIONS_MARKET_ID = "vicdata.admissions.market-share";

const ROWS: RowConfig[] = [
  { id: "now", name: "Now", time: "latest", openByDefault: true, legacyPanelId: "current" },
  { id: "trends", name: "Trends", time: "over_time", openByDefault: true, legacyPanelId: "trend" },
];

type Cell = { column: "c1" | "c2" | "c3"; row: "now" | "trends"; span?: 2; name: string; views: DataviewId[]; defaultView: DataviewId };

const PIPELINES: Cell[] = [
  { column: "c1", row: "now", name: "Current", views: ["DV-ADM-P-NOW"], defaultView: "DV-ADM-P-NOW" },
  { column: "c2", row: "now", span: 2, name: "Pipeline", views: ["DV-ADM-P-PIPELINE", "DV-ADM-P-FUNNEL", "DV-ADM-P-BIRTHS", "DV-ADM-P-MAP", "DV-ADM-P-TABLE", "DV-ADM-P-SHAPE"], defaultView: "DV-ADM-P-PIPELINE" },
  { column: "c1", row: "trends", name: "Trends", views: ["DV-ADM-P-ENTRY-LINE", "DV-ADM-P-ENTRY-BARS", "DV-ADM-P-ENTRY-TABLE", "DV-ADM-P-ENTRY-SEX"], defaultView: "DV-ADM-P-ENTRY-LINE" },
  { column: "c2", row: "trends", name: "Trends", views: ["DV-ADM-P-POOL-INDEXED", "DV-ADM-P-POOL-TABLE", "DV-ADM-P-AREA-POP"], defaultView: "DV-ADM-P-POOL-INDEXED" },
  { column: "c3", row: "trends", name: "Forward", views: ["DV-ADM-P-HOLD-LINE", "DV-ADM-P-HOLD-TABLE"], defaultView: "DV-ADM-P-HOLD-LINE" },
];

const MARKET: Cell[] = [
  { column: "c1", row: "now", name: "Current", views: ["DV-ADM-M-NOW"], defaultView: "DV-ADM-M-NOW" },
  { column: "c2", row: "now", span: 2, name: "Rivals", views: ["DV-ADM-M-DONUT", "DV-ADM-M-BARS", "DV-ADM-M-MAP", "DV-ADM-M-TABLE", "DV-ADM-M-MOMENTUM", "DV-ADM-M-STRENGTHS", "DV-ADM-M-SHAPE"], defaultView: "DV-ADM-M-BARS" },
  { column: "c1", row: "trends", name: "Trends", views: ["DV-ADM-M-VS-LINE", "DV-ADM-M-VS-BARS"], defaultView: "DV-ADM-M-VS-LINE" },
  { column: "c2", row: "trends", name: "Academic", views: ["DV-ADM-M-ACAD-RANK", "DV-ADM-M-ACAD-NUM", "DV-ADM-M-ACAD-CHANGE"], defaultView: "DV-ADM-M-ACAD-RANK" },
  { column: "c3", row: "trends", name: "Trends", views: ["DV-ADM-M-SHARE-LINE", "DV-ADM-M-SHARE-NUM", "DV-ADM-M-SHARE-RANKS", "DV-ADM-M-SHARE-CHANGE", "DV-ADM-M-ROLL-LINE", "DV-ADM-M-SHARE-BAND"], defaultView: "DV-ADM-M-SHARE-LINE" },
];

// The column headers carry the family each column starts from; the phase is unused by Admissions
// (the entry point is the focus) and pre-filled only because the shared type asks for one.
function columns(host: AdmissionsHostId, data: [AdmissionsDataId, AdmissionsDataId, AdmissionsDataId], titles: [string, string, string]): ColumnHeader[] {
  const icons: ColumnHeader["icon"][] = ["context", "context", "rankings"];
  return (["c1", "c2", "c3"] as const).map((id, i) => ({
    id,
    title: titles[i],
    icon: icons[i],
    data: { data: data[i], phase: "ks4" },
    focus: { kind: "entry_point" },
    compare: i === 0 ? null : { kinds: ["schools"], schools: "saved-or-chooser" },
    host,
  }));
}

function admissionsDashboard(id: string, name: string, order: number, host: AdmissionsHostId, cells: Cell[], cols: ColumnHeader[]): DashboardConfig {
  const panels: PanelConfig[] = cells.map((c) => {
    const pid = `${id}.${c.column}.${c.row}`;
    return {
      id: pid,
      row: c.row,
      column: c.column,
      span: { cols: c.span ?? 1, rows: 1 },
      name: c.name,
      dataviews: c.views.map((dv) => viewInstance(`${pid}/${dv}`, dv)),
      defaultView: `${pid}/${c.defaultView}`,
    };
  });
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id,
    name,
    kind: "dashboard",
    owner: "vicdata",
    colour: { key: "neutral" },
    group: { id: ADMISSIONS_GROUP.id, label: ADMISSIONS_GROUP.label, order },
    layout: { preset: "3", tracks: [1, 1, 1], accordion: "independent" },
    columns: cols,
    rows: ROWS,
    panels,
    features: { entryPointChips: true, admissionsFilters: true },
  };
}

export const ADMISSIONS_DASHBOARDS: DashboardConfig[] = [
  admissionsDashboard(ADMISSIONS_PIPELINES_ID, "Admissions Pipelines", 0, "admissions.pipelines", PIPELINES, columns("admissions.pipelines", ["admissions.pupils", "admissions.pipeline", "admissions.pipeline"], ["Entry point", "Pipeline", "Forward"])),
  admissionsDashboard(ADMISSIONS_MARKET_ID, "Admissions Market share", 1, "admissions.market", MARKET, columns("admissions.market", ["admissions.market", "admissions.market", "admissions.market"], ["Entry point", "Rivals", "Trends"])),
];

export const isAdmissionsDashboard = (id: string | null | undefined): boolean => !!id && id.startsWith(`${ADMISSIONS_GROUP.id}.`);

// Who the seed assigns them to (scripts/dashboards-seed-sql.ts): Admissions and SMT. The
// School-Admin and platform admins reach the page by role (src/lib/admissions/auth.ts); Teachers
// never get them (decision 5: a list shared with someone gives the list only).
export const ADMISSIONS_SEED_ROLES = ["admissions", "smt"] as const;
