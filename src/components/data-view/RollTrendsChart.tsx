"use client";

// Graphs redesign v1 (docs/vicdata_phase3_member_data_view_graphs_redesign_v1.md),
// Section 01's main graph: one line per school in the comparator set, all shown by
// default, fixed stable colour per school (school-series-colours.ts -- assigned by
// first-seen URN order, never repainted when the set changes), legend below, a
// toggle for a computed "average of all other schools" line, every year on the
// x-axis with a gridline each, real y-axis value labels.
//
// 2026-09-08: the average toggle is a MODE SWITCH, not an overlay -- selecting it
// hides every individual school's line (and legend entry) entirely, showing just the
// average line on its own, per Guy's explicit request. Toggling back off restores all
// individual lines.
//
// Whole-school roll only, same simplification the previous RollTrendChart (the old
// DashboardView.tsx) made and logged: the line always plots each school's unfiltered
// total, not the currently-filtered phase slice.
//
// Replaces DashboardView.tsx's old inline RollTrendChart, which had no y-axis labels
// or gridlines at all -- the exact gap this brief calls out.

import { useState } from "react";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import type { DataViewFilterState } from "@/lib/data-view-filters";
import { assignSeriesColours, seriesColourVar, seriesColourCssVars, type SeriesColourMap } from "@/lib/school-series-colours";

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

  const seriesFor = (s: DataViewSchoolProfile) => periods.map((p) => s.trend.find((t) => t.period === p)?.totalRoll ?? null);
  const allSeries = group.map((s) => ({ urn: s.urn, name: s.name, isTarget: s.urn === target.urn, values: seriesFor(s) }));

  const averageSeries = periods.map((_, i) => {
    const others = group.filter((s) => s.urn !== target.urn).map((s) => allSeries.find((a) => a.urn === s.urn)!.values[i]).filter((v): v is number => v !== null);
    return others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : null;
  });

  // Selecting the average is a mode switch, not an overlay: it replaces every
  // individual school's line (2026-09-08, per Guy's explicit request) rather than
  // adding to them, so the axis scale should reflect only what's actually drawn.
  const allValues = showAverage
    ? averageSeries.filter((v): v is number => v !== null)
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

        {!showAverage &&
          allSeries.map((s) => (
            <g key={s.urn}>
              <path
                d={pathFor(s.values)}
                fill="none"
                stroke={seriesColourVar(s.urn, target.urn)}
                strokeWidth={s.isTarget ? 3 : 1.75}
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
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-full border-t-2 border-dashed border-current opacity-60" />
              Average of all other schools
            </span>
          ) : (
            allSeries.map((s) => (
              <span key={s.urn} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: seriesColourVar(s.urn, target.urn) }} />
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
