// VicData 0.6.7 B2: the Post-16 default set with the precomputed list ABSENT (production today:
// the lookup isn't applied) and PRESENT (a fetch stub answering teacher_default_neighbours_lookup
// from the computed rows -- scripts/compute-teacher-default-neighbours.ts --out DIR), against the
// built set (main's path). Read-only.
//   npx -y tsx --env-file=.env docs/v0.6/audit_scripts/v067_neighbours/both_states.ts <DIR> [urn ...]
// Prints, per school: identical? (the whole resolveDefaultNearest answer, JSON) and the time cold
// (fresh hour cache is per process: each school is read once per state).
import { readFileSync } from "node:fs";

const [dir, ...only] = process.argv.slice(2);
const stamp = JSON.parse(readFileSync(`${dir}/stamp.json`, "utf8"));
const lists = new Map<string, { rank: number; neighbour_id: string; distance_km: number }[]>();
for (const line of readFileSync(`${dir}/teacher_default_neighbours.csv`, "utf8").trim().split("\n").slice(1)) {
  const [e, r, n, d] = line.split(",");
  (lists.get(e) ?? lists.set(e, []).get(e)!).push({ rank: Number(r), neighbour_id: n, distance_km: Number(d) });
}
let present = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (present && url.includes("/rpc/teacher_default_neighbours_lookup")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    const rows = (lists.get(b.p_entity_id) ?? []).map((r) => ({ ...r, census_period: stamp.census_period, ks5_periods: stamp.ks5_periods, computed_at: stamp.computed_at, stale: false }));
    return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

async function main() {
  const cs = await import("../../../../src/lib/chooser-sets");
  const dcl = await import("../../../../src/lib/default-comparator-lists");
  const no = await import("../../../../src/lib/nearest-option");
  const built = async (urn: string) => {
    const l = await dcl.buildDefaultComparatorLists(urn, { only: "nearest", post16: true });
    const chosen = no.resolveNearestOption(l.list1, l.boardingBand, l.boardingRecipe, null);
    const urns = (chosen?.schools ?? []).map((s) => s.urn).filter((u) => u !== urn);
    return { ...(await cs.resolveFixedSet(urn, "ks5", urns)), count: urns.length };
  };
  const urns = only.length ? only : ["137625", "117037", "118952", "100053", "137739", "130416", "130432"];
  let diffs = 0;
  for (const urn of urns) {
    let t = performance.now();
    const main = JSON.stringify(await built(urn));
    const tBuilt = Math.round(performance.now() - t);
    present = false;
    t = performance.now();
    const absent = JSON.stringify(await cs.resolveDefaultNearest(urn, "ks5"));
    const tAbsent = Math.round(performance.now() - t);
    present = true;
    t = performance.now();
    const withList = JSON.stringify(await cs.resolveDefaultNearest(urn, "ks5"));
    const tPresent = Math.round(performance.now() - t);
    present = false;
    const ok = absent === main && withList === main;
    if (!ok) diffs++;
    console.log(`${urn}: ${ok ? "IDENTICAL" : "DIFFERENT"} (absent ${absent === main}, present ${withList === main}); built ${tBuilt} ms, absent ${tAbsent} ms, present ${tPresent} ms${lists.has(urn) ? "" : " (not precomputed: falls back)"}`);
  }
  process.exit(diffs ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
