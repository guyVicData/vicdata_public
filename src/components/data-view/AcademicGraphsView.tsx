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
// §2's Category -> Subject nesting -- NOT actually filtered to that category's own real
// subjects, a flagged approximation: subject_family_map isn't exposed via any RPC this
// round, so the dropdown lists every real subject for the stage, not just the
// selected family's). Deliberately narrower than spec §6 asks for -- entries count
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
  TREND_BASELINE_PERIOD,
  MINIMUM_SUBJECT_N,
  ks4ExclusionTargetSentence,
  ks4ExclusionGroupNote,
  ks4ExclusionWholeGroupSentence,
  dominantKs5Cohort,
  ks5HeadlineMeasureKey,
  ks5HeadlineLabel,
  ks5CohortExclusionNote,
  ks5CohortWholeGroupSentence,
  ks5MeasureFor,
  headlineValueAt,
  latestYear,
  stageYears,
  stageFamilies,
  familyYearsFor,
  latestFamilyYear,
  type AcademicSchoolProfile,
  type AcademicFamilyYear,
  type KsStage,
  type Ks5Cohort,
  type SubjectEntry,
  type SubjectValueAdded,
} from "@/lib/academic-data-view";
import { spreadData, trendBadge } from "@/lib/data-view-cards";
import { academicYearLabel } from "./TrendPill";
import SpreadStrip from "./SpreadStrip";
import DivergingBarChart from "./DivergingBarChart";
import SortedBarChart from "./SortedBarChart";

// Round 2, Part B: a small, self-contained N-slice donut for the entries-share
// breakdown (spec §4, "echoes the gender donut") -- GenderSplitCard.tsx's own Donut is
// hardcoded to exactly two slices (girls/boys), a genuinely different shape of problem
// from an arbitrary-length family list, so this is a new, small implementation rather
// than forcing that component into a shape it wasn't built for (same principle
// TargetVsAverageTrend below already applies to the two-line trend chart).
function familyColour(index: number, total: number): string {
  const hue = Math.round((index / Math.max(total, 1)) * 360);
  return `hsl(${hue}, 55%, 55%)`;
}

function EntriesShareDonut({ families, highlightFamilyId }: { families: AcademicFamilyYear[]; highlightFamilyId: string }) {
  const total = families.reduce((sum, f) => sum + f.entriesTotal, 0);
  if (total <= 0) return <p className="text-sm text-neutral-500">No real entries data for this school under this key stage.</p>;
  let acc = 0;
  const stops: string[] = [];
  const sorted = [...families].sort((a, b) => b.entriesTotal - a.entriesTotal);
  sorted.forEach((f, i) => {
    const start = (acc / total) * 100;
    acc += f.entriesTotal;
    const end = (acc / total) * 100;
    stops.push(`${familyColour(i, sorted.length)} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
  });
  return (
    <div className="flex items-center gap-5">
      <div className="h-24 w-24 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }} />
      <div className="flex flex-col gap-1.5">
        {sorted.map((f, i) => (
          <div key={f.familyId} className={`flex items-center gap-2 text-[13px] ${f.familyId === highlightFamilyId ? "font-semibold text-neutral-900 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: familyColour(i, sorted.length) }} />
            {f.familyLabel} — {((f.entriesTotal / total) * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_EXCLUDED_SET: Set<string> = new Set();

function formatHeadline(stage: KsStage, value: number): string {
  return HEADLINE_UNIT[stage] === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

// Small, dumb two-line trend chart (target vs. ticked-group average) -- same
// "plain inline SVG, no charting library" convention every other chart in this
// directory follows (Sparkline/SpreadStrip's own module comments). Not a shared
// component: this is the one place this codebase needs a two-series line (Rolls'
// own RollTrendsChart draws one line per SCHOOL, not a target-vs-average pair), so a
// small local implementation is clearer than forcing an unrelated existing chart to
// take on a second real shape it wasn't built for.
function TargetVsAverageTrend({ periods, targetSeries, averageSeries }: { periods: number[]; targetSeries: (number | null)[]; averageSeries: (number | null)[] }) {
  const allReal = [...targetSeries, ...averageSeries].filter((v): v is number => v !== null);
  if (allReal.length < 2 || periods.length < 2) return <p className="text-sm text-neutral-500">Not enough history to show a trend.</p>;
  const min = Math.min(...allReal);
  const max = Math.max(...allReal);
  const span = max - min || 1;
  const W = 320;
  const H = 140;
  const padX = 28;
  const padY = 14;
  const xFor = (i: number) => padX + (i / (periods.length - 1)) * (W - padX * 2);
  const yFor = (v: number) => H - padY - ((v - min) / span) * (H - padY * 2);

  function pathFor(series: (number | null)[]): string {
    const segments: string[] = [];
    let current: string[] = [];
    series.forEach((v, i) => {
      if (v === null) {
        if (current.length > 1) segments.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${i === 0 || current.length === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`);
    });
    if (current.length > 1) segments.push(current.join(" "));
    return segments.join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 480 }}>
      <line x1={padX} x2={W - padX} y1={H - padY} y2={H - padY} stroke="currentColor" strokeOpacity={0.15} />
      <path d={pathFor(averageSeries)} fill="none" stroke="#9ca3af" strokeWidth={2} />
      <path d={pathFor(targetSeries)} fill="none" stroke="#dc2626" strokeWidth={2} />
      {periods.map((p, i) => (
        <text key={p} x={xFor(i)} y={H} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.5}>
          {academicYearLabel(p)}
        </text>
      ))}
    </svg>
  );
}

export default function AcademicGraphsView({
  targetProfile,
  tickedProfiles,
  stage,
  startPeriod,
  activeSetLabel,
  familyId = null,
  familyLabel = null,
  subjectData = null,
  ks4ExcludedUrns = EMPTY_EXCLUDED_SET,
  ks5Cohort = null,
  ks5ExcludedUrns = EMPTY_EXCLUDED_SET,
}: {
  targetProfile: AcademicSchoolProfile;
  tickedProfiles: AcademicSchoolProfile[];
  stage: KsStage;
  startPeriod: number;
  activeSetLabel: string | null;
  familyId?: string | null;
  familyLabel?: string | null;
  subjectData?: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] } | null;
  // GCSE exclusion round, Part 2: real URNs excluded from GCSE comparison this render
  // (empty whenever stage !== "ks4", per AcademicDataView's own gating) -- affects
  // Overview/Growth-decline/Context-over-time only; Section 4 (family/subject
  // breakdown) is untouched, a deliberate scope call (see this round's own report --
  // the brief's own Part 2 list names free card/Overview/Rankings/Map, not this
  // section, and entries/point-score are a different real metric class from
  // Attainment 8/EBacc, not necessarily affected by the same DfE exclusion).
  ks4ExcludedUrns?: Set<string>;
  // KS5 qualification-type-awareness round, Part 4: the group-comparison sections
  // below (spread/growth/trend) key their measure on this selected cohort -- the
  // Overview headline NUMBER itself (Part 3) deliberately does NOT use this prop; it
  // always shows the target's own real dominant cohort regardless of the selector,
  // per the brief's own "the number itself, not its spread/growth/trend sub-sections"
  // scoping. ks5ExcludedUrns is this round's analogue of ks4ExcludedUrns, empty
  // whenever stage !== "ks5". Item 10: null is the real default now -- every school
  // in the group is then valued on ITS OWN dominant cohort (ks5MeasureFor) rather
  // than one shared measure across a mixed group.
  ks5Cohort?: Ks5Cohort | null;
  ks5ExcludedUrns?: Set<string>;
}) {
  // Local, not lifted -- this component already remounts (its parent's
  // DataViewErrorBoundary key) whenever stage/family changes, so this resets for free.
  const [subject, setSubject] = useState<string | null>(null);
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  // KS5 qualification-type-awareness round, Part 4: group-comparison sections
  // (spread/growth/trend/same-year bar) key their measure on the selected cohort.
  // Item 10: with no cohort selected (ks5Cohort === null, the new default), there is
  // no single shared measure -- valueFor resolves each school's OWN real dominant
  // cohort via ks5MeasureFor instead of a shared measureKey.
  const baseline = TREND_BASELINE_PERIOD[stage];
  const setLabel = activeSetLabel ?? "the ticked comparator set";

  const valueFor = (p: AcademicSchoolProfile, period?: number) => {
    const years = stageYears(p, stage);
    const y = period !== undefined ? years.find((yy) => yy.period === period) : latestYear(years);
    if (!y) return null;
    const measureKey = stage === "ks5" ? ks5MeasureFor(p, ks5Cohort).measureKey : HEADLINE_MEASURE[stage];
    return headlineValueAt(years, y.period, measureKey);
  };

  // Part 3: the Overview headline NUMBER's own measure is the target's real dominant
  // cohort, deliberately independent of the Part 4 selector above (see this file's
  // own header comment on the ks5Cohort prop) -- so this does NOT reuse valueFor/
  // measureKey. For ks4/ks2 this is identical to the old behaviour (HEADLINE_MEASURE).
  const targetDominantKs5Cohort = stage === "ks5" ? (dominantKs5Cohort(targetProfile) ?? "A level") : null;
  const targetHeadlineMeasureKey = stage === "ks5" ? ks5HeadlineMeasureKey(targetDominantKs5Cohort!) : HEADLINE_MEASURE[stage];
  const targetHeadlineLabel = stage === "ks5" ? ks5HeadlineLabel(targetDominantKs5Cohort!, targetProfile.ks5QualTypes.ib) : HEADLINE_LABEL[stage];
  // Part 4's own group-level label, for the Growth/decline and Context-over-time
  // captions below -- always the SELECTED cohort (not the target's own dominant one).
  // Item 10 design call: with no cohort selected, there is no one real label that
  // covers every school in a mixed group (each may be on a different real dominant
  // cohort) -- rather than naming one arbitrarily, these sections use a generic
  // caption instead (see the two JSX call sites below). This constant stays the
  // specific label whenever an explicit cohort IS selected (unchanged behaviour).
  const groupHeadlineLabel = stage === "ks5" ? (ks5Cohort ? ks5HeadlineLabel(ks5Cohort) : "each school's own qualification-type headline measure") : HEADLINE_LABEL[stage];
  const targetHeadlineValueAt = (period: number) => headlineValueAt(stageYears(targetProfile, stage), period, targetHeadlineMeasureKey);
  const targetLatestYear = latestYear(stageYears(targetProfile, stage));
  const targetCurrent = targetLatestYear ? targetHeadlineValueAt(targetLatestYear.period) : null;
  const targetAnchor = targetHeadlineValueAt(baseline);
  const targetTrendBadge = trendBadge(targetCurrent, targetAnchor);

  // GCSE exclusion round, Part 2 (supersedes stage-1's caveat-alongside-a-number Part
  // D): the excluded set is computed once in AcademicDataView and threaded down here
  // (empty whenever stage !== "ks4"). `comparableGroup` feeds every group-comparison
  // calculation below (spread/growth/trend/same-year bar) -- an excluded school (target
  // or ticked) simply isn't part of any of them, rather than showing with a caveat.
  const ks4TargetExcluded = ks4ExcludedUrns.has(targetProfile.urn);
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
  const ks5TargetExcludedFromGroup = ks5ExcludedUrns.has(targetProfile.urn);
  // Unlike the GCSE round's ks4 pattern, this names the TARGET too when it's the one
  // excluded (rather than a separate dedicated sentence) -- Part 3 above already
  // covers the target's own single-school headline number independently, so the only
  // real gap left to explain here is "why is this school's own dot/bar/line missing
  // from the group charts below," which naming it in the same note answers directly.
  const excludedNamesKs5 = group.filter((p) => ks5ExcludedUrns.has(p.urn)).map((p) => p.name);
  const ks5WholeGroupExcluded = stage === "ks5" && comparableGroup.length === 0;
  // ks5ExcludedUrns (and so excludedNamesKs5/ks5WholeGroupExcluded) is only ever
  // non-empty when the parent has a specific ks5Cohort selected -- the default
  // per-school state does no qualification-type matching at all (item 11) -- so the
  // `?? "A level"` fallbacks below are type-safety-only, never a real path.
  const ks5GroupNote = stage === "ks5" ? ks5CohortExclusionNote(excludedNamesKs5, ks5Cohort ?? "A level") : null;
  // Only one of the two is ever non-null/true for a given render (each gated to its
  // own stage) -- combined once here so the JSX below doesn't need to repeat both
  // stages' own conditionals in every affected section.
  const anyWholeGroupExcluded = wholeGroupExcluded || ks5WholeGroupExcluded;
  const anyGroupNote = ks4GroupNote ?? ks5GroupNote;
  const anyWholeGroupSentence = wholeGroupExcluded ? ks4ExclusionWholeGroupSentence(setLabel) : ks5CohortWholeGroupSentence(setLabel, ks5Cohort ?? "A level");

  const spreadPoints = comparableGroup.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: valueFor(p) }));
  const spread = spreadData(spreadPoints);
  const groupAverage = spread ? spread.points.reduce((s, p) => s + p.value, 0) / spread.points.length : null;

  const growthPoints = comparableGroup.map((p) => {
    const current = valueFor(p);
    const anchor = valueFor(p, baseline);
    return { urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, pctChange: trendBadge(current, anchor)?.pctChange ?? null };
  });

  const allPeriods = Array.from(new Set(comparableGroup.flatMap((p) => stageYears(p, stage).map((y) => y.period))))
    .filter((p) => p >= Math.max(startPeriod, baseline))
    .sort((a, b) => a - b);
  // Excluded from the group means excluded from its own trend line too -- the same
  // methodology issue applies to every one of its real years, not just the latest.
  const targetSeries = ks4TargetExcluded || ks5TargetExcludedFromGroup ? allPeriods.map(() => null) : allPeriods.map((p) => valueFor(targetProfile, p));
  const averageSeries = allPeriods.map((p) => {
    const vals = comparableGroup.map((s) => valueFor(s, p)).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

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
  // real, selectable option) -- NOT filtered to the active family (see this file's own
  // header comment for why: subject_family_map isn't exposed via any RPC this round).
  const subjectNames = subjectData
    ? Array.from(new Set([...subjectData.entries.map((e) => e.subject), ...subjectData.valueAdded.map((v) => v.subject)])).sort((a, b) => a.localeCompare(b))
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

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Overview — {targetHeadlineLabel}</h3>
        {ks4TargetExcluded ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{ks4ExclusionTargetSentence(targetProfile.name, false)}</p>
        ) : targetCurrent !== null ? (
          <>
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">{formatHeadline(stage, targetCurrent)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {targetTrendBadge
                ? `${targetTrendBadge.direction === "up" ? "▲" : targetTrendBadge.direction === "down" ? "▼" : "▬"} ${Math.abs(targetTrendBadge.pctChange).toFixed(0)}% since ${academicYearLabel(baseline)}`
                : `no ${academicYearLabel(baseline)} comparison`}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">No real data available for this school under this key stage.</p>
        )}
        {!ks4TargetExcluded && (anyGroupNote || spread) && (
          <div className="mt-4">
            {anyGroupNote && <p className="mb-2 text-xs italic text-neutral-500">{anyGroupNote}</p>}
            {spread && (
              <>
                <SpreadStrip min={spread.min} max={spread.max} points={spread.points} formatValue={(v) => formatHeadline(stage, v)} />
                {targetCurrent !== null && groupAverage !== null && groupAverage !== 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {Math.abs(((targetCurrent - groupAverage) / groupAverage) * 100).toFixed(0)}% {targetCurrent >= groupAverage ? "above" : "below"} the average of{" "}
                    {formatHeadline(stage, groupAverage)} for {setLabel}
                    {/* KS5 qualification-type-awareness round: this spread strip is
                        keyed on the SELECTED cohort (Part 4), which can genuinely
                        differ from the big number above (the target's own auto-
                        detected dominant cohort, Part 3) -- named explicitly here so
                        the two never read as the same figure when they aren't. */}
                    {stage === "ks5" && ` (${groupHeadlineLabel})`}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Growth / decline since {academicYearLabel(baseline)}</h3>
        {anyWholeGroupExcluded ? (
          <p className="text-sm text-neutral-500">{anyWholeGroupSentence}</p>
        ) : (
          <>
            {anyGroupNote && <p className="mb-2 text-xs italic text-neutral-500">{anyGroupNote}</p>}
            <p className="mb-2 text-xs text-neutral-500">Change in {groupHeadlineLabel}, across {setLabel}.</p>
            <DivergingBarChart points={growthPoints} />
          </>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Context over time</h3>
        {anyWholeGroupExcluded ? (
          <p className="text-sm text-neutral-500">{anyWholeGroupSentence}</p>
        ) : (
          <>
            {anyGroupNote && <p className="mb-2 text-xs italic text-neutral-500">{anyGroupNote}</p>}
            <p className="mb-2 text-xs text-neutral-500">
              {targetProfile.name}&rsquo;s {groupHeadlineLabel} compared with the average of {setLabel}, {allPeriods.length > 0 ? `${academicYearLabel(allPeriods[0])}–${academicYearLabel(allPeriods[allPeriods.length - 1])}` : ""}.
            </p>
            <TargetVsAverageTrend periods={allPeriods} targetSeries={targetSeries} averageSeries={averageSeries} />
            {latestPeriod !== null && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-neutral-500">
                  {groupHeadlineLabel}, {academicYearLabel(latestPeriod)} — {targetProfile.name} compared with {setLabel}.
                </p>
                <SortedBarChart points={sameYearBarPoints} formatValue={(v) => formatHeadline(stage, v)} />
              </div>
            )}
          </>
        )}
      </section>

      {familyId && familyLabel && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Subject/family breakdown — {familyLabel}</h3>

          <div className="mb-4">
            <p className="mb-2 text-xs text-neutral-500">
              {targetFamilyYear ? `${targetFamilyYear.entriesSharePercent ?? "—"}% of ${targetProfile.name}'s ${STAGE_ENTRY_NOUN[stage]} in ${academicYearLabel(targetFamilyYear.period)} were in ${familyLabel}.` : `No real entries data for ${familyLabel} at this school.`}
            </p>
            <EntriesShareDonut families={stageFamiliesLatest(targetProfile, stage)} highlightFamilyId={familyId} />
          </div>

          {familyPointScoreAvailable ? (
            <>
              <div className="mb-4">
                <p className="mb-2 text-xs text-neutral-500">
                  Average point score per entry in {familyLabel}, {targetFamilyYear ? academicYearLabel(targetFamilyYear.period) : ""} — {targetProfile.name} compared with {setLabel}.
                </p>
                {familyBarPointsWithScore.length > 0 ? (
                  <SortedBarChart points={familyBarPointsWithScore.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.isTarget, value: p.avgPointScore }))} formatValue={(v) => v.toFixed(1)} />
                ) : (
                  <p className="text-sm text-neutral-500">No real point-score data for {familyLabel} across this set.</p>
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
        </section>
      )}
    </div>
  );
}

const STAGE_LABEL_SHORT: Record<KsStage, string> = { ks2: "KS2", ks4: "GCSE", ks5: "A-level" };

// Round 2, Part C: the subject-level table (spec §6), folded into Graphs' Overview via
// the Subject picker above rather than a separate page/section, per the spec's own
// instruction. Entries always shown when known; value-added shown per real
// qualification/size-weight row (KS5 only, from dfe_ks5_subject_value_added's own
// self-consistent entries_count -- see this file's header comment for why it's not
// cross-referenced with the raw entries source), each with its real confidence
// interval, framed the same honest way the summary-wordings doc's own Progress 8
// sentence template is -- never a bare score. Small-cohort caveat applies per real row
// (entries or value-added's own entries_count), using MINIMUM_SUBJECT_N (see that
// constant's own comment for the real evidence behind the number).
function SubjectTable({
  subject,
  schoolName,
  entryRow,
  valueAddedRows,
  ksStage,
}: {
  subject: string;
  schoolName: string;
  entryRow: SubjectEntry | null;
  valueAddedRows: SubjectValueAdded[];
  ksStage: KsStage;
}) {
  const hasAnyData = entryRow !== null || valueAddedRows.length > 0;
  if (!hasAnyData) {
    return <p className="text-sm text-neutral-500">No real data for {subject} at {schoolName}.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-400 dark:border-neutral-800">
            <th className="px-3 py-2 text-left font-normal">Qualification</th>
            <th className="px-3 py-2 text-right font-normal">Entries</th>
            {ksStage === "ks5" && <th className="px-3 py-2 text-left font-normal">Value-added</th>}
          </tr>
        </thead>
        <tbody>
          {entryRow && (
            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="px-3 py-2">
                {entryRow.qualificationType} — {academicYearLabel(entryRow.period)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {entryRow.entries}
                {entryRow.entries < MINIMUM_SUBJECT_N && <span className="ml-1 text-amber-600 dark:text-amber-400">†</span>}
              </td>
              {ksStage === "ks5" && <td className="px-3 py-2 text-neutral-400">—</td>}
            </tr>
          )}
          {valueAddedRows.map((v, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-900">
              <td className="px-3 py-2">
                {v.qualificationType} (size {v.sizeWeight}) — {academicYearLabel(v.period)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {v.entriesCount ?? "—"}
                {v.entriesCount !== null && v.entriesCount < MINIMUM_SUBJECT_N && <span className="ml-1 text-amber-600 dark:text-amber-400">†</span>}
              </td>
              <td className="px-3 py-2">
                {v.valueAdded !== null && v.valueAddedLowerCi !== null && v.valueAddedUpperCi !== null
                  ? `${v.valueAdded > 0 ? "+" : ""}${v.valueAdded.toFixed(2)} (likely between ${v.valueAddedLowerCi > 0 ? "+" : ""}${v.valueAddedLowerCi.toFixed(2)} and ${v.valueAddedUpperCi > 0 ? "+" : ""}${v.valueAddedUpperCi.toFixed(2)} once normal year-to-year variation is accounted for)`
                  : "No real value-added figure for this row."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {((entryRow && entryRow.entries < MINIMUM_SUBJECT_N) || valueAddedRows.some((v) => v.entriesCount !== null && v.entriesCount < MINIMUM_SUBJECT_N)) && (
        <p className="border-t border-neutral-200 px-3 py-2 text-xs text-amber-700 dark:border-neutral-800 dark:text-amber-400">
          † Fewer than {MINIMUM_SUBJECT_N} pupils took this subject at {schoolName} — too few to show a meaningful grade breakdown.
        </p>
      )}
    </div>
  );
}

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
