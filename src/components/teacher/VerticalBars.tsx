"use client";

// Teacher view, round 6: the Candidates Current panel's bar chart (Main.dc.html).
//
// Deliberately NOT a fourth ViewChart layout. ViewChart's bars all share one shape -- a
// horizontal track with the value at the end -- and this is the other shape: a value axis
// up the side, gridlines across, and a category per column underneath. Folding it in
// would mean a `layout` prop that switches the axis as well as the arrangement, which is
// two charts in one component wearing a single name.
//
// Same build rules as ViewChart, though: divs on a baseline, no canvas, no library, every
// colour either a theme token or the subject's own qualification colour.
import { useLayoutEffect, useRef, useState } from "react";
import type { Measure } from "@/lib/teacher-view-panels";

// Under the baseline: the column's 4px gap plus up to two label lines, plus the 6px top
// inset every column starts with, plus 6px of room under the second line -- what the
// measured height must leave room for. Always two lines, so every chart's baseline sits
// at the same height whether or not any label actually wraps. LABEL_LINE is the label's
// real rendered line height: it is set explicitly on the label below (measured: one line
// 12px, two lines 24px), not the ~15px the old default leading gave. BOTTOM_ROOM is the
// headroom: without it a two-line label ended flush with the card's content edge.
const LABEL_LINE = 12;
const BOTTOM_ROOM = 6;
const BELOW_AND_ABOVE = 6 + 4 + 2 * LABEL_LINE + BOTTOM_ROOM;

// The widest a column (and so its label) may be before the label wraps: 4rem.
const LABEL_MAX = 64;

// The right-edge fade while more bars are scrolled out of view.
const EDGE_FADE = "linear-gradient(to right, #000 calc(100% - 28px), transparent)";

export type VerticalBar = { key: string; label: string; shortLabel: string; value: number | null; colour: string };

export function VerticalBars({
  bars,
  measure,
  fullscreen = false,
}: {
  bars: VerticalBar[];
  measure: Measure;
  fullscreen?: boolean;
}) {
  // The chart fills whatever height its container gives it, measured, rather than a
  // hand-tuned constant: the old fixed 90px dated from the 232px card and left the bars
  // in a strip at the top of the accordion round's 384px panel -- and a constant would
  // drift out of date again the next time PANEL_HEIGHT changes. The old 90/220 remain
  // as the floor, which is also what shows until the first measurement lands.
  const fallback = fullscreen ? 220 : 90;
  const real = bars.map((b) => b.value).filter((v): v is number => v !== null);
  const hasData = real.length > 0;
  const barW = bars.length > 5 ? 20 : 26;
  const box = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  // A layout effect, so the first measurement lands before the first paint (no frame of
  // the small fallback chart), then a ResizeObserver keeps it current as the panel,
  // the accordion or the fullscreen modal changes size.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setMeasured(Math.floor(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // Re-attached when the chart appears after an empty state, which renders no box.
  }, [hasData]);

  // The bars row scrolls sideways when the bars outnumber the card's width. Tracked here:
  // whether more bars sit past the right edge (which fades the edge, so a bar cut by it
  // reads as "scroll for more" rather than broken), and the height of the row's own
  // scrollbar where the platform draws one (Windows), which the bar area gives up so the
  // labels are never pushed under the card's clipped bottom edge.
  const row = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ more: false, scrollbar: 0 });
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const check = () => {
      const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
      const scrollbar = el.offsetHeight - el.clientHeight;
      setEdge((prev) => (prev.more === more && prev.scrollbar === scrollbar ? prev : { more, scrollbar }));
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [hasData]);

  // Round 2: every column is ONE width -- the widest single WORD among this chart's
  // labels, capped at LABEL_MAX and never narrower than a bar. The label used to set its
  // own column's width under a max-width cap, so "Bio" made a 20px column and "Math Stud"
  // a 46px one, and one constant gap between columns of six different widths read as
  // irregular gaps driven by the label text. Sized to the widest word rather than the
  // widest whole label, so "Math Stud" and "Fur Maths" wrap onto two lines at their space
  // (the two-line room is always reserved anyway) instead of widening every column to
  // fit them on one: on The Chase's six Sciences & Maths bars that is 30px columns in
  // place of 48px. Not a flat 64px either: six of those would scroll on almost every
  // card. Measured with the label's real font (canvas measureText) before the first paint.
  const [colW, setColW] = useState<number | null>(null);
  const labelKey = bars.map((b) => b.shortLabel).join("\u0000");
  useLayoutEffect(() => {
    const label = row.current?.querySelector<HTMLElement>("[data-bar-label]");
    const ctx = label ? document.createElement("canvas").getContext("2d") : null;
    if (!label || !ctx) return;
    const cs = getComputedStyle(label);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const words = labelKey.split("\u0000").flatMap((t) => t.split(/\s+/)).filter(Boolean);
    const widest = Math.max(0, ...words.map((w) => ctx.measureText(w).width));
    setColW(Math.min(LABEL_MAX, Math.max(barW, Math.ceil(widest) + 2)));
  }, [hasData, labelKey, barW]);

  if (!hasData) return <p className="text-xs text-[var(--muted)]">No published figures for these subjects yet.</p>;

  // Round 7 §5: the tallest real bar fills the chart. This used to round up to a "nice"
  // round number, which on a real dashboard meant Candidates' tallest bar of 231 being
  // drawn against an axis top of 500 -- half the height, for no reason a reader could
  // see. The axis figures are the data's own now, not a rounder number near it.
  const top = Math.max(...real);
  // bodyH is the bar area; the axis SVG (plot) is 16px taller, as before.
  const bodyH = Math.max(fallback, measured ?? 0) - BELOW_AND_ABOVE - edge.scrollbar;
  const columnStyle = colW === null ? { maxWidth: LABEL_MAX } : { width: colW };
  const plot = bodyH + 16;
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  // The axis is as wide as its widest figure needs, not a fixed 30px: this panel's
  // figures are mostly one or two digits ("37", "9"), and the fixed box left ~17px of
  // empty space before them -- the unexplained left margin on the Candidates card. About
  // 5.6px a character at 9.5px (digits run ~5.2px, so this errs wide), plus 2px each side.
  const axisW = Math.max(12, Math.ceil(Math.max(...ticks.map((t) => measure.format(top * t).length)) * 5.6) + 4);

  return (
    // flex-1 + basis-0: the height comes from the container's free space, never from this
    // chart's own content, so a taller plot cannot feed back into a taller measurement.
    // min-height keeps the old fixed size as a floor where a container gives no height.
    <div ref={box} className="mt-1 flex min-h-0 flex-1 basis-0 gap-2 overflow-hidden" style={{ minHeight: fallback }}>
      <svg data-axis width={axisW} height={plot} viewBox={`0 0 ${axisW} ${plot}`} aria-hidden="true" className="shrink-0">
        {ticks.map((t) => (
          <text key={t} x={axisW - 2} y={6 + (1 - t) * bodyH + 3} textAnchor="end" fontSize="9.5" fill="var(--muted)">
            {measure.format(top * t)}
          </text>
        ))}
      </svg>
      {/* min-w-0: without it this flex item grows to its bars' full width, the row inside
          never overflows and so never scrolls, and the card's own overflow-hidden crops the
          last bars mid-bar instead. */}
      <div className="relative min-w-0 flex-grow">
        {/* Gridlines sit behind the bars at the same offsets the axis labels use, so a
            bar's top genuinely meets the line its figure is written against. */}
        {ticks.slice(0, -1).map((t) => (
          <div key={t} className="absolute inset-x-0 h-px bg-[var(--panel-border)]" style={{ top: 6 + (1 - t) * bodyH }} />
        ))}
        <div className="absolute inset-x-0 h-px bg-[var(--panel-border2)]" style={{ top: 6 + bodyH }} />
        {/* pt-[6px] matches the axis SVG's own 6px inset, which is what keeps the two
            columns' baselines on the same line without absolute positioning. pr-4: scrolled
            fully right, the last bar and its label clear the edge rather than meeting it. */}
        <div
          ref={row}
          className="flex gap-4 overflow-x-auto pl-1 pr-4 pt-[6px]"
          style={edge.more ? { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE } : undefined}
        >
          {bars.map((b) => (
            <div
              key={b.key}
              className="flex shrink-0 flex-col items-center gap-1"
              style={columnStyle}
              title={`${b.label}: ${b.value === null ? "no figure" : measure.format(b.value)}`}
            >
              <div className="flex items-end" style={{ height: bodyH }}>
                <div
                  className="rounded-t"
                  style={{
                    width: barW,
                    height: b.value === null ? 0 : Math.max(2, (b.value / top) * bodyH),
                    background: b.colour,
                  }}
                />
              </div>
              {/* Two lines before an ellipsis, not one: the short labels ("Fur Maths") are
                  already abbreviated, so clipping them further lost the subject entirely. */}
              <span
                data-bar-label
                className="line-clamp-2 w-full text-center text-[10px] break-words whitespace-normal text-[var(--muted3)]"
                style={{ lineHeight: `${LABEL_LINE}px` }}
              >
                {b.shortLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
