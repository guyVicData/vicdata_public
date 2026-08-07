"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type Membership = {
  id: string;
  status: string;
  school_account_id: string;
  school_accounts: { school_urn: string; schools: { current_name: string } | null };
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
      const { data } = await supabase
        .from("school_memberships")
        .select("id, status, school_account_id, school_accounts(school_urn, schools(current_name))")
        .eq("profile_id", userData.user.id)
        .eq("status", "approved");
      setMemberships((data as unknown as Membership[]) ?? []);
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
          <div className="mt-2 flex gap-4 text-sm">
            <Link
              className="underline"
              href={`/sets/comparator/new?school_account_id=${m.school_account_id}&anchor_urn=${m.school_accounts.school_urn}`}
            >
              Build Comparator Set
            </Link>
            <Link
              className="underline"
              href={`/sets/feeder/new?school_account_id=${m.school_account_id}&receiving_urn=${m.school_accounts.school_urn}`}
            >
              Build Feeder Set
            </Link>
          </div>
        </div>
      ))}
    </main>
  );
}
