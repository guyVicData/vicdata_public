"use client";

// Member Data View shell (build brief v1, §4): topic tabs, shared comparator-set
// sidebar + tick-list, shared phase/gender/boarding filter state, and the Map |
// Dashboard | Rankings | +Custom view switcher -- one state, three real consumers,
// per the brief's own "never reset or diverge the active filter when switching views"
// rule. Client component, matching every other auth-gated page in this repo
// (/account, /sets, /sets/[id]) -- there's no server-side session/middleware in this
// codebase to gate on instead.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  boardingModeForFilters,
  singleGenderFilter,
  type DataViewFilterState,
  type WireDataViewFilterState,
} from "@/lib/data-view-filters";
import type { SetOption, ViewKey } from "@/lib/data-view-types";
import type { DefaultListEntry, SchoolTypeCategory } from "@/lib/default-comparator-lists";
import { describeActiveViewSentence } from "@/lib/data-view-summary";
import type { RegionNationPoint, RegionNationRankResult, RegionNationRow } from "@/lib/region-nation-comparator";
import type { AggregateTrends } from "@/lib/aggregate-trends";
import { TOPIC_COLOURS, contrastingTextColour } from "@/lib/tag-colours";
import ComparatorSidebar from "./ComparatorSidebar";
import SavedSetsControl from "./SavedSetsControl";
import FilterBar from "./FilterBar";
import ViewSwitcher from "./ViewSwitcher";
import GraphsView from "./GraphsView";
import RankingsView from "./RankingsView";
import MapView from "./MapView";
import PdfExportButton from "./PdfExportButton";
import DataViewErrorBoundary from "./DataViewErrorBoundary";
import LoadingSpinnerCard from "./LoadingSpinnerCard";

type TargetSchool = {
  urn: string;
  name: string;
  town: string | null;
  easting: number | null;
  northing: number | null;
};

type LoadState = "checking" | "not_a_member" | "loading" | "ready" | "error";

// Member Data View performance architecture v1 (2026-10-08): same figure as
// MapView.tsx's own CLUSTER_THRESHOLD -- one shared definition of "this comparator
// set is large enough to need different handling" rather than two separately-tuned
// numbers that could drift apart.
const LARGE_SET_PROFILE_THRESHOLD = 200;

// Large-set design v1, items 3/5: pure key-derivation helpers, module-scope so they're
// usable identically both inside the fetch effects (to know what to store a result
// under) and during render (to know whether a stored result is still valid for the
// CURRENT scope/set/filters) -- see the ranking effect's own comment for why this
// keyed-cache shape replaces a simpler "clear state in the effect's bail-out branch"
// approach.
function largeSetRankScopeKey(activeSet: SetOption | null): "region" | "nation" | null {
  if (!activeSet || activeSet.kind !== "recipe" || activeSet.schools.length <= LARGE_SET_PROFILE_THRESHOLD) return null;
  if (activeSet.key === "ons_region") return "region";
  if (activeSet.key === "nation") return "nation";
  return null;
}

function largeSetRankRequestKey(targetUrn: string, scopeKey: "region" | "nation", filters: DataViewFilterState): string {
  const sectors = Array.from(filters.sector).sort().join(",");
  return `${targetUrn}|${scopeKey}|${sectors}|${boardingModeForFilters(filters) ?? ""}|${singleGenderFilter(filters) ?? ""}`;
}

function aggregateTrendsRequestKey(targetUrn: string, startPeriod: number): string {
  return `${targetUrn}|${startPeriod}`;
}

// Payload-cleanup round (2026-09-09): region-nation-set's own API response now sends
// the raw positional rows straight through (see region-nation-comparator.ts's own
// comment for the real payload regression this fixes -- re-keying server-side and
// AGAIN duplicating urn/name into a separate list cost 26.96MB vs. the raw RPC's
// 11.98MB, Nation scope). This unpacks one row into the two shapes the rest of this
// component actually needs -- the same shapes buildRegionOrNationComparatorSet used
// to build server-side -- client-side instead. Fixed field order is the same
// positional contract RegionNationRow documents; keep in sync with that migration's
// SQL by hand, same as before this round.
function unpackRegionNationRow(r: RegionNationRow): { entry: DefaultListEntry; point: RegionNationPoint } {
  return {
    entry: { urn: r[0], name: r[1], distanceKm: null },
    point: {
      urn: r[0],
      easting: r[2],
      northing: r[3],
      establishmentTypeGroup: r[4],
      establishmentType: r[5],
      statutoryLowAge: r[6],
      statutoryHighAge: r[7],
      currentPeriod: r[8],
      totalRoll: r[9],
      femaleTotal: r[10],
      ageGenderCounts: r[11],
      boarding: r[12] ? { boarders: r[12][0], day: r[12][1], total: r[12][2] } : null,
      boardersGenderSplit: r[13] ? { male: r[13][0], female: r[13][1] } : null,
      anchorPeriod: r[14],
      anchorAgeGenderCounts: r[15],
    },
  };
}

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
  // Member Data View performance architecture v1 (2026-10-08): Region/Nation follow
  // the exact same lazy-placeholder pattern boarding_quintile already established --
  // a real, correctly-labelled button from the first render (regionName/nation come
  // back with the initial default-lists fetch below), but the actual member list
  // (potentially tens of thousands of schools) is only fetched once clicked.
  const [regionOption, setRegionOption] = useState<SetOption | null>(null);
  const [nationOption, setNationOption] = useState<SetOption | null>(null);
  // Real bug found live (2026-10-09): lightweight (no full profile) geometry+sector
  // for Region/Nation-scale schools -- see loadRegionOrNationSet's own comment for why
  // this exists (MapView drew nothing for these sets without it) and MapView.tsx's
  // buildLightweightProfile for how it's used. Never merged into profilesByUrn itself
  // -- that map stays real-data-only, since Graphs/Rankings/stat cards also read it
  // and a stub zero-roll profile for tens of thousands of schools would silently
  // corrupt their aggregates.
  const [largeSetPoints, setLargeSetPoints] = useState<Map<string, RegionNationPoint>>(new Map());
  // Which of Region/Nation (if either) is currently mid-fetch -- NOT a plain boolean,
  // since a shared true/false flag would make BOTH buttons read as optimistically
  // "selected" the instant either one is clicked (the same class of bug already found
  // and fixed once this round for the Camden/Nearest-10 race -- caught here before
  // shipping, not after a live report this time).
  const [regionNationLoadingScope, setRegionNationLoadingScope] = useState<"region" | "nation" | null>(null);

  const [activeSet, setActiveSet] = useState<SetOption | null>(null);
  // 2026-09-08, live-testing fix round 3: a shared "a named set is being selected"
  // signal, reported up by ComparatorSidebar (its own onLoadingChange prop) for
  // every async control it owns (Local Authorities, Nearest/Boarding "+5 more") --
  // combined below with profilesLoading/boardingQuintileLoading into the ONE
  // indicator the Map actually shows, so three separate "is this button working"
  // complaints get one shared fix instead of three ad hoc ones.
  const [selectingSet, setSelectingSet] = useState(false);
  const [selectingSetLabel, setSelectingSetLabel] = useState<string | undefined>(undefined);
  const handleLoadingChange = useCallback((loading: boolean, label?: string) => {
    setSelectingSet(loading);
    setSelectingSetLabel(label);
  }, []);
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
  // Large-set design v1, item 3: Region/Nation-scale ranking, computed server-side
  // (region_nation_rank()) since tickedProfiles structurally can never hold a
  // 49,000-school set -- see RankingsView.tsx's own large-set display branch for how
  // this gets rendered. null whenever the active set isn't large-scale (small/medium
  // sets keep ranking entirely client-side, unchanged) or the fetch hasn't resolved
  // yet.
  const [largeSetRank, setLargeSetRank] = useState<{ key: string; data: RegionNationRankResult } | null>(null);
  const [largeSetRankLoading, setLargeSetRankLoading] = useState(false);
  // Large-set design v1, item 5: Graphs' aggregate-lines chart data (national/region/
  // sector roll_aggregates rows) -- fetched whenever the active set is large-scale,
  // independent of which view is currently active (a small, cheap fetch -- a handful
  // of rows per scope, nothing like region_nation_set()'s own per-school payload), so
  // switching into Graphs after arriving via Map/Rankings doesn't show an extra
  // loading flash.
  const [aggregateTrends, setAggregateTrends] = useState<{ key: string; data: AggregateTrends } | null>(null);

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
          regionName: string | null;
          nation: "england" | "wales" | null;
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

        // Region only offered when the target genuinely has a sub-national region (not
        // every Welsh school does, and a handful of GIAS sentinel LAs resolve to
        // neither -- see region-crosswalk.ts) -- Nation is offered whenever nation
        // membership resolved at all, England or Wales alike.
        if (body.regionName) {
          setRegionOption({ kind: "recipe", key: "ons_region", label: `${body.regionName} Schools`, schools: [], lazy: true });
        }
        if (body.nation) {
          const nationLabel = body.nation === "england" ? "England Schools" : "Wales Schools";
          setNationOption({ kind: "recipe", key: "nation", label: nationLabel, schools: [], lazy: true });
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
        // 2026-09-08: ticks the WHOLE list now (list1 is already capped at 10 server-
        // side, so this was never actually a behaviour change in practice) -- kept
        // consistent with selectSet's own "every named set ticks its whole list" rule
        // rather than a separate slice here.
        if (list1) {
          setActiveSet(list1);
          setTickedUrns(new Set(list1.schools.map((s) => s.urn)));
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

  const loadRegionOrNationSet = useCallback(
    async (scope: "region" | "nation") => {
      if (!authToken || regionNationLoadingScope) return null;
      setRegionNationLoadingScope(scope);
      try {
        const res = await fetch(`/api/data-view/region-nation-set?urn=${urn}&scope=${scope}`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!res.ok) return null;
        const body = (await res.json()) as { key?: string; label?: string; rows: RegionNationRow[] | null };
        if (!body.rows || !body.key || !body.label) return null;
        const unpacked = body.rows.map(unpackRegionNationRow);
        const option: SetOption = { kind: "recipe", key: body.key, label: body.label, schools: unpacked.map((u) => u.entry) };
        // Real bug found live (2026-10-09): "London/England schools don't load" -- the
        // set itself selected fine, but MapView's own drawing pipeline only plots a
        // school with a full profile in profilesByUrn, which LARGE_SET_PROFILE_THRESHOLD
        // deliberately never fetches for a set this size. These lightweight points
        // (real geometry + sector, no multi-year roll data) let MapView plot a real
        // marker for every school anyway -- see MapView.tsx's own buildLightweightProfile.
        setLargeSetPoints((prev) => {
          const next = new Map(prev);
          for (const u of unpacked) next.set(u.point.urn, u.point);
          return next;
        });
        if (scope === "region") setRegionOption(option);
        else setNationOption(option);
        return option;
      } finally {
        setRegionNationLoadingScope(null);
      }
    },
    [authToken, urn, regionNationLoadingScope],
  );

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
    // Member Data View performance architecture v1 (2026-10-08): Region/Nation sets
    // can legitimately run to tens of thousands of schools (region-nation-comparator.ts
    // returns every real member, per the map's own "nothing silently capped or
    // sampled" principle) -- fetching a FULL rich profile (multi-year roll, age/gender
    // breakdown) per school for a set that large is exactly the fetch-and-compute-at-
    // scale failure mode this whole architecture round exists to remove, just moved
    // from set-SELECTION to set-SELECTED. Past LARGE_SET_PROFILE_THRESHOLD (same
    // figure MapView's own clustering threshold uses, for one consistent "this is a
    // big set" definition rather than two), only the target's own profile PLUS
    // whatever's actually ticked is fetched -- Map still renders every real school
    // (via activeSet.schools/largeSetPoints, not profilesByUrn), Rankings/Graphs read
    // from school_current_snapshot/roll_aggregates at this scale instead (large-set
    // design v1), and Graphs' small/medium per-school charts still work correctly over
    // whatever handful of schools a member has actually ticked.
    //
    // Large-set design v1, item 6: this is also the WHOLE mechanism behind "click a
    // marker in a large set to see its real numbers" -- MapView's own marker-click
    // handler already calls onToggleTick(urn) unconditionally (its tooltip already
    // said "click to add to comparison" before this round), so ticking a school here
    // is what triggers this effect to fetch ITS real profile too, via the exact same
    // /api/data-view/schools endpoint every other comparator set already uses -- no
    // new fetch machinery, no new click handler, just no longer skipping tickedUrns
    // when the active set is large. A member isn't going to individually click
    // hundreds of markers by hand, so this stays a small, bounded fetch in practice.
    const isLargeSet = activeSet.schools.length > LARGE_SET_PROFILE_THRESHOLD;
    const activeSetUrns = new Set(activeSet.schools.map((s) => s.urn));
    const urns = isLargeSet
      ? Array.from(new Set([target.urn, ...Array.from(tickedUrns).filter((u) => activeSetUrns.has(u))]))
      : Array.from(new Set([target.urn, ...activeSet.schools.map((s) => s.urn)]));
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
  }, [authToken, activeSet, target, tickedUrns]);

  // Large-set design v1, item 3: fetches region_nation_rank() whenever the active set
  // is BOTH large (past LARGE_SET_PROFILE_THRESHOLD) AND actually one of the
  // ons_region/nation recipes (the only sets this RPC's own scope resolution can
  // answer for -- a member-curated saved set has no real region/nation membership as
  // a SET, only individual member schools might). boardingModeForFilters/
  // singleGenderFilter (data-view-filters.ts) translate the shared filter state into
  // the same reading region_nation_rank()'s own SQL uses, so this can't silently pick
  // a different boarding-mode/gender interpretation than the RPC itself does.
  //
  // Stores the result keyed by exactly what it was fetched FOR (largeSetRankRequestKey
  // below), rather than clearing state synchronously in the effect body when the
  // gating conditions stop holding (react-hooks/set-state-in-effect -- same discipline
  // the slowLoad effect above already documents: avoid a synchronous setState in an
  // effect's bail-out branch, let render-time comparison decide whether stored state
  // is still valid instead). This also fixes a real correctness gap a plain
  // "clear on bail-out" reset wouldn't: switching directly between two DIFFERENT
  // large sets (e.g. Region -> Nation) without an intermediate small-set state would
  // otherwise flash the PREVIOUS scope's stale ranking while the new one is in
  // flight, since neither transition ever hits the "not large" bail-out branch.
  useEffect(() => {
    const scopeKey = target ? largeSetRankScopeKey(activeSet) : null;
    if (!authToken || !target || !scopeKey) return;
    const requestKey = largeSetRankRequestKey(target.urn, scopeKey, filters);
    let cancelled = false;
    (async () => {
      setLargeSetRankLoading(true);
      try {
        const params = new URLSearchParams({ urn: target.urn, scope: scopeKey });
        const sectors = Array.from(filters.sector).join(",");
        const boardingMode = boardingModeForFilters(filters);
        const gender = singleGenderFilter(filters);
        if (sectors) params.set("sectors", sectors);
        if (boardingMode) params.set("boardingMode", boardingMode);
        if (gender) params.set("gender", gender);
        const res = await fetch(`/api/data-view/region-nation-rank?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[DataViewShell] region-nation-rank fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { rank: RegionNationRankResult | null };
        if (cancelled || !body.rank) return;
        setLargeSetRank({ key: requestKey, data: body.rank });
      } catch (e) {
        if (!cancelled) console.error("[DataViewShell] unexpected error fetching region/nation ranking:", e);
      } finally {
        if (!cancelled) setLargeSetRankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, target, activeSet, filters]);

  // Large-set design v1, item 5: fetches national/region/sector aggregate trend lines
  // whenever the active set is large-scale (same LARGE_SET_PROFILE_THRESHOLD gate as
  // the ranking fetch above) -- unlike ranking, this doesn't depend on which specific
  // recipe is active (region_nation_rank() needs a real region/nation SCOPE to rank
  // against; aggregate-trends only needs the TARGET's own region/nation/sector
  // membership, which is real regardless of what the member happens to have
  // selected), so it's gated on set size alone. Same keyed-cache discipline as the
  // ranking effect above, for the same react-hooks/set-state-in-effect reason.
  useEffect(() => {
    const isLargeSet = !!activeSet && activeSet.schools.length > LARGE_SET_PROFILE_THRESHOLD;
    if (!authToken || !target || !isLargeSet) return;
    const requestKey = aggregateTrendsRequestKey(target.urn, filters.startPeriod);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/data-view/aggregate-trends?urn=${target.urn}&startPeriod=${filters.startPeriod}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[DataViewShell] aggregate-trends fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { trends: AggregateTrends };
        if (cancelled) return;
        setAggregateTrends({ key: requestKey, data: body.trends });
      } catch (e) {
        if (!cancelled) console.error("[DataViewShell] unexpected error fetching aggregate trends:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, target, activeSet, filters.startPeriod]);

  useEffect(() => {
    // Only ever read while loadState is "checking"/"loading" (see that render branch
    // below) -- no need to explicitly reset it back to false once loading finishes,
    // that branch simply stops rendering it. Avoids a synchronous setState call in
    // the effect body itself (react-hooks/set-state-in-effect).
    if (loadState !== "checking" && loadState !== "loading") return;
    const timer = setTimeout(() => setSlowLoad(true), 12000);
    return () => clearTimeout(timer);
  }, [loadState]);

  // 2026-09-08, live-testing fix round 3 (investigating "I think I crashed the
  // selector -- had to refresh the page"): the ONE place every real set-selection
  // ultimately lands, regardless of which control triggered it -- so it's also the
  // one correct place to guard against a genuinely real, previously-unguarded race.
  // The boarding-quintile lazy load (below) can take ~41s; if a member clicks
  // Boarding schools, then clicks something else before that resolves, the OLD code
  // called selectSet(loaded) unconditionally once it finally finished -- silently
  // discarding whatever the member had since chosen and replacing it with the stale
  // boarding set, with no error, no crash message, just a UI that suddenly looks
  // wrong for no visible reason. That matches the reported symptom closely enough
  // (a confusing, "broken-feeling" state right after a slow LA/boarding
  // interaction) that this is treated as the real, or at least the most likely,
  // root cause -- logged in docs/vicdata_data_view_open_questions.md alongside the
  // honest caveat that a literal reproduction (a thrown exception, a white screen)
  // was not achieved. Every selectSet call bumps this counter; the boarding
  // lazy-load path snapshots it before starting and only applies its result if
  // nothing else has selected a set in the meantime. ComparatorSidebar.tsx's own
  // ComparatorSidebar-local ~setRequestSeq guard is a complementary, narrower
  // version of this same idea for the controls entirely local to that component
  // (Local Authorities, Nearest/Boarding "+5 more").
  const activeSetSeq = useRef(0);

  // 2026-09-08, "Compared with" panel rework, per direct instruction: "every
  // [named-set] button... instantly ticks its whole set... one click, no further
  // confirmation." Every recipe now ticks EVERY school in its list, not just the
  // first INITIAL_TICKED_COUNT -- the old partial-pre-tick default existed for the
  // dropdown era's own "you'll thin it out yourself in the list below" model, which
  // this rework replaces entirely (manual thinning now happens in the
  // Add/subtract-schools window instead, a genuinely separate action from picking a
  // named set). A saved set already ticked everything it held; this just makes
  // recipes consistent with that, not a new special case.
  function selectSet(option: SetOption) {
    activeSetSeq.current++;
    setActiveSet(option);
    setTickedUrns(new Set(option.schools.map((s) => s.urn)));
    // 2026-09-06, UX refinements round 1, A2/B3: recalling a saved set restores the
    // filter state it was saved with too, when one was actually saved (see
    // SetOption's own comment for why this is optional) -- "share one underlying
    // save mechanism" means recall is symmetric with save, not just the school list.
    if (option.kind === "saved" && option.filters) {
      setFilters(deserializeFilterState(option.filters));
    }
  }

  // 2026-09-08, "Compared with" panel round 2, per direct request: the "Schools and
  // FE colleges, 16+, in {LA}" recipe lost its own standalone button -- "this set
  // should be triggered by the post16 search button above" (FilterBar's own Post-16
  // phase pill) instead. Fires only on the OFF->ON transition (a ref, not a plain
  // effect dependency check), so turning Post-16 on picks this recipe once, but a
  // member who then manually picks a different set isn't fought with every
  // subsequent render while Post-16 stays active -- only a fresh OFF->ON edge
  // re-triggers it.
  const wasPost16Ref = useRef(false);
  useEffect(() => {
    const isPost16Now = filters.phaseBands.has("Post 16");
    if (isPost16Now && !wasPost16Ref.current && recipeLists?.local16Plus) {
      selectSet(recipeLists.local16Plus);
    }
    wasPost16Ref.current = isPost16Now;
  }, [filters.phaseBands, recipeLists?.local16Plus]);

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
  // 2026-09-08, shared map-based loading indicator (live-testing fix round 3):
  // combines every real source of "the comparator set is still being worked out" --
  // the profile fetch itself, the boarding-quintile lazy load, and every async
  // control ComparatorSidebar owns (surfaced via handleLoadingChange) -- into the
  // ONE signal the Map actually renders. Boarding's own already-good loading copy
  // takes priority when it's genuinely what's happening; everything else shares a
  // plain default rather than each control inventing its own wording.
  const mapLoading = profilesLoading || boardingQuintileLoading || regionNationLoadingScope !== null || selectingSet;
  const mapLoadingLabel = boardingQuintileLoading
    ? "Computing national boarding quintile — this can take a little while…"
    : regionNationLoadingScope !== null
      ? "Loading schools across this scope…"
      : (selectingSetLabel ?? "Loading schools…");
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

  // Large-set design v1, items 3/5: resolve the keyed-cache state (see those effects'
  // own comments) against what the CURRENT render actually wants -- a stored result
  // whose key doesn't match the live scope/set/filters is stale (superseded by a
  // switch to a different set, or simply not fetched yet) and is treated as absent
  // rather than shown.
  const isLargeSet = !!activeSet && activeSet.schools.length > LARGE_SET_PROFILE_THRESHOLD;
  const currentLargeSetRankScopeKey = largeSetRankScopeKey(activeSet);
  const resolvedLargeSetRank =
    target && currentLargeSetRankScopeKey && largeSetRank?.key === largeSetRankRequestKey(target.urn, currentLargeSetRankScopeKey, filters)
      ? largeSetRank.data
      : null;
  const resolvedAggregateTrends =
    target && isLargeSet && aggregateTrends?.key === aggregateTrendsRequestKey(target.urn, filters.startPeriod) ? aggregateTrends.data : null;

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
            nearestOption={recipeLists?.list1 ?? null}
            homeLaOption={recipeLists?.list2 ?? null}
            boardingOption={boardingQuintileOption}
            regionOption={regionOption}
            nationOption={nationOption}
            savedSets={savedSets}
            activeSet={activeSet}
            onSelectSet={(opt) => {
              // Every lazy placeholder (boarding_quintile, ons_region, nation) shares
              // this same "snapshot activeSetSeq before the async load, only apply if
              // still current" guard -- see activeSetSeq's own comment above for the
              // real bug this protects against, now generalised past boarding alone
              // since Region/Nation's own fetch is a second async selectSet path.
              if (opt.kind === "recipe" && opt.lazy && opt.schools.length === 0) {
                const mySeq = activeSetSeq.current;
                const loader = opt.key === "ons_region" ? () => loadRegionOrNationSet("region") : opt.key === "nation" ? () => loadRegionOrNationSet("nation") : loadBoardingQuintileList;
                loader().then((loaded) => {
                  if (loaded && mySeq === activeSetSeq.current) selectSet(loaded);
                });
                return;
              }
              selectSet(opt);
            }}
            boardingQuintileLoading={boardingQuintileLoading}
            regionNationLoadingScope={regionNationLoadingScope}
            onLoadingChange={handleLoadingChange}
            tickedUrns={tickedUrns}
            onToggleTick={toggleTick}
            onSelectAllTicked={selectAllTicked}
            onUnselectAllTicked={unselectAllTicked}
            comparedHidden={comparedHidden}
            onToggleComparedHidden={() => setComparedHidden((h) => !h)}
            profilesByUrn={profilesByUrn}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* 2026-09-05: Map view v1 (per direct request) treats the map as a full
              canvas with the view-switcher and export button floated as overlays
              INSIDE it, rather than this in-flow subheader row -- so the row is
              skipped entirely for Map (MapView renders its own copies). Dashboard
              and Rankings are untouched.
              2026-09-08: switcher moved to the left (justify-between, not justify-end)
              to exactly match the Map overlay's own left/right split -- switcher at
              the left edge, export button at the right -- per Guy's explicit request,
              rather than both bunched together on the right as before. */}
          {activeView !== "map" && (
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-900">
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
              // 2026-09-08, per direct request: the Map's own loading state now matches
              // the public school page's map-loading indicator exactly (same spinner
              // component, LoadingSpinnerCard.tsx) rather than plain text -- scoped to
              // Map specifically since that's the view this was asked for; Graphs/
              // Rankings keep the existing plain-text loading state, unchanged.
              activeView === "map" ? (
                <LoadingSpinnerCard label="Loading schools…" />
              ) : (
                <p className="py-12 text-center text-sm text-neutral-500">Loading school data…</p>
              )
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
                    largeSetPoints={largeSetPoints}
                    loading={mapLoading}
                    loadingLabel={mapLoadingLabel}
                    filters={filters}
                    activeView={activeView}
                    onChangeView={setActiveView}
                  />
                ) : activeView === "graphs" ? (
                  <GraphsView
                    targetProfile={targetProfile}
                    tickedProfiles={tickedProfiles}
                    filters={filters}
                    filterSummary={filterSummary}
                    isLargeSet={isLargeSet}
                    aggregateTrends={resolvedAggregateTrends}
                  />
                ) : (
                  <RankingsView
                    targetProfile={targetProfile}
                    tickedProfiles={tickedProfiles}
                    filters={filters}
                    largeSetRank={resolvedLargeSetRank}
                    largeSetRankLoading={largeSetRankLoading}
                    largeSetLabel={activeSet?.label ?? null}
                  />
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
