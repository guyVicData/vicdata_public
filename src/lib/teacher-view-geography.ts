// Teacher view, Candidates live review Part 5: the focused subject's entries in the
// school's LA, region and England (/api/teacher/subject-geography). Client-safe. GCSE per
// subject; Post-16 (Part C) per subject and exact qualification.
//
// Every figure here is POINTS-ELIGIBLE entries (GCSE full course) -- the source table's
// own convention -- which is why the school's own row beside them is its points-eligible
// entries too, not its all-qualifications Candidates count: all four rows then count the
// same thing.
import type { createBrowserSupabaseClient } from "@/lib/supabase";
import type { AcademicSubjectHeadlineEntry } from "@/lib/academic-data-view";
import { POINTS_BEARING_QUALIFICATION } from "@/lib/dfe-qualification-buckets";
import type { MeasureId } from "@/lib/teacher-view-panels";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { cachedFetchJson } from "@/lib/fetch-cache";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// avgPointScore: the area's own average point score for the subject -- what Results
// compares against. entries: its points-eligible entries -- what Candidates compares.
export type GeographyRow = { period: number; entries: number | null; avgPointScore: number | null; schoolCount: number };
export type GeographyPayload = {
  la: { name: string; rows: GeographyRow[] } | null;
  region: { name: string; rows: GeographyRow[] } | null;
  national: { name: string; rows: GeographyRow[] } | null;
};

// Post-16 Part C: pass the item's exact qualification type at KS5, where the area figures
// are per (subject, qualification) rather than per subject.
export async function fetchSubjectGeography(
  supabase: Supa,
  urn: string,
  subject: string,
  qualificationType?: string,
): Promise<GeographyPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const params = new URLSearchParams({ urn, subject });
  if (qualificationType) {
    params.set("phase", "ks5");
    params.set("qualificationType", qualificationType);
  }
  // Shared across panels and embedded views for 5 minutes (fetch-cache.ts, decision 10).
  const res = await cachedFetchJson<GeographyPayload>(`/api/teacher/subject-geography?${params.toString()}`, { token });
  return res.ok ? res.body : null;
}

// ------------------------------------------------ which comparisons apply (0.6 S2)
// Lifted verbatim from the Teacher view page, so a geography view moved out of Column 1
// cannot set a school's figure against an area figure that counts something else.

/**
 * R-GEO-APPLIES, R-KS4-POINTS-GCSE-FULL: Candidates' area comparison applies only where the
 * area figure counts the same thing -- at GCSE only for the points-bearing GCSE (the area
 * figures are GCSE points-eligible entries); at Post-16 the item's exact qualification.
 */
export function candidatesGeographyApplies(phase: TeacherPhase, item: { qualificationType: string }): boolean {
  return phase === "ks5" || item.qualificationType === POINTS_BEARING_QUALIFICATION.ks4;
}

/**
 * R-GEO-APPLIES, R-NO-GRADE-RATE-GEO, R-KS4-POINTS-GCSE-FULL: Results' area comparison is on
 * average point score only (no area Grade 4+ / A*-E rate or band is published), and at
 * GCSE only for the points-bearing GCSE.
 */
export function resultsGeographyApplies(phase: TeacherPhase, measureId: MeasureId, item: { qualificationType: string }): boolean {
  return measureId === "points" && (phase === "ks5" || item.qualificationType === POINTS_BEARING_QUALIFICATION.ks4);
}

/**
 * R-GEO-POINTS-ELIGIBLE: the school's own row beside the area entries is its POINTS-ELIGIBLE
 * entries (entries x points coverage, rounded), not its all-qualifications Candidates
 * count, so all four rows count the same thing. `rowsAt` is the item's own rows for a period.
 */
export function pointsEligibleEntriesByPeriod(periods: number[], rowsAt: (period: number) => AcademicSubjectHeadlineEntry[]): (number | null)[] {
  return periods.map((p) => {
    const rows = rowsAt(p).filter((h) => h.pointsCoveragePercent !== null);
    return rows.length ? Math.round(rows.reduce((a, h) => a + (h.entriesTotal ?? 0) * (h.pointsCoveragePercent! / 100), 0)) : null;
  });
}

// ------------------------------------------ the comparison itself (0.6.1 S3c)
// What GeographyView draws, worked out once: the three states it says in words (not
// applicable / loading / nothing published) or the rows -- the school, then its LA, region
// and England -- over the years the area figures exist within the panel's span. GeographyView
// (src/components/teacher/GeographyComparison.tsx) and the series builder's geography views
// (src/lib/view-series/geography.ts) both draw from this, so the two can't disagree.

export type GeographyMetric = "entries" | "avgPointScore";

export type GeographyLine = { key: "own" | "area-la" | "area-region" | "area-national"; label: string; colour: string; values: (number | null)[] };

export type GeographyComparison =
  | { state: "note"; text: string }
  | { state: "ok"; periods: number[]; lines: GeographyLine[] };

export const geographyFigure = (metric: GeographyMetric, r: GeographyRow): number | null => (metric === "entries" ? r.entries : r.avgPointScore);

// The two views' own headings (0.6.1 S1, pinch point 3): the chart draws the LA and England
// lines, the table every area's row with the change.
export function geographyHeading(label: string, view: "chart" | "table"): string {
  return view === "chart" ? `${label} against its LA and England, year by year` : `${label}: change against its LA, region and England`;
}

// The area tiers a payload carries, LA first, with their keys and name suffixes.
export type GeographyTier = { key: "area-la" | "area-region" | "area-national"; kind: "la" | "region" | "england"; area: { name: string; rows: GeographyRow[] }; suffix: string };
export function geographyTiers(payload: GeographyPayload | null): GeographyTier[] {
  const tiers: GeographyTier[] = [];
  if (payload?.la) tiers.push({ key: "area-la", kind: "la", area: payload.la, suffix: " (LA)" });
  if (payload?.region) tiers.push({ key: "area-region", kind: "region", area: payload.region, suffix: " (region)" });
  if (payload?.national) tiers.push({ key: "area-national", kind: "england", area: payload.national, suffix: "" });
  return tiers;
}

// An area's figure for each period (null where it has none).
export function geographyValues(rows: GeographyRow[], metric: GeographyMetric, periods: number[]): (number | null)[] {
  return periods.map((p) => {
    const row = rows.find((r) => r.period === p);
    return row ? geographyFigure(metric, row) : null;
  });
}

// `payload`: undefined = still loading (or loaded for another subject); null = the fetch
// came back with nothing. `colourOf` gives each line its chart colour (the caller's palette).
export function geographyComparison(input: {
  label: string;
  applies: boolean;
  notApplicableText: string;
  payload: GeographyPayload | null | undefined;
  metric: GeographyMetric;
  own: (number | null)[];
  ownPeriods: number[];
  spanPeriods: number[];
  colourOf: (key: GeographyLine["key"]) => string;
}): GeographyComparison {
  const { metric } = input;
  const noun = metric === "entries" ? "entries" : "average points";
  if (!input.applies) return { state: "note", text: input.notApplicableText };
  if (input.payload === undefined) return { state: "note", text: "Loading LA, regional and national figures…" };
  const withFigure = geographyTiers(input.payload).filter((t) => t.area.rows.some((r) => geographyFigure(metric, r) !== null));
  if (withFigure.length === 0) return { state: "note", text: `No LA, regional or national ${noun} figures are published for ${input.label}.` };
  const geoPeriods = new Set(withFigure.flatMap((t) => t.area.rows.filter((r) => geographyFigure(metric, r) !== null).map((r) => r.period)));
  const shown = input.spanPeriods.filter((p) => geoPeriods.has(p));
  return {
    state: "ok",
    periods: shown,
    lines: [
      { key: "own", label: "This school", colour: input.colourOf("own"), values: shown.map((p) => input.own[input.ownPeriods.indexOf(p)] ?? null) },
      ...withFigure.map((t) => ({ key: t.key, label: `${t.area.name}${t.suffix}`, colour: input.colourOf(t.key), values: geographyValues(t.area.rows, metric, shown) })),
    ],
  };
}
