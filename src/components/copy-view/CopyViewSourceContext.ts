"use client";

// VicData 0.6 S6: how a panel tells its Export menu what "Copy this view…" copies. The
// host (the config renderer, the editor, a meeting slot) wraps each panel in a provider
// with the panel's active view, its resolved context and its pinned settings; the Export
// menu (PanelFooter) shows "Copy this view…" only when there is a source AND it is drawn
// under a dashboard plan or on /dashboards/* -- so the live, hand-coded Teacher dashboards
// keep their two disabled options exactly.
//
// Kept tiny (types only) so every page that draws a panel doesn't pull in the dialog: the
// dialog itself is loaded on demand.
import { createContext, useContext } from "react";
import type { CopyViewSource } from "@/lib/copy-view";

export type { CopyViewSource };

export type CopyViewSourceValue = {
  source: CopyViewSource;
  // Super-admin may copy into VicData dashboards and sees draft views.
  superAdmin?: boolean;
  // Called after a copy, with where it went (the host may show a toast or refresh).
  onCopied?: (result: CopyViewResult) => void;
};

export type CopyViewResult =
  | { kind: "dashboard"; dashboardId: string; href: string; name: string; panelId: string; overridden: boolean; created: boolean }
  | { kind: "meeting"; meetingId: string; href: string; name: string; slideId: string; arrangement: string; created: boolean };

export const CopyViewSourceContext = createContext<CopyViewSourceValue | null>(null);

export function useCopyViewSource(): CopyViewSourceValue | null {
  return useContext(CopyViewSourceContext);
}
