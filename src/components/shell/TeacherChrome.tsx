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
import { ExportIcon } from "./PanelFooter";

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

// Top-nav rounds: the toggle and Export used to be one inseparable pair. The toggle now
// lives in TeacherNav on every Teacher view page, and Export stays in each page's own
// header or control bar -- so they are two separate components, each defined once.
//
// The print-forcing effect lives in ThemeToggle: it depends only on the theme, and the
// toggle is the one thing every page that owns a theme renders. It still runs when the
// toggle is print:hidden -- CSS hides the button, not the component.
export function ThemeToggle({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
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

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => onTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--panel-bg)] text-[var(--muted)] hover:text-[var(--fg)]"
    >
      {theme === "dark" ? SUN_ICON : MOON_ICON}
    </button>
  );
}

// The icon shows the theme a click switches TO.
const SUN_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const MOON_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// Content round S2: an icon, the same glyph every panel's own Export uses, so the
// whole-dashboard export and a panel's read as the same action at two sizes.
export function ExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label="Export all visible panels"
      title="Export all visible panels"
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-[var(--panel-border2)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] print:hidden [&>svg]:h-4 [&>svg]:w-4"
    >
      {ExportIcon}
    </button>
  );
}
