"use client";

// 0.6 snagging round 2, item A: the thin banner every Teacher page shows while Guy is
// viewing VicData as a member (View as, src/lib/view-as.ts). The old look-as line's style (it lived
// in TeacherDashboard), moved here so every page draws the same one:
//
//   Viewing as SMT at Croydon College · Change · Start fresh · Back to me
//
// 0.6 snag 4 (A): renamed from "Trying VicData as … · Exit". It draws from the View as
// cookie straight away (useViewAsNow), so a tab opened while viewing as someone shows it
// from its first paint, loading screens included (`plain`: no Teacher tokens there).
// Change opens the nav pill's popover.
//
// Rendered as the first child inside the page's #teacher-root, so it takes that page's
// tokens and theme. Renders nothing outside a confirmed trial.
//
// Room for item B: `actions` go before Change (its "Edit" and "Preview draft"), and
// `headline` replaces the opening words (its "Editing the VicData dashboard for all
// schools · previewing as SMT at …").
//
// Item B: on a page showing a VicData dashboard (src/lib/edit-mode.ts) the banner adds
// the footer's Edit switch and a "Preview draft" switch (Guy only, this tab only).
//
// 0.8 View as: one banner for every View as, head office's included (the same cookie):
//
//   Viewing as SMT · Leighton Park · Edit · Preview draft · Change · Back to me
//   Viewing as Head office · Harris Federation · View as: read-only · Change · Back to me
//   Editing the VicData dashboard for all schools · previewing as SMT · Leighton Park · Edit · …
//
// Start fresh moved off the banner into the switcher (Change), beside each recent View as.
import { Fragment, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { VIEW_AS_READ_ONLY, type ViewAs } from "@/lib/view-as";
import { setEditOn, setPreviewDraft, useEditSwitch } from "@/lib/edit-mode";
import { SwitchButton } from "@/components/edit-mode/EditSwitch";
import { backToMe, openViewAs, useViewAsGroupNow, useViewAsNow, useViewAsUnconfirmed, viewAsGroupLabel, viewAsLabel } from "./ViewAs";


const ACTION = "font-semibold text-[var(--fg)] underline-offset-2 hover:underline disabled:opacity-50";

export function ViewAsBanner({
  actions,
  headline,
  className = "mb-3",
  plain = false,
}: {
  actions?: ReactNode[];
  headline?: (t: ViewAs) => ReactNode;
  className?: string;
  // Outside #teacher-root (a page's loading screen): neutral classes for the same shape.
  plain?: boolean;
}) {
  const supabase = createBrowserSupabaseClient();
  const viewAs = useViewAsNow();
  const group = useViewAsGroupNow();
  const edit = useEditSwitch(supabase);
  const unconfirmed = useViewAsUnconfirmed();
  if (!viewAs && !group) return null;

  const editItems: ReactNode[] = edit.shown
    ? [
        <SwitchButton key="edit" on={edit.on} onChange={setEditOn} className={ACTION}>
          <span data-view-as-edit="">Edit</span>
        </SwitchButton>,
        <SwitchButton key="draft" on={edit.previewDraft} onChange={setPreviewDraft} className={ACTION}>
          <span data-view-as-preview-draft="">Preview draft</span>
        </SwitchButton>,
      ]
    : [];
  const items: ReactNode[] = [
    // 0.8 View as fixes: the platform-admin check couldn't be answered on this load. View as is kept
    // (never the admin's own school); the data routes say "try again" until it can be.
    ...(unconfirmed
      ? [
          <span key="unconfirmed" data-view-as-unconfirmed="">Couldn&rsquo;t confirm View as just now</span>,
          <button key="retry" type="button" data-view-as-retry="" onClick={() => window.location.reload()} className={ACTION}>Retry</button>,
        ]
      : []),
    ...editItems,
    ...(viewAs ? [] : [<span key="ro">{VIEW_AS_READ_ONLY}</span>]),
    ...(actions ?? []),
    <button
      key="change"
      type="button"
      data-view-as-change=""
      onClick={() => openViewAs(viewAs ? { urn: viewAs.urn, name: viewAs.schoolName, role: viewAs.role } : { group: group! })}
      className={ACTION}
    >
      Change
    </button>,
    <button key="back" type="button" onClick={backToMe} className={ACTION}>Back to me</button>,
  ];
  const label = viewAs ? viewAsLabel(viewAs) : viewAsGroupLabel(group!);
  return (
    <div
      role="status"
      data-view-as-banner=""
      className={
        plain
          ? `flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 print:hidden ${className}`
          : `flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-2 text-sm text-[var(--muted2)] print:hidden ${className}`
      }
    >
      <span className={plain ? "font-semibold text-neutral-900 dark:text-neutral-100" : "font-semibold text-[var(--fg)]"}>
        {headline && viewAs ? (
          headline(viewAs)
        ) : edit.on ? (
          <>Editing the VicData dashboard for all schools · previewing as {label}</>
        ) : (
          <>Viewing as {label}</>
        )}
      </span>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span aria-hidden="true">·</span>
          {item}
        </Fragment>
      ))}
    </div>
  );
}
