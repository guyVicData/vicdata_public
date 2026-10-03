"use client";

// VicData 0.6 S7: the small pieces the meetings screens share -- the boards' buttons, the
// meetings icon tile, the slide thumbnail, and print forcing the light theme.
//
// Colours are the Teacher view tokens (globals.css #teacher-root) and FEATURE_ACCENT.meetings
// for the rose, never the boards' literal hexes: #0a0a0a --bg, #141414 --panel-bg,
// #1c1c1c --border, #262626/#2a2a2a --panel-border2, #3a3a3a --edge-strong, #9a9a9a
// --muted, #c9c9c9 --chip-fg, #fb7185 FEATURE_ACCENT.meetings, #f87171 DELTA_NEGATIVE.
import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type DragEvent } from "react";
import type { SlideConfig } from "@/catalogue/types";
import { MeetingsGlyph } from "@/components/teacher/HomeCard";
import { FEATURE_ACCENT } from "@/lib/teacher-view-theme";
import { MEETING_UI, thumbRects } from "@/lib/meeting-layout";
import { SLOT_DRAG_TYPE, readDrag } from "./SlideCanvas";

export const ROSE = FEATURE_ACCENT.meetings;

// #teacher-root's accent for these pages: CardBox's modal close, notes and focus marks.
export const ROSE_ROOT_STYLE = { "--accent": ROSE.hex, "--accent-rgb": ROSE.rgb } as CSSProperties;

// The rose fill's ink (the boards' #2a0a10): the accent taken almost to black.
export const ROSE_INK = `color-mix(in srgb, ${ROSE.hex} 14%, #000)`;

// Meeting.dc.html .ebtn / MeetingPlay .tb, and the rose primary.
export function EBtn({ primary = false, className = "", style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`shrink-0 whitespace-nowrap rounded-[8px] border px-[11px] py-[6px] text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
        primary ? "" : "border-[var(--edge-strong)] bg-[var(--panel-bg)] text-[var(--fg)] enabled:hover:border-[var(--fg)]"
      } ${className}`}
      style={primary ? { background: ROSE.hex, borderColor: ROSE.hex, color: ROSE_INK, ...style } : style}
    />
  );
}

// The 32px meetings tile in the editor header (Meeting.dc.html), the home tile's glyph.
export function MeetingsTile() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] [&>svg]:h-[17px] [&>svg]:w-[17px]"
      style={{ background: `rgba(${ROSE.rgb},0.14)`, color: ROSE.hex }}
    >
      <MeetingsGlyph />
    </span>
  );
}

// Print in the light, print-safe palette whatever the screen theme (brief v2 §7) -- the
// same swap ThemeToggle does, for pages that don't render the nav's toggle.
export function usePrintLight(theme: string) {
  useEffect(() => {
    const root = document.getElementById("teacher-root");
    if (!root) return;
    const before = () => root.setAttribute("data-theme", "light");
    const after = () => root.setAttribute("data-theme", theme);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [theme]);
}

// A slide's thumbnail (Meeting.dc.html .thumb): the slide's real arrangement, scaled.
// Text cells darker; empty cells dashed; the picked-up slot rose. A drop target for
// moving a view to the end of that slide.
export function SlideThumb({
  slide,
  index,
  current,
  selectedIdx,
  onClick,
  onDrop,
}: {
  slide: SlideConfig;
  index: number;
  current: boolean;
  selectedIdx: number | null;
  onClick: () => void;
  onDrop?: (from: { slide: number; idx: number }) => void;
}) {
  const w = MEETING_UI.thumbWidth;
  const h = MEETING_UI.thumbHeight;
  const t = thumbRects(slide, w - 2, h - 2);
  const dropProps = onDrop
    ? {
        onDragOver: (e: DragEvent) => {
          if (e.dataTransfer.types.includes(SLOT_DRAG_TYPE)) e.preventDefault();
        },
        onDrop: (e: DragEvent) => {
          const from = readDrag(e);
          if (from) {
            e.preventDefault();
            onDrop(from);
          }
        },
      }
    : {};
  return (
    <div className="flex items-start gap-2">
      <span className="w-[10px] text-[11px]" style={current ? { color: ROSE.hex, fontWeight: 700 } : { color: "var(--muted)" }}>
        {index + 1}
      </span>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Slide ${index + 1}${slide.title ? `: ${slide.title}` : ""}`}
        aria-current={current ? "true" : undefined}
        title={slide.title || "Untitled slide"}
        className="relative shrink-0 overflow-hidden rounded-[7px] bg-[var(--panel-bg)]"
        style={{ width: w, height: h, border: current ? `2px solid ${ROSE.hex}` : "1px solid var(--panel-border2)" }}
        {...dropProps}
      >
        <i className="absolute rounded-[2px] bg-[var(--panel-border2)]" style={{ left: t.title.x, top: t.title.y + 1, width: t.title.width, height: Math.max(5, t.title.height) }} />
        {t.cells.map((c, i) => {
          const s = c.slotIndex === null ? null : slide.slots[c.slotIndex];
          const style: CSSProperties = { left: c.rect.x, top: c.rect.y, width: c.rect.width, height: c.rect.height };
          if (!s) return <i key={i} className="absolute rounded-[2px] border border-dashed border-[var(--edge-strong)]" style={style} />;
          const picked = c.slotIndex === selectedIdx;
          return (
            <i
              key={i}
              className="absolute rounded-[2px]"
              style={{ ...style, background: picked ? ROSE.hex : s.view ? "var(--panel-border2)" : "var(--panel-border)" }}
            />
          );
        })}
      </button>
    </div>
  );
}
