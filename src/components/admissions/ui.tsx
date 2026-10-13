"use client";

// VicData 0.7 admissions r2: the Admissions boards' building blocks (docs/wireframes/admissions,
// Main / MarketShare), measured from the boards and drawn with the app's own tokens, never the
// boards' illustrative hexes:
//   #0a0a0a page → --bg · #141414 panel → --panel-bg · #232323 panel edge → --panel-border
//   #2a2a2a chip edge → --panel-border2 · #101010 inset → --box-bg · #f2f2f2 → --fg
//   #9a9a9a → --muted2 · #7a7a7a → --muted · #d4d4d4 / #c4c4c4 → --chip-fg
//   #22d3ee → --accent (ROLE_ACCENT.admissions) · #0f2329 → the accent at 0.14 (--adm-tint)
// The boards' semantic colours (green flag, red flag, amber, orange, greys) are
// Admissions variables below, a dark and a light value each, so both themes read.
import type { CSSProperties, ReactNode } from "react";
import { productAccent } from "@/components/shell/accent";
import { RailPanel } from "@/components/shell/RailPanel";
import type { Theme } from "@/components/teacher/TeacherChrome";

const A = productAccent("admissions")!;

export function admissionsVars(theme: Theme): CSSProperties {
  const dark = theme === "dark";
  return {
    "--accent": A.hex,
    "--accent-rgb": A.rgb,
    "--adm-tint": `rgba(${A.rgb},${dark ? 0.12 : 0.14})`,
    "--adm-accent-text": dark ? A.hex : "#0e7490",
    "--adm-on-accent": "#041418",
    "--adm-rail-on": dark ? "#262626" : "#e4e4e7",
    "--adm-grey-bar": dark ? "#3f3f46" : "#d4d4d8",
    "--adm-grey-2": dark ? "#52525b" : "#a1a1aa",
    "--adm-grey-line": dark ? "#71717a" : "#a1a1aa",
    "--adm-grey-soft": dark ? "#a1a1aa" : "#71717a",
    "--adm-grid": dark ? "#1e1e1e" : "#ececef",
    "--adm-axis": dark ? "#2a2a2a" : "#d8d8dd",
    "--adm-up-bg": dark ? "#14261c" : "#dcfce7",
    "--adm-up-fg": dark ? "#86efac" : "#15803d",
    "--adm-down-bg": dark ? "#2a1616" : "#fee2e2",
    "--adm-down-fg": dark ? "#fca5a5" : "#b91c1c",
    "--adm-amber": dark ? "#fbbf24" : "#b45309",
    "--adm-orange": dark ? "#f97316" : "#ea580c",
    "--adm-range-edge": dark ? "#2f4b52" : "#a5e4ef",
    "--adm-quadrant": dark ? "#6a6a70" : "#9a9aa2",
  } as CSSProperties;
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ------------------------------------------------------------------------- small pieces

// 0.8 shell (Part A): the filter pill (FChip) and the focus chip (EntryChip) moved to
// src/components/shell/FilterPills.tsx.
export { EntryChip, FChip } from "@/components/shell/FilterPills";

export function Tile({ label, value, sub, accent = false, small = false }: { label: string; value: ReactNode; sub: ReactNode; accent?: boolean; small?: boolean }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-[9px] border border-[var(--panel-border)] px-[10px] py-2">
      <span className="text-[10.5px] text-[var(--muted2)]">{label}</span>
      <span className={cx("font-extrabold tabular-nums", small ? "text-[16px]" : "text-[19px]", accent ? "text-[var(--adm-accent-text)]" : "text-[var(--fg)]")}>{value}</span>
      <span className="text-[10.5px] text-[var(--muted2)]">{sub}</span>
    </div>
  );
}

export function Key({ swatch, children, muted = false }: { swatch: ReactNode; children: ReactNode; muted?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-[6px] text-[11px]", muted ? "text-[var(--muted)]" : "text-[var(--chip-fg)]")}>
      {swatch}
      {children}
    </span>
  );
}
export const LineSwatch = ({ colour, dashed = false, width = 16, weight = 2.5 }: { colour: string; dashed?: boolean; width?: number; weight?: number }) => (
  <span aria-hidden="true" style={{ width, height: 0, borderTop: `${weight}px ${dashed ? "dashed" : "solid"} ${colour}` }} />
);

export type FlagTone = "up" | "down" | "note";
const TONE: Record<FlagTone, string> = {
  up: "bg-[var(--adm-up-bg)] text-[var(--adm-up-fg)]",
  down: "bg-[var(--adm-down-bg)] text-[var(--adm-down-fg)]",
  // 0.7 r3 (F1): a flag with no direction takes Teacher's neutral chip, not a note colour of its own.
  note: "bg-[var(--box-bg)] text-[var(--muted2)]",
};
/** A flag pill. `figures` is the hover: every flag shows the figures behind it (R-ADM-VIEW-FLAGS). */
export function FlagPill({ tone, children, figures, small = false }: { tone: FlagTone; children: ReactNode; figures?: string; small?: boolean }) {
  return (
    <span title={figures} tabIndex={figures ? 0 : undefined} className={cx("inline-flex items-center gap-1 rounded-[6px] font-bold", small ? "px-[7px] py-[2px] text-[10.5px]" : "px-2 py-[2px] text-[11px]", TONE[tone])}>
      {children}
    </span>
  );
}

export const Muted = ({ children, className = "", size = 11 }: { children: ReactNode; className?: string; size?: number }) => (
  <span className={cx("text-[var(--muted2)]", className)} style={{ fontSize: size }}>
    {children}
  </span>
);

export const Lbl = ({ children }: { children: ReactNode }) => <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">{children}</div>;

// 0.8 shell (Part A): the panel, its rail, the phone's tabs and full screen's fill moved to
// src/components/shell/RailPanel.tsx. Admissions' Panel stays a thin wrapper round it (and so round
// the shell's CardBox), as round 3 left it.
export { Rail, Tabs, fillHeight, railGlyph, type RailItem, type PanelMenuAction } from "@/components/shell/RailPanel";

export function Panel(props: Parameters<typeof RailPanel>[0]) {
  return <RailPanel {...props} />;
}

export const ViewTitle = ({ children }: { children: ReactNode }) => <div className="text-[12.5px] font-bold text-[var(--fg)]">{children}</div>;

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex grow items-center justify-center rounded-[9px] border border-dashed border-[var(--panel-border2)] p-4 text-center text-[12px] leading-snug text-[var(--muted2)]">{children}</div>;
}

export function Skeleton() {
  return <div className="grow animate-pulse rounded-[9px] bg-[var(--box-bg)]" aria-label="Loading" />;
}

// ------------------------------------------------------------------------- formats
export const fmtN = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-GB"));
export const fmtPct = (v: number | null | undefined, dp = 1) => (v === null || v === undefined ? "—" : `${v.toFixed(dp)}%`);
export const fmtSigned = (v: number | null | undefined, dp = 1, unit = "%") => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(dp)}${unit}`);
export const arrow = (v: number | null | undefined, flat = 0.5) => (v === null || v === undefined ? "" : v > flat ? "▲" : v < -flat ? "▼" : "▬");
export const yearLabel = (p: number) => `${p}/${String((p + 1) % 100).padStart(2, "0")}`;
export const ordinal = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n.toLocaleString("en-GB")}${s}`;
};
