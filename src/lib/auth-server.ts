// 0.8 front door part 3, milestone 1: reading the cookie session on the server. Two callers:
//   - the proxy (src/proxy.ts): readRequestSession over the incoming request, writing any refreshed
//     cookies onto the response it returns;
//   - route handlers (the auth routes, preview-session): routeSessionClient over a response they build.
// Both verify with getClaims(): this project signs its JWTs with an asymmetric key (ES256), so the check is
// local against Supabase's published key, not a call to Auth on every request. An expired access token is
// refreshed first (getClaims reads the session through getSession, which refreshes), and the new cookies
// go out on the response.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_OPTIONS, hasSessionCookie } from "./auth-cookies";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

export type SessionClaims = { sub: string; session_id?: string; email?: string; exp?: number; [k: string]: unknown };

export type RequestSession = {
  claims: SessionClaims | null;
  accessToken: string | null;
  /** Writes any refreshed (or cleared) session cookies onto a response. */
  apply(res: NextResponse): NextResponse;
};

// Secure in production (Render sits behind Cloudflare, so the request the server sees can read http: even
// though the browser's is https -- the preview route's own lesson); plain http works on a local dev server.
function cookieOptions(https: boolean) {
  return { ...SESSION_COOKIE_OPTIONS, secure: https || process.env.NODE_ENV === "production" };
}

function applyCookies(res: NextResponse, set: CookieToSet[], headers: Record<string, string>): NextResponse {
  for (const c of set) res.cookies.set(c.name, c.value, c.options);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

const NO_SESSION: RequestSession = { claims: null, accessToken: null, apply: (r) => r };

/** The signed-in user on this request, from its session cookie, verified (and refreshed when it has
 * expired). No session cookie: answered at once, with no client made. */
export async function readRequestSession(request: NextRequest): Promise<RequestSession> {
  if (!hasSessionCookie(request.cookies.getAll().map((c) => c.name))) return NO_SESSION;
  const set: CookieToSet[] = [];
  const headers: Record<string, string> = {};
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: cookieOptions(request.nextUrl.protocol === "https:"),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, h) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          set.push(c as CookieToSet);
        }
        Object.assign(headers, h ?? {});
      },
    },
  });
  let claims: SessionClaims | null = null;
  let accessToken: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    claims = (data?.claims as SessionClaims | undefined) ?? null;
    if (claims?.sub) {
      const { data: s } = await supabase.auth.getSession();
      accessToken = s.session?.access_token ?? null;
    } else claims = null;
  } catch (e) {
    console.error("[auth-server] session check failed:", (e as Error).message);
    claims = null;
  }
  return { claims, accessToken, apply: (res) => applyCookies(res, set, headers) };
}

/** A server client over this request's session cookies, writing any change (sign-in, refresh, sign-out)
 * to `pending`, which the caller applies to the response it returns (applySessionCookies). */
export function routeSessionClient(request: NextRequest): { supabase: SupabaseClient; pending: { set: CookieToSet[]; headers: Record<string, string> } } {
  const pending = { set: [] as CookieToSet[], headers: {} as Record<string, string> };
  const https = request.nextUrl.protocol === "https:";
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: cookieOptions(https),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, h) => {
        for (const c of list) pending.set.push(c as CookieToSet);
        Object.assign(pending.headers, h ?? {});
      },
    },
  });
  return { supabase, pending };
}

export function applySessionCookies(res: NextResponse, pending: { set: CookieToSet[]; headers: Record<string, string> }): NextResponse {
  return applyCookies(res, pending.set, pending.headers);
}

// A plain client for verifying a token handed to us (no storage, no session): getClaims(jwt) is local.
let verifier: SupabaseClient | null = null;

/** Whether `Authorization: Bearer <jwt>` carries a token the project signed and that hasn't expired. */
export async function verifyBearer(header: string | null): Promise<boolean> {
  return !!(await bearerClaims(header));
}

export async function bearerClaims(header: string | null): Promise<SessionClaims | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  if (!m) return null;
  verifier ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { data } = await verifier.auth.getClaims(m[1]);
    const claims = (data?.claims as SessionClaims | undefined) ?? null;
    return claims?.sub ? claims : null;
  } catch {
    return null;
  }
}
