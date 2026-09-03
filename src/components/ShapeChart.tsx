"use client";

import { useState } from "react";
import type { AgeGenderCounts } from "@/lib/roll-data";
import {
  observedAgeSpan,
  genderShareByAge,
  SHAPE_CLASSIFICATION_MIN_AGE,
  SHAPE_CLASSIFICATION_MAX_AGE,
} from "@/lib/roll-data";
import type { ShapeMetrics } from "@/lib/shape-classifier";
import { TAG_COLOURS } from "@/lib/tag-colours";
import { SINGLE_SEX_SUPPRESSION_BAND } from "@/lib/narrative";

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

// 2026-09-04, qualifier build round: signal-line/reference-envelope overlay colour --
// distinct from both gender bar colours and the existing Focus token (that's the
// surrounding-schools bar chart's own highlight, a different chart/purpose). A plain
// neutral works fine here since both overlays carry their own shape (solid vs dashed)
// as the real distinguishing signal, not colour alone.
const SIGNAL_LINE_COLOUR = { light: "#171717", dark: "#e5e5e5" };
const REFERENCE_ENVELOPE_COLOUR = { light: "#a3a3a3", dark: "#737373" };

export default function ShapeChart({
  ageGenderCounts,
  metrics,
  dominantTransition,
}: {
  ageGenderCounts: AgeGenderCounts;
  // 2026-09-04, qualifier build round -- both optional and both from classifyShape()'s
  // own return object, passed straight through by whichever caller has already run
  // the classifier (never re-derived here). Omitting them renders exactly the
  // pre-existing chart, unchanged -- these are additive overlays, not a redesign.
  metrics?: ShapeMetrics;
  dominantTransition?: { fromAge: string; toAge: string } | null;
}) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const span = observedAgeSpan(ageGenderCounts);
  if (!span) {
    return <p className="text-sm text-neutral-500">No age-by-age roll data to chart.</p>;
  }

  const ages: number[] = [];
  for (let age = span.maxAge; age >= span.minAge; age--) ages.push(age); // oldest first (top row)

  // (a) % labels: female share per row, same STATIONARY_ABS_FLOOR suppression the
  // gender-mix qualifier itself uses (genderShareByAge, roll-data.ts) -- computed over
  // the chart's own full displayed span (observedAgeSpan), not the narrower 5-17
  // classification clamp, so every row that's actually drawn can carry a label.
  const femaleShareByAge = genderShareByAge(ageGenderCounts, span);

  const rows = ages.map((age) => {
    const c = ageGenderCounts.get(age);
    return {
      age,
      male: c?.male ?? 0,
      female: c?.female ?? 0,
      isEdge: age < SHAPE_CLASSIFICATION_MIN_AGE || age > SHAPE_CLASSIFICATION_MAX_AGE,
      femaleSharePct: femaleShareByAge.has(age) ? femaleShareByAge.get(age)! * 100 : null,
    };
  });

  // 2026-09-07 fix (round 13, found via live-page review): single-sex detection,
  // same threshold narrative.ts's classifyGenderComposition already uses (reused, not
  // reinvented) -- >=98% one gender across the chart's own full displayed total. Below
  // this, splitting the canvas 50/50 wastes half of it on an always-empty side, and
  // the reference envelope's "even 50/50 split" comparison is meaningless against a
  // real ~100/0 split. Single-sex renders the one real gender full-width instead: no
  // center split, no reference envelope (nothing to compare against), no % labels
  // (trivially ~100/0 or ~0/100 on every row) -- the signal line stays, single-sided.
  const totalMale = rows.reduce((sum, r) => sum + r.male, 0);
  const totalFemale = rows.reduce((sum, r) => sum + r.female, 0);
  const totalAll = totalMale + totalFemale;
  const singleSexGender: "male" | "female" | null =
    totalAll > 0 && Math.min(totalMale, totalFemale) / totalAll <= SINGLE_SEX_SUPPRESSION_BAND
      ? totalMale >= totalFemale
        ? "male"
        : "female"
      : null;

  const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.male, r.female)));
  const innerH = ages.length * ROW_HEIGHT + (ages.length - 1) * ROW_GAP;
  const height = PAD.top + PAD.bottom + innerH;
  const halfWidth = (WIDTH - PAD.left - PAD.right) / 2;
  const centerX = PAD.left + halfWidth;
  const scale = halfWidth / maxVal;

  // Single-sex layout: full plot width for the one real gender's own values (male+
  // female combined -- indistinguishable from the dominant gender alone at this
  // threshold, and keeps the signal line's own total-based positions consistent with
  // the bars rather than introducing a second, slightly different scale).
  const fullPlotWidth = WIDTH - PAD.left - PAD.right;
  const singleSexMaxVal = Math.max(1, ...rows.map((r) => r.male + r.female));
  const singleSexScale = fullPlotWidth / singleSexMaxVal;
  const singleSexColourVar = singleSexGender === "male" ? "var(--boys)" : "var(--girls)";

  const rowY = (i: number) => PAD.top + i * (ROW_HEIGHT + ROW_GAP);
  const rowMidY = (i: number) => rowY(i) + ROW_HEIGHT / 2;

  // Total-roll half-width per row -- male+female <= 2*maxVal always (maxVal is the
  // global max of any single gender/age cell), so total*scale/2 always fits within
  // halfWidth, the same scale the existing per-gender bars already use. Shared basis
  // for both overlays below: (b) traces it only through the ANCHORED (floor-surviving)
  // ages classifyShape actually classified from; (c) draws it as a full reference
  // envelope through every displayed row, independent of anchoring, so the real
  // boy/girl bars can be read directly against "what an even 50/50 split would look
  // like at this total."
  const totalHalfWidth = (r: { male: number; female: number }) => ((r.male + r.female) * scale) / 2;

  // (b) Signal-line overlay: metrics.anchored is the exact noise-filtered sequence
  // classifyShape classified from (shape-classifier.ts) -- only ages that survived the
  // floor-drop appear here, in the same age order. Matched back to this chart's own
  // rows by age key so the line only visits rows the classifier actually used.
  const anchoredAges = new Set((metrics?.anchored ?? []).map((p) => Number(p.key)));
  const signalPoints = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => anchoredAges.has(r.age));
  const dominantAges =
    dominantTransition != null
      ? [Number(dominantTransition.fromAge), Number(dominantTransition.toAge)]
      : [];

  const pathFor = (points: { r: (typeof rows)[number]; i: number }[], side: "left" | "right") =>
    points
      .map(({ r, i }, idx) => {
        const x = side === "left" ? centerX - totalHalfWidth(r) : centerX + totalHalfWidth(r);
        return `${idx === 0 ? "M" : "L"} ${x} ${rowMidY(i)}`;
      })
      .join(" ");

  // Single-sex signal line: single-sided (from the left baseline, same as the bars),
  // no left/right mirror -- there's no second side to mirror against.
  const singleSexX = (r: { male: number; female: number }) => PAD.left + (r.male + r.female) * singleSexScale;
  const pathForSingleSex = (points: { r: (typeof rows)[number]; i: number }[]) =>
    points.map(({ r, i }, idx) => `${idx === 0 ? "M" : "L"} ${singleSexX(r)} ${rowMidY(i)}`).join(" ");

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
          --signal-line: ${SIGNAL_LINE_COLOUR.light};
          --reference-envelope: ${REFERENCE_ENVELOPE_COLOUR.light};
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --surface-1: #1a1a19;
            --axis-label: #cccccc;
            --grid: #333230;
            --boys: ${BOYS_COLOUR.dark};
            --girls: ${GIRLS_COLOUR.dark};
            --signal-line: ${SIGNAL_LINE_COLOUR.dark};
            --reference-envelope: ${REFERENCE_ENVELOPE_COLOUR.dark};
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --surface-1: #1a1a19;
          --axis-label: #cccccc;
          --grid: #333230;
          --boys: ${BOYS_COLOUR.dark};
          --girls: ${GIRLS_COLOUR.dark};
          --signal-line: ${SIGNAL_LINE_COLOUR.dark};
          --reference-envelope: ${REFERENCE_ENVELOPE_COLOUR.dark};
        }
      `}</style>

      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" onMouseLeave={() => setHoverAge(null)}>
        {/* Zero line -- centred for the co-ed split chart, at the left baseline for
            the single-sex full-width layout (no split to centre on). */}
        <line
          x1={singleSexGender ? PAD.left : centerX}
          x2={singleSexGender ? PAD.left : centerX}
          y1={PAD.top}
          y2={PAD.top + innerH}
          stroke="var(--grid)"
          strokeWidth={1}
        />

        {/* (c) Symmetric gender-comparison envelope: total roll mirrored evenly
            left/right, drawn through every displayed row regardless of anchoring --
            "what an even 50/50 split of this row's real total would look like." Real
            boy/girl bars (below) are plotted against this same reference, direct
            visual support for the gender-shape-divergence qualifier: a bar pulling
            noticeably inside this outline on one side is that gender under-
            represented at that age relative to the school's own overall split.
            Skipped entirely for a single-sex school -- there's no second gender to
            compare against, so "what an even 50/50 split would look like" isn't a
            meaningful reference for a real ~100/0 school. */}
        {!singleSexGender && rows.length > 1 && (
          <>
            <path
              d={pathFor(rows.map((r, i) => ({ r, i })), "left")}
              fill="none"
              stroke="var(--reference-envelope)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <path
              d={pathFor(rows.map((r, i) => ({ r, i })), "right")}
              fill="none"
              stroke="var(--reference-envelope)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </>
        )}

        {rows.map((r, i) => {
          const y = rowY(i);
          const opacity = r.isEdge ? 0.5 : 1;
          const totalW = (r.male + r.female) * singleSexScale;
          const maleW = r.male * scale;
          const femaleW = r.female * scale;
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
              {singleSexGender ? (
                totalW > 0 && (
                  <rect
                    x={PAD.left}
                    y={y}
                    width={totalW}
                    height={ROW_HEIGHT}
                    rx={2}
                    fill={singleSexColourVar}
                    fillOpacity={opacity}
                  />
                )
              ) : (
                <>
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
                  {/* (a) % label: female share of this row's total, only where the row
                      clears the same noise floor the gender-mix qualifier itself uses
                      (genderShareByAge) -- a single-digit-total row's own share is close
                      to meaningless, so it's simply omitted rather than shown misleadingly
                      precise. Skipped entirely for single-sex (trivially ~0% or ~100% on
                      every row -- see singleSexGender's own comment). */}
                  {r.femaleSharePct !== null && (
                    <text
                      x={WIDTH - PAD.right + 6}
                      y={y + ROW_HEIGHT / 2 + 4}
                      fontSize={9}
                      fill="var(--axis-label)"
                      textAnchor="start"
                    >
                      {Math.round(r.femaleSharePct)}%
                    </text>
                  )}
                </>
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

        {/* (b) Signal-line overlay: traces metrics.anchored -- the exact noise-
            filtered sequence classifyShape classified from -- through only the rows
            that survived the floor-drop, so it shows what the classifier actually
            saw, not the full raw chart. The dominantTransition segment (the specific
            move that decided the shape) is highlighted with end markers. Kept for
            single-sex, single-sided (from the left baseline, same as the bars) --
            there's no second side to trace, unlike the reference envelope which is
            dropped entirely. */}
        {metrics && signalPoints.length > 1 && singleSexGender && (
          <>
            <path d={pathForSingleSex(signalPoints)} fill="none" stroke="var(--signal-line)" strokeWidth={1.25} />
            {dominantAges.length === 2 &&
              signalPoints
                .filter(({ r }) => dominantAges.includes(r.age))
                .map(({ r, i }) => <circle key={`dom-${r.age}`} cx={singleSexX(r)} cy={rowMidY(i)} r={2.5} fill="var(--signal-line)" />)}
          </>
        )}
        {metrics && signalPoints.length > 1 && !singleSexGender && (
          <>
            <path d={pathFor(signalPoints, "left")} fill="none" stroke="var(--signal-line)" strokeWidth={1.25} />
            <path d={pathFor(signalPoints, "right")} fill="none" stroke="var(--signal-line)" strokeWidth={1.25} />
            {dominantAges.length === 2 &&
              signalPoints
                .filter(({ r }) => dominantAges.includes(r.age))
                .map(({ r, i }) => (
                  <g key={`dom-${r.age}`}>
                    <circle cx={centerX - totalHalfWidth(r)} cy={rowMidY(i)} r={2.5} fill="var(--signal-line)" />
                    <circle cx={centerX + totalHalfWidth(r)} cy={rowMidY(i)} r={2.5} fill="var(--signal-line)" />
                  </g>
                ))}
          </>
        )}

        {/* x-axis reference labels: 0 at the baseline (left edge for single-sex, centre
            for the split chart), max at the right edge (and left edge too, mirrored,
            for the split chart). */}
        {!singleSexGender && (
          <text x={centerX} y={PAD.top + innerH + 16} fontSize={10} fill="var(--axis-label)" textAnchor="middle">
            0
          </text>
        )}
        {!singleSexGender && (
          <text x={PAD.left} y={PAD.top + innerH + 16} fontSize={10} fill="var(--axis-label)" textAnchor="start">
            {Math.round(maxVal).toLocaleString()}
          </text>
        )}
        {singleSexGender && (
          <text x={PAD.left} y={PAD.top + innerH + 16} fontSize={10} fill="var(--axis-label)" textAnchor="start">
            0
          </text>
        )}
        <text
          x={WIDTH - PAD.right}
          y={PAD.top + innerH + 16}
          fontSize={10}
          fill="var(--axis-label)"
          textAnchor="end"
        >
          {Math.round(singleSexGender ? singleSexMaxVal : maxVal).toLocaleString()}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-400">
        {singleSexGender ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: singleSexColourVar }} />
            {singleSexGender === "male" ? "Boys" : "Girls"}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--boys)" }} />
              Boys
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--girls)" }} />
              Girls
            </span>
          </>
        )}
        {metrics && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3" style={{ backgroundColor: "var(--signal-line)" }} />
            What the shape was read from
          </span>
        )}
        {/* Even-50/50 reference envelope legend entry -- co-ed only, matching the
            envelope itself being skipped entirely for single-sex (see its own
            comment above). */}
        {!singleSexGender && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-3"
              style={{ backgroundImage: "linear-gradient(to right, var(--reference-envelope) 50%, transparent 50%)", backgroundSize: "4px 1px" }}
            />
            Even 50/50 split at this total
          </span>
        )}
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
