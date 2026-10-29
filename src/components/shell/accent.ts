// 0.8 shell (Part A): each product's accent, named in one place. A product sets it once, on its
// page's root (#teacher-root), as the CSS custom properties --accent and --accent-rgb; every shell
// part reads those (var(--accent)), inherited down the tree like a context. No shell part takes a
// hex, and no product passes one to the shell.
//
//   Teacher     by phase: PHASE_ACCENT (GCSE green, Post-16 violet; KS2 none)
//   Admissions  by role:  ROLE_ACCENT.admissions (cyan)
//   SMT         by role:  ROLE_ACCENT.smt (violet)
//   Groups      GROUP_ACCENT (orange, as the group wireframes draw it; to confirm with Guy)
import type { CSSProperties } from "react";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { GROUP_ACCENT, PHASE_ACCENT, ROLE_ACCENT } from "@/lib/teacher-view-theme";

export type ShellProduct = "teacher" | "admissions" | "smt" | "groups";
export type Accent = { hex: string; rgb: string };

export function productAccent(product: ShellProduct, phase?: TeacherPhase): Accent | null {
  if (product === "teacher") return phase ? PHASE_ACCENT[phase] : null;
  if (product === "groups") return GROUP_ACCENT;
  return ROLE_ACCENT[product];
}

// The root's custom properties: { "--accent", "--accent-rgb" }, or nothing for no accent. 0.8 Admissions
// feedback round 1 (F-17): with the product's featured-row token, its --row-featured too.
export function accentVars(accent: Accent | null | undefined, featured: FeaturedRowKey | null = null): CSSProperties {
  return { ...(accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}), ...featuredRowVars(featured) } as CSSProperties;
}

// 0.8 Admissions feedback round 1 (F-17): the featured school's row in every table is tinted in its
// product's own colour -- one token per product, light and dark, in globals.css (#teacher-root). A
// product's root names its token as --row-featured (featuredRowVars); every table reads
// FEATURED_ROW_BG. Teacher by phase: GCSE and Post-16 (KS2 has no accent and takes the neutral
// default). SMT's token is Post-16's violet, as the role and phase accents already share it.
export type FeaturedRowKey = "admissions" | "gcse" | "post16" | "smt" | "groups";
export const FEATURED_ROW_TOKEN: Record<FeaturedRowKey, string> = {
  admissions: "--row-featured-admissions",
  gcse: "--row-featured-gcse",
  post16: "--row-featured-post16",
  smt: "--row-featured-smt",
  groups: "--row-featured-groups",
};

/** The product's featured-row token: Teacher by phase (none for KS2). */
export function featuredRowKey(product: ShellProduct, phase?: TeacherPhase): FeaturedRowKey | null {
  if (product === "teacher") return phase === "ks4" ? "gcse" : phase === "ks5" ? "post16" : null;
  return product;
}

/** The root's --row-featured, naming its product's token; nothing for no token (the neutral default). */
export function featuredRowVars(key: FeaturedRowKey | null): CSSProperties {
  return (key ? { "--row-featured": `var(${FEATURED_ROW_TOKEN[key]})` } : {}) as CSSProperties;
}

/** A featured row's (or column's) background in any table. Where no product has named a token (KS2,
 * an editor preview outside #teacher-root), the accent at 14%, as Teacher's tables drew it before. */
export const FEATURED_ROW_BG = "var(--row-featured, rgba(var(--accent-rgb,138,138,144),0.14))";
/** Text in the accent on a featured row: the accent mixed toward --fg (accentText's per-theme share), so
 * it reads on the tint in both themes (the raw #34d399 on the light tint is about 1.5:1). */
export const FEATURED_ROW_ACCENT_TEXT = "color-mix(in srgb, var(--accent, var(--fg)) var(--accent-text-mix, 65%), var(--fg))";
