"use client";

import { createBrowserSupabaseClient } from "./supabase";

// 0.8 front door part 3: signing out of THIS browser. `scope: "local"` ends only this session (Supabase's default,
// "global", would sign the person out everywhere: that is "Sign out of all devices", on purpose only). Then a
// full page load to the landing page, not a client navigation: the router may hold the landing page's
// signed-in answer (a redirect home) from before.
export async function signOutHere(): Promise<void> {
  try {
    await fetch("/api/auth/sign-out", { method: "POST" });
  } catch {
    // The server's half (milestone 3: the device row) is best effort; the cookie still goes below.
  }
  await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose (above)
  window.location.assign("/");
}
