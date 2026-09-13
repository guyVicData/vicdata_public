"use client";

// Academic Results Graphs (frontend build brief §4): three of Rolls' own four
// sections, adapted metric-for-metric using the SAME real chart primitives Rolls'
// GraphsView.tsx already uses (SpreadStrip/spreadData, DivergingBarChart,
// SortedBarChart, Sparkline -- all confirmed genuinely generic before reuse, not
// re-implemented). Section 4 ("Subject/family breakdown", once a category is in
// view) is NOT built this round -- it needs a category/subject drill-down filter this
// round's scope didn't reach; flagged in the build report as a real, separate
// follow-up rather than half-built here.

import {
  HEADLINE_MEASURE,
  HEADLINE_LABEL,
  HEADLINE_UNIT,
  TREND_BASELINE_PERIOD,
  headlineValueAt,
  latestYear,
  stageYears,
  type AcademicSchoolProfile,
  type KsStage,
} from "@/lib/academic-data-view";
import { spreadData, trendBadge } from "@/lib/data-view-cards";
import { academicYearLabel } from "./TrendPill";
import SpreadStrip from "./SpreadStrip";
import DivergingBarChart from "./DivergingBarChart";
import SortedBarChart from "./SortedBarChart";

function formatHeadline(stage: KsStage, value: number): string {
  return HEADLINE_UNIT[stage] === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

// Small, dumb two-line trend chart (target vs. ticked-group average) -- same
// "plain inline SVG, no charting library" convention every other chart in this
// directory follows (Sparkline/SpreadStrip's own module comments). Not a shared
// component: this is the one place this codebase needs a two-series line (Rolls'
// own RollTrendsChart draws one line per SCHOOL, not a target-vs-average pair), so a
// small local implementation is clearer than forcing an unrelated existing chart to
// take on a second real shape it wasn't built for.
function TargetVsAverageTrend({ periods, targetSeries, averageSeries }: { periods: number[]; targetSeries: (number | null)[]; averageSeries: (number | null)[] }) {
  const allReal = [...targetSeries, ...averageSeries].filter((v): v is number => v !== null);
  if (allReal.length < 2 || periods.length < 2) return <p className="text-sm text-neutral-500">Not enough history to show a trend.</p>;
  const min = Math.min(...allReal);
  const max = Math.max(...allReal);
  const span = max - min || 1;
  const W = 320;
  const H = 140;
  const padX = 28;
  const padY = 14;
  const xFor = (i: number) => padX + (i / (periods.length - 1)) * (W - padX * 2);
  const yFor = (v: number) => H - padY - ((v - min) / span) * (H - padY * 2);

  function pathFor(series: (number | null)[]): string {
    const segments: string[] = [];
    let current: string[] = [];
    series.forEach((v, i) => {
      if (v === null) {
        if (current.length > 1) segments.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${i === 0 || current.length === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`);
    });
    if (current.length > 1) segments.push(current.join(" "));
    return segments.join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 480 }}>
      <line x1={padX} x2={W - padX} y1={H - padY} y2={H - padY} stroke="currentColor" strokeOpacity={0.15} />
      <path d={pathFor(averageSeries)} fill="none" stroke="#9ca3af" strokeWidth={2} />
      <path d={pathFor(targetSeries)} fill="none" stroke="#dc2626" strokeWidth={2} />
      {periods.map((p, i) => (
        <text key={p} x={xFor(i)} y={H} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.5}>
          {academicYearLabel(p)}
        </text>
      ))}
    </svg>
  );
}

export default function AcademicGraphsView({
  targetProfile,
  tickedProfiles,
  stage,
  startPeriod,
  activeSetLabel,
}: {
  targetProfile: AcademicSchoolProfile;
  tickedProfiles: AcademicSchoolProfile[];
  stage: KsStage;
  startPeriod: number;
  activeSetLabel: string | null;
}) {
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  const measureKey = HEADLINE_MEASURE[stage];
  const baseline = TREND_BASELINE_PERIOD[stage];
  const setLabel = activeSetLabel ?? "the ticked comparator set";

  const valueFor = (p: AcademicSchoolProfile, period?: number) => {
    const years = stageYears(p, stage);
    const y = period !== undefined ? years.find((yy) => yy.period === period) : latestYear(years);
    return y ? headlineValueAt(years, y.period, measureKey) : null;
  };

  const targetCurrent = valueFor(targetProfile);
  const targetAnchor = valueFor(targetProfile, baseline);
  const targetTrendBadge = trendBadge(targetCurrent, targetAnchor);

  const spreadPoints = group.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: valueFor(p) }));
  const spread = spreadData(spreadPoints);
  const groupAverage = spread ? spread.points.reduce((s, p) => s + p.value, 0) / spread.points.length : null;

  const growthPoints = group.map((p) => {
    const current = valueFor(p);
    const anchor = valueFor(p, baseline);
    return { urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, pctChange: trendBadge(current, anchor)?.pctChange ?? null };
  });

  const allPeriods = Array.from(new Set(group.flatMap((p) => stageYears(p, stage).map((y) => y.period))))
    .filter((p) => p >= Math.max(startPeriod, baseline))
    .sort((a, b) => a - b);
  const targetSeries = allPeriods.map((p) => valueFor(targetProfile, p));
  const averageSeries = allPeriods.map((p) => {
    const vals = group.map((s) => valueFor(s, p)).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  const latestPeriod = allPeriods[allPeriods.length - 1] ?? null;
  const sameYearBarPoints = latestPeriod !== null
    ? group.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: valueFor(p, latestPeriod) ?? 0 }))
    : [];

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Overview — {HEADLINE_LABEL[stage]}</h3>
        {targetCurrent !== null ? (
          <>
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">{formatHeadline(stage, targetCurrent)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {targetTrendBadge
                ? `${targetTrendBadge.direction === "up" ? "▲" : targetTrendBadge.direction === "down" ? "▼" : "▬"} ${Math.abs(targetTrendBadge.pctChange).toFixed(0)}% since ${academicYearLabel(baseline)}`
                : `no ${academicYearLabel(baseline)} comparison`}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">No real data available for this school under this key stage.</p>
        )}
        {spread && (
          <div className="mt-4">
            <SpreadStrip min={spread.min} max={spread.max} points={spread.points} formatValue={(v) => formatHeadline(stage, v)} />
            {targetCurrent !== null && groupAverage !== null && groupAverage !== 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                {Math.abs(((targetCurrent - groupAverage) / groupAverage) * 100).toFixed(0)}% {targetCurrent >= groupAverage ? "above" : "below"} the average of{" "}
                {formatHeadline(stage, groupAverage)} for {setLabel}
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Growth / decline since {academicYearLabel(baseline)}</h3>
        <p className="mb-2 text-xs text-neutral-500">Change in {HEADLINE_LABEL[stage]}, across {setLabel}.</p>
        <DivergingBarChart points={growthPoints} />
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Context over time</h3>
        <p className="mb-2 text-xs text-neutral-500">
          {targetProfile.name}&rsquo;s {HEADLINE_LABEL[stage]} compared with the average of {setLabel}, {allPeriods.length > 0 ? `${academicYearLabel(allPeriods[0])}–${academicYearLabel(allPeriods[allPeriods.length - 1])}` : ""}.
        </p>
        <TargetVsAverageTrend periods={allPeriods} targetSeries={targetSeries} averageSeries={averageSeries} />
        {latestPeriod !== null && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-neutral-500">
              {HEADLINE_LABEL[stage]}, {academicYearLabel(latestPeriod)} — {targetProfile.name} compared with {setLabel}.
            </p>
            <SortedBarChart points={sameYearBarPoints} formatValue={(v) => formatHeadline(stage, v)} />
          </div>
        )}
      </section>
    </div>
  );
}
