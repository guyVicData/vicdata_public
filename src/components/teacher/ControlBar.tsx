"use client";

// Teacher view, round 8 §3: the one control bar, replacing the per-column title rows.
//
// It carries exactly three things, and the list is deliberately short. Guy caught, live,
// that a measure-specific pill appearing up here only in Results mode threw the three
// columns' panel grids out of alignment with each other depending on toggle state -- so
// everything measure-specific moved down under its own column's heading, and what is left
// here is only what is genuinely global:
//
//   - the qualification icon (the largest on the page, by design) and "GCSE — {school}";
//   - the Candidates/Results toggle, which drives all three columns at once;
//   - the focus-subject chips, single-select, and the "±" that opens the subject picker.
//
// Single-select is Guy's own resolution: "lets leave single subject selected for now as it
// would change which graphs were shown." These chips are a FOCUS, read by Context and
// Comparisons, both already single-subject mechanisms. Column 1's own multi-subject bars
// are a separate thing and this does not touch them.
import type { ReactNode } from "react";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { PhaseGlyph } from "./HomeCard";

export type SharedMeasure = "candidates" | "results";

// One focus chip's row. Round 2 §1 dropped the chips' icon: it was the qualification
// FAMILY's icon (built for the onboarding tiles, three at KS4), so every standard GCSE
// subject showed the same mortarboard. There is no per-subject icon set to use instead.
export type FocusSubject = { key: string; label: string; colour: string };

// The toggle itself: a segmented control, not a dropdown, because there are two options and
// both should be readable without opening anything. Exported so the phone nav renders this
// same control rather than a lookalike; `compact` only tightens its padding for phone width.
export function MeasureToggle({
  measure,
  onMeasure,
  compact = false,
}: {
  measure: SharedMeasure;
  onMeasure: (next: SharedMeasure) => void;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] p-[3px] print:hidden" role="group" aria-label="Measure">
      {(["candidates", "results"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={measure === m}
          onClick={() => onMeasure(m)}
          className={[
            compact ? "rounded-full px-3 py-1 text-xs font-bold" : "rounded-full px-4 py-1.5 text-[13px] font-bold",
            measure === m ? "bg-[var(--accent,var(--fg))] text-[#06120c]" : "text-[var(--muted)] hover:text-[var(--fg)]",
          ].join(" ")}
        >
          {m === "candidates" ? "Candidates" : "Results"}
        </button>
      ))}
    </div>
  );
}

export function ControlBar({
  phase,
  phaseLabel,
  schoolName,
  measure,
  onMeasure,
  subjects,
  focusKey,
  onFocus,
  onEditSubjects,
  chrome,
}: {
  // Content round S1: the badge draws the phase's own PhaseGlyph -- the one the Teacher
  // home tiles and the nav's phase switcher use -- not a separate mortarboard.
  phase: TeacherPhase;
  phaseLabel: string;
  schoolName: string | null;
  measure: SharedMeasure;
  onMeasure: (next: SharedMeasure) => void;
  subjects: FocusSubject[];
  // Always one of `subjects` (content round S5: there is no "All"); null only when no
  // subject is ticked, in which case there are no chips to highlight either.
  focusKey: string | null;
  onFocus: (key: string) => void;
  onEditSubjects: () => void;
  // The theme toggle and export, which belong to the page rather than to this bar.
  chrome?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--accent-rgb,138,138,144),0.14)] text-[var(--accent,var(--muted2))]">
            <span className="flex [&>svg]:h-[23px] [&>svg]:w-[23px]"><PhaseGlyph phase={phase} /></span>
          </span>
          <p className="text-base font-bold">
            {phaseLabel}
            {schoolName && <span className="text-[13px] font-medium text-[var(--muted)]"> — {schoolName}</span>}
          </p>
        </div>

        <MeasureToggle measure={measure} onMeasure={onMeasure} />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {subjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Focus subject">
            {subjects.map((s) => {
              const on = s.key === focusKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  // Single-select, and always one: content round S5 removed "All", so picking
                  // the active chip again keeps it rather than clearing the focus.
                  onClick={() => onFocus(s.key)}
                  className="rounded-full border px-3 py-[5px] text-xs font-semibold"
                  style={
                    on
                      ? { borderColor: s.colour, background: `${s.colour}29`, color: s.colour }
                      : { borderColor: "var(--panel-border2)", background: "transparent", color: "var(--muted2)" }
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={onEditSubjects}
          aria-label="Change subjects"
          aria-haspopup="dialog"
          title="Change subjects"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--accent,var(--muted2))] text-[13px] font-extrabold text-[var(--accent,var(--muted2))]"
        >
          &plusmn;
        </button>
        {chrome}
      </div>
    </div>
  );
}
