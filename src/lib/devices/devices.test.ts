// Run: node --import tsx --test --test-force-exit src/lib/devices/devices.test.ts
// 0.8 front door part 3, milestone 3 (E24): R-DEVICE-CODES (a device VicData hasn't seen asks for a 6-digit code,
// behind DEVICE_CODES) and R-DEVICE-CAP (signing in on one more device signs out the oldest). The real routes and the
// real proxy, over the memory store and a stand-in Supabase Auth; the code email is caught at Resend's address.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { AUTH_URL, accessToken, endedSessions, gateRows, installFakeAuth, session, sessionCookie, sidOf } from "../auth-testkit";
import { memoryDeviceStore } from "./store";
import { setDeviceStoreForTests } from "./http";
import { forgetSessions } from "./gate";
import { capVictims, checkCode, codeHash, describeDevice, flaggedAccounts, placeFrom, signInNeed, type DeviceRow } from "./core";
import { DEVICE_CAP } from "./config";

process.env.NEXT_PUBLIC_SUPABASE_URL = AUTH_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
installFakeAuth();

// The code email, caught where Resend would get it.
const mail: { to: string; code: string }[] = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (u === "https://api.resend.com/emails") {
    const b = JSON.parse(String(init?.body)) as { to: string[]; subject: string };
    mail.push({ to: b.to[0], code: /^(\d{6}) /.exec(b.subject)![1] });
    return new Response("{}", { status: 200 });
  }
  return prevFetch(input, init);
}) as typeof fetch;

const OLD = "2026-01-01T00:00:00Z"; // an account made long ago
let mem = memoryDeviceStore();
function fresh(profiles: Record<string, { email: string; createdAt: string }> = {}, platformAdmins: string[] = []) {
  mem = memoryDeviceStore({ profiles, platformAdmins });
  setDeviceStoreForTests(mem.store);
  mail.length = 0;
  gateRows.clear();
}
beforeEach(() => {
  delete process.env.DEVICE_CODES;
  delete process.env.DEVICE_SESSIONS;
  process.env.RESEND_API_KEY = "re_test";
  process.env.DEVICE_CODE_FROM = "VicData <signin@vicdata.example>";
});

type Browser = { cookie: string; ua: string };
const ua = { mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36", iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0", linux: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0" };

/** Calls a route as `sub` in session `sid` from a browser holding `device` (its cookie, if any). */
async function call(path: string, sub: string, sid: string, b: Browser, body?: unknown) {
  const route = await import(`../../app/api/auth/${path}/route`);
  const headers = new Headers({ authorization: `Bearer ${accessToken(sub, sid)}`, "user-agent": b.ua, "cf-ipcity": "Reading", "cf-ipcountry": "GB" });
  if (b.cookie) headers.set("cookie", b.cookie);
  const req = new NextRequest(`http://app.test/api/auth/${path}`, { method: body === undefined && path === "devices" ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const res: Response = body === undefined && path === "devices" ? await route.GET(req) : await route.POST(req);
  const set = res.headers.getSetCookie?.() ?? [];
  const dev = set.find((c) => c.startsWith("vicdata_device="));
  if (dev) b.cookie = dev.split(";")[0];
  return { status: res.status, json: await res.json().catch(() => null), set };
}
const browser = (k: keyof typeof ua): Browser => ({ cookie: "", ua: ua[k] });
// Each sign-in is a new Supabase session.
let n = 0;
const newSid = (sub: string) => sidOf(`${sub}#${++n}`);

/** The proxy's answer for a page or API request in this session (the gate reads the real device rows). */
async function gate(path: string, sub: string, sid: string) {
  const { proxy } = await import("../../proxy");
  const s = { ...session(sub, { sid }) };
  forgetSessions([sid]);
  const d = mem.devices.find((x) => x.session_id === sid);
  gateRows.set(sid, d ? { id: d.id, profile_id: d.profile_id, signed_in_at: d.signed_in_at, signed_out_at: d.signed_out_at, signed_out_reason: d.signed_out_reason, last_active_at: d.last_active_at, place: d.place } : null);
  const res = await proxy(new NextRequest(`http://app.test${path}`, { headers: { cookie: sessionCookie(s) } }));
  return { status: res.status, location: res.headers.get("location"), passed: res.headers.get("x-middleware-next") === "1", cleared: res.headers.getSetCookie().some((c) => /^sb-supabase-auth-token=;/.test(c)) };
}

// ------------------------------------------------------------------ R-DEVICE-CODES

test("R-DEVICE-CODES: off by default (Q5) -- a new device signs straight in, no code, no email", async () => {
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const b = browser("mac");
  const sid = newSid("t");
  const r = await call("device", "t", sid, b);
  assert.equal(r.json.next, "home");
  assert.equal(mail.length, 0);
  assert.ok(r.set.some((c) => /^vicdata_device=.+HttpOnly/i.test(c)), "the device cookie is httpOnly");
  assert.ok((await gate("/teacher", "t", sid)).passed);
});

test("R-DEVICE-CODES: on, a device VicData hasn't seen asks for a 6-digit code after the password, and waits for it", async () => {
  process.env.DEVICE_CODES = "on";
  fresh({ t: { email: "t@test", createdAt: OLD } });
  const b = browser("mac");
  const sid = newSid("t");
  const r = await call("device", "t", sid, b);
  assert.equal(r.json.next, "code");
  // To the account's own address (the session's), masked on screen.
  assert.equal(r.json.sentTo, "t•••@test");
  assert.equal(mail.length, 1);
  assert.match(mail[0].code, /^\d{6}$/);
  assert.equal(mail[0].to, "t@test");
  // Stored hashed and bound to the device, never as the code.
  assert.equal(mem.codes.length, 1);
  assert.notEqual(mem.codes[0].code_hash, mail[0].code);
  assert.equal(mem.codes[0].code_hash, codeHash(mem.codes[0].device_id, mail[0].code));
  assert.notEqual(codeHash("another-device", mail[0].code), mem.codes[0].code_hash);
  // Until the code: pages go to /login to finish, the API is closed but the auth routes.
  const page = await gate("/teacher/smt", "t", sid);
  assert.equal(page.location, "http://app.test/login?step=device");
  assert.equal((await gate("/api/teacher/phases?urn=1", "t", sid)).status, 401);
  assert.ok((await gate("/api/auth/device/code", "t", sid)).passed);
  assert.ok((await gate("/login", "t", sid)).passed);
  // A reload asks again without sending a second email.
  assert.equal((await call("device", "t", sid, b)).json.next, "code");
  assert.equal(mail.length, 1);
});

test("R-DEVICE-CODES: the right code trusts the device for 60 days and signs it in; the next sign-in there needs none", async () => {
  process.env.DEVICE_CODES = "on";
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const b = browser("mac");
  const sid = newSid("t");
  await call("device", "t", sid, b);
  const ok = await call("device/code", "t", sid, b, { code: mail[0].code });
  assert.equal(ok.json.ok, true);
  const d = mem.devices[0];
  const days = (new Date(d.trusted_until!).getTime() - Date.now()) / 86_400_000;
  assert.ok(days > 59.9 && days <= 60, `trusted for 60 days (${days})`);
  assert.ok((await gate("/teacher", "t", sid)).passed);
  // Signing in again later on the same browser: a new session, no code.
  const sid2 = newSid("t");
  const again = await call("device", "t", sid2, b);
  assert.equal(again.json.next, "home");
  assert.equal(mail.length, 1);
  assert.equal(mem.devices.length, 1, "the same device row");
  // After 60 days, a code again.
  mem.devices[0].trusted_until = new Date(Date.now() - 1000).toISOString();
  assert.equal((await call("device", "t", newSid("t"), b)).json.next, "code");
});

test("R-DEVICE-CODES: wrong codes cost a try (5 in all), an expired code is refused, a used one too", async () => {
  process.env.DEVICE_CODES = "on";
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const b = browser("mac");
  const sid = newSid("t");
  await call("device", "t", sid, b);
  const wrong = mail[0].code === "000000" ? "111111" : "000000";
  const first = await call("device/code", "t", sid, b, { code: wrong });
  assert.equal(first.status, 400);
  assert.match(first.json.error, /4 tries left/);
  for (let i = 0; i < 3; i++) await call("device/code", "t", sid, b, { code: wrong });
  const fifth = await call("device/code", "t", sid, b, { code: wrong });
  assert.match(fifth.json.error, /Too many wrong tries/);
  const late = await call("device/code", "t", sid, b, { code: mail[0].code });
  assert.equal(late.json.ok, false, "even the right code, after five wrong ones");
  assert.ok(!mem.devices[0].signed_in_at);
  // Expired.
  const row = { id: "c", device_id: "d", profile_id: "t", code_hash: codeHash("d", "123456"), expires_at: new Date(Date.now() - 1).toISOString(), attempts: 0, consumed_at: null, created_at: new Date().toISOString() };
  assert.deepEqual(checkCode(row, "123456", new Date()), { ok: false, reason: "expired", attemptsLeft: 0 });
  assert.deepEqual(checkCode({ ...row, expires_at: new Date(Date.now() + 60_000).toISOString() }, "123456", new Date()), { ok: true });
  assert.equal(checkCode({ ...row, expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: new Date().toISOString() }, "123456", new Date()).ok, false);
});

test("R-DEVICE-CODES: a new code no sooner than a minute after the last; the new one ends the old", async () => {
  process.env.DEVICE_CODES = "on";
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const b = browser("mac");
  const sid = newSid("t");
  await call("device", "t", sid, b);
  const soon = await call("device/resend", "t", sid, b, {});
  assert.equal(soon.status, 429);
  assert.match(soon.json.message, /in \d+ seconds/);
  mem.codes[0].created_at = new Date(Date.now() - 61_000).toISOString();
  const again = await call("device/resend", "t", sid, b, {});
  assert.equal(again.json.ok, true);
  assert.equal(mail.length, 2);
  assert.equal((await call("device/code", "t", sid, b, { code: mail[0].code })).json.ok, mail[0].code === mail[1].code, "the old code is dead");
  assert.equal((await call("device/code", "t", sid, b, { code: mail[1].code })).json.ok, true);
});

test("R-DEVICE-CODES: no code for a brand-new account's first device, nor the preview account; codes on and no mailer fails closed", async () => {
  process.env.DEVICE_CODES = "on";
  const now = new Date();
  assert.deepEqual(signInNeed({ codesOn: true, kind: "staff", device: null, accountCreatedAt: new Date(now.getTime() - 5 * 60_000).toISOString(), accountHasDevices: false, now }), { code: false, why: "new_account" });
  assert.deepEqual(signInNeed({ codesOn: true, kind: "staff", device: null, accountCreatedAt: new Date(now.getTime() - 5 * 60_000).toISOString(), accountHasDevices: true, now }), { code: true });
  assert.deepEqual(signInNeed({ codesOn: true, kind: "preview", device: null, accountCreatedAt: OLD, accountHasDevices: true, now }), { code: false, why: "preview" });
  fresh({ fresh: { email: "new@school.org", createdAt: new Date().toISOString() } });
  assert.equal((await call("device", "fresh", newSid("fresh"), browser("mac"))).json.next, "home", "joined a minute ago: in");
  delete process.env.RESEND_API_KEY;
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const sid = newSid("t");
  const r = await call("device", "t", sid, browser("mac"));
  assert.equal(r.json.next, "code");
  assert.equal(r.json.sent, false);
  assert.match(r.json.message, /couldn't send a code/);
  assert.equal((await gate("/teacher", "t", sid)).location, "http://app.test/login?step=device", "and not signed in");
});

test("R-DEVICE-CODES: what a device is and where, roughly (city at most; never the IP)", () => {
  assert.deepEqual(describeDevice(ua.mac), { label: "Chrome on Mac", browser: "Chrome", os: "Mac", form: "desktop" });
  assert.deepEqual(describeDevice(ua.iphone), { label: "Safari on iPhone", browser: "Safari", os: "iPhone", form: "phone" });
  assert.equal(describeDevice(ua.win).label, "Edge on Windows");
  assert.equal(describeDevice(ua.linux).label, "Firefox on Linux");
  assert.equal(describeDevice(null).label, "A browser");
  assert.equal(placeFrom(new Headers({ "cf-ipcity": "Reading", "cf-ipcountry": "GB", "cf-connecting-ip": "203.0.113.9" })), "Reading, UK");
  assert.equal(placeFrom(new Headers({ "cf-ipcountry": "FR" })), "France");
  assert.equal(placeFrom(new Headers({ "x-forwarded-for": "203.0.113.9" })), null);
});

// ------------------------------------------------------------------ R-DEVICE-CAP

function row(id: string, at: string, extra: Partial<DeviceRow> = {}): DeviceRow {
  return { id, profile_id: "p", token_hash: id.padEnd(64, "0"), account_kind: "staff", label: id, browser: null, os: null, form: null, place: null, session_id: `s-${id}`, trusted_until: null, signed_in_at: at, last_active_at: at, signed_out_at: null, signed_out_reason: null, created_at: at, ...extra };
}

test("R-DEVICE-CAP: one constant per kind of account -- staff 3", () => {
  assert.equal(DEVICE_CAP.staff, 3);
  const three = [row("a", "2026-11-01"), row("b", "2026-11-02"), row("c", "2026-11-03")];
  assert.deepEqual(capVictims([...three, row("new", "2026-11-04")], "new", "staff").map((d) => d.id), ["a"]);
  assert.deepEqual(capVictims([row("a", "2026-11-01"), row("b", "2026-11-02"), row("new", "2026-11-04")], "new", "staff"), []);
  assert.deepEqual(capVictims([...three, row("x", "2026-10-01", { signed_out_at: "2026-10-02" }), row("new", "2026-11-04")], "new", "staff").map((d) => d.id), ["a"], "a signed-out device doesn't count");
  assert.equal(capVictims([...three, row("d", "2026-11-04"), row("new", "2026-11-05")], "new", "platform_admin").length, 0);
});

test("R-DEVICE-CAP: signing in on a 4th device signs out the oldest, ends its session, says so on the next page, and that device is signed out", async () => {
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const sids: string[] = [];
  const browsers = [browser("mac"), browser("iphone"), browser("win"), browser("linux")];
  for (let i = 0; i < 3; i++) {
    sids.push(newSid("t"));
    assert.equal((await call("device", "t", sids[i], browsers[i])).json.next, "home");
    await new Promise((r) => setTimeout(r, 5));
  }
  // The gate has the oldest remembered as signed in (as it would, mid-browsing).
  const { deviceGateState } = await import("./gate");
  const asGate = (d: DeviceRow) => ({ id: d.id, profile_id: d.profile_id, signed_in_at: d.signed_in_at, signed_out_at: d.signed_out_at, signed_out_reason: d.signed_out_reason, last_active_at: d.last_active_at, place: d.place });
  forgetSessions([sids[0]]);
  gateRows.set(sids[0], asGate(mem.devices.find((d) => d.session_id === sids[0])!));
  assert.equal((await deviceGateState(sids[0], "t")).state, "in");
  sids.push(newSid("t"));
  const fourth = await call("device", "t", sids[3], browsers[3]);
  assert.equal(fourth.json.next, "home");
  const notice = fourth.set.find((c) => c.startsWith("vicdata_notice="));
  assert.ok(notice && decodeURIComponent(notice.split(";")[0].split("=")[1]).includes("signed you out on Chrome on Mac"), notice);
  const mac = mem.devices.find((d) => d.label === "Chrome on Mac")!;
  assert.equal(mac.signed_out_reason, "cap");
  assert.deepEqual(mem.revoked, [sids[0]], "its Supabase session is ended");
  assert.equal(mem.devices.filter((d) => d.signed_in_at && !d.signed_out_at).length, 3);
  // The cap makes the gate forget it, so there is no window (the row now says signed out).
  gateRows.set(sids[0], asGate(mac));
  assert.equal((await deviceGateState(sids[0], "t")).state, "revoked", "seen at once, not after the gate's 30 seconds");
  // The oldest's next request: signed out, cookies cleared, told why.
  const g = await gate("/teacher", "t", sids[0]);
  assert.equal(g.location, "http://app.test/login?signedOut=cap");
  assert.ok(g.cleared);
  assert.equal((await gate("/api/teacher/phases", "t", sids[0])).status, 401);
  assert.ok((await gate("/teacher", "t", sids[3])).passed);
});

test("R-DEVICE-CAP: a signed-out session can't sign itself back in -- not by its device row, not once Supabase has ended it", async () => {
  fresh({ t: { email: "t@school.org", createdAt: OLD } });
  const sids: string[] = [];
  const browsers = [browser("mac"), browser("iphone"), browser("win"), browser("linux")];
  for (let i = 0; i < 4; i++) {
    sids.push(newSid("t"));
    await call("device", "t", sids[i], browsers[i]);
    await new Promise((r) => setTimeout(r, 5));
  }
  // The capped Mac's token is still unexpired: the device route refuses it (its row says signed out).
  const back = await call("device", "t", sids[0], browsers[0]);
  assert.equal(back.status, 401);
  assert.match(back.json.error, /sign-in has ended/);
  assert.equal(mem.devices.find((d) => d.label === "Chrome on Mac")!.signed_out_reason, "cap", "still signed out");
  // Supabase ended the session (revoke_auth_session): every auth route refuses its token outright, even on a
  // browser with no row for it.
  endedSessions.add(sids[0]);
  assert.equal((await call("device", "t", sids[0], browser("mac"))).status, 401);
  assert.equal((await call("devices", "t", sids[0], browser("mac"))).status, 401);
  endedSessions.clear();
});

test("R-DEVICE-CAP: \"Where you're signed in\" -- the person's own devices, one signed out, then all", async () => {
  fresh({ t: { email: "t@school.org", createdAt: OLD }, u: { email: "u@school.org", createdAt: OLD } });
  const a = browser("mac"), b = browser("iphone"), other = browser("win");
  const sa = newSid("t"), sb = newSid("t"), su = newSid("u");
  await call("device", "t", sa, a);
  await call("device", "t", sb, b);
  await call("device", "u", su, other);
  const list = await call("devices", "t", sa, a);
  assert.deepEqual(list.json.devices.map((d: { label: string; current: boolean; lastActive: string }) => [d.label, d.current, d.lastActive]), [["Chrome on Mac", true, "This device"], ["Safari on iPhone", false, "Active now"]]);
  assert.equal(list.json.devices[0].place, "Reading, UK");
  const uDevice = mem.devices.find((d) => d.profile_id === "u")!;
  assert.equal((await call("devices", "t", sa, a, { action: "sign_out", id: uDevice.id })).status, 404, "never someone else's");
  const phone = mem.devices.find((d) => d.label === "Safari on iPhone")!;
  assert.equal((await call("devices", "t", sa, a, { action: "sign_out", id: phone.id })).json.signedOutHere, false);
  assert.equal(phone.signed_out_reason, "elsewhere");
  assert.equal((await gate("/teacher", "t", sb)).location, "http://app.test/login?signedOut=elsewhere");
  const all = await call("devices", "t", sa, a, { action: "sign_out_all" });
  assert.equal(all.json.signedOutHere, true);
  assert.ok(mem.devices.filter((d) => d.profile_id === "t").every((d) => d.signed_out_at));
  assert.ok(!uDevice.signed_out_at, "another person's devices untouched");
});

test("R-DEVICE-CAP: a device with no row (a session from before milestone 3, or made outside the app) must finish signing in; DEVICE_SESSIONS=off is the emergency switch", async () => {
  fresh();
  const sid = newSid("ghost");
  const g = await gate("/teacher", "ghost", sid);
  assert.equal(g.location, "http://app.test/login?step=device");
  process.env.DEVICE_SESSIONS = "off";
  assert.ok((await gate("/teacher", "ghost", sid)).passed);
});

// ------------------------------------------------------------------ the quiet alert (R-SIGNINS-RLS's page shows it)

test("R-SIGNINS-RLS: an account used from more than 4 places in 24 hours is flagged; older or repeated places don't count", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const ev = (p: string, place: string, hoursAgo: number) => ({ profile_id: p, place, at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString() });
  const events = [
    ...["Reading", "Leeds", "York", "Bath", "Hull"].map((c, i) => ev("busy", c, i)),
    ...["Reading", "Leeds", "York", "Bath"].map((c, i) => ev("four", c, i)),
    ev("four", "Reading", 2),
    ...["Reading", "Leeds", "York", "Bath"].map((c, i) => ev("old", c, i)),
    ev("old", "Hull", 30),
  ];
  assert.deepEqual(flaggedAccounts(events, now), [{ profileId: "busy", places: ["Bath", "Hull", "Leeds", "Reading", "York"] }]);
});
