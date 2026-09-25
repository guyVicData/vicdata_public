"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function NavBar() {
  const supabase = createBrowserSupabaseClient();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2026-09-25: the Teacher view phase dashboards (/teacher/ks4 etc.) carry their own
  // TeacherNav -- wordmark, Home, Account -- so this bar would be a second wordmark and a
  // second Account link stacked directly above it. Only those routes: /teacher itself,
  // /teacher/recruitment and /teacher/meetings have no TeacherNav and keep this bar. The
  // phases are spelt out rather than importing TEACHER_PHASES, whose module drags the
  // academic data layer into every page's bundle for the sake of one list.
  if (pathname && /^\/teacher\/(ks2|ks4|ks5)\/?$/.test(pathname)) return null;

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
