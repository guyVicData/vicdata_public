// The "Add a view" matching rule (docs/v0.6/vicdata_0_6_add_a_view_combinations_v1.md §2),
// as a pure function. Night 2's chooser (Pick) calls it; scripts/catalogue-unit-tests.ts
// tests it.
//
// A catalogue view appears in Pick when ALL of these hold:
//   1. data and measure match the column (or the panel override);
//   2. focus is one the view supports;
//   3. compare follows the subset rule: no comparison -> only views that don't compare;
//      one or more -> views that compare, with every comparison kind among those chosen;
//   4. time matches the row (Either = no filter; the result is grouped by date mode);
//   5. palette: the user's role is allowed the data;
//   6. status is live (super-admin also sees draft).
// It is a structural filter, never a data check: whether THIS school has enough years is
// a warning tag on the card (F9), not a reason to hide it.
//
// Ordering (scope brief §3, "familiar first"):
//   1. familiar: the view sits in the matching panel of a default VicData dashboard;
//   2. vicdata:  the view is on some VicData dashboard;
//   3. also:     everything else that matches.
import type {
  CompareKind,
  DashboardConfig,
  DataId,
  Dataview,
  DataviewId,
  FocusKind,
  Phase,
  ResultsMeasure,
  RowTime,
} from "./types";

export type PickContext = {
  data: DataId;
  phase: Phase;
  results?: ResultsMeasure;
  focus: FocusKind;
  compare: CompareKind[];
  time: RowTime;
  // The data families the user's role palette allows (catalogue §4.4). Absent = all.
  palette?: DataId[];
  superAdmin?: boolean;
};

export type PickTier = "familiar" | "vicdata" | "also";

export type PickResult = {
  dataview: Dataview;
  tier: PickTier;
  // "on GCSE Results, Comparisons" -- where a familiar or VicData view already lives.
  livesOn: string[];
  // Either rows group the list by date mode.
  group: "latest" | "over_time";
  // F9: structural warnings shown on the card, never used to hide it.
  warnings: string[];
};

export type MatchFailure = "data" | "phase" | "results" | "focus" | "compare" | "time" | "palette" | "status";

// Why one view does or doesn't match; the first failing condition, in the rule's order.
export function whyNot(dv: Dataview, ctx: PickContext): MatchFailure | null {
  const s = dv.supports;
  if (!s.data.includes(ctx.data)) return "data";
  if (!s.phases.includes(ctx.phase)) return "phase";
  if (ctx.data === "academic.results" && ctx.results && s.results && !s.results.includes(ctx.results)) return "results";
  if (!s.focus.includes(ctx.focus)) return "focus";
  if (!compareMatches(s.compare, ctx.compare)) return "compare";
  if (!timeMatches(s.dateMode, ctx.time)) return "time";
  if (ctx.palette && !ctx.palette.includes(ctx.data)) return "palette";
  if (!statusVisible(dv.status, !!ctx.superAdmin)) return "status";
  return null;
}

export function compareMatches(viewCompares: CompareKind[], chosen: CompareKind[]): boolean {
  if (chosen.length === 0) return viewCompares.length === 0;
  return viewCompares.length > 0 && viewCompares.every((k) => chosen.includes(k));
}

export function timeMatches(mode: "single" | "trend", time: RowTime): boolean {
  if (time === "either") return true;
  return time === "latest" ? mode === "single" : mode === "trend";
}

function statusVisible(status: Dataview["status"], superAdmin: boolean): boolean {
  if (status === "live") return true;
  if (status === "draft") return superAdmin;
  return false; // deprecated still renders where placed, but is never offered; retired is gone
}

// Where each dataview sits on the VicData dashboards, and whether that panel's own
// context matches `ctx` (the "matching panel" of familiar-first).
export function placements(dashboards: DashboardConfig[], dvId: DataviewId, ctx: PickContext | null) {
  const out: { dashboard: DashboardConfig; column: string; matching: boolean }[] = [];
  for (const d of dashboards) {
    if (d.owner !== "vicdata") continue;
    for (const p of d.panels) {
      if (!p.dataviews.some((v) => v.kind === "view" && v.dataview === dvId)) continue;
      const col = d.columns.find((c) => c.id === p.column);
      const row = d.rows.find((r) => r.id === p.row);
      if (!col || !row) continue;
      const data = p.override?.data ?? col.data;
      const focus = p.override?.focus ?? col.focus;
      const compare = p.override?.compare !== undefined ? p.override.compare : col.compare;
      const matching =
        !!ctx &&
        data.data === ctx.data &&
        data.phase === ctx.phase &&
        focus.kind === ctx.focus &&
        sameKinds(compare?.kinds ?? [], ctx.compare) &&
        (row.time === ctx.time || ctx.time === "either");
      out.push({ dashboard: d, column: col.title, matching });
    }
  }
  return out;
}

function sameKinds(a: CompareKind[], b: CompareKind[]) {
  return a.length === b.length && a.every((k) => b.includes(k));
}

const TIER_ORDER: Record<PickTier, number> = { familiar: 0, vicdata: 1, also: 2 };

export function matchDataviews(catalogue: Dataview[], ctx: PickContext, dashboards: DashboardConfig[]): PickResult[] {
  const results: (PickResult & { index: number })[] = [];
  catalogue.forEach((dv, index) => {
    if (whyNot(dv, ctx)) return;
    const where = placements(dashboards, dv.id, ctx);
    const tier: PickTier = where.some((w) => w.matching) ? "familiar" : where.length ? "vicdata" : "also";
    const livesOn = [...new Set(where.map((w) => `on ${w.dashboard.name}, ${w.column}`))];
    const warnings: string[] = [];
    if (dv.requires) warnings.push(dv.requires);
    results.push({ dataview: dv, tier, livesOn, group: dv.supports.dateMode === "single" ? "latest" : "over_time", warnings, index });
  });
  // Stable within a tier: catalogue order, which is rail order.
  results.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.index - b.index);
  return results.map((r) => ({ dataview: r.dataview, tier: r.tier, livesOn: r.livesOn, group: r.group, warnings: r.warnings }));
}

// Relaxations for the empty state (combinations §4.3): how many views each loosening
// would unlock.
export function relaxations(catalogue: Dataview[], ctx: PickContext, dashboards: DashboardConfig[]) {
  const count = (c: PickContext) => matchDataviews(catalogue, c, dashboards).length;
  const out: { id: "no-compare" | "over-time" | "latest"; label: string; count: number }[] = [];
  if (ctx.compare.length) out.push({ id: "no-compare", label: "Without comparison", count: count({ ...ctx, compare: [] }) });
  if (ctx.time === "latest") out.push({ id: "over-time", label: "Over time instead", count: count({ ...ctx, time: "over_time" }) });
  if (ctx.time === "over_time") out.push({ id: "latest", label: "Latest year instead", count: count({ ...ctx, time: "latest" }) });
  return out.filter((r) => r.count > 0);
}
