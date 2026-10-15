"use client";

// VicData 0.8 SMT r4 (stage I): "How it is calculated" in a panel's source (i) -- the view's method
// (src/catalogue/methods.ts): sources, area, years and what is left out, then the numbered steps behind a
// collapsible heading (closed until opened, on the phone too), then any rounding. Never truncated: the (i)
// scrolls. The methods module is loaded only when an (i) is opened, so no page carries its text.
import { useEffect, useState } from "react";
import type { ProjectionMethodInput, ViewMethod } from "@/catalogue/methods";

type Vars = Record<string, string | number | null | undefined>;

/** A registered view's method (by dataview id, its {placeholders} filled from `vars`), or a method the
 * host built itself (the forward view's, from its settings). */
export function MethodNote({ id, vars, method, projection }: { id?: string | null; vars?: Vars; method?: ViewMethod | null; projection?: ProjectionMethodInput | null }) {
  const [loaded, setLoaded] = useState<ViewMethod | null>(null);
  const [open, setOpen] = useState(false);
  const key = JSON.stringify([vars ?? {}, projection ?? null]);
  useEffect(() => {
    if (method || (!id && !projection)) return;
    let live = true;
    import("@/catalogue/methods").then(({ methodOf, projectionMethod }) => {
      // The forward view's method is generated from its settings (R-METHOD-SETTINGS).
      if (live) setLoaded(projection ? projectionMethod(projection) : methodOf(id!, vars ?? {}));
    });
    return () => {
      live = false;
    };
  }, [id, key, method]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = method ?? loaded;
  if (!m) return null;
  return (
    <span data-method={id ?? "generated"} className="mt-2 block border-t border-[var(--panel-border)] pt-2 text-[11px] leading-relaxed text-[var(--muted2)]">
      {m.notes?.map((n) => (
        <span key={n} data-method-note="" className="mb-1 block text-[var(--chip-fg)]">
          {n}
        </span>
      ))}
      <span className="block">
        <b className="font-semibold text-[var(--chip-fg)]">Sources.</b> {m.sources.join("; ")}.
      </span>
      <span className="mt-1 block">
        <b className="font-semibold text-[var(--chip-fg)]">Area.</b> {m.geography}
      </span>
      <span className="mt-1 block">
        <b className="font-semibold text-[var(--chip-fg)]">Years.</b> {m.years}
      </span>
      {m.leftOut.length > 0 && (
        <span className="mt-1 block">
          <b className="font-semibold text-[var(--chip-fg)]">Left out.</b> {m.leftOut.join(" ")}
        </span>
      )}
      <button type="button" aria-expanded={open} data-method-steps-toggle="" onClick={() => setOpen(!open)} className="mt-1.5 flex items-center gap-1 font-semibold text-[var(--chip-fg)] hover:text-[var(--fg)]">
        <span aria-hidden="true" className={open ? "rotate-90" : ""}>
          ›
        </span>
        How it is calculated
      </button>
      {open && (
        <ol data-method-steps="" className="ml-4 mt-1 list-decimal">
          {m.steps.map((s, i) => (
            <li key={i} className="mt-0.5">
              {s}
            </li>
          ))}
        </ol>
      )}
      {m.rounding.length > 0 && (
        <span className="mt-1 block">
          <b className="font-semibold text-[var(--chip-fg)]">Rounding.</b> {m.rounding.join(" ")}
        </span>
      )}
    </span>
  );
}
