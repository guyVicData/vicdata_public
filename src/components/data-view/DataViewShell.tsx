"use client";

// Member Data View shell (build brief v1, §4): topic tabs, shared comparator-set
// sidebar + tick-list, shared phase/gender/boarding filter state, and the Map |
// Dashboard | Rankings | +Custom view switcher -- one state, three real consumers,
// per the brief's own "never reset or diverge the active filter when switching views"
// rule. Client component, matching every other auth-gated page in this repo
// (/account, /sets, /sets/[id]) -- there's no server-side session/middleware in this
// codebase to gate on instead.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { deserializeProfile, type WireDataViewSchoolProfile } from "@/lib/data-view-serialize";
import { emptyDataViewFilterState, describeFilters, type DataViewFilterState } from "@/lib/data-view-filters";
import type { SetOption, ViewKey } from "@/lib/data-view-types";
import type { SchoolTypeCategory } from "@/lib/default-comparator-lists";
import ComparatorSidebar from "./ComparatorSidebar";
import FilterBar from "./FilterBar";
import ViewSwitcher from "./ViewSwitcher";
import DashboardView from "./DashboardView";
import RankingsView from "./RankingsView";
import MapView from "./MapView";
import PdfExportButton from "./PdfExportButton";

const INITIAL_TICKED_COUNT = 10;

type TargetSchool = {
  urn: string;
  name: string;
  town: string | null;
  easting: number | null;
  northing: number | null;
};

type LoadState = "checking" | "not_a_member" | "loading" | "ready" | "error";

export default function DataViewShell({ urn }: { urn: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Defence-in-depth for the "This page couldn't load" report (2026-09-05): even with
  // every promise above now caught (see Step 1/2's own comments), a request that
  // genuinely hangs rather than rejecting -- a stalled TCP connection, a cold-start
  // timeout with no response at all -- would still leave loadState stuck at
  // "checking"/"loading" forever with no way out for the user. This flips a visible
  // "taking a while" affordance after a real timeout, giving a definite escape hatch
  // (reload) instead of a spinner with no ceiling.
  const [slowLoad, setSlowLoad] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [target, setTarget] = useState<TargetSchool | null>(null);

  const [recipeLists, setRecipeLists] = useState<{
    schoolTypeCategory: SchoolTypeCategory | null;
    list1: SetOption | null;
    list2: SetOption | null;
  } | null>(null);
  const [savedSets, setSavedSets] = useState<SetOption[]>([]);
  const [boardingQuintileOption, setBoardingQuintileOption] = useState<SetOption | null>(null);
  const [boardingQuintileLoading, setBoardingQuintileLoading] = useState(false);

  const [activeSet, setActiveSet] = useState<SetOption | null>(null);
  const [tickedUrns, setTickedUrns] = useState<Set<string>>(new Set());
  const [profilesByUrn, setProfilesByUrn] = useState<Map<string, DataViewSchoolProfile>>(new Map());
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [filters, setFilters] = useState<DataViewFilterState>(emptyDataViewFilterState());
  const [activeView, setActiveView] = useState<ViewKey>("map");

  // Step 1: auth + membership gate, exactly the same approved-membership check every
  // paid API route in this build already enforces server-side -- this is the CLIENT's
  // own early check so the page can show a clear message immediately, not a
  // replacement for those routes' own checks.
  //
  // 2026-09-05 fix, real bug reported live (Safari, "This page couldn't load" on
  // https://vicdata.co.uk/schools/100053/data for a genuinely logged-in member):
  // this whole async body had no try/catch and the membership query's own `error`
  // was silently discarded -- the exact same class of mistake account.tsx's and
  // sets.tsx's own history comments already warn about ("silently rendering as 'No
  // memberships yet' because the error below used to be discarded"). If
  // getSession() or the membership query ever throws or the query itself returns a
  // real PostgREST error (a transient network blip, a cold-start timeout hitting the
  // remote Supabase project, anything) the effect's promise rejected with nothing
  // catching it -- loadState stayed stuck at "checking" forever, an indefinite
  // "Loading…" a real user has no way to distinguish from a hung/broken page.
  // Reloading re-runs the same effect and can hit the same transient failure again,
  // which matches "flashes to another screen [the fresh Loading… state] before
  // landing back on the same error [hangs again]" -- logged as the most likely real
  // cause in docs/vicdata_data_view_open_questions.md, though it couldn't be
  // reproduced directly in this session (no browser access here -- see that entry).
  // Every path through this effect now reaches a definite terminal state.
  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("[DataViewShell] getSession failed:", sessionError);
          setErrorMessage("Could not check your login. Try reloading, or log in again.");
          setLoadState("error");
          return;
        }
        const token = sessionData.session?.access_token ?? null;
        setAuthToken(token);
        if (!token) {
          setLoadState("not_a_member");
          return;
        }
        const { data, error: membershipError } = await supabase
          .from("school_memberships")
          .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
          .eq("status", "approved")
          .eq("school_accounts.school_urn", urn)
          .maybeSingle();
        if (membershipError) {
          console.error("[DataViewShell] membership check failed:", membershipError);
          setErrorMessage("Could not check your membership at this school. Try reloading.");
          setLoadState("error");
          return;
        }
        if (!data) {
          setLoadState("not_a_member");
          return;
        }
        setLoadState("loading");
      } catch (e) {
        console.error("[DataViewShell] unexpected error during auth check:", e);
        setErrorMessage("Something went wrong checking your login. Try reloading.");
        setLoadState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn]);

  // Step 2: target school + default lists + the member's own saved comparator sets,
  // once membership is confirmed.
  useEffect(() => {
    if (loadState !== "loading" || !authToken) return;
    (async () => {
      try {
        const [{ data: schoolRow }, defaultListsRes, savedSetsRows] = await Promise.all([
          supabase.from("schools").select("urn, current_name, town, easting, northing").eq("urn", urn).maybeSingle(),
          fetch(`/api/data-view/default-lists?urn=${urn}`, { headers: { Authorization: `Bearer ${authToken}` } }),
          supabase
            .from("saved_sets")
            .select("id, name, saved_set_members(school_urn, member_status, schools(current_name))")
            .eq("set_type", "comparator"),
        ]);

        if (!schoolRow) {
          setErrorMessage("Could not load this school.");
          setLoadState("error");
          return;
        }
        setTarget({ urn: schoolRow.urn, name: schoolRow.current_name, town: schoolRow.town, easting: schoolRow.easting, northing: schoolRow.northing });

        if (!defaultListsRes.ok) {
          setErrorMessage("Could not load comparator lists.");
          setLoadState("error");
          return;
        }
        const body = (await defaultListsRes.json()) as {
          schoolTypeCategory: SchoolTypeCategory | null;
          list1: { key: string; label: string; schools: { urn: string; name: string; distanceKm: number | null }[]; note?: string } | null;
          list2: { key: string; label: string; schools: { urn: string; name: string; distanceKm: number | null }[]; note?: string } | null;
        };
        const list1: SetOption | null = body.list1 ? { kind: "recipe", key: body.list1.key, label: body.list1.label, schools: body.list1.schools, note: body.list1.note } : null;
        const list2: SetOption | null = body.list2 ? { kind: "recipe", key: body.list2.key, label: body.list2.label, schools: body.list2.schools, note: body.list2.note } : null;
        setRecipeLists({ schoolTypeCategory: body.schoolTypeCategory, list1, list2 });

        if (
          body.schoolTypeCategory === "independent_boarding_senior" ||
          body.schoolTypeCategory === "independent_boarding_prep" ||
          body.schoolTypeCategory === "state_boarding"
        ) {
          setBoardingQuintileOption({ kind: "recipe", key: "boarding_quintile", label: "National boarding quintile", schools: [], lazy: true });
        }

        type SavedSetRow = {
          id: string;
          name: string;
          saved_set_members: { school_urn: string; member_status: string; schools: { current_name: string } | null }[];
        };
        const saved = ((savedSetsRows.data as unknown as SavedSetRow[]) ?? []).map(
          (s): SetOption => ({
            kind: "saved",
            id: s.id,
            label: s.name,
            schools: s.saved_set_members
              .filter((m) => m.member_status === "confirmed")
              .map((m) => ({ urn: m.school_urn, name: m.schools?.current_name ?? m.school_urn, distanceKm: null })),
          }),
        );
        setSavedSets(saved);

        // Default landing state (brief §4): Map view, Nearest 10 (any LA) pre-selected.
        if (list1) {
          setActiveSet(list1);
          setTickedUrns(new Set(list1.schools.slice(0, INITIAL_TICKED_COUNT).map((s) => s.urn)));
        }
        setLoadState("ready");
      } catch (e) {
        console.error("[DataViewShell] failed loading school/default lists:", e);
        setErrorMessage("Something went wrong loading the Data View.");
        setLoadState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, authToken, urn]);

  const loadBoardingQuintileList = useCallback(async () => {
    if (!authToken || boardingQuintileLoading) return;
    setBoardingQuintileLoading(true);
    try {
      const res = await fetch(`/api/data-view/boarding-quintile-list?urn=${urn}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) return;
      const body = (await res.json()) as { list3: { key: string; label: string; schools: { urn: string; name: string; distanceKm: number | null }[]; note?: string } | null };
      if (body.list3) {
        const option: SetOption = { kind: "recipe", key: body.list3.key, label: body.list3.label, schools: body.list3.schools, note: body.list3.note };
        setBoardingQuintileOption(option);
        return option;
      }
    } finally {
      setBoardingQuintileLoading(false);
    }
    return null;
  }, [authToken, urn, boardingQuintileLoading]);

  // Step 3: fetch rich per-school profiles for target + every school currently in
  // the active set (not just ticked ones -- toggling a tick shouldn't need a new
  // fetch; Map/Dashboard/Rankings filter down to ticked members themselves).
  useEffect(() => {
    if (!authToken || !activeSet || !target) return;
    const urns = Array.from(new Set([target.urn, ...activeSet.schools.map((s) => s.urn)]));
    const alreadyFetched = urns.every((u) => profilesByUrn.has(u));
    if (alreadyFetched) return;
    (async () => {
      setProfilesLoading(true);
      const res = await fetch(`/api/data-view/schools?anchorUrn=${target.urn}&urns=${urns.join(",")}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        setProfilesLoading(false);
        return;
      }
      const body = (await res.json()) as { profiles: WireDataViewSchoolProfile[] };
      setProfilesByUrn((prev) => {
        const next = new Map(prev);
        for (const p of body.profiles) next.set(p.urn, deserializeProfile(p));
        return next;
      });
      setProfilesLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, activeSet, target]);

  useEffect(() => {
    // Only ever read while loadState is "checking"/"loading" (see that render branch
    // below) -- no need to explicitly reset it back to false once loading finishes,
    // that branch simply stops rendering it. Avoids a synchronous setState call in
    // the effect body itself (react-hooks/set-state-in-effect).
    if (loadState !== "checking" && loadState !== "loading") return;
    const timer = setTimeout(() => setSlowLoad(true), 12000);
    return () => clearTimeout(timer);
  }, [loadState]);

  function selectSet(option: SetOption) {
    setActiveSet(option);
    setTickedUrns(new Set(option.schools.slice(0, INITIAL_TICKED_COUNT).map((s) => s.urn)));
  }

  function toggleTick(urn: string) {
    setTickedUrns((prev) => {
      const next = new Set(prev);
      if (next.has(urn)) next.delete(urn);
      else next.add(urn);
      return next;
    });
  }

  if (loadState === "checking" || loadState === "loading") {
    return (
      <main className="px-6 py-24 text-center text-sm text-neutral-500">
        <p>Loading…</p>
        {slowLoad && (
          <p className="mt-3">
            This is taking longer than expected.{" "}
            <button type="button" className="underline" onClick={() => window.location.reload()}>
              Reload
            </button>
            , or head back to{" "}
            <Link href="/member" className="underline">
              your home page
            </Link>
            .
          </p>
        )}
      </main>
    );
  }
  if (loadState === "not_a_member") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-neutral-500">
        The Data View is available to verified school staff.{" "}
        <Link href="/join" className="underline">
          Join your school
        </Link>{" "}
        to get access.
      </main>
    );
  }
  if (loadState === "error" || !target) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-neutral-500">
        <p>{errorMessage ?? "Something went wrong."}</p>
        <p className="mt-3">
          <button type="button" className="underline" onClick={() => window.location.reload()}>
            Reload
          </button>{" "}
          or head back to{" "}
          <Link href="/member" className="underline">
            your home page
          </Link>
          .
        </p>
      </main>
    );
  }

  const targetProfile = profilesByUrn.get(target.urn) ?? null;
  const tickedProfiles = activeSet
    ? activeSet.schools.filter((s) => tickedUrns.has(s.urn)).map((s) => profilesByUrn.get(s.urn)).filter((p): p is DataViewSchoolProfile => !!p)
    : [];
  const filterSummary = describeFilters(filters);

  const setOptions: SetOption[] = [
    ...(recipeLists?.list1 ? [recipeLists.list1] : []),
    ...(recipeLists?.list2 ? [recipeLists.list2] : []),
    ...(boardingQuintileOption ? [boardingQuintileOption] : []),
    ...savedSets,
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <TopicTabs />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-72 lg:shrink-0">
          <ComparatorSidebar
            targetName={target.name}
            options={setOptions}
            activeSet={activeSet}
            onSelectSet={(opt) => {
              if (opt.kind === "recipe" && opt.lazy && opt.schools.length === 0) {
                loadBoardingQuintileList().then((loaded) => {
                  if (loaded) selectSet(loaded);
                });
                return;
              }
              selectSet(opt);
            }}
            boardingQuintileLoading={boardingQuintileLoading}
            tickedUrns={tickedUrns}
            onToggleTick={toggleTick}
            initialTickedCount={INITIAL_TICKED_COUNT}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <ViewSwitcher active={activeView} onChange={setActiveView} />
            <PdfExportButton />
          </div>

          {/* Print-only summary line (brief §9): "show your assumptions" -- an
              exported view states which comparator set and filters produced the
              numbers on the page, not just the numbers themselves. Hidden on screen,
              the one thing this page ADDS for print rather than hides. */}
          <div className="hidden print:block print:mb-4 print:text-xs">
            <p>
              {target.name} — {activeView} view — comparator set: {activeSet?.label ?? "none"}
              {filterSummary ? ` — filtered: ${filterSummary}` : ""} — generated {new Date().toLocaleDateString("en-GB")}
            </p>
            <p>
              Compared against: {tickedProfiles.length > 0 ? tickedProfiles.map((p) => p.name).join(", ") : "no schools ticked"}
            </p>
          </div>

          {activeView !== "map" && (
            <div className="mb-4 print:hidden">
              <FilterBar filters={filters} onChange={setFilters} target={targetProfile} />
            </div>
          )}

          {profilesLoading && profilesByUrn.size === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">Loading school data…</p>
          ) : !targetProfile ? (
            <p className="py-12 text-center text-sm text-neutral-500">No real data available for this school yet.</p>
          ) : activeView === "map" ? (
            <MapView
              target={target}
              targetProfile={targetProfile}
              members={activeSet?.schools ?? []}
              tickedUrns={tickedUrns}
              onToggleTick={toggleTick}
              profilesByUrn={profilesByUrn}
              filters={filters}
              onFiltersChange={setFilters}
            />
          ) : activeView === "dashboard" ? (
            <DashboardView targetProfile={targetProfile} tickedProfiles={tickedProfiles} filters={filters} filterSummary={filterSummary} />
          ) : (
            <RankingsView targetProfile={targetProfile} tickedProfiles={tickedProfiles} filters={filters} />
          )}
        </div>
      </div>
    </div>
  );
}

// Brief §4: "Rolls (active), Academic/Destinations/Context (greyed, chevron
// submenus where the public page pattern already has them)." Repo-check finding
// (docs/vicdata_data_view_open_questions.md): the public School page doesn't
// literally have a chevron-submenu tab bar anywhere -- its own "coming soon" pattern
// is inline ComingSoonCard placeholders further down the same scroll, not a tab
// strip. Built fresh here to match the brief's own described SHAPE (a topic tab
// row) rather than a pattern that doesn't actually exist yet to copy.
function TopicTabs() {
  const tabs = [
    { label: "Rolls", active: true },
    { label: "Academic", active: false },
    { label: "Destinations", active: false },
    { label: "Context", active: false },
  ];
  return (
    <nav className="flex gap-1 border-b border-neutral-200 text-sm dark:border-neutral-800">
      {tabs.map((t) => (
        <span
          key={t.label}
          className={
            t.active
              ? "border-b-2 border-neutral-900 px-3 py-2 font-medium text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
              : "flex cursor-not-allowed items-center gap-1 px-3 py-2 text-neutral-400 dark:text-neutral-600"
          }
        >
          {t.label}
          {!t.active && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 2l3 3-3 3" />
            </svg>
          )}
        </span>
      ))}
    </nav>
  );
}
