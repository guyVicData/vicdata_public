"use client";

// Teacher view, content round S9 (moved here in round 2 §5 so more than one panel can use
// it): a list longer than its panel scrolls inside its own box, and the row marked
// `data-highlight` -- the school's own row in Comparisons' ranking, the focused subject in
// Context's whole-school bars and table -- is scrolled to the MIDDLE of that box, so it is
// in view with rows above and below it, whenever `watch` changes (the rows, their order,
// the focus). Sets the box's own scrollTop rather than calling scrollIntoView, which would
// scroll the whole page too.
import { useEffect, useRef, type ReactNode } from "react";

export function CentredOnTarget({ watch, children }: { watch: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>("[data-highlight]");
    if (!el || !row || el.scrollHeight <= el.clientHeight) return;
    el.scrollTop = row.offsetTop - (el.clientHeight - row.offsetHeight) / 2;
  }, [watch]);
  // `relative`, so the row's offsetTop is measured from this box.
  return (
    <div ref={box} className="relative min-h-0 flex-grow overflow-y-auto">
      {children}
    </div>
  );
}
