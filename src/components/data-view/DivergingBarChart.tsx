"use client";

// Graphs redesign v1: diverging bar chart (left of the centre-line = decline, right =
// growth), reusing the Map's own diverging scale (trend-colours.ts's trendColour --
// brief's explicit "reuse the Map's validated pair, don't invent a third scheme";
// 2026-09-11: that scale itself moved from red/grey/blue to red/orange/amber/green,
// see trend-colours.ts's own header for why -- this component still just calls
// trendColour() and gets whatever the shared scale currently is, so it picked up the
// new palette automatically, no change needed here). The focus school is identified
// by a ring/outline, not a forced fill colour, since this chart's colour job is
// direction, not identity -- its bar still gets trendColour's real value like every
// other school's.
//
// Sorted largest-growth-to-largest-decline; not specified in the brief, a reasonable
// default for a diverging chart (same "chosen, not discovered, easy to revisit"
// discipline as this codebase's other unspecified defaults, e.g. data-view-cards.ts's
// sizeBand tertiles).
//
// 2026-09-08: generalised from GrowthDeclineChart -- Section 02's own market-share
// growth/decline tile is "same blue/red diverging convention as Section 01's
// growth/decline chart" per the redesign doc, just a different value (percentage-
// POINT change in share, not % change in roll) with its own label suffix, so this is
// the one shared component behind both. formatValue defaults to Section 01's own
// "+N%" roll-growth format; Market Share passes a "+N.Npp" formatter (percentage
// points, since the underlying value is already itself a percentage).

import { trendColour } from "@/lib/trend-colours";

export default function DivergingBarChart({
  points,
  formatValue = (v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`,
}: {
  points: { urn: string; name: string; pctChange: number | null; isTarget: boolean }[];
  formatValue?: (v: number) => string;
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
        return (
          <div key={p.urn} className="flex items-center gap-2" title={`${p.name}: ${formatValue(p.pctChange)}`}>
            {/* Follow-up round (2026-09-16), item 1: a real school name (e.g. "La
                Sainte Union Catholic Secondary School") was getting cut off at the
                old fixed w-20 (80px) -- widened here, in the one shared component
                behind Section 02's Growth/decline chart, Section 03's market-share
                growth/decline tile, and the sector-fallback growth chart, so the
                fix applies everywhere this renders rather than one caller. Narrower
                on small screens (w-28, 112px) than large (sm:w-44, 176px) so the
                bar area itself doesn't get squeezed out on a narrow viewport. */}
            <span
              className={`w-28 shrink-0 truncate text-xs sm:w-44 ${p.isTarget ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}
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
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">{formatValue(p.pctChange)}</span>
          </div>
        );
      })}
    </div>
  );
}
