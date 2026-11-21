// 0.8 front door part 3 (E24): the device rules, pure. What a browser is ("Chrome on Mac"), where it roughly is,
// who the cap signs out, whether a sign-in needs a code, codes and their checks, and which accounts are flagged.
// No I/O: the store (store.ts) and the routes do that. Unit-tested in devices.test.ts.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { CODE_MAX_ATTEMPTS, CODE_MAX_PER_HOUR, CODE_MINUTES, CODE_RESEND_SECONDS, DEVICE_CAP, NEW_ACCOUNT_MINUTES, PLACES_ALERT, TRUST_DAYS, type AccountKind } from "./config";

export type DeviceRow = {
  id: string;
  profile_id: string;
  token_hash: string;
  account_kind: AccountKind;
  label: string;
  browser: string | null;
  os: string | null;
  form: "desktop" | "phone" | "tablet" | null;
  place: string | null;
  session_id: string | null;
  trusted_until: string | null;
  signed_in_at: string | null;
  last_active_at: string;
  signed_out_at: string | null;
  signed_out_reason: SignOutReason | null;
  created_at: string;
};
export type SignOutReason = "here" | "elsewhere" | "all" | "cap" | "admin" | "platform";
export type CodeRow = { id: string; device_id: string; profile_id: string; code_hash: string; expires_at: string; attempts: number; consumed_at: string | null; created_at: string };

// ------------------------------------------------------------------ what the browser is, and where

export type DeviceInfo = { label: string; browser: string | null; os: string | null; form: "desktop" | "phone" | "tablet" };

/** "Chrome on Mac", "Safari on iPhone"… from the User-Agent. Coarse on purpose: enough to recognise your own. */
export function describeDevice(ua: string | null): DeviceInfo {
  const s = ua ?? "";
  const os = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android" : /CrOS/.test(s) ? "Chromebook" : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : null;
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /Firefox\/|FxiOS/.test(s) ? "Firefox" : /SamsungBrowser/.test(s) ? "Samsung Internet" : /Chrome\/|CriOS/.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : null;
  const form = os === "iPad" || (/Android/.test(s) && !/Mobile/.test(s)) ? "tablet" : os === "iPhone" || /Mobile/.test(s) ? "phone" : "desktop";
  const label = browser && os ? `${browser} on ${os}` : browser ?? (os ? `A browser on ${os}` : "A browser");
  return { label, browser, os, form };
}

export { placeFrom } from "./place";

// ------------------------------------------------------------------ tokens and codes

export const newDeviceToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A 6-digit code, uniformly random. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

const codeKey = () => process.env.DEVICE_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
/** The stored form of a code: HMAC-SHA256 keyed by a server secret and bound to its device, so a leaked table
 * row can't be brute-forced offline or replayed on another device. */
export function codeHash(deviceId: string, code: string): string {
  const key = codeKey();
  if (!key) throw new Error("No secret to hash device codes with (DEVICE_CODE_SECRET or SUPABASE_SERVICE_ROLE_KEY)");
  return createHmac("sha256", key).update(`${deviceId}:${code}`).digest("hex");
}

export type CodeCheck = { ok: true } | { ok: false; reason: "none" | "expired" | "used" | "too_many" | "wrong"; attemptsLeft: number };

/** Checks a typed code against the device's latest code. A wrong code costs a try; the fifth wrong try ends it. */
export function checkCode(row: CodeRow | null, typed: string, now: Date): CodeCheck {
  if (!row) return { ok: false, reason: "none", attemptsLeft: 0 };
  if (row.consumed_at) return { ok: false, reason: "used", attemptsLeft: 0 };
  if (row.attempts >= CODE_MAX_ATTEMPTS) return { ok: false, reason: "too_many", attemptsLeft: 0 };
  if (new Date(row.expires_at) <= now) return { ok: false, reason: "expired", attemptsLeft: 0 };
  const clean = typed.replace(/\D/g, "");
  const want = Buffer.from(row.code_hash, "hex");
  const got = Buffer.from(codeHash(row.device_id, clean), "hex");
  if (clean.length === 6 && want.length === got.length && timingSafeEqual(want, got)) return { ok: true };
  const left = CODE_MAX_ATTEMPTS - row.attempts - 1;
  return { ok: false, reason: left > 0 ? "wrong" : "too_many", attemptsLeft: Math.max(0, left) };
}

export const codeExpiry = (now: Date) => new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString();
export const trustUntil = (now: Date) => new Date(now.getTime() + TRUST_DAYS * 86_400_000).toISOString();

/** May this device be sent another code now? Not within a minute of the last, nor more than five an hour. */
export function mayResend(recent: Pick<CodeRow, "created_at">[], now: Date): { ok: true } | { ok: false; waitSeconds: number } {
  const times = recent.map((r) => new Date(r.created_at).getTime()).sort((a, b) => b - a);
  if (times.length && now.getTime() - times[0] < CODE_RESEND_SECONDS * 1000) return { ok: false, waitSeconds: Math.ceil((CODE_RESEND_SECONDS * 1000 - (now.getTime() - times[0])) / 1000) };
  const lastHour = times.filter((t) => now.getTime() - t < 3_600_000);
  if (lastHour.length >= CODE_MAX_PER_HOUR) return { ok: false, waitSeconds: Math.ceil((lastHour[lastHour.length - 1] + 3_600_000 - now.getTime()) / 1000) };
  return { ok: true };
}

export const CODE_WORDS: Record<Exclude<CodeCheck, { ok: true }>["reason"], string> = {
  none: "Ask for a code first.",
  expired: "That code has expired. Send a new one.",
  used: "That code has been used. Send a new one.",
  too_many: "Too many wrong tries. Send a new code.",
  wrong: "That isn't the code we sent.",
};

/** "g•••@leightonpark.com": enough to recognise the address the code went to. */
export function maskEmail(email: string | null | undefined): string {
  const [user, domain] = (email ?? "").split("@");
  if (!user || !domain) return "your email";
  return `${user[0]}•••@${domain}`;
}

// ------------------------------------------------------------------ the sign-in decision

export type SignInNeed = { code: false; why: "trusted" | "codes_off" | "new_account" | "preview" } | { code: true };

/** Does this sign-in need a code? Not when codes are off (Q5), for the preview account, on a device trusted in the
 * last 60 days, or on a brand-new account's first device; otherwise yes. */
export function signInNeed(o: { codesOn: boolean; kind: AccountKind; device: Pick<DeviceRow, "trusted_until"> | null; accountCreatedAt: string | null; accountHasDevices: boolean; now: Date }): SignInNeed {
  if (o.kind === "preview") return { code: false, why: "preview" };
  if (!o.codesOn) return { code: false, why: "codes_off" };
  if (o.device?.trusted_until && new Date(o.device.trusted_until) > o.now) return { code: false, why: "trusted" };
  if (!o.accountHasDevices && o.accountCreatedAt && o.now.getTime() - new Date(o.accountCreatedAt).getTime() < NEW_ACCOUNT_MINUTES * 60_000) return { code: false, why: "new_account" };
  return { code: true };
}

export const isSignedIn = (d: Pick<DeviceRow, "signed_in_at" | "signed_out_at" | "session_id">) => !!d.signed_in_at && !d.signed_out_at && !!d.session_id;

/** R-DEVICE-CAP: signing `incoming` in, who must be signed out so at most the cap stay signed in? The oldest
 * sign-ins first; never the incoming device itself. */
export function capVictims(devices: DeviceRow[], incomingId: string, kind: AccountKind): DeviceRow[] {
  const cap = DEVICE_CAP[kind];
  const others = devices.filter((d) => d.id !== incomingId && isSignedIn(d)).sort((a, b) => (a.signed_in_at! < b.signed_in_at! ? -1 : a.signed_in_at! > b.signed_in_at! ? 1 : a.id.localeCompare(b.id)));
  const over = others.length + 1 - cap;
  return over > 0 ? others.slice(0, over) : [];
}

/** The one line the next page shows after the cap signed devices out. */
export function capNotice(labels: string[], kind: AccountKind): string {
  const cap = DEVICE_CAP[kind];
  const which = labels.length === 1 ? labels[0] : `${labels.length} other devices`;
  return `You can be signed in on ${cap} devices at once, so we signed you out on ${which}.`;
}

export { SIGNED_OUT_WORDS } from "./words";

// ------------------------------------------------------------------ the quiet alert

export type SignInEvent = { profile_id: string; place: string | null; at: string };

/** Accounts used from more than PLACES_ALERT.places places in the last PLACES_ALERT.hours hours, most places first. */
export function flaggedAccounts(events: SignInEvent[], now: Date): { profileId: string; places: string[] }[] {
  const since = now.getTime() - PLACES_ALERT.hours * 3_600_000;
  const by = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.place || new Date(e.at).getTime() < since) continue;
    const set = by.get(e.profile_id) ?? new Set<string>();
    set.add(e.place);
    by.set(e.profile_id, set);
  }
  return [...by]
    .filter(([, s]) => s.size > PLACES_ALERT.places)
    .map(([profileId, s]) => ({ profileId, places: [...s].sort() }))
    .sort((a, b) => b.places.length - a.places.length || a.profileId.localeCompare(b.profileId));
}

/** "Active now", "12 minutes ago", "3 hours ago", "2 days ago", "4 Nov". */
export function lastActiveWords(iso: string | null, now: Date): string {
  if (!iso) return "—";
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 5) return "Active now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}
