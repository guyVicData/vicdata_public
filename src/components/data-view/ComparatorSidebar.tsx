"use client";

// Member Data View sidebar (brief §4): named set (VicData-recipe or self-curated) +
// tick-list of member schools + sort indicator + "more in this set" overflow
// (ticked-off, expandable) + search-to-add (SchoolSearch.tsx, no new search UI) +
// "Edit set" action. The tick-list is the ONLY comparison mechanism in this whole
// build -- no separate "compare to" control anywhere.
//
// 2026-09-06, UX refinements round 1, B3: "Rename 'Comparator [Set]' to 'Compared
// with', and extend how it works" --
// - Renamed throughout ("Comparator set" header -> "Compared with").
// - New Local Authorities multi-select: the target's own LA (always pre-ticked) plus
//   real "adjacent" candidate LAs (la-comparator-picker.ts -- derived from the
//   target's own nearest real schools, since this repo has no real geographic LA-
//   boundary-adjacency dataset), a "Select all" button, and ticking/unticking any of
//   them re-fetches the union via /api/data-view/la-set and makes it the active set.
// - Region/Nation/"same academy group" are real, visible entries here, but disabled
//   -- the request's own explicit instruction was to build the UI now and grey it
//   out until the real underlying data infrastructure exists, not fake it. No group-
//   membership data exists in this schema at all (checked directly -- `schools` has
//   no trust/group/federation column of any kind), so that one is unconditionally
//   disabled; Region/Nation are the same, per the request's own explicit deferral.
// - "+5 more" button for the Nearest-10-shaped recipes (mainstream and FE), calling
//   /api/data-view/expand-nearest and growing the SAME active set's school list in
//   place (never resetting the member's own existing ticks the way selecting a whole
//   new set does -- see onExpandActiveSet's own comment in DataViewShell.tsx).

import { useEffect, useState } from "react";
import Link from "next/link";
import SchoolSearch, { type SchoolSearchResult } from "@/components/SchoolSearch";
import type { SetOption } from "@/lib/data-view-types";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";

type AdjacentLasResponse = { ownLaName: string | null; adjacent: { name: string }[] };

export default function ComparatorSidebar({
  targetName,
  targetUrn,
  authToken,
  options,
  activeSet,
  onSelectSet,
  onExpandActiveSet,
  boardingQuintileLoading,
  tickedUrns,
  onToggleTick,
  initialTickedCount,
}: {
  targetName: string;
  targetUrn: string;
  authToken: string | null;
  options: SetOption[];
  activeSet: SetOption | null;
  onSelectSet: (option: SetOption) => void;
  onExpandActiveSet: (schools: DefaultListEntry[]) => void;
  boardingQuintileLoading: boolean;
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  initialTickedCount: number;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [addedUrns, setAddedUrns] = useState<{ urn: string; name: string }[]>([]);

  const [laInfo, setLaInfo] = useState<AdjacentLasResponse | null>(null);
  const [checkedLas, setCheckedLas] = useState<Set<string>>(new Set());
  const [laLoading, setLaLoading] = useState(false);
  const [laOpen, setLaOpen] = useState(false);
  const [expanding, setExpanding] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/data-view/adjacent-las?urn=${targetUrn}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (cancelled || !res.ok) return;
      const body = (await res.json()) as AdjacentLasResponse;
      setLaInfo(body);
      setCheckedLas(body.ownLaName ? new Set([body.ownLaName]) : new Set());
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUrn, authToken]);

  async function applyLaSelection(next: Set<string>) {
    setCheckedLas(next);
    if (!authToken || next.size === 0) return;
    setLaLoading(true);
    try {
      const res = await fetch(`/api/data-view/la-set?urn=${targetUrn}&las=${Array.from(next).map(encodeURIComponent).join(",")}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { set: { key: string; label: string; schools: DefaultListEntry[] } | null };
      if (body.set) onSelectSet({ kind: "recipe", key: "multi_la", label: body.set.label, schools: body.set.schools });
    } finally {
      setLaLoading(false);
    }
  }

  function toggleLa(name: string) {
    const next = new Set(checkedLas);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    applyLaSelection(next);
  }

  function selectAllLas() {
    if (!laInfo) return;
    const all = new Set([...(laInfo.ownLaName ? [laInfo.ownLaName] : []), ...laInfo.adjacent.map((a) => a.name)]);
    applyLaSelection(all);
  }

  const isExpandableNearest = activeSet?.kind === "recipe" && (activeSet.key === "nearest_10" || activeSet.key === "fe_nearest_10");

  async function expandNearest() {
    if (!authToken || !isExpandableNearest || !activeSet) return;
    setExpanding(true);
    try {
      const nextCount = activeSet.schools.length + 5;
      const res = await fetch(`/api/data-view/expand-nearest?urn=${targetUrn}&count=${nextCount}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { list: { schools: DefaultListEntry[] } };
      onExpandActiveSet(body.list.schools);
    } finally {
      setExpanding(false);
    }
  }

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
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Compared with</h2>

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

      {isExpandableNearest && (
        <button type="button" disabled={expanding} onClick={expandNearest} className="mb-2 text-xs underline disabled:opacity-50">
          {expanding ? "Loading…" : `+5 more (${activeSet!.schools.length} → ${activeSet!.schools.length + 5})`}
        </button>
      )}

      <div className="mb-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        <button type="button" className="mb-1 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-neutral-500" onClick={() => setLaOpen((o) => !o)}>
          Local Authorities
          <span className="text-neutral-400">{laOpen ? "▾" : "▸"}</span>
        </button>
        {laOpen && (
          <div className="space-y-1 text-xs">
            {!laInfo ? (
              <p className="text-neutral-400">Loading…</p>
            ) : !laInfo.ownLaName ? (
              <p className="text-neutral-400">No real LA on record for this school.</p>
            ) : (
              <>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={checkedLas.has(laInfo.ownLaName)} onChange={() => toggleLa(laInfo.ownLaName!)} />
                  {laInfo.ownLaName} <span className="text-neutral-400">(this school&rsquo;s own LA)</span>
                </label>
                {laInfo.adjacent.map((la) => (
                  <label key={la.name} className="flex items-center gap-2">
                    <input type="checkbox" checked={checkedLas.has(la.name)} onChange={() => toggleLa(la.name)} />
                    {la.name}
                  </label>
                ))}
                {laInfo.adjacent.length > 0 && (
                  <button type="button" onClick={selectAllLas} className="mt-1 text-neutral-500 underline">
                    Select all
                  </button>
                )}
                {laLoading && <p className="text-neutral-400">Updating…</p>}
              </>
            )}
            <div className="mt-2 space-y-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
              <p
                className="cursor-not-allowed text-neutral-300 line-through decoration-neutral-300 dark:text-neutral-700 dark:decoration-neutral-700"
                title="Not available yet -- the regional/national aggregation this needs hasn't been built."
              >
                Region
              </p>
              <p
                className="cursor-not-allowed text-neutral-300 line-through decoration-neutral-300 dark:text-neutral-700 dark:decoration-neutral-700"
                title="Not available yet -- the regional/national aggregation this needs hasn't been built."
              >
                Nation
              </p>
              <p
                className="cursor-not-allowed text-neutral-300 line-through decoration-neutral-300 dark:text-neutral-700 dark:decoration-neutral-700"
                title="Not available yet -- there's no real school-group/trust data in this dataset to compare against."
              >
                Same academy/school group
              </p>
            </div>
          </div>
        )}
      </div>

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
