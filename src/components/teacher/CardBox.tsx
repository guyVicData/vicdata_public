"use client";

// Teacher view, round 5: one box per view inside a column, titled by that view's short
// title, with a fullscreen that is a real floating modal.
//
// Why not FullscreenChartModal. It already takes arbitrary children, so it could host the
// Rankings map -- but it is an opaque full-viewport sheet (bg-white, inset-0, no backdrop),
// so the dashboard disappears behind it and there is nothing to click to dismiss. Changing
// that component would change the advanced dashboard's fullscreen too, which this round
// does not ask for. So Teacher view gets its own, deliberately small version.
//
// Three things are load-bearing:
//   - The modal renders INSIDE this box rather than through a portal to <body>. Teacher
//     view's theme is an attribute on #teacher-root, not on <html> (Q15), so a portal
//     would escape it and always render in the system theme.
//   - The box's own content keeps rendering underneath while the modal is open. That is
//     what makes it a modal rather than a layout swap: close it and nothing reflows.
//   - z-[1500], the same layer FullscreenChartModal uses, because Leaflet's own panes and
//     controls go up to 1000 and the map card underneath must not show through.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ExpandIcon, MODAL_CLOSE_BUTTON_CLASS, TeacherModal } from "./TeacherModal";

// Lets the dashboard know when any box -- a column's default box or a pinned one deep in
// ColumnBuilder -- is fullscreen, without threading a callback through every level. The
// dashboard uses it to hide its column dividers, as the mockup does. Defaults to a no-op,
// so a CardBox outside the dashboard is unaffected.
export const FullscreenReport = createContext<(open: boolean) => void>(() => {});

export function CardBox({
  title,
  subtitle,
  question,
  tag,
  actions,
  trailingActions,
  controls,
  caption,
  source,
  children,
}: {
  title: string;
  subtitle?: string;
  // The full natural-language question, shown as the modal's heading: a projected
  // fullscreen box has room for the sentence, and §14 wants the real question wherever
  // there is space for it.
  question?: string;
  // Round 6: a panel's own heading, which replaces the plain muted title a pinned view
  // uses. `title` still names the box for its fullscreen button, its modal and every aria
  // label, so the two can never describe different things. Optional, so every round-5
  // caller is untouched.
  //
  // Round 7 §2 dropped the tinted pill this used to sit in: on the real dashboard it read
  // as a button, which it never was. Plain text, a little larger, so losing the pill does
  // not read as a demotion.
  tag?: ReactNode;
  // The panel's VIEW-CHOICE icons (bar/table/donut/map/…). Round 7 §3 moved these out of
  // the top-right corner, which was carrying up to four icons, onto their own row under
  // the heading -- leaving exactly two in the corner. They choose how to draw the figure,
  // so they belong beside the figure; fullscreen and remove act on the panel itself.
  actions?: ReactNode;
  // The one icon that belongs AFTER the fullscreen button: remove. Two icons, top-right,
  // on every panel (round 7 §3).
  trailingActions?: ReactNode;
  // A full-width control row under the header, above the content: the panels' subject
  // chips and their From:/Since:/Trend-line pills. Not part of the figure, so -- like the
  // comparison-set chooser already here -- it is dropped when the box is projected.
  controls?: ReactNode;
  // The mockups' two closing lines under every box's content: a one-line explanation
  // (11.5px, --muted2) and a source line (9.5px, --source). Optional because a pinned
  // axis view carries its own framing in its subtitle.
  caption?: ReactNode;
  source?: ReactNode;
  // Called twice while fullscreen is open -- once for the box underneath, once for the
  // modal -- so it must be safe to mount two copies (the map is: each instance owns its
  // own Leaflet map).
  children: (mode: { fullscreen: boolean }) => ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const report = useContext(FullscreenReport);

  useEffect(() => {
    if (!fullscreen) return;
    report(true);
    return () => report(false);
  }, [fullscreen, report]);

  // Escape, backdrop click, scroll lock and focus live in TeacherModal, shared with the
  // dashboard's subject picker.

  const header = (isModal: boolean) => (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        {tag && !isModal ? (
          // The pill carries the title visually; the heading itself stays in the tree for
          // screen readers rather than being replaced by a decorative span.
          <h3 className="sr-only">{title}</h3>
        ) : (
          <h3 className={isModal ? "text-base font-bold" : "text-[11.5px] font-bold text-[var(--muted2)]"}>{title}</h3>
        )}
        {tag && !isModal && tag}
        {isModal && question && <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{question}</p>}
        {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 print:hidden">
        <button
          ref={isModal ? closeRef : undefined}
          type="button"
          onClick={() => setFullscreen(!isModal)}
          aria-label={isModal ? `Exit full screen: ${title}` : `Full screen: ${title}`}
          title={isModal ? "Exit full screen" : "Full screen"}
          // Mockup: muted3 at rest; the exit icon sits on a faint accent tint in the accent
          // colour. --accent is set per phase on #teacher-root; KS2 has none and falls back.
          className={
            isModal
              ? MODAL_CLOSE_BUTTON_CLASS
              : "flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted3)] hover:text-[var(--fg)]"
          }
        >
          <ExpandIcon expanded={isModal} />
        </button>
        {!isModal && trailingActions}
      </div>
    </div>
  );

  const footer = (
    <>
      {caption && <p className="text-[11.5px] text-[var(--muted2)]">{caption}</p>}
      {source && <p className="text-[9.5px] text-[var(--source)]">{source}</p>}
    </>
  );

  return (
    // Mockup box: radius 10px, 1px --panel-border, --box-bg, 12px padding, 10px gap.
    <div className="mt-3 flex flex-col gap-2.5 rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] p-3">
      {header(false)}
      {/* Round 7 §3: the view-choice icons, top-left under the heading. */}
      {actions && <div className="-mt-1 flex items-center gap-0.5 print:hidden">{actions}</div>}
      {controls && <div className="print:hidden">{controls}</div>}
      <div>{children({ fullscreen: false })}</div>
      {footer}

      {fullscreen && (
        <TeacherModal label={`${title}, full screen`} backdropLabel="Close full screen" onClose={() => setFullscreen(false)} initialFocusRef={closeRef}>
          {header(true)}
          <div className="mt-1 min-h-0 flex-1">{children({ fullscreen: true })}</div>
          {footer}
        </TeacherModal>
      )}
    </div>
  );
}
