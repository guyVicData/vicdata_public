"use client";

import { useState } from "react";
import { TAG_GROUPS, emptyFilterState, type FilterState } from "@/lib/map-tag-groups";
import { TAG_COLOURS, contrastingTextColour } from "@/lib/tag-colours";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";

// Filter panel for the State of the School page map (2026-08-25 design/polish round
// -- rebuilt from a checkbox list to toggleable pill/chip buttons per Guy's live
// review). Colour mode now lives in its own component (MapColourKey.tsx, a separate
// box per Guy's explicit instruction) -- this component is filters only.
//
// Entirely config-driven off TAG_GROUPS (map-tag-groups.ts) -- adding a future filter
// group (a later topic's own tag category) is a config entry there, not a change to
// this component's layout. All groups are wired to real filtering logic
// (passesFilters, used by SchoolMap.tsx) -- built as genuinely working controls, not
// yet decided which ship enabled at launch.
//
// 2026-08-25, same round: an active/selected button now fills with the tag's OWN
// colour (TAG_COLOURS -- the exact same palette the map dots and TypologyTags pills
// use) instead of a generic grey, per Guy's live review -- "selecting reinforces
// which colour means what." Text colour is computed per fill via
// contrastingTextColour (tag-colours.ts), not hardcoded -- ISC orange and the
// provisional green land on opposite sides of the light/dark-text split, so a fixed
// choice would have been wrong for at least one of them. The light-mode fill is set
// inline (always correct, no cascade ambiguity); the dark-mode fill can only apply
// via a CSS custom property + !important override (same technique
// TypologyTags.tsx's own pill already uses for the same problem: an inline style
// can't respond to a prefers-color-scheme/data-theme change on its own).
export default function MapFilterPanel({
  filters,
  onFiltersChange,
}: {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}) {
  const activeCount = Object.values(filters).reduce((sum, set) => sum + set.size, 0);
  // 2026-10-02, item 4: local, non-persisted collapse state -- doesn't need to
  // survive a reload, so plain useState rather than anything wired to the URL/
  // localStorage.
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-full rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      {/* bg-white/dark:bg-neutral-950 added 2026-08-28 when this panel moved onto the
          map itself (previously a side column, always on the page's own background --
          never needed one of its own). Same shape as the size-legend box's own
          bg-white/dark:bg-neutral-950, same reason: without it, transparent + muted
          text over live map tiles is unreadable (the exact bug already documented on
          SchoolMap.tsx's colour-key box, caught the same way -- verify it's actually
          visible, not just present in the DOM, before trusting it). */}
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .filter-pill-active {
            background-color: var(--pill-bg-dark) !important;
            border-color: var(--pill-bg-dark) !important;
            color: var(--pill-fg-dark) !important;
          }
        }
        :root[data-theme="dark"] .filter-pill-active {
          background-color: var(--pill-bg-dark) !important;
          border-color: var(--pill-bg-dark) !important;
          color: var(--pill-fg-dark) !important;
        }
      `}</style>

      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Filters</h3>
        <div className="flex shrink-0 items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onFiltersChange(emptyFilterState())}
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Clear ({activeCount})
            </button>
          )}
          <MapBoxCollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} label="Filters" />
        </div>
      </div>

      {!collapsed && TAG_GROUPS.map((group) => (
        <div key={group.key} className="mt-3">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {group.title}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((opt) => {
              const active = filters[group.key]?.has(opt) ?? false;
              const tagColours = TAG_COLOURS[opt];
              const fillLight = tagColours?.light[1] ?? "#171717";
              const fillDark = tagColours?.dark[1] ?? "#ededed";
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFiltersChange(toggleFilter(filters, group.key, opt))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    active
                      ? "filter-pill-active"
                      : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                  }`}
                  style={
                    active
                      ? ({
                          "--pill-bg-dark": fillDark,
                          "--pill-fg-dark": contrastingTextColour(fillDark),
                          backgroundColor: fillLight,
                          borderColor: fillLight,
                          color: contrastingTextColour(fillLight),
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function toggleFilter(filters: FilterState, key: string, value: string): FilterState {
  const current = filters[key] ?? new Set<string>();
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return { ...filters, [key]: next };
}
