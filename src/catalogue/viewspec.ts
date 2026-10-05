// VicData 0.6.1 S2: the ViewSpec -- one view's whole recipe, in the order the editor asks
// for it (docs/v0.6/vicdata_0_6_view_editor_rebuild_claude_code_prompt_v1.md, "The rule
// everything follows"):
//
//   data      1 · Data decides the numbers: what is measured, one value per year / subject /
//             grade / school, shown as actual / indexed / change, which years
//   compare   1 · Data too: what the numbers are compared with -- "follows-page" (D1a: the
//             members' own Compare against / Compared against settings keep working), or
//             the view's own lines and markers
//   view      2 · View decides only how they are drawn (a View choice never changes a figure)
//   resultsMeasures, variants, icon, title   3 · Preview
//   preset    the dataview the spec was translated from (D10: carryUserState keys on it)
//
// S2 adds the model and the presets only: every dataview in dataviews.ts translated, one
// preset each, in docs/v0.6/views_preset_table.md (its table is generated from here by
// scripts/views-preset-table.ts, and a unit test keeps the two in step). Members' pages
// still draw through the hosts; the config-driven renderer that reads a spec is S3's.
//
// Fields beyond the prompt's S2 shape are marked [ext] and logged in the table doc.
import { DATAVIEWS } from "./dataviews";
import { CONFIG_SCHEMA_VERSION, type DashboardConfig, type DataId, type Dataview, type DataviewId, type DataviewInstance, type ResultsMeasure, type VariantSets } from "./types";

// ---------------------------------------------------------------------------------- data

export type ViewPer = "year" | "subject" | "grade" | "school";
export type ViewShownAs = "actual" | "indexed" | "change";

// Which subject the figures are for. "follows" = the dashboard's subject chips (the focused
// subject). [ext] "follows-or-whole-school": the focused subject, or the phase headline
// (Attainment 8 / A level points per entry) with no subject chip -- Comparisons' rule.
// [ext] "whole-school": always the phase headline -- Comparisons' ranking tiles.
export type ViewSubject = "follows" | "follows-or-whole-school" | "whole-school" | { fixed: string };

// Which rows (subjects or schools) are drawn, each its own line / bar / row. Absent = the
// focused subject (or school) alone, with whatever `compare` adds. "follows-page" = the
// page's own control: Context's Compare against pill (category / all / selected subjects) or
// Comparisons' Compared against set.
export type ViewRows = "follows-page" | "category" | "all" | "selected" | "nearest" | { savedSet: string };

export type ViewYears =
  // [ext] memberPick: the members' own year control (Context's year menu, the Trends "From"
  // menu, Grade counts' compare-year menu) moves the span; the spec is where it starts.
  | { latest: true; memberPick?: boolean }
  // `from`: "first" = the first year with a figure (today's Trends default); rollOn = the
  // latest end moves on when a new year lands.
  | { from: "first" | number; rollOn: boolean; memberPick?: boolean };

export type ViewData = {
  // [ext] "follows-page": the dashboard's own Candidates / Results (Context and Comparisons
  // draw on both). Results figures are on the page's Results measure (the pill) and band
  // range, as today.
  source: DataId | "follows-page";
  // [ext] which entries a count reads: every entry (default) or points-eligible entries only
  // (the LA / region / England figures count those, R-GEO-POINTS-ELIGIBLE).
  entries?: "all" | "points-eligible";
  subject: ViewSubject;
  per: ViewPer;
  rows?: ViewRows;
  shownAs: ViewShownAs;
  // [ext] which change: "honest" (default, R-NUMBER-TYPE-HONESTY: % on a count, points or
  // percentage points on a mean or a rate) or "absolute" (the plain difference on every
  // measure -- Comparisons' Trend map).
  change?: "honest" | "absolute";
  years: ViewYears;
};

// --------------------------------------------------------------------------------- compare

export type CompareSeriesKind =
  | "self"
  | "category"
  | "allSubjects"
  | "selectedSubjects"
  | "la"
  | "region"
  | "england"
  | "nearest"
  | "savedSet"
  | "chosenSchool"
  | "otherSubject";

export type CompareSeries = {
  kind: CompareSeriesKind;
  // A theme token ("accent", "muted", "england", "palette") or a hex.
  colour: string;
  // An average of things NOT drawn (one drawn as a line or marker). An average of what IS
  // drawn is a look option (bars, grade spread).
  average?: "mean" | "median" | "weighted";
  // [ext] how it is drawn: its own line (default), a marker on each row (England on the
  // bars), a dashed reference line across ranked bars, or its own table row.
  as?: "line" | "marker" | "reference" | "row";
  // [ext] the same series at an earlier year (Grade counts' Spread by year).
  at?: "earlier-year";
};

export type ViewCompare = "follows-page" | CompareSeries[];

// ------------------------------------------------------------------------------------ view

export type ViewKind = "line" | "bar" | "table" | "ranking" | "numbers" | "spread" | "slope" | "donut" | "map";

export type LineLook = {
  // The straight line of best fit: true / false, or "member" -- members' own Trend line
  // toggle, off until they switch it on (today's).
  trendLine?: boolean | "member";
  endLabels?: boolean;
  fromZero?: boolean;
  // [ext] R-TREND-LINE-4YR: what draws while the span has fewer than 4 real years -- ranked
  // change bars in the measure's own units (MultiTrend), or the table alone (Comparisons).
  shortSpan?: "change-bars" | "table";
  // [ext] the fullscreen rail's show/hide list of lines.
  memberLegend?: boolean;
  // [ext] Context on All subjects: the card draws the focused subject against the group
  // average only; fullscreen draws every line.
  cardFocusVsAverage?: "on-all-subjects";
};

export type BarLook = {
  // [ext] horizontal rows (ViewChart, ChangeList) or vertical columns (VerticalBars).
  orientation?: "horizontal" | "vertical";
  order?: "highest" | "az" | "above-comparison";
  // A line across the bars shown: an average of what is drawn.
  average?: "none" | "mean" | "median" | "weighted";
  top10?: boolean;
  highlight?: boolean;
  values?: boolean;
  // [ext] ViewChart's roomier rows (Results' Current).
  spacious?: boolean;
  // [ext] bars that grow either way from zero (a change).
  diverging?: boolean;
};

export type TableLook = {
  // "first-latest": the first and latest years on the card, every year in fullscreen.
  yearColumns?: "first-latest" | "every" | "latest";
  // [ext] "vs-comparison": the third column against the comparison (England, the group
  // average), falling back to the subject's own previous year (R-PREV-YEAR-FALLBACK).
  extra?: ("change" | "rank" | "n" | "vs-comparison")[];
  sort?: "listed" | "latest" | "change" | "vs-comparison";
  highlight?: boolean;
  colourChange?: boolean;
  memberSort?: boolean;
  // [ext] a bare rank first, the rank order fixed (the change tables, Context's table).
  leadingRank?: boolean;
  // [ext] false = no value column (Context's table: rank and "vs average" only).
  value?: boolean;
  // [ext] which half of a count's Change cell leads (the geography table: the %).
  changeLeads?: "value" | "percent";
};

export type RankingLook = {
  columns?: ("rank" | "sector" | "value" | "change" | "distance" | "n" | "bar")[];
  show?: "top5" | "all" | "around";
  alwaysSelf?: boolean;
};

// The figures themselves stay in the instance's params (round 3's NumberTilesParams), as
// today; unset = the host's own tiles.
export type NumbersLook = Record<string, never>;

export type SpreadLook = {
  show?: "percent" | "counts";
  average?: "none" | "mean" | "median";
  bands?: "none" | "follows-page" | { top: string; bottom: string };
  values?: boolean;
  // [ext] members click two grades to highlight a span (Grade counts' Current); or the
  // page's band range, shaded ("page-range": Results' Grade distribution on Grade bands --
  // since 0.6.1 S5 (D3) picked in the top bar, no longer by clicking grades here).
  memberSpan?: "highlight" | "page-range";
};

export type SlopeLook = Record<string, never>;
export type DonutLook = Record<string, never>;

export type MapLook = {
  // "value": coloured by the figure; "change": by the change over the span (the scale follows
  // the change kind); "member": the map's own Grade band / Trends toggle.
  colour: "value" | "change" | "member";
};

export type ViewView =
  | { kind: "line"; look: LineLook }
  | { kind: "bar"; look: BarLook }
  | { kind: "table"; look: TableLook }
  | { kind: "ranking"; look: RankingLook }
  | { kind: "numbers"; look: NumbersLook }
  | { kind: "spread"; look: SpreadLook }
  | { kind: "slope"; look: SlopeLook }
  | { kind: "donut"; look: DonutLook }
  | { kind: "map"; look: MapLook };

// ------------------------------------------------------------------------------- the spec

export type ViewSpec = {
  data: ViewData;
  compare: ViewCompare;
  view: ViewView;
  // The Results measures the view is offered on, and the most it can be drawn on (round 3's
  // Dataview.resultsMeasures). Absent = all four (or not a Results view). An instance still
  // narrows it with its own resultsMeasures, as before.
  resultsMeasures?: ResultsMeasure[];
  // [ext] the same for the other page axes (round 4's Dataview.variants).
  variants?: VariantSets;
  // A PanelIcons glyph name (the rail icon).
  icon: string;
  // The title template, placeholders allowed ("[subject] against the wider system").
  title: string;
  // The dataview this spec was translated from (D10).
  preset?: DataviewId;
};

// ------------------------------------------------------------------------------ presets

const LATEST: ViewYears = { latest: true };
const LATEST_PICK: ViewYears = { latest: true, memberPick: true };
const TRENDS: ViewYears = { from: "first", rollOn: true, memberPick: true };

type Body = Pick<ViewSpec, "data" | "view">;

const line = (look: LineLook): ViewView => ({ kind: "line", look });
const bar = (look: BarLook): ViewView => ({ kind: "bar", look });
const table = (look: TableLook): ViewView => ({ kind: "table", look });

// Shared looks, as the hosts draw them today.
const MULTI_TREND: LineLook = { trendLine: "member", shortSpan: "change-bars" };
const YEAR_TABLE: TableLook = { yearColumns: "first-latest", extra: ["change"], sort: "latest", highlight: true, colourChange: true, memberSort: true };
const CHANGE_TABLE: TableLook = { yearColumns: "first-latest", extra: ["change"], sort: "change", highlight: true, colourChange: true, leadingRank: true };
const CHANGE_BARS: BarLook = { orientation: "horizontal", order: "highest", highlight: true, values: true, diverging: true };
const GEO_TABLE: TableLook = { yearColumns: "first-latest", extra: ["change"], sort: "listed", highlight: true, colourChange: true, memberSort: true };

const C1 = (source: DataId, per: ViewPer, shownAs: ViewShownAs, years: ViewYears, view: ViewView, rows: ViewRows | null = "category"): Body => ({
  data: { source, subject: "follows", per, ...(rows ? { rows } : {}), shownAs, years },
  view,
});
const C2 = (source: ViewData["source"], per: ViewPer, shownAs: ViewShownAs, years: ViewYears, view: ViewView): Body => ({
  data: { source, subject: "follows", per, rows: "follows-page", shownAs, years },
  view,
});
const C3 = (per: ViewPer, shownAs: ViewShownAs, years: ViewYears, view: ViewView, rows: ViewRows | null = "follows-page", extra: Partial<ViewData> = {}): Body => ({
  data: { source: "follows-page", subject: "follows-or-whole-school", per, ...(rows ? { rows } : {}), shownAs, years, ...extra },
  view,
});

// Every dataview's data and view, translated (docs/v0.6/views_preset_table.md says why each
// is what it is). compare, resultsMeasures, variants, icon and title come from the dataview.
const BODIES: Record<string, Body> = {
  // ------------------------------------------------ Column 1, Candidates (CandidatesPanels)
  "DV-C1-CAND-CUR-TILES": C1("academic.candidates", "subject", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-C1-CAND-TR-INDEXED": C1("academic.candidates", "year", "indexed", TRENDS, line(MULTI_TREND)),
  "DV-C1-CAND-TR-ACTUAL": C1("academic.candidates", "year", "actual", TRENDS, line(MULTI_TREND)),
  "DV-C1-CAND-TR-TABLE": C1("academic.candidates", "year", "actual", TRENDS, table(YEAR_TABLE)),
  "DV-C1-CAND-TR-GEO-CHART": {
    data: { source: "academic.candidates", entries: "points-eligible", subject: "follows", per: "year", shownAs: "indexed", years: TRENDS },
    view: line({}),
  },
  "DV-C1-CAND-TR-GEO-TABLE": {
    data: { source: "academic.candidates", entries: "points-eligible", subject: "follows", per: "year", shownAs: "actual", years: TRENDS },
    view: table({ ...GEO_TABLE, changeLeads: "percent" }),
  },
  "DV-C1-CAND-TR-CHANGELIST": C1("academic.candidates", "subject", "change", TRENDS, bar(CHANGE_BARS)),
  "DV-C1-CAND-TR-CHANGETABLE": C1("academic.candidates", "year", "actual", TRENDS, table(YEAR_TABLE)),

  // ------------------------------------- Column 1, Results on points / threshold / bands
  "DV-C1-RES-CUR-TILES": C1("academic.results", "subject", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-C1-RES-CUR-GRADES": C1("academic.results", "grade", "actual", LATEST, { kind: "spread", look: { show: "percent", bands: "follows-page", memberSpan: "page-range" } }, null),
  "DV-C1-RES-CUR-BAR": C1("academic.results", "subject", "actual", LATEST, bar({ orientation: "horizontal", order: "highest", highlight: true, values: true, spacious: true })),
  "DV-C1-RES-CUR-TABLE": C1("academic.results", "subject", "actual", LATEST, table({ yearColumns: "latest", extra: ["vs-comparison"], sort: "vs-comparison", highlight: true, colourChange: true, memberSort: true })),
  "DV-C1-RES-TR-CHART": C1("academic.results", "year", "actual", TRENDS, line({ ...MULTI_TREND, memberLegend: true })),
  "DV-C1-RES-TR-TABLE": C1("academic.results", "year", "actual", TRENDS, table(YEAR_TABLE)),
  "DV-C1-RES-TR-MAP": C1("academic.results", "school", "actual", LATEST, { kind: "map", look: { colour: "member" } }, "follows-page"),
  "DV-C1-RES-TR-GEO-CHART": C1("academic.results", "year", "actual", TRENDS, line({}), null),
  "DV-C1-RES-TR-GEO-TABLE": C1("academic.results", "year", "actual", TRENDS, table(GEO_TABLE), null),

  // --------------------------------------------- Column 1, Results on Grade counts
  "DV-C1-CNT-CUR-DIST": C1("academic.results", "grade", "actual", LATEST, { kind: "spread", look: { show: "percent", bands: "none", memberSpan: "highlight" } }, null),
  "DV-C1-CNT-TR-SPREAD": C1("academic.results", "grade", "actual", LATEST_PICK, { kind: "spread", look: { show: "percent", bands: "none" } }, null),
  "DV-C1-CNT-TR-CHANGETABLE": C1("academic.results", "grade", "actual", TRENDS, table({ yearColumns: "first-latest", extra: ["change"], sort: "listed", colourChange: true, memberSort: true }), null),

  // ------------------------------------------------------------- Column 2, Context
  "DV-C2-CUR-DONUT": C2("follows-page", "subject", "actual", LATEST_PICK, { kind: "donut", look: {} }),
  "DV-C2-CUR-BARS": C2("follows-page", "subject", "actual", LATEST_PICK, bar({ orientation: "vertical", order: "highest", highlight: true, values: true })),
  "DV-C2-CUR-LIST": C2("follows-page", "subject", "actual", LATEST_PICK, { kind: "ranking", look: { columns: ["rank", "value"], show: "all", alwaysSelf: true } }),
  "DV-C2-CUR-TABLE": C2("follows-page", "subject", "actual", LATEST_PICK, table({ yearColumns: "latest", extra: ["vs-comparison"], sort: "latest", highlight: true, colourChange: true, memberSort: true, leadingRank: true, value: false })),
  "DV-C2-TR-INDEXED": C2("academic.candidates", "year", "indexed", TRENDS, line({ ...MULTI_TREND, memberLegend: true, cardFocusVsAverage: "on-all-subjects" })),
  "DV-C2-TR-CHART": C2("academic.results", "year", "actual", TRENDS, line({ ...MULTI_TREND, memberLegend: true, cardFocusVsAverage: "on-all-subjects" })),
  "DV-C2-TR-ACTUAL": C2("academic.candidates", "year", "actual", TRENDS, line({ ...MULTI_TREND, memberLegend: true, cardFocusVsAverage: "on-all-subjects" })),
  "DV-C2-TR-TABLE": C2("follows-page", "year", "actual", TRENDS, table(YEAR_TABLE)),
  "DV-C2-TR-CHANGELIST": C2("follows-page", "subject", "change", TRENDS, bar(CHANGE_BARS)),
  "DV-C2-TR-CHANGETABLE": C2("follows-page", "year", "actual", TRENDS, table(CHANGE_TABLE)),

  // --------------------------------------------------------- Column 3, Comparisons
  "DV-C3-CUR-TILES": {
    data: { source: "follows-page", subject: "whole-school", per: "school", rows: "follows-page", shownAs: "actual", years: LATEST },
    view: { kind: "numbers", look: {} },
  },
  "DV-C3-CUR-MAP": C3("school", "actual", LATEST, { kind: "map", look: { colour: "value" } }),
  "DV-C3-CUR-BAR": C3("school", "actual", LATEST, bar({ orientation: "horizontal", order: "highest", highlight: true, values: true })),
  "DV-C3-CUR-RANKING": C3("school", "actual", LATEST, { kind: "ranking", look: { columns: ["rank", "sector", "value", "distance"], show: "all", alwaysSelf: true } }),
  "DV-C3-TR-CHART": C3("year", "actual", TRENDS, line({ trendLine: "member", shortSpan: "table" }), null),
  "DV-C3-TR-TABLE": C3("year", "actual", TRENDS, table(YEAR_TABLE)),
  "DV-C3-TR-MAP": C3("school", "change", TRENDS, { kind: "map", look: { colour: "change" } }, "follows-page", { change: "absolute" }),
  "DV-C3-TR-CHANGELIST": C3("school", "change", TRENDS, bar(CHANGE_BARS)),
  "DV-C3-TR-CHANGETABLE": C3("year", "actual", TRENDS, table(CHANGE_TABLE)),
  "DV-C3-TR-CHANGEMAP": C3("school", "change", TRENDS, { kind: "map", look: { colour: "change" } }),
};

function presetFrom(dv: Dataview): ViewSpec {
  const body = BODIES[dv.id];
  if (!body) throw new Error(`viewspec: no preset for ${dv.id}`);
  return {
    data: body.data,
    // D1a: every translated preset follows the page.
    compare: "follows-page",
    view: body.view,
    ...(dv.resultsMeasures ? { resultsMeasures: [...dv.resultsMeasures] } : {}),
    ...(dv.variants ? { variants: structuredClone(dv.variants) } : {}),
    icon: dv.railIcon,
    title: dv.titleTemplate,
    preset: dv.id,
  };
}

// One preset per dataview, in the catalogue's order.
export const VIEW_PRESETS: ReadonlyMap<DataviewId, ViewSpec> = new Map(DATAVIEWS.map((dv) => [dv.id, presetFrom(dv)]));
export const PRESET_IDS: DataviewId[] = [...VIEW_PRESETS.keys()];

// A fresh copy of a dataview's preset (a config owns its spec). Throws for an unknown id.
export function presetSpec(dataview: DataviewId): ViewSpec {
  const spec = VIEW_PRESETS.get(dataview);
  if (!spec) throw new Error(`viewspec: unknown dataview ${dataview}`);
  return structuredClone(spec);
}

// --------------------------------------------------------------------- instances (S2, D10)

type ViewInstance = Extract<DataviewInstance, { kind: "view" }>;

// A new view instance of a dataview, carrying its preset's spec. Every place that makes an
// instance goes through here (or retarget), so `spec.preset` always equals `dataview`.
export function viewInstance(id: string, dataview: DataviewId, rest: Omit<ViewInstance, "id" | "kind" | "dataview" | "spec"> = {}): ViewInstance {
  return { id, kind: "view", dataview, ...rest, spec: presetSpec(dataview) };
}

// The same instance pointed at another dataview (an editor swap): its spec follows.
export function retarget<T extends ViewInstance>(v: T, dataview: DataviewId): T {
  return { ...v, dataview, spec: presetSpec(dataview) };
}

// The preset an instance was made from: its spec's, else (a v1 instance read raw, before
// upgradeConfig) its dataview.
export function presetOf(v: DataviewInstance): string {
  return v.kind === "view" ? (v.spec?.preset ?? v.dataview) : v.id;
}

// ------------------------------------------------------------------------- reading v1

// A stored config as it may come back from the store: the current shape, or a schema_version
// 1 config (meetings and custom dashboards saved before 0.6.1), whose view instances have no
// spec.
export type StoredConfig = Omit<DashboardConfig, "schema_version"> & { schema_version: number };

const withSpec = <T extends DataviewInstance>(v: T): T => {
  if (v.kind !== "view" || (v.spec && v.spec.preset === v.dataview)) return v;
  // An id the catalogue doesn't know keeps no spec; validateConfig reports the dataview.
  return VIEW_PRESETS.has(v.dataview) ? { ...v, spec: presetSpec(v.dataview) } : v;
};

// 0.6.1 S2: convert a schema_version 1 config on read (meetings, custom dashboards): every
// view instance -- panels' and slide slots' -- gains its preset's spec, and nothing else
// changes (ids, params, titles, per-instance resultsMeasures / variants, defaults, text
// slots, pins). A current config comes back as it is. VicData's own dashboards are NOT read
// through here on members' pages (D9: published-vicdata.ts draws the code copy instead).
export function upgradeConfig(stored: StoredConfig | DashboardConfig): DashboardConfig {
  if (stored.schema_version === CONFIG_SCHEMA_VERSION && stored.panels.every((p) => p.dataviews.every((v) => v.kind !== "view" || v.spec))) return stored as DashboardConfig;
  if (stored.schema_version > CONFIG_SCHEMA_VERSION || !Array.isArray(stored.panels)) return stored as DashboardConfig;
  return {
    ...stored,
    schema_version: CONFIG_SCHEMA_VERSION,
    panels: stored.panels.map((p) => ({ ...p, dataviews: p.dataviews.map(withSpec) })),
    ...(stored.presentation
      ? { presentation: { ...stored.presentation, slides: stored.presentation.slides.map((s) => ({ ...s, slots: s.slots.map((slot) => (slot.view ? { ...slot, view: withSpec(slot.view) } : slot)) })) } }
      : {}),
  };
}
