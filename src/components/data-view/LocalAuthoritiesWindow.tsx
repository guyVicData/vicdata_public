"use client";

// "Compared with" panel, round 2 tweak (2026-09-08, per direct request): the Local
// Authorities checklist moves from an inline expanding panel into a real popup
// window -- "list is a pop up window like the schools list" -- reusing the exact
// same overlay/panel treatment AddSubtractSchoolsWindow.tsx already established
// (dims the page behind it, Close-button-only dismiss, no click-outside/Escape).

export type AdjacentLasResponse = { ownLaName: string | null; adjacent: { name: string }[] };

export default function LocalAuthoritiesWindow({
  laInfo,
  checkedLas,
  laLoading,
  onToggleLa,
  onSelectAllLas,
  onClose,
}: {
  laInfo: AdjacentLasResponse | null;
  checkedLas: Set<string>;
  laLoading: boolean;
  onToggleLa: (name: string) => void;
  onSelectAllLas: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add or subtract local authorities"
        className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-lg bg-white shadow-xl dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Local Authorities</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {!laInfo ? (
            <p className="text-neutral-400">Loading…</p>
          ) : !laInfo.ownLaName ? (
            <p className="text-neutral-400">No real LA on record for this school.</p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checkedLas.has(laInfo.ownLaName)} onChange={() => onToggleLa(laInfo.ownLaName!)} />
                {laInfo.ownLaName} <span className="text-neutral-400">(this school&rsquo;s own LA)</span>
              </label>
              {laInfo.adjacent.map((la) => (
                <label key={la.name} className="flex items-center gap-2">
                  <input type="checkbox" checked={checkedLas.has(la.name)} onChange={() => onToggleLa(la.name)} />
                  {la.name}
                </label>
              ))}
              {laInfo.adjacent.length > 0 && (
                <button type="button" onClick={onSelectAllLas} className="text-xs text-neutral-500 underline">
                  Select all
                </button>
              )}
              {laLoading && <p className="text-xs text-neutral-400">Updating…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
