// 0.8 front door part 3: a stand-in Supabase Auth for the session, gate and device tests (not a test file).
// It signs real ES256 access tokens with its own key and serves that key as the project's JWKS, so the
// app's own verification (getClaims, local, as in production) runs unchanged; it answers a refresh with a
// new token. Everything else falls through to the fetch it wraps.
import { createHash, generateKeyPairSync, sign, randomUUID } from "node:crypto";

export const AUTH_URL = "http://supabase.test";
const KID = "test-key-1";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const JWK = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "ES256", use: "sig", key_ops: ["verify"] };

const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** A session id for a user: a UUID, as Supabase's are, the same each time for the same user. */
export function sidOf(sub: string): string {
  const h = createHash("sha1").update(sub).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The device row the gate reads for each session (src/lib/devices/gate.ts), by session id. A session minted here
 * is signed in on a device unless a test says otherwise (null: no device yet; or any row it sets). */
export const gateRows = new Map<string, Record<string, unknown> | null>();
const minted = new Map<string, string>();
export const gateReads: string[] = [];
/** Sessions Supabase has ended (deleted): /user answers 403 "session_not_found" for their tokens. */
export const endedSessions = new Set<string>();

/** A signed access token for `sub` (session `sid`), expiring `ttl` seconds from now (negative: expired). */
export function accessToken(sub: string, sid = sidOf(sub), ttl = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  minted.set(sid, sub);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KID, typ: "JWT" }));
  const body = b64u(JSON.stringify({ sub, session_id: sid, role: "authenticated", aud: "authenticated", email: `${sub}@test`, iat: now, exp: now + ttl }));
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}

/** A forged token: right shape, signed by a key the project doesn't publish. */
export function forgedToken(sub: string): string {
  const other = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KID, typ: "JWT" }));
  const body = b64u(JSON.stringify({ sub, session_id: sidOf(sub), role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 }));
  return `${head}.${body}.${b64u(sign("sha256", Buffer.from(`${head}.${body}`), { key: other, dsaEncoding: "ieee-p1363" }))}`;
}

export function session(sub: string, opts: { ttl?: number; sid?: string; refresh?: string } = {}) {
  const ttl = opts.ttl ?? 3600;
  const token = accessToken(sub, opts.sid ?? sidOf(sub), ttl);
  return {
    access_token: token,
    refresh_token: opts.refresh ?? `refresh-${sub}`,
    token_type: "bearer",
    expires_in: ttl,
    expires_at: Math.floor(Date.now() / 1000) + ttl,
    user: { id: sub, aud: "authenticated", email: `${sub}@test`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}

/** The browser's session cookie for a session, as @supabase/ssr writes it (one chunk). The project ref is the
 * URL's first label: `supabase` for AUTH_URL. */
export function sessionCookie(s: ReturnType<typeof session>): string {
  return `sb-supabase-auth-token=base64-${b64u(JSON.stringify(s))}`;
}

export const authLog = { refreshes: [] as string[], otp: [] as string[] };

/** Wraps globalThis.fetch: the JWKS, refresh_token grants, /user and verify(OTP) are answered here. */
export function installFakeAuth(): () => void {
  const prev = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const u = new URL(req.url);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u.origin === AUTH_URL && u.pathname === "/rest/v1/account_devices" && req.method === "GET" && u.searchParams.get("session_id")?.startsWith("eq.")) {
      const sid = u.searchParams.get("session_id")!.slice(3);
      gateReads.push(sid);
      if (gateRows.has(sid)) {
        const row = gateRows.get(sid);
        return json(row ? [row] : []);
      }
      const sub = minted.get(sid);
      const now = new Date().toISOString();
      return json(sub ? [{ id: `dev-${sub}`, profile_id: sub, signed_in_at: now, signed_out_at: null, signed_out_reason: null, last_active_at: now, place: null }] : []);
    }
    if (u.origin !== AUTH_URL || !u.pathname.startsWith("/auth/v1/")) return prev(input, init);
    if (u.pathname === "/auth/v1/.well-known/jwks.json") return json({ keys: [JWK] });
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "refresh_token") {
      const { refresh_token } = (await req.json()) as { refresh_token: string };
      authLog.refreshes.push(refresh_token);
      const sub = /^refresh-(.+)$/.exec(refresh_token)?.[1];
      if (!sub) return json({ error: "invalid_grant", error_description: "Invalid Refresh Token" }, 400);
      return json(session(sub, { refresh: `refresh-${sub}` }));
    }
    if (u.pathname === "/auth/v1/verify") {
      const b = (await req.json()) as { token_hash?: string };
      authLog.otp.push(b.token_hash ?? "");
      const sub = /^hash-(.+)$/.exec(b.token_hash ?? "")?.[1];
      return sub ? json(session(sub, { sid: randomUUID() })) : json({ error: "otp_expired" }, 403);
    }
    if (u.pathname === "/auth/v1/user") {
      const tok = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const claims = tok.split(".").length === 3 ? JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()) : null;
      if (claims?.session_id && endedSessions.has(claims.session_id)) return json({ code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" }, 403);
      return claims?.sub ? json({ id: claims.sub, aud: "authenticated", email: `${claims.sub}@test` }) : json({ msg: "bad jwt" }, 401);
    }
    if (u.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    return json({ msg: `fake auth: ${u.pathname} not handled` }, 404);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = prev;
  };
}
