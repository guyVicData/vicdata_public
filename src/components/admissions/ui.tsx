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
import { ROLE_ACCENT } from "@/lib/teacher-view-theme";
import { CardBox } from "@/components/teacher/CardBox";
import { PanelExport, type PanelMenuItem } from "@/components/teacher/PanelFooter";
import * as Icons from "@/components/teacher/PanelIcons";
import type { Theme } from "@/components/teacher/TeacherChrome";

const A = ROLE_ACCENT.admissions!;

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

const CHEVRON = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** The boards' .fchip: an 8px-radius filter or set chip, optionally a menu. */
export function FChip({ children, onClick, title: titleIn, chevron = true, active = false, disabled = false }: { children: ReactNode; onClick?: () => void; title?: string; chevron?: boolean; active?: boolean; disabled?: boolean }) {
  const title = titleIn ?? (typeof children === "string" ? children : undefined);
  const cls = cx(
    "inline-flex min-w-0 max-w-[340px] items-center gap-[5px] whitespace-nowrap rounded-[8px] border px-[10px] py-[5px] text-[11.5px] font-semibold [&>span.t]:truncate",
    active ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]",
    "bg-[var(--box-bg)]",
    disabled && "opacity-60",
  );
  const body = (
    <>
      <span className="t min-w-0">{children}</span>
      {chevron && onClick && CHEVRON}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={title} disabled={disabled}>
      {body}
    </button>
  ) : (
    <span className={cls} title={title}>
      {body}
    </span>
  );
}

/** The boards' entry-point .chip (pill, the accent when active). */
export function EntryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "whitespace-nowrap rounded-full border px-3 py-[5px] text-[12px] font-semibold",
        active ? "border-[var(--accent)] bg-[var(--adm-tint)] text-[var(--fg)]" : "border-[var(--panel-border2)] bg-[var(--panel-bg)] text-[var(--chip-fg)]",
      )}
    >
      {label}
    </button>
  );
}

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

// ------------------------------------------------------------------------- icons

export function railGlyph(name: string): ReactNode {
  const g = (Icons as unknown as Record<string, ReactNode>)[name];
  return g && typeof g === "object" ? g : Icons.TilesIcon;
}

// ------------------------------------------------------------------------- the panel

export type RailItem = { id: string; label: string; icon: string };

/** 0.7 r3 (F1): the rail is Teacher's -- its IconButton, down CardBox's rail column. */
export function Rail({ items, active, onPick }: { items: RailItem[]; active: string; onPick: (id: string) => void }) {
  if (items.length < 2) return null;
  return (
    <>
      {items.map((it) => (
        <Icons.IconButton key={it.id} label={it.label} active={it.id === active} onClick={() => onPick(it.id)}>
          {railGlyph(it.icon)}
        </Icons.IconButton>
      ))}
    </>
  );
}

/** Phone: the large view's views become tabs (Phone.dc.html). */
export function Tabs({ items, active, onPick }: { items: RailItem[]; active: string; onPick: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-[14px] overflow-x-auto border-b border-[var(--panel-border)]">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={it.id === active} type="button" onClick={() => onPick(it.id)} className={cx("whitespace-nowrap border-b-2 px-[2px] py-2 text-[12px] font-bold", it.id === active ? "border-[var(--accent)] text-[var(--fg)]" : "border-transparent text-[var(--muted2)]")}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export type PanelMenuAction = PanelMenuItem;

/** One Admissions panel or large view. 0.7 r3 (F1): Teacher's own CardBox -- the same header
 * and icon row (PanelIconRow: the menu, full screen, a reserved collapse slot), the same rail,
 * the same footer notes (the source "i", the caption behind its button, the flag at the right)
 * and the same full screen. Only the size differs: Admissions' rows are 470 and 330 tall, and
 * the large view spans two columns. Admissions' own header line (tag · context) is the tag, its
 * chips sit right-aligned before the icon row. */
export function Panel({
  tag,
  context,
  chips,
  menu = [],
  rail,
  railActive,
  onRail,
  source,
  caption,
  visibleCaption,
  flag,
  controls,
  height,
  span = 1,
  title,
  children,
  id,
  onCopy,
}: {
  tag: string;
  context?: ReactNode;
  chips?: ReactNode;
  menu?: PanelMenuAction[];
  rail?: RailItem[];
  railActive?: string;
  onRail?: (id: string) => void;
  source?: ReactNode;
  // The panel's honesty note, behind the footer's caption button (Teacher's CaptionNote).
  caption?: ReactNode;
  // A line the panel shows without a click (CardBox's visibleCaption): the LA context, a link.
  visibleCaption?: ReactNode;
  flag?: ReactNode;
  // A row under the header (CardBox's controls): the phone's tabs.
  controls?: ReactNode;
  height: number | "auto";
  span?: 1 | 2;
  title: string;
  children: (o: { fullscreen: boolean }) => ReactNode;
  id?: string;
  // D8: "Copy this view…" (meeting slides; absent in View as and wherever a copy can't be saved).
  onCopy?: () => void;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      data-adm-panel={id}
      className="min-w-0 [&>div]:!mt-0"
      style={{ gridColumn: span === 2 ? "span 2" : undefined }}
    >
      <CardBox
        title={title}
        tag={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-[var(--fg)]">{tag}</span>
            {context && <span className="min-w-0 truncate whitespace-nowrap text-[11.5px] text-[var(--muted2)]">{context}</span>}
          </span>
        }
        headerExtra={chips}
        controls={controls}
        actions={rail && railActive && onRail && rail.length > 1 ? <Rail items={rail} active={railActive} onPick={onRail} /> : undefined}
        source={source}
        caption={caption}
        visibleCaption={visibleCaption}
        flag={flag}
        fixedHeight={height !== "auto"}
        height={height === "auto" ? undefined : height}
        menu={({ print }) => <PanelExport onPrint={print} onCopy={onCopy} extra={menu} />}
      >
        {({ fullscreen }) => <div className={cx("flex min-w-0 grow flex-col gap-2", height !== "auto" && "min-h-0")}>{children({ fullscreen })}</div>}
      </CardBox>
    </section>
  );
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
