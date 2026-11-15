// VicData 0.8 feedback B5 (SMT 1): the loading graphic -- a turning ring and what is loading, in words -- for
// every place a dashboard, a walk or a home tile waits on its figures (SMT's routes can take seconds on a
// cold server). Tokens only, so it draws in every theme; still under reduced motion.

/** The ring alone, sized to sit in a line of text or a tile. */
export function Spinner({ size = 18 }: { size?: number }) {
  return <span aria-hidden="true" data-spinner="" className="inline-block shrink-0 animate-spin rounded-full border-[3px] border-[var(--muted3,#9ca3af)] border-t-transparent motion-reduce:animate-none" style={{ width: size, height: size }} />;
}

/** The ring and its words, centred in the space it fills. */
export function LoadingGraphic({ label = "Loading the figures…", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" data-loading="" className={`flex grow flex-col items-center justify-center gap-2.5 p-4 text-center ${className}`}>
      <Spinner size={26} />
      <span className="text-[12.5px] text-[var(--muted2)]">{label}</span>
    </div>
  );
}
