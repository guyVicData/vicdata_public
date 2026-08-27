"use client";

import { TAG_GROUPS, emptyFilterState, type FilterState } from "@/lib/map-tag-groups";
import { TAG_COLOURS, contrastingTextColour } from "@/lib/tag-colours";

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

  return (
    <div className="w-full rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
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

      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Filters</h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onFiltersChange(emptyFilterState())}
            className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Clear ({activeCount})
          </button>
        )}
      </div>

      {TAG_GROUPS.map((group) => (
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
