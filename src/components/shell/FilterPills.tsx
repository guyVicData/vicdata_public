"use client";

// 0.8 shell (Part A): the control bar's pills and chips, beside ControlBar and PillMenu.
//
//   FChip      a filter pill (8px radius; the accent edge when it isn't at its default), plain
//              or opening a menu -- Admissions' Pupils / Sector / Day + boarding, SMT's Gender
//   MenuChip   an FChip that opens a one-choice menu (PanelMenu)
//   EntryChip  a focus chip in the pill shape, the accent tint when selected (the phone's
//              entry points; the full screen's focus bar)
//
// Moved here from src/components/admissions (ui.tsx, controls.tsx), which re-export them.
import { useState, type ReactNode } from "react";
import { MenuRow, PanelMenu, useDismiss } from "./PanelMenu";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const CHEVRON = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** The boards' .fchip: an 8px-radius filter or set chip, optionally a menu. */
export function FChip({ children, onClick, title: titleIn, chevron = true, active = false, disabled = false }: { children: ReactNode; onClick?: () => void; title?: string; chevron?: boolean; active?: boolean; disabled?: boolean }) {
  const title = titleIn ?? (typeof children === "string" ? children : undefined);
  const cls = cx(
    "inline-flex min-w-0 max-w-[340px] items-center gap-[5px] whitespace-nowrap rounded-[8px] border px-[10px] py-[5px] text-[11.5px] font-semibold [&>span.t]:truncate",
    active ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]",
    "bg-[var(--box-bg)]",
    disabled && "opacity-60",
  );
  const body = (
    <>
      <span className="t min-w-0">{children}</span>
      {chevron && onClick && CHEVRON}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={title} disabled={disabled}>
      {body}
    </button>
  ) : (
    <span className={cls} title={title}>
      {body}
    </span>
  );
}

/** The boards' entry-point .chip (pill, the accent when active). */
export function EntryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "whitespace-nowrap rounded-full border px-3 py-[5px] text-[12px] font-semibold",
        active ? "border-[var(--accent)] bg-[var(--adm-tint)] text-[var(--fg)]" : "border-[var(--panel-border2)] bg-[var(--panel-bg)] text-[var(--chip-fg)]",
      )}
    >
      {label}
    </button>
  );
}

// 0.8 SMT r3: `menuWidth` (optional, 210 as before) for Context's longer "Shade by" options.
export function MenuChip<T extends string>({ value, options, onPick, label, menuWidth = 210 }: { value: T; options: { id: T; label: string; title?: string }[]; onPick: (v: T) => void; label: string; menuWidth?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <span className="relative" ref={ref}>
      <FChip onClick={() => setOpen(!open)} title={label} active={value !== options[0].id}>
        {current.label}
      </FChip>
      {open && (
        <PanelMenu label={label} align="right" width={menuWidth}>
          {options.map((o) => (
            <MenuRow
              key={o.id}
              label={o.label}
              selected={o.id === value}
              title={o.title}
              onClick={() => {
                setOpen(false);
                onPick(o.id);
              }}
            />
          ))}
        </PanelMenu>
      )}
    </span>
  );
}
