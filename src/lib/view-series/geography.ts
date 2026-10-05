// VicData 0.6.1 S3c: the series builder for the geography views -- the focused subject against
// its LA, region and England (the Area chart and the Change table in Column 1's % change half,
// Candidates on points-eligible entries, Results on average points).
//
// Their figures are the host's own fetch (useSubjectGeography, /api/teacher/subject-geography),
// handed over in the frame -- never fetched again here -- and worked out by the same pure
// function GeographyView draws from (geographyComparison, teacher-view-geography.ts): the
// states it says in words, the rows, the years the area figures exist within the half's span.
// The host's gating stays as rules, decided where the page builds its GeographyInput:
// R-KS4-POINTS-GCSE-FULL / R-GEO-POINTS-ELIGIBLE (GCSE: the points-bearing GCSE only),
// R-NO-GRADE-RATE-GEO (Results: average points only), R-KS5-ENGLAND-EXACT (Post-16: the exact
// qualification); R-MIN-SCHOOLS is the route's (LA and region need 5 schools).
import type { ViewSpec } from "@/catalogue/viewspec";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import { ENTRIES_MEASURE } from "@/lib/teacher-view-panels";
import { geographyComparison, geographyHeading } from "@/lib/teacher-view-geography";
import { FOCUS_COLOUR, paletteInOrder } from "@/lib/teacher-view-trend-styles";
import { basics as candidateBasics, changeData as candidateChange } from "./candidates";
import type { SeriesFrame } from "./frames";
import type { ViewSeries } from "./series";
import { changeData as subjectChange } from "./subjects";

export function buildGeography(spec: ViewSpec, f: SeriesFrame): ViewSeries | null {
  if (f.kind === "comparisons") return null;
  const g = f.geography;
  if (!g || f.subjects.length === 0) return null;
  const view = spec.view.kind === "table" ? "table" : "chart";
  // The % change half's span, as the host trims it (every subject and the group lines).
  const span = f.kind === "subjects" ? subjectChange(f, true).data.periods : candidateChange(f, candidateBasics(f), true).data.periods;
  const measure = f.kind === "subjects" ? f.measure : f.measure ?? ENTRIES_MEASURE;
  const colours = paletteInOrder(["own", "area-la", "area-region", "area-national"], "own", FOCUS_COLOUR, f.theme === "light" ? PALETTE_LIGHT : PALETTE_DARK, f.accentHex);
  const got = geographyComparison({
    label: g.label,
    applies: g.applies,
    notApplicableText: g.notApplicableText,
    payload: g.payload,
    metric: g.metric,
    own: g.own,
    ownPeriods: f.periods,
    spanPeriods: span,
    colourOf: (key) => colours.get(key)!,
  });
  const heading = geographyHeading(g.label, view);
  const kind = spec.view.kind === "table" ? "table" : "line";
  if (got.state === "note") {
    return { kind, heading: null, title: null, leaf: { leaf: "geography", heading, note: got.text, view, data: { periods: [], series: [] }, measure, centred: "" } };
  }
  // The table keeps one grey for the areas (its rows are labelled); the chart has no region
  // line (its path runs almost on top of England's).
  const data =
    view === "table"
      ? { periods: got.periods, series: got.lines.map((x) => (x.key === "own" ? x : { ...x, colour: "var(--muted3)" })) }
      : { periods: got.periods, series: got.lines.filter((x) => x.key !== "area-region") };
  return {
    kind,
    heading: null,
    title: null,
    leaf: { leaf: "geography", heading, view, data, measure, centred: `geo:${g.id}:${g.metric}:${got.periods.join(",")}` },
  };
}
