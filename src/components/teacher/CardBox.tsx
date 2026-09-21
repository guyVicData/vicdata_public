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
import { useEffect, useRef, useState, type ReactNode } from "react";

function ExpandIcon({ expanded }: { expanded: boolean }) {
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

export function CardBox({
  title,
  subtitle,
  question,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  // The full natural-language question, shown as the modal's heading: a projected
  // fullscreen box has room for the sentence, and §14 wants the real question wherever
  // there is space for it.
  question?: string;
  actions?: ReactNode;
  // Called twice while fullscreen is open -- once for the box underneath, once for the
  // modal -- so it must be safe to mount two copies (the map is: each instance owns its
  // own Leaflet map).
  children: (mode: { fullscreen: boolean }) => ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!fullscreen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    // The page behind a modal should not scroll under the wheel; the modal panel scrolls
    // itself instead.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  const header = (isModal: boolean) => (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className={isModal ? "text-base font-semibold" : "text-xs font-semibold"}>{title}</h3>
        {isModal && question && <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{question}</p>}
        {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 print:hidden">
        {!isModal && actions}
        <button
          ref={isModal ? closeRef : undefined}
          type="button"
          onClick={() => setFullscreen(!isModal)}
          aria-label={isModal ? `Exit full screen: ${title}` : `Full screen: ${title}`}
          title={isModal ? "Exit full screen" : "Full screen"}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <ExpandIcon expanded={isModal} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      {header(false)}
      {children({ fullscreen: false })}

      {fullscreen && (
        <div className="fixed inset-0 z-[1500] print:hidden" role="dialog" aria-modal="true" aria-label={`${title}, full screen`}>
          {/* The backdrop is a real button so clicking it is an ordinary, keyboard-
              reachable dismissal rather than a click handler on a div. */}
          <button
            type="button"
            aria-label="Close full screen"
            tabIndex={-1}
            onClick={() => setFullscreen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-neutral-900/40 backdrop-blur-sm dark:bg-black/60"
          />
          {/* ~5% margin on desktop, 3% on a phone, per the round 5 brief. */}
          <div className="absolute inset-[3%] flex flex-col overflow-auto rounded-lg border border-neutral-200 bg-white p-4 text-neutral-900 shadow-2xl sm:inset-[5%] sm:p-6 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
            {header(true)}
            <div className="mt-3 min-h-0 flex-1">{children({ fullscreen: true })}</div>
          </div>
        </div>
      )}
    </div>
  );
}
