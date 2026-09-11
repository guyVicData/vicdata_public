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
import type { SchoolSearchResult } from "@/components/SchoolSearch";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { deserializeProfile, profileToFilterableData, type WireDataViewSchoolProfile } from "@/lib/data-view-serialize";
import {
  emptyDataViewFilterState,
  describeFilters,
  serializeFilterState,
  deserializeFilterState,
  matchesSectorFilter,
  boardingModeForFilters,
  singleGenderFilter,
  filteredCount,
  type DataViewFilterState,
  type WireDataViewFilterState,
} from "@/lib/data-view-filters";
import type { SetOption, RecipeOption, ViewKey } from "@/lib/data-view-types";
import type { DefaultListEntry, SchoolTypeCategory, BoardingQuintileBand } from "@/lib/default-comparator-lists";
import { describeActiveViewSentence } from "@/lib/data-view-summary";
import type { RegionNationPoint, RegionNationRankResult, RegionNationRow } from "@/lib/region-nation-comparator";
import type { AggregateTrends } from "@/lib/aggregate-trends";
import type { LaChoroplethEntry } from "@/lib/la-choropleth";
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

// Map round (2026-09-12), Part 2 Stage A: region_nation_la_rollup() applies phase/
// age-range too (deliberately not replicated by region_nation_rank() above -- see
// that RPC's own migration comment), so this key includes phaseBands, unlike
// largeSetRankRequestKey's own sectors/boarding/gender-only key.
// Same "recipe" narrowing largeSetRankScopeKey's own guard uses (SetOption is a
// union -- only the "recipe" variant carries a `key` at all, a "saved" set has none).
function isRegionScope(activeSet: SetOption | null): boolean {
  return !!activeSet && activeSet.kind === "recipe" && activeSet.key === "ons_region";
}

// Map round (2026-09-12), Part 2 Stage B: same "recipe" narrowing, "nation" is the
// key buildRegionOrNationComparatorSet gives the Nation scope recipe.
function isNationScope(activeSet: SetOption | null): boolean {
  return !!activeSet && activeSet.kind === "recipe" && activeSet.key === "nation";
}

// school_region_nation's own whole-country pseudo-"region" code for Wales (confirmed
// live earlier this round) -- there is no real ONS sub-national region for Wales, so
// this is the one real region_code value every Welsh school's own region membership
// already resolves to, reused here as the permanent "region" a Welsh Nation-scope
// target's LA-tier drill-down fetches, no zoom detection needed.
const WALES_PSEUDO_REGION_CODE = "W92000004";

function laChoroplethRequestKey(targetUrn: string, filters: DataViewFilterState): string {
  const sectors = Array.from(filters.sector).sort().join(",");
  const phaseBands = Array.from(filters.phaseBands).sort().join(",");
  return `${targetUrn}|${sectors}|${phaseBands}|${boardingModeForFilters(filters) ?? ""}|${singleGenderFilter(filters) ?? ""}`;
}

// Map round (2026-09-12), Part 2 Stage B: same shape as laChoroplethRequestKey, no
// regionCode component -- the region tier IS "every region," there's nothing to
// scope to.
function nationRegionChoroplethRequestKey(targetUrn: string, filters: DataViewFilterState): string {
  const sectors = Array.from(filters.sector).sort().join(",");
  const phaseBands = Array.from(filters.phaseBands).sort().join(",");
  return `${targetUrn}|${sectors}|${phaseBands}|${boardingModeForFilters(filters) ?? ""}|${singleGenderFilter(filters) ?? ""}`;
}

// Map round (2026-09-12), Part 2 Stage B: the LA-tier drill-down within Nation scope
// is keyed by regionCode too (unlike laChoroplethRequestKey, which only ever fetches
// the TARGET's own single region and never needs one) -- refetches whenever the
// member zooms into a DIFFERENT region, not just when filters change.
function nationDrilldownRequestKey(targetUrn: string, regionCode: string, filters: DataViewFilterState): string {
  const sectors = Array.from(filters.sector).sort().join(",");
  const phaseBands = Array.from(filters.phaseBands).sort().join(",");
  return `${targetUrn}|${regionCode}|${sectors}|${phaseBands}|${boardingModeForFilters(filters) ?? ""}|${singleGenderFilter(filters) ?? ""}`;
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

// Compared-with panel round (2026-09-10), item 2: which SetOption "Nearest 10"
// currently resolves to, for a genuine boarding target -- there is no longer a
// separate Boarding schools button, so this single ordinary-vs-quintile choice is
// what the one Nearest-10 button (and its +5/-5 stepper, ComparatorSidebar's own
// concern) actually shows. Pure function of the already-fetched recipe data plus the
// LIVE boarding filter mode, so it can be called identically both for the initial
// landing selection (boardingMode null, filters start empty) and on every later
// render as the member toggles the shared boarding filter (see the resolvedNearestOption
// memo + switch-effect below, in the component body).
//   - boardingBand "top_two": default is boardingRecipe (same-quintile match,
//     unbounded catchment) -- switches to the ordinary list1 recipe when the member
//     ticks Day pupils specifically (a day-pupil framing makes more sense than a
//     boarding-population quintile for that reading).
//   - boardingBand "bottom_three": default is the ordinary list1 recipe -- switches
//     to boardingRecipe (nearest real boarding schools nationally, age/gender) when
//     the member ticks Boarders specifically.
//   - boardingBand null (not a genuine boarding school, or the fast-path recipe
//     isn't precomputed yet for a top-two target -- see DefaultComparatorLists'
//     own comment for why no slow fallback is attempted here): list1 always.
function resolveNearestOption(
  list1: RecipeOption | null,
  boardingBand: BoardingQuintileBand | null,
  boardingRecipe: RecipeOption | null,
  boardingMode: "boarders" | "day" | "whole" | null,
): RecipeOption | null {
  if (boardingBand === "top_two") {
    return boardingMode === "day" ? list1 : (boardingRecipe ?? list1);
  }
  if (boardingBand === "bottom_three") {
    return boardingMode === "boarders" ? (boardingRecipe ?? list1) : list1;
  }
  return list1;
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
    list1: RecipeOption | null;
    list2: SetOption | null;
    // Compared-with panel round (2026-09-10), item 2: which quintile band a genuine
    // boarding target falls in, plus the boarding-quintile recipe itself (fast-path
    // only) -- together with `list1`, everything resolveNearestOption (below) needs
    // to decide which recipe "Nearest 10" currently means. Both null for a
    // non-boarding target. See default-comparator-lists.ts's own DefaultComparatorLists
    // comment for the full gate description.
    boardingBand: BoardingQuintileBand | null;
    boardingRecipe: RecipeOption | null;
    // 2026-09-08, bug fix: a real candidate list letting a mainstream Post-16
    // target's own comparator picker include FE colleges (default-comparator-
    // lists.ts's own comment explains why this never existed for a mainstream
    // target before, only an FE-college one).
    local16Plus: SetOption | null;
  } | null>(null);
  const [savedSets, setSavedSets] = useState<SetOption[]>([]);
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
  // Real bug found live-testing the numbers block (2026-09-11): this used to live
  // entirely inside ComparatorSidebar.tsx as local state, invisible to this
  // component -- a school added via the Add/Subtract window's search-add path
  // (addSchool) called onToggleTick(urn) correctly (tickedUrns did include it), but
  // the school itself was never added to anything DataViewShell reads, so every
  // downstream consumer of "the active set's real schools" (tickedProfiles below,
  // the profile-fetch effect, Map/Dashboard/Rankings via tickedProfiles) silently
  // never saw it -- a manually searched-and-added-then-ticked school was ticked in
  // the sidebar's own tick-list but functionally invisible everywhere else. Lifted
  // here, alongside tickedUrns (which has always lived here), so activeSetSchools
  // below can merge it into the one real roster every downstream consumer reads.
  // Deliberately NOT reset when activeSet changes (picking a different named set) --
  // same "manual thinning is a genuinely separate action from picking a named set"
  // convention ComparatorSidebar's own module comment already establishes for why
  // this exists as a persistent overlay, not reset elsewhere.
  const [addedUrns, setAddedUrns] = useState<{ urn: string; name: string }[]>([]);
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
  // Map round (2026-09-12), Part 2 Stage A: LA choropleth data, fetched only when the
  // active set is genuinely Region scope (activeSet.key === "ons_region") -- Nation
  // stays dot-cluster until Stage B, and every other recipe (Nearest-10/LA-scoped/
  // boarding) keeps its existing dot map completely unchanged, per direct instruction.
  // Same keyed-cache discipline as largeSetRank/aggregateTrends above.
  const [laChoropleth, setLaChoropleth] = useState<{ key: string; data: LaChoroplethEntry[] } | null>(null);
  // Bug fix round (2026-09-14), real bug found live ("loading spinner stuck on
  // permanently, survives switching schools/scopes"): this used to be a plain
  // boolean, set true/false imperatively inside the effect -- when the effect's own
  // guard clause started failing (scope/target no longer qualifies) while a
  // previous run's fetch was still in flight, React's cleanup-then-rerun ordering
  // meant NEITHER the orphaned promise's own `finally` (guarded by its now-true
  // `cancelled`) NOR the new run (which bails before reaching any reset) ever set it
  // back to false -- stuck true forever. Fixed by tracking the REQUEST KEY currently
  // being fetched for instead (set only inside the async block, same place the old
  // boolean was set/cleared) and deriving the exposed loading boolean at render time
  // (see laChoroplethLoading below) -- same "let render-time comparison decide,
  // don't reset state synchronously in an effect" discipline this file's own
  // largeSetRank/aggregateTrends effects already document, applied here too so the
  // loading signal can't desync from the real gating conditions ever again.
  const [laChoroplethFetchingKey, setLaChoroplethFetchingKey] = useState<string | null>(null);
  // Map round (2026-09-12), Part 2 Stage B: the target's own real nation ("england" |
  // "wales" | null), captured once here (Step 2's own default-lists fetch already
  // resolves it, previously only baked into nationOption's own label string) -- needed
  // as a real value, not string-parsed, to decide which of Nation scope's two modes
  // applies (English targets get the region tier + zoom-drill; Wales has no ONS region
  // subdivision at all, so a Welsh target's Nation scope goes straight to the LA tier
  // -- see nationDrilldownLaChoropleth's own fetch effect).
  const [targetNation, setTargetNation] = useState<"england" | "wales" | null>(null);
  // Nation scope's region tier (English targets only) -- same keyed-cache discipline
  // as laChoropleth above, independent of zoom (cheap, ~9 rows, kept ready so zooming
  // back out never needs a refetch).
  const [nationRegionChoropleth, setNationRegionChoropleth] = useState<{ key: string; data: LaChoroplethEntry[] } | null>(null);
  // Same fetching-key tracking as laChoroplethFetchingKey above, same bug/fix.
  const [nationRegionChoroplethFetchingKey, setNationRegionChoroplethFetchingKey] = useState<string | null>(null);
  // Which region the map is currently "zoomed into" within Nation scope -- reported
  // by MapView's own zoom-detection (English targets) via onNationZoomedRegionChange,
  // or set once, permanently, to Wales's own whole-country pseudo-region code for a
  // Welsh target (see the effect below). null means "region tier, zoomed out" (English
  // targets only -- a Welsh target is never null once resolved).
  const [nationZoomedRegionCode, setNationZoomedRegionCode] = useState<string | null>(null);
  // The LA tier for whichever region nationZoomedRegionCode names -- reuses the exact
  // SAME /api/data-view/region-la-choropleth endpoint laChoropleth (Region scope)
  // already calls, just with an explicit regionCode instead of letting it resolve the
  // target's own.
  const [nationDrilldownLaChoropleth, setNationDrilldownLaChoropleth] = useState<{ key: string; data: LaChoroplethEntry[] } | null>(null);
  // Same fetching-key tracking as laChoroplethFetchingKey above, same bug/fix.
  const [nationDrilldownFetchingKey, setNationDrilldownFetchingKey] = useState<string | null>(null);

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
          boardingBand: BoardingQuintileBand | null;
          boardingRecipe: { key: string; label: string; schools: { urn: string; name: string; distanceKm: number | null }[]; note?: string } | null;
          local16Plus: { key: string; label: string; schools: { urn: string; name: string; distanceKm: number | null }[]; note?: string } | null;
          regionName: string | null;
          nation: "england" | "wales" | null;
        };
        const list1: RecipeOption | null = body.list1 ? { kind: "recipe", key: body.list1.key, label: body.list1.label, schools: body.list1.schools, note: body.list1.note } : null;
        const list2: SetOption | null = body.list2 ? { kind: "recipe", key: body.list2.key, label: body.list2.label, schools: body.list2.schools, note: body.list2.note } : null;
        const boardingRecipe: RecipeOption | null = body.boardingRecipe
          ? { kind: "recipe", key: body.boardingRecipe.key, label: body.boardingRecipe.label, schools: body.boardingRecipe.schools, note: body.boardingRecipe.note }
          : null;
        const local16Plus: SetOption | null = body.local16Plus
          ? { kind: "recipe", key: body.local16Plus.key, label: body.local16Plus.label, schools: body.local16Plus.schools, note: body.local16Plus.note }
          : null;
        setRecipeLists({ schoolTypeCategory: body.schoolTypeCategory, list1, list2, boardingBand: body.boardingBand, boardingRecipe, local16Plus });

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
        setTargetNation(body.nation);

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

        // Default landing state (brief §4): Map view, Nearest 10 (any LA) pre-selected
        // -- or, for a genuine top-two-quintile boarding target, its own quintile
        // recipe (resolveNearestOption's own comment) -- filters are still empty at
        // this point (emptyDataViewFilterState's own boarding Set), so this is exactly
        // the same resolution the live memo below applies on every subsequent render.
        // 2026-09-08: ticks the WHOLE list now (list1 is already capped at 10 server-
        // side, so this was never actually a behaviour change in practice) -- kept
        // consistent with selectSet's own "every named set ticks its whole list" rule
        // rather than a separate slice here.
        const initialNearest = resolveNearestOption(list1, body.boardingBand, boardingRecipe, null);
        if (initialNearest) {
          setActiveSet(initialNearest);
          setTickedUrns(new Set(initialNearest.schools.map((s) => s.urn)));
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
  // Real bug fix (2026-09-11): activeSet.schools alone never includes a school
  // manually added via the Add/Subtract window's search-add path (addSchool above)
  // -- merged here, ONCE, so every downstream consumer (this effect's own urns
  // computation just below, tickedProfiles further down, ComparatorSidebar's own
  // roster-count button) reads the SAME real list, rather than two that used to
  // silently disagree (addedUrns used to live only inside ComparatorSidebar's own
  // local state, invisible here). An added entry that happens to already be part of
  // activeSet.schools (a school someone searches for that's already in the active
  // recipe) is skipped, not duplicated -- activeSet's own entry (which may carry a
  // real distanceKm) wins.
  const activeSetSchoolUrns = new Set(activeSet?.schools.map((s) => s.urn) ?? []);
  const activeSetSchools: DefaultListEntry[] = activeSet
    ? [...activeSet.schools, ...addedUrns.filter((a) => !activeSetSchoolUrns.has(a.urn)).map((a) => ({ urn: a.urn, name: a.name, distanceKm: null }))]
    : [];

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
    const activeSetSchoolUrnSet = new Set(activeSetSchools.map((s) => s.urn));
    const urns = isLargeSet
      ? Array.from(new Set([target.urn, ...Array.from(tickedUrns).filter((u) => activeSetSchoolUrnSet.has(u))]))
      : Array.from(new Set([target.urn, ...activeSetSchools.map((s) => s.urn)]));
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

  // Map round (2026-09-12), Part 2 Stage A: real LA-level choropleth data, fetched
  // whenever the active set is genuinely Region scope -- gated on activeSet.key
  // exactly the way largeSetRankScopeKey gates on "ons_region"/"nation" above, but
  // Region only (Nation stays dot-cluster this round). Refetches whenever the shared
  // filter state changes (sector/phase/gender/boarding all reshape the LA totals,
  // same live-filters principle the dot map's own filteredCount already follows).
  useEffect(() => {
    if (!authToken || !target || !isRegionScope(activeSet)) return;
    const requestKey = laChoroplethRequestKey(target.urn, filters);
    if (laChoropleth?.key === requestKey) return;
    let cancelled = false;
    (async () => {
      setLaChoroplethFetchingKey(requestKey);
      try {
        const params = new URLSearchParams({ urn: target.urn });
        const sectors = Array.from(filters.sector).join(",");
        const phaseBands = Array.from(filters.phaseBands).join(",");
        const boardingMode = boardingModeForFilters(filters);
        const gender = singleGenderFilter(filters);
        if (sectors) params.set("sectors", sectors);
        if (phaseBands) params.set("phaseBands", phaseBands);
        if (boardingMode) params.set("boardingMode", boardingMode);
        if (gender) params.set("gender", gender);
        const res = await fetch(`/api/data-view/region-la-choropleth?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[DataViewShell] region-la-choropleth fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { entries: LaChoroplethEntry[] };
        if (cancelled) return;
        setLaChoropleth({ key: requestKey, data: body.entries });
      } catch (e) {
        if (!cancelled) console.error("[DataViewShell] unexpected error fetching LA choropleth:", e);
      } finally {
        if (!cancelled) setLaChoroplethFetchingKey((k) => (k === requestKey ? null : k));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, target, activeSet, filters, laChoropleth]);
  // Bug fix round (2026-09-14): DERIVED at render time, not a stored boolean the
  // effect above sets/resets imperatively -- see laChoroplethFetchingKey's own
  // comment for the full bug this closes. True only when the gating conditions
  // genuinely still call for this fetch AND a request matching them is actually in
  // flight -- the moment either stops holding (scope changes, target switches, the
  // request key changes), this is false on the very next render, with no reset step
  // that could ever get skipped.
  const laChoroplethLoading = !!target && isRegionScope(activeSet) && laChoroplethFetchingKey === laChoroplethRequestKey(target.urn, filters);

  // Map round (2026-09-12), Part 2 Stage B: Nation scope's own region-tier data,
  // English targets only (fetchNationRegionChoropleth's own comment explains why
  // Wales has no equivalent). Independent of zoom -- fetched once per filter
  // combination and kept ready, so zooming back out from the LA-tier drill-down never
  // needs a refetch.
  useEffect(() => {
    if (!authToken || !target || !isNationScope(activeSet) || targetNation !== "england") return;
    const requestKey = nationRegionChoroplethRequestKey(target.urn, filters);
    if (nationRegionChoropleth?.key === requestKey) return;
    let cancelled = false;
    (async () => {
      setNationRegionChoroplethFetchingKey(requestKey);
      try {
        const params = new URLSearchParams({ urn: target.urn });
        const sectors = Array.from(filters.sector).join(",");
        const phaseBands = Array.from(filters.phaseBands).join(",");
        const boardingMode = boardingModeForFilters(filters);
        const gender = singleGenderFilter(filters);
        if (sectors) params.set("sectors", sectors);
        if (phaseBands) params.set("phaseBands", phaseBands);
        if (boardingMode) params.set("boardingMode", boardingMode);
        if (gender) params.set("gender", gender);
        const res = await fetch(`/api/data-view/nation-region-choropleth?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[DataViewShell] nation-region-choropleth fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { entries: LaChoroplethEntry[] };
        if (cancelled) return;
        setNationRegionChoropleth({ key: requestKey, data: body.entries });
      } catch (e) {
        if (!cancelled) console.error("[DataViewShell] unexpected error fetching Nation region tier:", e);
      } finally {
        if (!cancelled) setNationRegionChoroplethFetchingKey((k) => (k === requestKey ? null : k));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, target, activeSet, targetNation, filters, nationRegionChoropleth]);
  // Bug fix round (2026-09-14): same derived-at-render-time discipline as
  // laChoroplethLoading above -- see that constant's own comment.
  const nationRegionChoroplethLoading =
    !!target &&
    isNationScope(activeSet) &&
    targetNation === "england" &&
    nationRegionChoroplethFetchingKey === nationRegionChoroplethRequestKey(target.urn, filters);

  // Map round (2026-09-12), Part 2 Stage B: the real region a Nation-scope target's
  // LA-tier drill-down should show, DERIVED at render time rather than synchronously
  // reset in an effect (same discipline the large-set ranking effect's own comment
  // documents -- "rather than clearing state synchronously in the effect body...
  // let render-time comparison decide instead"). nationZoomedRegionCode itself (raw
  // state) is ONLY ever written by MapView's own zoom-detection callback (English
  // targets) -- Wales and "not Nation scope" are both handled here, by DERIVING null
  // or the Wales pseudo-region rather than mutating state for them.
  const effectiveNationZoomedRegionCode = !isNationScope(activeSet)
    ? null
    : targetNation === "wales"
      ? WALES_PSEUDO_REGION_CODE
      : nationZoomedRegionCode;

  // Map round (2026-09-12), Part 2 Stage B: the LA tier for whichever region
  // effectiveNationZoomedRegionCode currently names -- reuses the exact same
  // /api/data-view/region-la-choropleth endpoint Region scope's own laChoropleth
  // fetch above calls, just with an explicit regionCode (Stage A's own version
  // always lets it resolve the target's own region instead). Works identically for
  // an English target zoomed into some region, or a Welsh target (permanently
  // resolving to its own W92000004 pseudo-region above) -- one fetch effect, not two.
  useEffect(() => {
    if (!authToken || !target || effectiveNationZoomedRegionCode === null) return;
    const requestKey = nationDrilldownRequestKey(target.urn, effectiveNationZoomedRegionCode, filters);
    if (nationDrilldownLaChoropleth?.key === requestKey) return;
    let cancelled = false;
    (async () => {
      setNationDrilldownFetchingKey(requestKey);
      try {
        const params = new URLSearchParams({ urn: target.urn, regionCode: effectiveNationZoomedRegionCode });
        const sectors = Array.from(filters.sector).join(",");
        const phaseBands = Array.from(filters.phaseBands).join(",");
        const boardingMode = boardingModeForFilters(filters);
        const gender = singleGenderFilter(filters);
        if (sectors) params.set("sectors", sectors);
        if (phaseBands) params.set("phaseBands", phaseBands);
        if (boardingMode) params.set("boardingMode", boardingMode);
        if (gender) params.set("gender", gender);
        const res = await fetch(`/api/data-view/region-la-choropleth?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[DataViewShell] nation-scope LA drilldown fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { entries: LaChoroplethEntry[] };
        if (cancelled) return;
        setNationDrilldownLaChoropleth({ key: requestKey, data: body.entries });
      } catch (e) {
        if (!cancelled) console.error("[DataViewShell] unexpected error fetching Nation-scope LA drilldown:", e);
      } finally {
        if (!cancelled) setNationDrilldownFetchingKey((k) => (k === requestKey ? null : k));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, target, effectiveNationZoomedRegionCode, filters, nationDrilldownLaChoropleth]);
  // Bug fix round (2026-09-14): same derived-at-render-time discipline as
  // laChoroplethLoading above -- see that constant's own comment.
  const nationDrilldownLoading =
    !!target &&
    effectiveNationZoomedRegionCode !== null &&
    nationDrilldownFetchingKey === nationDrilldownRequestKey(target.urn, effectiveNationZoomedRegionCode, filters);

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
    // Bug fix round (2026-09-14), real bug found live ("Could not load school data
    // for this Compared with set" on selecting Nation scope): ticking EVERY school
    // unconditionally breaks down for a genuinely large-scale recipe (Region/Nation,
    // tens of thousands of schools) -- the profile-fetch effect's own
    // LARGE_SET_PROFILE_THRESHOLD protection is built on "only a handful get ticked
    // in practice" (a member clicking individual markers -- that effect's own
    // comment), which auto-ticking the whole list here defeated by construction,
    // producing a urns= query string with every URN in the country and a
    // guaranteed-to-fail request. A genuinely large set now starts with nothing
    // ticked instead -- ComparatorSidebar's own "Select all ticked" affordance in
    // the Add/subtract window still lets a member deliberately tick a chunk
    // afterwards, and MapView's own marker-click-to-tick path (onToggleTick) is
    // completely unaffected either way (both already just call the same
    // setTickedUrns machinery this function also uses, untouched here).
    setTickedUrns(option.schools.length > LARGE_SET_PROFILE_THRESHOLD ? new Set() : new Set(option.schools.map((s) => s.urn)));
    // 2026-09-06, UX refinements round 1, A2/B3: recalling a saved set restores the
    // filter state it was saved with too, when one was actually saved (see
    // SetOption's own comment for why this is optional) -- "share one underlying
    // save mechanism" means recall is symmetric with save, not just the school list.
    if (option.kind === "saved" && option.filters) {
      setFilters(deserializeFilterState(option.filters));
    }
  }

  // Map round (2026-09-12), Part 2 Stage A: clicking an LA polygon on the Region
  // choropleth re-scopes the comparator set exactly the way the existing "Local
  // Authorities" picker already does -- same /api/data-view/la-set endpoint,
  // buildLaComparatorSet machinery, and "multi_la" recipe key ComparatorSidebar's own
  // selectLa (that component's local equivalent of this) already uses, then the same
  // selectSet() every other named-set control in this file goes through. No new
  // scoping mechanism, per direct instruction.
  const handleLaPolygonClick = useCallback(
    async (laName: string) => {
      if (!authToken || !target) return;
      try {
        const res = await fetch(`/api/data-view/la-set?urn=${target.urn}&las=${encodeURIComponent(laName)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { set: { key: string; label: string; schools: DefaultListEntry[] } | null };
        if (body.set) {
          selectSet({ kind: "recipe", key: "multi_la", label: body.set.label, schools: body.set.schools });
        }
      } catch (e) {
        console.error("[DataViewShell] unexpected error re-scoping to LA:", e);
      }
    },
    [authToken, target],
  );

  // Map round (2026-09-12), Part 2 Stage B: clicking a REGION polygon on Nation
  // scope's own region tier re-scopes the comparator set the same way the existing
  // "Region" button already does -- same region_nation_set()/
  // buildRegionOrNationComparatorSet() machinery (region-nation-set/route.ts's own
  // new optional regionCode/regionName params), just supplying the CLICKED region
  // rather than the target's own resolved home region. Deliberately does NOT touch
  // regionOption -- that state is the target's own "[Home region] Schools" button,
  // which a click on some OTHER region shouldn't silently repoint. Landing on
  // activeSet.key "ons_region" is what then makes isRegionScope(activeSet) true,
  // which is also what hands the LA-tier choropleth fetch (below) the clicked
  // region's own code -- the click-through and the render layer converge on Stage
  // A's exact existing LA-tier view for free, no new rendering path needed for this
  // case specifically (only the zoom-driven drill-in needed new rendering).
  const handleRegionPolygonClick = useCallback(
    async (regionCode: string, regionName: string) => {
      if (!authToken || !target) return;
      try {
        const params = new URLSearchParams({ urn: target.urn, scope: "region", regionCode, regionName });
        const res = await fetch(`/api/data-view/region-nation-set?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { key?: string; label?: string; rows: RegionNationRow[] | null };
        if (!body.rows || !body.key || !body.label) return;
        const unpacked = body.rows.map(unpackRegionNationRow);
        setLargeSetPoints((prev) => {
          const next = new Map(prev);
          for (const u of unpacked) next.set(u.point.urn, u.point);
          return next;
        });
        selectSet({ kind: "recipe", key: body.key, label: body.label, schools: unpacked.map((u) => u.entry) });
      } catch (e) {
        console.error("[DataViewShell] unexpected error re-scoping to region:", e);
      }
    },
    [authToken, target],
  );

  // Map round (2026-09-12), Part 2 Stage B: MapView's own zoom-driven region-tier
  // detection reports up through this stable callback -- a plain state setter, no
  // extra logic needed here (the LA-drilldown fetch effect reacts to the state
  // change via effectiveNationZoomedRegionCode).
  const handleNationZoomedRegionChange = useCallback((regionCode: string | null) => {
    setNationZoomedRegionCode(regionCode);
  }, []);

  // Compared-with panel round (2026-09-10), item 2: switches the active Nearest-10
  // recipe (ordinary <-> boarding-quintile) the moment the shared boarding filter
  // changes, while "Nearest 10" (whichever underlying recipe) is what's currently
  // active -- see resolveNearestOption's own module-scope comment for the gate.
  // Deliberately done HERE, synchronously inside the filter-change handler itself
  // (the one real user action that can trigger a switch), rather than in a useEffect
  // watching filters/activeSet -- an effect that reads activeSet and conditionally
  // calls setActiveSet again is exactly the self-referential "derived state via
  // effect" shape react-hooks/set-state-in-effect (and, via a ref workaround,
  // react-hooks/immutability) both flag; a plain synchronous check inside the same
  // handler that already calls setFilters has no such shape, and is arguably more
  // correct anyway -- this is a direct consequence of the member's own click, not a
  // background reaction to state changing on its own.
  function handleFilterChange(next: DataViewFilterState) {
    setFilters(next);
    if (!recipeLists || !(activeSet?.kind === "recipe" && (activeSet.key === "nearest_10" || activeSet.key === "boarding_quintile" || activeSet.key === "fe_nearest_10"))) {
      return;
    }
    const nextResolved = resolveNearestOption(recipeLists.list1, recipeLists.boardingBand, recipeLists.boardingRecipe, boardingModeForFilters(next));
    if (nextResolved && nextResolved.key !== activeSet.key) {
      selectSet(nextResolved);
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

  // Compared-with panel round (2026-09-10), item 2: which recipe "Nearest 10"
  // currently means, for a genuine boarding target, given the LIVE boarding filter
  // -- see resolveNearestOption's own module-scope comment for the gate itself. Pure
  // derived state (recomputed every render from recipeLists + the current boarding
  // mode), not a fetch -- both candidate recipes were already fetched up front
  // alongside list1/list2, so switching between them needs no round trip.
  const boardingMode = boardingModeForFilters(filters);
  const resolvedNearestOption = recipeLists
    ? resolveNearestOption(recipeLists.list1, recipeLists.boardingBand, recipeLists.boardingRecipe, boardingMode)
    : null;

  // The actual switch-on-filter-change behaviour lives in handleFilterChange above
  // (a plain synchronous check inside the same handler that calls setFilters, not an
  // effect -- see that function's own comment for why). This value is what gets
  // passed to ComparatorSidebar as `nearestOption` either way: the live-resolved
  // recipe for whichever button/stepper it renders, kept in sync with activeSet by
  // handleFilterChange whenever the member is genuinely looking at "Nearest 10."

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

  // Moved here from ComparatorSidebar.tsx (see addedUrns' own comment above for why)
  // -- same dedup guard against the real roster (activeSetSchools, defined below;
  // safe to reference here since this function only runs on a later event, well
  // after activeSetSchools has been assigned for the render that defined it), just
  // sourced from lifted state now instead of a local-only copy.
  function addSchool(result: SchoolSearchResult) {
    if (activeSetSchools.some((s) => s.urn === result.urn)) return;
    setAddedUrns((prev) => [...prev, { urn: result.urn, name: result.current_name }]);
    toggleTick(result.urn);
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
  // ONE signal the Map actually renders. Compared-with panel round (2026-09-10),
  // item 2: the boarding-quintile recipe is no longer a separate lazy load (it's
  // computed up front alongside list1/list2, see default-comparator-lists.ts), so
  // its own loading copy is gone from this chain too -- Region/Nation's real lazy
  // fetch is the only one left with scope-specific wording.
  // Map round (2026-09-12), Part 2 Stage A: the choropleth's own loading state folds
  // into the same shared spinner, scoped to when Region is genuinely the active set
  // (a filter-driven refetch shows the spinner over the still-visible previous
  // polygons, same "spinner overlays the still-visible map" convention this signal
  // already establishes for every other source above).
  const mapLoading =
    profilesLoading ||
    regionNationLoadingScope !== null ||
    selectingSet ||
    (isRegionScope(activeSet) && laChoroplethLoading) ||
    (isNationScope(activeSet) && (nationRegionChoroplethLoading || nationDrilldownLoading));

  const mapLoadingLabel =
    regionNationLoadingScope !== null ? "Loading schools across this scope…" : (selectingSetLabel ?? "Loading schools…");
  // 2026-09-07, UX refinements round 2, P3 item 7: the sector filter is a
  // membership exclusion (matchesSectorFilter's own comment explains why it can't
  // be a slice the way phase/gender/boarding are) applied once, here, so
  // Dashboard/Rankings/Map can never disagree about which ticked schools the
  // active sector filter has excluded.
  // Real bug fix (2026-09-11): reads activeSetSchools (defined above, alongside the
  // profile-fetch effect that needs it too) instead of activeSet.schools directly --
  // a manually added-and-ticked school (addSchool above) was previously invisible
  // here, meaning it never appeared on Map/Dashboard/Rankings despite being ticked in
  // the sidebar's own tick-list. This was the one place every one of those views
  // reads "what's actually being compared," so the fix here fixes all of them at
  // once, not just the numbers block that surfaced it.
  const tickedProfiles =
    activeSet && !comparedHidden
      ? activeSetSchools
          .filter((s) => tickedUrns.has(s.urn))
          .map((s) => profilesByUrn.get(s.urn))
          .filter((p): p is DataViewSchoolProfile => !!p)
          .filter((p) => matchesSectorFilter(p.sector, filters.sector))
      : [];
  const filterSummary = describeFilters(filters);

  // Compared-with panel round (2026-09-10), item 3, REAL BUG FOUND live-testing
  // (2026-09-11): this used to be JUST the target's own filteredCount(), with no
  // reference to the compared set (tickedUrns/activeSet/schools) at all -- neither
  // the "+5 more" stepper nor the Add/Subtract window's tick/untick ever moved this
  // number, because nothing about set membership was ever read. Fixed to sum the
  // target's own figure with every ticked, profile-loaded school's own
  // filteredCount() (over tickedProfiles, the same array Map/Rankings already treat
  // as "what's actually being compared," now itself fixed above) -- reacts live to
  // BOTH tickedUrns changes (any control that ticks/unticks) and filter changes.
  // female/male stay summed only while every contributing school has a real split
  // (filteredCount's own null-means-no-split convention); one school without a
  // split makes the combined split honestly null too, rather than silently
  // undercounting.
  const targetFilteredCount = targetProfile ? filteredCount(profileToFilterableData(targetProfile), filters) : null;
  const compareNumbers = targetFilteredCount
    ? tickedProfiles.reduce<typeof targetFilteredCount>(
        (sum, p) => {
          const c = filteredCount(profileToFilterableData(p), filters);
          return {
            total: sum.total + c.total,
            female: sum.female !== null && c.female !== null ? sum.female + c.female : null,
            male: sum.male !== null && c.male !== null ? sum.male + c.male : null,
            basis: sum.basis,
          };
        },
        targetFilteredCount,
      )
    : null;
  // Schools in set: real, PROFILE-LOADED ticked schools (tickedProfiles, complete now
  // that activeSetSchools includes manually-added ones) plus the target itself --
  // same totalWithFocus convention this file/ComparatorSidebar already uses
  // elsewhere. A Region/Nation-scale set can have more schools ticked than have a
  // full profile loaded yet (LARGE_SET_PROFILE_THRESHOLD's own gate, the profile-
  // fetch effect above) -- tracked separately so the sidebar can note the gap
  // honestly rather than silently showing a smaller number with no indication why.
  const compareSchoolCount = tickedProfiles.length + 1;
  const compareSchoolsNotLoaded =
    activeSet && !comparedHidden ? Array.from(tickedUrns).filter((u) => !profilesByUrn.has(u)).length : 0;
  const compareSentence = targetProfile ? describeActiveViewSentence(filters, activeSet, targetProfile) : null;

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
      // Real bug fix (2026-09-11): activeSetSchools (not activeSet.schools) so a
      // manually added school's own sector makes its filter pill available too --
      // consistent with this comment's own "whole active set" intent above.
      [targetProfile?.sector, ...activeSetSchools.map((s) => profilesByUrn.get(s.urn)?.sector)].filter((s): s is NonNullable<typeof s> => !!s),
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
          onChange={handleFilterChange}
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
            nearestOption={resolvedNearestOption}
            homeLaOption={recipeLists?.list2 ?? null}
            regionOption={regionOption}
            nationOption={nationOption}
            savedSets={savedSets}
            activeSet={activeSet}
            onSelectSet={(opt) => {
              // Compared-with panel round (2026-09-10), item 2: the boarding-quintile
              // recipe is no longer a separate lazy placeholder (it's resolved
              // eagerly into resolvedNearestOption above, never lazy/empty) -- only
              // Region/Nation still genuinely fetch lazily on first click. Same
              // "snapshot activeSetSeq before the async load, only apply if still
              // current" guard as before, just narrowed to the one real remaining
              // async path.
              if (opt.kind === "recipe" && opt.lazy && opt.schools.length === 0) {
                const mySeq = activeSetSeq.current;
                const loader = opt.key === "ons_region" ? () => loadRegionOrNationSet("region") : () => loadRegionOrNationSet("nation");
                loader().then((loaded) => {
                  if (loaded && mySeq === activeSetSeq.current) selectSet(loaded);
                });
                return;
              }
              selectSet(opt);
            }}
            regionNationLoadingScope={regionNationLoadingScope}
            onLoadingChange={handleLoadingChange}
            tickedUrns={tickedUrns}
            onToggleTick={toggleTick}
            onSelectAllTicked={selectAllTicked}
            onUnselectAllTicked={unselectAllTicked}
            comparedHidden={comparedHidden}
            onToggleComparedHidden={() => setComparedHidden((h) => !h)}
            compareNumbers={compareNumbers}
            compareSchoolCount={compareSchoolCount}
            compareSchoolsNotLoaded={compareSchoolsNotLoaded}
            compareSentence={compareSentence}
            profilesByUrn={profilesByUrn}
            addedUrns={addedUrns}
            onAddSchool={addSchool}
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
                    // Real bug fix (2026-09-11): this used to read activeSet.schools
                    // directly, which never included a school added via the
                    // Add/Subtract window's search-add path -- see activeSetSchools'
                    // own comment above for why. Using the merged list here means a
                    // manually added-and-ticked school actually draws on the map now,
                    // not just tick-listed in the sidebar.
                    members={activeSetSchools}
                    tickedUrns={tickedUrns}
                    comparedHidden={comparedHidden}
                    onToggleTick={toggleTick}
                    profilesByUrn={profilesByUrn}
                    largeSetPoints={largeSetPoints}
                    loading={mapLoading}
                    loadingLabel={mapLoadingLabel}
                    // Map round (2026-09-12), Part 2 Stage A: only a genuinely
                    // Region-scope active set gets real choropleth data -- every other
                    // recipe gets null here and MapView's existing dot-cluster
                    // rendering stays completely unchanged.
                    laChoropleth={isRegionScope(activeSet) ? (laChoropleth?.data ?? null) : null}
                    onLaPolygonClick={handleLaPolygonClick}
                    // Map round (2026-09-12), Part 2 Stage B: only Nation scope for an
                    // English target ever gets real region-tier data -- a Welsh target
                    // goes straight to nationDrilldownLaChoropleth below instead
                    // (that fetch effect's own comment explains why).
                    nationRegionChoropleth={isNationScope(activeSet) && targetNation === "england" ? (nationRegionChoropleth?.data ?? null) : null}
                    // Gated on effectiveNationZoomedRegionCode !== null (not just
                    // isNationScope) -- zooming back out to null must immediately
                    // revert to the region-tier view above, not keep showing a
                    // previously-zoomed region's stale LA data.
                    nationDrilldownLaChoropleth={effectiveNationZoomedRegionCode !== null ? (nationDrilldownLaChoropleth?.data ?? null) : null}
                    onNationZoomedRegionChange={handleNationZoomedRegionChange}
                    onRegionPolygonClick={handleRegionPolygonClick}
                    isRegionOrNationScope={isRegionScope(activeSet) || isNationScope(activeSet)}
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
