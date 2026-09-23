"use client";

// Teacher view dashboard: one of the four question cards, in the mockups' anatomy
// (docs/vicdata_phase3_teacher_view_design_reference_v1.md):
//   - a card (radius 14px, --panel-border, --panel-bg) topped with a 3px bar in the
//     phase accent -- the mockups put the bar on this outer card, not on each inner box;
//   - a header of a 39px rounded square tinted rgba(accent, 0.14) holding the card's own
//     icon in the accent colour, beside the natural-language question;
//   - then the boxes (CardBox) and the builder underneath.
//
// The accent comes in as --accent / --accent-rgb on #teacher-root, so this one component
// serves both phases. KS2 sets neither (its design is different and untouched), so its
// cards render without bar or tint.
import type { ReactNode } from "react";
import type { ColumnId } from "@/lib/teacher-view-catalogue";

// Exported so onboarding step 4 shows the very same icons rather than redrawn copies.
export const COLUMN_ICON_PATHS: Record<ColumnId, ReactNode> = {
  candidates: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  results: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  context: (
    <>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
  rankings: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </>
  ),
};

export function DashboardColumn({
  columnId,
  title,
  question,
  accented,
  badge,
  action,
  children,
}: {
  columnId: ColumnId;
  // Round 7 §1: the wireframe's single-line header -- icon, title and subtitle on the
  // left, the Add button on the right, one row -- but keeping the built dashboard's own
  // per-column icon rather than dropping it for the wireframe's plainer treatment.
  title: string;
  // The natural-language question, now the header's subtitle rather than its heading.
  // §14 wants the real question wherever there is room for it; this keeps it, and gives
  // the card the short name it also needs.
  question: string;
  accented: boolean;
  badge?: ReactNode;
  // The column's "+ Add" control. Rendered here so the header is genuinely one row --
  // it belongs to the panel mechanism, so the page passes it down rather than this
  // component knowing anything about panels.
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)]">
      {accented && <div className="h-[3px] bg-[var(--accent)]" />}
      <div className="flex flex-col p-4">
        <div className="flex items-center gap-2.5">
          {accented && (
            <div className="flex h-[39px] w-[39px] shrink-0 items-center justify-center rounded-lg bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent)]">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {COLUMN_ICON_PATHS[columnId]}
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-grow">
            <h2 className="text-[15px] font-bold leading-tight">
              {title}
              {badge}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">{question}</p>
          </div>
          {action && <div className="shrink-0 print:hidden">{action}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
