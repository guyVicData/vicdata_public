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
import {
  emptyDataViewFilterState,
  describeFilters,
  serializeFilterState,
  deserializeFilterState,
  matchesSectorFilter,
  type DataViewFilterState,
  type WireDataViewFilterState,
} from "@/lib/data-view-filters";
import type { SetOption, ViewKey } from "@/lib/data-view-types";
import type { SchoolTypeCategory } from "@/lib/default-comparator-lists";
import { describeActiveViewSentence } from "@/lib/data-view-summary";
import { TOPIC_COLOURS, contrastingTextColour } from "@/lib/tag-colours";
import ComparatorSidebar from "./ComparatorSidebar";
import SavedSetsControl from "./SavedSetsControl";
import FilterBar from "./FilterBar";
import ViewSwitcher from "./ViewSwitcher";
import DashboardView from "./DashboardView";
import RankingsView from "./RankingsView";
import MapView from "./MapView";
import PdfExportButton from "./PdfExportButton";
import DataViewErrorBoundary from "./DataViewErrorBoundary";

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
  // 2026-09-06, UX refinements round 1, A2: captured here (Step 1 already looks this
  // membership row up to gate the page; it just used to discard the row's own id
  // once the existence check passed) so the new Save Set flow can write a real
  // owner_membership_id/school_account_id -- the same two fields
  // /sets/comparator/new/page.tsx's own save already requires, reused rather than
  // re-derived a second way.
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [schoolAccountId, setSchoolAccountId] = useState<string | null>(null);

  const [recipeLists, setRecipeLists] = useState<{
    schoolTypeCategory: SchoolTypeCategory | null;
    list1: SetOption | null;
    list2: SetOption | null;
    // 2026-09-08, bug fix: a real candidate list letting a mainstream Post-16
    // target's own comparator picker include FE colleges (default-comparator-
    // lists.ts's own comment explains why this never existed for a mainstream
    // target before, only an FE-college one).
    local16Plus: SetOption | null;
  } | null>(null);
  const [savedSets, setSavedSets] = useState<SetOption[]>([]);
  const [boardingQuintileOption, setBoardingQuintileOption] = useState<SetOption | null>(null);
  const [boardingQuintileLoading, setBoardingQuintileLoading] = useState(false);

  const [activeSet, setActiveSet] = useState<SetOption | null>(null);
  const [tickedUrns, setTickedUrns] = useState<Set<string>>(new Set());
  // 2026-09-07, UX refinements round 2, P3 item 8: "ability to hide all schools in
  // the 'Compared with' list at once" -- built to Guy's own stated reading (a
  // temporary display toggle, membership-preserving, distinct from item 9's
  // select-all/unselect-all which DOES change membership), logged as the
  // operating interpretation in docs/vicdata_data_view_open_questions.md per his
  // own explicit "log it rather than guess silently" instruction. Deliberately
  // NOT touching tickedUrns -- un-hiding must restore exactly what was ticked
  // before, with no re-selection needed.
  const [comparedHidden, setComparedHidden] = useState(false);
  const [profilesByUrn, setProfilesByUrn] = useState<Map<string, DataViewSchoolProfile>>(new Map());
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const [filters, setFilters] = useState<DataViewFilterState>(emptyDataViewFilterState());
  const [activeView, setActiveView] = useState<ViewKey>("map");
  // One shared collapse toggle for the one shared filter bar (see the render's own
  // 2026-09-05 comment) -- applies identically regardless of which view is active,
  // rather than a per-view floating overlay only Map used to have.
  const [filterBarCollapsed, setFilterBarCollapsed] = useState(false);

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
          .select("id, school_account_id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
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
        setMembershipId(data.id);
        setSchoolAccountId(data.school_account_id);
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
            .select("id, name, config, saved_set_members(school_urn, member_status, schools(current_name))")
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
          local16Plus: { key: string; label: string; schools: { urn: string; name: string; distanceKm: number | null }[]; note?: string } | null;
        };
        const list1: SetOption | null = body.list1 ? { kind: "recipe", key: body.list1.key, label: body.list1.label, schools: body.list1.schools, note: body.list1.note } : null;
        const list2: SetOption | null = body.list2 ? { kind: "recipe", key: body.list2.key, label: body.list2.label, schools: body.list2.schools, note: body.list2.note } : null;
        const local16Plus: SetOption | null = body.local16Plus
          ? { kind: "recipe", key: body.local16Plus.key, label: body.local16Plus.label, schools: body.local16Plus.schools, note: body.local16Plus.note }
          : null;
        setRecipeLists({ schoolTypeCategory: body.schoolTypeCategory, list1, list2, local16Plus });

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
          config: { filters?: WireDataViewFilterState } | null;
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
            // Older rows (every one saved via /sets/comparator/new/page.tsx, and
            // every row saved before this round) have no real `config.filters` at
            // all -- `config` defaults to `{}` at the schema level, so this is
            // `undefined`, not a malformed value; SetOption's own `filters` field is
            // optional for exactly this reason.
            filters: s.config?.filters,
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
  //
  // 2026-09-05 fix, real bug reported live (Safari, Map view stuck on "Loading school
  // data…" forever, Acland Burghley's own Nearest-10 set): this effect had the exact
  // same missing-try/catch gap as Step 1/2 already had fixed -- if fetch()/res.json()
  // ever threw, the promise rejected uncaught and profilesLoading never cleared.
  // Reproduced directly this time (not just inferred): the REAL root cause here was a
  // separate bug in data-view-serialize.ts (ageGenderCounts2019 never round-tripped
  // through JSON correctly, silently becoming a non-iterable `{}`), which threw
  // *inside MapView's own render effect*, downstream of this fetch succeeding --
  // fixed at that source too (see data-view-serialize.ts's own comment), but this
  // effect's own missing error handling was real and independent of it, and is fixed
  // here on the same principle as Steps 1/2: every path reaches a definite state.
  useEffect(() => {
    if (!authToken || !activeSet || !target) return;
    const urns = Array.from(new Set([target.urn, ...activeSet.schools.map((s) => s.urn)]));
    const alreadyFetched = urns.every((u) => profilesByUrn.has(u));
    if (alreadyFetched) return;
    (async () => {
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        const res = await fetch(`/api/data-view/schools?anchorUrn=${target.urn}&urns=${urns.join(",")}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          console.error("[DataViewShell] profile fetch failed:", res.status, await res.text().catch(() => ""));
          setProfilesError("Could not load school data for this Compared with set.");
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
      } catch (e) {
        console.error("[DataViewShell] unexpected error fetching profiles:", e);
        setProfilesError("Something went wrong loading school data. Try reloading.");
        setProfilesLoading(false);
      }
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
    // A saved set is a deliberately curated tick-list (that's what got saved) --
    // restore it exactly, not just its first INITIAL_TICKED_COUNT. A recipe list
    // (Nearest 10, In-LA, etc.) keeps the existing "first 10 pre-ticked" default.
    setTickedUrns(
      option.kind === "saved"
        ? new Set(option.schools.map((s) => s.urn))
        : new Set(option.schools.slice(0, INITIAL_TICKED_COUNT).map((s) => s.urn)),
    );
    // 2026-09-06, UX refinements round 1, A2/B3: recalling a saved set restores the
    // filter state it was saved with too, when one was actually saved (see
    // SetOption's own comment for why this is optional) -- "share one underlying
    // save mechanism" means recall is symmetric with save, not just the school list.
    if (option.kind === "saved" && option.filters) {
      setFilters(deserializeFilterState(option.filters));
    }
  }

  // 2026-09-06, UX refinements round 1, B3: "+5 more" grows the ACTIVE set's own
  // school list in place, deliberately not routed through selectSet -- selectSet's
  // own "first INITIAL_TICKED_COUNT pre-ticked" default would silently discard
  // whatever the member had already manually ticked/unticked within the original 10
  // the moment they asked for 5 more. Only the newly-appeared URNs (present in the
  // new list, absent from the old one) get auto-ticked; every existing URN's ticked
  // state is left exactly as the member set it.
  function expandActiveSet(newSchools: SetOption["schools"]) {
    setActiveSet((prev) => (prev ? { ...prev, schools: newSchools } : prev));
    setTickedUrns((prev) => {
      const oldUrns = new Set(activeSet?.schools.map((s) => s.urn) ?? []);
      const next = new Set(prev);
      for (const s of newSchools) {
        if (!oldUrns.has(s.urn)) next.add(s.urn);
      }
      return next;
    });
  }

  // 2026-09-06, UX refinements round 1, A2/B3: the one save mechanism shared by the
  // filter row's own Saved Sets control and (once built) B3's richer "Compared with"
  // rework -- the exact same saved_sets/saved_set_members tables and RLS policies
  // /sets/comparator/new/page.tsx's own save flow already uses, with one real
  // addition: `config.filters`, a wire-safe snapshot of the current filter state, so
  // recall restores both halves of "what was I looking at," not just the schools.
  // Saves the CURRENTLY TICKED schools specifically (the tick-list is this whole
  // build's one real comparison mechanism, ComparatorSidebar.tsx's own module
  // comment) -- not every school in whatever recipe/saved list happens to be active,
  // which could be a much longer list the member never meant to bookmark whole.
  async function saveCurrentSet(name: string): Promise<{ ok: boolean; error?: string }> {
    if (!schoolAccountId || !membershipId) return { ok: false, error: "Could not verify your membership." };
    const urnsToSave = Array.from(tickedUrns).filter((u) => u !== target?.urn);
    if (urnsToSave.length === 0) return { ok: false, error: "Tick at least one school to save a set." };

    const { data: set, error: insertError } = await supabase
      .from("saved_sets")
      .insert({
        school_account_id: schoolAccountId,
        set_type: "comparator",
        name,
        owner_membership_id: membershipId,
        config: { filters: serializeFilterState(filters) },
      })
      .select("id")
      .single();
    if (insertError || !set) {
      // The personal-set cap (3, enforced by the DB trigger -- saved_sets.sql's own
      // enforce_personal_comparator_cap) surfaces here as a real Postgres exception
      // message, same as /sets/comparator/new/page.tsx's own save already surfaces
      // it -- not re-worded, so the two save paths give the member the same answer.
      return { ok: false, error: insertError?.message ?? "Could not save this set." };
    }

    const { error: membersError } = await supabase.from("saved_set_members").insert(
      urnsToSave.map((urn) => ({ saved_set_id: set.id, school_urn: urn, member_status: "confirmed" as const })),
    );
    if (membersError) {
      return { ok: false, error: membersError.message };
    }

    const names = new Map(profilesByUrn);
    setSavedSets((prev) => [
      ...prev,
      {
        kind: "saved",
        id: set.id,
        label: name,
        schools: urnsToSave.map((u) => ({ urn: u, name: names.get(u)?.name ?? u, distanceKm: null })),
        filters: serializeFilterState(filters),
      },
    ]);
    return { ok: true };
  }

  function toggleTick(urn: string) {
    setTickedUrns((prev) => {
      const next = new Set(prev);
      if (next.has(urn)) next.delete(urn);
      else next.add(urn);
      return next;
    });
  }

  // 2026-09-07, UX refinements round 2, P3 item 9: "Select all" / "Unselect all"
  // on the sidebar's own schools list -- genuinely changes tickedUrns (set
  // MEMBERSHIP), unlike item 8's comparedHidden above, which deliberately never
  // touches it. Selects every real school CURRENTLY in the list (the caller
  // passes the full list, visible + overflow together, not just what's on
  // screen) -- never the target, which isn't part of tickedUrns' own vocabulary.
  function selectAllTicked(urns: string[]) {
    setTickedUrns(new Set(urns));
  }

  function unselectAllTicked() {
    setTickedUrns(new Set());
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
  // 2026-09-07, UX refinements round 2, P3 item 7: the sector filter is a
  // membership exclusion (matchesSectorFilter's own comment explains why it can't
  // be a slice the way phase/gender/boarding are) applied once, here, so
  // Dashboard/Rankings/Map can never disagree about which ticked schools the
  // active sector filter has excluded.
  const tickedProfiles =
    activeSet && !comparedHidden
      ? activeSet.schools
          .filter((s) => tickedUrns.has(s.urn))
          .map((s) => profilesByUrn.get(s.urn))
          .filter((p): p is DataViewSchoolProfile => !!p)
          .filter((p) => matchesSectorFilter(p.sector, filters.sector))
      : [];
  const filterSummary = describeFilters(filters);

  // 2026-09-07, UX refinements round 2, P3 item 7: "same 'only show if relevant'
  // ... conventions" -- the Sector filter only makes sense (and only shows any
  // pills at all) when the active set genuinely contains more than one real
  // sector; a Nearest-10 set that's entirely state schools has nothing for it to
  // narrow. Computed from every real sector actually present -- target included,
  // same "the viewed school is a real reference point" rule applied everywhere
  // else -- across the WHOLE active set (not just the currently-ticked schools),
  // since an untocked-but-present school is still a real reason the filter is
  // relevant.
  const memberSectors = Array.from(
    new Set(
      [targetProfile?.sector, ...(activeSet?.schools.map((s) => profilesByUrn.get(s.urn)?.sector) ?? [])].filter(
        (s): s is NonNullable<typeof s> => !!s,
      ),
    ),
  );

  const setOptions: SetOption[] = [
    ...(recipeLists?.list1 ? [recipeLists.list1] : []),
    ...(recipeLists?.list2 ? [recipeLists.list2] : []),
    ...(recipeLists?.local16Plus ? [recipeLists.local16Plus] : []),
    ...(boardingQuintileOption ? [boardingQuintileOption] : []),
    ...savedSets,
  ];

  // 2026-09-05, layout fix (real bug reported live, both items below):
  //
  // 1. Full-bleed. The whole shell used to sit inside `mx-auto max-w-6xl px-4 sm:px-6`
  //    -- a centred, width-capped container that produced large left/right margins on
  //    any screen wider than 1152px, unlike the wireframe's own `.shell{width:100%}`
  //    (confirmed by reading the wireframe's actual source directly, not just eyeballing
  //    a screenshot -- the published canvas artifact embeds each board's real HTML/CSS).
  //    Removed entirely: the shell now fills the viewport edge to edge, the sidebar
  //    sits flush against the left edge (its own internal padding aside), and the main
  //    panel fills every remaining pixel out to the right edge.
  //
  // 2. One filter bar, one position, for all three views. The wireframe itself is
  //    genuinely inconsistent between boards here (Map's own filter bar is scoped to
  //    `.main`'s width, floating as an overlay INSIDE the map canvas; Dashboard's and
  //    Rankings' filter bars instead span the FULL page width, sitting ABOVE the
  //    sidebar+main split, with the view-switcher in its own separate row scoped to
  //    `.main`) -- confirmed directly from the wireframe's own source, not assumed.
  //    Resolved in favour of the Dashboard/Rankings treatment (2 of the 3 boards agree
  //    on it, and it's what "full width... same screen coordinates" in the bug report
  //    actually describes): the filter bar is now rendered ONCE, unconditionally,
  //    directly under the topic tabs and above the sidebar+main row -- never
  //    conditionally shown per view, never floated over the map -- so its position
  //    literally cannot drift between views; there is only one of it in the DOM. The
  //    view-switcher moved into its own row at the top of the main panel (matching
  //    Dashboard/Rankings' own `.main-subheader`), which MapView.tsx no longer renders
  //    a competing copy of. The brief's original "Map's filter bar floats as a
  //    collapsible overlay" instruction is satisfied in spirit, not literally, by the
  //    shared collapse toggle below (every view can reclaim the same vertical space);
  //    logged as a deliberate trade-off in docs/vicdata_data_view_open_questions.md.
  // flex-1 min-h-0, not a bare block: `body` (src/app/layout.tsx) is already a
  // flex column with a real baseline height (`min-h-full`, resolving against
  // `html`'s own `h-full` -- i.e. the viewport), the classic minimal "sticky
  // footer" recipe -- but this route's own root was never marked as the item
  // that should grow into the leftover space, so `flex-1`/`min-h-0` on the
  // sidebar+main row further down had nothing real to grow against. Harmless for
  // Dashboard/Rankings (their content was already taller than one viewport, so
  // flex-grow had no spare space to distribute either way) but left Map -- whose
  // controls are now floated OUT of the in-flow layout, leaving very little
  // in-flow content -- with no real "container height" to fill edge-to-edge.
  // `flex-1` here (a flex item of `body`) fixes that without touching the root
  // layout or adding any height on top of it.
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <TopicTabs schoolName={target.name} />

      <div className="border-b border-neutral-200 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-800">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          target={targetProfile}
          memberSectors={memberSectors}
          collapsed={filterBarCollapsed}
          onToggleCollapse={() => setFilterBarCollapsed((c) => !c)}
          extra={
            <SavedSetsControl
              savedSets={savedSets}
              onSelect={selectSet}
              onSave={saveCurrentSet}
              canSave={Array.from(tickedUrns).some((u) => u !== target?.urn)}
            />
          }
        />
      </div>

      {/* 2026-09-06, UX refinements round 1, A3: "a text line below the filter row,
          stating in plain language what the current filter/comparator combination
          means... updates live as filters change." Recomputed fresh every render
          from the actual live filters/activeSet/target (data-view-summary.ts's own
          module comment) -- never a snapshot that could drift from what Map/
          Dashboard/Rankings are actually showing. */}
      {targetProfile && (
        <div className="border-b border-neutral-200 px-4 py-1.5 text-xs text-neutral-500 print:hidden dark:border-neutral-800 dark:text-neutral-400 sm:px-6">
          {describeActiveViewSentence(filters, activeSet, targetProfile)}
        </div>
      )}

      {/* Print-only summary line (brief §9): "show your assumptions" -- an exported
          view states which comparator set and filters produced the numbers on the
          page, not just the numbers themselves. Hidden on screen, the one thing this
          page ADDS for print rather than hides. */}
      <div className="hidden px-4 sm:px-6 print:block print:py-2 print:text-xs">
        <p>
          {target.name} — {activeView} view — compared with: {activeSet?.label ?? "none"}
          {filterSummary ? ` — filtered: ${filterSummary}` : ""} — generated {new Date().toLocaleDateString("en-GB")}
        </p>
        <p>
          Compared against: {tickedProfiles.length > 0 ? tickedProfiles.map((p) => p.name).join(", ") : "no schools ticked"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-neutral-200 p-4 lg:w-64 lg:border-b-0 lg:border-r dark:border-neutral-800">
          <ComparatorSidebar
            targetName={target.name}
            targetUrn={target.urn}
            authToken={authToken}
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
            onExpandActiveSet={expandActiveSet}
            boardingQuintileLoading={boardingQuintileLoading}
            tickedUrns={tickedUrns}
            onToggleTick={toggleTick}
            onSelectAllTicked={selectAllTicked}
            onUnselectAllTicked={unselectAllTicked}
            comparedHidden={comparedHidden}
            onToggleComparedHidden={() => setComparedHidden((h) => !h)}
            initialTickedCount={INITIAL_TICKED_COUNT}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* 2026-09-05: Map view v1 (per direct request) treats the map as a full
              canvas with the view-switcher and export button floated as overlays
              INSIDE it, rather than this in-flow subheader row -- so the row is
              skipped entirely for Map (MapView renders its own copies). Dashboard
              and Rankings are untouched. */}
          {activeView !== "map" && (
            <div className="flex items-center justify-end gap-2 border-b border-neutral-100 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-900">
              <ViewSwitcher active={activeView} onChange={setActiveView} />
              <PdfExportButton />
            </div>
          )}

          {/* min-h-[480px]/[560px]: a real floor, not just flex-1 -- below the `lg`
              breakpoint the sidebar sits ABOVE the map (shrink-0, in-flow), and a
              long comparator list can push the map's flex-1 share of the
              remaining height to ~0. Matches the old fixed heights this replaced,
              now as a minimum rather than the only size. */}
          <div className={activeView === "map" ? "relative min-h-[480px] flex-1 sm:min-h-[560px]" : "flex-1 p-4 sm:p-6"}>
            {profilesError ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                <p>{profilesError}</p>
                <p className="mt-3">
                  <button type="button" className="underline" onClick={() => window.location.reload()}>
                    Reload
                  </button>
                </p>
              </div>
            ) : profilesLoading && profilesByUrn.size === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-500">Loading school data…</p>
            ) : !targetProfile ? (
              <p className="py-12 text-center text-sm text-neutral-500">No real data available for this school yet.</p>
            ) : (
              // key={activeView}: remounts the boundary (clearing any caught error) on
              // every view switch, rather than a stale error from one view lingering
              // over the next -- see DataViewErrorBoundary's own comment for why this
              // exists at all.
              <DataViewErrorBoundary key={activeView}>
                {activeView === "map" ? (
                  <MapView
                    target={target}
                    targetProfile={targetProfile}
                    members={activeSet?.schools ?? []}
                    tickedUrns={tickedUrns}
                    comparedHidden={comparedHidden}
                    onToggleTick={toggleTick}
                    profilesByUrn={profilesByUrn}
                    filters={filters}
                    activeView={activeView}
                    onChangeView={setActiveView}
                  />
                ) : activeView === "dashboard" ? (
                  <DashboardView targetProfile={targetProfile} tickedProfiles={tickedProfiles} filters={filters} filterSummary={filterSummary} />
                ) : (
                  <RankingsView targetProfile={targetProfile} tickedProfiles={tickedProfiles} filters={filters} />
                )}
              </DataViewErrorBoundary>
            )}
          </div>
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
//
// 2026-09-06, UX refinements round 1, A1: the school/college name sat on its own
// line above the tab row, left-aligned with "VicData" in NavBar.tsx (px-6) above
// it and "Phase" in FilterBar.tsx (this shell's own px-4 sm:px-6 filter row)
// below it. px-4 sm:px-6 kept here too (not px-6 unconditionally) for the same
// reason -- this row and the filter row sit directly adjacent and would
// otherwise visibly drift apart below the sm breakpoint.
//
// 2026-09-07, UX refinements round 2, P2 item 4: redesigned per direct
// instruction -- school name now shares ONE line with the tabs (bold/larger/
// dark, reading as identity, to the left) instead of its own line above them;
// tabs are flat pills (no chevrons -- those imply a sequence/step-flow, and
// these four topics are independent, not a step flow) with a FIXED identity
// colour each (TOPIC_COLOURS, tag-colours.ts -- picked to be distinguishable
// from each other, the one requirement that actually matters since they're the
// only place these four colours appear together; see that constant's own
// comment for why some proximity to the school-typology tag palette elsewhere
// in the app was unavoidable). The active tab (only "Rolls" is real content this
// round) always shows its fill -- per the request's own explicit instruction,
// this is NAVIGATION, not filtering, so it doesn't follow the "colour only when
// narrowing from all" convention P2 item 5 applies to actual filter pills (there
// is no "default tab" to narrow away from). print-color-adjust ensures this
// fill actually survives a PDF export (window.print()) rather than silently
// being stripped to plain text the way browsers default background colours to
// on the print path -- this row isn't `print:hidden`, so it's the "PDF export
// header" the request names.
const TOPIC_TABS: { label: string; active: boolean }[] = [
  { label: "Rolls", active: true },
  { label: "Academic", active: false },
  { label: "Destinations", active: false },
  { label: "Context", active: false },
];

function TopicTabs({ schoolName }: { schoolName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-3 sm:px-6 dark:border-neutral-800">
      <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">{schoolName}</p>
      <nav className="flex flex-wrap gap-1.5">
        {TOPIC_TABS.map((t) => {
          const tagColours = TOPIC_COLOURS[t.label];
          const fillLight = tagColours?.light[1] ?? "#171717";
          const fillDark = tagColours?.dark[1] ?? "#ededed";
          return (
            <span
              key={t.label}
              aria-current={t.active ? "page" : undefined}
              className={
                t.active
                  ? "topic-tab-active rounded-full px-3 py-1 text-xs font-medium"
                  : "cursor-not-allowed rounded-full px-3 py-1 text-xs text-neutral-400 dark:text-neutral-600"
              }
              style={
                t.active
                  ? ({
                      "--pill-bg-dark": fillDark,
                      "--pill-fg-dark": contrastingTextColour(fillDark),
                      backgroundColor: fillLight,
                      color: contrastingTextColour(fillLight),
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {t.label}
            </span>
          );
        })}
      </nav>
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .topic-tab-active {
            background-color: var(--pill-bg-dark) !important;
            color: var(--pill-fg-dark) !important;
          }
        }
        :root[data-theme="dark"] .topic-tab-active {
          background-color: var(--pill-bg-dark) !important;
          color: var(--pill-fg-dark) !important;
        }
      `}</style>
    </div>
  );
}
