"use client";

import { useState } from "react";

export type PeerSchool = {
  urn: string;
  name: string;
  isAnchor: boolean;
  trend: { period: number; totalRoll: number }[];
};

// Same validated categorical palette as RollTrendChart (dataviz skill), fixed order
// assigned by render order (first school = slot 1, etc.) -- capped at 8, the
// adjacent-pairlist limit for a line chart (references/palette.md).
const SLOT_COLORS_LIGHT = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];
const SLOT_COLORS_DARK = [
  "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767",
];

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export default function PeerTrendChart({ schools }: { schools: PeerSchool[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const withData = schools.filter((s) => s.trend.length >= 2).slice(0, 8);
  if (withData.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough trend data among this set to chart.</p>;
  }

  const allPeriods = Array.from(new Set(withData.flatMap((s) => s.trend.map((t) => t.period)))).sort(
    (a, b) => a - b,
  );
  const maxY = Math.max(...withData.flatMap((s) => s.trend.map((t) => t.totalRoll))) * 1.1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (allPeriods.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;
  const yTicks = [0, Math.round(maxY / 2 / 10) * 10, Math.round(maxY / 10) * 10];

  return (
    <div className="viz-root">
      <style>{`
        .viz-root { color-scheme: light; --surface-1:#fcfcfb; --text-muted:#85837c; --grid:#e4e2dc; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root { color-scheme: dark; --surface-1:#1a1a19; --text-muted:#8f8d84; --grid:#333230; }
        }
        :root[data-theme="dark"] .viz-root { color-scheme: dark; --surface-1:#1a1a19; --text-muted:#8f8d84; --grid:#333230; }
      `}</style>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" onMouseLeave={() => setHoverIdx(null)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill="var(--text-muted)" textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {allPeriods.map((p, i) => (
          <text key={p} x={x(i)} y={HEIGHT - 6} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
            {p}
          </text>
        ))}

        {withData.map((school, slot) => {
          const stroke = SLOT_COLORS_LIGHT[slot % 8];
          const points = allPeriods
            .map((p, i) => {
              const point = school.trend.find((t) => t.period === p);
              return point ? `${x(i)},${y(point.totalRoll)}` : null;
            })
            .filter(Boolean)
            .join(" ");
          return (
            <g key={school.urn}>
              <polyline
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth={school.isAnchor ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={school.isAnchor ? "" : "opacity-70"}
              />
            </g>
          );
        })}

        {allPeriods.map((p, i) => (
          <rect
            key={p}
            x={x(i) - innerW / allPeriods.length / 2}
            y={PAD.top}
            width={innerW / allPeriods.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        {withData.map((school, slot) => (
          <span key={school.urn} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: SLOT_COLORS_LIGHT[slot % 8] }}
            />
            {school.name}
            {school.isAnchor && " (this school)"}
          </span>
        ))}
      </div>

      {hoverIdx !== null && (
        <div className="mt-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          <strong>{allPeriods[hoverIdx]}</strong>
          {withData.map((school) => {
            const point = school.trend.find((t) => t.period === allPeriods[hoverIdx]);
            if (!point) return null;
            return (
              <span key={school.urn} className="ml-3">
                {school.name}: {point.totalRoll.toLocaleString()}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
