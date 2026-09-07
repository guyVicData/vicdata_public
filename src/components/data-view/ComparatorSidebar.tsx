"use client";

// Member Data View "Compared with" panel (2026-09-08 full rework; rounds 2-4 of
// live-testing fixes applied on top -- see docs/vicdata_data_view_open_questions.md
// for every logged decision).
//
// Round 4 (live-testing fixes 3-6), per direct request:
// - "Nearest 10 comparable schools" -> "Nearest 10 schools"; the Add/subtract-
//   schools count now includes the focus school itself (11, not 10); the button
//   grows the same "+N" suffix the home-LA button already uses once expanded past
//   the base 10, instead of showing nothing.
// - Shared map-based loading indicator: clicking a named-set button now shows as
//   "selected" (pressed) the instant it's clicked, not only once the real data
//   arrives; the actual wait shows as a loading overlay ON THE MAP
//   (onLoadingChange, surfaced up to DataViewShell/MapView), not an unresponsive
//   button or an easy-to-miss in-panel message -- covers the home-LA button, the
//   Local Authorities picker, and the Boarding schools button/its own "+5 more"
//   alike, one shared pattern rather than three separate fixes.
// - A shared request-sequence guard (setRequestSeq) now covers EVERY set-changing
//   control here, not just the Local Authorities toggles UX round 2 originally
//   fixed -- any control's stale, slower-to-resolve response is invalidated the
//   moment a newer selection (from ANY control, including a plain button click)
//   has already won. DataViewShell.tsx's own selectSet has a matching, more
//   fundamental version of this same guard for the boarding lazy-load path
//   specifically, since that async operation lives there, not here.
// - Boarding schools gained the same "+5 more" stepper Nearest 10 has, with a
//   running-total "+N" label (not a flat "+5" repeated every click).

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
const BOARDING_STEP = 5;
const BOARDING_MIN = 10;

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

// The small round "+" trigger shared by Nearest 10 and Boarding schools (a quick
// +/-5 stepper each) and the home-LA button (opens the Local Authorities window) --
// one consistent "add/subtract more" affordance, per direct request to reuse it.
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
  onLoadingChange,
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
  // 2026-09-08, shared map-based loading indicator (live-testing fix round 3): every
  // async set-changing operation this component owns (LA toggles, Nearest/Boarding
  // "+5 more") reports its combined loading state up so DataViewShell/MapView can
  // show ONE spinner on the map, rather than three separate in-panel treatments.
  // Optional label lets the Boarding-specific copy survive the move onto the map.
  onLoadingChange: (loading: boolean, label?: string) => void;
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
  const [boardingPopupOpen, setBoardingPopupOpen] = useState(false);
  const [boardingExpanding, setBoardingExpanding] = useState(false);

  const [laInfo, setLaInfo] = useState<AdjacentLasResponse | null>(null);
  const [checkedLas, setCheckedLas] = useState<Set<string>>(new Set());
  const [laLoading, setLaLoading] = useState(false);
  const [laWindowOpen, setLaWindowOpen] = useState(false);
  // 2026-09-07/08: a SHARED sequence counter across every set-changing control in
  // this component (not just Local Authorities, which is all UX round 2's own fix
  // covered) -- any control's async response is only applied if it's still the most
  // recent selection made ANYWHERE in this panel. Bumped by every control, both
  // async (before its own fetch) and instant (a plain button click), so a slow LA
  // fetch can never overwrite a snappier Nearest-10 click that happened while it was
  // still in flight, or vice versa. See DataViewShell.tsx's own selectSet for the
  // complementary, more fundamental version of this guard covering the Boarding
  // lazy-load path, which lives there instead.
  const setRequestSeq = useRef(0);

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

  // Every loading flag this component owns, combined into the one shared signal
  // DataViewShell/MapView actually render. Boarding's own copy takes priority when
  // it's genuinely what's happening (it's the one with real, useful "this is slow"
  // context; the others share a generic "Loading schools…" default at the map layer).
  useEffect(() => {
    const loading = laLoading || nearestExpanding || boardingExpanding;
    onLoadingChange(loading, boardingExpanding ? "Computing national boarding quintile — this can take a little while…" : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laLoading, nearestExpanding, boardingExpanding]);

  async function applyLaSelection(next: Set<string>) {
    setCheckedLas(next);
    if (!authToken || next.size === 0) return;
    const mySeq = ++setRequestSeq.current;
    setLaLoading(true);
    try {
      const res = await fetch(`/api/data-view/la-set?urn=${targetUrn}&las=${Array.from(next).map(encodeURIComponent).join(",")}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (mySeq !== setRequestSeq.current) return;
      if (!res.ok) return;
      const body = (await res.json()) as { set: { key: string; label: string; schools: DefaultListEntry[] } | null };
      if (body.set) {
        onSelectSet({ kind: "recipe", key: "multi_la", label: body.set.label, schools: body.set.schools });
        onSelectAllTicked(body.set.schools.map((s) => s.urn));
      }
    } finally {
      // 2026-09-08, real bug fix found during live verification: this used to only
      // clear laLoading when mySeq still matched -- correct for not letting a STALE
      // response prematurely clear a NEWER LA request's own flag, but that guard
      // meant a request that got superseded by a DIFFERENT control (a plain
      // Nearest-10/Boarding click, which also bumps this shared sequence) left
      // laLoading stuck true forever, since nothing else was ever going to satisfy
      // that check again -- the home-LA button would read as permanently "pressed."
      // The sequence guard's real job is only to gate whether the result gets
      // APPLIED (above); this fetch is unconditionally done, so its own flag always
      // clears.
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

  // Every DIRECT (non-async) selection -- a plain Nearest-10/Boarding/saved-set
  // click -- also bumps the shared sequence, so it correctly invalidates whatever
  // slower LA/expansion fetch might still be in flight from an earlier click.
  function selectNamed(option: SetOption) {
    setRequestSeq.current++;
    onSelectSet(option);
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
  // (selectSet's own "tick everything" rule). The CURRENT effective count comes
  // from activeSet itself when it's genuinely the nearest-N set (so a prior +5 is
  // remembered), falling back to the base recipe's own 10 otherwise. The button's
  // own label carries the same running-total "+N" suffix the home-LA button uses,
  // not a flat "+5" repeated on every click.
  const nearestIsActive = activeSet?.kind === "recipe" && (activeSet.key === "nearest_10" || activeSet.key === "fe_nearest_10");
  const currentNearestSchools = nearestIsActive ? activeSet.schools : (nearestOption?.schools ?? []);
  const nearestExtra = nearestOption ? Math.max(0, currentNearestSchools.length - nearestOption.schools.length) : 0;
  const nearestButtonLabel = `Nearest 10 schools${nearestExtra > 0 ? ` +${nearestExtra}` : ""}`;

  async function expandNearestBy(delta: number) {
    if (!nearestOption) return;
    const nextCount = Math.max(NEAREST_MIN, currentNearestSchools.length + delta);
    if (delta > 0) {
      if (!authToken) return;
      const mySeq = ++setRequestSeq.current;
      setNearestExpanding(true);
      try {
        const res = await fetch(`/api/data-view/expand-nearest?urn=${targetUrn}&count=${nextCount}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (mySeq !== setRequestSeq.current) return;
        if (!res.ok) return;
        const body = (await res.json()) as { list: { schools: DefaultListEntry[] } };
        onSelectSet({ ...nearestOption, schools: body.list.schools });
      } finally {
        // Always clears, regardless of sequence -- see applyLaSelection's own
        // comment for why a sequence-gated clear here would leave this button
        // stuck "pressed" forever once superseded by a different control.
        setNearestExpanding(false);
      }
    } else {
      setRequestSeq.current++;
      onSelectSet({ ...nearestOption, schools: currentNearestSchools.slice(0, nextCount) });
    }
  }

  // Same pattern as Nearest 10, scoped to the Boarding schools recipe -- see
  // default-comparator-lists.ts's own buildBoardingQuintileList comment for why
  // this is a real, ~41s-ish server round-trip each time rather than a cheap
  // client-side slice: the underlying national census scan isn't cached between
  // calls, and building a cache for one control felt like more than this round
  // asked for. The shared map loading indicator (with Boarding's own specific
  // copy) is what makes that wait legible now instead of a silent pause.
  const boardingIsActive = activeSet?.kind === "recipe" && activeSet.key === "boarding_quintile";
  const currentBoardingSchools = boardingIsActive ? activeSet.schools : (boardingOption?.schools ?? []);
  const boardingExtra = boardingOption ? Math.max(0, currentBoardingSchools.length - boardingOption.schools.length) : 0;
  const boardingButtonLabel = `Boarding schools${boardingExtra > 0 ? ` +${boardingExtra}` : ""}`;

  async function expandBoardingBy(delta: number) {
    if (!boardingOption) return;
    const nextCount = Math.max(BOARDING_MIN, currentBoardingSchools.length + delta);
    if (delta > 0) {
      if (!authToken) return;
      const mySeq = ++setRequestSeq.current;
      setBoardingExpanding(true);
      try {
        const res = await fetch(`/api/data-view/boarding-quintile-list?urn=${targetUrn}&count=${nextCount}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (mySeq !== setRequestSeq.current) return;
        if (!res.ok) return;
        const body = (await res.json()) as { list3: { key: string; label: string; schools: DefaultListEntry[]; note?: string } | null };
        if (body.list3) onSelectSet({ kind: "recipe", key: body.list3.key, label: body.list3.label, schools: body.list3.schools, note: body.list3.note });
      } finally {
        // Always clears -- see applyLaSelection's own comment for why.
        setBoardingExpanding(false);
      }
    } else {
      setRequestSeq.current++;
      onSelectSet({ ...boardingOption, schools: currentBoardingSchools.slice(0, nextCount) });
    }
  }

  // Add/subtract-schools count now includes the focus school itself (per direct
  // instruction: "read as 11 (10 comparators + focus school), not 10") -- schools
  // never includes the target (every candidate query excludes it, matching this
  // codebase's own convention everywhere else), so +1 is always safe, never a
  // double-count.
  const schools = activeSet ? [...activeSet.schools, ...addedUrns.map((a) => ({ urn: a.urn, name: a.name, distanceKm: null }))] : [];
  const totalWithFocus = schools.length + 1;

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
              label={nearestButtonLabel}
              selected={tickedMatchesSet(tickedUrns, currentNearestSchools)}
              onClick={() => selectNamed(nearestOption)}
            />
            <PlusButton title="Add or subtract five more" onClick={() => setNearestPopupOpen((o) => !o)} />
            {nearestPopupOpen && (
              // Closes itself the moment a step is actually applied, not just on an
              // outside click -- an earlier version of this popup stayed open and
              // sat over the row below it, intercepting its clicks.
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
            {/* 2026-09-08: selected now ALSO reads true the instant the button is
                clicked (laLoading flips true synchronously inside applyLaSelection,
                before its fetch even starts) -- "acknowledge the click immediately,"
                per direct instruction, rather than sitting unchanged until the real
                data arrives several seconds later. */}
            <SetButton label={homeLaButtonLabel} selected={isLaScoped || laLoading} onClick={() => applyLaSelection(checkedLas)} />
            <PlusButton title="Add or subtract local authorities" onClick={() => setLaWindowOpen(true)} />
          </div>
        )}

        {boardingOption && (
          <div className="relative flex items-center gap-1.5">
            <SetButton
              label={boardingButtonLabel}
              selected={tickedMatchesSet(tickedUrns, currentBoardingSchools) || boardingQuintileLoading}
              onClick={() => selectNamed(boardingOption)}
            />
            <PlusButton title="Add or subtract five more" onClick={() => setBoardingPopupOpen((o) => !o)} />
            {boardingPopupOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-2 text-xs shadow-md dark:border-neutral-800 dark:bg-neutral-950">
                <span className="text-neutral-500">{currentBoardingSchools.length} schools</span>
                <button
                  type="button"
                  disabled={boardingExpanding}
                  className="underline disabled:opacity-50"
                  onClick={() => {
                    expandBoardingBy(BOARDING_STEP);
                    setBoardingPopupOpen(false);
                  }}
                >
                  {boardingExpanding ? "Loading…" : `+${BOARDING_STEP} more`}
                </button>
                <button
                  type="button"
                  disabled={currentBoardingSchools.length <= BOARDING_MIN}
                  className="underline disabled:opacity-50"
                  onClick={() => {
                    expandBoardingBy(-BOARDING_STEP);
                    setBoardingPopupOpen(false);
                  }}
                >
                  -{BOARDING_STEP} fewer
                </button>
              </div>
            )}
          </div>
        )}
        <SetButton label="London Schools" disabled title="Not available yet -- the regional aggregation this needs hasn't been built." />
        <SetButton label="England Schools" disabled title="Not available yet -- the national aggregation this needs hasn't been built." />
        <SetButton
          label="Same academy/school group"
          disabled
          title="Not available yet -- there's no real school-group/trust data in this dataset to compare against."
        />
      </div>

      {/* 2026-09-08: the boarding-quintile loading message used to live here,
          "positioned somewhere easy to miss inside the panel" (direct feedback) --
          removed in favour of the shared map-based indicator above, which shows
          this same copy on the map itself instead. */}
      {activeSet?.kind === "recipe" && activeSet.note && <p className="mt-2 text-xs text-neutral-400">{activeSet.note}</p>}

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">My sets</h3>
        <div className="flex flex-col items-start gap-2">
          {savedSets.map((s) => (
            <SetButton
              key={s.kind === "saved" ? s.id : s.key}
              label={s.label}
              selected={tickedMatchesSet(tickedUrns, s.schools)}
              onClick={() => selectNamed(s)}
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
          Add/subtract schools ({totalWithFocus})
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
