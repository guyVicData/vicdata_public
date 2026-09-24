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
// §6.1's decision is unchanged: three compare-against options, with category-vs-category
// still deferred because it compares subject GROUPS rather than a subject to a group.
import { MenuHeading, MenuRow } from "./PanelMenu";
import { PillMenu } from "./PillMenu";

export type CompareAgainstId = "whole" | "area" | "selected";

export function ContextPills({
  against,
  onAgainst,
  areaLabel,
  allSubjects,
  selected,
  onToggleSelected,
}: {
  against: CompareAgainstId;
  onAgainst: (id: CompareAgainstId) => void;
  // The real subject family of the subject currently in focus, so the row reads
  // "Other subjects in Humanities & Social Sciences" rather than a placeholder.
  areaLabel: string | null;
  allSubjects: { key: string; label: string; colour: string }[];
  selected: string[];
  onToggleSelected: (key: string) => void;
}) {
  const againstLabel =
    against === "area" ? areaLabel ?? "Its category" : against === "selected" ? "Selected subjects" : "Whole school";

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
            <MenuRow
              label={areaLabel ? `Other subjects in ${areaLabel}` : "Other subjects in its category"}
              selected={against === "area"}
              disabled={!areaLabel}
              onClick={() => { onAgainst("area"); close(); }}
            />
            {/* Not closed on click: picking "Selected subjects" reveals the checklist
                underneath it, and closing would hide the thing just asked for. */}
            <MenuRow label="Selected subjects" selected={against === "selected"} onClick={() => onAgainst("selected")} />
            {against === "selected" && (
              <div className="flex flex-col gap-px py-1 pl-1">
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
