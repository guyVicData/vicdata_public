"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";

// Members' landing page (2026-09-05, added per Guy's direct request after a real live
// failure report on a direct /schools/[urn]/data link): a stable landing page a
// logged-in member always lands on. It forwarded to the school's Data View; since the
// private beta (21 Nov) it forwards an approved member to their home, /teacher, and a
// signed-out visitor to /. It is also where next.config.ts sends every /schools/**
// visit, since only the browser knows whether someone is signed in. Login (src/app/login/page.tsx) now sends here instead of
// straight to /account.
//
// At /member, not /home -- Guy's own correction: /home reads as the PUBLIC home
// page's own name (the "/" route already serves that, unchanged), not a members-only
// redirect page. Kept genuinely separate from "/" -- this route is never meant to be
// reachable by an anonymous visitor's expectations of what a site's "home" is.
//
// Same qualified-embed fix account.tsx's own comment documents (school_accounts has
// three FK relationships to school_memberships, an unqualified embed is genuinely
// ambiguous to PostgREST -- PGRST201).

type State = "checking" | "no_memberships" | "error";

export default function HomePage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // next.config.ts sends every /schools/** visit here (private beta, R-NO-PUBLIC-SCHOOL-LINKS):
        // signed out goes to the public home. getSession first: getUser with no session is an error.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.replace("/");
          return;
        }
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("[HomePage] getUser failed:", userError);
          setErrorMessage("Could not check your login. Try reloading.");
          setState("error");
          return;
        }
        if (!userData.user) {
          router.replace("/");
          return;
        }

        const { data, error } = await supabase
          .from("school_memberships")
          .select("id, status, school_account_id, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
          .eq("profile_id", userData.user.id)
          .eq("status", "approved");
        if (error) {
          console.error("[HomePage] membership lookup failed:", error);
          setErrorMessage("Could not load your memberships. Try reloading.");
          setState("error");
          return;
        }

        if (!data || data.length === 0) {
          setState("no_memberships");
          return;
        }
        // Private beta (Guy, 21 Nov): the member's home is /teacher, which picks the
        // membership itself. This used to forward to the school's Data View at
        // /schools/<urn>/data, hidden with the public school pages.
        router.replace("/teacher");
      } catch (e) {
        console.error("[HomePage] unexpected error:", e);
        setErrorMessage("Something went wrong. Try reloading.");
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "checking") {
    return <main className="px-6 py-24 text-center text-sm text-neutral-500">Loading…</main>;
  }

  if (state === "no_memberships") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-neutral-500">
        You&rsquo;re not an approved member at any school yet.{" "}
        <Link href="/join" className="underline">
          Join your school
        </Link>
        , or see your{" "}
        <Link href="/account" className="underline">
          account
        </Link>{" "}
        if you have a request pending.
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-neutral-500">
        <p>{errorMessage ?? "Something went wrong."}</p>
        <p className="mt-3">
          <button type="button" className="underline" onClick={() => window.location.reload()}>
            Reload
          </button>
        </p>
      </main>
    );
  }

  return <main className="px-6 py-24 text-center text-sm text-neutral-500">Loading…</main>;
}
