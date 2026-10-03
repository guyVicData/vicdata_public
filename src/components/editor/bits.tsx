"use client";

// VicData 0.6 S5: the editor boards' primitives, one per board class (.ebtn, .inh/.ovr,
// .struct, .rowhead icon buttons, the dialogs' .opt/.radio/.label), sizes literal from
// docs/wireframes/v0.6. Dialogs are TeacherModal's "chooser" size holding the comparator
// chooser's Panel / Body / Footer and buttons -- one modal language with Add a view.
import { useRef, type CSSProperties, type ReactNode } from "react";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { Body, CloseButton, Footer, Panel } from "@/components/teacher/chooser/ui";
import { EC } from "@/lib/editor-layout";

// ------------------------------------------------------------------------- buttons

export function EBtn({
  children,
  onClick,
  primary = false,
  on = false,
  small = false,
  disabled = false,
  title,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  on?: boolean;
  small?: boolean;
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={on || undefined}
      style={{
        border: `1px solid ${primary ? EC.amber : on ? EC.amber : EC.btnBorder}`,
        background: primary ? EC.amber : EC.btnBg,
        color: primary ? EC.amberInk : on ? EC.amberText : EC.btnFg,
        borderRadius: 8,
        padding: small ? "4px 8px" : "6px 11px",
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        lineHeight: "normal",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// .icon-btn: 24px, radius 6, muted; `danger` in red.
export function IconBtn({ label, onClick, danger = false, active = false, disabled = false, children }: { label: string; onClick?: () => void; danger?: boolean; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 6,
        border: "1px solid transparent",
        background: active ? EC.hover : "transparent",
        color: danger ? EC.danger : active ? "var(--fg)" : "var(--muted2)",
        padding: 0,
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------------- badges

export function InheritBadge({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 600, color: EC.inhFg, background: EC.inhBg, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{children}</span>;
}

export function OverrideBadge({ children, title }: { children: ReactNode; title?: string }) {
  return <span title={title} style={{ fontSize: 10, fontWeight: 600, color: EC.amberText, background: EC.ovrBg, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{children}</span>;
}

// Skeleton's .pill (PLANNED / READY TO SWAP IN / LIVE VIEW).
export function StatePill({ kind }: { kind: "planned" | "ready" | "live" }) {
  const s =
    kind === "planned"
      ? { background: EC.gold, color: "#fff", text: "PLANNED" }
      : kind === "ready"
        ? { background: EC.ready, color: EC.readyInk, text: "READY TO SWAP IN" }
        : { background: `color-mix(in srgb, ${EC.ready} 14%, var(--panel-bg))`, color: EC.ready, text: "LIVE VIEW" };
  return <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", borderRadius: 999, padding: "2px 8px", width: "fit-content", background: s.background, color: s.color }}>{s.text}</span>;
}

// ------------------------------------------------------------------------- structures

// .struct: a row structure as cells weighted by the columns they cover.
export function StructIcon({ weights, on = false, light = false, onClick, label }: { weights: number[]; on?: boolean; light?: boolean; onClick?: () => void; label: string }) {
  // Editor (dark board): 64 x 30, padding 8, radius 8; RowSettings (light board): 58 x 26, padding 6.
  const box = light ? { w: 58, h: 26, pad: 6 } : { w: 64, h: 30, pad: 8 };
  const fill = on ? (light ? "var(--cc-primary)" : EC.amber) : light ? "var(--cc-radio)" : "var(--edge-strong)";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      style={{
        border: `1px solid ${on && light ? "var(--cc-primary)" : light ? "var(--cc-border2)" : "var(--panel-border2)"}`,
        outline: on && !light ? `1.5px solid ${EC.amber}` : "none",
        borderRadius: 8,
        background: light ? "var(--cc-panel)" : "var(--panel-bg)",
        padding: box.pad,
        display: "flex",
        gap: 3,
        width: box.w,
        height: box.h,
        boxSizing: "content-box",
        cursor: "pointer",
      }}
    >
      {weights.map((w, i) => (
        <span key={i} style={{ flex: `${w} 1 0`, borderRadius: 3, background: fill }} />
      ))}
    </button>
  );
}

// ------------------------------------------------------------------------- icons

const S = ({ children, size = 13, w = 2 }: { children: ReactNode; size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    {children}
  </svg>
);
export const PencilIcon = () => <S><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></S>;
export const CopyIcon = () => <S><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></S>;
export const DownIcon = () => <S><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></S>;
export const UpIcon = () => <S><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></S>;
export const TrashIcon = () => <S><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /></S>;
export const ChevronDown = ({ size = 12 }: { size?: number }) => <S size={size} w={2.4}><polyline points="6 9 12 15 18 9" /></S>;
export const ChevronRight = ({ size = 12 }: { size?: number }) => <S size={size} w={2.4}><polyline points="9 6 15 12 9 18" /></S>;
export const ChevronUp = ({ size = 14 }: { size?: number }) => <S size={size} w={2.2}><polyline points="18 15 12 9 6 15" /></S>;
export const PlusIcon = ({ size = 10 }: { size?: number }) => <S size={size} w={3}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></S>;
export const GearIcon = () => <S><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></S>;

// The standard elements every view carries (G7), drawn inert in the editor: source, note,
// export / copy, fullscreen (the board's .bottom-row).
export function StandardElements() {
  const ink = { display: "inline-flex", color: "var(--muted3)" } as const;
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: 14, right: 14, bottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1px solid var(--panel-border2)", color: "var(--muted3)", fontSize: 9.5, fontStyle: "italic", fontWeight: 700 }}>i</span>
      <span style={ink}><S size={13}><path d="M4 4h16v12H8l-4 4z" /></S></span>
      <span style={ink}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" /><path d="M3.5 14.5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" /></svg>
      </span>
      <span style={{ flexGrow: 1 }} />
      <span style={ink}>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><polyline points="7,2 2,2 2,7" /><polyline points="13,18 18,18 18,13" /></svg>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------------- dialogs

// A board dialog (RowSettings, ColumnChange, Assign...): title + one line, close, a
// scrolling body and a footer. Light boards; the --cc-* palette carries them to dark.
export function Dialog({ label, title, sub, onClose, footer, children, gap = 10 }: { label: string; title: string; sub?: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode; gap?: number }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <TeacherModal label={label} backdropLabel={`Close ${label}`} size="chooser" onClose={onClose} initialFocusRef={closeRef}>
      <Panel>
        {/* The boards' line-height is the browser's normal; the app's preflight sets 1.5. */}
        <style>{`.ed-dialog, .ed-dialog *{line-height:normal}`}</style>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--cc-ink)", letterSpacing: -0.2 }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: "var(--cc-sub)", marginTop: 2 }}>{sub}</div>}
          </div>
          <CloseButton onClose={onClose} closeRef={closeRef} />
        </div>
        <div className="ed-dialog" style={{ display: "contents" }}>
          <Body gap={gap}>{children}</Body>
          {footer && <Footer>{footer}</Footer>}
        </div>
      </Panel>
    </TeacherModal>
  );
}

// The boards' .label: 11px, 700, uppercase, #767d87.
export const DLabel = ({ children, top = 0 }: { children: ReactNode; top?: number }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cc-sub)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: top }}>{children}</div>
);

// .opt with its .radio: the inset-dot radio, title and one line.
export function Opt({ on, title, sub, onClick, align = "center", pad = "11px 14px" }: { on: boolean; title: ReactNode; sub?: ReactNode; onClick: () => void; align?: "center" | "flex-start"; pad?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      style={{ display: "flex", alignItems: align, gap: 12, border: `1px solid ${on ? "var(--cc-blue)" : "var(--cc-border)"}`, borderRadius: 10, padding: pad, background: on ? "var(--cc-blue-tint)" : "var(--cc-panel)", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer", flex: "0 0 auto" }}
    >
      <span
        style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${on ? "var(--cc-blue)" : "var(--cc-radio)"}`, background: on ? "var(--cc-blue)" : "transparent", boxShadow: on ? "inset 0 0 0 4px var(--cc-panel)" : "none", flex: "0 0 20px", boxSizing: "border-box", marginTop: align === "flex-start" ? 1 : 0 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--cc-sub)", marginTop: align === "flex-start" ? 2 : 1, lineHeight: align === "flex-start" ? 1.4 : undefined }}>{sub}</span>}
      </span>
    </button>
  );
}

// The boards' switch row ("Open when the dashboard loads", "Key VicData dashboard").
export function SwitchRow({ on, onChange, title, sub }: { on: boolean; onChange: (v: boolean) => void; title: string; sub?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--cc-border)", borderRadius: 10, padding: "11px 14px", background: "var(--cc-panel)", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer", flex: "0 0 auto" }}
    >
      <span style={{ flex: "1 1 auto" }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--cc-sub)", marginTop: 1 }}>{sub}</span>}
      </span>
      <span style={{ width: 38, height: 22, borderRadius: 999, background: on ? "var(--cc-primary)" : "var(--cc-border2)", position: "relative", flex: "0 0 38px" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: on ? "var(--cc-on-primary)" : "var(--cc-panel)" }} />
      </span>
    </button>
  );
}

// .segmented: a row of equal options, the chosen one filled.
export function Segmented<T extends string>({ options, value, onChange, label, pad = "7px 4px", fontSize = 11.5 }: { options: { id: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; label: string; pad?: string; fontSize?: number }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", border: "1px solid var(--cc-border2)", borderRadius: 8, overflow: "hidden", flex: "0 0 auto" }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          style={{ flex: "1 1 0", textAlign: "center", padding: pad, fontSize, fontWeight: 600, border: "none", color: o.id === value ? "var(--cc-on-primary)" : "var(--cc-label)", background: o.id === value ? "var(--cc-primary)" : "var(--cc-panel)", cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? 0.4 : 1 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputStyle: CSSProperties = {
  border: "1px solid var(--cc-border2)",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
  color: "var(--cc-ink)",
  background: "var(--cc-panel)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export function Note({ children, top = 0 }: { children: ReactNode; top?: number }) {
  return <div style={{ fontSize: 11, color: "var(--cc-faint)", lineHeight: 1.4, marginTop: top }}>{children}</div>;
}

export function ErrorLine({ children }: { children: ReactNode }) {
  return <div role="alert" style={{ fontSize: 12, color: "var(--cc-danger)", lineHeight: 1.4 }}>{children}</div>;
}
