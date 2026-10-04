"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { exitTrial, getActiveTrial } from "@/lib/trial";

// 0.6 S1 (brief G13): one sign-in event per sign-in, via record_sign_in(), which writes a
// row per approved membership. supabase-js also fires SIGNED_IN when a tab regains focus
// or a stored session is picked up, so sessionStorage remembers which session (its access
// token) this tab has already recorded. Fire-and-forget: a failure here must never touch
// signing in.
// 0.6 snag 2: none while a "Try VicData as…" trial is active in this tab -- a trial is
// invisible to the school, sign-in events included.
function recordSignIn(supabase: SupabaseClient, userId: string, accessToken: string) {
  if (getActiveTrial()) return;
  const key = "vicdata.signInRecorded";
  const marker = `${userId}:${accessToken.slice(-16)}`;
  try {
    if (window.sessionStorage.getItem(key) === marker) return;
    window.sessionStorage.setItem(key, marker);
  } catch {
    // Storage blocked: record anyway; a duplicate row is better than none.
  }
  void Promise.resolve(supabase.rpc("record_sign_in")).catch(() => {});
}

export default function NavBar() {
  const supabase = createBrowserSupabaseClient();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setLoggedIn(Boolean(session?.user));
      if (event === "SIGNED_IN" && session?.user) recordSignIn(supabase, session.user.id, session.access_token);
      // A trial belongs to the signed-in platform admin; signing out ends it.
      if (event === "SIGNED_OUT") exitTrial();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2026-09-25: every Teacher view page -- /teacher, its three phase dashboards,
  // /teacher/recruitment and /teacher/meetings -- carries its own TeacherNav (wordmark,
  // Home, Account, Log in when signed out), so this bar would be a second wordmark and a
  // second Account link stacked directly above it. Exactly those six routes; everywhere
  // else keeps this bar, Sets included. Spelt out rather than importing TEACHER_PHASES,
  // whose module drags the academic data layer into every page's bundle for one list.
  // 0.6 S1: People and Teams carry their own header (People.dc.html, Teams.dc.html) too.
  if (pathname && /^\/teacher(\/(ks2|ks4|ks5|recruitment|meetings|people|teams))?\/?$/.test(pathname)) return null;

  return (
    <header className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 text-sm dark:border-neutral-800">
      <Link href="/" className="font-semibold">
        VicData
      </Link>
      <nav className="flex items-center gap-4 text-neutral-500">
        <Link href="/sets" className="hover:text-neutral-900 dark:hover:text-neutral-100">
          Sets
        </Link>
        {loggedIn ? (
          <>
            {/* 2026-09-05: added alongside the new /member fallback landing page --
                there was no link back to it anywhere once you'd navigated away. Not
                /home -- that name is reserved for the public "/" home page. */}
            <Link href="/member" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Home
            </Link>
            <Link href="/account" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Account
            </Link>
          </>
        ) : (
          <>
            <Link href="/join" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Join your school
            </Link>
            <Link href="/login" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Log in
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
