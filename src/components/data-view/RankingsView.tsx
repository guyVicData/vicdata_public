"use client";

// Member Data View Rankings (brief §7): same cards as Dashboard, re-rendered as
// ranked lists -- shape excluded entirely. Target's row highlighted in place, plus a
// one-line "ranks #N of M" summary. Shared-rank ties (two schools both #3, next is
// #5). Large sets (brief's own defensive threshold, LARGE_SET_THRESHOLD) switch the
// headline to percentile and show a neighbour window rather than the whole list.

import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { profileToFilterableData } from "@/lib/data-view-profiles";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import { rankDescendingWithTies, percentile, memberSetMarketShare, LARGE_SET_THRESHOLD, NEIGHBOUR_WINDOW } from "@/lib/data-view-cards";

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

export default function RankingsView({
  targetProfile,
  tickedProfiles,
  filters,
}: {
  targetProfile: DataViewSchoolProfile;
  tickedProfiles: DataViewSchoolProfile[];
  filters: DataViewFilterState;
}) {
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
