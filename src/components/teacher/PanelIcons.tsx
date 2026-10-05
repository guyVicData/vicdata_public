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

// Trend redesign: the Trend panel's chart view (a line over time) and the table view
// shared by Trend (Option E) and % Change (Option I).
export const TrendLineIcon = (
  <Glyph>
    <polyline points="2.5,15 7,10 11,12.5 17.5,4.5" />
  </Glyph>
);

// Col 1 / Trend actual-numbers round: the indexed chart's icon -- a line crossing a dashed
// level, the "100 = no change" line it is read against. The plain line (TrendLineIcon) is
// the actual-numbers chart.
export const IndexedLineIcon = (
  <Glyph>
    <line x1="2.5" y1="10" x2="17.5" y2="10" strokeDasharray="1.8 1.8" />
    <polyline points="2.5,14 7,10 11,11.5 17.5,4.5" />
  </Glyph>
);

// Snagging round 1 Part 2: the number-tiles view -- one wide tile over three small ones.
export const TilesIcon = (
  <Glyph>
    <rect x="2.5" y="3" width="15" height="6" rx="1.3" />
    <rect x="2.5" y="11.5" width="4" height="5.5" rx="1" />
    <rect x="8" y="11.5" width="4" height="5.5" rx="1" />
    <rect x="13.5" y="11.5" width="4" height="5.5" rx="1" />
  </Glyph>
);

// Grade bands frontend round: the per-grade distribution view (and its range picker).
export const GradesIcon = (
  <Glyph fill>
    <rect x="3" y="3.5" width="14" height="2.4" rx="1" />
    <rect x="3" y="7.4" width="10" height="2.4" rx="1" />
    <rect x="3" y="11.3" width="12" height="2.4" rx="1" />
    <rect x="3" y="15.2" width="5" height="2.4" rx="1" />
  </Glyph>
);

// The tiles' own glyphs, one per kind of figure: a rank within a group (podium), within
// the school (building), a change over time (arrow), an average (a bar at the mean) and
// the England comparison (flag).
export const PodiumIcon = (
  <Glyph>
    <path d="M7.5 16.5V7.5h5v9M2.5 16.5v-5h5M12.5 16.5v-3h5v3M2 16.5h16" />
  </Glyph>
);
export const SchoolIcon = (
  <Glyph>
    <path d="M3 17V8.5l7-4.5 7 4.5V17M1.8 17h16.4M8 17v-4.5h4V17" />
  </Glyph>
);
export const ChangeArrowIcon = (
  <Glyph>
    <polyline points="2.5,14.5 7.5,9.5 10.5,12.5 17,6" />
    <polyline points="12.5,6 17,6 17,10.5" />
  </Glyph>
);
export const AverageIcon = (
  <Glyph>
    <path d="M3.5 16.5V11M8 16.5V6M12.5 16.5V9M17 16.5v-8" />
    <line x1="1.8" y1="10" x2="18.2" y2="10" strokeDasharray="1.6 1.6" />
  </Glyph>
);
export const FlagIcon = (
  <Glyph>
    <path d="M4.5 17.5V3M4.5 3.5h10l-2 3.5 2 3.5h-10" />
  </Glyph>
);

export const TableIcon = (
  <Glyph>
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
    <line x1="2.5" y1="8" x2="17.5" y2="8" />
    <line x1="2.5" y1="12.3" x2="17.5" y2="12.3" />
    <line x1="8" y1="8" x2="8" y2="16.5" />
  </Glyph>
);

export const DonutIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 10 L10 2.5 A7.5 7.5 0 0 1 16.9 14 Z" fill="currentColor" stroke="none" />
  </svg>
);

// 0.6.1 S3c: the slope view's glyph -- two rows joined from a first year to the latest, a dot
// at each end -- in the same 20x20 stroke language (it was the view editor's own until now).
export const SlopeIcon = (
  <Glyph>
    <line x1="4" y1="14.5" x2="16" y2="6" />
    <line x1="4" y1="8" x2="16" y2="11.5" />
    <circle cx="4" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
  </Glyph>
);

export const MapPinIcon = (
  <Glyph>
    <path d="M10 18s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10z" />
    <circle cx="10" cy="8" r="2" fill="currentColor" stroke="none" />
  </Glyph>
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
  // VicData 0.6 E: the rail label the catalogue registers this button's view under
  // (Dataview.host.rail), where the visible label varies -- e.g. Context's disabled donut,
  // whose tooltip explains why. Identification only; never rendered.
  railLabel?: string;
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
