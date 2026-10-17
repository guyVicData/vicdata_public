// VicData 0.8 View as: the stand-in Supabase the View as tests run the real routes against (its REST
// and auth calls answered over fetch, RLS reduced to what the rules need). Not a test file itself.
// ------------------------------------------------------------------ the stand-in database

export const LEIGHTON = "110110"; // Leighton Park: no membership for the platform admin
export const EMPTY = "100001"; // a school with a school account and no members
export const NO_ACCOUNT = "100002"; // a school with no school account at all
export const CHASE = "137625"; // the multi-role member's school

type Membership = { id: string; profile_id: string; urn: string; roles: string[]; role: string; is_admin: boolean; admissions_lead: boolean };
export const accounts: Record<string, { id: string; account_holder_membership_id: string | null }> = {
  [LEIGHTON]: { id: "acc-lp", account_holder_membership_id: "m-lp-head" },
  [EMPTY]: { id: "acc-empty", account_holder_membership_id: null },
  [CHASE]: { id: "acc-chase", account_holder_membership_id: null },
};
export const memberships: Membership[] = [
  { id: "m-lp-head", profile_id: "lp-head", urn: LEIGHTON, roles: ["smt"], role: "smt", is_admin: true, admissions_lead: false },
  { id: "m-multi", profile_id: "multi", urn: CHASE, roles: ["teacher", "admissions"], role: "teacher", is_admin: false, admissions_lead: true },
  { id: "m-teacher", profile_id: "teacher", urn: CHASE, roles: ["teacher"], role: "teacher", is_admin: false, admissions_lead: false },
];
export const names: Record<string, string> = { [LEIGHTON]: "Leighton Park School", [EMPTY]: "Empty School", [NO_ACCOUNT]: "No Account School", [CHASE]: "The Chase" };
export const admins = new Set(["guy", "second-admin"]);
export const groupAccounts = [
  { id: "11111111-1111-4111-8111-111111111111", group_id: "preview:club_iss:dukes-education", display_name: "Dukes Education (preview)", status: "active", preview_of: "club_iss:dukes-education" },
  { id: "22222222-2222-4222-8222-222222222222", group_id: "preview:3320", display_name: "Harris Federation (preview)", status: "active", preview_of: "3320" },
];

export const log = { audit: [] as { action: string; urn: unknown; detail: unknown; by: string }[], usage: [] as Record<string, unknown>[], writes: [] as string[] };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function who(headers: Headers): { service: boolean; uid: string | null } {
  const key = headers.get("apikey");
  const auth = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (key === "service-key") return { service: true, uid: null };
  return { service: false, uid: auth.startsWith("tok-") ? auth.slice(4) : null };
}

function eqs(u: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of u.searchParams) if (v.startsWith("eq.")) out[k] = v.slice(3);
  return out;
}

// The member reads their own school's rows; nobody else's (RLS, reduced).
const memberOf = (uid: string | null, urn: string) => !!uid && memberships.some((m) => m.profile_id === uid && m.urn === urn);

export function installFakeSupabase() {
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const { service, uid } = who(req.headers);
  if (u.pathname === "/auth/v1/user") return uid ? json({ id: uid, aud: "authenticated", email: `${uid}@test` }) : json({ msg: "bad jwt" }, 401);
  const path = u.pathname.replace("/rest/v1/", "");
  const f = eqs(u);
  if (req.method === "POST" && path === "rpc/is_platform_admin") return json(!!uid && admins.has(uid));
  if (req.method === "POST" && path === "rpc/log_platform_action") {
    const b = (await req.json()) as { p_action: string; p_school_urn: unknown; p_detail: unknown };
    if (!uid || !admins.has(uid)) return json({ message: "not a platform admin" }, 403);
    log.audit.push({ action: b.p_action, urn: b.p_school_urn, detail: b.p_detail, by: uid });
    return json(null);
  }
  if (req.method === "POST" && path === "rpc/platform_group_accounts_overview") return json(groupAccounts);
  if (req.method !== "GET") {
    log.writes.push(`${req.method} ${path}`);
    if (path === "usage_events") log.usage.push((await req.json()) as Record<string, unknown>);
    return json([], 201);
  }
  if (path === "school_memberships") {
    const urn = f["school_accounts.school_urn"];
    const rows = memberships
      .filter((m) => (f.profile_id ? m.profile_id === f.profile_id : true) && (urn ? m.urn === urn : true))
      .filter((m) => service || memberOf(uid, m.urn))
      .slice(0, Number(u.searchParams.get("limit") ?? 1000))
      .map((m) => ({ id: m.id, roles: m.roles, role: m.role, is_admin: m.is_admin, admissions_lead: m.admissions_lead, approved_at: "2026-01-01", school_account_id: accounts[m.urn]?.id, school_accounts: { id: accounts[m.urn]?.id, school_urn: m.urn, account_holder_membership_id: accounts[m.urn]?.account_holder_membership_id ?? null, schools: { current_name: names[m.urn] } } }));
    return json(rows);
  }
  if (path === "school_accounts") {
    const urn = f.school_urn;
    const a = accounts[urn];
    return json(a && (service || memberOf(uid, urn)) ? [{ id: a.id, account_holder_membership_id: a.account_holder_membership_id }] : []);
  }
  if (path === "schools") return json(f.urn && names[f.urn] ? [{ urn: f.urn, current_name: names[f.urn] }] : []);
  if (path === "school_catchment") return json(service && f.school_account_id === "acc-lp" ? [{ km: 12 }] : []);
  if (path === "admissions_entry_points" || path === "admissions_lists") {
    const visible = service || Object.entries(accounts).some(([urn, a]) => a.id === f.school_account_id && memberOf(uid, urn));
    return json(visible && f.school_account_id === "acc-lp" ? (path === "admissions_lists" ? [{ id: "l1", entry_point: "y7", kind: "rivals", members: ["100050"], updated_by: null }] : [{ entry_point: "y7", sort_order: 0, updated_by: null }]) : []);
  }
  if (path === "group_accounts") return json(service ? groupAccounts.filter((g) => !f.id || g.id === f.id) : []);
  if (path === "group_memberships") return json([]);
  return json([]);
}) as typeof fetch;
}
