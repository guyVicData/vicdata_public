"use client";

// Member Data View shared filter bar (brief §4): phase/age (with an age drill-down
// nested under a selected phase band), gender, and boarding-status -- one state, fed
// to whichever view is active, never reset when switching views (the state itself
// lives in DataViewShell, this component is a pure controlled input over it).

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
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Phase</p>
        <div className="flex flex-wrap gap-1.5">
          {PHASE_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  phaseBands: toggle(filters.phaseBands, band),
                  ages: new Set(), // any phase-band change resets the age drill-down
                })
              }
              className={
                filters.phaseBands.has(band)
                  ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }
            >
              {band}
            </button>
          ))}
        </div>
        {ageOptions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
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
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Gender</p>
        <div className="flex gap-1.5">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChange({ ...filters, gender: toggle(filters.gender, g) })}
              className={
                filters.gender.has(g)
                  ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Boarding status</p>
        <div className="flex gap-1.5">
          {BOARDING_OPTIONS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onChange({ ...filters, boarding: toggle(filters.boarding, b) })}
              className={
                filters.boarding.has(b)
                  ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }
            >
              {b}
            </button>
          ))}
        </div>
        {filters.boarding.size > 0 && filters.phaseBands.size > 0 && (
          <p className="mt-1 text-xs text-neutral-400">Boarding counts are whole-school — the phase filter above doesn&rsquo;t further narrow them.</p>
        )}
      </div>
    </div>
  );
}
