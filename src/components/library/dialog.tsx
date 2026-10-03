"use client";

// VicData 0.6 S6: the dialog classes the Icon, CopyTo and CopyToMeeting boards share that
// the comparator chooser's ui.tsx doesn't already have (.segmented, .label, .dest, the
// note line), sizes literal from the boards, colours the --cc-* palette (light = the
// boards' hexes; dark = the dashboard's tokens).
import type { ReactNode } from "react";
import { CloseButton } from "@/components/teacher/chooser/ui";
import { COPY_UI } from "./layout";

// The boards' header: 17px title, 12px subtitle, close (ui.tsx's HubHeader with a title).
export function DialogHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flex: "0 0 auto" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--cc-ink)", letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--cc-sub)", marginTop: 2 }}>{subtitle}</div>
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

// .segmented: one bordered strip, the picked part filled.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  pad = "8px 10px",
  fontSize = 12.5,
}: {
  options: { id: T; label: string; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  pad?: string;
  fontSize?: number;
}) {
  return (
    <div role="tablist" style={{ display: "flex", border: "1px solid var(--cc-border2)", borderRadius: 8, overflow: "hidden", flex: "0 0 auto" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.id)}
            style={{
              flex: "1 1 0",
              textAlign: "center",
              padding: pad,
              fontSize,
              fontWeight: 600,
              border: "none",
              background: on ? "var(--cc-primary)" : "transparent",
              color: on ? "var(--cc-on-primary)" : "var(--cc-label)",
              opacity: o.disabled ? 0.45 : 1,
              cursor: o.disabled ? "not-allowed" : "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// .label: 11px uppercase section label.
export const Label = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cc-sub)", textTransform: "uppercase", letterSpacing: 0.5, flex: "0 0 auto", ...style }}>{children}</div>
);

// The small grey line under a list.
export const Note = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => (
  <div style={{ fontSize: 11, color: "var(--cc-faint)", lineHeight: 1.4, flex: "0 0 auto", ...style }}>{children}</div>
);

// .dest: a destination row (icon, title, sub, an optional right-hand tag).
export function DestRow({ on, icon, title, sub, tag, onClick, disabled }: { on: boolean; icon?: ReactNode; title: string; sub?: string; tag?: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: `1px solid ${on ? "var(--cc-blue)" : "var(--cc-border)"}`,
        borderRadius: 10,
        padding: COPY_UI.destPad,
        background: on ? "var(--cc-blue-tint)" : "var(--cc-panel)",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        flex: "0 0 auto",
      }}
    >
      {icon}
      <span style={{ flex: "1 1 auto", minWidth: 0, display: "block" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 11, color: "var(--cc-sub)" }}>{sub}</span>}
      </span>
      {tag}
    </button>
  );
}

// The dashed "+" square of "New dashboard" (CopyTo's .di with a dashed border).
export function PlusSquare() {
  return (
    <span style={{ width: COPY_UI.destIcon, height: COPY_UI.destIcon, flex: `0 0 ${COPY_UI.destIcon}px`, borderRadius: 8, border: "1.5px dashed var(--cc-radio)", color: "var(--cc-label)", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  );
}

// The boards' coloured notes: green "fits", amber "doesn't", blue "re-arranges".
export function Callout({ tone, icon, children }: { tone: "green" | "amber" | "blue"; icon: ReactNode; children: ReactNode }) {
  const c =
    tone === "green"
      ? { bg: "var(--cpv-green-bg)", border: "var(--cpv-green-border)", fg: "var(--cpv-green-fg)" }
      : tone === "amber"
        ? { bg: "var(--cc-banner-bg)", border: "var(--cc-banner-border)", fg: "var(--cc-banner-fg)" }
        : { bg: "var(--cc-blue-tint)", border: "var(--cpv-blue-border)", fg: "var(--cpv-blue-fg)" };
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: c.fg, lineHeight: 1.45, flex: "0 0 auto" }}>
      <span style={{ flex: "0 0 auto", marginTop: 1 }}>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

// Board colours the --cc-* palette lacks (light = the board's hex; dark = the same hue at
// the app's 400 level over a tint, as the chooser's own dark values are drawn):
//   green   CopyTo's fit line (#f0fdf4 / #bbf7d0 / #166534)
//   blue    CopyToMeeting's re-arrange line border and ink (#bfdbfe / #1e3a8a)
//   map     the slot map's box and slots (#0f0f10, #1a1a1a / #2a2a2a, #52525b dashed,
//           picked #60a5fa on #172033 with #bfdbfe ink) -- drawn in the dashboard's own
//           tokens, so it reads as the dashboard in either theme.
// Also: the boards' line-height is the browser's `normal` (the app's preflight sets 1.5),
// as the Add a view chooser found.
export const CPV_STYLES = `
.cpv-root{line-height:normal}
.cc-root{--cpv-green-bg:#f0fdf4;--cpv-green-border:#bbf7d0;--cpv-green-fg:#166534;--cpv-blue-border:#bfdbfe;--cpv-blue-fg:#1e3a8a;--cpv-map-bg:var(--bg,#f7f7f8);--cpv-slot-bg:var(--panel-bg,#ffffff);--cpv-slot-border:var(--panel-border2,#d8d8dd);--cpv-slot-fg:var(--muted,#6b6b72);--cpv-slot-dash:var(--edge-strong,#c7cbd1);--cpv-pick-border:#2563eb;--cpv-pick-bg:#eff6ff;--cpv-pick-fg:#1d4ed8;--cpv-new-bg:#dbeafe;--cpv-new-border:#93c5fd}
#teacher-root[data-theme="dark"] .cc-root{--cpv-green-bg:rgba(52,211,153,0.10);--cpv-green-border:rgba(52,211,153,0.32);--cpv-green-fg:#6ee7b7;--cpv-blue-border:rgba(96,165,250,0.32);--cpv-blue-fg:#bfdbfe;--cpv-pick-border:#60a5fa;--cpv-pick-bg:#172033;--cpv-pick-fg:#bfdbfe;--cpv-new-bg:#1e3a8a;--cpv-new-border:#93c5fd}
`;

export function CpvStyles() {
  return <style>{CPV_STYLES}</style>;
}
