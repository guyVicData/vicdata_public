"use client";

// Member Data View Dashboard (brief §5): Current Roll, Roll Trend, Gender Split,
// Boarding Split, Market Share -- five cards, all driven by the same ticked group +
// shared filter state. Through-school/sixth-form behaviour: with no phase filter,
// whole-school totals; with one active, every school's value recomputes to just that
// phase's headcount (data-view-filters.ts's filteredCount already does this slicing,
// shared with Rankings so the two views can never disagree about what a filtered
// number means).

import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { profileToFilterableData, profileToFilterableData2019 } from "@/lib/data-view-serialize";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { trendBadge, spreadData, memberSetMarketShare, shapeInlineFact, sizeBand, type TrendBadge } from "@/lib/data-view-cards";
import SpreadStrip from "./SpreadStrip";

function TrendPill({ badge }: { badge: TrendBadge }) {
  if (!badge) return <span className="text-xs text-neutral-400">no 2019 comparison</span>;
  const arrow = badge.direction === "up" ? "▲" : badge.direction === "down" ? "▼" : "▬";
  const colour =
    badge.direction === "up" ? "text-blue-600 dark:text-blue-400" : badge.direction === "down" ? "text-red-600 dark:text-red-400" : "text-neutral-500";
  return (
    <span className={`text-xs font-medium ${colour}`}>
      {arrow} {Math.abs(badge.pctChange).toFixed(0)}% since 2019
    </span>
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

export default function DashboardView({
  targetProfile,
  tickedProfiles,
  filters,
  filterSummary,
}: {
  targetProfile: DataViewSchoolProfile;
  tickedProfiles: DataViewSchoolProfile[];
  filters: DataViewFilterState;
  filterSummary: string | null;
}) {
  // The ticked group always includes the target itself as a real reference point,
  // per every other spread visualisation in this codebase (SchoolMap.tsx's own "the
  // viewed school's roll is a real data point in the domain, not excluded from it").
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];

  const currentPoints = group.map((p) => ({
    urn: p.urn,
    name: p.name,
    value: filteredCount(profileToFilterableData(p), filters).total,
    isTarget: p.urn === targetProfile.urn,
  }));
  const anchorPoints = group.map((p) => ({
    urn: p.urn,
    value: p.anchor2019 ? filteredCount(profileToFilterableData2019(p), filters).total : null,
  }));
  const targetCurrent = currentPoints.find((p) => p.isTarget)?.value ?? null;
  const targetAnchor = anchorPoints.find((p, i) => group[i].urn === targetProfile.urn)?.value ?? null;
  const rollTrendBadge = trendBadge(targetCurrent, targetAnchor);
  const rollSpread = spreadData(currentPoints);

  const genderPoints = group.map((p) => {
    const c = filteredCount(profileToFilterableData(p), filters);
    const pct = c.female !== null && c.total > 0 ? (c.female / c.total) * 100 : null;
    return { urn: p.urn, name: p.name, value: pct, isTarget: p.urn === targetProfile.urn };
  });
  const targetGenderCurrent = genderPoints.find((p) => p.isTarget)?.value ?? null;
  const targetGenderAnchorCount = targetProfile.anchor2019 ? filteredCount(profileToFilterableData2019(targetProfile), filters) : null;
  const targetGenderAnchor =
    targetGenderAnchorCount && targetGenderAnchorCount.female !== null && targetGenderAnchorCount.total > 0
      ? (targetGenderAnchorCount.female / targetGenderAnchorCount.total) * 100
      : null;
  const genderTrendBadge = trendBadge(targetGenderCurrent, targetGenderAnchor);
  const genderSpread = spreadData(genderPoints);

  const boardingPoints = group.map((p) => {
    const b = p.current?.boarding;
    const pct = b && b.total > 0 ? (b.boarders / b.total) * 100 : b ? 0 : null;
    return { urn: p.urn, name: p.name, value: pct, isTarget: p.urn === targetProfile.urn };
  });
  const targetBoardingCurrent = boardingPoints.find((p) => p.isTarget)?.value ?? null;
  const targetBoardingAnchorB = targetProfile.anchor2019?.boarding;
  const targetBoardingAnchor = targetBoardingAnchorB && targetBoardingAnchorB.total > 0 ? (targetBoardingAnchorB.boarders / targetBoardingAnchorB.total) * 100 : null;
  const boardingTrendBadge = trendBadge(targetBoardingCurrent, targetBoardingAnchor);
  const boardingSpread = spreadData(boardingPoints);
  const targetIsDaySchool = targetProfile.current?.boarding === null || targetProfile.current?.boarding?.boarders === 0;

  const groupTotal = currentPoints.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const marketShare = targetCurrent !== null ? memberSetMarketShare(targetCurrent, groupTotal) : null;

  const shapeFact = shapeInlineFact(targetProfile.shape2019, targetProfile.shapeCurrent);

  // Through-school size-band discrepancy line (brief §5): whole-school size band vs.
  // the currently-filtered phase's own size band, within this same ticked group --
  // only shown when a phase filter is active AND the two bands genuinely differ.
  let sizeBandLine: string | null = null;
  if (filters.phaseBands.size > 0 && targetProfile.phase.length > 1) {
    const wholeValues = group.map((p) => filteredCount(profileToFilterableData(p), { ...filters, phaseBands: new Set(), ages: new Set() }).total);
    const wholeTarget = wholeValues[group.findIndex((p) => p.urn === targetProfile.urn)];
    const wholeBand = sizeBand(wholeTarget, Math.min(...wholeValues), Math.max(...wholeValues));
    const filteredValues = currentPoints.map((p) => p.value);
    const filteredBand = sizeBand(targetCurrent ?? 0, Math.min(...filteredValues), Math.max(...filteredValues));
    if (wholeBand !== filteredBand) {
      const bandLabel = [...filters.phaseBands].join("/");
      sizeBandLine = `${wholeBand} overall · ${filteredBand} as a ${bandLabel} school`;
    }
  }

  return (
    <div className="space-y-4">
      {filterSummary && <p className="text-xs text-neutral-400">Filtered: {filterSummary}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Current roll">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{targetCurrent?.toLocaleString() ?? "—"}</span>
            <TrendPill badge={rollTrendBadge} />
          </div>
          {shapeFact && <p className="mb-2 text-xs text-neutral-500">{shapeFact}</p>}
          {sizeBandLine && <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">{sizeBandLine}</p>}
          {rollSpread && <SpreadStrip min={rollSpread.min} max={rollSpread.max} points={rollSpread.points} formatValue={(v) => v.toLocaleString()} />}
        </Card>

        <Card title="Roll trend, since 2019">
          <RollTrendChart target={targetProfile} group={group} filters={filters} />
        </Card>

        <Card title="Gender split">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{targetGenderCurrent !== null ? `${targetGenderCurrent.toFixed(0)}% girls` : "—"}</span>
            <TrendPill badge={genderTrendBadge} />
          </div>
          {genderSpread && <SpreadStrip min={genderSpread.min} max={genderSpread.max} points={genderSpread.points} formatValue={(v) => `${v.toFixed(0)}%`} />}
        </Card>

        <Card title="Boarding split">
          {targetIsDaySchool ? (
            <p className="text-sm text-neutral-500">This is a day school — boarding isn&rsquo;t a meaningful axis for it.</p>
          ) : (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{targetBoardingCurrent !== null ? `${targetBoardingCurrent.toFixed(0)}% boarding` : "—"}</span>
                <TrendPill badge={boardingTrendBadge} />
              </div>
              {boardingSpread && <SpreadStrip min={boardingSpread.min} max={boardingSpread.max} points={boardingSpread.points} formatValue={(v) => `${v.toFixed(0)}%`} />}
            </>
          )}
        </Card>

        <Card title="Market share of this set">
          <p className="mb-2 text-2xl font-semibold">{marketShare !== null ? `${marketShare.toFixed(0)}%` : "—"}</p>
          <MarketShareBar points={currentPoints} />
          <p className="mt-2 text-xs text-neutral-400">
            This is {targetProfile.name}&rsquo;s share of the schools you&rsquo;ve ticked here, not a claim about the total local market.
          </p>
        </Card>
      </div>
    </div>
  );
}

function MarketShareBar({ points }: { points: { urn: string; name: string; value: number; isTarget: boolean }[] }) {
  const total = points.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <div className="flex h-4 w-full overflow-hidden rounded">
      {points.map((p) => (
        <div
          key={p.urn}
          style={{ width: `${(p.value / total) * 100}%` }}
          className={p.isTarget ? "bg-red-600" : "bg-neutral-300 dark:bg-neutral-700"}
          title={`${p.name}: ${p.value.toLocaleString()}`}
        />
      ))}
    </div>
  );
}

function RollTrendChart({
  target,
  group,
  filters,
}: {
  target: DataViewSchoolProfile;
  group: DataViewSchoolProfile[];
  filters: DataViewFilterState;
}) {
  // Real per-period roll for a school, filtered the same way the Current Roll card
  // is -- only whole-school ("no filter") is exact for periods before the current
  // one at present, since ageGenderCounts per historical period isn't threaded
  // through DataViewSchoolProfile beyond the current/2019 anchors (a real, scoped
  // simplification: the LINE always plots whole-school roll regardless of the active
  // phase/gender/boarding filter, while every other card on this page does respect
  // it). Logged as a decision, not a silent gap.
  const periods = Array.from(new Set(target.trend.map((t) => t.period))).sort((a, b) => a - b);
  if (periods.length < 2) return <p className="text-sm text-neutral-500">Not enough real history to plot a trend.</p>;

  const targetSeries = periods.map((p) => target.trend.find((t) => t.period === p)?.totalRoll ?? null);
  const groupAverageSeries = periods.map((p) => {
    const values = group.map((g) => g.trend.find((t) => t.period === p)?.totalRoll ?? null).filter((v): v is number => v !== null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  });

  const allValues = [...targetSeries, ...groupAverageSeries].filter((v): v is number => v !== null);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const W = 200;
  const H = 60;
  const x = (i: number) => (periods.length <= 1 ? W / 2 : (i / (periods.length - 1)) * W);
  const y = (v: number) => (max <= min ? H / 2 : H - ((v - min) / (max - min)) * H);

  function pathFor(series: (number | null)[]): string {
    let d = "";
    let started = false;
    series.forEach((v, i) => {
      if (v === null) return;
      d += `${started ? "L" : "M"}${x(i)},${y(v)} `;
      started = true;
    });
    return d.trim();
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none">
        <path d={pathFor(groupAverageSeries)} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" strokeWidth={1.5} />
        <path d={pathFor(targetSeries)} fill="none" stroke="#dc2626" strokeWidth={2} />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-neutral-400">
        <span>{periods[0]}</span>
        <span>{periods[periods.length - 1]}</span>
      </div>
      {filters.phaseBands.size > 0 && <p className="mt-1 text-xs text-neutral-400">Trend line shows whole-school roll (not phase-filtered).</p>}
    </div>
  );
}
