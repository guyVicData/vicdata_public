"use client";

// VicData 0.8 front door 2b (M2): the dumbbell at dashboard size (RD-DUMBBELL on Context › Trends; the
// board's "same view on the dashboard", docs/v0.8/front_door_design/png/dumbbell.png). One row per subject:
// a ring at the first year, a dot at the latest, the bar between them in the subject's own colour (the
// panel's: the focus in the accent, the rest Current's grey ramp, as Ranked change draws them), the change
// in entries with ▲ / ▼ (no green/red), the focus row tinted; the plain average of the rows drawn, dashed, last.
// On the card the short names and a tight row (15 px) fit about 14 subjects in a 300 px panel; a longer
// list scrolls inside its box with the focus centred (CentredOnTarget). Full screen: full names, wider.
import type { DashboardDumbbell } from "@/lib/teacher-dumbbell";

export function DumbbellView({ d, fullscreen = false, firstLabel, latestLabel }: { d: DashboardDumbbell; fullscreen?: boolean; firstLabel: string; latestLabel: string }) {
  const values = [...d.rows.flatMap((r) => [r.first, r.latest]), ...(d.average ? [d.average.first, d.average.latest] : [])];
  const max = Math.max(...values, 1) * 1.04;
  const at = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  const grid = fullscreen ? "grid-cols-[minmax(0,11rem)_1fr_3.25rem] gap-3 text-[12.5px]" : "grid-cols-[6.5rem_1fr_2.75rem] gap-2 text-[11px]";
  const rowH = fullscreen ? "min-h-[24px]" : "min-h-[15px]";
  const mark = fullscreen ? "h-[9px] w-[9px]" : "h-[7px] w-[7px]";
  const change = (v: number) => {
    const c = Math.round(v);
    return c > 0 ? `▲ ${c.toLocaleString("en-GB")}` : c < 0 ? `▼ ${(-c).toLocaleString("en-GB")}` : "– 0";
  };
  const track = (first: number, latest: number, colour: string, dashed = false) => (
    <span className="relative block h-full min-h-[inherit]">
      <span
        aria-hidden="true"
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: at(Math.min(first, latest)), width: `calc(${at(Math.max(first, latest))} - ${at(Math.min(first, latest))})`, ...(dashed ? { borderTop: `1.5px dashed ${colour}` } : { height: 2, background: colour, opacity: 0.7 }) }}
      />
      <span aria-hidden="true" className={`absolute top-1/2 ${mark} -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-[var(--box-bg)]`} style={{ left: at(first), borderColor: colour }} />
      <span aria-hidden="true" className={`absolute top-1/2 ${mark} -translate-x-1/2 -translate-y-1/2 rounded-full`} style={{ left: at(latest), background: colour }} />
    </span>
  );
  return (
    <div data-view="dumbbell" className="flex min-h-0 flex-col gap-1">
      <div className="flex flex-col">
        {d.rows.map((r) => (
          <div
            key={r.key}
            data-dumbbell-row={r.focus ? "focus" : "subject"}
            data-highlight={r.focus ? "" : undefined}
            title={`${r.label}: ${Math.round(r.first).toLocaleString("en-GB")} in ${firstLabel}, ${Math.round(r.latest).toLocaleString("en-GB")} in ${latestLabel}`}
            className={`grid ${grid} ${rowH} items-center rounded-[4px] px-1 ${r.focus ? "bg-[rgba(var(--accent-rgb,120,120,120),0.14)]" : ""}`}
          >
            <span className={`truncate text-right ${r.focus ? "font-semibold text-[var(--accent,var(--fg))]" : "text-[var(--muted2)]"}`}>{fullscreen ? r.label : r.shortLabel}</span>
            {track(r.first, r.latest, r.colour)}
            <span className={`text-right tabular-nums ${r.focus ? "font-semibold text-[var(--accent,var(--fg))]" : "text-[var(--muted2)]"}`}>{change(r.change)}</span>
          </div>
        ))}
        {d.average && (
          <div data-dumbbell-row="average" className={`mt-1 grid ${grid} ${rowH} items-center border-t border-[var(--panel-border)] px-1 pt-1`}>
            <span className="truncate text-right italic text-[var(--muted2)]" title={d.average.label}>{fullscreen ? d.average.label : "Average"}</span>
            {track(d.average.first, d.average.latest, "var(--muted2)", true)}
            <span className="text-right tabular-nums text-[var(--muted2)]">{change(d.average.change)}</span>
          </div>
        )}
      </div>
      <p className="text-[10.5px] text-[var(--muted3)]">
        Entries: ring {firstLabel}, dot {latestLabel}; change in entries{d.average ? `; average of the ${d.rows.length} drawn` : ""}{d.leftOut ? ` · ${d.leftOut} ${d.leftOut === 1 ? "subject" : "subjects"} without both years left out` : ""}
      </p>
    </div>
  );
}
