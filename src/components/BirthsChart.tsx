"use client";

// Births bar chart with an overlaid trend line (population-trends-panel build,
// 2026-09-27) -- same .viz-root/CSS-custom-property convention RollTrendChart.tsx
// already uses for its own per-series colours (light/dark/data-theme="dark" blocks).
// A genuinely distinct colour (--series-births), not the trend-tier ramp
// (PopulationTrendSection.tsx's own TIER_COLOUR) the two existing age-profile charts
// already use for their bars -- this one needs to read as visually different, not a
// third instance of the same colour system.
const WIDTH = 320;
const HEIGHT = 170;
const PAD = { top: 12, right: 8, bottom: 22, left: 40 };

export default function BirthsChart({ series }: { series: { year: number; count: number }[] }) {
  if (series.length < 2) {
    return <p className="text-[12.5px] text-stone-500 dark:text-stone-400">Not enough years of data to chart a trend.</p>;
  }

  const maxY = Math.max(...series.map((s) => s.count)) * 1.1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const bandW = innerW / series.length;
  const x = (i: number) => PAD.left + i * bandW + bandW / 2;
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;
  const barW = bandW * 0.5;
  const yTicks = [0, Math.round(maxY / 2 / 10) * 10, Math.round(maxY / 10) * 10];

  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          color-scheme: light;
          --surface-1: #fcfcfb;
          --text-muted: #85837c;
          --grid: #e4e2dc;
          --series-births: #8a6bb8;
          --series-births-line: #513a7a;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --surface-1: #1a1a19;
            --text-muted: #8f8d84;
            --grid: #333230;
            --series-births: #b6a0dd;
            --series-births-line: #d7c8f0;
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --surface-1: #1a1a19;
          --text-muted: #8f8d84;
          --grid: #333230;
          --series-births: #b6a0dd;
          --series-births-line: #d7c8f0;
        }
      `}</style>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} fontSize={9.5} fill="var(--text-muted)" textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {series.map((s, i) => (
          <rect
            key={s.year}
            x={x(i) - barW / 2}
            y={y(s.count)}
            width={barW}
            height={PAD.top + innerH - y(s.count)}
            fill="var(--series-births)"
            opacity={0.65}
            rx={2}
          />
        ))}

        <polyline
          points={series.map((s, i) => `${x(i)},${y(s.count)}`).join(" ")}
          fill="none"
          stroke="var(--series-births-line)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {series.map((s) => {
          const i = series.indexOf(s);
          return (
            <circle key={s.year} cx={x(i)} cy={y(s.count)} r={3} fill="var(--series-births-line)" stroke="var(--surface-1)" strokeWidth={1.5} />
          );
        })}

        {series.map((s, i) => (
          <text key={s.year} x={x(i)} y={HEIGHT - 6} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
            {s.year}
          </text>
        ))}
      </svg>
    </div>
  );
}
