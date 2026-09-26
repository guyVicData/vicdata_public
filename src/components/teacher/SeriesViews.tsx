"use client";

// Teacher view, Trend & % Change redesign (build brief v1; mockup "Candidates Trend —
// chart style options"): the views that draw every subject -- or every comparator school
// -- individually, shared by Column 1 Candidates, Context and Comparisons.
//
//   MultiTrend  -- Trend's chart. Option H's ranked bars (each series' change in the
//                  measure's own units) below TREND_LINE_MIN_YEARS real years; Option D2 (one line each, indexed to
//                  its own first year = 100 for headcounts) from there; Option K (focus +
//                  top movers as lines, the rest one min-max band) when the list is long.
//   ChangeList  -- Option H: a change (% by default) as a ranked, diverging list, the group average a
//                  dashed reference line rather than a competing bar.
//   YearTable   -- Options E and I: one column per year (first and last on the card,
//                  every year in fullscreen), a latest-year rank, and the change.
//
// Colours come from the caller (greys in Current's order, the focus in the accent), so
// the same subject is the same colour in every view.
import { useState } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { periodsWithData, TREND_LINE_MIN_YEARS, type Measure, type PanelData, type PanelSeries } from "@/lib/teacher-view-panels";
import {
  DIRECTION_FILL,
  DIRECTION_TEXT,
  bandOf,
  changeOver,
  directionOf,
  indexTo100,
  shouldIndex,
  signed,
  topMovers,
} from "@/lib/teacher-view-trend-styles";
import { CentredOnTarget } from "./CentredOnTarget";
import { TrendChart } from "./TrendChart";

// D2's scale: an index, where 100 is "the same as the first year shown".
const INDEX_MEASURE: Measure = {
  id: "entries",
  label: "Index (first year = 100)",
  changeLabel: "% change",
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
  curated = false,
  restLabel = "rest",
  showFit = false,
  fullscreen = false,
}: {
  // Every series, in Current's order, already coloured and already sliced to the span.
  data: PanelData;
  measure: Measure;
  focusKey: string | null;
  // Option K: focus + top movers as lines, everyone else folded into one band.
  curated?: boolean;
  // What the band is called: "rest of school", "rest of the set".
  restLabel?: string;
  showFit?: boolean;
  fullscreen?: boolean;
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
          rows={data.series.map((s) => ({ key: s.key, label: s.label, colour: s.colour, value: changeOver(s.values)?.delta ?? null }))}
          focusKey={focusKey}
          formatValue={measure.formatDelta}
        />
      </CentredOnTarget>
    );
  }
  const indexed = shouldIndex(measure.aggregate);
  const series: PanelSeries[] = data.series.map((s) => ({ ...s, comparison: false, values: indexed ? indexTo100(s.values) : s.values }));
  let lines = series;
  let band: { min: (number | null)[]; max: (number | null)[]; label: string } | undefined;
  if (curated) {
    const m = topMovers(series, focusKey);
    lines = [...m.standouts, ...(m.focus ? [m.focus] : [])];
    if (m.rest.length) band = { ...bandOf(m.rest, data.periods.length), label: `${restLabel} (${m.rest.length})` };
  }
  return (
    <TrendChart
      data={{ periods: data.periods, series: lines }}
      measure={indexed ? INDEX_MEASURE : measure}
      showFit={showFit}
      fullscreen={fullscreen}
      focusKey={focusKey ?? undefined}
      reference={indexed ? { value: 100, label: "100 = first year shown" } : undefined}
      band={band}
    />
  );
}

// ----------------------------------------------------------------- ChangeList

export type ChangeRow = { key: string; label: string; colour: string; value: number | null };

// A % change, rounded, with its sign: ChangeList's default formatting.
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
}: {
  rows: ChangeRow[];
  focusKey: string | null;
  group?: { label: string; value: number | null };
  // How a row's value prints, sign included, as ViewChart's formatValue: the measure
  // formats its own values. Absent = a rounded, signed % change.
  formatValue?: (v: number) => string;
}) {
  const format = formatValue ?? signedPercent;
  // The tone follows the printed figure: a % change is shown rounded, so "+0%" reads flat.
  const dirOf = (v: number | null) => directionOf(v === null ? null : formatValue ? v : Math.round(v));
  const ranked = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const real = ranked.filter((r) => r.value !== null).map((r) => Math.abs(r.value!));
  if (real.length === 0) return <p className="text-xs text-[var(--muted)]">No two years of published figures to compare yet.</p>;
  const maxAbs = Math.max(...real, group?.value !== null && group?.value !== undefined ? Math.abs(group.value) : 0) || 1;
  // Half the track either side of zero, with a little room so the longest bar never
  // touches the edge.
  const pos = (v: number) => 50 + (v / maxAbs) * 46;
  // Nulls sort last, so a row's rank is simply its position among the real ones.
  return (
    <div className="flex flex-col gap-1.5">
      {ranked.map((r, idx) => {
        const rank = idx + 1;
        const dir = dirOf(r.value);
        const focus = r.key === focusKey;
        return (
          <div key={r.key} data-highlight={focus ? "" : undefined} className="grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-2 text-[11px]">
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
            </span>
            <span className={`text-right font-semibold tabular-nums ${DIRECTION_TEXT[dir]}`}>
              {r.value === null ? "—" : format(r.value)}
            </span>
          </div>
        );
      })}
      {group && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-dashed border-[var(--panel-border2)] pt-1.5 text-[10px] text-[var(--muted2)]">
          <span className="inline-block h-3 w-0 border-l border-dashed border-[var(--fg)] opacity-60" />
          {group.label}: {group.value === null ? "no figure" : format(group.value)}
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
//
// `curate` is Option K's table: on the card, only the rows the chart draws individually
// (focus + top movers) plus one "rest" row giving a min-max range -- read from the same
// topMovers result the chart used, never a subset picked here. Fullscreen shows every row.
export function YearTable({
  data,
  measure,
  focusKey,
  fullscreen = false,
  curate,
  nameHeading = "Subject",
  showRank = true,
  leadingRank = false,
  changeEmphasis = "value",
}: {
  data: PanelData;
  measure: Measure;
  focusKey: string | null;
  fullscreen?: boolean;
  curate?: { keys: string[]; restLabel: string };
  nameHeading?: string;
  // Off where a rank means nothing -- Part 5's geography rows (England is always "1st").
  showRank?: boolean;
  // Live review Part E (the % change table): a ranked list rather than a sortable table.
  // Rows are ranked by % CHANGE -- the order the ranked list beside it uses -- and stay in
  // that order (headers are not clickable); the rank is a bare number in an unheaded first
  // column, shown on the card as well as fullscreen; padding and type tighten so name,
  // rank, both years and Change fit a card without scrolling sideways.
  leadingRank?: boolean;
  // Which half of the Change cell leads. "value" (the default, every existing table): the
  // count bold and coloured, the % small and muted beneath. "percent" (the % Change
  // geography table, where a count of 33,271 beside 53 means little): the % bold and
  // coloured, the count beneath in a legible light tone rather than near-invisible grey.
  changeEmphasis?: "value" | "percent";
}) {
  const [userSort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: showRank ? "rank" : "given", dir: 1 });
  const sort: { key: SortKey; dir: 1 | -1 } = leadingRank ? { key: "rank", dir: 1 } : userSort;
  const pad = leadingRank ? "px-1" : "px-1.5";
  const { periods, series } = data;
  if (periods.length === 0 || series.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No published figures for this comparison yet.</p>;
  }
  const yearIdx = fullscreen || periods.length <= 2 ? periods.map((_, i) => i) : [0, periods.length - 1];
  const lastIdx = periods.length - 1;

  const rows = series.map((s) => ({ s, change: changeOver(s.values), last: s.values[lastIdx] }));
  const rankOf = new Map<string, number>();
  if (leadingRank) {
    [...rows]
      .filter((r) => r.change?.percent !== null && r.change?.percent !== undefined)
      .sort((a, b) => b.change!.percent! - a.change!.percent!)
      .forEach((r, i) => rankOf.set(r.s.key, i + 1));
  } else {
    [...rows]
      .filter((r) => r.last !== null)
      .sort((a, b) => b.last! - a.last!)
      .forEach((r, i) => rankOf.set(r.s.key, i + 1));
  }
  const ranked = rankOf.size;

  const curating = !!curate && !fullscreen;
  const shown = curating ? rows.filter((r) => curate!.keys.includes(r.s.key)) : rows;
  const rest = curating ? rows.filter((r) => !curate!.keys.includes(r.s.key)) : [];

  const valueFor = (r: (typeof rows)[number], key: SortKey): number | string | null =>
    key === "given" ? 0 : key === "name" ? r.s.label : key === "rank" ? rankOf.get(r.s.key) ?? null : key === "change" ? r.change?.percent ?? null : r.s.values[key];
  const sorted = [...shown].sort((a, b) => {
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
      {leadingRank ? (
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

  const range = (vals: (number | null)[]) => {
    const real = vals.filter((v): v is number => v !== null);
    return real.length ? `${measure.format(Math.min(...real))}–${measure.format(Math.max(...real))}` : "—";
  };

  return (
    <table className={`w-full border-collapse tabular-nums ${fullscreen ? "text-[13px]" : leadingRank ? "text-[11px]" : "text-[11.5px]"}`}>
      <thead className="border-b border-[var(--panel-border2)]">
        <tr>
          {leadingRank && <th className="w-5 pb-1.5" aria-label="Rank" />}
          {head("name", nameHeading, true)}
          {/* Live review Part 4: Rank only in fullscreen. On the card it pushed the year and
              Change columns -- the figures that matter there -- out of view. The ranking
              itself still drives the default sort either way. */}
          {fullscreen && showRank && !leadingRank && head("rank", "Rank")}
          {yearIdx.map((i) => head(i, academicYearLabel(periods[i])))}
          {head("change", "Change")}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const focus = r.s.key === focusKey;
          const dir = directionOf(r.change?.delta ?? null);
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
              {fullscreen && showRank && !leadingRank && (
                <td className="whitespace-nowrap px-1.5 text-right text-[var(--muted2)]">
                  {rankOf.has(r.s.key) ? `${rankOf.get(r.s.key)} of ${ranked}` : "—"}
                </td>
              )}
              {yearIdx.map((i) => (
                <td key={periods[i]} className={`${pad} text-right ${focus ? "font-semibold" : "text-[var(--muted2)]"}`}>
                  {r.s.values[i] === null ? "—" : measure.format(r.s.values[i]!)}
                </td>
              ))}
              <td className={`whitespace-nowrap ${pad} text-right leading-tight`}>
                {changeEmphasis === "percent" ? (
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
            </tr>
          );
        })}
        {rest.length > 0 && (
          <tr className="text-[var(--muted2)]">
            <td className="px-1.5 py-[5px] text-left italic">{curate!.restLabel} ({rest.length})</td>
            {leadingRank && <td />}
            {fullscreen && showRank && !leadingRank && <td />}
            {yearIdx.map((i) => (
              <td key={periods[i]} className="whitespace-nowrap px-1.5 text-right">{range(rest.map((r) => r.s.values[i]))}</td>
            ))}
            <td className="whitespace-nowrap px-1.5 text-right text-[10px]">range, not summed</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// The curated keys Option K's chart draws, for YearTable's `curate` -- the same topMovers
// call on the same (indexed where the chart indexes) values, so the two cannot disagree.
export function curatedKeys(data: PanelData, measure: Measure, focusKey: string | null): string[] {
  const indexed = shouldIndex(measure.aggregate);
  const series = data.series.map((s) => ({ ...s, values: indexed ? indexTo100(s.values) : s.values }));
  const m = topMovers(series, focusKey);
  return [...(m.focus ? [m.focus.key] : []), ...m.standouts.map((s) => s.key)];
}
