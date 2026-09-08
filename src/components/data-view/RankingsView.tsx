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
import { profileToFilterableData } from "@/lib/data-view-serialize";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { rankDescendingWithTies, percentile, memberSetMarketShare, LARGE_SET_THRESHOLD, NEIGHBOUR_WINDOW } from "@/lib/data-view-cards";
import type { RegionNationRankResult, RegionNationRankMetric } from "@/lib/region-nation-comparator";

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

  return (
    <div className="space-y-6">
      {METRICS.map((metric) => (
        <MetricRanking key={metric.key} metric={metric} group={group} targetUrn={targetProfile.urn} filters={filters} groupTotal={groupTotal} />
      ))}
    </div>
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
