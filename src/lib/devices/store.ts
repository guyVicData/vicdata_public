// 0.8 front door part 3 (E24): reading and writing devices, codes and sign-ins. Server-only. The real store is the
// service role over the tables (20261126090000_v08_front_door_r3_signins.sql), used only after a route has
// verified who is asking; the memory store stands in for it in the tests.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CodeRow, DeviceRow } from "./core";

export type NewDevice = Pick<DeviceRow, "profile_id" | "token_hash"> & Partial<Omit<DeviceRow, "id" | "profile_id" | "token_hash">>;

export interface DeviceStore {
  deviceByToken(hash: string): Promise<DeviceRow | null>;
  deviceBySession(sessionId: string): Promise<DeviceRow | null>;
  devicesOf(profileId: string): Promise<DeviceRow[]>;
  insertDevice(row: NewDevice): Promise<DeviceRow>;
  updateDevice(id: string, patch: Partial<DeviceRow>): Promise<void>;
  /** Clears session_id on any other row holding it (a session lives on one device). */
  releaseSession(sessionId: string, exceptId: string): Promise<void>;
  codesOf(deviceId: string, sinceIso: string): Promise<CodeRow[]>;
  insertCode(row: Omit<CodeRow, "id" | "attempts" | "consumed_at" | "created_at"> & { created_at?: string }): Promise<void>;
  updateCode(id: string, patch: Partial<CodeRow>): Promise<void>;
  addSignIn(profileId: string, deviceId: string | null, place: string | null, at: string): Promise<void>;
  /** Ends a Supabase session (its refresh token dies with it). */
  revokeSession(sessionId: string): Promise<void>;
  profile(profileId: string): Promise<{ email: string | null; createdAt: string | null } | null>;
  isPlatformAdmin(profileId: string): Promise<boolean>;
}

const DEVICE_COLS = "id, profile_id, token_hash, account_kind, label, browser, os, form, place, session_id, trusted_until, signed_in_at, last_active_at, signed_out_at, signed_out_reason, created_at";

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`[devices] ${what}: ${r.error.message}`);
  return r.data;
}

export function supabaseDeviceStore(sb: SupabaseClient): DeviceStore {
  return {
    async deviceByToken(hash) {
      return must(await sb.from("account_devices").select(DEVICE_COLS).eq("token_hash", hash).maybeSingle<DeviceRow>(), "device by token");
    },
    async deviceBySession(sessionId) {
      return must(await sb.from("account_devices").select(DEVICE_COLS).eq("session_id", sessionId).maybeSingle<DeviceRow>(), "device by session");
    },
    async devicesOf(profileId) {
      return must(await sb.from("account_devices").select(DEVICE_COLS).eq("profile_id", profileId).order("created_at"), "devices of") as DeviceRow[];
    },
    async insertDevice(row) {
      const d = must(await sb.from("account_devices").insert(row).select(DEVICE_COLS).single<DeviceRow>(), "insert device");
      if (!d) throw new Error("[devices] insert device: no row");
      return d;
    },
    async updateDevice(id, patch) {
      must(await sb.from("account_devices").update(patch).eq("id", id), "update device");
    },
    async releaseSession(sessionId, exceptId) {
      must(await sb.from("account_devices").update({ session_id: null }).eq("session_id", sessionId).neq("id", exceptId), "release session");
    },
    async codesOf(deviceId, sinceIso) {
      return must(await sb.from("device_codes").select("id, device_id, profile_id, code_hash, expires_at, attempts, consumed_at, created_at").eq("device_id", deviceId).gte("created_at", sinceIso).order("created_at", { ascending: false }), "codes of") as CodeRow[];
    },
    async insertCode(row) {
      must(await sb.from("device_codes").insert(row), "insert code");
    },
    async updateCode(id, patch) {
      must(await sb.from("device_codes").update(patch).eq("id", id), "update code");
    },
    async addSignIn(profileId, deviceId, place, at) {
      must(await sb.from("account_sign_ins").insert({ profile_id: profileId, device_id: deviceId, place, at }), "add sign-in");
    },
    async revokeSession(sessionId) {
      must(await sb.rpc("revoke_auth_session", { p_session: sessionId }), "revoke session");
    },
    async profile(profileId) {
      const p = must(await sb.from("profiles").select("email, created_at").eq("id", profileId).maybeSingle<{ email: string | null; created_at: string | null }>(), "profile");
      return p ? { email: p.email, createdAt: p.created_at } : null;
    },
    async isPlatformAdmin(profileId) {
      return !!must(await sb.from("platform_admins").select("profile_id").eq("profile_id", profileId).maybeSingle(), "platform admin");
    },
  };
}

/** The tests' stand-in: the same rules over arrays. */
export function memoryDeviceStore(seed: { profiles?: Record<string, { email: string; createdAt: string }>; platformAdmins?: string[] } = {}) {
  const devices: DeviceRow[] = [];
  const codes: CodeRow[] = [];
  const signIns: { profile_id: string; device_id: string | null; place: string | null; at: string }[] = [];
  const revoked: string[] = [];
  const store: DeviceStore = {
    async deviceByToken(hash) {
      return devices.find((d) => d.token_hash === hash) ?? null;
    },
    async deviceBySession(sessionId) {
      return devices.find((d) => d.session_id === sessionId) ?? null;
    },
    async devicesOf(profileId) {
      return devices.filter((d) => d.profile_id === profileId).map((d) => ({ ...d }));
    },
    async insertDevice(row) {
      if (devices.some((d) => d.token_hash === row.token_hash)) throw new Error("duplicate token");
      const d: DeviceRow = { id: randomUUID(), account_kind: "staff", label: "A browser", browser: null, os: null, form: null, place: null, session_id: null, trusted_until: null, signed_in_at: null, last_active_at: new Date().toISOString(), signed_out_at: null, signed_out_reason: null, created_at: new Date().toISOString(), ...row };
      devices.push(d);
      return { ...d };
    },
    async updateDevice(id, patch) {
      const d = devices.find((x) => x.id === id);
      if (d) Object.assign(d, patch);
    },
    async releaseSession(sessionId, exceptId) {
      for (const d of devices) if (d.session_id === sessionId && d.id !== exceptId) d.session_id = null;
    },
    async codesOf(deviceId, sinceIso) {
      return codes.filter((c) => c.device_id === deviceId && c.created_at >= sinceIso).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => ({ ...c }));
    },
    async insertCode(row) {
      codes.push({ id: randomUUID(), attempts: 0, consumed_at: null, created_at: new Date().toISOString(), ...row });
    },
    async updateCode(id, patch) {
      const c = codes.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    },
    async addSignIn(profileId, deviceId, place, at) {
      signIns.push({ profile_id: profileId, device_id: deviceId, place, at });
    },
    async revokeSession(sessionId) {
      revoked.push(sessionId);
    },
    async profile(profileId) {
      const p = seed.profiles?.[profileId];
      return p ? { email: p.email, createdAt: p.createdAt } : null;
    },
    async isPlatformAdmin(profileId) {
      return (seed.platformAdmins ?? []).includes(profileId);
    },
  };
  return { store, devices, codes, signIns, revoked };
}
