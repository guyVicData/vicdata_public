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
import type { SetOption, RecipeOption } from "@/lib/data-view-types";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import type { FilteredCount } from "@/lib/data-view-filters";
import { TAG_COLOURS, contrastingTextColour } from "@/lib/tag-colours";
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

// Compared-with panel round (2026-09-10), item 4: brings this button's active state
// in line with FilterBar.tsx's own Pill convention (confirmed by reading it directly)
// -- active fills with the VALUE's own real TAG_COLOURS colour, not a generic black
// fill, using the exact same inline-light/CSS-custom-property-dark technique so both
// components stay pixel-consistent in both themes. Most of these buttons (Nearest 10
// outside its boarding-quintile recipe, Home LA, Region, Nation, a saved set) have no
// single natural tag the way a boarding-quintile recipe genuinely does ("Boarding") --
// `tagKey` is optional for exactly that reason, falling back to TAG_COLOURS.Focus (the
// existing "this is the one that matters" accent already used elsewhere in this
// codebase) rather than inventing a new colour with no established meaning. A
// provisional choice, same status as every other colour in tag-colours.ts -- logged
// for Guy to react to live, not locked in.
function SetButton({
  label,
  selected,
  disabled,
  title,
  onClick,
  tagKey,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  tagKey?: string;
}) {
  const tagColours = (tagKey && TAG_COLOURS[tagKey]) || TAG_COLOURS.Focus;
  const fillLight = tagColours.light[1];
  const fillDark = tagColours.dark[1];
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
            ? "set-button-active rounded-full border px-3 py-1 text-xs font-medium"
            : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }
      style={
        selected
          ? ({
              "--set-button-bg-dark": fillDark,
              "--set-button-fg-dark": contrastingTextColour(fillDark),
              backgroundColor: fillLight,
              borderColor: fillLight,
              color: contrastingTextColour(fillLight),
            } as React.CSSProperties)
          : undefined
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
  regionOption,
  nationOption,
  savedSets,
  activeSet,
  onSelectSet,
  regionNationLoadingScope,
  onLoadingChange,
  tickedUrns,
  onToggleTick,
  onSelectAllTicked,
  onUnselectAllTicked,
  onGroupTicked,
  comparedHidden,
  onToggleComparedHidden,
  profilesByUrn,
  compareNumbers,
  compareSchoolCount,
  compareSchoolsNotLoaded,
  compareSentence,
  addedUrns,
  onAddSchool,
}: {
  targetName: string;
  targetUrn: string;
  authToken: string | null;
  // Compared-with panel round (2026-09-10), item 2: there is no longer a separate
  // Boarding schools option -- for a genuine boarding target, DataViewShell resolves
  // this to WHICHEVER recipe "Nearest 10" currently means (the ordinary nearest-10
  // match, or the boarding-quintile recipe, depending on the target's own quintile
  // band and the live boarding filter -- see DataViewShell's own resolveNearestOption
  // for the gate). This component only ever renders the ONE resulting button/stepper,
  // keyed off whichever `.key` comes back, never two.
  nearestOption: RecipeOption | null;
  homeLaOption: SetOption | null;
  regionOption: SetOption | null;
  nationOption: SetOption | null;
  savedSets: SetOption[];
  activeSet: SetOption | null;
  onSelectSet: (option: SetOption) => void;
  regionNationLoadingScope: "region" | "nation" | null;
  // 2026-09-08, shared map-based loading indicator (live-testing fix round 3): every
  // async set-changing operation this component owns (LA toggles, Nearest "+5 more")
  // reports its combined loading state up so DataViewShell/MapView can show ONE
  // spinner on the map, rather than several separate in-panel treatments. Optional
  // label lets the boarding-quintile-specific copy survive the move onto the map.
  onLoadingChange: (loading: boolean, label?: string) => void;
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  onSelectAllTicked: (urns: string[]) => void;
  onUnselectAllTicked: () => void;
  // Add/subtract window round (2026-09-14), Part 4: bulk select/deselect for ONE
  // group (LA/sector/phase) within the Add/subtract window -- adds/removes just
  // that group's URNs, unlike onSelectAllTicked/onUnselectAllTicked above (which
  // replace the WHOLE ticked set).
  onGroupTicked: (urns: string[], ticked: boolean) => void;
  comparedHidden: boolean;
  onToggleComparedHidden: () => void;
  profilesByUrn: Map<string, DataViewSchoolProfile>;
  // Compared-with panel round (2026-09-10), item 3: the CURRENTLY-COMPARED figure
  // (target + every ticked, profile-loaded school -- computed in DataViewShell since
  // it needs the full tickedProfiles array this component doesn't otherwise receive)
  // and the relocated A3 explanatory sentence -- both null only before the target
  // profile has loaded at all.
  //
  // Real bug fix (2026-09-11): compareNumbers used to be JUST the target's own
  // figure, with no reference to the compared set at all -- ticking/unticking never
  // moved it. compareSchoolCount is the real schools-in-set count (ticked +
  // profile-loaded, +1 for the target -- same totalWithFocus convention `schools`
  // below already uses); compareSchoolsNotLoaded is normally 0, non-zero only for a
  // Region/Nation-scale set where more schools are ticked than have a full profile
  // fetched yet (see DataViewShell's own comment) -- shown as an honest note rather
  // than silently under-counting with no indication why.
  compareNumbers: FilteredCount | null;
  compareSchoolCount: number;
  compareSchoolsNotLoaded: number;
  compareSentence: string | null;
  // Real bug fix (2026-09-11): used to be local state here, invisible to
  // DataViewShell -- a school added via the search-add path below was ticked
  // (onToggleTick reached the lifted tickedUrns correctly) but never actually part
  // of anything Map/Dashboard/Rankings/this panel's own numbers block read. Lifted
  // to DataViewShell (see its own addedUrns/addSchool comments) so the roster this
  // component still assembles below (`schools`) and the real compared set
  // DataViewShell computes from it (activeSetSchools/tickedProfiles) can never
  // silently disagree again.
  addedUrns: { urn: string; name: string }[];
  onAddSchool: (result: SchoolSearchResult) => void;
}) {
  const [windowOpen, setWindowOpen] = useState(false);
  const [nearestPopupOpen, setNearestPopupOpen] = useState(false);
  // Compared-with panel round (2026-09-10), item 2: one stepper now, shared by
  // whichever recipe `nearestOption` currently resolves to (ordinary nearest-10 or
  // the boarding-quintile recipe) -- see expandNearestBy's own comment for how it
  // picks the right endpoint per recipe.
  const [nearestExpanding, setNearestExpanding] = useState(false);

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
  // DataViewShell/MapView actually render. The boarding-quintile-specific copy takes
  // priority when it's genuinely what's happening (nearestExpanding while the
  // CURRENT nearestOption is the boarding-quintile recipe -- its own "+5 more" can
  // still fall back to the real, measured-slow live computation when the precomputed
  // tables haven't caught up yet, same as before this round, just reached via the
  // one merged stepper now); everything else shares a generic "Loading schools…"
  // default at the map layer.
  useEffect(() => {
    const loading = laLoading || nearestExpanding;
    onLoadingChange(loading, nearestExpanding && nearestOption?.key === "boarding_quintile" ? "Finding boarding schools nationally — this can take a little while…" : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laLoading, nearestExpanding, nearestOption?.key]);

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
  // from activeSet itself when it's genuinely the nearest-N-family set (so a prior
  // +5 is remembered), falling back to the base recipe's own 10 otherwise. The
  // button's own label carries the same running-total "+N" suffix the home-LA
  // button uses, not a flat "+5" repeated on every click.
  //
  // Compared-with panel round (2026-09-10), item 2: `nearestOption` can now resolve
  // to EITHER the ordinary ~10-nearest recipe OR the boarding-quintile recipe
  // (DataViewShell's own resolveNearestOption) -- there is no longer a second,
  // separate button/stepper for the latter, just this one, keyed off whichever
  // `.key` is currently active.
  //
  // Compared-with panel round (2026-09-11), item 2, per direct instruction: the
  // button's own label no longer shows the boarding-quintile recipe's own verbatim
  // text ("National boarding quintile..."/"Nearest boarding schools...") -- it
  // always reads the plain "Nearest 10 schools" (plus the same "+N" suffix),
  // whichever recipe is actually driving it. The recipe's real explanation now lives
  // in the comparator sentence instead (data-view-summary.ts's own
  // comparedWithPhrase), not duplicated here.
  const nearestIsActive =
    activeSet?.kind === "recipe" && (activeSet.key === "nearest_10" || activeSet.key === "fe_nearest_10" || activeSet.key === "boarding_quintile");
  const currentNearestSchools = nearestIsActive ? activeSet.schools : (nearestOption?.schools ?? []);
  const nearestExtra = nearestOption ? Math.max(0, currentNearestSchools.length - nearestOption.schools.length) : 0;
  const nearestIsBoardingQuintile = nearestOption?.key === "boarding_quintile";
  const nearestBaseLabel = "Nearest 10 schools";
  const nearestButtonLabel = `${nearestBaseLabel}${nearestExtra > 0 ? ` +${nearestExtra}` : ""}`;

  async function expandNearestBy(delta: number) {
    if (!nearestOption) return;
    const nextCount = Math.max(NEAREST_MIN, currentNearestSchools.length + delta);
    if (delta > 0) {
      if (!authToken) return;
      const mySeq = ++setRequestSeq.current;
      setNearestExpanding(true);
      try {
        // Same server round-trip either way, just a different endpoint per recipe --
        // the boarding-quintile one tries its own precomputed fast path first
        // (default-comparator-lists.ts's own buildBoardingQuintileList), falling
        // back to a real, measured-slow (~41s) live computation only when that
        // hasn't caught up yet for this school; the shared map loading indicator
        // (with its own boarding-quintile-specific copy, see the effect above) is
        // what makes that rare wait legible rather than a silent pause.
        const res = nearestIsBoardingQuintile
          ? await fetch(`/api/data-view/boarding-quintile-list?urn=${targetUrn}&count=${nextCount}`, { headers: { Authorization: `Bearer ${authToken}` } })
          : await fetch(`/api/data-view/expand-nearest?urn=${targetUrn}&count=${nextCount}`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (mySeq !== setRequestSeq.current) return;
        if (!res.ok) return;
        if (nearestIsBoardingQuintile) {
          const body = (await res.json()) as { list3: { key: string; label: string; schools: DefaultListEntry[]; note?: string } | null };
          if (body.list3) onSelectSet({ kind: "recipe", key: body.list3.key, label: body.list3.label, schools: body.list3.schools, note: body.list3.note });
        } else {
          const body = (await res.json()) as { list: { schools: DefaultListEntry[] } };
          onSelectSet({ ...nearestOption, schools: body.list.schools });
        }
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

  // Add/subtract-schools count now includes the focus school itself (per direct
  // instruction: "read as 11 (10 comparators + focus school), not 10") -- schools
  // never includes the target (every candidate query excludes it, matching this
  // codebase's own convention everywhere else), so +1 is always safe, never a
  // double-count. `addedUrns` is now a lifted prop (DataViewShell's own comment
  // explains why -- this used to be local-only state here, invisible to every
  // downstream consumer of "the real compared set") -- same merge shape as before,
  // just sourced from the parent.
  const schools = activeSet ? [...activeSet.schools, ...addedUrns.map((a) => ({ urn: a.urn, name: a.name, distanceKm: null }))] : [];
  const totalWithFocus = schools.length + 1;

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      {/* Item 4: same dark-mode custom-property technique FilterBar.tsx's own
          .filter-pill-active uses (an inline style can set the light-mode fill
          directly, but dark mode needs a real CSS rule to react to prefers-color-
          scheme/data-theme) -- a differently-named class so the two components'
          rules stay independently readable, even though both resolve the same way. */}
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .set-button-active {
            background-color: var(--set-button-bg-dark) !important;
            border-color: var(--set-button-bg-dark) !important;
            color: var(--set-button-fg-dark) !important;
          }
        }
        :root[data-theme="dark"] .set-button-active {
          background-color: var(--set-button-bg-dark) !important;
          border-color: var(--set-button-bg-dark) !important;
          color: var(--set-button-fg-dark) !important;
        }
      `}</style>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Compared with</h2>

      {/* Compared-with panel round (2026-09-10), item 3: pupils SUMMED across the
          target + every ticked, profile-loaded school (compareNumbers, computed in
          DataViewShell over tickedProfiles -- real bug fixed 2026-09-11: this used
          to be just the target's own figure, so ticking/unticking never moved it --
          see DataViewShell's own comment), the real schools-in-set count
          (compareSchoolCount, same fix), and the A3 explanatory sentence underneath
          -- relocated here from a full-width row below the filter bar
          (DataViewShell.tsx), which this replaces. */}
      {compareNumbers && (
        <div className="mb-3 rounded-md border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-2xl leading-none font-semibold text-neutral-900 dark:text-neutral-50">{compareNumbers.total.toLocaleString()}</p>
              <p className="mt-1 text-[11px] tracking-wide text-neutral-500 uppercase">Pupils</p>
            </div>
            <p className="text-xs whitespace-nowrap text-neutral-500">{compareSchoolCount.toLocaleString()} schools in this set</p>
          </div>
          {/* Only a Region/Nation-scale set can have more ticked than profile-loaded
              (DataViewShell's own LARGE_SET_PROFILE_THRESHOLD gate) -- noted
              honestly rather than silently showing a smaller number with no
              indication why. */}
          {compareSchoolsNotLoaded > 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              +{compareSchoolsNotLoaded.toLocaleString()} more ticked, not yet loaded
            </p>
          )}
          {compareNumbers.female !== null && compareNumbers.male !== null && (
            <p className="mt-1 text-xs text-neutral-500">
              {compareNumbers.female.toLocaleString()} girls · {compareNumbers.male.toLocaleString()} boys
            </p>
          )}
          {compareSentence && <p className="mt-2 text-xs text-neutral-500">{compareSentence}</p>}
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        {nearestOption && (
          <div className="relative flex items-center gap-1.5">
            <SetButton
              label={nearestButtonLabel}
              selected={tickedMatchesSet(tickedUrns, currentNearestSchools)}
              onClick={() => selectNamed(nearestOption)}
              tagKey={nearestIsBoardingQuintile ? "Boarding" : undefined}
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

        {/* Member Data View performance architecture v1 (2026-10-08): Region/Nation are
            real now, backed by the precomputed school_region_nation table -- same
            optimistic-pending pattern as Nearest 10's own boarding-quintile recipe
            (selected reads true the instant the click starts the lazy fetch, not only
            once the real list arrives). */}
        {regionOption && (
          <SetButton
            label={regionOption.label}
            selected={(activeSet?.kind === "recipe" && activeSet.key === "ons_region" && tickedMatchesSet(tickedUrns, activeSet.schools)) || regionNationLoadingScope === "region"}
            onClick={() => selectNamed(regionOption)}
          />
        )}
        {nationOption && (
          <SetButton
            label={nationOption.label}
            selected={(activeSet?.kind === "recipe" && activeSet.key === "nation" && tickedMatchesSet(tickedUrns, activeSet.schools)) || regionNationLoadingScope === "nation"}
            onClick={() => selectNamed(nationOption)}
          />
        )}
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
          onGroupTicked={onGroupTicked}
          onAddSchool={onAddSchool}
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
