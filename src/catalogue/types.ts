// VicData 0.6: the four-layer catalogue (docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md
// §1-2) and the dashboard config format (scope brief §1, §4; combinations doc §1-2).
//
//   RULES      what a number is allowed to be
//   MEASURES   what is counted, where, with which honest number types
//   RENDERERS  chart/table/map components: shape requirements only
//   DATAVIEWS  the registered recipes the chooser offers and dashboards place
//
// Code is the source of truth: docs/catalogue/*.md is generated from these objects by
// scripts/catalogue-export.ts, and the Catalogue page (/platform/catalogue) reads them.

// ---------------------------------------------------------------------------------
// Shared vocabularies

// Step 1's data families, in VicData terms. `rolls` and `social.births` are registered as
// measures in 0.6 with no views yet (scope brief D9, combinations doc §6).
export type DataId = "academic.candidates" | "academic.results" | "rolls" | "social.births";

export type Phase = "ks4" | "ks5";

// The Results sub-measure pill (MeasurePicker): APS / Grade 4+ / grade bands / grade counts.
export type ResultsMeasure = "points" | "threshold" | "bands" | "counts";

// Focus (scope brief §3). School-keyed data: school | subject_area | custom_area | subject |
// my_subjects. Area-keyed data: around_school | la | region | national (combinations F7).
export type FocusKind =
  | "school"
  | "subject"
  | "subject_area"
  | "custom_area"
  | "my_subjects"
  | "around_school"
  | "la"
  | "region"
  | "national";

// What a view compares against. "No comparison" is the empty list.
//   subjects  other subjects in this school (category, all subjects, a chosen set)
//   schools   a set of other schools (10 nearest, a saved or ranking set)
//   averages  LA / region / England figures
export type CompareKind = "subjects" | "schools" | "averages";

// Honest number types (catalogue §3): counts get the first four, averages points /
// change_points, rates rate / change_pp. `rank` is a position, shown on tiles and rankings.
export type NumberType =
  | "totals"
  | "pct_change"
  | "market_share"
  | "index100"
  | "points"
  | "change_points"
  | "rate"
  | "change_pp"
  | "rank";

export type DateMode = "single" | "trend";
export type ViewType = "numerical" | "donut" | "graph" | "map" | "ranking" | "table";

// A row's Time (combinations F1): latest year, over time, or either (no filter).
export type RowTime = "latest" | "over_time" | "either";

export type Status = "draft" | "live" | "deprecated" | "retired";

export type Geography = "school" | "subject_area" | "set" | "la" | "region" | "england";

// Audience tags (catalogue §4.3).
export type AudienceTag = "subject-level" | "whole-school" | "academic" | "rolls" | "social" | "market" | "geography";

// ---------------------------------------------------------------------------------
// Layer 1: rules

export type RuleId = `R-${string}`;

export type RuleTestCase = {
  // A real school whose figure proves the rule is working.
  urn: string;
  school: string;
  phase?: Phase;
  subject?: string;
  year?: string;
  // What the check asserts, in words, and the expected value where there is one.
  expect: string;
  // The runner in scripts/catalogue-rule-tests.ts that checks it; absent = documented,
  // not yet automated (the runner lists these as "manual").
  check?: string;
};

export type Rule = {
  id: RuleId;
  statement: string;
  why: string;
  appliesTo: string;
  // Every enforcement point, file:symbol. Each carries the rule ID in a code comment.
  enforcedIn: string[];
  testCase: RuleTestCase | null;
  origin: string;
  status: "active" | "superseded";
  supersededBy?: RuleId;
  // S0's "must lift" mark: enforced only inside a component before 0.6. `lifted` records
  // S2's move into the data layer (and that it changed no figure).
  lift?: { from: string; to: string; lifted: boolean; note?: string };
  // Known conflicts the code still carries, for Guy (logged in OPEN_QUESTIONS.md).
  openIssue?: string;
  // Deliberate figure changes that resolved an openIssue (S3b on), newest last: what
  // changed, where, and the commit's before/after evidence.
  fixes?: string[];
};

// ---------------------------------------------------------------------------------
// Layer 2: measures

export type MeasureId = `M-${string}`;

export type GeographyAvailability = { ok: boolean; reason?: string };

export type Measure = {
  id: MeasureId;
  name: string;
  data: DataId;
  phase?: Phase;
  results?: ResultsMeasure;
  definition: string;
  grain: string;
  sources: string[];
  years: { from: string; to: string; note?: string };
  // Area-keyed or school-keyed (vicdata-production source_registry.entity_keying).
  keying: "urn" | "geography";
  geographies: Record<Geography, GeographyAvailability>;
  numberTypes: NumberType[];
  rules: RuleId[];
  fetchedBy: string[];
  knownGaps: string[];
  briefing?: string;
  // The citation the renderer attaches to every view of this measure (G7).
  citation: string;
};

// ---------------------------------------------------------------------------------
// Layer 3: renderers

export type RendererId = `RD-${string}`;

export type Renderer = {
  id: RendererId;
  component: string;
  file: string;
  accepts: string;
  states: { empty?: string; suppressed?: string; partial?: string; loading?: string };
  minHeight: string;
  fullscreen: string;
  phone: string;
};

// ---------------------------------------------------------------------------------
// Layer 4: dataviews

export type DataviewId = `DV-${string}`;

// Night 1 composes dataviews through the existing panel components ("wrap, don't
// rewrite"): each registered view names the column host and panel it is drawn by, and
// the rail entry that selects it.
export type HostId = "teacher.c1.candidates" | "teacher.c1.results" | "teacher.c1.counts" | "teacher.c2.context" | "teacher.c3.comparisons";

export type Dataview = {
  id: DataviewId;
  label: string;
  railIcon: string;
  measures: MeasureId[];
  supports: {
    data: DataId[];
    results?: ResultsMeasure[];
    phases: Phase[];
    focus: FocusKind[];
    // [] = does not compare. Matching uses the subset rule (combinations §2.3).
    compare: CompareKind[];
    numberType: NumberType[];
    dateMode: DateMode;
    viewType: ViewType;
  };
  params: string[];
  titleTemplate: string;
  titleFallback?: string;
  requires?: string;
  renderer: RendererId;
  host: { id: HostId; panel: "current" | "trend"; rail: string | null; file: string };
  audience: AudienceTag[];
  status: Status;
  verifiedAt: string[];
  origin: string;
  rules: RuleId[];
  // Reachable today? A registered view the live dashboard can never show is kept
  // (draft) so the catalogue is honest about it.
  note?: string;
};

// ---------------------------------------------------------------------------------
// The dashboard config (stored as JSON; scope brief §1)

export const CONFIG_SCHEMA_VERSION = 1 as const;

export type LayoutPreset = "1" | "2" | "3" | "4" | "2:1" | "1:2" | "1:1:2" | "custom";

export type OwnerScope = "vicdata" | "school" | "user";

export type CompareSpec = {
  kinds: CompareKind[];
  // Which set or group, resolved per school (G5: relative references).
  subjects?: "category" | "whole" | "selected" | "pill";
  schools?: "10-nearest" | "saved-or-chooser" | { savedSetId: string };
  averages?: ("la" | "region" | "england")[];
};

export type ColumnHeader = {
  id: string;
  title: string;
  // An icon key from DashboardColumn's COLUMN_ICON_PATHS.
  icon: "candidates" | "results" | "context" | "rankings";
  data: {
    data: DataId;
    // Per column (combinations A7); the dashboard only pre-fills it.
    phase: Phase;
    // Results only: a fixed sub-measure, or follow the dashboard's Results pill.
    results?: ResultsMeasure | "pill";
  };
  focus: { kind: FocusKind; subject?: { mode: "follow-chips" } | { mode: "always"; subject: string } };
  compare: CompareSpec | null;
  // Which registered column host draws this column's panels (night 1).
  host?: HostId;
  // The persistence key today's page uses for this column (open panels, notes).
  legacyColumnKey?: string;
};

export type RowConfig = {
  id: string;
  name: string;
  time: RowTime;
  openByDefault: boolean;
  // Today's PanelId for this row (current | trend).
  legacyPanelId?: "current" | "trend";
};

export type DataviewInstance =
  | {
      id: string;
      kind: "view";
      dataview: DataviewId;
      params?: Record<string, unknown>;
      title?: string;
    }
  | {
      // Super-admin's planned view (scope brief §4.6a): shown dashed, "Planned".
      id: string;
      kind: "placeholder";
      description: string;
      shape: ViewType;
      notes?: string;
    };

export type PanelOverride = {
  data?: ColumnHeader["data"];
  focus?: ColumnHeader["focus"];
  compare?: CompareSpec | null;
  // Shown on the badge: "overridden: LA, region, England".
  badge: string;
  // Why: combinations F2 and the like.
  reason: string;
};

export type PanelConfig = {
  id: string;
  row: string;
  column: string;
  // Whole panel units (scope brief §7.1).
  span?: { cols: 1 | 2 | 3 | 4; rows: 1 | 2 };
  name?: string;
  override?: PanelOverride;
  dataviews: DataviewInstance[];
  defaultView?: string;
  // Legacy keys this panel's notes and open state resolve through (audit §6.3).
  legacy?: { columnKey: string; panelId: "current" | "trend"; noteKeys: string[] };
};

// Reserved now, built night 2 (S7).
export type SlideConfig = {
  id: string;
  title: string;
  notes?: string;
  layout: "auto" | "1+text" | "2+text" | "3-across" | "3x2" | "2x2+1";
  // A slot holds one pinned view, or (S7) a text box: `view` absent and `text` set.
  slots: { id: string; view?: DataviewInstance & { pinned?: Record<string, unknown>; keepLive?: boolean }; text?: string }[];
};

export type DashboardConfig = {
  schema_version: typeof CONFIG_SCHEMA_VERSION;
  id: string;
  name: string;
  kind: "dashboard" | "presentation";
  owner: OwnerScope;
  colour: { key: Phase | "neutral"; override?: string };
  icon?: { source: "view" | "set" | "upload"; ref: string };
  group?: { id: string; label: string; order: number };
  layout: {
    preset: LayoutPreset;
    // Column track weights (1-4 tracks); equal by default.
    tracks: number[];
    // Per layout (D10): auto-close = one panel open per column, as today.
    accordion: "auto-close" | "independent";
  };
  columns: ColumnHeader[];
  rows: RowConfig[];
  panels: PanelConfig[];
  // Dashboard-wide controls carried from today's page (scope brief §5).
  features?: {
    subjectChips?: boolean;
    resultsPill?: boolean;
    alignmentSpacer?: boolean;
  };
  presentation?: { meetingDate?: string; slides: SlideConfig[] };
};
