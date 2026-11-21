// 0.8 front door part 3 (E24): what the auth routes share. Server-only.
import type { NextRequest, NextResponse } from "next/server";
import { bearerClaims } from "../auth-server";
import { createServiceRoleSupabaseClient } from "../supabase";
import { DEVICE_COOKIE, DEVICE_COOKIE_DAYS, NOTICE_COOKIE } from "./config";
import { supabaseDeviceStore, type DeviceStore } from "./store";

export type Caller = { userId: string; sessionId: string; email: string | null };

/** The verified session behind this request (the proxy gives a cookie-only request its Bearer token), or null.
 * Verified twice: the token's signature (locally), then Supabase Auth itself confirms the session is still alive
 * -- an ended session's token stays valid until it expires (up to an hour), and these routes are where a device
 * signs in, so they must not take its word for it. Only here (rare requests), never on every page. */
export async function callerOf(request: NextRequest): Promise<Caller | null> {
  const header = request.headers.get("authorization");
  const c = await bearerClaims(header);
  if (!c?.sub || typeof c.session_id !== "string") return null;
  if (!(await sessionAlive(header!.replace(/^Bearer\s+/i, "")))) return null;
  return { userId: c.sub, sessionId: c.session_id, email: typeof c.email === "string" ? c.email : null };
}

async function sessionAlive(jwt: string): Promise<boolean> {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

let testStore: DeviceStore | null = null;
/** Tests only: run the routes over a memory store. */
export function setDeviceStoreForTests(store: DeviceStore | null): void {
  testStore = store;
}
export const deviceStore = (): DeviceStore => testStore ?? supabaseDeviceStore(createServiceRoleSupabaseClient());

const secure = () => process.env.NODE_ENV === "production";

/** The browser's device cookie: httpOnly, so no page script can read or copy it. */
export function setDeviceCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(DEVICE_COOKIE, token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: DEVICE_COOKIE_DAYS * 86_400 });
  return res;
}

/** A one-line notice for the next page (SignInNotice reads and clears it). */
export function setNotice(res: NextResponse, text: string | null): NextResponse {
  if (text) res.cookies.set(NOTICE_COOKIE, text, { httpOnly: false, secure: secure(), sameSite: "lax", path: "/", maxAge: 120 });
  return res;
}

export const deviceTokenOf = (request: NextRequest) => request.cookies.get(DEVICE_COOKIE)?.value ?? null;
