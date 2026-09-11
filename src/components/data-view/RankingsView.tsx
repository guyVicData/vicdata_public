"use client";

// Member Data View Rankings (brief §7): same cards as Dashboard, re-rendered as
// ranked lists -- shape excluded entirely. Target's row highlighted in place, plus a
// one-line "ranks #N of M" summary. Shared-rank ties (two schools both #3, next is
// #5). Large sets (brief's own defensive threshold, LARGE_SET_THRESHOLD) switch the
// headline to percentile and show a neighbour window rather than the whole list.
//
// Large-set design v1, item 3: a Region/Nation-scale set (DataViewShell's own
// LARGE_SET_PROFILE_THRESHOLD) can never be ranked from `tickedProfiles` -- that
// array structurally only ever holds whatever the member has individually ticked
// (large-set design v1, item 6), never the whole 49,000-school set. When
// `largeSetRank` is present (DataViewShell's own region_nation_rank() fetch),
// LargeSetMetricRanking renders the SAME percentile headline this file's own
// small/medium LARGE_SET_THRESHOLD branch already established, PLUS the design doc's
// own "top 15" requirement, computed server-side over the real full set. Market
// share is intentionally not offered at this scale (region_nation_rank()'s own
// migration comment: "% of this set" is meaningless for a 49,000-school region).

import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { profileToFilterableData, profileToFilterableDataForPeriod } from "@/lib/data-view-serialize";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import {
  rankDescendingWithTies,
  percentile,
  memberSetMarketShare,
  trendBadge,
  chunkedRankingDisplay,
  LARGE_SET_THRESHOLD,
  NEIGHBOUR_WINDOW,
  type RankedEntry,
} from "@/lib/data-view-cards";
import type { RegionNationRankResult, RegionNationRankMetric } from "@/lib/region-nation-comparator";
import { academicYearLabel } from "./TrendPill";
import Sparkline from "./Sparkline";
import { FOCUS_SCHOOL_COLOUR } from "@/lib/school-series-colours";

type Metric = { key: string; label: string; getValue: (p: DataViewSchoolProfile, filters: DataViewFilterState, groupTotal: number) => number | null; format: (v: number) => string };

const METRICS: Metric[] = [
  {
    key: "roll",
    label: "Current roll",
    getValue: (p, filters) => filteredCount(profileToFilterableData(p), filters).total,
    format: (v) => v.toLocaleString(),
  },
  {
    key: "girls_pct",
    label: "% girls",
    getValue: (p, filters) => {
      const c = filteredCount(profileToFilterableData(p), filters);
      return c.female !== null && c.total > 0 ? (c.female / c.total) * 100 : null;
    },
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    key: "boarding_pct",
    label: "% boarding",
    getValue: (p) => {
      const b = p.current?.boarding;
      return b && b.total > 0 ? (b.boarders / b.total) * 100 : b ? 0 : null;
    },
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    key: "market_share",
    label: "Market share of this set",
    getValue: (p, filters, groupTotal) => {
      const v = filteredCount(profileToFilterableData(p), filters).total;
      return memberSetMarketShare(v, groupTotal);
    },
    format: (v) => `${v.toFixed(0)}%`,
  },
];

// The three metrics region_nation_rank() computes, in the same order/labels/format
// functions as their METRICS counterparts above (roll/girls_pct/boarding_pct) --
// deliberately reusing the SAME label/format strings rather than a second, possibly-
// drifting copy, even though the underlying value has to come from the server-side
// result object instead of a client-side getValue call.
const LARGE_SET_METRICS: { key: keyof RegionNationRankResult; label: string; format: (v: number) => string }[] = [
  { key: "roll", label: "Current roll", format: (v) => v.toLocaleString() },
  { key: "girlsPct", label: "% girls", format: (v) => `${v.toFixed(0)}%` },
  { key: "boardingPct", label: "% boarding", format: (v) => `${v.toFixed(0)}%` },
];

export default function RankingsView({
  targetProfile,
  tickedProfiles,
  filters,
  largeSetRank,
  largeSetRankLoading,
  largeSetLabel,
}: {
  targetProfile: DataViewSchoolProfile;
  tickedProfiles: DataViewSchoolProfile[];
  filters: DataViewFilterState;
  // Large-set design v1, item 3: non-null only when the active comparator set is
  // Region/Nation-scale AND the server-side ranking fetch has resolved -- see
  // DataViewShell's own largeSetRank state/effect.
  largeSetRank?: RegionNationRankResult | null;
  largeSetRankLoading?: boolean;
  largeSetLabel?: string | null;
}) {
  if (largeSetRank !== undefined && largeSetRank !== null) {
    return (
      <div className="space-y-6">
        <p className="text-xs text-neutral-400">
          Ranked across {largeSetLabel ?? "this set"} — computed server-side; phase/age-band filters aren&rsquo;t applied at this scale (gender,
          boarding-status and sector filters are).
        </p>
        {LARGE_SET_METRICS.map((metric) => (
          <LargeSetMetricRanking key={metric.key} metricLabel={metric.label} format={metric.format} data={largeSetRank[metric.key]} targetUrn={targetProfile.urn} />
        ))}
      </div>
    );
  }
  if (largeSetRankLoading) {
    return <p className="py-12 text-center text-sm text-neutral-500">Ranking this school across the full set…</p>;
  }

  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  const groupTotal = group.reduce((sum, p) => sum + filteredCount(profileToFilterableData(p), filters).total, 0);

  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part C1/C2: "Current Roll"
  // here is deliberately the SAME value METRICS' own "roll" getValue has always
  // used (profileToFilterableData(p) -- each school's own current snapshot), not a
  // periods-array "latest" value -- GraphsView.tsx keeps that exact same
  // distinction (targetCurrent vs perSchoolFilteredSeries's last entry are two
  // separate computations there too), so C1's "This school's position" tile and
  // C2's table stay byte-identical to what the rest of this page already calls
  // "Current Roll," not a subtly different number.
  const rollMetric = METRICS.find((m) => m.key === "roll")!;
  const rollEntries = group.map((p) => ({
    urn: p.urn,
    name: p.name,
    isTarget: p.urn === targetProfile.urn,
    value: rollMetric.getValue(p, filters, groupTotal),
  }));
  const { ranked: rollRanked, targetRank: rollTargetRank, total: rollTotal } = rankDescendingWithTies(rollEntries);
  const targetCurrentValue = rollEntries.find((e) => e.isTarget)?.value ?? null;
  const averageCurrentValue = rollTotal > 0 ? rollRanked.reduce((sum, r) => sum + r.value, 0) / rollTotal : null;

  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part C1/C3: real years from
  // Start Year through now (same union-of-real-trend-periods construction as
  // GraphsView's own `periods`), feeding the one shared rankAcrossPeriods()
  // function -- built once, used by both C1's "Position over time" tile and C3's
  // per-year comparison table, not computed separately for each.
  const periods = Array.from(new Set(group.flatMap((s) => s.trend.map((t) => t.period))))
    .filter((p) => p >= filters.startPeriod)
    .sort((a, b) => a - b);
  const { ranksByUrn } = rankAcrossPeriods(group, periods, filters);
  const targetRankSeries = ranksByUrn.get(targetProfile.urn) ?? [];

  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part C4: the EXACT same
  // current/anchor pairing GraphsView.tsx's own growthPoints (Graph 4,
  // DivergingBarChart) already computes -- current reuses rollEntries directly (the
  // same current-snapshot value as C1/C2, not the periods-array "latest"), anchor
  // is the real snapshot at filters.startPeriod specifically (mirroring
  // GraphsView's own anchorSnapshot/anchorPoints, not the nearest available real
  // period) -- so this ranking reflects the identical growth % Graphs already
  // shows, not an approximation of it.
  const growthAnchorSnapshot = (p: DataViewSchoolProfile) => p.trend.find((t) => t.period === filters.startPeriod) ?? null;
  const growthEntries = group.map((p) => {
    const current = rollEntries.find((e) => e.urn === p.urn)?.value ?? null;
    const anchor = growthAnchorSnapshot(p) ? filteredCount(profileToFilterableDataForPeriod(p, filters.startPeriod), filters).total : null;
    return { urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: trendBadge(current, anchor)?.pctChange ?? null };
  });
  const { ranked: growthRanked, targetRank: growthTargetRank, total: growthTotal } = rankDescendingWithTies(growthEntries);

  // C2's strengthened highlight/top-10-neighbours-bottom-3 shape is new and
  // specific to Current Roll, the per-year comparison table, and the new
  // Growth/decline ranking (direct instruction) -- the three remaining pre-existing
  // metrics (% girls, % boarding, market share) keep MetricRanking exactly as it
  // was, still gated on the original LARGE_SET_THRESHOLD/NEIGHBOUR_WINDOW.
  const otherMetrics = METRICS.filter((m) => m.key !== "roll");

  return (
    <div className="space-y-6">
      <OverviewTiles
        rollTargetRank={rollTargetRank}
        rollTotal={rollTotal}
        targetCurrentValue={targetCurrentValue}
        averageCurrentValue={averageCurrentValue}
        periods={periods}
        targetRankSeries={targetRankSeries}
      />
      <RankTable title={rollMetric.label} ranked={rollRanked} targetRank={rollTargetRank} total={rollTotal} format={rollMetric.format} />
      {periods.length > 0 && (
        <ComparisonOverTimeTable
          ranked={rollRanked}
          targetRank={rollTargetRank}
          targetUrn={targetProfile.urn}
          periods={periods}
          ranksByUrn={ranksByUrn}
        />
      )}
      {otherMetrics.map((metric) => (
        <MetricRanking key={metric.key} metric={metric} group={group} targetUrn={targetProfile.urn} filters={filters} groupTotal={groupTotal} />
      ))}
      <RankTable
        title={`Growth / decline ranking since ${academicYearLabel(filters.startPeriod)}`}
        ranked={growthRanked}
        targetRank={growthTargetRank}
        total={growthTotal}
        format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
      />
    </div>
  );
}

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part C1/C3: per-school,
// per-period rank on Current Roll -- built once, shared by C1's "Position over
// time" tile and C3's comparison table, per direct instruction ("build once as a
// shared function... not separately for C1/C3"). Per-period values come from
// profileToFilterableDataForPeriod (real gap -> null, same "absence isn't a real
// zero" convention as GraphsView's own perSchoolFilteredSeries), deliberately NOT
// the profile's own "current" snapshot (there's no meaningful per-PAST-period
// equivalent of "current" -- this mirrors GraphsView's own established distinction
// between targetCurrent and the periods-array trend series).
function rankAcrossPeriods(
  group: DataViewSchoolProfile[],
  periods: number[],
  filters: DataViewFilterState,
): { ranksByUrn: Map<string, (number | null)[]> } {
  const ranksByUrn = new Map<string, (number | null)[]>(group.map((p) => [p.urn, periods.map(() => null)]));
  periods.forEach((period, i) => {
    const entries = group.map((p) => ({
      urn: p.urn,
      name: p.name,
      isTarget: false,
      value: p.ageGenderCountsByPeriod.has(period) ? filteredCount(profileToFilterableDataForPeriod(p, period), filters).total : null,
    }));
    const { ranked } = rankDescendingWithTies(entries);
    ranked.forEach((r) => {
      ranksByUrn.get(r.urn)![i] = r.rank;
    });
  });
  return { ranksByUrn };
}

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part C1: new overview row above
// the existing ranked tables. Tile A is a single-period snapshot (reuses the exact
// rollRanked/rollTargetRank the Current Roll table below is built from -- same
// numbers, not a second, possibly-drifting rank computation). Tile B is the new
// per-period view (rankAcrossPeriods' own targetRankSeries) -- "concrete numbers,
// not just an arrow" per direct instruction, so this states the real first/last
// rank in the shown range rather than a bare up/down badge.
function OverviewTiles({
  rollTargetRank,
  rollTotal,
  targetCurrentValue,
  averageCurrentValue,
  periods,
  targetRankSeries,
}: {
  rollTargetRank: number | null;
  rollTotal: number;
  targetCurrentValue: number | null;
  averageCurrentValue: number | null;
  periods: number[];
  targetRankSeries: (number | null)[];
}) {
  const pctVsAverage =
    targetCurrentValue !== null && averageCurrentValue !== null && averageCurrentValue !== 0
      ? ((targetCurrentValue - averageCurrentValue) / averageCurrentValue) * 100
      : null;

  const realRanks = targetRankSeries
    .map((r, i) => (r !== null ? { rank: r, period: periods[i] } : null))
    .filter((x): x is { rank: number; period: number } => x !== null);
  const avgRank = realRanks.length > 0 ? realRanks.reduce((sum, r) => sum + r.rank, 0) / realRanks.length : null;
  const first = realRanks[0] ?? null;
  const last = realRanks[realRanks.length - 1] ?? null;
  const showTrend = first !== null && last !== null && first.period !== last.period;
  const trendVerb = first && last ? (last.rank < first.rank ? "Risen" : last.rank > first.rank ? "Fallen" : "Steady") : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">This school&rsquo;s position</h3>
        {rollTargetRank !== null ? (
          <>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              #{rollTargetRank} of {rollTotal} schools
            </p>
            {targetCurrentValue !== null && (
              <p className="mt-1 text-xs text-neutral-500">
                {targetCurrentValue.toLocaleString()} pupils
                {pctVsAverage !== null && averageCurrentValue !== null && (
                  <>
                    {" "}
                    — {Math.abs(pctVsAverage).toFixed(0)}% {pctVsAverage >= 0 ? "above" : "below"} the average of{" "}
                    {Math.round(averageCurrentValue).toLocaleString()}
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-500">No real data available for this school under the current filter.</p>
        )}
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Position over time</h3>
        {avgRank !== null && first && last ? (
          <>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              Average rank #{avgRank.toFixed(1)}, {academicYearLabel(first.period)}–{academicYearLabel(last.period)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {showTrend
                ? `${trendVerb} from #${first.rank} (${academicYearLabel(first.period)}) to #${last.rank} (${academicYearLabel(last.period)})`
                : `Ranked #${last.rank} (${academicYearLabel(last.period)})`}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">Not enough real data across this period to show a trend.</p>
        )}
      </div>
    </div>
  );
}

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part C2/C4: shared table for
// Current Roll (C2) and the new Growth/decline ranking (C4) -- both single-period
// metrics wanting the new strengthened highlight + top-10/neighbours/bottom-3
// shape above RANK_TABLE_LARGE_THRESHOLD schools (chunkedRankingDisplay). The
// target row now gets a coloured left border + a deeper background than
// MetricRanking's own bg-red-50/950-30 (direct feedback: "current is too subtle") --
// scoped to this new component only, MetricRanking itself (still used for % girls/
// % boarding/market share below) is untouched.
function RankTable({
  title,
  ranked,
  targetRank,
  total,
  format,
}: {
  title: string;
  ranked: RankedEntry[];
  targetRank: number | null;
  total: number;
  format: (v: number) => string;
}) {
  if (total === 0) {
    return (
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
        <p className="text-sm text-neutral-500">No real data available for this metric in the current set.</p>
      </section>
    );
  }

  const chunks = chunkedRankingDisplay(ranked, targetRank);

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {targetRank !== null && (
        <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          Ranks <strong>#{targetRank}</strong> of {total}
        </p>
      )}
      {chunks.map((chunk, i) => (
        <div key={chunk.label ?? "all"} className={i > 0 ? "mt-3" : undefined}>
          {chunk.label && chunks.length > 1 && <p className="mb-1 text-xs text-neutral-400">{chunk.label}</p>}
          <table className="w-full text-sm">
            <tbody>
              {chunk.rows.map((r) => (
                <tr
                  key={r.urn}
                  className={
                    r.isTarget
                      ? "border-t border-neutral-100 bg-red-50 font-medium dark:border-neutral-800 dark:bg-red-950/40"
                      : "border-t border-neutral-100 dark:border-neutral-800"
                  }
                >
                  <td className={`w-10 py-1.5 text-neutral-500 ${r.isTarget ? "border-l-4 border-l-red-500 pl-1.5" : ""}`}>#{r.rank}</td>
                  <td className="py-1.5">
                    {r.name}
                    {r.isTarget && " (this school)"}
                  </td>
                  <td className="py-1.5 text-right font-medium">{format(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part C3: Current Roll rank
// (not raw pupil counts -- Graphs already shows the real figures; this table's own
// reason to exist is the RANK trajectory) for one column per real year, same
// chunking/highlight treatment as C2 (row set/order driven by the SAME rollRanked/
// rollTargetRank C2 uses, so both tables agree on who's "top 10" etc.), plus a
// summary "Avg rank" column and a small sparkline of the target's own average-rank-
// over-time -- same Sparkline component Part A's sidebar panel uses, per direct
// instruction ("same shape, fed rank values instead of roll values, not a second
// bespoke mini-chart"). Values are inverted (-rank) before being handed to
// Sparkline: that component always draws "bigger number = higher on the chart,"
// which is correct for a roll trend but backwards for rank (a SMALLER rank number
// is the better outcome) -- inverting means "the line goes up" reads as "this
// school's position improved," matching the "Risen"/"Fallen" wording in the C1
// tile above. This sign convention isn't specified in the handoff; flagged as our
// own call rather than an assumed one.
function ComparisonOverTimeTable({
  ranked,
  targetRank,
  targetUrn,
  periods,
  ranksByUrn,
}: {
  ranked: RankedEntry[];
  targetRank: number | null;
  targetUrn: string;
  periods: number[];
  ranksByUrn: Map<string, (number | null)[]>;
}) {
  if (ranked.length === 0 || periods.length === 0) return null;

  const chunks = chunkedRankingDisplay(ranked, targetRank);
  const avgRankFor = (urn: string) => {
    const real = (ranksByUrn.get(urn) ?? []).filter((r): r is number => r !== null);
    return real.length > 0 ? real.reduce((sum, r) => sum + r, 0) / real.length : null;
  };
  const targetRankSeries = ranksByUrn.get(targetUrn) ?? [];
  const targetSparklineValues = targetRankSeries.map((r) => (r === null ? null : -r));

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Current roll rank, {academicYearLabel(periods[0])}–{academicYearLabel(periods[periods.length - 1])}
      </h3>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1 overflow-x-auto">
          {chunks.map((chunk, i) => (
            <div key={chunk.label ?? "all"} className={i > 0 ? "mt-3" : undefined}>
              {chunk.label && chunks.length > 1 && <p className="mb-1 text-xs text-neutral-400">{chunk.label}</p>}
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="text-xs text-neutral-400">
                    <th className="w-10 py-1 text-left font-normal">#</th>
                    <th className="py-1 text-left font-normal">School</th>
                    {periods.map((p) => (
                      <th key={p} className="px-2 py-1 text-right font-normal">
                        {academicYearLabel(p)}
                      </th>
                    ))}
                    <th className="py-1 pl-2 text-right font-normal">Avg rank</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.rows.map((r) => {
                    const series = ranksByUrn.get(r.urn) ?? [];
                    const avg = avgRankFor(r.urn);
                    return (
                      <tr
                        key={r.urn}
                        className={
                          r.isTarget
                            ? "border-t border-neutral-100 bg-red-50 font-medium dark:border-neutral-800 dark:bg-red-950/40"
                            : "border-t border-neutral-100 dark:border-neutral-800"
                        }
                      >
                        <td className={`w-10 py-1.5 text-neutral-500 ${r.isTarget ? "border-l-4 border-l-red-500 pl-1.5" : ""}`}>#{r.rank}</td>
                        <td className="py-1.5">
                          {r.name}
                          {r.isTarget && " (this school)"}
                        </td>
                        {series.map((rank, i2) => (
                          <td key={periods[i2]} className="px-2 py-1.5 text-right text-neutral-600 dark:text-neutral-400">
                            {rank !== null ? `#${rank}` : "—"}
                          </td>
                        ))}
                        <td className="py-1.5 pl-2 text-right font-medium">{avg !== null ? `#${avg.toFixed(1)}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {targetSparklineValues.filter((v) => v !== null).length >= 2 && (
          <div className="flex flex-col items-center gap-1 lg:w-32 lg:shrink-0">
            <Sparkline values={targetSparklineValues} colour={FOCUS_SCHOOL_COLOUR} />
            <p className="text-center text-[10px] text-neutral-400">Rank over time (up = better)</p>
          </div>
        )}
      </div>
    </section>
  );
}

function MetricRanking({
  metric,
  group,
  targetUrn,
  filters,
  groupTotal,
}: {
  metric: Metric;
  group: DataViewSchoolProfile[];
  targetUrn: string;
  filters: DataViewFilterState;
  groupTotal: number;
}) {
  const entries = group.map((p) => ({
    urn: p.urn,
    name: p.name,
    value: metric.getValue(p, filters, groupTotal),
    isTarget: p.urn === targetUrn,
  }));
  const { ranked, targetRank, total } = rankDescendingWithTies(entries);
  if (total === 0) {
    return (
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{metric.label}</h3>
        <p className="text-sm text-neutral-500">No real data available for this metric in the current set.</p>
      </section>
    );
  }

  const isLarge = total > LARGE_SET_THRESHOLD;
  const targetIdx = ranked.findIndex((r) => r.isTarget);
  const visible = isLarge && targetIdx >= 0 ? ranked.slice(Math.max(0, targetIdx - NEIGHBOUR_WINDOW), targetIdx + NEIGHBOUR_WINDOW + 1) : ranked;

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{metric.label}</h3>
      {targetRank !== null && (
        <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          {isLarge ? (
            <>
              Top <strong>{100 - percentile(targetRank, total)}%</strong> of this set ({total} schools)
            </>
          ) : (
            <>
              Ranks <strong>#{targetRank}</strong> of {total}
            </>
          )}
        </p>
      )}
      <table className="w-full text-sm">
        <tbody>
          {visible.map((r) => (
            <tr
              key={r.urn}
              className={
                r.isTarget
                  ? "border-t border-neutral-100 bg-red-50 dark:border-neutral-800 dark:bg-red-950/30"
                  : "border-t border-neutral-100 dark:border-neutral-800"
              }
            >
              <td className="w-10 py-1.5 text-neutral-500">#{r.rank}</td>
              <td className="py-1.5">
                {r.name}
                {r.isTarget && " (this school)"}
              </td>
              <td className="py-1.5 text-right font-medium">{metric.format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const LARGE_SET_TOP_N = 15;

// Large-set design v1, item 3: the design doc's own "target rank/percentile plus the
// top 15 plus a neighbour window" -- a genuinely different display shape from
// MetricRanking's own isLarge branch above (which shows ONLY a neighbour window, no
// top-N), since at Region/Nation scale a member plausibly wants to see who's actually
// #1 as well as where their own school sits.
function LargeSetMetricRanking({
  metricLabel,
  format,
  data,
  targetUrn,
}: {
  metricLabel: string;
  format: (v: number) => string;
  data: RegionNationRankMetric;
  targetUrn: string;
}) {
  if (data.total === 0 || data.targetRank === null) {
    return (
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{metricLabel}</h3>
        <p className="text-sm text-neutral-500">No real data available for this metric in the current set.</p>
      </section>
    );
  }

  const targetInTop15 = data.targetRank <= LARGE_SET_TOP_N;
  // Neighbours past rank 15 only -- top15 already covers ranks 1-15, so this avoids
  // showing the same row twice when the target's own rank is close to 15 (e.g. rank
  // 18's neighbour window, 13-23, overlaps top15's own 13-15).
  const neighboursBeyondTop15 = data.neighbours.filter((r) => r.rank > LARGE_SET_TOP_N);

  const row = (r: { urn: string; name: string; value: number; rank: number }) => (
    <tr
      key={r.urn}
      className={
        r.urn === targetUrn
          ? "border-t border-neutral-100 bg-red-50 dark:border-neutral-800 dark:bg-red-950/30"
          : "border-t border-neutral-100 dark:border-neutral-800"
      }
    >
      <td className="w-10 py-1.5 text-neutral-500">#{r.rank}</td>
      <td className="py-1.5">
        {r.name}
        {r.urn === targetUrn && " (this school)"}
      </td>
      <td className="py-1.5 text-right font-medium">{format(r.value)}</td>
    </tr>
  );

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{metricLabel}</h3>
      <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
        Top <strong>{100 - percentile(data.targetRank, data.total)}%</strong> of this set ({data.total.toLocaleString()} schools) — ranks{" "}
        <strong>#{data.targetRank.toLocaleString()}</strong>
      </p>
      <table className="w-full text-sm">
        <tbody>{data.top15.map(row)}</tbody>
      </table>
      {!targetInTop15 && neighboursBeyondTop15.length > 0 && (
        <>
          <p className="mt-3 mb-1 text-xs text-neutral-400">Around this school</p>
          <table className="w-full text-sm">
            <tbody>{neighboursBeyondTop15.map(row)}</tbody>
          </table>
        </>
      )}
    </section>
  );
}
