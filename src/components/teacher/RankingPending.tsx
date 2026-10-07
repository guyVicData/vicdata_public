"use client";

// VicData 0.6.6: a subject ranking on its way -- the site's loading ring (SchoolMap's
// .vd-spinner: a ring with its top open, turning) in the Teacher view's own muted token,
// above one line saying what is happening. While the first answer is awaited the line names
// the ranking; past the route's wait (~8 s cold, before the database function is applied)
// it says "Ranking will be available shortly" and the page asks again. Drawn the same in
// both drawing paths (the panel has no frame while it shows). Still under reduced motion.
export function RankingPending({ text, detail }: { text: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <style>{`
        .vd-ranking-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--muted3);
          border-top-color: transparent;
          border-radius: 50%;
          animation: vd-ranking-spin 0.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vd-ranking-spinner { animation: none; }
        }
        @keyframes vd-ranking-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="vd-ranking-spinner" aria-hidden="true" />
      <p className="min-w-0 text-[12px] font-semibold text-[var(--muted2)]">{text}</p>
      {detail && <p className="min-w-0 text-[11px] leading-snug text-[var(--muted3)]">{detail}</p>}
    </div>
  );
}
