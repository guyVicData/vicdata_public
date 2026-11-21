// Run: node --import tsx --test --test-force-exit src/lib/devices/sign-out.test.ts
// R-SIGN-OUT-REVOKES (review pack 22 Nov, issue 5): Sign out signs THIS device out on the server under cookie
// sessions. signOutHere() sent the request with no session, the route answered 204 and did nothing, so every
// sign-out left a device "signed in" that counted towards the cap. The real route, over the memory store and a
// stand-in Supabase Auth (auth-testkit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { AUTH_URL, accessToken, installFakeAuth, session, sessionCookie, sidOf } from "../auth-testkit";
import { memoryDeviceStore } from "./store";
import { setDeviceStoreForTests } from "./http";

process.env.NEXT_PUBLIC_SUPABASE_URL = AUTH_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
installFakeAuth();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
let n = 0;

async function route(p: string, headers: Headers) {
  const r = await import(`../../app/api/auth/${p}/route`);
  return (await r.POST(new NextRequest(`http://app.test/api/auth/${p}`, { method: "POST", headers }))) as Response;
}

/** Signs in on a browser (the device route, as /login does), then signs out as `how`. */
async function signInAndOut(sub: string, how: "cookie" | "bearer" | "cross-site") {
  const sid = sidOf(`${sub}#${++n}`);
  const signIn = new Headers({ authorization: `Bearer ${accessToken(sub, sid)}`, "user-agent": UA });
  await route("device", signIn);
  const out = new Headers({ "user-agent": UA });
  if (how === "bearer") out.set("authorization", `Bearer ${accessToken(sub, sid)}`);
  else {
    out.set("cookie", sessionCookie(session(sub, { sid })));
    out.set("sec-fetch-site", how === "cookie" ? "same-origin" : "cross-site");
  }
  assert.equal((await route("sign-out", out)).status, 204);
  return sid;
}

test("R-SIGN-OUT-REVOKES: signing out three times (cookie session) leaves no extra active devices", async () => {
  const mem = memoryDeviceStore({ profiles: { t: { email: "t@school.org", createdAt: "2026-01-01T00:00:00Z" } } });
  setDeviceStoreForTests(mem.store);
  for (let i = 0; i < 3; i++) await signInAndOut("t", "cookie");
  assert.equal(mem.devices.filter((d) => d.profile_id === "t").length, 3, "three sign-ins, three device rows");
  assert.deepEqual(mem.devices.filter((d) => !d.signed_out_at), [], "none left signed in");
  assert.ok(mem.devices.every((d) => d.signed_out_reason === "here"));
  assert.equal(mem.revoked.length, 3, "each session ended at Supabase too");
});

test("R-SIGN-OUT-REVOKES: the Bearer header works too; a cross-site cookie never signs anyone out", async () => {
  const mem = memoryDeviceStore({ profiles: { t: { email: "t@school.org", createdAt: "2026-01-01T00:00:00Z" } } });
  setDeviceStoreForTests(mem.store);
  await signInAndOut("t", "bearer");
  assert.deepEqual(mem.devices.filter((d) => !d.signed_out_at), []);
  await signInAndOut("t", "cross-site");
  assert.equal(mem.devices.filter((d) => !d.signed_out_at).length, 1, "a cookie sent by another site is not the person");
});

test("R-SIGN-OUT-REVOKES: signOutHere sends the session (cookie and Bearer)", () => {
  const s = readFileSync(path.join(__dirname, "../sign-out.ts"), "utf8");
  assert.match(s, /credentials: "same-origin"/);
  assert.match(s, /Authorization: `Bearer \$\{token\}`/);
});
