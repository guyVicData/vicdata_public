// VicData 0.8 non-mainstream groups: the group dashboard route's body as one function, so the route and
// the parity and screenshot harnesses build the page's answer the same way. Pure but for the reads it is
// handed (the group lookups, through aggregates.ts, and the member schools' VicData accounts). The route
// (src/app/api/group/dash/route.ts) checks access first and reads the sets; everything after is here.
import type { ComparisonRow, GroupAggregate, Reading, SchoolYearRow } from "./aggregates";
import { NM_COMPARISON_KINDS } from "./aggregates";
import { buildOverview, buildSchools, displayName, kindsFor, type Focus } from "./dash";
import { buildAcademic, buildPupils } from "./dash-r3";
import type { GroupIndex } from "./library";
import type { GroupMember } from "./production";
import { GROUP_SET_CAP, groupDefaultOf, nearestInSize, resolveCompare, type GroupSetRow } from "./group-sets";
import type { GroupSetsInfo } from "./group-sets-server";
import { familyOf, FAMILY_PEER_PLURAL, isNonMainstream } from "./non-mainstream";

export type PayloadViewer = { as: "head_office" | "view_as" | "school"; account: { id: string; name: string }; groupId: string; urn?: string };

export async function dashPayload(input: {
  dash: "overview" | "schools" | "academic" | "pupils";
  reading: Reading;
  focus: Focus;
  compareRaw: string | null;
  viewer: PayloadViewer;
  agg: GroupAggregate;
  members: GroupMember[];
  index: GroupIndex;
  read: { sets: GroupSetRow[]; notSetUp: boolean; personalActive: number };
  admin: boolean;
  canKeep: boolean;
  source: "production" | "fixtures";
  comparisons: (kinds: string[]) => Promise<ComparisonRow[]>;
  schoolsYear: () => Promise<SchoolYearRow[]>;
  vicdataSchools: (urns: string[]) => Promise<Set<string>>;
}): Promise<Record<string, unknown>> {
  const { dash, focus, viewer, agg, members, index, read } = input;
  // The route's reads, by the names it used (the group is the viewer's).
  const groupComparisons = (...a: [string, string[]]) => input.comparisons(a[1]);
  const groupSchoolsYear = (...a: [string]) => (void a, input.schoolsYear());
  const vicdataSchools = input.vicdataSchools;
  const q = { get: (k: string) => (k === "compare" ? input.compareRaw : null) };
  // 0.8 non-mainstream groups: a special and AP trust or nursery federation (production's group.kind).
  const isNm = isNonMainstream(agg.group.kind);
  const nmCards = index.non_mainstream ?? [];
  const cards = [...index.groups, ...nmCards];
  const nmCounts = isNm ? { two: nmCards.filter((c) => c.schools === 2).length, of: nmCards.length } : undefined;

  // The sets this viewer may use, and the group's defaults (D8).
  const live = read.sets.filter((s) => !s.archived);
  const sets: GroupSetsInfo = {
    sets: live,
    notSetUp: read.notSetUp,
    personalActive: read.personalActive,
    cap: GROUP_SET_CAP,
    admin: input.admin,
    canKeep: input.canKeep,
    defaults: { group_peers: groupDefaultOf(live, "group_peers")?.id ?? null, group_schools: groupDefaultOf(live, "group_schools")?.id ?? null },
  };

  // The comparison: the address's key (old ones mapped), else the page's default.
  const sector = agg.group.type.startsWith("independent") ? "independent" : "state";
  const bandKey = agg.peer?.set_id ?? null;
  const size = agg.membership.confirmed + agg.membership.likely;
  const us = cards.find((c) => c.group_id === viewer.groupId) ?? { group_id: viewer.groupId, type: agg.group.type, schools: size };
  const card = new Map(cards.map((c) => [c.group_id, c]));
  const meta = (id: string) => {
    const c = card.get(id);
    return { id, label: c ? displayName(c.name) : id, type: c?.type ?? "unknown", schools: c?.schools ?? 0 };
  };
  const family = familyOf(agg.group.kind);
  // R-NM-SETS: a set of groups holds our own family's groups only (the others are left out, and said).
  const allowed = (id: string) => familyOf(card.get(id)?.kind) === family;
  const nearest = (isNm ? nearestInSize(cards, us, undefined, (c) => familyOf(c.kind) === family) : nearestInSize(index.groups, us)).map((c) => meta(c.group_id));
  const { key, compare, groupSet } = resolveCompare(q.get("compare"), { bandKey, sector, ourId: viewer.groupId, sets: live, defaultId: sets.defaults.group_peers, nearest, meta, nm: isNm, allowed, ...(isNm ? { nearestName: `Nearest in size, ${FAMILY_PEER_PLURAL[family as "special_ap" | "nursery"]}` } : {}) });
  const pass = { groupSet, addressKey: key, nearest, ...(nmCounts ? { nmCounts } : {}) };

  const base = {
    viewer: { as: viewer.as, accountId: viewer.account.id, groupId: viewer.groupId, name: viewer.account.name, urn: viewer.as === "school" ? (viewer.urn ?? null) : null },
    source: input.source,
    membership: members.map((m) => ({ urn: m.urn, name: m.name, confidence: m.confidence, joined: m.joined, lastSeen: m.lastSeen, source: m.source })),
    sets,
    nearest,
  };
  const mapOf = (census: number, schools: SchoolYearRow[]) =>
    schools
    .filter((s) => s.role === "member" && s.years.some((y) => y.listed_now))
    .map((s) => {
      const f = s.years.find((y) => y.period === census)?.figures ?? null;
      return { urn: s.urn, name: s.name ?? s.urn, easting: s.easting, northing: s.northing, roll: f?.roll ?? null, trend: f?.trend["1"] ?? null, outside: s.outside_england, likely: s.confidence === "likely", phases: f?.phases ?? [] };
    });
  if (dash === "schools") {
    const schools = await groupSchoolsYear(viewer.groupId);
    // NM11: a special, AP, PRU or nursery school is placed against its region's pool of its kind.
    const placed = isNm || schools.some((s) => s.role === "member" && s.years.some((y) => y.figures?.pool_kind));
    const pools = placed ? await groupComparisons(viewer.groupId, ["pools"]).catch(() => []) : undefined;
    const headOffice = viewer.as !== "school";
    const vicdata = headOffice ? await vicdataSchools(schools.filter((s) => s.role === "member").map((s) => s.urn)) : new Set<string>();
    // The group-now figures as Overview counts them (Schools has no comparison: its selector is Showing).
    const now = buildOverview({ agg, comps: isNm ? (pools ?? []) : [], compare: "peer_band", focus, ...(nmCounts ? { nmCounts } : {}) });
    return ({ ...base, now, map: mapOf(now.years.census, schools), schools: buildSchools({ agg, schools, focus, members, vicdata, headOffice, ...(pools ? { pools } : {}) }) });
  }
  // A non-mainstream group asks for its own kinds: its peer set, its kinds' pools, the same kinds in its
  // regions, and the mainstream pools for its mainstream line.
  const kinds = isNm ? [...NM_COMPARISON_KINDS, ...kindsFor(compare).filter((k) => k.startsWith("peer_named:"))] : kindsFor(compare);
  const [comps, schools] = await Promise.all([groupComparisons(viewer.groupId, kinds), groupSchoolsYear(viewer.groupId)]);
  if (isNm && dash === "academic") {
    // R-NM-NO-RESULTS: no results are compared for a non-mainstream group; Academic says why.
    const overview = buildOverview({ agg, comps, compare, focus, ...pass });
    return ({ ...base, now: overview, overview, map: mapOf(overview.years.census, schools) });
  }
  if (dash === "academic" || dash === "pupils") {
    const input = { agg, comps, schools, compare, focus, ...pass };
    const page = dash === "academic" ? { academic: buildAcademic(input) } : { pupils: buildPupils(input) };
    const overview = (page.academic ?? page.pupils)!.overview;
    return ({ ...base, ...page, now: overview, overview, map: mapOf(overview.years.census, schools) });
  }
  const overview = buildOverview({ agg, comps, compare, focus, ...pass });
  // The map: member schools sized by roll, coloured by trend; outside England listed beside it.
  return ({ ...base, overview, map: mapOf(overview.years.census, schools) });
}
