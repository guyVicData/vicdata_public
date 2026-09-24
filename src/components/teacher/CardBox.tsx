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
import { SourceNote } from "./PanelFooter";

// Lets the dashboard know when any box -- a column's default box or a pinned one deep in
// ColumnBuilder -- is fullscreen, without threading a callback through every level. The
// dashboard uses it to hide its column dividers, as the mockup does. Defaults to a no-op,
// so a CardBox outside the dashboard is unaffected.
export const FullscreenReport = createContext<(open: boolean) => void>(() => {});

// Round 8 §2/§7: every panel is this tall, so the three columns line up as a real 3x3 grid.
//
// Computed from the REAL grid rather than copied from the wireframe, which §7 asks for
// explicitly. At the 1280px cap: 1280 - 48 page padding = 1232 content; minus 4 gaps of
// 18px and two 2px dividers leaves 1156 across three tracks, so a column track is 385px.
// The wireframe's proportion is 260px tall at 394px wide, so 260 x 385/394 = 254px, rounded
// to the nearest 8px step.
//
// Deliberately scaled against the COLUMN track, which is the brief's own wording ("260px at
// its own 394px column width"). Scaling against the panel's inner width instead -- 353px
// once DashboardColumn's padding is taken off -- would give 233px, and the wireframe's own
// 394 is ambiguous between the two, since its panel and its column head are both 394. The
// taller reading leaves a usable chart area; flagged in the build report as the judgement
// §7 asked to have made explicitly rather than silently.
export const PANEL_HEIGHT = 256;

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
  footerActions,
  fixedHeight = false,
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
  // the top-right corner, which was carrying up to four icons; round 8 §4 moves them again,
  // from a horizontal row under the heading to a vertical RAIL down the left of the
  // content, with a divider between the two. They choose how to draw the figure, so they
  // belong beside the figure; fullscreen and remove act on the panel itself.
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
  // Round 8 §4: the footer's own controls -- the private note and Export -- beside the
  // source icon, all pinned to the panel's real bottom edge. Given `print`, so Export can
  // drive this box's own fullscreen-and-print without reaching into it.
  footerActions?: (tools: { print: () => void }) => ReactNode;
  // Round 8 §2: every panel is the same height, so the three columns read as a true 3x3
  // grid rather than three ragged stacks. Absent = size to content, which is what the KS2
  // boxes and any non-panel caller still want.
  fixedHeight?: boolean;
  // Called twice while fullscreen is open -- once for the box underneath, once for the
  // modal -- so it must be safe to mount two copies (the map is: each instance owns its
  // own Leaflet map).
  children: (mode: { fullscreen: boolean }) => ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  // Round 8 §5: a panel print is the same fullscreen modal, opened for the print and
  // marked as the one subtree to paint. Tracked separately from `fullscreen` so closing
  // the print does not leave an ordinary fullscreen open behind it.
  const [printing, setPrinting] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const report = useContext(FullscreenReport);

  // Open the modal, let it paint, print, then put everything back. afterprint is the only
  // honest signal for "the dialog has gone" -- there is no promise to await.
  const printPanel = () => {
    setPrinting(true);
    setFullscreen(true);
    const root = document.getElementById("teacher-root");
    root?.setAttribute("data-print-panel", "");
    const done = () => {
      root?.removeAttribute("data-print-panel");
      setPrinting(false);
      setFullscreen(false);
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    // Two frames: one for the modal to mount, one for it to lay out before the print
    // dialog snapshots the page.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

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

  // Round 8 §4: one footer row, pinned to the panel's own bottom edge by absolute
  // positioning rather than pushed there by flex order -- so a short chart and a long one
  // put their source, note and Export in exactly the same place. The panel reserves the
  // room for it in its own bottom padding.
  const footerRow = (
    <div
      className={[
        fixedHeight ? "absolute inset-x-3 bottom-2.5" : "",
        "flex items-center gap-1.5 print:hidden",
      ].join(" ")}
    >
      {/* §4: the citation is an icon that opens its own text, not a printed sentence. */}
      <SourceNote>{source}</SourceNote>
      {footerActions?.({ print: printPanel })}
    </div>
  );

  // The caption is the panel's one-line conclusion and still reads as text above the
  // footer; only the citation moved into the row (§4).
  const captionLine = caption ? <p className="text-[11.5px] leading-snug text-[var(--muted2)]">{caption}</p> : null;

  return (
    // Mockup box: radius 10px, 1px --panel-border, --box-bg, 12px padding, 10px gap.
    // Fixed-height panels add bottom padding to reserve the footer's row and go
    // `relative` so it can be pinned there.
    <div
      className={[
        "mt-3 flex flex-col gap-2 rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] p-3",
        fixedHeight ? "relative overflow-hidden pb-9" : "",
      ].join(" ")}
      // PANEL_HEIGHT is computed from the real grid, not copied from the wireframe -- see
      // its own note.
      style={fixedHeight ? { height: PANEL_HEIGHT } : undefined}
    >
      {header(false)}
      {controls && <div className="shrink-0 print:hidden">{controls}</div>}
      {/* Round 8 §4: the view rail runs down the left of the content, divided from it, and
          both stretch to fill whatever height the fixed panel leaves them. */}
      <div className={fixedHeight ? "flex min-h-0 flex-grow items-stretch gap-0" : ""}>
        {actions && (
          <div className="mr-2.5 flex shrink-0 flex-col gap-[3px] border-r border-[var(--panel-border)] pr-2.5 print:hidden">
            {actions}
          </div>
        )}
        <div className={fixedHeight ? "flex min-w-0 flex-grow flex-col" : "min-w-0 flex-grow"}>
          {children({ fullscreen: false })}
        </div>
      </div>
      {captionLine}
      {footerRow}

      {fullscreen && (
        <TeacherModal
          label={`${title}, full screen`}
          backdropLabel="Close full screen"
          onClose={() => setFullscreen(false)}
          initialFocusRef={closeRef}
          printable={printing}
        >
          {header(true)}
          <div className="mt-1 flex min-h-0 flex-1 items-stretch">
            {actions && (
              <div className="mr-3 flex shrink-0 flex-col gap-1 border-r border-[var(--panel-border)] pr-3 print:hidden">{actions}</div>
            )}
            <div className="flex min-w-0 flex-grow flex-col">{children({ fullscreen: true })}</div>
          </div>
          {captionLine}
          {/* Printed with the panel: a figure on its own page needs its citation ON the
              page, which is exactly where a popover would be no use. */}
          <p className="hidden text-[9.5px] text-[var(--source)] print:block">{source}</p>
          <div className="flex items-center gap-1.5 print:hidden">
            <SourceNote>{source}</SourceNote>
            {footerActions?.({ print: printPanel })}
          </div>
        </TeacherModal>
      )}
    </div>
  );
}
