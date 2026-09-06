"use client";

// Graphs redesign v1 (docs/vicdata_phase3_member_data_view_graphs_redesign_v1.md),
// Section 01's main graph: one line per school in the comparator set, all shown by
// default, fixed stable colour per school (school-series-colours.ts -- assigned by
// first-seen URN order, never repainted when the set changes), legend below, a
// toggle for a computed "average of all other schools" line, every year on the
// x-axis with a gridline each, real y-axis value labels.
//
// 2026-09-08: the average toggle is a MODE SWITCH, not an overlay -- selecting it
// hides every OTHER individual school's line (and legend entry), keeping only the
// focus school's own line against the average, per Guy's explicit request ("so we can
// see clearly how it is doing in relation to average local trends"). Toggling back
// off restores every individual line.
//
// 2026-09-08: plots each school's FILTERED per-period total (phase/age/gender/
// boarding, whichever is active), not the flat whole-school totalRoll -- per Guy's
// report that the age filter (and, by the same gap, every other filter) visibly
// changed Current Roll/Growth-Decline but silently did nothing to this chart. Uses
// the same filteredCount(profileToFilterableDataForPeriod(...)) pairing GraphsView
// already applies to a single anchor period (data-view-cards.ts's own established
// pattern), just repeated across every period on the x-axis rather than one point --
// ageGenderCountsByPeriod (data-view-profiles.ts) already holds a real breakdown for
// every trend period, so this is no new data dependency, only reusing more of what
// was already fetched. This also replaces the OLD DashboardView.tsx RollTrendChart's
// logged "whole-school roll only" simplification, which is now a real gap fixed
// rather than a standing decision.
//
// Replaces DashboardView.tsx's old inline RollTrendChart, which had no y-axis labels
// or gridlines at all -- the exact gap this brief calls out.
//
// 2026-09-08: once more than 7 non-focus schools are on screen, the 7-hue palette
// wraps and line-type (solid/dashed/dotted) becomes a secondary encoding for colour
// (school-series-colours.ts's own assignSeriesColours) -- standard composite
// encoding, per Guy's explicit request, rather than generating extra
// low-distinctness hues. The legend's LineSwatch reflects both.

import { useState } from "react";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { profileToFilterableDataForPeriod } from "@/lib/data-view-serialize";
import { assignSeriesColours, seriesColourVar, seriesColourCssVars, seriesDashArray, type SeriesColourMap } from "@/lib/school-series-colours";

// A small coloured (and, where the palette's run out, dashed/dotted) line swatch --
// used both for the chart's own legend and, implicitly, matches each series' own
// <path> styling exactly, so the legend is never a simplified stand-in for what's
// actually drawn.
function LineSwatch({ colour, dashArray, opacity = 1 }: { colour: string; dashArray?: string; opacity?: number }) {
  return (
    <svg width={16} height={8} className="shrink-0">
      <line x1={0} y1={4} x2={16} y2={4} stroke={colour} strokeOpacity={opacity} strokeWidth={2} strokeDasharray={dashArray} strokeLinecap="round" />
    </svg>
  );
}

function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

export default function RollTrendsChart({
  target,
  group,
  filters,
  showAverage,
  onToggleAverage,
}: {
  target: DataViewSchoolProfile;
  group: DataViewSchoolProfile[];
  filters: DataViewFilterState;
  showAverage: boolean;
  onToggleAverage: () => void;
}) {
  // Persisted across renders -- the whole point of "stable colour" is that it
  // survives the comparator set changing shape, not just re-renders of this one.
  // assignSeriesColours is pure (returns a new Map, never mutates `colours`), so
  // adjusting state directly during render here is React's own documented pattern
  // for derived state (https://react.dev/reference/react/useState#storing-information-
  // from-previous-renders) -- a ref write during render is what the new
  // react-hooks/refs rule actually forbids, not this.
  const [colours, setColours] = useState<SeriesColourMap>(() => new Map());
  const urns = group.map((s) => s.urn);
  const nextColours = assignSeriesColours(colours, urns, target.urn);
  if (nextColours.size !== colours.size) {
    setColours(nextColours);
  }

  const periods = Array.from(new Set(group.flatMap((s) => s.trend.map((t) => t.period))))
    .filter((p) => p >= filters.startPeriod)
    .sort((a, b) => a - b);

  if (periods.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough real history to plot a trend from {academicYearLabel(filters.startPeriod)}.</p>;
  }

  // Guards the same "no real data for this school at this period" gap the old
  // ?? null fallback preserved -- ageGenderCountsByPeriod is built from this exact
  // school's own trend array (data-view-profiles.ts), so absence here means genuinely
  // no data, not zero; profileToFilterableDataForPeriod's own empty-Map fallback
  // would otherwise silently read as a real 0 via filteredCount.
  const seriesFor = (s: DataViewSchoolProfile) =>
    periods.map((p) => (s.ageGenderCountsByPeriod.has(p) ? filteredCount(profileToFilterableDataForPeriod(s, p), filters).total : null));
  const allSeries = group.map((s) => ({ urn: s.urn, name: s.name, isTarget: s.urn === target.urn, values: seriesFor(s) }));

  const averageSeries = periods.map((_, i) => {
    const others = group.filter((s) => s.urn !== target.urn).map((s) => allSeries.find((a) => a.urn === s.urn)!.values[i]).filter((v): v is number => v !== null);
    return others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : null;
  });

  const targetSeries = allSeries.find((s) => s.isTarget)!;

  // Selecting the average is a mode switch, not an overlay: it replaces every OTHER
  // school's line with the average (2026-09-08, per Guy's explicit request) while
  // keeping the focus school's own line, so the axis scale should reflect only what's
  // actually drawn.
  const allValues = showAverage
    ? [...averageSeries, ...targetSeries.values].filter((v): v is number => v !== null)
    : allSeries.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const maxY = Math.max(...allValues) * 1.05;
  const minY = 0;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;

  function pathFor(values: (number | null)[]): string {
    let d = "";
    let started = false;
    values.forEach((v, i) => {
      if (v === null) return;
      d += `${started ? "L" : "M"}${x(i)},${y(v)} `;
      started = true;
    });
    return d.trim();
  }

  const yTicks = [0, maxY / 2, maxY].map((v) => Math.round(v / 10) * 10);
  const { light: cssLight, dark: cssDark } = seriesColourCssVars(nextColours);

  return (
    <div className="roll-trends-root">
      <style>{`
        .roll-trends-root { ${cssLight} }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .roll-trends-root { ${cssDark} }
        }
        :root[data-theme="dark"] .roll-trends-root { ${cssDark} }
      `}</style>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill="currentColor" fillOpacity={0.5} textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {periods.map((p, i) => (
          <g key={p}>
            <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
            <text x={x(i)} y={HEIGHT - 8} fontSize={10} fill="currentColor" fillOpacity={0.5} textAnchor="middle">
              {academicYearLabel(p)}
            </text>
          </g>
        ))}

        {showAverage && (
          <path d={pathFor(averageSeries)} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" strokeWidth={1.5} />
        )}

        {(showAverage ? [targetSeries] : allSeries).map((s) => (
            <g key={s.urn}>
              <path
                d={pathFor(s.values)}
                fill="none"
                stroke={seriesColourVar(s.urn, target.urn)}
                strokeWidth={s.isTarget ? 3 : 1.75}
                strokeDasharray={seriesDashArray(nextColours, s.urn, target.urn)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r={s.isTarget ? 2.5 : 1.75} fill={seriesColourVar(s.urn, target.urn)}>
                    <title>
                      {s.name}: {v.toLocaleString()} ({academicYearLabel(periods[i])})
                    </title>
                  </circle>
                ),
              )}
            </g>
          ))}
      </svg>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          {showAverage ? (
            <>
              <span className="flex items-center gap-1.5">
                <LineSwatch colour={seriesColourVar(target.urn, target.urn)} />
                {target.name}
                <span className="text-neutral-400">(this school)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <LineSwatch colour="currentColor" dashArray="4 3" opacity={0.4} />
                Average of all other schools
              </span>
            </>
          ) : (
            allSeries.map((s) => (
              <span key={s.urn} className="flex items-center gap-1.5">
                <LineSwatch colour={seriesColourVar(s.urn, target.urn)} dashArray={seriesDashArray(nextColours, s.urn, target.urn)} />
                {s.name}
                {s.isTarget && <span className="text-neutral-400">(this school)</span>}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={onToggleAverage}
          className={
            showAverage
              ? "shrink-0 rounded border border-neutral-400 px-2 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-500 dark:text-neutral-300"
              : "shrink-0 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-400"
          }
        >
          {showAverage ? "Hide" : "Show"} average of all other schools
        </button>
      </div>
    </div>
  );
}
