// VicData 0.8 groups r3 (S, spec §3.5): a member school's groups as comparison sets in the existing
// chooser, everywhere it works (Teacher, SMT; the chooser's payload, /api/teacher/saved-comparator-sets).
// Each group is a read-only set, as the chooser's Victoria Consultancy sets are: choosing it opens its
// schools through the same custom-set path. Read from production's round 1 lookups
// (school_groups_lookup, group_schools_lookup); no group membership is needed (§3.2). Server-only.
//
// Rules (R-GROUP-SET, R-GROUP-SET-SOURCES):
//   - official groups (GIAS, Club ISS, Companies House, GIAS proprietor) are offered to their members;
//   - likely members are included, labelled with the source;
//   - a self-declared group is offered only to the school that made it (none exist yet: the path is
//     ready and tested with a fixture);
//   - single-academy trusts aren't groups here; a group of no other school isn't offered;
//   - two records of the same body (Harris' MAT 3320 and sponsor 3319) are shown once.
import { displayName } from "./dash";
import type { GroupMember, SchoolGroup } from "./production";

export const GROUP_SET_PREFIX = "group:";
const NOT_SETS = new Set(["sat", "secure_sat"]);

export type GroupSetMember = { urn: string; name: string; laName: string | null; independent: boolean; likely?: boolean };
export type GroupSet = {
  id: string;
  name: string;
  shared: true;
  mine: false;
  editable: false;
  config: Record<string, never>;
  vc: false;
  group: { groupId: string; source: string; sourceLabel: string; likely: boolean; likelyMembers: number; type: string; selfDeclared: boolean };
  members: GroupSetMember[];
};

const SOURCE_LABEL: Record<string, string> = { gias_groups: "GIAS", gias: "GIAS", club_iss: "Club ISS", companies_house: "Companies House", gias_proprietor: "GIAS (proprietor)", self_declared: "made by your school" };

/** "All Dukes schools", "All Harris Federation schools" (§3.5's labels). */
export function groupSetLabel(name: string): string {
  const n = displayName(name).replace(/\s+(Limited|Ltd)\.?$/i, "");
  return `All ${n.replace(/^The /, "")}${/schools$/i.test(n) ? "" : " schools"}`;
}

/** The school's groups as comparison sets. `groups` is the school's own (school_groups_lookup);
 * `membersOf` reads each group's current members (group_schools_lookup); `madeBy` is who made a
 * self-declared group (the school's URN), when there is one. */
export async function groupSetsFor(
  urn: string,
  groups: (SchoolGroup & { madeBy?: string | null })[],
  membersOf: (groupId: string) => Promise<GroupMember[]>,
  info: (urns: string[]) => Promise<Map<string, { laName: string | null; independent: boolean }>>,
): Promise<GroupSet[]> {
  const offered = groups.filter((g) => !NOT_SETS.has(g.type) && (g.source !== "self_declared" || g.madeBy === urn));
  const out: GroupSet[] = [];
  const seen = new Set<string>();
  for (const g of offered) {
    const members = (await membersOf(g.groupId)).filter((m) => m.urn !== urn);
    if (!members.length) continue;
    const key = members.map((m) => m.urn).sort().join(",");
    if (seen.has(key)) continue; // the same body under a second record
    seen.add(key);
    const meta = await info(members.map((m) => m.urn));
    out.push({
      id: `${GROUP_SET_PREFIX}${g.groupId}`,
      name: groupSetLabel(g.name),
      shared: true,
      mine: false,
      editable: false,
      config: {},
      vc: false,
      group: { groupId: g.groupId, source: g.source, sourceLabel: SOURCE_LABEL[g.source] ?? g.source, likely: g.confidence === "likely", likelyMembers: members.filter((m) => m.confidence === "likely").length, type: g.type, selfDeclared: g.source === "self_declared" },
      members: members
        .map((m) => ({ urn: m.urn, name: m.name, laName: meta.get(m.urn)?.laName ?? null, independent: meta.get(m.urn)?.independent ?? false, ...(m.confidence === "likely" ? { likely: true } : {}) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return out;
}
