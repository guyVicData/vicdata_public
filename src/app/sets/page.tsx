"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { readSets } from "@/lib/sets/store";

type SavedSet = { id: string; name: string; kind: "compared_against" | "feeders"; personal: boolean };

type Membership = {
  id: string;
  status: string;
  school_account_id: string;
  school_accounts: { school_urn: string; schools: { current_name: string } | null };
  savedSets?: SavedSet[];
};

export default function SetsHomePage() {
  const supabase = createBrowserSupabaseClient();
  const [memberships, setMemberships] = useState<Membership[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMemberships([]);
        return;
      }
      // school_accounts qualified by FK constraint name -- same ambiguous-embed fix
      // as account/page.tsx's own load() (see that file's comment for the full
      // reasoning); the identical unqualified embed here failed the same way
      // (PGRST201), silently rendering every approved member's own /sets page as "no
      // schools" since account_holder_handoff.sql landed.
      const { data, error } = await supabase
        .from("school_memberships")
        .select("id, status, school_account_id, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
        .eq("profile_id", userData.user.id)
        .eq("status", "approved");
      if (error) console.error("Failed to load school memberships:", error);
      const rows = (data as unknown as Membership[]) ?? [];

      // 0.8 sets round 1 (A5): the one sets model (public.sets): each school's sets and the member's own.
      const withSets = await Promise.all(
        rows.map(async (m) => {
          const { sets } = await readSets(supabase, { schoolAccountId: m.school_account_id, profileId: userData.user!.id });
          const here = sets.filter((s) => s.ownerScope === "school" || s.schoolAccountId === m.school_account_id || (!s.schoolAccountId && s.focusUrn === m.school_accounts.school_urn));
          return { ...m, savedSets: here.map((s) => ({ id: s.id, name: s.name, kind: s.kind, personal: s.ownerScope === "personal" })) };
        }),
      );
      setMemberships(withSets);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (memberships === null) return <main className="px-6 py-24 text-center text-sm text-neutral-500">Loading…</main>;

  if (memberships.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-neutral-500">
        You need to be an approved member at a school to build Comparator or Feeder
        Sets.{" "}
        <Link href="/join" className="underline">
          Join your school
        </Link>
        .
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-xl font-semibold">Comparator &amp; Feeder Sets</h1>
      {memberships.map((m) => (
        <div key={m.id} className="mb-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="font-medium">
            {m.school_accounts.schools?.current_name ?? m.school_accounts.school_urn}
          </p>
          <p className="mt-2 text-sm text-neutral-500">Make a set from any page&rsquo;s set menu (New set&hellip;).</p>
          {m.savedSets && m.savedSets.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {m.savedSets.map((s) => (
                <li key={s.id}>
                  {s.kind === "compared_against" ? (
                    <Link className="underline" href={`/sets/${s.id}`}>
                      {s.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">{s.name} (feeder schools)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </main>
  );
}
