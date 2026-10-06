"use client";

// VicData 0.6.3 S1 (R-COUNTS-SELECTION): what Columns 2 and 3 show on Grade counts.
//
//   SelectionPrompt   before any grade is selected: a quiet empty-state card at the panel's
//                     size, in the existing note style (PanelLimitNote), instead of a silent
//                     average-points fallback
//   SelectionChip     with a selection: "Grade 9 · from your highlight", linking back to
//                     Column 1 (showColumn), on every title of both panels
import type { ReactNode } from "react";

export function SelectionPrompt({ text }: { text: string }) {
  return (
    <div
      data-selection-prompt=""
      className="flex min-h-[10rem] flex-1 items-center justify-center rounded-[10px] border border-dashed border-[var(--panel-border2)] p-4 text-center text-[12.5px] leading-relaxed text-[var(--muted2)]"
    >
      {text}
    </div>
  );
}

export type SelectionChipValue = { label: string; onJump: () => void };

export function SelectionChip({ chip }: { chip: SelectionChipValue }) {
  return (
    <button
      type="button"
      data-selection-chip=""
      onClick={chip.onJump}
      title="Change it in Results' Grade counts"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fg)] hover:border-[var(--accent,var(--fg))] print:hidden"
    >
      {chip.label}
    </button>
  );
}

// The chip beside the host's own controls (above the panel's title, both panels and both
// drawing paths: the controls row is the host's, whichever renderer draws the body).
export function withSelectionChip(controls: ReactNode, chip: SelectionChipValue | null | undefined): ReactNode {
  if (!chip) return controls;
  return (
    <div className="flex flex-wrap items-start justify-between gap-1.5">
      {controls}
      <SelectionChip chip={chip} />
    </div>
  );
}
