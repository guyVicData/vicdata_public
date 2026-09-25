"use client";

// Teacher view, round 8 §§4-6: the three controls that live in every panel's pinned
// footer -- the source citation, the private note, and Export.
//
// All three were previously either a printed sentence taking two lines of the panel
// (the citation), a link under the whole column rather than the panel (the note), or
// page-level only (print). Grouped here so a panel's metadata and its actions sit
// together, out of the way of the figure.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MenuRow, PanelMenu, useDismiss } from "./PanelMenu";

// ---------------------------------------------------------------- source (§4)

// The citation, compacted from a printed sentence to an "i" that opens it (§1: Guy's
// "1 word, pop up"). The text itself is unchanged -- this is the same `source` node
// CardBox has always been given, just no longer printed at 9.5px under every panel.
export function SourceNote({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  if (!children) return null;
  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Where this figure comes from"
        title="Where this figure comes from"
        className="flex h-[17px] w-[17px] items-center justify-center rounded-full border border-[var(--panel-border2)] text-[9.5px] font-bold italic text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
      >
        i
      </button>
      {open && (
        // Opens upward: the footer is pinned to the panel's bottom edge, so a menu
        // dropping down would fall outside the panel entirely.
        <span className="absolute bottom-6 left-0 z-30 block w-[17rem] max-w-[80vw] rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-3 text-[11px] leading-relaxed text-[var(--muted2)] shadow-[0_10px_24px_rgba(0,0,0,0.3)]">
          {children}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------- caption (round 2 §8)

const CaptionIcon = (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 4.5h13v8.5H9l-3.5 3v-3h-2z" />
    <path d="M7 8h6M7 10.5h4" />
  </svg>
);

// The panel's one-line conclusion ("Additional Maths has grown the most…"), moved out of
// the panel body into the footer behind a button, closed by default. A real button rather
// than a hover tooltip: hover does not exist on the phone layout this dashboard also
// serves, and it keeps Escape/click-outside dismissal the same as the "i" beside it.
export function CaptionNote({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  if (!children) return null;
  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="What this shows"
        title="What this shows"
        className={`flex h-[17px] w-[17px] items-center justify-center rounded-[5px] ${open ? "text-[var(--fg)]" : "text-[var(--muted)]"} hover:text-[var(--fg)]`}
      >
        {CaptionIcon}
      </button>
      {open && (
        // Opens upward, like the source note: the footer is pinned to the panel's bottom.
        <span className="absolute bottom-6 left-0 z-30 block w-[18rem] max-w-[80vw] rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-2 shadow-[0_10px_24px_rgba(0,0,0,0.3)]">
          {children}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ note (§6)

const NoteIcon = (
  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13.5 3.5 16.5 6.5 7 16H4v-3z" />
    <path d="M11.5 5.5 14.5 8.5" />
  </svg>
);

// One note per person per panel, private to its author. The persistence is the REAL,
// already-shipped teacher_view_notes table (round 8's brief believed no note mechanism
// existed; it has been live since the original Teacher-view persistence migration, with
// RLS of profile_id = auth.uid()). The only change this round needs is the key: it was
// one note per CARD, and a panel is finer than a card.
export function PanelNote({
  body,
  onSave,
  disabled = false,
}: {
  body: string | null;
  onSave: (next: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(body ?? "");
  const ref = useDismiss(open, () => setOpen(false));
  const area = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) area.current?.focus();
  }, [open]);

  // The draft is seeded when the note is OPENED rather than synced by an effect: the
  // note may still be loading on first paint, and an effect that reassigns the draft
  // whenever `body` changes would overwrite whatever was half-typed at the moment the
  // fetch came back.
  const openNote = () => {
    if (!open) setDraft(body ?? "");
    setOpen(!open);
  };

  const has = (body ?? "").trim().length > 0;

  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={openNote}
        aria-expanded={open}
        aria-label={has ? "Your private note" : "Add a private note"}
        title={has ? "Your private note" : "Add a private note"}
        className={[
          "flex h-[17px] w-[17px] items-center justify-center rounded-[5px]",
          has ? "text-[var(--accent,var(--fg))]" : "text-[var(--muted)]",
          disabled ? "cursor-not-allowed opacity-40" : "hover:text-[var(--fg)]",
        ].join(" ")}
      >
        {NoteIcon}
      </button>
      {open && (
        <span className="absolute bottom-6 left-0 z-30 block w-[18rem] max-w-[80vw] rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.3)]">
          <textarea
            ref={area}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Only you can see this."
            className="w-full resize-none rounded-md border border-[var(--panel-border)] bg-transparent p-2 text-[12px] text-[var(--fg)]"
          />
          <span className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => { await onSave(draft); setOpen(false); }}
              className="rounded-md bg-[var(--accent,#2563eb)] px-2.5 py-1 text-[11.5px] font-semibold text-[#06120c]"
            >
              Save
            </button>
            <button type="button" onClick={() => { setDraft(body ?? ""); setOpen(false); }} className="text-[11.5px] text-[var(--muted)]">
              Cancel
            </button>
            <span className="ml-auto text-[10px] text-[var(--muted3)]">Private to you</span>
          </span>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- export (§5)

export const ExportIcon = (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" />
    <path d="M3.5 14.5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" />
  </svg>
);

// Three functions, one menu. Only the first does anything: there is no custom-dashboard
// concept in the codebase at all, and Guy's call this round was to leave presentations
// disabled too even though Meetings is in fact built (round 8 §1's claim that it is not
// turned out to be wrong -- see the build report). Both are SHOWN and visibly disabled,
// the house pattern round 6 §5 set for the greyed Grade-bands/counts measures: absence
// reads as a known gap rather than an omission nobody noticed.
export function PanelExport({ onPrint }: { onPrint: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Export this panel"
        title="Export"
        className="flex h-[17px] w-[17px] items-center justify-center rounded-[5px] text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {ExportIcon}
      </button>
      {open && (
        <span className="absolute bottom-6 left-0 z-30 block">
          <PanelMenu label="Export" width={212}>
            <MenuRow label="Print this graph" onClick={() => { setOpen(false); onPrint(); }} />
            <MenuRow label="Copy to custom dashboard" tag="Coming soon" disabled onClick={() => {}} />
            <MenuRow label="Copy to a presentation" tag="Coming soon" disabled onClick={() => {}} />
          </PanelMenu>
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------- trend line (content round S12)

// Trend's "Trend line" toggle, moved from the top of the panel into its footer, just
// before the "i". Sized to sit in that row beside the 17px footer icons, rather than as
// the full pill it was.
//
// Trend redesign step 3: `disabled` whenever the chart has no line to fit -- bars (under
// TREND_LINE_MIN_YEARS real years), a list, or a table. The bars form never drew a fit, so
// the toggle used to click and do nothing; now it is visibly off and says why.
export function TrendLineToggle({ on, onToggle, disabled = false }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on && !disabled}
      disabled={disabled}
      title={disabled ? "A trend line needs at least four published years drawn as a line" : undefined}
      className={[
        "h-[17px] shrink-0 rounded-full border px-1.5 text-[10px] font-semibold leading-none",
        disabled
          ? "cursor-not-allowed border-[var(--panel-border)] text-[var(--muted3)] opacity-60"
          : on
            ? "border-[var(--accent,var(--fg))] text-[var(--accent,var(--fg))]"
            : "border-[var(--panel-border2)] text-[var(--muted)] hover:text-[var(--fg)]",
      ].join(" ")}
    >
      Trend line
    </button>
  );
}
