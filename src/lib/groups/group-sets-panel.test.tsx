// Run: npx tsx --test --test-force-exit src/lib/groups/group-sets-panel.test.tsx
// Guy, 20 Nov ("learn from SMT"): the group home's comparison panel -- what the set is for, the choices (VicData
// default, Group sets, My sets) with the one in use ticked, the set's groups, how it was chosen, Make your own set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupSetsPanel } from "@/components/groups/GroupSetsPanel";

const data = {
  overview: {
    picker: {
      key: "nearest",
      name: "Nearest in size, same type",
      countText: "10 groups",
      short: "Nearest",
      defaults: [
        { key: "nearest", name: "Nearest in size, same type", countText: "10 groups", title: "The 10 MATs nearest Harris in number of schools." },
        { key: "band:mat:41+", name: "MATs with 41+ schools", countText: "12 groups", title: "Every MAT with 41 or more schools." },
      ],
      set: { key: "nearest", name: "Nearest in size", source: "nearest", setId: null, scope: null, groups: [{ id: "g1", label: "Ark Schools", type: "MAT", schools: 39 }, { id: "g2", label: "United Learning", type: "MAT", schools: 90 }] },
    },
  },
  sets: { sets: [{ id: "s1", name: "London MATs", kind: "group_peers", scope: "group", members: ["a", "b", "c"] }], notSetUp: false, personalActive: 0, cap: 8, admin: true, canKeep: true, defaults: { group_peers: null, group_schools: null } },
} as never;

const draw = (readOnly = false) => renderToStaticMarkup(createElement(GroupSetsPanel, { data, groupName: "Harris Federation", account: "acc-1", groupHome: "/teacher/group?account=acc-1", onPick: () => undefined, readOnly }));

test("group sets panel: explains the set, lists the choices by block, ticks the one in use, shows its groups", () => {
  const html = draw();
  assert.ok(html.includes("set Harris Federation against a set of other groups"));
  for (const b of ["VicData default", "Group sets"]) assert.ok(html.includes(b), b);
  assert.deepEqual([...html.matchAll(/aria-checked="true"[^>]*data-group-set-row="([^"]+)"/g)].map((m) => m[1]), ["nearest"]);
  assert.ok(html.indexOf("United Learning") < html.indexOf("Ark Schools"), "largest first");
  assert.ok(html.includes("This set includes 2 groups. The 10 MATs nearest Harris in number of schools."));
  assert.ok(html.includes('data-group-set-make=""'));
});

test("group sets panel: read-only (View as, a peek) hides Make your own set", () => {
  assert.ok(!draw(true).includes("data-group-set-make"));
});
