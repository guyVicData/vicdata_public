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
//
// 2026-09-14, subject-category colour round: each pill now fills with its OWN
// subject-family colour when active (subject-family-colours.ts, new site-wide
// palette per Guy's direct instruction -- "apply to all subject category
// selectors"), not a generic neutral black/white active state. Same real mechanism
// FilterBar.tsx's own Pill already uses for TAG_COLOURS -- inline style sets the
// light-mode fill directly plus two GENERIC CSS custom properties
// (--category-pill-bg-dark/-fg-dark); because a CSS custom property set inline is
// scoped to that one button element (and its children) via normal cascade, each
// pill's own dark-mode override resolves independently even though the CSS rule
// text itself (below) is written once, generically -- exact same trick
// FilterBar.tsx's own --pill-bg-dark/-fg-dark already relies on, not something new
// invented here. "Whole school" keeps the original neutral black/white active fill
// -- it isn't a subject category, it's the absence of one, so it has no real colour
// of its own to take on.
import { subjectFamilyColour } from "@/lib/subject-family-colours";
import { contrastingTextColour } from "@/lib/tag-colours";

function CategoryPill({ active, familyId, onClick, children }: { active: boolean; familyId: string | null; onClick: () => void; children: React.ReactNode }) {
  if (familyId === null) {
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
  const { light, dark } = subjectFamilyColour(familyId);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "category-pill-active inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
          : "inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }
      style={
        active
          ? ({
              "--category-pill-bg-dark": dark[0],
              "--category-pill-fg-dark": contrastingTextColour(dark[0]),
              backgroundColor: light[1],
              borderColor: light[1],
              color: contrastingTextColour(light[1]),
            } as React.CSSProperties)
          : undefined
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
      {/* Dark-mode override for whichever category pill is currently active -- same
          "an inline style can set the light-mode fill directly, but dark mode needs
          a CSS rule" split FilterBar.tsx's own filter-pill-active class already
          uses (MapFilterPanel.tsx carries that rule). Written generically against
          the CSS custom properties the active pill itself sets above, so this one
          block covers whichever family is active without per-family rules. */}
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .category-pill-active {
            background-color: var(--category-pill-bg-dark) !important;
            border-color: var(--category-pill-bg-dark) !important;
            color: var(--category-pill-fg-dark) !important;
          }
        }
        :root[data-theme="dark"] .category-pill-active {
          background-color: var(--category-pill-bg-dark) !important;
          border-color: var(--category-pill-bg-dark) !important;
          color: var(--category-pill-fg-dark) !important;
        }
      `}</style>
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</span>
      <CategoryPill active={activeFamilyId === null} familyId={null} onClick={() => onChange(null)}>
        Whole school
      </CategoryPill>
      {families.map((f) => (
        <CategoryPill key={f.familyId} active={activeFamilyId === f.familyId} familyId={f.familyId} onClick={() => onChange(f.familyId)}>
          {f.familyLabel}
        </CategoryPill>
      ))}
    </div>
  );
}
