"use client";

// VicData 0.6 S6: a dashboard's coloured icon tile at any size (Main.dc.html's 38px
// library tile, Icon.dc.html's 52px preview, CopyTo's 28px destination square). The rules
// -- which glyph, which colour, radius and tint per size -- are src/lib/dashboard-icons.ts;
// this only draws them, with the app's own glyphs (one icon per meaning).
import type { CSSProperties, ReactNode } from "react";
import type { DashboardConfig } from "@/catalogue/types";
import * as PanelIcons from "@/components/teacher/PanelIcons";
import { COLUMN_ICON_PATHS } from "@/components/teacher/DashboardColumn";
import { MeetingsGlyph, PhaseGlyph, RecruitmentGlyph } from "@/components/teacher/HomeCard";
import { colourOf, iconOf, resolveIcon, tileMetrics, type DashboardIconSpec, type IconDrawing, type SetRef, type TileColour } from "@/lib/dashboard-icons";

const stroke24 = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// The library's own mark (HomeSMT.dc.html's Dashboards tile): four panels of unequal size.
export const LibraryGlyph = stroke24(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);

// Key dashboards (HomeSMT.dc.html's empty tile): four equal panels -- the same mark as the
// nav's Home, since the key dashboards are what Home is for.
export const KeyDashboardsGlyph = stroke24(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);

const SET_GLYPHS: Record<SetRef, () => ReactNode> = {
  "phase.ks4": () => <PhaseGlyph phase="ks4" />,
  "phase.ks5": () => <PhaseGlyph phase="ks5" />,
  "column.candidates": () => stroke24(COLUMN_ICON_PATHS.candidates),
  "column.results": () => stroke24(COLUMN_ICON_PATHS.results),
  "column.context": () => stroke24(COLUMN_ICON_PATHS.context),
  "column.rankings": () => stroke24(COLUMN_ICON_PATHS.rankings),
  school: () => PanelIcons.SchoolIcon,
  library: () => LibraryGlyph,
  "feature.recruitment": () => <RecruitmentGlyph />,
  "feature.meetings": () => <MeetingsGlyph />,
};

export function railGlyphByName(name: string): ReactNode {
  const g = (PanelIcons as Record<string, unknown>)[name];
  return (g as ReactNode) ?? PanelIcons.TilesIcon;
}

// The glyph alone, filling a `size` box (every svg is stretched to the box; uploads keep
// their aspect).
export function IconGlyph({ drawing, size }: { drawing: IconDrawing; size: number }) {
  const box: CSSProperties = { width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" };
  if (drawing.kind === "img")
    // eslint-disable-next-line @next/next/no-img-element -- a Storage object at any size; next/image adds nothing here
    return <img src={drawing.src} alt="" style={{ ...box, objectFit: "contain" }} />;
  const node = drawing.kind === "rail" ? railGlyphByName(drawing.name) : SET_GLYPHS[drawing.ref]();
  return (
    <span aria-hidden="true" style={box} className="[&>svg]:block [&>svg]:h-full [&>svg]:w-full">
      {node}
    </span>
  );
}

// The coloured tile: the colour at 14% (16% from 48px up) behind the glyph in the colour.
export function IconTile({ drawing, colour, size = 38 }: { drawing: IconDrawing; colour: TileColour; size?: number }) {
  const m = tileMetrics(size);
  return (
    <span
      style={{
        width: m.size,
        height: m.size,
        flex: `0 0 ${m.size}px`,
        borderRadius: m.radius,
        background: `rgba(${colour.rgb},${m.tint})`,
        color: colour.hex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <IconGlyph drawing={drawing} size={m.glyph} />
    </span>
  );
}

// A spec on a colour (the Icon dialog's live preview).
export function SpecTile({ spec, colour, size = 38 }: { spec: DashboardIconSpec; colour: TileColour; size?: number }) {
  return <IconTile drawing={resolveIcon(spec)} colour={colour} size={size} />;
}

// A dashboard's own icon, from its config (its icon, else its default; its colour).
export function DashboardIcon({ config, size = 38 }: { config: Pick<DashboardConfig, "kind" | "columns" | "icon" | "colour">; size?: number }) {
  return <IconTile drawing={resolveIcon(iconOf(config))} colour={colourOf(config.colour)} size={size} />;
}
