"use client";

// Member Data View "Compared with" panel (2026-09-08 full rework, per direct
// request -- docs/vicdata_phase3_member_data_view_compared_with_panel_redesign_v1.md
// did not actually exist on disk when this was built; see the logged decisions in
// docs/vicdata_data_view_open_questions.md for how that was handled and every real
// judgement call made below).
//
// Replaces the dropdown-based Sets picker AND the always-visible/accordion-collapsed
// schools list with: a row of named-set buttons (one click ticks the WHOLE set, no
// partial pre-tick), a "My sets" row of the member's own saved sets, and a single
// "Add/subtract schools" action that opens a real modal window (AddSubtractSchoolsWindow.tsx)
// holding the actual granular list -- the always-visible surface is just buttons, never
// something that grows with list length (the whole point, per direct instruction).
//
// Supersedes last round's Bug 2 accordion-collapse fix entirely (schoolsListCollapsed/
// the in-place <ul>/overflow pagination are gone, replaced by the window) and the
// old "+5 more" nearest-N expansion (superseded by the window's own "Add a school"
// search -- see the logged decision for why that was dropped rather than kept
// alongside the new window).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SchoolSearchResult } from "@/components/SchoolSearch";
import type { SetOption } from "@/lib/data-view-types";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";
import AddSubtractSchoolsWindow from "./AddSubtractSchoolsWindow";

type AdjacentLasResponse = { ownLaName: string | null; adjacent: { name: string }[] };

// A named-set button is "selected" purely by comparing what's actually ticked
// against the option's own real school list -- not by tracking "which button was
// last clicked." Per direct instruction: "once a member manually adds/removes
// schools inside the window, no named-set button should still visually read as
// selected if it no longer matches what's actually ticked" -- comparing live state
// this way means that's automatically true the instant tickedUrns changes, with no
// separate "dirty" flag to keep in sync. An empty/not-yet-loaded option (e.g. the
// boarding-quintile placeholder before its lazy load resolves) never reads as
// selected, since an empty set trivially "matching" an empty tick would be
// misleading before there's any real data.
function tickedMatchesSet(tickedUrns: Set<string>, schools: DefaultListEntry[]): boolean {
  if (schools.length === 0) return false;
  if (tickedUrns.size !== schools.length) return false;
  return schools.every((s) => tickedUrns.has(s.urn));
}

function SetButton({
  label,
  selected,
  disabled,
  title,
  onClick,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-pressed={!!selected}
      onClick={onClick}
      className={
        disabled
          ? "cursor-not-allowed rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-300 dark:border-neutral-800 dark:text-neutral-700"
          : selected
            ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
            : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }
    >
      {label}
    </button>
  );
}

export default function ComparatorSidebar({
  targetName,
  targetUrn,
  authToken,
  nearestOption,
  homeLaOption,
  local16PlusOption,
  boardingOption,
  savedSets,
  activeSet,
  onSelectSet,
  boardingQuintileLoading,
  tickedUrns,
  onToggleTick,
  onSelectAllTicked,
  onUnselectAllTicked,
  comparedHidden,
  onToggleComparedHidden,
  profilesByUrn,
}: {
  targetName: string;
  targetUrn: string;
  authToken: string | null;
  nearestOption: SetOption | null;
  homeLaOption: SetOption | null;
  local16PlusOption: SetOption | null;
  boardingOption: SetOption | null;
  savedSets: SetOption[];
  activeSet: SetOption | null;
  onSelectSet: (option: SetOption) => void;
  boardingQuintileLoading: boolean;
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  onSelectAllTicked: (urns: string[]) => void;
  onUnselectAllTicked: () => void;
  comparedHidden: boolean;
  onToggleComparedHidden: () => void;
  profilesByUrn: Map<string, DataViewSchoolProfile>;
}) {
  const [addedUrns, setAddedUrns] = useState<{ urn: string; name: string }[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);

  const [laInfo, setLaInfo] = useState<AdjacentLasResponse | null>(null);
  const [checkedLas, setCheckedLas] = useState<Set<string>>(new Set());
  const [laLoading, setLaLoading] = useState(false);
  const [laOpen, setLaOpen] = useState(false);
  // 2026-09-07, UX refinements round 2, P1 items 1+2 -- root cause, confirmed by
  // reproducing live (dots genuinely updated 11->7 for a real Camden-only
  // selection, but the dropdown's own label stayed frozen on "Nearest 10 (any
  // LA)"): applyLaSelection tagged its result `key: "multi_la"`, a key that never
  // exists in the `options` array the dropdown renders from. That dropdown is gone
  // now (this whole file's own rework), but the underlying out-of-order-response
  // race this also fixed is still real -- laRequestSeq is kept unchanged.
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
      if (mySeq !== laRequestSeq.current) return;
      if (!res.ok) return;
      const body = (await res.json()) as { set: { key: string; label: string; schools: DefaultListEntry[] } | null };
      if (body.set) {
        onSelectSet({ kind: "recipe", key: "multi_la", label: body.set.label, schools: body.set.schools });
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

  // Local Authorities has no single fixed backing list of its own (it's a live,
  // adjustable multi-select) -- "is the active set LA-scoped at all" on its own
  // isn't enough, though: per direct instruction, ANY named-set button (this one
  // included) must stop reading as selected the moment a manual edit makes the
  // ticked set no longer match. So this still requires the active set to genuinely
  // be LA-scoped, AND for tickedUrns to still match that set's own real list --
  // exactly the same tickedMatchesSet check every other button uses, just against
  // activeSet.schools directly since there's no separate fixed option object here.
  const isLaScoped =
    activeSet?.kind === "recipe" &&
    (activeSet.key === "in_la" || activeSet.key === "multi_la" || activeSet.key === "fe_local_16plus") &&
    tickedMatchesSet(tickedUrns, activeSet.schools);

  const schools = activeSet ? [...activeSet.schools, ...addedUrns.map((a) => ({ urn: a.urn, name: a.name, distanceKm: null }))] : [];

  function addSchool(result: SchoolSearchResult) {
    if (schools.some((s) => s.urn === result.urn)) return;
    setAddedUrns((prev) => [...prev, { urn: result.urn, name: result.current_name }]);
    onToggleTick(result.urn);
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Compared with</h2>

      <div className="flex flex-wrap gap-2">
        {nearestOption && (
          <SetButton label={nearestOption.label} selected={tickedMatchesSet(tickedUrns, nearestOption.schools)} onClick={() => onSelectSet(nearestOption)} />
        )}
        {homeLaOption && (
          <SetButton label={homeLaOption.label} selected={tickedMatchesSet(tickedUrns, homeLaOption.schools)} onClick={() => onSelectSet(homeLaOption)} />
        )}
        {local16PlusOption && (
          <SetButton
            label={local16PlusOption.label}
            selected={tickedMatchesSet(tickedUrns, local16PlusOption.schools)}
            onClick={() => onSelectSet(local16PlusOption)}
          />
        )}
        <SetButton label="Local Authorities" selected={isLaScoped} onClick={() => setLaOpen((o) => !o)} />
        <SetButton label="Region" disabled title="Not available yet -- the regional/national aggregation this needs hasn't been built." />
        <SetButton label="Nation" disabled title="Not available yet -- the regional/national aggregation this needs hasn't been built." />
        {boardingOption && (
          <SetButton
            label="Boarding schools"
            selected={tickedMatchesSet(tickedUrns, boardingOption.schools)}
            onClick={() => onSelectSet(boardingOption)}
          />
        )}
        <SetButton
          label="Same academy/school group"
          disabled
          title="Not available yet -- there's no real school-group/trust data in this dataset to compare against."
        />
      </div>

      {laOpen && (
        <div className="mt-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
          <div className="mb-1 flex w-full items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Local Authorities</span>
            <MapBoxCollapseToggle collapsed={!laOpen} onToggle={() => setLaOpen((o) => !o)} label="Local Authorities" />
          </div>
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
          </div>
        </div>
      )}

      {boardingQuintileLoading && <p className="mt-2 text-xs text-neutral-400">Computing national boarding quintile — this can take a little while…</p>}
      {activeSet?.kind === "recipe" && activeSet.note && <p className="mt-2 text-xs text-neutral-400">{activeSet.note}</p>}

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">My sets</h3>
        <div className="flex flex-wrap gap-2">
          {savedSets.map((s) => (
            <SetButton
              key={s.kind === "saved" ? s.id : s.key}
              label={s.label}
              selected={tickedMatchesSet(tickedUrns, s.schools)}
              onClick={() => onSelectSet(s)}
            />
          ))}
          <Link
            href="/sets/comparator/new"
            className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            + Add a list
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setWindowOpen(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Add/subtract schools ({schools.length})
        </button>
        <button type="button" className="text-neutral-500 underline" onClick={onToggleComparedHidden}>
          {comparedHidden ? "Show comparison data" : "Hide comparison data"}
        </button>
      </div>

      {activeSet?.kind === "saved" && (
        <div className="mt-3">
          <Link href={`/sets/${activeSet.id}`} className="text-xs underline">
            Edit set
          </Link>
        </div>
      )}

      {windowOpen && (
        <AddSubtractSchoolsWindow
          targetName={targetName}
          schools={schools}
          tickedUrns={tickedUrns}
          onToggleTick={onToggleTick}
          onSelectAllTicked={() => onSelectAllTicked(schools.map((s) => s.urn))}
          onUnselectAllTicked={onUnselectAllTicked}
          onAddSchool={addSchool}
          profilesByUrn={profilesByUrn}
          onClose={() => setWindowOpen(false)}
        />
      )}
    </div>
  );
}
