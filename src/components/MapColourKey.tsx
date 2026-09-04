"use client";

import { useState } from "react";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";

// Colour box for the State of the School page map (2026-08-25 design/polish round --
// new, split out per Guy's live review: "Colour by" previously had no working
// selector under it, and the colour key lived in an easy-to-miss overlay on the map
// itself. Now a real single-select mode control + a live colour key, in their own
// box, separate from the filter panel. Swatches update live as mode changes --
// SchoolMap.tsx computes which swatches apply to the current mode and passes them in,
// since only it knows the resolved CSS custom property values (theme-aware, read at
// draw time for the map dots).
//
// Real bug caught later the same round: this box moved from a side column (sitting
// against the page's own background) to floating ON TOP of the map itself
// (SchoolMap.tsx), but its own root div never had a background colour -- it never
// needed one before. transparent + muted grey text over live map tiles rendered
// (confirmed present in the DOM, correct position, elementFromPoint hits it) but was
// genuinely illegible -- exactly the earlier "legend not visible" failure mode, a new
// instance of it, caused by this round's own layout change. bg-white/dark:bg-
// neutral-950 + shadow added below, matching the Size box's own treatment in
// SchoolMap.tsx for consistency.
export type ColourModeOption = { key: string; label: string };
export type ColourSwatch = { label: string; colourVar: string };

export default function MapColourKey({
  modes,
  mode,
  onModeChange,
  swatches,
}: {
  modes: ColourModeOption[];
  mode: string;
  onModeChange: (mode: string) => void;
  swatches: ColourSwatch[];
}) {
  // 2026-10-02, item 4: same local, non-persisted collapse state as MapFilterPanel.
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-full rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className={`flex items-center justify-between gap-2 ${collapsed ? "" : "mb-2"}`}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Colour by</h3>
        <MapBoxCollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} label="Colour by" />
      </div>
      {!collapsed && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => onModeChange(m.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  mode === m.key
                    ? "border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {swatches.map((sw) => (
              <span
                key={sw.label}
                className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${sw.colourVar})`, opacity: 0.85 }}
                />
                {sw.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
