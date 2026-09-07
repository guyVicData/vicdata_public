"use client";

// Member Data View "Compared with" panel (2026-09-08 full rework, round 2 tweaks
// applied on top -- see docs/vicdata_data_view_open_questions.md for every logged
// decision, including why the redesign doc referenced for the original rework never
// actually existed on disk).
//
// Round 2 wording/behaviour tweaks, per direct request:
// - "Nearest 10 (any LA)" -> "Nearest 10 comparable schools"; gained a "+" control
//   (same one Local Authorities uses) to add/subtract five more at a time, reviving
//   the old "+5 more" mechanic that round 1 of this rework had dropped.
// - "In {LA} (all sectors)" -> "{LA} schools"; gained the same "+" control, which now
//   opens the Local Authorities picker as a real popup window (LocalAuthoritiesWindow.tsx,
//   "like the schools list") instead of an inline expanding panel, and the button's
//   own label grows a "+N" suffix once more than the home LA is checked (e.g. "Camden
//   schools +1") -- no separate standalone "Local Authorities" button anymore.
// - The "Schools and FE colleges, 16+, in {LA}" recipe lost its own standalone
//   button entirely -- now triggered by the Post-16 phase filter itself
//   (DataViewShell.tsx's own effect watches for Post-16 turning on), not a button
//   here at all.
// - "Region"/"Nation" placeholders relabelled "London Schools"/"England Schools".
// - Every button now stacks one per line (a vertical list), not a wrapped row.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SchoolSearchResult } from "@/components/SchoolSearch";
import type { SetOption } from "@/lib/data-view-types";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import AddSubtractSchoolsWindow from "./AddSubtractSchoolsWindow";
import LocalAuthoritiesWindow, { type AdjacentLasResponse } from "./LocalAuthoritiesWindow";

const NEAREST_STEP = 5;
const NEAREST_MIN = 10;

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

// "In Camden (all sectors)" -> "Camden"; "16+ provision in Camden" (the FE-college-
// target equivalent of the home-LA slot) -> "Camden" too -- same short-name
// treatment either way. Falls back to the option's own raw label if neither known
// shape matches, rather than guessing at a new one.
function homeLaShortName(rawLabel: string): string | null {
  const m = /^In (.+) \(all sectors\)$/.exec(rawLabel) ?? /^16\+ provision in (.+)$/.exec(rawLabel);
  return m ? m[1] : null;
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

// The small round "+" trigger shared by Nearest 10 (opens a quick +/-5 stepper) and
// the home-LA button (opens the Local Authorities window) -- one consistent
// "add/subtract more" affordance, per direct request to reuse it for both.
function PlusButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-sm leading-none text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
    >
      +
    </button>
  );
}

export default function ComparatorSidebar({
  targetName,
  targetUrn,
  authToken,
  nearestOption,
  homeLaOption,
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
  const [nearestPopupOpen, setNearestPopupOpen] = useState(false);
  const [nearestExpanding, setNearestExpanding] = useState(false);

  const [laInfo, setLaInfo] = useState<AdjacentLasResponse | null>(null);
  const [checkedLas, setCheckedLas] = useState<Set<string>>(new Set());
  const [laLoading, setLaLoading] = useState(false);
  const [laWindowOpen, setLaWindowOpen] = useState(false);
  // 2026-09-07, UX refinements round 2, P1 items 1+2 -- root cause, confirmed by
  // reproducing live: applyLaSelection had no guard against out-of-order responses,
  // so two overlapping LA toggles could let a slower, staler response overwrite a
  // newer one. Every call still carries its own sequence number.
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
  // isn't enough: per direct instruction, ANY named-set button must stop reading as
  // selected the moment a manual edit makes the ticked set no longer match. So this
  // still requires tickedUrns to genuinely match activeSet's own real list too.
  const isLaScoped =
    activeSet?.kind === "recipe" &&
    (activeSet.key === "in_la" || activeSet.key === "multi_la" || activeSet.key === "fe_local_16plus") &&
    tickedMatchesSet(tickedUrns, activeSet.schools);
  const extraLaCount = Math.max(0, checkedLas.size - 1);
  const homeLaLabel = homeLaOption ? (homeLaShortName(homeLaOption.label) ?? homeLaOption.label) : null;
  const homeLaButtonLabel = homeLaLabel ? `${homeLaLabel} schools${extraLaCount > 0 ? ` +${extraLaCount}` : ""}` : "";

  // Nearest 10's own "+"/"-" stepper reuses onSelectSet directly rather than a
  // separate expand/contract code path: building a modified copy of the recipe with
  // a longer or shorter `.schools` array and selecting IT ticks the whole new list
  // in one step, the same way clicking any other named-set button already does
  // (selectSet's own "tick everything" rule, round 1 of this rework). The CURRENT
  // effective count comes from activeSet itself when it's genuinely the nearest-N
  // set (so a prior +5 is remembered), falling back to the base recipe's own 10
  // otherwise.
  const nearestIsActive = activeSet?.kind === "recipe" && (activeSet.key === "nearest_10" || activeSet.key === "fe_nearest_10");
  const currentNearestSchools = nearestIsActive ? activeSet.schools : (nearestOption?.schools ?? []);

  async function expandNearestBy(delta: number) {
    if (!nearestOption) return;
    const nextCount = Math.max(NEAREST_MIN, currentNearestSchools.length + delta);
    if (delta > 0) {
      if (!authToken) return;
      setNearestExpanding(true);
      try {
        const res = await fetch(`/api/data-view/expand-nearest?urn=${targetUrn}&count=${nextCount}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { list: { schools: DefaultListEntry[] } };
        onSelectSet({ ...nearestOption, schools: body.list.schools });
      } finally {
        setNearestExpanding(false);
      }
    } else {
      onSelectSet({ ...nearestOption, schools: currentNearestSchools.slice(0, nextCount) });
    }
  }

  const schools = activeSet ? [...activeSet.schools, ...addedUrns.map((a) => ({ urn: a.urn, name: a.name, distanceKm: null }))] : [];

  function addSchool(result: SchoolSearchResult) {
    if (schools.some((s) => s.urn === result.urn)) return;
    setAddedUrns((prev) => [...prev, { urn: result.urn, name: result.current_name }]);
    onToggleTick(result.urn);
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Compared with</h2>

      <div className="flex flex-col items-start gap-2">
        {nearestOption && (
          <div className="relative flex items-center gap-1.5">
            <SetButton
              label="Nearest 10 comparable schools"
              selected={tickedMatchesSet(tickedUrns, nearestOption.schools) || (nearestIsActive && tickedMatchesSet(tickedUrns, currentNearestSchools))}
              onClick={() => onSelectSet(nearestOption)}
            />
            <PlusButton title="Add or subtract five more" onClick={() => setNearestPopupOpen((o) => !o)} />
            {nearestPopupOpen && (
              // 2026-09-08, real bug fix found during live verification: this popup
              // stayed open after +5/-5, sitting directly over the next button-row
              // down (the vertical one-button-per-line layout stacks rows tightly)
              // and silently intercepting its clicks. Closes itself the moment a
              // step is actually applied, not just on an outside click.
              <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-2 text-xs shadow-md dark:border-neutral-800 dark:bg-neutral-950">
                <span className="text-neutral-500">{currentNearestSchools.length} schools</span>
                <button
                  type="button"
                  disabled={nearestExpanding}
                  className="underline disabled:opacity-50"
                  onClick={() => {
                    expandNearestBy(NEAREST_STEP);
                    setNearestPopupOpen(false);
                  }}
                >
                  {nearestExpanding ? "Loading…" : `+${NEAREST_STEP} more`}
                </button>
                <button
                  type="button"
                  disabled={currentNearestSchools.length <= NEAREST_MIN}
                  className="underline disabled:opacity-50"
                  onClick={() => {
                    expandNearestBy(-NEAREST_STEP);
                    setNearestPopupOpen(false);
                  }}
                >
                  -{NEAREST_STEP} fewer
                </button>
              </div>
            )}
          </div>
        )}

        {homeLaOption && (
          <div className="flex items-center gap-1.5">
            <SetButton label={homeLaButtonLabel} selected={isLaScoped} onClick={() => applyLaSelection(checkedLas)} />
            <PlusButton title="Add or subtract local authorities" onClick={() => setLaWindowOpen(true)} />
          </div>
        )}

        {boardingOption && (
          <SetButton
            label="Boarding schools"
            selected={tickedMatchesSet(tickedUrns, boardingOption.schools)}
            onClick={() => onSelectSet(boardingOption)}
          />
        )}
        <SetButton label="London Schools" disabled title="Not available yet -- the regional aggregation this needs hasn't been built." />
        <SetButton label="England Schools" disabled title="Not available yet -- the national aggregation this needs hasn't been built." />
        <SetButton
          label="Same academy/school group"
          disabled
          title="Not available yet -- there's no real school-group/trust data in this dataset to compare against."
        />
      </div>

      {boardingQuintileLoading && <p className="mt-2 text-xs text-neutral-400">Computing national boarding quintile — this can take a little while…</p>}
      {activeSet?.kind === "recipe" && activeSet.note && <p className="mt-2 text-xs text-neutral-400">{activeSet.note}</p>}

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">My sets</h3>
        <div className="flex flex-col items-start gap-2">
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

      {laWindowOpen && (
        <LocalAuthoritiesWindow
          laInfo={laInfo}
          checkedLas={checkedLas}
          laLoading={laLoading}
          onToggleLa={toggleLa}
          onSelectAllLas={selectAllLas}
          onClose={() => setLaWindowOpen(false)}
        />
      )}
    </div>
  );
}
