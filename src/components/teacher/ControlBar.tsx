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

export type SharedMeasure = "candidates" | "results";

// One focus chip's row. `icon` is the qualification family's own icon (the onboarding tile
// picker's, via familyIcon), resolved once by the page so every place that draws a subject
// -- these chips, and anything else handed the same rows -- shows the same one.
export type FocusSubject = { key: string; label: string; colour: string; icon: ReactNode };

// The small icon square before a chip's label. It follows the chip's own on/off treatment:
// tinted in the chip's colour when focused, plain muted glyph when not.
export function SubjectIconSquare({ icon, colour, on }: { icon: ReactNode; colour: string; on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] [&>svg]:h-[11px] [&>svg]:w-[11px]"
      style={on ? { background: `${colour}33`, color: colour } : undefined}
    >
      {icon}
    </span>
  );
}

// The qualification glyph -- a mortarboard, the one icon the wireframe sizes up above
// every other on the page (40px box, 23px glyph, against the columns' 30/16).
const QUALIFICATION_ICON = (
  <svg width="23" height="23" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 8l8-4 8 4-8 4-8-4z" />
    <path d="M5.5 9.7V13c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V9.7" />
    <path d="M17 8v4.5" />
  </svg>
);

export function ControlBar({
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
  phaseLabel: string;
  schoolName: string | null;
  measure: SharedMeasure;
  onMeasure: (next: SharedMeasure) => void;
  subjects: FocusSubject[];
  // null = no single subject in focus; Context reads it as "All subjects" and Comparisons
  // as "Whole school", which is what each already called that state.
  focusKey: string | null;
  onFocus: (key: string | null) => void;
  onEditSubjects: () => void;
  // The theme toggle and export, which belong to the page rather than to this bar.
  chrome?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--accent-rgb,138,138,144),0.14)] text-[var(--accent,var(--muted2))]">
            {QUALIFICATION_ICON}
          </span>
          <p className="text-base font-bold">
            {phaseLabel}
            {schoolName && <span className="text-[13px] font-medium text-[var(--muted)]"> — {schoolName}</span>}
          </p>
        </div>

        {/* The toggle itself: a segmented control, not a dropdown, because there are two
            options and both should be readable without opening anything. */}
        <div className="inline-flex rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] p-[3px] print:hidden" role="group" aria-label="Measure">
          {(["candidates", "results"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={measure === m}
              onClick={() => onMeasure(m)}
              className={[
                "rounded-full px-4 py-1.5 text-[13px] font-bold",
                measure === m ? "bg-[var(--accent,var(--fg))] text-[#06120c]" : "text-[var(--muted)] hover:text-[var(--fg)]",
              ].join(" ")}
            >
              {m === "candidates" ? "Candidates" : "Results"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {subjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Focus subject">
            <button
              type="button"
              aria-pressed={focusKey === null}
              onClick={() => onFocus(null)}
              className="rounded-full border px-3 py-[5px] text-xs font-semibold"
              style={
                focusKey === null
                  ? { borderColor: "var(--fg)", background: "var(--fg)", color: "var(--bg)" }
                  : { borderColor: "var(--panel-border2)", background: "transparent", color: "var(--muted2)" }
              }
            >
              All
            </button>
            {subjects.map((s) => {
              const on = s.key === focusKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  // Single-select: picking one replaces the previous focus rather than
                  // adding to it, and picking the active one clears back to All.
                  onClick={() => onFocus(on ? null : s.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border py-[5px] pl-[5px] pr-3 text-xs font-semibold"
                  style={
                    on
                      ? { borderColor: s.colour, background: `${s.colour}29`, color: s.colour }
                      : { borderColor: "var(--panel-border2)", background: "transparent", color: "var(--muted2)" }
                  }
                >
                  <SubjectIconSquare icon={s.icon} colour={s.colour} on={on} />
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
