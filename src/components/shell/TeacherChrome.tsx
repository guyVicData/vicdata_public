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
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { ExportIcon } from "./PanelFooter";

// 0.8 front door (C18): three themes, Dark · Mid · Light, remembered per person as before (the same
// localStorage key; an old "dark" or "light" reads unchanged). Mid belongs to the homes and the walks
// only: everything else -- dashboards, the sets pages, admin pages -- asks for `useTeacherTheme()`,
// which answers Dark under Mid. So no dashboard, set or group component needed to change, and Mid can
// never reach them by accident (R-THEME-MID-SCOPE). Front door 2b (M3): dashboards follow Mid now
// (useDashboardTheme, MidDash.tsx); the sets and admin pages still draw Dark under Mid.
export type Theme = "dark" | "light";
export type ThemePref = "dark" | "mid" | "light";
const STORAGE_KEY = "vicdata.teacher.theme";

// One small store, shared by every hook on the page, so the switch (in the nav) and the page's own
// theme can't disagree: a click in the nav re-renders whichever page reads the theme.
let pref: ThemePref | null = null;
const listeners = new Set<() => void>();
function readPref(): ThemePref {
  if (pref) return pref;
  pref = "dark"; // "defaulting to dark" (§7): the default, not a forced value -- a stored choice wins.
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "mid") pref = stored;
  } catch {
    // Private browsing and blocked site-data both throw here. A theme is a convenience, so failing
    // to read one must never break the page.
  }
  return pref;
}
export function setThemePref(next: ThemePref) {
  pref = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // As above -- the in-memory theme still applies for this visit.
  }
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
// The server has no localStorage: it (and hydration) renders Dark, then the stored choice applies.
const serverPref = (): ThemePref => "dark";

/** The person's chosen theme, Mid included: for the homes and the walks only. */
export function useThemePref(): [ThemePref, (t: ThemePref) => void] {
  const p = useSyncExternalStore(subscribe, readPref, serverPref);
  return [p, setThemePref];
}

/** Dark under Mid (C18): what every dashboard, sets page and admin page draws in. */
export function effectiveTheme(p: ThemePref): Theme {
  return p === "light" ? "light" : "dark";
}

export function useTeacherTheme(): [Theme, (t: Theme) => void] {
  const [p] = useThemePref();
  // 0.8 front door 2b (M3): inside a dashboard drawn in Mid, the theme of the part being drawn (Light on
  // the coloured field and its plates, Dark in the header band: DashThemeContext, MidDash.tsx). Everywhere
  // else -- the sets and admin pages -- Dark under Mid, as before.
  const inDash = useContext(DashThemeContext);
  return [inDash ?? effectiveTheme(p), setThemePref];
}

// 0.8 front door 2b (M3; Guy, 13 Nov): dashboards follow Mid. A Mid dashboard keeps its page and header
// dark and draws the area being worked in as its part's coloured field, with everything on it -- columns,
// panels, charts, full screen -- as Light draws it. So its root draws Light, and its header band Dark.
// The provider is set by the dashboard's root (MidDashRoot) and by the band (MidBand); null outside.
export const DashThemeContext = createContext<Theme | null>(null);

/** A dashboard's theme for a choice: Light under Mid (the field and its plates), else the choice. */
export function dashThemeOf(p: ThemePref): Theme {
  return p === "mid" ? "light" : effectiveTheme(p);
}

/** What a dashboard draws in (dashThemeOf), with `mid` to mark the root. */
export function useDashboardTheme(): { theme: Theme; mid: boolean; setTheme: (t: Theme) => void } {
  const [p] = useThemePref();
  return { theme: dashThemeOf(p), mid: p === "mid", setTheme: setThemePref };
}

// Top-nav rounds: the toggle and Export used to be one inseparable pair. The toggle now
// lives in TeacherNav on every Teacher view page, and Export stays in each page's own
// header or control bar -- so they are two separate components, each defined once.
//
// The print-forcing effect lives in ThemeToggle: it depends only on the theme, and the
// toggle is the one thing every page that owns a theme renders. It still runs when the
// toggle is print:hidden -- CSS hides the button, not the component.
//
// 0.8 front door (C18): the switch is Dark · Mid · Light. It reads the person's choice from the store,
// so a dashboard in Mid shows Mid picked while it draws Dark. `theme` and `onTheme` stay for the
// callers: the print swap uses the theme the page draws in.
export function ThemeToggle({ theme }: { theme: Theme; onTheme?: (t: Theme) => void }) {
  const [p, setP] = useThemePref();
  useEffect(() => {
    const root = document.getElementById("teacher-root");
    if (!root) return;
    const restore = root.getAttribute("data-theme") ?? theme;
    const before = () => root.setAttribute("data-theme", "light");
    const after = () => root.setAttribute("data-theme", restore);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [theme, p]);

  return (
    <div role="radiogroup" aria-label="Theme" className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-[var(--panel-border2)] p-[3px]">
      {THEME_CHOICES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={p === value}
          onClick={() => setP(value)}
          title={value === "mid" ? "Mid: the homes, walkthroughs and dashboards in colour (the header stays dark)" : `${label} theme`}
          className={
            p === value
              ? "h-full rounded-full bg-[var(--fg)] px-2.5 text-[11.5px] font-semibold text-[var(--bg)]"
              : "h-full rounded-full px-2.5 text-[11.5px] text-[var(--muted)] hover:text-[var(--fg)]"
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
const THEME_CHOICES: [ThemePref, string][] = [
  ["dark", "Dark"],
  ["mid", "Mid"],
  ["light", "Light"],
];

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
