"use client";

import { createBrowserSupabaseClient } from "./supabase";

// 0.8 front door part 3: signing out of THIS browser. `scope: "local"` ends only this session (Supabase's default,
// "global", would sign the person out everywhere: that is "Sign out of all devices", on purpose only). Then a
// full page load to the landing page, not a client navigation: the router may hold the landing page's
// signed-in answer (a redirect home) from before.
export async function signOutHere(): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  try {
    // Review pack 22 Nov, issue 5 (R-SIGN-OUT-REVOKES): the session goes with the request -- its access token as
    // Bearer, and the session cookie (the route reads either) -- so the server signs THIS device out. Sent with
    // neither, the server did nothing and the device stayed signed in, counting towards the cap.
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  } catch {
    // The server's half (milestone 3: the device row) is best effort; the cookie still goes below.
  }
  await supabase.auth.signOut({ scope: "local" });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose (above)
  window.location.assign("/");
}
