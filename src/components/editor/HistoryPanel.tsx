"use client";

// VicData 0.6 S5: History (docs/wireframes/v0.6/History.dc.html; scope brief §4.8): the
// draft, then every published version newest first, each with Preview (read-only),
// Restore (makes a new draft, so it can be undone) and Compare (the change summary).
import { useState } from "react";
import type { DashboardConfig } from "@/catalogue/types";
import type { VersionRow } from "@/lib/dashboards-store";
import { EC, EDITOR } from "@/lib/editor-layout";
import { changeSummary } from "@/lib/editor-ops";

const when = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

function Act({ children, onClick, danger = false, muted = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ border: "none", background: "transparent", color: danger ? EC.danger : muted ? "var(--muted2)" : EC.amberText, fontSize: 11.5, fontWeight: 700, padding: 0, cursor: "pointer" }}>
      {children}
    </button>
  );
}

// Inline-markdown *emphasis* in a summary, as plain text.
export const plainSummary = (s: string | null) => (s ?? "").replace(/\*([^*]+)\*/g, "$1");

export function HistoryPanel({
  draft,
  dirty,
  savedLine,
  versions,
  publishedId,
  available,
  previewing,
  onPreview,
  onRestore,
  onPublish,
  onDiscard,
  onClose,
}: {
  draft: DashboardConfig;
  dirty: boolean;
  savedLine: string;
  versions: VersionRow[];
  publishedId: string | null;
  available: boolean;
  previewing: string | null;
  onPreview: (v: VersionRow | null) => void;
  onRestore: (v: VersionRow) => void;
  onPublish: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const [comparing, setComparing] = useState<string | null>(null);
  const live = versions.find((v) => v.id === publishedId) ?? null;
  const card = (sel: boolean, dashed = false) =>
    ({ border: `1px ${dashed ? "dashed" : "solid"} ${sel ? EC.amber : "var(--panel-border2)"}`, borderRadius: 10, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6, background: sel ? EC.barBg : "var(--panel-bg)" }) as const;
  return (
    <aside aria-label="History" style={{ width: EDITOR.historyWidth, flexShrink: 0, background: "var(--box-bg)", border: "1px solid var(--panel-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", alignSelf: "flex-start", maxHeight: "calc(100dvh - 140px)", position: "sticky", top: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>History</div>
        <Act muted onClick={onClose}>
          Close
        </Act>
      </div>

      <div style={card(previewing === null, true)}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: EC.amberText }}>Draft</span>
          <span style={{ fontSize: 11, color: "var(--muted2)" }}>{savedLine}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--chip-fg)", lineHeight: 1.45 }}>
          {live ? `Since v${live.version}: ` : ""}
          {plainSummary(changeSummary(live?.config ?? null, draft)).replace(/^./, (c) => (live ? c.toLowerCase() : c))}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {previewing !== null && <Act onClick={() => onPreview(null)}>Back to draft</Act>}
          <Act onClick={onPublish}>Publish</Act>
          {available && dirty && live && (
            <Act danger onClick={onDiscard}>
              Discard draft
            </Act>
          )}
        </div>
      </div>

      {!available && <div style={{ fontSize: 12, color: "var(--muted2)", lineHeight: 1.45 }}>Versions need the database update. Until then the draft lives in this tab only.</div>}
      {available && versions.length === 0 && <div style={{ fontSize: 12, color: "var(--muted2)", lineHeight: 1.45 }}>Not published yet. Publish makes version 1.</div>}

      {versions.map((v) => {
        const isLive = v.id === publishedId;
        const sel = previewing === v.id;
        return (
          <div key={v.id} style={card(sel)}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Version {v.version}
                {isLive ? " · live" : ""}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted2)" }}>{when(v.created_at)}</span>
            </div>
            {v.label && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--chip-fg)" }}>&ldquo;{v.label}&rdquo;</div>}
            <div style={{ fontSize: 12, color: "var(--muted2)", lineHeight: 1.45 }}>{plainSummary(v.change_summary) || "No summary."}</div>
            <div style={{ display: "flex", gap: 14 }}>
              <Act onClick={() => onPreview(sel ? null : v)}>{sel ? "Previewing" : "Preview"}</Act>
              {!isLive || sel ? <Act onClick={() => onRestore(v)}>Restore</Act> : null}
              <Act onClick={() => setComparing(comparing === v.id ? null : v.id)}>{isLive ? "Compare with draft" : "Compare"}</Act>
            </div>
            {sel && <div style={{ fontSize: 11, color: "var(--muted2)" }}>Restore makes a new draft from this version, so it can be undone.</div>}
            {comparing === v.id && (
              <div style={{ fontSize: 11.5, color: "var(--chip-fg)", lineHeight: 1.45, borderTop: "1px solid var(--panel-border)", paddingTop: 6 }}>
                <span style={{ color: "var(--muted2)" }}>From v{v.version} to the draft: </span>
                {plainSummary(changeSummary(v.config, draft))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: "var(--muted3)", lineHeight: 1.45 }}>
        Publishing a VicData dashboard is an upgrade for everyone using it: notes and open rows carry over where panels survive; changed panels open at their new default.
      </div>
    </aside>
  );
}
