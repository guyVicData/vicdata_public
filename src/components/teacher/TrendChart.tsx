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
// What the wireframe asked for and this keeps: a real y-axis (a spine with tick marks
// beside the numbers, not floating text), x ticks at every real data point with labels
// thinned so they never crowd, an "Academic year" axis title, an optional dashed
// least-squares fit, and the comparison line dashed grey behind the focus line.
//
// What it adds, because real data has it and mock arrays do not: gaps. A period with no
// published figure breaks the line rather than being bridged -- drawing straight through
// a missing year invites reading the gap as a real, measured trajectory.
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { leastSquares, type Measure, type PanelData } from "@/lib/teacher-view-panels";

// The wireframe's own geometry, kept so the chart lands at the same size on the card.
const W = 260;
const H = 80;
const TOP = 6;
const BOTTOM = 74;
const AXIS_W = 30;

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
  const xFor = (i: number) => (periods.length > 1 ? (i / (periods.length - 1)) * W : W / 2);

  const show = labelledIndices(periods.length, fullscreen ? periods.length : 4);
  // The focus line draws last so it sits above the dashed comparison line.
  const ordered = [...series].sort((a, b) => Number(!!b.comparison) - Number(!!a.comparison));
  const focus = series.find((s) => !s.comparison) ?? series[0];
  const fit = showFit ? leastSquares(focus.values) : null;
  const height = fullscreen ? 220 : H;

  return (
    <div className="mt-1">
      <div className="flex gap-2">
        {/* The y spine and its three ticks, as its own fixed-width SVG so the plot area
            keeps a clean 0-260 coordinate space whatever the card's real width is. */}
        <svg width={AXIS_W} height={height} viewBox={`0 0 ${AXIS_W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="shrink-0">
          <line x1={AXIS_W - 1} y1={TOP} x2={AXIS_W - 1} y2={BOTTOM + 2} stroke="var(--panel-border2)" strokeWidth="1" />
          {[scaleMax, (scaleMax + scaleMin) / 2, scaleMin].map((v) => (
            <g key={v}>
              <line x1={AXIS_W - 5} y1={yFor(v)} x2={AXIS_W - 1} y2={yFor(v)} stroke="var(--muted3)" strokeWidth="1" />
              <text x={AXIS_W - 7} y={yFor(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--muted)">
                {measure.format(v)}
              </text>
            </g>
          ))}
        </svg>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block flex-grow"
          role="img"
          aria-label={`${focus.label}, ${academicYearLabel(periods[0])} to ${academicYearLabel(periods[periods.length - 1])}`}
        >
          <line x1="0" y1={TOP} x2={W} y2={TOP} stroke="var(--panel-border)" strokeWidth="1" />
          <line x1="0" y1={(TOP + BOTTOM) / 2} x2={W} y2={(TOP + BOTTOM) / 2} stroke="var(--panel-border)" strokeWidth="1" />
          <line x1="0" y1={BOTTOM} x2={W} y2={BOTTOM} stroke="var(--panel-border2)" strokeWidth="1" />
          {ordered.map((s) =>
            runsOf(s.values).map((run, ri) =>
              run.length === 1 ? (
                // A lone real value between two gaps still has to appear -- a one-point
                // polyline draws nothing at all.
                <circle
                  key={`${s.key}-${ri}`}
                  cx={xFor(run[0].i)}
                  cy={yFor(run[0].v)}
                  r={s.comparison ? 1.8 : 2.4}
                  fill={s.comparison ? "var(--muted3)" : s.colour}
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

      <div className="flex gap-2">
        <div className="shrink-0" style={{ width: AXIS_W }} />
        <svg width="100%" height="16" viewBox={`0 0 ${W} 16`} preserveAspectRatio="none" aria-hidden="true" className="block flex-grow">
          {periods.map((p, i) => (
            <g key={p}>
              <line x1={xFor(i)} y1="0" x2={xFor(i)} y2="4" stroke="var(--panel-border2)" strokeWidth="1" />
              {show[i] && (
                <text
                  x={xFor(i)}
                  y="14"
                  textAnchor={i === 0 ? "start" : i === periods.length - 1 ? "end" : "middle"}
                  fontSize="9.5"
                  fill="var(--muted)"
                >
                  {academicYearLabel(p)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="pl-[38px] text-center text-[9.5px] uppercase tracking-[0.04em] text-[var(--muted3)]">Academic year</p>

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3.5 pl-[38px]">
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
