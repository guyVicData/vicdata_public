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
import { useMemo, useState } from "react";
import { availableViews, computeView, COLUMN_MEASURE, AXES, type ColumnId, type SubjectRef } from "@/lib/teacher-view-catalogue";
import type { AcademicSubjectHeadlineEntry } from "@/lib/academic-data-view";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { ViewChart } from "./ViewChart";
import { TickList } from "./TickList";

export function ColumnBuilder({
  columnId,
  phase,
  ticked,
  allSubjects,
  headline,
  pinned,
  onChange,
}: {
  columnId: ColumnId;
  phase: TeacherPhase;
  ticked: SubjectRef[];
  allSubjects: SubjectRef[];
  headline: AcademicSubjectHeadlineEntry[];
  pinned: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  // Axis 4 ("vs subjects I choose") is the one axis that needs a second input. Kept local
  // to the builder rather than persisted: it is a framing of a pinned view, and persisting
  // it would need its own per-view store that §7 does not ask for.
  const [chosen, setChosen] = useState<string[]>([]);

  const views = useMemo(() => availableViews(columnId, phase, ticked, headline), [columnId, phase, ticked, headline]);
  const measure = COLUMN_MEASURE[columnId];
  const pinnedViews = useMemo(() => views.filter((v) => pinned.includes(v.id)), [views, pinned]);
  const needsChoice = useMemo(() => new Set(AXES.filter((a) => a.needsChoice).map((a) => a.id)), []);

  if (!measure) return null; // §7's topic gate: this column has no axis menu at all.

  const toggle = (id: string) => onChange(pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id]);

  return (
    <div className="mt-3">
      {pinnedViews.map((v) => {
        const computed = computeView(v, phase, ticked, allSubjects, headline, chosen);
        return (
          <figure key={v.id} className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-900">
            <figcaption className="flex items-start justify-between gap-2">
              <span>
                <span className="block text-xs font-medium">{v.label}</span>
                <span className="block text-[11px] text-neutral-500">{v.sublabel}</span>
              </span>
              <button
                type="button"
                onClick={() => toggle(v.id)}
                className="shrink-0 text-[11px] text-neutral-500 hover:underline print:hidden"
                aria-label={`Remove ${v.label}`}
              >
                Remove
              </button>
            </figcaption>
            {needsChoice.has(v.axis) && (
              <div className="mt-2 print:hidden">
                <TickList
                  items={allSubjects.map((x) => ({ key: x.key, label: x.label }))}
                  checked={(k) => chosen.includes(k)}
                  onToggle={(k) => setChosen(chosen.includes(k) ? chosen.filter((c) => c !== k) : [...chosen, k])}
                  maxHeightClass="max-h-32"
                />
              </div>
            )}
            <ViewChart computed={computed} unit={measure.unit} />
          </figure>
        );
      })}

      <div className="mt-3 flex items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
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
              items={views.map((v) => ({ key: v.id, label: v.label, sublabel: v.sublabel }))}
              checked={(k) => pinned.includes(k)}
              onToggle={toggle}
            />
          )}
        </div>
      )}
    </div>
  );
}
