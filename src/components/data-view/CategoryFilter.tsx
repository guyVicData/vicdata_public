"use client";

// Round 2, Part B: Category (subject family) drill-down -- same real pill/button
// styling FilterBar.tsx's own Phase pills use (active fill), a self-contained copy
// rather than importing FilterBar's own private `Pill` (that component is styled for
// Rolls' TAG_COLOURS tag keys specifically; this one just needs the same visual shape,
// not the same colour-lookup mechanism).
//
// Stage 1 review fix: this used to take a `hasCaret` prop and render a ▾ next to each
// family pill, implying an expandable next level. Nothing actually expands from the
// pill -- picking a family appends a "Subject/family breakdown" section further down
// the page (Graphs only), with its own separate Subject <select>, not an inline
// drill-down anywhere near the pill itself. Removed rather than kept as a decorative
// truthful-affordance fix.
//
// Graphs edit 2: moved out of AcademicDataView.tsx into its own file, rather than
// exported from there, specifically to avoid a real circular import -- AcademicDataView
// already imports AcademicGraphsView (to render it), and Section 3's own fix needs
// AcademicGraphsView to render THIS component too; a plain export from
// AcademicDataView.tsx would have made the two modules import each other. Both
// AcademicDataView.tsx (Map's own copy, below the map div) and AcademicGraphsView.tsx
// (Section 3, the actual fix this round) import it from here instead -- `familyId`/
// `families` state itself stays owned by AcademicDataView.tsx regardless of which
// view is currently rendering the picker; this file only owns the control's own markup.
function CategoryPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          : "inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }
    >
      {children}
    </button>
  );
}

export default function CategoryFilter({
  families,
  activeFamilyId,
  onChange,
}: {
  families: { familyId: string; familyLabel: string }[];
  activeFamilyId: string | null;
  onChange: (familyId: string | null) => void;
}) {
  if (families.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</span>
      <CategoryPill active={activeFamilyId === null} onClick={() => onChange(null)}>
        Whole school
      </CategoryPill>
      {families.map((f) => (
        <CategoryPill key={f.familyId} active={activeFamilyId === f.familyId} onClick={() => onChange(f.familyId)}>
          {f.familyLabel}
        </CategoryPill>
      ))}
    </div>
  );
}
