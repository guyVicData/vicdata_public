"use client";

// VicData 0.6.1 S3b: the slope view -- each row's figure in two years, joined by a line. A new
// view type (no translated preset uses it yet); the series builder (src/lib/view-series/
// slope.ts) hands it the two years and each row's two figures, unchanged.
//
// Drawn as TrendChart draws: a stretched SVG holds the lines only (non-scaling strokes), and
// every word and dot is HTML over it, so nothing distorts at any panel width. Direct labels
// (the figure at each end) on the focused row and any comparison line only, so they never
// pile up; every line names itself on hover, and the legend under it names each colour.
import type { CSSProperties } from "react";
import type { Measure } from "@/lib/teacher-view-panels";
import type { SlopeRowData } from "@/lib/view-series/series";
import { academicYearLabel } from "@/lib/teacher-view-theme";

const PAD = 0.1;

export function SlopeChart({ from, to, rows, measure, fullscreen = false }: { from: number; to: number; rows: SlopeRowData[]; measure: Measure; fullscreen?: boolean }) {
  const all = rows.flatMap((r) => [r.from, r.to]);
  // A flat set of figures still gets a scale (one unit either side).
  const lo = Math.min(...all) - (Math.min(...all) === Math.max(...all) ? 1 : 0);
  const hi = Math.max(...all) + (Math.min(...all) === Math.max(...all) ? 1 : 0);
  // y as a % from the top, inside a 10% margin either end.
  const y = (v: number) => (PAD + ((hi - v) / (hi - lo)) * (1 - 2 * PAD)) * 100;
  // Draw the others first, then comparisons, then the focused row on top.
  const order = [...rows].sort((a, b) => Number(a.emphasis) * 2 + Number(!!a.comparison) - (Number(b.emphasis) * 2 + Number(!!b.comparison)));
  const labelled = rows.filter((r) => r.emphasis || r.comparison);
  const tip = (r: SlopeRowData) => `${r.label}: ${measure.format(r.from)} in ${academicYearLabel(from)}, ${measure.format(r.to)} in ${academicYearLabel(to)}`;
  const dot = (r: SlopeRowData, v: number, side: "left" | "right"): CSSProperties => ({
    top: `${y(v)}%`,
    [side]: 0,
    width: r.emphasis ? 9 : 7,
    height: r.emphasis ? 9 : 7,
    transform: `translate(${side === "left" ? "-50%" : "50%"}, -50%)`,
    background: r.comparison ? "var(--panel-bg)" : r.colour,
    border: `2px solid ${r.colour}`,
  });
  const label = (r: SlopeRowData, v: number): CSSProperties => ({ top: `${y(v)}%`, transform: "translateY(-50%)", color: r.emphasis ? "var(--fg)" : "var(--muted)" });
  return (
    <div className="flex min-h-0 flex-col gap-1.5" data-view="slope">
      <div className="flex justify-between px-14 text-[10.5px] font-semibold text-[var(--muted)]">
        <span className="-translate-x-1/2">{academicYearLabel(from)}</span>
        <span className="translate-x-1/2">{academicYearLabel(to)}</span>
      </div>
      <div className={`relative ${fullscreen ? "h-[50vh] min-h-[16rem]" : "h-[180px]"}`}>
        {/* The left and right figures sit in 3.5rem gutters either side of the lines. */}
        <div className="absolute inset-y-0 left-0 w-14">
          {labelled.map((r) => (
            <span key={r.key} className={`absolute right-2.5 text-[10.5px] tabular-nums ${r.emphasis ? "font-semibold" : ""}`} style={label(r, r.from)}>
              {measure.format(r.from)}
            </span>
          ))}
        </div>
        <div className="absolute inset-y-0 right-0 w-14">
          {labelled.map((r) => (
            <span key={r.key} className={`absolute left-2.5 text-[10.5px] tabular-nums ${r.emphasis ? "font-semibold" : ""}`} style={label(r, r.to)}>
              {measure.format(r.to)}
            </span>
          ))}
        </div>
        <div className="absolute inset-y-0 left-14 right-14">
          <div className="absolute inset-y-0 left-0 border-l border-[var(--panel-border2)]" />
          <div className="absolute inset-y-0 right-0 border-r border-[var(--panel-border2)]" />
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Each row in ${academicYearLabel(from)} and ${academicYearLabel(to)}`}>
            {order.map((r) => (
              <g key={r.key}>
                <line x1="0" y1={y(r.from)} x2="100" y2={y(r.to)} stroke={r.colour} strokeWidth={r.emphasis ? 2.5 : 2} strokeDasharray={r.comparison ? "4 3" : undefined} vectorEffect="non-scaling-stroke" opacity={r.emphasis || r.comparison ? 1 : 0.75} />
                {/* A wider invisible line: the hover target that names the row. */}
                <line x1="0" y1={y(r.from)} x2="100" y2={y(r.to)} stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke">
                  <title>{tip(r)}</title>
                </line>
              </g>
            ))}
          </svg>
          {order.map((r) => (
            <span key={r.key} title={tip(r)}>
              <span aria-hidden="true" className="absolute rounded-full" style={dot(r, r.from, "left")} />
              <span aria-hidden="true" className="absolute rounded-full" style={dot(r, r.to, "right")} />
            </span>
          ))}
        </div>
      </div>
      {rows.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          {rows.map((r) => (
            <span key={r.key} className={`flex items-center gap-1.5 text-[10.5px] ${r.emphasis ? "font-semibold text-[var(--fg)]" : "text-[var(--muted)]"}`}>
              <span aria-hidden="true" className="inline-block h-[2px] w-3.5" style={{ background: r.comparison ? `repeating-linear-gradient(90deg, ${r.colour} 0 4px, transparent 4px 7px)` : r.colour }} />
              {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
