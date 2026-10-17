// Run: npx -y tsx --test src/lib/view-as-round.test.ts
// VicData 0.8 View as: the round's rules, run through the real route handlers and the one caller
// helper against a stand-in Supabase (its REST and auth calls answered here, over fetch, with the
// app database's RLS reduced to what these rules need: a member reads their own school's rows, a
// platform admin's own token reads no other school's, the service role reads everything).
//   R-VIEW-AS-ANY-SCHOOL, R-VIEW-AS-HEAD-OFFICE, R-VIEW-AS-ADMIN-ONLY, R-ROLE-SWITCH, R-VIEW-AS-LOGGING
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.NEXT_PUBLIC_DASHBOARD_RENDERER = "config";

import { accounts, admins, groupAccounts, log, names, LEIGHTON, EMPTY, NO_ACCOUNT, CHASE, installFakeSupabase } from "./view-as-testkit";
installFakeSupabase();

// ------------------------------------------------------------------ requests

// Loaded once the environment above is set (the modules read it as they load).
import * as VA from "./view-as";
import type * as SrvT from "./view-as-server";
let M: {
  resolveCaller: typeof SrvT.resolveCaller;
  smtCaller: typeof import("./smt/auth").smtCaller;
  admissionsCaller: typeof import("./admissions/auth").admissionsCaller;
  groupCaller: typeof import("./groups/server").groupCaller;
  callerRoute: typeof import("../app/api/view-as/caller/route");
  listsRoute: typeof import("../app/api/admissions/lists/route");
  catchmentRoute: typeof import("../app/api/smt/catchment/route");
  usageRoute: typeof import("../app/api/usage/route");
};
before(async () => {
  M = {
    resolveCaller: (await import("./view-as-server")).resolveCaller,
    smtCaller: (await import("./smt/auth")).smtCaller,
    admissionsCaller: (await import("./admissions/auth")).admissionsCaller,
    groupCaller: (await import("./groups/server")).groupCaller,
    callerRoute: await import("../app/api/view-as/caller/route"),
    listsRoute: await import("../app/api/admissions/lists/route"),
    catchmentRoute: await import("../app/api/smt/catchment/route"),
    usageRoute: await import("../app/api/usage/route"),
  };
});
const { serializeViewAsCookie, serializeViewAsGroup, parseViewAsCookie, parseViewAsGroup, VIEW_AS_COOKIE, LEGACY_VIEW_AS_GROUP_COOKIE } = VA;
const SRC = join(process.cwd(), "src");
const src = (rel: string) => readFileSync(join(SRC, rel), "utf8");

type Role = "teacher" | "smt" | "admissions" | "school_admin";
const asSchool = (urn: string, role: Role) => `${VIEW_AS_COOKIE}=${serializeViewAsCookie({ urn, role, schoolName: names[urn] ?? urn })}`;
const asGroup = (i: number) => `${VIEW_AS_COOKIE}=${serializeViewAsGroup({ accountId: groupAccounts[i].id, name: groupAccounts[i].display_name })}`;

function request(path: string, uid: string, cookie?: string, init: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer tok-${uid}` };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`http://app.test${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

// ------------------------------------------------------------------ R-VIEW-AS-ANY-SCHOOL

test("R-VIEW-AS-ANY-SCHOOL: SMT, Admissions and School-Admin at a school with no membership for the admin, and at schools with no members or no account", async () => {
  for (const urn of [LEIGHTON, EMPTY, NO_ACCOUNT]) {
    // The page's own read of the viewed school (what loadSmtMember / loadAdmissionsMember / the admin pages call).
    for (const role of ["smt", "admissions", "school_admin"] as Role[]) {
      const res = await M.callerRoute.GET(request(`/api/view-as/caller?urn=${urn}`, "guy", asSchool(urn, role)));
      assert.equal(res.status, 200, `${urn} as ${role}`);
      const body = (await res.json()) as { accountId: string; access: string; readOnly: boolean; name: string; catchmentKm: number | null };
      assert.equal(body.access, "viewAs");
      assert.equal(body.readOnly, true);
      assert.equal(body.accountId, accounts[urn]?.id ?? "", "the account the admin's own RLS can't read, or none");
      assert.equal(body.name, names[urn]);
    }
    // SMT's routes: SMT and the School-Admin draw; a Teacher View as is refused, as a Teacher is.
    for (const role of ["smt", "school_admin"] as Role[]) {
      const c = await M.smtCaller(request(`/api/smt/school?urn=${urn}`, "guy", asSchool(urn, role)), urn);
      assert.ok(!(c instanceof Response), `SMT as ${role} at ${urn}`);
      assert.equal(c.access, "viewAs");
      assert.equal(c.readOnly, true);
    }
    const t = await M.smtCaller(request(`/api/smt/school?urn=${urn}`, "guy", asSchool(urn, "teacher")), urn);
    assert.ok(t instanceof Response && t.status === 403, "View as Teacher: SMT says who it's for");
    // Admissions' routes.
    for (const role of ["admissions", "smt", "school_admin"] as Role[]) {
      const c = await M.admissionsCaller(request(`/api/admissions/pipeline?urn=${urn}`, "guy", asSchool(urn, role)), urn);
      assert.ok(!(c instanceof Response), `Admissions as ${role} at ${urn}`);
      assert.equal(c.readOnly, true);
    }
    // The school's own lists are read (Leighton Park has some), or none; never a 404.
    const lists = await M.listsRoute.GET(request(`/api/admissions/lists?urn=${urn}`, "guy", asSchool(urn, "admissions")));
    assert.equal(lists.status, 200, `lists at ${urn}`);
    const lb = (await lists.json()) as { lists: unknown[] };
    assert.equal(lb.lists.length, urn === LEIGHTON ? 1 : 0);
  }
});

test("R-VIEW-AS-ANY-SCHOOL: saves are refused as read-only", async () => {
  const before = log.writes.length;
  const put = await M.listsRoute.PUT(request(`/api/admissions/lists?urn=${LEIGHTON}`, "guy", asSchool(LEIGHTON, "admissions"), { method: "PUT", body: { entryPoints: ["y7"] } }));
  assert.equal(put.status, 403);
  assert.deepEqual(await put.json(), { error: "View as: read-only" });
  const km = await M.catchmentRoute.PUT(request(`/api/smt/catchment?urn=${LEIGHTON}`, "guy", asSchool(LEIGHTON, "school_admin"), { method: "PUT", body: { km: 10 } }));
  assert.equal(km.status, 403);
  assert.deepEqual(await km.json(), { error: "View as: read-only" });
  assert.equal(log.writes.length, before, "nothing was written");
  // Its saved catchment is read through the server (the admin's RLS reads none), and can't be saved.
  const c = await M.smtCaller(request(`/api/smt/catchment?urn=${LEIGHTON}`, "guy", asSchool(LEIGHTON, "smt")), LEIGHTON);
  assert.ok(!(c instanceof Response));
  const { savedCatchmentKm } = await import("./smt/catchment-server");
  const { catchmentRights } = await import("./smt/catchment");
  assert.equal(await savedCatchmentKm(c, LEIGHTON), 12);
  assert.equal(catchmentRights(c).mayTrySave, false);
});

test("R-VIEW-AS-ANY-SCHOOL: a platform admin who is also a member is read-only while viewing their own school", async () => {
  admins.add("lp-head");
  try {
    const c = await M.smtCaller(request(`/api/smt/school?urn=${LEIGHTON}`, "lp-head", asSchool(LEIGHTON, "smt")), LEIGHTON);
    assert.ok(!(c instanceof Response));
    assert.equal(c.access, "viewAs");
    assert.equal(c.readOnly, true);
    const own = await M.smtCaller(request(`/api/smt/school?urn=${LEIGHTON}`, "lp-head"), LEIGHTON);
    assert.ok(!(own instanceof Response));
    assert.equal(own.access, "member", "without the cookie: their own membership, as before");
    assert.equal(own.readOnly, false);
  } finally {
    admins.delete("lp-head");
  }
});

test("every platform admin, not one user: a second admin gets the same View as", async () => {
  const c = await M.resolveCaller(request(`/api/teacher/phases?urn=${LEIGHTON}`, "second-admin", asSchool(LEIGHTON, "smt")), LEIGHTON, { refusal: "no", allowed: () => true });
  assert.ok(!(c instanceof Response));
  assert.equal(c.access, "viewAs");
  assert.equal(c.platformAdmin, true);
});

// ------------------------------------------------------------------ R-VIEW-AS-HEAD-OFFICE

test("R-VIEW-AS-HEAD-OFFICE: head office of Dukes, then Harris, through the same cookie", async () => {
  for (const i of [0, 1]) {
    const cookie = asGroup(i);
    assert.deepEqual(parseViewAsGroup(cookie), { accountId: groupAccounts[i].id, name: groupAccounts[i].display_name });
    assert.equal(parseViewAsCookie(cookie), null, "never a school View as at the same time: one cookie");
    const g = await M.groupCaller(request("/api/group/home", "guy", cookie));
    assert.ok(!(g instanceof Response));
    assert.equal(g.viewAs, true);
    assert.deepEqual(g.offices.map((o) => o.name), [groupAccounts[i].display_name]);
    // Anyone else's head-office cookie reads nothing.
    const other = await M.groupCaller(request("/api/group/home", "teacher", cookie));
    assert.ok(!(other instanceof Response));
    assert.equal(other.viewAs, false);
    assert.deepEqual(other.offices, []);
  }
  // groups r1's own cookie no longer means anything.
  const legacy = `${LEGACY_VIEW_AS_GROUP_COOKIE}=${encodeURIComponent(JSON.stringify({ a: groupAccounts[0].id, n: "x" }))}`;
  const g = await M.groupCaller(request("/api/group/home", "guy", legacy));
  assert.ok(!(g instanceof Response));
  assert.equal(g.viewAs, false);
});

// ------------------------------------------------------------------ R-VIEW-AS-ADMIN-ONLY

test("R-VIEW-AS-ADMIN-ONLY: the server refuses the cookie and a peek for a non-admin", async () => {
  // A Teacher at The Chase with a planted SMT View as of their own school: still a Teacher.
  const t = await M.resolveCaller(request(`/api/teacher/phases?urn=${CHASE}`, "teacher", asSchool(CHASE, "smt")), CHASE, { refusal: "no", allowed: () => true });
  assert.ok(!(t instanceof Response));
  assert.equal(t.access, "member");
  assert.deepEqual(t.roles, ["teacher"]);
  const s = await M.smtCaller(request(`/api/smt/school?urn=${CHASE}`, "teacher", asSchool(CHASE, "smt")), CHASE);
  assert.ok(s instanceof Response && s.status === 403);
  // A planted cookie (or ?peek=1) for another school: refused, as without it.
  const other = await M.callerRoute.GET(request(`/api/view-as/caller?urn=${LEIGHTON}&peek=1&lookAs=${LEIGHTON}&as=smt`, "teacher", asSchool(LEIGHTON, "smt")));
  assert.equal(other.status, 403);
  const adm = await M.admissionsCaller(request(`/api/admissions/pipeline?urn=${LEIGHTON}`, "teacher", asSchool(LEIGHTON, "admissions")), LEIGHTON);
  assert.ok(adm instanceof Response && adm.status === 403);
  // A platform admin with no View as there is a peek: read-only.
  const p = await M.resolveCaller(request(`/api/teacher/phases?urn=${LEIGHTON}&peek=1`, "guy"), LEIGHTON, { refusal: "no" });
  assert.ok(!(p instanceof Response));
  assert.equal(p.access, "peek");
  assert.equal(p.readOnly, true);
});

test("R-VIEW-AS-ADMIN-ONLY: a member's request costs no platform-admin call, and is decided as before", async () => {
  let rpcs = 0;
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input instanceof Request ? input.url : input).includes("rpc/is_platform_admin")) rpcs++;
    return real(input, init);
  }) as typeof fetch;
  try {
    const c = await M.resolveCaller(request(`/api/teacher/phases?urn=${CHASE}`, "multi"), CHASE, { refusal: "no", visibleRow: true });
    assert.ok(!(c instanceof Response));
    assert.equal(c.access, "member");
    const a = await M.admissionsCaller(request(`/api/admissions/pipeline?urn=${CHASE}`, "multi"), CHASE);
    assert.ok(!(a instanceof Response));
    assert.equal(a.lead, true);
    assert.equal(a.readOnly, false);
    assert.equal(rpcs, 0);
  } finally {
    globalThis.fetch = real;
  }
});

test("R-VIEW-AS-ADMIN-ONLY: View as elements live only in the admin-gated components", () => {
  // Every data-view-as element is drawn by the View as pill and panel (shown for a confirmed platform
  // admin, or while the cookie a platform admin set is present -- which the nav re-confirms, clearing it
  // for anyone else), the banner (the same), and the account menu's row (isPlatformAdminCached).
  const nav = src("components/shell/TeacherNav.tsx");
  const row = nav.slice(nav.indexOf("data-view-as-open") - 200, nav.indexOf("data-view-as-open"));
  assert.match(row, /\{staff && \(/, "the account menu's View as… is for platform admins only");
  const pill = src("components/view-as/ViewAs.tsx");
  assert.match(pill, /const shown = !!current \|\| !!currentGroup \|\| admin === true;/);
  assert.match(pill, /if \(current\) void resolveViewAs\(supabase\);/);
  // The footer and the SMT and Admissions messages draw no View as entry point any more.
  for (const f of ["../components/Footer.tsx", "../components/shell/EditSwitch.tsx", "../components/smt/SmtDashboard.tsx", "../components/admissions/AdmissionsDashboard.tsx"]) {
    assert.doesNotMatch(src(f.replace("../", "")), /openViewAs\(|FooterViewAs\b(?!\))|data-view-as-open/, f);
  }
});

// ------------------------------------------------------------------ R-ROLE-SWITCH

test("R-ROLE-SWITCH: a member with Teacher and Admissions gets the switch; a single-role member none; never in View as", async () => {
  const { lensesOf } = await import("../components/library/RoleHome");
  assert.deepEqual(lensesOf({ roles: ["teacher", "admissions"], role: "teacher", is_admin: false, isAccountHolder: false }), ["teacher", "admissions"]);
  assert.deepEqual(lensesOf({ roles: ["teacher"], role: "teacher", is_admin: false, isAccountHolder: false }), ["teacher"]);
  // School-Admin is not a role to switch to.
  assert.deepEqual(lensesOf({ roles: ["teacher"], role: "teacher", is_admin: true, isAccountHolder: false }), ["teacher"]);
  const nav = src("components/shell/RoleSwitch.tsx");
  assert.match(nav, /if \(!m \|\| m\.lenses\.length < 2\) return null;/, "drawn only with more than one role");
  assert.match(nav, /if \(getActiveViewAs\(\) \|\| viewAsGroupSnapshot\(\) \|\| search\.get\("peek"\) === "1"\) return null;/, "never in View as or a peek");
  // The /teacher home lost its own switch (it moved into the nav) and follows the nav's.
  const home = src("app/teacher/page.tsx");
  assert.doesNotMatch(home, /<LensSwitch/);
  assert.match(home, /LENS_EVENT/);
});

test("R-ROLE-SWITCH: the nav reads the member's own roles and schools, and nothing in View as", async () => {
  const jar = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); }, set cookie(_: string) {} };
  g.window = { location: { search: "", protocol: "https:", href: "http://app.test/teacher" }, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  jar.set(VIEW_AS_COOKIE, serializeViewAsCookie({ urn: LEIGHTON, role: "smt", schoolName: "Leighton Park" }));
  const { loadNavMember } = await import("../components/shell/RoleSwitch");
  assert.equal(await loadNavMember(), null, "in View as the nav draws no role switch and no school picker");
});

// ------------------------------------------------------------------ R-VIEW-AS-LOGGING

test("R-VIEW-AS-LOGGING: no usage events in View as; a member's own views still count", async () => {
  log.usage.length = 0;
  const report = { product: "smt", event: "page_view", urn: LEIGHTON, dashboard: "smt-overview" };
  assert.equal((await M.usageRoute.POST(request("/api/usage", "guy", asSchool(LEIGHTON, "smt"), { method: "POST", body: report }))).status, 204);
  assert.equal((await M.usageRoute.POST(request("/api/usage", "guy", undefined, { method: "POST", body: report }))).status, 204);
  assert.equal(log.usage.length, 0, "a platform admin's View as, or peek, is never the school's usage");
  await M.usageRoute.POST(request("/api/usage", "multi", undefined, { method: "POST", body: { ...report, product: "admissions", urn: CHASE } }));
  assert.equal(log.usage.length, 1);
  assert.equal(log.usage[0].membership_id, "m-multi");
  assert.equal(log.usage[0].role, "admissions");
});

test("R-VIEW-AS-LOGGING: one audit row per start or change (who, school, role, when)", async () => {
  const jar = new Map<string, string>();
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
  g.window = { location: { search: "", protocol: "https:" }, dispatchEvent: () => true, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  const { createClient } = await import("@supabase/supabase-js");
  const client = (uid: string) => createClient("http://supabase.test", "anon-key", { global: { headers: { Authorization: `Bearer tok-${uid}` } }, auth: { persistSession: false } });
  const { startViewAs, startViewAsHeadOffice, viewAsGroupSnapshot } = await import("./view-as");
  log.audit.length = 0;
  assert.equal((await startViewAs(client("guy"), { urn: LEIGHTON, role: "smt", fresh: false, schoolName: "Leighton Park" })).ok, true);
  assert.equal(log.audit.length, 1);
  assert.deepEqual({ ...log.audit[0] }, { action: "view_as", urn: LEIGHTON, detail: { role: "smt", fresh: false }, by: "guy" });
  // Change: the wrong-role message's "Switch to SMT", or the switcher.
  assert.equal((await startViewAs(client("guy"), { urn: LEIGHTON, role: "admissions", fresh: false, schoolName: "Leighton Park" })).ok, true);
  assert.equal(log.audit.length, 2);
  assert.equal(parseViewAsCookie(`${VIEW_AS_COOKIE}=${jar.get(VIEW_AS_COOKIE)}`)?.role, "admissions");
  // Head office: the same cookie, one row, and the school View as ends.
  assert.equal((await startViewAsHeadOffice(client("guy"), { accountId: groupAccounts[1].id, name: "Harris Federation", groupId: "3320" })).ok, true);
  assert.equal(log.audit.length, 3);
  assert.equal(log.audit[2].action, "view_as_group");
  assert.equal(parseViewAsCookie(`${VIEW_AS_COOKIE}=${jar.get(VIEW_AS_COOKIE)}`), null);
  assert.equal(viewAsGroupSnapshot()?.accountId, groupAccounts[1].id);
  // Nobody else can start one, and nothing is logged for them.
  assert.equal((await startViewAs(client("teacher"), { urn: LEIGHTON, role: "smt", fresh: false })).ok, false);
  assert.equal((await startViewAsHeadOffice(client("teacher"), { accountId: groupAccounts[0].id, name: "x" })).ok, false);
  assert.equal(log.audit.length, 3);
});

test("the scripted peek (?lookAs=&as=&peek=1): every product, platform admins only, read-only", async () => {
  const peekReq = (path: string, uid: string, q: string) => {
    const r = request(path, uid);
    r.headers.set(VA.PEEK_HEADER, q);
    return r;
  };
  const smt = await M.smtCaller(peekReq(`/api/smt/school?urn=${LEIGHTON}`, "guy", `peek=1&lookAs=${LEIGHTON}&as=smt`), LEIGHTON);
  assert.ok(!(smt instanceof Response));
  assert.equal(smt.access, "peek");
  assert.equal(smt.readOnly, true);
  const adm = await M.admissionsCaller(peekReq(`/api/admissions/pipeline?urn=${LEIGHTON}`, "guy", `peek=1&lookAs=${LEIGHTON}&as=admissions`), LEIGHTON);
  assert.ok(!(adm instanceof Response));
  assert.equal(adm.access, "peek");
  const asTeacher = await M.smtCaller(peekReq(`/api/smt/school?urn=${LEIGHTON}`, "guy", `peek=1&lookAs=${LEIGHTON}&as=teacher`), LEIGHTON);
  assert.ok(asTeacher instanceof Response && asTeacher.status === 403, "a peek as Teacher sees what a Teacher sees");
  const notAdmin = await M.smtCaller(peekReq(`/api/smt/school?urn=${LEIGHTON}`, "teacher", `peek=1&lookAs=${LEIGHTON}&as=smt`), LEIGHTON);
  assert.ok(notAdmin instanceof Response && notAdmin.status === 403, "anyone else's peek does nothing");
  const ho = await M.groupCaller(peekReq("/api/group/home", "guy", `peek=1&lookAs=${groupAccounts[1].id}&as=head_office`));
  assert.ok(!(ho instanceof Response));
  assert.equal(ho.viewAs, true);
  const hoOther = await M.groupCaller(peekReq("/api/group/home", "teacher", `peek=1&lookAs=${groupAccounts[1].id}&as=head_office`));
  assert.ok(!(hoOther instanceof Response));
  assert.equal(hoOther.viewAs, false);
  const before = log.usage.length;
  await M.usageRoute.POST((() => { const r = request("/api/usage", "guy", undefined, { method: "POST", body: { product: "smt", event: "page_view", urn: LEIGHTON } }); r.headers.set(VA.PEEK_HEADER, `peek=1&lookAs=${LEIGHTON}&as=smt`); return r; })());
  assert.equal(log.usage.length, before, "a peek is never logged");
});

