"use client";

// Teacher view's one modal shell, shared by CardBox's fullscreen and the dashboard's
// subject picker so there is a single modal behaviour rather than two lookalikes:
//   - a dimmed, blurred backdrop over the page that is a real <button>, so clicking it
//     is an ordinary, keyboard-reachable dismissal rather than a click handler on a div;
//   - Escape closes;
//   - the page behind does not scroll under the wheel (the panel scrolls itself);
//   - focus moves to the given control (the panel's close button) on open;
//   - a floating panel at ~5% margin on desktop, 3% on a phone (round 5 brief).
//
// The caller renders it only while open (`{open && <TeacherModal … />}`), and renders it
// INSIDE #teacher-root rather than through a portal: Teacher view's theme is an attribute
// on that element (Q15), so a portal to <body> would escape it. z-[1500] clears Leaflet's
// panes and controls (up to 1000).
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// The expand/exit-full-screen glyph. `expanded` draws the exit form, which is also the
// modal's close control.
export function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {expanded ? (
        <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// The close control's look inside a modal (mockup: the exit icon on a faint accent tint,
// in the accent colour; --accent is set per phase on #teacher-root, KS2 falls back).
export const MODAL_CLOSE_BUTTON_CLASS =
  "flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(var(--accent-rgb,96,165,250),0.12)] text-[var(--accent,var(--muted2))]";

export function TeacherModal({
  label,
  backdropLabel,
  onClose,
  initialFocusRef,
  children,
}: {
  label: string;
  backdropLabel: string;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  // Held in a ref so a caller passing a fresh arrow each render does not re-run the
  // open effect (re-focusing and re-binding on every render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    initialFocusRef?.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // Mount/unmount only: the caller mounts this exactly while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[1500] print:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label={backdropLabel}
        tabIndex={-1}
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 h-full w-full cursor-default bg-neutral-900/40 backdrop-blur-sm dark:bg-black/60"
      />
      <div className="absolute inset-[3%] flex flex-col gap-2.5 overflow-auto rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-[var(--fg)] shadow-2xl sm:inset-[5%] sm:p-6">
        {children}
      </div>
    </div>
  );
}
