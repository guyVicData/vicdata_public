// VicData 0.8 groups r1: the group pages' colours, from the shell's accent (head office bronze, GROUP_ACCENT; orange before 0.8 front door) and the
// wireframes (docs/wireframes/groups/Home.dc.html, Access.dc.html), for both themes.
import type { CSSProperties } from "react";
import { accentVars, productAccent } from "@/components/shell/accent";
import { GROUP_ACCENT, GROUP_BRONZE } from "@/lib/teacher-view-theme";

export function groupVars(theme: "light" | "dark"): CSSProperties {
  const dark = theme === "dark";
  const b = GROUP_BRONZE[dark ? "dark" : "light"];
  return {
    ...accentVars(productAccent("groups"), "groups"),
    // 0.8 front door part 2 (FD5): head office bronze, where the orange of before Part 1 was left.
    "--group-accent-text": dark ? GROUP_ACCENT.hex : b.accentText,
    // The dashed "coming" chips and the group card's edge.
    "--group-chip-border": b.chipBorder,
    "--group-chip-bg": b.chipBg,
    "--group-chip-fg": b.chipFg,
    "--group-card-edge": b.cardEdge,
    // The Access page's switch, on (Access.dc.html: #fb923c, knob #1f0f04).
    "--group-switch-on": GROUP_ACCENT.hex,
    "--group-switch-knob-on": dark ? "#1f0f04" : "#ffffff",
    // The likely-member pill (Access.dc.html: #3b2f0a / #fde68a).
    "--group-likely-bg": dark ? "#3b2f0a" : "#fef3c7",
    "--group-likely-fg": dark ? "#fde68a" : "#92400e",
    "--group-strong": b.strong,
  } as CSSProperties;
}
