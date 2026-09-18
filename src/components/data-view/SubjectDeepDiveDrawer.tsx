"use client";

// Subject deep-dive round, Parts 2 + 3 (docs/vicdata_phase3_academic_results_subject_
// deep_dive_frontend_brief_v1.md). Part 3's own navigation design, Option C
// (recommended, read that section's full reasoning before touching this file) --
// a breadcrumb-oriented slide-over drawer, NOT the existing FullscreenChartModal
// (built for "one chart, bigger", not "a different, richer view"). Opened by clicking
// any bar in SubjectAreaSection.tsx's four rows (both category-mode's per-category
// bars and subject-mode's per-subject bars, via that component's own
// onSelectSubjectArea prop). Closing the drawer returns to exactly where the page
// already was -- no new URL, no lost scroll position, this component owns no page
// state, only its own open/breadcrumb/fetch state.
//
// Self-contained data: this drawer does its own fetch (the same real
// /api/data-view/academic-subject-comparison route Part 1 built), scoped to whatever
// category was clicked, rather than reusing SubjectAreaSection's own page-scoped
// fetch -- the page's own comparatorSubjectByUrn/comparatorSubjectHeadlineByUrn are
// scoped to the PAGE's own currently-selected category (or none, in category mode),
// which usually isn't the category a member just clicked into. One real fetch per
// category opened; the anchor URN's own row comes back in the same response (the
// route always includes anchorUrn in the requested urns), so no separate re-fetch of
// the target's own data is needed either.
//
// CATEGORY level (target.subject undefined): a real, honest simplification versus a
// full nested copy of SubjectAreaSection's own four-row engine -- "subjects listed"
// (the brief's own wording), one real row per subject (this school's own entries +
// results), each a click target into the subject level below. The full four-row
// comparison view for a whole category already exists on the page itself (subject
// mode, Section 03) -- this level's real job is picking which subject to go deeper
// on, not duplicating that page content a second time inside the drawer.
//
// SUBJECT level (target.subject set): Part 2's real content -- the same four metrics
// as Section 03's own rows, bigger; a real grade distribution (genuinely new content,
// not built anywhere else); KS5's real value-added with its CI (SubjectTable, reused
// directly); a real trend line back to 2020/21 (TargetVsAverageTrend, reused
// directly); the comparator selector, plus a real ranked list of every comparator's
// own figure for this one subject.
import { useEffect, useMemo, useState } from "react";
import { buildSubjectRows, type SubjectRow } from "./SubjectAreaSection";
import SubjectTable from "./SubjectTable";
import TargetVsAverageTrend from "./TargetVsAverageTrend";
import { academicYearLabel } from "./TrendPill";
import { subjectFamilyColour } from "@/lib/subject-family-colours";
import {
  type AcademicSchoolProfile,
  type KsStage,
  type SubjectEntry,
  type SubjectValueAdded,
  type SubjectGradeCount,
  type AcademicSubjectHeadlineEntry,
  HEADLINE_LABEL,
} from "@/lib/academic-data-view";
import { bucketFor, KS5_BUCKET_LABEL, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";

export type DeepDiveTarget = { familyId: string; familyLabel: string; subject?: string };

// Grade bands used to be two hardcoded lists picked by stage alone, so everything that
// was not GCSE got forced into the A-level bands. Confirmed live 2026-09-18 against
// ingested grade rows: that is wrong for most qualification types, not just IB.
// 31 qualification types carry real subject-grain grade rows at KS5 alone, across at
// least eight genuinely different scales:
//
//   A-level / AS / Core Maths / Extended Project   A*  A  B  C  D  E   (+ Fail)
//   IBO Higher + Standard level component          7 6 5 4 3 2 1
//   IBO Diploma Programme Core                     A  B  C  D  E       (a different
//                                                                       A-E scale)
//   International Baccalaureate (the Diploma)      45 ... 24
//   BTEC / OCR Technicals / VRQ, single award      Distinction* ... Pass
//   ... double award                               Distinction*-Distinction* ...
//   ... triple award                               Distinction*-Distinction*-D* ...
//   Pre-U                                          D1 D2 D3 M1 M2 M3 P1 P2 P3
//
// and at KS4 only "GCSE (9-1) Full Course" matches the old GCSE list -- Double Award
// publishes two-digit pairs (99, 98, 87 ... 11) and the vocational labels use two
// different encodings between their own label variants ("Level 2 distinction" vs
// "D2"). Hardcoding every one of those, times their label variants, would be wrong
// again the first time DfE adds a band.
//
// So the order is derived from the grades actually present in this subject's real
// SubjectGradeCount rows, and only the ORDERING is knowledge we supply: a rank table
// covering the scales above, highest attainment first. A grade outside the table still
// renders, sorted after the ones we recognise, rather than vanishing.
// Ordered best-to-worst, one array per real scale. Deliberately NOT flattened into a
// single global rank table: the same grade string means opposite things in different
// scales. "D1" is the TOP Pre-U grade but the LOWER of the two vocational distinctions
// (where the digit is the level, so D2 beats D1), and a flat table ranked Pre-U as
// "D3 D1 M2 P3". So the scale is chosen per subject, by which one best covers the
// grades actually present, and only then used to order them.
const GRADE_SCALES: string[][] = [
  // KS4 GCSE 9-1, then the Double Award pairs, highest first.
  ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
  ["99", "98", "88", "87", "77", "76", "66", "65", "55", "54", "44", "43", "33", "32", "22", "21", "11"],
  // A-level family. "*" appears as a real raw value alongside "A*" in the source.
  ["A*", "*", "A", "B", "C", "D", "E"],
  // IB subject components (Higher and Standard level).
  ["7", "6", "5", "4", "3", "2", "1"],
  // IB Diploma points total.
  ["45", "44", "43", "42", "41", "40", "39", "38", "37", "36", "35", "34", "33", "32", "31", "30", "29", "28", "27", "26", "25", "24"],
  // Vocational single / double / triple award, highest first.
  ["Distinction*", "Distinction", "High merit", "Merit", "High pass", "Pass"],
  ["Distinction*-Distinction*", "Distinction*-Distinction", "Distinction-Distinction", "Distinction-Merit", "Merit-Merit", "Merit-Pass", "Pass-Pass"],
  [
    "Distinction*-Distinction*-Distinction*", "Distinction*-Distinction*-Distinction", "Distinction*-Distinction-Distinction",
    "Distinction-Distinction-Distinction", "Distinction-Distinction-Merit", "Distinction-Merit-Merit",
    "Merit-Merit-Merit", "Merit-Merit-Pass", "Merit-Pass-Pass", "Pass-Pass-Pass",
  ],
  // KS4 vocational, both real encodings.
  ["L2*", "L2D", "L2M", "L2P", "L1D", "L1M", "L1P"],
  ["*2", "*1", "D2", "D1", "M2", "M1", "P2", "P1"],
  ["Level 2 distinction star", "Level 2 distinction", "Level 2 merit", "Level 2 pass", "Level 1 distinction star", "Level 1 distinction", "Level 1 merit", "Level 1 pass"],
  // Pre-U.
  ["D1", "D2", "D3", "M1", "M2", "M3", "P1", "P2", "P3"],
  // T Level, its OWN scale rather than the vocational one above. The two share
  // Distinction*/Distinction/Merit/Pass, so a T Level distribution would part-match the
  // vocational scale and silently drop its two distinctive bands -- the same shape as
  // the bug that forced IB into A-level's A*-E and rendered an empty chart. "Partial
  // achievement" is a real T Level outcome (a student who passed some but not all
  // components), ranked below Pass and above Unclassified, and deliberately NOT treated
  // as a non-result: it is a real attainment band, just one with no derivable points.
  ["Distinction*", "Distinction", "Merit", "Pass", "Partial achievement", "Unclassified"],
];

// Present in almost every scale and always the bottom of it, so they are ranked below
// every graded band rather than being indexed alongside them -- otherwise a fail sorts
// to the TOP of the chart.
const BOTTOM_RANK: Record<string, number> = { Fail: 900, U: 901, Unclassified: 902 };

// Not attainment bands: DfE suppression and non-results. Excluded from the chart's axis
// so a distribution is not padded with rows that cannot be compared between schools.
const NON_GRADE_VALUES = new Set(["Suppressed", "No result", "No result / X", "X", "Covid impacted", "Not Awarded", "Awarded"]);

function gradeOrderFrom(...gradeSets: Iterable<string>[]): string[] {
  const present = new Set<string>();
  for (const set of gradeSets) for (const g of set) if (!NON_GRADE_VALUES.has(g)) present.add(g);
  const graded = Array.from(present).filter((g) => !(g in BOTTOM_RANK));

  // Pick the scale covering the most of what is actually here. Ties go to the shorter
  // scale, which is the more specific match for the same coverage.
  let best: string[] = [];
  let bestHits = 0;
  for (const scale of GRADE_SCALES) {
    const hits = graded.filter((g) => scale.includes(g)).length;
    if (hits > bestHits || (hits === bestHits && hits > 0 && scale.length < best.length)) {
      best = scale;
      bestHits = hits;
    }
  }

  const rank = (g: string) => {
    if (g in BOTTOM_RANK) return BOTTOM_RANK[g];
    const i = best.indexOf(g);
    return i === -1 ? 800 : i; // unrecognised grades still render, just after the known ones
  };
  return Array.from(present).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

type SchoolSubjectData = { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[]; gradeDistribution: SubjectGradeCount[] };

// A real, single-value stat tile -- the same real "bigger, side by side" framing
// Section 03's own rows use, just one item at a time instead of a bar-per-item chart
// (a bar chart of one real bar reads worse than a plain stat once there's real room).
function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="mb-1 text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

// Real, genuinely new content (not built anywhere else in this app): a grade-by-grade
// distribution, school vs comparison-set AVERAGE profile, both as a real % of that
// side's own total entries (so the two bars are comparable regardless of real cohort
// size). Reuses the subject-family colour ramp for visual consistency with the rest
// of this feature, not a new palette.
function GradeDistributionChart({
  familyId,
  gradeOrder,
  schoolCounts,
  comparisonPercents,
}: {
  familyId: string;
  gradeOrder: string[];
  schoolCounts: Map<string, number>;
  comparisonPercents: Map<string, number>;
}) {
  const schoolTotal = Array.from(schoolCounts.values()).reduce((s, v) => s + v, 0);
  if (schoolTotal === 0 && comparisonPercents.size === 0) {
    return <p className="text-sm text-neutral-500">No real grade breakdown available for this subject yet (modern years only, 2023/24 on).</p>;
  }
  const colour = subjectFamilyColour(familyId).light[1];
  const maxPercent = Math.max(...gradeOrder.map((g) => Math.max((schoolTotal > 0 ? ((schoolCounts.get(g) ?? 0) / schoolTotal) * 100 : 0), comparisonPercents.get(g) ?? 0)), 1);
  return (
    <div className="space-y-1.5">
      {gradeOrder.map((grade) => {
        const schoolPct = schoolTotal > 0 ? ((schoolCounts.get(grade) ?? 0) / schoolTotal) * 100 : 0;
        const comparisonPct = comparisonPercents.get(grade) ?? 0;
        return (
          <div key={grade} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400">{grade}</span>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                  <div className="h-full rounded" style={{ width: `${(schoolPct / maxPercent) * 100}%`, background: colour }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-neutral-500">{schoolPct.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                  <div className="h-full rounded bg-neutral-400 dark:bg-neutral-600" style={{ width: `${(comparisonPct / maxPercent) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-neutral-500">{comparisonPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-neutral-400">
        Top bar (coloured): this school. Bottom bar (grey): average across the comparison set. Both shown as a real % of that side&rsquo;s own total real entries.
      </p>
    </div>
  );
}

export default function SubjectDeepDiveDrawer({
  target,
  onNavigate,
  profile,
  comparableGroup,
  stage,
  setLabel,
  urn,
  authToken,
  ks5Bucket = null,
}: {
  target: DeepDiveTarget | null;
  onNavigate: (target: DeepDiveTarget | null) => void;
  profile: AcademicSchoolProfile;
  comparableGroup: AcademicSchoolProfile[];
  stage: KsStage;
  setLabel: string;
  urn: string;
  authToken: string | null;
  // The active TYPE bucket, shared with the headline filter and the subject cards so
  // one selection means the same thing everywhere (Part B). null shows every type.
  ks5Bucket?: Ks5Bucket | null;
}) {
  const [selectedComparatorUrn, setSelectedComparatorUrn] = useState<string | null>(null);

  const [subjectByUrn, setSubjectByUrn] = useState<Map<string, SchoolSubjectData>>(new Map());
  const [headlineByUrn, setHeadlineByUrn] = useState<Map<string, AcademicSubjectHeadlineEntry[]>>(new Map());
  const [loading, setLoading] = useState(false);
  // Why this exists: until 2026-09-17 this fetch discarded every failure -- a non-ok
  // response returned silently and the catch was bare -- so a real HTTP 500 from the
  // upstream lookup rendered as an ordinary "no data" drawer. The bug behind that
  // (a statement timeout, see lookupAcademicSubjectHeadline) was invisible from the
  // UI for exactly that reason. A failed fetch now says so.
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Part B: the same bucketFor() rule the pills, the subject cards and the ingest use.
  // Applied to this drawer's OWN fetched rows (it fetches independently -- see the
  // file header), so a drawer opened with IB selected shows IB entries and IB grades,
  // not every qualification type for the subject.
  const bucketActive = stage === "ks5" && ks5Bucket !== null;
  const scopedSubjectByUrn = useMemo(() => {
    if (!bucketActive) return subjectByUrn;
    const keep = <T extends { qualificationType: string }>(rows: T[]) => rows.filter((r) => bucketFor(r.qualificationType) === ks5Bucket);
    const out = new Map<string, SchoolSubjectData>();
    for (const [u, d] of subjectByUrn) {
      out.set(u, { entries: keep(d.entries), valueAdded: keep(d.valueAdded), gradeDistribution: keep(d.gradeDistribution) });
    }
    return out;
  }, [subjectByUrn, bucketActive, ks5Bucket]);

  useEffect(() => {
    // react-hooks/set-state-in-effect: the setState call lives inside this async
    // callback rather than directly in the effect body, same real fix this codebase
    // already established elsewhere for this exact lint rule.
    (async () => {
      setSelectedComparatorUrn(null);
    })();
  }, [target?.familyId, target?.subject]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!target || !authToken) {
        if (!cancelled) {
          setSubjectByUrn(new Map());
          setHeadlineByUrn(new Map());
          setFetchError(target && !authToken ? "You need to be signed in to load subject detail." : null);
        }
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const urns = Array.from(new Set([urn, ...comparableGroup.map((p) => p.urn)]));
        const params = new URLSearchParams({ anchorUrn: urn, urns: urns.join(","), stage, familyId: target.familyId });
        const res = await fetch(`/api/data-view/academic-subject-comparison?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          // A failed request is NOT "no data" -- distinguishing the two is the whole
          // point of this branch. Reported here and logged with the real status so
          // the next occurrence is diagnosable from the console alone.
          console.error("[SubjectDeepDiveDrawer] subject comparison fetch failed", {
            status: res.status,
            stage,
            familyId: target.familyId,
            urnCount: urns.length,
          });
          setSubjectByUrn(new Map());
          setHeadlineByUrn(new Map());
          setFetchError(
            res.status >= 500
              ? "Couldn't load subject detail just now -- the data service didn't respond in time. Try again, or narrow your comparison set."
              : "Couldn't load subject detail for this category.",
          );
          return;
        }
        const body = (await res.json()) as { subjectByUrn: Record<string, SchoolSubjectData>; headlineByUrn: Record<string, AcademicSubjectHeadlineEntry[]> };
        setSubjectByUrn(new Map(Object.entries(body.subjectByUrn)));
        setHeadlineByUrn(new Map(Object.entries(body.headlineByUrn)));
      } catch (err) {
        if (cancelled) return;
        console.error("[SubjectDeepDiveDrawer] subject comparison fetch threw", err);
        setFetchError("Couldn't load subject detail just now. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target?.familyId, urn, comparableGroup, stage, authToken, target]);

  if (!target) return null;
  const targetFamilyId = target.familyId;

  const comparatorOptions = comparableGroup.filter((p) => p.urn !== profile.urn);

  // Every real subject in this category, union across every real school fetched --
  // the category-level list, and the subject-level row lookups both key off this.
  const allSubjectNames = new Set<string>();
  for (const rows of headlineByUrn.values()) for (const r of rows) allSubjectNames.add(r.subject);

  // The category-level list: every real subject in this category that the target
  // school actually has entries for, ranked by entry count. Hoisted out of the JSX
  // so the empty state below can tell "category returned nothing" apart from
  // "subjects exist but none has entries data".
  const listedSubjects = Array.from(allSubjectNames)
    .map((name) => ({ name, row: rowFor(profile.urn, name) }))
    .filter((s): s is { name: string; row: SubjectRow } => s.row !== null && s.row.candidates !== null)
    .sort((a, b) => (b.row.candidates ?? 0) - (a.row.candidates ?? 0));

  function rowFor(schoolUrn: string, subject: string): SubjectRow | null {
    const own = scopedSubjectByUrn.get(schoolUrn);
    const headline = (headlineByUrn.get(schoolUrn) ?? []).filter((r) => r.subject === subject);
    const bySubject = new Map<string, AcademicSubjectHeadlineEntry[]>([[subject, headline]]);
    const rows = buildSubjectRows(stage, targetFamilyId, own ? { ...own, subjectFamilyMap: { [subject]: targetFamilyId } } : null, bySubject);
    return rows.find((r) => r.id === subject) ?? null;
  }

  return (
    <div className="fixed inset-0 z-[2500] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={() => onNavigate(null)} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        {/* Breadcrumb: orientation + navigation in one strip, per the brief's own Part 3 design. */}
        <nav className="mb-4 flex items-center gap-1.5 text-sm">
          <button type="button" className="text-neutral-500 hover:underline" onClick={() => onNavigate(null)}>
            Whole school
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">›</span>
          {target.subject ? (
            <button type="button" className="text-neutral-500 hover:underline" onClick={() => onNavigate({ familyId: target.familyId, familyLabel: target.familyLabel })}>
              {target.familyLabel}
            </button>
          ) : (
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{target.familyLabel}</span>
          )}
          {target.subject && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">›</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{target.subject}</span>
            </>
          )}
          <button type="button" onClick={() => onNavigate(null)} className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-300" aria-label="Close">
            ✕
          </button>
        </nav>

        {loading && subjectByUrn.size === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">Loading real subject data…</p>
        ) : fetchError ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
            <p className="text-sm text-amber-900 dark:text-amber-200">{fetchError}</p>
          </div>
        ) : !target.subject ? (
          // CATEGORY level -- real subjects listed, each a click target into the subject level.
          <div className="space-y-1">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Subjects within {target.familyLabel}</h3>
            {listedSubjects.map(({ name, row }) => (
                <button
                  key={name}
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  onClick={() => onNavigate({ familyId: target.familyId, familyLabel: target.familyLabel, subject: name })}
                >
                  <span className="text-neutral-900 dark:text-neutral-100">{name}</span>
                  <span className="text-xs text-neutral-500">
                    {row.candidates} real entries{row.results !== null ? ` · ${row.results.toFixed(1)} avg` : ""}
                  </span>
                </button>
              ))}
            {/* THREE genuinely different empty states, not two.
                  1. `allSubjectNames` empty: the category itself returned nothing.
                  2. A TYPE bucket is selected and nothing in this category matches it.
                     This is the common case and it is NOT missing data -- the school's
                     provision here is simply a different qualification type.
                  3. No bucket selected, subjects exist, but none has entries in the
                     modern raw-fact source.
                Case 2 used to fall into case 3's wording and quote
                `allSubjectNames.size` -- a count taken from the UNFILTERED headline
                rollup, so it reported every qualification type combined as though that
                many subjects were missing data. Capital City College filtered to
                BTec & OCR read "No entries data for the 27 subjects in this category
                yet" when the real answer is that it has no BTec & OCR provision in this
                category at all. Never quote that count while a bucket is narrowing the
                list: it was never scoped to the thing causing the emptiness. */}
            {allSubjectNames.size === 0 ? (
              <p className="text-sm text-neutral-500">No real subject data for this category yet.</p>
            ) : (
              listedSubjects.length === 0 && (
                <p className="text-sm text-neutral-500">
                  {bucketActive && ks5Bucket
                    ? `No ${KS5_BUCKET_LABEL[ks5Bucket]} entries for this category at this school.`
                    : `No entries data for the ${allSubjectNames.size} subject${allSubjectNames.size === 1 ? "" : "s"} in this category yet.`}
                </p>
              )
            )}
          </div>
        ) : (
          (() => {
            const subject = target.subject;
            const targetRow = rowFor(profile.urn, subject);
            const comparatorRows = new Map(comparableGroup.filter((p) => p.urn !== profile.urn).map((p) => [p.urn, rowFor(p.urn, subject)]));
            const selectedRow = selectedComparatorUrn ? comparatorRows.get(selectedComparatorUrn) : null;
            const selectedName = selectedComparatorUrn ? comparatorOptions.find((p) => p.urn === selectedComparatorUrn)?.name : null;

            const realComparatorRows = Array.from(comparatorRows.entries()).filter((e): e is [string, SubjectRow] => e[1] !== null);
            const marketShareTotal = (targetRow?.candidates ?? 0) + realComparatorRows.reduce((s, [, r]) => s + (r.candidates ?? 0), 0);
            const marketShare = targetRow?.candidates !== null && targetRow?.candidates !== undefined && marketShareTotal > 0 ? (targetRow.candidates / marketShareTotal) * 100 : null;

            const resultsValues = realComparatorRows.map(([, r]) => r.results).filter((v): v is number => v !== null);
            const avgResults = resultsValues.length > 0 ? resultsValues.reduce((s, v) => s + v, 0) / resultsValues.length : null;
            const comparisonResultsValue = selectedRow ? selectedRow.results : avgResults;
            const comparisonResultsLabel = selectedName ?? `Average across ${setLabel}`;

            // Real multi-period trend, target vs comparison-set average, back to
            // 2020/21 -- vicdata's new headline rollup, reused via TargetVsAverageTrend.
            const targetSeries = (headlineByUrn.get(profile.urn) ?? []).filter((r) => r.subject === subject).sort((a, b) => a.period - b.period);
            const periods = Array.from(new Set(Array.from(headlineByUrn.values()).flatMap((rows) => rows.filter((r) => r.subject === subject).map((r) => r.period)))).sort((a, b) => a - b);
            const targetTrendSeries = periods.map((p) => targetSeries.find((r) => r.period === p)?.avgPointScore ?? null);
            const averageTrendSeries = periods.map((p) => {
              const vals = comparableGroup
                .filter((sc) => sc.urn !== profile.urn)
                .map((sc) => (headlineByUrn.get(sc.urn) ?? []).find((r) => r.subject === subject && r.period === p)?.avgPointScore)
                .filter((v): v is number => v !== null && v !== undefined);
              return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
            });

            // Real grade distribution, school vs comparison-set average -- from the
            // batched raw-fact fetch (gradeDistribution), modern years only (2023/24
            // on, same real limitation as the underlying source itself).
            const schoolGradeCounts = new Map<string, number>();
            for (const g of scopedSubjectByUrn.get(profile.urn)?.gradeDistribution ?? []) {
              if (g.subject !== subject) continue;
              schoolGradeCounts.set(g.grade, (schoolGradeCounts.get(g.grade) ?? 0) + g.entries);
            }
            // Bands come from the grades this subject really carries, across the school
            // and its comparison set, so an IB or BTEC subject charts its own scale
            // instead of being forced into A-level's seven bands and rendering as zeros.
            // The set union matters: a comparator offering a band the target does not
            // still gets a column, which is the whole point of the comparison.
            const comparisonGradeValues: string[] = [];
            for (const sc of comparableGroup) {
              if (sc.urn === profile.urn) continue;
              for (const g of scopedSubjectByUrn.get(sc.urn)?.gradeDistribution ?? []) {
                if (g.subject === subject) comparisonGradeValues.push(g.grade);
              }
            }
            const gradeOrder = gradeOrderFrom(schoolGradeCounts.keys(), comparisonGradeValues);

            const comparisonGradePercents = new Map<string, number>();
            const comparisonGradeSamples = new Map<string, number[]>();
            for (const sc of comparableGroup) {
              if (sc.urn === profile.urn) continue;
              const counts = new Map<string, number>();
              for (const g of scopedSubjectByUrn.get(sc.urn)?.gradeDistribution ?? []) {
                if (g.subject !== subject) continue;
                counts.set(g.grade, (counts.get(g.grade) ?? 0) + g.entries);
              }
              const total = Array.from(counts.values()).reduce((s, v) => s + v, 0);
              if (total === 0) continue;
              for (const grade of gradeOrder) {
                const pct = ((counts.get(grade) ?? 0) / total) * 100;
                const list = comparisonGradeSamples.get(grade);
                if (list) list.push(pct);
                else comparisonGradeSamples.set(grade, [pct]);
              }
            }
            for (const [grade, samples] of comparisonGradeSamples) comparisonGradePercents.set(grade, samples.reduce((s, v) => s + v, 0) / samples.length);

            // KS5 value-added, real, with its CI -- SubjectTable, reused directly.
            const targetEntryRow = scopedSubjectByUrn.get(profile.urn)?.entries.find((e) => e.subject === subject) ?? null;
            const targetValueAddedRows = scopedSubjectByUrn.get(profile.urn)?.valueAdded.filter((v) => v.subject === subject) ?? [];

            const resultsUnit = HEADLINE_LABEL[stage];

            return (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{subject}</h3>

                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Candidates" value={targetRow?.candidates?.toLocaleString() ?? "—"} sub={targetRow?.candidatesPeriod !== null && targetRow?.candidatesPeriod !== undefined ? academicYearLabel(targetRow.candidatesPeriod) : undefined} />
                  <StatTile label={`Market share of ${setLabel}`} value={marketShare !== null ? `${marketShare.toFixed(0)}%` : "—"} />
                  <StatTile label="Candidates, % change" value={targetRow?.candidatesPctChange !== null && targetRow?.candidatesPctChange !== undefined ? `${targetRow.candidatesPctChange > 0 ? "+" : ""}${targetRow.candidatesPctChange.toFixed(0)}%` : "Not enough real history"} />
                  <StatTile
                    label={`Results${stage === "ks5" ? " (value added)" : ""}`}
                    value={targetRow?.results !== null && targetRow?.results !== undefined ? targetRow.results.toFixed(1) : "No real figure yet"}
                    sub={comparisonResultsValue !== null ? `${comparisonResultsLabel}: ${comparisonResultsValue.toFixed(1)}` : undefined}
                  />
                </div>

                {stage === "ks4" && (
                  <div>
                    <p className="mb-2 text-xs text-neutral-500">Results, % change ({resultsUnit})</p>
                    <p className="text-sm text-neutral-900 dark:text-neutral-100">
                      {targetRow?.resultsPctChange !== null && targetRow?.resultsPctChange !== undefined
                        ? `${targetRow.resultsPctChange > 0 ? "+" : ""}${targetRow.resultsPctChange.toFixed(0)}% since ${periods.length > 0 ? academicYearLabel(periods[0]) : "the start of the series"}`
                        : "Not enough real history to compute growth/decline."}
                    </p>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Grade distribution</p>
                  <GradeDistributionChart familyId={target.familyId} gradeOrder={gradeOrder} schoolCounts={schoolGradeCounts} comparisonPercents={comparisonGradePercents} />
                </div>

                {periods.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Trend since {academicYearLabel(periods[0])}</p>
                    <TargetVsAverageTrend periods={periods} targetSeries={targetTrendSeries} averageSeries={averageTrendSeries} />
                  </div>
                )}

                {stage === "ks5" && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Value-added</p>
                    <SubjectTable subject={subject} schoolName={profile.name} entryRow={targetEntryRow} valueAddedRows={targetValueAddedRows} ksStage={stage} />
                  </div>
                )}

                {comparatorOptions.length > 0 && (
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
                  </div>
                )}

                {realComparatorRows.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Every real school in {setLabel}, ranked</p>
                    <table className="w-full text-sm">
                      <tbody>
                        {[...realComparatorRows, [profile.urn, targetRow] as [string, SubjectRow]]
                          .filter((e): e is [string, SubjectRow] => e[1] !== null && e[1].results !== null)
                          .sort((a, b) => (b[1].results ?? 0) - (a[1].results ?? 0))
                          .map(([schoolUrn, r], i) => {
                            const isTarget = schoolUrn === profile.urn;
                            const name = isTarget ? profile.name : (comparableGroup.find((p) => p.urn === schoolUrn)?.name ?? schoolUrn);
                            return (
                              <tr key={schoolUrn} className={isTarget ? "border-t border-neutral-100 bg-red-50 font-medium dark:border-neutral-800 dark:bg-red-950/40" : "border-t border-neutral-100 dark:border-neutral-800"}>
                                <td className="w-8 py-1.5 text-neutral-500">#{i + 1}</td>
                                <td className="py-1.5">
                                  {name}
                                  {isTarget && " (this school)"}
                                </td>
                                <td className="py-1.5 text-right font-medium tabular-nums">{r.results?.toFixed(1)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
