// VicData 0.8 groups r1: the group pages' colours, from the shell's accent (orange, GROUP_ACCENT) and the
// wireframes (docs/wireframes/groups/Home.dc.html, Access.dc.html), for both themes.
import type { CSSProperties } from "react";
import { accentVars, productAccent } from "@/components/shell/accent";
import { GROUP_ACCENT } from "@/lib/teacher-view-theme";

export function groupVars(theme: "light" | "dark"): CSSProperties {
  const dark = theme === "dark";
  return {
    ...accentVars(productAccent("groups")),
    "--group-accent-text": dark ? GROUP_ACCENT.hex : "#c2410c",
    // The dashed "coming" chips and the group card's edge (Home.dc.html: #4a2c14 / #21150b / #fed7aa).
    "--group-chip-border": dark ? "#4a2c14" : "#fdba74",
    "--group-chip-bg": dark ? "#21150b" : "#fff7ed",
    "--group-chip-fg": dark ? "#fed7aa" : "#9a3412",
    "--group-card-edge": dark ? "#4a2c14" : "#fdba74",
    // The Access page's switch, on (Access.dc.html: #fb923c, knob #1f0f04).
    "--group-switch-on": GROUP_ACCENT.hex,
    "--group-switch-knob-on": dark ? "#1f0f04" : "#ffffff",
    // The likely-member pill (Access.dc.html: #3b2f0a / #fde68a).
    "--group-likely-bg": dark ? "#3b2f0a" : "#fef3c7",
    "--group-likely-fg": dark ? "#fde68a" : "#92400e",
    "--group-strong": dark ? "#fed7aa" : "#9a3412",
  } as CSSProperties;
}
