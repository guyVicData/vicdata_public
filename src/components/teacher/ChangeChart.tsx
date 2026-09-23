"use client";

// Teacher view, round 6: the % change panel's diverging bar chart (round-6 wireframe,
// all four boards; brief §4.1-§4.3).
//
// Every subject at once, no selector -- "comparing subjects against each other is the
// point" (§4.1), which is also why this panel has a Since: control but no chip row. Bars
// grow up or down from a shared zero line, so a decline is visibly a decline rather than
// a shorter bar with a minus sign in front of it.
//
// Divs rather than SVG, unlike TrendChart: these are rectangles on a baseline, which is
// exactly what ViewChart's own bars already are, and building them the same way keeps the
// print/theme behaviour ViewChart's comment argues for.
const LANE = 38; // px of travel either side of the zero line

export type ChangeBar = {
  key: string;
  label: string;
  shortLabel: string;
  colour: string;
  // null where the span has no two real figures to compare -- rendered as a gap with a
  // dash, never as 0%, which would read as "measured, and it did not move".
  percent: number | null;
};

export function ChangeChart({ bars, fullscreen = false }: { bars: ChangeBar[]; fullscreen?: boolean }) {
  const real = bars.filter((b) => b.percent !== null);
  if (real.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No two years of published figures to compare yet.</p>;
  }
  // Round out to a 10% step with headroom, so the tallest bar never touches the axis top
  // and the scale reads as a scale rather than as whatever the maximum happened to be.
  const axisMax = Math.max(10, Math.ceil((Math.max(...real.map((b) => Math.abs(b.percent!))) * 1.3) / 10) * 10);
  const lane = fullscreen ? LANE * 2 : LANE;
  const barWidth = bars.length > 5 ? 20 : 26;

  return (
    <div className="mt-1">
      <div className="flex gap-2">
        <svg width="34" height={lane * 2 + 12} viewBox={`0 0 34 ${lane * 2 + 12}`} aria-hidden="true" className="shrink-0">
          <line x1="32" y1="6" x2="32" y2={lane * 2 + 6} stroke="var(--panel-border2)" strokeWidth="1" />
          {[
            { y: 6, label: `+${axisMax}%` },
            { y: lane + 6, label: "0" },
            { y: lane * 2 + 6, label: `−${axisMax}%` },
          ].map((t) => (
            <g key={t.label}>
              <line x1="28" y1={t.y} x2="32" y2={t.y} stroke="var(--muted3)" strokeWidth="1" />
              <text x="26" y={t.y + 3} textAnchor="end" fontSize="9.5" fill="var(--muted)">{t.label}</text>
            </g>
          ))}
        </svg>
        <div className="relative flex-grow" style={{ height: lane * 2 + 12 }}>
          <div className="absolute inset-x-0 h-px bg-[var(--panel-border2)]" style={{ top: lane + 6 }} />
          <div className="flex h-full items-center justify-center gap-3 overflow-x-auto px-1">
            {bars.map((b) => {
              const pct = b.percent ?? 0;
              const up = b.percent === null ? 0 : Math.max(0, Math.round((pct / axisMax) * lane));
              const down = b.percent === null ? 0 : Math.max(0, Math.round((-pct / axisMax) * lane));
              return (
                <div key={b.key} className="flex shrink-0 flex-col items-center" title={`${b.label}: ${b.percent === null ? "no figure" : `${pct >= 0 ? "+" : "−"}${Math.abs(Math.round(pct))}%`}`}>
                  <div className="flex items-end" style={{ height: lane + 6 }}>
                    <div
                      className="rounded-t"
                      style={{ width: barWidth, height: Math.max(b.percent === null ? 0 : 3, up), background: b.colour }}
                    />
                  </div>
                  <div className="flex items-start" style={{ height: lane + 6 }}>
                    <div
                      className="rounded-b"
                      style={{ width: barWidth, height: Math.max(b.percent === null ? 0 : 3, down), background: b.colour }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-[34px] shrink-0" />
        <div className="flex flex-grow justify-center gap-3 overflow-x-auto px-1">
          {bars.map((b) => (
            <div key={b.key} className="flex shrink-0 flex-col items-center gap-px" style={{ width: barWidth }}>
              <span className="truncate text-[10px] text-[var(--muted3)]">{b.shortLabel}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: b.percent === null ? "var(--muted3)" : b.colour }}>
                {b.percent === null ? "—" : `${b.percent >= 0 ? "+" : "−"}${Math.abs(Math.round(b.percent))}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
