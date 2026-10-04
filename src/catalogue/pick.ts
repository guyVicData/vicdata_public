// VicData 0.6 S4: the "Add a view" chooser's pure helpers (scope brief §3; combinations doc
// §1-4). The chooser itself is src/components/chooser-v06/AddViewChooser.tsx; the editor
// (S5) and meetings (S7) open it with a PickPanelContext built by `contextFromPanel`.
//
// Everything here is a structural filter over the registry, never a data check (F9): what
// a chooser step offers is decided by which registered dataviews exist, not by this school.
import { dataviewResults } from "./results";
import { changeKind, changeOfMeasure, changeWord } from "./titles";
import { DATAVIEWS, MEASURES } from "./index";
import { compareMatches, matchDataviews, placements, whyNot, type PickContext, type PickResult } from "./matching";
import { DASHBOARDS } from "./dashboards";
import type {
  ColumnHeader,
  CompareKind,
  CompareSpec,
  DashboardConfig,
  DataId,
  Dataview,
  DataviewInstance,
  FocusKind,
  Measure,
  NumberTilesParams,
  NumberType,
  PanelConfig,
  PanelOverride,
  Phase,
  ResultsMeasure,
  RowTime,
  ViewType,
} from "./types";

// ---------------------------------------------------------------------------------
// The context a panel hands the chooser: column + row + override, resolved for display.

export type AverageId = "la" | "region" | "england";

export type PickPanelContext = {
  data: DataId;
  phase: Phase;
  // Results only: the resolved sub-measure (a column that follows the Results pill passes
  // the pill's current value).
  results?: ResultsMeasure;
  focus: {
    kind: FocusKind;
    // Subject focus (F10): follow the dashboard's subject chips, or always one subject.
    subject?: { mode: "follow-chips" | "always"; label: string | null; key?: string };
    // Custom area focus (2b): the subjects grouped together.
    area?: { name: string; subjects: string[] };
  };
  compare: {
    // [] = no comparison.
    kinds: CompareKind[];
    subjects?: { scope: "category" | "whole" | "selected" | "pill" | "my_subjects"; label: string };
    schools?: { spec: NonNullable<CompareSpec["schools"]>; label: string; choice?: unknown };
    averages?: AverageId[];
  };
  // The row's Time (F1).
  time: RowTime;
  // Display strings: header line, summary, title placeholders.
  labels: {
    dashboard: string;
    column: string;
    row: string;
    school?: string;
    // The focused subject's category ("Sciences & Maths").
    category?: string;
    la?: string;
    region?: string;
  };
  // Where the panel is, for the editor (and familiar-first's "this position").
  source?: { dashboardId: string; columnId: string; rowId: string; panelId?: string };
  // The panel's existing override, if any (already folded into the fields above).
  override?: PanelOverride;
};

// A PanelOverride that can also carry the row Time a relaxation changed ("Over time
// instead"). Structurally a PanelOverride; `time` is an additive field the editor keeps.
export type PickOverride = PanelOverride & { time?: RowTime };

// Super-admin's "Add a placeholder" (scope brief §4.6a): the exact context is saved.
export type PlaceholderRequest = { description: string; shape: ViewType | null; notes: string; context: PickPanelContext };

// What "Ask for this view" logs (view_requests.context holds `context`).
export type ViewRequest = { description: string; context: PickPanelContext };

// What Customise adds as the instance's params.
export type CustomViewParams = {
  numberType: NumberType;
  fromYear: string | null;
  look: ViewType;
  title: string;
  rollForward: boolean;
} & NumberTilesParams;

// ---------------------------------------------------------------------------------
// Vocabulary

export const DATA_LABEL: Record<DataId, string> = {
  "academic.candidates": "Candidates",
  "academic.results": "Results",
  rolls: "Rolls",
  "social.births": "Live births",
};

export const PHASE_LABEL: Record<Phase, string> = { ks4: "GCSE", ks5: "Post-16" };

// One term, "points" (catalogue §3, decided 3 Oct): the switcher's "Average point score"
// is "Average points" here.
export function resultsLabel(r: ResultsMeasure, phase: Phase): string {
  if (r === "points") return "Average points";
  if (r === "threshold") return phase === "ks5" ? "A*–E rate" : "Grade 4+ rate";
  if (r === "bands") return "Grade bands";
  return "Grade counts";
}

export function measureLabel(ctx: Pick<PickPanelContext, "data" | "phase" | "results">): string {
  if (ctx.data === "academic.results") return resultsLabel(ctx.results ?? "points", ctx.phase);
  return DATA_LABEL[ctx.data];
}

export const VIEW_TYPE_LABEL: Record<ViewType, string> = {
  numerical: "Numerical",
  donut: "Donut",
  graph: "Graph",
  map: "Map",
  ranking: "Ranking",
  table: "Table",
};

// Look's chips, in the board's order (Ch3Adjust).
export const LOOK_ORDER: ViewType[] = ["graph", "ranking", "map", "table", "donut", "numerical"];

export const NUMBER_TYPE_LABEL: Record<NumberType, string> = {
  totals: "Totals",
  pct_change: "% change",
  market_share: "Market share",
  index100: "Indexed",
  points: "Points",
  change_points: "Change in points",
  rate: "Rate",
  change_pp: "Change in percentage points",
  rank: "Rank",
};

const COUNT_TYPES: NumberType[] = ["totals", "pct_change", "market_share", "index100"];
const AVERAGE_TYPES: NumberType[] = ["points", "change_points"];
const RATE_TYPES: NumberType[] = ["rate", "change_pp"];

export type MeasureKind = "counts" | "averages" | "rates";

export function measureKind(ctx: Pick<PickPanelContext, "data" | "results">): MeasureKind {
  if (ctx.data !== "academic.results") return "counts";
  if (ctx.results === "threshold" || ctx.results === "bands") return "rates";
  if (ctx.results === "counts") return "counts";
  return "averages";
}

export const FOCUS_LABEL: Record<FocusKind, string> = {
  school: "Whole school",
  subject: "One subject",
  subject_area: "Subject area",
  custom_area: "Custom area",
  my_subjects: "My subjects",
  around_school: "Around the school",
  la: "LA",
  region: "Region",
  national: "England",
};

// Block 1's chips (F7): school-keyed data focuses inside the school, area-keyed data on an
// area. Academic data never has a beyond-school focus (A6).
export const SCHOOL_FOCUS: FocusKind[] = ["school", "subject_area", "subject", "my_subjects", "custom_area"];
export const AREA_FOCUS: FocusKind[] = ["around_school", "la", "region", "national"];

export const AVERAGE_LABEL: Record<AverageId, string> = { la: "LA", region: "Region", england: "England" };

// ---------------------------------------------------------------------------------
// Measures and years

// The measure card behind a context: the per-subject measure, or the whole-school headline
// for a school-focused Results context.
export function measureFor(ctx: Pick<PickPanelContext, "data" | "phase" | "results" | "focus">): Measure | undefined {
  const list = MEASURES.filter((m) => m.data === ctx.data && (m.phase === undefined || m.phase === ctx.phase));
  if (ctx.data !== "academic.results") return list[0];
  const r = ctx.results ?? "points";
  const headline = ctx.focus.kind === "school" && r === "points" ? list.find((m) => m.id.endsWith("-HEADLINE")) : undefined;
  return headline ?? list.find((m) => m.results === r && !m.id.endsWith("-HEADLINE"));
}

export function isAreaKeyed(ctx: Pick<PickPanelContext, "data" | "phase" | "results" | "focus">): boolean {
  return measureFor(ctx)?.keying === "geography";
}

// "2021/22" .. "2024/25" (academic) or "2019" .. "2025" (calendar).
export function yearsOf(measure: Measure | undefined): string[] {
  if (!measure) return [];
  const academic = /^(\d{4})\/(\d{2})$/;
  const a = measure.years.from.match(academic);
  const b = measure.years.to.match(academic);
  if (a && b) {
    const out: string[] = [];
    for (let y = +a[1]; y <= +b[1]; y++) out.push(`${y}/${String((y + 1) % 100).padStart(2, "0")}`);
    return out;
  }
  const from = parseInt(measure.years.from, 10);
  const to = parseInt(measure.years.to, 10);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [measure.years.to];
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

// Trends start where the measure's honest series starts: KS4/KS5 points were 0 in 2020/21
// (teacher-assessed), which the measure cards already encode as their `from`.
export function defaultFromYear(ctx: PickPanelContext): string | null {
  return yearsOf(measureFor(ctx))[0] ?? null;
}

export function latestYear(ctx: PickPanelContext): string | null {
  const ys = yearsOf(measureFor(ctx));
  return ys[ys.length - 1] ?? null;
}

// ---------------------------------------------------------------------------------
// Matching

export function toPickContext(ctx: PickPanelContext, opts: { palette?: DataId[]; superAdmin?: boolean } = {}): PickContext {
  return {
    data: ctx.data,
    phase: ctx.phase,
    results: ctx.data === "academic.results" ? (ctx.results ?? "points") : undefined,
    focus: ctx.focus.kind,
    compare: ctx.compare.kinds,
    time: ctx.time,
    palette: opts.palette,
    superAdmin: opts.superAdmin,
  };
}

// 0.6 snag 3 / 03: on a Results pill state, the views drawn on it (dataviewResults) come
// first; otherwise the matching order (tier, then rail order) is kept.
export function pickResults(ctx: PickPanelContext, opts: { palette?: DataId[]; superAdmin?: boolean } = {}): PickResult[] {
  const out = matchDataviews(DATAVIEWS, toPickContext(ctx, opts), DASHBOARDS);
  const m = ctx.data === "academic.results" ? ctx.results : undefined;
  if (!m) return out;
  const draws = (r: PickResult) => (dataviewResults(r.dataview).includes(m) ? 0 : 1);
  return out.map((r, i) => ({ r, i })).sort((a, b) => draws(a.r) - draws(b.r) || a.i - b.i).map((x) => x.r);
}

// How many registered views a partial context leads to, ignoring the dimensions not yet
// chosen. Steps 1-2 offer an option only when this is > 0 (scope brief §3's pruning rule).
export function countViews(
  partial: { data: DataId; phase?: Phase; results?: ResultsMeasure; focus?: FocusKind; compareHas?: CompareKind; compare?: CompareKind[] },
  superAdmin: boolean,
): number {
  return DATAVIEWS.filter((dv) => {
    if (dv.status !== "live" && !(dv.status === "draft" && superAdmin)) return false;
    const s = dv.supports;
    if (!s.data.includes(partial.data)) return false;
    if (partial.phase && !s.phases.includes(partial.phase)) return false;
    if (partial.data === "academic.results" && partial.results && s.results && !s.results.includes(partial.results)) return false;
    if (partial.focus && !s.focus.includes(partial.focus)) return false;
    if (partial.compareHas && !s.compare.includes(partial.compareHas)) return false;
    if (partial.compare && !compareMatches(s.compare, partial.compare)) return false;
    return true;
  }).length;
}

// The candidate views Customise can move between: everything matching the context in
// either time mode (Years switches between them).
export function customiseCandidates(ctx: PickPanelContext, opts: { palette?: DataId[]; superAdmin?: boolean } = {}): Dataview[] {
  return pickResults({ ...ctx, time: "either" }, opts).map((r) => r.dataview);
}

// Numbers (catalogue §3): the measure kind's own honest types first; for averages and
// rates, the count-only four follow, dotted. A type is enabled when the measure declares it
// honest AND a matching view offers it.
export function numbersOptions(ctx: PickPanelContext, candidates: Dataview[]): { type: NumberType; enabled: boolean }[] {
  const kind = measureKind(ctx);
  const honest = new Set(measureFor(ctx)?.numberTypes ?? []);
  const own = kind === "counts" ? COUNT_TYPES : kind === "averages" ? AVERAGE_TYPES : RATE_TYPES;
  const shown = kind === "counts" ? own : [...own, ...COUNT_TYPES];
  return shown.map((type) => ({ type, enabled: honest.has(type) && candidates.some((dv) => dv.supports.numberType.includes(type)) }));
}

// A view's honest number types under this context, in its own order.
export function honestTypesOf(dv: Dataview, ctx: PickPanelContext): NumberType[] {
  const honest = new Set(measureFor(ctx)?.numberTypes ?? []);
  return dv.supports.numberType.filter((t) => honest.has(t) && t !== "rank");
}

// ---------------------------------------------------------------------------------
// Titles and card lines

export const TITLE_PLACEHOLDERS = ["[subject]", "[category]", "[comparison-group]", "[comparison-set]", "[school]", "[measure]", "[year]", "[from-year]"] as const;

// Fill a dataview's titleTemplate from the context. Placeholders the context can't fill
// fall back to plain words, never to a bracketed token.
// `latest` (0.6 snag 4 / 01): the real latest year where the caller knows it (a live page);
// otherwise the measure card's.
export function resolveTitle(template: string, dv: Dataview | null, ctx: PickPanelContext, opts: { fromYear?: string | null; latest?: string | null } = {}): string {
  const from = opts.fromYear ?? defaultFromYear(ctx) ?? "the first year";
  const latest = opts.latest ?? latestYear(ctx) ?? "the latest year";
  const trend = dv ? dv.supports.dateMode === "trend" : ctx.time === "over_time";
  const subject = ctx.focus.kind === "subject" ? (ctx.focus.subject?.label ?? "This subject") : ctx.focus.kind === "custom_area" ? (ctx.focus.area?.name ?? "This area") : ctx.focus.kind === "school" ? (ctx.labels.school ?? "This school") : FOCUS_LABEL[ctx.focus.kind];
  const set = ctx.compare.schools?.label ?? "comparator schools";
  const group = ctx.compare.subjects?.label ?? ctx.labels.category ?? "its category";
  const fill = (token: string): string => {
    switch (token) {
      case "subject":
        return subject;
      case "category":
        return ctx.labels.category ?? "its category";
      case "comparison-group":
        return group;
      case "set":
      case "comparison-set":
      case "versus":
        return set;
      case "school":
        return ctx.labels.school ?? "This school";
      case "measure":
        return measureLabel(ctx).toLowerCase().replace(/^grade/, "Grade");
      case "year":
        return trend ? from : latest;
      case "from-year":
        return from;
      case "compare year":
      case "change year":
        return latest;
      case "change-word":
        return changeWord(changeKind(ctx.data, ctx.results));
      case "change-of-measure":
        return changeOfMeasure(changeKind(ctx.data, ctx.results), measureLabel(ctx).toLowerCase().replace(/^grade/, "Grade"));
      case "Entries|Results":
        return ctx.data === "academic.candidates" ? "Entries" : ctx.data === "academic.results" ? "Results" : DATA_LABEL[ctx.data];
      default:
        return token;
    }
  };
  const out = template.replace(/\[([^\]]+)\]/g, (_, t: string) => fill(t));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// A dataview's title under this context; registered views without a template read
// "{label}: {subject}".
export function viewTitle(dv: Dataview, ctx: PickPanelContext): string {
  return resolveTitle(titleTemplateOf(dv), dv, ctx);
}

// The template Customise's Title box starts from (and viewTitle resolves).
export function titleTemplateOf(dv: Dataview): string {
  return dv.titleTemplate || `[subject]: ${dv.label.toLowerCase()}`;
}

// 0.6 snag 4 / 01: a view instance's own title -- Customise's Title, placeholders and all
// (`params.title`, which Customise also writes as the instance's `title`) -- when it differs
// from its dataview's template. null = no override: the host draws its own title, with its
// own fallbacks, exactly as before. Customise saves the template even when the title wasn't
// touched, so an unedited title is not an override.
export function titleOverrideOf(v: DataviewInstance): string | null {
  if (v.kind !== "view") return null;
  const dv = DATAVIEWS.find((d) => d.id === v.dataview);
  const fromParams = v.params?.title;
  const own = typeof fromParams === "string" ? fromParams : v.title;
  if (!own || !own.trim() || !dv) return null;
  return own.trim() === titleTemplateOf(dv).trim() ? null : own;
}

// The instance's title as a reader sees it: its override resolved for this context, else
// the dataview's own (viewTitle).
export function instanceTitle(v: Extract<DataviewInstance, { kind: "view" }>, ctx: PickPanelContext, opts: { fromYear?: string | null; latest?: string | null } = {}): string {
  const dv = DATAVIEWS.find((d) => d.id === v.dataview) ?? null;
  const own = titleOverrideOf(v);
  if (own) return resolveTitle(own, dv, ctx, opts);
  return dv ? resolveTitle(titleTemplateOf(dv), dv, ctx, opts) : (v.title ?? v.dataview);
}

const CHANGE_TYPES: NumberType[] = ["pct_change", "change_points", "change_pp"];

// "Graph · change since 2021/22 · on GCSE Results, Comparisons".
export function metaLine(r: PickResult, ctx: PickPanelContext): string {
  const dv = r.dataview;
  const from = defaultFromYear(ctx);
  const latest = latestYear(ctx);
  const isChange = dv.supports.numberType.some((t) => CHANGE_TYPES.includes(t)) && !dv.supports.numberType.some((t) => ["points", "rate", "totals", "index100"].includes(t));
  const when = dv.supports.dateMode === "single" ? (latest ?? "latest year") : from ? `${isChange ? "change " : ""}since ${from}` : "over time";
  const parts = [VIEW_TYPE_LABEL[dv.supports.viewType], when];
  // Where it lives: the matching panel's dashboard first (the board names one place).
  if (r.livesOn.length) {
    const where = placements(DASHBOARDS, dv.id, toPickContext(ctx));
    const best = where.find((w) => w.matching) ?? where[0];
    parts.push(best ? `on ${best.dashboard.name}, ${best.column}` : r.livesOn[0]);
  }
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------------
// Summary lines

export function focusLabel(ctx: PickPanelContext): string {
  const f = ctx.focus;
  if (f.kind === "subject") return f.subject?.label ?? "the subject chips";
  if (f.kind === "custom_area") return f.area?.name ?? "custom area";
  if (f.kind === "la") return ctx.labels.la ?? "LA";
  if (f.kind === "region") return ctx.labels.region ?? "Region";
  return FOCUS_LABEL[f.kind].toLowerCase().replace(/^england$/, "England").replace(/^la$/, "LA");
}

export function averagesLabel(ids: AverageId[], ctx: Pick<PickPanelContext, "labels">): string[] {
  return ids.map((a) => (a === "la" ? (ctx.labels.la ?? "LA") : a === "region" ? (ctx.labels.region ?? "Region") : "England"));
}

export function compareLabel(ctx: PickPanelContext): string {
  const c = ctx.compare;
  if (!c.kinds.length) return "no comparison";
  const parts: string[] = [];
  if (c.kinds.includes("schools")) parts.push(c.schools?.label ?? "comparator schools");
  if (c.kinds.includes("averages")) {
    const n = c.averages?.length ?? 0;
    parts.push(n === 1 ? averagesLabel(c.averages!, ctx)[0] : `${n || "the"} averages`);
  }
  if (c.kinds.includes("subjects")) parts.push(c.subjects?.label ?? "other subjects");
  return `vs ${parts.join(" + ")}`;
}

// "Average points · Maths (General) · vs 10 nearest + 3 averages" (Ch3Pick's "From this
// column"); Ch3Empty adds the time.
export function summaryLine(ctx: PickPanelContext, withTime = false): string {
  const parts = [measureLabel(ctx), focusLabel(ctx), compareLabel(ctx)];
  if (withTime) parts.push(ctx.time === "latest" ? "latest year" : ctx.time === "over_time" ? "over time" : "either");
  return parts.join(" · ");
}

export function headerLine(ctx: PickPanelContext): string {
  return [ctx.labels.dashboard, ctx.labels.column, ctx.labels.row].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------------
// From a dashboard panel

// A panel's effective column settings: the panel override over the column (matching.ts's
// own precedence).
export function panelSettings(d: DashboardConfig, p: PanelConfig) {
  const col = d.columns.find((c) => c.id === p.column)!;
  const row = d.rows.find((r) => r.id === p.row)!;
  return {
    column: col,
    row,
    data: p.override?.data ?? col.data,
    focus: p.override?.focus ?? col.focus,
    compare: p.override?.compare !== undefined ? p.override.compare : col.compare,
  };
}

export type PanelLabels = {
  results?: ResultsMeasure; // the Results pill's value, for a column that follows it
  subject?: { label: string; key?: string } | null;
  school?: string;
  category?: string;
  setLabel?: string; // the column's current school set ("10 nearest schools")
  la?: string;
  region?: string;
};

const SUBJECTS_SCOPE_LABEL = (scope: NonNullable<CompareSpec["subjects"]>, category?: string) =>
  scope === "category" || scope === "pill" ? (category ?? "its category") : scope === "whole" ? "all subjects" : "chosen subjects";

export function compareFromSpec(spec: CompareSpec | null, labels: PanelLabels): PickPanelContext["compare"] {
  if (!spec || !spec.kinds.length) return { kinds: [] };
  const out: PickPanelContext["compare"] = { kinds: [...spec.kinds] };
  if (spec.kinds.includes("subjects")) out.subjects = { scope: spec.subjects ?? "category", label: SUBJECTS_SCOPE_LABEL(spec.subjects ?? "category", labels.category) };
  if (spec.kinds.includes("schools")) {
    const s = spec.schools ?? "10-nearest";
    out.schools = { spec: s, label: labels.setLabel ?? (s === "10-nearest" ? "10 nearest" : typeof s === "object" ? "a saved set" : "10 nearest") };
  }
  if (spec.kinds.includes("averages")) out.averages = spec.averages ?? ["england"];
  return out;
}

export function contextFromPanel(d: DashboardConfig, panelId: string, labels: PanelLabels = {}): PickPanelContext {
  const p = d.panels.find((x) => x.id === panelId);
  if (!p) throw new Error(`unknown panel ${panelId}`);
  const s = panelSettings(d, p);
  const results = s.data.data === "academic.results" ? (s.data.results === "pill" || !s.data.results ? (labels.results ?? "points") : s.data.results) : undefined;
  const subj = s.focus.subject;
  return {
    data: s.data.data,
    phase: s.data.phase,
    results,
    focus: {
      kind: s.focus.kind,
      subject:
        s.focus.kind === "subject"
          ? subj?.mode === "always"
            ? { mode: "always", label: subj.subject, key: subj.subject }
            : { mode: "follow-chips", label: labels.subject?.label ?? null, key: labels.subject?.key }
          : undefined,
    },
    compare: compareFromSpec(s.compare, labels),
    time: s.row.time,
    labels: { dashboard: d.name, column: s.column.title, row: p.name ?? s.row.name, school: labels.school, category: labels.category, la: labels.la, region: labels.region },
    source: { dashboardId: d.id, columnId: s.column.id, rowId: s.row.id, panelId: p.id },
    override: p.override,
  };
}

// The context's settings in the config's own terms (what an override stores).
export function settingsOf(ctx: PickPanelContext): { data: ColumnHeader["data"]; focus: ColumnHeader["focus"]; compare: CompareSpec | null } {
  const c = ctx.compare;
  const subjectsScope = c.subjects?.scope === "my_subjects" ? "selected" : c.subjects?.scope;
  return {
    data: { data: ctx.data, phase: ctx.phase, ...(ctx.data === "academic.results" ? { results: ctx.results ?? "points" } : {}) },
    focus:
      ctx.focus.kind === "subject"
        ? { kind: "subject", subject: ctx.focus.subject?.mode === "always" && ctx.focus.subject.key ? { mode: "always", subject: ctx.focus.subject.key } : { mode: "follow-chips" } }
        : { kind: ctx.focus.kind },
    compare: c.kinds.length
      ? {
          kinds: [...c.kinds],
          ...(c.kinds.includes("subjects") && subjectsScope ? { subjects: subjectsScope } : {}),
          ...(c.kinds.includes("schools") ? { schools: c.schools?.spec ?? "10-nearest" } : {}),
          ...(c.kinds.includes("averages") ? { averages: c.averages ?? ["england"] } : {}),
        }
      : null,
  };
}

// What differs between two contexts, in the badge's words ("overridden: LA, region,
// England"). Empty = nothing to override.
export function describeDiff(base: PickPanelContext, next: PickPanelContext): string[] {
  const out: string[] = [];
  if (base.data !== next.data || base.phase !== next.phase || (next.data === "academic.results" && base.results !== next.results))
    out.push(`${next.data !== base.data || next.phase !== base.phase ? `${PHASE_LABEL[next.phase]} ` : ""}${measureLabel(next)}`);
  const fs = (c: PickPanelContext) => `${c.focus.kind}|${c.focus.subject?.mode ?? ""}|${c.focus.subject?.mode === "always" ? c.focus.subject.key : ""}|${c.focus.area?.name ?? ""}`;
  if (fs(base) !== fs(next)) out.push(focusLabel(next));
  const cs = (c: PickPanelContext) => JSON.stringify([[...c.compare.kinds].sort(), c.compare.subjects?.scope ?? null, c.compare.schools?.label ?? null, [...(c.compare.averages ?? [])].sort()]);
  if (cs(base) !== cs(next) && !(base.compare.kinds.length === 0 && next.compare.kinds.length === 0)) {
    if (!next.compare.kinds.length) out.push("no comparison");
    else {
      const parts: string[] = [];
      if (next.compare.kinds.includes("averages")) parts.push(averagesLabel(next.compare.averages ?? ["england"], next).join(", "));
      if (next.compare.kinds.includes("schools")) parts.push(next.compare.schools?.label ?? "comparator schools");
      if (next.compare.kinds.includes("subjects")) parts.push(next.compare.subjects?.label ?? "other subjects");
      out.push(parts.join("; "));
    }
  }
  if (base.time !== next.time && next.time !== "either") out.push(next.time === "latest" ? "latest year" : "over time");
  return out;
}

export function overrideBetween(base: PickPanelContext, next: PickPanelContext, reason: string): PickOverride | undefined {
  const diff = describeDiff(base, next);
  if (!diff.length) return undefined;
  const s = settingsOf(next);
  const b = settingsOf(base);
  const o: PickOverride = { badge: `overridden: ${diff.join("; ")}`, reason };
  if (JSON.stringify(s.data) !== JSON.stringify(b.data)) o.data = s.data;
  if (JSON.stringify(s.focus) !== JSON.stringify(b.focus)) o.focus = s.focus;
  if (JSON.stringify(s.compare) !== JSON.stringify(b.compare)) o.compare = s.compare;
  if (base.time !== next.time) o.time = next.time;
  return o;
}

// ---------------------------------------------------------------------------------
// Browse VicData dashboards

export type BrowseCell = { dashboard: DashboardConfig; panel: PanelConfig; column: ColumnHeader; rowName: string; views: Dataview[] };

export function browseMap(): { dashboard: DashboardConfig; cells: BrowseCell[] }[] {
  return DASHBOARDS.filter((d) => d.owner === "vicdata").map((d) => ({
    dashboard: d,
    cells: d.rows.flatMap((row) =>
      d.columns.map((col) => {
        const panel = d.panels.find((p) => p.row === row.id && p.column === col.id)!;
        const views = (panel?.dataviews ?? [])
          .map((v) => (v.kind === "view" ? DATAVIEWS.find((dv) => dv.id === v.dataview) : undefined))
          .filter((x): x is Dataview => !!x);
        return { dashboard: d, panel, column: col, rowName: row.name, views };
      }),
    ),
  }));
}

// A view taken from the mini map: the context it would carry, which is the working
// context when the view fits it, else the source panel's own (with the working context's
// labels and Results pill), so the panel says what it shows.
export function browseContext(cell: BrowseCell, dv: Dataview, working: PickPanelContext, opts: { palette?: DataId[]; superAdmin?: boolean } = {}): { ctx: PickPanelContext; fits: boolean } {
  if (!whyNot(dv, toPickContext({ ...working, time: "either" }, opts)) && (working.time === "either" || (dv.supports.dateMode === "single") === (working.time === "latest")))
    return { ctx: working, fits: true };
  const fromPanel = contextFromPanel(cell.dashboard, cell.panel.id, {
    results: working.data === "academic.results" ? working.results : undefined,
    subject: working.focus.subject?.label ? { label: working.focus.subject.label, key: working.focus.subject.key } : null,
    school: working.labels.school,
    category: working.labels.category,
    setLabel: working.compare.schools?.label,
    la: working.labels.la,
    region: working.labels.region,
  });
  // A Results view in a Results-pill column keeps a sub-measure the view supports.
  let results = fromPanel.results;
  if (fromPanel.data === "academic.results" && dv.supports.results && results && !dv.supports.results.includes(results)) results = dv.supports.results[0];
  return { ctx: { ...fromPanel, results, labels: { ...working.labels }, source: working.source, override: working.override }, fits: false };
}

// ---------------------------------------------------------------------------------
// Instances

let seq = 0;
export function newInstanceId(ctx: PickPanelContext, dvId: string, custom: boolean): string {
  seq += 1;
  const base = `${ctx.source?.panelId ?? "panel"}/${dvId}`;
  return custom ? `${base}~${Date.now().toString(36)}${seq}` : base;
}

export function readyMadeInstance(dv: Dataview, ctx: PickPanelContext): DataviewInstance {
  return { id: newInstanceId(ctx, dv.id, false), kind: "view", dataview: dv.id };
}
