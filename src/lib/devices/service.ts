// 0.8 front door part 3 (E24; R-DEVICE-CODES, R-DEVICE-CAP): what happens when a session meets a device. Server-only.
// The routes (src/app/api/auth/*, the preview route) verify the session first and pass who it is; this decides and
// writes through a DeviceStore, so the tests run it over the memory store.
//
//   registerSignIn  a password (or preview, or join) sign-in arrives: find or make this browser's device row,
//                   bind the session to it, and either sign it in (trusted device, codes off, a brand-new
//                   account's first device, preview) or send a code and wait.
//   verifyDeviceCode / resendDeviceCode   the code step.
//   activate        signs the device in, then the cap signs out the oldest others.
//   signOutDevices  by the owner (here, one, all), the cap, a School-Admin or a platform admin: the row is marked
//                   and the Supabase session ended, so it can't be refreshed; the gate refuses it at once.
import { CODE_MINUTES, type AccountKind } from "./config";
import {
  capNotice, capVictims, checkCode, codeExpiry, codeHash, describeDevice, isSignedIn, mayResend, maskEmail, newCode,
  newDeviceToken, signInNeed, tokenHash, trustUntil, CODE_WORDS, type DeviceRow, type SignOutReason,
} from "./core";
import type { CodeMailer } from "./mailer";
import type { DeviceStore } from "./store";
import { forgetSessions } from "./gate";

export type RegisterInput = {
  userId: string;
  sessionId: string;
  email: string | null;
  /** The browser's device cookie, if it has one. */
  token: string | null;
  userAgent: string | null;
  place: string | null;
  /** Forced kind (the preview route); otherwise platform admin or staff. */
  kind?: AccountKind;
  codesOn: boolean;
  now: Date;
};

export type RegisterResult =
  | { next: "home"; token: string; deviceId: string; notice: string | null }
  | { next: "code"; token: string; deviceId: string; sentTo: string; sent: boolean; message: string | null }
  | { next: "error"; token: string | null; message: string };

const COULDNT_SEND = "We couldn't send a code just now. Try again in a minute.";
const ENDED = "This sign-in has ended. Sign in again.";

export async function registerSignIn(store: DeviceStore, mailer: CodeMailer, o: RegisterInput): Promise<RegisterResult> {
  // A session whose device was signed out (by its owner, the cap, a School-Admin, VicData) is over: its access token
  // may still be unexpired, but it never signs a device in again. Found by hand: a capped browser came straight back.
  const bound = await store.deviceBySession(o.sessionId);
  if (bound?.signed_out_at) return { next: "error", token: o.token, message: ENDED };
  const kind: AccountKind = o.kind ?? ((await store.isPlatformAdmin(o.userId)) ? "platform_admin" : "staff");
  let token = o.token;
  let device = token ? await store.deviceByToken(tokenHash(token)) : null;
  // A browser another person signed in on before: this person gets their own device (a new cookie).
  if (device && device.profile_id !== o.userId) {
    device = null;
    token = null;
  }
  token ??= newDeviceToken();
  const info = describeDevice(o.userAgent);
  const [devices, profile] = await Promise.all([store.devicesOf(o.userId), store.profile(o.userId)]);
  const need = signInNeed({ codesOn: o.codesOn, kind, device, accountCreatedAt: profile?.createdAt ?? null, accountHasDevices: devices.length > 0, now: o.now });
  const fields = { account_kind: kind, label: info.label, browser: info.browser, os: info.os, form: info.form, place: o.place, session_id: o.sessionId, last_active_at: o.now.toISOString() };

  if (!device) device = await store.insertDevice({ profile_id: o.userId, token_hash: tokenHash(token), ...fields, signed_in_at: null });
  else if (!(isSignedIn(device) && device.session_id === o.sessionId)) await store.updateDevice(device.id, { ...fields, signed_in_at: null, signed_out_at: null, signed_out_reason: null });
  await store.releaseSession(o.sessionId, device.id);

  // Already signed in here with this very session (a second call): nothing more to do.
  if (isSignedIn(device) && device.session_id === o.sessionId) return { next: "home", token, deviceId: device.id, notice: null };

  if (!need.code) {
    const notice = await activate(store, { ...device, ...fields }, kind, o.now, o.place, null);
    return { next: "home", token, deviceId: device.id, notice };
  }
  const sentTo = maskEmail(o.email ?? profile?.email);
  // A code already on its way and still good: don't send another on a reload.
  const recent = await store.codesOf(device.id, new Date(o.now.getTime() - 3_600_000).toISOString());
  const live = recent.find((c) => !c.consumed_at && new Date(c.expires_at) > o.now && c.attempts < 5);
  if (live) return { next: "code", token, deviceId: device.id, sentTo, sent: true, message: null };
  const sent = await sendCode(store, mailer, device.id, o.userId, o.email ?? profile?.email ?? null, o.now);
  return { next: "code", token, deviceId: device.id, sentTo, sent, message: sent ? null : COULDNT_SEND };
}

async function sendCode(store: DeviceStore, mailer: CodeMailer, deviceId: string, userId: string, email: string | null, now: Date): Promise<boolean> {
  if (!email || !mailer.configured) return false;
  const code = newCode();
  await store.insertCode({ device_id: deviceId, profile_id: userId, code_hash: codeHash(deviceId, code), expires_at: codeExpiry(now), created_at: now.toISOString() });
  return mailer.send(email, code);
}

/** The device this browser's cookie names, waiting for a code under this very session -- or null. */
async function pendingDevice(store: DeviceStore, o: { userId: string; sessionId: string; token: string | null }): Promise<DeviceRow | null> {
  if (!o.token) return null;
  const d = await store.deviceByToken(tokenHash(o.token));
  return d && d.profile_id === o.userId && d.session_id === o.sessionId && !d.signed_out_at ? d : null;
}

export type CodeResult = { ok: true; notice: string | null } | { ok: false; message: string; attemptsLeft: number };

export async function verifyDeviceCode(store: DeviceStore, o: { userId: string; sessionId: string; token: string | null; code: string; place: string | null; now: Date }): Promise<CodeResult> {
  const device = await pendingDevice(store, o);
  if (!device) return { ok: false, message: "Sign in again to get a code.", attemptsLeft: 0 };
  const [latest] = await store.codesOf(device.id, new Date(o.now.getTime() - (CODE_MINUTES + 60) * 60_000).toISOString());
  const check = checkCode(latest ?? null, o.code, o.now);
  if (!check.ok) {
    if (latest && (check.reason === "wrong" || check.reason === "too_many") && latest.attempts < 5) await store.updateCode(latest.id, { attempts: latest.attempts + 1 });
    return { ok: false, message: check.reason === "wrong" ? `${CODE_WORDS.wrong} ${check.attemptsLeft} ${check.attemptsLeft === 1 ? "try" : "tries"} left.` : CODE_WORDS[check.reason], attemptsLeft: check.attemptsLeft };
  }
  await store.updateCode(latest!.id, { consumed_at: o.now.toISOString() });
  const notice = await activate(store, device, device.account_kind, o.now, o.place, trustUntil(o.now));
  return { ok: true, notice };
}

export async function resendDeviceCode(store: DeviceStore, mailer: CodeMailer, o: { userId: string; sessionId: string; token: string | null; email: string | null; now: Date }): Promise<{ ok: boolean; message: string }> {
  const device = await pendingDevice(store, o);
  if (!device) return { ok: false, message: "Sign in again to get a code." };
  const recent = await store.codesOf(device.id, new Date(o.now.getTime() - 3_600_000).toISOString());
  const may = mayResend(recent, o.now);
  if (!may.ok) return { ok: false, message: `You can ask for another code in ${may.waitSeconds} seconds.` };
  // A new code ends the old one.
  for (const c of recent) if (!c.consumed_at) await store.updateCode(c.id, { consumed_at: o.now.toISOString() });
  const sent = await sendCode(store, mailer, device.id, o.userId, o.email, o.now);
  return sent ? { ok: true, message: `We've sent a new code to ${maskEmail(o.email)}.` } : { ok: false, message: COULDNT_SEND };
}

/** Signs the device in (trusted until `trusted`, when a code was just passed), records the sign-in, then signs
 * out the oldest others over the cap. Returns the one-line notice for the next page, or null. */
export async function activate(store: DeviceStore, device: DeviceRow, kind: AccountKind, now: Date, place: string | null, trusted: string | null): Promise<string | null> {
  const iso = now.toISOString();
  await store.updateDevice(device.id, { signed_in_at: iso, signed_out_at: null, signed_out_reason: null, last_active_at: iso, ...(trusted ? { trusted_until: trusted } : {}) });
  await store.addSignIn(device.profile_id, device.id, place, iso);
  const all = (await store.devicesOf(device.profile_id)).map((d) => (d.id === device.id ? { ...d, signed_in_at: iso, signed_out_at: null } : d));
  const victims = capVictims(all, device.id, kind);
  await signOutDevices(store, victims, "cap", now);
  return victims.length ? capNotice(victims.map((v) => v.label), kind) : null;
}

/** Signs devices out: marks each row and ends its Supabase session. Returns the session ids ended (the gate's
 * cache forgets them at once). */
export async function signOutDevices(store: DeviceStore, devices: DeviceRow[], reason: SignOutReason, now: Date): Promise<string[]> {
  const ended: string[] = [];
  for (const d of devices) {
    if (d.signed_out_at) continue;
    await store.updateDevice(d.id, { signed_out_at: now.toISOString(), signed_out_reason: reason });
    if (d.session_id) {
      try {
        await store.revokeSession(d.session_id);
      } catch (e) {
        // The row is signed out, so the gate refuses the session anyway; the refresh token outlives it.
        console.error("[devices] could not end a session:", (e as Error).message);
      }
      ended.push(d.session_id);
    }
  }
  // The gate forgets them at once, whichever route signed them out (found by hand: the cap's victims were
  // remembered as signed in for up to GATE_CACHE_SECONDS).
  forgetSessions(ended);
  return ended;
}
