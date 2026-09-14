"use client";

// Subject area section (Graphs page, Section 3 "Subjects"), per Guy's direct brief,
// 2026-09-14: "for this section whole school selected show the categories, if a
// category selected show the subjects within the category... two charts 50:50...
// a) Candidates... b) results... underneath Trends a) Candidates % change b)
// results % change." A NEW block, always visible once Section 3 is open (whether
// or not a category is picked) -- distinct from, and rendered ABOVE, the EXISTING
// family-specific content below it (entries-share donut, per-family point score vs.
// the comparator SET, subject picker/table), which stays exactly as it was: that
// content answers "how does this school's own category compare with OTHER
// SCHOOLS," a genuinely different question from this section's "how do THIS
// school's own categories/subjects compare with EACH OTHER" -- Guy's own closing
// line ("I will think about how the comparisons work") reads as deliberately
// deferring the former, not asking for it to be touched here.
//
// CATEGORY mode (no family picked): built entirely from data already on the
// profile (stageFamilies/familyYearsFor, academic-data-view.ts) -- no new fetch.
// SUBJECT mode (a family picked): needs to know which real subjects belong to that
// family, which academic_subject_family_map_lookup (new this round, vicdata) now
// provides via subjectData.subjectFamilyMap -- previously impossible (this file's
// own header comment on the Subject dropdown used to flag exactly this gap).
//
// Real, honest gap, not silently glossed over: subject-LEVEL results have no
// established real figure for KS4 at all (this file's own header comment already
// explains why -- turning per-grade entries tallies into one average point score
// needs the same GCSE_POINTS conversion tables ingest/academic_aggregates.py built
// for the FAMILY rollup, which live only in that repo, not ported here). For KS5,
// subject-level "results" uses the real value-added figure instead (a genuinely
// different, real metric, labelled as such, not relabelled as if it were the same
// avg-point-score idea family level uses) -- averaged across a subject's own
// multiple real qualification/size-weight rows at its latest period for one
// chartable number (the existing per-subject TABLE below still lists every real row
// separately, unweighted -- this average is a simplification for THIS chart only,
// not a replacement for that detail). Subject-level Results-trend (%-change) is
// left out entirely, deliberately: KS4 has no results figure to trend at all, and
// value-added centres on/crosses zero, where a percentage change is mathematically
// unstable and would mislead rather than inform -- flagged with a plain note in the
// UI rather than computed anyway.
import { useMemo } from "react";
import { stageFamilies, familyYearsFor, type AcademicSchoolProfile, type KsStage, type SubjectEntry, type SubjectValueAdded } from "@/lib/academic-data-view";
import { subjectFamilyColour } from "@/lib/subject-family-colours";
import { academicYearLabel } from "./TrendPill";
import SubjectAreaBarChart from "./SubjectAreaBarChart";
import SubjectAreaDivergingBarChart from "./SubjectAreaDivergingBarChart";

function pctChange(first: number | null, last: number | null): number | null {
  if (first === null || last === null || first === 0) return null;
  return ((last - first) / first) * 100;
}

export default function SubjectAreaSection({
  profile,
  stage,
  familyId,
  familyLabel,
  subjectData,
}: {
  profile: AcademicSchoolProfile;
  stage: KsStage;
  familyId: string | null;
  familyLabel: string | null;
  subjectData: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null;
}) {
  const families = useMemo(() => stageFamilies(profile, stage), [profile, stage]);
  const familyIds = useMemo(() => Array.from(new Set(families.map((f) => f.familyId))), [families]);

  // CATEGORY mode: one candidates/results/trend figure per real family, from
  // familyYearsFor's own ascending-by-period history -- "first/last real year with a
  // value" is the same real methodology Section 3's existing single-family trend
  // (familyFirstScore/familyLastScore) already uses, applied across every family at
  // once instead of just the picked one.
  const categoryRows = useMemo(
    () =>
      familyIds.map((id) => {
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
      }),
    [familyIds, families, profile, stage],
  );

  // SUBJECT mode: real subjects mapped to the active family via
  // academic_subject_family_map_lookup (subjectData.subjectFamilyMap), NOT every
  // subject for the stage regardless of category -- the real gap this round closes.
  const subjectRows = useMemo(() => {
    if (!familyId || !subjectData) return [];
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
      const results =
        stage === "ks5" && vaAtLatest.length > 0 ? vaAtLatest.reduce((sum, v) => sum + (v.valueAdded ?? 0), 0) / vaAtLatest.length : null;

      return {
        id: name,
        label: name,
        candidates,
        candidatesPeriod: latestPeriod,
        results,
        candidatesPctChange: pctChange(candidatesFirst, candidates),
      };
    });
  }, [familyId, subjectData, stage]);

  const rows = familyId ? subjectRows : categoryRows;
  const latestPeriod = rows.map((r) => r.candidatesPeriod).find((p): p is number => p !== null) ?? null;
  const colourFor = (id: string) => subjectFamilyColour(familyId ?? id).light[1];

  const candidateItems = rows.filter((r) => r.candidates !== null).map((r) => ({ id: r.id, label: r.label, value: r.candidates as number }));
  const order = [...candidateItems].sort((a, b) => b.value - a.value).map((i) => i.id);
  const resultItems = rows.filter((r) => r.results !== null).map((r) => ({ id: r.id, label: r.label, value: r.results as number }));
  const candidatesTrendItems = rows.map((r) => ({ id: r.id, label: r.label, pctChange: r.candidatesPctChange }));
  const resultsTrendItems = familyId ? [] : rows.map((r) => ({ id: r.id, label: r.label, pctChange: (r as (typeof categoryRows)[number]).resultsPctChange }));

  const hasAnyResults = resultItems.length > 0;
  const resultsUnavailableNote = familyId
    ? stage === "ks4"
      ? "No real average-point-score figure exists at individual-subject level for GCSE yet -- this needs the same grade-to-points conversion ingest's own family rollup uses, not built for individual subjects."
      : "No real value-added figure for any subject in this category yet."
    : "No real results figure for any category yet.";

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Subject area{familyId && familyLabel ? ` — subjects within ${familyLabel}` : " — categories"}
      </h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-neutral-500">
            Candidates{latestPeriod !== null ? `, ${academicYearLabel(latestPeriod)}` : ""}
          </p>
          <SubjectAreaBarChart items={candidateItems} order={order} colourFor={colourFor} />
        </div>
        <div>
          <p className="mb-2 text-xs text-neutral-500">
            Results{latestPeriod !== null ? `, ${academicYearLabel(latestPeriod)}` : ""}
            {familyId && stage === "ks5" ? " (value added)" : ""}
          </p>
          {hasAnyResults ? (
            <SubjectAreaBarChart items={resultItems} order={order} colourFor={colourFor} formatValue={(v) => v.toFixed(1)} />
          ) : (
            <p className="text-sm text-neutral-500">{resultsUnavailableNote}</p>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-neutral-500">Candidates, % change</p>
          <SubjectAreaDivergingBarChart items={candidatesTrendItems} order={order} />
        </div>
        <div>
          <p className="mb-2 text-xs text-neutral-500">Results, % change</p>
          {!familyId && resultsTrendItems.some((r) => r.pctChange !== null) ? (
            <SubjectAreaDivergingBarChart items={resultsTrendItems} order={order} />
          ) : (
            <p className="text-sm text-neutral-500">
              {familyId
                ? "Not shown at subject level -- results % change would be misleading here (see this component's own header comment)."
                : "Not enough real history to compute growth/decline."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
