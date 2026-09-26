"use client";

// Teacher view, round 6: Context Current's donut view (Context.dc.html; brief §4.2).
//
// One share, not a breakdown: "your focus subject(s) as a portion of the comparison
// group", with the rest of the group as the track behind it. That is why it replaces
// round 5's SharePie rather than extending it -- the pie sliced the school's entries by
// qualification group, which is a different question from the one this column now asks.
//
// Candidates only. A "share" of an average point score is not a meaningful percentage,
// so the icon that selects this view is genuinely disabled for a Results measure (§4.2)
// rather than this component rendering something misleading.
import { useLayoutEffect, useRef, useState } from "react";

// The two legend lines under the circle, with the gap above them.
const LEGEND_H = 60;

export function ShareDonut({
  percent,
  label,
  groupLabel,
  valueLabel,
  groupValueLabel,
  colour,
  fullscreen = false,
}: {
  percent: number;
  label: string;
  groupLabel: string;
  valueLabel: string;
  groupValueLabel: string;
  colour: string;
  fullscreen?: boolean;
}) {
  // Live review Part C: the circle fills the space the panel gives it, measured (the same
  // fix as VerticalBars, c3716e4), rather than a fixed 104px sitting small in a 384px
  // panel. The legend moved under the circle so the circle can use the card's full width;
  // beside it, the legend capped the circle at about half the width. The diameter is the
  // smaller of the width and the height left above the legend, so it stays a circle; the
  // old 104 / 180 are the floor.
  const fallback = fullscreen ? 180 : 104;
  const box = useRef<HTMLDivElement | null>(null);
  const [space, setSpace] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSpace({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const size = Math.max(fallback, space ? Math.min(space.w - 8, space.h - LEGEND_H) : 0);
  const share = Math.max(0, Math.min(100, percent));
  return (
    // flex-1 + basis-0: sized by the panel's free space, never by the circle it draws.
    <div ref={box} className="flex min-h-0 flex-1 basis-0 flex-col items-center justify-center gap-3 overflow-hidden px-0.5 py-1" style={{ minHeight: fallback + LEGEND_H }}>
      {/* r = 15.9155 makes the circumference 100, so the dash array IS the percentage
          and no arc maths is needed. Rotated -90 so it starts at twelve o'clock. */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 42 42"
        className="shrink-0"
        role="img"
        aria-label={`${label} is ${Math.round(share)}% of ${groupLabel}`}
      >
        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--panel-border)" strokeWidth="6" />
        <circle
          cx="21"
          cy="21"
          r="15.9155"
          fill="transparent"
          stroke={colour}
          strokeWidth="6"
          strokeDasharray={`${share} 100`}
          strokeLinecap="round"
          transform="rotate(-90 21 21)"
        />
        <text x="21" y="24" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--fg)">
          {Math.round(share)}%
        </text>
      </svg>
      <div className="flex min-w-0 flex-col gap-2 self-stretch">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} />
          <span className="text-[12.5px]">
            {label} — {valueLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--panel-border)]" />
          {/* Live review Part C: the same words whichever set is being compared against. */}
          <span className="text-[12.5px] text-[var(--muted)]">All other entries — {groupValueLabel}</span>
        </div>
      </div>
    </div>
  );
}
