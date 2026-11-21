// 0.8 front door part 3: the session cookie's shape, shared by the browser client (src/lib/supabase.ts),
// the proxy (src/proxy.ts) and the server's auth routes (src/lib/auth-server.ts), so the three never
// disagree about a cookie's name or options. No server-only imports: the browser loads this too.

// @supabase/ssr's own defaults (path /, SameSite=Lax, 400 days), stated here so they are ours. SameSite=Lax
// is what keeps the cookie off another site's POST/fetch: the proxy only ever turns it into an
// Authorization header for a same-origin request too (sessionToBearer below), so a cookie alone never
// makes a cross-site call act as the user. `secure` is added where the page is https.
export const SESSION_COOKIE_OPTIONS = { path: "/", sameSite: "lax" as const, maxAge: 400 * 24 * 60 * 60 };

/** Supabase's session cookies: `sb-<project ref>-auth-token`, split into `.0`, `.1`… when long. The PKCE
 * code verifier (`-code-verifier`) is not a session. */
export function isSessionCookie(name: string): boolean {
  return /^sb-[^-]+-auth-token(\.\d+)?$/.test(name);
}

export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const n of names) if (isSessionCookie(n)) return true;
  return false;
}

/** Whether a request that carries the session cookie but no Bearer token should be given one from
 * the cookie. Only for the site's own pages: a cross-site request (Sec-Fetch-Site: cross-site or
 * same-site) never acts as the user on the strength of a cookie. No header at all (curl, an old browser)
 * isn't a browser being steered by another site, so it is treated as the site's own. */
export function sessionToBearer(headers: Headers): boolean {
  if (/^Bearer\s+\S/i.test(headers.get("authorization") ?? "")) return false;
  const site = headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}
