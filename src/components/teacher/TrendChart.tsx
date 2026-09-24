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
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { leastSquares, trendChartKind, type Measure, type PanelData } from "@/lib/teacher-view-panels";

// The wireframe's own plot geometry, as a coordinate space the HTML axes share.
const W = 260;
const H = 80;
const TOP = 6;
const BOTTOM = 74;

// Labels are thinned to at most four at card width. The wireframe notes this is a
// heuristic pending a real measurement pass, and that fullscreen is where every date gets
// shown -- so fullscreen raises the cap rather than running the same thinning twice.
function labelledIndices(count: number, max: number): boolean[] {
  if (count <= 0) return [];
  const show = new Array<boolean>(count).fill(false);
  if (count <= max) show.fill(true);
  else if (Math.ceil(count / 2) <= max) for (let i = 0; i < count; i += 2) show[i] = true;
  show[0] = true;
  show[count - 1] = true;
  return show;
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
}: {
  data: PanelData;
  measure: Measure;
  showFit?: boolean;
  fullscreen?: boolean;
}) {
  const { periods, series } = data;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (periods.length === 0 || all.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No published figures for this comparison yet.</p>;
  }

  // Round 7 §4: too few real years to draw a line through honestly -- bars instead.
  if (trendChartKind(data) === "bars") {
    return <TrendBars data={data} measure={measure} fullscreen={fullscreen} />;
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
  const xPercent = (i: number) => (periods.length > 1 ? (i / (periods.length - 1)) * 100 : 50);

  const show = labelledIndices(periods.length, fullscreen ? periods.length : 4);
  // The focus line draws last so it sits above the dashed comparison line.
  const ordered = [...series].sort((a, b) => Number(!!b.comparison) - Number(!!a.comparison));
  const focus = series.find((s) => !s.comparison) ?? series[0];
  const fit = showFit ? leastSquares(focus.values) : null;
  // Round 8 §4: fill whatever vertical room the fixed-height panel leaves, rather than a
  // fixed 80px box. The SVG already stretches (preserveAspectRatio="none") and its axes are
  // HTML positioned as percentages of it, so both follow the container for free.
  const plotHeight = fullscreen ? 220 : undefined;
  const ticks = [scaleMax, (scaleMax + scaleMin) / 2, scaleMin];

  return (
    <div className="mt-1 flex min-h-0 flex-grow flex-col">
      <div className="flex min-h-0 flex-grow gap-2">
        {/* The y axis: its labels are HTML, positioned at the same fractions of the plot's
            height that the SVG uses, so they stay upright at any card width. */}
        <div className="relative w-8 shrink-0" style={plotHeight ? { height: plotHeight } : undefined} aria-hidden="true">
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
                  stroke={s.comparison ? "var(--muted3)" : s.colour}
                  strokeWidth={s.comparison ? 4 : 5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <polyline
                  key={`${s.key}-${ri}`}
                  points={run.map((p) => `${xFor(p.i).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={s.comparison ? "var(--muted3)" : s.colour}
                  strokeWidth={s.comparison ? 2 : 2.4}
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

      {/* The x axis, positioned over the same 0-100% the plot spans. */}
      <div className="flex shrink-0 gap-2">
        <div className="w-8 shrink-0" />
        <div className="relative h-4 flex-grow" aria-hidden="true">
          {periods.map((p, i) => (
            <span key={p} className="absolute top-0" style={{ left: `${xPercent(i)}%` }}>
              <span className="absolute left-0 top-0 h-1 w-px bg-[var(--panel-border2)]" />
              {show[i] && (
                <span
                  className={`absolute top-1.5 whitespace-nowrap text-[9.5px] tabular-nums text-[var(--muted)] ${
                    i === 0 ? "left-0" : i === periods.length - 1 ? "right-0 translate-x-0" : "-translate-x-1/2"
                  }`}
                  style={i === periods.length - 1 ? { transform: "translateX(-100%)" } : undefined}
                >
                  {academicYearLabel(p)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 pl-10 text-center text-[9.5px] uppercase tracking-[0.04em] text-[var(--muted3)]">Academic year</p>

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3.5 pl-10">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
              <span
                className="inline-block h-[2.5px] w-3 rounded-[1px]"
                style={
                  s.comparison
                    ? { backgroundImage: "linear-gradient(90deg, var(--muted3) 60%, transparent 40%)", backgroundSize: "6px 2.5px" }
                    : { background: s.colour }
                }
              />
              {s.label}
            </span>
          ))}
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
function TrendBars({ data, measure, fullscreen }: { data: PanelData; measure: Measure; fullscreen?: boolean }) {
  const { periods, series } = data;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const top = Math.max(...all);
  const bodyH = fullscreen ? 200 : 96;  // fallback only; the flex row below drives it
  const ticks = [1, 0.5, 0];

  return (
    <div className="mt-1">
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0" style={{ height: bodyH + 12 }} aria-hidden="true">
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
                          // The comparison series stays the muted dashed-line grey it has
                          // on the line chart, so the two forms read as the same pair.
                          background: s.comparison ? "var(--muted3)" : s.colour,
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
      <p className="mt-2 pl-10 text-center text-[9.5px] uppercase tracking-[0.04em] text-[var(--muted3)]">Academic year</p>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3.5 pl-10">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ background: s.comparison ? "var(--muted3)" : s.colour }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
