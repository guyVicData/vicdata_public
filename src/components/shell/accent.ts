// 0.8 shell (Part A): each product's accent, named in one place. A product sets it once, on its
// page's root (#teacher-root), as the CSS custom properties --accent and --accent-rgb; every shell
// part reads those (var(--accent)), inherited down the tree like a context. No shell part takes a
// hex, and no product passes one to the shell.
//
//   Teacher     by phase: PHASE_ACCENT (GCSE green, Post-16 violet; KS2 none)
//   Admissions  by role:  ROLE_ACCENT.admissions (cyan)
//   SMT         by role:  ROLE_ACCENT.smt (violet)
//   Groups      to come (the group wireframes draw orange, to confirm)
import type { CSSProperties } from "react";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT, ROLE_ACCENT } from "@/lib/teacher-view-theme";

export type ShellProduct = "teacher" | "admissions" | "smt";
export type Accent = { hex: string; rgb: string };

export function productAccent(product: ShellProduct, phase?: TeacherPhase): Accent | null {
  if (product === "teacher") return phase ? PHASE_ACCENT[phase] : null;
  return ROLE_ACCENT[product];
}

// The root's custom properties: { "--accent", "--accent-rgb" }, or nothing for no accent.
export function accentVars(accent: Accent | null | undefined): CSSProperties {
  return (accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) as CSSProperties;
}
