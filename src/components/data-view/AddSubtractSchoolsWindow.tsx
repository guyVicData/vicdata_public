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
import { relevantAgeBandsFor, type PhaseBandKey } from "@/lib/data-view-filters";
import type { SectorTag } from "@/lib/typology";
import { tagDisplayLabel } from "@/lib/typology";

type Row = { urn: string; name: string; distanceKm: number | null };
type SortMode = "distance" | "name";
// Add/subtract window round (2026-09-14), Part 4: "Group by" generalised from a
// single LA checkbox into a real choice, per direct instruction -- "select/
// deselect all schools of a given kind at once... generalise the existing
// grouping mechanism rather than adding a separate new control."
type GroupByMode = "none" | "la" | "sector" | "phase";

// Same four real sector buckets MapView's own SectorColourKey legend uses
// (typology.ts's SectorTag), same real order.
const ALL_SECTORS: SectorTag[] = ["Independent", "State", "FE", "Special Schools"];
const UNKNOWN_SECTOR_LABEL = "Unknown sector";
// Same real PhaseBandKey taxonomy used everywhere else in this build
// (data-view-filters.ts's own PHASE_BANDS), same real order.
const PHASE_GROUP_ORDER: PhaseBandKey[] = ["Early Years", "Junior", "Prep", "Senior", "Post 16", "Adult"];
const UNKNOWN_PHASE_LABEL = "Unknown phase";

type SchoolGroup = { key: string; label: string | null; rows: Row[] };

export default function AddSubtractSchoolsWindow({
  title = "Add/subtract schools",
  targetName,
  schools,
  tickedUrns,
  onToggleTick,
  onSelectAllTicked,
  onUnselectAllTicked,
  onGroupTicked,
  onAddSchool,
  profilesByUrn,
  onClose,
}: {
  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graph 3's own
  // "Add/subtract schools to this graph" reuse: a distinct title for that call
  // site's window, defaulting to the sidebar's original text so its own call site
  // is unaffected.
  title?: string;
  targetName: string;
  schools: Row[];
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  onSelectAllTicked: () => void;
  onUnselectAllTicked: () => void;
  onGroupTicked: (urns: string[], ticked: boolean) => void;
  // Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graph 3: optional now
  // -- the graph-scoped reuse's own candidates are deliberately limited to schools
  // already in the ticked/filtered comparator set ("not the wider nearby-schools
  // pool," per direct instruction), so that call site omits this entirely and the
  // open-search-to-add-ANY-school section below doesn't render, rather than
  // offering an affordance that contradicts its own candidate restriction. The
  // sidebar's own original call site is unaffected (still always passes this).
  onAddSchool?: (result: SchoolSearchResult) => void;
  profilesByUrn: Map<string, DataViewSchoolProfile>;
  onClose: () => void;
}) {
  const hasDistance = schools.some((s) => s.distanceKm !== null);
  const [sortMode, setSortMode] = useState<SortMode>(hasDistance ? "distance" : "name");
  const [groupBy, setGroupBy] = useState<GroupByMode>("none");

  function sortRows(rows: Row[]): Row[] {
    return [...rows].sort((a, b) =>
      sortMode === "distance" ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : a.name.localeCompare(b.name),
    );
  }

  // Add/subtract window round (2026-09-14), Part 4: a school can genuinely belong
  // to more than one phase band (a through-school -- e.g. real Junior+Senior+
  // Post-16 pupils under one URN). Decided plainly, not left ambiguous: it appears
  // in EVERY matching group, not just one "primary" band -- reusing
  // relevantAgeBandsFor's own established multi-band return shape verbatim (the
  // same real enrollment-aware phase-relevance function FilterBar's own pill
  // display already uses elsewhere in this build) rather than inventing a new
  // "pick just one" reduction this codebase has no other precedent for.
  const groups = useMemo((): SchoolGroup[] => {
    if (groupBy === "none") return [{ key: "all", label: null, rows: sortRows(schools) }];

    if (groupBy === "la") {
      const byLa = new Map<string, Row[]>();
      for (const s of schools) {
        const la = profilesByUrn.get(s.urn)?.laName ?? "Unknown LA";
        if (!byLa.has(la)) byLa.set(la, []);
        byLa.get(la)!.push(s);
      }
      return Array.from(byLa.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([laName, rows]) => ({ key: laName, label: laName, rows: sortRows(rows) }));
    }

    if (groupBy === "sector") {
      const bySector = new Map<string, Row[]>();
      for (const s of schools) {
        const sector = profilesByUrn.get(s.urn)?.sector ?? UNKNOWN_SECTOR_LABEL;
        if (!bySector.has(sector)) bySector.set(sector, []);
        bySector.get(sector)!.push(s);
      }
      return [...ALL_SECTORS, UNKNOWN_SECTOR_LABEL]
        .filter((k) => bySector.has(k))
        .map((k) => ({ key: k, label: tagDisplayLabel(k), rows: sortRows(bySector.get(k)!) }));
    }

    // phase
    const byPhase = new Map<string, Row[]>();
    for (const s of schools) {
      const profile = profilesByUrn.get(s.urn);
      const bands = profile ? relevantAgeBandsFor(profile) : [];
      if (bands.length === 0) {
        if (!byPhase.has(UNKNOWN_PHASE_LABEL)) byPhase.set(UNKNOWN_PHASE_LABEL, []);
        byPhase.get(UNKNOWN_PHASE_LABEL)!.push(s);
      } else {
        for (const b of bands) {
          if (!byPhase.has(b.key)) byPhase.set(b.key, []);
          byPhase.get(b.key)!.push(s);
        }
      }
    }
    return [...PHASE_GROUP_ORDER, UNKNOWN_PHASE_LABEL]
      .filter((k) => byPhase.has(k))
      .map((k) => ({ key: k, label: tagDisplayLabel(k), rows: sortRows(byPhase.get(k)!) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools, groupBy, sortMode, profilesByUrn]);

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
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Close
          </button>
        </div>

        {onAddSchool && (
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-900">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Add a school</p>
            <SchoolSearch onSelect={onAddSchool} placeholder="Search to add…" />
          </div>
        )}

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
              Group by:
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupByMode)}
                className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="none">None</option>
                <option value="la">LA</option>
                <option value="sector">Sector</option>
                <option value="phase">Phase</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-xs text-neutral-500">
            {targetName} <span className="text-neutral-400">(this school)</span>
          </p>
          {groups.map((g) => (
            <div key={g.key} className="mb-3">
              {g.label && (
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{g.label}</h3>
                  {/* Add/subtract window round (2026-09-14), Part 4: a working
                      select-all/deselect-all pair on EVERY group's own header row,
                      not just the whole-list controls above -- LA groups get this
                      for free too, same mechanism (onGroupTicked, additive/
                      subtractive over just this group's own URNs, never touching
                      ticks outside it). */}
                  <div className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-400">
                    <button type="button" className="underline" onClick={() => onGroupTicked(g.rows.map((r) => r.urn), true)}>
                      Select all
                    </button>
                    <button type="button" className="underline" onClick={() => onGroupTicked(g.rows.map((r) => r.urn), false)}>
                      Deselect all
                    </button>
                  </div>
                </div>
              )}
              <ul className="space-y-1">
                {g.rows.map((s) => (
                  <SchoolRow key={`${g.key}:${s.urn}`} school={s} ticked={tickedUrns.has(s.urn)} sector={profilesByUrn.get(s.urn)?.sector ?? null} onToggle={() => onToggleTick(s.urn)} />
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
            title={tagDisplayLabel(sector)}
          />
        )}
        <span className="truncate">{school.name}</span>
      </label>
      {school.distanceKm !== null && <span className="shrink-0 text-xs text-neutral-400">{school.distanceKm.toFixed(1)}km</span>}
    </li>
  );
}
