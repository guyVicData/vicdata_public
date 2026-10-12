// VicData 0.7 admissions r1 (A5): the routes' work timed, cold then warm (the same server process,
// the one-hour reference cache warm), at The Chase and King's Worcester. Read-only.
//   npx -y tsx --env-file=.env docs/v0.7/audit_scripts/admissions_r1_timing.ts
import { buildPipeline } from "../../../src/lib/admissions/pipeline";
import { buildMarketShare } from "../../../src/lib/admissions/market";
import { buildRivals } from "../../../src/lib/admissions/rivals";
import { entryPoint } from "../../../src/lib/admissions/entry-points";

const time = async (f: () => Promise<unknown>) => { const t = performance.now(); await f(); return Math.round(performance.now() - t); };
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function main() {
  for (const [urn, id] of [["137625", "16+"], ["137625", "11+"], ["117037", "16+"]] as const) {
    const ep = entryPoint(id)!;
    for (const [label, f] of [
      ["pipeline", () => buildPipeline(urn, ep)],
      ["market share (10 rivals)", () => buildMarketShare(urn, ep)],
      ["rivals' ranks and flags", () => buildRivals(urn, ep)],
    ] as const) {
      const cold = await time(f);
      const warm = [await time(f), await time(f), await time(f)];
      const p = label === "pipeline" ? await buildPipeline(urn, ep) : null;
      const schools = p ? new Set(p.sets.flatMap((s) => s.urns)).size : null;
      console.log(`${urn} ${id} ${label}${schools ? ` (${schools} schools)` : ""}: cold ${cold} ms, warm ${med(warm)} ms`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
