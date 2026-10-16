// GIAS refresh, 16 Oct 2026: GIAS now spells the LA "Isles of Scilly". Both spellings must resolve
// to South West, England, or the 8 Scilly schools drop out of school_region_nation and every
// region/nation comparison after the next sync.
// Run: npx -y tsx --test src/lib/region-crosswalk.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRegionNation } from "./region-crosswalk";

test("both Isles of Scilly spellings resolve to South West, England", () => {
  for (const name of ["Isles Of Scilly", "Isles of Scilly"]) {
    assert.deepEqual(resolveRegionNation(name), { regionName: "South West", regionCode: "E12000009", nation: "england" }, name);
  }
});
