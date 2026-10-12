"use client";

// VicData 0.7 admissions r2: the small chart kit the Admissions views share. Plain SVG at the
// container's measured width (first measured synchronously, so a panel never draws at a guessed
// size), the boards' stroke weights and dash patterns. Nothing here computes a figure: every
// value arrives from /api/admissions/*.
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// 0.7 admissions editor s1: the editor's preview draws a view at its real panel size, scaled down
// to fit the dialogue; a chart's first measure (getBoundingClientRect) is of the scaled box, so
// it is divided back by the scale. 1 everywhere else (the page): the same widths as before.
export const MeasureScale = createContext(1);

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  const k = useContext(MeasureScale);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(k === 1 ? el.getBoundingClientRect().width : el.getBoundingClientRect().width / k);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [k]);
  return [ref, w];
}

export type Pt = { x: number; y: number | null };
export const extent = (vals: (number | null | undefined)[], pad = 0.08, zero = false): [number, number] => {
  const v = vals.filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x));
  if (!v.length) return [0, 1];
  let lo = zero ? 0 : Math.min(...v);
  let hi = Math.max(...v);
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const p = (hi - lo) * pad;
  return [zero ? lo : lo - p, hi + p];
};
export const scale = (d: [number, number], r: [number, number]) => (v: number) => r[0] + ((v - d[0]) / (d[1] - d[0] || 1)) * (r[1] - r[0]);

/** A polyline through the points that have a value (gaps break the line, never bridged). */
export function path(points: Pt[], sx: (v: number) => number, sy: (v: number) => number): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (p.y === null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

export type Series = { id: string; label: string; colour: string; width?: number; dashed?: string; points: Pt[]; title?: (p: Pt) => string; dots?: boolean };

/** The boards' row-2 line chart: an axis line, optional dashed reference, lines, first/last year labels. */
export function LineChart({
  series,
  height,
  reference,
  xLabels,
  fromZero = false,
  yFormat = (v: number) => Math.round(v).toLocaleString("en-GB"),
  children,
}: {
  series: Series[];
  height: number;
  reference?: { y: number; label?: string } | null;
  xLabels?: [string, string] | null;
  fromZero?: boolean;
  yFormat?: (v: number) => string;
  children?: ReactNode;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = [...series.flatMap((s) => s.points.map((p) => p.y)), reference?.y ?? null];
  const xd: [number, number] = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
  const yd = extent(ys, 0.12, fromZero);
  const W = Math.max(w, 10);
  const pad = { l: 10, r: 10, t: 8, b: 10 };
  const sx = scale(xd, [pad.l, W - pad.r]);
  const sy = scale(yd, [height - pad.b, pad.t]);
  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg width={W} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          <line x1={0} x2={W} y1={height - 1} y2={height - 1} stroke="var(--adm-axis)" />
          {reference && <line x1={0} x2={W} y1={sy(reference.y)} y2={sy(reference.y)} stroke="var(--adm-grid)" strokeDasharray="2 4" />}
          {series.map((s) => (
            <g key={s.id}>
              <path d={path(s.points, sx, sy)} fill="none" stroke={s.colour} strokeWidth={s.width ?? 2.6} strokeDasharray={s.dashed} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p) =>
                p.y === null ? null : (
                  <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={s.dots ? 3 : 7} fill={s.dots ? s.colour : "transparent"}>
                    <title>{s.title ? s.title(p) : `${s.label}: ${yFormat(p.y)}`}</title>
                  </circle>
                ),
              )}
            </g>
          ))}
          {children}
        </svg>
      )}
      {xLabels && (
        <div className="flex justify-between text-[10px] text-[var(--muted)]">
          <span>{xLabels[0]}</span>
          <span>{xLabels[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Vertical bars, one per year (the rail's bar view). */
export function YearBars({ bars, height, colour = "var(--accent)", format = (v: number) => Math.round(v).toLocaleString("en-GB") }: { bars: { label: string; value: number | null; title?: string; colour?: string }[]; height: number; colour?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0));
  return (
    <div className="flex w-full items-end gap-[6px]" style={{ height }}>
      {bars.map((b) => (
        <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={b.title ?? `${b.label}: ${b.value === null ? "no figure" : format(b.value)}`}>
          <span className="text-[10px] tabular-nums text-[var(--muted2)]">{b.value === null ? "—" : format(b.value)}</span>
          <span className="w-full rounded-t-[3px]" style={{ height: b.value === null ? 0 : `${(b.value / max) * (height - 34)}px`, background: b.colour ?? colour }} />
          <span className="truncate text-[10px] text-[var(--muted)]">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Diverging horizontal bars around a centre line (change since a year; strengths' gap). */
export function DivergingBar({ value, max, positive = "var(--accent)", negative = "var(--adm-orange)", height = 12 }: { value: number | null; max: number; positive?: string; negative?: string; height?: number }) {
  const w = value === null || max === 0 ? 0 : Math.min(50, (Math.abs(value) / max) * 50);
  return (
    <span className="relative block" style={{ height }}>
      <span className="absolute -bottom-[3px] -top-[3px] left-1/2 w-px bg-[var(--edge-strong)]" />
      {value !== null && (
        <span
          className="absolute bottom-0 top-0"
          style={value >= 0 ? { left: "50%", width: `${w}%`, background: Math.abs(value) < max * 0.04 ? "var(--adm-grey-line)" : positive, borderRadius: "0 3px 3px 0" } : { right: "50%", width: `${w}%`, background: Math.abs(value) < max * 0.04 ? "var(--adm-grey-line)" : negative, borderRadius: "3px 0 0 3px" }}
        />
      )}
    </span>
  );
}
