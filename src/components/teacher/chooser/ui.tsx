"use client";

// Comparator chooser: the wireframe's visual primitives
// (docs/wireframes/comparator-chooser-v29), one component per class in its <style>
// blocks, with every size, radius, weight and colour copied from those files.
//
// Colour: the wireframe is drawn light only. Its hexes are the LIGHT values here,
// verbatim; in Teacher view's dark theme each maps to the dashboard's own dark token
// (--panel-bg, --fg, --muted...) so the chooser is not a white slab on a dark page. The
// sector / gender / boarding chip and circle colours are tag-colours.ts's own pairs --
// the light half is exactly what the wireframe specifies, the dark half already exists.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { SchoolSearchResult } from "@/components/SchoolSearch";
import { formatKm, sectorSolid, type ChooserSchool } from "@/lib/comparator-chooser";
import type { SectorTag } from "@/lib/typology";

export const CHOOSER_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;

// The palette as CSS variables on the chooser's root. Light = the wireframe's hexes.
export function ChooserStyles() {
  return (
    <style>{`
.cc-root{--cc-panel:#ffffff;--cc-ink:#141413;--cc-sub:#767d87;--cc-faint:#9aa0a8;--cc-label:#5b6470;--cc-line:#eef0f2;--cc-border:#e3e5e9;--cc-border2:#d7dae0;--cc-radio:#c7cbd1;--cc-soft:#f7f8f9;--cc-chipbg:#f1f3f5;--cc-blue:#2563eb;--cc-blue-tint:#eff6ff;--cc-blue-badge:#dbeafe;--cc-primary:#141413;--cc-on-primary:#ffffff;--cc-banner-bg:#fff3d6;--cc-banner-border:#f1d896;--cc-banner-fg:#8a5a00;--cc-danger:#b91c1c;--cc-size-bg:#f0ece0;--cc-size-fg:#b3ab99;--cc-gold:#a97a1f;--cc-divider:#f1f3f5;--cc-green:#15803d;--cc-shadow:0 12px 32px rgba(20,20,19,0.18)}
#teacher-root[data-theme="dark"] .cc-root{--cc-panel:var(--panel-bg);--cc-ink:var(--fg);--cc-sub:var(--muted);--cc-faint:var(--muted3);--cc-label:var(--muted2);--cc-line:var(--panel-border);--cc-border:var(--panel-border);--cc-border2:var(--panel-border2);--cc-radio:var(--muted3);--cc-soft:var(--box-bg);--cc-chipbg:rgba(255,255,255,0.07);--cc-blue:#60a5fa;--cc-blue-tint:rgba(96,165,250,0.12);--cc-blue-badge:rgba(96,165,250,0.22);--cc-primary:var(--fg);--cc-on-primary:var(--bg);--cc-banner-bg:rgba(250,204,21,0.10);--cc-banner-border:rgba(250,204,21,0.32);--cc-banner-fg:#fcd34d;--cc-danger:#f87171;--cc-size-bg:rgba(224,178,61,0.10);--cc-size-fg:var(--muted3);--cc-gold:#e0b23d;--cc-divider:var(--panel-border);--cc-green:#4ade80;--cc-shadow:0 12px 32px rgba(0,0,0,0.5)}
.cc-root button{font-family:inherit}
.cc-scroll{scrollbar-width:thin}
`}</style>
  );
}

// ------------------------------------------------------------------------------ icons

type SvgProps = { size?: number; stroke?: string; width?: number };
const Svg = ({ size = 16, stroke = "currentColor", width = 2, children }: SvgProps & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    {children}
  </svg>
);
export const TickIcon = (p: SvgProps) => <Svg {...p}><polyline points="20 6 9 17 4 12" /></Svg>;
export const CloseIcon = (p: SvgProps) => <Svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
export const BackIcon = (p: SvgProps) => <Svg {...p}><polyline points="15 18 9 12 15 6" /></Svg>;
export const SearchIcon = (p: SvgProps) => <Svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
export const DotsIcon = (p: SvgProps) => <Svg {...p}><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></Svg>;
export const ChevronDownIcon = (p: SvgProps) => <Svg {...p}><polyline points="6 9 12 15 18 9" /></Svg>;
export const PlusIcon = (p: SvgProps) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
export const AlertIcon = (p: SvgProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Svg>;
// The wireframe's two school glyphs: a university building (day) and a bed (boarders).
export const UniversityGlyph = (p: SvgProps) => (
  <Svg {...p}><polyline points="4 9 12 4 20 9" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="6" y1="9" x2="6" y2="18" /><line x1="10" y1="9" x2="10" y2="18" /><line x1="14" y1="9" x2="14" y2="18" /><line x1="18" y1="9" x2="18" y2="18" /><line x1="3" y1="20" x2="21" y2="20" /></Svg>
);
export const BedGlyph = (p: SvgProps) => (
  <Svg {...p}><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></Svg>
);
const DayLegendGlyph = () => (
  <Svg size={10} stroke="var(--cc-sub)" width={2.4}><polyline points="4 9 12 4 20 9" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="20" x2="21" y2="20" /></Svg>
);
const BoardersLegendGlyph = () => (
  <Svg size={10} stroke="var(--cc-sub)" width={2.4}><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /></Svg>
);

// ------------------------------------------------------------------------------ shell

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      className="cc-root flex h-full w-full flex-col overflow-hidden"
      style={{ background: "var(--cc-panel)", borderRadius: 14, boxShadow: "var(--cc-shadow)", fontFamily: CHOOSER_FONT, color: "var(--cc-ink)" }}
    >
      <ChooserStyles />
      {children}
    </div>
  );
}

const iconBtnStyle = { width: 32, height: 32, borderRadius: "50%", background: "var(--cc-chipbg)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 32px" } as const;

export function CloseButton({ onClose, closeRef }: { onClose: () => void; closeRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} style={iconBtnStyle}>
      <CloseIcon stroke="var(--cc-label)" />
    </button>
  );
}

// Screen 1's header: the big title, the running count beneath.
export function HubHeader({ subtitle, onClose, closeRef }: { subtitle: string; onClose: () => void; closeRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto" }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--cc-ink)", letterSpacing: -0.2 }}>Comparator schools</div>
        <div style={{ fontSize: 12, color: "var(--cc-sub)", marginTop: 2 }}>{subtitle}</div>
      </div>
      <CloseButton onClose={onClose} closeRef={closeRef} />
    </div>
  );
}

// Every later screen's header: back, a title and one line under it, close.
export function StepHeader({ title, subtitle, onBack, onClose }: { title: string; subtitle: string; onBack: () => void; onClose: () => void }) {
  return (
    <div style={{ padding: "14px 14px 14px 8px", borderBottom: "1px solid var(--cc-line)", display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
      <button type="button" aria-label="Back" onClick={onBack} style={{ ...iconBtnStyle, background: "none" }}>
        <BackIcon size={18} stroke="var(--cc-ink)" />
      </button>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--cc-sub)", marginTop: 1 }}>{subtitle}</div>
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

export function Body({ gap = 10, children }: { gap?: number; children: ReactNode }) {
  return (
    <div className="cc-scroll" style={{ flex: "1 1 auto", overflowY: "auto", padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap }}>
      {children}
    </div>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "12px 18px", borderTop: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto", gap: 8 }}>
      {children}
    </div>
  );
}

export const FooterCount = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 13, color: "var(--cc-label)" }}>{children}</div>;

// ---------------------------------------------------------------------------- buttons

const btnBase = { border: "none", borderRadius: 20, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" } as const;

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...btnBase, background: "var(--cc-primary)", color: "var(--cc-on-primary)", opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}
export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...btnBase, background: "var(--cc-panel)", color: "var(--cc-ink)", border: "1px solid var(--cc-border2)", opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}
export function DangerGhostButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...btnBase, background: "none", color: "var(--cc-danger)", padding: "9px 6px", borderRadius: 8, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}
export function GhostWideButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...btnBase, background: "var(--cc-panel)", border: "1px solid var(--cc-border2)", color: "var(--cc-ink)", padding: "8px 14px", fontSize: 12.5, width: "100%" }}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------------ hub rows

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cc-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{children}</div>
);

export function Radio({ on }: { on: boolean }) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${on ? "var(--cc-blue)" : "var(--cc-radio)"}`, background: on ? "var(--cc-blue)" : "transparent", flex: "0 0 20px", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
      {on && <TickIcon size={11} stroke="#ffffff" width={3} />}
    </div>
  );
}

export function Badge({ active, children, stacked }: { active: boolean; children: ReactNode; stacked?: boolean }) {
  return (
    <div style={{ marginLeft: stacked ? 0 : "auto", display: "inline-block", fontSize: 11, color: active ? "var(--cc-blue)" : "var(--cc-label)", background: active ? "var(--cc-blue-badge)" : "var(--cc-chipbg)", borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

// A "start from" row. `badge` + `badgeNote` stack right-aligned (10 nearest, LA); a bare
// `badge` sits alone at the end (saved sets).
export function HubRow({
  active,
  title,
  subtitle,
  note,
  badge,
  badgeNote,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  note?: string | null;
  badge?: string | null;
  badgeNote?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${active ? "var(--cc-blue)" : "var(--cc-border)"}`, borderRadius: 10, padding: "12px 14px", background: active ? "var(--cc-blue-tint)" : "var(--cc-panel)", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer" }}
    >
      <Radio on={active} />
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--cc-sub)", marginTop: 1 }}>{subtitle}</div>
        {note && <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: 1 }}>{note}</div>}
      </div>
      {badge && badgeNote !== undefined ? (
        <div style={{ flex: "0 0 auto", textAlign: "right" }}>
          <Badge active={active} stacked>{badge}</Badge>
          {badgeNote && <div style={{ fontSize: 10.5, color: "var(--cc-faint)", marginTop: 4, whiteSpace: "nowrap" }}>{badgeNote}</div>}
        </div>
      ) : badge ? (
        <Badge active={active}>{badge}</Badge>
      ) : null}
    </button>
  );
}

export function SubList({ children }: { children: ReactNode }) {
  return <div style={{ margin: "-2px 0 0 32px", padding: "6px 10px", background: "var(--cc-soft)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>;
}
export const SubLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cc-faint)", textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 4px 0" }}>{children}</div>
);
export function SubRow({ active, label, count, onClick, menu }: { active: boolean; label: string; count: string; onClick: () => void; menu?: ReactNode }) {
  return (
    <div
      role="radio"
      aria-checked={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px", cursor: "pointer", borderRadius: 6 }}
    >
      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${active ? "var(--cc-blue)" : "var(--cc-radio)"}`, flex: "0 0 16px", background: active ? "var(--cc-blue)" : "var(--cc-panel)", boxShadow: active ? "inset 0 0 0 3px var(--cc-panel)" : "none", boxSizing: "border-box" }} />
      <div style={{ fontSize: 12.5, color: "var(--cc-ink)", flex: "1 1 auto", minWidth: 0 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>{count}</div>
      {menu}
    </div>
  );
}

// The "⋯" on an editable sub-row, opening a small menu of its actions.
export function RowMenu({ label, items }: { label: string; items: { label: string; danger?: boolean; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`More: ${label}`} aria-expanded={open} onClick={() => setOpen(!open)} style={{ width: 24, height: 24, borderRadius: "50%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 24px" }}>
        <DotsIcon size={14} stroke="var(--cc-sub)" />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: 26, zIndex: 5, minWidth: 128, background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, boxShadow: "0 8px 20px rgba(20,20,19,0.14)", padding: 4 }}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onSelect(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 10px", fontSize: 12.5, borderRadius: 6, cursor: "pointer", color: it.danger ? "var(--cc-danger)" : "var(--cc-ink)" }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BuildRow({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", cursor: "pointer", color: "var(--cc-blue)", fontSize: 12.5, fontWeight: 600, background: "none", border: "none", textAlign: "left" }}>
      <PlusIcon size={14} stroke="var(--cc-blue)" width={2.2} />
      Build a new ranking
    </button>
  );
}

// ------------------------------------------------------------------ school lists (2a-c)

// The circle: sector as its fill, boarding as its glyph. The ranked lists (2a, 2c) use a
// 20px circle with the full building/bed glyphs; 2b's checklist a compact 18px one with
// the wireframe's simpler 10px glyphs (the legend's own two).
export function IconCircle({ sector, boarders, compact = false }: { sector: SectorTag | null; boarders: boolean; compact?: boolean }) {
  const size = compact ? 18 : 20;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flex: `0 0 ${size}px`, display: "flex", alignItems: "center", justifyContent: "center", background: sectorSolid(sector) }}>
      {compact ? (
        boarders ? (
          <Svg size={10} stroke="#fff" width={2.4}><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /></Svg>
        ) : (
          <Svg size={10} stroke="#fff" width={2.4}><polyline points="4 9 12 4 20 9" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="20" x2="21" y2="20" /></Svg>
        )
      ) : boarders ? (
        <BedGlyph size={11} stroke="#fff" width={2.2} />
      ) : (
        <UniversityGlyph size={11} stroke="#fff" width={2.2} />
      )}
    </div>
  );
}

const LEGEND_LABEL: Record<SectorTag, string> = { State: "State", Independent: "Independent", FE: "FE / post-16 college", "Special Schools": "Special school" };

// Only what the list actually shows: its sectors, then day and/or has-boarders.
export function Legend({ schools, showDay = true }: { schools: ChooserSchool[]; showDay?: boolean }) {
  const order: SectorTag[] = ["State", "FE", "Independent", "Special Schools"];
  const sectors = order.filter((s) => schools.some((x) => x.sector === s));
  const anyBoarders = schools.some((x) => x.boarders);
  const anyDay = schools.some((x) => !x.boarders);
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 10.5, color: "var(--cc-sub)", padding: "2px 2px 0" }}>
      {sectors.map((s) => (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: sectorSolid(s) }} />
          {LEGEND_LABEL[s]}
        </span>
      ))}
      {showDay && anyDay && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><DayLegendGlyph />day</span>
      )}
      {anyBoarders && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><BoardersLegendGlyph />has boarders</span>
      )}
    </div>
  );
}

export function RankRow({ rank, school, extra, onRemove, topRule }: { rank: string; school: ChooserSchool; extra?: ReactNode; onRemove?: () => void; topRule?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: topRule ? "10px 2px 7px" : "7px 2px", ...(topRule ? { borderTop: "1px solid var(--cc-divider)", marginTop: 4 } : {}) }}>
      <div style={{ width: 16, fontSize: 12, fontWeight: 700, color: "var(--cc-faint)", textAlign: "center", flex: "0 0 16px" }}>{rank}</div>
      <IconCircle sector={school.sector} boarders={school.boarders} />
      <div style={{ fontSize: 13, color: "var(--cc-ink)", flex: "1 1 auto", minWidth: 0 }}>
        {school.name}
        {extra}
      </div>
      <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>{formatKm(school.distanceKm)}</div>
      {onRemove && (
        <button type="button" aria-label={`Remove ${school.name}`} onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <CloseIcon size={12} stroke="var(--cc-faint)" />
        </button>
      )}
    </div>
  );
}

export function Check({ on, partial }: { on: boolean; partial?: boolean }) {
  return (
    <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on || partial ? "var(--cc-blue)" : "var(--cc-radio)"}`, flex: "0 0 18px", display: "flex", alignItems: "center", justifyContent: "center", background: on || partial ? "var(--cc-blue)" : "var(--cc-panel)", boxSizing: "border-box" }}>
      {on ? <TickIcon size={10} stroke="#fff" width={3} /> : partial ? <div style={{ width: 8, height: 2, borderRadius: 1, background: "#fff" }} /> : null}
    </div>
  );
}

export function Divider({ margin = "10px 0 4px" }: { margin?: string }) {
  return <div style={{ height: 1, background: "var(--cc-line)", margin }} />;
}

export function Stepper({ label, onLess, onMore, lessDisabled, busy }: { label: string; onLess: () => void; onMore: () => void; lessDisabled?: boolean; busy?: boolean }) {
  const step = (disabled?: boolean) =>
    ({ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--cc-border2)", background: "var(--cc-panel)", fontSize: 15, fontWeight: 700, color: "var(--cc-ink)", cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }) as const;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "11px 10px", border: "1px solid var(--cc-border)", borderRadius: 10, background: "var(--cc-soft)" }}>
      <button type="button" aria-label="Show 5 fewer" onClick={onLess} disabled={lessDisabled || busy} style={step(lessDisabled || busy)}>−5</button>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cc-ink)", opacity: busy ? 0.5 : 1 }}>{label}</div>
      <button type="button" aria-label="Show 5 more" onClick={onMore} disabled={busy} style={step(busy)}>+5</button>
    </div>
  );
}

export const Hint = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: 5, padding: "0 2px", lineHeight: 1.4 }}>{children}</div>
);

// "Add a specific school by name": the site's own search (the search_schools RPC that
// SchoolSearch.tsx calls, same query, debounce and minimum length), in the wireframe's
// search row rather than SchoolSearch's own full-width box.
export function AddByName({ placeholder, onPick, exclude }: { placeholder: string; onPick: (school: SchoolSearchResult) => void; exclude: Set<string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_schools", { p_query: q, p_limit: 20 });
      if (cancelled) return;
      setLoading(false);
      if (!error && data) setResults(data as SchoolSearchResult[]);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, supabase]);
  const shown = query.trim().length >= 2 ? results.filter((r) => !exclude.has(r.urn)) : [];
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--cc-border)", borderRadius: 10, padding: "9px 12px", background: "var(--cc-soft)" }}>
        <SearchIcon size={15} stroke="var(--cc-faint)" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{ border: "none", background: "none", fontSize: 13, color: "var(--cc-ink)", outline: "none", width: "100%", fontFamily: "inherit" }}
        />
      </div>
      {query.trim().length >= 2 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 6, maxHeight: 220, overflowY: "auto", background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 10, boxShadow: "0 8px 20px rgba(20,20,19,0.14)" }}>
          {loading && shown.length === 0 ? (
            <div style={{ padding: "9px 12px", fontSize: 12.5, color: "var(--cc-faint)" }}>Searching…</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: "9px 12px", fontSize: 12.5, color: "var(--cc-faint)" }}>No schools found</div>
          ) : (
            shown.map((r) => (
              <button
                key={r.urn}
                type="button"
                onClick={() => { onPick(r); setQuery(""); setResults([]); }}
                style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--cc-line)", padding: "8px 12px", cursor: "pointer" }}
              >
                <div style={{ fontSize: 13, color: "var(--cc-ink)" }}>{r.current_name}</div>
                <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>{[r.town, r.postcode].filter(Boolean).join(", ")}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--cc-banner-bg)", border: "1px solid var(--cc-banner-border)", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "var(--cc-banner-fg)", flex: "1 1 auto" }}>
      <div style={{ flex: "0 0 auto", marginTop: 1 }}><AlertIcon size={14} stroke="var(--cc-banner-fg)" /></div>
      <div>{children}</div>
    </div>
  );
}

// "Name this set" / "Name this ranking", plus -- for someone who may create the school's
// shared sets -- the wireframe's segmented control (its .segmented class) choosing
// between a personal and a school-wide save.
export function SaveBox({
  title,
  name,
  onName,
  placeholder,
  canShare,
  shared,
  onShared,
  note,
}: {
  title: string;
  name: string;
  onName: (v: string) => void;
  placeholder: string;
  canShare: boolean;
  shared: boolean;
  onShared: (v: boolean) => void;
  note?: string | null;
}) {
  const seg = (on: boolean) => ({ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: on ? "var(--cc-on-primary)" : "var(--cc-label)", background: on ? "var(--cc-primary)" : "transparent", cursor: "pointer", border: "none" }) as const;
  return (
    <div style={{ border: "1px solid var(--cc-border)", borderRadius: 10, padding: 12, background: "var(--cc-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</div>
      <input
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder={placeholder}
        aria-label={title}
        style={{ border: "1px solid var(--cc-border2)", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--cc-ink)", outline: "none", background: "var(--cc-panel)" }}
      />
      {canShare && (
        <div style={{ display: "flex", border: "1px solid var(--cc-border2)", borderRadius: 8, overflow: "hidden", width: "fit-content" }} role="radiogroup" aria-label="Who can use it">
          <button type="button" role="radio" aria-checked={!shared} onClick={() => onShared(false)} style={seg(!shared)}>Just me</button>
          <button type="button" role="radio" aria-checked={shared} onClick={() => onShared(true)} style={seg(shared)}>Whole school</button>
        </div>
      )}
      {note && <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>{note}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- rankings (3a/3b)

export const FilterLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cc-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{children}</div>
);

export function FilterBox({ children }: { children: ReactNode }) {
  return <div style={{ border: "1px solid var(--cc-border)", borderRadius: 10, padding: 10, background: "var(--cc-soft)" }}>{children}</div>;
}

// A small chip (.chip.sm). Active: the neutral black fill, or -- given a colour pair --
// the tinted form the wireframe uses for sector, gender and boarding.
export function Chip({
  active,
  onClick,
  children,
  pair,
  dot,
  subtle,
  ariaLabel,
  size = "sm",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  pair?: [string, string] | null;
  dot?: string | null;
  subtle?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
}) {
  // Border as longhands, always all three: an active chip overrides the colour, and a
  // shorthand here would leave React unsetting borderColor alone on the way back to
  // inactive -- resetting it to the text colour (a dark ring on every "All"/"Any").
  const style: React.CSSProperties = {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--cc-border2)",
    borderRadius: 20,
    padding: size === "sm" ? "4px 8px" : "6px 12px",
    fontSize: size === "sm" ? 11 : 12,
    fontWeight: 600,
    color: "var(--cc-label)",
    background: "var(--cc-panel)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
  };
  if (active && pair) Object.assign(style, { background: pair[0], borderColor: pair[1], color: pair[1] });
  else if (active) Object.assign(style, { background: "var(--cc-primary)", borderColor: "var(--cc-primary)", color: "var(--cc-on-primary)" });
  return (
    <button type="button" aria-pressed={active} aria-label={ariaLabel} onClick={onClick} style={style}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", marginRight: 5, flex: "0 0 7px", background: dot }} />}
      {subtle ? <span style={{ opacity: 0.62, fontWeight: 500 }}>{children}</span> : children}
    </button>
  );
}

// The Group-by chips on 2b (.chip without .sm, active = blue).
export function GroupChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{ border: `1px solid ${active ? "var(--cc-blue)" : "var(--cc-border2)"}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: active ? "#fff" : "var(--cc-label)", background: active ? "var(--cc-blue)" : "var(--cc-panel)", cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {children}
    </button>
  );
}

// XS-XL: the public pages' own size-badge convention (PhaseBreakdownCard.tsx) -- 25px,
// 7px radius, muted sand, gold when active.
export function SizeSquare({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Size ${label}`}
      onClick={onClick}
      style={{ width: 25, height: 25, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, background: active ? "var(--cc-gold)" : "var(--cc-size-bg)", color: active ? "#fff" : "var(--cc-size-fg)", cursor: "pointer", border: "none" }}
    >
      {label}
    </button>
  );
}

export function StatCard({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ flex: "0 0 100px", border: "1px solid var(--cc-border)", borderRadius: 10, padding: "10px 8px", background: "var(--cc-soft)", display: "flex", flexDirection: "column", gap: 2, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--cc-ink)", lineHeight: 1.1 }}>{num}</div>
      <div style={{ fontSize: 10.5, color: "var(--cc-sub)", lineHeight: 1.25 }}>{label}</div>
    </div>
  );
}

export function IncludesBox({ lines }: { lines: string[] }) {
  return (
    <div style={{ flex: "1 1 auto", border: "1px solid var(--cc-border)", borderRadius: 10, padding: "9px 11px", background: "var(--cc-soft)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
      {lines.map((l) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--cc-label)", padding: "2px 0" }}>
          <TickIcon size={12} stroke="var(--cc-green)" width={3} />
          {l}
        </div>
      ))}
    </div>
  );
}
