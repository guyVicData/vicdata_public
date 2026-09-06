"use client";

// Graphs redesign v1 addition (2026-09-08 update to
// docs/vicdata_phase3_member_data_view_graphs_redesign_v1.md), Section 01: a large
// chart directly under Roll Trends -- the TOTAL combined population of every school
// currently in the comparator set, one aggregate summed figure per year (not broken
// out by school), as a lollipop chart (a stem + dot per year) with a trend line
// overlaid.
//
// "Trend line" read as a genuinely FITTED line (least-squares linear regression
// through the real points), not just connecting the dots -- connecting the dots
// would just be the lollipop chart's own data, not something visually distinct
// worth calling "a trend line" separately. Rendered dashed/muted (currentColor,
// same overlay convention as RollTrendsChart's own average line) so it doesn't
// compete with the accent-coloured yearly marks. Logged as a judgement call in
// docs/vicdata_data_view_open_questions.md -- not specified further in the doc.
//
// 2026-09-08, follow-up refinement: moved from a small right-column tile to a large
// chart in the main column, and the y-axis is now ZOOMED to the real data's own
// range (with headroom) rather than forced to a true zero baseline, per Guy's direct
// "adjust vertical scale to show trends clearly" -- a combined roll in the
// thousands typically moves by a few percent year to year, which a zero-based axis
// visually flattens to a near-straight line. This deliberately departs from
// RollTrendsChart's own zero-based convention directly above it: that chart's
// zero-basing matters because it's comparing many schools' relative SIZES against
// each other and against zero; this chart has only one series, where the shape of
// the trend (not a zero reference) is the entire point. Logged in
// docs/vicdata_data_view_open_questions.md.

function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };
const ACCENT = "#0d9488"; // teal-600 -- a metric accent distinct from focus-red, the market-share-blue accent, and the diverging blue/red pair

export default function CombinedRollChart({ periods, values }: { periods: number[]; values: (number | null)[] }) {
  const real = values.map((v, i) => (v === null ? null : { i, v })).filter((p): p is { i: number; v: number } => p !== null);
  if (real.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough real history to plot a combined trend.</p>;
  }

  const rawMin = Math.min(...real.map((p) => p.v));
  const rawMax = Math.max(...real.map((p) => p.v));
  const span = rawMax - rawMin;
  // A real spread gets 15% headroom each side (zoomed to show the trend's actual
  // shape); a near-flat series (span ~0) falls back to a modest 5%-of-value pad so
  // it doesn't divide by ~zero and blow the axis up.
  const pad = span > 0 ? span * 0.15 : Math.max(rawMax * 0.05, 1);
  const minY = Math.max(0, rawMin - pad);
  const maxY = rawMax + pad;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;

  // Least-squares linear regression over the real points only, so a school-set gap
  // year doesn't skew the fit toward a false zero.
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
        <g key={p}>
          <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
          <text x={x(i)} y={HEIGHT - 8} fontSize={10} fill="currentColor" fillOpacity={0.5} textAnchor="middle">
            {academicYearLabel(p)}
          </text>
        </g>
      ))}

      <line
        x1={x(real[0].i)}
        y1={y(trendAt(real[0].i))}
        x2={x(real[real.length - 1].i)}
        y2={y(trendAt(real[real.length - 1].i))}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeDasharray="4 3"
        strokeWidth={1.5}
      />

      {real.map(({ i, v }) => (
        <g key={i}>
          <line x1={x(i)} x2={x(i)} y1={y(minY)} y2={y(v)} stroke={ACCENT} strokeWidth={2} />
          <circle cx={x(i)} cy={y(v)} r={4.5} fill={ACCENT}>
            <title>
              {academicYearLabel(periods[i])}: {v.toLocaleString()}
            </title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
