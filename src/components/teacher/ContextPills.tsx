"use client";

// Teacher view, round 7 §8: Context's two pills.
//
// This REPLACES round 6's single combined "Compare against + Measure" dropdown. That was
// recorded last round as Guy's deliberate choice, and reversing it is equally deliberate:
// reviewing the built dashboard live, the combined menu turned out to be a long scrolling
// list where the two halves were only related by being in the same popover. Two pills say
// what each one changes before it is opened.
//
// "Matching Comparisons' pattern exactly" is implemented as literally the same component
// (PillMenu), not a second lookalike -- see that file's own note.
//
// Round 8 §3: this used to carry a second pill for Candidates/Results. That is gone --
// the shared control bar's one toggle replaces it and Comparisons' equivalent, so a
// dashboard has one measure rather than three independent ones. What remains is Context's
// own dimension, which the shared toggle does not answer: WHICH GROUP the subject is being
// read against.
//
// Content round S8: two compare-against options, Whole school and Selected subjects. The
// third, "Other subjects in <category>", moved to Column 1, which now always reads the
// focused subject against its own category (S6) -- so offering it here too would have been
// the same comparison in two places.
import { MenuHeading, MenuRow } from "./PanelMenu";
import { PillMenu } from "./PillMenu";

export type CompareAgainstId = "whole" | "selected";

export function ContextPills({
  against,
  onAgainst,
  allSubjects,
  selected,
  onToggleSelected,
  onSetSelected,
}: {
  against: CompareAgainstId;
  onAgainst: (id: CompareAgainstId) => void;
  // Only subjects with real entries at this school -- the caller filters, so the list can
  // never offer a subject there is nothing behind.
  allSubjects: { key: string; label: string; colour: string }[];
  selected: string[];
  onToggleSelected: (key: string) => void;
  // S8: select-all / clear-all, one write rather than one per subject.
  onSetSelected: (keys: string[]) => void;
}) {
  const againstLabel = against === "selected" ? "Selected subjects" : "Whole school";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <PillMenu label="Compare against" value={againstLabel} width={264}>
        {(close) => (
          <>
            <MenuHeading>Compare against</MenuHeading>
            <MenuRow
              label="Whole school"
              selected={against === "whole"}
              onClick={() => { onAgainst("whole"); close(); }}
            />
            {/* Not closed on click: picking "Selected subjects" reveals the checklist
                underneath it, and closing would hide the thing just asked for. */}
            <MenuRow label="Selected subjects" selected={against === "selected"} onClick={() => onAgainst("selected")} />
            {against === "selected" && (
              <div className="flex flex-col gap-px py-1 pl-1">
                <div className="flex items-center gap-3 px-3 pb-1 text-[11.5px] font-semibold">
                  <button
                    type="button"
                    disabled={selected.length === allSubjects.length}
                    onClick={() => onSetSelected(allSubjects.map((s) => s.key))}
                    className="text-[var(--accent,var(--fg))] disabled:text-[var(--muted3)]"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={selected.length === 0}
                    onClick={() => onSetSelected([])}
                    className="text-[var(--accent,var(--fg))] disabled:text-[var(--muted3)]"
                  >
                    Clear all
                  </button>
                </div>
                {allSubjects.map((s) => (
                  <MenuRow
                    key={s.key}
                    label={s.label}
                    swatch={s.colour}
                    checkbox
                    selected={selected.includes(s.key)}
                    indented
                    onClick={() => onToggleSelected(s.key)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </PillMenu>

    </div>
  );
}
