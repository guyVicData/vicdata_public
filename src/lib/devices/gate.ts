// 0.8 front door part 3 (E24): the beta gate's device check, per request (src/proxy.ts). A verified session counts
// as signed in only while its device row is: none yet (or waiting for a code) means "finish signing in here"; a row
// signed out (by its owner, the cap, a School-Admin, VicData) means signed out, whatever the token says.
//
// One small REST read per session per GATE_CACHE_SECONDS (the service role, like the usage count: no supabase-js
// in the proxy), remembered in a bounded map; our own sign-out routes forget a session at once. "Last active" is
// written at most every TOUCH_MINUTES, after the response, with the rough place; a change of place is a sign-in
// event for the places alert.
import { GATE_CACHE_SECONDS, TOUCH_MINUTES } from "./config";
import type { SignOutReason } from "./core";

export type GateRow = { id: string; profile_id: string; signed_in_at: string | null; signed_out_at: string | null; signed_out_reason: SignOutReason | null; last_active_at: string; place: string | null };
export type DeviceGateState = { state: "in"; row: GateRow } | { state: "unregistered" } | { state: "pending"; row: GateRow } | { state: "revoked"; reason: SignOutReason } | { state: "error" };

const MAX_ENTRIES = 5000;
// On globalThis: the proxy and the route handlers are separate bundles, each with its own copy of this module, and
// a route's forgetSessions must reach the proxy's map (found by hand: a passed code, or the cap, took up to
// GATE_CACHE_SECONDS to be seen).
const G = globalThis as unknown as { __vicdataDeviceGate?: Map<string, { row: GateRow | null; at: number }> };
const cache = (G.__vicdataDeviceGate ??= new Map());

export function forgetSessions(sessionIds: string[]): void {
  for (const s of sessionIds) cache.delete(s);
}

export function stateOf(row: GateRow | null, profileId: string): DeviceGateState {
  if (!row || row.profile_id !== profileId) return { state: "unregistered" };
  if (row.signed_out_at) return { state: "revoked", reason: row.signed_out_reason ?? "here" };
  if (!row.signed_in_at) return { state: "pending", row };
  return { state: "in", row };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The device state of a verified session (`sid` from its claims, `sub` its user). */
export async function deviceGateState(sid: string | undefined, sub: string, now = Date.now()): Promise<DeviceGateState> {
  if (!sid || !UUID.test(sid)) return { state: "unregistered" };
  const hit = cache.get(sid);
  if (hit && now - hit.at < GATE_CACHE_SECONDS * 1000) return stateOf(hit.row, sub);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { state: "error" };
  try {
    const r = await fetch(`${url}/rest/v1/account_devices?session_id=eq.${sid}&select=id,profile_id,signed_in_at,signed_out_at,signed_out_reason,last_active_at,place`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) {
      console.error("[device-gate] read failed:", r.status);
      return { state: "error" };
    }
    const rows = (await r.json()) as GateRow[];
    const row = rows[0] ?? null;
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(sid, { row, at: now });
    return stateOf(row, sub);
  } catch (e) {
    console.error("[device-gate] read failed:", (e as Error).message);
    return { state: "error" };
  }
}

/** After the response: "last active" (and the place) at most every TOUCH_MINUTES; a new place is a sign-in event. */
export async function touchDevice(row: GateRow, place: string | null, now = new Date()): Promise<void> {
  const stale = now.getTime() - new Date(row.last_active_at).getTime() >= TOUCH_MINUTES * 60_000;
  const moved = !!place && place !== row.place;
  if (!stale && !moved) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" };
  row.last_active_at = now.toISOString();
  if (place) row.place = place;
  try {
    await fetch(`${url}/rest/v1/account_devices?id=eq.${row.id}`, { method: "PATCH", headers, body: JSON.stringify({ last_active_at: row.last_active_at, ...(place ? { place } : {}) }), signal: AbortSignal.timeout(4000) });
    if (moved) await fetch(`${url}/rest/v1/account_sign_ins`, { method: "POST", headers, body: JSON.stringify({ profile_id: row.profile_id, device_id: row.id, place, at: row.last_active_at }), signal: AbortSignal.timeout(4000) });
  } catch {
    // Best effort: the next request tries again.
  }
}
