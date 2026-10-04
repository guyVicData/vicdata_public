// VicData 0.6.1 S4: the Add a view / Edit view screens' model, pure (no React) so
// src/lib/view-editor.test.ts can pin it.
//
//   env        where the view goes: the column's host, the panel's half (Current / Trends),
//              the measure the editor is on, the panel's resolved context
//   draft      what the three steps edit: a whole ViewSpec, the Show-for ticks, the title
//   output     a ViewInstance carrying a full ViewSpec (buildInstance), applied through
//              editor-ops so undo and autosave work
//
// The spec's `preset` (D10) is the dataview of the host the view is drawn by: the preset
// it equals when nothing was changed (so it IS that preset, drawn exactly as today), else
// the nearest preset of the same host and half, which keeps the panel's frame (tag, From
// menu, Trend line toggle) -- the S3a convention (src/components/views/rail.tsx).
import { DATAVIEWS } from "@/catalogue/dataviews";
import { dataviewResults } from "@/catalogue/results";
import { presetSpec, type CompareSeries, type CompareSeriesKind, type ViewKind, type ViewPer, type ViewSpec } from "@/catalogue/viewspec";
import { titleTemplateOf, type PickPanelContext } from "@/catalogue/pick";
import type { DashboardConfig, Dataview, DataviewId, DataviewInstance, HostId, Phase, ResultsMeasure } from "@/catalogue/types";
import { compareHonest, hostOnMeasure, perHonest, shownAsHonest, viewHonest, VIEW_KINDS, VIEW_LABEL, changeLabel, SHORT_KIND, type HonestContext, type HonestMeasure } from "@/catalogue/honest";
import { hostForColumn, hostPanelOfConfig } from "@/components/dashboard-config/embed";
import type { Target } from "@/lib/editor-ops";

export type ViewInstance = Extract<DataviewInstance, { kind: "view" }>;
export type Side = "current" | "trend";

export type EditorEnv = {
  phase: Phase;
  // The column's host (Column 1 Results also on Grade counts, which draws through its own).
  columnHost: HostId;
  side: Side;
  // The measure the editor is on: the Results pill, or Candidates' entries.
  measure: HonestMeasure;
  // A Results dashboard following the pill: Show this view for has ticks.
  followsPill: boolean;
  ctx: PickPanelContext;
};

export type Draft = {
  spec: ViewSpec;
  // Show this view for (Results dashboards).
  ticks: ResultsMeasure[];
  // The title template as typed; null = follow the spec's own (generated) title.
  title: string | null;
};

// ------------------------------------------------------------------------------ env

export function columnHostOf(config: DashboardConfig, target: Target): HostId | null {
  const columnId = typeof target === "string" ? config.panels.find((p) => p.id === target)?.column : target.column;
  const column = config.columns.find((c) => c.id === columnId);
  return column ? hostForColumn(column) : null;
}

export function sideOf(config: DashboardConfig, target: Target): Side {
  const panel = typeof target === "string" ? config.panels.find((p) => p.id === target) : config.panels.find((p) => p.row === target.row && p.column === target.column);
  const rowId = panel?.row ?? (typeof target === "string" ? undefined : target.row);
  const row = config.rows.find((r) => r.id === rowId);
  if (panel) {
    const s = hostPanelOfConfig(panel, row?.legacyPanelId);
    if (s) return s;
  }
  if (row?.legacyPanelId) return row.legacyPanelId;
  return row?.time === "latest" ? "current" : "trend";
}

export const honestCtx = (env: EditorEnv, measure: HonestMeasure = env.measure): HonestContext => ({ phase: env.phase, measure, host: env.columnHost });

// The host that draws this column on the editor's measure.
export const drawingHost = (env: EditorEnv): HostId => (env.measure === "entries" ? env.columnHost : hostOnMeasure(env.columnHost, env.measure));

// ------------------------------------------------------------------ host presets

const START: Record<HostId, Record<Side, DataviewId[]>> = {
  "teacher.c1.results": { current: ["DV-C1-RES-CUR-BAR"], trend: ["DV-C1-RES-TR-CHART"] },
  "teacher.c1.counts": { current: ["DV-C1-CNT-CUR-DIST"], trend: ["DV-C1-CNT-TR-SPREAD"] },
  "teacher.c1.candidates": { current: ["DV-C1-CAND-CUR-TILES"], trend: ["DV-C1-CAND-TR-ACTUAL"] },
  "teacher.c2.context": { current: ["DV-C2-CUR-BARS"], trend: ["DV-C2-TR-CHART", "DV-C2-TR-ACTUAL"] },
  "teacher.c3.comparisons": { current: ["DV-C3-CUR-BAR"], trend: ["DV-C3-TR-CHART"] },
};

export const presetsOf = (host: HostId, side: Side): Dataview[] => DATAVIEWS.filter((d) => d.host.id === host && d.host.panel === side);

// The preset a new view starts from: the host's plain chart for the half.
export function startPreset(host: HostId, side: Side, data: PickPanelContext["data"]): DataviewId {
  const ids = START[host][side];
  if (host === "teacher.c2.context" && side === "trend") return data === "academic.candidates" ? "DV-C2-TR-ACTUAL" : "DV-C2-TR-CHART";
  return ids[0];
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
export const specsEqual = same;

// What is the same view whatever its preset, title and icon: data, compare and view.
const body = (s: ViewSpec) => ({ data: s.data, compare: s.compare, view: s.view });

// The host preset a spec is drawn by: the preset it equals (data, compare and view), else
// the nearest of the host's half by view, per, shown as.
export function hostPresetFor(spec: ViewSpec, host: HostId, side: Side, data: PickPanelContext["data"]): Dataview {
  const list = presetsOf(host, side).filter((d) => d.supports.data.includes(data) || d.host.id === "teacher.c2.context" || d.host.id === "teacher.c3.comparisons");
  const pool = list.length ? list : presetsOf(host, side);
  const exact = pool.find((d) => same(body(presetSpec(d.id)), body(spec)));
  if (exact) return exact;
  const score = (d: Dataview) => {
    const p = presetSpec(d.id);
    let s = 0;
    if (p.view.kind === spec.view.kind) s += 8;
    if (p.data.per === spec.data.per) s += 4;
    if (p.data.shownAs === spec.data.shownAs) s += 2;
    if (p.data.source === data || p.data.source === "follows-page") s += 1;
    // A spec of its own keeps clear of the geography views (their own fetch) and drafts.
    if (/-GEO-/.test(d.id)) s -= 3;
    if (d.status === "draft") s -= 1;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

// ------------------------------------------------------------------------ drafts

const DEFAULT_COLOUR: Partial<Record<CompareSeriesKind, string>> = {
  self: "accent",
  category: "muted",
  allSubjects: "muted",
  selectedSubjects: "muted",
  la: "palette:0",
  region: "palette:6",
  england: "palette:3",
  nearest: "muted",
  savedSet: "muted",
  chosenSchool: "palette:1",
  otherSubject: "palette:4",
};
export const defaultColour = (kind: CompareSeriesKind) => DEFAULT_COLOUR[kind] ?? "muted";

// The rail icons a View offers (real PanelIcons names; "SlopeIcon" is the editor's own until
// PanelIcons has one). The first is the View's default.
export const ICONS_FOR: Record<ViewKind, string[]> = {
  line: ["TrendLineIcon", "IndexedLineIcon", "ChangeArrowIcon", "AverageIcon"],
  bar: ["HorizontalBarsIcon", "VerticalBarsIcon", "AverageIcon", "ChangeArrowIcon"],
  table: ["TableIcon", "RankListIcon"],
  ranking: ["RankListIcon", "PodiumIcon", "TableIcon"],
  numbers: ["TilesIcon", "PodiumIcon", "SchoolIcon", "FlagIcon"],
  spread: ["GradesIcon", "HorizontalBarsIcon"],
  slope: ["SlopeIcon", "TrendLineIcon"],
  donut: ["DonutIcon"],
  map: ["MapPinIcon"],
};

const DEFAULT_LOOK: { [K in ViewKind]: Extract<ViewSpec["view"], { kind: K }>["look"] } = {
  line: { endLabels: true },
  bar: { orientation: "horizontal", order: "highest", average: "none", highlight: true, values: true },
  table: { yearColumns: "first-latest", extra: ["change"], sort: "listed", highlight: true, colourChange: true, memberSort: false },
  ranking: { columns: ["rank", "sector", "value", "change", "distance"], show: "all", alwaysSelf: true },
  numbers: {},
  spread: { show: "percent", average: "none", bands: "none", values: true },
  slope: {},
  donut: {},
  map: { colour: "value" },
};

export function startDraft(env: EditorEnv, instance?: ViewInstance): Draft {
  if (instance) {
    const dv = DATAVIEWS.find((d) => d.id === instance.dataview);
    const ticks = instance.resultsMeasures ?? dataviewResults(dv);
    const own = instance.title ?? (typeof instance.params?.title === "string" ? (instance.params.title as string) : null);
    // A spec of its own carries its title; a preset's is its dataview's template.
    const fromSpec = dv && instance.spec.title !== titleTemplateOf(dv) && !same(body(presetSpec(dv.id)), body(instance.spec)) ? instance.spec.title : null;
    // Editing keeps the view's name: the title starts as it reads now, so a Data change
    // doesn't silently rename it (a new view's title follows its data until typed).
    return { spec: structuredClone(instance.spec), ticks: [...ticks], title: own ?? fromSpec ?? (dv ? titleTemplateOf(dv) : instance.spec.title) };
  }
  const spec = presetSpec(startPreset(drawingHost(env), env.side, env.ctx.data));
  return { spec, ticks: env.followsPill && env.measure !== "entries" ? [env.measure] : [], title: null };
}

// Pick a View that can draw the data, keeping the current one where it can.
export function fitView(spec: ViewSpec, env: EditorEnv): ViewSpec {
  const ctx = honestCtx(env);
  if (viewHonest(ctx, spec.view.kind, spec.data).ok) return spec;
  const want: ViewKind = spec.data.per === "year" ? "line" : spec.data.per === "grade" ? "spread" : spec.data.per === "school" ? "ranking" : "bar";
  const kind = viewHonest(ctx, want, spec.data).ok ? want : (VIEW_KINDS.find((k) => viewHonest(ctx, k, spec.data).ok) ?? "table");
  return setView(spec, kind);
}

export function setView(spec: ViewSpec, kind: ViewKind): ViewSpec {
  if (spec.view.kind === kind) return spec;
  const icon = ICONS_FOR[kind].includes(spec.icon) ? spec.icon : ICONS_FOR[kind][0];
  return { ...spec, view: { kind, look: structuredClone(DEFAULT_LOOK[kind]) } as ViewSpec["view"], icon };
}

// 1 · Data's "One value per": the years follow (a year needs a span; anything else starts on
// the latest year unless it is a change), then the View if it can no longer draw it.
export function setPer(spec: ViewSpec, per: ViewPer, env: EditorEnv): ViewSpec {
  const data = { ...spec.data, per };
  if (per === "year" && "latest" in data.years) data.years = { from: "first", rollOn: true };
  if (per !== "year" && data.shownAs === "actual" && "from" in data.years) data.years = { latest: true };
  if (per === "school" || per === "grade") delete data.rows;
  if (per === "school") data.rows = "follows-page";
  if (data.shownAs === "indexed" && per !== "year") data.shownAs = "actual";
  return fitView({ ...spec, data }, env);
}

export function setShownAs(spec: ViewSpec, shownAs: ViewSpec["data"]["shownAs"], env: EditorEnv): ViewSpec {
  const data = { ...spec.data, shownAs };
  if (shownAs !== "actual" && "latest" in data.years) data.years = { from: "first", rollOn: true };
  if (shownAs === "actual" && data.per !== "year" && "from" in data.years) data.years = { latest: true };
  return fitView({ ...spec, data }, env);
}

// ------------------------------------------------------------------- compared with

export function addLine(spec: ViewSpec, kind: CompareSeriesKind, extra: Partial<CompareSeries> = {}): ViewSpec {
  const list: CompareSeries[] = spec.compare === "follows-page" ? [{ kind: "self", colour: defaultColour("self") }] : [...spec.compare];
  if (list.some((c) => c.kind === kind && !!c.average === !!extra.average)) return spec;
  return { ...spec, compare: [...list, { kind, colour: defaultColour(kind), ...extra }] };
}

export function removeLine(spec: ViewSpec, index: number): ViewSpec {
  if (spec.compare === "follows-page") return { ...spec, compare: [{ kind: "self", colour: defaultColour("self") }] };
  return { ...spec, compare: spec.compare.filter((_, i) => i !== index) };
}

export function setLine(spec: ViewSpec, index: number, patch: Partial<CompareSeries>): ViewSpec {
  if (spec.compare === "follows-page") return spec;
  return { ...spec, compare: spec.compare.map((c, i) => (i === index ? { ...c, ...patch } : c)) };
}

// The one average of things not drawn (☐ Add an average), or null.
export function averageOf(spec: ViewSpec): { index: number; series: CompareSeries } | null {
  if (spec.compare === "follows-page") return null;
  const index = spec.compare.findIndex((c) => !!c.average);
  return index < 0 ? null : { index, series: spec.compare[index] };
}

export function setAverage(spec: ViewSpec, next: CompareSeries | null): ViewSpec {
  const now = averageOf(spec);
  let s = spec;
  if (now) s = removeLine(s, now.index);
  if (!next) return s;
  const list: CompareSeries[] = s.compare === "follows-page" ? [{ kind: "self", colour: defaultColour("self") }] : [...s.compare];
  return { ...s, compare: [...list, next] };
}

// --------------------------------------------------------------------- titles

// A spec of its own reads by what it draws, in placeholders the page resolves.
export function generatedTitle(spec: ViewSpec, data: PickPanelContext["data"]): string {
  const noun = data === "academic.candidates" ? "entries" : "results";
  const Noun = data === "academic.candidates" ? "Entries" : "Results";
  const { per, shownAs, rows } = spec.data;
  const group = rows === "follows-page" ? "[comparison-group]" : "[category]";
  if (per === "year") {
    if (rows) return shownAs === "change" ? `${Noun} in ${group}: [change-word] since [from-year]` : `${Noun} in ${group}, year by year`;
    if (shownAs === "change") return `[subject]: [change-word] since [from-year]`;
    return spec.compare !== "follows-page" && spec.compare.length > 1 ? `[subject] ${noun} from [from-year], compared` : `[subject] ${noun} from [from-year]`;
  }
  if (per === "subject") return shownAs === "change" ? `${Noun} in ${group}: [change-word] since [from-year], ranked` : `${Noun} by subject in ${group}`;
  if (per === "grade") return shownAs === "change" ? `[subject]'s entries at each grade: [from-year] against the latest year` : `[subject] grades, [year]`;
  return shownAs === "change" ? `[change-of-measure] since [from-year], ranked against the [set]` : `Schools by [subject] [measure] in the [set]`;
}

// The title template the view carries: typed, else its preset's when it is the preset,
// else generated from what it draws.
export function titleOf(draft: Draft, env: EditorEnv): string {
  if (draft.title !== null) return draft.title;
  const dv = hostPresetFor(draft.spec, drawingHost(env), env.side, env.ctx.data);
  if (same(body(presetSpec(dv.id)), body(draft.spec))) return titleTemplateOf(dv);
  return generatedTitle(draft.spec, env.ctx.data);
}

// ------------------------------------------------------------------------- output

// The instance the screens hand back: a full ViewSpec, preset kept when unchanged, a new id
// for a new view (editor-ops gives it its panel's free id), the Show-for ticks as its
// resultsMeasures (left off when they are the preset's own, as round 3 does).
export function buildInstance(draft: Draft, env: EditorEnv, original?: ViewInstance): ViewInstance {
  const host = drawingHost(env);
  const dv = hostPresetFor(draft.spec, host, env.side, env.ctx.data);
  const preset = presetSpec(dv.id);
  const typed = titleOf(draft, env);
  const isPreset = same(body(preset), body(draft.spec)) && draft.spec.icon === preset.icon;
  // A renamed preset stays its preset: the title is the instance's own (both renderers read
  // instance.title). A spec of its own carries its title in the spec.
  const spec: ViewSpec = isPreset
    ? preset
    : {
        ...structuredClone(draft.spec),
        ...(preset.resultsMeasures ? { resultsMeasures: [...preset.resultsMeasures] } : {}),
        ...(preset.variants ? { variants: structuredClone(preset.variants) } : {}),
        title: typed,
        preset: dv.id,
      };
  if (!preset.resultsMeasures) delete spec.resultsMeasures;
  if (!preset.variants) delete spec.variants;
  const template = titleTemplateOf(dv);
  const ownTitle = typed.trim() && typed.trim() !== template.trim() ? typed : null;
  const keepParams = original && original.dataview === dv.id ? { ...(original.params ?? {}) } : {};
  delete keepParams.title;
  const can = dataviewResults(dv);
  const ticks = draft.ticks.filter((m) => can.includes(m));
  const tagged = env.followsPill && ticks.length && !(ticks.length === can.length && can.every((m) => ticks.includes(m)));
  return {
    id: original?.id ?? "new",
    kind: "view",
    dataview: dv.id,
    spec,
    ...(Object.keys(keepParams).length ? { params: keepParams } : {}),
    ...(ownTitle ? { title: ownTitle } : {}),
    ...(tagged ? { resultsMeasures: ticks } : {}),
    ...(original?.variants ? { variants: structuredClone(original.variants) } : {}),
  };
}

// Can the draft be saved: every choice honest on the editor's measure, a tick where ticks apply.
export function draftProblems(draft: Draft, env: EditorEnv): string[] {
  const ctx = honestCtx(env);
  const out: string[] = [];
  const s = draft.spec;
  for (const v of [perHonest(ctx, s.data.per), shownAsHonest(ctx, s.data.shownAs, s.data.per), viewHonest(ctx, s.view.kind, s.data)]) if (!v.ok && v.reason) out.push(v.reason);
  if (s.compare !== "follows-page") {
    const span = "from" in s.data.years;
    for (const c of s.compare) {
      const v = compareHonest(ctx, c.kind, { span });
      if (!v.ok && v.reason) out.push(v.reason);
    }
  }
  if (env.followsPill && !draft.ticks.length) out.push("Tick at least one result type to show it for.");
  return out;
}

// --------------------------------------------------------------- changes (Edit view)

const yearsWord = (y: ViewSpec["data"]["years"]) => ("latest" in y ? "latest year" : y.from === "first" ? "from the first year" : `from ${y.from}/${String((y.from + 1) % 100).padStart(2, "0")}`);
const PER_WORD: Record<ViewPer, string> = { year: "Year", subject: "Subject", grade: "Grade", school: "School" };

// What changed between two drafts, newest last, in the board's words ("England line
// removed (step 1)").
export function describeChanges(before: Draft, after: Draft, phase: Phase, measure: HonestMeasure): string[] {
  const out: string[] = [];
  const a = before.spec;
  const b = after.spec;
  if (a.data.per !== b.data.per) out.push(`One value per ${PER_WORD[b.data.per]} (step 1)`);
  if (a.data.shownAs !== b.data.shownAs) out.push(`Shown as ${b.data.shownAs === "change" ? changeLabel(measure).toLowerCase() : b.data.shownAs} (step 1)`);
  if (!same(a.data.years, b.data.years)) out.push(`Years ${yearsWord(b.data.years)} (step 1)`);
  if (!same(a.data.rows, b.data.rows)) out.push("Which subjects changed (step 1)");
  if (!same(a.compare, b.compare)) {
    const kinds = (c: ViewSpec["compare"]) => (c === "follows-page" ? [] : c.map((x) => `${x.kind}${x.average ? ":avg" : ""}`));
    const removed = kinds(a.compare).filter((k) => !kinds(b.compare).includes(k));
    const added = kinds(b.compare).filter((k) => !kinds(a.compare).includes(k));
    const word = (k: string) => (k.endsWith(":avg") ? `${SHORT_KIND[k.slice(0, -4) as CompareSeriesKind]} average` : SHORT_KIND[k as CompareSeriesKind]);
    if (a.compare === "follows-page" && b.compare !== "follows-page") out.push("Lines no longer follow the page (step 1)");
    else if (b.compare === "follows-page") out.push("Lines follow the page (step 1)");
    for (const k of removed) out.push(`${cap(word(k))} line removed (step 1)`);
    // Leaving "follows the page" starts the list on this school: not an addition of its own.
    for (const k of added) if (!(k === "self" && a.compare === "follows-page")) out.push(`${cap(word(k))} line added (step 1)`);
    if (!removed.length && !added.length && a.compare !== "follows-page" && b.compare !== "follows-page") out.push("Line colours changed (step 1)");
  }
  if (a.view.kind !== b.view.kind) out.push(`${VIEW_LABEL[b.view.kind]} (step 2)`);
  else if (!same(a.view.look, b.view.look)) out.push(`How the ${VIEW_LABEL[b.view.kind].toLowerCase()} looks (step 2)`);
  if (!same([...before.ticks].sort(), [...after.ticks].sort())) out.push(`Shows for ${after.ticks.map((m) => SHOW_WORD[m]).join(", ") || "nothing"} (step 3)`);
  if (a.icon !== b.icon) out.push("Rail icon (step 3)");
  if (before.title !== after.title) out.push("Title (step 3)");
  void phase;
  return out;
}

const SHOW_WORD: Record<ResultsMeasure, string> = { points: "points", threshold: "Grade 4+", bands: "bands", counts: "counts" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
