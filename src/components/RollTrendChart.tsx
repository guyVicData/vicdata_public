"use client";

import { useState } from "react";
import { AGE_BANDS, type RollSnapshot } from "@/lib/roll-data";

// Categorical palette, validated (dataviz skill, references/palette.md) -- fixed
// order, one slot per age band, never cycled/reassigned by which bands happen to be
// non-zero for a given school. Actual hex values live as CSS custom properties below
// (--series-{key}) so light/dark swap in one place.

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export default function RollTrendChart({ trend }: { trend: RollSnapshot[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (trend.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough years of data to chart a trend.</p>;
  }

  const bandsWithData = AGE_BANDS.filter((b) =>
    trend.some((t) => (t.byAgeBand.find((x) => x.key === b.key)?.total ?? 0) > 0),
  );

  const maxY = Math.max(...trend.map((t) => t.totalRoll)) * 1.1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (trend.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const yTicks = [0, Math.round(maxY / 2 / 10) * 10, Math.round(maxY / 10) * 10];

  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          color-scheme: light;
          --surface-1: #fcfcfb;
          --text-secondary: #52514e;
          --text-muted: #85837c;
          --grid: #e4e2dc;
          --series-early_years: #2a78d6;
          --series-primary: #eb6834;
          --series-secondary: #1baf7a;
          --series-sixth_form: #eda100;
          --series-nineteen_plus: #e87ba4;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --surface-1: #1a1a19;
            --text-secondary: #c3c2b7;
            --text-muted: #8f8d84;
            --grid: #333230;
            --series-early_years: #3987e5;
            --series-primary: #d95926;
            --series-secondary: #199e70;
            --series-sixth_form: #c98500;
            --series-nineteen_plus: #d55181;
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --surface-1: #1a1a19;
          --text-secondary: #c3c2b7;
          --text-muted: #8f8d84;
          --grid: #333230;
          --series-early_years: #3987e5;
          --series-primary: #d95926;
          --series-secondary: #199e70;
          --series-sixth_form: #c98500;
          --series-nineteen_plus: #d55181;
        }
      `}</style>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill="var(--text-muted)" textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {trend.map((t, i) => (
          <text
            key={t.period}
            x={x(i)}
            y={HEIGHT - 6}
            fontSize={11}
            fill="var(--text-muted)"
            textAnchor="middle"
          >
            {t.period}
          </text>
        ))}

        {bandsWithData.map((band) => {
          const stroke = `var(--series-${band.key})`;
          const points = trend.map((t, i) => {
            const val = t.byAgeBand.find((b) => b.key === band.key)?.total ?? 0;
            return `${x(i)},${y(val)}`;
          });
          return (
            <g key={band.key}>
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {trend.map((t, i) => {
                const val = t.byAgeBand.find((b) => b.key === band.key)?.total ?? 0;
                return (
                  <circle
                    key={t.period}
                    cx={x(i)}
                    cy={y(val)}
                    r={4}
                    fill={stroke}
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Hover hit targets */}
        {trend.map((t, i) => (
          <rect
            key={t.period}
            x={x(i) - innerW / trend.length / 2}
            y={PAD.top}
            width={innerW / trend.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}

        {hoverIdx !== null && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        {bandsWithData.map((band) => (
          <span key={band.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: `var(--series-${band.key})` }}
            />
            {band.label}
          </span>
        ))}
      </div>

      {/* Tooltip / readout */}
      {hoverIdx !== null && (
        <div className="mt-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          <strong>{trend[hoverIdx].period}</strong> — total {trend[hoverIdx].totalRoll.toLocaleString()}
          {bandsWithData.map((band) => {
            const val = trend[hoverIdx].byAgeBand.find((b) => b.key === band.key)?.total ?? 0;
            if (val === 0) return null;
            return (
              <span key={band.key} className="ml-3">
                {band.label}: {val}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
