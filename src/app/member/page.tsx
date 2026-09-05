"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";

// Members' landing page (2026-09-05, added per Guy's direct request after a real live
// failure report on a direct /schools/[urn]/data link): a stable landing page a
// logged-in member always lands on, that for now just forwards them to their own
// school's Data View -- there was previously no fallback landing page at all if a
// direct deep link failed. Login (src/app/login/page.tsx) now sends here instead of
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
type Membership = {
  id: string;
  status: string;
  school_account_id: string;
  school_accounts: { school_urn: string; schools: { current_name: string } | null };
};

type State = "checking" | "logged_out" | "no_memberships" | "choose" | "error";

export default function HomePage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("[HomePage] getUser failed:", userError);
          setErrorMessage("Could not check your login. Try reloading.");
          setState("error");
          return;
        }
        if (!userData.user) {
          setState("logged_out");
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

        const rows = (data as unknown as Membership[]) ?? [];
        if (rows.length === 0) {
          setState("no_memberships");
          return;
        }
        if (rows.length === 1) {
          router.replace(`/schools/${rows[0].school_accounts.school_urn}/data`);
          return;
        }
        setMemberships(rows);
        setState("choose");
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

  if (state === "logged_out") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-neutral-500">
        <Link href="/login" className="underline">
          Log in
        </Link>{" "}
        to see your school&rsquo;s Data View.
      </main>
    );
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

  // "choose": more than one approved membership -- a real, if uncommon, case (e.g. a
  // consultant or governor at more than one school). Plain list, no attempt at a
  // "default" school this round.
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="mb-6 text-xl font-semibold">Choose a school</h1>
      <ul className="space-y-2">
        {memberships.map((m) => (
          <li key={m.id}>
            <Link href={`/schools/${m.school_accounts.school_urn}/data`} className="underline">
              {m.school_accounts.schools?.current_name ?? m.school_accounts.school_urn}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
