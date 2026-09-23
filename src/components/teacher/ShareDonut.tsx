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
  const size = fullscreen ? 180 : 104;
  const share = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex flex-wrap items-center gap-4 px-0.5 py-1">
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
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} />
          <span className="text-[12.5px]">
            {label} — {valueLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--panel-border)]" />
          <span className="text-[12.5px] text-[var(--muted)]">
            Rest of {groupLabel} — {groupValueLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
