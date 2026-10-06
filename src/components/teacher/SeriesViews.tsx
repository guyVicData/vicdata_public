"use client";

// Teacher view, Trend & % Change redesign (build brief v1; mockup "Candidates Trend —
// chart style options"): the views that draw every subject -- or every comparator school
// -- individually, shared by Column 1 Candidates, Context and Comparisons.
//
//   MultiTrend  -- Trend's chart. Option H's ranked bars (each series' change in the
//                  measure's own units) below TREND_LINE_MIN_YEARS real years; Option D2 (one line each, indexed to
//                  its own first year = 100 for headcounts) from there. (Option K's
//                  curated focus + top movers + band went with snagging round 1 Part 3.)
//   ChangeList  -- Option H: a change (% by default) as a ranked, diverging list, the group average a
//                  dashed reference line rather than a competing bar.
//   YearTable   -- Options E and I: one column per year (first and last on the card,
//                  every year in fullscreen), a latest-year rank, and the change.
//
// Colours come from the caller (greys in Current's order, the focus in the accent), so
// the same subject is the same colour in every view.
import { createContext, useContext, useState, type ReactNode } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { countedValues, periodsWithData, rankByValue, TREND_LINE_MIN_YEARS, type Measure, type PanelData, type PanelSeries } from "@/lib/teacher-view-panels";
import {
  DIRECTION_FILL,
  DIRECTION_TEXT,
  changeOver,
  directionOf,
  indexTo100,
  shouldIndex,
  signed,
} from "@/lib/teacher-view-trend-styles";
import { CentredOnTarget } from "./CentredOnTarget";
import { TrendChart } from "./TrendChart";

// D2's scale: an index, where 100 is "the same as the first year shown".
const INDEX_MEASURE: Measure = {
  id: "entries",
  label: "Index (first year = 100)",
  changeLabel: "% change",
  changeKind: "percent",
  format: (v) => `${Math.round(v)}`,
  formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}`,
  axisStep: 10,
  aggregate: "mean",
  noun: "index",
  barScaleMax: null,
};

// Whether the Trend line toggle means anything for this data: the fallback is a list with no
// time axis to fit a line along.
export function multiTrendHasLine(data: PanelData): boolean {
  return periodsWithData(data).length >= TREND_LINE_MIN_YEARS;
}

// ----------------------------------------------------------------- MultiTrend

export function MultiTrend({
  data,
  measure,
  focusKey,
  showFit = false,
  fullscreen = false,
  index,
  seriesLegend,
  fromZero,
  endLabels,
}: {
  // Every series, in Current's order, already coloured and already sliced to the span.
  data: PanelData;
  measure: Measure;
  focusKey: string | null;
  showFit?: boolean;
  fullscreen?: boolean;
  // Col 1 / Trend actual-numbers round: whether to draw the index. Absent = the measure's
  // own rule (shouldIndex: headcounts indexed, points and rates real). false = the "Actual"
  // view -- the same lines at their real values, the numbers the index is built from.
  index?: boolean;
  // Passed to TrendChart: false when the caller draws the series legend itself.
  seriesLegend?: boolean;
  // 0.6.1 S3: a line view's look (TrendChart's), passed through; off by default.
  fromZero?: boolean;
  endLabels?: boolean;
}) {
  if (!multiTrendHasLine(data)) {
    // A long list scrolls inside the panel, starting with the focused row in view. Only
    // the list: the line chart sizes itself by stretching to fill the panel, which a
    // scroll box would break.
    // Option H's ranked bars, on each series' change first -> last in the measure's own
    // units (pp for a rate, points, entries) -- not % change -- and no reference line.
    return (
      <CentredOnTarget watch={`${focusKey}:${data.series.map((s) => s.key).join(",")}`}>
        <ChangeList
          // R-TREND-FROM-2223: each change counted from the trend's statement year.
          rows={data.series.map((s) => ({ key: s.key, label: s.label, colour: s.colour, value: changeOver(countedValues(s.values, data.periods, data.statementFrom))?.delta ?? null }))}
          focusKey={focusKey}
          formatValue={measure.formatDelta}
        />
      </CentredOnTarget>
    );
  }
  const indexed = index ?? shouldIndex(measure.aggregate);
  // A series marked as a comparison (Context's card: the group average beside the focus)
  // keeps its dashed line; everything else is drawn solid, as before.
  const series: PanelSeries[] = data.series.map((s) => ({ ...s, comparison: s.comparison ?? false, values: indexed ? indexTo100(s.values) : s.values }));
  return (
    <TrendChart
      data={{ periods: data.periods, series, statementFrom: data.statementFrom }}
      measure={indexed ? INDEX_MEASURE : measure}
      showFit={showFit}
      fullscreen={fullscreen}
      focusKey={focusKey ?? undefined}
      reference={indexed ? { value: 100, label: "100 = first year shown" } : undefined}
      seriesLegend={seriesLegend}
      fromZero={fromZero}
      endLabels={endLabels}
    />
  );
}

// The title over a headcount chart that says what it is drawing. The indexed chart is the
// default and was unexplained: a teacher meeting it for the first time had no way to know
// what "100" meant without hovering. The actual-numbers chart says it is the real figures,
// which is what makes the index readable beside it. A TITLE, not a caption (Guy's call):
// the same style as the panel's own "Entries in {category}" heading, so it reads as part
// of what the chart is, not a footnote under it. Also used over Geography's indexed chart,
// so every indexed-to-100 chart explains itself the same way.
export function TrendScaleTitle({ view, from, noun }: { view: "indexed" | "actual"; from: number | null; noun: string }) {
  // The scale's own sentence, never replaced by a view's title override (0.6 snag 4 / 01):
  // it explains the chart under whatever title the view carries.
  return (
    <ViewTitleLine>
      {view === "indexed"
        ? `Change since ${from === null ? "the first year shown" : academicYearLabel(from)}: each line starts at 100 (no change); 110 = 10% more ${noun}, 90 = 10% fewer.`
        : `${noun.charAt(0).toUpperCase() + noun.slice(1)} each year, real numbers: one scale for every subject, so small ones sit low.`}
    </ViewTitleLine>
  );
}

// Trends row merge round: the one title line every view in a Trends panel carries, directly
// above its chart, table, list or map -- TrendScaleTitle's own style, generalised. With
// Trend's and % change's views behind one rail, the title is what tells a screenshot of the
// body alone which view it is.
//
// 0.6 snag 4 / 01: a view instance's own title (Customise's Title, resolved for the page's
// school, subject, year and sets) replaces the host's words here, wherever the body is drawn
// -- the card, fullscreen, the print, a meeting slot's figure. A host passes no children
// where it draws no title today; with no override that still draws nothing.
export function ViewTitle({ children }: { children?: ReactNode }) {
  const override = useContext(ViewTitleOverrideContext);
  const text = override ?? children;
  if (text === null || text === undefined || text === false) return null;
  return <ViewTitleLine>{text}</ViewTitleLine>;
}

function ViewTitleLine({ children }: { children: ReactNode }) {
  return <p className="mb-1 shrink-0 text-[12px] font-semibold leading-snug text-[var(--muted2)]">{children}</p>;
}

// The resolved override for the view a panel is showing; null = the host's own titles.
// Provided by ColumnPanels (src/components/teacher/ColumnPanels.tsx) under a plan only.
export const ViewTitleOverrideContext = createContext<string | null>(null);

// ----------------------------------------------------------------- ChangeList

export type ChangeRow = { key: string; label: string; colour: string; value: number | null };

// A % change, rounded, with its sign: ChangeList's default formatting (a count's change).
// Points and rates pass their own (formatChange / the measure's formatDelta).
const signedPercent = (v: number) => signed(Math.round(v), (x) => `${x}%`);

// Option H. Ranked by change (a % change unless the caller formats something else, as
// Trend's short-span fallback does with a measure's own delta), biggest rise first, so reading order alone answers "which
// moved most" -- the same convention as the rankings. Bars grow either way from a centre
// zero; every value is printed in full beside its bar, which is also why one outlier no
// longer squashes the rest: a short bar still carries a full-size "+2%". The group
// average is a dashed line through every row, not an extra row to rank against.
export function ChangeList({
  rows,
  focusKey,
  group,
  formatValue,
  values = true,
  order = "highest",
  average,
}: {
  rows: ChangeRow[];
  focusKey: string | null;
  group?: { label: string; value: number | null };
  // 0.6.1 S3, a bar view's look: an average of the rows drawn, a dotted line (the group's
  // reference above is an average of things not drawn).
  average?: { label: string; value: number };
  // 0.6.1 S3, a bar view's look: false leaves the figures off the rows (the bars alone);
  // "az" lists the rows by name rather than by change. Defaults draw as before.
  values?: boolean;
  order?: "highest" | "az";
  // How a row's value prints, sign included, as ViewChart's formatValue: the measure
  // formats its own values. Absent = a rounded, signed % change.
  formatValue?: (v: number) => string;
}) {
  const format = formatValue ?? signedPercent;
  // The tone follows the printed figure: a % change is shown rounded, so "+0%" reads flat.
  const dirOf = (v: number | null) => directionOf(v === null ? null : formatValue ? v : Math.round(v));
  const byChange = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const rankOfKey = new Map(byChange.map((r, i) => [r.key, i + 1]));
  const ranked = order === "az" ? [...rows].sort((a, b) => a.label.localeCompare(b.label)) : byChange;
  const real = ranked.filter((r) => r.value !== null).map((r) => Math.abs(r.value!));
  if (real.length === 0) return <p className="text-xs text-[var(--muted)]">No two years of published figures to compare yet.</p>;
  const maxAbs = Math.max(...real, group?.value !== null && group?.value !== undefined ? Math.abs(group.value) : 0, average ? Math.abs(average.value) : 0) || 1;
  // Half the track either side of zero, with a little room so the longest bar never
  // touches the edge.
  const pos = (v: number) => 50 + (v / maxAbs) * 46;
  // Nulls sort last, so a row's rank is simply its position among the real ones.
  return (
    <div className="flex flex-col gap-1.5">
      {ranked.map((r) => {
        const rank = rankOfKey.get(r.key)!;
        const dir = dirOf(r.value);
        const focus = r.key === focusKey;
        return (
          <div key={r.key} data-highlight={focus ? "" : undefined} className={`grid ${values ? "grid-cols-[6.5rem_1fr_2.75rem]" : "grid-cols-[6.5rem_1fr]"} items-center gap-2 text-[11px]`}>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="w-3 shrink-0 text-right text-[9px] tabular-nums text-[var(--muted3)]">{r.value === null ? "" : rank}</span>
              <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: r.colour }} />
              {/* The focused row's label takes its own colour (the accent), as its dot does. */}
              <span
                className={`truncate ${focus ? "font-semibold" : "text-[var(--muted2)]"}`}
                style={focus ? { color: r.colour } : undefined}
                title={r.label}
              >
                {r.label}
              </span>
            </span>
            <span className="relative h-3.5 rounded-[3px] bg-[var(--panel-border)]">
              <span className="absolute -bottom-0.5 -top-0.5 left-1/2 w-px bg-[var(--panel-border2)]" />
              {r.value !== null && (
                <span
                  className="absolute inset-y-0 rounded-[2px]"
                  style={{
                    left: `${Math.min(50, pos(r.value))}%`,
                    width: `${Math.abs(pos(r.value) - 50)}%`,
                    background: DIRECTION_FILL[dir],
                  }}
                />
              )}
              {group?.value !== null && group?.value !== undefined && (
                <span
                  className="absolute -bottom-1 -top-1 w-0 border-l border-dashed border-[var(--fg)] opacity-60"
                  style={{ left: `${pos(group.value)}%` }}
                />
              )}
              {average && (
                <span
                  data-average-line=""
                  className="absolute -bottom-1 -top-1 w-0 border-l border-dotted border-[var(--fg)] opacity-70"
                  style={{ left: `${pos(average.value)}%` }}
                />
              )}
            </span>
            {values && (
              <span className={`text-right font-semibold tabular-nums ${DIRECTION_TEXT[dir]}`}>
                {r.value === null ? "—" : format(r.value)}
              </span>
            )}
          </div>
        );
      })}
      {group && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-dashed border-[var(--panel-border2)] pt-1.5 text-[10px] text-[var(--muted2)]">
          <span className="inline-block h-3 w-0 border-l border-dashed border-[var(--fg)] opacity-60" />
          {group.label}: {group.value === null ? "no figure" : format(group.value)}
        </div>
      )}
      {average && (
        <div className={`${group ? "" : "mt-1 border-t border-dashed border-[var(--panel-border2)] pt-1.5 "}flex items-center gap-1.5 text-[10px] text-[var(--muted2)]`}>
          <span className="inline-block h-3 w-0 border-l border-dotted border-[var(--fg)] opacity-70" />
          {average.label}: {format(average.value)}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ YearTable

// "given": the caller's own row order (Part 5's school, LA, region, England), until a
// header is clicked.
type SortKey = "given" | "name" | "rank" | "change" | number;

// Options E and I, one component. Real figures per year -- the headcounts D2 deliberately
// hides behind an index, and the base that tells a big move on 8 candidates from one on
// 230. The card shows the first and last year only, so a row still fits a card's width;
// fullscreen opens every year between.
export function YearTable({
  data,
  measure,
  focusKey,
  fullscreen = false,
  nameHeading = "Subject",
  showRank = true,
  leadingRank = false,
  changeEmphasis = "value",
  yearColumns = "first-latest",
  showChange = true,
  rankColumn = "fullscreen",
  counts,
  initialSort,
  highlight = true,
  colourChange = true,
  sortable,
}: {
  data: PanelData;
  measure: Measure;
  focusKey: string | null;
  fullscreen?: boolean;
  nameHeading?: string;
  // Off where a rank means nothing -- Part 5's geography rows (England is always "1st").
  showRank?: boolean;
  // Live review Part E (the % change table): a ranked list rather than a sortable table.
  // Rows are ranked by CHANGE (% for a count; points or percentage points otherwise,
  // R-NUMBER-TYPE-HONESTY) -- the order the ranked list beside it uses -- and stay in
  // that order (headers are not clickable); the rank is a bare number in an unheaded first
  // column, shown on the card as well as fullscreen; padding and type tighten so name,
  // rank, both years and Change fit a card without scrolling sideways.
  leadingRank?: boolean;
  // Which half of the Change cell leads. "value" (the default, every existing table): the
  // count bold and coloured, the % small and muted beneath. "percent" (the % Change
  // geography table, where a count of 33,271 beside 53 means little): the % bold and
  // coloured, the count beneath in a legible light tone rather than near-invisible grey.
  changeEmphasis?: "value" | "percent";
  // 0.6.1 S3, a table view's look (never a figure). Every default draws as before.
  //   yearColumns  "first-latest": first and latest on the card, every year in fullscreen;
  //                "every": every year everywhere; "latest": the latest year alone.
  //   showChange   the Change column.
  //   rankColumn   the "n of N" rank column: fullscreen only (today), always, or never.
  //   counts       an "n" column: the count behind each row's latest figure, by row key.
  //   initialSort  the order the table opens in: "listed" (the caller's), the latest
  //                year, or the change. Absent: by rank (or as given without one).
  //   highlight    the focused row picked out; colourChange the change coloured by direction.
  //   sortable     members re-sort by clicking a heading (absent: unless leadingRank).
  yearColumns?: "first-latest" | "every" | "latest";
  showChange?: boolean;
  rankColumn?: "fullscreen" | "always" | "never";
  counts?: Record<string, number | null>;
  initialSort?: "listed" | "latest" | "change";
  highlight?: boolean;
  colourChange?: boolean;
  sortable?: boolean;
}) {
  const lastSortIdx = data.periods.length - 1;
  const openingSort = (): { key: SortKey; dir: 1 | -1 } =>
    initialSort === "listed"
      ? { key: "given", dir: 1 }
      : initialSort === "latest"
        ? { key: Math.max(0, lastSortIdx), dir: -1 }
        : initialSort === "change"
          ? { key: "change", dir: -1 }
          : { key: showRank ? "rank" : "given", dir: 1 };
  const [userSort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(openingSort);
  const sort: { key: SortKey; dir: 1 | -1 } = leadingRank ? { key: "rank", dir: 1 } : userSort;
  const canSort = sortable ?? !leadingRank;
  const pad = leadingRank ? "px-1" : "px-1.5";
  const { periods, series } = data;
  if (periods.length === 0 || series.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No published figures for this comparison yet.</p>;
  }
  // R-TREND-FROM-2223: on a trend measured from a later year than the first it shows, the
  // Change column counts from that year, and the card's two year columns are the change's
  // own two ends (every year, 2021/22 included, in fullscreen).
  const fromIdx = Math.max(0, data.statementFrom === null || data.statementFrom === undefined ? 0 : periods.findIndex((p) => p >= data.statementFrom!));
  const yearIdx =
    yearColumns === "latest"
      ? [periods.length - 1]
      : yearColumns === "every" || fullscreen || periods.length <= 2
        ? periods.map((_, i) => i)
        : [fromIdx < periods.length - 1 ? fromIdx : 0, periods.length - 1];
  const rankShown = showRank && !leadingRank && (rankColumn === "always" || (rankColumn === "fullscreen" && fullscreen));
  const lastIdx = periods.length - 1;

  // R-NUMBER-TYPE-HONESTY (S3b): the change a row is ranked and sorted by is the measure's
  // honest one -- % for a count, the difference in points or percentage points otherwise.
  const percentKind = measure.changeKind === "percent";
  const rows = series.map((s) => {
    const change = changeOver(countedValues(s.values, periods, data.statementFrom));
    return { s, change, honest: change ? (percentKind ? change.percent : change.delta) : null, last: s.values[lastIdx] };
  });
  // The one shared ranking rule (teacher-view-panels' rankByValue: largest first, ties
  // share a rank) -- the Current number tiles and Column 3's ranking read it too.
  const rankOf = rankByValue(rows.map((r) => ({ key: r.s.key, value: leadingRank ? r.honest : r.last })));
  const ranked = rankOf.size;


  const valueFor = (r: (typeof rows)[number], key: SortKey): number | string | null =>
    key === "given" ? 0 : key === "name" ? r.s.label : key === "rank" ? rankOf.get(r.s.key) ?? null : key === "change" ? r.honest : r.s.values[key];
  const sorted = [...rows].sort((a, b) => {
    const av = valueFor(a, sort.key);
    const bv = valueFor(b, sort.key);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number)) * sort.dir;
  });
  const onSort = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key === "rank" ? 1 : -1 }));

  const head = (k: SortKey, children: React.ReactNode, left = false) => (
    <th key={String(k)} className={`${pad} pb-1.5 font-semibold ${left ? "text-left" : "text-right"}`}>
      {!canSort ? (
        <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.02em] text-[var(--muted)]">{children}</span>
      ) : (
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] uppercase tracking-[0.02em] text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {children}
        <span aria-hidden="true" className={sort.key === k ? "" : "opacity-0"}>{sort.dir === 1 ? "▲" : "▼"}</span>
      </button>
      )}
    </th>
  );

  return (
    <table className={`w-full border-collapse tabular-nums ${fullscreen ? "text-[13px]" : leadingRank ? "text-[11px]" : "text-[11.5px]"}`}>
      <thead className="border-b border-[var(--panel-border2)]">
        <tr>
          {leadingRank && <th className="w-5 pb-1.5" aria-label="Rank" />}
          {head("name", nameHeading, true)}
          {/* Live review Part 4: Rank only in fullscreen. On the card it pushed the year and
              Change columns -- the figures that matter there -- out of view. The ranking
              itself still drives the default sort either way. */}
          {rankShown && head("rank", "Rank")}
          {yearIdx.map((i) => head(i, academicYearLabel(periods[i])))}
          {counts && <th className={`${pad} pb-1.5 text-right font-semibold`}><span className="whitespace-nowrap text-[10px] uppercase tracking-[0.02em] text-[var(--muted)]">n</span></th>}
          {showChange && head("change", "Change")}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const focus = highlight && r.s.key === focusKey;
          const dir = colourChange ? directionOf(r.change?.delta ?? null) : "flat";
          return (
            <tr
              key={r.s.key}
              data-highlight={focus ? "" : undefined}
              className="border-b border-[var(--panel-border)] last:border-b-0"
              style={focus ? { background: "rgba(var(--accent-rgb,138,138,144),0.10)" } : undefined}
            >
              {leadingRank && (
                <td className="w-5 pl-0.5 pr-1 text-right text-[var(--muted3)]">{rankOf.get(r.s.key) ?? ""}</td>
              )}
              <td className={`max-w-0 ${pad} py-[5px] text-left`}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: r.s.colour }} />
                  <span className={`truncate ${focus ? "font-semibold text-[var(--fg)]" : "text-[var(--muted2)]"}`} title={r.s.label}>{r.s.label}</span>
                </span>
              </td>
              {rankShown && (
                <td className="whitespace-nowrap px-1.5 text-right text-[var(--muted2)]">
                  {rankOf.has(r.s.key) ? `${rankOf.get(r.s.key)} of ${ranked}` : "—"}
                </td>
              )}
              {yearIdx.map((i) => (
                <td key={periods[i]} className={`${pad} text-right ${focus ? "font-semibold" : "text-[var(--muted2)]"}`}>
                  {r.s.values[i] === null ? "—" : measure.format(r.s.values[i]!)}
                </td>
              ))}
              {counts && (
                <td className={`${pad} text-right text-[var(--muted2)]`}>{counts[r.s.key] === null || counts[r.s.key] === undefined ? "—" : Math.round(counts[r.s.key]!).toLocaleString()}</td>
              )}
              {showChange && (
              <td className={`whitespace-nowrap ${pad} text-right leading-tight`}>
                {!percentKind ? (
                  // Points and rates: the difference alone (R-NUMBER-TYPE-HONESTY), never a %.
                  <span className={`block font-semibold ${DIRECTION_TEXT[dir]}`}>{r.change ? measure.formatDelta(r.change.delta) : "—"}</span>
                ) : changeEmphasis === "percent" ? (
                  <>
                    <span className={`block font-semibold ${DIRECTION_TEXT[dir]}`}>
                      {r.change?.percent !== null && r.change?.percent !== undefined ? signed(Math.round(r.change.percent), (v) => `${v}%`) : "—"}
                    </span>
                    {r.change && <span className="block text-[9.5px] text-[var(--fg)] opacity-85">{measure.formatDelta(r.change.delta)}</span>}
                  </>
                ) : (
                  <>
                    <span className={`block font-semibold ${DIRECTION_TEXT[dir]}`}>{r.change ? measure.formatDelta(r.change.delta) : "—"}</span>
                    {r.change?.percent !== null && r.change?.percent !== undefined && (
                      <span className="block text-[9.5px] text-[var(--muted2)]">{signed(Math.round(r.change.percent), (v) => `${v}%`)}</span>
                    )}
                  </>
                )}
              </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
