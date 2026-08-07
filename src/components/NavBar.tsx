"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function NavBar() {
  const supabase = createBrowserSupabaseClient();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Link href="/account" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Account
          </Link>
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
