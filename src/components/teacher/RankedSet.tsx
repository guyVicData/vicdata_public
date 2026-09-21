"use client";

// Teacher view, round 5: how one of the Rankings card's pinnable comparator sets renders --
// the same "N of M" anchor the default box leads with (§14: the position is the anchor,
// the figure never stands alone), then the whole set ranked.
import { rankOf, type RankedSchool } from "@/lib/teacher-view-rankings";

export type RankedSetRow = RankedSchool & { distanceKm: number | null; cohortSize?: number | null; igcseExcluded?: boolean };

export function RankedSet({
  rows,
  headlineLabel,
  formatValue,
  showCohort,
  fullscreen,
  emptyText,
}: {
  rows: RankedSetRow[] | undefined;
  headlineLabel: string;
  formatValue: (v: number) => string;
  // Similar-sized sets are chosen on cohort size, so they show it: a set whose reason for
  // existing is invisible reads as arbitrary.
  showCohort?: boolean;
  fullscreen: boolean;
  emptyText: string;
}) {
  const target = rows?.find((r) => r.isTarget);
  const position = rows && target ? rankOf(rows, target.urn) : null;
  if (!rows || rows.length <= 1 || !position) {
    return <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{emptyText}</p>;
  }
  const ranked = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  return (
    <>
      <p className={`mt-2 font-semibold tabular-nums ${fullscreen ? "text-5xl" : "text-3xl"}`}>
        {position.position}
        <span className="ml-1 text-base font-normal text-neutral-500">of {position.outOf}</span>
      </p>
      <p className="text-sm text-neutral-500">on {headlineLabel}</p>
      <ol className={`mt-3 space-y-1 ${fullscreen ? "text-base" : "text-sm"}`}>
        {ranked.map((r) => (
          <li key={r.urn} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 ${r.isTarget ? "font-semibold" : ""}`}>
            <span className="truncate">{r.name}</span>
            <span className="text-xs tabular-nums text-neutral-500">
              {showCohort && r.cohortSize ? `${Math.round(r.cohortSize).toLocaleString()} pupils` : !r.isTarget && r.distanceKm !== null ? `${r.distanceKm.toFixed(1)} km` : ""}
            </span>
            <span className="tabular-nums">
              {r.igcseExcluded ? (
                <span className="text-neutral-400" title="DfE's performance tables exclude IGCSEs, which this school uses instead of reformed GCSEs.">IGCSE, not comparable</span>
              ) : r.value === null ? (
                <span className="text-neutral-400">no figure</span>
              ) : (
                formatValue(r.value)
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
