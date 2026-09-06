"use client";

// Graphs redesign v1, Section 02 main graph (2026-09-08 update to
// docs/vicdata_phase3_member_data_view_graphs_redesign_v1.md): the focus school's
// own share of the comparator set's combined roll, per year, as a single line+area
// chart -- one accent hue, not the categorical palette, since there's only ever one
// series on this chart (unlike Section 01's main graph, which needs colour to
// distinguish many schools). Same every-year x-axis gridlines and real y-axis
// value-label conventions as Section 01's main graph, just labelled in % rather
// than raw counts.

function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const ACCENT = "#2563eb"; // blue-600 -- a single metric accent, distinct from focus-red and the diverging pair

export default function MarketShareTrendChart({ periods, values }: { periods: number[]; values: (number | null)[] }) {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough real history to plot market share.</p>;
  }

  const maxY = Math.min(100, Math.max(...real) * 1.15);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / (maxY || 1)) * innerH;

  let line = "";
  let area = "";
  let started = false;
  let lastRealIdx: number | null = null;
  values.forEach((v, i) => {
    if (v === null) return;
    line += `${started ? "L" : "M"}${x(i)},${y(v)} `;
    area += `${started ? "L" : "M"}${x(i)},${started ? y(v) : y(0)} `;
    if (!started) area += `L${x(i)},${y(v)} `;
    started = true;
    lastRealIdx = i;
  });
  if (lastRealIdx !== null) area += `L${x(lastRealIdx)},${y(0)} Z`;

  const yTicks = [0, maxY / 2, maxY].map((v) => Math.round(v));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
          <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill="currentColor" fillOpacity={0.5} textAnchor="end">
            {t}%
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

      <path d={area} fill={ACCENT} fillOpacity={0.12} stroke="none" />
      <path d={line} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) =>
        v === null ? null : (
          <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={ACCENT}>
            <title>
              {academicYearLabel(periods[i])}: {v.toFixed(1)}%
            </title>
          </circle>
        ),
      )}
    </svg>
  );
}
