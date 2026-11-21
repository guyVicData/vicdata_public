import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { tracedFetch } from "./build-trace";
import { SESSION_COOKIE_OPTIONS } from "./auth-cookies";

// Browser/client-safe: anon key only, RLS enforced (e.g. schools_select_anyone,
// search_schools granted to anon). Never import the service-role client below into
// client components.
//
// 0.8 front door part 3, milestone 1 (cookie sessions): the session lives in a cookie
// (@supabase/ssr's createBrowserClient), not localStorage, so the server -- the proxy's
// sign-in gate, the device check, the auth routes -- can see who is signed in. Callers
// are unchanged: getSession() still answers in the browser, and every page still sends
// `Authorization: Bearer <token>` from it, which the API routes read as before. A request
// that carries only the cookie gets the same header from the proxy (src/proxy.ts).
//
// Singleton, not a fresh client per caller: createBrowserClient keeps one per tab itself
// in the browser (several GoTrueClients over one session misbehave -- confirmed in dev
// console when SchoolSearch and its ManualSchoolRequestForm each made their own).
let browserClient: SupabaseClient | null = null;
let serverRenderClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  // A client component rendered on the server (or a lib module loaded there) has no document.cookie and
  // never a session: it gets a plain anon client, as it effectively did before cookie sessions.
  if (typeof window === "undefined" || typeof document === "undefined") {
    serverRenderClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return serverRenderClient;
  }
  if (!browserClient) {
    const https = typeof location !== "undefined" && location.protocol === "https:";
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: { ...SESSION_COOKIE_OPTIONS, secure: https } },
    );
    forgetLocalStorageSession();
  }
  return browserClient;
}

// Before milestone 1 the session was kept in localStorage under `sb-<project>-auth-token`. It is never
// read again (everyone signs in once more after the switch: the cookie is the session now), so it is
// removed rather than left as a second, stale copy of a refresh token.
function forgetLocalStorageSession(): void {
  try {
    if (typeof localStorage === "undefined") return;
    for (const k of Object.keys(localStorage)) if (/^sb-.+-auth-token(-code-verifier)?$/.test(k)) localStorage.removeItem(k);
  } catch {
    // Storage blocked: nothing to forget.
  }
}

// Server-only: bypasses RLS. Never imported from a "use client" file.
export function createServiceRoleSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // tracedFetch: a failed read inside a build keeps that answer out of the results cache.
    { auth: { persistSession: false }, global: { fetch: tracedFetch } },
  );
}

// Server-only, anon key, RLS still enforced -- for Server Component / lib code that
// needs public data (schools table, search_schools, nearest_schools) without a user
// session. Not the browser singleton above: no localStorage in a server runtime, and
// this and the browser client have genuinely different lifetimes (per-request vs.
// per-tab), so sharing one instance across both would be the wrong fix, not a
// convenience.
export function createServerAnonSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false }, global: { fetch: tracedFetch } },
  );
}
