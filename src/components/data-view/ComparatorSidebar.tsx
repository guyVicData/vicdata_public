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

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SchoolSearch, { type SchoolSearchResult } from "@/components/SchoolSearch";
import type { SetOption } from "@/lib/data-view-types";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";

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
  onSelectAllTicked,
  onUnselectAllTicked,
  comparedHidden,
  onToggleComparedHidden,
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
  onSelectAllTicked: (urns: string[]) => void;
  onUnselectAllTicked: () => void;
  comparedHidden: boolean;
  onToggleComparedHidden: () => void;
  initialTickedCount: number;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [addedUrns, setAddedUrns] = useState<{ urn: string; name: string }[]>([]);
  // 2026-09-08, bug fix: last round's "Hide/Show compared schools" was a real
  // misreading of the request -- it hides schools' DATA from Map/Dashboard/
  // Rankings (comparedHidden, still below), when what was actually meant was
  // collapsing this SCHOOLS LIST specifically, since a long one was pushing the
  // sidebar's own height too tall and (since the sidebar and the map share one
  // row) dragging the map's height down with it. Purely a local display/layout
  // concern, same footing as `overflowOpen` above -- no reason for DataViewShell
  // to know about it.
  const [schoolsListCollapsed, setSchoolsListCollapsed] = useState(false);

  const [laInfo, setLaInfo] = useState<AdjacentLasResponse | null>(null);
  const [checkedLas, setCheckedLas] = useState<Set<string>>(new Set());
  const [laLoading, setLaLoading] = useState(false);
  const [laOpen, setLaOpen] = useState(false);
  const [expanding, setExpanding] = useState(false);
  // 2026-09-07, UX refinements round 2, P1 items 1+2 -- root cause, confirmed by
  // reproducing live (dots genuinely updated 11->7 for a real Camden-only
  // selection, but the dropdown's own label stayed frozen on "Nearest 10 (any
  // LA)"): applyLaSelection tagged its result `key: "multi_la"`, a key that never
  // exists in the `options` array the dropdown renders from (that array only ever
  // holds the server's fixed recipe/saved sets) -- so the <select>'s `value` never
  // matched any real <option>, and the browser silently fell back to showing
  // whichever option happened to be first. `laRequestSeq` is a second, related fix
  // found while fixing the first: applyLaSelection had no guard against
  // out-of-order responses at all, so two overlapping LA toggles (a real
  // possibility -- nothing stopped a member clicking a second checkbox before the
  // first fetch resolved) could let a slower, staler response overwrite a newer
  // one -- "dots don't appear consistently for Camden" is exactly what that race
  // looks like from the outside. Every call now carries its own sequence number;
  // a response is only applied if it's still the most recent request in flight.
  const laRequestSeq = useRef(0);

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
    const mySeq = ++laRequestSeq.current;
    setLaLoading(true);
    try {
      const res = await fetch(`/api/data-view/la-set?urn=${targetUrn}&las=${Array.from(next).map(encodeURIComponent).join(",")}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // A newer LA toggle fired while this one was in flight -- its own response
      // (or one still to come) is the one that should win, not this stale one.
      if (mySeq !== laRequestSeq.current) return;
      if (!res.ok) return;
      const body = (await res.json()) as { set: { key: string; label: string; schools: DefaultListEntry[] } | null };
      if (body.set) {
        onSelectSet({ kind: "recipe", key: "multi_la", label: body.set.label, schools: body.set.schools });
        // 2026-09-08, per direct request: picking an ADDITIONAL LA is a deliberate
        // "widen the comparison" move -- assume the member wants every school in the
        // now-broader area, not just the usual first-INITIAL_TICKED_COUNT default
        // onSelectSet's own recipe branch would otherwise leave ticked. Runs as a
        // second setTickedUrns call right after onSelectSet's own (same tick, so this
        // one simply wins) rather than changing onSelectSet's general default, which
        // every OTHER recipe selection (Nearest 10, the dropdown's own single-LA
        // option, etc.) still relies on.
        onSelectAllTicked(body.set.schools.map((s) => s.urn));
      }
    } finally {
      if (mySeq === laRequestSeq.current) setLaLoading(false);
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

  // 2026-09-07, UX refinements round 2, P1 items 1+2: the LA checklist is a
  // refinement panel for an LA-SCOPED active set, not a standing control -- it
  // only makes sense (and only renders at all) once the active set actually IS
  // one ("In {LA} (all sectors)", key "in_la" from the server default, or
  // "multi_la" once the member has ticked/unticked LAs here). Reached the first
  // time via the ORDINARY dropdown's own "In {LA} (all sectors)" entry (list2,
  // already in `options`) -- not circular, since that entry already exists
  // independently of this panel. "Nearest 10 (any LA)" and every other recipe
  // correctly show nothing here now.
  const isLaScoped = activeSet?.kind === "recipe" && (activeSet.key === "in_la" || activeSet.key === "multi_la");

  // The dropdown's own `options` prop only ever holds the server's fixed recipe/
  // saved sets -- a "multi_la" selection built here has no matching entry there at
  // all, which is the exact reason its label used to freeze on whatever the
  // previous real option was. Injecting the CURRENT active set as a synthetic
  // extra option (only when it genuinely isn't already one of the real ones)
  // keeps the <select>'s displayed text always honestly in sync with whatever is
  // actually active, multi-LA included.
  const activeSetValue = activeSet ? (activeSet.kind === "recipe" ? `recipe:${activeSet.key}` : `saved:${activeSet.id}`) : "";
  const activeSetIsListed = options.some((o) => (o.kind === "recipe" ? `recipe:${o.key}` : `saved:${o.id}`) === activeSetValue);
  const dropdownOptions = activeSet && !activeSetIsListed ? [activeSet, ...options] : options;

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
        value={activeSetValue}
        onChange={(e) => {
          const [kind, id] = e.target.value.split(":");
          const found = dropdownOptions.find((o) => (kind === "recipe" ? o.kind === "recipe" && o.key === id : o.kind === "saved" && o.id === id));
          if (found) onSelectSet(found);
        }}
      >
        {dropdownOptions.map((o) => (
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

      {isLaScoped && (
      <div className="mb-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        {/* 2026-09-07, UX refinements round 2, P4: was a bare unicode ▾/▸ glyph,
            roughly half the visual size of every other open/close arrow in the
            shell -- swapped for MapBoxCollapseToggle, the exact same chevron
            FilterBar.tsx's own collapse arrow uses, so there's one consistent
            arrow style rather than several ad hoc ones. Rendered as a sibling of
            the label (not nested inside one <button>, which the text label also
            still is, for a bigger click target) since MapBoxCollapseToggle
            renders its own <button> and two interactive elements can't nest. */}
        <div className="mb-1 flex w-full items-center justify-between">
          <button type="button" className="text-xs font-semibold uppercase tracking-wide text-neutral-500" onClick={() => setLaOpen((o) => !o)}>
            Local Authorities
          </button>
          <MapBoxCollapseToggle collapsed={!laOpen} onToggle={() => setLaOpen((o) => !o)} label="Local Authorities" />
        </div>
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
      )}

      {/* 2026-09-08, bug fix: accordion collapse for the schools list itself --
          the actual fix for "long lists push the sidebar's height too tall and
          drag the map's height down with it" (the sidebar and map share one
          row). Reuses MapBoxCollapseToggle, the same arrow FilterBar.tsx's
          collapse control and the Local Authorities panel both already use, per
          the standing "one consistent arrow style" rule. Collapsed state shows
          just the real count, always -- even collapsed, per direct instruction. */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Schools ({schools.length})
        </h3>
        <MapBoxCollapseToggle collapsed={schoolsListCollapsed} onToggle={() => setSchoolsListCollapsed((c) => !c)} label="schools list" />
      </div>

      {!schoolsListCollapsed && (
        <>
          {hasDistance && <p className="mb-2 text-xs text-neutral-400">Sorted by distance (km)</p>}

          <p className="mb-2 text-xs text-neutral-500">
            {targetName} <span className="text-neutral-400">(this school)</span>
          </p>

          {/* 2026-09-07, UX refinements round 2, P3 items 8+9: "Select all"/
              "Unselect all" genuinely change which schools are ticked
              (tickedUrns membership); "Hide/Show comparison data" deliberately
              does NOT (comparedHidden -- DataViewShell's own comment on that
              state explains why these two are kept clearly separate rather than
              one control doing both).
              2026-09-08: relabelled from "Hide/Show compared schools" -- that
              exact wording is now also, confusingly, what the accordion header
              above it could describe. Kept as a real, separate, legitimate
              feature (Guy's own call: cheap to leave in, hides DATA from Map/
              Dashboard/Rankings without touching set membership, genuinely not
              the same thing as this list's own collapse) but renamed so the two
              controls can't be mistaken for each other. */}
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            <button type="button" className="underline" onClick={() => onSelectAllTicked(schools.map((s) => s.urn))}>
              Select all
            </button>
            <button type="button" className="underline" onClick={onUnselectAllTicked}>
              Unselect all
            </button>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <button type="button" className="underline" onClick={onToggleComparedHidden}>
              {comparedHidden ? "Show comparison data" : "Hide comparison data"}
            </button>
          </div>

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
        </>
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
