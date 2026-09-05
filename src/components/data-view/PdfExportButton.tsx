"use client";

// Member Data View PDF export (brief §9). Repo-check finding (docs/vicdata_data_view_
// open_questions.md): grepped this whole repo for window.print/@media print/afterprint
// -- zero hits. VicDash's own pattern (Phase 2, a separate repo not present here) is
// referenced but not actually inspectable from this codebase; built fresh here
// matching the DESCRIBED shape (window.print() + @media print, no PDF-generation
// dependency, nothing server-rendered) since that's the best available reference, not
// a verified port.
//
// The afterprint-timing lesson IS carried forward even though it couldn't be verified
// against the original code: this button does no DOM/palette mutation of its own at
// all (no "enter print mode, then revert" step to race) -- the whole print treatment
// is pure CSS (@media print in globals.css), so there's nothing for afterprint to
// clean up. If a future round adds a print-time state mutation (temporarily
// re-colouring charts for print, say), it MUST gate the revert on the `afterprint`
// event, not a timer immediately after calling print() -- exactly the bug class
// VicDash's build ran into.
export default function PdfExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900 print:hidden"
    >
      Export PDF
    </button>
  );
}
