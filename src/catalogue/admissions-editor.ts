// VicData 0.7 admissions editor, stages 1-2 (docs/v0.7/admissions_editor_plan_v1.md): what the
// view editor may offer on an Admissions view, and nothing it can't draw.
//
//   ADMISSIONS_NEEDS_SPAN   the views round 2's D8 found crush at one panel unit (plan §2.3, §3's
//                           "Fit"): moving one into a one-unit panel is allowed, with a warning
//                           (Guy, decision 2).
//   ADMISSIONS_LOOKS        each view's look options, as the page draws them (stage 2). A view not
//                           listed has none; an option not listed isn't offered (decision 1: a
//                           control is shown only when it changes the drawing).
//   ADMISSIONS_VIEW_COMPARE each view's compare chips: the feeder set (day / boarding / both, for
//                           a boarding school only: F2) and the lines it can add or drop.
//
// Every option's default is the preset's own value (ADMISSIONS_BODIES), so a published config
// draws exactly as it did before stage 2.
import type { CompareSeriesKind, ViewCompare } from "./viewspec";
import type { DataviewId } from "./types";

export const ADMISSIONS_NEEDS_SPAN: ReadonlySet<DataviewId> = new Set<DataviewId>(["DV-ADM-P-TABLE", "DV-ADM-M-TABLE", "DV-ADM-M-MOMENTUM", "DV-ADM-M-STRENGTHS", "DV-ADM-P-SHAPE", "DV-ADM-M-SHAPE"]);
export const ADMISSIONS_SPAN_WARNING = "This view needs two columns; at one it crushes its columns";
// Until stage 3 makes presets side-free (gap 3), a view moved to another row is remapped to that
// row's preset when it's next edited (the funnel becomes Share needed): blocked for Admissions.
export const ADMISSIONS_ROW_MOVE_BLOCKED = "Move between rows comes in the next editor round";

export type LookChoice = { value: string | number | boolean; label: string };
export type LookOption = {
  // The look key the spec carries (spec.view.look[key]).
  key: string;
  label: string;
  // A tick (true / false) or a choice of values.
  choices: LookChoice[] | "tick";
  // The value an absent key draws as: the preset's (today's drawing).
  fallback: string | number | boolean;
};

const tick = (key: string, label: string, fallback: boolean): LookOption => ({ key, label, choices: "tick", fallback });
const YEARS: LookOption = { key: "years", label: "Years", choices: [{ value: "down", label: "Down: a row per year" }, { value: "across", label: "Across: a column per year" }], fallback: "down" };
const SHAPE_COLUMNS: LookOption = { key: "columns", label: "Rivals' shapes in", choices: [1, 2, 3].map((n) => ({ value: n, label: `${n} column${n > 1 ? "s" : ""}` })), fallback: 2 };

export const ADMISSIONS_LOOKS: Partial<Record<DataviewId, LookOption[]>> = {
  "DV-ADM-P-PIPELINE": [
    { key: "projection", label: "Projection (11+)", choices: [{ value: "member", label: "Members can turn it on" }, { value: "off", label: "Off" }], fallback: "member" },
    tick("pastPools", "Past pools before now", true),
    tick("rungLabels", "Rung labels under the axis", true),
  ],
  "DV-ADM-P-MAP": [{ key: "colour", label: "Colour", choices: [{ value: "change", label: "By trend (the feeder flags)" }, { value: "value", label: "By pupils (thirds)" }], fallback: "change" }],
  "DV-ADM-P-TABLE": [
    { key: "sort", label: "Order", choices: [{ value: "listed", label: "As listed" }, { value: "latest", label: "Most pupils first" }, { value: "change", label: "Biggest rise first" }], fallback: "listed" },
    tick("showKm", "Distance (km)", true),
    tick("showSector", "Sector", true),
    tick("showGender", "Gender", true),
    tick("showSize", "Size (XS–XL)", true),
  ],
  "DV-ADM-P-SHAPE": [SHAPE_COLUMNS],
  "DV-ADM-M-SHAPE": [SHAPE_COLUMNS],
  "DV-ADM-M-BARS": [
    { key: "show", label: "Show", choices: [{ value: "all", label: "Every school" }, { value: "top5", label: "The top 5, and you" }, { value: "around", label: "Around you" }], fallback: "all" },
    tick("withDonut", "With the donut", true),
  ],
  "DV-ADM-M-MAP": [{ key: "colour", label: "Colour", choices: [{ value: "value", label: "By sector" }, { value: "change", label: "By trend since last year" }], fallback: "value" }],
  "DV-ADM-M-TABLE": [{ key: "sort", label: "Order", choices: [{ value: "latest", label: "By pupils (the rank)" }, { value: "listed", label: "Nearest first" }], fallback: "latest" }],
  "DV-ADM-M-MOMENTUM": [tick("labels", "Name each school", true), tick("quadrantNames", "Name the quadrants", true)],
  "DV-ADM-M-FLAGS": [{ key: "show", label: "Show", choices: [{ value: "flagged", label: "Flagged rivals" }, { value: "all", label: "Every rival" }], fallback: "flagged" }],
  "DV-ADM-M-STRENGTHS": [
    { key: "order", label: "Order", choices: [{ value: "gap", label: "By the gap" }, { value: "az", label: "A to Z" }], fallback: "gap" },
    tick("showFlags", "Show the flags column", true),
  ],
  "DV-ADM-P-POOL-INDEXED": [tick("endLabels", "Name each line at its end", false)],
  "DV-ADM-P-ENTRY-TABLE": [YEARS],
  "DV-ADM-M-SHARE-NUM": [YEARS],
  "DV-ADM-M-SHARE-RANKS": [YEARS],
};

/** A view's looks as it draws them: the spec's own values over the presets' (today's). */
export function looksOf(dataview: string, look: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const own = (look ?? {}) as Record<string, unknown>;
  for (const o of ADMISSIONS_LOOKS[dataview as DataviewId] ?? []) {
    const v = own[o.key];
    out[o.key] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : o.fallback;
  }
  return out;
}

export type ViewCompareOptions = {
  // The feeder set this view draws (day / boarding / both): a boarding school's choice only.
  feeders?: boolean;
  // Lines (or columns) the view can add or drop, each on by default (follows the page).
  lines?: { kind: CompareSeriesKind; label: string }[];
};
const FEEDERS: ViewCompareOptions = { feeders: true };
const AREA_LINES: ViewCompareOptions = { feeders: true, lines: [{ kind: "la", label: "Area: LA" }, { kind: "england", label: "Area: England" }] };
// The funnel (Guy's decision 9) and every Market share / Rivals' results view draw one set (the
// area, or the lead's rivals): no chips. Shape and size keeps its local shape: hiding it would take
// its ADMISSIONS_NOTES line with it (R-ADM-EDITOR-LOOKS-KEEP-NOTES).
export const ADMISSIONS_VIEW_COMPARE: Partial<Record<DataviewId, ViewCompareOptions>> = {
  "DV-ADM-P-PIPELINE": FEEDERS,
  "DV-ADM-P-MAP": FEEDERS,
  "DV-ADM-P-TABLE": FEEDERS,
  "DV-ADM-P-HOLD-LINE": FEEDERS,
  "DV-ADM-P-HOLD-TABLE": FEEDERS,
  "DV-ADM-P-POOL-INDEXED": AREA_LINES,
  "DV-ADM-P-POOL-TABLE": AREA_LINES,
  "DV-ADM-P-AREA-POP": { lines: [{ kind: "la", label: "Area: LA" }, { kind: "region", label: "Area: region" }] },
};

// ------------------------------------------------------------------ reading a view's compare

export type FeederChoice = "page" | "day" | "boarding" | "both";
export type CompareState = { feeders: FeederChoice; lines: Set<CompareSeriesKind> };
const FEEDER_KIND: Record<Exclude<FeederChoice, "page">, CompareSeriesKind> = { day: "dayFeeders", boarding: "boardingFeeders", both: "bothFeeders" };

/** What a view's compare draws: "follows-page" = the page's feeder set and every line it offers. */
export function compareState(compare: ViewCompare, opts: ViewCompareOptions | undefined): CompareState {
  const all = new Set<CompareSeriesKind>((opts?.lines ?? []).map((l) => l.kind));
  if (compare === "follows-page") return { feeders: "page", lines: all };
  const kinds = new Set(compare.map((c) => c.kind));
  const feeders: FeederChoice = kinds.has("bothFeeders") || (kinds.has("dayFeeders") && kinds.has("boardingFeeders")) ? "both" : kinds.has("dayFeeders") ? "day" : kinds.has("boardingFeeders") ? "boarding" : "page";
  return { feeders, lines: new Set([...all].filter((k) => kinds.has(k))) };
}

/** The compare a state is saved as: "follows-page" when it is the page's, else this view's own lines. */
export function compareOf(state: CompareState, opts: ViewCompareOptions | undefined): ViewCompare {
  const all = (opts?.lines ?? []).map((l) => l.kind);
  if (state.feeders === "page" && all.every((k) => state.lines.has(k))) return "follows-page";
  return [
    { kind: "self", colour: "accent" },
    ...(state.feeders !== "page" ? [{ kind: FEEDER_KIND[state.feeders], colour: "muted" }] : []),
    ...all.filter((k) => state.lines.has(k)).map((k) => ({ kind: k, colour: k === "england" ? "england" : "muted" })),
  ];
}
