"use client";

// Teacher view: the focused GCSE subject against its LA, region and England -- the % Change
// panel's "us vs. the wider system" views, shared by Column 1 Candidates (entries) and
// Column 1 Results (average point score). Moved here from CandidatesPanels when Results
// took the same comparison, so the fetch, the three states (not applicable / loading / no
// data), the table and the chart exist once.
//
// Source: /api/teacher/subject-geography (academic_subject_geography_lookup, GCSE only),
// which returns each area's points-eligible entries and its average point score per year.
// The years shown are those the area figures exist for (2021/22 on -- DfE published no GCSE
// points for 2020/21) within the panel's From range, so every row and line covers the same
// span.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchSubjectGeography, type GeographyPayload, type GeographyRow } from "@/lib/teacher-view-geography";
import { FOCUS_COLOUR, paletteInOrder } from "@/lib/teacher-view-trend-styles";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import type { Measure } from "@/lib/teacher-view-panels";
import { CentredOnTarget } from "./CentredOnTarget";
import { MultiTrend, YearTable } from "./SeriesViews";

export type GeographyInput = {
  urn: string;
  subject: string;
  label: string;
  // Whether the comparison means anything for this subject and measure (the caller's rule).
  applies: boolean;
  // The school's own figure per period, aligned to the caller's `ownPeriods`.
  own: (number | null)[];
  // What to say when it does not apply -- the reason differs by column.
  notApplicableText: string;
};

type Loaded = { subject: string; data: GeographyPayload | null } | null;

// Fetched once per subject, only when the comparison applies.
export function useSubjectGeography(geography: GeographyInput | undefined): Loaded {
  const [geo, setGeo] = useState<Loaded>(null);
  const wanted = !!geography?.applies;
  const urn = geography?.urn;
  const subject = geography?.subject;
  useEffect(() => {
    if (!wanted || !urn || !subject || geo?.subject === subject) return;
    let cancelled = false;
    (async () => {
      const data = await fetchSubjectGeography(createBrowserSupabaseClient(), urn, subject);
      if (!cancelled) setGeo({ subject, data });
    })();
    return () => { cancelled = true; };
  }, [wanted, urn, subject, geo?.subject]);
  return geo;
}

export function GeographyView({
  geography,
  geo,
  metric,
  ownPeriods,
  spanPeriods,
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
  measure: Measure;
  theme: "dark" | "light";
  accentHex: string | null;
  view: "chart" | "table";
  fullscreen: boolean;
}) {
  const noun = metric === "entries" ? "entries" : "average point score";
  const heading = <p className="shrink-0 text-[12px] font-semibold text-[var(--muted2)]">{geography.label} against the wider system</p>;
  const note = (text: string) => (
    <>
      {heading}
      <p className="text-[12px] leading-relaxed text-[var(--muted2)]">{text}</p>
    </>
  );

  if (!geography.applies) return note(geography.notApplicableText);
  if (!geo || geo.subject !== geography.subject) return note("Loading LA, regional and national figures…");

  // Chart colours: the categorical palette (paletteInOrder, which skips hues near the phase
  // accent), the school in FOCUS_COLOUR. The table keeps one grey: its rows are labelled.
  const colours = paletteInOrder(
    ["own", "area-la", "area-region", "area-national"],
    "own",
    FOCUS_COLOUR,
    theme === "light" ? PALETTE_LIGHT : PALETTE_DARK,
    accentHex,
  );
  const tiers = [
    { key: "area-la", area: geo.data?.la, suffix: " (LA)" },
    { key: "area-region", area: geo.data?.region, suffix: " (region)" },
    { key: "area-national", area: geo.data?.national, suffix: "" },
  ].filter((t): t is { key: string; area: NonNullable<typeof t.area>; suffix: string } => !!t.area);
  const figure = (r: GeographyRow) => (metric === "entries" ? r.entries : r.avgPointScore);
  const withFigure = tiers.filter((t) => t.area.rows.some((r) => figure(r) !== null));
  if (withFigure.length === 0) return note(`No LA, regional or national ${noun} figures are published for ${geography.label}.`);

  const geoPeriods = new Set(withFigure.flatMap((t) => t.area.rows.filter((r) => figure(r) !== null).map((r) => r.period)));
  const shown = spanPeriods.filter((p) => geoPeriods.has(p));
  const at = (rows: GeographyRow[], p: number) => {
    const row = rows.find((r) => r.period === p);
    return row ? figure(row) : null;
  };
  const series = [
    { key: "own", label: "This school", colour: FOCUS_COLOUR, values: shown.map((p) => geography.own[ownPeriods.indexOf(p)] ?? null) },
    ...withFigure.map((t) => ({ key: t.key, label: `${t.area.name}${t.suffix}`, colour: colours.get(t.key)!, values: shown.map((p) => at(t.area.rows, p)) })),
  ];

  if (view === "table") {
    return (
      <>
        {heading}
        <CentredOnTarget watch={`geo:${geography.subject}:${metric}:${shown.join(",")}`}>
          <YearTable
            data={{ periods: shown, series: series.map((x) => (x.key === "own" ? x : { ...x, colour: "var(--muted3)" })) }}
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
  return (
    <>
      {heading}
      <MultiTrend data={{ periods: shown, series: series.filter((x) => x.key !== "area-region") }} measure={measure} focusKey="own" fullscreen={fullscreen} />
    </>
  );
}
