"use client";

// Teacher view, round 6: the Measure switcher (brief §4.1).
//
// Deliberately separate from Add, and the separation is the point. Add only ever asks
// "how do I want to look at this" (Current / Trend / % change); the Measure switcher asks
// "which data", and picking one re-points all three panels at it together, so the panels
// someone has built survive a measure change untouched.
//
// The two measures with no data model yet -- Grade bands and Grade counts -- are SHOWN,
// greyed, tagged "Coming soon", rather than hidden (§5). Their absence then reads as a
// known gap rather than an omission nobody noticed. They are real disabled buttons, so
// they are inert to the keyboard as well as to the mouse.
import { useState } from "react";
import { COMING_SOON_MEASURES, type Measure } from "@/lib/teacher-view-panels";
import { ChevronDown } from "./PanelIcons";
import { MenuHeading, MenuRow, PanelMenu, useDismiss } from "./PanelMenu";

export function MeasurePicker({
  measures,
  active,
  onChange,
  label,
}: {
  measures: Measure[];
  active: Measure;
  onChange: (id: string) => void;
  // What the pill reads when closed. Context passes its own combined label
  // ("Whole school · Candidates"); Results just uses the measure's name.
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {label ?? active.label}
        {ChevronDown}
      </button>
      {open && (
        <PanelMenu label="Switch measure" width={236}>
          <MenuHeading>Switch measure</MenuHeading>
          {measures.map((m) => (
            <MenuRow
              key={m.id}
              label={m.label}
              selected={m.id === active.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
            />
          ))}
          {COMING_SOON_MEASURES.map((m) => (
            <MenuRow key={m.id} label={m.label} tag="Coming soon" disabled onClick={() => {}} />
          ))}
        </PanelMenu>
      )}
    </div>
  );
}
