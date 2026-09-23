"use client";

// Teacher view, round 6: the Comparisons card's three panels (Rankings.dc.html; brief
// §4.3). Named "Comparisons" in every heading and label; the module, the `rankings`
// ColumnId, the rank_* view ids and the note key stay as they are -- §6.2 settled the
// rename as UI copy only, so nothing persisted changes and there is no migration.
//
// Current keeps the real, shipped card: the "N of M" position, the subject chips and
// RankingsMap. §4.3 is explicit that the map is reused as-is rather than rebuilt.
//
// Trend and % change plot this school's own real headline measure per year -- the series
// the dashboard route already fetched and used to throw away (§6.4). The comparator
// set's own line, and the "vs:" selector that picks it, arrive with the rest of §4.3.
import { useState, type ReactNode } from "react";
import type { AcademicSchoolProfile, KsStage } from "@/lib/academic-data-view";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import {
  DIRECTION_ARROW,
  DIRECTION_WORD,
  nextStart,
  percentChange,
  periodsWithData,
  sliceFrom,
  startOptions,
  trendSentence,
  type Measure,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { ColumnPanels, PanelSummary, type PanelRender } from "./ColumnPanels";
import { ChangeChart } from "./ChangeChart";
import { Pill } from "./PanelIcons";
import { RankingsMap } from "./RankingsMap";
import { TrendChart } from "./TrendChart";

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

export function ComparisonsPanels({
  phase,
  panels,
  onPanelsChange,
  question,
  source,
  headlineLabel,
  ownSeries,
  measure,
  // Current's real, already-shipped content.
  schoolUrn,
  hasNeighbours,
  mapProfiles,
  mapChips,
  activeMapChip,
  onMapChip,
  mapRank,
  onMapRank,
  position,
}: {
  phase: KsStage;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  question: string;
  source: (span?: string) => ReactNode;
  headlineLabel: string;
  // This school's own headline measure per published year, ascending.
  ownSeries: { period: number; value: number }[];
  measure: Measure;
  schoolUrn: string | null;
  hasNeighbours: boolean;
  mapProfiles: AcademicSchoolProfile[] | null;
  mapChips: MapChip[];
  activeMapChip: MapChip | null;
  onMapChip: (key: string) => void;
  mapRank: { rank: number; total: number } | null;
  onMapRank: (info: { rank: number; total: number } | null) => void;
  position: { position: number; outOf: number } | null;
}) {
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);

  const periods = ownSeries.map((r) => r.period);
  const ownValues = ownSeries.map((r) => r.value as number | null);
  const full: PanelData = {
    periods,
    series: [{ key: "own", label: "Your school", colour: "var(--fg)", values: ownValues }],
  };
  const realPeriods = periodsWithData(full);
  const trendData = sliceFrom(full, trendStart);
  const changeData = sliceFrom(full, changeStart);
  const spanLabel = (ps: number[]) => (ps.length ? `${academicYearLabel(ps[0])}–${academicYearLabel(ps[ps.length - 1])}` : "");

  // ------------------------------------------------------------------ Current
  const current: PanelRender = {
    tag: `Current — ${periods.length ? academicYearLabel(periods[periods.length - 1]) : "no year"}`,
    question,
    body: (fullscreen) => (
      <>
        {activeMapChip && schoolUrn && hasNeighbours ? (
          // A subject chip is active, so the map is plotting that subject and the figure
          // follows it -- the map's own rank, not the whole-school one below.
          mapRank ? (
            <>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {mapRank.rank}
                <span className="ml-1 text-base font-normal text-[var(--muted)]">of {mapRank.total}</span>
              </p>
              <p className="text-sm text-[var(--muted)]">
                among the nearest schools with data, on {activeMapChip.legend} avg. point score
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted2)]">
              {mapProfiles === null ? "Loading the map…" : `No ${activeMapChip.legend} points score for this school to rank.`}
            </p>
          )
        ) : position ? (
          <>
            {/* §14: the position IS the anchor -- the figure never stands alone. */}
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {position.position}
              <span className="ml-1 text-base font-normal text-[var(--muted)]">of {position.outOf}</span>
            </p>
            <p className="text-sm text-[var(--muted)]">among the nearest schools with data, on {headlineLabel}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted2)]">No nearby schools with comparable published data for this phase.</p>
        )}

        {/* The map is a live Leaflet map and does not print. */}
        {schoolUrn && hasNeighbours && (
          <div className="print:hidden">
            {mapChips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-[5px]" role="group" aria-label="Subject shown on the map">
                {mapChips.map((c) => {
                  const on = c.key === activeMapChip?.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onMapChip(c.key)}
                      className="rounded-full px-[9px] py-1 text-[10.5px] font-bold"
                      style={
                        on
                          ? { background: c.hex, color: "#0a0a0b", border: `1.5px solid ${c.hex}` }
                          : { background: "transparent", color: c.hex, border: `1.5px solid ${c.hex}80` }
                      }
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
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
        )}
      </>
    ),
    source: source(),
  };

  // -------------------------------------------------------------------- Trend
  const trendSaid = trendSentence({
    subjectClause: `Your school's ${headlineLabel}`,
    values: trendData.series[0]?.values ?? [],
    measure,
    startLabel: trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "",
  });

  const trend: PanelRender = {
    tag: `${measure.label} — ${spanLabel(trendData.periods) || "no history"}`,
    question: "How has this school moved, year on year?",
    controls: (
      <div className="flex flex-wrap justify-end gap-1.5">
        {startOptions(realPeriods).length > 1 && (
          <Pill
            label={`From: ${trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "—"} ▾`}
            onClick={() => setTrendStart(nextStart(realPeriods, trendStart ?? realPeriods[0] ?? null))}
          />
        )}
        <Pill label="Trend line" active={showFit} onClick={() => setShowFit(!showFit)} />
      </div>
    ),
    body: (fullscreen) => <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} />,
    summary: trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend for this school.</PanelSummary>
    ),
    source: source(spanLabel(trendData.periods)),
  };

  // ---------------------------------------------------------------- % change
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";
  const changePct = percentChange(changeData.series[0]?.values ?? []);

  const change: PanelRender = {
    tag: `% change in ${measure.label.toLowerCase()} — since ${changeSince || "—"}`,
    question: "How much has this school moved over the period?",
    controls:
      startOptions(realPeriods).length > 1 ? (
        <div className="flex justify-end">
          <Pill
            label={`Since: ${changeSince || "—"} ▾`}
            onClick={() => setChangeStart(nextStart(realPeriods, changeStart ?? realPeriods[0] ?? null))}
          />
        </div>
      ) : undefined,
    body: (fullscreen) => (
      <ChangeChart
        bars={[{ key: "own", label: "Your school", shortLabel: "You", colour: "var(--fg)", percent: changePct }]}
        fullscreen={fullscreen}
      />
    ),
    summary:
      changePct === null ? (
        <PanelSummary>Not enough published years yet to measure a change.</PanelSummary>
      ) : (
        <PanelSummary>
          This school&rsquo;s {headlineLabel} has {changePct >= 0 ? "risen" : "fallen"} {Math.abs(Math.round(changePct))}% since{" "}
          {changeSince}.
        </PanelSummary>
      ),
    source: source(spanLabel(changeData.periods)),
  };

  return (
    <ColumnPanels
      columnId="rankings"
      panels={panels}
      onPanelsChange={onPanelsChange}
      changeLabel={measure.changeLabel}
      render={{ current, trend, change }}
    />
  );
}
