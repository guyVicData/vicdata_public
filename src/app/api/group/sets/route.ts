import { NextRequest, NextResponse } from "next/server";
import { dashViewer } from "@/lib/groups/dash-server";
import { groupDataSource, groupLibraryIndex, groupSchoolsYear } from "@/lib/groups/aggregates";
import { displayName } from "@/lib/groups/dash";
import { GROUP_SET_CAP, groupDefaultOf } from "@/lib/groups/group-sets";
import { canKeepSets, isGroupAdmin, readGroupSets } from "@/lib/groups/group-sets-server";

// VicData 0.8 group sets (M4, M5): a head office's sets, for the set editor in group mode, Manage sets
// (/sets?account=) and the library's Add to set…. GET ?account=&with=cards|schools
//   sets         the group's sets and the caller's own for this group (archived included), the group's
//                defaults, the caller's active personal sets against the cap, and what they may do;
//   cards        (with=cards) every listed group (the library's index): the editor's rows and Add groups;
//   schools      (with=schools) the group's schools, current and past, for a subset of our own schools.
// Head office only (a member school's SMT reads "not found" here, D2: it never edits). View as and a peek
// read it, read-only. Writes go straight to the database under the member's own session.
export async function GET(request: NextRequest) {
  try {
    const who = await dashViewer(request);
    if (who instanceof NextResponse) return who;
    const { viewer } = who;
    if (viewer.as === "school") return NextResponse.json({ error: "Not found." }, { status: 404 });
    const want = request.nextUrl.searchParams.get("with");
    const [read, index] = await Promise.all([readGroupSets(who, { includeArchived: true }), groupLibraryIndex().catch(() => ({ build: null, groups: [] }))]);
    const us = index.groups.find((c) => c.group_id === viewer.groupId) ?? null;
    const live = read.sets.filter((s) => !s.archived);
    let schools: { urn: string; name: string; la: string | null; phases: string[]; roll: number | null; likely: boolean; current: boolean; counted: boolean }[] | undefined;
    if (want === "schools") {
      const rows = await groupSchoolsYear(viewer.groupId);
      schools = rows
        .filter((s) => s.role === "member")
        .map((s) => {
          const latest = [...s.years].reverse().find((y) => y.figures)?.figures ?? null;
          return { urn: s.urn, name: s.name ?? s.urn, la: s.la_name, phases: latest?.phases ?? [], roll: latest?.roll ?? null, likely: s.confidence === "likely", current: s.years.some((y) => y.listed_now), counted: latest?.counted !== false };
        })
        .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
    }
    return NextResponse.json({
      viewer: { as: viewer.as, accountId: viewer.account.id, groupId: viewer.groupId, name: us ? displayName(us.name) : viewer.account.name, userId: who.userId },
      source: groupDataSource(),
      can: { keep: canKeepSets(viewer), admin: isGroupAdmin(viewer) },
      sets: read.sets,
      notSetUp: read.notSetUp,
      personalActive: read.personalActive,
      cap: GROUP_SET_CAP,
      defaults: { group_peers: groupDefaultOf(live, "group_peers")?.id ?? null, group_schools: groupDefaultOf(live, "group_schools")?.id ?? null },
      us,
      ...(want === "cards" ? { cards: index.groups.filter((c) => c.group_id !== viewer.groupId) } : {}),
      ...(schools ? { schools } : {}),
    });
  } catch (err) {
    console.error("[group/sets] failed:", err);
    return NextResponse.json({ error: "Could not read the group's sets." }, { status: 502 });
  }
}
