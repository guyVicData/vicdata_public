"use client";

// Subject area section (Graphs page, Section 3 "Subjects"). Redesigned 2026-09-14
// (docs/vicdata_phase3_academic_results_graphs_entries_subjects_comparison_redesign_
// brief_v1.md) from a school-only "how do THIS school's own categories/subjects
// compare with EACH OTHER" view (the original 2026-09-14 round's own deliberate
// scope -- Guy's closing line then, "I will think about how the comparisons work",
// was him deferring exactly this) into a real school-vs-comparison-set view: four
// independently-expandable Card rows, each a left (school) / right (comparison set)
// split, per Guy's own live-confirmed decisions (see the brief's own "Decisions
// confirmed live" section, not re-litigated here).
//
// CATEGORY mode (no family picked): built entirely from data already on every
// profile in the comparison set (stageFamilies/familyYearsFor) -- no new fetch, same
// real data source the pre-existing bottom chart already uses for its own comparator
// bars.
// SUBJECT mode (a family picked): the school's own side is built the same way it
// already was (subjectData, fetched for the target alone). The comparison-set side
// is NOT YET built this round -- extending it needs the same subject-level fetch
// repeated across every comparator school (subjectData is currently fetched only for
// the target, one URN), a genuinely new piece of fetching work the brief itself
// flags as the one real gap, not a client-side computation over what's already
// loaded. The four right-hand panels show a plain, honest "not yet available in
// subject mode" note instead of silently going blank or (worse) computing something
// half-real from only the target's own data.
//
// Real, honest gap carried over unchanged from before this round: subject-LEVEL
// results have no established real figure for KS4 at all (turning per-grade entries
// tallies into one average point score needs the same GCSE_POINTS conversion tables
// ingest/academic_aggregates.py built for the FAMILY rollup, which live only in that
// repo, not ported here). For KS5, subject-level "results" uses the real value-added
// figure instead (a genuinely different, real metric, labelled as such). Subject-level
// Results-trend (%-change) is left out entirely on BOTH sides, deliberately: KS4 has
// no results figure to trend at all, and value-added centres on/crosses zero, where a
// percentage change is mathematically unstable and would mislead rather than inform.
import { useMemo, useState } from "react";
import { stageFamilies, familyYearsFor, type AcademicFamilyYear, type AcademicSchoolProfile, type KsStage, type SubjectEntry, type SubjectValueAdded } from "@/lib/academic-data-view";
import { subjectFamilyColour } from "@/lib/subject-family-colours";
import { academicYearLabel } from "./TrendPill";
import SubjectAreaBarChart from "./SubjectAreaBarChart";
import SubjectAreaDivergingBarChart from "./SubjectAreaDivergingBarChart";
import { Card } from "./GraphsView";

function pctChange(first: number | null, last: number | null): number | null {
  if (first === null || last === null || first === 0) return null;
  return ((last - first) / first) * 100;
}

type Row = {
  id: string;
  label: string;
  candidates: number | null;
  candidatesPeriod: number | null;
  results: number | null;
  candidatesPctChange: number | null;
  resultsPctChange: number | null;
};

// CATEGORY mode: one candidates/results/trend figure per real family, from
// familyYearsFor's own ascending-by-period history -- "first/last real year with a
// value" is the same real methodology this section has always used. Extracted as a
// plain, profile-agnostic function (not a useMemo tied to the target) so the exact
// same real computation applies to every comparator school too, not a second,
// possibly-drifting copy.
function buildCategoryRows(profile: AcademicSchoolProfile, stage: KsStage): Row[] {
  const families = stageFamilies(profile, stage);
  const familyIds = Array.from(new Set(families.map((f) => f.familyId)));
  return familyIds.map((id) => {
    const years = familyYearsFor(profile, stage, id);
    const label = families.find((f) => f.familyId === id)?.familyLabel ?? id;
    const latest = years.length ? years[years.length - 1] : null;
    const entriesFirst = years.find((y) => y.entriesTotal > 0)?.entriesTotal ?? null;
    const entriesLast = [...years].reverse().find((y) => y.entriesTotal > 0)?.entriesTotal ?? null;
    const scoreFirst = years.find((y) => y.avgPointScore !== null)?.avgPointScore ?? null;
    const scoreLast = [...years].reverse().find((y) => y.avgPointScore !== null)?.avgPointScore ?? null;
    return {
      id,
      label,
      candidates: latest?.entriesTotal ?? null,
      candidatesPeriod: latest?.period ?? null,
      results: latest?.avgPointScore ?? null,
      candidatesPctChange: pctChange(entriesFirst, entriesLast),
      resultsPctChange: pctChange(scoreFirst, scoreLast),
    };
  });
}

// SUBJECT mode: real subjects mapped to the active family via
// academic_subject_family_map_lookup (subjectData.subjectFamilyMap). Target only this
// round -- subjectData isn't fetched for comparator schools yet (see this file's own
// header comment).
function buildSubjectRows(
  stage: KsStage,
  familyId: string,
  subjectData: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null,
): Row[] {
  if (!subjectData) return [];
  const namesInFamily = new Set(Object.entries(subjectData.subjectFamilyMap).filter(([, fam]) => fam === familyId).map(([name]) => name));
  const subjectNames = Array.from(
    new Set([...subjectData.entries.map((e) => e.subject), ...subjectData.valueAdded.map((v) => v.subject)].filter((s) => namesInFamily.has(s))),
  );
  return subjectNames.map((name) => {
    const entryRows = subjectData.entries.filter((e) => e.subject === name);
    const periods = Array.from(new Set(entryRows.map((e) => e.period))).sort((a, b) => a - b);
    const latestPeriod = periods.length ? periods[periods.length - 1] : null;
    const firstPeriod = periods.length ? periods[0] : null;
    const candidates = latestPeriod !== null ? entryRows.filter((e) => e.period === latestPeriod).reduce((sum, e) => sum + e.entries, 0) : null;
    const candidatesFirst = firstPeriod !== null ? entryRows.filter((e) => e.period === firstPeriod).reduce((sum, e) => sum + e.entries, 0) : null;

    const vaRows = subjectData.valueAdded.filter((v) => v.subject === name && v.valueAdded !== null);
    const vaLatestPeriod = vaRows.length ? Math.max(...vaRows.map((v) => v.period)) : null;
    const vaAtLatest = vaLatestPeriod !== null ? vaRows.filter((v) => v.period === vaLatestPeriod) : [];
    const results = stage === "ks5" && vaAtLatest.length > 0 ? vaAtLatest.reduce((sum, v) => sum + (v.valueAdded ?? 0), 0) / vaAtLatest.length : null;

    return {
      id: name,
      label: name,
      candidates,
      candidatesPeriod: latestPeriod,
      results,
      candidatesPctChange: pctChange(candidatesFirst, candidates),
      resultsPctChange: null,
    };
  });
}

// Entries/Subjects comparison redesign: real aggregate-trend helper shared by Row B's
// %-change column (sum of real entries across the set, first real period vs latest)
// and Row D's %-change column (average of real avgPointScore across the set, first
// vs latest) -- same "first/last real period WITH a value" methodology every other
// trend figure on this page already uses, just applied to a per-period AGGREGATE
// across profiles instead of one profile's own history. A profile with no real value
// for a given period simply doesn't contribute to that period's aggregate (never
// treated as a real zero), same absence convention as buildCategoryRows itself.
function aggregateFamilyTrend(
  profiles: AcademicSchoolProfile[],
  stage: KsStage,
  familyId: string,
  pick: (y: AcademicFamilyYear) => number | null,
  combine: (values: number[]) => number,
): number | null {
  const byPeriod = new Map<number, number[]>();
  for (const p of profiles) {
    for (const y of familyYearsFor(p, stage, familyId)) {
      const v = pick(y);
      if (v === null) continue;
      const existing = byPeriod.get(y.period);
      if (existing) existing.push(v);
      else byPeriod.set(y.period, [v]);
    }
  }
  const periods = Array.from(byPeriod.keys()).sort((a, b) => a - b);
  if (periods.length === 0) return null;
  return pctChange(combine(byPeriod.get(periods[0])!), combine(byPeriod.get(periods[periods.length - 1])!));
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
const average = (values: number[]) => sum(values) / values.length;

export default function SubjectAreaSection({
  profile,
  comparableGroup,
  stage,
  familyId,
  familyLabel,
  subjectData,
  setLabel,
}: {
  profile: AcademicSchoolProfile;
  // Entries/Subjects comparison redesign: the SAME real comparableGroup (target +
  // ticked/widened, GCSE/KS5-exclusion-aware) every other "vs comparison set" figure
  // on this page already uses -- passed down from AcademicGraphsView, not
  // re-derived here. Self-inclusive (the target is one of its own comparableGroup
  // members), matching the established convention every other average/total on this
  // page already follows (RankingsView's own averageCurrentValue, this file's own
  // Section 02 sameYearBarPoints, etc.) -- not something invented differently here.
  comparableGroup: AcademicSchoolProfile[];
  stage: KsStage;
  familyId: string | null;
  familyLabel: string | null;
  subjectData: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null;
  setLabel: string;
}) {
  // Individual-school selector ("as we did for rolls" -- Guy's own words; checked
  // directly, Rolls doesn't have quite this pattern already built, see the brief's
  // own "individual-school selector" section for why this is new, small UI rather
  // than a straight reuse). Applies to rows C, D's right column, and Row B's own
  // %-change right column -- NOT Row B's own raw market-share row (a single school's
  // share of the total isn't a meaningful "swap to one other school" reading the same
  // way a plain average is -- Guy's own brief, unless asked for once he sees the rest
  // built). null = "Average across the set", the real default.
  const [selectedComparatorUrn, setSelectedComparatorUrn] = useState<string | null>(null);

  const categoryMode = !familyId;
  const rows = useMemo(
    () => (categoryMode ? buildCategoryRows(profile, stage) : buildSubjectRows(stage, familyId, subjectData)),
    [categoryMode, profile, stage, familyId, subjectData],
  );
  const latestPeriod = rows.map((r) => r.candidatesPeriod).find((p): p is number => p !== null) ?? null;
  const colourFor = (id: string) => subjectFamilyColour(familyId ?? id).light[1];

  const candidateItems = rows.filter((r) => r.candidates !== null).map((r) => ({ id: r.id, label: r.label, value: r.candidates as number }));
  const order = [...candidateItems].sort((a, b) => b.value - a.value).map((i) => i.id);
  const labelById = new Map(rows.map((r) => [r.id, r.label]));
  const resultItems = rows.filter((r) => r.results !== null).map((r) => ({ id: r.id, label: r.label, value: r.results as number }));
  const candidatesTrendItems = rows.map((r) => ({ id: r.id, label: r.label, pctChange: r.candidatesPctChange }));
  const resultsTrendItems = categoryMode ? rows.map((r) => ({ id: r.id, label: r.label, pctChange: r.resultsPctChange })) : [];

  const hasAnyResults = resultItems.length > 0;
  const resultsUnavailableNote = familyId
    ? stage === "ks4"
      ? "No real average-point-score figure exists at individual-subject level for GCSE yet -- this needs the same grade-to-points conversion ingest's own family rollup uses, not built for individual subjects."
      : "No real value-added figure for any subject in this category yet."
    : "No real results figure for any category yet.";

  // Category-mode comparison-set data -- real, client-side computation over profiles
  // already fetched (comparableGroup), no new fetch. Gated on categoryMode: subject
  // mode's own comparison-set data needs a fetch this round doesn't build (see this
  // file's own header comment) -- every right-hand panel below shows a plain,
  // honest note instead in that case.
  const comparatorRowsByUrn = useMemo(
    () => (categoryMode ? new Map(comparableGroup.map((p) => [p.urn, buildCategoryRows(p, stage)])) : new Map<string, Row[]>()),
    [categoryMode, comparableGroup, stage],
  );
  // Selector options exclude the target itself -- comparing a school against its own
  // figure has no real meaning here.
  const comparatorOptions = comparableGroup.filter((p) => p.urn !== profile.urn);
  const selectedRows = selectedComparatorUrn ? (comparatorRowsByUrn.get(selectedComparatorUrn) ?? []) : null;
  const selectedComparatorName = selectedComparatorUrn ? (comparatorOptions.find((p) => p.urn === selectedComparatorUrn)?.name ?? null) : null;

  // Row B, right: MARKET SHARE -- school's own entries ÷ sum of every real school in
  // comparableGroup's own entries for that category, ×100. Deliberately self-
  // inclusive (comparableGroup already includes the target -- "this school accounts
  // for X% of all entries across the COMPARED schools", Guy's own wording, decision 2
  // in the brief) -- a genuinely different, TOTAL-based number from Section 01's new
  // comparison pie above (which AVERAGES each school's own % share -- see that
  // component's own header comment for the explicit distinction). No selector here
  // per Guy's own instruction (decision/§ "individual-school selector").
  const marketShareItems = categoryMode
    ? candidateItems.map((item) => {
        const total = comparableGroup.reduce((s, p) => s + (comparatorRowsByUrn.get(p.urn)?.find((r) => r.id === item.id)?.candidates ?? 0), 0);
        return { id: item.id, label: item.label, value: total > 0 ? (item.value / total) * 100 : 0 };
      })
    : [];

  // Row B, right, % change -- STATED ASSUMPTION, not confirmed with Guy (the brief's
  // own flag): the comparison-set's entries % change, computed the same total-based
  // way the brief describes -- sum of real comparableGroup entries at the family's
  // own first real period vs its own latest real period (aggregateFamilyTrend,
  // sum-combine), not tied to a single hardcoded baseline year (mirrors how the
  // school-side row itself resolves "first/last", not a fixed period). When a
  // specific comparator is selected, shows THAT school's own real %-change instead.
  const candidatesTrendComparisonItems = categoryMode
    ? order.map((id) => ({
        id,
        label: labelById.get(id) ?? id,
        pctChange: selectedRows ? (selectedRows.find((r) => r.id === id)?.candidatesPctChange ?? null) : aggregateFamilyTrend(comparableGroup, stage, id, (y) => (y.entriesTotal > 0 ? y.entriesTotal : null), sum),
      }))
    : [];

  // Row C, right: AVERAGE avg point score / value-added across comparableGroup
  // (self-inclusive, same convention as market share's own denominator above), or
  // the one selected school's own real figure.
  const resultComparisonItems = categoryMode
    ? order
        .map((id) => {
          if (selectedRows) {
            const r = selectedRows.find((r) => r.id === id);
            return r && r.results !== null ? { id, label: labelById.get(id) ?? id, value: r.results } : null;
          }
          const values = comparableGroup
            .map((p) => comparatorRowsByUrn.get(p.urn)?.find((r) => r.id === id)?.results)
            .filter((v): v is number => v !== null && v !== undefined);
          return values.length > 0 ? { id, label: labelById.get(id) ?? id, value: average(values) } : null;
        })
        .filter((x): x is { id: string; label: string; value: number } => x !== null)
    : [];

  // Row D, right: comparison-set AVERAGE's own % change (aggregateFamilyTrend,
  // average-combine) or the one selected school's own real %-change. Inherits the
  // EXACT SAME omission this component already applies on the school side
  // (resultsTrendItems above, categoryMode-only) -- KS4 subject level has no results
  // figure to trend at all; KS5 subject level's value-added centres on/crosses zero,
  // where a %-change is mathematically unstable and would mislead. Computing a
  // technically-possible number here just because two averages CAN be divided would
  // contradict the reason the school side already withholds it.
  const resultsTrendComparisonItems = categoryMode
    ? order.map((id) => ({
        id,
        label: labelById.get(id) ?? id,
        pctChange: selectedRows ? (selectedRows.find((r) => r.id === id)?.resultsPctChange ?? null) : aggregateFamilyTrend(comparableGroup, stage, id, (y) => y.avgPointScore, average),
      }))
    : [];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Subject area{familyId && familyLabel ? ` — subjects within ${familyLabel}` : " — categories"}
      </h4>

      {categoryMode && comparatorOptions.length > 0 && (
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Compare against
          <select
            className="ml-2 rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-normal normal-case text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            value={selectedComparatorUrn ?? ""}
            onChange={(e) => setSelectedComparatorUrn(e.target.value || null)}
          >
            <option value="">Average across {setLabel}</option>
            {comparatorOptions.map((p) => (
              <option key={p.urn} value={p.urn}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <Card title={`Candidates${latestPeriod !== null ? `, ${academicYearLabel(latestPeriod)}` : ""}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            <SubjectAreaBarChart items={candidateItems} order={order} colourFor={colourFor} />
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">Market share of {setLabel}</p>
            {categoryMode ? (
              <SubjectAreaBarChart items={marketShareItems} order={order} colourFor={colourFor} formatValue={(v) => `${v.toFixed(0)}%`} />
            ) : (
              <p className="text-sm text-neutral-500">Market share isn&rsquo;t available at individual-subject level yet.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Candidates, % change">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            <SubjectAreaDivergingBarChart items={candidatesTrendItems} order={order} />
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">{selectedComparatorName ?? `Average across ${setLabel}`}</p>
            {categoryMode ? (
              <SubjectAreaDivergingBarChart items={candidatesTrendComparisonItems} order={order} />
            ) : (
              <p className="text-sm text-neutral-500">Not available at individual-subject level yet.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title={`Results${latestPeriod !== null ? `, ${academicYearLabel(latestPeriod)}` : ""}${familyId && stage === "ks5" ? " (value added)" : ""}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            {hasAnyResults ? (
              <SubjectAreaBarChart items={resultItems} order={order} colourFor={colourFor} formatValue={(v) => v.toFixed(1)} />
            ) : (
              <p className="text-sm text-neutral-500">{resultsUnavailableNote}</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">{selectedComparatorName ?? `Average across ${setLabel}`}</p>
            {!categoryMode ? (
              <p className="text-sm text-neutral-500">Not available at individual-subject level yet.</p>
            ) : resultComparisonItems.length > 0 ? (
              <SubjectAreaBarChart items={resultComparisonItems} order={order} colourFor={colourFor} formatValue={(v) => v.toFixed(1)} />
            ) : (
              <p className="text-sm text-neutral-500">No real results figure for any category across {setLabel} yet.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Results, % change">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            {categoryMode && resultsTrendItems.some((r) => r.pctChange !== null) ? (
              <SubjectAreaDivergingBarChart items={resultsTrendItems} order={order} />
            ) : (
              <p className="text-sm text-neutral-500">
                {familyId
                  ? "Not shown at subject level -- results % change would be misleading here (see this component's own header comment)."
                  : "Not enough real history to compute growth/decline."}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">{selectedComparatorName ?? `Average across ${setLabel}`}</p>
            {!categoryMode ? (
              <p className="text-sm text-neutral-500">Not shown at subject level -- results % change would be misleading here (see this component&rsquo;s own header comment).</p>
            ) : resultsTrendComparisonItems.some((r) => r.pctChange !== null) ? (
              <SubjectAreaDivergingBarChart items={resultsTrendComparisonItems} order={order} />
            ) : (
              <p className="text-sm text-neutral-500">Not enough real history to compute growth/decline across {setLabel}.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
