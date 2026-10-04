// VicData 0.6.1 S3: the series builder -- ViewSpec + the panel's frame -> one leaf's props
// (D1: "ViewSpec -> series builder -> leaf component", beside the hosts).
//
//   frames.ts       what a host hands over: the page's data as already derived, and the
//                   members' own settings on it
//   compare.ts      `compare` resolved for a frame, "follows-page" (D1a) included
//   looks.ts        2 · View's look arithmetic (order, top ten, an average of what is drawn)
//   subjects.ts     Column 1 Results and Context
//   candidates.ts   Column 1 Candidates
//   comparisons.ts  Comparisons
//   ranking.ts      ranking (S3b): Context's Ranked list, Comparisons' Ranking (D5)
//   tiles.ts        numbers (S3b): the number tiles, with the instance's Figures
//   slope.ts        slope (S3b): two years, joined
//   donut.ts        donut (S3c): Context's Share
//   map.ts          map (S3c): Comparisons' Current / Trend / Change maps, Results' Trend map
//   geography.ts    the geography views (S3c): the focused subject against its LA, region and
//                   England, from the host's own fetch (in the frame)
//   compare-lines.ts  a spec of its own's compare series (S3c): averages of things not drawn,
//                   LA / region / England, where the catalogue allows (D7)
//
// `buildSeries` returns null where the view isn't this builder's to draw (yet): a view type
// a later part adds (Grade counts, the grade spread), or a state the host draws its own note
// for (loading, nothing to show, a band with no range). The renderer then leaves the panel
// to its host.
import type { ViewSpec } from "@/catalogue/viewspec";
import { buildCandidates } from "./candidates";
import { buildComparisons } from "./comparisons";
import { needsGeography } from "./compare";
import { buildDonut } from "./donut";
import { buildGeography } from "./geography";
import { buildMap } from "./map";
import type { ViewFrame } from "./frames";
import type { BuildContext, ViewSeries } from "./series";
import { buildRanking } from "./ranking";
import { buildSlope } from "./slope";
import { buildSubjects } from "./subjects";
import { buildNumbers } from "./tiles";

export type { ViewFrame } from "./frames";
export type { BuildContext, LeafSeries, ViewSeries } from "./series";
export { ordinal } from "./tiles";
export { compareColour } from "./colours";

export function buildSeries(spec: ViewSpec, frame: ViewFrame, ctx: BuildContext): ViewSeries | null {
  // The geography views, as their presets draw them (a spec of its own with LA / region /
  // England lines is an ordinary line or table, below).
  if (needsGeography(spec) && spec.compare === "follows-page") return buildGeography(spec, frame);
  switch (spec.view.kind) {
    case "donut":
      return buildDonut(spec, frame);
    case "map":
      return buildMap(spec, frame);
    case "ranking":
      return buildRanking(spec, frame);
    case "numbers":
      return buildNumbers(frame, ctx);
    case "slope":
      return buildSlope(spec, frame);
  }
  switch (frame.kind) {
    case "subjects":
      return buildSubjects(spec, frame, ctx);
    case "candidates":
      return buildCandidates(spec, frame);
    case "comparisons":
      return buildComparisons(spec, frame);
  }
}
