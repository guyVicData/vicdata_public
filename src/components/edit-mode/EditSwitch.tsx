"use client";

// 0.6 snagging round 2, item B: the footer's "Edit" switch (src/lib/edit-mode.ts), after
// "Sources & methodology" in the same text style. Rendered only for a platform admin on a
// page that shows a VicData-owned dashboard; everywhere else (and for everyone else) it
// renders nothing, so the footer is exactly as it was.
import { useMemo, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { setEditOn, useEditSwitch, usePlatformAdminCached } from "@/lib/edit-mode";
import { openViewAs, useViewAsNow } from "@/components/view-as/ViewAs";

// A small on/off track drawn in the text's own colour (currentColor), so it takes the
// footer's or the banner's palette and adds no colour of its own.
export function MiniSwitch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block h-[10px] w-[18px] shrink-0 rounded-full border border-current align-middle ${on ? "" : "opacity-70"}`}
    >
      <span className={`absolute top-[1px] h-[6px] w-[6px] rounded-full bg-current ${on ? "right-[1px]" : "left-[1px]"}`} />
    </span>
  );
}

export function SwitchButton({ on, onChange, className, children }: { on: boolean; onChange: (on: boolean) => void; className: string; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
      <MiniSwitch on={on} />
    </button>
  );
}

export function FooterEditSwitch() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { shown, on } = useEditSwitch(supabase);
  if (!shown) return null;
  return (
    <SwitchButton on={on} onChange={setEditOn} className="ml-4 align-middle leading-none hover:text-neutral-900 dark:hover:text-neutral-100 print:hidden">
      <span data-edit-switch="">Edit</span>
    </SwitchButton>
  );
}

// 0.7 admissions r3 (F5): the edit bar's "View as…", for platform admins on every page, while not
// viewing as anyone (the banner's Change does that then). It opens the nav pill's popover, which
// no longer shows "Viewing as: you" at rest.
export function FooterViewAs() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const admin = usePlatformAdminCached(supabase);
  const viewing = useViewAsNow();
  if (!admin || viewing) return null;
  return (
    <button type="button" onClick={() => openViewAs()} className="ml-4 align-middle leading-none hover:text-neutral-900 dark:hover:text-neutral-100 print:hidden" data-view-as-open="">
      View as&hellip;
    </button>
  );
}
