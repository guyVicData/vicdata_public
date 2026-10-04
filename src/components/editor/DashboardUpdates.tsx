"use client";

// VicData 0.6 integration, G1: a VicData dashboard's new version is an upgrade. On a visit
// this carries the viewer's own per-panel state across from the version it was written
// against (upgradeUserState: kept where the panel survives, the new default elsewhere),
// then shows S5's dismissible "Updated — what's changed" line (UpdatedNotice). Renders
// nothing while the S2 tables aren't there, for newcomers, and for anyone up to date.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { listVersions, loadDashboard, loadUserState, type VersionRow } from "@/lib/dashboards-store";
import { upgradeUserState } from "@/lib/editor-upgrade";
import { UpdatedNotice } from "./UpdatedNotice";

// The version a stored state row was written against (DashboardUserState.version), or null.
export function stateVersionOf(state: unknown): number | null {
  const v = (state as { version?: unknown } | null)?.version;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function DashboardUpdates({ dashboardId, version, schoolUrn }: { dashboardId: string; version: VersionRow; schoolUrn: string | null }) {
  useEffect(() => {
    if (!schoolUrn) return;
    let live = true;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const row = await loadUserState(supabase, dashboardId, schoolUrn);
        const from = row ? stateVersionOf(row.state) : null;
        if (!live || from === null || from >= version.version) return;
        const prev = (await listVersions(supabase, dashboardId)).find((v) => v.version === from);
        if (!live || !prev) return;
        await upgradeUserState(supabase, dashboardId, schoolUrn, prev.config, version.config, version.version);
      } catch {
        /* never block the dashboard over an upgrade */
      }
    })();
    return () => {
      live = false;
    };
  }, [dashboardId, version, schoolUrn]);
  return <UpdatedNotice dashboardId={dashboardId} version={version.version} summary={version.change_summary} config={version.config} />;
}

// The same for a VicData dashboard known by its slug (the flagged Teacher page, which draws
// the config seeded in code): loads the stored row and its published version, and shows
// nothing -- no element at all -- unless the S2 tables hold it with a published version.
export function VicDataUpdatesBySlug({ slug, schoolUrn, className }: { slug: string; schoolUrn: string | null; className?: string }) {
  const [found, setFound] = useState<{ id: string; version: VersionRow } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const loaded = await loadDashboard(createBrowserSupabaseClient(), slug);
        if (!live) return;
        setFound(loaded?.available && loaded.row.owner_scope === "vicdata" && loaded.version ? { id: loaded.row.id, version: loaded.version } : null);
      } catch {
        if (live) setFound(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [slug]);
  if (!found) return null;
  return (
    <div className={className}>
      <DashboardUpdates dashboardId={found.id} version={found.version} schoolUrn={schoolUrn} />
    </div>
  );
}
