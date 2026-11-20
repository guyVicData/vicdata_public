"use client";

// Guy, 20 Nov (navigation): a dashboard reached from a level above (?back=, lib/front-door/back.ts) says the way back
// in words, at the top -- "← Back to the SMT home" -- not only through the Home icon. Shown only when the address
// carries a back (or the older &from=smt), so a dashboard opened straight from the menu is unchanged. Read after the
// first draw (the address isn't known on the server), so it needs no Suspense.
import Link from "next/link";
import { useEffect, useState } from "react";
import { backFrom, HOME_SECTION } from "@/lib/front-door/back";

export function BackBar({ className = "" }: { className?: string }) {
  const [back, setBack] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const b = backFrom(sp, HOME_SECTION.smt);
    // Head office inside a member school: its banner already says "Back to the group".
    if (sp.has("headOffice") && b.href.startsWith("/teacher/group")) return;
    // 0.8 feedback B5: the SMT home's Our subjects opened the Teacher dashboard with &from=smt before ?back existed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBack(b.given ? { href: b.href, label: b.label } : sp.get("from") === "smt" ? { href: HOME_SECTION.smt, label: "Back to the SMT home" } : null);
  }, []);
  if (!back) return null;
  return (
    <div data-back-bar="" className={`print:hidden ${className}`}>
      <Link href={back.href} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-4 text-[13.5px] font-semibold text-[var(--fg)] hover:border-[var(--accent,var(--fg))] sm:min-h-[36px]">
        <span aria-hidden="true">&larr;</span> {back.label}
      </Link>
    </div>
  );
}
