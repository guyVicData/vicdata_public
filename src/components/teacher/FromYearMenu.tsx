"use client";

// Teacher view, content round S11: the "From {year} ▾" start-year dropdown on every Trends
// and % Change panel, in all three columns.
//
// It replaces the From:/Since: pills, which cycled one year per click (nextStart) and so
// hid the choices until you had clicked through them. One component for all six panels,
// so they cannot drift apart. The years offered are startOptions(periods) -- the real
// periods that panel has figures for, minus the last one, since a range needs two points.
// With fewer than two to choose between there is nothing to narrow, and it reads as plain
// text rather than as a control that does nothing.
import { useState } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { startOptions } from "@/lib/teacher-view-panels";
import { ChevronDown } from "./PanelIcons";
import { MenuRow, PanelMenu, useDismiss } from "./PanelMenu";

export function FromYearMenu({
  periods,
  from,
  onChange,
  mode = "from",
}: {
  // Every period the panel has a figure for, ascending.
  periods: number[];
  // The first period the panel is currently showing, or null when it has none.
  from: number | null;
  onChange: (start: number) => void;
  // Round 2 §4: "year" picks ONE year to show (Context's Current, which used to have a
  // prev/next stepper) rather than the start of a range -- so every real year is offered,
  // the latest included, and the button reads "2024/25 ▾" rather than "From 2024/25 ▾".
  mode?: "from" | "year";
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const options = mode === "year" ? [...periods].reverse() : startOptions(periods);
  const label = from === null ? "—" : academicYearLabel(from);

  if (options.length < 2) {
    return <span className="text-[12px] font-medium text-[var(--muted)]">{mode === "year" ? label : `from ${label}`}</span>;
  }
  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-md px-1 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {mode === "year" ? label : `From ${label}`}
        {ChevronDown}
      </button>
      {open && (
        <PanelMenu label={mode === "year" ? "Year" : "Start year"} width={140}>
          {options.map((p) => (
            <MenuRow
              key={p}
              label={academicYearLabel(p)}
              selected={p === from}
              onClick={() => { onChange(p); setOpen(false); }}
            />
          ))}
        </PanelMenu>
      )}
    </span>
  );
}
