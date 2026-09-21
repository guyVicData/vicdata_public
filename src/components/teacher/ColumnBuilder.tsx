"use client";

// Teacher view, Phase 4: "expand to a focused view -- and build it up" (design brief v2 §7).
//
// §7 is explicit that this is not a display toggle: "it's a real builder: a scrollable,
// tick-to-add/remove list (the same gesture as the subject picker -- radical consistency,
// §14) of the views available for that column, which get pinned onto the dashboard and
// accumulate into something the person actually built."
//
// Three things follow from that wording and are load-bearing here:
//   - the tick row is deliberately the SAME markup as SubjectPicker's, not a lookalike;
//   - pinned views accumulate on the card itself, they are not a separate screen;
//   - a per-column reset "wipes it back to the single default view", so reset clears the
//     pins rather than restoring some remembered earlier set.
//
// Saved state is a hard requirement in §7, not optional, so every tick round-trips to
// teacher_view_preferences immediately -- there is no explicit save.
import { useMemo, useState, type ReactNode } from "react";
import { availableViews, computeView, isAxisView, comparabilityKey, COLUMN_MEASURE, AXES, type ColumnId, type SubjectRef, type ViewDef } from "@/lib/teacher-view-catalogue";
import { colourByGroup } from "@/lib/teacher-view-theme";
import type { AcademicSubjectHeadlineEntry } from "@/lib/academic-data-view";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { ViewChart } from "./ViewChart";
import { TickList } from "./TickList";
import { CardBox } from "./CardBox";

export function ColumnBuilder({
  columnId,
  phase,
  ticked,
  allSubjects,
  headline,
  pinned,
  onChange,
  chosenFor,
  onChosenChange,
  renderSpecial,
}: {
  columnId: ColumnId;
  phase: TeacherPhase;
  ticked: SubjectRef[];
  allSubjects: SubjectRef[];
  headline: AcademicSubjectHeadlineEntry[];
  pinned: string[];
  onChange: (next: string[]) => void;
  // Axis 4 ("vs subjects I choose") is the one axis that needs a second input. It used to
  // be local state here, so a pinned "Vs. your comparison set" box came back empty after
  // every reload, and two such boxes in one column shared one choice. Now it is saved per
  // pinned view, alongside the pins themselves (see the dashboard's setChosen).
  chosenFor: (viewId: string) => string[];
  onChosenChange: (viewId: string, keys: string[]) => void;
  // Round 5's non-axis views (Candidates' "% of year group", Rankings' comparator sets)
  // are drawn from data the dashboard holds rather than from the subject headline, so it
  // renders them.
  renderSpecial?: (view: ViewDef, fullscreen: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const views = useMemo(() => availableViews(columnId, phase, ticked, headline), [columnId, phase, ticked, headline]);
  const measure = COLUMN_MEASURE[columnId];
  const pinnedViews = useMemo(() => views.filter((v) => pinned.includes(v.id)), [views, pinned]);
  const needsChoice = useMemo(() => new Set(AXES.filter((a) => a.needsChoice).map((a) => a.id)), []);

  // §7's topic gate: a column with nothing on offer has no builder at all. Includes every
  // subject-scoped column at KS2, where there is no subject picker -- offering "Expand"
  // there only led to "Tick a subject first", which a KS2 user has no way to do.
  if (views.length === 0 && (phase === "ks2" || (!measure && columnId !== "rankings"))) return null;

  const toggle = (id: string) => onChange(pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id]);

  // A view about one subject takes that subject's qualification-group colour -- the same
  // colourByGroup the dashboard's chips, bars and scores use -- so a checked view reads as
  // belonging to the subject it is about. Views that are not about one subject (Rankings'
  // sets, the whole-cohort share) take the list's phase accent.
  const groupColour = colourByGroup(phase, ticked);
  const viewColour = (v: ViewDef): string | undefined => {
    const s = ticked.find((t) => t.key === v.subjectKey);
    return s ? groupColour.get(comparabilityKey(phase, s.qualificationType)) : undefined;
  };

  return (
    <div>
      {/* Round 5: each pinned view is its own box, titled by its catalogue shortTitle --
          two pinned views are two boxes with two titles, never one merged figure. The
          subject goes in the subtitle because the short title is per axis: pinning the
          same comparison for two subjects must still leave the boxes distinguishable. */}
      {pinnedViews.map((v) => {
        const chosen = chosenFor(v.id);
        return (
          <CardBox
            key={v.id}
            title={v.shortTitle}
            subtitle={v.subjectLabel ? `${v.subjectLabel} · ${v.sublabel}` : v.sublabel}
            question={v.label}
            actions={
              <button
                type="button"
                onClick={() => toggle(v.id)}
                className="text-[11px] text-neutral-500 hover:underline"
                aria-label={`Remove ${v.label}`}
              >
                Remove
              </button>
            }
          >
            {({ fullscreen }) => (
              <>
                {/* The chooser is an editing control, not part of the figure, so it stays
                    on the card rather than being projected. */}
                {!fullscreen && isAxisView(v) && needsChoice.has(v.axis) && (
                  <div className="mt-2 print:hidden">
                    <TickList
                      items={allSubjects.map((x) => ({ key: x.key, label: x.label }))}
                      checked={(k) => chosen.includes(k)}
                      onToggle={(k) => onChosenChange(v.id, chosen.includes(k) ? chosen.filter((c) => c !== k) : [...chosen, k])}
                      maxHeightClass="max-h-32"
                    />
                  </div>
                )}
                {isAxisView(v) && measure ? (
                  <ViewChart computed={computeView(v, phase, ticked, allSubjects, headline, chosen)} unit={measure.unit} />
                ) : (
                  renderSpecial?.(v, fullscreen)
                )}
              </>
            )}
          </CardBox>
        );
      })}

      <div className="mt-3 flex items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-xs font-bold text-[var(--accent,#2563eb)] hover:underline"
        >
          {open ? "Done" : pinnedViews.length ? `Add a view (${pinnedViews.length} pinned)` : "Expand"}
        </button>
        {pinnedViews.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-neutral-500 hover:underline">
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 print:hidden">
          {views.length === 0 ? (
            <p className="px-1 py-2 text-xs text-neutral-500">
              {ticked.length === 0
                ? "Tick a subject first -- the views on offer follow from what you teach."
                : "No comparable views for this subject yet."}
            </p>
          ) : (
            // §14: literally the same component as the subject picker, not a lookalike.
            <TickList
              items={views.map((v) => ({ key: v.id, label: v.label, sublabel: v.sublabel, color: viewColour(v) }))}
              checked={(k) => pinned.includes(k)}
              onToggle={toggle}
            />
          )}
        </div>
      )}
    </div>
  );
}
