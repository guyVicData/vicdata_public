"use client";

// Teacher view, round 6: the Trend panel's line chart (round-6 wireframe, all four
// boards; brief §4.1-§4.3).
//
// SVG rather than divs, unlike ViewChart's bars, for one reason the bars do not have: a
// line between two points is a line, and there is no honest way to build one out of
// stacked boxes. It stays print-safe the way ViewChart is -- no canvas, no library
// painting its own colours, every stroke either a theme token or the subject's own
// qualification colour passed in by the caller.
//
// The plot SVG stretches to the card's width (preserveAspectRatio="none") so the line
// fills whatever space there is, and it therefore contains NO text: a stretched viewBox
// scales glyphs with it, so an axis label inside it would be squashed at card width and
// stretched at fullscreen. Both axes are HTML positioned over the same coordinate space
// instead, which also means they inherit the theme's own type rather than an SVG font.
//
// What the wireframe asked for and this keeps: a real y-axis (a spine with tick marks
// beside the numbers, not floating text), x ticks at every real data point with labels
// thinned so they never crowd, an "Academic year" axis title, an optional dashed
// least-squares fit, and the comparison line dashed grey behind the focus line.
//
// What it adds, because real data has it and mock arrays do not: gaps. A period with no
// published figure breaks the line rather than being bridged -- drawing straight through
// a missing year invites reading the gap as a real, measured trajectory.
import { useLayoutEffect, useRef, useState } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { leastSquares, trendChartKind, type Measure, type PanelData } from "@/lib/teacher-view-panels";

// The wireframe's own plot geometry, as a coordinate space the HTML axes share.
const W = 260;
const H = 80;
const TOP = 6;
const BOTTOM = 74;

// Clear space kept between two x-axis labels, in px.
const LABEL_GAP = 6;

// The y axis is as wide as its widest figure needs, the rule VerticalBars' value axis
// already uses, rather than a fixed 32px: at 9.5px a figure runs about 5.6px a character
// (digits ~5.2px, so this errs wide), plus the 8px tick mark and its gap beside it. The
// fixed box left two-digit axes with ~13px of empty space before their figures, and put
// this chart's plot 8px right of the bar chart above it in the same column.
function yAxisWidth(labels: string[]): number {
  return Math.max(20, Math.ceil(Math.max(...labels.map((l) => l.length)) * 5.6) + 2 + 8);
}

// Which x-axis labels to show, from the axis's real width and a label's real width -- the
// measurement pass the wireframe's "at most four" heuristic was waiting for. A count cap
// could not work: the labels keep their pixel width while the gap between ticks shrinks
// with the card, so four labels that fit at 800px land on top of each other at a phone's
// 375px ("2023/24" over "2024/25"). The first label hangs right from its tick, the last
// hangs left from its tick (so neither leaves the card), the rest are centred. First and
// last always show; between them every `step`-th, the smallest step at which no two boxes
// meet -- dropping the one before the last when that alone is what collides, since the
// last is the year a reader looks for. Width not known yet: everything.
function labelledIndices(count: number, axisWidth: number | null, labelWidth: number): boolean[] {
  if (count <= 0) return [];
  if (count === 1) return [true];
  if (axisWidth === null || axisWidth <= 0) return new Array<boolean>(count).fill(true);
  const last = count - 1;
  const box = (i: number): [number, number] => {
    const x = (i / last) * axisWidth;
    if (i === 0) return [0, labelWidth];
    if (i === last) return [axisWidth - labelWidth, axisWidth];
    return [x - labelWidth / 2, x + labelWidth / 2];
  };
  const clear = (idx: number[]) => idx.every((i, k) => k === 0 || box(idx[k - 1])[1] + LABEL_GAP <= box(i)[0]);
  for (let step = 1; step < last; step++) {
    const idx: number[] = [];
    for (let i = 0; i < last; i += step) idx.push(i);
    idx.push(last);
    if (!clear(idx) && idx.length > 2) idx.splice(idx.length - 2, 1);
    if (clear(idx)) return Array.from({ length: count }, (_, i) => idx.includes(i));
  }
  // Only the two ends are left. If even they meet, the latest year alone.
  return Array.from({ length: count }, (_, i) => i === last || (i === 0 && clear([0, last])));
}

// The x axis, positioned over the same 0-100% the plot spans. It measures itself (and one
// label) so the thinning above works from real pixels: synchronously on mount, before the
// first paint, then on every resize of the card, the accordion or the fullscreen modal.
function XAxis({ periods, axisWidth }: { periods: number[]; axisWidth: number }) {
  const axis = useRef<HTMLDivElement | null>(null);
  const probe = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState<{ axis: number; label: number } | null>(null);
  useLayoutEffect(() => {
    const el = axis.current;
    if (!el) return;
    const measure = () =>
      setSize({ axis: el.getBoundingClientRect().width, label: probe.current?.getBoundingClientRect().width ?? 0 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const show = labelledIndices(periods.length, size?.axis ?? null, size?.label ?? 0);
  const xPercent = (i: number) => (periods.length > 1 ? (i / (periods.length - 1)) * 100 : 50);
  const labelClass = "whitespace-nowrap text-[9.5px] tabular-nums text-[var(--muted)]";
  return (
    <div className="flex shrink-0 gap-2">
      <div className="shrink-0" style={{ width: axisWidth }} />
      <div ref={axis} className="relative h-4 flex-grow" aria-hidden="true">
        {/* An invisible copy of the widest label, for its real rendered width. */}
        <span ref={probe} className={`invisible absolute left-0 top-0 ${labelClass}`}>
          {academicYearLabel(periods.reduce((a, b) => (academicYearLabel(b).length > academicYearLabel(a).length ? b : a), periods[0]))}
        </span>
        {periods.map((p, i) => (
          <span key={p} className="absolute top-0" style={{ left: `${xPercent(i)}%` }}>
            <span className="absolute left-0 top-0 h-1 w-px bg-[var(--panel-border2)]" />
            {show[i] && (
              // The last label hangs left from its tick with `right-0` alone. It used to add
              // an inline translateX(-100%) as well, meant to override the class's
              // transform -- but Tailwind v4's translate-x-* sets the separate `translate`
              // property, so both applied and the label sat a whole label-width short of its
              // tick, on top of the one before it. That, more than the tick spacing, is what
              // put "2024/25" over "2023/24" on a phone.
              <span
                className={`absolute top-1.5 ${labelClass} ${
                  i === 0 ? "left-0" : i === periods.length - 1 ? "right-0" : "-translate-x-1/2"
                }`}
              >
                {academicYearLabel(p)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Contiguous runs of real values, so each unbroken stretch is its own polyline and a gap
// stays a gap.
function runsOf(values: (number | null)[]): { i: number; v: number }[][] {
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) { if (run.length) runs.push(run); run = []; return; }
    run.push({ i, v });
  });
  if (run.length) runs.push(run);
  return runs;
}

export function TrendChart({
  data,
  measure,
  showFit = false,
  fullscreen = false,
  focusKey,
  reference,
  band,
  seriesLegend = true,
}: {
  data: PanelData;
  measure: Measure;
  showFit?: boolean;
  fullscreen?: boolean;
  // Trend map/legend round: false drops the per-series entries from the legend under the
  // chart, for a caller that draws its own (Column 1's fullscreen "Subjects shown" rail,
  // where each entry is also the line's show/hide control). The band and reference
  // entries stay -- nothing else explains them.
  seriesLegend?: boolean;
  // Trend redesign (D2/K): with many solid lines, which one is the focus -- drawn last and
  // thickest, and the one the fit follows. Absent = the first non-comparison series, as
  // before.
  focusKey?: string;
  // A dashed horizontal line: D2's index 100 ("no change since the first year shown").
  reference?: { value: number; label: string };
  // Option K's shaded min-max band for the series not drawn individually.
  band?: { min: (number | null)[]; max: (number | null)[]; label: string };
}) {
  const { periods, series } = data;
  const all = [
    ...series.flatMap((s) => s.values),
    ...(band ? [...band.min, ...band.max] : []),
    ...(reference ? [reference.value] : []),
  ].filter((v): v is number => v !== null);
  if (periods.length === 0 || all.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No published figures for this comparison yet.</p>;
  }

  // Round 7 §4: too few real years to draw a line through honestly -- bars instead.
  if (trendChartKind(data) === "bars") {
    return <TrendBars data={data} measure={measure} fullscreen={fullscreen} seriesLegend={seriesLegend} />;
  }

  // Scale to the data, rounded out to the measure's own step, with a little headroom --
  // so a points scale gets 0.5 steps and a rate gets 5s, rather than one shared guess.
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) { min -= measure.axisStep; max += measure.axisStep; }
  const pad = Math.max(measure.axisStep, (max - min) * 0.2);
  const scaleMin = Math.max(0, Math.floor((min - pad) / measure.axisStep) * measure.axisStep);
  const scaleMax = Math.ceil((max + pad) / measure.axisStep) * measure.axisStep;
  const span = scaleMax - scaleMin || 1;

  const yFor = (v: number) => {
    const y = TOP + (1 - (v - scaleMin) / span) * (BOTTOM - TOP);
    return Math.max(TOP, Math.min(BOTTOM, y));
  };
  // The same y in per-cent of the plot's height, for the HTML axis beside it.
  const yPercent = (v: number) => (yFor(v) / H) * 100;
  const xFor = (i: number) => (periods.length > 1 ? (i / (periods.length - 1)) * W : W / 2);

  // The focus line draws last so it sits above the dashed comparison line -- and, with a
  // focusKey, above every other solid line too.
  const focus = (focusKey ? series.find((s) => s.key === focusKey) : undefined) ?? series.find((s) => !s.comparison) ?? series[0];
  const ordered = [...series].sort(
    (a, b) => Number(!!b.comparison) - Number(!!a.comparison) || Number(a.key === focus.key) - Number(b.key === focus.key),
  );
  // With a named focus, the other solid lines are context and draw thinner.
  const widthOf = (s: (typeof series)[number]) => (s.comparison ? 2 : focusKey && s.key !== focus.key ? 1.6 : 2.4);
  const bandPoints = band
    ? (() => {
        const top = band.max.map((v, i) => (v === null ? null : `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)).filter(Boolean);
        const bottom = band.min
          .map((v, i) => (v === null ? null : `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`))
          .filter(Boolean)
          .reverse();
        return [...top, ...bottom].join(" ");
      })()
    : null;
  const fit = showFit ? leastSquares(focus.values) : null;
  // Round 8 §4: fill whatever vertical room the fixed-height panel leaves, rather than a
  // fixed 80px box. The SVG already stretches (preserveAspectRatio="none") and its axes are
  // HTML positioned as percentages of it, so both follow the container for free.
  const plotHeight = fullscreen ? 220 : undefined;
  const ticks = [scaleMax, (scaleMax + scaleMin) / 2, scaleMin];
  const axisW = yAxisWidth(ticks.map((v) => measure.format(v)));

  return (
    <div className="mt-1 flex min-h-0 flex-grow flex-col">
      {/* Accordion round Part 1: the plot row has a floor. In a fixed-height card the
          legend below is sized to its content, so with nine or ten entries (Comparisons'
          "All schools, individually") it wrapped to several lines and took the whole
          column, squeezing this flex-grow row -- and the SVG in it -- to 0px high. With a
          floor, a legend that no longer fits pushes the content taller than the card
          instead, and CardBox's content box scrolls: a chart you scroll to beats a chart
          that is not there. Fullscreen sets its own height and never hit this. */}
      <div className="flex min-h-[110px] flex-grow gap-2">
        {/* The y axis: its labels are HTML, positioned at the same fractions of the plot's
            height that the SVG uses, so they stay upright at any card width. */}
        <div className="relative shrink-0" style={{ width: axisW, ...(plotHeight ? { height: plotHeight } : {}) }} aria-hidden="true">
          <span className="absolute right-0 w-px bg-[var(--panel-border2)]" style={{ top: `${(TOP / H) * 100}%`, bottom: `${((H - BOTTOM - 2) / H) * 100}%` }} />
          {ticks.map((v) => (
            <span
              key={v}
              className="absolute right-0 flex translate-y-[-50%] items-center gap-1 text-[9.5px] tabular-nums text-[var(--muted)]"
              style={{ top: `${yPercent(v)}%` }}
            >
              {measure.format(v)}
              <span className="inline-block h-px w-1 bg-[var(--muted3)]" />
            </span>
          ))}
        </div>
        <svg
          width="100%"
          height={plotHeight ?? "100%"}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block min-h-0 flex-grow"
          role="img"
          aria-label={`${focus.label}, ${academicYearLabel(periods[0])} to ${academicYearLabel(periods[periods.length - 1])}`}
        >
          <line x1="0" y1={TOP} x2={W} y2={TOP} stroke="var(--panel-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={(TOP + BOTTOM) / 2} x2={W} y2={(TOP + BOTTOM) / 2} stroke="var(--panel-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={BOTTOM} x2={W} y2={BOTTOM} stroke="var(--panel-border2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {bandPoints && <polygon points={bandPoints} fill="var(--muted3)" opacity="0.18" stroke="none" />}
          {reference && (
            <line
              x1="0"
              y1={yFor(reference.value)}
              x2={W}
              y2={yFor(reference.value)}
              stroke="var(--muted2)"
              strokeWidth="1"
              strokeDasharray="2,3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {ordered.map((s) =>
            runsOf(s.values).map((run, ri) =>
              run.length === 1 ? (
                // A lone real value between two gaps still has to appear -- a one-point
                // polyline draws nothing at all. Drawn as a short flat dash rather than a
                // circle, because a circle in a stretched viewBox becomes an ellipse.
                <line
                  key={`${s.key}-${ri}`}
                  x1={xFor(run[0].i)}
                  y1={yFor(run[0].v)}
                  x2={xFor(run[0].i)}
                  y2={yFor(run[0].v)}
                  stroke={s.colour}
                  strokeWidth={s.comparison ? 4 : 5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <polyline
                  key={`${s.key}-${ri}`}
                  points={run.map((p) => `${xFor(p.i).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={widthOf(s)}
                  strokeDasharray={s.comparison ? "4,3" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ),
            ),
          )}
          {fit && (
            <line
              x1="0"
              y1={yFor(fit.intercept)}
              x2={W}
              y2={yFor(fit.intercept + fit.slope * (periods.length - 1))}
              stroke={focus.colour}
              strokeWidth="1.3"
              strokeDasharray="3,3"
              opacity="0.8"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>

      <XAxis periods={periods} axisWidth={axisW} />
      <p className="mt-3 text-center text-[9.5px] uppercase tracking-[0.04em] text-[var(--muted3)]" style={{ paddingLeft: axisW + 8 }}>Academic year</p>

      {((seriesLegend && series.length > 1) || band || reference) && (
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1" style={{ paddingLeft: axisW + 8 }}>
          {seriesLegend && series.map((s) => (
            <span key={s.key} className={`flex items-center gap-1.5 text-[10.5px] ${s.key === focus.key && focusKey ? "font-semibold text-[var(--fg)]" : "text-[var(--muted)]"}`}>
              <span
                className="inline-block h-[2.5px] w-3 rounded-[1px]"
                style={
                  s.comparison
                    ? { backgroundImage: `linear-gradient(90deg, ${s.colour} 60%, transparent 40%)`, backgroundSize: "6px 2.5px" }
                    : { background: s.colour }
                }
              />
              {s.label}
            </span>
          ))}
          {band && (
            <span className="flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
              <span className="inline-block h-2 w-3 rounded-[1px] bg-[var(--muted3)] opacity-40" />
              {band.label}
            </span>
          )}
          {reference && (
            <span className="flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
              <span className="inline-block h-px w-3 border-t border-dashed border-[var(--muted2)]" />
              {reference.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// The short-series form (§4). One group of bars per year, one bar per series, on a scale
// whose top is the largest real value -- §5's autoscale, so the tallest bar fills the
// chart rather than sitting halfway up a padded axis.
//
// Zero is the floor rather than the smallest value. A bar chart read against a non-zero
// baseline exaggerates every difference, which is exactly what a three-point series
// should not do; a line chart can crop its axis because it is showing direction, not
// magnitude.
function TrendBars({ data, measure, fullscreen, seriesLegend = true }: { data: PanelData; measure: Measure; fullscreen?: boolean; seriesLegend?: boolean }) {
  const { periods, series } = data;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const top = Math.max(...all);
  const bodyH = fullscreen ? 200 : 96;  // fallback only; the flex row below drives it
  const ticks = [1, 0.5, 0];
  const axisW = yAxisWidth(ticks.map((t) => measure.format(top * t)));

  return (
    <div className="mt-1">
      <div className="flex gap-2">
        <div className="relative shrink-0" style={{ width: axisW, height: bodyH + 12 }} aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 flex translate-y-[-50%] items-center gap-1 text-[9.5px] tabular-nums text-[var(--muted)]"
              style={{ top: 6 + (1 - t) * bodyH }}
            >
              {measure.format(top * t)}
              <span className="inline-block h-px w-1 bg-[var(--muted3)]" />
            </span>
          ))}
        </div>
        <div className="relative flex-grow">
          {ticks.slice(0, -1).map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-[var(--panel-border)]" style={{ top: 6 + (1 - t) * bodyH }} />
          ))}
          <div className="absolute inset-x-0 h-px bg-[var(--panel-border2)]" style={{ top: 6 + bodyH }} />
          <div className="flex justify-around gap-2 overflow-x-auto px-1 pt-[6px]">
            {periods.map((p, i) => (
              <div key={p} className="flex shrink-0 flex-col items-center gap-1">
                <div className="flex items-end gap-1" style={{ height: bodyH }}>
                  {series.map((s) => {
                    const v = s.values[i];
                    return (
                      <div
                        key={s.key}
                        title={`${s.label} ${academicYearLabel(p)}: ${v === null ? "no figure" : measure.format(v)}`}
                        className="rounded-t"
                        style={{
                          width: series.length > 1 ? 14 : 24,
                          height: v === null ? 0 : Math.max(2, (v / top) * bodyH),
                          // A comparison series keeps the colour its dashed line has on the
                          // line chart, so the two forms read as the same pair.
                          background: s.colour,
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-[9.5px] tabular-nums text-[var(--muted)]">{academicYearLabel(p)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[9.5px] uppercase tracking-[0.04em] text-[var(--muted3)]" style={{ paddingLeft: axisW + 8 }}>Academic year</p>
      {seriesLegend && series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3.5" style={{ paddingLeft: axisW + 8 }}>
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ background: s.colour }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
