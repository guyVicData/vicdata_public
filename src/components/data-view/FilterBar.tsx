"use client";

// Member Data View shared filter bar (brief §4): phase/age (with an age drill-down
// nested under a selected phase band), gender, boarding-status, sector, and (round 1
// UX refinements, A2) a start-date control and an inline collapse arrow -- one state,
// fed to whichever view is active, never reset when switching views (the state
// itself lives in DataViewShell, this component is a pure controlled input over it).
//
// 2026-09-05 layout pass: laid out as one horizontal row (Phase pills, Gender pills,
// Boarding pills side by side, wrapping on narrow screens) rather than three stacked
// blocks -- matches the wireframe's own `.filter-group` inline treatment now that
// this renders once, in DataViewShell's own shared bar, instead of stacked inside a
// bordered box per view.
//
// 2026-09-06, UX refinements round 1, A2:
// - "Show only the filters relevant to the school/college being viewed" -- Phase
//   pills are now whichever bands relevantAgeBandsFor() (data-view-filters.ts) says
//   actually apply to the TARGET, not the full static PHASE_BANDS list. An FE
//   participation institution gets U19/Adult instead of Early Years/Junior/Prep/
//   Senior/Post 16 (see that function's own comment for the "Post 16" relabelling);
//   Boarding pills are hidden outright for one too (no real boarding data exists for
//   an FE college at all).
// - New date-range control: start year selectable from the target's own real trend
//   history, end fixed at the latest real period (CURRENT_CENSUS_PERIOD) and never
//   shown as editable, per the brief's own explicit "can't be changed."
// - `extra`: an injection point for DataViewShell's own SavedSetsControl, rendered
//   inside this same wrapping flex row (not a second, visually separate row) so the
//   Saved Sets dropdown + Save button genuinely read as part of "the filter row,"
//   matching the request's literal placement -- while the save MECHANISM itself
//   (membership/account lookups, the actual saved_sets write) stays owned by
//   DataViewShell, not duplicated into this component's own "pure controlled input"
//   role.
// - `collapsed`/`onToggleCollapse`: the expand/collapse behaviour is now an inline
//   arrow living in this same row (MapBoxCollapseToggle, the same chevron already
//   used for the Map's own overlay boxes) rather than a separate text link
//   underneath -- always rendered, regardless of collapsed state, so there's always
//   something in this row to click to get back.
//
// 2026-09-07, UX refinements round 2:
// - P1 item 3: Boarding pills also gated on the target genuinely having real
//   boarding provision (hasRealBoardingProvision, data-view-filters.ts), not just
//   "not an FE college" -- Acland Burghley (a real day school) was showing a
//   Boarding filter that could only ever produce the same whole-school number
//   either way it was clicked.
// - P2 item 5: every pill now follows the SAME colour convention the public map's
//   own filter panel already established (MapFilterPanel.tsx, confirmed by reading
//   it directly) -- inactive = plain neutral border/text, active = fills with the
//   VALUE's own real TAG_COLOURS colour (the same palette TypologyTags.tsx/
//   SchoolMap.tsx already use for these exact tags), not a generic black fill.
//   Colour signals "this is actively narrowing away from all," never decoration.
// - P3 item 7: new Sector pills (Independent/State/FE/Special Schools), a real
//   MEMBERSHIP filter (data-view-filters.ts's own module comment explains why
//   sector can't be a slice the way phase/gender/boarding are) -- shown only when
//   the active set genuinely contains more than one real sector (memberSectors),
//   and only pills for sectors ACTUALLY present in it, not all four unconditionally.

import { CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";
import {
  ageRangeForBand,
  PHASE_BANDS,
  type DataViewFilterState,
  type PhaseBandKey,
  type BoardingFilterValue,
} from "@/lib/data-view-filters";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import type { GenderTag, SectorTag } from "@/lib/typology";
import { tagDisplayLabel } from "@/lib/typology";
import { TAG_COLOURS, contrastingTextColour } from "@/lib/tag-colours";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";

const GENDER_OPTIONS: GenderTag[] = ["Girls", "Boys"];
const BOARDING_OPTIONS: BoardingFilterValue[] = ["Boarders", "Day pupils"];
// TAG_COLOURS keys are "Boarding"/"Day" (the school-typology tag names) -- the
// filter's own values ("Boarders"/"Day pupils") read better as filter labels but
// don't match those keys literally, so this maps one to the other rather than
// renaming either.
const BOARDING_TAG_KEY: Record<BoardingFilterValue, string> = { Boarders: "Boarding", "Day pupils": "Day" };
const SECTOR_OPTIONS: SectorTag[] = ["Independent", "State", "FE", "Special Schools"];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// "2025/26" -- the one academic-year-label convention already established elsewhere
// in this codebase (RollCard.tsx/FeCollegeCards.tsx/SmallCards.tsx all use this exact
// `{period}/{String(period + 1).slice(2)}` shape), reused verbatim rather than
// inventing a second format for this one new control.
function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

// 2026-09-07, UX refinements round 2, P2 item 5: reuses MapFilterPanel.tsx's own
// active-fill technique verbatim (confirmed by reading that component directly
// before building this) -- an inline light-mode fill (always correct, no cascade
// ambiguity) plus a `--pill-bg-dark`/`--pill-fg-dark` custom-property pair the
// shared `.filter-pill-active` class (declared once, in FilterBar's own render)
// applies with `!important` for the dark-mode/data-theme cases an inline style
// can't react to on its own.
//
// Global filter-row rework (2026-09-16), item 4: the INACTIVE style used to be a
// light neutral border/muted text (border-neutral-300/text-neutral-600) -- didn't
// read as "darkened," just outlined. Now a genuinely filled dark-neutral pill in
// both themes (bg-neutral-800 in light mode -- clearly darker than the page around
// it -- bg-neutral-950 in dark mode, darker than this app's own usual dark-mode
// card backgrounds so it still reads as recessed/muted against them), not just a
// border tweak. `hasCaret` adds a small "opens a menu" glyph -- phase/age pills
// only (the ones that gain a nested "Ages:" drill-down when selected alone);
// Gender/Boarding/Sector pills don't get one, they have no nested menu.
function Pill({
  active,
  tagKey,
  onClick,
  hasCaret,
  children,
}: {
  active: boolean;
  tagKey: string;
  onClick: () => void;
  hasCaret?: boolean;
  children: React.ReactNode;
}) {
  const tagColours = TAG_COLOURS[tagKey];
  const fillLight = tagColours?.light[1] ?? "#171717";
  const fillDark = tagColours?.dark[1] ?? "#ededed";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "filter-pill-active inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
          : "inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-500 dark:hover:bg-neutral-900"
      }
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
      {children}
      {hasCaret && (
        <span aria-hidden="true" className="text-[10px] opacity-70">
          ▾
        </span>
      )}
    </button>
  );
}

// Global filter-row rework (2026-09-16), item 4: reverses the "only show filters
// relevant to this school" behaviour from two earlier rounds (relevantAgeBandsFor's
// gating here, the showBoarding/sectorOptions.length>1 gates) -- an explicit
// experiment, Guy's own words, not a settled decision. The full Phase/Gender/
// Boarding/Sector vocabulary now always renders regardless of whether it applies
// to the current target; an inapplicable pill still narrows the number to a real,
// honest zero when ticked (same "many schools will show a real, honest zero" note
// as the global phase-band ages change), it just isn't hidden pre-emptively
// anymore. relevantAgeBandsFor/hasRealBoardingProvision themselves are untouched
// (still real, still used elsewhere -- e.g. AddSubtractSchoolsWindow.tsx's own
// "Group by phase" grouping) -- only THIS component's own gating of them is gone.
export default function FilterBar({
  filters,
  onChange,
  target,
  collapsed,
  onToggleCollapse,
}: {
  filters: DataViewFilterState;
  onChange: (next: DataViewFilterState) => void;
  target: DataViewSchoolProfile | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const isFeParticipation = !!target?.feParticipation;

  const singleBand = filters.phaseBands.size === 1 ? ([...filters.phaseBands][0] as PhaseBandKey) : null;
  const ageOptions =
    !isFeParticipation && singleBand && target?.statutoryLowAge !== null && target?.statutoryLowAge !== undefined && target?.statutoryHighAge !== null && target?.statutoryHighAge !== undefined
      ? (() => {
          const [lo, hi] = ageRangeForBand(singleBand, target.statutoryLowAge!, target.statutoryHighAge!);
          const ages: number[] = [];
          for (let a = Math.max(lo, 0); a <= hi; a++) ages.push(a);
          return ages;
        })()
      : [];

  // Start-year options: every real period in the target's own trend history, oldest
  // first. Falls back to just the current selection if the target has no real trend
  // at all yet (a school new enough to have no 2019 data at all, say) -- the control
  // still needs to render something rather than an empty, unusable <select>.
  const startPeriodOptions = target && target.trend.length > 0 ? target.trend.map((t) => t.period).sort((a, b) => a - b) : [filters.startPeriod];

  return (
    <div className="text-sm">
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {!collapsed && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {isFeParticipation ? "Age" : "Phase"}
              </span>
              {PHASE_BANDS.map((band) => (
                <Pill
                  key={band}
                  tagKey={band}
                  hasCaret
                  active={filters.phaseBands.has(band)}
                  onClick={() => onChange({ ...filters, phaseBands: toggle(filters.phaseBands, band), ages: new Set() })}
                >
                  {tagDisplayLabel(band)}
                </Pill>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Gender</span>
              {GENDER_OPTIONS.map((g) => (
                <Pill key={g} tagKey={g} active={filters.gender.has(g)} onClick={() => onChange({ ...filters, gender: toggle(filters.gender, g) })}>
                  {g}
                </Pill>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Boarding</span>
              {BOARDING_OPTIONS.map((b) => (
                <Pill key={b} tagKey={BOARDING_TAG_KEY[b]} active={filters.boarding.has(b)} onClick={() => onChange({ ...filters, boarding: toggle(filters.boarding, b) })}>
                  {b}
                </Pill>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Sector</span>
              {SECTOR_OPTIONS.map((s) => (
                <Pill key={s} tagKey={s} active={filters.sector.has(s)} onClick={() => onChange({ ...filters, sector: toggle(filters.sector, s) })}>
                  {tagDisplayLabel(s)}
                </Pill>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Since</span>
              <select
                value={filters.startPeriod}
                onChange={(e) => onChange({ ...filters, startPeriod: Number(e.target.value) })}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                {startPeriodOptions.map((p) => (
                  <option key={p} value={p}>
                    {academicYearLabel(p)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-400">to {academicYearLabel(CURRENT_CENSUS_PERIOD)} (latest)</span>
            </div>
          </>
        )}

        <MapBoxCollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} label="filters" />
      </div>

      {!collapsed && ageOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-neutral-400">Ages:</span>
          {ageOptions.map((age) => (
            <button
              key={age}
              type="button"
              onClick={() => onChange({ ...filters, ages: toggle(filters.ages, age) })}
              className={
                filters.ages.has(age)
                  ? "rounded border border-neutral-900 bg-neutral-900 px-1.5 py-0.5 text-xs text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              }
            >
              {age}
            </button>
          ))}
        </div>
      )}

      {!collapsed && filters.boarding.size > 0 && filters.phaseBands.size > 0 && (
        <p className="mt-1 text-xs text-neutral-400">Boarding counts are whole-school — the phase filter above doesn&rsquo;t further narrow them.</p>
      )}
    </div>
  );
}
