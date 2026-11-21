// Run: node --import tsx --test --test-force-exit src/lib/auth-session.test.ts
// 0.8 front door part 3, milestone 1, R-COOKIE-SESSION: the session lives in a cookie the server can read; the
// proxy verifies it (locally, against the project's key), refreshes it when expired, and turns it into the
// Bearer header the API routes read, for the site's own requests only. Preview access mints a real session
// cookie on the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { AUTH_URL, accessToken, authLog, forgedToken, installFakeAuth, session, sessionCookie } from "./auth-testkit";
import { hasSessionCookie, isSessionCookie, sessionToBearer } from "./auth-cookies";

process.env.NEXT_PUBLIC_SUPABASE_URL = AUTH_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
installFakeAuth();
// Milestone 1 keeps the Basic Auth gate; these tests are about the session behind it.
process.env.ACCESS_GATE_ENABLED ??= "false";
const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

async function runProxy(path: string, headers: Record<string, string> = {}) {
  const { proxy } = await import("../proxy");
  return proxy(new NextRequest(`http://app.test${path}`, { headers }));
}
const injected = (res: Response) => res.headers.get("x-middleware-request-authorization");

test("R-COOKIE-SESSION: Supabase's session cookies are recognised, chunks included; the code verifier isn't a session", () => {
  assert.ok(isSessionCookie("sb-lnhulykjlxmoneappnsp-auth-token"));
  assert.ok(isSessionCookie("sb-lnhulykjlxmoneappnsp-auth-token.0"));
  assert.ok(!isSessionCookie("sb-lnhulykjlxmoneappnsp-auth-token-code-verifier"));
  assert.ok(!isSessionCookie("vicdata_view_as"));
  assert.ok(hasSessionCookie(["a", "sb-x-auth-token.1"]));
});

test("R-COOKIE-SESSION: only the site's own requests without a Bearer token get one from the cookie", () => {
  assert.equal(sessionToBearer(new Headers()), true);
  assert.equal(sessionToBearer(new Headers({ "sec-fetch-site": "same-origin" })), true);
  assert.equal(sessionToBearer(new Headers({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(sessionToBearer(new Headers({ "sec-fetch-site": "same-site" })), false);
  assert.equal(sessionToBearer(new Headers({ authorization: "Bearer abc" })), false);
  assert.equal(sessionToBearer(new Headers({ authorization: "Basic dTpw" })), true, "a cached Basic credential is not a session");
});

test("R-COOKIE-SESSION: the browser client keeps the session in a cookie (@supabase/ssr), not localStorage", () => {
  const s = src("src/lib/supabase.ts");
  assert.match(s, /createBrowserClient\(/);
  assert.match(s, /from "@supabase\/ssr"/);
  assert.match(s, /forgetLocalStorageSession/);
});

test("R-COOKIE-SESSION: an API call carrying only the cookie reaches the route with Bearer <its access token>", async () => {
  const s = session("teacher-1");
  const res = await runProxy("/api/teacher/phases?urn=110110", { cookie: sessionCookie(s), "sec-fetch-site": "same-origin" });
  assert.equal(injected(res), `Bearer ${s.access_token}`);
});

test("R-COOKIE-SESSION: a request that already sends Bearer is untouched (Bearer keeps working alongside the cookie)", async () => {
  const s = session("teacher-1");
  const res = await runProxy("/api/teacher/phases?urn=110110", { cookie: sessionCookie(s), authorization: "Bearer from-the-page" });
  assert.equal(injected(res), null);
});

test("R-COOKIE-SESSION: another site's request never acts as the user on the strength of the cookie", async () => {
  const res = await runProxy("/api/teacher/phases?urn=110110", { cookie: sessionCookie(session("teacher-1")), "sec-fetch-site": "cross-site" });
  assert.equal(injected(res), null);
});

test("R-COOKIE-SESSION: a forged cookie (a token the project's key didn't sign) is no session", async () => {
  const s = { ...session("intruder"), access_token: forgedToken("intruder") };
  const res = await runProxy("/api/teacher/phases?urn=110110", { cookie: sessionCookie(s) });
  assert.equal(injected(res), null);
});

test("R-COOKIE-SESSION: an expired access token is refreshed in the proxy and the new cookie goes out on the response", async () => {
  authLog.refreshes.length = 0;
  const s = session("teacher-2", { ttl: -60 });
  const res = await runProxy("/api/teacher/phases?urn=110110", { cookie: sessionCookie(s) });
  assert.deepEqual(authLog.refreshes, ["refresh-teacher-2"]);
  const sent = injected(res);
  assert.ok(sent && sent !== `Bearer ${s.access_token}`, "the refreshed token, not the expired one");
  assert.match(res.headers.get("set-cookie") ?? "", /sb-supabase-auth-token=base64-/);
  void accessToken;
});

// ------------------------------------------------------------------ preview access mints a real session cookie

test("R-COOKIE-SESSION: preview access is off by default and fails closed (404, byte for byte) without its secret", async () => {
  const { GET } = await import("../app/api/testing/preview-session/route");
  for (const k of ["PREVIEW_ACCESS_ENABLED", "PREVIEW_ACCESS_TOKEN", "PREVIEW_ACCESS_EMAIL", "PREVIEW_ACCESS_SITE_URL"]) delete process.env[k];
  const off = await GET(new NextRequest("http://app.test/api/testing/preview-session?token=x"));
  assert.equal(off.status, 404);
  Object.assign(process.env, { PREVIEW_ACCESS_ENABLED: "true", PREVIEW_ACCESS_TOKEN: "the-secret", PREVIEW_ACCESS_EMAIL: "preview@test", PREVIEW_ACCESS_SITE_URL: "https://vicdata.example" });
  const wrong = await GET(new NextRequest("http://app.test/api/testing/preview-session?token=not-it"));
  assert.equal(wrong.status, 404);
  assert.equal(await wrong.text(), "Not found");
  const none = await GET(new NextRequest("http://app.test/api/testing/preview-session"));
  assert.equal(none.status, 404);
});

test("R-COOKIE-SESSION: with its secret, preview access redeems a real magic link on the server and leaves a session cookie for its fixed account", async () => {
  Object.assign(process.env, { PREVIEW_ACCESS_ENABLED: "true", PREVIEW_ACCESS_TOKEN: "the-secret", PREVIEW_ACCESS_EMAIL: "preview@test", PREVIEW_ACCESS_SITE_URL: "https://vicdata.example" });
  const prev = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const u = new URL(req.url);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (u.pathname === "/auth/v1/admin/users") return json({ users: [{ id: "preview-user", email: "preview@test" }], aud: "authenticated" });
    if (u.pathname === "/auth/v1/admin/generate_link") {
      asked.push(((await req.json()) as { email: string }).email);
      return json({ action_link: "https://x.supabase.co/auth/v1/verify?token=t", hashed_token: "hash-preview-user", verification_type: "magiclink", id: "preview-user", email: "preview@test" });
    }
    if (u.pathname === "/rest/v1/school_memberships") return json([{ id: "m-1" }]);
    if (u.pathname === "/rest/v1/platform_admins") return json(null);
    return prev(input, init);
  }) as typeof fetch;
  try {
    const { GET } = await import("../app/api/testing/preview-session/route");
    const res = await GET(new NextRequest("http://app.test/api/testing/preview-session?token=the-secret&redirect=/teacher/smt"));
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://vicdata.example/teacher/smt", "to the configured site, never the request's origin");
    assert.deepEqual(asked, ["preview@test"]);
    assert.ok(authLog.otp.includes("hash-preview-user"), "redeemed with Supabase's own verifyOtp");
    const cookies = res.headers.getSetCookie();
    assert.ok(cookies.some((c) => /^sb-supabase-auth-token=base64-/.test(c)), "a real session cookie");
    // An open redirect would hand out a session: anything not a path on this origin falls back.
    const evil = await GET(new NextRequest("http://app.test/api/testing/preview-session?token=the-secret&redirect=//evil.example"));
    assert.equal(evil.headers.get("location"), "https://vicdata.example/teacher");
  } finally {
    globalThis.fetch = prev;
  }
});
