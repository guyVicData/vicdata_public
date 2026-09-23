"use client";

// Teacher view, round 6: the Candidates Current panel's bar chart (Main.dc.html).
//
// Deliberately NOT a fourth ViewChart layout. ViewChart's bars all share one shape -- a
// horizontal track with the value at the end -- and this is the other shape: a value axis
// up the side, gridlines across, and a category per column underneath. Folding it in
// would mean a `layout` prop that switches the axis as well as the arrangement, which is
// two charts in one component wearing a single name.
//
// Same build rules as ViewChart, though: divs on a baseline, no canvas, no library, every
// colour either a theme token or the subject's own qualification colour.
import type { Measure } from "@/lib/teacher-view-panels";

export type VerticalBar = { key: string; label: string; shortLabel: string; value: number | null; colour: string };

export function VerticalBars({
  bars,
  measure,
  fullscreen = false,
}: {
  bars: VerticalBar[];
  measure: Measure;
  fullscreen?: boolean;
}) {
  const real = bars.map((b) => b.value).filter((v): v is number => v !== null);
  if (real.length === 0) return <p className="text-xs text-[var(--muted)]">No published figures for these subjects yet.</p>;

  // Round 7 §5: the tallest real bar fills the chart. This used to round up to a "nice"
  // round number, which on a real dashboard meant Candidates' tallest bar of 231 being
  // drawn against an axis top of 500 -- half the height, for no reason a reader could
  // see. The axis figures are the data's own now, not a rounder number near it.
  const top = Math.max(...real);
  const plot = fullscreen ? 220 : 90;
  const bodyH = plot - 16; // the label strip under the baseline
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="mt-1 flex gap-2">
      <svg width="30" height={plot} viewBox={`0 0 30 ${plot}`} aria-hidden="true" className="shrink-0">
        {ticks.map((t) => (
          <text key={t} x="28" y={6 + (1 - t) * bodyH + 3} textAnchor="end" fontSize="9.5" fill="var(--muted)">
            {measure.format(top * t)}
          </text>
        ))}
      </svg>
      <div className="relative flex-grow">
        {/* Gridlines sit behind the bars at the same offsets the axis labels use, so a
            bar's top genuinely meets the line its figure is written against. */}
        {ticks.slice(0, -1).map((t) => (
          <div key={t} className="absolute inset-x-0 h-px bg-[var(--panel-border)]" style={{ top: 6 + (1 - t) * bodyH }} />
        ))}
        <div className="absolute inset-x-0 h-px bg-[var(--panel-border2)]" style={{ top: 6 + bodyH }} />
        {/* pt-[6px] matches the axis SVG's own 6px inset, which is what keeps the two
            columns' baselines on the same line without absolute positioning. */}
        <div className="flex gap-4 overflow-x-auto px-1 pt-[6px]">
          {bars.map((b) => (
            <div
              key={b.key}
              className="flex shrink-0 flex-col items-center gap-1"
              title={`${b.label}: ${b.value === null ? "no figure" : measure.format(b.value)}`}
            >
              <div className="flex items-end" style={{ height: bodyH }}>
                <div
                  className="rounded-t"
                  style={{
                    width: bars.length > 5 ? 20 : 26,
                    height: b.value === null ? 0 : Math.max(2, (b.value / top) * bodyH),
                    background: b.colour,
                  }}
                />
              </div>
              <span className="max-w-[4rem] truncate text-[10px] text-[var(--muted3)]">{b.shortLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
