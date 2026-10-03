// The VicData 0.6 catalogue: rules, measures, renderers and dataviews (catalogue doc §2),
// plus the matching rule. Code is the source of truth; docs/catalogue/*.md is generated
// from these objects by scripts/catalogue-export.ts.
import { DATAVIEWS } from "./dataviews";
import { MEASURES } from "./measures";
import { RENDERERS } from "./renderers";
import { RULES } from "./rules";
import type { Dataview, DataviewId, HostId, Measure, MeasureId, Renderer, RendererId, Rule, RuleId } from "./types";

export * from "./types";
export * from "./matching";
export { RULES, RULE_IDS } from "./rules";
export { MEASURES, ACADEMIC_CITATION } from "./measures";
export { RENDERERS } from "./renderers";
export { DATAVIEWS, DATAVIEW_IDS } from "./dataviews";

const index = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));
const RULE_BY_ID = index(RULES);
const MEASURE_BY_ID = index(MEASURES);
const RENDERER_BY_ID = index(RENDERERS);
const DATAVIEW_BY_ID = index(DATAVIEWS);

export function ruleById(id: RuleId | string): Rule | undefined {
  return RULE_BY_ID.get(id);
}

export function measureById(id: MeasureId | string): Measure | undefined {
  return MEASURE_BY_ID.get(id);
}

export function rendererById(id: RendererId | string): Renderer | undefined {
  return RENDERER_BY_ID.get(id);
}

export function dataviewById(id: DataviewId | string): Dataview | undefined {
  return DATAVIEW_BY_ID.get(id);
}

// A host panel's views in rail order (the catalogue's own order). `panel` omitted = both.
export function dataviewsForHost(host: HostId, panel?: "current" | "trend"): Dataview[] {
  return DATAVIEWS.filter((d) => d.host.id === host && (panel === undefined || d.host.panel === panel));
}

// Rules a dataview applies, directly and through its measures (deduped, catalogue order).
export function rulesForDataview(dv: Dataview): Rule[] {
  const ids = new Set<string>(dv.rules);
  for (const m of dv.measures) for (const r of measureById(m)?.rules ?? []) ids.add(r);
  return RULES.filter((r) => ids.has(r.id));
}
