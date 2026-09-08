"use client";

// Member Data View Graphs (docs/vicdata_phase3_member_data_view_graphs_redesign_v1.md):
// replaces the old Dashboard's five-card grid with a scrollable, sectioned layout.
// This round builds Section 01 (Overview) in full; Sections 02 (Market share) and 03
// (Gender split) are scaffolded so a later round can fill/extend them without another
// structural rebuild.
//
// 2026-09-08, Graphs redesign v1, logged decisions (docs/vicdata_data_view_open_
// questions.md has the full reasoning):
//   - "Sectioned like the public home page" doesn't literally match either candidate
//     page (the real public home page has no sections at all; the School profile
//     page's ComingSoonCard grid isn't headed sections either) -- built fresh to the
//     brief's own described SHAPE (numbered, headed, scrollable sections) instead,
//     same precedent this file's own DataViewShell.tsx already set for its topic-tab
//     row ("built fresh here to match the brief's own described shape... rather than
//     a pattern that doesn't actually exist yet to copy").
//   - Boarding Split (a real card in the old Dashboard) has no named home anywhere in
//     this brief -- only Gender Split is explicitly "ported over," and only Market
//     share gets a reserved heading-only section. Dropped rather than folded into an
//     unrequested new section; flagged in case it should become one.
//   - Focus-school red (main graph) vs. the growth/decline chart's blue/red
//     direction encoding is a real, acknowledged collision -- kept as specified
//     (Guy's own explicit instruction), logged as provisional.
//
// 2026-09-08, redesign doc updated with two additions -- see
// docs/vicdata_data_view_open_questions.md for the full reasoning on both:
//   - Section 01 gained a new "Combined Roll" lollipop-plus-trend-line chart
//     directly under Roll Trends, in the main column, as a large chart -- moved
//     there from the right-hand tile column per Guy's own follow-up refinement
//     (CombinedRollChart.tsx).
//   - Section 02 (Market share) got its full spec: a single-series share-over-time
//     chart plus two secondary tiles reusing the SAME bar-chart/diverging-chart
//     components Section 01 already established (CurrentRollBarChart and
//     GrowthDeclineChart generalised into SortedBarChart/DivergingBarChart so both
//     sections share one implementation each, per the doc's own "same pattern as
//     Section 01" wording).

import { useState } from "react";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { profileToFilterableData as toFilterable, profileToFilterableDataForPeriod as toFilterableForPeriod } from "@/lib/data-view-serialize";
import { trendBadge, spreadData, shapeInlineFact, sizeBand, type TrendBadge } from "@/lib/data-view-cards";
import { shapeClassifierInput } from "@/lib/roll-data";
import { classifyShape } from "@/lib/shape-classifier";
import { graphTitlePrefix } from "@/lib/data-view-summary";
import type { AggregateTrends } from "@/lib/aggregate-trends";
import SpreadStrip from "./SpreadStrip";
import RollTrendsChart from "./RollTrendsChart";
import SortedBarChart from "./SortedBarChart";
import DivergingBarChart from "./DivergingBarChart";
import CombinedRollChart from "./CombinedRollChart";
import MarketShareTrendChart from "./MarketShareTrendChart";
import AggregateTrendChart, {
  AGGREGATE_TARGET_COLOUR,
  AGGREGATE_REGION_COLOUR,
  AGGREGATE_NATION_COLOUR,
  AGGREGATE_SECTOR_COLOUR,
  type AggregateChartSeries,
} from "./AggregateTrendChart";

function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

function TrendPill({ badge, startPeriod }: { badge: TrendBadge; startPeriod: number }) {
  if (!badge) return <span className="text-xs text-neutral-400">no {academicYearLabel(startPeriod)} comparison</span>;
  const arrow = badge.direction === "up" ? "▲" : badge.direction === "down" ? "▼" : "▬";
  const colour =
    badge.direction === "up" ? "text-blue-600 dark:text-blue-400" : badge.direction === "down" ? "text-red-600 dark:text-red-400" : "text-neutral-500";
  return (
    <span className={`text-xs font-medium ${colour}`}>
      {arrow} {Math.abs(badge.pctChange).toFixed(0)}% since {academicYearLabel(startPeriod)}
    </span>
  );
}

// 2026-09-08, per direct request: a short prose trend statement for the Combined
// Roll chart ("growing/declining/broadly stable"), reusing trendBadge()'s own
// direction/threshold classification and TrendPill's own colour convention above --
// not new wording or a new threshold, just a worded rendering of the same
// up/down/flat call instead of an arrow+bare-percent badge.
function TrendStatement({ badge, startPeriod }: { badge: TrendBadge; startPeriod: number }) {
  if (!badge) return null;
  const word = badge.direction === "up" ? "Growing" : badge.direction === "down" ? "Declining" : "Broadly stable";
  const colour =
    badge.direction === "up" ? "text-blue-600 dark:text-blue-400" : badge.direction === "down" ? "text-red-600 dark:text-red-400" : "text-neutral-500";
  return (
    <p className={`mt-2 text-xs font-medium ${colour}`}>
      {word} ({badge.pctChange >= 0 ? "+" : ""}
      {badge.pctChange.toFixed(0)}% since {academicYearLabel(startPeriod)})
    </p>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
      <span className="text-neutral-300 dark:text-neutral-700">{number}</span>
      {title}
    </h2>
  );
}

export default function GraphsView({
  targetProfile,
  tickedProfiles,
  filters,
  filterSummary,
  isLargeSet,
  aggregateTrends,
}: {
  targetProfile: DataViewSchoolProfile;
  tickedProfiles: DataViewSchoolProfile[];
  filters: DataViewFilterState;
  filterSummary: string | null;
  // Large-set design v1, item 5: true whenever the active comparator set is
  // Region/Nation-scale (DataViewShell's own LARGE_SET_PROFILE_THRESHOLD) -- swaps
  // Section 01/02's per-school-mark charts (which only ever have real data for
  // whatever's individually ticked at this scale, large-set design v1 item 6) for the
  // new aggregate-lines chart. Section 03 (Gender split) is unaffected -- not in the
  // design doc's own list of charts that need replacing at scale.
  isLargeSet?: boolean;
  aggregateTrends?: AggregateTrends | null;
}) {
  const [showAverage, setShowAverage] = useState(false);

  // The ticked group always includes the target itself as a real reference point
  // (SchoolMap.tsx's own established "the viewed school's roll is a real data point
  // in the domain, not excluded from it").
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];

  // 2026-09-08, per direct request, applies everywhere in Graphs (Roll Trends,
  // Current Roll, the Combined Roll chart, Growth/decline, and both Market-share
  // charts): a school with zero real pupils in the currently active age/phase
  // bracket is excluded entirely, not shown as a flat-zero line or an empty bar.
  // Evaluated once, from each school's CURRENT filtered total (the same "is this
  // school currently in scope" question every other current-period figure on this
  // page already asks) -- a school that qualifies stays in scope across every
  // period on a chart (its own real history, including any period where it happens
  // to be genuinely zero, isn't erased), only a school that's out of scope RIGHT NOW
  // is dropped. The focus school is the one exception, per this codebase's
  // established "the viewed school is always a real reference point, never
  // excluded" rule (SchoolMap.tsx's own comment) -- shown even at a genuine zero,
  // same as its own stat tile already honestly would. Deliberately NOT applied to
  // Section 03's gender split, which Guy's own list of affected charts didn't
  // include -- that chart already excludes a zero-total school on its own (spreadData
  // filters out null values, and a zero-total school's female/total ratio is already
  // computed as null), so no separate rule was needed there anyway.
  const currentFilteredTotal = new Map(group.map((p) => [p.urn, filteredCount(toFilterable(p), filters).total] as const));
  const groupInScope = group.filter((p) => p.urn === targetProfile.urn || (currentFilteredTotal.get(p.urn) ?? 0) > 0);

  const anchorSnapshot = (p: DataViewSchoolProfile) => p.trend.find((t) => t.period === filters.startPeriod) ?? null;

  const currentPoints = groupInScope.map((p) => ({
    urn: p.urn,
    name: p.name,
    value: currentFilteredTotal.get(p.urn) ?? 0,
    isTarget: p.urn === targetProfile.urn,
  }));
  const anchorPoints = groupInScope.map((p) => ({
    urn: p.urn,
    value: anchorSnapshot(p) ? filteredCount(toFilterableForPeriod(p, filters.startPeriod), filters).total : null,
  }));
  const targetCurrent = currentPoints.find((p) => p.isTarget)?.value ?? null;
  const targetAnchor = anchorPoints.find((p) => p.urn === targetProfile.urn)?.value ?? null;
  const rollTrendBadge = trendBadge(targetCurrent, targetAnchor);

  const growthPoints = groupInScope.map((p, i) => ({
    urn: p.urn,
    name: p.name,
    isTarget: p.urn === targetProfile.urn,
    pctChange: trendBadge(currentPoints[i].value, anchorPoints[i].value)?.pctChange ?? null,
  }));

  // Shared timeline + per-school filtered series for the new Combined Roll chart
  // (Section 01) and the whole of Market share (Section 02) -- same
  // filteredCount(profileToFilterableDataForPeriod(...)) pairing RollTrendsChart
  // already applies per school, summed/ratioed across the group here instead of
  // rendered as separate lines. ageGenderCountsByPeriod.has(p) guards the same
  // "genuinely no data for this school this period" gap RollTrendsChart's own
  // seriesFor guards -- absence means no data, not a real zero.
  const periods = Array.from(new Set(groupInScope.flatMap((s) => s.trend.map((t) => t.period))))
    .filter((p) => p >= filters.startPeriod)
    .sort((a, b) => a - b);
  const latestIdx = periods.length - 1;
  const earliestIdx = 0;
  const perSchoolFilteredSeries = groupInScope.map((s) => ({
    urn: s.urn,
    name: s.name,
    isTarget: s.urn === targetProfile.urn,
    values: periods.map((p) => (s.ageGenderCountsByPeriod.has(p) ? filteredCount(toFilterableForPeriod(s, p), filters).total : null)),
  }));
  const combinedByPeriod = periods.map((_, i) => {
    const vals = perSchoolFilteredSeries.map((s) => s.values[i]).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  });
  const combinedRollBadge = trendBadge(combinedByPeriod[latestIdx] ?? null, combinedByPeriod[earliestIdx] ?? null);

  const targetFilteredSeries = perSchoolFilteredSeries.find((s) => s.isTarget)!.values;
  const marketShareByPeriod = periods.map((_, i) => {
    const combined = combinedByPeriod[i];
    const t = targetFilteredSeries[i];
    return combined && combined > 0 && t !== null ? (t / combined) * 100 : null;
  });

  const shareAt = (values: (number | null)[], idx: number) => {
    const combined = combinedByPeriod[idx];
    const v = values[idx];
    return combined && combined > 0 && v !== null ? (v / combined) * 100 : null;
  };
  const marketShareBarPoints = perSchoolFilteredSeries.map((s) => ({
    urn: s.urn,
    name: s.name,
    isTarget: s.isTarget,
    value: shareAt(s.values, latestIdx) ?? 0,
  }));
  const marketShareGrowthPoints = perSchoolFilteredSeries.map((s) => {
    const early = shareAt(s.values, earliestIdx);
    const late = shareAt(s.values, latestIdx);
    return { urn: s.urn, name: s.name, isTarget: s.isTarget, pctChange: early !== null && late !== null ? late - early : null };
  });

  const genderPoints = group.map((p) => {
    const c = filteredCount(toFilterable(p), filters);
    const pct = c.female !== null && c.total > 0 ? (c.female / c.total) * 100 : null;
    return { urn: p.urn, name: p.name, value: pct, isTarget: p.urn === targetProfile.urn };
  });
  const targetGenderCurrent = genderPoints.find((p) => p.isTarget)?.value ?? null;
  const targetGenderAnchorCount = anchorSnapshot(targetProfile) ? filteredCount(toFilterableForPeriod(targetProfile, filters.startPeriod), filters) : null;
  const targetGenderAnchor =
    targetGenderAnchorCount && targetGenderAnchorCount.female !== null && targetGenderAnchorCount.total > 0
      ? (targetGenderAnchorCount.female / targetGenderAnchorCount.total) * 100
      : null;
  const genderTrendBadge = trendBadge(targetGenderCurrent, targetGenderAnchor);
  const genderSpread = spreadData(genderPoints);

  // Brief's own rule: hide Gender split entirely for a confirmed single-sex school
  // (typology.ts's GenderTag -- only a real "Boys"/"Girls" value triggers this, never
  // "Co-ed" or an unknown/null tag).
  const isSingleSex = targetProfile.gender === "Boys" || targetProfile.gender === "Girls";

  const anchorAgeGenderCounts = targetProfile.ageGenderCountsByPeriod.get(filters.startPeriod) ?? targetProfile.ageGenderCounts2019;
  const anchorShape = classifyShape(shapeClassifierInput(anchorAgeGenderCounts))?.label ?? null;
  const shapeFact = shapeInlineFact(anchorShape, targetProfile.shapeCurrent, academicYearLabel(filters.startPeriod));

  let sizeBandLine: string | null = null;
  if (filters.phaseBands.size > 0 && targetProfile.phase.length > 1) {
    const wholeValues = groupInScope.map((p) => filteredCount(toFilterable(p), { ...filters, phaseBands: new Set(), ages: new Set() }).total);
    const wholeTarget = wholeValues[groupInScope.findIndex((p) => p.urn === targetProfile.urn)];
    const wholeBand = sizeBand(wholeTarget, Math.min(...wholeValues), Math.max(...wholeValues));
    const filteredValues = currentPoints.map((p) => p.value);
    const filteredBand = sizeBand(targetCurrent ?? 0, Math.min(...filteredValues), Math.max(...filteredValues));
    if (wholeBand !== filteredBand) {
      const bandLabel = [...filters.phaseBands].join("/");
      sizeBandLine = `${wholeBand} overall · ${filteredBand} as a ${bandLabel} school`;
    }
  }

  const titlePrefix = graphTitlePrefix(filters, targetProfile);
  const rollTrendsTitle = `${titlePrefix ? `${titlePrefix} ` : ""}Roll Trends since ${academicYearLabel(filters.startPeriod)}`;
  // 2026-09-08, per direct request: explicitly names "selected schools" since this
  // is the sum across the whole comparator set, not the focus school's own figure --
  // easy to misread as a second "Current Roll" otherwise.
  const combinedRollTitle = `${titlePrefix ? `${titlePrefix} ` : ""}Combined roll of selected schools since ${academicYearLabel(filters.startPeriod)}`;
  const marketShareTitle = `${titlePrefix ? `${titlePrefix} ` : ""}Market Share since ${academicYearLabel(filters.startPeriod)}`;

  // Large-set design v1, item 5: the target's own real, WHOLE-SCHOOL roll trend
  // (not filtered by the active phase/gender/boarding filter -- roll_aggregates'
  // own region/nation/sector lines are whole-school totals too, at a fixed 5-band
  // granularity that can't honour the same phase/age slicing filteredCount() does;
  // see AggregateTrendChart.tsx's own header comment). Only built/rendered when
  // isLargeSet -- cheap either way (targetProfile.trend already exists), but no
  // reason to compute it for a small/medium set that will never render this chart.
  const aggregateSeries: AggregateChartSeries[] = isLargeSet
    ? [
        {
          key: "target",
          label: targetProfile.name,
          colourLight: AGGREGATE_TARGET_COLOUR.light,
          colourDark: AGGREGATE_TARGET_COLOUR.dark,
          points: targetProfile.trend.filter((t) => t.period >= filters.startPeriod).map((t) => ({ period: t.period, value: t.totalRoll })),
        },
        ...(aggregateTrends?.region
          ? [
              {
                key: "region",
                label: aggregateTrends.region.label,
                colourLight: AGGREGATE_REGION_COLOUR.light,
                colourDark: AGGREGATE_REGION_COLOUR.dark,
                points: aggregateTrends.region.points.map((p) => ({ period: p.period, value: p.totalRoll })),
              },
            ]
          : []),
        ...(aggregateTrends?.national
          ? [
              {
                key: "nation",
                label: aggregateTrends.national.label,
                colourLight: AGGREGATE_NATION_COLOUR.light,
                colourDark: AGGREGATE_NATION_COLOUR.dark,
                points: aggregateTrends.national.points.map((p) => ({ period: p.period, value: p.totalRoll })),
              },
            ]
          : []),
        ...(aggregateTrends?.sector
          ? [
              {
                key: "sector",
                label: `${aggregateTrends.sector.label} nationally`,
                colourLight: AGGREGATE_SECTOR_COLOUR.light,
                colourDark: AGGREGATE_SECTOR_COLOUR.dark,
                points: aggregateTrends.sector.points.map((p) => ({ period: p.period, value: p.totalRoll })),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-8">
      {filterSummary && <p className="text-xs text-neutral-400">Filtered: {filterSummary}</p>}

      {isLargeSet ? (
        <section>
          <SectionHeading number="01" title="Overview" />
          <Card title={`${targetProfile.name} vs region, nation and sector since ${academicYearLabel(filters.startPeriod)}`}>
            {aggregateTrends === undefined || aggregateTrends === null ? (
              <p className="text-sm text-neutral-500">Loading region/nation/sector comparison…</p>
            ) : (
              <AggregateTrendChart series={aggregateSeries} />
            )}
          </Card>
          <p className="mt-2 text-xs text-neutral-400">
            At this scale, Graphs compares whole-school roll trends only -- phase/age-band filters aren&rsquo;t reflected in this chart (gender and
            boarding filters don&rsquo;t apply to a trend chart either way).
          </p>
        </section>
      ) : (
        <>
          <section>
            <SectionHeading number="01" title="Overview" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-4 lg:col-span-2">
                <Card title={rollTrendsTitle}>
                  <RollTrendsChart target={targetProfile} group={groupInScope} filters={filters} showAverage={showAverage} onToggleAverage={() => setShowAverage((v) => !v)} />
                </Card>
                <Card title={combinedRollTitle}>
                  <CombinedRollChart periods={periods} values={combinedByPeriod} />
                  <TrendStatement badge={combinedRollBadge} startPeriod={filters.startPeriod} />
                </Card>
              </div>
              <div className="flex flex-col gap-4">
                <Card title="Current roll">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">{targetCurrent?.toLocaleString() ?? "—"}</span>
                    <TrendPill badge={rollTrendBadge} startPeriod={filters.startPeriod} />
                  </div>
                  {shapeFact && <p className="mb-2 text-xs text-neutral-500">{shapeFact}</p>}
                  {sizeBandLine && <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">{sizeBandLine}</p>}
                  <SortedBarChart points={currentPoints} />
                </Card>
                <Card title={`Growth / decline since ${academicYearLabel(filters.startPeriod)}`}>
                  <DivergingBarChart points={growthPoints} />
                </Card>
              </div>
            </div>
          </section>

          <section>
            {/* 2026-09-08, per direct request: names the focus school specifically
                ("Acland Burghley School's market share"), dynamic per school -- not a
                static "Market share" label. */}
            <SectionHeading number="02" title={`${targetProfile.name}'s market share`} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card title={marketShareTitle}>
                  <MarketShareTrendChart periods={periods} values={marketShareByPeriod} />
                </Card>
              </div>
              <div className="flex flex-col gap-4">
                <Card title={`Market share, ${academicYearLabel(periods[latestIdx] ?? filters.startPeriod)}`}>
                  <SortedBarChart points={marketShareBarPoints} formatValue={(v) => `${v.toFixed(0)}%`} />
                </Card>
                <Card title={`Market-share growth / decline since ${academicYearLabel(filters.startPeriod)}`}>
                  <DivergingBarChart points={marketShareGrowthPoints} formatValue={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`} />
                </Card>
              </div>
            </div>
          </section>
        </>
      )}

      {!isSingleSex && (
        <section>
          <SectionHeading number="03" title="Gender split" />
          <Card title="Gender split">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{targetGenderCurrent !== null ? `${targetGenderCurrent.toFixed(0)}% girls` : "—"}</span>
              <TrendPill badge={genderTrendBadge} startPeriod={filters.startPeriod} />
            </div>
            {genderSpread && <SpreadStrip min={genderSpread.min} max={genderSpread.max} points={genderSpread.points} formatValue={(v) => `${v.toFixed(0)}%`} />}
          </Card>
        </section>
      )}
    </div>
  );
}
