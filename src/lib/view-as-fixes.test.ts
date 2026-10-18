// Run: npx -y tsx --test --test-force-exit src/lib/view-as-fixes.test.ts
// VicData 0.8 View as fixes: the round's rules, through the real module, caller helpers and routes against
// the View as round's stand-in Supabase (view-as-testkit.ts), with three things added here: an
// is_platform_admin that can fail (an error, or a request the browser cancelled), the production group
// lookups for two groups with no group account, and group_accounts by group id.
//   R-VIEW-AS-TRANSIENT, R-VIEW-AS-ANY-GROUP, R-PLATFORM-NO-MEMBERSHIP (and the race behind 18 Oct's bug)
// R-VIEW-AS-LANDS is the browser's (docs/v0.8/audit_scripts/view_as_fixes/lands.mjs).
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.VICDATA_API_URL = "http://production.test";
process.env.VICDATA_ANON_KEY = "prod-anon";
process.env.NEXT_PUBLIC_DASHBOARD_RENDERER = "config";

import { CHASE, LEIGHTON, groupAccounts, installFakeSupabase, log, memberships } from "./view-as-testkit";
installFakeSupabase();

// ------------------------------------------------------------------ what this file adds to the stand-in

// How is_platform_admin answers next: the fake's own answer ("ok"), an error, or a cancelled request.
let adminAnswers: ("ok" | "error" | "cancelled")[] = [];
let adminCalls = 0;
const HARRIS = "3320";
const DUKES = "club_iss:dukes-education";
const groupMembersOf: Record<string, { urn: string; name: string }[]> = {
  [HARRIS]: [{ urn: LEIGHTON, name: "Leighton Park School" }, { urn: "100060", name: "Harris Academy Example" }],
  [DUKES]: [{ urn: CHASE, name: "The Chase" }],
};
const groupMembershipRows: { profile_id: string }[] = [];
const fake = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (u.pathname === "/rest/v1/rpc/is_platform_admin") {
    adminCalls++;
    const a = adminAnswers.shift() ?? "ok";
    if (a === "cancelled") throw new TypeError("Failed to fetch");
    if (a === "error") return new Response(JSON.stringify({ message: "canceling statement due to statement timeout", code: "57014" }), { status: 500, headers: { "content-type": "application/json" } });
  }
  if (u.host === "production.test" && u.pathname === "/rest/v1/rpc/group_schools_lookup") {
    const { p_group_ids } = (await req.json()) as { p_group_ids: string[] };
    const rows = p_group_ids.flatMap((g) => (groupMembersOf[g] ?? []).map((m) => ({ group_id: g, urn: m.urn, school_name: m.name, school_status: "open", source: "gias", confidence: "confirmed", joined_date: "2015-09-01", last_seen: "2026-10-01" })));
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.pathname === "/rest/v1/group_accounts" && u.searchParams.get("group_id")) {
    const gid = u.searchParams.get("group_id")!.replace(/^eq\./, "");
    return new Response(JSON.stringify(groupAccounts.filter((g) => g.group_id === gid)), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.pathname === "/rest/v1/group_memberships" && req.method === "GET") {
    const pid = u.searchParams.get("profile_id")?.replace(/^eq\./, "");
    return new Response(JSON.stringify(pid ? groupMembershipRows.filter((r) => r.profile_id === pid).map(() => ({ id: "gm" })) : []), { status: 200, headers: { "content-type": "application/json" } });
  }
  return fake(input, init);
}) as typeof fetch;

// ------------------------------------------------------------------ the browser, for the client half

const jar = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
  set cookie(line: string) {
    const [pair, ...attrs] = line.split(";");
    const i = pair.indexOf("=");
    const k = pair.slice(0, i).trim();
    if (attrs.some((a) => /max-age=0/i.test(a.trim()))) jar.delete(k);
    else jar.set(k, pair.slice(i + 1).trim());
  },
};
g.window = {
  location: { search: "", protocol: "https:" },
  dispatchEvent: (e: Event) => { listeners.get(e.type)?.forEach((f) => f()); return true; },
  addEventListener: (t: string, f: () => void) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(f); },
  removeEventListener: (t: string, f: () => void) => listeners.get(t)?.delete(f),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

import type * as VAT from "./view-as";
type VA = typeof VAT;
/** A fresh copy of the module: what a new page load gets (its pin, its resolved promise). */
const load = createRequire(__filename);
async function pageLoad(): Promise<VA> {
  delete load.cache[load.resolve("./view-as")];
  return load("./view-as") as VA;
}

const client = (uid: string) => createClient("http://supabase.test", "anon-key", { global: { headers: { Authorization: `Bearer tok-${uid}` } }, auth: { persistSession: false } });
const session = (uid: string) => {
  const c = client(uid);
  // ownHome reads the session's user id (the browser client's; a stand-in here).
  (c.auth as unknown as { getSession: () => Promise<unknown> }).getSession = async () => ({ data: { session: { user: { id: uid }, access_token: `tok-${uid}` } }, error: null });
  return c;
};

let M: {
  resolveCaller: typeof import("./view-as-server").resolveCaller;
  groupCaller: typeof import("./groups/server").groupCaller;
  homeRoute: typeof import("../app/api/group/home/route");
  accessRoute: typeof import("../app/api/group/access/route");
  usageRoute: typeof import("../app/api/usage/route");
};
before(async () => {
  M = {
    resolveCaller: (await import("./view-as-server")).resolveCaller,
    groupCaller: (await import("./groups/server")).groupCaller,
    homeRoute: await import("../app/api/group/home/route"),
    accessRoute: await import("../app/api/group/access/route"),
    usageRoute: await import("../app/api/usage/route"),
  };
});

function request(path: string, uid: string, cookie?: string, init: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer tok-${uid}` };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`http://app.test${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

// ------------------------------------------------------------------ the race (18 Oct)

test("the cause: after a confirmed start, the page asks no second admin check (the one the navigation cancelled)", async () => {
  const va = await pageLoad();
  adminAnswers = [];
  const r = await va.startViewAs(client("guy"), { urn: LEIGHTON, role: "smt", fresh: false, schoolName: "Leighton Park School" });
  assert.equal(r.ok, true);
  const before = adminCalls;
  // The nav pill re-resolves as soon as the cookie changes; the page is navigating to /teacher.
  adminAnswers = ["cancelled", "cancelled", "cancelled"];
  assert.equal((await va.resolveViewAs(client("guy")))?.urn, LEIGHTON);
  assert.equal(adminCalls, before, "no re-check on the page being left");
  assert.equal(va.parseViewAsCookie(document.cookie)?.urn, LEIGHTON, "the cookie survives to /teacher");
  adminAnswers = [];
});

// ------------------------------------------------------------------ R-VIEW-AS-TRANSIENT

test("R-VIEW-AS-TRANSIENT: an is_platform_admin error keeps the cookie and shows a retry; never the admin's own school", async () => {
  for (const failure of ["error", "cancelled"] as const) {
    const start = await pageLoad();
    await start.startViewAs(client("guy"), { urn: LEIGHTON, role: "smt", fresh: false, schoolName: "Leighton Park School" });
    const va = await pageLoad();
    adminAnswers = [failure, failure, failure];
    const v = await va.resolveViewAs(client("guy"));
    assert.equal(v?.urn, LEIGHTON, `${failure}: the page is still Leighton Park as SMT`);
    assert.equal(v?.role, "smt");
    assert.equal(va.parseViewAsCookie(document.cookie)?.urn, LEIGHTON, `${failure}: the cookie is kept`);
    assert.equal(va.viewAsUnconfirmed(), true, `${failure}: the banner offers Retry`);
  }
  // One failure, then an answer: asked again, confirmed, no retry shown.
  const va = await pageLoad();
  adminAnswers = ["error"];
  assert.equal((await va.resolveViewAs(client("guy")))?.urn, LEIGHTON);
  assert.equal(va.viewAsUnconfirmed(), false);
  // Only a definite no ends it.
  const no = await pageLoad();
  assert.equal(await no.resolveViewAs(client("teacher")), null);
  assert.equal(no.parseViewAsCookie(document.cookie), null, "a definite no clears the cookie");
  adminAnswers = [];
});

test("R-VIEW-AS-TRANSIENT: the server says 'try again' (502), never the admin's own membership, and logs no usage", async () => {
  const cookie = `vicdata_view_as=${encodeURIComponent(JSON.stringify({ u: CHASE, r: "smt", n: "The Chase" }))}`;
  // A platform admin who is also a member here (the multi-role member stands in): without the check, the
  // request would be decided as their own membership.
  const admin = memberships.find((m) => m.urn === CHASE)!.profile_id;
  const wasAdmin = (await import("./view-as-testkit")).admins.has(admin);
  (await import("./view-as-testkit")).admins.add(admin);
  try {
    adminAnswers = ["error", "error"];
    const c = await M.resolveCaller(request(`/api/x?urn=${CHASE}`, admin, cookie), CHASE, { refusal: "no" });
    assert.ok(c instanceof Response);
    assert.equal(c.status, 502);
    adminAnswers = ["cancelled", "cancelled"];
    const g = await M.groupCaller(request("/api/group/home", "guy", `vicdata_view_as=${encodeURIComponent(JSON.stringify({ r: "head_office", g: `group:${HARRIS}`, n: "Harris Federation" }))}`));
    assert.ok(g instanceof Response);
    assert.equal(g.status, 502);
    log.usage.length = 0;
    adminAnswers = ["error", "error"];
    await M.usageRoute.POST(request("/api/usage", admin, cookie, { method: "POST", body: { product: "smt", urn: CHASE, event: "page_view", dashboard: "vicdata.smt.school" } }));
    assert.equal(log.usage.length, 0, "not logged");
    // Without a View as, a member's request is decided by their membership as before (no admin call).
    adminAnswers = [];
    const before = adminCalls;
    const m = await M.resolveCaller(request(`/api/x?urn=${CHASE}`, admin), CHASE, { refusal: "no" });
    assert.ok(!(m instanceof Response));
    assert.equal(m.access, "member");
    assert.equal(adminCalls, before);
  } finally {
    if (!wasAdmin) (await import("./view-as-testkit")).admins.delete(admin);
    adminAnswers = [];
  }
});

// ------------------------------------------------------------------ R-VIEW-AS-ANY-GROUP

const noAccountCookie = (gid: string, name: string) => `vicdata_view_as=${encodeURIComponent(JSON.stringify({ r: "head_office", g: `group:${gid}`, n: name }))}`;

test("R-VIEW-AS-ANY-GROUP: the cookie and the peek name any group, account or not; nothing else", async () => {
  const va = await pageLoad();
  assert.deepEqual(va.parseViewAsGroup(noAccountCookie(HARRIS, "Harris Federation")), { accountId: `group:${HARRIS}`, name: "Harris Federation" });
  assert.deepEqual(va.parseViewAsGroup(noAccountCookie(DUKES, "Dukes Education")), { accountId: `group:${DUKES}`, name: "Dukes Education" });
  assert.equal(va.parseViewAsGroup(noAccountCookie("bad id!", "x")), null);
  assert.equal(va.parseViewAsGroup(`vicdata_view_as=${encodeURIComponent(JSON.stringify({ r: "head_office", g: "3320", n: "x" }))}`), null, "a bare id is neither an account nor a group reference");
  assert.equal(va.parseViewAsCookie(noAccountCookie(HARRIS, "x")), null, "never a school View as");
  assert.deepEqual(va.parsePeekHeader(`peek=1&lookAs=group:${HARRIS}&as=head_office`)?.group, { accountId: `group:${HARRIS}` });
});

test("R-VIEW-AS-ANY-GROUP: head office of Harris and Dukes, neither with a group account, opens read-only", async () => {
  for (const [gid, name] of [[HARRIS, "Harris Federation"], [DUKES, "Dukes Education"]] as const) {
    assert.ok(!groupAccounts.some((a) => a.group_id === gid), "no group account for it");
    const cookie = noAccountCookie(gid, name);
    const c = await M.groupCaller(request("/api/group/home", "guy", cookie));
    assert.ok(!(c instanceof Response));
    assert.equal(c.viewAs, true);
    assert.deepEqual(c.offices.map((o) => ({ id: o.id, groupId: o.groupId, name: o.name, noAccount: o.noAccount })), [{ id: `group:${gid}`, groupId: gid, name, noAccount: true }]);
    // Its home: the member schools from the group lookups, no grants, not manageable.
    const home = await M.homeRoute.GET(request(`/api/group/home?account=group:${gid}`, "guy", cookie));
    assert.equal(home.status, 200);
    const h = (await home.json()) as { office: { noAccount: boolean }; viewAs: boolean; canManage: boolean; access: { seeing: number }; schools: { urn: string }[] };
    assert.equal(h.office.noAccount, true);
    assert.equal(h.viewAs, true);
    assert.equal(h.canManage, false);
    assert.equal(h.access.seeing, 0);
    assert.deepEqual(h.schools.map((s) => s.urn).sort(), groupMembersOf[gid].map((m) => m.urn).sort());
    // No Access page, read or write.
    assert.equal((await M.accessRoute.GET(request(`/api/group/access?account=group:${gid}`, "guy", cookie))).status, 404);
    const before = log.writes.length;
    assert.equal((await M.accessRoute.POST(request("/api/group/access", "guy", cookie, { method: "POST", body: { account: `group:${gid}`, urn: groupMembersOf[gid][0].urn, on: true } }))).status, 404);
    assert.equal(log.writes.length, before, "nothing written");
  }
});

test("R-VIEW-AS-ANY-GROUP: only the server's platform-admin check decides; head office's own access is unchanged", async () => {
  const cookie = noAccountCookie(HARRIS, "Harris Federation");
  const other = await M.groupCaller(request("/api/group/home", "teacher", cookie));
  assert.ok(!(other instanceof Response));
  assert.equal(other.viewAs, false);
  assert.deepEqual(other.offices, [], "anyone else's cookie reads nothing");
  assert.equal((await M.homeRoute.GET(request(`/api/group/home?account=group:${HARRIS}`, "teacher", cookie))).status, 404);
  // A group with no current members is no head office at all.
  const empty = await M.groupCaller(request("/api/group/home", "guy", noAccountCookie("9999", "Gone")));
  assert.ok(!(empty instanceof Response));
  assert.deepEqual(empty.offices, []);
  // A group that has an account, named by group id: the account's office (here: a preview account's id).
  const withAccount = await M.groupCaller(request("/api/group/home", "guy", `vicdata_view_as=${encodeURIComponent(JSON.stringify({ r: "head_office", g: groupAccounts[1].id, n: "x" }))}`));
  assert.ok(!(withAccount instanceof Response));
  assert.equal(withAccount.offices[0].id, groupAccounts[1].id);
  assert.equal(withAccount.offices[0].noAccount, undefined);
});

// ------------------------------------------------------------------ R-PLATFORM-NO-MEMBERSHIP

test("R-PLATFORM-NO-MEMBERSHIP: Back to me goes to /platform for a platform admin with no membership", async () => {
  const va = await pageLoad();
  assert.ok(!memberships.some((m) => m.profile_id === "guy"), "the stand-in admin holds no membership");
  assert.equal(await va.ownHome(session("guy")), "/platform");
  // A member goes home to their school; head office to the group; anyone else to /teacher, which explains.
  const member = memberships[0].profile_id;
  assert.equal(await va.ownHome(session(member)), "/teacher");
  groupMembershipRows.push({ profile_id: "head-office-user" });
  assert.equal(await va.ownHome(session("head-office-user")), "/teacher/group");
  assert.equal(await va.ownHome(session("nobody")), "/teacher");
  // A platform admin who IS a member (a second admin with a school) goes to that school's home.
  const admins = (await import("./view-as-testkit")).admins;
  admins.add(member);
  try {
    assert.equal(await va.ownHome(session(member)), "/teacher");
  } finally {
    admins.delete(member);
  }
});

test("R-PLATFORM-NO-MEMBERSHIP: every fallback for a platform admin is Platform, never a school", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = (p: string) => readFileSync(join(__dirname, p), "utf8");
  // Back to me uses ownHome; /teacher's no-school fallback sends a platform admin to /platform.
  assert.match(src("../components/view-as/ViewAs.tsx"), /export async function backToMe\(\) \{\s*exitViewAs\(\);\s*const home = await ownHome\(/);
  assert.match(src("../app/teacher/page.tsx"), /checkPlatformAdmin\(supabase, 1\)\) === "yes"\) \{\s*window\.location\.replace\("\/platform"\)/);
  // The preview sign-in's starter school is never granted to a platform admin.
  assert.match(src("../app/api/testing/preview-session/route.ts"), /&& !admin0\)/);
});
