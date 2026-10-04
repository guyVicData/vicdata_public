// VicData 0.6.1 S3c: the series builder for a map -- RankingsMap (the advanced dashboard's own
// AcademicMapView) on the page's already-loaded map profiles. Three places draw one today:
//
//   Comparisons' Current Map    the set's schools, coloured by the figure (the phase accent
//                               scale; KS2's grade bands) -- look.colour "value"
//   Comparisons' Trend map /    each school's change over the panel's span: the Trend map the
//   Change map                  plain difference (data.change "absolute", trend_absolute); the
//                               Change map the honest change (R-NUMBER-TYPE-HONESTY) -- a %
//                               on a count (the fixed ±% scale), points / percentage points
//                               otherwise (the set's own range) -- look.colour "change"
//   Results' Trend map          the focused subject at each comparator school, the map's own
//                               Grade band / Trends toggle -- look.colour "member"
//
// A map needs a set of schools (R-RANKING-SAMPLE: never a ranking's sample) and two years for
// a change. The change figures are the same ones the panels' ranked bars and tables read
// (changeOver / changeOf / percentChange over the same span), keyed by URN (changeByUrn).
// Where the host draws a note (loading, no location, too short a span) it is left to it.
import type { ViewSpec } from "@/catalogue/viewspec";
import { changeInTitle, changeOf, changePhrase, formatChange, percentChange, sliceFrom } from "@/lib/teacher-view-panels";
import { changeByUrn, signedPercent } from "@/lib/teacher-view-comparisons";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { changeOver } from "@/lib/teacher-view-trend-styles";
import { onChangeHalf } from "./compare";
import { pageVersus, series } from "./comparisons";
import type { ComparisonsFrame, FrameMap, SubjectsFrame, SeriesFrame } from "./frames";
import type { ViewSeries } from "./series";

export function buildMap(spec: ViewSpec, f: SeriesFrame): ViewSeries | null {
  if (spec.view.kind !== "map") return null;
  if (f.kind === "subjects") return trendMap(f);
  if (f.kind === "comparisons") {
    const change = spec.view.look.colour === "change" || spec.data.shownAs === "change";
    return change ? changeMap(spec, f) : currentMap(f, spec.view.look.colour);
  }
  return null;
}

// Results' Trend map: the focused subject at each of the page's comparator schools.
function trendMap(f: SubjectsFrame): ViewSeries | null {
  const m = f.trendMap;
  if (!m || !m.targetUrn) return null;
  return {
    kind: "map",
    heading: null,
    title: [m.subjectLabel, " at each comparator school, on the map"],
    leaf: { leaf: "map", place: "trend", map: m, targetUrn: m.targetUrn, untitledSizeLegend: true },
  };
}

const mapOf = (f: ComparisonsFrame): (FrameMap & { targetUrn: string }) | null =>
  f.map && f.map.allowed && f.map.targetUrn ? { ...f.map, targetUrn: f.map.targetUrn } : null;

// Comparisons' Current: the set's schools by value. The map draws its own loading state.
function currentMap(f: ComparisonsFrame, colour: "value" | "change" | "member"): ViewSeries | null {
  const m = mapOf(f);
  if (!m || f.schools.length === 0) return null;
  return {
    kind: "map",
    heading: null,
    title: `${f.titleOn} by school, on the map`,
    leaf: {
      leaf: "map",
      place: "current",
      map: m,
      targetUrn: m.targetUrn,
      ...(colour === "member" ? {} : { forcedColourMode: m.stage === "ks2" ? ("grade_band" as const) : ("accent" as const) }),
    },
  };
}

// Comparisons' Trend map (the plain difference) and Change map (the honest change): each
// school's change over the half's span, this set's schools only.
function changeMap(spec: ViewSpec, f: ComparisonsFrame): ViewSeries | null {
  const m = mapOf(f);
  if (!m || f.blocked) return null;
  // The span is the page's "vs:" pair's (as the host trims it), from the half's own From year.
  const { everySchool, full, b } = series(f, pageVersus(f));
  const changeHalf = onChangeHalf(spec);
  const start = changeHalf ? f.state.changeStart : f.state.trendStart;
  const table = sliceFrom(everySchool, start);
  if (table.periods.length < 2) return null;
  const target = b.target?.urn;
  // This set's schools only: the page's profiles cover every set's schools, and one outside
  // this set has no change here to colour it by.
  const map: FrameMap = { ...m, profiles: m.profiles ? m.profiles.filter((p) => p.urn === m.targetUrn || f.schools.some((sc) => sc.urn === p.urn)) : null };
  if (spec.data.change === "absolute") {
    const from = table.periods.length ? academicYearLabel(table.periods[0]) : "the first year";
    return {
      kind: "map",
      heading: null,
      title: ["Change in ", f.comparedOn, " since ", from, ", coloured by school"],
      leaf: {
        leaf: "map",
        place: "change",
        map,
        targetUrn: m.targetUrn,
        forcedColourMode: "trend_absolute",
        changeValues: { byUrn: changeByUrn(table.series, target, (v) => changeOver(v)?.delta ?? null), format: f.measure.formatDelta, label: `change since ${from}` },
      },
    };
  }
  const span = sliceFrom(full, start);
  const since = span.periods.length ? academicYearLabel(span.periods[0]) : "";
  const percent = f.measure.changeKind === "percent";
  return {
    kind: "map",
    heading: null,
    title: [changeInTitle(f.measure, f.comparedOn, since), ", coloured by school"],
    leaf: {
      leaf: "map",
      place: "change",
      map,
      targetUrn: m.targetUrn,
      forcedColourMode: percent ? "trend" : "trend_absolute",
      changeValues: percent
        ? { byUrn: changeByUrn(table.series, target, percentChange), format: signedPercent, label: `% change since ${since}` }
        : { byUrn: changeByUrn(table.series, target, (v) => changeOf(f.measure, v)), format: (v: number) => formatChange(f.measure, v), label: `${changePhrase(f.measure)} since ${since}` },
    },
  };
}
