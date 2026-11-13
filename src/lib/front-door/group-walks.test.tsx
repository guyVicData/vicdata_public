// Run: npx -y tsx --test --test-force-exit src/lib/front-door/group-walks.test.tsx
// VicData 0.8 front door (B12; Guy, 13 Nov): head office's walks draw the group dashboard's own views, on
// the Harris (3320) and Dukes fixtures (docs/v0.8/groups_fixtures: production's group lookups). Every
// screen: its view exists on its dashboard's layout, draws markup, opens on its own rail, and has an
// answer sentence with real figures (no "undefined", "NaN" or "null"). Comparing screens open on the set
// picker's "Nearest in size, same type", side by side with the set's median. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOverview, buildSchools, displayName, kindsFor, type GroupSetInput } from "../groups/dash";
import { buildAcademic, buildPupils } from "../groups/dash-r3";
import type { ComparisonRow, GroupAggregate, SchoolYearRow } from "../groups/aggregates";
import type { GroupIndex } from "../groups/library";
import { nearestInSize } from "../groups/group-sets";
import { groupWalkView, GROUP_VIEWS, type DashResponse, type ViewId } from "../../components/groups/dash/GroupDashboard";
import { groupAnswer } from "./group-answers";
import { groupWalkDash, walksFor } from "./walks";

const FX = path.join(__dirname, "../../../docs/v0.8/groups_fixtures");
const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(FX, f), "utf8")) as T;
const index = read<GroupIndex>("group_index_lookup.json");
const card = new Map(index.groups.map((c) => [c.group_id, c]));
const meta = (id: string) => ({ id, label: displayName(card.get(id)!.name), type: card.get(id)!.type, schools: card.get(id)!.schools });

function dashOf(tag: "harris" | "dukes", groupId: string): Record<string, DashResponse> {
  const agg = read<GroupAggregate>(`${tag}_group_aggregate_lookup_at_time.json`);
  const comps = [...read<ComparisonRow[]>(`${tag}_group_comparison_lookup.json`), ...read<ComparisonRow[]>(`${tag}_group_comparison_lookup_named.json`)];
  const schools = read<SchoolYearRow[]>(`${tag}_group_schools_year_lookup.json`);
  const nearest = nearestInSize(index.groups, card.get(groupId)!).map((c) => meta(c.group_id));
  const groupSet: GroupSetInput = { key: "nearest", name: "Nearest in size, same type", source: "nearest", setId: null, scope: null, groups: nearest };
  const compare = `peer_named:${nearest.map((g) => g.id).join(",")}` as never;
  const pass = { groupSet, addressKey: "nearest", nearest };
  const viewer = { as: "head_office" as const, accountId: "a1", groupId, name: agg.group.name, urn: null };
  const mapOf = schools.filter((s) => s.role === "member").map((s) => ({ urn: s.urn, name: s.name ?? s.urn, easting: s.easting, northing: s.northing, roll: null, trend: null, outside: s.outside_england, likely: s.confidence === "likely", phases: [] }));
  const base = { viewer, source: "fixtures" as const, membership: [], map: mapOf as never, nearest };
  const o = buildOverview({ agg, comps: comps.filter((r) => kindsFor(compare).includes(r.kind) || r.kind === "peer_named"), compare, focus: "all", ...pass });
  const input = { agg, comps, schools, compare, focus: "all" as const, ...pass };
  const a = buildAcademic(input);
  const p = buildPupils(input);
  const now = buildOverview({ agg, comps: [], compare: "peer_band", focus: "all" });
  return {
    overview: { ...base, overview: o },
    academic: { ...base, academic: a, now: a.overview, overview: a.overview },
    pupils: { ...base, pupils: p, now: p.overview, overview: p.overview },
    schools: { ...base, now, schools: buildSchools({ agg, schools, focus: "all", members: [], vicdata: new Set(), headOffice: true }) },
  };
}

const GROUPS = [
  { tag: "harris" as const, id: "3320" },
  { tag: "dukes" as const, id: "club_iss:dukes-education" },
];

for (const g of GROUPS) {
  test(`head office walks draw the group views (${g.tag})`, () => {
    const dash = dashOf(g.tag, g.id);
    const walks = walksFor("group");
    assert.equal(walks.length, 4);
    for (const w of walks) {
      assert.ok(w.screens.length >= 5, `${w.id}: ${w.screens.length} screens`);
      for (const s of w.screens) {
        const which = groupWalkDash(s.view);
        assert.ok(s.view in GROUP_VIEWS, `${s.view} is a group view`);
        const v = groupWalkView(dash[which], which, s.view as ViewId, [], 320);
        assert.ok(v.rail.some((r) => r.id === s.view), `${s.view}: its own rail lists it`);
        const html = renderToStaticMarkup(v.body);
        assert.ok(html.length > 200, `${w.id} ${s.view}: draws (${html.length} chars)`);
        const answer = groupAnswer(s.view, dash[which], []);
        assert.ok(answer.length > 20, `${s.view}: an answer`);
        assert.doesNotMatch(answer, /undefined|NaN|null|\[object/, `${s.view}: ${answer}`);
      }
    }
  });

  test(`a comparing screen opens side by side with the set's median (${g.tag})`, () => {
    const dash = dashOf(g.tag, g.id);
    const o = dash.overview.overview!;
    assert.ok(o.sideBySide, "side by side");
    assert.equal(o.picker.key, "nearest");
    assert.ok(o.picker.defaults.some((d) => d.key === "nearest"), "Nearest in size is in the Default block");
    const html = renderToStaticMarkup(groupWalkView(dash.overview, "overview", "GRP-O-AGAINST", null).body);
    assert.match(html, /Median of the set/);
    const answer = groupAnswer("GRP-O-AGAINST", dash.overview, null);
    assert.match(answer, /median of the set \(Nearest in size, same type\)/);
  });
}

test("the answers' figures are the views' own (Harris)", () => {
  const dash = dashOf("harris", "3320");
  const o = dash.overview.overview!;
  assert.ok(groupAnswer("GRP-O-NOW", dash.overview, null).includes(o.now.roll.toLocaleString("en-GB")));
  const ch = o.now.change["3"];
  assert.ok(groupAnswer("GRP-S-GROWING", dash.schools, null).startsWith(`${dash.schools.now!.now.change["3"].growing} of ${dash.schools.now!.now.change["3"].of}`));
  assert.ok(ch.of > 0);
  const i = dash.academic.academic!.improving;
  assert.ok(groupAnswer("GRP-A-IMPROVING", dash.academic, null).startsWith(`${i.improved} of ${i.of}`));
});
