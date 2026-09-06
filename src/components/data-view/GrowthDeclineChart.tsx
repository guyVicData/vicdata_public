"use client";

// Graphs redesign v1: new growth/decline-rate chart, one diverging bar per school
// (left of the centre-line = decline, right = growth), reusing the Map's own already-
// validated blue/red diverging scale (trend-colours.ts's trendColour -- brief's
// explicit "reuse the Map's validated pair, don't invent a third scheme"). The focus
// school is identified by a ring/outline, not a forced fill colour, since this
// chart's colour job is direction, not identity -- its bar still gets trendColour's
// real value like every other school's.
//
// Sorted largest-growth-to-largest-decline; not specified in the brief, a reasonable
// default for a diverging chart (same "chosen, not discovered, easy to revisit"
// discipline as this codebase's other unspecified defaults, e.g. data-view-cards.ts's
// sizeBand tertiles).

import { trendColour } from "@/lib/trend-colours";

export default function GrowthDeclineChart({
  points,
}: {
  points: { urn: string; name: string; pctChange: number | null; isTarget: boolean }[];
}) {
  const withData = points.filter((p): p is { urn: string; name: string; pctChange: number; isTarget: boolean } => p.pctChange !== null);
  if (withData.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough history to compute growth/decline.</p>;
  }
  const sorted = [...withData].sort((a, b) => b.pctChange - a.pctChange);
  const maxAbs = Math.max(...sorted.map((p) => Math.abs(p.pctChange)), 5);

  return (
    <div className="space-y-1.5">
      {sorted.map((p) => {
        const widthPct = (Math.abs(p.pctChange) / maxAbs) * 50;
        const sign = p.pctChange > 0 ? "+" : "";
        return (
          <div key={p.urn} className="flex items-center gap-2" title={`${p.name}: ${sign}${p.pctChange.toFixed(0)}%`}>
            <span
              className={`w-20 shrink-0 truncate text-xs ${p.isTarget ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}
            >
              {p.name}
            </span>
            <div className="relative h-3 flex-1">
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-neutral-300 dark:bg-neutral-700" />
              <div
                className={`absolute inset-y-0 rounded ${p.isTarget ? "ring-2 ring-neutral-900 dark:ring-neutral-100" : ""}`}
                style={{
                  left: p.pctChange >= 0 ? "50%" : `${50 - widthPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: trendColour(p.pctChange),
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-500">
              {sign}
              {p.pctChange.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
