"use client";

import { useState } from "react";
import type { AgeGenderCounts } from "@/lib/roll-data";
import {
  observedAgeSpan,
  SHAPE_CLASSIFICATION_MIN_AGE,
  SHAPE_CLASSIFICATION_MAX_AGE,
} from "@/lib/roll-data";
import { TAG_COLOURS } from "@/lib/tag-colours";

// Horizontal population-pyramid shape chart (chart palette doc, "Public View
// rebuild"). Ages on the y-axis, oldest at top / youngest at bottom -- boys extend
// left of a centred zero line, girls extend right.
//
// 2026-08-27: boys/girls colours now come from TAG_COLOURS (tag-colours.ts) --
// the SAME cyan/pink the map's Gender colour mode already uses -- rather than this
// chart's own separate purple (#8000ff)/red (#fb0207). Guy's explicit instruction:
// "one shared, easily-editable colour source for every chart/graph/map," with THIS
// specific swap (not a repo-wide rewrite) as the first real migration onto it. Also a
// genuine improvement in passing: the old colours were hardcoded identically in both
// the light and dark CSS blocks below (never actually theme-aware despite the
// per-theme block structure); TAG_COLOURS' own light/dark pair now makes these bars
// properly theme-aware for the first time.
//
// This REPLACES a formal colourblind-safety validator pass this chart's own colours
// had been through (ΔE 34.9 CVD separation, logged when those colours were chosen) --
// the shared palette hasn't been re-validated for bar-chart use specifically. Still
// never relying on colour alone here (legend + hover value readout stay), and this
// whole pairing is logged as explicitly provisional in docs/OPEN_QUESTIONS.md
// (2026-08-27) -- Guy does not want a stereotypical pink/blue gender pairing
// long-term and wants to revisit the whole palette later; this round is a consistency
// pass, not the final answer.
const BOYS_COLOUR = { light: TAG_COLOURS.Boys.light[1], dark: TAG_COLOURS.Boys.dark[1] };
const GIRLS_COLOUR = { light: TAG_COLOURS.Girls.light[1], dark: TAG_COLOURS.Girls.dark[1] };

const ROW_HEIGHT = 20;
const ROW_GAP = 2;
const WIDTH = 560;
const PAD = { top: 8, right: 40, bottom: 28, left: 40 };

export default function ShapeChart({ ageGenderCounts }: { ageGenderCounts: AgeGenderCounts }) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const span = observedAgeSpan(ageGenderCounts);
  if (!span) {
    return <p className="text-sm text-neutral-500">No age-by-age roll data to chart.</p>;
  }

  const ages: number[] = [];
  for (let age = span.maxAge; age >= span.minAge; age--) ages.push(age); // oldest first (top row)

  const rows = ages.map((age) => {
    const c = ageGenderCounts.get(age);
    return {
      age,
      male: c?.male ?? 0,
      female: c?.female ?? 0,
      isEdge: age < SHAPE_CLASSIFICATION_MIN_AGE || age > SHAPE_CLASSIFICATION_MAX_AGE,
    };
  });

  const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.male, r.female)));
  const innerH = ages.length * ROW_HEIGHT + (ages.length - 1) * ROW_GAP;
  const height = PAD.top + PAD.bottom + innerH;
  const halfWidth = (WIDTH - PAD.left - PAD.right) / 2;
  const centerX = PAD.left + halfWidth;
  const scale = halfWidth / maxVal;

  const rowY = (i: number) => PAD.top + i * (ROW_HEIGHT + ROW_GAP);

  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          color-scheme: light;
          --surface-1: #fcfcfb;
          --axis-label: #4d4d4d;
          --grid: #e4e2dc;
          --boys: ${BOYS_COLOUR.light};
          --girls: ${GIRLS_COLOUR.light};
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --surface-1: #1a1a19;
            --axis-label: #cccccc;
            --grid: #333230;
            --boys: ${BOYS_COLOUR.dark};
            --girls: ${GIRLS_COLOUR.dark};
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --surface-1: #1a1a19;
          --axis-label: #cccccc;
          --grid: #333230;
          --boys: ${BOYS_COLOUR.dark};
          --girls: ${GIRLS_COLOUR.dark};
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
        Ages {SHAPE_CLASSIFICATION_MIN_AGE - 1} and under, and {SHAPE_CLASSIFICATION_MAX_AGE + 1}{" "}
        and over, shown at reduced opacity — outside the standard-cohort range,
        excluded from the shape classification above.
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
