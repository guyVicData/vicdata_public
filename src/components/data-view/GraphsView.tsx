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

import { useState } from "react";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { profileToFilterableData as toFilterable, profileToFilterableDataForPeriod as toFilterableForPeriod } from "@/lib/data-view-serialize";
import { trendBadge, spreadData, shapeInlineFact, sizeBand, type TrendBadge } from "@/lib/data-view-cards";
import { shapeClassifierInput } from "@/lib/roll-data";
import { classifyShape } from "@/lib/shape-classifier";
import { graphTitlePrefix } from "@/lib/data-view-summary";
import SpreadStrip from "./SpreadStrip";
import RollTrendsChart from "./RollTrendsChart";
import CurrentRollBarChart from "./CurrentRollBarChart";
import GrowthDeclineChart from "./GrowthDeclineChart";

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
}: {
  targetProfile: DataViewSchoolProfile;
  tickedProfiles: DataViewSchoolProfile[];
  filters: DataViewFilterState;
  filterSummary: string | null;
}) {
  const [showAverage, setShowAverage] = useState(false);

  // The ticked group always includes the target itself as a real reference point
  // (SchoolMap.tsx's own established "the viewed school's roll is a real data point
  // in the domain, not excluded from it").
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];

  const anchorSnapshot = (p: DataViewSchoolProfile) => p.trend.find((t) => t.period === filters.startPeriod) ?? null;

  const currentPoints = group.map((p) => ({
    urn: p.urn,
    name: p.name,
    value: filteredCount(toFilterable(p), filters).total,
    isTarget: p.urn === targetProfile.urn,
  }));
  const anchorPoints = group.map((p) => ({
    urn: p.urn,
    value: anchorSnapshot(p) ? filteredCount(toFilterableForPeriod(p, filters.startPeriod), filters).total : null,
  }));
  const targetCurrent = currentPoints.find((p) => p.isTarget)?.value ?? null;
  const targetAnchor = anchorPoints.find((p, i) => group[i].urn === targetProfile.urn)?.value ?? null;
  const rollTrendBadge = trendBadge(targetCurrent, targetAnchor);

  const growthPoints = group.map((p, i) => ({
    urn: p.urn,
    name: p.name,
    isTarget: p.urn === targetProfile.urn,
    pctChange: trendBadge(currentPoints[i].value, anchorPoints[i].value)?.pctChange ?? null,
  }));

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
    const wholeValues = group.map((p) => filteredCount(toFilterable(p), { ...filters, phaseBands: new Set(), ages: new Set() }).total);
    const wholeTarget = wholeValues[group.findIndex((p) => p.urn === targetProfile.urn)];
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

  return (
    <div className="space-y-8">
      {filterSummary && <p className="text-xs text-neutral-400">Filtered: {filterSummary}</p>}

      <section>
        <SectionHeading number="01" title="Overview" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title={rollTrendsTitle}>
              <RollTrendsChart target={targetProfile} group={group} filters={filters} showAverage={showAverage} onToggleAverage={() => setShowAverage((v) => !v)} />
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
              <CurrentRollBarChart points={currentPoints} />
            </Card>
            <Card title={`Growth / decline since ${academicYearLabel(filters.startPeriod)}`}>
              <GrowthDeclineChart points={growthPoints} />
            </Card>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading number="02" title="Market share" />
        <p className="text-sm text-neutral-500">Coming soon.</p>
      </section>

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
