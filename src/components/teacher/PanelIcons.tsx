"use client";

// Teacher view, round 6: the panel mechanism's icon set and its two small controls.
//
// The glyphs are the round-6 wireframe's own paths, copied rather than approximated --
// every board draws the same bar/table/donut/map/remove marks at the same 20x20 viewBox,
// and §14's "pixel-identical icon language everywhere a pattern appears" only holds if
// there is one copy of each. The fullscreen glyph is deliberately NOT here: CardBox
// already renders the app's own ExpandIcon, and a second fullscreen mark would be exactly
// the drift §14 exists to stop.
import type { ReactNode } from "react";

function Glyph({ children, fill = false, size = 15 }: { children: ReactNode; fill?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? undefined : "currentColor"}
      strokeWidth={fill ? undefined : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Add picker rows, in the wireframe's own order.
export const PANEL_PICKER_ICONS = {
  current: (
    <Glyph size={16}>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <line x1="3" y1="8" x2="17" y2="8" />
    </Glyph>
  ),
  trend: (
    <Glyph size={16}>
      <polyline points="2,15 7,10.5 11,12.5 18,4" />
      <circle cx="18" cy="4" r="1.3" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  change: (
    <Glyph size={16}>
      <line x1="4" y1="16" x2="16" y2="4" />
      <polyline points="8,4 16,4 16,12" />
    </Glyph>
  ),
} as const;

export const PlusIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="10" y1="3" x2="10" y2="17" />
    <line x1="3" y1="10" x2="17" y2="10" />
  </svg>
);

export const RemoveIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="4" y1="4" x2="16" y2="16" />
    <line x1="16" y1="4" x2="4" y2="16" />
  </svg>
);

export const ChevronDown = (
  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="5,8 10,13 15,8" />
  </svg>
);

// Current-panel view toggles. Candidates plots one value per subject vertically; every
// other column's bar view is horizontal (one long row per subject or school), which is
// why there are two bar glyphs rather than one.
export const VerticalBarsIcon = (
  <Glyph fill>
    <rect x="3" y="10" width="3" height="7" />
    <rect x="8.5" y="5" width="3" height="12" />
    <rect x="14" y="8" width="3" height="9" />
  </Glyph>
);

export const HorizontalBarsIcon = (
  <Glyph fill>
    <rect x="3" y="3.5" width="10" height="3" rx="1" />
    <rect x="3" y="8.5" width="14" height="3" rx="1" />
    <rect x="3" y="13.5" width="7" height="3" rx="1" />
  </Glyph>
);

export const RankListIcon = (
  <Glyph fill>
    <circle cx="3" cy="5" r="1.3" />
    <rect x="6" y="4.3" width="11" height="1.6" />
    <circle cx="3" cy="10" r="1.3" />
    <rect x="6" y="9.3" width="8" height="1.6" />
    <circle cx="3" cy="15" r="1.3" />
    <rect x="6" y="14.3" width="5" height="1.6" />
  </Glyph>
);

export const DonutIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 10 L10 2.5 A7.5 7.5 0 0 1 16.9 14 Z" fill="currentColor" stroke="none" />
  </svg>
);

export const MapPinIcon = (
  <Glyph>
    <path d="M10 18s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10z" />
    <circle cx="10" cy="8" r="2" fill="currentColor" stroke="none" />
  </Glyph>
);

export const PrevYearIcon = (
  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="12,4 6,10 12,16" />
  </svg>
);

export const NextYearIcon = (
  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="8,4 14,10 8,16" />
  </svg>
);

// The wireframe's 26px icon button: transparent at rest, inverted when active, and at
// 35% with pointer events off when disabled. Disabled is a real `disabled` attribute as
// well as a look -- §4.2 wants the donut genuinely inert for a Results measure, not just
// greyed, and a pointer-events rule alone still leaves it reachable by keyboard.
export function IconButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={onClick && !disabled ? active : undefined}
      title={label}
      className={[
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-transparent",
        active ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--muted)] hover:bg-[var(--box-bg)] hover:text-[var(--fg)]",
        disabled ? "cursor-not-allowed opacity-35 hover:bg-transparent" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// The wireframe's small rounded pill ("From: 2021/22 ▾", "Trend line", "vs: …"). Used for
// every in-panel control, so one look covers all four columns.
export function Pill({
  label,
  active = false,
  disabled = false,
  expanded,
  onClick,
  trailing,
}: {
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-pressed={expanded === undefined && onClick ? active : undefined}
      className={[
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
        active
          ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
          : "border-[var(--panel-border2)] bg-[var(--panel-bg)] text-[var(--muted2)] hover:border-[var(--fg)]",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
    >
      {label}
      {trailing}
    </button>
  );
}

// A subject chip: filled in its qualification colour when active, outlined when not --
// the same treatment the dashboard's Rankings map chips already use, so "this subject,
// in its own colour" reads the same way in both places.
export function SubjectChip({
  label,
  colour,
  active,
  onClick,
}: {
  label: string;
  colour: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-[5px] text-xs font-medium"
      style={
        active
          ? { background: colour, borderColor: colour, color: "#0a0a0b" }
          : { background: "transparent", borderColor: `${colour}80`, color: colour }
      }
    >
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: active ? "#0a0a0b" : colour }} />
      {label}
    </button>
  );
}
