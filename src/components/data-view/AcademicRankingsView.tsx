"use client";

// Academic Results Rankings (frontend build brief §5): single active-metric ranking
// (the headline measure for the selected key stage) + rank-over-time, same real shape
// as Rolls' own RankingsView.tsx (rankDescendingWithTies/chunkedRankingDisplay/
// trendBadge -- all confirmed genuinely generic, reused directly) but built as its own
// component since DataViewSchoolProfile there is Rolls-specific end to end. Ticked-
// comparator-set only -- no Region/Nation scale this round (Part C).
//
// Open question from the brief (§5, §9), decided here: subject-family metrics do NOT
// get their own Rankings entry -- only the whole-school headline measure is ranked,
// consistent with Rolls' own deliberate single-metric cut-down. Family/subject
// comparisons live in Graphs only (this round's own scope reduction, see the build
// report -- Graphs' own family breakdown section wasn't built either, so this is
// currently moot in practice, but the decision stands for when it is).

import {
  HEADLINE_MEASURE,
  HEADLINE_LABEL,
  HEADLINE_UNIT,
  TREND_BASELINE_PERIOD,
  ks4ExclusionTargetSentence,
  ks4ExclusionGroupNote,
  ks4ExclusionWholeGroupSentence,
  ks5HeadlineMeasureKey,
  ks5HeadlineLabel,
  ks5CohortExclusionNote,
  ks5CohortWholeGroupSentence,
  headlineValueAt,
  latestYear,
  stageYears,
  type AcademicSchoolProfile,
  type KsStage,
  type Ks5Cohort,
} from "@/lib/academic-data-view";
import { rankDescendingWithTies, trendBadge, chunkedRankingDisplay, type RankedEntry } from "@/lib/data-view-cards";
import { academicYearLabel } from "./TrendPill";

const EMPTY_EXCLUDED_SET: Set<string> = new Set();

function formatHeadline(stage: KsStage, value: number): string {
  return HEADLINE_UNIT[stage] === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

function rankAcrossPeriods(
  group: AcademicSchoolProfile[],
  periods: number[],
  stage: KsStage,
  measureKey: string,
): Map<string, (number | null)[]> {
  const ranksByUrn = new Map<string, (number | null)[]>(group.map((p) => [p.urn, periods.map(() => null)]));
  periods.forEach((period, i) => {
    const entries = group.map((p) => ({
      urn: p.urn,
      name: p.name,
      isTarget: false,
      value: headlineValueAt(stageYears(p, stage), period, measureKey),
    }));
    const { ranked } = rankDescendingWithTies(entries);
    ranked.forEach((r) => {
      ranksByUrn.get(r.urn)![i] = r.rank;
    });
  });
  return ranksByUrn;
}

export default function AcademicRankingsView({
  targetProfile,
  tickedProfiles,
  stage,
  startPeriod,
  activeSetLabel,
  ks4ExcludedUrns = EMPTY_EXCLUDED_SET,
  ks5Cohort = "A level",
  ks5ExcludedUrns = EMPTY_EXCLUDED_SET,
}: {
  targetProfile: AcademicSchoolProfile;
  tickedProfiles: AcademicSchoolProfile[];
  stage: KsStage;
  startPeriod: number;
  activeSetLabel?: string | null;
  // GCSE exclusion round, Part 2 -- see AcademicGraphsView's own header comment for
  // the same prop.
  ks4ExcludedUrns?: Set<string>;
  // KS5 qualification-type-awareness round, Part 4 -- see AcademicGraphsView's own
  // header comment for the same props. Unlike Graphs, Rankings has no separate
  // "single-school, no comparison" concept (a ranking is inherently a group
  // comparison), so everything here -- not just spread/growth/trend -- keys on the
  // selected cohort; there's no Part-3-style "always the target's own dominant
  // cohort" number anywhere in this view.
  ks5Cohort?: Ks5Cohort;
  ks5ExcludedUrns?: Set<string>;
}) {
  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  const measureKey = stage === "ks5" ? ks5HeadlineMeasureKey(ks5Cohort) : HEADLINE_MEASURE[stage];
  const headlineLabel = stage === "ks5" ? ks5HeadlineLabel(ks5Cohort) : HEADLINE_LABEL[stage];
  const setLabel = activeSetLabel ?? "the ticked comparator set";

  const ks4TargetExcluded = ks4ExcludedUrns.has(targetProfile.urn);
  const comparableGroup = group.filter((p) => !ks4ExcludedUrns.has(p.urn) && !ks5ExcludedUrns.has(p.urn));
  const excludedTickedNames = group.filter((p) => ks4ExcludedUrns.has(p.urn) && p.urn !== targetProfile.urn).map((p) => p.name);
  const wholeGroupExcluded = stage === "ks4" && comparableGroup.length === 0;
  const ks4GroupNote = stage === "ks4" ? ks4ExclusionGroupNote(excludedTickedNames) : null;

  // Same "name the target too" reasoning as AcademicGraphsView's own ks5 note --
  // there's no dedicated target-excluded sentence for KS5 here (unlike ks4's), so the
  // group note is the only place this gets explained.
  const excludedNamesKs5 = group.filter((p) => ks5ExcludedUrns.has(p.urn)).map((p) => p.name);
  const ks5WholeGroupExcluded = stage === "ks5" && comparableGroup.length === 0;
  const ks5GroupNote = stage === "ks5" ? ks5CohortExclusionNote(excludedNamesKs5, ks5Cohort) : null;
  const anyWholeGroupExcluded = wholeGroupExcluded || ks5WholeGroupExcluded;
  const anyGroupNote = ks4GroupNote ?? ks5GroupNote;
  const anyWholeGroupSentence = wholeGroupExcluded ? ks4ExclusionWholeGroupSentence(setLabel) : ks5CohortWholeGroupSentence(setLabel, ks5Cohort);

  const currentEntries = comparableGroup.map((p) => {
    const years = stageYears(p, stage);
    const y = latestYear(years);
    return {
      urn: p.urn,
      name: p.name,
      isTarget: p.urn === targetProfile.urn,
      value: y ? headlineValueAt(years, y.period, measureKey) : null,
    };
  });
  const groupInScope = currentEntries.filter((e) => e.value !== null || e.isTarget).map((e) => comparableGroup.find((p) => p.urn === e.urn)!);
  const { ranked, targetRank, total } = rankDescendingWithTies(currentEntries);
  const targetCurrentValue = currentEntries.find((e) => e.isTarget)?.value ?? null;
  const averageCurrentValue = total > 0 ? ranked.reduce((sum, r) => sum + r.value, 0) / total : null;

  const baseline = TREND_BASELINE_PERIOD[stage];
  const allPeriods = Array.from(new Set(groupInScope.flatMap((p) => stageYears(p, stage).map((y) => y.period))))
    .filter((p) => p >= Math.max(startPeriod, baseline))
    .sort((a, b) => a - b);
  const ranksByUrn = rankAcrossPeriods(groupInScope, allPeriods, stage, measureKey);
  const targetRankSeries = ranksByUrn.get(targetProfile.urn) ?? [];
  const realRanks = targetRankSeries.map((r, i) => (r !== null ? { rank: r, period: allPeriods[i] } : null)).filter((x): x is { rank: number; period: number } => x !== null);
  const avgRank = realRanks.length > 0 ? realRanks.reduce((s, r) => s + r.rank, 0) / realRanks.length : null;
  const first = realRanks[0] ?? null;
  const last = realRanks[realRanks.length - 1] ?? null;

  const growthEntries = comparableGroup.map((p) => {
    const years = stageYears(p, stage);
    const current = headlineValueAt(years, latestYear(years)?.period ?? -1, measureKey);
    const anchor = headlineValueAt(years, baseline, measureKey);
    return { urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: trendBadge(current, anchor)?.pctChange ?? null };
  });
  const { ranked: growthRanked, targetRank: growthTargetRank, total: growthTotal } = rankDescendingWithTies(growthEntries);

  const pctVsAverage = targetCurrentValue !== null && averageCurrentValue !== null && averageCurrentValue !== 0 ? ((targetCurrentValue - averageCurrentValue) / averageCurrentValue) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">This school&rsquo;s position</h3>
          {ks4TargetExcluded ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{ks4ExclusionTargetSentence(targetProfile.name, false)}</p>
          ) : targetRank !== null ? (
            <>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
                #{targetRank} of {total} schools
              </p>
              {targetCurrentValue !== null && (
                <p className="mt-1 text-xs text-neutral-500">
                  {formatHeadline(stage, targetCurrentValue)} — {headlineLabel}
                  {pctVsAverage !== null && averageCurrentValue !== null && (
                    <> ({Math.abs(pctVsAverage).toFixed(0)}% {pctVsAverage >= 0 ? "above" : "below"} the average of {formatHeadline(stage, averageCurrentValue)})</>
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">No real data available for this school under this key stage.</p>
          )}
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Position over time</h3>
          {ks4TargetExcluded ? (
            <p className="text-sm text-neutral-500">{ks4ExclusionTargetSentence(targetProfile.name, false)}</p>
          ) : avgRank !== null && first && last ? (
            <>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
                Average rank #{avgRank.toFixed(1)}, {academicYearLabel(first.period)}–{academicYearLabel(last.period)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {first.period !== last.period
                  ? `${last.rank < first.rank ? "Risen" : last.rank > first.rank ? "Fallen" : "Steady"} from #${first.rank} (${academicYearLabel(first.period)}) to #${last.rank} (${academicYearLabel(last.period)})`
                  : `Ranked #${last.rank} (${academicYearLabel(last.period)})`}
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Not enough real data across this period to show a trend.</p>
          )}
        </div>
      </div>

      {anyWholeGroupExcluded ? (
        <p className="text-sm text-neutral-500">{anyWholeGroupSentence}</p>
      ) : (
        <>
          {anyGroupNote && <p className="text-xs italic text-neutral-500">{anyGroupNote}</p>}

          <RankTable title={headlineLabel} ranked={ranked} targetRank={targetRank} total={total} format={(v) => formatHeadline(stage, v)} />

          {allPeriods.length > 0 && (
            <ComparisonOverTimeTable ranked={ranked} targetRank={targetRank} targetUrn={targetProfile.urn} periods={allPeriods} ranksByUrn={ranksByUrn} />
          )}

          <RankTable
            title={`Growth / decline ranking since ${academicYearLabel(baseline)}`}
            ranked={growthRanked}
            targetRank={growthTargetRank}
            total={growthTotal}
            format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
          />
        </>
      )}
    </div>
  );
}

function RankTable({ title, ranked, targetRank, total, format }: { title: string; ranked: RankedEntry[]; targetRank: number | null; total: number; format: (v: number) => string }) {
  if (total === 0) {
    return (
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
        <p className="text-sm text-neutral-500">No real data available for this metric in the current set.</p>
      </section>
    );
  }
  const chunks = chunkedRankingDisplay(ranked, targetRank);
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {targetRank !== null && (
        <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          Ranks <strong>#{targetRank}</strong> of {total}
        </p>
      )}
      {chunks.map((chunk, i) => (
        <div key={chunk.label ?? "all"} className={i > 0 ? "mt-3" : undefined}>
          {chunk.label && chunks.length > 1 && <p className="mb-1 text-xs text-neutral-400">{chunk.label}</p>}
          <table className="w-full text-sm">
            <tbody>
              {chunk.rows.map((r) => (
                <tr key={r.urn} className={r.isTarget ? "border-t border-neutral-100 bg-red-50 font-medium dark:border-neutral-800 dark:bg-red-950/40" : "border-t border-neutral-100 dark:border-neutral-800"}>
                  <td className={`w-10 py-1.5 text-neutral-500 ${r.isTarget ? "border-l-4 border-l-red-500 pl-1.5" : ""}`}>#{r.rank}</td>
                  <td className="py-1.5">
                    {r.name}
                    {r.isTarget && " (this school)"}
                  </td>
                  <td className="py-1.5 text-right font-medium">{format(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function ComparisonOverTimeTable({
  ranked,
  targetRank,
  targetUrn,
  periods,
  ranksByUrn,
}: {
  ranked: RankedEntry[];
  targetRank: number | null;
  targetUrn: string;
  periods: number[];
  ranksByUrn: Map<string, (number | null)[]>;
}) {
  if (ranked.length === 0 || periods.length === 0) return null;
  const chunks = chunkedRankingDisplay(ranked, targetRank);
  const avgRankFor = (urn: string) => {
    const real = (ranksByUrn.get(urn) ?? []).filter((r): r is number => r !== null);
    return real.length > 0 ? real.reduce((s, r) => s + r, 0) / real.length : null;
  };
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Rank, {academicYearLabel(periods[0])}–{academicYearLabel(periods[periods.length - 1])}
      </h3>
      <div className="overflow-x-auto">
        {chunks.map((chunk, i) => (
          <div key={chunk.label ?? "all"} className={i > 0 ? "mt-3" : undefined}>
            {chunk.label && chunks.length > 1 && <p className="mb-1 text-xs text-neutral-400">{chunk.label}</p>}
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="text-xs text-neutral-400">
                  <th className="w-10 py-1 text-left font-normal">#</th>
                  <th className="py-1 text-left font-normal">School</th>
                  {periods.map((p) => (
                    <th key={p} className="px-2 py-1 text-right font-normal">
                      {academicYearLabel(p)}
                    </th>
                  ))}
                  <th className="py-1 pl-2 text-right font-normal">Avg rank</th>
                </tr>
              </thead>
              <tbody>
                {chunk.rows.map((r) => {
                  const series = ranksByUrn.get(r.urn) ?? [];
                  const avg = avgRankFor(r.urn);
                  return (
                    <tr key={r.urn} className={r.urn === targetUrn ? "border-t border-neutral-100 bg-red-50 font-medium dark:border-neutral-800 dark:bg-red-950/40" : "border-t border-neutral-100 dark:border-neutral-800"}>
                      <td className={`w-10 py-1.5 text-neutral-500 ${r.urn === targetUrn ? "border-l-4 border-l-red-500 pl-1.5" : ""}`}>#{r.rank}</td>
                      <td className="py-1.5">
                        {r.name}
                        {r.urn === targetUrn && " (this school)"}
                      </td>
                      {series.map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-right text-neutral-600 dark:text-neutral-400">
                          {v !== null ? `#${v}` : "—"}
                        </td>
                      ))}
                      <td className="py-1.5 pl-2 text-right font-medium">{avg !== null ? `#${avg.toFixed(1)}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
