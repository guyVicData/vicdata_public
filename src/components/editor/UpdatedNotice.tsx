"use client";

// VicData 0.6 S5, G1: "Updated — what's changed", a dismissible line on the first visit
// after a VicData dashboard publishes a new version, written from that version's change
// summary. The live renderer mounts it above the dashboard:
//
//   <UpdatedNotice dashboardId={row.id} version={version.version} summary={version.change_summary} />
//
// It reads and writes the viewer's own dashboard_user_state.seen_version (school_urn ''
// -- seeing an update isn't per school). A viewer with no row yet is recorded silently at
// this version: the line is for people who used the previous version, not newcomers.
// Shows nothing while the S2 tables aren't there. Per-panel state carries over by
// carryUserState (src/catalogue/config.ts); see upgradeUserState in src/lib/editor-upgrade.ts.
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loadUserState, saveUserState } from "@/lib/dashboards-store";
import { EC } from "@/lib/editor-layout";

export type UpdatedNoticeProps = {
  // The dashboards row id (uuid): dashboard_user_state keys on it.
  dashboardId: string;
  // The published version number the viewer is looking at.
  version: number;
  // That version's change_summary (inline *emphasis* allowed).
  summary: string | null;
};

export function UpdatedNotice({ dashboardId, version, summary }: UpdatedNoticeProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const s = await loadUserState(supabase, dashboardId, "");
        if (!live) return;
        if (!s || s.seen_version == null) {
          // First visit (or no table): record where they start, show nothing.
          await saveUserState(supabase, dashboardId, "", { seen_version: version });
          return;
        }
        if (s.seen_version < version) setShow(true);
      } catch {
        /* never block the dashboard over a notice */
      }
    })();
    return () => {
      live = false;
    };
  }, [supabase, dashboardId, version]);

  if (!show) return null;
  const dismiss = async () => {
    setShow(false);
    try {
      await saveUserState(supabase, dashboardId, "", { seen_version: version });
    } catch {
      /* dismissed for this visit anyway */
    }
  };
  const parts = (summary ?? "").split(/\*([^*]+)\*/g);
  return (
    <div role="status" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "4px 10px", background: EC.barBg, border: `1px solid ${EC.barBorder}`, borderRadius: 12, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.45, color: "var(--fg)" }}>
      <span style={{ fontWeight: 700, color: EC.amberText, whiteSpace: "nowrap" }}>Updated &mdash; what&apos;s changed</span>
      <span style={{ flex: "1 1 240px", color: "var(--chip-fg)" }}>
        {summary ? parts.map((p, i) => (i % 2 ? <em key={i} style={{ fontStyle: "normal", fontWeight: 600, color: "var(--fg)" }}>{p}</em> : p)) : `This dashboard is now version ${version}.`}
      </span>
      <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ border: "none", background: "transparent", color: "var(--muted2)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
        Dismiss
      </button>
    </div>
  );
}
