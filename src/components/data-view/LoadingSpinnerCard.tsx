"use client";

// Exact replica of the public school page's map-loading indicator (SchoolMap.tsx's
// own .vd-spinner/.vd-status-card pattern: a spinning ring inside a bordered card) --
// per direct request, "when school data is loading show a loading animation exactly
// as the public site." Kept as its own small component (not copy-pasted into
// DataViewShell.tsx/MapView.tsx) since the exact CSS is worth keeping visibly
// identical to the public original rather than drifting via two separate copies.

export default function LoadingSpinnerCard({ label }: { label: string }) {
  return (
    <div className="vd-loading-spinner-root pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center px-4">
      <style>{`
        .vd-loading-spinner-root { --dot: #9ca3af; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-loading-spinner-root { --dot: #6b7280; }
        }
        :root[data-theme="dark"] .vd-loading-spinner-root { --dot: #6b7280; }
        .vd-loading-spinner-root .vd-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid var(--dot);
          border-top-color: transparent;
          border-radius: 50%;
          animation: vd-spin 0.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vd-loading-spinner-root .vd-spinner { animation: none; }
        }
        @keyframes vd-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        className="max-w-[320px] rounded-lg border-2 border-neutral-900 bg-white px-6 py-5 text-center shadow-lg dark:border-neutral-100 dark:bg-neutral-950"
      >
        <div className="vd-spinner mx-auto mb-3" />
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</p>
      </div>
    </div>
  );
}
