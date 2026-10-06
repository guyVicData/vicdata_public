// VicData 0.6.3 S2: the Teacher view's maps -- what each dot's size, colour and hover say.
//
// One spec for every map in scope (Comparisons' Current, Trend and Change maps; Column 1
// Results' Trend map), built by both drawing paths from the figures their panels already
// show, and drawn by AcademicMapView behind its optional `teacherMap` prop (the Data View
// never passes it, so its map is untouched):
//
//   colour "none"       Candidates Current: size = entries, one neutral fill, no key
//   colour "rank"       Results Current: the selected measure, sequential by rank in the set
//                       (RANK_SEQ_STOPS, pale blue -> deep purple: its own hues, so it can't
//                       be read as the red-amber-green of change -- Guy, 6 Oct 2026)
//   colour "diverging"  every Trends map: the change, centred on zero, one symmetric scale
//                       (RAG_DIVERGING_STOPS, dark red -> pale amber -> deep green)
//
// A school with no figure, or below the small-entries rule, is a hollow grey dot whose hover
// says which. The school itself wears a thick ring (white on dark, dark grey on light).
// Pure: no React, no Leaflet.
import { inlineRangeLabel, rangeLabel, type GradeRange } from "./subject-grades";

export type ColourStop = { t: number; hex: string };

// Lightness falls steadily from the lowest to the highest rank, so the order reads without
// hue (colour-blind vision, print). The lightest stop is a mid tint, never near-white, so a
// dot shows on a white card; the outline (below) carries the darkest on a black one.
export const RANK_SEQ_STOPS: ColourStop[] = [
  { t: 0, hex: "#9fc3e6" },
  { t: 0.25, hex: "#6c9fd4" },
  { t: 0.5, hex: "#5a78c2" },
  { t: 0.75, hex: "#6849a8" },
  { t: 1, hex: "#4b1c8c" },
];

// Zero is pale amber; equal steps either side darken towards red (a fall) and green (a rise),
// so the same lightness means the same size of change on both sides.
export const RAG_DIVERGING_STOPS: ColourStop[] = [
  { t: 0, hex: "#8e1b1b" },
  { t: 0.25, hex: "#d4692e" },
  { t: 0.5, hex: "#f2dfa0" },
  { t: 0.75, hex: "#5ea459" },
  { t: 1, hex: "#1b6b2e" },
];

export const NEUTRAL_DOT = "#94a3b8";
export const HOLLOW_DOT = "#9ca3af";

export type MapTheme = "dark" | "light";

/** The school's own ring (replaces the red #dc2626 outline, which clashed with the scales). */
export function ownRing(theme: MapTheme): { colour: string; weight: number } {
  return { colour: theme === "light" ? "#374151" : "#ffffff", weight: 3.5 };
}

/** Every other dot's outline: enough edge for a pale amber or pale blue dot on either card. */
export function dotOutline(theme: MapTheme): string {
  return theme === "light" ? "rgba(55,65,81,0.55)" : "rgba(255,255,255,0.65)";
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function colourAt(stops: ColourStop[], t: number): string {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i].t) {
      const a = stops[i - 1];
      const b = stops[i];
      const f = b.t === a.t ? 0 : (x - a.t) / (b.t - a.t);
      const [ar, ag, ab] = hexToRgb(a.hex);
      const [br, bg, bb] = hexToRgb(b.hex);
      const mix = (p: number, q: number) => Math.round(p + (q - p) * f).toString(16).padStart(2, "0");
      return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
    }
  }
  return stops[stops.length - 1].hex;
}

export type TeacherMapDot = {
  // The figure the colour (and the rank) is on: the measure (Current), the change (Trends),
  // or the entries (Candidates Current). null = no figure: a hollow dot.
  value: number | null;
  // Dot size: entries (the subject's, where a subject is focused). null = the map's own.
  size: number | null;
  // The hover, in order: the colour's figure first, then entries.
  lines: string[];
};

export type TeacherMapSpec = {
  colour: "none" | "rank" | "diverging";
  // Keyed by URN. A plotted school missing here is a hollow dot, "No published figure".
  dots: Record<string, TeacherMapDot>;
  // What colour means, in words ("Darker purple = higher Grade 4+ rate in the set"); null
  // with colour "none".
  legend: string | null;
  // The key's two ends, low first ("Lower", "Higher"; "Biggest fall", "Biggest rise").
  ends: [string, string] | null;
  sizeLegend: string;
  // One line under the key (e.g. why the dots aren't coloured).
  note: string | null;
  theme: MapTheme;
};

export type MapSchoolFigure = { urn: string; value: number | null; entries: number | null; tooFew?: boolean };

/**
 * The spec from each school's figure. `valueLine` writes the hover's first line ("Grade 4+:
 * 76% (101 of 132)", "+4pp since 2022/23"); `entriesLine` the entries line. With `mixed` set
 * (the schools' figures are on different measures or qualifications) the dots stay neutral,
 * the hover still gives each school's own figure, and `mixed` is the note.
 */
export function teacherMapSpec(args: {
  colour: "none" | "rank" | "diverging";
  schools: MapSchoolFigure[];
  valueLine: ((value: number, entries: number | null) => string) | null;
  entriesLine: (entries: number) => string;
  legend: string | null;
  ends?: [string, string] | null;
  sizeLegend: string;
  mixed?: string | null;
  theme: MapTheme;
}): TeacherMapSpec {
  const dots: Record<string, TeacherMapDot> = {};
  for (const s of args.schools) {
    const lines: string[] = [];
    const value = s.tooFew ? null : s.value;
    if (value === null) lines.push(s.tooFew ? "Too few entries" : "No published figure");
    else if (args.valueLine) lines.push(args.valueLine(value, s.entries));
    if (s.entries !== null && s.entries > 0) lines.push(args.entriesLine(s.entries));
    dots[s.urn] = { value, size: s.entries !== null && s.entries > 0 ? s.entries : null, lines };
  }
  const mixed = args.mixed ?? null;
  return {
    colour: mixed ? "none" : args.colour,
    dots,
    legend: mixed || args.colour === "none" ? null : args.legend,
    ends: mixed || args.colour === "none" ? null : args.ends ?? null,
    sizeLegend: args.sizeLegend,
    note: mixed,
    theme: args.theme,
  };
}

/**
 * Each plotted school's fill (null = hollow) and the school's own rank among the plotted
 * schools with a figure, largest first, ties sharing a rank -- the "rank N of M" beside the
 * map. On colour "rank" the fill follows the rank (top = deepest); on "diverging" the value
 * on one symmetric scale, the set's largest change either way at the ends.
 */
export function teacherMapFills(spec: TeacherMapSpec, plotted: string[], targetUrn: string): { fill: Map<string, string | null>; rank: { rank: number; total: number } | null } {
  const fill = new Map<string, string | null>();
  const withValue = plotted.filter((u) => spec.dots[u] && spec.dots[u].value !== null);
  const sorted = [...withValue].sort((a, b) => spec.dots[b].value! - spec.dots[a].value!);
  const rankOf = new Map<string, number>();
  sorted.forEach((u, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    rankOf.set(u, prev !== null && spec.dots[prev].value === spec.dots[u].value ? rankOf.get(prev)! : i + 1);
  });
  const total = withValue.length;
  const maxAbs = Math.max(0, ...withValue.map((u) => Math.abs(spec.dots[u].value!)));
  for (const u of plotted) {
    const d = spec.dots[u];
    if (!d || d.value === null) {
      fill.set(u, null);
    } else if (spec.colour === "rank") {
      const r = rankOf.get(u)!;
      fill.set(u, colourAt(RANK_SEQ_STOPS, total > 1 ? (total - r) / (total - 1) : 1));
    } else if (spec.colour === "diverging") {
      fill.set(u, colourAt(RAG_DIVERGING_STOPS, maxAbs > 0 ? 0.5 + d.value / (2 * maxAbs) : 0.5));
    } else {
      fill.set(u, NEUTRAL_DOT);
    }
  }
  const r = rankOf.get(targetUrn);
  return { fill, rank: r !== undefined ? { rank: r, total } : null };
}

/** The key's gradient, low to high (left to right). */
export function legendGradient(spec: TeacherMapSpec): string | null {
  const stops = spec.colour === "rank" ? RANK_SEQ_STOPS : spec.colour === "diverging" ? RAG_DIVERGING_STOPS : null;
  return stops ? `linear-gradient(to right, ${stops.map((s) => `${s.hex} ${Math.round(s.t * 100)}%`).join(", ")})` : null;
}

// ------------------------------------------------------------------ the words

const pct = (v: number) => `${Math.round(v)}%`;

/**
 * Results Current's hover line, the selected result first:
 *   rate measures   "Grade 9: 12% (7 of 58)", "Grade 4+: 76% (101 of 132)"
 *   points          "Average points: 5.3"
 * A rate's "met" is recovered from the rate and its graded entries (the same rows scored it).
 */
export function resultLine(name: string, kind: "rate" | "points", format: (v: number) => string) {
  return (value: number, entries: number | null): string =>
    kind === "rate"
      ? entries !== null && entries > 0
        ? `${name}: ${pct(value)} (${Math.round((value / 100) * entries).toLocaleString()} of ${entries.toLocaleString()})`
        : `${name}: ${pct(value)}`
      : `${name}: ${format(value)}`;
}

/** A Trends map's hover line: the change first, "+12 entries since 2022/23", "+4pp since 2022/23". */
export function changeLine(format: (v: number) => string, since: string, unit = "") {
  return (value: number): string => `${format(value)}${unit} since ${since}`;
}

export const entriesLineFor = (period: string | null) => (n: number) => `${n.toLocaleString()} entries${period ? ` (${period})` : ""}`;

/** Change in a count, signed: "+12", "−3" (the minus sign the year tables print). */
export function signedCount(v: number): string {
  const r = Math.round(v);
  return r === 0 ? "0" : `${r > 0 ? "+" : "−"}${Math.abs(r).toLocaleString()}`;
}

// ------------------------------------------------------------------ from a panel's figures

// What a map is built from: the panel's own per-school figures over its years (the same
// values its ranking and tables read), each school's entries behind them, and what the
// figure is called.
export type MapSeries = {
  periods: number[];
  schools: { urn: string; values: (number | null)[]; entries: (number | null)[]; tooFew?: boolean }[];
  measure: { id: string; changeKind: "percent" | "points" | "pp"; format: (v: number) => string; formatDelta: (d: number) => string };
  // "Grade 4+" / "Grade 9" / "Average points"; the legend's noun ("Grade 4+ rate", "share at
  // grade 9", "average points"); a rate prints "(met of entries)".
  result: { name: string; noun: string; kind: "rate" | "points" | "entries" };
  subjectLabel: string | null;
  theme: MapTheme;
  // The schools' figures aren't on one measure and qualification: neutral dots, this note.
  mixed?: string | null;
};

const yearLabel = (period: number) => `${period}/${String((period + 1) % 100).padStart(2, "0")}`;
const sizeLegendOf = (s: MapSeries) => `Dot size = entries${s.subjectLabel ? ` in ${s.subjectLabel}` : ""}`;

/**
 * a / c: a Current map at `latestIdx` -- Candidates (size = entries, no colour, hover entries
 * only) or Results (colour = the selected measure by rank in the set, deepest = top).
 */
export function currentMapFrom(s: MapSeries, latestIdx: number): TeacherMapSpec {
  const at = latestIdx >= 0 ? s.periods[latestIdx] : null;
  const entriesLine = entriesLineFor(at !== null ? yearLabel(at) : null);
  const schools = s.schools.map((sc) => {
    const entries = latestIdx >= 0 ? sc.entries[latestIdx] ?? null : null;
    const value = latestIdx >= 0 ? sc.values[latestIdx] ?? null : null;
    return { urn: sc.urn, value: s.result.kind === "entries" ? (value ?? entries) : value, entries, tooFew: sc.tooFew };
  });
  if (s.result.kind === "entries") {
    return teacherMapSpec({ colour: "none", schools, valueLine: null, entriesLine, legend: null, sizeLegend: sizeLegendOf(s), theme: s.theme });
  }
  return teacherMapSpec({
    colour: "rank",
    schools,
    valueLine: resultLine(s.result.name, s.result.kind, s.measure.format),
    entriesLine,
    legend: `Darker purple = higher ${s.result.noun} in the set`,
    ends: ["Lowest", "Highest"],
    sizeLegend: sizeLegendOf(s),
    mixed: s.mixed,
    theme: s.theme,
  });
}

/**
 * b / d: a Trends map over `spanPeriods` (the panel's own span, statements from 2022/23):
 * each school's change, diverging and centred on zero. "absolute" is the plain difference
 * (the Trend map: "+12 entries", "+4pp", "+0.4 points"); "honest" the measure's own change
 * (the % change map: a % on a count, R-NUMBER-TYPE-HONESTY). Size = entries in the span's
 * last year. The change is the panels' own (changeOver / changeOf on the same values).
 */
export function changeMapFrom(
  s: MapSeries,
  spanPeriods: number[],
  how: "absolute" | "honest",
  changeOfValues: (values: (number | null)[]) => number | null,
): TeacherMapSpec {
  const idx = spanPeriods.map((p) => s.periods.indexOf(p));
  const lastIdx = idx.length ? idx[idx.length - 1] : -1;
  const since = spanPeriods.length ? yearLabel(spanPeriods[0]) : "the first year";
  const schools = s.schools.map((sc) => ({
    urn: sc.urn,
    value: spanPeriods.length >= 2 ? changeOfValues(idx.map((i) => (i >= 0 ? sc.values[i] ?? null : null))) : null,
    entries: lastIdx >= 0 ? sc.entries[lastIdx] ?? null : null,
    tooFew: sc.tooFew,
  }));
  const format =
    how === "honest" && s.measure.changeKind === "percent"
      ? (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`
      : s.result.kind === "entries"
        ? (v: number) => `${signedCount(v)} entries`
        : s.measure.changeKind === "points"
          ? (v: number) => `${s.measure.formatDelta(v)} points`
          : s.measure.formatDelta;
  const maxAbs = Math.max(0, ...schools.map((sc) => (sc.value === null || sc.tooFew ? 0 : Math.abs(sc.value))));
  const spec = teacherMapSpec({
    colour: "diverging",
    schools,
    valueLine: (v) => `${format(v)} since ${since}`,
    entriesLine: entriesLineFor(lastIdx >= 0 ? yearLabel(s.periods[lastIdx]) : null),
    legend: `Green = biggest rise since ${since}; red = biggest fall`,
    ends: maxAbs > 0 ? [format(-maxAbs), format(maxAbs)] : ["Fall", "Rise"],
    sizeLegend: sizeLegendOf(s),
    mixed: s.mixed,
    theme: s.theme,
  });
  return spec;
}

/**
 * What a map's figure is called. A grade range (Grade bands, or a Grade counts selection)
 * by its own wording ("Grade 9", "Grades 7–9"); a rate by its label ("Grade 4+"); points
 * as "Average points" on a subject, the headline's own name without one.
 */
export function mapResultOf(
  measure: { id: string; label: string; changeKind: "percent" | "points" | "pp" },
  range: GradeRange | null,
  onSubject: boolean,
): MapSeries["result"] {
  if (measure.id === "entries") return { name: "Entries", noun: "entries", kind: "entries" };
  if ((measure.id === "bands" || measure.id === "counts") && range) {
    const name = rangeLabel(range);
    return { name, noun: `share at ${inlineRangeLabel(name)}`, kind: "rate" };
  }
  if (measure.changeKind === "pp") {
    // "Grade 4+ rate" names the figure "Grade 4+" ("Grade 4+: 76% (101 of 132)").
    const name = measure.label.replace(/ rate$/i, "");
    return { name, noun: `${name} rate`, kind: "rate" };
  }
  return onSubject ? { name: "Average points", noun: "average points", kind: "points" } : { name: measure.label, noun: measure.label, kind: "points" };
}
