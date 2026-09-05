"use client";

// Member Data View sidebar (brief §4): named set (VicData-recipe or self-curated) +
// tick-list of member schools + sort indicator + "more in this set" overflow
// (ticked-off, expandable) + search-to-add (SchoolSearch.tsx, no new search UI) +
// "Edit set" action. The tick-list is the ONLY comparison mechanism in this whole
// build -- no separate "compare to" control anywhere.

import { useState } from "react";
import Link from "next/link";
import SchoolSearch, { type SchoolSearchResult } from "@/components/SchoolSearch";
import type { SetOption } from "@/lib/data-view-types";

export default function ComparatorSidebar({
  targetName,
  options,
  activeSet,
  onSelectSet,
  boardingQuintileLoading,
  tickedUrns,
  onToggleTick,
  initialTickedCount,
}: {
  targetName: string;
  options: SetOption[];
  activeSet: SetOption | null;
  onSelectSet: (option: SetOption) => void;
  boardingQuintileLoading: boolean;
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  initialTickedCount: number;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [addedUrns, setAddedUrns] = useState<{ urn: string; name: string }[]>([]);

  const schools = activeSet ? [...activeSet.schools, ...addedUrns.map((a) => ({ urn: a.urn, name: a.name, distanceKm: null }))] : [];
  const visible = schools.slice(0, initialTickedCount);
  const overflow = schools.slice(initialTickedCount);
  const hasDistance = schools.some((s) => s.distanceKm !== null);

  function addSchool(result: SchoolSearchResult) {
    if (schools.some((s) => s.urn === result.urn)) return;
    setAddedUrns((prev) => [...prev, { urn: result.urn, name: result.current_name }]);
    onToggleTick(result.urn);
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Comparator set</h2>

      <select
        className="mb-2 w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        value={activeSet ? (activeSet.kind === "recipe" ? `recipe:${activeSet.key}` : `saved:${activeSet.id}`) : ""}
        onChange={(e) => {
          const [kind, id] = e.target.value.split(":");
          const found = options.find((o) => (kind === "recipe" ? o.kind === "recipe" && o.key === id : o.kind === "saved" && o.id === id));
          if (found) onSelectSet(found);
        }}
      >
        {options.map((o) => (
          <option key={o.kind === "recipe" ? `recipe:${o.key}` : `saved:${o.id}`} value={o.kind === "recipe" ? `recipe:${o.key}` : `saved:${o.id}`}>
            {o.label}
            {o.kind === "recipe" && o.lazy && o.schools.length === 0 ? " (click to load)" : ""}
          </option>
        ))}
      </select>
      {boardingQuintileLoading && <p className="mb-2 text-xs text-neutral-400">Computing national boarding quintile — this can take a little while…</p>}
      {activeSet?.kind === "recipe" && activeSet.note && <p className="mb-2 text-xs text-neutral-400">{activeSet.note}</p>}

      {hasDistance && <p className="mb-2 text-xs text-neutral-400">Sorted by distance (km)</p>}

      <p className="mb-2 text-xs text-neutral-500">
        {targetName} <span className="text-neutral-400">(this school)</span>
      </p>

      <ul className="space-y-1">
        {visible.map((s) => (
          <SchoolRow key={s.urn} school={s} ticked={tickedUrns.has(s.urn)} onToggle={() => onToggleTick(s.urn)} />
        ))}
      </ul>

      {overflow.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-xs underline" onClick={() => setOverflowOpen((o) => !o)}>
            {overflowOpen ? "Hide" : `${overflow.length} more in this set`}
          </button>
          {overflowOpen && (
            <ul className="mt-1 space-y-1">
              {overflow.map((s) => (
                <SchoolRow key={s.urn} school={s} ticked={tickedUrns.has(s.urn)} onToggle={() => onToggleTick(s.urn)} />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Add a school</p>
        <SchoolSearch onSelect={addSchool} placeholder="Search to add…" />
      </div>

      {activeSet?.kind === "saved" && (
        <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <Link href={`/sets/${activeSet.id}`} className="text-xs underline">
            Edit set
          </Link>
        </div>
      )}
    </div>
  );
}

function SchoolRow({
  school,
  ticked,
  onToggle,
}: {
  school: { urn: string; name: string; distanceKm: number | null };
  ticked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <input type="checkbox" checked={ticked} onChange={onToggle} className="shrink-0" />
        <span className="truncate">{school.name}</span>
      </label>
      {school.distanceKm !== null && <span className="shrink-0 text-xs text-neutral-400">{school.distanceKm.toFixed(1)}km</span>}
    </li>
  );
}
