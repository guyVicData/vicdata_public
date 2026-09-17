"use client";

// KS2 domain comparison -- Section 03's real content at KS2, replacing the placeholder
// note that stood here since Section 03 was gated for this stage.
//
// KS2 has no subject taxonomy and never will: every pupil sits the same fixed national
// tests, so there is no "which subjects does this school offer" question. What it does
// have is DOMAIN, and domain is a real comparison axis of exactly the same shape --
// six fixed rows every KS2 school sits, compared against the same self-inclusive
// comparableGroup convention the rest of this page uses.
//
// Deliberately NOT a copy of SubjectAreaSection:
//
//  - No Candidates row. Every domain has the identical fixed cohort; a "candidates"
//    figure would just be roll size, which is the Rolls feature's job, not this one.
//  - No drawer, no third level. Domain is the real floor KS2 has -- there is nothing
//    beneath it to drill into the way a subject opens into a single-subject view.
//  - No shared-axis bar chart across all six domains. Three domains lead with a scaled
//    score (~80-120) and three with a percentage (0-100), so one axis across all six
//    would render two different kinds of number against a common scale and invite a
//    comparison that is not real. Each row carries its own value and its own unit
//    instead; the bar is normalised within its unit group, never across groups.
//
// The metric each domain leads with is the richest real figure DfE publishes for it,
// not one artificial common denominator (confirmed with Guy directly):
//
//   Reading, Maths, GPS          -> average_scaled_score
//   Writing, Science, RWM        -> expected_standard_pupil_percent (no scaled score
//                                   exists for these three -- structural, not a gap)
//
// Verified against real ingested dfe_ks2_attainment rows on hosted production
// (2026-09-17), not assumed from the brief: the six real `subject` strings are
// "Reading", "Writing", "Maths", "Grammar, punctuation and spelling", "Science" and
// "Reading, writing and maths". GPS is stored as the full phrase; "GPS" is a display
// abbreviation only.
//
// No new fetch, no new RPC, no new rollup: every one of these measures already arrives
// on AcademicSchoolProfile.ks2 for the target AND for every comparator, via the
// batched lookupReferenceData call that already feeds the KS2 whole-school headline.

import { Card } from "./GraphsView";
import SubjectAreaDivergingBarChart from "./SubjectAreaDivergingBarChart";
import { academicYearLabel } from "./TrendPill";
import type { AcademicSchoolProfile, AcademicHeadlineYear } from "@/lib/academic-data-view";

type Unit = "scaled" | "percent";

type DomainSpec = {
  id: string; // the real DfE `subject` string, verified live
  label: string; // display label
  metric: string; // the indicator that LEADS for this domain
  unit: Unit;
  higher?: string; // higher_standard_pupil_percent, where it exists
  progress?: string; // progress_measure_score, where it exists
  progressLow?: string;
  progressHigh?: string;
  access?: string; // absence/disapplied indicator, where it exists
  accessLabel?: string;
};

// Column availability below is the real matrix, confirmed live against
// canonical_facts_current rather than taken from the brief: Science has no
// higher-standard figure, GPS has no progress measure, and RWM combined has neither a
// progress measure nor any absence indicator at all.
const KS2_DOMAINS: DomainSpec[] = [
  {
    id: "Reading", label: "Reading", metric: "average_scaled_score", unit: "scaled",
    higher: "higher_standard_pupil_percent",
    progress: "progress_measure_score", progressLow: "progress_measure_lower_conf_interval", progressHigh: "progress_measure_upper_conf_interval",
    access: "absent_or_not_able_to_access_percent", accessLabel: "absent / unable to access",
  },
  {
    id: "Writing", label: "Writing", metric: "expected_standard_pupil_percent", unit: "percent",
    higher: "higher_standard_pupil_percent",
    progress: "progress_measure_score", progressLow: "progress_measure_lower_conf_interval", progressHigh: "progress_measure_upper_conf_interval",
    access: "absent_or_disapplied_percent", accessLabel: "absent / disapplied",
  },
  {
    id: "Maths", label: "Maths", metric: "average_scaled_score", unit: "scaled",
    higher: "higher_standard_pupil_percent",
    progress: "progress_measure_score", progressLow: "progress_measure_lower_conf_interval", progressHigh: "progress_measure_upper_conf_interval",
    access: "absent_or_not_able_to_access_percent", accessLabel: "absent / unable to access",
  },
  {
    id: "Grammar, punctuation and spelling", label: "GPS", metric: "average_scaled_score", unit: "scaled",
    higher: "higher_standard_pupil_percent",
    access: "absent_or_not_able_to_access_percent", accessLabel: "absent / unable to access",
  },
  {
    id: "Science", label: "Science", metric: "expected_standard_pupil_percent", unit: "percent",
    access: "absent_or_disapplied_percent", accessLabel: "absent / disapplied",
  },
  {
    id: "Reading, writing and maths", label: "RWM combined", metric: "expected_standard_pupil_percent", unit: "percent",
    higher: "higher_standard_pupil_percent",
  },
];

// Scaled scores sit in a real ~80-120 band around 100 = the expected standard, so a
// bar drawn from zero would compress every school into an indistinguishable block.
// Drawn from 80 instead, which is the floor of the published scale, not an invention.
const SCALED_FLOOR = 80;
const SCALED_CEILING = 120;

function measureAt(years: AcademicHeadlineYear[], domainId: string, indicator: string): { value: number; period: number } | null {
  const key = `${domainId}::${indicator}`;
  for (let i = years.length - 1; i >= 0; i--) {
    const raw = years[i].measures[key];
    if (typeof raw === "number") return { value: raw, period: years[i].period };
  }
  return null;
}

// First and last real year for one measure, for the %-change row. Only three domains
// have more than a single year of data (Reading and Maths scaled score, RWM expected
// standard); the rest are 2024-only in the real source and correctly yield null here
// rather than a fabricated flat line.
function pctChangeFor(years: AcademicHeadlineYear[], domainId: string, indicator: string): number | null {
  const key = `${domainId}::${indicator}`;
  const points = years
    .map((y) => ({ period: y.period, value: y.measures[key] }))
    .filter((p): p is { period: number; value: number } => typeof p.value === "number")
    .sort((a, b) => a.period - b.period);
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function formatMetric(value: number, unit: Unit): string {
  return unit === "scaled" ? value.toFixed(1) : `${value.toFixed(1)}%`;
}

function barFraction(value: number, unit: Unit): number {
  if (unit === "scaled") return Math.max(0, Math.min(1, (value - SCALED_FLOOR) / (SCALED_CEILING - SCALED_FLOOR)));
  return Math.max(0, Math.min(1, value / 100));
}

function DomainRows({
  years,
  showSupporting,
  colour,
}: {
  years: AcademicHeadlineYear[];
  showSupporting: boolean;
  colour: string;
}) {
  return (
    <div className="space-y-2">
      {KS2_DOMAINS.map((d) => {
        const primary = measureAt(years, d.id, d.metric);
        const higher = d.higher ? measureAt(years, d.id, d.higher) : null;
        const progress = d.progress ? measureAt(years, d.id, d.progress) : null;
        const low = d.progressLow ? measureAt(years, d.id, d.progressLow) : null;
        const high = d.progressHigh ? measureAt(years, d.id, d.progressHigh) : null;
        const access = d.access ? measureAt(years, d.id, d.access) : null;
        return (
          <div key={d.id} className="border-b border-neutral-100 pb-2 last:border-0 dark:border-neutral-900">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-neutral-600 dark:text-neutral-400">{d.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                {primary && <div className="h-full rounded" style={{ width: `${barFraction(primary.value, d.unit) * 100}%`, background: colour }} />}
              </div>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-700 dark:text-neutral-300">
                {primary ? formatMetric(primary.value, d.unit) : "--"}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 pl-30 text-[10px] leading-relaxed text-neutral-400">
              <span>
                {d.unit === "scaled" ? "scaled score, 100 = expected standard" : "% meeting the expected standard"}
                {primary ? ` · ${academicYearLabel(primary.period)}` : ""}
              </span>
              {showSupporting && higher && <span>higher standard {higher.value.toFixed(1)}%</span>}
              {showSupporting && progress && (
                <span>
                  progress {progress.value > 0 ? "+" : ""}{progress.value.toFixed(1)}
                  {low && high ? ` (${low.value.toFixed(1)} to ${high.value.toFixed(1)})` : ""}
                  {` · ${academicYearLabel(progress.period)}`}
                </span>
              )}
              {showSupporting && access && <span>{access.value.toFixed(1)}% {d.accessLabel}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Ks2DomainSection({
  profile,
  comparableGroup,
  setLabel,
}: {
  profile: AcademicSchoolProfile;
  comparableGroup: AcademicSchoolProfile[];
  setLabel: string;
}) {
  const own = profile.ks2 ?? [];
  const hasAnyOwn = KS2_DOMAINS.some((d) => measureAt(own, d.id, d.metric) !== null);

  // Comparison-set average per domain, over the schools that really have that domain's
  // leading measure. Schools without KS2 data at all (a secondary sitting in a mixed
  // comparison set) simply are not counted, rather than being averaged in as zero.
  const comparisonAvg = new Map<string, number>();
  const comparisonCount = new Map<string, number>();
  for (const d of KS2_DOMAINS) {
    const values: number[] = [];
    for (const p of comparableGroup) {
      if (p.urn === profile.urn) continue;
      const m = measureAt(p.ks2 ?? [], d.id, d.metric);
      if (m) values.push(m.value);
    }
    if (values.length > 0) {
      comparisonAvg.set(d.id, values.reduce((s, v) => s + v, 0) / values.length);
      comparisonCount.set(d.id, values.length);
    }
  }
  const comparisonSchools = Math.max(0, ...Array.from(comparisonCount.values()));

  const ownTrend = KS2_DOMAINS.map((d) => ({ id: d.id, label: d.label, pctChange: pctChangeFor(own, d.id, d.metric) }));
  const comparisonTrend = KS2_DOMAINS.map((d) => {
    const changes: number[] = [];
    for (const p of comparableGroup) {
      if (p.urn === profile.urn) continue;
      const c = pctChangeFor(p.ks2 ?? [], d.id, d.metric);
      if (c !== null) changes.push(c);
    }
    return { id: d.id, label: d.label, pctChange: changes.length ? changes.reduce((s, v) => s + v, 0) / changes.length : null };
  });
  const trendableLabels = ownTrend.filter((t) => t.pctChange !== null).map((t) => t.label);
  const untrendableLabels = KS2_DOMAINS.filter((d) => !trendableLabels.includes(d.label)).map((d) => d.label);

  if (!hasAnyOwn) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No real KS2 domain data for {profile.name} yet. KS2 results are published per domain (Reading, Writing, Maths, GPS,
          Science and the combined reading/writing/maths figure) for schools with a Key Stage 2 cohort.
        </p>
      </div>
    );
  }

  const OWN_COLOUR = "#3A7AC8";
  const SET_COLOUR = "#9CA3AF";

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        KS2 is assessed by domain, not subject -- every pupil sits the same six national measures, so domain is the real
        comparison axis at this stage. Each domain leads with the richest figure DfE publishes for it, so three show a
        scaled score and three a percentage; the unit is labelled on every row.
      </p>

      <Card title="Results by domain">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            <DomainRows years={own} showSupporting colour={OWN_COLOUR} />
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">
              Average across {setLabel}
              {comparisonSchools > 0 ? ` (${comparisonSchools} school${comparisonSchools === 1 ? "" : "s"} with KS2 data)` : ""}
            </p>
            {comparisonAvg.size > 0 ? (
              <div className="space-y-2">
                {KS2_DOMAINS.map((d) => {
                  const avg = comparisonAvg.get(d.id);
                  return (
                    <div key={d.id} className="border-b border-neutral-100 pb-2 last:border-0 dark:border-neutral-900">
                      <div className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-xs text-neutral-600 dark:text-neutral-400">{d.label}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                          {avg !== undefined && <div className="h-full rounded" style={{ width: `${barFraction(avg, d.unit) * 100}%`, background: SET_COLOUR }} />}
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-700 dark:text-neutral-300">
                          {avg !== undefined ? formatMetric(avg, d.unit) : "--"}
                        </span>
                      </div>
                      <div className="mt-0.5 pl-30 text-[10px] leading-relaxed text-neutral-400">
                        {d.unit === "scaled" ? "scaled score, 100 = expected standard" : "% meeting the expected standard"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No school in {setLabel} has real KS2 domain data yet.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Results, % change">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            {trendableLabels.length > 0 ? (
              <SubjectAreaDivergingBarChart items={ownTrend} order={KS2_DOMAINS.map((d) => d.id)} />
            ) : (
              <p className="text-sm text-neutral-500">Not enough real history to compute growth or decline.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">Average across {setLabel}</p>
            {comparisonTrend.some((t) => t.pctChange !== null) ? (
              <SubjectAreaDivergingBarChart items={comparisonTrend} order={KS2_DOMAINS.map((d) => d.id)} />
            ) : (
              <p className="text-sm text-neutral-500">Not enough real history across {setLabel}.</p>
            )}
          </div>
        </div>
        {untrendableLabels.length > 0 && (
          // Not a bug and not a loading state: DfE publishes a multi-year run only for
          // the scaled scores and the combined RWM figure. The rest of the KS2 measures
          // exist for the latest year alone in the real source, so there is genuinely
          // nothing to trend and a flat bar would be an invention.
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">
            {untrendableLabels.join(", ")} {untrendableLabels.length === 1 ? "has" : "have"} only one real year of published data,
            so no change can be shown for {untrendableLabels.length === 1 ? "it" : "them"} yet.
          </p>
        )}
      </Card>
    </div>
  );
}
