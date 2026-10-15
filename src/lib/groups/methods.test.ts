// VicData 0.8 groups r2 (E): R-METHOD-PRESENT for the group views, and the honesty lines (R-GROUP-NOTES).
// Run: npx -y tsx --test src/lib/groups/methods.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { METHODS_GROUPS, groupMethodOf } from "@/catalogue/methods-groups";
import { methodText } from "@/catalogue/methods";
import { GROUP_NOTES } from "@/catalogue/notes";

const dashboard = readFileSync(path.join(__dirname, "../../components/groups/dash/GroupDashboard.tsx"), "utf8");
const viewIds = Array.from(dashboard.matchAll(/"(GRP-[OS]-[A-Z]+)": \{ label:/g)).map((m) => m[1]);

test("R-METHOD-PRESENT: every group view has a method: sources, area, years, steps, and no unfilled placeholder", () => {
  assert.ok(viewIds.length >= 12, `views registered: ${viewIds.join(" ")}`);
  for (const id of viewIds) {
    const m = groupMethodOf(id, {});
    assert.ok(m, `${id}: a method`);
    assert.ok(m!.sources.length > 0 && m!.sources.every((s) => s.trim().length > 3), `${id}: sources`);
    assert.ok(m!.geography.trim() && m!.years.trim(), `${id}: area and years`);
    assert.ok(m!.steps.length >= 1 && m!.steps.every((s) => s.trim().length > 10), `${id}: steps`);
    assert.ok(!/[{}]/.test(methodText(m!)), `${id}: no unfilled placeholder`);
  }
  assert.deepEqual(Object.keys(METHODS_GROUPS).filter((k) => !viewIds.includes(k)), [], "no method without a view");
});

test("the method is generated from the lookups' metadata: the reading, the set and its n, the years", () => {
  const m = methodText(groupMethodOf("GRP-O-AGAINST", { reading: "All schools listed now", setLabel: "MATs with 41+ schools (828 schools)", census: "2025/26", resultsYear: "2025/26", membershipSources: "GIAS", asOf: "2026-10-13" })!);
  for (const s of ["All schools listed now", "MATs with 41+ schools (828 schools)", "2025/26", "GIAS (as of 2026-10-13)"]) assert.ok(m.includes(s), s);
});

test("R-GROUP-NOTES: the four honesty lines, locked, and drawn by the dashboard", () => {
  assert.equal(GROUP_NOTES.membershipAsOf, "Membership as of {date}, from {source}.");
  assert.equal(GROUP_NOTES.combined, "Combined figures add up the schools listed. A school that joined recently counts for every year shown.");
  assert.match(GROUP_NOTES.comparesOnly, /^Compares only groups of the same type and a similar size band\. A self-declared group is never ranked against official groups\.$/);
  assert.match(GROUP_NOTES.missingListed, /listed and labelled, never left out silently\.$/);
  for (const k of ["membershipAsOf", "combinedAtTime", "combined", "comparesOnly", "missingListed", "readingAtTime", "readingListed"]) assert.ok(dashboard.includes(k), `the dashboard uses GROUP_NOTES.${k}`);
});
