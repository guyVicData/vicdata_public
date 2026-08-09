"use client";

import { useState } from "react";
import type { AgeGenderCounts } from "@/lib/roll-data";
import { SHAPE_CLASSIFICATION_MIN_AGE, SHAPE_CLASSIFICATION_MAX_AGE } from "@/lib/roll-data";

// Horizontal population-pyramid shape chart (chart palette doc, "Public View
// rebuild"). Ages on the y-axis, oldest at top / youngest at bottom -- boys extend
// left of a centred zero line, girls extend right. Colors validated through the
// colourblind-safety validator (dataviz skill) before being treated as final: ΔE 34.9
// CVD separation, one dark-mode contrast WARN on the purple, addressed by never
// relying on the bar color alone -- a legend and a value readout are always present.

const EDGE_AGE_MIN = SHAPE_CLASSIFICATION_MIN_AGE - 1; // 4: shown, tinted, excluded from classification
const EDGE_AGE_MAX = SHAPE_CLASSIFICATION_MAX_AGE + 1; // 18: shown, tinted, excluded from classification
const EDGE_AGES = new Set([EDGE_AGE_MIN, EDGE_AGE_MAX]);

const ROW_HEIGHT = 20;
const ROW_GAP = 2;
const WIDTH = 560;
const PAD = { top: 8, right: 40, bottom: 28, left: 40 };

export default function ShapeChart({ ageGenderCounts }: { ageGenderCounts: AgeGenderCounts }) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const ages: number[] = [];
  for (let age = EDGE_AGE_MAX; age >= EDGE_AGE_MIN; age--) ages.push(age); // oldest first (top row)

  const rows = ages.map((age) => {
    const c = ageGenderCounts.get(age);
    return { age, male: c?.male ?? 0, female: c?.female ?? 0, isEdge: EDGE_AGES.has(age) };
  });

  const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.male, r.female)));
  const innerH = ages.length * ROW_HEIGHT + (ages.length - 1) * ROW_GAP;
  const height = PAD.top + PAD.bottom + innerH;
  const halfWidth = (WIDTH - PAD.left - PAD.right) / 2;
  const centerX = PAD.left + halfWidth;
  const scale = halfWidth / maxVal;

  const rowY = (i: number) => PAD.top + i * (ROW_HEIGHT + ROW_GAP);

  if (rows.every((r) => r.male === 0 && r.female === 0)) {
    return <p className="text-sm text-neutral-500">No age-by-age roll data to chart.</p>;
  }

  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          color-scheme: light;
          --surface-1: #fcfcfb;
          --axis-label: #4d4d4d;
          --grid: #e4e2dc;
          --boys: #8000ff;
          --girls: #fb0207;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --surface-1: #1a1a19;
            --axis-label: #cccccc;
            --grid: #333230;
            --boys: #8000ff;
            --girls: #fb0207;
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --surface-1: #1a1a19;
          --axis-label: #cccccc;
          --grid: #333230;
          --boys: #8000ff;
          --girls: #fb0207;
        }
      `}</style>

      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" onMouseLeave={() => setHoverAge(null)}>
        {/* Zero line */}
        <line x1={centerX} x2={centerX} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--grid)" strokeWidth={1} />

        {rows.map((r, i) => {
          const y = rowY(i);
          const maleW = r.male * scale;
          const femaleW = r.female * scale;
          const opacity = r.isEdge ? 0.5 : 1;
          return (
            <g key={r.age}>
              <text
                x={PAD.left - 8}
                y={y + ROW_HEIGHT / 2 + 4}
                fontSize={10}
                fill="var(--axis-label)"
                textAnchor="end"
              >
                {r.age}
              </text>
              {maleW > 0 && (
                <rect
                  x={centerX - maleW}
                  y={y}
                  width={maleW}
                  height={ROW_HEIGHT}
                  rx={2}
                  fill="var(--boys)"
                  fillOpacity={opacity}
                />
              )}
              {femaleW > 0 && (
                <rect
                  x={centerX}
                  y={y}
                  width={femaleW}
                  height={ROW_HEIGHT}
                  rx={2}
                  fill="var(--girls)"
                  fillOpacity={opacity}
                />
              )}
              <rect
                x={PAD.left}
                y={y}
                width={WIDTH - PAD.left - PAD.right}
                height={ROW_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHoverAge(r.age)}
              />
            </g>
          );
        })}

        {/* x-axis reference labels: 0 at centre, max at each edge */}
        <text x={centerX} y={PAD.top + innerH + 16} fontSize={10} fill="var(--axis-label)" textAnchor="middle">
          0
        </text>
        <text x={PAD.left} y={PAD.top + innerH + 16} fontSize={10} fill="var(--axis-label)" textAnchor="start">
          {Math.round(maxVal).toLocaleString()}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={PAD.top + innerH + 16}
          fontSize={10}
          fill="var(--axis-label)"
          textAnchor="end"
        >
          {Math.round(maxVal).toLocaleString()}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--boys)" }} />
          Boys
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--girls)" }} />
          Girls
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Ages {EDGE_AGE_MIN} and {EDGE_AGE_MAX} shown at reduced opacity — structurally
        incomplete cohorts at census date, excluded from the shape classification above.
      </p>

      {hoverAge !== null && (
        <div className="mt-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          {(() => {
            const r = rows.find((x) => x.age === hoverAge)!;
            return (
              <>
                <strong>Age {r.age}</strong>
                <span className="ml-3">{r.male.toLocaleString()} boys</span>
                <span className="ml-3">{r.female.toLocaleString()} girls</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
