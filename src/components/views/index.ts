// VicData 0.6.1 S3: the config-driven view renderer (D1). ViewSpec -> series builder
// (src/lib/view-series) -> leaf component. This part registers line, table and bar; every
// other kind is still drawn by its host until its own part registers it.
import { buildSeries } from "@/lib/view-series";
import { registerViewKind } from "./registry";

for (const kind of ["line", "table", "bar"] as const) registerViewKind({ kind, build: buildSeries });

export { renderView, registerViewKind, viewKindRegistered, type ViewKindDef } from "./registry";
export { useViewsV2, viewsV2Requested, ViewsModeContext, type ViewsMode } from "./flag";
