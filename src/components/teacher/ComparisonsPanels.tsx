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
import { academicYearLabel } from "@/lib/teacher-view-theme";
import {
  DIRECTION_ARROW,
  DIRECTION_WORD,
  meanOf,
  nextStart,
  rankByValue,
  percentChange,
  periodsWithData,
  sliceFrom,
  trimToData,
  startOptions,
  trendSentence,
  type Measure,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { ChangeChart } from "./ChangeChart";
import { HorizontalBarsIcon, IconButton, MapPinIcon, Pill, RankListIcon } from "./PanelIcons";
import { PillMenu } from "./PillMenu";
import { MenuHeading, MenuRow, PanelMenu, useDismiss } from "./PanelMenu";
import { RankingsMap } from "./RankingsMap";
import { SortTable, nextSort, type SortRow, type SortState } from "./SortTable";
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

export type ComparatorSchool = { urn: string; name: string; isTarget: boolean; igcseExcluded?: boolean };
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
  schools,
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
}: {
  phase: KsStage;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  notes?: PanelNotes;
  question: string;
  source: (span?: string) => ReactNode;
  headlineLabel: string;
  setId: string;
  setOptions: { id: string; label: string }[];
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
}) {
  // Ranking is the default view (§4.3), even though Graph comes first in the icon row.
  const [view, setView] = useState<"graph" | "map" | "ranking">("ranking");
  const [sort, setSort] = useState<SortState>({ key: "delta", dir: "asc" });
  // One `versus` shared by Trend and % change -- the wireframe puts the selector on both
  // and keeps them in step -- but each panel's own popover open/closed flag, or opening
  // one would open the other.
  const [versus, setVersus] = useState<string>(AVERAGE);
  const [versusOpen, setVersusOpen] = useState(false);
  const [changeVersusOpen, setChangeVersusOpen] = useState(false);
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);

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
  const ranked = [...schools]
    .map((s) => ({ ...s, value: valueAt(s.urn) }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const placed = ranked.filter((r) => r.value !== null);
  const rankOfUrn = rankByValue(ranked.map((r) => ({ key: r.urn, value: r.value })));
  const targetRank = target ? rankOfUrn.get(target.urn) ?? null : null;
  // The Map reports its own rank, computed inside AcademicMapView over the schools it
  // could actually plot. Where it has one it wins, because a figure beside a map should
  // match the map.
  const shownRank = view === "map" && mapRank ? mapRank : targetRank && placed.length > 1 ? { rank: targetRank, total: placed.length } : null;

  const rankingRows: SortRow[] = ranked.map((r) => ({
    key: r.urn,
    label: r.isTarget ? "This school" : r.name,
    value: r.value,
    valueLabel: r.value === null ? (r.igcseExcluded ? "not comparable" : "—") : measure.format(r.value),
    // The third column IS the rank here, so it sorts on the rank rather than on a delta.
    delta: rankOfUrn.get(r.urn) ?? null,
    deltaLabel: rankOfUrn.has(r.urn) ? `${rankOfUrn.get(r.urn)} of ${placed.length}` : "—",
    deltaTone: "neutral",
    emphasis: r.isTarget,
  }));

  const current: PanelRender = {
    tag: `Current — ${latest === null ? "no year" : academicYearLabel(latest)}`,
    question,
    actions: (
      <>
        <IconButton label="Bar chart" active={view === "graph"} onClick={() => setView("graph")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Map" active={view === "map"} onClick={() => setView("map")}>{MapPinIcon}</IconButton>
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
          // does, which is why it stays the default rather than this.
          <div className="print:hidden">
            <RankingsMap
              profiles={mapProfiles}
              targetUrn={schoolUrn}
              stage={phase}
              heightClass={fullscreen ? "h-[70vh] min-h-[22rem]" : "h-72"}
              subject={activeMapChip?.subject ?? null}
              subjectLabel={activeMapChip?.legend ?? null}
              subjectBucket={activeMapChip?.bucket ?? null}
              familyId={activeMapChip?.familyId ?? null}
              dense={!fullscreen}
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
                label: r.isTarget ? "This school" : r.name,
                value: r.value,
                isSubject: r.isTarget,
                color: r.isTarget ? "var(--fg)" : "var(--muted3)",
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
        <div className="min-h-0 flex-grow overflow-y-auto">
          <SortTable
            rows={rankingRows}
            sort={sort}
            onSort={(key) => setSort(nextSort(sort, key))}
            columns={{ name: "School", value: "Result", delta: "Rank" }}
            fullscreen={fullscreen}
          />
        </div>
      );
    },
    summary: seriesLoading ? undefined : shownRank ? (
      <PanelSummary>
        This school is {shownRank.rank} of {shownRank.total} on {comparedOn}, among {setLabel.toLowerCase()}.
      </PanelSummary>
    ) : (
      <PanelSummary>
        {subjectLabel
          ? `No published ${subjectLabel} figure for this school to rank against this set.`
          : "No nearby schools with comparable published data for this phase."}
      </PanelSummary>
    ),
    source: source(),
  };

  // ------------------------------------------------- the "vs:" selector (§4.3)
  const versusSchool = others.find((s) => s.urn === versus) ?? null;
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
      { key: "own", label: "Your school", colour: "var(--fg)", values: target ? valuesFor(target.urn) : [] },
      { key: "versus", label: versusLabel, colour: "var(--muted3)", values: versusValues, comparison: true },
    ],
  });
  const realPeriods = periodsWithData(full);
  const trendData = sliceFrom(full, trendStart);
  const changeData = sliceFrom(full, changeStart);
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
    tag: `${measure.label} — ${spanLabel(trendData.periods) || "no history"}`,
    question: "How has this school moved against its comparators, year on year?",
    controls: (
      <div className="flex flex-wrap justify-end gap-1.5">
        {versusPill(versusOpen, setVersusOpen, versusRef)}
        {startOptions(realPeriods).length > 1 && (
          <Pill
            label={`From: ${trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "—"} ▾`}
            onClick={() => setTrendStart(nextStart(realPeriods, trendStart ?? realPeriods[0] ?? null))}
          />
        )}
        <Pill label="Trend line" active={showFit} onClick={() => setShowFit(!showFit)} />
      </div>
    ),
    body: (fullscreen) =>
      seriesLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>
      ) : (
        <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} />
      ),
    summary: seriesLoading ? undefined : trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence.replace(/\.$/, "")}{versusClause || "."}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend for this school.</PanelSummary>
    ),
    source: source(spanLabel(trendData.periods)),
  };

  // ---------------------------------------------------------------- % change
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";
  const ownPct = percentChange(changeData.series[0]?.values ?? []);
  const versusPct = percentChange(changeData.series[1]?.values ?? []);

  const change: PanelRender = {
    tag: `% change in ${measure.label.toLowerCase()} — since ${changeSince || "—"}`,
    question: "How much has this school moved, against its comparators?",
    controls: (
      <div className="flex flex-wrap justify-end gap-1.5">
        {versusPill(changeVersusOpen, setChangeVersusOpen, changeVersusRef)}
        {startOptions(realPeriods).length > 1 && (
          <Pill
            label={`Since: ${changeSince || "—"} ▾`}
            onClick={() => setChangeStart(nextStart(realPeriods, changeStart ?? realPeriods[0] ?? null))}
          />
        )}
      </div>
    ),
    body: (fullscreen) =>
      seriesLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading {subjectLabel ?? "the comparison"}…</p>
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
          <PillMenu label="Compared against" value={setLabel} menuLabel="Compared against">
            {(close) =>
              setOptions.map((o) => (
                <MenuRow key={o.id} label={o.label} selected={o.id === setId} onClick={() => { changeSet(o.id); close(); }} />
              ))
            }
          </PillMenu>
          {setNote && <p className="text-[11px] text-[var(--muted3)]">{setNote}</p>}
        </div>
      }
      render={{ current, trend, change }}
    />
  );
}
