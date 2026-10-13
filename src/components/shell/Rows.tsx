"use client";

// 0.8 shell (Part A): the page and its rows, as Admissions draws them (and SMT after it):
//
//   ShellPage   the page's frame: 1440 wide, padded on a desktop; flush on a phone.
//   ShellRow    one row: its head (RowHead: a chevron that collapses the row, the row's name and
//               context), anything right-aligned beside it, then a three-column grid of panels.
//               Column 1 is one panel; the large view is a RailPanel with span 2 (columns 2-3).
//   PhoneStack  a phone: column 1, then the large view with its views as tabs, then the rows'
//               panels as tabs of one panel -- each a RailPanel sized to its content.
//
// Teacher's three columns are DashboardGrid + DashboardColumn, beside these.
// Moved here from src/components/admissions (AdmissionsDashboard.tsx, controls.tsx).
import type { ReactNode, Ref } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function ShellPage({ phone, rootRef, children }: { phone: boolean; rootRef?: Ref<HTMLDivElement>; children: ReactNode }) {
  return (
    <div ref={rootRef} className={cx("mx-auto flex w-full max-w-[1440px] flex-col", phone ? "gap-0" : "gap-[14px] px-7 py-5")}>
      {children}
    </div>
  );
}

export function RowHead({ title, context, open, onToggle }: { title: string; context: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 px-[2px] py-1 text-left text-[12.5px] font-bold text-[var(--fg)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ transform: open ? undefined : "rotate(-90deg)" }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {title} <span className="text-[11px] font-medium text-[var(--muted2)]">&middot; {context}</span>
    </button>
  );
}

export function ShellRow({ title, context, open, onToggle, actions, children }: { title: string; context: string; open: boolean; onToggle: () => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-3">
        <RowHead title={title} context={context} open={open} onToggle={onToggle} />
        <span className="grow" />
        {actions}
      </div>
      {open && <div className="grid grid-cols-3 gap-6">{children}</div>}
    </div>
  );
}

export function PhoneStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[10px] px-4 py-3">{children}</div>;
}
