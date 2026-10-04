// 0.6 snagging round 3 / 01: the number-tiles view's figures, editable as a view setting.
//
// NumberTiles (src/components/teacher/NumberTiles.tsx) draws one main figure and a row of
// small tiles. Each host builds the tiles it can for the school and subject it is showing
// (CandidatesPanels, SubjectPanels, ComparisonsPanels), keyed by the ids registered below,
// and drops one that has no figure (a rank needs more than one subject, England tiles need
// a same-year England figure). A view instance can then say WHICH of those figures to
// show, in what order, with what scope line, and hide one (params.tiles; NumberTilesParams
// in catalogue/types.ts). With nothing set the host's own tiles are drawn untouched.
//
// Pure: no React, no fetch. The hosts call applyTileFigures / applyMainLabel; Customise's
// Figures box uses the rest.
import type { DataviewId, NumberTilesParams, NumberType, ResultsMeasure, TileFigureSpec } from "@/catalogue/types";

// A value that differs by Results measure ("points" one way, rates another); a plain value
// for every state.
type PerResults<T> = T | Partial<Record<ResultsMeasure, T>>;

export type TileFigureDef = {
  // The key the host builds the tile under (NumberTile.key).
  id: string;
  // What the Figures box calls it.
  name: string;
  // The Results measures the host builds it on; absent = every state the view has.
  results?: ResultsMeasure[];
  // Its honest number type (catalogue §3), per measure where that differs. Customise offers
  // a figure only where the measure declares this type honest.
  numberType: PerResults<NumberType>;
  // The host's own scope line, as a template: what the Figures box starts an edit from.
  label: PerResults<string>;
  // This tile's own placeholders, beside the shared ones (TILE_SHARED_TOKENS).
  tokens: string[];
};

export type TileViewDef = {
  main: { name: string; label: string; tokens: string[] };
  // In the host's own order: unset params draw this order (where each one exists).
  figures: TileFigureDef[];
  // The figures are on the view's own measure (Comparisons' ranking headline), not the
  // column's: honesty is checked against the dataview's measures.
  ownMeasure?: boolean;
};

// The existing title placeholder chips that apply to a tile's scope line.
export const TILE_SHARED_TOKENS = ["[subject]", "[category]", "[school]", "[year]"] as const;

const RANK_IN_CATEGORY: TileFigureDef = { id: "category", name: "Rank in its category", numberType: "rank", label: "of [total] in [category]", tokens: ["[total]"] };

export const TILE_FIGURES: Partial<Record<DataviewId, TileViewDef>> = {
  // CandidatesPanels: entries this year, then rank in the category, rank among every
  // subject at the school, and the change since the first published year.
  "DV-C1-CAND-CUR-TILES": {
    main: { name: "Entries this year", label: "[subject] entries in [year]", tokens: [] },
    figures: [
      RANK_IN_CATEGORY,
      { id: "school", name: "Rank among the school's subjects", numberType: "rank", label: "of [total] subjects at school", tokens: ["[total]"] },
      { id: "change", name: "% change since the first year", numberType: "pct_change", label: "since [from-year]", tokens: ["[from-year]"] },
    ],
  },
  // SubjectPanels: the subject's figure on the pill's measure, then (points, rates) its
  // rank in the category, or (grade bands) its entries in the range; then England's figure
  // and the gap to it, where a same-year England figure exists.
  "DV-C1-RES-CUR-TILES": {
    main: { name: "This subject's figure", label: "[subject] [measure] in [year]", tokens: ["[measure]"] },
    figures: [
      { ...RANK_IN_CATEGORY, results: ["points", "threshold"] },
      { id: "count", name: "Entries in the grade range", results: ["bands"], numberType: "totals", label: "of [total] graded entries at [range]", tokens: ["[total]", "[range]"] },
      {
        id: "england-average",
        name: "England's figure",
        results: ["points", "bands"],
        numberType: { points: "points", bands: "rate" },
        label: { points: "England average for [subject]", bands: "England, [range]" },
        tokens: ["[range]"],
      },
      {
        id: "england",
        name: "Gap to England",
        results: ["points", "bands"],
        numberType: { points: "change_points", bands: "change_pp" },
        label: { points: "[direction] the England average", bands: "[direction] England" },
        tokens: ["[direction]", "[range]"],
      },
    ],
  },
  // ComparisonsPanels (ranking sets): the school's headline, its rank in the set and the
  // set's average, always on the ranking's own measure.
  "DV-C3-CUR-TILES": {
    main: { name: "The school's headline", label: "[school] [measure] in [year]", tokens: ["[measure]"] },
    ownMeasure: true,
    figures: [
      { id: "rank", name: "Rank in the set", numberType: "rank", label: "of [total] in this set", tokens: ["[total]"] },
      { id: "average", name: "The set's average", numberType: "points", label: "average across this set", tokens: [] },
    ],
  },
};

export function tileViewDef(dv: DataviewId | string): TileViewDef | null {
  return TILE_FIGURES[dv as DataviewId] ?? null;
}

const pick = <T>(v: PerResults<T>, results: ResultsMeasure | undefined): T | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Partial<Record<ResultsMeasure, T>>)[results ?? "points"] : (v as T);

// A figure's number type and default scope line on this Results measure (undefined = the
// host doesn't build it there).
export function figureNumberType(def: TileFigureDef, results?: ResultsMeasure): NumberType | undefined {
  if (results && def.results && !def.results.includes(results)) return undefined;
  return pick(def.numberType, results);
}

export function figureDefaultLabel(def: TileFigureDef, results?: ResultsMeasure): string {
  return pick(def.label, results) ?? pick(def.label, def.results?.[0]) ?? "";
}

// The figures Customise offers here: built by the host on this measure, and honest for it.
export function offeredFigures(dv: DataviewId | string, results: ResultsMeasure | undefined, honest: ReadonlySet<NumberType>): TileFigureDef[] {
  const def = tileViewDef(dv);
  if (!def) return [];
  return def.figures.filter((f) => {
    const t = figureNumberType(f, results);
    return t !== undefined && honest.has(t);
  });
}

// ---------------------------------------------------------------------------------
// Reading and writing params

function cleanSpec(x: unknown): TileFigureSpec | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.figure !== "string" || !o.figure) return null;
  const out: TileFigureSpec = { figure: o.figure };
  if (typeof o.label === "string" && o.label.trim()) out.label = o.label;
  if (o.hidden === true) out.hidden = true;
  return out;
}

// The tiles settings on an instance's params, validated. Anything malformed reads as unset.
export function readTileParams(params: unknown): NumberTilesParams {
  if (!params || typeof params !== "object") return {};
  const p = params as Record<string, unknown>;
  const out: NumberTilesParams = {};
  if (Array.isArray(p.tiles)) {
    const seen = new Set<string>();
    out.tiles = p.tiles.flatMap((t) => {
      const s = cleanSpec(t);
      if (!s || seen.has(s.figure)) return [];
      seen.add(s.figure);
      return [s];
    });
  }
  if (typeof p.mainLabel === "string" && p.mainLabel.trim()) out.mainLabel = p.mainLabel;
  return out;
}

// The default list for a view: every figure the host can build, in its own order, shown.
export function defaultTileSpec(dv: DataviewId | string): TileFigureSpec[] {
  return (tileViewDef(dv)?.figures ?? []).map((f) => ({ figure: f.id }));
}

export function isDefaultTileSpec(dv: DataviewId | string, spec: TileFigureSpec[]): boolean {
  const d = defaultTileSpec(dv);
  return spec.length === d.length && spec.every((s, i) => s.figure === d[i].figure && !s.hidden && !s.label);
}

// What to save: only what differs from the host's own tiles (unset = today's tiles).
export function writeTileParams(dv: DataviewId | string, spec: TileFigureSpec[] | null, mainLabel: string | null): NumberTilesParams {
  const out: NumberTilesParams = {};
  if (spec && !isDefaultTileSpec(dv, spec)) out.tiles = spec.map((s) => ({ figure: s.figure, ...(s.label?.trim() ? { label: s.label } : {}), ...(s.hidden ? { hidden: true } : {}) }));
  if (mainLabel?.trim()) out.mainLabel = mainLabel;
  return out;
}

// ---------------------------------------------------------------------------------
// The editor's operations on the list (each returns a new list)

export function setTileHidden(spec: TileFigureSpec[], figure: string, hidden: boolean): TileFigureSpec[] {
  return spec.map((s) => {
    if (s.figure !== figure) return s;
    const next: TileFigureSpec = { ...s, hidden: true };
    if (!hidden) delete next.hidden;
    return next;
  });
}

export function setTileLabel(spec: TileFigureSpec[], figure: string, label: string | null): TileFigureSpec[] {
  return spec.map((s) => {
    if (s.figure !== figure) return s;
    const next: TileFigureSpec = { ...s, label: label ?? "" };
    if (!label?.trim()) delete next.label;
    return next;
  });
}

export function addTile(spec: TileFigureSpec[], figure: string): TileFigureSpec[] {
  return spec.some((s) => s.figure === figure) ? spec : [...spec, { figure }];
}

export function removeTile(spec: TileFigureSpec[], figure: string): TileFigureSpec[] {
  return spec.filter((s) => s.figure !== figure);
}

// Move a tile one place up or down among `among` (the figures the box lists; others in the
// list -- figures this measure doesn't have -- keep their places around them).
export function moveTile(spec: TileFigureSpec[], figure: string, dir: -1 | 1, among?: ReadonlySet<string>): TileFigureSpec[] {
  const listed = (s: TileFigureSpec) => !among || among.has(s.figure);
  const i = spec.findIndex((s) => s.figure === figure);
  if (i < 0) return spec;
  let j = i + dir;
  while (j >= 0 && j < spec.length && !listed(spec[j])) j += dir;
  if (j < 0 || j >= spec.length) return spec;
  const out = spec.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// Move a tile to another's place (drag and drop).
export function moveTileTo(spec: TileFigureSpec[], figure: string, onto: string): TileFigureSpec[] {
  const i = spec.findIndex((s) => s.figure === figure);
  const j = spec.findIndex((s) => s.figure === onto);
  if (i < 0 || j < 0 || i === j) return spec;
  const out = spec.slice();
  const [moved] = out.splice(i, 1);
  out.splice(j, 0, moved);
  return out;
}

// ---------------------------------------------------------------------------------
// Drawing: what the hosts call

export type TileVars = Record<string, string | number | null | undefined>;

// Plain words for a placeholder the host can't fill, as resolveTitle (catalogue/pick.ts)
// falls back -- never a bracketed token on the page.
const FALLBACK: Record<string, string> = { subject: "this subject", category: "its category", school: "this school", year: "the latest year", "from-year": "the first year", measure: "this measure", range: "the range", total: "all", direction: "against" };

// Fill a scope line's placeholders. Unlike a title it is not capitalised: a scope line
// reads on from the figure ("2nd" / "of 5 in Sciences & Maths").
export function fillTileLabel(template: string, vars: TileVars): string {
  return template.replace(/\[([^\]]+)\]/g, (_, t: string) => {
    const v = vars[t];
    if (v !== undefined && v !== null && String(v) !== "") return typeof v === "number" ? v.toLocaleString() : v;
    return FALLBACK[t] ?? t;
  });
}

type BuiltTile = { key: string; detail: string; vars?: TileVars };

// The tiles to draw: with no tiles set, the host's own tiles exactly (the same array);
// otherwise the set figures in the set order, hidden ones left out, relabelled where a
// label is set, and any figure the host didn't build here (this school, subject, measure)
// dropped, as the host drops it today.
export function applyTileFigures<T extends BuiltTile>(built: T[], params: NumberTilesParams | null | undefined, shared: TileVars = {}): T[] {
  if (!params?.tiles) return built;
  const byKey = new Map(built.map((t) => [t.key, t]));
  return params.tiles.flatMap((s) => {
    if (s.hidden) return [];
    const t = byKey.get(s.figure);
    if (!t) return [];
    return [s.label ? { ...t, detail: fillTileLabel(s.label, { ...shared, ...t.vars }) } : t];
  });
}

export function applyMainLabel<M extends { label: string }>(main: M | null, params: NumberTilesParams | null | undefined, vars: TileVars = {}): M | null {
  if (!main || !params?.mainLabel) return main;
  return { ...main, label: fillTileLabel(params.mainLabel, vars) };
}
