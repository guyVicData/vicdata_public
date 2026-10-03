"use client";

// Pick's empty state (Ch3Empty.dc.html; combinations doc §4.3, scope brief §4.6a): one-tap
// loosening with a count of the views each unlocks, then -- for super-admin -- "Add a
// placeholder" (description, rough shape, notes; the exact context is saved), and for
// everyone else "Ask for this view" (logged to view_requests).
import type { PickPanelContext } from "@/catalogue/pick";
import { headerLine, summaryLine, VIEW_TYPE_LABEL } from "@/catalogue/pick";
import type { ViewType } from "@/catalogue/types";
import { Body, Footer, PrimaryButton, SecondaryButton } from "@/components/teacher/chooser/ui";
import { AvHeader, BoardChip, ContextBox, CountBadge, StepLabel, fieldStyle } from "./bits";

export type Relaxation = { id: "no-compare" | "over-time" | "latest"; label: string; count: number };

const RELAX_LABEL: Record<Relaxation["id"], string> = {
  "no-compare": "Without the comparison",
  "over-time": "Over time instead",
  latest: "Latest year instead",
};

const SHAPES: (ViewType | null)[] = ["graph", "ranking", "map", "table", "numerical", null];

const relaxStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid var(--cc-border)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "var(--cc-panel)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--cc-ink)",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export type EmptyDraft = { description: string; shape: ViewType | null; notes: string };

export function EmptyScreen({
  ctx,
  superAdmin,
  relaxations,
  draft,
  onDraft,
  asked,
  askError,
  busy,
  onRelax,
  onChangeData,
  onBack,
  onClose,
  onSubmit,
}: {
  ctx: PickPanelContext;
  superAdmin: boolean;
  relaxations: Relaxation[];
  draft: EmptyDraft;
  onDraft: (d: EmptyDraft) => void;
  asked: boolean;
  askError: string | null;
  busy: boolean;
  onRelax: (id: Relaxation["id"]) => void;
  onChangeData: () => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <AvHeader title="Add a view" subtitle={headerLine(ctx)} segs={null} onBack={onBack} onClose={onClose} />
      <Body gap={10}>
        <ContextBox label="From this column" line={summaryLine(ctx, true)} />
        <div style={{ textAlign: "center", padding: "8px 10px 2px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cc-ink)" }}>Nothing built for this yet</div>
          <div style={{ fontSize: 12.5, color: "var(--cc-sub)", marginTop: 4, lineHeight: 1.45 }}>Try loosening one choice, or {superAdmin ? "plan the view you want" : "ask for the view you want"}.</div>
        </div>
        {relaxations.map((r) => (
          <button key={r.id} type="button" onClick={() => onRelax(r.id)} style={relaxStyle}>
            {RELAX_LABEL[r.id]}
            <CountBadge n={r.count} />
          </button>
        ))}
        <button type="button" onClick={onChangeData} style={relaxStyle}>
          Change data&hellip;
        </button>

        {superAdmin ? (
          <div style={{ border: "1.5px dashed var(--cc-gold)", borderRadius: 12, padding: 12, background: "var(--av-plan-bg)", display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: "#ffffff", background: "var(--cc-gold)", borderRadius: 999, padding: "2px 8px" }}>SUPER-ADMIN</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--cc-ink)" }}>Add a placeholder</span>
            </div>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => onDraft({ ...draft, description: e.target.value })}
              placeholder="What should it show?"
              aria-label="What should it show"
              style={fieldStyle}
            />
            <StepLabel>Rough shape</StepLabel>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {SHAPES.map((s) => (
                <BoardChip
                  key={s ?? "unsure"}
                  size="md"
                  active={draft.shape === s}
                  onClick={() => onDraft({ ...draft, shape: s })}
                >
                  {s ? VIEW_TYPE_LABEL[s] : "Not sure"}
                </BoardChip>
              ))}
            </div>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => onDraft({ ...draft, notes: e.target.value })}
              placeholder="Notes for the build"
              aria-label="Notes for the build"
              style={{ ...fieldStyle, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "var(--av-plan-ink)", lineHeight: 1.4 }}>
              Shows on the dashboard as a dashed &ldquo;Planned&rdquo; panel. Its context is saved exactly, so the build brief can be written from it.
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid var(--cc-border)", borderRadius: 12, padding: 12, background: "var(--cc-soft)", display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--cc-ink)" }}>Ask for this view</span>
            {asked ? (
              <div style={{ fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.45 }}>Thanks &mdash; it&apos;s on VicData&apos;s list of views to build, with exactly this column&apos;s settings.</div>
            ) : (
              <>
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => onDraft({ ...draft, description: e.target.value })}
                  placeholder="What would you like it to show? (optional)"
                  aria-label="What would you like it to show"
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <div style={{ fontSize: 11, color: "var(--cc-faint)", lineHeight: 1.4 }}>Sends this column&apos;s exact settings to VicData as a request, so the gaps people hit become what gets built next.</div>
              </>
            )}
            {askError && <div style={{ fontSize: 11.5, color: "var(--cc-danger)" }}>Couldn&apos;t send it: {askError}</div>}
          </div>
        )}
      </Body>
      <Footer>
        <SecondaryButton onClick={onClose}>{asked ? "Close" : "Cancel"}</SecondaryButton>
        {!asked && (
          <PrimaryButton onClick={onSubmit} disabled={busy || (superAdmin && !draft.description.trim())}>
            {superAdmin ? "Add placeholder" : busy ? "Sending…" : "Ask for this view"}
          </PrimaryButton>
        )}
      </Footer>
    </>
  );
}
