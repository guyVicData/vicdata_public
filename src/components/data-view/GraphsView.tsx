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
//     directly under Roll Trends -- moved out again below, see the Part B comment.
//   - Section 02 (Market share) got its full spec: a single-series share-over-time
//     chart plus two secondary tiles reusing the SAME bar-chart/diverging-chart
//     components Section 01 already established (CurrentRollBarChart and
//     GrowthDeclineChart generalised into SortedBarChart/DivergingBarChart so both
//     sections share one implementation each, per the doc's own "same pattern as
//     Section 01" wording).
//
// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B: restructured from three
// sections into FOUR, independently collapsible, all open by default (no adaptive
// show/hide -- "training wheels" principle, every section always reachable):
//   - Section 01 (Overview) is now deliberately LIGHT: a new single-series bar+
//     trend-line chart of the target's own roll (Graph 1, TargetRollBarChart.tsx)
//     plus the unchanged Current Roll card (Graph 2). CombinedRollChart and the
//     Growth/decline chart both moved OUT of this section.
//   - Section 02 (new) is the new home for the main RollTrendsChart (Graph 3, itself
//     enhanced -- see RollTrendsChart.tsx's own header comment for the four
//     additions) and the Growth/decline chart (Graph 4, moved here from Section 01).
//   - Section 03 (renumbered from the old Section 02) keeps its two market-share
//     charts (Graphs 5/6) and gains CombinedRollChart (Graph 7, moved here from
//     Section 01) -- Graphs 5/6 also gain a new >20-school sector-aggregate
//     fallback, replacing per-school bars with target-vs-real-sector bars once the
//     set is too large for individual bars to mean much (GRAPH_SECTOR_FALLBACK_
//     THRESHOLD, aggregate-trends.ts -- deliberately separate from
//     LARGE_SET_PROFILE_THRESHOLD, which is Region/Nation scale, ~10x larger).
//   - Section 04 (renumbered from the old Section 03) keeps its existing gender-
//     split stat + SpreadStrip and gains three items: Graph 8 (ShapeChart.tsx, the
//     real public-site population-pyramid, reused directly), Graph 9 (the Donut
//     component from GenderSplitCard.tsx, reused directly, now exported), and
//     Graph 10 (NEW: a stacked-bar chart, one 100%-stacked bar per school, with the
//     SAME sector-aggregate fallback as Graphs 5/6 above the same threshold). The
//     handoff's own section summary says "gains two charts" but its itemised list
//     names three (8/9/10) -- resolved by treating Graph 9 as an upgrade of the
//     EXISTING stat line (same targetGenderCurrent figure, just as a donut instead
//     of bare text) rather than a fourth thing bolted on top of a now-redundant
//     third; nothing existing was removed, logged here rather than silently
//     resolved.

import { useState } from "react";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { profileToFilterableData as toFilterable, profileToFilterableDataForPeriod as toFilterableForPeriod } from "@/lib/data-view-serialize";
import { trendBadge, sizeBand, type TrendBadge } from "@/lib/data-view-cards";
import { graphTitlePrefix } from "@/lib/data-view-summary";
import { GRAPH_SECTOR_FALLBACK_THRESHOLD, type AggregateTrends } from "@/lib/aggregate-trends";
import { FOCUS_SCHOOL_COLOUR } from "@/lib/school-series-colours";
import { academicYearLabel } from "./TrendPill";
import RollTrendsChart from "./RollTrendsChart";
import SortedBarChart from "./SortedBarChart";
import DivergingBarChart from "./DivergingBarChart";
import CombinedRollChart from "./CombinedRollChart";
import TargetRollBarChart from "./TargetRollBarChart";
import GenderSplitBarChart, { type GenderSplitBarRow } from "./GenderSplitBarChart";
import AddSubtractSchoolsWindow from "./AddSubtractSchoolsWindow";
import ShapeChart from "@/components/ShapeChart";
import { Donut } from "@/components/dashboard/GenderSplitCard";
import AggregateTrendChart, {
  AGGREGATE_TARGET_COLOUR,
  AGGREGATE_REGION_COLOUR,
  AGGREGATE_NATION_COLOUR,
  AGGREGATE_SECTOR_COLOUR,
  type AggregateChartSeries,
} from "./AggregateTrendChart";

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

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B: SectionHeading is now a
// real toggle button, not static text -- "each independently collapsible... all
// four open by default." A plain <details>/<summary> pair would have been simpler,
// but this codebase's other collapsible-ish controls (the FilterBar pills, the
// large-set popup) are all plain button+state, and a chevron-plus-heading button
// keeps the exact same visual weight/placement SectionHeading always had.
function SectionHeading({ number, title, isOpen, onToggle }: { number: string; title: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold uppercase tracking-wide text-neutral-500"
      aria-expanded={isOpen}
    >
      <span className="text-neutral-300 dark:text-neutral-700">{number}</span>
      <span className="flex-1">{title}</span>
      <span className="text-neutral-400">{isOpen ? "▾" : "▸"}</span>
    </button>
  );
}

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graphs 5/6/10's shared
// sector-aggregate fallback caption -- same "state the real basis explicitly"
// discipline Section 01's own isLargeSet caption already established, adapted for
// this narrower, more-common case.
//
// Follow-up round (2026-09-16), item 8: rewritten -- this used to say the fallback
// was whole-school and filter-blind, which was true of the old roll_aggregates-
// based version but is no longer true now that it sums this set's own real,
// filtered schools instead (see sectorFallbackRollPoints/sectorFallbackGrowthPoints/
// sectorFallbackGenderRows' own comments for the fix).
function SectorFallbackNote() {
  return (
    <p className="mt-2 text-xs text-neutral-400">
      This set is large enough that individual school bars aren&rsquo;t shown -- grouped by sector instead, summed across the real schools in your own
      comparator set that share each sector. Reflects whatever phase/gender/boarding filter is currently active, same as every other figure on this
      page.
    </p>
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

  // Follow-up round (2026-09-16), item 4: only Section 01 (Overview) starts open --
  // "user opens up and explores" -- Sections 02/03/04 start collapsed. Collapsing
  // still doesn't need to persist across reload (unchanged from the earlier round's
  // own note), so this stays a plain in-memory Set, just with a non-empty initial
  // value now.
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set(["02", "03", "04"]));
  const toggleSection = (id: string) =>
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graph 3(d): state for
  // the graph-scoped "Add/subtract schools to this graph" window -- deliberately
  // local to GraphsView (per direct instruction: "own state... threaded through
  // GraphsView"), not lifted to DataViewShell, since it affects only this one
  // chart's own display, not the real filter/comparator set every other view reads.
  const [graphAddedUrns, setGraphAddedUrns] = useState<Set<string>>(new Set());
  const [hiddenLineUrns, setHiddenLineUrns] = useState<Set<string>>(new Set());
  const [graphAddWindowOpen, setGraphAddWindowOpen] = useState(false);
  const toggleGraphAdded = (urn: string) =>
    setGraphAddedUrns((prev) => {
      const next = new Set(prev);
      if (next.has(urn)) next.delete(urn);
      else next.add(urn);
      return next;
    });
  const toggleHiddenLine = (urn: string) =>
    setHiddenLineUrns((prev) => {
      const next = new Set(prev);
      if (next.has(urn)) next.delete(urn);
      else next.add(urn);
      return next;
    });

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
  // Section 04's gender split, which Guy's own list of affected charts didn't
  // include -- genderBarRows/GenderSplitBarChart already drops a zero-total row on
  // its own, so no separate rule was needed there anyway.
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

  // Shared timeline + per-school filtered series for the Combined Roll chart
  // (Section 03) and the whole of Market share (Section 03) -- same
  // filteredCount(profileToFilterableDataForPeriod(...)) pairing RollTrendsChart
  // already applies per school, summed/ratioed across the group here instead of
  // rendered as separate lines. ageGenderCountsByPeriod.has(p) guards the same
  // "genuinely no data for this school this period" gap RollTrendsChart's own
  // seriesFor guards -- absence means no data, not a real zero. Also feeds
  // Section 01's new Graph 1 (the target's own series is just one row of this).
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

  const shareAt = (values: (number | null)[], idx: number) => {
    const combined = combinedByPeriod[idx];
    const v = values[idx];
    return combined && combined > 0 && v !== null ? (v / combined) * 100 : null;
  };
  // Follow-up round (2026-09-16), item 4: same share-of-combined-total math as
  // shareAt directly above, for a single already-known value (targetCurrent/
  // targetAnchor, or one sector's own already-summed total) rather than indexing
  // into a full per-period values array -- the sector-fallback fix below needs
  // this shape, not shareAt's own.
  const shareOfCombined = (value: number | null, idx: number) => {
    const combined = combinedByPeriod[idx];
    return combined && combined > 0 && value !== null ? (value / combined) * 100 : null;
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

  // Follow-up round (2026-09-16), item 8: real design miss in the original build,
  // not a build defect -- this used to query roll_aggregates (the SAME table the
  // public site's real Regional/National cards read), i.e. genuine NATIONAL totals
  // for that sector, nothing to do with THIS member's own comparator set, and not
  // filter-aware (roll_aggregates only carries a fixed 5-band age split, no
  // phase/gender/boarding slicing) -- viewing a real set showed what looked like
  // whole-country numbers once past the threshold, and the active filter silently
  // did nothing to these three charts. Fixed to sum the REAL schools actually in
  // this member's own ticked/loaded set (groupInScope), bucketed by
  // establishmentTypeGroup -- perSchoolFilteredSeries (below) already has every
  // real school's own FILTERED figure, respecting whatever phase/gender/boarding
  // filter is active; no fetch or DB query needed for this at all now. Real sectors
  // only: establishmentTypeGroup is null for a school with no real value, filtered
  // out rather than grouped under a fake "Unknown" bucket.
  const isSectorFallback = groupInScope.length > GRAPH_SECTOR_FALLBACK_THRESHOLD;
  const distinctSectorsPresent = Array.from(new Set(groupInScope.map((p) => p.establishmentTypeGroup).filter((s): s is string => !!s))).sort();

  // Sums every non-target groupInScope school's own per-period FILTERED value
  // (perSchoolFilteredSeries, built below from groupInScope) into one real total
  // per sector -- built once, called for both the latest and the anchor period, so
  // Graphs 5 and 6's fallback bars share the same real per-sector sums rather than
  // two separate summation passes computing the same thing differently.
  function sumFilteredBySector(idx: number): Map<string, number> {
    const buckets = new Map<string, number>();
    groupInScope.forEach((p) => {
      if (p.urn === targetProfile.urn) return;
      const sector = p.establishmentTypeGroup;
      if (!sector) return;
      const v = perSchoolFilteredSeries.find((s) => s.urn === p.urn)?.values[idx] ?? null;
      if (v === null) return;
      buckets.set(sector, (buckets.get(sector) ?? 0) + v);
    });
    return buckets;
  }
  const sectorRollLatest = sumFilteredBySector(latestIdx);
  const sectorRollEarliest = sumFilteredBySector(earliestIdx);

  // The target's own row now uses the SAME filtered targetCurrent/targetAnchor
  // every other figure on this page already reads (not a separate whole-school
  // figure) -- that whole-school basis only ever existed to match
  // roll_aggregates' own whole-school-only shape, which this fallback no longer
  // reads from, so the active filter now genuinely affects the target's own bar
  // too, like-for-like against the equally-filtered sector sums.
  //
  // Follow-up round (2026-09-16), item 4: real bug from the item-8 fix -- these
  // two cards are titled "Market share," but sectorFallbackRollPoints/
  // sectorFallbackGrowthPoints were left as raw summed roll COUNTS (item 8's own
  // fix corrected the SOURCE, real schools instead of national totals, but never
  // converted the result into a share). Fixed by running every value/pctChange
  // through shareOfCombined -- the SAME combinedByPeriod[latestIdx/earliestIdx]
  // denominator marketShareBarPoints/marketShareGrowthPoints already use, so a
  // fallback bar reads as the same kind of percentage (share of the group's real
  // combined roll), not a different metric a member would have to notice the
  // switch between when a set crosses the threshold. Growth specifically used to
  // read trendBadge(...).pctChange (% CHANGE IN ROLL COUNT, a ratio) where the
  // non-fallback branch's own pctChange is a POINT difference between two real
  // share percentages -- fixed to the same late-minus-early share-point shape.
  const sectorFallbackRollPoints = isSectorFallback
    ? [
        { urn: targetProfile.urn, name: targetProfile.name, isTarget: true, value: shareOfCombined(targetCurrent, latestIdx) ?? 0 },
        ...distinctSectorsPresent
          .filter((s) => sectorRollLatest.has(s))
          .map((sector) => ({
            urn: `sector:${sector}`,
            name: sector,
            isTarget: false,
            value: shareOfCombined(sectorRollLatest.get(sector)!, latestIdx) ?? 0,
          })),
      ]
    : null;
  const sectorFallbackGrowthPoints = isSectorFallback
    ? [
        {
          urn: targetProfile.urn,
          name: targetProfile.name,
          isTarget: true,
          pctChange: (() => {
            const early = shareOfCombined(targetAnchor, earliestIdx);
            const late = shareOfCombined(targetCurrent, latestIdx);
            return early !== null && late !== null ? late - early : null;
          })(),
        },
        ...distinctSectorsPresent
          .filter((s) => sectorRollLatest.has(s) && sectorRollEarliest.has(s))
          .map((sector) => {
            const early = shareOfCombined(sectorRollEarliest.get(sector)!, earliestIdx);
            const late = shareOfCombined(sectorRollLatest.get(sector)!, latestIdx);
            return { urn: `sector:${sector}`, name: sector, isTarget: false, pctChange: early !== null && late !== null ? late - early : null };
          }),
      ]
    : null;

  // Follow-up round (2026-09-16), item 3: the old "Gender split" stat card (this
  // %girls figure + TrendPill + the genderPoints/genderSpread-fed SpreadStrip
  // dot-strip beneath it) was removed entirely, per direct instruction ("that
  // dot-strip specifically is a very hard one to understand") -- Graph 9's Donut
  // stays as the section's own current-split figure. genderPoints/
  // targetGenderCurrent/targetGenderAnchor(Count)/genderTrendBadge/genderSpread
  // were only ever computed to feed that removed card, so they're gone too rather
  // than left as dead code for lint to catch.

  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graph 10: individual
  // rows use the same FILTERED girls/boys split as everything else on this page
  // (unlike Graphs 5/6's whole-school fallback basis) -- GenderSplitBarChart itself
  // drops any row with girls+boys===0 (no real data), same convention as
  // genderPoints' own null-filtering just above.
  const genderBarRows: GenderSplitBarRow[] = group.map((p) => {
    const c = filteredCount(toFilterable(p), filters);
    return { key: p.urn, label: p.name, girls: c.female ?? 0, boys: c.male ?? 0, isTarget: p.urn === targetProfile.urn };
  });
  const targetWholeSchoolGender = Array.from(targetProfile.ageGenderCounts.values()).reduce(
    (acc, c) => ({ male: acc.male + c.male, female: acc.female + c.female }),
    { male: 0, female: 0 },
  );
  // Follow-up round (2026-09-16), item 8: same fix as the roll fallback above --
  // sums the REAL groupInScope schools' own FILTERED girls/boys split (the same
  // filteredCount() figures genderBarRows itself uses) by sector, rather than a
  // national roll_aggregates row. The target's own row reuses genderBarRows' own
  // entry for the target (already the correct filtered figure) instead of
  // targetWholeSchoolGender, which stays reserved for Graph 9's Donut below (a
  // deliberately whole-school figure, unaffected by this fix).
  function sumGenderBySector(): Map<string, { girls: number; boys: number }> {
    const buckets = new Map<string, { girls: number; boys: number }>();
    groupInScope.forEach((p) => {
      if (p.urn === targetProfile.urn) return;
      const sector = p.establishmentTypeGroup;
      if (!sector) return;
      const c = filteredCount(toFilterable(p), filters);
      const girls = c.female ?? 0;
      const boys = c.male ?? 0;
      if (girls + boys === 0) return;
      const existing = buckets.get(sector) ?? { girls: 0, boys: 0 };
      buckets.set(sector, { girls: existing.girls + girls, boys: existing.boys + boys });
    });
    return buckets;
  }
  const sectorGenderBuckets = sumGenderBySector();
  const targetFilteredGenderRow = genderBarRows.find((r) => r.isTarget) ?? null;
  const sectorFallbackGenderRows: GenderSplitBarRow[] | null =
    isSectorFallback && targetFilteredGenderRow
      ? [
          targetFilteredGenderRow,
          ...distinctSectorsPresent
            .filter((s) => sectorGenderBuckets.has(s))
            .map((sector) => {
              const b = sectorGenderBuckets.get(sector)!;
              return { key: `sector:${sector}`, label: sector, girls: b.girls, boys: b.boys };
            }),
        ]
      : null;

  // Brief's own rule: hide Gender split entirely for a confirmed single-sex school
  // (typology.ts's GenderTag -- only a real "Boys"/"Girls" value triggers this, never
  // "Co-ed" or an unknown/null tag).
  const isSingleSex = targetProfile.gender === "Boys" || targetProfile.gender === "Girls";

  // Follow-up round (2026-09-16), item 3: shapeFact (and its upstream
  // anchorAgeGenderCounts/anchorShape) only ever fed the "Current roll" card's
  // shape-arrow line ("Pyramid -> Top-step since ..."), which was removed --
  // "makes no sense there," direct feedback. Checked directly: nothing else in
  // this file reads any of the three, so they're gone too, along with the
  // shapeInlineFact/shapeClassifierInput/classifyShape imports that only existed
  // to compute them.
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
  const targetRollBarTitle = `${titlePrefix ? `${titlePrefix} ` : ""}Roll since ${academicYearLabel(filters.startPeriod)}`;
  const rollTrendsTitle = `${titlePrefix ? `${titlePrefix} ` : ""}Roll Trends since ${academicYearLabel(filters.startPeriod)}`;
  // 2026-09-08, per direct request: explicitly names "selected schools" since this
  // is the sum across the whole comparator set, not the focus school's own figure --
  // easy to misread as a second "Current Roll" otherwise.
  const combinedRollTitle = `${titlePrefix ? `${titlePrefix} ` : ""}Combined roll of selected schools since ${academicYearLabel(filters.startPeriod)}`;

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

  // Graph 3(d): candidates are schools already in the ticked/filtered comparator
  // set (the same `group` this whole view already has profiles for), never the
  // wider nearby-schools pool -- per direct instruction. profilesByUrn here is
  // built from `group` alone for the same reason (AddSubtractSchoolsWindow's own
  // sector colour-coding only needs profiles for its own candidate list).
  const graphAddCandidates = group.filter((p) => p.urn !== targetProfile.urn).map((p) => ({ urn: p.urn, name: p.name, distanceKm: null }));
  const graphAddProfilesByUrn = new Map(group.map((p) => [p.urn, p] as const));
  const graphAddedProfiles = group.filter((p) => graphAddedUrns.has(p.urn));

  return (
    <div className="space-y-8">
      {filterSummary && <p className="text-xs text-neutral-400">Filtered: {filterSummary}</p>}

      <section>
        <SectionHeading number="01" title={`${targetProfile.name} Overview`} isOpen={!closedSections.has("01")} onToggle={() => toggleSection("01")} />
        {!closedSections.has("01") &&
          (isLargeSet ? (
            <>
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
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card title={targetRollBarTitle}>
                  <TargetRollBarChart periods={periods} values={targetFilteredSeries} colour={FOCUS_SCHOOL_COLOUR} />
                  {/* Follow-up round (2026-09-16), item 2: the trend line overlaid
                      on this chart previously had no caption anywhere -- same
                      TrendStatement pattern CombinedRollChart's own card already
                      uses, fed the same rollTrendBadge computed above (now free to
                      reuse here since item 3 removed its other consumer, the
                      Current Roll card's TrendPill). */}
                  <TrendStatement badge={rollTrendBadge} startPeriod={filters.startPeriod} />
                </Card>
              </div>
              <div>
                {/* Follow-up round (2026-09-16), item 3: the big current-roll
                    number + TrendPill and the shapeFact line were both removed --
                    the number/trend is "already in the left hand column" (Part A's
                    sidebar panel), and the shape-arrow text "makes no sense here"
                    (direct feedback). SortedBarChart (the real cross-set
                    comparison) is now this card's whole content, alongside
                    sizeBandLine, which wasn't flagged and stays. */}
                <Card title="Current roll">
                  {sizeBandLine && <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">{sizeBandLine}</p>}
                  <SortedBarChart points={currentPoints} />
                </Card>
              </div>
            </div>
          ))}
      </section>

      {!isLargeSet && (
        <section>
          <SectionHeading number="02" title="Roll trends compared" isOpen={!closedSections.has("02")} onToggle={() => toggleSection("02")} />
          {/* Follow-up round (2026-09-16), item 1: side by side (50/50) rather than
              stacked -- same stack-on-mobile grid pattern Section 03/04 already use,
              just two columns instead of three. */}
          {!closedSections.has("02") && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title={rollTrendsTitle}>
                <RollTrendsChart
                  target={targetProfile}
                  group={groupInScope}
                  filters={filters}
                  showAverage={showAverage}
                  onToggleAverage={() => setShowAverage((v) => !v)}
                  extraProfiles={graphAddedProfiles}
                  hiddenUrns={hiddenLineUrns}
                  onToggleHidden={toggleHiddenLine}
                  onOpenAddSchools={() => setGraphAddWindowOpen(true)}
                />
              </Card>
              <Card title={`Growth / decline since ${academicYearLabel(filters.startPeriod)}`}>
                <DivergingBarChart points={growthPoints} />
              </Card>
            </div>
          )}
        </section>
      )}

      {!isLargeSet && (
        <section>
          {/* 2026-09-08, per direct request: names the focus school specifically
              ("Acland Burghley School's market share"), dynamic per school -- not a
              static "Market share" label. */}
          <SectionHeading
            number="03"
            title={`${targetProfile.name}'s market share`}
            isOpen={!closedSections.has("03")}
            onToggle={() => toggleSection("03")}
          />
          {/* Follow-up round (2026-09-16), item 2: removed the "Market Share since
              ..." trend-over-time chart (MarketShareTrendChart) entirely, per
              direct instruction -- the three remaining charts now sit in a genuine
              3-column row (lg:grid-cols-3, one card each) rather than the old
              2-column split (trend+combined roll on the left, the two bar charts
              stacked on the right), matching Guy's own original design note's own
              ordering: market share this year, market-share growth/decline,
              combined roll of the set. */}
          {!closedSections.has("03") && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card title={`Market share, ${academicYearLabel(periods[latestIdx] ?? filters.startPeriod)}`}>
                {isSectorFallback && sectorFallbackRollPoints ? (
                  <>
                    <SortedBarChart points={sectorFallbackRollPoints} formatValue={(v) => `${v.toFixed(0)}%`} />
                    <SectorFallbackNote />
                  </>
                ) : (
                  <SortedBarChart points={marketShareBarPoints} formatValue={(v) => `${v.toFixed(0)}%`} />
                )}
              </Card>
              <Card title={`Market-share growth / decline since ${academicYearLabel(filters.startPeriod)}`}>
                {isSectorFallback && sectorFallbackGrowthPoints ? (
                  <>
                    <DivergingBarChart points={sectorFallbackGrowthPoints} formatValue={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`} />
                    <SectorFallbackNote />
                  </>
                ) : (
                  <DivergingBarChart points={marketShareGrowthPoints} formatValue={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`} />
                )}
              </Card>
              <Card title={combinedRollTitle}>
                <CombinedRollChart periods={periods} values={combinedByPeriod} />
                <TrendStatement badge={combinedRollBadge} startPeriod={filters.startPeriod} />
              </Card>
            </div>
          )}
        </section>
      )}

      {!isSingleSex && (
        <section>
          <SectionHeading number="04" title="Gender split" isOpen={!closedSections.has("04")} onToggle={() => toggleSection("04")} />
          {/* Follow-up round (2026-09-16), item 3: the old "Gender split" stat card
              (a bare %girls figure + TrendPill + a SpreadStrip dot-strip -- "a very
              hard one to understand," per direct feedback) is gone; Graph 9's Donut
              below is now the section's own current-split figure. Down to 3 cards,
              laid out as a row (lg:grid-cols-3) matching Section 03's own row above
              rather than the leftover-2-then-1 wrap a 2-column grid would produce. */}
          {!closedSections.has("04") && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card title="This school's age/gender shape">
                <ShapeChart ageGenderCounts={targetProfile.ageGenderCounts} />
              </Card>
              <Card title="This school's gender split">
                <Donut girls={targetWholeSchoolGender.female} boys={targetWholeSchoolGender.male} label={targetProfile.name} sexLabels={{ female: "girls", male: "boys" }} />
              </Card>
              <Card title="Gender split across this set">
                {isSectorFallback && sectorFallbackGenderRows ? (
                  <>
                    <GenderSplitBarChart rows={sectorFallbackGenderRows} />
                    <SectorFallbackNote />
                  </>
                ) : (
                  <GenderSplitBarChart rows={genderBarRows} />
                )}
              </Card>
            </div>
          )}
        </section>
      )}

      {graphAddWindowOpen && (
        <AddSubtractSchoolsWindow
          title="Add/subtract schools to this graph"
          targetName={targetProfile.name}
          schools={graphAddCandidates}
          tickedUrns={graphAddedUrns}
          onToggleTick={toggleGraphAdded}
          onSelectAllTicked={() => setGraphAddedUrns(new Set(graphAddCandidates.map((s) => s.urn)))}
          onUnselectAllTicked={() => setGraphAddedUrns(new Set())}
          onGroupTicked={(urns, ticked) =>
            setGraphAddedUrns((prev) => {
              const next = new Set(prev);
              urns.forEach((u) => (ticked ? next.add(u) : next.delete(u)));
              return next;
            })
          }
          profilesByUrn={graphAddProfilesByUrn}
          onClose={() => setGraphAddWindowOpen(false)}
        />
      )}
    </div>
  );
}
