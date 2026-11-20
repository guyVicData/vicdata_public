// Run: npx -y tsx --test --test-force-exit src/lib/saved-sets-access.test.ts
// 20 Nov: /api/teacher/saved-comparator-sets for head office (a member school's SMT) and a platform admin's
// peek, through the real route against the View as round's stand-in Supabase (view-as-testkit.ts), with
// Harris' production members and one real head-office user added here. Read-only for both: the school's
// shared and Victoria Consultancy sets, never anyone's personal sets, nothing editable; a member's path,
// a View as and a refusal are as before.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.VICDATA_API_URL = "http://production.test";
process.env.VICDATA_ANON_KEY = "prod-anon";
process.env.NEXT_PUBLIC_DASHBOARD_RENDERER = "config";

import { accounts, CHASE, groupAccounts, installFakeSupabase, LEIGHTON, log, names } from "./view-as-testkit";
installFakeSupabase();

// ------------------------------------------------------------------ what this file adds to the stand-in

const HARRIS_ACCOUNT = groupAccounts[1]; // Harris Federation (preview), members as production's 3320
const HO_USER = "ho"; // head office of Harris
let shares: { shared: boolean; set_at: string }[] = [];
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const fake = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const service = req.headers.get("apikey") === "service-key";
  const uid = req.headers.get("authorization")?.replace(/^Bearer\s+tok-/i, "") ?? null;
  if (u.host === "production.test" && u.pathname === "/rest/v1/rpc/group_schools_lookup") {
    const { p_group_ids } = (await req.json()) as { p_group_ids: string[] };
    return json(p_group_ids.filter((g) => g === "3320").map((g) => ({ group_id: g, urn: LEIGHTON, school_name: names[LEIGHTON], school_status: "open", source: "gias", confidence: "confirmed", joined_date: "2015-09-01", last_seen: "2026-10-01" })));
  }
  if (u.pathname === "/rest/v1/group_memberships" && req.method === "GET") {
    const pid = u.searchParams.get("profile_id")?.replace(/^eq\./, "");
    return json(pid === HO_USER && uid === HO_USER ? [{ role: "head_office", group_accounts: HARRIS_ACCOUNT }] : []);
  }
  // schoolAccounts([urn]): the school accounts by urn (service role).
  if (u.pathname === "/rest/v1/school_accounts" && u.searchParams.get("school_urn")?.startsWith("in.")) {
    const urns = u.searchParams.get("school_urn")!.slice(4, -1).split(",").map((x) => x.replace(/"/g, ""));
    return json(service ? urns.filter((x) => accounts[x]).map((x) => ({ id: accounts[x].id, school_urn: x, account_holder_membership_id: accounts[x].account_holder_membership_id })) : []);
  }
  if (u.pathname === "/rest/v1/group_admissions_shares") return json(service ? shares : []);
  // Leighton Park's sets: its Admissions 11+ rivals (an entry-point set), a whole-school set SMT made, and
  // lp-head's own personal set (theirs only, RLS).
  if (u.pathname === "/rest/v1/sets" && req.method === "GET") {
    const eq = (k: string) => u.searchParams.get(k)?.replace(/^eq\./, "");
    const memberHere = uid === "lp-head";
    if (eq("owner_scope") === "school" && eq("school_account_id") === accounts[LEIGHTON].id && (service || memberHere)) return json([set("rivals11", "Rivals at 11+", "school", "admissions", "11+"), set("whole", "Our usual schools", "school", "smt", null)]);
    if (eq("owner_scope") === "personal" && eq("owner_profile_id") === "lp-head" && uid === "lp-head" && !service) return json([set("mine", "My set", "personal", "me", null)]);
    return json([]);
  }
  return fake(input, init);
}) as typeof fetch;

function set(id: string, name: string, scope: "school" | "personal", creator: string, entry: string | null) {
  return { id, name, description: null, kind: "compared_against", entry_point: entry, phase: null, focus_urn: LEIGHTON, owner_scope: scope, school_account_id: scope === "school" ? accounts[LEIGHTON].id : null, owner_profile_id: scope === "personal" ? "lp-head" : null, creator_kind: creator, audience: null, rung_age: null, is_default: false, pinned: false, folder: null, tags: [], archived: false, rule: null, source_recipe: null, la_blend: null, config: {}, created_by: null, created_at: "2026-11-06T00:00:00Z", updated_by: null, updated_at: "2026-11-06T00:00:00Z", set_members: [{ urn: "100050", position: 0, tier: null }] };
}

let route: typeof import("../app/api/teacher/saved-comparator-sets/route");
let VA: typeof import("./view-as");
before(async () => {
  route = await import("../app/api/teacher/saved-comparator-sets/route");
  VA = await import("./view-as");
});

type Payload = { me: { membershipId: string; schoolAccountId: string; canEditShared: boolean; creatorKind?: string | null; viewAs?: unknown }; personalCount: number; sets: { id: string; mine: boolean; editable: boolean }[]; rankings?: unknown[] };

function get(urn: string, uid: string, extra: { cookie?: string; peek?: string } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer tok-${uid}` };
  if (extra.cookie) headers.cookie = extra.cookie;
  if (extra.peek) headers[VA.PEEK_HEADER] = extra.peek;
  return route.GET(new NextRequest(`http://app.test/api/teacher/saved-comparator-sets?urn=${urn}&phase=ks4`, { headers }));
}

function assertReadOnly(b: Payload, accountId: string) {
  assert.equal(b.me.membershipId, "", "no membership: nothing is saved as anyone's");
  assert.equal(b.me.schoolAccountId, accountId);
  assert.equal(b.me.canEditShared, false);
  assert.equal(b.me.creatorKind, null);
  assert.equal(b.me.viewAs, undefined, "not a View as: no View as store to save to");
  assert.equal(b.personalCount, 0);
  assert.ok(b.sets.every((s) => !s.mine && !s.editable), "nothing personal, nothing editable");
}

test("a member's request is decided by their membership, as before", async () => {
  const res = await get(CHASE, "multi");
  assert.equal(res.status, 200);
  const b = (await res.json()) as Payload;
  assert.equal(b.me.membershipId, "m-multi");
  assert.equal(b.me.schoolAccountId, accounts[CHASE].id);
  assert.equal(b.me.canEditShared, true, "the Admissions lead curates");
});

test("anyone else is refused, with or without a planted peek", async () => {
  assert.equal((await get(LEIGHTON, "teacher")).status, 403);
  assert.equal((await get(LEIGHTON, "teacher", { peek: `peek=1&lookAs=${LEIGHTON}&as=smt` })).status, 403);
  // A real head office, at a school its group doesn't hold.
  assert.equal((await get(CHASE, HO_USER)).status, 403);
});

test("a platform admin's peek reads the school's shared sets, read-only", async () => {
  // The stand-in logs every non-GET; the published-data lookups are read-only RPCs (POST rpc/...).
  const writes = () => log.writes.filter((w) => !w.startsWith("POST rpc/")).length;
  const before = writes();
  const res = await get(LEIGHTON, "guy", { peek: `peek=1&lookAs=${LEIGHTON}&as=smt` });
  assert.equal(res.status, 200);
  const b = (await res.json()) as Payload;
  assertReadOnly(b, accounts[LEIGHTON].id);
  assert.deepEqual(b.sets.map((s) => s.id).sort(), ["rivals11", "whole"], "the school's shared sets (its Admissions rivals too)");
  assert.equal(writes(), before, "nothing was written");
});

test("a platform admin who is a member, in a peek: the peek, never their own sets", async () => {
  const { admins } = await import("./view-as-testkit");
  admins.add("lp-head");
  try {
    const own = (await (await get(LEIGHTON, "lp-head")).json()) as Payload;
    assert.equal(own.me.membershipId, "m-lp-head", "without the peek: their own membership");
    assert.ok(own.sets.some((s) => s.id === "mine" && s.mine), "and their own set");
    const p = (await (await get(LEIGHTON, "lp-head", { peek: `peek=1&lookAs=${LEIGHTON}&as=smt` })).json()) as Payload;
    assertReadOnly(p, accounts[LEIGHTON].id);
    assert.deepEqual(p.sets.map((s) => s.id).sort(), ["rivals11", "whole"], "never their own set");
  } finally {
    admins.delete("lp-head");
  }
});

test("head office reads a member school's shared sets, read-only; Admissions' lists only where shared", async () => {
  shares = [];
  const res = await get(LEIGHTON, HO_USER);
  assert.equal(res.status, 200);
  const b = (await res.json()) as Payload;
  assertReadOnly(b, accounts[LEIGHTON].id);
  assert.deepEqual(b.sets.map((s) => s.id), ["whole"], "the school keeps its Admissions lists from head office");
  shares = [{ shared: true, set_at: "2020-01-01T00:00:00Z" }];
  try {
    const s = (await (await get(LEIGHTON, HO_USER)).json()) as Payload;
    assertReadOnly(s, accounts[LEIGHTON].id);
    assert.deepEqual(s.sets.map((x) => x.id).sort(), ["rivals11", "whole"], "shared with head office: its lists too");
  } finally {
    shares = [];
  }
});

test("a platform admin's head-office peek reads as that head office", async () => {
  const res = await get(LEIGHTON, "guy", { peek: `peek=1&lookAs=${HARRIS_ACCOUNT.id}&as=head_office` });
  assert.equal(res.status, 200);
  const b = (await res.json()) as Payload;
  assertReadOnly(b, accounts[LEIGHTON].id);
  assert.deepEqual(b.sets.map((s) => s.id), ["whole"], "a preview group has no shares");
});

test("View as is unchanged: the viewed role's standing and its own View as store", async () => {
  const cookie = `${VA.VIEW_AS_COOKIE}=${VA.serializeViewAsCookie({ urn: LEIGHTON, role: "school_admin", schoolName: names[LEIGHTON] })}`;
  const res = await get(LEIGHTON, "guy", { cookie });
  assert.equal(res.status, 200);
  const b = (await res.json()) as Payload;
  assert.ok(b.me.viewAs, "View as");
  assert.equal(b.me.canEditShared, true, "the viewed School-Admin's standing, as before");
  assert.deepEqual(b.sets.map((s) => s.id).sort(), ["rivals11", "whole"]);
});
