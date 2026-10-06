"use client";

// Teacher view: the focused GCSE subject against its LA, region and England -- the % Change
// panel's "us vs. the wider system" views, shared by Column 1 Candidates (entries) and
// Column 1 Results (average point score). Moved here from CandidatesPanels when Results
// took the same comparison, so the fetch, the three states (not applicable / loading / no
// data), the table and the chart exist once.
//
// Source: /api/teacher/subject-geography (academic_subject_geography_lookup at GCSE;
// academic_subject_qualification_geography_lookup at Post-16, per exact qualification),
// which returns each area's points-eligible entries and its average point score per year.
// The years shown are those the area figures exist for (2021/22 on -- DfE published no GCSE
// points for 2020/21) within the panel's From range, so every row and line covers the same
// span.
import { useContext, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchSubjectGeography, geographyComparison, geographyHeading, type GeographyMetric, type GeographyPayload } from "@/lib/teacher-view-geography";
import type { FrameGeography } from "@/lib/view-series/frames";
import { FOCUS_COLOUR, paletteInOrder } from "@/lib/teacher-view-trend-styles";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import type { Measure } from "@/lib/teacher-view-panels";
import { CentredOnTarget } from "./CentredOnTarget";
import { MultiTrend, TrendScaleTitle, ViewTitleOverrideContext, YearTable, multiTrendHasLine } from "./SeriesViews";
import { shouldIndex } from "@/lib/teacher-view-trend-styles";

export type GeographyInput = {
  urn: string;
  subject: string;
  // Post-16 only: the exact qualification the area figures are for. Omitted at GCSE.
  qualificationType?: string;
  label: string;
  // Whether the comparison means anything for this subject and measure (the caller's rule).
  applies: boolean;
  // The school's own figure per period, aligned to the caller's `ownPeriods`.
  own: (number | null)[];
  // What to say when it does not apply -- the reason differs by column.
  notApplicableText: string;
};

// `id` is what was fetched: the subject, plus the qualification at Post-16, where A-level
// and AS Psychology are two different comparisons.
type Loaded = { id: string; data: GeographyPayload | null } | null;
export const geographyId = (g: GeographyInput) => `${g.subject}::${g.qualificationType ?? ""}`;

// 0.6.1 S3c: what was fetched for THIS subject (and qualification): the payload, null when
// the fetch came back with nothing, undefined while it is loading (or still the last
// subject's). The hosts hand it to the series builder's frame.
export function loadedPayload(geography: GeographyInput | undefined, geo: Loaded): GeographyPayload | null | undefined {
  return geography && geo && geo.id === geographyId(geography) ? geo.data : undefined;
}

// 0.6.1 S3c: the geography as a view frame carries it (src/lib/view-series/frames.ts).
export function frameGeography(geography: GeographyInput | undefined, geo: Loaded, metric: GeographyMetric): FrameGeography | null {
  if (!geography) return null;
  return {
    label: geography.label,
    applies: geography.applies,
    notApplicableText: geography.notApplicableText,
    metric,
    own: geography.own,
    payload: loadedPayload(geography, geo),
    id: geographyId(geography),
  };
}

// Fetched once per subject (and qualification), only when the comparison applies.
export function useSubjectGeography(geography: GeographyInput | undefined): Loaded {
  const [geo, setGeo] = useState<Loaded>(null);
  const wanted = !!geography?.applies;
  const urn = geography?.urn;
  const subject = geography?.subject;
  const qualificationType = geography?.qualificationType;
  const id = geography ? geographyId(geography) : null;
  useEffect(() => {
    if (!wanted || !urn || !subject || !id || geo?.id === id) return;
    let cancelled = false;
    (async () => {
      const data = await fetchSubjectGeography(createBrowserSupabaseClient(), urn, subject, qualificationType);
      if (!cancelled) setGeo({ id, data });
    })();
    return () => { cancelled = true; };
  }, [wanted, urn, subject, qualificationType, id, geo?.id]);
  return geo;
}

export function GeographyView({
  geography,
  geo,
  metric,
  ownPeriods,
  spanPeriods,
  statementFrom,
  measure,
  theme,
  accentHex,
  view,
  fullscreen,
}: {
  geography: GeographyInput;
  geo: Loaded;
  // Which area figure: points-eligible entries (Candidates) or average point score (Results).
  metric: "entries" | "avgPointScore";
  // The periods `geography.own` is aligned to.
  ownPeriods: number[];
  // The panel's current span (its From range).
  spanPeriods: number[];
  // R-TREND-FROM-2223: the year the change table's Change counts from (2022/23 on points),
  // while the chart and fullscreen table still draw every year of the span.
  statementFrom?: number | null;
  measure: Measure;
  theme: "dark" | "light";
  accentHex: string | null;
  view: "chart" | "table";
  fullscreen: boolean;
}) {
  // 0.6 snag 4 / 01: a view's title override replaces the plain heading's words.
  const override = useContext(ViewTitleOverrideContext);
  // 0.6.1 S1 (pinch point 3): each view its own words, so the two can be told apart -- the
  // chart draws the LA and England lines (no region: it runs on top of England's), the
  // table every area's figures with the change. Catalogue titleTemplates say the same.
  const heading = <p className="shrink-0 text-[12px] font-semibold text-[var(--muted2)]">{override ?? geographyHeading(geography.label, view)}</p>;
  const note = (text: string) => (
    <>
      {heading}
      <p className="text-[12px] leading-relaxed text-[var(--muted2)]">{text}</p>
    </>
  );

  // Chart colours: the categorical palette (paletteInOrder, which skips hues near the phase
  // accent), the school in FOCUS_COLOUR. The table keeps one grey: its rows are labelled.
  // The states, rows and years: geographyComparison (the series builder draws from it too).
  const colours = paletteInOrder(
    ["own", "area-la", "area-region", "area-national"],
    "own",
    FOCUS_COLOUR,
    theme === "light" ? PALETTE_LIGHT : PALETTE_DARK,
    accentHex,
  );
  const got = geographyComparison({
    label: geography.label,
    applies: geography.applies,
    notApplicableText: geography.notApplicableText,
    payload: loadedPayload(geography, geo),
    metric,
    own: geography.own,
    ownPeriods,
    spanPeriods,
    colourOf: (key) => colours.get(key)!,
  });
  if (got.state === "note") return note(got.text);
  const shown = got.periods;
  const series = got.lines;

  if (view === "table") {
    return (
      <>
        {heading}
        <CentredOnTarget watch={`geo:${geographyId(geography)}:${metric}:${shown.join(",")}`}>
          <YearTable
            data={{ periods: shown, series: series.map((x) => (x.key === "own" ? x : { ...x, colour: "var(--muted3)" })), statementFrom }}
            measure={measure}
            focusKey="own"
            fullscreen={fullscreen}
            nameHeading="Where"
            showRank={false}
            changeEmphasis="percent"
          />
        </CentredOnTarget>
      </>
    );
  }
  // The chart has no region line: its path runs almost on top of England's. The table
  // keeps all four rows. MultiTrend indexes entries to each line's own first year = 100;
  // average point scores share one scale and are drawn at their real levels.
  const chartData = { periods: shown, series: series.filter((x) => x.key !== "area-region") };
  // Entries are drawn indexed to their own first year (MultiTrend's rule for a headcount),
  // so the chart carries the same title Trend's indexed chart does -- one explanation for
  // every indexed-to-100 chart. Average point score is drawn at its real level: no title.
  return (
    <>
      {heading}
      {shouldIndex(measure.aggregate) && multiTrendHasLine(chartData) && <TrendScaleTitle view="indexed" from={shown[0] ?? null} noun="entries" />}
      <MultiTrend data={chartData} measure={measure} focusKey="own" fullscreen={fullscreen} />
    </>
  );
}
