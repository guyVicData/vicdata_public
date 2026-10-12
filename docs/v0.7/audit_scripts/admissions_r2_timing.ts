// 0.7 admissions r2: warm timings of each /api/admissions/* screen function (views-api.ts: what
// the routes answer, minus the auth check and the lists read). Run:
//   npx -y tsx --env-file=.env docs/v0.7/audit_scripts/admissions_r2_timing.ts
async function main() {
const v = await import("../../../src/lib/admissions/views-api");
const today = new Date("2026-10-12");
for (const [urn, e] of [["137625", "11+"], ["137625", "16+"], ["117037", "11+"]] as const) {
  const ep = v.entryPoint(e)!;
  const all = () => Promise.all([v.pipelineView(urn, ep, [], { today }), v.marketView(urn, ep, []), v.rivalsView(urn, ep, []), v.shapeView(urn, ep, [])]);
  let s = Date.now();
  await all();
  console.log(`${urn} ${e} cold (all four in parallel): ${Date.now() - s} ms`);
  for (let i = 1; i <= 3; i++) {
    const t: Record<string, number> = {};
    const time = async (n: string, f: () => Promise<unknown>) => { const a = Date.now(); await f(); t[n] = Date.now() - a; };
    s = Date.now();
    await Promise.all([time("pipeline", () => v.pipelineView(urn, ep, [], { today })), time("market", () => v.marketView(urn, ep, [])), time("rivals", () => v.rivalsView(urn, ep, [])), time("shape", () => v.shapeView(urn, ep, []))]);
    console.log(`${urn} ${e} warm run ${i}: all four in parallel ${Date.now() - s} ms (${Object.entries(t).map(([k, x]) => `${k} ${x}`).join(", ")})`);
  }
}
process.exit(0);
}
void main();
