"use client";

// Academic Results Data View tab (frontend build brief, Part B). Sibling to
// DataViewShell's own existing Rolls-specific Map/Graphs/Rankings tree, not a
// modification of it -- MapView/GraphsView/RankingsView/DataViewSchoolProfile are all
// written against Rolls' own fields end to end (confirmed directly before writing any
// of this), so this is a parallel set of view components consuming a new
// AcademicSchoolProfile shape instead, per the brief's own "flag anything more
// Rolls-specific than expected rather than silently forking it" instruction.
//
// Reuses from DataViewShell: the comparator-set SELECTION state (tickedUrns/addedUrns/
// activeSetLabel -- just URNs and a label, genuinely topic-agnostic) and the shared
// ViewSwitcher/PdfExportButton chrome. Does NOT reuse profilesByUrn/ComparatorSidebar's
// own "compared with" roll-figures panel -- those stay Rolls-shaped and keep showing
// roll numbers even while this tab is active (a deliberate, flagged scope decision --
// building an academic-equivalent sidebar panel duplicates non-trivial existing logic
// for low value this round; the SELECTION UI, not the figures display, is what's
// genuinely shared).
//
// Round 1 built headline level only. Round 2 adds: Part A (a includePopulation flag
// so the free card's fetch skips the census round-trip it never used -- see
// academic-data-view.ts), Part B (family-level Map/Graphs via the Category filter
// below), Part C (a subject-level table inside Graphs' Overview, entries + KS5
// value-added only -- see AcademicGraphsView's own comment for why average grade/
// point score and a subject-level Map aren't built). Subject data is fetched
// separately from the main profile batch, for the target school alone (see
// /api/data-view/academic-subject) -- the subject table is a single-school view, not
// a ticked-set comparison, so there's no reason to pull it for every ticked school.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ViewKey } from "@/lib/data-view-types";
import {
  stagesPresent,
  availableFamilies,
  deserializeAcademicProfile,
  igcseExclusionLikely,
  ks5HasCohortEntries,
  KS5_COHORT_OPTIONS,
  type AcademicSchoolProfile,
  type WireAcademicSchoolProfile,
  type KsStage,
  type Ks5Cohort,
  type SubjectEntry,
  type SubjectValueAdded,
  STAGE_LABEL,
} from "@/lib/academic-data-view";
// Region/Nation comparator round 2: type-only imports from server-only lib files --
// erased at compile time, same safe pattern round 1's own AcademicGeographyChoroplethEntry
// import already established for this component (see that round's build report). The
// actual fetches below go through the usual /api/data-view/* routes, matching every
// other fetch this component already does (academic-schools/academic-subject/
// academic-comparator-widen) -- never a direct call into a server-only lib function
// from client code.
import type { AcademicRegionNationRankMetric } from "@/lib/academic-region-nation-rank";
import type { AcademicAggregateTrends } from "@/lib/academic-aggregate-trends";
import ViewSwitcher from "./ViewSwitcher";
import PdfExportButton from "./PdfExportButton";
import LoadingSpinnerCard from "./LoadingSpinnerCard";
import DataViewErrorBoundary from "./DataViewErrorBoundary";
import AcademicMapView from "./AcademicMapView";
import AcademicGraphsView from "./AcademicGraphsView";
import AcademicRankingsView from "./AcademicRankingsView";
import CategoryFilter from "./CategoryFilter";

function KsStageSwitcher({ stages, active, onChange }: { stages: KsStage[]; active: KsStage; onChange: (s: KsStage) => void }) {
  if (stages.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 p-1 text-sm dark:border-neutral-800">
      {stages.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={
            active === s
              ? "rounded px-3 py-1 font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }
        >
          {STAGE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

// KS5 qualification-type-awareness round, Part 4: an explicit, user-changeable
// qualification-type control for group-comparison views at KS5 (Rankings, Overview's
// spread/growth/trend sections, Map) -- deliberately visually distinct from
// CategoryFilter above (a different real concept: WHICH qualification type is being
// compared, not which subject family) even though it reuses the same pill shape.
// Defaults to the target school's own real dominant cohort on first load (so opening
// Capital City College's Rankings shows its real Applied General ranking by default,
// not a jarring near-empty A-level one) but is a real, changeable control from there.
// Stage 2 UX review, item 10: `active` is now nullable -- null is the real default
// state (nothing explicitly clicked, every school shown on its own real dominant
// cohort), not "not yet resolved." No pill shows as active in that state, which is
// deliberate: there IS no single shared measure to highlight yet.
function Ks5CohortSwitcher({ active, onChange }: { active: Ks5Cohort | null; onChange: (c: Ks5Cohort) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Qualification type</span>
      {KS5_COHORT_OPTIONS.map((opt) => (
        <button
          key={opt.cohort}
          type="button"
          aria-pressed={active === opt.cohort}
          title={opt.description}
          onClick={() => onChange(opt.cohort)}
          className={
            active === opt.cohort
              ? "inline-flex items-center gap-1 rounded-full border border-blue-900 bg-blue-900 px-3 py-1 text-xs font-medium text-white dark:border-blue-100 dark:bg-blue-100 dark:text-blue-900"
              : "inline-flex items-center gap-1 rounded-full border border-blue-300 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
          }
        >
          {opt.pillLabel}
        </button>
      ))}
    </div>
  );
}

export default function AcademicDataView({
  urn,
  authToken,
  tickedUrns,
  addedUrns,
  activeSetLabel,
  startPeriod,
  activeView,
  onChangeView,
  isActiveTopic,
  stageSwitcherSlot,
  onHasAnyData,
  isLargeSet,
  regionNationScopeKey,
  isRegionOrNationScope,
}: {
  urn: string;
  authToken: string | null;
  tickedUrns: Set<string>;
  addedUrns: { urn: string; name: string }[];
  activeSetLabel: string | null;
  startPeriod: number;
  activeView: ViewKey;
  onChangeView: (v: ViewKey) => void;
  // Stage 2 UX review, items 2-3: this component is now always mounted (see
  // DataViewShell's own comment on its render call) so it can fetch eagerly and
  // report real facts up regardless of which topic is currently showing.
  // isActiveTopic gates the HEAVY view tree (Map/Graphs/Rankings) so a hidden,
  // inactive Academic tab never mounts a second live Leaflet instance alongside
  // Rolls' own MapView -- the fetch/portal/tab-gating logic below stays active
  // either way.
  isActiveTopic: boolean;
  stageSwitcherSlot: HTMLDivElement | null;
  onHasAnyData: (has: boolean) => void;
  // Region/Nation comparator round 2: all three values below are computed ONCE in
  // DataViewShell.tsx off the shared `activeSet` (topic-agnostic) and passed straight
  // through, the same values Rolls' own MapView/GraphsView/RankingsView already
  // receive -- not re-derived here. isLargeSet gates the per-ticked-URN profile fetch
  // below (confirmed a real no-op change is needed there -- see this round's own
  // build report); regionNationScopeKey ("region"|"nation"|null) drives the new
  // academic-region-nation-rank fetch; isRegionOrNationScope is threaded straight
  // through to AcademicMapView for the same auto-choropleth trigger Rolls' own
  // MapView already has.
  isLargeSet: boolean;
  regionNationScopeKey: "region" | "nation" | null;
  isRegionOrNationScope: boolean;
}) {
  // Item 11: real schools/colleges found to widen the KS5 comparator set past
  // whatever's ticked, when too few of them have real data for the current view
  // (default: any real KS5 data; a cohort explicitly selected: real entries for
  // THAT cohort). Folded into urnsKey below so the existing profile-fetch effect
  // picks them up for free -- no second fetch mechanism needed.
  const [ks5WidenedUrns, setKs5WidenedUrns] = useState<string[]>([]);

  // Region/Nation comparator round 2, real design call confirmed rather than assumed:
  // this per-ticked-URN profile fetch already needs NO large-set bypass of its own.
  // Unlike Rolls' own profile-fetch effect in DataViewShell.tsx (which reads
  // activeSet.schools -- the WHOLE active set, capped by LARGE_SET_PROFILE_THRESHOLD),
  // this component was never given activeSet.schools at all (this file's own header
  // comment: "Does NOT reuse profilesByUrn... those stay Rolls-shaped") -- urnsKey below
  // is built only from urn/tickedUrns/addedUrns/ks5WidenedUrns, every one of which is
  // already inherently bounded (tickedUrns is reset to empty whenever a large set is
  // selected -- DataViewShell's own setTickedUrns call; addedUrns is a manual, one-at-
  // a-time search-add; ks5WidenedUrns caps at `needed = 10 - qualifying`). So a 24,000-
  // school Nation-scale set selected while viewing Academic can never inflate this
  // fetch -- confirmed structurally, not just by inspection: there is no code path here
  // that could read the full activeSet.schools list even if it wanted to.
  const urnsKey = useMemo(() => {
    const all = new Set<string>([urn, ...tickedUrns, ...addedUrns.map((a) => a.urn), ...ks5WidenedUrns]);
    return Array.from(all).sort().join(",");
  }, [urn, tickedUrns, addedUrns, ks5WidenedUrns]);

  const [profilesByUrn, setProfilesByUrn] = useState<Map<string, AcademicSchoolProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<KsStage | null>(null);
  // Round 2, Part B: which subject family (if any) is drilled into. Reset whenever
  // the key stage itself changes -- family_id values are shared across ks4/ks5 (the
  // same 8 families), but a family selected under one stage carrying silently over to
  // a stage switch reads as confusing state, not a helpful default.
  const [familyId, setFamilyId] = useState<string | null>(null);
  // Item 10: null is the real default (per-school own-cohort mode, no forced
  // "target's dominant cohort" default any more) -- see Ks5CohortSwitcher's own
  // comment. Reset on every stage change for the same reason familyId is.
  const [ks5Cohort, setKs5Cohort] = useState<Ks5Cohort | null>(null);
  function changeStage(next: KsStage) {
    setStage(next);
    setFamilyId(null);
    setKs5WidenedUrns([]);
    setKs5Cohort(null);
  }

  useEffect(() => {
    if (!authToken || urnsKey.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/data-view/academic-schools?anchorUrn=${urn}&urns=${encodeURIComponent(urnsKey)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setError("Couldn't load academic data for this school.");
          return;
        }
        const body = (await res.json()) as { profiles: WireAcademicSchoolProfile[] };
        const profiles = body.profiles.map(deserializeAcademicProfile);
        setProfilesByUrn(new Map(profiles.map((p) => [p.urn, p])));
      } catch {
        if (!cancelled) setError("Couldn't load academic data for this school.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urn, urnsKey, authToken]);

  const targetProfile = profilesByUrn.get(urn) ?? null;
  // Item 3: real stagesPresent, unfiltered -- reported up so TopicTabs can grey out
  // the whole "Academic" tab for a target with no real data at all. Deliberately the
  // RAW check (not the ks4-exclusion-filtered list below), a separate concern from
  // item 4's own narrower "hide just the GCSE button" gate.
  const availableStages = targetProfile ? stagesPresent(targetProfile) : [];
  useEffect(() => {
    if (!loading) onHasAnyData(availableStages.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, availableStages.length]);

  // Item 4: a target for which igcseExclusionLikely is true gets no GCSE button at
  // all (not the button-plus-caveat-sentence pattern this morning's GCSE exclusion
  // round built for a ticked comparator school) -- that round's own caveat sentence,
  // used on Rankings/Graphs/Map for a TICKED school, is unaffected; this is
  // specifically about the TARGET's own top-level stage button.
  const ks4Excluded = targetProfile ? igcseExclusionLikely(targetProfile) : false;
  const filteredStages = availableStages.filter((s) => !(s === "ks4" && ks4Excluded));
  // Item 5: oldest age group first (ks5 -> ks4 -> ks2) -- "not many schools actually
  // have more than 2 of these," so this mostly matters for all-through schools with
  // a genuine sixth form, which should now open on Post-16 rather than GCSE.
  const effectiveStage: KsStage | null =
    stage && filteredStages.includes(stage)
      ? stage
      : filteredStages.includes("ks5")
        ? "ks5"
        : filteredStages.includes("ks4")
          ? "ks4"
          : (filteredStages[0] ?? null);

  const tickedProfiles = Array.from(tickedUrns)
    .map((u) => profilesByUrn.get(u))
    .filter((p): p is AcademicSchoolProfile => !!p);

  // Item 11: real schools found to widen the KS5 comparator set (see the effect
  // below) -- appended to the ticked group passed down to Graphs/Rankings/Map,
  // WITHOUT touching the shared tickedUrns state itself (so Rolls' own view, which
  // reuses that same selection state, is never affected by an Academic-only
  // widening decision). Empty outside ks5, since widening only ever runs there.
  const ks5WidenedProfiles = ks5WidenedUrns.map((u) => profilesByUrn.get(u)).filter((p): p is AcademicSchoolProfile => !!p);
  const academicGroupProfiles = [...tickedProfiles, ...ks5WidenedProfiles];

  // Union across target + ticked, per stage -- KS2 always yields [] (no family
  // taxonomy at all), so the Category row simply never renders for it.
  const families = effectiveStage ? availableFamilies([targetProfile, ...academicGroupProfiles].filter((p): p is AcademicSchoolProfile => !!p), effectiveStage) : [];

  // GCSE exclusion round, Part 2: computed once here (this component already has
  // target + ticked together) and threaded down to Graphs/Rankings/Map alongside the
  // props they already receive, rather than each view recomputing it separately.
  // Only populated at KS4 -- igcseExclusionLikely itself reads ks4 data regardless of
  // the active stage, so gating here (not inside the function) keeps KS2/KS5 views
  // completely unaffected, per the brief's own "KS4-only exclusion" scope.
  const ks4ExcludedUrns = new Set<string>();
  if (effectiveStage === "ks4") {
    const seen = new Set<string>();
    for (const p of [targetProfile, ...academicGroupProfiles]) {
      if (!p || seen.has(p.urn)) continue;
      seen.add(p.urn);
      if (igcseExclusionLikely(p)) ks4ExcludedUrns.add(p.urn);
    }
  }

  // Item 10: NO forced default any more -- ks5Cohort stays exactly what the user
  // has (or hasn't) explicitly clicked. null means "every school on its own real
  // dominant cohort," a genuinely different default from item 11's own scope
  // below. Only a SPECIFIC selection produces an exclusion set at all: per item
  // 11's own explicit instruction, the default (per-school) state does no
  // qualification-type matching -- a mixed set is correct and expected there,
  // since the comparator-widening effect below already guarantees ~10 real
  // KS5-having schools regardless of which cohort each one is shown on.
  const ks5ExcludedUrns = new Set<string>();
  if (effectiveStage === "ks5" && ks5Cohort !== null) {
    const seen = new Set<string>();
    for (const p of [targetProfile, ...academicGroupProfiles]) {
      if (!p || seen.has(p.urn)) continue;
      seen.add(p.urn);
      if (!ks5HasCohortEntries(p, ks5Cohort)) ks5ExcludedUrns.add(p.urn);
    }
  }

  // Item 11: "comparator set must always be 10 real schools" for the KS5 view --
  // reuses surrounding-schools.ts's own findSurroundingSchools() engine via the new
  // /api/data-view/academic-comparator-widen route (see that route's own comment),
  // rather than inventing new selection logic. Default state (ks5Cohort === null):
  // the extra filter is just "has any real KS5 data at all." A specific cohort
  // selected: narrows to "has real entries for THIS cohort" -- e.g. selecting IB on
  // Sevenoaks brings in the nearest 10 real IB schools nationally if fewer are
  // geographically close, not just the nearest 10 by plain distance filtered down.
  // Deliberately NOT extended to KS4's own IGCSE exclusion (a real, separate,
  // unresolved design question for Guy -- see this round's own report).
  useEffect(() => {
    let cancelled = false;
    // Real fix, react-hooks/set-state-in-effect: every setKs5WidenedUrns call below
    // (including the two early "reset to empty" cases) lives inside this one async
    // callback rather than directly in the effect body, matching React's own guidance
    // to call setState from a callback rather than synchronously during the effect.
    (async () => {
      if (effectiveStage !== "ks5" || !targetProfile || !authToken) {
        setKs5WidenedUrns((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const baseGroup = [targetProfile, ...tickedProfiles];
      const qualifying = baseGroup.filter((p) => (ks5Cohort ? ks5HasCohortEntries(p, ks5Cohort) : stagesPresent(p).includes("ks5"))).length;
      const needed = 10 - qualifying;
      if (needed <= 0) {
        setKs5WidenedUrns((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const excludeAll = new Set([urn, ...tickedUrns, ...addedUrns.map((a) => a.urn)]);
      const params = new URLSearchParams({ anchorUrn: urn, count: String(needed), excludeUrns: Array.from(excludeAll).join(",") });
      if (ks5Cohort) params.set("cohort", ks5Cohort);
      try {
        const res = await fetch(`/api/data-view/academic-comparator-widen?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { urns: string[] };
        const sortedNew = [...body.urns].sort().join(",");
        // No-op guard: `targetProfile`'s own object identity changes on every real
        // fetch, which would otherwise re-fire this effect and re-request the same
        // real result forever (a genuine, if bounded, re-render loop) -- only
        // actually update state when the real content differs.
        setKs5WidenedUrns((prev) => (prev.slice().sort().join(",") === sortedNew ? prev : body.urns));
      } catch {
        // Non-fatal -- the comparator set just stays as-is, same discipline as the
        // subject-level fetch below.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStage, targetProfile, tickedUrns, addedUrns, ks5Cohort, authToken, urn]);

  // Round 2, Part C: subject-level data for the TARGET school only (see this file's
  // own header comment for why), refetched whenever the stage changes (ks4/ks5 are
  // genuinely different sources) -- not gated on familyId, since AcademicGraphsView
  // needs the real subject list to populate its own picker before a subject is chosen.
  // Which SUBJECT is picked is AcademicGraphsView's own local state, not lifted here --
  // that component already remounts on stage/family change (its parent
  // DataViewErrorBoundary key includes both), so its local subject selection resets
  // for free on either change, no explicit reset effect needed.
  const [subjectData, setSubjectData] = useState<{ entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Stage 2 UX review, items 2-3: this component is now always mounted, so this
      // heavier per-subject fetch is gated on isActiveTopic too -- no reason to pull
      // subject-level data for a topic the member isn't even looking at yet.
      if (!authToken || !effectiveStage || effectiveStage === "ks2" || !isActiveTopic) {
        if (!cancelled) setSubjectData(null);
        return;
      }
      try {
        const res = await fetch(`/api/data-view/academic-subject?anchorUrn=${urn}&stage=${effectiveStage}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] };
        setSubjectData(body);
      } catch {
        // Non-fatal -- the subject table just doesn't appear; headline/family levels
        // above are unaffected.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urn, effectiveStage, authToken, isActiveTopic]);

  // Region/Nation comparator round 2, Rankings: fetches academic_region_nation_rank()
  // whenever the active set is a real Region/Nation-scale recipe AND the current stage
  // has real geography data (ks4/ks5 only -- academic_headline_snapshot itself has no
  // KS2 rows, same real constraint round 1's choropleth already hit). Keyed-cache
  // discipline, same real reason DataViewShell's own largeSetRank effect already
  // documents (react-hooks/set-state-in-effect: avoid a synchronous setState in an
  // effect's bail-out branch; a stored result whose key doesn't match the current
  // render is just treated as stale/absent at render time instead).
  const [academicLargeSetRank, setAcademicLargeSetRank] = useState<{ key: string; data: AcademicRegionNationRankMetric; regionName: string | null } | null>(
    null,
  );
  const [academicLargeSetRankLoading, setAcademicLargeSetRankLoading] = useState(false);
  const academicLargeSetRankRequestKey =
    regionNationScopeKey && effectiveStage && effectiveStage !== "ks2" ? `${urn}|${regionNationScopeKey}|${effectiveStage}` : null;
  useEffect(() => {
    if (!authToken || !academicLargeSetRankRequestKey || !effectiveStage || effectiveStage === "ks2" || !regionNationScopeKey) return;
    const requestKey = academicLargeSetRankRequestKey;
    let cancelled = false;
    (async () => {
      setAcademicLargeSetRankLoading(true);
      try {
        const params = new URLSearchParams({ urn, scope: regionNationScopeKey, ksStage: effectiveStage });
        const res = await fetch(`/api/data-view/academic-region-nation-rank?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[AcademicDataView] academic-region-nation-rank fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { rank: AcademicRegionNationRankMetric | null; regionName: string | null };
        if (cancelled || !body.rank) return;
        // Real bug found live (Guy, 2026-09-14): regionName rides along with the same
        // fetch (the route already resolves it for the ranking's own scope object) --
        // AcademicMapView needs it to default its choropleth straight to the active
        // region's own LAs instead of the national overview.
        setAcademicLargeSetRank({ key: requestKey, data: body.rank, regionName: body.regionName ?? null });
      } catch (e) {
        if (!cancelled) console.error("[AcademicDataView] unexpected error fetching academic region/nation ranking:", e);
      } finally {
        if (!cancelled) setAcademicLargeSetRankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, urn, regionNationScopeKey, effectiveStage, academicLargeSetRankRequestKey]);
  const resolvedAcademicLargeSetRank = academicLargeSetRank?.key === academicLargeSetRankRequestKey ? academicLargeSetRank.data : null;
  const resolvedActiveRegionName = academicLargeSetRank?.key === academicLargeSetRankRequestKey ? academicLargeSetRank.regionName : null;

  // Region/Nation comparator round 2, Graphs: real prior art (aggregate-trends.ts)
  // reused directly -- see academic-aggregate-trends.ts's own header comment for the
  // real source (academic_geography_aggregate, no new precompute). Gated on isLargeSet
  // alone (not the ranking's own narrower regionNationScopeKey), same reasoning
  // DataViewShell's own aggregateTrends effect already documents: this doesn't need a
  // real region/nation SCOPE to compute against, only the target's own real region
  // membership, which is real regardless of which recipe happens to be active.
  const [academicAggregateTrends, setAcademicAggregateTrends] = useState<{ key: string; data: AcademicAggregateTrends } | null>(null);
  const academicAggregateTrendsRequestKey = effectiveStage && effectiveStage !== "ks2" ? `${urn}|${effectiveStage}|${startPeriod}` : null;
  useEffect(() => {
    if (!authToken || !isLargeSet || !academicAggregateTrendsRequestKey || !effectiveStage || effectiveStage === "ks2") return;
    const requestKey = academicAggregateTrendsRequestKey;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ urn, ksStage: effectiveStage, startPeriod: String(startPeriod) });
        const res = await fetch(`/api/data-view/academic-aggregate-trends?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error("[AcademicDataView] academic-aggregate-trends fetch failed:", res.status, await res.text().catch(() => ""));
          return;
        }
        const body = (await res.json()) as { trends: AcademicAggregateTrends };
        if (cancelled) return;
        setAcademicAggregateTrends({ key: requestKey, data: body.trends });
      } catch (e) {
        if (!cancelled) console.error("[AcademicDataView] unexpected error fetching academic aggregate trends:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, isLargeSet, urn, effectiveStage, startPeriod, academicAggregateTrendsRequestKey]);
  const resolvedAcademicAggregateTrends = academicAggregateTrends?.key === academicAggregateTrendsRequestKey ? academicAggregateTrends.data : null;

  return (
    <div hidden={!isActiveTopic} className="flex min-w-0 flex-1 flex-col">
      {/* Item 2: portalled into TopicTabs' own row (DataViewShell), not rendered
          in-flow here -- see that component's own comment. Guarded on
          effectiveStage !== null since KsStageSwitcher's own `active` prop isn't
          nullable; an empty/1-stage filteredStages already makes it render null
          internally either way. */}
      {stageSwitcherSlot && effectiveStage && createPortal(<KsStageSwitcher stages={filteredStages} active={effectiveStage} onChange={changeStage} />, stageSwitcherSlot)}

      {/* Item 6: the in-flow ViewSwitcher/PdfExportButton row is skipped for Map,
          matching Rolls' own MapView.tsx pattern exactly -- AcademicMapView renders
          its own overlay copies instead (see that component). Item 8: CategoryFilter
          also moves out of this row for Map (rendered below the map div instead),
          so this whole header row has nothing left to show for Map unless the
          Ks5CohortSwitcher is also present -- gated to avoid a stray empty bordered
          strip when neither applies. */}
      {effectiveStage && (activeView !== "map" || effectiveStage === "ks5") && (
        <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-900">
          {activeView !== "map" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ViewSwitcher active={activeView} onChange={onChangeView} />
              <PdfExportButton />
            </div>
          )}
          {/* Graphs edit 2: CategoryFilter no longer renders here for Graphs -- moved
              into AcademicGraphsView.tsx's own Section 3, where the picker and the
              content it drives are genuinely in the same place (Guy's own live
              question, "this change was missed -- why?", after round 3's Graphs
              restructure moved the CONTENT but never the picker that sets familyId).
              Rankings never received it at all (a deliberate round-2 scope cut --
              subject-family metrics don't get their own Rankings entry). Map keeps
              its own copy, rendered below the map div instead (see the return's own
              bottom, item 8). ViewSwitcher/PdfExportButton above still render for
              Graphs/Rankings regardless, so this row is never actually empty for
              them -- only Map's own version of this row can end up with nothing to
              show (its own gate, above, already accounts for that). */}
          {/* KS5 qualification-type-awareness round, Part 4: unlike CategoryFilter,
              this genuinely applies to every view at KS5 (Rankings included) -- it's
              about which real cohort is being compared, not a subject-family drill-
              down -- so it isn't hidden on Rankings. Deliberately its own row/colour
              (blue vs. CategoryFilter's neutral pills) so it doesn't read as the same
              control by a different name. */}
          {effectiveStage === "ks5" && <Ks5CohortSwitcher active={ks5Cohort} onChange={setKs5Cohort} />}
        </div>
      )}

      <div className={activeView === "map" ? "relative min-h-[480px] flex-1 sm:min-h-[560px]" : "flex-1 p-4 sm:p-6"}>
        {error ? (
          <p className="py-12 text-center text-sm text-neutral-500">{error}</p>
        ) : loading && profilesByUrn.size === 0 ? (
          activeView === "map" ? <LoadingSpinnerCard label="Loading schools…" /> : <p className="py-12 text-center text-sm text-neutral-500">Loading school data…</p>
        ) : !targetProfile ? (
          <p className="py-12 text-center text-sm text-neutral-500">No real data available for this school yet.</p>
        ) : !effectiveStage ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No real KS2/GCSE/A-level academic results are available for this school yet.
          </p>
        ) : !isActiveTopic ? null : ( // items 2-3: data/portal logic above stays live even while hidden; the heavy view tree itself does not.
          <DataViewErrorBoundary key={`${activeView}-${effectiveStage}-${familyId ?? "whole"}`}>
            {activeView === "map" ? (
              <AcademicMapView
                targetProfile={targetProfile}
                tickedProfiles={academicGroupProfiles}
                stage={effectiveStage}
                familyId={familyId}
                familyLabel={families.find((f) => f.familyId === familyId)?.familyLabel ?? null}
                activeSetLabel={activeSetLabel}
                ks4ExcludedUrns={ks4ExcludedUrns}
                ks5Cohort={ks5Cohort}
                ks5ExcludedUrns={ks5ExcludedUrns}
                activeView={activeView}
                onChangeView={onChangeView}
                authToken={authToken}
                isRegionOrNationScope={isRegionOrNationScope}
                activeRegionName={resolvedActiveRegionName}
              />
            ) : activeView === "graphs" ? (
              <AcademicGraphsView
                targetProfile={targetProfile}
                tickedProfiles={academicGroupProfiles}
                stage={effectiveStage}
                startPeriod={startPeriod}
                activeSetLabel={activeSetLabel}
                familyId={familyId}
                familyLabel={families.find((f) => f.familyId === familyId)?.familyLabel ?? null}
                families={families}
                onFamilyChange={setFamilyId}
                subjectData={subjectData}
                ks4ExcludedUrns={ks4ExcludedUrns}
                ks5Cohort={ks5Cohort}
                ks5ExcludedUrns={ks5ExcludedUrns}
                isLargeSet={isLargeSet}
                aggregateTrends={resolvedAcademicAggregateTrends}
              />
            ) : (
              <AcademicRankingsView
                targetProfile={targetProfile}
                tickedProfiles={academicGroupProfiles}
                stage={effectiveStage}
                startPeriod={startPeriod}
                activeSetLabel={activeSetLabel}
                ks4ExcludedUrns={ks4ExcludedUrns}
                ks5Cohort={ks5Cohort}
                ks5ExcludedUrns={ks5ExcludedUrns}
                largeSetRank={resolvedAcademicLargeSetRank}
                largeSetRankLoading={academicLargeSetRankLoading}
                largeSetLabel={activeSetLabel}
              />
            )}
          </DataViewErrorBoundary>
        )}
      </div>
      {/* Item 8: Category filter moves BELOW the map for Map specifically. Graphs
          now renders its own copy inside Section 3 (Graphs edit 2); Rankings never
          gets one (deliberate round-2 scope cut). Only rendered once the heavy tree
          itself is (isActiveTopic), same reasoning as the map/graphs/rankings
          switch above. */}
      {isActiveTopic && activeView === "map" && effectiveStage && (
        <div className="border-t border-neutral-100 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-900">
          <CategoryFilter families={families} activeFamilyId={familyId} onChange={setFamilyId} />
        </div>
      )}
    </div>
  );
}
