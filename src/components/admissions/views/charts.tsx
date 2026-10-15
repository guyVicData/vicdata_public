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
// A width to draw at before the first measure: 0 (measure first) everywhere but a server render,
// where R-ADM-EDITOR-LOOKS-KEEP-NOTES sets one so the charts draw and their looks can be compared.
export const InitialWidth = createContext(0);

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(useContext(InitialWidth));
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

export type Series = { id: string; label: string; colour: string; width?: number; dashed?: string; points: Pt[]; title?: (p: Pt) => string; dots?: boolean; opacity?: number };
// 0.8 SMT r4 (F1): a shaded range under the lines (a projection's band), and a labelled vertical marker
// (where the years start to include children not yet born). Optional: absent, the chart is as before.
export type Band = { id: string; colour: string; opacity?: number; points: { x: number; lo: number | null; hi: number | null }[] };
export type Marker = { x: number; label: string };

/** The boards' row-2 line chart: an axis line, optional dashed reference, lines, first/last year labels. */
export function LineChart({
  series,
  height,
  reference,
  xLabels,
  fromZero = false,
  yFormat = (v: number) => Math.round(v).toLocaleString("en-GB"),
  endLabels = false,
  bands = [],
  markers = [],
  children,
}: {
  series: Series[];
  bands?: Band[];
  markers?: Marker[];
  height: number;
  reference?: { y: number; label?: string } | null;
  xLabels?: [string, string] | null;
  fromZero?: boolean;
  yFormat?: (v: number) => string;
  // 0.7 admissions editor s2: each line's name and last value at its end (a look option, off by default).
  endLabels?: boolean;
  children?: ReactNode;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const xs = [...series.flatMap((s) => s.points.map((p) => p.x)), ...bands.flatMap((b) => b.points.map((p) => p.x))];
  const ys = [...series.flatMap((s) => s.points.map((p) => p.y)), ...bands.flatMap((b) => b.points.flatMap((p) => [p.lo, p.hi])), reference?.y ?? null];
  const xd: [number, number] = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
  const yd = extent(ys, 0.12, fromZero);
  const W = Math.max(w, 10);
  const pad = { l: 10, r: endLabels ? 92 : 10, t: 8, b: 10 };
  const sx = scale(xd, [pad.l, W - pad.r]);
  const sy = scale(yd, [height - pad.b, pad.t]);
  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg width={W} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          <line x1={0} x2={W} y1={height - 1} y2={height - 1} stroke="var(--adm-axis)" />
          {reference && <line x1={0} x2={W} y1={sy(reference.y)} y2={sy(reference.y)} stroke="var(--adm-grid)" strokeDasharray="2 4" />}
          {bands.map((b) => {
            const pts = b.points.filter((p) => p.lo !== null && p.hi !== null) as { x: number; lo: number; hi: number }[];
            if (pts.length < 2) return null;
            const d = `M${pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.hi).toFixed(1)}`).join("L")}L${[...pts].reverse().map((p) => `${sx(p.x).toFixed(1)},${sy(p.lo).toFixed(1)}`).join("L")}Z`;
            return <path key={b.id} data-band={b.id} d={d} fill={b.colour} fillOpacity={b.opacity ?? 0.18} stroke="none" />;
          })}
          {markers.map((m) => (
            <g key={`m-${m.x}`} data-marker={m.label}>
              <line x1={sx(m.x)} x2={sx(m.x)} y1={pad.t} y2={height - 1} stroke="var(--adm-grid)" strokeDasharray="3 3" />
              <text x={sx(m.x) + 4} y={pad.t + 9} fontSize={10} fill="var(--muted)">
                {m.label}
              </text>
            </g>
          ))}
          {series.map((s) => (
            <g key={s.id} opacity={s.opacity}>
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
          {endLabels &&
            series.map((s) => {
              const last = [...s.points].reverse().find((p) => p.y !== null);
              return last ? (
                <text key={`end-${s.id}`} data-end-label="" x={sx(last.x) + 6} y={sy(last.y!) + 3.5} fontSize={10.5} fill={s.colour}>
                  {s.label.length > 13 ? `${s.label.slice(0, 12)}…` : s.label} {yFormat(last.y!)}
                </text>
              ) : null;
            })}
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
