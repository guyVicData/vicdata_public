"use client";

// Current panel rework round 1: the Candidates card's "Ranked list" view, moved out of
// CandidatesPanels as it was so Context's Current can draw the same list (Column 1's
// Current is Number tiles only now). One row per subject, largest first as the caller
// sorts it. The focused subject's row is marked for CentredOnTarget, so a whole-school
// list that scrolls starts with it in view.
import type { Measure } from "@/lib/teacher-view-panels";

export type RankedListRow = { key: string; label: string; value: number | null };

export function RankedList({
  rows,
  measure,
  focusKey = null,
}: {
  rows: RankedListRow[];
  measure: Measure;
  focusKey?: string | null;
}) {
  // A headcount reads "231 candidates"; any other measure is its own formatted figure.
  const unit = measure.id === "entries" ? " candidates" : "";
  return (
    <ol className="flex flex-col gap-1.5 px-0.5 text-[12.5px] text-[var(--muted2)]">
      {rows.map((r, i) => (
        <li key={r.key} data-highlight={r.key === focusKey ? "" : undefined}>
          <span className="tabular-nums">{i + 1}</span>&nbsp;&nbsp;
          <span className="font-medium text-[var(--fg)]">{r.label}</span> —{" "}
          {r.value === null ? "no published figure" : `${measure.format(r.value)}${unit}`}
        </li>
      ))}
    </ol>
  );
}
