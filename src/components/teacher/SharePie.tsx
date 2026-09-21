"use client";

// Teacher view School Context default ("Share of entries"): the mockups' 70px conic-
// gradient pie with a swatch legend beside it. CSS-only for the same reason ViewChart is
// -- it prints exactly as it looks and takes the theme tokens for free.
//
// Slices are per qualification group, not per subject, exactly as the mockups draw them
// ("Geography & Sports Studies (GCSE) — 9%"): a group shares one chip colour, so two
// same-coloured slices side by side would read as one anyway.

export type PieSlice = { label: string; value: number; color: string };

function pct(v: number, total: number): number {
  return total > 0 ? (v / total) * 100 : 0;
}

export function SharePie({ slices, total, fullscreen }: { slices: PieSlice[]; total: number; fullscreen: boolean }) {
  const mine = slices.reduce((a, s) => a + s.value, 0);
  const rest = Math.max(0, total - mine);
  // Each slice starts where the ones before it end.
  const ends = slices.map((_, i) => slices.slice(0, i + 1).reduce((a, s) => a + pct(s.value, total), 0));
  const stops = slices.map((s, i) => `${s.color} ${i === 0 ? 0 : ends[i - 1]}% ${ends[i]}%`);
  stops.push(`var(--panel-border) ${ends[ends.length - 1] ?? 0}% 100%`);
  const size = fullscreen ? 180 : 70;
  // Rounded for display only; the slices themselves use exact shares.
  const show = (v: number) => `${Math.round(pct(v, total))}%`;
  return (
    <div className="flex items-center gap-3.5">
      <div
        role="img"
        aria-label={`${slices.map((s) => `${s.label} ${show(s.value)}`).join(", ")}, every other subject ${show(rest)}`}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${stops.join(", ")})` }}
      />
      <div className={`flex flex-col gap-1.5 ${fullscreen ? "text-sm" : "text-[11.5px]"}`}>
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: s.color }} />
            {s.label} &mdash; {show(s.value)}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 shrink-0 rounded-[2px] border border-[var(--panel-border2)] bg-[var(--panel-border)]" />
          Every other subject &mdash; {show(rest)}
        </div>
      </div>
    </div>
  );
}
