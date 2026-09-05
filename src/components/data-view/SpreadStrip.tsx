"use client";

// Member Data View: the "spread/dot-strip of the ticked group" visualisation used by
// every Dashboard card (brief §5) and, at large-set scale, Rankings' own percentile
// view (brief §7: "this converges with Dashboard's spread/distribution treatment").
// Plain inline SVG, no charting library -- matches this repo's own established
// "hand-rolled SVG" convention (module comment, SchoolMap.tsx) for everything except
// the one deliberate Leaflet exception.

import type { SpreadPoint } from "@/lib/data-view-cards";

const WIDTH = 100; // percent-based viewBox, scales via the wrapping <svg>'s own width
const HEIGHT = 36;
const DOT_R = 4;
const TARGET_R = 6;

export default function SpreadStrip({
  min,
  max,
  points,
  formatValue,
}: {
  min: number;
  max: number;
  points: SpreadPoint[];
  formatValue: (v: number) => string;
}) {
  const span = max - min;
  const x = (v: number) => (span <= 0 ? WIDTH / 2 : 4 + ((v - min) / span) * (WIDTH - 8));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-9 w-full" preserveAspectRatio="none">
        <line x1={4} y1={HEIGHT / 2} x2={WIDTH - 4} y2={HEIGHT / 2} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
        {points
          .filter((p) => !p.isTarget)
          .map((p) => (
            <circle key={p.urn} cx={x(p.value)} cy={HEIGHT / 2} r={DOT_R} className="fill-neutral-400 dark:fill-neutral-600" opacity={0.7}>
              <title>{`${p.name}: ${formatValue(p.value)}`}</title>
            </circle>
          ))}
        {points
          .filter((p) => p.isTarget)
          .map((p) => (
            <circle key={p.urn} cx={x(p.value)} cy={HEIGHT / 2} r={TARGET_R} className="fill-none stroke-red-600" strokeWidth={2.5}>
              <title>{`${p.name} (this school): ${formatValue(p.value)}`}</title>
            </circle>
          ))}
      </svg>
      <div className="mt-0.5 flex justify-between text-xs text-neutral-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}
