"use client";

// Teacher view, round 6: the one dropdown the panel mechanism uses.
//
// Round 6 adds six of them -- Add, Results' measure switcher, Context's combined
// compare-against+measure picker, Comparisons' two pills and its "vs:" selector -- and
// §14's "pixel-identical position, icon and colour language everywhere a pattern appears"
// only survives if they are one component rather than six lookalikes that drift a padding
// value apart.
//
// Deliberately NOT TeacherModal: these are small popovers anchored to the control that
// opened them, not modal sheets. What they DO share with it is the dismissal contract --
// Escape closes, a click outside closes, focus is not trapped -- because a control that
// only closes by clicking itself again is the thing people report as "stuck".
import { useEffect, useRef, type ReactNode } from "react";

export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // Pointerdown rather than click: a click listener fires after the button's own
    // handler has already toggled the menu back open, so the menu never closed.
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose]);
  return ref;
}

// The popover panel itself. `align` follows the wireframe: Add opens from the right edge
// of the card, every measure/compare picker from the left under its own pill.
export function PanelMenu({
  label,
  align = "left",
  width,
  children,
}: {
  label: string;
  align?: "left" | "right";
  width: number;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // max-h + overflow so a long list (Context's subject checklist, Comparisons' named
      // schools) scrolls inside the popover rather than running off the card.
      className={[
        "absolute top-full z-30 mt-1.5 flex max-h-[22rem] flex-col gap-0.5 overflow-y-auto rounded-[14px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.16)]",
        align === "right" ? "right-0" : "left-0",
      ].join(" ")}
      // Width is the wireframe's per-menu figure; capped so it can never be wider than a
      // phone viewport, where the card itself is only a little wider than the menu.
      style={{ width, maxWidth: "min(90vw, 20rem)" }}
    >
      {children}
    </div>
  );
}

export function MenuHeading({ children, indented = false }: { children: ReactNode; indented?: boolean }) {
  return (
    <p
      className={`px-1 pb-0.5 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--muted3)] ${indented ? "pl-3" : ""}`}
    >
      {children}
    </p>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-[var(--panel-border)]" />;
}

// A bordered row with a leading icon -- the Add picker's own shape.
export function MenuCardRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-left hover:border-[var(--fg)] hover:bg-[var(--box-bg)]"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--box-bg)] text-[var(--muted2)]">
        {icon}
      </span>
      <span className="text-[13.5px] font-medium">{label}</span>
    </button>
  );
}

// A plain selectable row, optionally carrying a "Coming soon"-style tag. A disabled row
// is a real disabled button, not a styled div: §4.1 wants the coming-soon measures shown
// and inert, and "looks greyed but still responds to Enter" is the bug that hides in a
// div with an onClick.
export function MenuRow({
  label,
  selected = false,
  disabled = false,
  tag,
  swatch,
  checkbox,
  indented = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  tag?: string;
  swatch?: string;
  checkbox?: boolean;
  indented?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={selected || undefined}
      aria-pressed={checkbox !== undefined ? selected : undefined}
      className={[
        "flex w-full items-center gap-2 rounded-lg px-2 py-[7px] text-left",
        indented ? "pl-3.5" : "",
        selected && checkbox === undefined ? "bg-[var(--box-bg)]" : "",
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-[var(--box-bg)]",
      ].join(" ")}
    >
      {checkbox !== undefined && (
        <span
          aria-hidden="true"
          className={[
            "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded border-[1.5px] text-[10px] leading-none",
            selected ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--panel-border2)]",
          ].join(" ")}
        >
          {selected ? "✓" : ""}
        </span>
      )}
      {swatch && <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: swatch }} />}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>
      {tag && (
        <span className="shrink-0 rounded-full bg-[var(--box-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted3)]">
          {tag}
        </span>
      )}
    </button>
  );
}
