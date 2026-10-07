// VicData 0.6.7 B2: when the precomputed Post-16 list is used (src/lib/post16-default-neighbours.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { precomputedPost16Neighbours } from "./post16-default-neighbours";
import { clearReferenceCache } from "./server-cache";
import { CURRENT_CENSUS_PERIOD } from "./roll-data";

process.env.VICDATA_API_URL ??= "http://test.invalid";
process.env.VICDATA_ANON_KEY ??= "anon";
let lookup: () => Response;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith("/rpc/academic_current_periods")) return Response.json([{ ks_stage: "ks5", latest_period: 2024 }]);
  if (url.endsWith("/rpc/teacher_default_neighbours_lookup")) return lookup();
  return new Response("{}", { status: 404 });
}) as typeof fetch;
const row = (rank: number, over: Record<string, unknown> = {}) => ({ rank, neighbour_id: `n${rank}`, distance_km: rank, census_period: CURRENT_CENSUS_PERIOD, ks5_periods: [2023, 2024], computed_at: "2026-10-07", stale: false, ...over });
beforeEach(() => clearReferenceCache());

test("a current list is used, in rank order", async () => {
  lookup = () => Response.json([row(2), row(1), row(3)]);
  assert.deepEqual(await precomputedPost16Neighbours("1"), ["n1", "n2", "n3"]);
});

test("stale, other periods, no rows, a missing function or an error: build as before (null)", async () => {
  for (const r of [[row(1, { stale: true })], [row(1, { census_period: CURRENT_CENSUS_PERIOD - 1 })], [row(1, { ks5_periods: [2022, 2023] })], []]) {
    lookup = () => Response.json(r);
    assert.equal(await precomputedPost16Neighbours("1"), null, JSON.stringify(r));
  }
  lookup = () => new Response(JSON.stringify({ code: "PGRST202" }), { status: 404 });
  assert.equal(await precomputedPost16Neighbours("1"), null);
  lookup = () => new Response("boom", { status: 500 });
  assert.equal(await precomputedPost16Neighbours("1"), null);
});
