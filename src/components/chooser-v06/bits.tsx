"use client";

// The "Add a view" boards' primitives that the comparator chooser's ui.tsx doesn't already
// have, one per board class (.card, .rail, .seg, .seg2, .chip, .toggle, .warn, .count...),
// sizes literal from docs/wireframes/v0.6. Colours are the --cc-* / --av-* variables.
import type { ReactNode } from "react";
import * as Icons from "@/components/teacher/PanelIcons";
import { BackIcon, CloseButton, AlertIcon } from "@/components/teacher/chooser/ui";
import { AV_STYLES, L } from "./layout";

export function AvStyles() {
  return <style>{AV_STYLES + `.av-rail svg{width:${L.railGlyph}px;height:${L.railGlyph}px;display:block}.av-mini svg{width:11px;height:11px;display:block}.av-qi svg{width:10px;height:10px;display:block}`}</style>;
}

// The dataview's STANDARD rail icon: the same glyph the panel rail draws (PanelIcons), on
// the rail's active look (fg on bg -- the board's dark square in the light theme).
export function railGlyph(name: string): ReactNode {
  const g = (Icons as Record<string, unknown>)[name];
  return (g as ReactNode) ?? Icons.TilesIcon;
}

export function RailBadge({ icon }: { icon: string }) {
  return (
    <span
      className="av-rail"
      aria-hidden="true"
      style={{ width: L.rail, height: L.rail, borderRadius: L.railRadius, background: "var(--cc-primary)", color: "var(--cc-on-primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: `0 0 ${L.rail}px`, alignSelf: "flex-start" }}
    >
      {railGlyph(icon)}
    </span>
  );
}

// The board's radio (.radio): an inset dot when on.
export function Dot({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, borderRadius: "50%", border: `1.5px solid ${on ? "var(--cc-blue)" : "var(--cc-radio)"}`, background: on ? "var(--cc-blue)" : "transparent", boxShadow: on ? "inset 0 0 0 3px var(--cc-panel)" : "none", flex: `0 0 ${size}px`, boxSizing: "border-box" }}
    />
  );
}

export function WarnTag({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 4, marginTop: 5, fontSize: 10.5, fontWeight: 600, color: "var(--cc-banner-fg)", background: "var(--cc-banner-bg)", border: "1px solid var(--cc-banner-border)", borderRadius: 6, padding: "2px 6px", lineHeight: 1.35 }}>
      <span style={{ flex: "0 0 auto", marginTop: 1.5 }}><AlertIcon size={10} stroke="currentColor" width={2.6} /></span>
      <span>{children}</span>
    </span>
  );
}

// A Pick card (.card): radio, title + meta (+ tags), rail icon, preview.
export function ViewCard({
  on,
  title,
  meta,
  tags,
  icon,
  preview,
  onClick,
}: {
  on: boolean;
  title: string;
  meta: string;
  tags?: ReactNode;
  icon: string;
  preview: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: L.cardGap, border: `1px solid ${on ? "var(--cc-blue)" : "var(--cc-border)"}`, borderRadius: L.cardRadius, padding: L.cardPad, background: on ? "var(--cc-blue-tint)" : "var(--cc-panel)", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer" }}
    >
      <Dot on={on} />
      <span style={{ flex: "1 1 auto", minWidth: 0, display: "block" }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--cc-ink)", lineHeight: 1.3 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--cc-sub)", marginTop: 2 }}>{meta}</span>
        {tags}
      </span>
      <RailBadge icon={icon} />
      {preview}
    </button>
  );
}

// Section headings inside the list (.label / the 10.5px group headings).
export function GroupHeading({ children, colour = "var(--cc-sub)", top = 2 }: { children: ReactNode; colour?: string; top?: number }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, color: colour, textTransform: "uppercase", letterSpacing: 0.4, marginTop: top }}>{children}</div>;
}

export const StepLabel = ({ children, top = 0 }: { children: ReactNode; top?: number }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cc-sub)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: top }}>{children}</div>
);

export const SubLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cc-sub)", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</div>
);

// The stepped header (Ch3Pick, Ch1Data, Ch2Focus): back, title + subtitle, close, and the
// three .seg bars. `segs` = how many are done; null = the plain header (Ch3Adjust, 2a, 2b).
export function AvHeader({
  title,
  subtitle,
  segs,
  onBack,
  onClose,
}: {
  title: string;
  subtitle: string;
  segs: number | null;
  onBack: (() => void) | null;
  onClose: () => void;
}) {
  const top = (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {onBack ? (
        <button type="button" aria-label="Back" onClick={onBack} style={{ width: 32, height: 32, borderRadius: "50%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 32px" }}>
          <BackIcon size={18} stroke="var(--cc-ink)" />
        </button>
      ) : (
        <span style={{ width: 10, flex: "0 0 10px" }} />
      )}
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--cc-sub)", marginTop: 1 }}>{subtitle}</div>
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
  return (
    <div
      style={{
        padding: segs === null ? "14px 14px 14px 8px" : "14px 14px 12px 8px",
        borderBottom: "1px solid var(--cc-line)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flex: "0 0 auto",
      }}
    >
      {top}
      {segs !== null && (
        <div style={{ display: "flex", gap: 4, paddingLeft: 10 }} aria-label={`Step ${Math.max(segs, 1)} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ flex: "1 1 0", height: L.segHeight, borderRadius: 2, background: i < segs ? "var(--cc-primary)" : "var(--cc-border)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// The "From this column" box (Ch3Pick, PickEither, Ch3Empty).
export function ContextBox({ label, line, onChange }: { label: string | null; line: string; onChange?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--cc-border)", borderRadius: 10, padding: "10px 12px", background: "var(--cc-soft)" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        {label && <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cc-sub)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>}
        <div style={{ fontSize: 12.5, color: "var(--cc-ink)", marginTop: label ? 2 : 0, lineHeight: 1.4 }}>{line}</div>
      </div>
      {onChange && (
        <button type="button" onClick={onChange} style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-blue)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          Change
        </button>
      )}
    </div>
  );
}

// Two-way segmented control (.seg2 and Ch3Pick's tab strip).
export function Seg2<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
}: {
  options: { id: T; label: string; disabled?: boolean }[];
  value: T | null;
  onChange: (id: T) => void;
  size?: "md" | "sm" | "tab";
  ariaLabel: string;
}) {
  const pad = size === "tab" ? "7px 8px" : size === "md" ? "7px 6px" : "6px 6px";
  const fs = size === "tab" ? 12 : size === "md" ? 12.5 : 11.5;
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: "flex", border: "1px solid var(--cc-border2)", borderRadius: 8, overflow: "hidden" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            style={{ flex: "1 1 0", textAlign: "center", padding: pad, fontSize: fs, fontWeight: 600, color: on ? "var(--cc-on-primary)" : "var(--cc-label)", background: on ? "var(--cc-primary)" : "var(--cc-panel)", border: "none", cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? 0.45 : 1 }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// The boards' chip (.chip): active = filled, off = dashed and unpickable, more = dashed but
// pickable (Custom area…), soon = faded. `size` follows each board's padding.
export function BoardChip({
  active = false,
  off = false,
  more = false,
  onClick,
  children,
  size = "sm",
  title,
}: {
  active?: boolean;
  off?: boolean;
  more?: boolean;
  onClick?: () => void;
  children: ReactNode;
  size?: "xs" | "sm" | "md";
  title?: string;
}) {
  const pad = size === "xs" ? "4px 9px" : size === "sm" ? "4px 10px" : "6px 11px";
  const fs = size === "md" ? 12 : 11.5;
  return (
    <button
      type="button"
      aria-pressed={off ? undefined : active}
      aria-disabled={off || undefined}
      disabled={off}
      title={title}
      onClick={off ? undefined : onClick}
      style={{
        borderWidth: 1,
        borderStyle: off || more ? "dashed" : "solid",
        borderColor: active ? "var(--cc-primary)" : "var(--cc-border2)",
        borderRadius: 20,
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        color: active ? "var(--cc-on-primary)" : off ? "var(--cc-faint)" : "var(--cc-label)",
        background: active ? "var(--cc-primary)" : off ? "transparent" : "var(--cc-panel)",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        cursor: off ? "default" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

// `disabled` (0.6 snag 4 / 01): shown, inert and faded -- a choice that's "Coming soon".
export function Toggle({ on, onChange, label, size = "sm", disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; size?: "sm" | "md"; disabled?: boolean }) {
  const t = size === "sm" ? L.toggleSm : L.toggleMd;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled || undefined}
      onClick={disabled ? undefined : () => onChange(!on)}
      style={{ width: t.w, height: t.h, borderRadius: 999, background: on ? "var(--cc-primary)" : "var(--cc-border2)", position: "relative", flex: `0 0 ${t.w}px`, border: "none", cursor: disabled ? "default" : "pointer", padding: 0, ...(disabled ? { opacity: 0.4 } : {}) }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? t.w - t.knob - 3 : 3, width: t.knob, height: t.knob, borderRadius: "50%", background: on ? "var(--cc-on-primary)" : "var(--cc-panel)" }} />
    </button>
  );
}

export function CountBadge({ n, noun = "view" }: { n: number; noun?: string }) {
  return (
    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: "var(--cc-blue)", background: "var(--cc-blue-badge)", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {n} {n === 1 ? noun : `${noun}s`}
    </span>
  );
}

export const fieldStyle = {
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
} as const;
