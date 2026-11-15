// Run with the group fixtures switch on (src/lib/groups/fixture-switch.ts; the rule runner sets it): npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/group-walks-load.test.tsx
// VicData 0.8 feedback 15 Nov, build A (A2, R-GROUP-WALKS-LOAD): every head office walk loads -- its exact
// request (the walk's own address: dash, reading, focus, compare) through the group dash route's own body
// (dashPayload) on the group fixtures, then every screen drawn by the walk's own view builder -- for a
// mainstream group (Harris), a special trust (Nexus), a nursery federation (Birmingham), Shaw and Dukes, each
// as a group with no account (View as by production id) and with one. And a walk that can't load says what
// failed and offers the way home. No database: the group reads come from the fixtures; members and sets are
// stand-ins (the route reads them after access).
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { dashPayload } from "../groups/dash-payload";
import { fixtureGroups, groupAggregate, groupComparisons, groupLibraryIndex, groupSchoolsYear } from "../groups/aggregates";
import { foldSponsors, type GroupIndexEntry } from "../groups/production";
import { groupWalkView, type DashResponse, type ViewId } from "../../components/groups/dash/GroupDashboard";
import { groupAnswer } from "./group-answers";
import { groupWalkDash, walksFor } from "./walks";
import { groupWalkCompare, groupWalkDashUrl } from "./tile-figures";

const KINDS: Record<string, string> = { "3320": "mainstream (Harris)", "16125": "special trust (Nexus)", "17126": "nursery federation (Birmingham)", "4499": "Shaw", "club_iss:dukes-education": "Dukes" };

test("R-GROUP-WALKS-LOAD: every group walk loads for a mainstream group, a special trust, a nursery federation, with and without an account", async () => {
  const groups = fixtureGroups();
  assert.ok(["3320", "16125", "17126"].every((g) => groups.includes(g)), "the fixtures hold Harris, Nexus and a nursery federation");
  const index = await groupLibraryIndex();
  let n = 0;
  for (const groupId of groups)
    for (const account of [`group:${groupId}`, "00000000-0000-4000-8000-000000000001"])
      for (const w of walksFor("group")) {
        const dash = groupWalkDash(w.screens[0].view);
        // The walk's exact request, as GroupWalk builds it.
        const url = new URL(groupWalkDashUrl(dash, account, groupWalkCompare(dash)), "https://x");
        const reading = url.searchParams.get("reading") as "at_time";
        const agg = await groupAggregate(groupId, reading);
        assert.ok(agg, `${KINDS[groupId]}: the group's figures`);
        const d = (await dashPayload({
          dash: dash as "overview",
          reading,
          focus: "all",
          compareRaw: url.searchParams.get("compare"),
          viewer: { as: "view_as", account: { id: account, name: agg.group.name }, groupId },
          agg,
          members: [],
          index,
          read: { sets: [], notSetUp: !account.startsWith("group:"), personalActive: 0 },
          admin: false,
          canKeep: false,
          source: "fixtures",
          comparisons: (kinds) => groupComparisons(groupId, kinds),
          schoolsYear: () => groupSchoolsYear(groupId),
          vicdataSchools: async () => new Set(),
        })) as unknown as DashResponse;
        for (const s of w.screens) {
          const v = groupWalkView(d, dash, s.view as ViewId, null, 320);
          const html = renderToStaticMarkup(<>{v.body}</>);
          assert.ok(html.length > 40, `${KINDS[groupId]} ${w.id} ${s.view}: draws`);
          const a = groupAnswer(s.view, d, null);
          assert.ok(a && !/undefined|NaN|\bnull\b/.test(a), `${KINDS[groupId]} ${w.id} ${s.view}: "${a}"`);
          n++;
        }
      }
  assert.ok(n > 100, `${n} screens`);
});

test("R-GROUP-WALKS-LOAD: a walk that can't load names the failure and its code, and links home", async () => {
  const src = (await import("node:fs")).readFileSync("src/components/front-door/role-walks.tsx", "utf8");
  assert.doesNotMatch(src, /This walk couldn't load the group's figures\."/, "no bare sentence");
  assert.match(src, /function WalkError[\s\S]*\(error \{code\}\)[\s\S]*Back to your home/);
  assert.ok((src.match(/<WalkError /g) ?? []).length >= 3, "SMT, Admissions and head office walks");
  // The walk reads its account from the address the router holds, not window.location (A2).
  assert.match(src, /useSearchParams\(\)/);
});

test("A3: a trust's GIAS 'School sponsor' record folds into the trust (same schools); a diocese across trusts stays", () => {
  const e = (groupId: string, name: string, type: string, schools: number): GroupIndexEntry => ({ groupId, name, type, source: "gias_groups", schools, likely: 0 });
  const members: Record<string, string[]> = { "16125": ["a", "b"], "16132": ["b", "a"], "16040": ["c"], "15705": ["c"], dio: ["a", "c"] };
  const out = foldSponsors([e("16125", "NEXUS MULTI ACADEMY TRUST", "mat", 2), e("16132", "Nexus Multi Academy Trust", "sponsor", 2), e("16040", "NEXUS EDUCATION SCHOOLS TRUST", "mat", 1), e("15705", "Nexus Education Schools Trust", "sponsor", 1), e("dio", "Diocese of X", "sponsor", 2)], (id) => members[id] ?? []);
  assert.deepEqual(out.map((g) => [g.groupId, g.name, g.aliases ?? []]), [
    ["dio", "Diocese of X", []],
    ["16040", "Nexus Education Schools Trust", ["15705"]],
    ["16125", "Nexus Multi Academy Trust", ["16132"]],
  ]);
});
