"use client";

// Member Data View shared filter bar (brief §4): phase/age (with an age drill-down
// nested under a selected phase band), gender, boarding-status, and (round 1 UX
// refinements, A2) a start-date control and an inline collapse arrow -- one state,
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

import { CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";
import {
  ageRangeForBand,
  relevantAgeBandsFor,
  type DataViewFilterState,
  type PhaseBandKey,
  type BoardingFilterValue,
} from "@/lib/data-view-filters";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import type { GenderTag } from "@/lib/typology";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";

const GENDER_OPTIONS: GenderTag[] = ["Girls", "Boys"];
const BOARDING_OPTIONS: BoardingFilterValue[] = ["Boarders", "Day pupils"];

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

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }
    >
      {children}
    </button>
  );
}

export default function FilterBar({
  filters,
  onChange,
  target,
  collapsed,
  onToggleCollapse,
  extra,
}: {
  filters: DataViewFilterState;
  onChange: (next: DataViewFilterState) => void;
  target: DataViewSchoolProfile | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  extra?: React.ReactNode;
}) {
  const isFeParticipation = !!target?.feParticipation;
  const ageBands = target
    ? relevantAgeBandsFor({ phase: target.phase, statutoryLowAge: target.statutoryLowAge, statutoryHighAge: target.statutoryHighAge, feParticipation: target.feParticipation })
    : [];

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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {!collapsed && (
          <>
            {ageBands.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {isFeParticipation ? "Age" : "Phase"}
                </span>
                {ageBands.map(({ key, label }) => (
                  <Pill
                    key={key}
                    active={filters.phaseBands.has(key)}
                    onClick={() => onChange({ ...filters, phaseBands: toggle(filters.phaseBands, key), ages: new Set() })}
                  >
                    {label}
                  </Pill>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Gender</span>
              {GENDER_OPTIONS.map((g) => (
                <Pill key={g} active={filters.gender.has(g)} onClick={() => onChange({ ...filters, gender: toggle(filters.gender, g) })}>
                  {g}
                </Pill>
              ))}
            </div>

            {!isFeParticipation && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Boarding</span>
                {BOARDING_OPTIONS.map((b) => (
                  <Pill key={b} active={filters.boarding.has(b)} onClick={() => onChange({ ...filters, boarding: toggle(filters.boarding, b) })}>
                    {b}
                  </Pill>
                ))}
              </div>
            )}

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

            {extra}
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
