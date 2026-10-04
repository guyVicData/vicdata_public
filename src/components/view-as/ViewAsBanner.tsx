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
// the footer's Edit switch and a "Preview draft" switch (Guy only, this tab only):
//
//   Viewing as SMT at Croydon College · Edit · Preview draft · Change · Start fresh · Back to me
//   Editing the VicData dashboard for all schools · previewing as SMT at Croydon College · Edit · …
import { Fragment, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { VISIBLE_ROLE_LABELS } from "@/lib/roles";
import { startViewAs, type ViewAs } from "@/lib/view-as";
import { setEditOn, setPreviewDraft, useEditSwitch } from "@/lib/edit-mode";
import { SwitchButton } from "@/components/edit-mode/EditSwitch";
import { backToMe, openViewAs, useViewAsNow } from "./ViewAs";

const roleLabel = (t: Pick<ViewAs, "role">) => VISIBLE_ROLE_LABELS[t.role];

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
  const edit = useEditSwitch(supabase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!viewAs) return null;

  async function startFresh(t: ViewAs) {
    setBusy(true);
    setError(null);
    const r = await startViewAs(supabase, { urn: t.urn, role: t.role, fresh: true, schoolName: t.schoolName });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

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
    ...editItems,
    ...(actions ?? []),
    <button key="change" type="button" onClick={() => openViewAs({ urn: viewAs.urn, name: viewAs.schoolName, role: viewAs.role })} className={ACTION}>Change</button>,
    <button key="fresh" type="button" onClick={() => startFresh(viewAs)} disabled={busy} className={ACTION}>
      {busy ? "Starting fresh…" : "Start fresh"}
    </button>,
    <button key="back" type="button" onClick={backToMe} className={ACTION}>Back to me</button>,
  ];
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
        {headline ? (
          headline(viewAs)
        ) : edit.on ? (
          <>Editing the VicData dashboard for all schools · previewing as {roleLabel(viewAs)} at {viewAs.schoolName}</>
        ) : (
          <>Viewing as {roleLabel(viewAs)} at {viewAs.schoolName}</>
        )}
      </span>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span aria-hidden="true">·</span>
          {item}
        </Fragment>
      ))}
      {error && <span role="alert" className="basis-full text-[12px]">{error}</span>}
    </div>
  );
}
