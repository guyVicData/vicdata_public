"use client";

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Section 01, Graph 1:
// column/bar chart of the TARGET's own filtered roll, one bar per real academic
// year, with a fitted trend line overlaid across the bar tops. No existing
// component does this exact combo -- CombinedRollChart.tsx is the closest
// precedent (same least-squares trend-line fit, reused verbatim below) but that
// chart plots the SET's combined total as a lollipop (stem + dot); this one plots
// ONE school as real bars, in FOCUS_SCHOOL_COLOUR (the same red used everywhere
// else in this app for the target/focus school's own line), per direct
// instruction.
//
// Follow-up round (2026-09-16), item 2: three fixes --
//   - Y-scale: was deliberately zero-based ("a bar chart's whole visual language
//     depends on bars starting from a real zero"), but that compressed a real
//     few-percent year-on-year move into the top sliver of the bar, making the
//     actual trend hard to see. Reused CombinedRollChart's own zoomed-axis pattern
//     verbatim (real min/max + 15% headroom each side, same "adjust vertical scale
//     to show trends clearly" instruction that chart was already built from) --
//     bars still visually start at minY (not floating), same look CombinedRollChart's
//     own lollipop stems already have.
//   - The trend line previously had no caption anywhere; GraphsView.tsx now renders
//     a TrendStatement-style caption in the card around this chart (built from the
//     same rollTrendBadge already computed there), not inside this component.
//   - Made visually distinct from RollTrendsChart's own "average roll of this set"
//     line (both used to be near-identical: currentColor, ~0.4-0.5 opacity, dashed
//     "4 3", 1.5 width) -- Guy's own words, these two need to read as different
//     things. This chart's bars are already in FOCUS_SCHOOL_COLOUR (this school's
//     own colour identity, not a generic grey), so the trend line now ties to that
//     same colour -- solid, not dashed, and full-strength rather than muted.
function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

export default function TargetRollBarChart({ periods, values, colour }: { periods: number[]; values: (number | null)[]; colour: string }) {
  const real = values.map((v, i) => (v === null ? null : { i, v })).filter((p): p is { i: number; v: number } => p !== null);
  if (real.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough real history to plot a trend.</p>;
  }

  // Same zoomed-axis pattern as CombinedRollChart.tsx: real spread gets 15%
  // headroom each side; a near-flat series (span ~0) falls back to a modest
  // 5%-of-value pad instead of dividing by ~zero.
  const rawMin = Math.min(...real.map((p) => p.v));
  const rawMax = Math.max(...real.map((p) => p.v));
  const span = rawMax - rawMin;
  const pad = span > 0 ? span * 0.15 : Math.max(rawMax * 0.05, 1);
  const minY = Math.max(0, rawMin - pad);
  const maxY = rawMax + pad;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;
  const barWidth = Math.min(36, (innerW / periods.length) * 0.6);

  // Same least-squares linear regression as CombinedRollChart.tsx, reused
  // verbatim (real points only, so a genuine gap year doesn't skew the fit).
  const n = real.length;
  const sumX = real.reduce((s, p) => s + p.i, 0);
  const sumY = real.reduce((s, p) => s + p.v, 0);
  const sumXY = real.reduce((s, p) => s + p.i * p.v, 0);
  const sumXX = real.reduce((s, p) => s + p.i * p.i, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const trendAt = (i: number) => intercept + slope * i;

  const yTicks = [minY, (minY + maxY) / 2, maxY].map((v) => Math.round(v / 10) * 10);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
          <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill="currentColor" fillOpacity={0.5} textAnchor="end">
            {t.toLocaleString()}
          </text>
        </g>
      ))}
      {periods.map((p, i) => (
        <text key={p} x={x(i)} y={HEIGHT - 8} fontSize={10} fill="currentColor" fillOpacity={0.5} textAnchor="middle">
          {academicYearLabel(p)}
        </text>
      ))}

      {real.map(({ i, v }) => (
        <rect
          key={i}
          x={x(i) - barWidth / 2}
          y={y(v)}
          width={barWidth}
          height={Math.max(0, y(minY) - y(v))}
          rx={2}
          fill={colour}
        >
          <title>
            {academicYearLabel(periods[i])}: {v.toLocaleString()}
          </title>
        </rect>
      ))}

      <line
        x1={x(real[0].i)}
        y1={y(trendAt(real[0].i))}
        x2={x(real[real.length - 1].i)}
        y2={y(trendAt(real[real.length - 1].i))}
        stroke={colour}
        strokeOpacity={0.85}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
