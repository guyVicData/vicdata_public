// VicData 0.6.1 S3: the config-driven view renderer (D1). ViewSpec -> series builder
// (src/lib/view-series) -> leaf component. This part registers line, table and bar; every
// other kind is still drawn by its host until its own part registers it. S3b registers
// ranking (D5: today's RankedList / SchoolRankingTable), numbers (NumberTiles with the
// instance's Figures) and slope (new).
import { createElement } from "react";
import { buildSeries } from "@/lib/view-series";
import { MapView } from "./MapView";
import { registerViewKind } from "./registry";

// S3c registers donut (ShareDonut), map (RankingsMap, in its host's own wrapper) and, through
// line and table, the geography views. Still host-drawn: Grade counts and the grade spread.
for (const kind of ["line", "table", "bar", "ranking", "numbers", "slope", "donut"] as const) registerViewKind({ kind, build: buildSeries });
registerViewKind({ kind: "map", build: buildSeries, render: (series, ctx) => createElement(MapView, { series, fullscreen: ctx.fullscreen }) });

export { renderView, registerViewKind, viewKindRegistered, type ViewKindDef } from "./registry";
export { useViewsV2, viewsV2Requested, ViewsModeContext, type ViewsMode } from "./flag";
