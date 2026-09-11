"use client";

// Member Data View large-set design v1, item 5: Graphs' new large-set chart type --
// the target school's own real roll trend plotted against region/nation/sector
// AGGREGATE trend lines (roll_aggregates), not a per-school-mark chart. The one
// genuinely new UI component this round adds (everything else is a data-layer change
// feeding existing display logic).
//
// Plotted as an INDEX (each series set to 100 at the first period all real series
// share), not absolute headcounts: a single school's roll (hundreds/low thousands)
// and England's (~8 million) are different orders of magnitude entirely -- on a
// shared absolute y-axis the target's own line would be indistinguishable from a
// flat line at the bottom. Indexing is the standard way to compare growth trends
// across series at wildly different scales, and it's what "vs its own trend" (Guy's
// own framing in the design doc) actually means -- real totals are still shown in
// each point's tooltip and the legend's own current-total line, nothing is hidden,
// just RESCALED for comparability. Logged as a decision in
// docs/vicdata_data_view_open_questions.md.
//
// Same SVG-line-chart shape as RollTrendsChart.tsx (this file's own established
// pattern for a multi-series trend chart) -- deliberately not reusing that component
// directly, since its whole data model is per-SCHOOL series from DataViewSchoolProfile
// objects, not a mix of one real school trend and three precomputed aggregate series.

import { FOCUS_SCHOOL_COLOUR } from "@/lib/school-series-colours";

export type AggregateChartSeries = { key: string; label: string; colourLight: string; colourDark: string; points: { period: number; value: number }[] };

function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

const WIDTH = 640;
const HEIGHT = 280;
// Follow-up round (2026-09-16), item 6: widened -- same real-label-spilling-past-
// the-edge fix as CombinedRollChart.tsx/TargetRollBarChart.tsx/
// RollTrendsChart.tsx. See CombinedRollChart.tsx's own comment for the full
// reasoning.
const PAD = { top: 16, right: 32, bottom: 28, left: 64 };

function LineSwatch({ colour }: { colour: string }) {
  return (
    <svg width={16} height={8} className="shrink-0">
      <line x1={0} y1={4} x2={16} y2={4} stroke={colour} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export default function AggregateTrendChart({ series }: { series: AggregateChartSeries[] }) {
  const periods = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.period)))).sort((a, b) => a - b);

  if (periods.length < 2 || series.every((s) => s.points.length < 2)) {
    return <p className="text-sm text-neutral-500">Not enough real history to plot a trend.</p>;
  }

  // Index each series to 100 at ITS OWN earliest real point within `periods` -- a
  // series missing its very first year (e.g. a school that opened after 2019, or a
  // sector row not yet backfilled that far) still gets a real index line from
  // whichever real point it does start at, rather than being dropped entirely.
  const indexed = series
    .map((s) => {
      const byPeriod = new Map(s.points.map((p) => [p.period, p.value]));
      const firstReal = periods.find((p) => byPeriod.has(p) && (byPeriod.get(p) ?? 0) > 0);
      if (firstReal === undefined) return null;
      const base = byPeriod.get(firstReal)!;
      return {
        ...s,
        values: periods.map((p) => (byPeriod.has(p) ? (byPeriod.get(p)! / base) * 100 : null)),
        raw: periods.map((p) => byPeriod.get(p) ?? null),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (indexed.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough real history to plot a trend.</p>;
  }

  const allValues = indexed.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const maxY = Math.max(...allValues, 100) * 1.05;
  const minY = Math.min(...allValues, 100) * 0.95;
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

  const firstPeriod = periods[0];
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(100)} y2={y(100)} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} strokeDasharray="3 3" />
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill="currentColor" fillOpacity={0.5} textAnchor="end">
              {Math.round(t)}
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

        {indexed.map((s) => (
          <g key={s.key}>
            <path d={pathFor(s.values)} fill="none" stroke={s.colourLight} strokeWidth={s.key === "target" ? 3 : 1.75} strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={s.key === "target" ? 2.5 : 1.75} fill={s.colourLight}>
                  <title>
                    {s.label}: {s.raw[i]?.toLocaleString() ?? "—"} ({academicYearLabel(periods[i])}, index {Math.round(v)})
                  </title>
                </circle>
              ),
            )}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        {indexed.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <LineSwatch colour={s.colourLight} />
            {s.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-400">Indexed to 100 at {academicYearLabel(firstPeriod)} — real totals shown on hover.</p>
    </div>
  );
}

// Fixed semantic colours (not the per-school stable-assignment palette
// school-series-colours.ts provides -- these are fixed ROLES, not per-URN
// identities): the target school reuses this codebase's own established focus-red;
// region/nation/sector reuse three hues from that same module's palette so the whole
// page stays visually consistent, picked for clear separation from focus-red and
// from each other.
export const AGGREGATE_TARGET_COLOUR = { light: FOCUS_SCHOOL_COLOUR, dark: FOCUS_SCHOOL_COLOUR };
export const AGGREGATE_REGION_COLOUR = { light: "#2a78d6", dark: "#3987e5" };
export const AGGREGATE_NATION_COLOUR = { light: "#1baf7a", dark: "#199e70" };
export const AGGREGATE_SECTOR_COLOUR = { light: "#eda100", dark: "#c98500" };
