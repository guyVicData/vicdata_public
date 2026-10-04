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
//
// `buildSeries` returns null where the view isn't this builder's to draw (yet): a view type
// a later part adds, a view that needs another fetch (the geography comparison), or a state
// the host draws its own note for (loading, nothing to show, a band with no range). The
// renderer then leaves the panel to its host.
import type { ViewSpec } from "@/catalogue/viewspec";
import { buildCandidates } from "./candidates";
import { buildComparisons } from "./comparisons";
import { needsGeography } from "./compare";
import type { ViewFrame } from "./frames";
import type { BuildContext, ViewSeries } from "./series";
import { buildSubjects } from "./subjects";

export type { ViewFrame } from "./frames";
export type { BuildContext, LeafSeries, ViewSeries } from "./series";

export function buildSeries(spec: ViewSpec, frame: ViewFrame, ctx: BuildContext): ViewSeries | null {
  if (needsGeography(spec)) return null;
  switch (frame.kind) {
    case "subjects":
      return buildSubjects(spec, frame, ctx);
    case "candidates":
      return buildCandidates(spec, frame);
    case "comparisons":
      return buildComparisons(spec, frame);
  }
}
