// VicData 0.8 groups r1: the groups themselves, read from production (hrqrbvrrhlidpoybezhs) only
// through its anon-callable lookups, school_groups_lookup and group_schools_lookup (spec §3.2). Both
// return CURRENT memberships only (left_date null; confirmed and likely). Server-only.
import { cachedReference } from "../server-cache";
import { englandSchools } from "../admissions/ranks";

export type GroupMember = {
  groupId: string;
  urn: string;
  name: string;
  status: string | null;
  source: string;
  confidence: "confirmed" | "likely";
  joined: string | null;
  lastSeen: string | null;
};
export type SchoolGroup = { urn: string; groupId: string; type: string; name: string; officialName: string; status: string | null; source: string; confidence: "confirmed" | "likely"; joined: string | null; lastSeen: string | null };
export type GroupIndexEntry = { groupId: string; name: string; type: string; source: string; schools: number; likely: number };

// Membership changes when the ingest runs (at most daily); ten minutes keeps a revoke-by-leaving
// prompt without a lookup on every request.
const MEMBERS_TTL_MS = 10 * 60_000;
const INDEX_TTL_MS = 6 * 60 * 60_000;

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
  const url = process.env.VICDATA_API_URL;
  const key = process.env.VICDATA_ANON_KEY;
  if (!url || !key) throw new Error("VICDATA_API_URL / VICDATA_ANON_KEY are not set");
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${name} failed: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

type MemberRow = { group_id: string; urn: string; school_name: string | null; school_status: string | null; source: string; confidence: string; joined_date: string | null; last_seen: string | null };
type SchoolGroupRow = { urn: string; group_id: string; group_type: string; display_name: string; official_name: string; group_status: string | null; source: string; confidence: string; joined_date: string | null; last_seen: string | null };
const conf = (c: string): "confirmed" | "likely" => (c === "likely" ? "likely" : "confirmed");

/** A group's current member schools (one group per call, cached). */
export function groupMembers(groupId: string): Promise<GroupMember[]> {
  return cachedReference(
    `groups:members:${groupId}`,
    async () =>
      (await rpc<MemberRow>("group_schools_lookup", { p_group_ids: [groupId] })).map((r) => ({
        groupId: r.group_id,
        urn: r.urn,
        name: r.school_name ?? r.urn,
        status: r.school_status,
        source: r.source,
        confidence: conf(r.confidence),
        joined: r.joined_date,
        lastSeen: r.last_seen,
      })),
    MEMBERS_TTL_MS,
  );
}

/** A school's current groups (cached per school). */
export function schoolGroups(urn: string): Promise<SchoolGroup[]> {
  return cachedReference(`groups:of:${urn}`, async () => (await rpc<SchoolGroupRow>("school_groups_lookup", { p_urns: [urn] })).map(toSchoolGroup), MEMBERS_TTL_MS);
}

function toSchoolGroup(r: SchoolGroupRow): SchoolGroup {
  return { urn: r.urn, groupId: r.group_id, type: r.group_type, name: r.display_name, officialName: r.official_name, status: r.group_status, source: r.source, confidence: conf(r.confidence), joined: r.joined_date, lastSeen: r.last_seen };
}

/** Every group with a current English member, for the Platform page's search. Production has no
 * lookup by group name, so this asks school_groups_lookup about every school, in batches small
 * enough that no response reaches PostgREST's 1,000-row cap (logged: an ingest-side search lookup
 * would replace it). */
export function groupIndex(): Promise<GroupIndexEntry[]> {
  return cachedReference(
    "groups:index",
    async () => {
      const urns = Array.from((await englandSchools()).keys());
      const batches: string[][] = [];
      for (let i = 0; i < urns.length; i += 300) batches.push(urns.slice(i, i + 300));
      const by = new Map<string, GroupIndexEntry>();
      for (let i = 0; i < batches.length; i += 8) {
        const parts = await Promise.all(batches.slice(i, i + 8).map((b) => rpc<SchoolGroupRow>("school_groups_lookup", { p_urns: b })));
        for (const r of parts.flat()) {
          const e = by.get(r.group_id) ?? { groupId: r.group_id, name: r.display_name, type: r.group_type, source: r.source, schools: 0, likely: 0 };
          e.schools++;
          if (r.confidence === "likely") e.likely++;
          by.set(r.group_id, e);
        }
      }
      return Array.from(by.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    INDEX_TTL_MS,
  );
}
