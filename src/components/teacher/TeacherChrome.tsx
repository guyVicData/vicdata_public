"use client";

// Teacher view, Phase 4: theme toggle + export (design brief v2 §7).
//
// §7 asks for "a proper toggle, defaulting to dark" and for universal PDF/print export
// that "defaults to a light, print-safe rendering regardless of on-screen theme".
//
// Two decisions worth stating, both about blast radius:
//
// 1. The theme attribute goes on Teacher view's own wrapper, not on <html>. Defaulting
//    the whole site to dark is a change to the public product for every existing
//    visitor, which this brief never asks for -- it is a Teacher view requirement in a
//    Teacher view section. The dual-mode `dark:` variant in globals.css is what makes a
//    scoped override possible at all. Logged as Q15.
//
// 2. Print forces the light palette by swapping the attribute in beforeprint and
//    restoring it in afterprint, rather than trying to unwind every `dark:` utility in
//    a @media print block -- CSS cannot un-apply a utility, so the attribute is the only
//    honest lever. The existing Data View print stylesheet already forces a white body,
//    so this completes the same job for themed subtrees rather than adding a second
//    export mechanism.
import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "vicdata.teacher.theme";

export function useTeacherTheme(): [Theme, (t: Theme) => void] {
  // §7's "defaulting to dark" -- the default, not a forced value: a stored choice wins.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    // Read inside an async callback rather than the effect body -- the same fix already
    // applied to the dashboard page's own loader, for the same reason: a synchronous
    // setState in an effect body triggers cascading renders. It cannot go in a useState
    // initializer either, because localStorage does not exist during SSR and reading it
    // there would hydrate mismatched markup.
    (async () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") setTheme(stored);
      } catch {
        // Private browsing and blocked site-data both throw here. A theme is a
        // convenience, so failing to read one must never break the dashboard.
      }
    })();
  }, []);
  const set = (t: Theme) => {
    setTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // As above -- the in-memory theme still applies for this visit.
    }
  };
  return [theme, set];
}

export function TeacherChrome({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  useEffect(() => {
    const root = document.getElementById("teacher-root");
    if (!root) return;
    const before = () => root.setAttribute("data-theme", "light");
    const after = () => root.setAttribute("data-theme", theme);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [theme]);

  return (
    <div className="flex items-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
      >
        {theme === "dark" ? "Light" : "Dark"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
      >
        Export
      </button>
    </div>
  );
}
