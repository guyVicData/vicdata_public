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
import { useState, type ReactNode } from "react";
import type { AcademicSchoolProfile, KsStage } from "@/lib/academic-data-view";
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
import { YearTable } from "./SeriesViews";
import { TrendLineToggle } from "./PanelFooter";
import { ChangeChart } from "./ChangeChart";
import { HorizontalBarsIcon, IconButton, MapPinIcon, Pill, RankListIcon, TableIcon, TrendLineIcon, VerticalBarsIcon } from "./PanelIcons";
import { PillMenu } from "./PillMenu";
import { MenuHeading, MenuRow, PanelMenu, useDismiss } from "./PanelMenu";
import { RankingsMap } from "./RankingsMap";
import { SchoolRankingTable, type SchoolRankingRow } from "./SchoolRankingTable";
import { TrendChart } from "./TrendChart";
import { ViewChart } from "./ViewChart";

const DIRECTION_COLOUR = { up: "#0d9488", down: "#b45309", flat: "var(--muted)" } as const;

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
  group?: "preset" | "mine" | "shared";
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
  setOptions,
  onSetChange,
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
  seriesLoading,
  emptyText,
  targetName,
  currentLabel,
  onManageSet,
  personalSetsNote,
}: {
  phase: KsStage;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  notes?: PanelNotes;
  question: string;
  source: (span?: string) => ReactNode;
  headlineLabel: string;
  setId: string;
  setOptions: SetOption[];
  onSetChange: (id: string) => void;
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
  // "2 / 8": personal sets used, for the "Your sets" heading.
  personalSetsNote?: string;
}) {
  // Column 3 round Part 1: Map is the default view, and first in the icon rail to match.
  const [view, setView] = useState<"graph" | "map" | "ranking">("map");
  // The card map's "Dot size / Colour" line, handed up by the map (onCaption) so it can
  // sit behind the caption button rather than over the map.
  const [mapCaption, setMapCaption] = useState<string | null>(null);
  // One `versus` shared by Trend and % change -- the wireframe puts the selector on both
  // and keeps them in step -- but each panel's own popover open/closed flag, or opening
  // one would open the other.
  const [versus, setVersus] = useState<string>(AVERAGE);
  const [versusOpen, setVersusOpen] = useState(false);
  const [changeVersusOpen, setChangeVersusOpen] = useState(false);
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);
  // Column 3 round Part 3: a table view beside Trend's chart.
  const [trendView, setTrendView] = useState<"chart" | "table">("chart");
  // Part 4: and one beside % change's bars.
  const [changeView, setChangeView] = useState<"chart" | "table">("chart");

  const versusRef = useDismiss(versusOpen, () => setVersusOpen(false));
  const changeVersusRef = useDismiss(changeVersusOpen, () => setChangeVersusOpen(false));

  // What the card is comparing on, in a sentence. §9 made this follow the chip, so it is
  // no longer always the phase headline.
  const comparedOn = subjectLabel ? `${subjectLabel} ${measure.label.toLowerCase()}` : headlineLabel;
  const seriesKey = measure.id === "entries" ? "candidates" : "results";
  const seriesFor = (urn: string) => seriesByUrn[urn]?.[seriesKey] ?? [];

  // §4.3: picking a different comparator set resets the "vs:" selector back to Average --
  // the school it was pointing at may not even be in the new set.
  const changeSet = (id: string) => {
    setVersus(AVERAGE);
    setVersusOpen(false);
    setChangeVersusOpen(false);
    onSetChange(id);
  };

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
  const shownRank = view === "map" && mapRank ? mapRank : targetRank && placed.length > 1 ? { rank: targetRank, total: placed.length } : null;

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
        <IconButton label="Map" active={view === "map"} onClick={() => setView("map")}>{MapPinIcon}</IconButton>
        <IconButton label="Bar chart" active={view === "graph"} onClick={() => setView("graph")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Ranking" active={view === "ranking"} onClick={() => setView("ranking")}>{RankListIcon}</IconButton>
      </>
    ),
    body: (fullscreen) => {
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
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No location is recorded for this school, so there is no map to draw.</p>
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
  const versusLabel = versusSchool ? versusSchool.name : `Average across ${setLabel.toLowerCase()}`;
  const versusValues = versusSchool
    ? valuesFor(versusSchool.urn)
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

  const trend: PanelRender = {
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
    footerLead: (
      <TrendLineToggle
        on={showFit}
        onToggle={() => setShowFit(!showFit)}
        disabled={trendView === "table" || trendChartKind(trendData) === "bars"}
      />
    ),
    // Column 3 round Part 3: a table beside the chart, as Columns 1 and 2 have.
    actions: (
      <>
        <IconButton label="Chart" active={trendView === "chart"} onClick={() => setTrendView("chart")}>{TrendLineIcon}</IconButton>
        <IconButton label="Table" active={trendView === "table"} onClick={() => setTrendView("table")}>{TableIcon}</IconButton>
      </>
    ),

    body: (fullscreen) =>
      seriesLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>
      ) : trendView === "table" ? (
        // Every school in the set, ranked on the latest year (sortable), the school's own
        // row scrolled into view.
        <CentredOnTarget watch={`trend-table:${trendTable.periods.join(",")}:${trendTable.series.length}`}>
          <YearTable data={trendTable} measure={measure} focusKey="own" fullscreen={fullscreen} nameHeading="School" />
        </CentredOnTarget>
      ) : (
        <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} focusKey="own" />
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
  const versusPct = percentChange(changeData.series[1]?.values ?? []);

  const change: PanelRender = {
    tag: "% Change",
    afterTag: <FromYearMenu periods={realPeriods} from={changeData.periods[0] ?? null} onChange={setChangeStart} />,
    question: "How much has this school moved, against its comparators?",
    controls: (
      <div className="flex flex-wrap justify-end gap-1.5">
        {versusPill(changeVersusOpen, setChangeVersusOpen, changeVersusRef)}
      </div>
    ),
    // Column 3 round Part 4: a table beside the bars, in the same format as Context's %
    // change table (ranked by change, bare rank first, no sorting).
    actions: (
      <>
        <IconButton label="Bar chart" active={changeView === "chart"} onClick={() => setChangeView("chart")}>{VerticalBarsIcon}</IconButton>
        <IconButton label="Table" active={changeView === "table"} onClick={() => setChangeView("table")}>{TableIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      seriesLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>
      ) : changeView === "table" ? (
        <CentredOnTarget watch={`change-table:${changeTable.periods.join(",")}:${changeTable.series.length}`}>
          <YearTable data={changeTable} measure={measure} focusKey="own" fullscreen={fullscreen} nameHeading="School" leadingRank />
        </CentredOnTarget>
      ) : (
      <ChangeChart
        bars={[
          { key: "own", label: "Your school", shortLabel: "You", colour: "var(--fg)", percent: ownPct },
          { key: "versus", label: versusLabel, shortLabel: versusSchool ? versusSchool.name.slice(0, 4) + "." : "Avg.", colour: "#57534e", percent: versusPct },
        ]}
        fullscreen={fullscreen}
      />
      ),
    summary:
      seriesLoading ? undefined : ownPct === null ? (
        <PanelSummary>Not enough published years yet to measure a change.</PanelSummary>
      ) : (
        <PanelSummary>
          This school&rsquo;s {comparedOn} has {ownPct >= 0 ? "risen" : "fallen"} {Math.abs(Math.round(ownPct))}% since {changeSince}
          {versusPct === null
            ? "."
            : `, against ${versusPct >= 0 ? "a rise" : "a fall"} of ${Math.abs(Math.round(versusPct))}% for ${versusLabel.toLowerCase()}.`}
        </PanelSummary>
      ),
    source: source(spanLabel(changeData.periods)),
    headline: seriesLoading ? undefined : ownPct === null || ownPct === undefined ? undefined : `${ownPct >= 0 ? "+" : "−"}${Math.abs(Math.round(ownPct))}%`,
  };

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
            {(close) => {
              // Part 3: the wireframe's three groups -- starting points, your sets, the
              // school's sets -- and a way into the chooser at the bottom.
              const row = (o: SetOption) => (
                <div key={o.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-grow">
                    <MenuRow label={o.meta ? `${o.label} · ${o.meta}` : o.label} selected={o.id === setId} onClick={() => { changeSet(o.id); close(); }} />
                  </div>
                  {o.editable && onManageSet && (
                    <button
                      type="button"
                      onClick={() => { onManageSet(o.id); close(); }}
                      className="shrink-0 rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-[var(--accent,var(--fg))] hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              );
              const mine = setOptions.filter((o) => o.group === "mine");
              const shared = setOptions.filter((o) => o.group === "shared");
              return (
                <>
                  <MenuHeading>Starting points</MenuHeading>
                  {setOptions.filter((o) => !o.group || o.group === "preset").map(row)}
                  {onManageSet && (
                    <>
                      <MenuHeading>Your sets{personalSetsNote ? ` (${personalSetsNote})` : ""}</MenuHeading>
                      {mine.length ? mine.map(row) : <p className="px-2.5 py-1 text-[12px] italic text-[var(--muted3)]">None yet</p>}
                      {shared.length > 0 && (
                        <>
                          <MenuHeading>School&rsquo;s sets</MenuHeading>
                          {shared.map(row)}
                        </>
                      )}
                      <MenuRow label="Choose schools…" onClick={() => { onManageSet(null); close(); }} />
                    </>
                  )}
                </>
              );
            }}
          </PillMenu>
          {setNote && <p className="text-[11px] text-[var(--muted3)]">{setNote}</p>}
        </div>
      }
      render={{ current, trend, change }}
    />
  );
}

