"use client";

// Subject area section (Graphs page, Section 3 "Subjects"). Redesigned 2026-09-14
// (docs/vicdata_phase3_academic_results_graphs_entries_subjects_comparison_redesign_
// brief_v1.md) into a real school-vs-comparison-set view: four independently-
// expandable Card rows, each a left (school) / right (comparison set) split.
//
// Subject deep-dive round (docs/vicdata_phase3_academic_results_subject_deep_dive_
// frontend_brief_v1.md, Part 1): closes the subject-mode comparison-set gap the last
// round deliberately deferred. CATEGORY mode is unchanged (buildCategoryRows, no new
// fetch). SUBJECT mode now has real comparison-set data too, from two real sources
// threaded down from AcademicDataView.tsx's own new batched fetch
// (comparatorSubjectByUrn/comparatorSubjectHeadlineByUrn):
//   - vicdata's new academic_subject_headline rollup (multi-period back to 2020/21,
//     real avg_point_score -- this closes the "no real figure exists at individual-
//     subject level for GCSE" gap this file used to flag, for KS4) -- the primary
//     source for candidates/results/both trends at subject grain now.
//   - Raw dfe_ks4_subject_entries/dfe_ks5_subject_results facts (modern-only,
//     2023/24 on) -- still the only source for KS5's real value-added figure (no
//     rollup equivalent for that metric), so it stays layered in for KS5 Results
//     specifically, unchanged from before this round.
// The target's OWN rows still read from the existing, fast, single-URN subjectData
// fetch (not the new heavier batched one) -- unchanged latency for the school side;
// the new batched fetch only slows the COMPARISON side, which had no data at all
// before this round.
import { useCallback, useMemo, useState } from "react";
import { stageFamilies, familyYearsFor, type AcademicFamilyYear, type AcademicSchoolProfile, type KsStage, type SubjectEntry, type SubjectValueAdded, type AcademicSubjectHeadlineEntry } from "@/lib/academic-data-view";
import { bucketFor, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";
import { subjectFamilyColour } from "@/lib/subject-family-colours";
import { academicYearLabel } from "./TrendPill";
import SubjectAreaBarChart from "./SubjectAreaBarChart";
import SubjectAreaDivergingBarChart from "./SubjectAreaDivergingBarChart";
import { Card } from "./GraphsView";

function pctChange(first: number | null, last: number | null): number | null {
  if (first === null || last === null || first === 0) return null;
  return ((last - first) / first) * 100;
}

export type SubjectRow = {
  id: string;
  label: string;
  // The real subject name, kept separate from `label` because `label` may carry a
  // disambiguating qualification suffix. null qualificationType means "every
  // qualification type for this subject, summed" (buildSubjectRows' "subject" mode).
  subject?: string;
  qualificationType?: string | null;
  candidates: number | null;
  candidatesPeriod: number | null;
  results: number | null;
  candidatesPctChange: number | null;
  resultsPctChange: number | null;
};

// CATEGORY mode: one candidates/results/trend figure per real family, from
// familyYearsFor's own ascending-by-period history -- "first/last real year with a
// value" is the same real methodology this section has always used. Extracted as a
// plain, profile-agnostic function so the exact same real computation applies to
// every comparator school too, not a second, possibly-drifting copy.
export function buildCategoryRows(profile: AcademicSchoolProfile, stage: KsStage): SubjectRow[] {
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

// The one qualification type per stage that actually carries a points-based score.
// Confirmed live against ingested data: only these two feed avg_point_score into the
// rollup, so only their row can honestly claim the headline-derived `results` figure.
// Every other qualification type at the same stage has real entries and no score.
const POINTS_BEARING_QUALIFICATION: Record<KsStage, string | null> = {
  ks2: null,
  ks4: "GCSE (9-1) Full Course",
  ks5: "GCE A level",
};

// Trims the DfE band/grade-structure suffix off a qualification label so a
// disambiguating row label stays readable: "BTEC National Foundation Diploma L3 -
// Band H - P-D*" becomes "BTEC National Foundation Diploma L3". Purely cosmetic.
function shortQualificationLabel(qualificationType: string): string {
  return qualificationType.split(" - Band ")[0].replace(/\s*\(any AO and grade structure\)/i, "").trim();
}

// SUBJECT mode: real subjects mapped to the active family via
// academic_subject_family_map_lookup (subjectData.subjectFamilyMap) for candidates
// (raw facts), with results/resultsPctChange enriched from vicdata's own
// academic_subject_headline rollup (headlineBySubject) for KS4 -- real, multi-period.
// KS5 stays on the real value-added figure (a genuinely different, real metric,
// labelled as such, not relabelled as if it were the same avg-point-score idea family
// level uses) -- resultsPctChange for KS5 stays null, deliberately: value-added
// centres on/crosses zero, where a %-change is mathematically unstable and would
// mislead.
//
// `groupBy` exists because two callers want genuinely different things from the same
// inputs, and conflating them was the bug:
//
//   "qualification" -- one row per (subject, qualification type). A college running
//       both BTEC and A-level in the same subject gets two rows, not one merged row.
//       Used by the subject-mode list, where the qualification IS the distinction the
//       reader is looking at.
//   "subject"       -- one row per subject, entries summed across qualification types.
//       The pre-existing behaviour, kept exactly, for the deep-dive drawer: the drawer
//       resolves a subject against academic_subject_headline, and that rollup has no
//       qualification dimension at all, so a per-qualification row there would have
//       nothing to reconcile against.
//
// Real bug this fixes (Capital City College, URN 130421, verified live 2026-09-18):
// grouping by subject name alone merged qualification types that share a name. Its
// 2024 "Psychology" row summed 207 A-level entries with 36 BTEC ones, so a reader
// looking at BTEC provision saw a row that was 85% A-level. "Business Studies" merged
// four BTEC bands with 129 A-level entries into a single 515-entry row. Every one of
// that college's 38 BTEC subject names IS present in subjectFamilyMap, so nothing was
// being filtered out -- the rows were being silently combined, which is a different
// bug with a different fix.
export function buildSubjectRows(
  stage: KsStage,
  familyId: string,
  subjectData: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null,
  headlineBySubject: Map<string, AcademicSubjectHeadlineEntry[]>,
  groupBy: "subject" | "qualification" = "subject",
): SubjectRow[] {
  if (!subjectData) return [];
  const namesInFamily = new Set(Object.entries(subjectData.subjectFamilyMap).filter(([, fam]) => fam === familyId).map(([name]) => name));
  const inFamily = (s: string) => namesInFamily.has(s);
  const entriesInFamily = subjectData.entries.filter((e) => inFamily(e.subject));
  const valueAddedInFamily = subjectData.valueAdded.filter((v) => inFamily(v.subject));

  // One group per row. In "subject" mode the qualification part of the key is fixed,
  // which reproduces the previous single-row-per-subject behaviour exactly.
  const groups = new Map<string, { subject: string; qualificationType: string | null }>();
  for (const e of entriesInFamily) {
    const qual = groupBy === "qualification" ? e.qualificationType : null;
    groups.set(`${qual ?? ""}\u0000${e.subject}`, { subject: e.subject, qualificationType: qual });
  }
  for (const v of valueAddedInFamily) {
    const qual = groupBy === "qualification" ? v.qualificationType : null;
    groups.set(`${qual ?? ""}\u0000${v.subject}`, { subject: v.subject, qualificationType: qual });
  }

  // Only disambiguate a label when this school really does run the same subject under
  // more than one qualification type -- otherwise every row would carry a noisy suffix
  // it does not need, and the common single-qualification case would read differently
  // from before for no reason.
  const qualsPerSubject = new Map<string, Set<string>>();
  if (groupBy === "qualification") {
    for (const g of groups.values()) {
      if (!g.qualificationType) continue;
      const set = qualsPerSubject.get(g.subject) ?? new Set<string>();
      set.add(g.qualificationType);
      qualsPerSubject.set(g.subject, set);
    }
  }

  return Array.from(groups.entries()).map(([key, { subject: name, qualificationType }]) => {
    const matches = <T extends { subject: string; qualificationType: string }>(r: T) =>
      r.subject === name && (qualificationType === null || r.qualificationType === qualificationType);

    const entryRows = entriesInFamily.filter(matches);
    const periods = Array.from(new Set(entryRows.map((e) => e.period))).sort((a, b) => a - b);
    const latestPeriod = periods.length ? periods[periods.length - 1] : null;
    const firstPeriod = periods.length ? periods[0] : null;
    const candidates = latestPeriod !== null ? entryRows.filter((e) => e.period === latestPeriod).reduce((sum, e) => sum + e.entries, 0) : null;
    const candidatesFirst = firstPeriod !== null ? entryRows.filter((e) => e.period === firstPeriod).reduce((sum, e) => sum + e.entries, 0) : null;

    let results: number | null = null;
    let resultsPctChange: number | null = null;
    if (stage === "ks5") {
      const vaRows = valueAddedInFamily.filter((v) => matches(v) && v.valueAdded !== null);
      const vaLatestPeriod = vaRows.length ? Math.max(...vaRows.map((v) => v.period)) : null;
      const vaAtLatest = vaLatestPeriod !== null ? vaRows.filter((v) => v.period === vaLatestPeriod) : [];
      results = vaAtLatest.length > 0 ? vaAtLatest.reduce((sum, v) => sum + (v.valueAdded ?? 0), 0) / vaAtLatest.length : null;
    } else {
      // headlineBySubject comes from the rollup, which has no qualification dimension,
      // so its score describes the points-bearing qualification alone. Attaching it to
      // a BTEC row would put a GCSE score on a BTEC line.
      const scoreBelongsHere = qualificationType === null || qualificationType === POINTS_BEARING_QUALIFICATION[stage];
      const years = scoreBelongsHere ? [...(headlineBySubject.get(name) ?? [])].sort((a, b) => a.period - b.period) : [];
      if (years.length > 0) {
        results = years[years.length - 1].avgPointScore;
        const scoreFirst = years.find((y) => y.avgPointScore !== null)?.avgPointScore ?? null;
        const scoreLast = [...years].reverse().find((y) => y.avgPointScore !== null)?.avgPointScore ?? null;
        resultsPctChange = pctChange(scoreFirst, scoreLast);
      }
    }

    const needsSuffix = qualificationType !== null && (qualsPerSubject.get(name)?.size ?? 0) > 1;
    return {
      id: qualificationType === null ? name : key,
      label: needsSuffix ? `${name} (${shortQualificationLabel(qualificationType)})` : name,
      subject: name,
      qualificationType,
      candidates,
      candidatesPeriod: latestPeriod,
      results,
      candidatesPctChange: pctChange(candidatesFirst, candidates),
      resultsPctChange,
    };
  });
}

// Real aggregate-trend helper shared by Row B's %-change column (sum of real entries
// across the set, first real period vs latest) and Row D's %-change column (average
// of real avgPointScore across the set, first vs latest) -- same "first/last real
// period WITH a value" methodology every other trend figure on this page already
// uses, just applied to a per-period AGGREGATE across profiles instead of one
// profile's own history. A profile with no real value for a given period simply
// doesn't contribute to that period's aggregate (never treated as a real zero).
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

// Subject deep-dive round, Part 1: the same real aggregate-trend shape as
// aggregateFamilyTrend above, but over a Map<urn, SubjectRow[]> (subject mode's own
// real data shape, one entry per comparator per subject) instead of re-deriving from
// familyYearsFor -- subject-mode rows don't have a per-period history to walk the
// same way (each row is already "latest" plus a pre-computed pctChange), so this
// aggregates the REAL first/last VALUES each row already carries (candidates or
// results) via each comparator's own row for this one subject id.
function aggregateSubjectTrend(rowsByUrn: Map<string, SubjectRow[]>, id: string, pick: (r: SubjectRow) => number | null, combine: (values: number[]) => number): number | null {
  const values = Array.from(rowsByUrn.values())
    .map((rows) => rows.find((r) => r.id === id))
    .map((r) => (r ? pick(r) : null))
    .filter((v): v is number => v !== null);
  return values.length > 0 ? combine(values) : null;
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
  comparatorSubjectByUrn,
  comparatorSubjectHeadlineByUrn,
  setLabel,
  onSelectSubjectArea,
  ks5Bucket = null,
}: {
  profile: AcademicSchoolProfile;
  comparableGroup: AcademicSchoolProfile[];
  stage: KsStage;
  familyId: string | null;
  familyLabel: string | null;
  subjectData: { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; subjectFamilyMap: Record<string, string> } | null;
  // Subject deep-dive round, Part 1: real per-comparator subject data -- see this
  // file's own header comment for the two real sources and why both still coexist.
  comparatorSubjectByUrn: Map<string, { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] }>;
  comparatorSubjectHeadlineByUrn: Map<string, AcademicSubjectHeadlineEntry[]>;
  setLabel: string;
  // Subject deep-dive round, Part 3: any bar across all four rows is a real click
  // target opening the navigation drawer -- a category bar (category mode) opens it
  // at category-with-subjects-listed; a subject bar (subject mode) opens straight to
  // the single-subject deep dive. Optional so this component still renders (read-only
  // bars) if a caller doesn't wire the drawer up.
  onSelectSubjectArea?: (target: { familyId: string; familyLabel: string; subject?: string }) => void;
  // The active TYPE bucket, shared with the headline filter above so one selection
  // means the same thing in both places -- the whole point of Part B. null means no
  // explicit selection and every qualification type is shown, exactly as before.
  ks5Bucket?: Ks5Bucket | null;
}) {
  // Individual-school selector ("as we did for rolls"). Applies to rows C, D's right
  // column, and Row B's own %-change right column -- NOT Row B's own raw market-share
  // row (a single school's share of the total isn't a meaningful "swap to one other
  // school" reading the same way a plain average is). null = "Average across the
  // set", the real default. Now real in subject mode too, per this round's own brief.
  const [selectedComparatorUrn, setSelectedComparatorUrn] = useState<string | null>(null);

  const categoryMode = !familyId;

  // Part B: the TYPE bucket filters the subject rows too, not just the headline
  // figures, using the SAME bucketFor() rule the pills and the ingest both use.
  // Only at KS5: the bucket concept is a Post-16 qualification distinction and the
  // other stages have no qualification dimension to filter on.
  const bucketActive = stage === "ks5" && ks5Bucket !== null;
  const inBucket = useCallback(
    <T extends { qualificationType: string }>(rows: T[]): T[] =>
      bucketActive ? rows.filter((r) => bucketFor(r.qualificationType) === ks5Bucket) : rows,
    [bucketActive, ks5Bucket],
  );

  const scopedSubjectData = useMemo(
    () => (subjectData && bucketActive
      ? { ...subjectData, entries: inBucket(subjectData.entries), valueAdded: inBucket(subjectData.valueAdded) }
      : subjectData),
    [subjectData, bucketActive, inBucket],
  );

  const scopedComparatorSubjectByUrn = useMemo(() => {
    if (!bucketActive) return comparatorSubjectByUrn;
    const out = new Map<string, { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] }>();
    for (const [urn, d] of comparatorSubjectByUrn) {
      out.set(urn, { entries: inBucket(d.entries), valueAdded: inBucket(d.valueAdded) });
    }
    return out;
  }, [comparatorSubjectByUrn, bucketActive, inBucket]);

  // Honest gap, deliberately surfaced rather than papered over: the CATEGORY-mode
  // figures come from the subject-family rollup, whose points are computed for the
  // points-bearing qualification only (GCE A level at KS5 -- see
  // POINTS_BEARING_QUALIFICATION). That rollup has no qualification-bucket dimension,
  // so with a non-A-level bucket selected its points figure would be an A-level number
  // shown against IB or BTEC rows. Suppressing it leaves entries, which ARE correctly
  // bucket-scoped, and shows no points figure at all rather than a wrong one. Giving
  // category mode real per-bucket points needs the rollup itself to gain the bucket
  // dimension; flagged in this round's build report, not silently faked here.
  const categoryPointsUnavailable = bucketActive && ks5Bucket !== "alevel" && categoryMode;

  // Strips the points figure off category rows when it would be an A-level number
  // shown against a non-A-level bucket. See categoryPointsUnavailable above.
  const withoutBorrowedPoints = useCallback(
    (rows: SubjectRow[]): SubjectRow[] =>
      categoryPointsUnavailable ? rows.map((r) => ({ ...r, results: null, resultsPctChange: null })) : rows,
    [categoryPointsUnavailable],
  );

  // Real headline rows for one school, scoped to the active family -- a small local
  // helper (not memoized per-call; comparator sets here are small, ~10 real schools,
  // so recomputing this per render is cheap) shared by the school-side and
  // comparator-side buildSubjectRows calls below.
  function headlineBySubjectFor(urn: string): Map<string, AcademicSubjectHeadlineEntry[]> {
    const bySubject = new Map<string, AcademicSubjectHeadlineEntry[]>();
    if (!familyId) return bySubject;
    for (const h of comparatorSubjectHeadlineByUrn.get(urn) ?? []) {
      if (h.familyId !== familyId) continue;
      const list = bySubject.get(h.subject);
      if (list) list.push(h);
      else bySubject.set(h.subject, [h]);
    }
    return bySubject;
  }

  // School side: category mode from the profile's own real family data (unchanged);
  // subject mode from the existing fast, single-URN subjectData fetch (unchanged
  // latency for the school side -- this round's new batched fetch only affects the
  // comparison side below), enriched with the target's own real headline rows.
  const rows = useMemo(
    // "qualification": the subject-mode list is exactly where a BTEC row must not be
    // merged with an A-level row that happens to share its name. See buildSubjectRows.
    () => (categoryMode ? withoutBorrowedPoints(buildCategoryRows(profile, stage)) : familyId ? buildSubjectRows(stage, familyId, scopedSubjectData, headlineBySubjectFor(profile.urn), "qualification") : []),
    // headlineBySubjectFor is a plain function of familyId/comparatorSubjectHeadlineByUrn
    // (both already listed) redefined every render -- omitted deliberately, not a stale-
    // closure risk, since everything it reads is already tracked here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryMode, profile, stage, familyId, scopedSubjectData, comparatorSubjectHeadlineByUrn],
  );
  const latestPeriod = rows.map((r) => r.candidatesPeriod).find((p): p is number => p !== null) ?? null;
  const colourFor = (id: string) => subjectFamilyColour(familyId ?? id).light[1];

  const candidateItems = rows.filter((r) => r.candidates !== null).map((r) => ({ id: r.id, label: r.label, value: r.candidates as number }));
  const order = [...candidateItems].sort((a, b) => b.value - a.value).map((i) => i.id);
  const labelById = new Map(rows.map((r) => [r.id, r.label]));
  // In subject mode a row's id is now (qualification type, subject), but the drawer
  // resolves a subject against academic_subject_headline, which has no qualification
  // dimension -- so it must be handed the real subject NAME, never the composite id.
  const subjectById = new Map(rows.map((r) => [r.id, r.subject ?? r.id]));
  const handleItemClick = onSelectSubjectArea
    ? (id: string) => {
        if (categoryMode) {
          onSelectSubjectArea({ familyId: id, familyLabel: labelById.get(id) ?? id });
        } else if (familyId) {
          onSelectSubjectArea({ familyId, familyLabel: familyLabel ?? familyId, subject: subjectById.get(id) ?? id });
        }
      }
    : undefined;
  const resultItems = rows.filter((r) => r.results !== null).map((r) => ({ id: r.id, label: r.label, value: r.results as number }));
  const candidatesTrendItems = rows.map((r) => ({ id: r.id, label: r.label, pctChange: r.candidatesPctChange }));
  const resultsTrendItems = rows.map((r) => ({ id: r.id, label: r.label, pctChange: r.resultsPctChange }));

  const hasAnyResults = resultItems.length > 0;
  const resultsUnavailableNote = familyId
    ? stage === "ks4"
      ? "No real average-point-score figure for any subject in this category yet (too few real points-eligible entries, or the comparison-set fetch hasn't resolved yet)."
      : "No real value-added figure for any subject in this category yet."
    : "No real results figure for any category yet.";

  // Comparison-set data. Category mode: unchanged, client-side over comparableGroup's
  // own already-fetched profiles, no new fetch. Subject mode: real now (Part 1 of
  // this round) -- comparatorSubjectByUrn/comparatorSubjectHeadlineByUrn, keyed by the
  // SAME comparableGroup this page already uses everywhere else. The target's own
  // entry reuses `rows` (already computed above via the fast path) rather than
  // recomputing from the batched fetch a second time.
  const comparatorRowsByUrn = useMemo(() => {
    const map = new Map<string, SubjectRow[]>();
    for (const p of comparableGroup) {
      if (p.urn === profile.urn) {
        map.set(p.urn, rows);
        continue;
      }
      if (categoryMode) {
        map.set(p.urn, withoutBorrowedPoints(buildCategoryRows(p, stage)));
      } else if (familyId) {
        // subjectFamilyMap is stage-scoped, static reference data -- identical for
        // every real school, so the target's own already-fetched copy (subjectData)
        // is reused here rather than re-fetching it once per comparator.
        const own = scopedComparatorSubjectByUrn.get(p.urn);
        const comparatorSubjectData = own ? { ...own, subjectFamilyMap: subjectData?.subjectFamilyMap ?? {} } : null;
        // Same grouping as the target side, or the two sides would not line up by id.
        map.set(p.urn, buildSubjectRows(stage, familyId, comparatorSubjectData, headlineBySubjectFor(p.urn), "qualification"));
      } else {
        map.set(p.urn, []);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- headlineBySubjectFor, same reasoning as `rows` above.
  }, [comparableGroup, profile.urn, rows, categoryMode, stage, familyId, comparatorSubjectByUrn, comparatorSubjectHeadlineByUrn, subjectData]);

  // Selector options exclude the target itself -- comparing a school against its own
  // figure has no real meaning here.
  const comparatorOptions = comparableGroup.filter((p) => p.urn !== profile.urn);
  const selectedRows = selectedComparatorUrn ? (comparatorRowsByUrn.get(selectedComparatorUrn) ?? []) : null;
  const selectedComparatorName = selectedComparatorUrn ? (comparatorOptions.find((p) => p.urn === selectedComparatorUrn)?.name ?? null) : null;

  // Row B, right: MARKET SHARE -- school's own entries ÷ sum of every real school in
  // comparableGroup's own entries for that category/subject, ×100. Deliberately self-
  // inclusive (comparableGroup already includes the target -- "this school accounts
  // for X% of all entries across the COMPARED schools") -- a genuinely different,
  // TOTAL-based number from Section 01's own comparison pie (which AVERAGES each
  // school's own % share). No selector here per direct instruction.
  const marketShareItems = candidateItems.map((item) => {
    const total = comparableGroup.reduce((s, p) => s + (comparatorRowsByUrn.get(p.urn)?.find((r) => r.id === item.id)?.candidates ?? 0), 0);
    return { id: item.id, label: item.label, value: total > 0 ? (item.value / total) * 100 : 0 };
  });

  // Row B, right, % change -- STATED ASSUMPTION, not confirmed with Guy (carried over
  // from the prior round's own flag): the comparison-set's entries % change, computed
  // the same total-based way -- sum of real comparableGroup entries at the earliest
  // real period vs the latest real period. Category mode aggregates from each
  // profile's own familyYearsFor history (aggregateFamilyTrend); subject mode
  // aggregates from each comparator's own already-computed SubjectRow (
  // aggregateSubjectTrend) -- subject rows don't carry a per-period series to walk
  // the same way category rows' underlying familyYearsFor does. When a specific
  // comparator is selected, shows THAT school's own real %-change instead.
  const candidatesTrendComparisonItems = order.map((id) => ({
    id,
    label: labelById.get(id) ?? id,
    pctChange: selectedRows
      ? (selectedRows.find((r) => r.id === id)?.candidatesPctChange ?? null)
      : categoryMode
        ? aggregateFamilyTrend(comparableGroup, stage, id, (y) => (y.entriesTotal > 0 ? y.entriesTotal : null), sum)
        : aggregateSubjectTrend(comparatorRowsByUrn, id, (r) => r.candidatesPctChange !== null ? r.candidates : null, sum),
  }));

  // Row C, right: AVERAGE avg point score / value-added across comparableGroup
  // (self-inclusive, same convention as market share's own denominator above), or
  // the one selected school's own real figure.
  const resultComparisonItems = order
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
    .filter((x): x is { id: string; label: string; value: number } => x !== null);

  // Row D, right: comparison-set AVERAGE's own % change or the one selected school's
  // own real %-change. Inherits the EXACT SAME omission the school side already
  // applies (resultsTrendItems above) -- KS4 subject level now has a real trend
  // (this round); KS5 subject level's value-added stays omitted (resultsPctChange is
  // already null on every KS5 SubjectRow, so aggregateSubjectTrend naturally finds no
  // real values to aggregate and correctly returns null too -- the omission is
  // enforced by the DATA, not a separate mode check here).
  const resultsTrendComparisonItems = order.map((id) => ({
    id,
    label: labelById.get(id) ?? id,
    pctChange: selectedRows
      ? (selectedRows.find((r) => r.id === id)?.resultsPctChange ?? null)
      : categoryMode
        ? // categoryPointsUnavailable has to be checked EXPLICITLY here, unlike every
          // other points path in this component. The others read comparatorRowsByUrn,
          // which has already had withoutBorrowedPoints applied; this one calls
          // aggregateFamilyTrend over the raw comparableGroup profiles and their own
          // familyYearsFor history, so the suppression never reaches it.
          //
          // Without this gate the "Results, % change" card showed a real A-level points
          // trend for the comparator set while a non-A-level TYPE bucket was selected --
          // directly contradicting the "Results, 2024/25" card immediately above it,
          // which correctly showed no figure at all. Found live at Sevenoaks School
          // under TYPE = IB: school side honestly empty, comparator side showing data.
          //
          // The gate is deliberately NOT applied to the candidates trend above, which
          // uses the same helper: entries are legitimately bucket-scoped earlier in the
          // pipeline and were never part of this suppression.
          categoryPointsUnavailable
          ? null
          : aggregateFamilyTrend(comparableGroup, stage, id, (y) => y.avgPointScore, average)
        : aggregateSubjectTrend(comparatorRowsByUrn, id, (r) => (r.resultsPctChange !== null ? r.results : null), average),
  }));

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Subject area{familyId && familyLabel ? ` — subjects within ${familyLabel}` : " — categories"}
      </h4>

      {comparatorOptions.length > 0 && (
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
            <SubjectAreaBarChart items={candidateItems} order={order} colourFor={colourFor} onItemClick={handleItemClick} />
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">Market share of {setLabel}</p>
            <SubjectAreaBarChart items={marketShareItems} order={order} colourFor={colourFor} formatValue={(v) => `${v.toFixed(0)}%`} onItemClick={handleItemClick} />
          </div>
        </div>
      </Card>

      <Card title="Candidates, % change">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            <SubjectAreaDivergingBarChart items={candidatesTrendItems} order={order} onItemClick={handleItemClick} />
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">{selectedComparatorName ?? `Average across ${setLabel}`}</p>
            <SubjectAreaDivergingBarChart items={candidatesTrendComparisonItems} order={order} onItemClick={handleItemClick} />
          </div>
        </div>
      </Card>

      <Card title={`Results${latestPeriod !== null ? `, ${academicYearLabel(latestPeriod)}` : ""}${familyId && stage === "ks5" ? " (value added)" : ""}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-neutral-500">{profile.name}</p>
            {hasAnyResults ? (
              <SubjectAreaBarChart items={resultItems} order={order} colourFor={colourFor} formatValue={(v) => v.toFixed(1)} onItemClick={handleItemClick} />
            ) : (
              <p className="text-sm text-neutral-500">{resultsUnavailableNote}</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">{selectedComparatorName ?? `Average across ${setLabel}`}</p>
            {resultComparisonItems.length > 0 ? (
              <SubjectAreaBarChart items={resultComparisonItems} order={order} colourFor={colourFor} formatValue={(v) => v.toFixed(1)} onItemClick={handleItemClick} />
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
            {resultsTrendItems.some((r) => r.pctChange !== null) ? (
              <SubjectAreaDivergingBarChart items={resultsTrendItems} order={order} onItemClick={handleItemClick} />
            ) : (
              <p className="text-sm text-neutral-500">
                {familyId && stage === "ks5"
                  ? "Not shown at subject level -- results % change would be misleading here (see this component's own header comment)."
                  : "Not enough real history to compute growth/decline."}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">{selectedComparatorName ?? `Average across ${setLabel}`}</p>
            {resultsTrendComparisonItems.some((r) => r.pctChange !== null) ? (
              <SubjectAreaDivergingBarChart items={resultsTrendComparisonItems} order={order} onItemClick={handleItemClick} />
            ) : (
              <p className="text-sm text-neutral-500">
                {familyId && stage === "ks5"
                  ? "Not shown at subject level -- results % change would be misleading here (see this component's own header comment)."
                  : `Not enough real history to compute growth/decline across ${setLabel}.`}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
