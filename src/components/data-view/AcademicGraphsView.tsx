"use client";

// Academic Results Graphs (frontend build brief §4): Rolls' own four-section shape,
// adapted metric-for-metric using the SAME real chart primitives Rolls' GraphsView.tsx
// already uses (SpreadStrip/spreadData, DivergingBarChart, SortedBarChart -- all
// confirmed genuinely generic before reuse, not re-implemented). Section 4 (Subject/
// family breakdown, spec §4) is additive once a category is selected -- sections 1-3
// always stay whole-school headline.
//
// Round 2, Part C: a subject-level table inside Overview, once a specific subject is
// picked from the Subject dropdown below (shown once a category is selected, per spec
// §2's Category -> Subject nesting). Subject area round, 2026-09-14: the dropdown now
// IS genuinely filtered to the active category's own real subjects, closing the gap
// this comment used to flag -- academic_subject_family_map_lookup (new vicdata RPC
// this round) finally exposes subject_family_map, which nothing before this round
// could read at all. Deliberately narrower than spec §6 asks for -- entries count
// (both stages) and KS5 value-added with its real confidence interval, but NOT average
// grade/point score at subject level (either stage), and NOT a subject-level Map. Real
// reasons, not an oversight, checked directly against the live ingested data before
// writing this:
//   - The raw entries sources (dfe_ks4_subject_entries/dfe_ks5_subject_results) give
//     per-GRADE tallies ("Level 2 distinction": 14, "Merit": 9, "U": 2), not a
//     pre-computed average -- turning that into one average point-score figure needs
//     the same GCSE_POINTS/ALEVEL_POINTS conversion tables and weighted-averaging logic
//     vicdata's own ingest/academic_aggregates.py built for the FAMILY rollup, which
//     lives only in that repo's ingest pipeline; porting/re-deriving it here would be
//     new scoring logic with no real backend precedent to lean on, not a fetch+group.
//   - Real subject NAMES genuinely differ between dfe_ks5_subject_results and
//     dfe_ks5_subject_value_added for the same real subject (confirmed directly: e.g.
//     "Art and Design (Fine Art)" vs "Art & Design (Fine Art)" for the same
//     qualification/school) -- cross-referencing the two sources by subject name to
//     merge an entries figure with a value-added figure would silently mismatch some
//     real subjects. The value-added source's OWN entries_count field is used instead
//     (self-consistent, no cross-source join), so KS5 subjects that have entries in the
//     raw source but no value-added row (methodology exclusions, too-new subjects) will
//     not appear in the value-added rows -- a real, flagged narrowing, not a bug.
//   - Without an average point score, a subject-level Map's colour dimension has
//     nothing real to encode (entries alone would just repeat the family-level map's
//     own sizing idea one level finer, with no colour) -- not built this round.

import { useState } from "react";
import {
  HEADLINE_MEASURE,
  HEADLINE_LABEL,
  HEADLINE_UNIT,
  HEADLINE_AGE,
  TREND_BASELINE_PERIOD,
  ks4ExclusionGroupNote,
  ks4ExclusionWholeGroupSentence,
  ks5BucketHeadlineLabel,
  ks5BucketExclusionNote,
  ks5BucketWholeGroupSentence,
  ks5BucketMeasureFor,
  ibDiplomaHeadline,
  headlineValueAt,
  latestYear,
  stageYears,
  stageFamilies,
  familyYearsFor,
  latestFamilyYear,
  populationAtAge,
  populationSeriesAtAge,
  entriesSeries,
  latestEntriesCount,
  type AcademicSchoolProfile,
  type AcademicFamilyYear,
  type KsStage,
  type Ks5Bucket,
  type SubjectEntry,
  type SubjectValueAdded,
  type SubjectGradeCount,
  type AcademicSubjectHeadlineEntry,
} from "@/lib/academic-data-view";
import { CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";
import { trendBadge } from "@/lib/data-view-cards";
import { TREND_LABELS } from "@/lib/trend-labels";
import { FOCUS_SCHOOL_COLOUR } from "@/lib/school-series-colours";
import { academicYearLabel } from "./TrendPill";
import DivergingBarChart from "./DivergingBarChart";
import SortedBarChart from "./SortedBarChart";
import TargetRollBarChart from "./TargetRollBarChart";
import { Card, SectionHeading } from "./GraphsView";
import CategoryFilter from "./CategoryFilter";
import SubjectAreaSection from "./SubjectAreaSection";
import Ks2DomainSection from "./Ks2DomainSection";
import TargetVsAverageTrend from "./TargetVsAverageTrend";
import SubjectTable from "./SubjectTable";
import SubjectDeepDiveDrawer, { type DeepDiveTarget } from "./SubjectDeepDiveDrawer";
import AggregateTrendChart, { AGGREGATE_TARGET_COLOUR, AGGREGATE_REGION_COLOUR, AGGREGATE_NATION_COLOUR, type AggregateChartSeries } from "./AggregateTrendChart";
import type { AcademicAggregateTrends } from "@/lib/academic-aggregate-trends";
import { subjectFamilyColour } from "@/lib/subject-family-colours";

// Round 2, Part B: a small, self-contained N-slice donut for the entries-share
// breakdown (spec §4, "echoes the gender donut") -- GenderSplitCard.tsx's own Donut is
// hardcoded to exactly two slices (girls/boys), a genuinely different shape of problem
// from an arbitrary-length family list, so this is a new, small implementation rather
// than forcing that component into a shape it wasn't built for (same principle
// TargetVsAverageTrend below already applies to the two-line trend chart).
//
// 2026-09-14, subject-category colour round: was a dynamic index-based HSL hue
// (`familyColour(index,total)`) -- meant every family's donut slice/dot colour was
// arbitrary and re-shuffled depending on which families were present/how they
// sorted, so the SAME real family (e.g. Sciences & Maths) could read as a different
// colour on different schools. Replaced with the new fixed, site-wide
// subject-family-colours.ts palette, keyed on the family's own real familyId --
// per Guy's direct instruction that a subject category needs ONE distinct colour,
// consistent everywhere it appears (map, buttons, graphs), not a per-render one.
function familyColour(familyId: string): string {
  return subjectFamilyColour(familyId).light[1];
}

function EntriesShareDonut({ families, highlightFamilyId }: { families: AcademicFamilyYear[]; highlightFamilyId: string }) {
  const total = families.reduce((sum, f) => sum + f.entriesTotal, 0);
  if (total <= 0) return <p className="text-sm text-neutral-500">No real entries data for this school under this key stage.</p>;
  let acc = 0;
  const stops: string[] = [];
  const sorted = [...families].sort((a, b) => b.entriesTotal - a.entriesTotal);
  sorted.forEach((f) => {
    const start = (acc / total) * 100;
    acc += f.entriesTotal;
    const end = (acc / total) * 100;
    stops.push(`${familyColour(f.familyId)} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
  });
  return (
    <div className="flex items-center gap-5">
      <div className="h-24 w-24 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }} />
      <div className="flex flex-col gap-1.5">
        {sorted.map((f) => (
          <div key={f.familyId} className={`flex items-center gap-2 text-[13px] ${f.familyId === highlightFamilyId ? "font-semibold text-neutral-900 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: familyColour(f.familyId) }} />
            {f.familyLabel} — {((f.entriesTotal / total) * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  );
}

// Entries/Subjects comparison redesign (2026-09-14), Section 01's new bottom row:
// the comparison-set's own AVERAGE entries-share distribution, one pie alongside the
// school's own (EntriesShareDonut, unchanged, reused directly). Real, deliberate
// arithmetic distinction from Section 03's Candidates market-share row below (per the
// brief's own decision 1/§Section 01 note): this AVERAGES each comparator school's
// own real entries_share_percent per category -- it does NOT pool every comparator's
// raw entries into one combined total and take shares of that pool (a different,
// total-based number, which is what market share means). Verified directly against
// real hosted data before building this (four real Slough-area KS4 schools) that
// entries_share_percent is always populated and each school's own real shares sum to
// ~100% -- averaging across schools is a meaningful, real distribution, not an
// artifact of sparse data.
type FamilySharePoint = { familyId: string; familyLabel: string; percent: number };

function averageEntriesShareByFamily(profiles: AcademicSchoolProfile[], stage: KsStage): FamilySharePoint[] {
  const byFamily = new Map<string, { label: string; sum: number; n: number }>();
  for (const p of profiles) {
    for (const f of stageFamiliesLatest(p, stage)) {
      if (f.entriesSharePercent === null) continue;
      const entry = byFamily.get(f.familyId) ?? { label: f.familyLabel, sum: 0, n: 0 };
      entry.sum += f.entriesSharePercent;
      entry.n += 1;
      byFamily.set(f.familyId, entry);
    }
  }
  return Array.from(byFamily.entries()).map(([familyId, { label, sum, n }]) => ({ familyId, familyLabel: label, percent: sum / n }));
}

// Same visual shape as EntriesShareDonut (conic-gradient wedges + a coloured-dot
// legend, same subject-family-colours.ts palette) but fed pre-computed percentages
// rather than raw entriesTotal -- EntriesShareDonut's own totalling logic doesn't
// apply here (there's no single real "total" to sum across a whole comparison set,
// only an average per category). Wedge geometry is normalised against the slices'
// own sum (so it always draws a full circle even if real per-school coverage gaps
// mean the true averages don't sum to exactly 100) but each slice's LABEL shows its
// real, un-renormalised average percentage -- the two only diverge when coverage is
// genuinely incomplete across the set, which is honest to show as a label, not hide.
function ComparisonShareDonut({ slices }: { slices: FamilySharePoint[] }) {
  const totalForGeometry = slices.reduce((sum, s) => sum + s.percent, 0);
  if (totalForGeometry <= 0) return <p className="text-sm text-neutral-500">No real entries-share data across the comparison set.</p>;
  let acc = 0;
  const stops: string[] = [];
  const sorted = [...slices].sort((a, b) => b.percent - a.percent);
  sorted.forEach((s) => {
    const start = (acc / totalForGeometry) * 100;
    acc += s.percent;
    const end = (acc / totalForGeometry) * 100;
    stops.push(`${familyColour(s.familyId)} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
  });
  return (
    <div className="flex items-center gap-5">
      <div className="h-24 w-24 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }} />
      <div className="flex flex-col gap-1.5">
        {sorted.map((s) => (
          <div key={s.familyId} className="flex items-center gap-2 text-[13px] text-neutral-600 dark:text-neutral-400">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: familyColour(s.familyId) }} />
            {s.familyLabel} — {s.percent.toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_EXCLUDED_SET: Set<string> = new Set();
const EMPTY_FAMILIES: { familyId: string; familyLabel: string }[] = [];
const EMPTY_COMPARATOR_SUBJECT_MAP: Map<string, { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; gradeDistribution: SubjectGradeCount[] }> = new Map();
const EMPTY_COMPARATOR_HEADLINE_MAP: Map<string, AcademicSubjectHeadlineEntry[]> = new Map();

function formatHeadline(stage: KsStage, value: number): string {
  return HEADLINE_UNIT[stage] === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

// Subject deep-dive round: TargetVsAverageTrend extracted to its own file
// (TargetVsAverageTrend.tsx) so SubjectDeepDiveDrawer.tsx can reuse the same real
// trend chart for a subject's own multi-period line -- see that file's own header
// comment for the full reasoning (unchanged from before this round otherwise).

export default function AcademicGraphsView({
  targetProfile,
  tickedProfiles,
  stage,
  startPeriod,
  activeSetLabel,
  familyId = null,
  familyLabel = null,
  families = EMPTY_FAMILIES,
  onFamilyChange = () => {},
  subjectData = null,
  comparatorSubjectByUrn = EMPTY_COMPARATOR_SUBJECT_MAP,
  comparatorSubjectHeadlineByUrn = EMPTY_COMPARATOR_HEADLINE_MAP,
  ks4ExcludedUrns = EMPTY_EXCLUDED_SET,
  ks5Bucket = null,
  ks5ExcludedUrns = EMPTY_EXCLUDED_SET,
  isLargeSet = false,
  aggregateTrends = null,
  authToken = null,
}: {
  targetProfile: AcademicSchoolProfile;
  tickedProfiles: AcademicSchoolProfile[];
  stage: KsStage;
  startPeriod: number;
  activeSetLabel: string | null;
  // Subject deep-dive round, Part 3: the real bearer token SubjectDeepDiveDrawer's own
  // fetch needs (same membership-gated pattern every other Academic fetch already
  // uses). This component didn't previously do any fetching of its own -- the drawer
  // is the first thing here that does, hence a genuinely new prop, not a repurposed
  // existing one.
  authToken?: string | null;
  // Region/Nation comparator round 2: same real shape as Rolls' own GraphsView.tsx
  // isLargeSet/aggregateTrends props -- true once the active comparator set is a real
  // Region/Nation-scale recipe past LARGE_SET_PROFILE_THRESHOLD. aggregateTrends stays
  // undefined/null while the fetch is in flight (a real, distinct "still loading" state
  // from "fetched, genuinely nothing real to show"), same convention Rolls' own prop
  // already establishes.
  isLargeSet?: boolean;
  aggregateTrends?: AcademicAggregateTrends | null;
  familyId?: string | null;
  familyLabel?: string | null;
  // Graphs edit 2, Section 3: the real picker itself (CategoryFilter, moved here
  // from AcademicDataView.tsx's own header) needs the full real family list and a
  // way to change the selection -- `familyId`/`familyLabel` above stay as the
  // already-resolved CURRENT selection this component's other sections read, same
  // as before; these two are new, only for rendering/driving the picker itself.
  // `familyId`/`families` state stays owned by AcademicDataView.tsx regardless --
  // this is a real relocation of the rendered control, not a new picker or a new
  // state owner.
  families?: { familyId: string; familyLabel: string }[];
  onFamilyChange?: (familyId: string | null) => void;
  subjectData?: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null;
  // Subject deep-dive round, Part 1: the batched comparator-set sibling of
  // subjectData above -- one entry per real comparator URN (target included, same
  // convention as comparableGroup below). Empty maps (not undefined/null) are the
  // real "not fetched yet, or genuinely nothing" default -- SubjectAreaSection.tsx's
  // own comparison-set rows already know how to render "no real data" from an empty
  // map, no separate loading state needed here.
  comparatorSubjectByUrn?: Map<string, { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; gradeDistribution: SubjectGradeCount[] }>;
  comparatorSubjectHeadlineByUrn?: Map<string, AcademicSubjectHeadlineEntry[]>;
  // GCSE exclusion round, Part 2: real URNs excluded from GCSE comparison this render
  // (empty whenever stage !== "ks4", per AcademicDataView's own gating) -- affects
  // Section 2 (Results) only; Section 3 (family/subject breakdown) is untouched, a
  // deliberate scope call (see this round's own report -- the brief's own Part 2
  // list names free card/Overview/Rankings/Map, not this section, and entries/
  // point-score are a different real metric class from Attainment 8/EBacc, not
  // necessarily affected by the same DfE exclusion).
  ks4ExcludedUrns?: Set<string>;
  // KS5 qualification-type-awareness round, Part 4: Section 2's own group-comparison
  // charts (growth/same-year bar) key their measure on this selected cohort.
  // ks5ExcludedUrns is this round's analogue of ks4ExcludedUrns, empty whenever
  // stage !== "ks5". Item 10: null is the real default now -- every school in the
  // group is then valued on ITS OWN dominant cohort (ks5MeasureFor) rather than one
  // shared measure across a mixed group.
  ks5Bucket?: Ks5Bucket | null;
  ks5ExcludedUrns?: Set<string>;
}) {
  // Local, not lifted -- this component already remounts (its parent's
  // DataViewErrorBoundary key) whenever stage/family changes, so this resets for free.
  const [subject, setSubject] = useState<string | null>(null);
  // Round 3, Part B: three independently-collapsible sections, all open by default
  // (SectionHeading's own established convention, ported from Rolls' GraphsView.tsx)
  // -- an EMPTY closed-set, unlike Rolls' own Section 01-open/02-04-closed default,
  // per this brief's own explicit "mirroring SectionHeading's own 'all open by
  // default' behaviour" instruction.
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());
  // Subject deep-dive round, Part 3: the drawer's own open/breadcrumb state -- owned
  // here (not inside SubjectAreaSection.tsx, and not inside the drawer itself) since
  // AcademicGraphsView is the real natural boundary between the page (which must stay
  // completely unaffected by opening/closing the drawer) and the click targets that
  // open it (Section 03's own bars). null = closed.
  const [deepDiveTarget, setDeepDiveTarget] = useState<DeepDiveTarget | null>(null);
  const toggleSection = (id: string) =>
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  // KS5 qualification-type-awareness round, Part 4: group-comparison sections
  // (spread/growth/trend/same-year bar) key their measure on the selected cohort.
  // Item 10: with no cohort selected (ks5Bucket === null, the new default), there is
  // no single shared measure -- valueFor resolves each school's OWN real dominant
  // cohort via ks5MeasureFor instead of a shared measureKey.
  const baseline = TREND_BASELINE_PERIOD[stage];
  const setLabel = activeSetLabel ?? "the ticked comparator set";

  const valueFor = (p: AcademicSchoolProfile, period?: number) => {
    const years = stageYears(p, stage);
    const y = period !== undefined ? years.find((yy) => yy.period === period) : latestYear(years);
    if (!y) return null;
    const measureKey = stage === "ks5" ? ks5BucketMeasureFor(p, ks5Bucket).measureKey : HEADLINE_MEASURE[stage];
    return headlineValueAt(years, y.period, measureKey);
  };

  // Part 4's own group-level label, for the Growth/decline and Results captions
  // below -- always the SELECTED cohort (not the target's own dominant one). Item
  // 10 design call: with no cohort selected, there is no one real label that covers
  // every school in a mixed group (each may be on a different real dominant
  // cohort) -- rather than naming one arbitrarily, these sections use a generic
  // caption instead (see the JSX call sites below). This constant stays the
  // specific label whenever an explicit cohort IS selected (unchanged behaviour).
  const groupHeadlineLabel = stage === "ks5" ? (ks5Bucket ? ks5BucketHeadlineLabel(ks5Bucket) : "each school's own qualification-type headline measure") : HEADLINE_LABEL[stage];

  // GCSE exclusion round, Part 2 (supersedes stage-1's caveat-alongside-a-number Part
  // D): the excluded set is computed once in AcademicDataView and threaded down here
  // (empty whenever stage !== "ks4"). `comparableGroup` feeds every group-comparison
  // calculation below (growth/same-year bar) -- an excluded school (target or
  // ticked) simply isn't part of any of them, rather than showing with a caveat.
  const comparableGroup = group.filter((p) => !ks4ExcludedUrns.has(p.urn) && !ks5ExcludedUrns.has(p.urn));
  const excludedTickedNames = group.filter((p) => ks4ExcludedUrns.has(p.urn) && p.urn !== targetProfile.urn).map((p) => p.name);
  // Only possible when the target is ALSO excluded (comparableGroup would otherwise
  // always contain at least the target) -- a real, distinct case from "some ticked
  // schools excluded": nothing at all is left to chart.
  const wholeGroupExcluded = stage === "ks4" && comparableGroup.length === 0;
  const ks4GroupNote = stage === "ks4" ? ks4ExclusionGroupNote(excludedTickedNames) : null;

  // KS5 qualification-type-awareness round, Part 4: same real pattern, keyed on the
  // selected cohort instead. `comparableGroup` above already reflects BOTH exclusion
  // sets (ks4ExcludedUrns is empty whenever stage !== "ks4", and vice versa for
  // ks5ExcludedUrns below, so only one ever actually filters anything for a given
  // stage) -- recomputed here rather than folded into one shared variable name so
  // each stage's own exclusion reason stays traceable to its own real cause.
  // Names the TARGET too when it's the one excluded (rather than a separate
  // dedicated sentence, unlike the GCSE round's ks4 pattern) -- "why is this
  // school's own bar/line missing from the group charts below" is the whole real
  // gap left to explain here now that Section 2's own single-school headline number
  // is gone (Graphs edit 2).
  const excludedNamesKs5 = group.filter((p) => ks5ExcludedUrns.has(p.urn)).map((p) => p.name);
  const ks5WholeGroupExcluded = stage === "ks5" && comparableGroup.length === 0;
  // ks5ExcludedUrns (and so excludedNamesKs5/ks5WholeGroupExcluded) is only ever
  // non-empty when the parent has a specific ks5Bucket selected -- the default
  // per-school state does no qualification-type matching at all (item 11) -- so the
  // `?? "A level"` fallbacks below are type-safety-only, never a real path.
  // Only the target school's own Diploma figure: this is a whole-cohort headline for the
  // school being viewed, not a comparator-set measure.
  const ibDiploma = stage === "ks5" ? ibDiplomaHeadline(targetProfile) : null;

  const ks5GroupNote = stage === "ks5" ? ks5BucketExclusionNote(excludedNamesKs5, ks5Bucket ?? "alevel") : null;
  // Only one of the two is ever non-null/true for a given render (each gated to its
  // own stage) -- combined once here so the JSX below doesn't need to repeat both
  // stages' own conditionals in every affected section.
  const anyWholeGroupExcluded = wholeGroupExcluded || ks5WholeGroupExcluded;
  const anyGroupNote = ks4GroupNote ?? ks5GroupNote;
  const anyWholeGroupSentence = wholeGroupExcluded ? ks4ExclusionWholeGroupSentence(setLabel) : ks5BucketWholeGroupSentence(setLabel, ks5Bucket ?? "alevel");

  const growthPoints = comparableGroup.map((p) => {
    const current = valueFor(p);
    const anchor = valueFor(p, baseline);
    return { urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, pctChange: trendBadge(current, anchor)?.pctChange ?? null };
  });

  const allPeriods = Array.from(new Set(comparableGroup.flatMap((p) => stageYears(p, stage).map((y) => y.period))))
    .filter((p) => p >= Math.max(startPeriod, baseline))
    .sort((a, b) => a - b);

  const latestPeriod = allPeriods[allPeriods.length - 1] ?? null;
  const sameYearBarPoints = latestPeriod !== null
    ? comparableGroup.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: valueFor(p, latestPeriod) ?? 0 }))
    : [];

  // Round 2, Part B: Section 4 data, only computed when a family is actually
  // selected. Entries-share/entries-count always show normally for a low-coverage
  // family (Health & Care never has a real avgPointScore at all, confirmed directly
  // against the real ingested data -- see the round 2 report's own evidence); only the
  // point-score bar chart/trend line are withheld, with the honest wording already
  // drafted (summary-wordings doc §6), never a fabricated substitute number.
  const targetFamilyYear = familyId ? latestFamilyYear(targetProfile, stage, familyId) : null;
  const familyBarPoints = familyId
    ? group
        .map((p) => ({ urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, avgPointScore: latestFamilyYear(p, stage, familyId)?.avgPointScore ?? null }))
    : [];
  const familyBarPointsWithScore = familyBarPoints.filter((p): p is { urn: string; name: string; isTarget: boolean; avgPointScore: number } => p.avgPointScore !== null);
  const familyTrendYears = familyId ? familyYearsFor(targetProfile, stage, familyId) : [];
  const familyTargetSeries = allPeriods.map((p) => familyTrendYears.find((y) => y.period === p)?.avgPointScore ?? null);
  const familyPointScoreAvailable = targetFamilyYear?.avgPointScore !== null && targetFamilyYear?.avgPointScore !== undefined;
  const familyFirstScore = familyTrendYears.find((y) => y.avgPointScore !== null)?.avgPointScore ?? null;
  const familyLastScore = [...familyTrendYears].reverse().find((y) => y.avgPointScore !== null)?.avgPointScore ?? null;

  // Round 2, Part C: real distinct subject names, union of both real sources (a
  // subject with entries but no value-added row, or vice-versa, should still be a
  // real, selectable option). Subject area round, 2026-09-14: NOW filtered to the
  // active family when one's picked -- academic_subject_family_map_lookup (new this
  // round) closes the real gap this comment used to flag ("subject_family_map isn't
  // exposed via any RPC," subjectData.subjectFamilyMap below). Whole-school (no
  // family picked) still lists every real subject for the stage, same as before --
  // there's no "family" to filter against at that scope.
  const subjectNames = subjectData
    ? Array.from(new Set([...subjectData.entries.map((e) => e.subject), ...subjectData.valueAdded.map((v) => v.subject)]))
        .filter((name) => !familyId || subjectData.subjectFamilyMap[name] === familyId)
        .sort((a, b) => a.localeCompare(b))
    : [];
  const subjectEntryRows = subject && subjectData ? subjectData.entries.filter((e) => e.subject === subject) : [];
  const subjectLatestEntry = subjectEntryRows.length > 0 ? subjectEntryRows.reduce((a, b) => (a.period > b.period ? a : b)) : null;
  // A subject can have more than one real value-added row (different qualification
  // types/size-weights genuinely coexist for the same subject name, e.g. a BTEC and a
  // GCE A level both called "Biology") -- show every real one rather than silently
  // picking the first, since collapsing them would misstate which qualification the
  // figure is actually for.
  const subjectValueAddedRows = subject && subjectData
    ? subjectData.valueAdded.filter((v) => v.subject === subject && v.period === Math.max(...subjectData.valueAdded.filter((x) => x.subject === subject).map((x) => x.period), -Infinity))
    : [];

  // Round 3, Part B, Section 1 (Entries): real per-school candidate/entries counts --
  // A1's own real GCSE/Post-16 entries figures (entriesSeries), roll population for
  // KS2 (the SAME real per-period census source the map's own current-snapshot
  // figure already uses -- Graphs edit 2, Section 1: extended to a genuine real
  // MULTI-year series via populationSeriesAtAge/ageGenderCountsByPeriod, not a
  // single current-year point any more; KS2 still has no real DfE entries/cohort-
  // size figure at all, confirmed via that data set's own /meta response, so this
  // stays population, just a real history of it now instead of one snapshot).
  const targetEntriesSeries = stage === "ks2" ? populationSeriesAtAge(targetProfile, HEADLINE_AGE.ks2) : entriesSeries(targetProfile, stage, ks5Bucket);
  // Fallback to a single current-snapshot point only for KS2, and only in the real
  // edge case of a school with no per-period census history at all (e.g. brand new)
  // -- GCSE/Post-16 correctly stay a genuinely empty series in their own equivalent
  // case, which TargetRollBarChart already renders honestly as "not enough real
  // history to plot a trend" rather than fabricating a point for them too.
  const entriesPeriods = targetEntriesSeries.length > 0 ? targetEntriesSeries.map((r) => r.period) : stage === "ks2" ? [CURRENT_CENSUS_PERIOD] : [];
  const entriesValues: (number | null)[] =
    targetEntriesSeries.length > 0 ? targetEntriesSeries.map((r) => r.value) : stage === "ks2" ? [populationAtAge(targetProfile, HEADLINE_AGE.ks2)] : [];
  const entriesFirst = entriesValues.find((v): v is number => v !== null) ?? null;
  const entriesLast = [...entriesValues].reverse().find((v): v is number => v !== null) ?? null;
  const entriesTrendBadge = entriesFirst !== null && entriesLast !== null ? trendBadge(entriesLast, entriesFirst) : null;
  const entriesNoun = stage === "ks2" ? `${HEADLINE_AGE.ks2}-year-olds` : stage === "ks4" ? "pupils entered for GCSEs" : "pupils entered for Post-16 exams";

  // Right panel: the comparison set's own real candidate numbers, latest real year --
  // same comparableGroup (GCSE-exclusion/KS5-cohort-exclusion aware) every other
  // group chart on this page already uses.
  const entriesBarPoints = comparableGroup.map((p) => ({
    urn: p.urn,
    name: p.name,
    isTarget: p.urn === targetProfile.urn,
    value: (stage === "ks2" ? populationAtAge(p, HEADLINE_AGE.ks2) : latestEntriesCount(p, stage, ks5Bucket)?.value) ?? 0,
  }));

  // Entries/Subjects comparison redesign (2026-09-14), Section 01's new bottom row:
  // same comparableGroup every other "vs comparison set" figure on this page already
  // uses (the target's own row is included in that average, same convention every
  // other comparator figure here follows -- never target-excluded). KS2/family-level
  // have no real subject-family taxonomy at all (stageFamilies already returns []
  // for KS2, and this row is whole-school scope like Section 01's own existing
  // content), so entriesShareComparisonAvailable gates on that, not a separate check.
  const entriesShareComparisonAvailable = stage !== "ks2";
  const entriesShareComparisonSlices = entriesShareComparisonAvailable ? averageEntriesShareByFamily(comparableGroup, stage) : [];

  // Region/Nation comparator round 2: real prior art reused directly (GraphsView.tsx's
  // own aggregateSeries), for Section 2 (Results) only -- a real finding checked
  // directly against real hosted data before building Section 1's own equivalent (not
  // assumed the same source would just work): academic_geography_aggregate's own
  // entries_total column is NEVER populated for family_id='whole_school' rows --
  // confirmed both by reading ingest/academic_aggregates.py's own accumulator (the
  // whole-school headline branch only ever sums `value`/`n`, never an entries figure)
  // and by a live fetch (every real national/region row returned entriesTotal: null).
  // entries_total only exists for a real, specific subject family (from
  // academic_subject_family_rollup), which this round's large-set scope doesn't fetch
  // (round 1's own choropleth is whole-school only for the same reason). So there is no
  // real national/region "candidate numbers" aggregate to chart -- Section 1's own
  // isLargeSet branch below withholds the comparator card with an honest note instead
  // of fabricating one from a field that's structurally always null at this scope.
  const headlineAggregateSeries: AggregateChartSeries[] = isLargeSet
    ? [
        {
          key: "target",
          label: targetProfile.name,
          colourLight: AGGREGATE_TARGET_COLOUR.light,
          colourDark: AGGREGATE_TARGET_COLOUR.dark,
          points: allPeriods.map((p) => ({ period: p, value: valueFor(targetProfile, p) })).filter((pt): pt is { period: number; value: number } => pt.value !== null),
        },
        ...(aggregateTrends?.region
          ? [{ key: "region", label: aggregateTrends.region.label, colourLight: AGGREGATE_REGION_COLOUR.light, colourDark: AGGREGATE_REGION_COLOUR.dark, points: aggregateTrends.region.points.map((p) => ({ period: p.period, value: p.value })) }]
          : []),
        ...(aggregateTrends?.national
          ? [{ key: "nation", label: aggregateTrends.national.label, colourLight: AGGREGATE_NATION_COLOUR.light, colourDark: AGGREGATE_NATION_COLOUR.dark, points: aggregateTrends.national.points.map((p) => ({ period: p.period, value: p.value })) }]
          : []),
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Round 3, Part B: three independently-collapsible sections, reusing Rolls'
          own real SectionHeading/Card/FullscreenChartModal directly (GraphsView.tsx)
          rather than a rebuilt lookalike. */}
      <section>
        <SectionHeading number="01" title="Entries" isOpen={!closedSections.has("01")} onToggle={() => toggleSection("01")} />
        {!closedSections.has("01") && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={`${targetProfile.name}'s candidate numbers since ${entriesPeriods.length > 0 ? academicYearLabel(entriesPeriods[0]) : "the start of the series"}`}>
              <TargetRollBarChart periods={entriesPeriods} values={entriesValues} colour={FOCUS_SCHOOL_COLOUR} />
              {/* Same real noun-form wording (trend-labels.ts, A4) as the Map's own
                  trend popup -- one shared module, not a second inline copy. */}
              {entriesTrendBadge && (
                <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {TREND_LABELS[entriesTrendBadge.direction].adjective} ({entriesTrendBadge.pctChange >= 0 ? "+" : ""}
                  {entriesTrendBadge.pctChange.toFixed(0)}% since {academicYearLabel(entriesPeriods[0] ?? baseline)})
                </p>
              )}
            </Card>
            {isLargeSet ? (
              // Region/Nation comparator round 2: the comparator-set bar chart
              // (SortedBarChart over `comparableGroup`) is meaningless at this scale
              // (comparableGroup is only ever the bounded ticked/widened group, never
              // the real 5,000+-school set) -- but unlike Section 2, there's no real
              // national/region aggregate to show instead here: confirmed directly
              // against real hosted data (see this file's own comment above the
              // aggregate-series computation) that academic_geography_aggregate never
              // carries a whole-school entries total. Withheld honestly rather than
              // faked from an always-null field.
              <Card title="Candidate numbers vs region and nation">
                <p className="text-sm text-neutral-500">
                  A real national/region comparison isn&rsquo;t available for candidate numbers at this scale -- {targetProfile.name}&rsquo;s own trend is shown on the left.
                </p>
              </Card>
            ) : (
              <Card title={`Candidate numbers${entriesPeriods.length > 0 ? `, ${academicYearLabel(entriesPeriods[entriesPeriods.length - 1])}` : ""} — ${targetProfile.name} vs ${setLabel}`}>
                <SortedBarChart points={entriesBarPoints} />
                <p className="mt-2 text-xs text-neutral-400">{entriesNoun}, real DfE entries counts (roll population for KS2, which DfE doesn&rsquo;t publish an entries figure for).</p>
              </Card>
            )}
          </div>
        )}
        {/* Entries/Subjects comparison redesign (2026-09-14): new bottom row, two
            pie charts -- school's own entries-share breakdown (EntriesShareDonut,
            unchanged, reused directly) next to the comparison set's own AVERAGE
            distribution (ComparisonShareDonut, new -- see its own comment above for
            why this is a genuinely different computation from Section 03's Candidates
            market-share row below, not the same arithmetic under a different name).
            KS2 has no real subject-family taxonomy at all -- this row simply doesn't
            render there, same real constraint every other family-based chart on this
            page already respects. Large-set scale follows the exact same withholding
            precedent this section's own existing right-hand card already established
            just above (comparableGroup is only ever the bounded ticked/widened group
            at that scale, never the real multi-thousand-school set). */}
        {!closedSections.has("01") && stage !== "ks2" && (
          <Card title={`Entries by subject category — ${targetProfile.name} vs comparison set average`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs text-neutral-500">{targetProfile.name}</p>
                <EntriesShareDonut families={stageFamiliesLatest(targetProfile, stage)} highlightFamilyId="" />
              </div>
              <div>
                <p className="mb-2 text-xs text-neutral-500">Average across {setLabel}</p>
                {isLargeSet ? (
                  <p className="text-sm text-neutral-500">A real comparison-set average isn&rsquo;t available for entries by category at this scale.</p>
                ) : (
                  <ComparisonShareDonut slices={entriesShareComparisonSlices} />
                )}
              </div>
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionHeading number="02" title="Results" isOpen={!closedSections.has("02")} onToggle={() => toggleSection("02")} />
        {!closedSections.has("02") &&
          (isLargeSet ? (
            // Region/Nation comparator round 2: same real swap as Section 1 above,
            // applied to the headline measure instead of entries -- the one chart
            // this whole product exists to show at scale (Attainment 8/APS trend vs
            // region and nation), not a comparator-set bar chart over a handful of
            // ticked schools.
            <>
              <Card title={`${groupHeadlineLabel}, ${targetProfile.name} vs region and nation since ${academicYearLabel(baseline)}`}>
                {aggregateTrends === undefined || aggregateTrends === null ? (
                  <p className="text-sm text-neutral-500">Loading region/nation comparison…</p>
                ) : (
                  <AggregateTrendChart series={headlineAggregateSeries} />
                )}
              </Card>
              <p className="mt-2 text-xs text-neutral-400">
                At this scale, Results compares whole-school trends only -- GCSE/IGCSE and KS5 qualification-type exclusions aren&rsquo;t reflected in this chart.
              </p>
            </>
          ) : (
            // Graphs edit 2, Section 2: the preserved headline-number/SpreadStrip/
            // TargetVsAverageTrend "introductory" block that used to sit here is
            // gone -- a real, explicit Round 3 judgement call (see that round's own
            // build report) reversed on direct instruction after Guy saw it live.
            // Section 2 is now just the two Card components below, side by side,
            // nothing above them -- Part B's own original 50:50 two-column ask: left,
            // the overall results summary bar chart (school vs comparison set, latest
            // real year); right, the growth/decline chart.
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title={latestPeriod !== null ? `${groupHeadlineLabel}, ${academicYearLabel(latestPeriod)} — ${targetProfile.name} vs ${setLabel}` : "Results summary"}>
                {anyWholeGroupExcluded ? (
                  <p className="text-sm text-neutral-500">{anyWholeGroupSentence}</p>
                ) : latestPeriod !== null ? (
                  <>
                    {anyGroupNote && <p className="mb-2 text-xs italic text-neutral-500">{anyGroupNote}</p>}
                    <SortedBarChart points={sameYearBarPoints} formatValue={(v) => formatHeadline(stage, v)} />
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">No real data available for this key stage.</p>
                )}
              </Card>
              <Card title={`Growth / decline since ${academicYearLabel(baseline)}`}>
                {anyWholeGroupExcluded ? (
                  <p className="text-sm text-neutral-500">{anyWholeGroupSentence}</p>
                ) : (
                  <>
                    {anyGroupNote && <p className="mb-2 text-xs italic text-neutral-500">{anyGroupNote}</p>}
                    <p className="mb-2 text-xs text-neutral-500">Change in {groupHeadlineLabel}, across {setLabel}.</p>
                    <DivergingBarChart points={growthPoints} />
                  </>
                )}
              </Card>
            </div>
          ))}
      </section>

      <section>
        <SectionHeading number="03" title="Subjects" isOpen={!closedSections.has("03")} onToggle={() => toggleSection("03")} />
        {/* Graphs edit 2: the real picker itself, CategoryFilter, moved here from
            AcademicDataView.tsx's own header row -- "this change was missed" (Guy's
            own live question after round 3) was exactly this: round 3 moved the
            CONTENT below into this section but left the control that sets familyId
            sitting outside it. Section 3 now always renders (picker + a real empty
            state before a family's picked), rather than staying invisible until a
            family's already selected via a control that no longer exists anywhere
            else -- there'd be no way to ever reach this section otherwise. */}
        {/* KS2 has no subject taxonomy -- no subject_family_map entries, no
            category/subject split -- and never will: every pupil sits the same fixed
            national tests, so there is nothing to categorise. It does have DOMAIN,
            which is a real comparison axis of the same shape, so this section now
            carries real domain content here rather than the explanatory placeholder
            that stood in for it when Section 03 was first gated for this stage.
            Deliberately a separate component, not SubjectAreaSection with a KS2 mode:
            no candidates concept, no drawer, and two different units across the six
            rows. See Ks2DomainSection.tsx's own header for the reasoning. */}
        {!closedSections.has("03") && stage === "ks2" && (
          <Ks2DomainSection
            profile={targetProfile}
            comparableGroup={comparableGroup}
            setLabel={setLabel}
          />
        )}
        {!closedSections.has("03") && stage !== "ks2" && (
          <div>
            <div className="mb-4">
              <CategoryFilter families={families} activeFamilyId={familyId} onChange={onFamilyChange} />
            </div>
            {/* Subject area, per Guy's direct brief (2026-09-14): "whole school
                selected show the categories, if a category selected show the
                subjects within the category" -- always rendered here, whether or
                not a family's picked, distinct from (and above) the EXISTING
                family-specific content below, which answers a different question
                (how this school's own category compares with OTHER schools, not
                with its own other categories/subjects) and is untouched. */}
            {/* The IB Diploma total score, placed directly ABOVE the subject list.
                Reasoning for this spot: it is the whole-cohort counterpart of the
                subject-by-subject breakdown that follows -- a reader who has picked
                Post-16 at an IB school wants the Diploma average before the per-subject
                detail, the same way the A-level points figure precedes its own subject
                list. It is deliberately NOT in the whole-school headline strip at the
                top, which is shared by every school and every stage; only a minority of
                schools run the Diploma, and a card that is absent for most schools reads
                better adjacent to the subject content it explains than as a hole in a
                fixed header. Renders only when the school has a real Diploma cohort. */}
            {stage === "ks5" && ibDiploma && (
              <div className="mb-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  International Baccalaureate Diploma
                </p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {ibDiploma.averageScore.toFixed(2)}
                  <span className="ml-1 text-base font-normal text-neutral-500">out of 45</span>
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Average total Diploma score across {ibDiploma.students.toLocaleString()} candidate
                  {ibDiploma.students === 1 ? "" : "s"} in {academicYearLabel(ibDiploma.period)}
                  {ibDiploma.entries > ibDiploma.students
                    ? `. ${(ibDiploma.entries - ibDiploma.students).toLocaleString()} further candidate${ibDiploma.entries - ibDiploma.students === 1 ? "" : "s"} did not receive a scored result and are not in the average.`
                    : "."}
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  The Diploma score is a different scale from the points figures above: it runs 24 to 45 and
                  counts the whole Diploma, not one entry.
                </p>
              </div>
            )}
            <div className="mb-6">
              <SubjectAreaSection
                ks5Bucket={ks5Bucket}
                profile={targetProfile}
                comparableGroup={comparableGroup}
                stage={stage}
                familyId={familyId}
                familyLabel={familyLabel}
                subjectData={subjectData}
                comparatorSubjectByUrn={comparatorSubjectByUrn}
                comparatorSubjectHeadlineByUrn={comparatorSubjectHeadlineByUrn}
                setLabel={setLabel}
                onSelectSubjectArea={setDeepDiveTarget}
              />
            </div>
            {familyId && familyLabel ? (
              // Part B's own explicit instruction for this content: relocate the
              // existing subject-family content as-is -- "for now, just make the
              // existing subject graphs visible here... then I will refine." Not
              // redesigned beyond moving it (this round moves the picker above it
              // too, still not a redesign of the content itself).
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{familyLabel}</h4>

                <div className="mb-4">
                  <p className="mb-2 text-xs text-neutral-500">
                    {targetFamilyYear ? `${targetFamilyYear.entriesSharePercent ?? "—"}% of ${targetProfile.name}'s ${STAGE_ENTRY_NOUN[stage]} in ${academicYearLabel(targetFamilyYear.period)} were in ${familyLabel}.` : `No real entries data for ${familyLabel} at this school.`}
                  </p>
                  <EntriesShareDonut families={stageFamiliesLatest(targetProfile, stage)} highlightFamilyId={familyId} />
                </div>

                {familyPointScoreAvailable ? (
                  <>
                    <div className="mb-4">
                      {isLargeSet ? (
                        // Region/Nation comparator round 2: family-level comparison
                        // has no real region/nation aggregate to fall back on
                        // (academic_geography_aggregate's own family_id scoping was
                        // never fetched for the large-set path this round -- round 1's
                        // own choropleth is whole-school only too, same real scope
                        // limit, not extended here) -- the comparator bar chart over
                        // `group` is meaningless at this scale for the same reason
                        // Sections 1/2 swap theirs out, so it's withheld with an
                        // honest note rather than shown against a near-empty ticked
                        // group. The donut/subject table/trend below are all real,
                        // target-only figures and stay exactly as they are.
                        <p className="text-sm text-neutral-500">Comparison across {setLabel} isn&rsquo;t available for individual subject categories at this scale.</p>
                      ) : (
                        <>
                          <p className="mb-2 text-xs text-neutral-500">
                            Average point score per entry in {familyLabel}, {targetFamilyYear ? academicYearLabel(targetFamilyYear.period) : ""} — {targetProfile.name} compared with {setLabel}.
                          </p>
                          {familyBarPointsWithScore.length > 0 ? (
                            <SortedBarChart points={familyBarPointsWithScore.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.isTarget, value: p.avgPointScore }))} formatValue={(v) => v.toFixed(1)} />
                          ) : (
                            <p className="text-sm text-neutral-500">No real point-score data for {familyLabel} across this set.</p>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-xs text-neutral-500">
                        {familyFirstScore !== null && familyLastScore !== null
                          ? `${targetProfile.name}'s average point score in ${familyLabel} has ${familyLastScore >= familyFirstScore ? "risen" : "fallen"} from ${familyFirstScore.toFixed(1)} to ${familyLastScore.toFixed(1)} since ${academicYearLabel(baseline)}.`
                          : `Not enough real history to show a trend for ${familyLabel} yet.`}
                      </p>
                      <TargetVsAverageTrend periods={allPeriods} targetSeries={familyTargetSeries} averageSeries={allPeriods.map(() => null)} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Not enough of {familyLabel}&rsquo;s qualifications currently convert to a comparable point score to show one here — this is a data gap we&rsquo;re working on, not a
                    sign {targetProfile.name} has no entries in this area.
                  </p>
                )}

                {subjectNames.length > 0 && (
                  <div className="mt-6">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Subject
                      <select
                        className="ml-2 rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-normal normal-case text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                        value={subject ?? ""}
                        onChange={(e) => setSubject(e.target.value || null)}
                      >
                        <option value="">Choose a subject…</option>
                        {subjectNames.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* Real, flagged approximation (this file's own header comment): not
                        filtered to the family selected above -- every real subject for this
                        stage is offered, regardless of category. */}
                    <p className="mb-3 text-xs text-neutral-400">Not yet filtered to {familyLabel} specifically — every real subject for {STAGE_LABEL_SHORT[stage]} is listed.</p>

                    {subject && (
                      <SubjectTable
                        subject={subject}
                        schoolName={targetProfile.name}
                        entryRow={subjectLatestEntry}
                        valueAddedRows={subjectValueAddedRows}
                        ksStage={stage}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Real empty state -- confirmed this reads right once the picker
              // actually moved here (brief's own "confirm that reads right once
              // it's moved, don't assume"): with CategoryFilter now living in this
              // same section, "pick a category above" points at a control that's
              // genuinely right there, not somewhere else on the page.
              <p className="text-sm text-neutral-500">Pick a category above to see its own subject/family breakdown here.</p>
            )}
          </div>
        )}
      </section>

      {/* Subject deep-dive round, Part 3: fixed-position overlay -- rendering it here
          (inside this component's own root, rather than a portal) is fine since it's
          position: fixed and covers the whole viewport regardless of where in the DOM
          it sits; no layout effect on anything around it either way. */}
      <SubjectDeepDiveDrawer
        ks5Bucket={ks5Bucket}
        target={deepDiveTarget}
        onNavigate={setDeepDiveTarget}
        profile={targetProfile}
        comparableGroup={comparableGroup}
        stage={stage}
        setLabel={setLabel}
        urn={targetProfile.urn}
        authToken={authToken}
      />
    </div>
  );
}

const STAGE_LABEL_SHORT: Record<KsStage, string> = { ks2: "KS2", ks4: "GCSE", ks5: "A-level" };

// Subject deep-dive round: SubjectTable extracted to its own file (SubjectTable.tsx)
// so SubjectDeepDiveDrawer.tsx can reuse the exact same real value-added rendering --
// unchanged otherwise.

// Round 2, Part B: this school's own full family mix (every family, one row each) for
// the donut -- the LATEST real period across all of this school's own family rows at
// this stage, not just the drilled-into family's own latest year (families can have
// slightly different real coverage per year for the same school).
function stageFamiliesLatest(profile: AcademicSchoolProfile, stage: KsStage): AcademicFamilyYear[] {
  const all = stageFamilies(profile, stage);
  if (all.length === 0) return [];
  const latestPeriod = Math.max(...all.map((f) => f.period));
  return all.filter((f) => f.period === latestPeriod);
}

const STAGE_ENTRY_NOUN: Record<KsStage, string> = { ks2: "assessments", ks4: "GCSE entries", ks5: "A-level entries" };
