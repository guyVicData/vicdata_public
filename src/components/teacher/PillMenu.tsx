"use client";

// Teacher view, round 7 §8: the labelled pill-with-popover that Context and Comparisons
// both use for their "which data" controls.
//
// Round 6 gave Context one combined dropdown and Comparisons two separate pills, recorded
// then as a deliberate difference. Round 7 reverses that: Context splits into two pills
// "matching Comparisons' pattern exactly". "Exactly" is why this is a shared component
// rather than a second set of lookalike buttons -- the round-6 note is the kind of thing
// that quietly stops being true when one of two copies gets a padding tweak.
//
// The popover itself is PanelMenu, the same one Add and the measure switcher open, so
// Escape and click-outside behave identically everywhere.
import { useState, type ReactNode } from "react";
import { ChevronDown } from "./PanelIcons";
import { PanelMenu, useDismiss } from "./PanelMenu";

export function PillMenu({
  label,
  value,
  menuLabel,
  width = 220,
  align = "left",
  title,
  children,
}: {
  // The fixed prefix ("Compare against", "Measure"), so the pill says what it changes
  // even when its current value is a subject nobody recognises out of context.
  label: string;
  value: string;
  menuLabel?: string;
  width?: number;
  align?: "left" | "right";
  // 0.6 snag 1: the pill's full text as a tooltip, for a value long enough to truncate.
  title?: string;
  // Given `close`, so a row can dismiss the popover after choosing -- but a checklist row
  // can choose not to.
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    // max-w-full + the span's min-w-0 (snag 1 item 02): a value too long for the column now
    // truncates with an ellipsis instead of running past it. Pills that fit are unchanged.
    <div className="relative max-w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
        className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--muted2)] hover:border-[var(--fg)]"
      >
        <span className="min-w-0 truncate">
          {label}: <span className="text-[var(--fg)]">{value}</span>
        </span>
        <span className="shrink-0">{ChevronDown}</span>
      </button>
      {open && (
        <PanelMenu label={menuLabel ?? label} align={align} width={width}>
          {children(() => setOpen(false))}
        </PanelMenu>
      )}
    </div>
  );
}
