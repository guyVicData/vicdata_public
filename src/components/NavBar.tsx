"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { exitViewAs, getActiveViewAs } from "@/lib/view-as";
import { TeacherNav, useNavLabels } from "@/components/shell/TeacherNav";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { navModeFor } from "@/components/shell/nav-routes";

// 0.6 S1 (brief G13): one sign-in event per sign-in, via record_sign_in(), which writes a
// row per approved membership. supabase-js also fires SIGNED_IN when a tab regains focus
// or a stored session is picked up, so sessionStorage remembers which session (its access
// token) this tab has already recorded. Fire-and-forget: a failure here must never touch
// signing in.
// 0.6 snag 2: none while viewing as a member (View as, src/lib/view-as.ts) -- it is
// invisible to the school, sign-in events included.
function recordSignIn(supabase: SupabaseClient, userId: string, accessToken: string) {
  if (getActiveViewAs()) return;
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
  const pathname = usePathname();
  const [theme, setTheme] = useTeacherTheme();
  const [labelsOn, setLabelsOn] = useNavLabels(null, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) recordSignIn(supabase, session.user.id, session.access_token);
      // A trial belongs to the signed-in platform admin; signing out ends it.
      if (event === "SIGNED_OUT") exitViewAs();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 0.8 nav consistency (Guy, 21 Nov; R-NAV-ONE): the site's own bar (VicData · Sets · Home · Account) is
  // retired. There is one nav, the shell's TeacherNav. A page that draws it itself (every dashboard, the homes,
  // Recruitment, Meetings, the library) gets nothing from here -- this bar used to be stacked above several of
  // them as a second header -- and a walkthrough has its own band. Every other page gets the same TeacherNav
  // here, in the person's theme, with no phase of its own. Which is which: nav-routes.ts, one entry per page.
  if (navModeFor(pathname) !== "host") return null;

  return (
    <div data-shell-nav="" data-theme={theme} className="border-b border-[var(--panel-border)] bg-[var(--bg)] text-[var(--fg)] print:hidden">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-3 sm:px-7">
        <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={setTheme} />
      </div>
    </div>
  );
}
