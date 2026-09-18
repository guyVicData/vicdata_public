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
import type { ViewKey } from "@/lib/data-view-types";
import {
  stagesPresent,
  availableFamilies,
  deserializeAcademicProfile,
  igcseExclusionLikely,
  ks5HasBucketEntries,
  KS5_BUCKET_OPTIONS,
  KS5_BUCKETS,
  KS5_BTEC_OCR_PARTIAL_POINTS_NOTE,
  KS5_OTHER_NO_FIGURE_NOTE,
  ks5BucketHasPointsFigure,
  type AcademicSchoolProfile,
  type WireAcademicSchoolProfile,
  type KsStage,
  type Ks5Bucket,
  type SubjectEntry,
  type SubjectValueAdded,
  type SubjectLevelSchoolData,
  type AcademicSubjectHeadlineEntry,
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

const CONTROL_LABEL = "text-xs font-semibold uppercase tracking-wide text-neutral-500";

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
// The TYPE control. These pills are the real-world comparability buckets (A-level /
// IB / BTec, OCR, VRQ / Other), which REPLACED DfE's own five pre-blended cohort pills
// (A level / Academic / Applied general / Tech level / Technical certificate).
//
// Why the replacement: DfE's categories describe DfE's reporting, not a school's own
// offer. "Academic" silently blends A-level with IB, so there was no way to see IB on
// its own; Cambridge Technicals split across "Applied general" and "Tech level" by
// subject area, so no single pill matched a school's BTEC/OCR provision; and "Tech
// level" is DfE's own 2013 category, routinely misread as the T Level qualification.
//
// The cost of replacing them is that DfE publishes a headline points figure for only
// one of the four buckets (A-level). The other figures are computed from DfE's OWN
// per-qualification challenge tables at subject grain -- never UCAS Tariff, which
// DfE's own guide explicitly forbids comparing its points to. A-level itself still
// uses DfE's own published number, completely unchanged. "Other" deliberately gets no
// figure at all. See src/lib/dfe-qualification-buckets.ts for the tables, the
// verification against DfE's published figures, and the reasoning.
//
// Stage 2 UX review, item 10 still holds: `active` is nullable, and null is the real
// default state (nothing explicitly clicked, every school shown on its own dominant
// bucket), not "not yet resolved." No pill shows as active in that state, which is
// deliberate: there IS no single shared measure to highlight yet.
const PILL_ON =
  "inline-flex items-center gap-1 rounded-full border border-blue-900 bg-blue-900 whitespace-nowrap px-3 py-1 text-xs font-medium text-white dark:border-blue-100 dark:bg-blue-100 dark:text-blue-900";
const PILL_OFF =
  "inline-flex items-center gap-1 rounded-full border border-blue-300 whitespace-nowrap px-3 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950";

function Ks5TypeSwitcher({
  active,
  onChange,
  availableBuckets,
}: {
  active: Ks5Bucket | null;
  onChange: (b: Ks5Bucket | null) => void;
  // Only the buckets this school has real entries for. A pill for a qualification type
  // a school does not offer is not a filter, it is a dead end that empties the page.
  availableBuckets: Ks5Bucket[];
}) {
  const options = KS5_BUCKET_OPTIONS.filter((opt) => availableBuckets.includes(opt.bucket));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* "TYPE" rather than "Qualification type": this sits to the right of the stage
          buttons under a shared "QUALIFICATION" label, so the two read together as
          "QUALIFICATION ... TYPE ...". */}
      <span className={`mr-1 ${CONTROL_LABEL}`}>Type</span>
      {/* The way back to the real default. null is not "nothing selected yet", it is a
          genuine state with its own meaning -- every school measured on its own
          dominant qualification type rather than one shared axis -- so it needs a
          control, not just an initial value nobody can return to. Always rendered,
          regardless of the availability filter below. */}
      <button
        type="button"
        aria-pressed={active === null}
        title="Every qualification type together: each school on its own dominant type."
        onClick={() => onChange(null)}
        className={active === null ? PILL_ON : PILL_OFF}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt.bucket}
          type="button"
          aria-pressed={active === opt.bucket}
          title={opt.description}
          onClick={() => onChange(opt.bucket)}
          className={active === opt.bucket ? PILL_ON : PILL_OFF}
        >
          {opt.pillLabel}
        </button>
      ))}
    </div>
  );
}

// Part A of the qualification-type comparability round: the stage buttons used to be
// portalled up into TopicTabs' own row while the type pills lived down here, so two
// halves of one question ("which qualification?") sat in two different places. They are
// one row now. Behaviour of both controls is unchanged -- this is layout only.
function QualificationRow({
  stages,
  activeStage,
  onChangeStage,
  showType,
  activeBucket,
  onChangeBucket,
  availableBuckets,
}: {
  stages: KsStage[];
  activeStage: KsStage;
  onChangeStage: (s: KsStage) => void;
  showType: boolean;
  activeBucket: Ks5Bucket | null;
  onChangeBucket: (b: Ks5Bucket | null) => void;
  availableBuckets: Ks5Bucket[];
}) {
  // KsStageSwitcher renders null for a school with only one real stage; with no type
  // half either, the whole row would be an empty bordered strip.
  if (stages.length <= 1 && !showType) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* The label and a stage indicator show whether or not there is anything to
            switch between. A Post-16-only college is the common case, not an edge one,
            and hiding both left its TYPE pills floating with no heading and no sign of
            which stage was being shown. With one stage the indicator is plain text, not
            a disabled-looking button: there is genuinely nothing to click. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`mr-1 ${CONTROL_LABEL}`}>Qualification</span>
          {stages.length > 1 ? (
            <KsStageSwitcher stages={stages} active={activeStage} onChange={onChangeStage} />
          ) : (
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{STAGE_LABEL[activeStage]}</span>
          )}
        </div>
        {showType && <Ks5TypeSwitcher active={activeBucket} onChange={onChangeBucket} availableBuckets={availableBuckets} />}
      </div>
      {/* Two buckets carry an honest caveat, and both have to be visible at the moment
          the bucket is selected rather than buried in a doc -- otherwise a missing or
          partial number reads as a data gap or a bug. "Other" has no points figure at
          all; BTec, OCR, VRQ has one that covers only part of the bucket, because VRQ
          entries are counted but cannot be scored. */}
      {showType && activeBucket !== null && !ks5BucketHasPointsFigure(activeBucket) && (
        <p className="max-w-3xl text-xs text-neutral-600 dark:text-neutral-400">{KS5_OTHER_NO_FIGURE_NOTE}</p>
      )}
      {showType && activeBucket === "btec_ocr" && (
        <p className="max-w-3xl text-xs text-neutral-600 dark:text-neutral-400">{KS5_BTEC_OCR_PARTIAL_POINTS_NOTE}</p>
      )}
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
  // "target's dominant cohort" default any more) -- see Ks5TypeSwitcher's own
  // comment. Reset on every stage change for the same reason familyId is.
  const [ks5Bucket, setKs5Bucket] = useState<Ks5Bucket | null>(null);
  function changeStage(next: KsStage) {
    setStage(next);
    setFamilyId(null);
    setKs5WidenedUrns([]);
    setKs5Bucket(null);
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

  // Item 10: NO forced default any more -- ks5Bucket stays exactly what the user
  // has (or hasn't) explicitly clicked. null means "every school on its own real
  // dominant cohort," a genuinely different default from item 11's own scope
  // below. Only a SPECIFIC selection produces an exclusion set at all: per item
  // 11's own explicit instruction, the default (per-school) state does no
  // qualification-type matching -- a mixed set is correct and expected there,
  // since the comparator-widening effect below already guarantees ~10 real
  // KS5-having schools regardless of which cohort each one is shown on.
  // Which TYPE pills this school should even offer. Uses the SAME ks5HasBucketEntries
  // this file already uses to exclude comparator schools from a bucket comparison, so
  // "does this school have real entries in this bucket" means one thing in both places.
  // A bucket the school does not offer is dropped rather than rendered as a clickable
  // pill that empties the page -- Capital City College has no real IB, and was still
  // showing an IB pill.
  const availableKs5Buckets = targetProfile
    ? KS5_BUCKETS.filter((b) => ks5HasBucketEntries(targetProfile, b))
    : [];

  const ks5ExcludedUrns = new Set<string>();
  if (effectiveStage === "ks5" && ks5Bucket !== null) {
    const seen = new Set<string>();
    for (const p of [targetProfile, ...academicGroupProfiles]) {
      if (!p || seen.has(p.urn)) continue;
      seen.add(p.urn);
      if (!ks5HasBucketEntries(p, ks5Bucket)) ks5ExcludedUrns.add(p.urn);
    }
  }

  // Item 11: "comparator set must always be 10 real schools" for the KS5 view --
  // reuses surrounding-schools.ts's own findSurroundingSchools() engine via the new
  // /api/data-view/academic-comparator-widen route (see that route's own comment),
  // rather than inventing new selection logic. Default state (ks5Bucket === null):
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
      const qualifying = baseGroup.filter((p) => (ks5Bucket ? ks5HasBucketEntries(p, ks5Bucket) : stagesPresent(p).includes("ks5"))).length;
      const needed = 10 - qualifying;
      if (needed <= 0) {
        setKs5WidenedUrns((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const excludeAll = new Set([urn, ...tickedUrns, ...addedUrns.map((a) => a.urn)]);
      const params = new URLSearchParams({ anchorUrn: urn, count: String(needed), excludeUrns: Array.from(excludeAll).join(",") });
      if (ks5Bucket) params.set("bucket", ks5Bucket);
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
  }, [effectiveStage, targetProfile, tickedUrns, addedUrns, ks5Bucket, authToken, urn]);

  // Round 2, Part C: subject-level data for the TARGET school only (see this file's
  // own header comment for why), refetched whenever the stage changes (ks4/ks5 are
  // genuinely different sources) -- not gated on familyId, since AcademicGraphsView
  // needs the real subject list to populate its own picker before a subject is chosen.
  // Which SUBJECT is picked is AcademicGraphsView's own local state, not lifted here --
  // that component already remounts on stage/family change (its parent
  // DataViewErrorBoundary key includes both), so its local subject selection resets
  // for free on either change, no explicit reset effect needed.
  const [subjectData, setSubjectData] = useState<{ entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null>(null);
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
        const body = (await res.json()) as { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> };
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

  // Subject deep-dive round, Part 1: the batched comparator-set sibling of the
  // single-school fetch above -- closes the flagged subject-mode comparison-set gap
  // (docs/vicdata_phase3_academic_results_graphs_entries_subjects_comparison_redesign_
  // build_report_v1.md's own "what's needed to close this gap" section). Gated on
  // activeView === "graphs" (not just isActiveTopic, unlike subjectData above) --
  // this batched fetch is heavier (every real subject, every real comparator school,
  // every real period back to 2020/21) and Section 03 only ever renders on the Graphs
  // view, so there's no reason to pull it while looking at Map/Rankings. Keyed on the
  // same real comparator-group urns (target + ticked/widened) every other "vs
  // comparison set" fetch on this page already uses, plus familyId (narrows the new
  // RPC's own real subject-headline fetch to one category server-side, rather than
  // fetching every category and filtering client-side).
  const [comparatorSubjectByUrn, setComparatorSubjectByUrn] = useState<Map<string, SubjectLevelSchoolData>>(new Map());
  const [comparatorSubjectHeadlineByUrn, setComparatorSubjectHeadlineByUrn] = useState<Map<string, AcademicSubjectHeadlineEntry[]>>(new Map());
  // Not memoized -- academicGroupProfiles is itself a new array every render (not its
  // own useMemo), so memoizing on it here would never actually preserve anything; the
  // effect below already keys on the resulting STRING value, which is what actually
  // matters for whether a re-fetch is needed.
  const comparatorSubjectUrnsKey = Array.from(new Set<string>([urn, ...academicGroupProfiles.map((p) => p.urn)])).sort().join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authToken || !effectiveStage || effectiveStage === "ks2" || !isActiveTopic || activeView !== "graphs" || comparatorSubjectUrnsKey.length === 0) {
        if (!cancelled) {
          setComparatorSubjectByUrn(new Map());
          setComparatorSubjectHeadlineByUrn(new Map());
        }
        return;
      }
      try {
        const params = new URLSearchParams({ anchorUrn: urn, urns: comparatorSubjectUrnsKey, stage: effectiveStage });
        if (familyId) params.set("familyId", familyId);
        const res = await fetch(`/api/data-view/academic-subject-comparison?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { subjectByUrn: Record<string, SubjectLevelSchoolData>; headlineByUrn: Record<string, AcademicSubjectHeadlineEntry[]> };
        setComparatorSubjectByUrn(new Map(Object.entries(body.subjectByUrn)));
        setComparatorSubjectHeadlineByUrn(new Map(Object.entries(body.headlineByUrn)));
      } catch {
        // Non-fatal -- subject-mode comparison-set rows just fall back to their own
        // "not available" note, same as before this round.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urn, effectiveStage, authToken, isActiveTopic, activeView, comparatorSubjectUrnsKey, familyId]);

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
      {/* Item 6: the in-flow ViewSwitcher/PdfExportButton row is skipped for Map,
          matching Rolls' own MapView.tsx pattern exactly -- AcademicMapView renders
          its own overlay copies instead (see that component). Item 8: CategoryFilter
          also moves out of this row for Map (rendered below the map div instead),
          so this whole header row has nothing left to show for Map unless the
          Ks5TypeSwitcher is also present -- gated to avoid a stray empty bordered
          strip when neither applies. */}
      {/* The stage buttons live in this row now (Part A), so it renders whenever there
          is a stage at all -- previously it could be skipped entirely for Map, which
          would now take the stage switcher down with it. */}
      {effectiveStage && (
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
          <QualificationRow
            stages={filteredStages}
            activeStage={effectiveStage}
            onChangeStage={changeStage}
            showType={effectiveStage === "ks5"}
            activeBucket={ks5Bucket}
            onChangeBucket={setKs5Bucket}
            availableBuckets={availableKs5Buckets}
          />
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
                ks5Bucket={ks5Bucket}
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
                comparatorSubjectByUrn={comparatorSubjectByUrn}
                comparatorSubjectHeadlineByUrn={comparatorSubjectHeadlineByUrn}
                ks4ExcludedUrns={ks4ExcludedUrns}
                ks5Bucket={ks5Bucket}
                ks5ExcludedUrns={ks5ExcludedUrns}
                isLargeSet={isLargeSet}
                aggregateTrends={resolvedAcademicAggregateTrends}
                authToken={authToken}
              />
            ) : (
              <AcademicRankingsView
                targetProfile={targetProfile}
                tickedProfiles={academicGroupProfiles}
                stage={effectiveStage}
                startPeriod={startPeriod}
                activeSetLabel={activeSetLabel}
                ks4ExcludedUrns={ks4ExcludedUrns}
                ks5Bucket={ks5Bucket}
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
