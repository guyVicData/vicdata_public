// 0.8 SMT feedback round 1 (F-6, R-RAIL-HIDES-EMPTY): the views the rail now hides, per school, on SMT and
// Admissions -- built by the routes' own functions, read-only, the same hasContent the pages use.
//   npx -y tsx --env-file=.env docs/v0.8/audit_scripts/smt_fb1/rail-hidden.ts [urn ...]
// SMT on the school's default set (Teacher's 10 nearest), Whole school, no filters. Admissions on each
// standard entry point the school takes, with Admissions' defaults (no saved lists: none are readable here).
// Groups' rails are per group, not per school; their hasContent is unit-checked, not listed here.
import { smtSchool } from "../../../../src/lib/smt/school";
import { buildOverview, type SmtSet } from "../../../../src/lib/smt/overview";
import { buildPupils } from "../../../../src/lib/smt/pupils";
import { buildAcademic } from "../../../../src/lib/smt/academic";
import { buildContext } from "../../../../src/lib/smt/context";
import { resolveDefaultNearest } from "../../../../src/lib/chooser-sets";
import { setPhaseOf } from "../../../../src/lib/smt/levels";
import { SMT_DASHBOARDS } from "../../../../src/catalogue/dashboards/smt";
import { ADMISSIONS_DASHBOARDS } from "../../../../src/catalogue/dashboards/admissions";
import { showsOnState } from "../../../../src/catalogue/variants";
import { smtHasContent } from "../../../../src/components/smt/content";
import { admissionsHasContent } from "../../../../src/components/admissions/content";
import { entryPoint } from "../../../../src/lib/admissions/entry-points";
import { marketView, pipelineView, rivalsView, shapeView } from "../../../../src/lib/admissions/views-api";
import type { DashboardConfig } from "../../../../src/catalogue/types";

const FIVE_MILES_KM = 5 * 1.609344;
type Hidden = { product: string; dashboard: string; panel: string; dataview: string; entry?: string };

const railed = (config: DashboardConfig) => config.panels.filter((p) => p.dataviews.filter((v) => v.kind === "view").length > 1);

export async function railHidden(urn: string): Promise<{ name: string; hidden: Hidden[] }> {
  const school = (await smtSchool(urn))!;
  const near = await resolveDefaultNearest(urn, setPhaseOf(school.phases));
  const set: SmtSet = { kind: "nearest", label: "10 nearest schools", urns: near.rows.map((r: { urn: string }) => r.urn).filter((u: string) => u !== urn) };
  const filters = { sex: "all", boarding: "all" } as const;
  const level = { phase: "whole", area: null } as const;
  const [overview, pupils, academic, context] = await Promise.all([
    buildOverview(school, set, filters, null),
    buildPupils(school, set, filters, level, null),
    buildAcademic(school, level, set),
    buildContext(school, "around", "whole", { km: FIVE_MILES_KM, savedKm: null, defaultKm: FIVE_MILES_KM, capKm: 30, from: "view", capped: false }),
  ]);
  const ready = <T,>(data: T) => ({ status: "ready" as const, data });
  const c = { school, level, set, overview: ready(overview), pupils: ready(pupils), academic: ready(academic), context: ready(context) } as never;
  const hidden: Hidden[] = [];
  for (const config of SMT_DASHBOARDS)
    for (const p of railed(config))
      for (const v of p.dataviews) if (v.kind === "view" && !smtHasContent(v.dataview, c)) hidden.push({ product: "SMT", dashboard: config.name, panel: p.name ?? p.id, dataview: v.dataview });

  const entries = (["4+", "11+", "16+"] as const).filter((e) => {
    const age = Number(e.replace("+", ""));
    return (school.low ?? 99) <= age && (school.high ?? 0) >= age;
  });
  for (const e of entries) {
    const ep = entryPoint(e)!;
    const [pipeline, market, rivals, shape] = await Promise.all([pipelineView(urn, ep, []), marketView(urn, ep, []), rivalsView(urn, ep, []), shapeView(urn, ep, [])]);
    const ac = { entry: e, pipeline: ready(pipeline), market: ready(market), rivals: ready(rivals), shape: ready(shape) } as never;
    for (const config of ADMISSIONS_DASHBOARDS)
      for (const p of railed(config))
        for (const v of p.dataviews) if (v.kind === "view" && showsOnState(v, { entryPoint: e }) && !admissionsHasContent(v.dataview, ac)) hidden.push({ product: "Admissions", dashboard: config.name, panel: p.name ?? p.id, dataview: v.dataview, entry: e });
  }
  return { name: school.name, hidden };
}

if (process.argv[1]?.endsWith("rail-hidden.ts")) {
  (async () => {
    const urns = process.argv.slice(2);
    for (const u of urns.length ? urns : ["110110", "137625", "117037"]) {
      const r = await railHidden(u);
      console.log(`\n== ${r.name} (${u}): ${r.hidden.length} hidden`);
      for (const h of r.hidden) console.log(`  ${h.product} · ${h.dashboard}${h.entry ? ` (${h.entry})` : ""} · ${h.panel} · ${h.dataview}`);
    }
  })();
}
