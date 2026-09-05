"use client";

// Member Data View shared filter bar (brief §4): phase/age (with an age drill-down
// nested under a selected phase band), gender, and boarding-status -- one state, fed
// to whichever view is active, never reset when switching views (the state itself
// lives in DataViewShell, this component is a pure controlled input over it).
//
// 2026-09-05 layout pass: laid out as one horizontal row (Phase pills, Gender pills,
// Boarding pills side by side, wrapping on narrow screens) rather than three stacked
// blocks -- matches the wireframe's own `.filter-group` inline treatment now that
// this renders once, in DataViewShell's own shared bar, instead of stacked inside a
// bordered box per view.

import { PHASE_BANDS, ageRangeForBand, type DataViewFilterState, type PhaseBandKey, type BoardingFilterValue } from "@/lib/data-view-filters";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import type { GenderTag } from "@/lib/typology";

const GENDER_OPTIONS: GenderTag[] = ["Girls", "Boys"];
const BOARDING_OPTIONS: BoardingFilterValue[] = ["Boarders", "Day pupils"];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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
}: {
  filters: DataViewFilterState;
  onChange: (next: DataViewFilterState) => void;
  target: DataViewSchoolProfile | null;
}) {
  const singleBand = filters.phaseBands.size === 1 ? ([...filters.phaseBands][0] as PhaseBandKey) : null;
  const ageOptions =
    singleBand && target?.statutoryLowAge !== null && target?.statutoryLowAge !== undefined && target?.statutoryHighAge !== null && target?.statutoryHighAge !== undefined
      ? (() => {
          const [lo, hi] = ageRangeForBand(singleBand, target.statutoryLowAge!, target.statutoryHighAge!);
          const ages: number[] = [];
          for (let a = Math.max(lo, 0); a <= hi; a++) ages.push(a);
          return ages;
        })()
      : [];

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Phase</span>
          {PHASE_BANDS.map((band) => (
            <Pill
              key={band}
              active={filters.phaseBands.has(band)}
              onClick={() => onChange({ ...filters, phaseBands: toggle(filters.phaseBands, band), ages: new Set() })}
            >
              {band}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Gender</span>
          {GENDER_OPTIONS.map((g) => (
            <Pill key={g} active={filters.gender.has(g)} onClick={() => onChange({ ...filters, gender: toggle(filters.gender, g) })}>
              {g}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Boarding</span>
          {BOARDING_OPTIONS.map((b) => (
            <Pill key={b} active={filters.boarding.has(b)} onClick={() => onChange({ ...filters, boarding: toggle(filters.boarding, b) })}>
              {b}
            </Pill>
          ))}
        </div>
      </div>

      {ageOptions.length > 0 && (
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

      {filters.boarding.size > 0 && filters.phaseBands.size > 0 && (
        <p className="mt-1 text-xs text-neutral-400">Boarding counts are whole-school — the phase filter above doesn&rsquo;t further narrow them.</p>
      )}
    </div>
  );
}
