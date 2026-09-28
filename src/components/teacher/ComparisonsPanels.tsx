"use client";

// Teacher view, round 6: the Comparisons card (Rankings.dc.html; brief §4.3).
//
// Named "Comparisons" in every heading and label. §6.2 settled that as UI copy only, so
// teacher-view-rankings.ts, the `rankings` ColumnId, the rank_* view ids and the
// `<phase>:rankings` note key all stay exactly as they are -- nothing persisted changes
// and there is no migration to run.
//
// Two pills here, not Context's one combined dropdown. That is deliberate rather than
// inconsistent: Context's two dimensions are read as one sentence, so they are chosen
// together; which schools you compare with and which measure you compare on are
// independent questions, and the wireframe keeps them apart.
//
// Current has three views in the wireframe's own order -- Graph, Map, Ranking, with
// Ranking the default. The Map is the real, shipped RankingsMap, reused as-is: §4.3 is
// explicit that it is not to be rebuilt.
//
// Trend and % change compare this school against the comparator set's own history. That
// history is REAL (§6.4): fetchAcademicProfiles already returned every comparator's whole
// year series and rankSets threw it away. The wireframe's fabricated genSeries() drift is
// not used and not needed.
import { useEffect, useState, type ReactNode } from "react";
import type { AcademicSchoolProfile, KsStage, SubjectGradeCount } from "@/lib/academic-data-view";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchComparatorGrades } from "@/lib/teacher-view-comparator-grades";
import { PHASE_ACCENT, academicYearLabel } from "@/lib/teacher-view-theme";
import {
  DIRECTION_ARROW,
  DIRECTION_WORD,
  meanOf,
  rankByValue,
  percentChange,
  periodsWithData,
  sliceFrom,
  trimToData,
  trendChartKind,
  trendSentence,
  type Measure,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { CentredOnTarget } from "./CentredOnTarget";
import { FromYearMenu } from "./FromYearMenu";
import { ChangeList, ViewTitle, YearTable, type ChangeRow } from "./SeriesViews";
import { DIRECTION_COLOUR, changeOver } from "@/lib/teacher-view-trend-styles";
import { TrendLineToggle } from "./PanelFooter";
import { AverageIcon, HorizontalBarsIcon, IconButton, MapPinIcon, Pill, PodiumIcon, RankListIcon, TableIcon, TilesIcon, TrendLineIcon } from "./PanelIcons";
import { NumberTiles, ordinal, type NumberTile } from "./NumberTiles";
import type { RankingFigures } from "@/lib/chooser-sets";
import { PillMenu } from "./PillMenu";
import { MenuHeading, MenuRow, PanelMenu, useDismiss } from "./PanelMenu";
import { RankingsMap } from "./RankingsMap";
import { SchoolRankingTable, type SchoolRankingRow } from "./SchoolRankingTable";
import { TrendChart } from "./TrendChart";
import { ViewChart } from "./ViewChart";

export type MapChip = {
  key: string;
  subject: string;
  bucket: string | null;
  label: string;
  legend: string;
  hex: string;
  familyId: string | null;
};

// One "Compared against" choice. `group` (accordion round Part 3) places it in the pill's
// menu: the algorithmic presets, the teacher's own saved sets, or the school's shared ones.
export type SetOption = {
  id: string;
  label: string;
  group?: "preset" | "mine" | "shared" | "vc";
  meta?: string;
  editable?: boolean;
};

// distanceKm / independent (Column 3 round Part 2): the ranking table's distance column
// and sector icon, from the dashboard and saved-sets routes.
export type ComparatorSchool = { urn: string; name: string; isTarget: boolean; igcseExcluded?: boolean; distanceKm?: number | null; independent?: boolean };
export type SchoolSeries = { results: { period: number; value: number }[]; candidates: { period: number; value: number }[] };

// The "vs:" selector's own value: the set's average, or one named school in it.
const AVERAGE = "average";

// The subject chip row's own "no subject" value -- compare on the phase headline instead.
export const WHOLE_SCHOOL = "whole-school";

export function ComparisonsPanels({
  phase,
  panels,
  onPanelsChange,
  notes,
  question,
  source,
  headlineLabel,
  // Which comparator set is active, and what the four are called.
  setId,
  activeSet,
  setLabel,
  setNote,
  schools: allSchools,
  seriesByUrn,
  // Round 8 §3: the measure comes from the shared control bar now. This column's own
  // Candidates/Results pill is gone; only "Compared against" -- which SCHOOLS, a question
  // the shared toggle does not answer -- remains its own.
  measure,
  // Current's real, already-shipped map content.
  schoolUrn,
  mapProfiles,
  activeMapChip,
  mapRank,
  onMapRank,
  subjectLabel,
  seriesLoading: profilesLoading,
  emptyText,
  targetName,
  currentLabel,
  onManageSet,
  threshold,
  rankingSet = null,
}: {
  phase: KsStage;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  notes?: PanelNotes;
  question: string;
  source: (span?: string) => ReactNode;
  headlineLabel: string;
  setId: string;
  // Comparator dropdown round: the one set the column is on. The pill shows it and hands
  // every change to the chooser (onManageSet) -- it no longer lists other sets itself.
  activeSet: SetOption;
  setLabel: string;
  // The set's own caveat, where it has one ("Independent schools only").
  setNote?: ReactNode;
  schools: ComparatorSchool[];
  seriesByUrn: Record<string, SchoolSeries>;
  measure: Measure;
  schoolUrn: string | null;
  mapProfiles: AcademicSchoolProfile[] | null;
  activeMapChip: MapChip | null;
  mapRank: { rank: number; total: number } | null;
  onMapRank: (info: { rank: number; total: number } | null) => void;
  // Round 7 §9: the active subject chip's own label, or null for the whole school. Every
  // view reads the same selection, so the narrative has to name it too -- a rank "on
  // Geography avg. point score" is a different statement from one on Attainment 8.
  subjectLabel: string | null;
  // The per-subject rows arrive on their own, heavier fetch than the rest of the card
  // (they are the map's profiles). With a subject chip active by default, saying "no
  // published figures" while they are still in flight would be a plain lie.
  seriesLoading: boolean;
  emptyText: string;
  // Content round S9: the school's real name for its own row, in place of "This school".
  targetName: string;
  // S11: the Current tag names what is compared and against whom, e.g. "Candidates at the
  // Nearest 10 Schools 2024/25" -- built by the page from the live set label.
  currentLabel: string;
  // Part 3: open the comparator chooser -- a set's id to edit it, null for a new set.
  onManageSet?: (setId: string | null) => void;
  // Set when Results is on a grade threshold (Grade 4+ / A*-E rate) with a subject in
  // focus. The map's profiles carry only entries and average point score per subject, so
  // the rates come from each school's own per-grade counts (/api/teacher/comparator-grades),
  // fetched here for the set's schools and scored by `rateOf` -- the page's own
  // thresholdRate, so every school is scored exactly as the school itself is.
  threshold?: { subject: string; qualificationType: string; rateOf: (rows: SubjectGradeCount[]) => number | null } | null;
  // Snagging round 1 Part 4: set when the active comparator is a national/regional
  // RANKING (the chooser's 3a/3b) rather than a list of schools. Its schools are a sample
  // (the top and this school's neighbours), so the column shows no map of them; it shows
  // the school's rank in the whole population and that population's true average instead,
  // on the ranking's own measure (`measure`, the phase headline).
  rankingSet?: (RankingFigures & { measure: Measure; measureName: string }) | null;
}) {
  // ------------------------------------------- threshold rates (grade counts per school)
  const gradeUrns = allSchools.map((s) => s.urn).sort();
  const gradesKey = threshold && schoolUrn ? `${threshold.subject}|${gradeUrns.join(",")}` : null;
  const [grades, setGrades] = useState<{ key: string; rows: Record<string, SubjectGradeCount[]> | null } | null>(null);
  useEffect(() => {
    // After the map's profiles have landed, not beside them: the two lookups hit the same
    // reference database, and run together the heavier one can cross its statement timeout
    // (the academic-subject-comparison route serialises them for the same reason).
    if (!gradesKey || !threshold || !schoolUrn || profilesLoading || grades?.key === gradesKey) return;
    let cancelled = false;
    (async () => {
      const rows = await fetchComparatorGrades(createBrowserSupabaseClient(), schoolUrn, gradeUrns, phase, threshold.subject);
      if (!cancelled) setGrades({ key: gradesKey, rows });
    })();
    return () => { cancelled = true; };
    // gradesKey carries the subject and the schools; threshold and gradeUrns are read through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradesKey, schoolUrn, phase, profilesLoading, grades?.key]);
  const gradesLoaded = !!gradesKey && grades?.key === gradesKey;
  const seriesLoading = profilesLoading || (!!gradesKey && !gradesLoaded);
  // Each school's rate per year: its rows for this subject AND this qualification type
  // (a GCSE and a Cambridge National in one subject are scored apart), as the page does.
  const rateSeries: Record<string, { period: number; value: number }[]> = {};
  if (threshold && gradesLoaded && grades?.rows) {
    for (const [urn, rows] of Object.entries(grades.rows)) {
      const mine = rows.filter((g) => g.subject === threshold.subject && g.qualificationType === threshold.qualificationType);
      rateSeries[urn] = Array.from(new Set(mine.map((g) => g.period)))
        .sort((a, b) => a - b)
        .map((period) => ({ period, value: threshold.rateOf(mine.filter((g) => g.period === period)) }))
        .filter((r): r is { period: number; value: number } => r.value !== null);
    }
  }

  // Column 3 round Part 1: Map is the default view, and first in the icon rail to match.
  const [viewChosen, setView] = useState<"tiles" | "graph" | "map" | "ranking">("map");
  // Part 4: a ranking has no Map -- its default is the tiles view -- and a list of schools
  // has no tiles view; whichever was chosen falls back to the other's default.
  const view = rankingSet ? (viewChosen === "map" ? "tiles" : viewChosen) : viewChosen === "tiles" ? "map" : viewChosen;
  // The card map's "Dot size / Colour" line, handed up by the map (onCaption) so it can
  // sit behind the caption button rather than over the map.
  const [mapCaption, setMapCaption] = useState<string | null>(null);
  // Trend's "vs:" choice. % Change no longer has one: its list shows every school, with
  // the set's average as a reference line.
  // Stamped with the set it was chosen in: a different set (chosen in the chooser) reads
  // as Average again -- the school it pointed at may not even be in the new set (§4.3).
  const [versusChoice, setVersusChoice] = useState<{ set: string; urn: string }>({ set: setId, urn: AVERAGE });
  const versus = versusChoice.set === setId ? versusChoice.urn : AVERAGE;
  const setVersus = (urn: string) => setVersusChoice({ set: setId, urn });
  const [versusOpen, setVersusOpen] = useState(false);
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);
  // Column 3 round Part 3: a table view beside Trend's chart.
  // Trends row merge round: Trend's and % change's views share one Trends panel, so one view
  // state spans both halves -- Trend's (chart, table, map) then % change's (ranked bars,
  // table, map).
  const [trendsView, setTrendsView] = useState<"chart" | "table" | "map" | "changeChart" | "changeTable" | "changeMap">("chart");
  const isChange = trendsView === "changeChart" || trendsView === "changeTable" || trendsView === "changeMap";
  const trendView: "chart" | "table" | "map" = isChange ? "chart" : (trendsView as "chart" | "table" | "map");
  const setTrendView = (v: "chart" | "table" | "map") => setTrendsView(v);
  // Part 4: and one beside % change's bars.
  const changeView: "chart" | "table" | "map" = trendsView === "changeTable" ? "table" : trendsView === "changeMap" ? "map" : "chart";
  const setChangeView = (v: "chart" | "table" | "map") => setTrendsView(v === "table" ? "changeTable" : v === "map" ? "changeMap" : "changeChart");

  const versusRef = useDismiss(versusOpen, () => setVersusOpen(false));

  // What the card is comparing on, in a sentence. §9 made this follow the chip, so it is
  // no longer always the phase headline.
  const comparedOn = subjectLabel ? `${subjectLabel} ${measure.label.toLowerCase()}` : headlineLabel;
  const seriesKey = measure.id === "entries" ? "candidates" : "results";
  const seriesFor = (urn: string) => (threshold ? rateSeries[urn] ?? [] : seriesByUrn[urn]?.[seriesKey] ?? []);

  // Content round S4: a comparator with no published figure for what is being compared --
  // at Post-16 most often a school that does not offer the focused subject -- is simply
  // not listed for it, rather than drawn as a bare "—  —" row. Per subject and per
  // measure: the same school reappears for any subject it does have figures for. Not
  // applied while the per-subject rows are still loading, when "no data yet" is not "no
  // data". The school itself always stays.
  const schools = seriesLoading ? allSchools : allSchools.filter((s) => s.isTarget || seriesFor(s.urn).length > 0);
  const target = schools.find((s) => s.isTarget) ?? null;
  const others = schools.filter((s) => !s.isTarget);

  // Every period any school in the set has a figure for, ascending -- the real range, per
  // §6.3, which is also what reconciles the date-range inconsistency the wireframe flagged
  // but could not fix: there is no fixed range left to disagree with the other columns.
  const periods = Array.from(new Set(schools.flatMap((s) => seriesFor(s.urn).map((r) => r.period)))).sort((a, b) => a - b);
  const valuesFor = (urn: string) => periods.map((p) => seriesFor(urn).find((r) => r.period === p)?.value ?? null);

  const latestIdx = (() => {
    for (let i = periods.length - 1; i >= 0; i--) if (schools.some((s) => valuesFor(s.urn)[i] !== null)) return i;
    return -1;
  })();
  const latest = latestIdx >= 0 ? periods[latestIdx] : null;
  const valueAt = (urn: string) => (latestIdx >= 0 ? valuesFor(urn)[latestIdx] : null);

  // ------------------------------------------------------------------ Current
  // A comparator with history but nothing in the latest year is left out of the ranking
  // for the same reason: a row of dashes is not a position.
  const ranked = [...schools]
    .map((s) => ({ ...s, value: valueAt(s.urn) }))
    .filter((r) => r.isTarget || r.value !== null)
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const placed = ranked.filter((r) => r.value !== null);
  const rankOfUrn = rankByValue(ranked.map((r) => ({ key: r.urn, value: r.value })));
  const targetRank = target ? rankOfUrn.get(target.urn) ?? null : null;
  // The Map reports its own rank, computed inside AcademicMapView over the schools it
  // could actually plot. Where it has one it wins, because a figure beside a map should
  // match the map.
  // Not on a rate: the map is still coloured and ranked by average point score.
  // Part 4: on a ranking, compared on the ranking's own measure (the headline, no subject
  // chip, not entries), the rank is the one in the WHOLE population, not in the sample.
  const onRankingMeasure = !!rankingSet && !subjectLabel && !threshold && measure.id !== "entries";
  const setRank = rankingSet?.targetRank ? { rank: rankingSet.targetRank, total: rankingSet.ranked } : null;
  const shownRank =
    (onRankingMeasure || view === "tiles") && setRank
      ? setRank
      : view === "map" && mapRank && !threshold
        ? mapRank
        : targetRank && placed.length > 1
          ? { rank: targetRank, total: placed.length }
          : null;
  const rankingAverageAt = (period: number | null) => (period === null ? null : rankingSet?.average.find((a) => a.period === period)?.value ?? null);

  // Column 3 round Part 2: the school-ranking table's rows -- rank, school, sector,
  // figure, distance from the school itself.
  const rankingRows: SchoolRankingRow[] = ranked.map((r) => ({
    key: r.urn,
    name: r.isTarget ? targetName : r.name,
    rank: rankOfUrn.get(r.urn) ?? null,
    value: r.value,
    valueLabel: r.value === null ? (r.igcseExcluded ? "not comparable" : "—") : measure.format(r.value),
    distanceKm: r.distanceKm ?? null,
    independent: r.independent ?? null,
    isTarget: r.isTarget,
  }));

  const current: PanelRender = {
    tag: `${currentLabel} ${latest === null ? "" : academicYearLabel(latest)}`.trim(),
    question,
    actions: (
      <>
        {rankingSet ? (
          <IconButton label="Number tiles" active={view === "tiles"} onClick={() => setView("tiles")}>{TilesIcon}</IconButton>
        ) : (
          <IconButton label="Map" active={view === "map"} onClick={() => setView("map")}>{MapPinIcon}</IconButton>
        )}
        <IconButton label="Bar chart" active={view === "graph"} onClick={() => setView("graph")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Ranking" active={view === "ranking"} onClick={() => setView("ranking")}>{RankListIcon}</IconButton>
      </>
    ),
    body: (fullscreen) => {
      if (view === "tiles" && rankingSet) {
        // Part 4: always on the ranking's own measure, whatever Column 1 is showing --
        // that is what the population was ranked on; the label says which.
        const rs = rankingSet;
        const tiles: NumberTile[] = [];
        if (rs.targetRank) tiles.push({ key: "rank", icon: PodiumIcon, figure: ordinal(rs.targetRank), detail: `of ${rs.ranked.toLocaleString()} in this set` });
        // The set's average for the SAME year as the main figure (the graphs' figure too);
        // the latest-of-each average the rank is on only where that year has none.
        const avg = (rs.target ? rankingAverageAt(rs.target.period) : null) ?? rs.averageLatest;
        if (avg !== null) tiles.push({ key: "average", icon: AverageIcon, figure: rs.measure.format(avg), detail: "average across this set" });
        return (
          <NumberTiles
            main={rs.target ? { figure: rs.measure.format(rs.target.value), label: `${targetName} ${rs.measureName} in ${academicYearLabel(rs.target.period)}` } : null}
            tiles={tiles}
            fullscreen={fullscreen}
          />
        );
      }
      if (schools.length === 0) return <p className="text-sm text-[var(--muted)]">{emptyText}</p>;
      // The map draws its own loading state, so only the other two views need one.
      if (seriesLoading && view !== "map") return <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>;
      if (view === "map") {
        return schoolUrn ? (
          // A live Leaflet map, which does not print -- the Ranking view is the one that
          // does. (Map is now the default view on screen, Column 3 round Part 1.) On the
          // card it fills whatever height the panel leaves it rather than a fixed 288px.
          <div className={fullscreen ? "print:hidden" : "flex min-h-0 flex-1 flex-col print:hidden"}>
            <RankingsMap
              profiles={mapProfiles}
              targetUrn={schoolUrn}
              stage={phase}
              heightClass={fullscreen ? "h-[70vh] min-h-[22rem]" : "min-h-[10rem] flex-1"}
              subject={activeMapChip?.subject ?? null}
              subjectLabel={activeMapChip?.legend ?? null}
              subjectBucket={activeMapChip?.bucket ?? null}
              familyId={activeMapChip?.familyId ?? null}
              dense={!fullscreen}
              // The phase's own accent for the value scale (Teacher view only), and the
              // card map's explanation line handed up rather than printed on the map.
              accentHex={phase === "ks2" ? null : PHASE_ACCENT[phase]?.hex ?? null}
              onCaption={fullscreen ? undefined : setMapCaption}
              onTargetRank={onMapRank}
              // Comparisons change-map round: Current is about standing, so its map is the
              // value colour only -- change has its own maps on Trend and % change.
              forcedColourMode={phase === "ks2" ? "grade_band" : "accent"}
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No location is recorded for this school, so there is no map to draw.</p>
        );
      }
      if (view === "graph" && onRankingMeasure) {
        // Part 4: the school against its set's average, not against the sample's schools.
        const avg = rankingAverageAt(latest);
        return (
          <ViewChart
            layout="row"
            unit=""
            formatValue={measure.format}
            scaleMax={measure.barScaleMax ?? undefined}
            computed={{
              rows: [
                ...(target ? [{ label: targetName, value: valueAt(target.urn), isSubject: true, color: "var(--accent,var(--fg))", emphasis: true }] : []),
                { label: "Set average", value: avg, isSubject: false, color: "var(--muted3)", emphasis: false },
              ],
            }}
          />
        );
      }
      if (view === "graph") {
        return (
          <ViewChart
            layout="row"
            unit=""
            formatValue={measure.format}
            scaleMax={measure.barScaleMax ?? undefined}
            computed={{
              // No benchmark marker: the other bars ARE the comparison (§4.3). Your own
              // school takes the foreground colour and reads bold.
              rows: ranked.map((r) => ({
                label: r.isTarget ? targetName : r.name,
                value: r.value,
                isSubject: r.isTarget,
                color: r.isTarget ? "var(--accent,var(--fg))" : "var(--muted3)",
                emphasis: r.isTarget,
              })),
            }}
          />
        );
      }
      return (
        // Round 8 §4: a comparator set longer than the panel scrolls within its own box.
        // The panel's height is fixed now, so without this a 10-school set would either
        // overflow it or push the footer off the bottom.
        <CentredOnTarget watch={rankingRows.map((r) => r.key).join(",")}>
          <SchoolRankingTable
            rows={rankingRows}
            valueHeading={measure.id === "entries" ? "Entries" : "Result"}
            targetName={targetName}
            fullscreen={fullscreen}
          />
        </CentredOnTarget>
      );
    },
    summary: seriesLoading ? undefined : shownRank ? (
      <PanelSummary>
        This school is {shownRank.rank} of {shownRank.total} on {comparedOn}, among {setLabel.toLowerCase()}.
        {view === "map" && mapCaption ? ` ${mapCaption}.` : ""}
      </PanelSummary>
    ) : (
      <PanelSummary>
        {subjectLabel
          ? `No published ${subjectLabel} figure for this school to rank against this set.`
          : "No nearby schools with comparable published data for this phase."}
      </PanelSummary>
    ),
    source: source(),
    // Column 3 round Part 1: a visible "Full screen" line under the card -- the map
    // especially reads far better with room.
    suggestFullscreen: true,
    // S10: the collapsed bar's figure -- where the school sits in the set.
    headline: seriesLoading || !shownRank ? undefined : `${shownRank.rank} of ${shownRank.total}`,
  };

  // ------------------------------------------------- the "vs:" selector (§4.3)
  const versusSchool = others.find((s) => s.urn === versus) ?? null;
  // Column 3 round Part 3: "All schools, individually" is gone (it shipped in c76312e) --
  // the set's average or one named school, as before it.
  // Part 4: on a ranking the "Average" is the whole population's, on the ranking's own
  // measure; on any other measure it can only be the schools shown, and says so.
  const versusLabel = versusSchool
    ? versusSchool.name
    : rankingSet
      ? onRankingMeasure
        ? `Average across this set (${rankingSet.ranked.toLocaleString()} schools)`
        : "Average of the schools shown"
      : `Average across ${setLabel.toLowerCase()}`;
  const versusValues = versusSchool
    ? valuesFor(versusSchool.urn)
    : onRankingMeasure
      ? periods.map((p) => rankingAverageAt(p))
      : // The set's average per period, over the schools that genuinely have a figure that
        // year -- so a school joining or leaving the published data does not read as the
        // whole set moving.
        periods.map((_, i) => meanOf(others.map((s) => valuesFor(s.urn)[i])));

  const versusPill = (open: boolean, setOpenState: (v: boolean) => void, ref: React.RefObject<HTMLDivElement | null>) => (
    <div className="relative" ref={ref}>
      <Pill label={`vs: ${versusLabel} ▾`} expanded={open} onClick={() => setOpenState(!open)} />
      {open && (
        <PanelMenu label="Compare with" align="right" width={220}>
          <MenuHeading>Compare with</MenuHeading>
          <MenuRow
            label={`Average across ${setLabel.toLowerCase()}`}
            selected={versus === AVERAGE}
            onClick={() => { setVersus(AVERAGE); setOpenState(false); }}
          />
          {others.map((s) => (
            <MenuRow
              key={s.urn}
              label={s.name}
              selected={versus === s.urn}
              onClick={() => { setVersus(s.urn); setOpenState(false); }}
            />
          ))}
        </PanelMenu>
      )}
    </div>
  );

  const full: PanelData = trimToData({
    periods,
    series: [
      // Column 3 round Part 3: the school in the phase accent, as the bar graph already
      // draws it; the comparison as a solid line (it was dashed). TrendChart is told which
      // line is the focus (focusKey "own"), so it still draws on top and the fit follows it.
      { key: "own", label: "Your school", colour: "var(--accent,var(--fg))", values: target ? valuesFor(target.urn) : [] },
      { key: "versus", label: versusLabel, colour: "var(--muted3)", values: versusValues },
    ],
  });
  const realPeriods = periodsWithData(full);
  const trendData = sliceFrom(full, trendStart);
  const changeData = sliceFrom(full, changeStart);
  // The Trend and % Change tables list every school in the set, one row each, over the
  // same years as the charts (which keep the two series above). The school's own row is
  // "own", so it is picked out and centred as the charts' line is.
  const everySchool: PanelData = {
    periods: full.periods,
    series: schools.map((s) => {
      const values = valuesFor(s.urn);
      return {
        key: s.isTarget ? "own" : s.urn,
        label: s.name,
        colour: s.isTarget ? "var(--accent,var(--fg))" : "var(--muted3)",
        values: full.periods.map((p) => values[periods.indexOf(p)] ?? null),
      };
    }),
  };
  const trendTable = sliceFrom(everySchool, trendStart);
  const changeTable = sliceFrom(everySchool, changeStart);
  const spanLabel = (ps: number[]) => (ps.length ? `${academicYearLabel(ps[0])}–${academicYearLabel(ps[ps.length - 1])}` : "");

  // Comparisons change-map round: Trend's and % change's own maps -- each school's change
  // as that panel measures it (its measure, its "From" year), coloured on the one red-
  // orange-green scale. Not for a ranking (a sample of a population, Part 4 of snagging
  // round 1), and only with two or more years to measure a change across.
  const changeMapFor = (table: PanelData, value: (values: (number | null)[]) => number | null) => {
    const byUrn: Record<string, number> = {};
    for (const s of table.series) {
      const v = value(s.values);
      if (v !== null) byUrn[s.key === "own" ? target?.urn ?? s.key : s.key] = v;
    }
    return byUrn;
  };
  const changeMap = (fullscreen: boolean, forced: "trend" | "trend_absolute", changeValues: { byUrn: Record<string, number>; format: (v: number) => string; label: string }) =>
    schoolUrn ? (
      <div className="flex min-h-0 flex-1 flex-col print:hidden">
        <RankingsMap
          // This set's schools only: the page's profiles cover every set's schools, and one
          // outside this set has no change here to colour it by.
          profiles={mapProfiles ? mapProfiles.filter((p) => p.urn === schoolUrn || schools.some((sc) => sc.urn === p.urn)) : null}
          targetUrn={schoolUrn}
          stage={phase}
          heightClass={fullscreen ? "min-h-[22rem] flex-1" : "min-h-[10rem] flex-1"}
          subject={activeMapChip?.subject ?? null}
          subjectLabel={activeMapChip?.legend ?? null}
          subjectBucket={activeMapChip?.bucket ?? null}
          familyId={activeMapChip?.familyId ?? null}
          dense={!fullscreen}
          accentHex={phase === "ks2" ? null : PHASE_ACCENT[phase]?.hex ?? null}
          forcedColourMode={forced}
          changeValues={changeValues}
        />
      </div>
    ) : null;
  const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`;

  // -------------------------------------------------------------------- Trend
  const trendSaid = trendSentence({
    subjectClause: `Your school's ${comparedOn}`,
    values: trendData.series[0]?.values ?? [],
    measure,
    startLabel: trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "",
  });
  const versusClause = (() => {
    const vals = (trendData.series[1]?.values ?? []).filter((v): v is number => v !== null);
    if (vals.length < 2) return "";
    return ` — against ${versusLabel.toLowerCase()}'s own ${measure.format(vals[0])} to ${measure.format(vals[vals.length - 1])} over the same years.`;
  })();

  // Below TREND_LINE_MIN_YEARS real years TrendChart could only draw bars per year, which
  // is not a trend line: the panel is the table alone until the span supports a line.
  const hasTrendLine = trendChartKind(trendData) === "line";
  const trendMapOk = !rankingSet && !!schoolUrn && trendTable.periods.length >= 2;
  const trendShows = trendView === "map" && trendMapOk ? "map" : trendView === "table" || !hasTrendLine ? "table" : "chart";

  // The one title line over every view (ViewTitle): what is compared, over which schools,
  // in which shape -- so a screenshot of the body alone says which view it is.
  const setNoun = setLabel.toLowerCase();
  const trendFrom = trendTable.periods.length ? academicYearLabel(trendTable.periods[0]) : "the first year";
  const trendHalf: PanelRender = {
    // S11: one uniform title, with the span's start as its own dropdown beside it.
    tag: "Trends",
    afterTag: <FromYearMenu periods={realPeriods} from={trendData.periods[0] ?? null} onChange={setTrendStart} />,
    question: "How has this school moved against its comparators, year on year?",
    controls: (
      <div className="flex flex-wrap justify-end gap-1.5">
        {versusPill(versusOpen, setVersusOpen, versusRef)}
      </div>
    ),
    // S12: the direction flag sits right-aligned in the footer; the full sentence is its
    // tooltip here and the caption in fullscreen, where there is room for it.
    flag: !seriesLoading && trendSaid ? (
      <span title={trendSaid.sentence} style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ) : undefined,
    footerLead: hasTrendLine ? (
      <TrendLineToggle on={showFit} onToggle={() => setShowFit(!showFit)} disabled={isChange || trendShows !== "chart"} />
    ) : undefined,
    // Column 3 round Part 3: a table beside the chart, as Columns 1 and 2 have -- only once
    // there is a line to show; before that the table is the one view (with the map
    // beside it where there is one), so no Chart button.
    // Trends row merge round: always a rail now -- with % change's views beside Trend's, the
    // Trend table needs its own button to come back to, even when it is Trend's only view.
    actions: (
      <>
        {hasTrendLine && <IconButton label="Chart" active={!isChange && trendShows === "chart"} onClick={() => setTrendView("chart")}>{TrendLineIcon}</IconButton>}
        <IconButton label="Trend table" active={!isChange && trendShows === "table"} onClick={() => setTrendView("table")}>{TableIcon}</IconButton>
        {trendMapOk && <IconButton label="Trend map" active={!isChange && trendShows === "map"} onClick={() => setTrendView("map")}>{MapPinIcon}</IconButton>}
      </>
    ),
    suggestFullscreen: trendShows === "map",

    body: (fullscreen) =>
      seriesLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>
      ) : trendShows === "map" ? (
        // Each school coloured by its absolute change over this panel's span (red fell,
        // orange about level, green rose), scaled to this set's own real range.
        <>
          <ViewTitle>Change in {comparedOn} since {trendFrom}, coloured by school</ViewTitle>
          {changeMap(fullscreen, "trend_absolute", {
            byUrn: changeMapFor(trendTable, (v) => changeOver(v)?.delta ?? null),
            format: measure.formatDelta,
            label: `change since ${trendFrom}`,
          })}
        </>
      ) : trendShows === "table" ? (
        // Every school in the set, ranked on the latest year (sortable), the school's own
        // row scrolled into view. Also the only view while the span is too short for a
        // line, whatever trendView was left on.
        <>
          <ViewTitle>Every school in the {setNoun}: {comparedOn}, year by year</ViewTitle>
          <CentredOnTarget watch={`trend-table:${trendTable.periods.join(",")}:${trendTable.series.length}`}>
            <YearTable data={trendTable} measure={measure} focusKey="own" fullscreen={fullscreen} nameHeading="School" />
          </CentredOnTarget>
        </>
      ) : (
        <>
          <ViewTitle>This school&rsquo;s {comparedOn} against {versusLabel.charAt(0).toLowerCase() + versusLabel.slice(1)}, year by year</ViewTitle>
          <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} focusKey="own" />
        </>
      ),
    summary: seriesLoading ? undefined : trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence.replace(/\.$/, "")}{versusClause || "."}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend for this school.</PanelSummary>
    ),
    source: source(spanLabel(trendData.periods)),
    headline: seriesLoading || !trendSaid ? undefined : (
      <span style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ),
  };

  // ---------------------------------------------------------------- % change
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";
  const ownPct = percentChange(changeData.series[0]?.values ?? []);
  // Every school's % change over the span, as the table ranks them, and the set's average
  // (the mean figure per year over the schools that have one, as Trend's "Average across"
  // line) as the reference -- not whichever school Trend's "vs:" points at.
  const changeRows: ChangeRow[] = changeTable.series.map((s) => ({ key: s.key, label: s.label, colour: s.colour, value: percentChange(s.values) }));
  const averageLabel = `Average across ${setLabel.toLowerCase()}`;
  const averagePct = percentChange(
    changeTable.periods.map((_, i) => meanOf(changeTable.series.filter((s) => s.key !== "own").map((s) => s.values[i]))),
  );

  const changeMapOk = !rankingSet && !!schoolUrn && changeTable.periods.length >= 2;
  const changeShows = changeView === "map" && !changeMapOk ? "chart" : changeView;

  const changeHalf: PanelRender = {
    tag: "% Change",
    afterTag: <FromYearMenu periods={realPeriods} from={changeData.periods[0] ?? null} onChange={setChangeStart} />,
    question: "How much has this school moved, against its comparators?",
    // Column 3 round Part 4: a table beside the chart, in the same format as Context's %
    // change table (ranked by change, bare rank first, no sorting).
    actions: (
      <>
        <IconButton label="Ranked bars" active={isChange && changeShows === "chart"} onClick={() => setChangeView("chart")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Change table" active={isChange && changeShows === "table"} onClick={() => setChangeView("table")}>{TableIcon}</IconButton>
        {changeMapOk && <IconButton label="Change map" active={isChange && changeShows === "map"} onClick={() => setChangeView("map")}>{MapPinIcon}</IconButton>}
      </>
    ),
    suggestFullscreen: changeShows === "map",
    body: (fullscreen) =>
      seriesLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>
      ) : changeShows === "map" ? (
        // The map that was Current's "Trends" mode, here on the panel it is about: each
        // school's % change over this panel's span, the same figures as the ranked bars.
        <>
          <ViewTitle>% change in {comparedOn} since {changeSince}, coloured by school</ViewTitle>
          {changeMap(fullscreen, "trend", { byUrn: changeMapFor(changeTable, percentChange), format: signedPct, label: `% change since ${changeSince}` })}
        </>
      ) : changeShows === "table" ? (
        <>
          <ViewTitle>Every school in the {setNoun}: {changeSince} against the latest year, ranked by change</ViewTitle>
          <CentredOnTarget watch={`change-table:${changeTable.periods.join(",")}:${changeTable.series.length}`}>
            <YearTable data={changeTable} measure={measure} focusKey="own" fullscreen={fullscreen} nameHeading="School" leadingRank />
          </CentredOnTarget>
        </>
      ) : (
        // Option H, as Candidates and Context draw their % change: every school ranked by
        // its change, the school itself picked out, the set's average a dashed line.
        <>
          <ViewTitle>% change in {comparedOn} since {changeSince}, ranked against the {setNoun}</ViewTitle>
          <CentredOnTarget watch={`change-list:${changeTable.periods.join(",")}:${changeTable.series.length}`}>
            <ChangeList rows={changeRows} focusKey="own" group={{ label: averageLabel, value: averagePct }} />
          </CentredOnTarget>
        </>
      ),
    summary:
      seriesLoading ? undefined : ownPct === null ? (
        <PanelSummary>Not enough published years yet to measure a change.</PanelSummary>
      ) : (
        <PanelSummary>
          This school&rsquo;s {comparedOn} has {ownPct >= 0 ? "risen" : "fallen"} {Math.abs(Math.round(ownPct))}% since {changeSince}
          {averagePct === null
            ? "."
            : `, against ${averagePct >= 0 ? "a rise" : "a fall"} of ${Math.abs(Math.round(averagePct))}% for the ${averageLabel.toLowerCase()}.`}
        </PanelSummary>
      ),
    source: source(spanLabel(changeData.periods)),
    headline: seriesLoading ? undefined : ownPct === null || ownPct === undefined ? undefined : `${ownPct >= 0 ? "+" : "−"}${Math.abs(Math.round(ownPct))}%`,
  };

  // Trends row merge round: the one Trends panel -- Trend's views then % change's in one
  // rail. The "From" menu, question, summary, source and full-screen invitation follow the
  // half the view on screen belongs to; the "vs:" pill belongs to Trend's chart, so it
  // shows only on Trend's views. The tag, direction flag, Trend-line toggle and collapsed
  // figure are Trend's.
  const trend: PanelRender = {
    ...trendHalf,
    afterTag: isChange ? changeHalf.afterTag : trendHalf.afterTag,
    question: isChange ? changeHalf.question : trendHalf.question,
    controls: isChange ? undefined : trendHalf.controls,
    actions: (
      <>
        {trendHalf.actions}
        {changeHalf.actions}
      </>
    ),
    suggestFullscreen: isChange ? changeHalf.suggestFullscreen : trendHalf.suggestFullscreen,
    body: (fullscreen) => (isChange ? changeHalf.body(fullscreen) : trendHalf.body(fullscreen)),
    summary: isChange ? changeHalf.summary : trendHalf.summary,
    source: isChange ? changeHalf.source : trendHalf.source,
  };

  // On a rate, a school that publishes no grades for the subject drops out of the lists as
  // it does for points. The whole column gives way to a note only when no comparator has a
  // rate at all, or the grade counts could not be loaded.
  const unavailableNote = !threshold || !gradesLoaded
    ? null
    : grades?.rows === null
      ? `Comparator schools' ${measure.label.replace(/^Grade/, "grade")} for ${subjectLabel ?? threshold.subject} could not be loaded. Try again shortly.`
      : others.length === 0 && allSchools.some((s) => !s.isTarget)
        ? `None of the ${setLabel.toLowerCase()} publishes a ${measure.label.replace(/^Grade/, "grade")} for ${subjectLabel ?? threshold.subject}.`
        : null;

  // The panel keeps its tag and question; its views, controls and figures give way to the
  // note, as Results' % Change does when LA / region / England figures don't exist.
  const notAvailable = (p: PanelRender): PanelRender => ({
    tag: p.tag,
    question: p.question,
    body: () => (
      <>
        {subjectLabel && <p className="shrink-0 text-[12px] font-semibold text-[var(--muted2)]">{subjectLabel} against comparator schools</p>}
        <p className="text-[12px] leading-relaxed text-[var(--muted2)]">{unavailableNote}</p>
      </>
    ),
  });

  return (
    <ColumnPanels
      columnId="rankings"
      panels={panels}
      onPanelsChange={onPanelsChange}
      notes={notes}
      controls={
        <div className="flex flex-col items-start gap-1.5">
          {/* The same PillMenu Context uses, so round 7 §8's "matching Comparisons'
              pattern exactly" is one component rather than two lookalikes. */}
          <PillMenu label="Compared against" value={setLabel} menuLabel="Compared against" width={260}>
            {(close) => (
              // Comparator dropdown round: the same shape as Context's pill -- what is
              // selected, then the way into the chooser to change it -- instead of its own
              // list of presets and saved sets (the chooser's hub lists every set).
              <>
                <MenuHeading>Compared against</MenuHeading>
                <MenuRow label={activeSet.meta ? `${activeSet.label} · ${activeSet.meta}` : activeSet.label} selected onClick={close} />
                {onManageSet && activeSet.editable && (
                  <MenuRow label="Edit this set…" indented onClick={() => { onManageSet(activeSet.id); close(); }} />
                )}
                {onManageSet && <MenuRow label="Change comparison…" onClick={() => { onManageSet(null); close(); }} />}
              </>
            )}
          </PillMenu>
          {setNote && <p className="text-[11px] text-[var(--muted3)]">{setNote}</p>}
        </div>
      }
      render={unavailableNote ? { current: notAvailable(current), trend: notAvailable(trend) } : { current, trend }}
    />
  );
}

