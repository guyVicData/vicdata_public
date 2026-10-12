"use client";

// VicData 0.7 admissions r2: the Admissions boards' building blocks (docs/wireframes/admissions,
// Main / MarketShare), measured from the boards and drawn with the app's own tokens, never the
// boards' illustrative hexes:
//   #0a0a0a page → --bg · #141414 panel → --panel-bg · #232323 panel edge → --panel-border
//   #2a2a2a chip edge → --panel-border2 · #101010 inset → --box-bg · #f2f2f2 → --fg
//   #9a9a9a → --muted2 · #7a7a7a → --muted · #d4d4d4 / #c4c4c4 → --chip-fg
//   #22d3ee → --accent (ROLE_ACCENT.admissions) · #0f2329 → the accent at 0.14 (--adm-tint)
// The boards' semantic colours (green flag, red flag, note blue, amber, orange, greys) are
// Admissions variables below, a dark and a light value each, so both themes read.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ROLE_ACCENT } from "@/lib/teacher-view-theme";
import { SourceNote } from "@/components/teacher/PanelFooter";
import { ExpandIcon, MODAL_CLOSE_BUTTON_CLASS, TeacherModal } from "@/components/teacher/TeacherModal";
import { useDismiss } from "@/components/teacher/PanelMenu";
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
    "--adm-note-bg": dark ? "#1f2430" : "#dbeafe",
    "--adm-note-fg": dark ? "#93c5fd" : "#1d4ed8",
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
export function FChip({ children, onClick, title, chevron = true, active = false, disabled = false }: { children: ReactNode; onClick?: () => void; title?: string; chevron?: boolean; active?: boolean; disabled?: boolean }) {
  const cls = cx(
    "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[8px] border px-[10px] py-[5px] text-[11.5px] font-semibold",
    active ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]",
    "bg-[var(--box-bg)]",
    disabled && "opacity-60",
  );
  const body = (
    <>
      {children}
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
  note: "bg-[var(--adm-note-bg)] text-[var(--adm-note-fg)]",
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

/** The boards' 22px rail icon button: transparent, the inverted chip when active. */
function RailButton({ item, active, onClick }: { item: RailItem; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      aria-pressed={active}
      onClick={onClick}
      className={cx("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] [&>svg]:h-3 [&>svg]:w-3", active ? "bg-[var(--adm-rail-on)] text-[var(--fg)]" : "text-[var(--muted2)] hover:text-[var(--fg)]")}
    >
      {railGlyph(item.icon)}
    </button>
  );
}

export function Rail({ items, active, onPick }: { items: RailItem[]; active: string; onPick: (id: string) => void }) {
  if (items.length < 2) return null;
  return (
    <div role="toolbar" aria-label="Views" className="mr-[10px] flex shrink-0 flex-col gap-[3px] border-r border-[var(--panel-border)] pb-[2px] pl-0 pr-[9px] pt-[1px]">
      {items.map((it) => (
        <RailButton key={it.id} item={it} active={it.id === active} onClick={() => onPick(it.id)} />
      ))}
    </div>
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

export type PanelMenuAction = { label: string; onClick: () => void; disabled?: boolean; title?: string };

function DotsMenu({ actions }: { actions: PanelMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  if (!actions.length) return null;
  return (
    <span className="relative" ref={ref}>
      <button type="button" aria-label="Panel menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[var(--muted2)] hover:text-[var(--fg)]">
        &middot;&middot;&middot;
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-40 flex w-52 flex-col rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 shadow-[0_10px_24px_rgba(0,0,0,0.3)]">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              title={a.title}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className="rounded-[7px] px-2.5 py-1.5 text-left text-[12px] text-[var(--fg)] hover:bg-[var(--box-bg)] disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** One Admissions panel, as the boards draw it: a header line (tag, muted context, chips, ···),
 * an optional rail on the left of the body, and a bottom row pinned 10px from the edge (the
 * source "i", the panel's honesty line, the fullscreen mark). */
export function Panel({
  tag,
  context,
  chips,
  menu = [],
  rail,
  railActive,
  onRail,
  source,
  footer,
  height,
  span = 1,
  title,
  fullscreen = true,
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
  footer?: ReactNode;
  height: number | "auto";
  span?: 1 | 2;
  title: string;
  fullscreen?: boolean;
  children: (o: { fullscreen: boolean }) => ReactNode;
  id?: string;
  // D8: "Copy to meeting slides…" (absent in View as and wherever a copy can't be saved).
  onCopy?: () => void;
}) {
  const [full, setFull] = useState(false);
  // D8: "Print this view" -- the fullscreen view, printed alone (TeacherModal printable), as
  // Teacher's "Print this graph".
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const done = () => {
      setPrinting(false);
      setFull(false);
    };
    window.addEventListener("afterprint", done, { once: true });
    const t = window.setTimeout(() => window.print(), 350);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);
  const actions: PanelMenuAction[] = [
    { label: "Print this view", onClick: () => { setFull(true); setPrinting(true); } },
    ...(onCopy ? [{ label: "Copy to meeting slides…", onClick: onCopy }] : []),
    ...menu,
  ];
  const body = (isFull: boolean) => (
    <div className="flex min-h-0 grow">
      {rail && railActive && onRail && <Rail items={rail} active={railActive} onPick={onRail} />}
      <div className="flex min-w-0 grow flex-col gap-2">{children({ fullscreen: isFull })}</div>
    </div>
  );
  return (
    <section
      id={id}
      aria-label={title}
      data-adm-panel={id}
      className="relative flex flex-col gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-[14px] pb-9 pt-3"
      style={{ height: height === "auto" ? undefined : height, gridColumn: span === 2 ? "span 2" : undefined, boxSizing: "border-box" }}
    >
      <div className="flex items-center gap-[6px]">
        <span className="text-[11.5px] font-semibold text-[var(--chip-fg)]">{tag}</span>
        {context && <span className="text-[11.5px] text-[var(--muted2)]">{context}</span>}
        <span className="grow" />
        {chips}
        <DotsMenu actions={actions} />
      </div>
      {body(false)}
      <div className="absolute bottom-[10px] left-[14px] right-[14px] flex items-center gap-[6px]">
        {source ? <SourceNote>{source}</SourceNote> : <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full border border-[var(--panel-border2)] text-[9.5px] font-bold italic text-[var(--muted)]">i</span>}
        {footer}
        {fullscreen && (
          <>
            <span className="grow" />
            <button type="button" title="Fullscreen" aria-label={`${title}: fullscreen`} onClick={() => setFull(true)} className="inline-flex text-[var(--muted)] hover:text-[var(--fg)] [&>svg]:h-3 [&>svg]:w-3">
              <ExpandIcon expanded={false} />
            </button>
          </>
        )}
      </div>
      {full && (
        <TeacherModal label={title} backdropLabel="Close fullscreen" onClose={() => setFull(false)} printable={printing}>
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[var(--fg)]">{title}</span>
              <span className="grow" />
              {chips}
              <button type="button" className={MODAL_CLOSE_BUTTON_CLASS} aria-label="Exit fullscreen" onClick={() => setFull(false)}>
                <ExpandIcon expanded />
              </button>
            </div>
            {body(true)}
            {footer && <div className="flex items-center gap-2">{footer}</div>}
          </div>
        </TeacherModal>
      )}
    </section>
  );
}

export const Footer = ({ children }: { children: ReactNode }) => <span className="truncate text-[11px] text-[var(--muted2)]">{children}</span>;

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
