"use client";

// Member Data View "Compared with" panel rework (2026-09-08, per direct request): the
// granular schools list moves here, into a real modal window, out of the
// always-visible sidebar surface entirely -- "the whole point is a standard-height
// panel that never distorts the map/graphs beside it." A genuine window, not a
// popover: covers Map/Graphs/Rankings, closes ONLY via the explicit Close button
// (no click-outside/Escape dismiss -- not asked for, and a stray click while
// reviewing a long list shouldn't silently lose the review).
//
// Sector colour-coding reuses TAG_COLOURS/cssVarNameForTag exactly as MapView.tsx's
// own scoped <style>-block technique does (same --tag-* custom-property pattern),
// rather than a new colour mechanism -- "sector colour-coded to match the existing
// scheme" per direct instruction.

import { useMemo, useState } from "react";
import SchoolSearch, { type SchoolSearchResult } from "@/components/SchoolSearch";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { TAG_COLOURS, cssVarNameForTag } from "@/lib/tag-colours";

type Row = { urn: string; name: string; distanceKm: number | null };
type SortMode = "distance" | "name";

export default function AddSubtractSchoolsWindow({
  targetName,
  schools,
  tickedUrns,
  onToggleTick,
  onSelectAllTicked,
  onUnselectAllTicked,
  onAddSchool,
  profilesByUrn,
  onClose,
}: {
  targetName: string;
  schools: Row[];
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  onSelectAllTicked: () => void;
  onUnselectAllTicked: () => void;
  onAddSchool: (result: SchoolSearchResult) => void;
  profilesByUrn: Map<string, DataViewSchoolProfile>;
  onClose: () => void;
}) {
  const hasDistance = schools.some((s) => s.distanceKm !== null);
  const [sortMode, setSortMode] = useState<SortMode>(hasDistance ? "distance" : "name");
  const [groupByLa, setGroupByLa] = useState(false);

  function sortRows(rows: Row[]): Row[] {
    return [...rows].sort((a, b) =>
      sortMode === "distance" ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : a.name.localeCompare(b.name),
    );
  }

  const groups = useMemo(() => {
    if (!groupByLa) return [{ laName: null as string | null, rows: sortRows(schools) }];
    const byLa = new Map<string, Row[]>();
    for (const s of schools) {
      const la = profilesByUrn.get(s.urn)?.laName ?? "Unknown LA";
      if (!byLa.has(la)) byLa.set(la, []);
      byLa.get(la)!.push(s);
    }
    return Array.from(byLa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([laName, rows]) => ({ laName, rows: sortRows(rows) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools, groupByLa, sortMode, profilesByUrn]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <style>{`
        .vd-compared-window { ${Object.entries(TAG_COLOURS)
          .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.light[1]};`)
          .join(" ")} }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-compared-window { ${Object.entries(TAG_COLOURS)
            .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.dark[1]};`)
            .join(" ")} }
        }
        :root[data-theme="dark"] .vd-compared-window { ${Object.entries(TAG_COLOURS)
          .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.dark[1]};`)
          .join(" ")} }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add or subtract schools"
        className="vd-compared-window flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Add/subtract schools</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Close
          </button>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-900">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Add a school</p>
          <SchoolSearch onSelect={onAddSchool} placeholder="Search to add…" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2 text-xs dark:border-neutral-900">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-500">
            <button type="button" className="underline" onClick={onSelectAllTicked}>
              Select all
            </button>
            <button type="button" className="underline" onClick={onUnselectAllTicked}>
              Unselect all
            </button>
          </div>
          <div className="flex items-center gap-3 text-neutral-500">
            {hasDistance && (
              <label className="flex items-center gap-1.5">
                Sort:
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="distance">Distance</option>
                  <option value="name">Name</option>
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={groupByLa} onChange={(e) => setGroupByLa(e.target.checked)} />
              Group by LA
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-xs text-neutral-500">
            {targetName} <span className="text-neutral-400">(this school)</span>
          </p>
          {groups.map((g) => (
            <div key={g.laName ?? "all"} className="mb-3">
              {g.laName && <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{g.laName}</h3>}
              <ul className="space-y-1">
                {g.rows.map((s) => (
                  <SchoolRow key={s.urn} school={s} ticked={tickedUrns.has(s.urn)} sector={profilesByUrn.get(s.urn)?.sector ?? null} onToggle={() => onToggleTick(s.urn)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SchoolRow({
  school,
  ticked,
  sector,
  onToggle,
}: {
  school: Row;
  ticked: boolean;
  sector: string | null;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <input type="checkbox" checked={ticked} onChange={onToggle} className="shrink-0" />
        {sector && (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: `var(${cssVarNameForTag(sector)})` }}
            title={sector}
          />
        )}
        <span className="truncate">{school.name}</span>
      </label>
      {school.distanceKm !== null && <span className="shrink-0 text-xs text-neutral-400">{school.distanceKm.toFixed(1)}km</span>}
    </li>
  );
}
