"use client";

// VicData 0.8 SMT round 1: SMT's few own pieces. The page wears the shared shell (src/components/shell)
// and Admissions' small kit (tiles, flag pills, keys, the chart kit) -- the same tokens, the boards'
// semantic colours as Admissions variables -- with SMT's accent (ROLE_ACCENT.smt) in place of
// Admissions'. Nothing here computes a figure: every value arrives from /api/smt/*.
import type { CSSProperties, ReactNode } from "react";
import { accentVars, productAccent } from "@/components/shell/accent";
import { admissionsVars, cx } from "@/components/admissions/ui";
import type { Theme } from "@/components/shell/TeacherChrome";
import { periodLabel, withProvisional, type YearFamily } from "@/catalogue/years";
import { ARROW, arrowed, type Direction, flatBand, signedDelta, signedValue } from "@/lib/signed-delta";

const S = productAccent("smt")!;

/** The page root's variables: Admissions' semantic colours, SMT's accent. */
export function smtVars(theme: Theme): CSSProperties {
  const dark = theme === "dark";
  return {
    ...admissionsVars(theme),
    ...accentVars(S),
    "--adm-tint": `rgba(${S.rgb},${dark ? 0.12 : 0.14})`,
    "--adm-accent-text": dark ? S.hex : "#6d28d9",
    "--adm-on-accent": "#160f2a",
    "--adm-range-edge": dark ? "#3b3252" : "#d8ccfa",
  } as CSSProperties;
}

export type Unit = "pupils" | "points" | "pct" | "va" | "share" | "grade";

/** A figure as the boards write it, by its unit. */
export function fmt(v: number | null | undefined, unit: Unit, key?: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  switch (unit) {
    case "pupils":
      return Math.round(v).toLocaleString("en-GB");
    case "pct":
    case "share":
      // R-MINUS-SIGN: a negative (a roll change) carries "−".
      return `${signedValue(v, 1).replace(/\.0$/, "")}%`;
    case "va":
      return signedDelta(v, (x) => Math.abs(x).toFixed(2), { zero: "" });
    case "grade":
      return v.toFixed(2);
    default:
      return key && /aps_per_entry/.test(key) ? v.toFixed(2) : v.toFixed(1);
  }
}

/** A change, signed, in its own unit: +2.5 pts, −0.7 pts, +6.1 pp, ▲ 16%. */
export function fmtChange(c: { change: number; unit: "pct" | "points" | "pp" | "va" } | null | undefined, dp = 1): string {
  if (!c) return "—";
  const v = c.change;
  // F-4: a value-added change, in value added's own units (two places, as the figure).
  if (c.unit === "va") return signedDelta(v, (x) => Math.abs(x).toFixed(2), { zero: "±" });
  const s = `${Math.abs(v).toFixed(c.unit === "pct" ? 0 : dp)}`;
  return c.unit === "pct" ? arrowed(v, (x) => `${x.toFixed(0)}%`, 0) : signedDelta(v, () => `${s} ${c.unit === "pp" ? "pp" : "pts"}`, { zero: "±" });
}

/** The precision fmtChange prints a change at: whole percents, `dp` places otherwise. */
export const changeDp = (c: { unit: "pct" | "points" | "pp" | "va" }, dp = 1) => (c.unit === "pct" ? 0 : c.unit === "va" ? 2 : dp);

// R-FLAT-BAND: steady (neutral, "–") when the change rounds to 0 at the precision shown (`dp`), or
// within a view's own wider band (`flat`).
const DIR_CLASS: Record<Direction, string> = { up: "text-[var(--adm-up-fg)]", down: "text-[var(--adm-down-fg)]", flat: "text-[var(--muted2)]" };
export const dirClass = (v: number | null | undefined, flat = 0.05, dp = 2) => (v === null || v === undefined ? DIR_CLASS.flat : DIR_CLASS[flatBand(v, dp, flat)]);
export const arrowOf = (v: number | null | undefined, flat = 0.05, dp = 2) => (v === null || v === undefined ? "" : ARROW[flatBand(v, dp, flat)]);

export const ord = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n.toLocaleString("en-GB")}${s}`;
};
// A shared place reads "=851st", as Teacher's rankings print it (subject-ranking-view.ts).
export const rankText = (r: { rank: number; of: number; tied?: boolean } | null | undefined) => (r ? `${r.tied ? "=" : ""}${ord(r.rank)} of ${r.of.toLocaleString("en-GB")}` : "—");

/** A results year, "(provisional)" where the data says so (years.ts). */
export const yearOf = (p: number | null | undefined, family?: YearFamily | null) => (p === null || p === undefined ? "" : withProvisional(periodLabel(p), family ?? null, p));
export const shortYear = (p: number) => `${String(p % 100).padStart(2, "0")}/${String((p + 1) % 100).padStart(2, "0")}`;

/** The boards' column-1 tile, with the accent figure, as Admissions' (ui.tsx Tile) but with a muted note. */
export function NoteTile({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-[9px] border border-[var(--panel-border)] px-[10px] py-2">
      <span className="text-[10.5px] text-[var(--muted2)]">{label}</span>
      <span className="text-[15px] font-extrabold text-[var(--muted2)]">{title}</span>
      <span className="text-[10.5px] leading-snug text-[var(--muted2)]">{sub}</span>
    </div>
  );
}

export function Th({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <th title={title} className={cx("whitespace-nowrap px-2 py-[7px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted2)]", className)}>{children}</th>;
}
export function Td({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <td title={title} className={cx("px-2 py-[7px] text-[12.5px] text-[var(--chip-fg)]", className)}>
      {children}
    </td>
  );
}
