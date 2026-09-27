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
// Combined round §4b: the "Selected subjects" checklist moved out of the dropdown into the
// dashboard's one subject picker (CategorySubjectPicker), in the compact TeacherModal --
// categories, per-category tick/untick and a global Select all / Deselect all, instead of
// a flat list inside a popover. §4c: no qualification step; the caller passes only the
// focused subject's qualification family. §4f: still no Apply -- every tick writes
// immediately, as the dropdown's did.
import { useRef, useState } from "react";
import { MenuHeading, MenuRow } from "./PanelMenu";
import { PillMenu } from "./PillMenu";
import { ExpandIcon, MODAL_CLOSE_BUTTON_CLASS, TeacherModal } from "./TeacherModal";
import { CategorySubjectPicker, type PickerItem } from "./CategorySubjectPicker";
import type { QualificationFamily } from "@/lib/teacher-view-theme";

export type CompareAgainstId = "whole" | "selected";

export function ContextPills({
  against,
  onAgainst,
  pickerItems,
  family,
  focusCategory,
  theme,
  selected,
  onToggleSelected,
  onSetSelected,
}: {
  against: CompareAgainstId;
  onAgainst: (id: CompareAgainstId) => void;
  // Only subjects with real entries at this school, in the focused subject's
  // qualification family -- the caller filters, so the picker can never offer a subject
  // there is nothing behind, or one from another qualification.
  pickerItems: PickerItem[];
  family: QualificationFamily | null;
  // The focused subject's category, opened first in the picker.
  focusCategory: string | null;
  theme: "dark" | "light";
  selected: string[];
  onToggleSelected: (key: string) => void;
  // Bulk changes (select all, a whole category): one write rather than one per subject.
  onSetSelected: (keys: string[]) => void;
}) {
  // Live review Part B: "All subjects" on screen; the id stays "whole".
  const againstLabel = against === "selected" ? "Selected subjects" : "All subjects";
  const [pickerOpen, setPickerOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const offered = new Set(pickerItems.map((i) => i.key));
  const nSelected = selected.filter((k) => offered.has(k)).length;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <PillMenu label="Compare against" value={againstLabel} width={264}>
        {(close) => (
          <>
            <MenuHeading>Compare against</MenuHeading>
            <MenuRow
              label="All subjects"
              selected={against === "whole"}
              onClick={() => { onAgainst("whole"); close(); }}
            />
            <MenuRow
              label="Selected subjects"
              selected={against === "selected"}
              onClick={() => { onAgainst("selected"); close(); setPickerOpen(true); }}
            />
            {against === "selected" && (
              <MenuRow
                label={`Edit selection (${nSelected} of ${pickerItems.length})…`}
                indented
                onClick={() => { close(); setPickerOpen(true); }}
              />
            )}
          </>
        )}
      </PillMenu>

      {pickerOpen && (
        <TeacherModal
          label="Compare against selected subjects"
          backdropLabel="Close subject selection"
          onClose={() => setPickerOpen(false)}
          initialFocusRef={closeRef}
          size="compact"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold">Compare against selected subjects</h2>
              <p className="mt-1 text-xs text-[var(--muted2)]">
                {family ? `${family.label} subjects at your school. ` : ""}Changes apply as you tick.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label="Close subject selection"
              title="Close"
              className={`shrink-0 ${MODAL_CLOSE_BUTTON_CLASS}`}
            >
              <ExpandIcon expanded />
            </button>
          </div>
          <div className="mt-2">
            <CategorySubjectPicker
              families={family ? [family] : []}
              items={pickerItems}
              ticked={selected}
              onToggle={onToggleSelected}
              onSetTicked={onSetSelected}
              theme={theme}
              tabs={false}
              showAllToggle
              defaultExpanded={focusCategory ? [focusCategory] : []}
            />
          </div>
        </TeacherModal>
      )}
    </div>
  );
}
