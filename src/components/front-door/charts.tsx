"use client";

// VicData 0.8 front door (B14-B17): the walk's charts. One vocabulary with the dashboard: the focus in the
// phase accent, peers in shades of their subject category's colour (light to dark, each with its own
// marker shape), reference lines in fixed colours (LA #3987e5, England #c98500, the nearest schools
// #d55181), dashes kept for averages and dotted for unpublished years. Every chart is keyed (a key entry for
// every colour and mark: R-WALK-KEYS), and every label on a line chart is HTML over the plot -- only the
// lines are SVG, with vector-effect: non-scaling-stroke -- so they always render (C15).
//
// A chart sits on a plate: white in Mid and Light, the dark well in Dark. Colours follow (darker shades on
// light plates: C16).
import type { CSSProperties, ReactNode } from "react";
import { SUBJECT_FAMILY_COLOURS } from "@/lib/subject-family-colours";
import type { Chart, KeyEntry, Marker, Role } from "@/lib/front-door/teacher-screens";
import { RailGlyph } from "./home";

export const REF = { la: "#3987e5", england: "#c98500", nearest: "#d55181" } as const;

export type Palette = { focus: string; peer: string; other: string; average: string; grid: string; text: string; muted: string; plate: string; dark: boolean };

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, "0")).join("");
}

/** The palette for a plate: the focus accent (darker on a light plate), the category's colour, the greys. */
export function palette(opts: { dark: boolean; accent: { hex: string; light: string }; categoryId: string | null }): Palette {
  const fam = opts.categoryId ? SUBJECT_FAMILY_COLOURS[opts.categoryId] : undefined;
  const peer = fam ? (opts.dark ? fam.dark[1] : fam.light[1]) : opts.dark ? "#a1a1aa" : "#6b6b72";
  return opts.dark
    ? { focus: opts.accent.hex, peer, other: "#5a5a62", average: "#c8c8ce", grid: "#26262b", text: "#f2f2f3", muted: "#9a9aa0", plate: "#0b0b0d", dark: true }
    : { focus: opts.accent.light, peer, other: "#c4c4cc", average: "#3f3f46", grid: "#ececf0", text: "#17171b", muted: "#5f5f67", plate: "#ffffff", dark: false };
}

/** A peer's shade: light to dark on a light plate (dark to light on a dark one); five steps at most. */
export function peerShade(p: Palette, k: number): string {
  const steps = p.dark ? [0, 0.22, 0.42, 0.58, 0.7] : [0.5, 0.3, 0.12, 0, 0];
  return p.dark ? mixHex(p.peer, "#000000", steps[k % 5] * 0.6) : mixHex(p.peer, "#ffffff", steps[k % 5]);
}

export function roleColour(p: Palette, role: Role, shade?: number): string {
  switch (role) {
    case "focus":
      return p.focus;
    case "peer":
      return shade === undefined ? p.peer : peerShade(p, shade);
    case "other":
      return p.other;
    case "average":
      return p.average;
    case "la":
      return REF.la;
    case "england":
      // Deepened on a light plate, as Light mode does.
      return p.dark ? REF.england : "#a86f00";
    case "nearest":
      return REF.nearest;
    case "region":
      return p.muted;
  }
}

function MarkerShape({ marker, colour, size = 8 }: { marker?: Marker; colour: string; size?: number }) {
  const s = size;
  if (marker === "square") return <span style={{ width: s, height: s, background: colour, display: "inline-block" }} />;
  if (marker === "diamond") return <span style={{ width: s * 0.8, height: s * 0.8, background: colour, display: "inline-block", transform: "rotate(45deg)" }} />;
  if (marker === "triangle") return <span style={{ width: 0, height: 0, display: "inline-block", borderLeft: `${s / 2}px solid transparent`, borderRight: `${s / 2}px solid transparent`, borderBottom: `${s}px solid ${colour}` }} />;
  return <span style={{ width: s, height: s, borderRadius: 99, background: colour, display: "inline-block" }} />;
}

/** The key: one entry per colour and mark (R-WALK-KEYS). */
export function ChartKey({ keys, p }: { keys: KeyEntry[]; p: Palette }) {
  if (!keys.length) return null;
  return (
    <ul data-chart-key="" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: p.muted }}>
      {keys.map((k, i) => {
        const c = roleColour(p, k.role, k.shade);
        const mark =
          k.mark === "swatch" ? <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
          : k.mark === "line" ? <span className="inline-flex items-center gap-0.5"><span className="inline-block h-[2.5px] w-4 rounded" style={{ background: c }} />{k.marker && <MarkerShape marker={k.marker} colour={c} size={7} />}</span>
          : k.mark === "dash" ? <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: c }} />
          : k.mark === "tick" ? <span className="inline-block h-3 w-[3px] rounded" style={{ background: c }} />
          : k.mark === "ring" ? <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: c }} />
          : <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />;
        return (
          <li key={i} data-key-entry={k.role} className="inline-flex items-center gap-1.5">
            {mark}
            <span>{k.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

const fmt = (v: number, d: number) => (d ? v.toFixed(d) : Math.round(v).toLocaleString("en-GB"));

// ------------------------------------------------------------------------------------------------ lines

function LinesChart({ c, p }: { c: Extract<Chart, { kind: "lines" }>; p: Palette }) {
  const vals = c.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (!vals.length) return <p className="text-[13px]" style={{ color: p.muted }}>No figures to draw.</p>;
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
  const pad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.12;
  const min = c.yCaption.startsWith("Place") ? Math.max(0, rawMin - 1) : Math.max(0, rawMin - pad) === 0 && rawMin > 0 && rawMin - pad < 0 ? 0 : rawMin - pad;
  const max = rawMax + pad;
  const flip = c.yCaption.startsWith("Place"); // 1st at the top
  const n = c.years.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => (flip ? ((v - min) / (max - min)) * 100 : 100 - ((v - min) / (max - min)) * 100);
  const ticks = Array.from({ length: 5 }, (_, k) => min + ((max - min) * k) / 4);
  // End labels: at each line's last real point, nudged apart so they never overlap.
  const ends = c.series
    .map((s, si) => {
      let li = s.values.length - 1;
      while (li >= 0 && s.values[li] === null) li--;
      return li < 0 ? null : { si, label: s.label, v: s.values[li] as number, top: y(s.values[li] as number) };
    })
    .filter((e): e is { si: number; label: string; v: number; top: number } => !!e)
    .sort((a, b) => a.top - b.top);
  for (let k = 1; k < ends.length; k++) if (ends[k].top - ends[k - 1].top < 9) ends[k].top = ends[k - 1].top + 9;
  return (
    <div data-line-chart="" className="flex flex-col gap-2">
      <div className="relative ml-10 mr-[150px] h-[240px] sm:h-[280px]">
        {/* Gridlines and the y ticks: HTML. */}
        {ticks.map((t, k) => (
          <div key={k} className="absolute inset-x-0" style={{ top: `${y(t)}%`, borderTop: `1px solid ${p.grid}` }}>
            <span data-html-label="tick" className="absolute -left-10 -translate-y-1/2 text-[11px] tabular-nums" style={{ color: p.muted }}>{fmt(t, c.digits && max - min < 10 ? c.digits : 0)}</span>
          </div>
        ))}
        {/* Unpublished years: dotted and labelled. */}
        {c.unpublished.map((k) => (
          <div key={`u${k}`} className="absolute inset-y-0" style={{ left: `${x(k)}%`, borderLeft: `1.5px dotted ${p.muted}` }}>
            <span data-html-label="gap" className="absolute top-1 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[10.5px]" style={{ background: p.plate, color: p.muted }}>{c.years[k]}: not published</span>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {c.series.map((s, si) => {
            const col = roleColour(p, s.role, s.shade);
            const segs: string[][] = [];
            let cur: string[] = [];
            s.values.forEach((v, i) => {
              if (v === null) {
                if (cur.length) segs.push(cur);
                cur = [];
              } else cur.push(`${x(i)},${y(v)}`);
            });
            if (cur.length) segs.push(cur);
            // A gap in the focus line is bridged dotted.
            const bridges: string[] = [];
            if (s.role === "focus") {
              const idx = s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
              for (let k = 1; k < idx.length; k++) if (idx[k] - idx[k - 1] > 1) bridges.push(`${x(idx[k - 1])},${y(s.values[idx[k - 1]]!)} ${x(idx[k])},${y(s.values[idx[k]]!)}`);
            }
            return (
              <g key={si}>
                {segs.map((pts, k) => (pts.length > 1 ? <polyline key={k} points={pts.join(" ")} fill="none" stroke={col} strokeWidth={s.role === "focus" ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray={s.role === "average" ? "5 4" : undefined} /> : null))}
                {bridges.map((b, k) => <polyline key={`b${k}`} points={b} fill="none" stroke={col} strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
              </g>
            );
          })}
        </svg>
        {/* Markers: HTML, so their shapes stay true at any width. */}
        {c.series.map((s, si) =>
          s.values.map((v, i) =>
            v === null || (!s.marker && s.role !== "focus") ? null : (
              <span key={`${si}-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 leading-none" style={{ left: `${x(i)}%`, top: `${y(v)}%` }}>
                <MarkerShape marker={s.marker ?? "circle"} colour={roleColour(p, s.role, s.shade)} size={s.role === "focus" ? 8 : 7} />
              </span>
            ),
          ),
        )}
        {/* Direct end labels: HTML. */}
        {ends.map((e) => {
          const s = c.series[e.si];
          return (
            <span key={e.si} data-html-label="end" className="absolute left-[calc(100%+8px)] -translate-y-1/2 whitespace-nowrap text-[11.5px] font-semibold" style={{ top: `${e.top}%`, color: roleColour(p, s.role, s.shade) }}>
              {e.label} {fmt(e.v, c.digits)}
            </span>
          );
        })}
        {/* Year labels: HTML. */}
        <div className="absolute inset-x-0 top-[calc(100%+6px)]">
          {c.years.map((yr, i) =>
            n <= 7 || i === 0 || i === n - 1 || i % 2 === 0 ? (
              <span key={i} data-html-label="year" className="absolute -translate-x-1/2 text-[11px]" style={{ left: `${x(i)}%`, color: p.muted }}>{yr}</span>
            ) : null,
          )}
        </div>
      </div>
      <p className="ml-10 mt-5 text-[11.5px]" style={{ color: p.muted }}>{c.yCaption}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ bars

function VBars({ c, p }: { c: Extract<Chart, { kind: "vbars" }>; p: Palette }) {
  const max = Math.max(...c.rows.map((r) => r.value), c.average?.value ?? 0) * 1.1 || 1;
  const digits = c.unit === "entries" ? 0 : 1;
  if (c.rows.length > 10)
    return (
      <div data-bars="horizontal" className="relative flex flex-col gap-1">
        {c.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-[12px]">
            <span className="truncate" title={r.label} style={{ color: r.role === "focus" ? p.text : p.muted, fontWeight: r.role === "focus" ? 700 : 400 }}>{r.label}</span>
            <span className="relative h-3.5">
              <span className="absolute inset-y-0 left-0 rounded-r-[3px]" style={{ width: `${(r.value / max) * 100}%`, background: roleColour(p, r.role) }} />
              {c.average && <span className="absolute -inset-y-0.5 border-l-2 border-dashed" style={{ left: `${(c.average.value / max) * 100}%`, borderColor: p.average }} />}
            </span>
            <span className="text-right tabular-nums" style={{ color: p.text }}>{fmt(r.value, digits)}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div data-bars="vertical" className="flex flex-col gap-1">
      <div className="relative flex h-[220px] items-end gap-2 border-b pb-0 sm:gap-3" style={{ borderColor: p.grid }}>
        {c.average && (
          <div className="absolute inset-x-0 border-t-2 border-dashed" style={{ bottom: `${(c.average.value / max) * 100}%`, borderColor: p.average }}>
            <span data-html-label="average" className="absolute -top-5 right-0 rounded px-1 text-[11px]" style={{ background: p.plate, color: p.average }}>{c.average.label}</span>
          </div>
        )}
        {c.rows.map((r) => (
          <div key={r.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: r.role === "focus" ? p.focus : p.text }}>{fmt(r.value, digits)}</span>
            <span className="w-full max-w-[56px] rounded-t-[4px]" style={{ height: `${(r.value / max) * 100}%`, background: roleColour(p, r.role) }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-3">
        {c.rows.map((r) => (
          <span key={r.label} className="min-w-0 flex-1 break-words text-center text-[11px] leading-tight" style={{ color: r.role === "focus" ? p.text : p.muted, fontWeight: r.role === "focus" ? 700 : 400 }}>{r.label}</span>
        ))}
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: p.muted }}>{c.yCaption}</p>
    </div>
  );
}

function HBars({ c, p }: { c: Extract<Chart, { kind: "hbars" }>; p: Palette }) {
  const max = Math.max(...c.rows.map((r) => r.value)) * 1.08 || 1;
  return (
    <div data-bars="horizontal" className="flex flex-col gap-1.5">
      {c.rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,12rem)_1fr_3.5rem] items-center gap-2 text-[12.5px]">
          <span className="truncate" title={r.label} style={{ color: r.role === "focus" ? p.text : p.muted, fontWeight: r.role === "focus" ? 700 : 400 }}>{r.label}</span>
          <span className="relative h-4">
            <span className="absolute inset-y-0 left-0 rounded-r-[3px]" style={{ width: `${(r.value / max) * 100}%`, background: roleColour(p, r.role) }} />
          </span>
          <span className="text-right tabular-nums" style={{ color: p.text }}>{fmt(r.value, c.digits)}</span>
        </div>
      ))}
      <p className="mt-1 text-[11.5px]" style={{ color: p.muted }}>{c.unit === "entries" ? "Entries" : "Average points per entry"}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ dumbbell

export function DumbbellChart({ c, p }: { c: Extract<Chart, { kind: "dumbbell" }>; p: Palette }) {
  const max = Math.max(...c.rows.flatMap((r) => [r.first, r.latest])) * 1.05 || 1;
  return (
    <div data-dumbbell="" className="flex flex-col gap-0.5">
      {c.rows.map((r, i) => {
        const col = r.role === "average" ? p.average : roleColour(p, r.role);
        const a = (Math.min(r.first, r.latest) / max) * 100;
        const b = (Math.max(r.first, r.latest) / max) * 100;
        const ch = Math.round(r.latest - r.first);
        return (
          <div key={i} data-dumbbell-row={r.role} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 rounded-[6px] px-1 py-[3px] text-[12px]" style={r.role === "focus" ? { background: `color-mix(in srgb, ${p.focus} 16%, transparent)` } : undefined}>
            <span className="break-words leading-tight" style={{ color: r.role === "focus" ? p.text : p.muted, fontWeight: r.role === "focus" || r.role === "average" ? 700 : 400 }}>{r.label}</span>
            <span className="relative h-3">
              <span className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: `${a}%`, width: `${b - a}%`, background: col, opacity: 0.55, ...(r.role === "average" ? { background: "transparent", borderTop: `2px dashed ${col}`, opacity: 1 } : {}) }} />
              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ left: `${(r.first / max) * 100}%`, borderColor: col, background: p.plate }} />
              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(r.latest / max) * 100}%`, background: col }} />
            </span>
            <span className="text-right tabular-nums" style={{ color: p.text }}>{ch > 0 ? `▲ ${ch}` : ch < 0 ? `▼ ${-ch}` : "– 0"}</span>
          </div>
        );
      })}
      <p className="mt-1 text-[11.5px]" style={{ color: p.muted }}>Entries, {c.firstYear} (ring) and {c.latestYear} (dot); change in pupils</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ the rest

function Grades({ c, p }: { c: Extract<Chart, { kind: "grades" }>; p: Palette }) {
  const max = Math.max(...c.rows.flatMap((r) => [r.share, r.england ?? 0])) * 1.1 || 1;
  return (
    <div data-grades="" className="flex flex-col gap-1">
      {c.rows.map((r) => (
        <div key={r.grade} className="grid grid-cols-[2.5rem_1fr_7.5rem] items-center gap-2 text-[12.5px]">
          <span className="font-semibold" style={{ color: p.text }}>{r.grade}</span>
          <span className="relative h-3.5">
            <span className="absolute inset-y-0 left-0 rounded-r-[3px]" style={{ width: `${(r.share / max) * 100}%`, background: p.focus }} />
            {r.england !== null && <span className="absolute -inset-y-1 w-[3px] rounded" style={{ left: `calc(${(r.england / max) * 100}% - 1px)`, background: roleColour(p, "england") }} />}
          </span>
          <span className="tabular-nums" style={{ color: p.muted }}>{r.count} · {Math.round(r.share * 100)}%</span>
        </div>
      ))}
      <p className="mt-1 text-[11.5px]" style={{ color: p.muted }}>Share of {c.total} at each grade (%)</p>
    </div>
  );
}

function Ranking({ c, p }: { c: Extract<Chart, { kind: "ranking" }>; p: Palette }) {
  return (
    <table className="w-full text-[12.5px]" style={{ color: p.text }}>
      <thead>
        <tr style={{ color: p.muted }} className="text-left">
          <th className="py-1 pr-2 font-medium">Rank</th>
          <th className="py-1 pr-2 font-medium">School</th>
          <th className="py-1 pr-2 text-right font-medium">Average points</th>
          <th className="py-1 text-right font-medium">Distance</th>
        </tr>
      </thead>
      <tbody>
        {c.rows.map((r, i) => (
          <tr key={i} data-featured-row={r.role === "focus" ? "" : undefined} style={r.role === "focus" ? { background: `color-mix(in srgb, ${p.focus} 16%, transparent)`, fontWeight: 700 } : undefined} className="border-t" >
            <td className="py-1.5 pr-2 tabular-nums">{r.rank}</td>
            <td className="py-1.5 pr-2">{r.label}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(r.value, c.digits)}</td>
            <td className="py-1.5 text-right tabular-nums" style={{ color: p.muted }}>{r.role === "focus" ? "—" : r.distanceKm === null ? "" : `${r.distanceKm.toFixed(1)} km`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MapChart({ c, p }: { c: Extract<Chart, { kind: "map" }>; p: Palette }) {
  const xs = c.points.map((q) => q.easting), ys = c.points.map((q) => q.northing);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x1 - x0, y1 - y0, 1000) * 1.15;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const X = (e: number) => 50 + ((e - cx) / span) * 100;
  const Y = (nn: number) => 50 - ((nn - cy) / span) * 100;
  const others = c.points.filter((q) => q.role !== "focus");
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative aspect-square w-full max-w-[340px] rounded-[10px]" style={{ background: p.dark ? "#121216" : "#f4f4f7" }}>
        {c.points.map((q, i) => (
          <span key={i} title={q.label} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${X(q.easting)}%`, top: `${Y(q.northing)}%`, width: q.role === "focus" ? 14 : 10, height: q.role === "focus" ? 14 : 10, background: roleColour(p, q.role), border: `2px solid ${p.plate}` }}>
            {q.role !== "focus" && <span data-html-label="map" className="absolute left-3 top-[-3px] text-[10px] font-semibold" style={{ color: p.muted }}>{others.indexOf(q) + 1}</span>}
          </span>
        ))}
      </div>
      <ol className="flex flex-col gap-0.5 text-[12.5px]" style={{ color: p.text }}>
        {others.map((q, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums" style={{ color: p.muted }}>{i + 1}</span>
            <span className="min-w-0 flex-grow">{q.label}</span>
            <span className="tabular-nums" style={{ color: p.muted }}>{q.value === null ? "no entries" : `${q.value} entries`}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tiles({ c, p }: { c: Extract<Chart, { kind: "tiles" }>; p: Palette }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[56px] font-semibold leading-none tracking-[-0.02em]" style={{ color: p.text }}>{c.main.figure}</span>
        <span className="text-[14px]" style={{ color: p.muted }}>{c.main.label}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {c.tiles.map((t, i) => (
          <div key={i} className="rounded-[10px] border p-3" style={{ borderColor: p.grid }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: `color-mix(in srgb, ${p.focus} 16%, transparent)`, color: p.focus }}><RailGlyph name={t.icon} /></span>
            <p className="mt-2 text-[22px] font-semibold" style={{ color: p.text }}>{t.figure}</p>
            <p className="text-[12.5px]" style={{ color: p.muted }}>{t.scope}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A chart's own table: what the rail's table view switches to, in place. */
export function ChartTable({ c, p }: { c: Chart; p: Palette }) {
  let head: string[] = [];
  let rows: (string | number)[][] = [];
  if (c.kind === "lines") {
    head = ["", ...c.years];
    rows = [...c.series.map((s) => [s.label, ...s.values.map((v) => (v === null ? "–" : fmt(v, c.digits)))]), ...(c.extraRows ?? []).map((s) => [s.label, ...s.values.map((v) => (v === null ? "–" : fmt(v, c.digits)))])];
  } else if (c.kind === "vbars" || c.kind === "hbars") {
    head = ["", c.unit];
    rows = c.rows.map((r) => [r.label, fmt(r.value, c.unit === "entries" ? 0 : 1)]);
  } else if (c.kind === "dumbbell") {
    head = ["", c.firstYear, c.latestYear, "Change"];
    rows = c.rows.map((r) => [r.label, fmt(r.first, 0), fmt(r.latest, 0), Math.round(r.latest - r.first)]);
  } else if (c.kind === "grades") {
    head = ["Grade", "Pupils", "Share", "England"];
    rows = c.rows.map((r) => [r.grade, r.count, `${Math.round(r.share * 100)}%`, r.england === null ? "–" : `${Math.round(r.england * 100)}%`]);
  } else if (c.kind === "ranking") {
    head = ["Rank", "School", c.unit];
    rows = c.rows.map((r) => [r.rank, r.label, fmt(r.value, c.digits)]);
  } else if (c.kind === "tiles") {
    head = ["", ""];
    rows = [[c.main.label, c.main.figure], ...c.tiles.map((t) => [t.scope, t.figure])];
  } else if (c.kind === "map") {
    head = ["School", "Entries"];
    rows = c.points.map((q) => [q.label, q.value ?? "–"]);
  }
  return (
    <div className="overflow-x-auto">
      <table data-chart-table="" className="w-full text-[12.5px]" style={{ color: p.text }}>
        <thead>
          <tr className="text-left" style={{ color: p.muted }}>{head.map((h, i) => <th key={i} className="py-1 pr-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t" style={{ borderColor: p.grid }}>{r.map((v, k) => <td key={k} className={`py-1.5 pr-3 ${k ? "tabular-nums" : ""}`}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WalkChart({ chart, p, asTable }: { chart: Chart; p: Palette; asTable?: boolean }) {
  let body: ReactNode;
  if (asTable) body = <ChartTable c={chart} p={p} />;
  else if (chart.kind === "lines") body = <LinesChart c={chart} p={p} />;
  else if (chart.kind === "vbars") body = <VBars c={chart} p={p} />;
  else if (chart.kind === "hbars") body = <HBars c={chart} p={p} />;
  else if (chart.kind === "dumbbell") body = <DumbbellChart c={chart} p={p} />;
  else if (chart.kind === "grades") body = <Grades c={chart} p={p} />;
  else if (chart.kind === "ranking") body = <Ranking c={chart} p={p} />;
  else if (chart.kind === "map") body = <MapChart c={chart} p={p} />;
  else if (chart.kind === "tiles") body = <Tiles c={chart} p={p} />;
  else body = <p className="text-[13px]" style={{ color: p.muted }}>{chart.reason}</p>;
  return (
    <div className="flex flex-col gap-3" style={{ "--plate": p.plate } as CSSProperties}>
      {!asTable && <ChartKey keys={chart.keys} p={p} />}
      {body}
    </div>
  );
}
