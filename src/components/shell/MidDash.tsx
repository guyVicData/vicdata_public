"use client";

// VicData 0.8 front door 2b (M3; Guy, 13 Nov): Mid on the dashboards. The homes' look carries over:
//
//   the page and the header band stay dark;
//   the area being worked in -- the dashboard's own ladder element (DashboardGrid, ShellPage), or the
//   Group library's body -- is its part's coloured field (GCSE green, Post-16 violet, the top level
//   orange, Admissions sky, head office the orange field with its bronze accent: Part 1's gradients);
//   on the field everything draws as Light draws it: the columns and open panels on near-white plates,
//   shut panels as Light's raised bars (the ladder), charts on white with their fixed reference colours.
//
// So under Mid a dashboard's root draws data-theme="light" (its tokens, its `dark:` utilities, and the
// JS colours its components pick from `theme`), marked data-mid-dash="<part>" for the field and page
// rules in globals.css; and the header -- the nav, the control bar, the banners -- sits in a MidBand,
// data-theme="dark", drawn exactly as Dark draws it. Nested components that ask useTeacherTheme() get
// the theme of the part they are in (DashThemeContext).
//
// In Dark and Light nothing here adds an element or an attribute: MidBand is a fragment, the root's
// attributes are absent, so every Dark and Light picture is the same, pixel for pixel.
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { DashThemeContext, type Theme } from "./TeacherChrome";

export type MidPart = "gcse" | "post16" | "top" | "group" | "admissions";

const MidPartContext = createContext<MidPart | null>(null);

/** The part's field this dashboard is drawn on in Mid, or null (Dark, Light, or not a dashboard). */
export function useMidPart(): MidPart | null {
  return useContext(MidPartContext);
}

/** The root's attributes under Mid (none otherwise). */
export function midRootProps(mid: boolean, part: MidPart): Record<string, string> {
  return mid ? { "data-pref": "mid", "data-mid-dash": part } : {};
}

/** Around a dashboard's root: what nested components read (the part in Mid; the root's theme). */
export function MidDashProvider({ mid, part, theme, children }: { mid: boolean; part: MidPart; theme: Theme; children: ReactNode }) {
  if (!mid) return <>{children}</>;
  return (
    <MidPartContext.Provider value={part}>
      <DashThemeContext.Provider value={theme}>{children}</DashThemeContext.Provider>
    </MidPartContext.Provider>
  );
}

/**
 * The dark header band in Mid: its children draw as Dark (tokens, `dark:` utilities, and nested
 * useTeacherTheme()). `style` re-applies the product's own Dark variables (its accent) on the band.
 * `bleed` stretches the band to the field's edges where the field holds the header (ShellPage: desktop
 * px-7 py-5); `className` keeps the parent's spacing between the band's children (a flex column's gap).
 * Outside Mid: the children, as they are.
 */
export function MidBand({ children, style, bleed = false, className = "" }: { children: ReactNode; style?: CSSProperties; bleed?: boolean; className?: string }) {
  const part = useMidPart();
  if (!part) return <>{children}</>;
  return (
    <DashThemeContext.Provider value="dark">
      <div data-theme="dark" data-mid-band="" style={style} className={`${bleed ? "-mx-7 -mt-5 px-7 pb-5 pt-5" : ""} ${className}`.trim()}>
        {children}
      </div>
    </DashThemeContext.Provider>
  );
}
