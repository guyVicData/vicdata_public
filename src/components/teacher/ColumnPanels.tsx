"use client";

// Teacher view, round 6: the card mechanism (brief §3, §6.6).
//
// This replaces ColumnBuilder. Round 5's shape was "one hardcoded default box that could
// not be removed, plus a tick-list of per-subject AXES views pinned beside it"; round 6's
// is three peers -- Current, Trend, % change -- any two of which can go, leaving whichever
// one the person kept. §6.6 settled that the axis tick-list is REPLACED rather than kept
// alongside, so there is no second add gesture here and no dormant copy of the old one.
//
// Three rules this component owns, so no column can implement them differently:
//   1. PANEL_ORDER is the render order, whatever order they were added in.
//   2. Add offers exactly the panels that are currently missing, and disappears when all
//      three are showing -- there is nothing left to add.
//   3. The remove control is always present and becomes DISABLED, not hidden, on the last
//      panel. §3 is explicit: "visibly present but greyed, so it's clear why it won't
//      respond". A hidden control reads as a missing feature; a greyed one reads as a
//      floor, which is what it is.
//
// Each column supplies its own panel contents through `render`; this file knows nothing
// about measures, subjects or schools.
import type { ReactNode } from "react";
import { CardBox } from "./CardBox";
import { ADD_LABEL } from "./AddPanelButton";
import { IconButton, RemoveIcon } from "./PanelIcons";
import { PanelExport, PanelNote } from "./PanelFooter";
import { PANEL_ORDER, canRemovePanel, removePanel, type PanelId } from "@/lib/teacher-view-panels";

// Round 8 §6: one private note per person per panel. The page owns the school and the
// Supabase client, so it supplies the reader and the writer and this only routes them.
export type PanelNotes = {
  bodyFor: (panelId: PanelId) => string | null;
  onSave: (panelId: PanelId, body: string) => Promise<void> | void;
};

export type PanelRender = {
  // The pill at the top-left of the panel: "Current — 2024/25", "Candidates — 2021/22 to
  // 2024/25".
  tag: string;
  // Controls that sit before the pill rather than in the icon row -- Context's year
  // prev/next pair, which the wireframe puts either side of the tag.
  beforeTag?: ReactNode;
  // The full natural-language question, used as the fullscreen modal's heading (§14).
  question: string;
  // View-toggle icons, which sit before the fullscreen button.
  actions?: ReactNode;
  // The chip row and pill row under the header.
  controls?: ReactNode;
  body: (fullscreen: boolean) => ReactNode;
  summary?: ReactNode;
  source?: ReactNode;
};

export function ColumnPanels({
  columnId,
  panels,
  onPanelsChange,
  controls,
  notes,
  render,
}: {
  columnId: string;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  // The column's own data controls -- Results' measure pill, Context's and Comparisons'
  // two pills each. They sit under the card header, above the panels; Add itself now
  // lives in that header (round 7 §1, AddPanelButton).
  controls?: ReactNode;
  // Round 8 §6: the private note, one per person per PANEL. Owned by the page, which holds
  // the school and the Supabase client; this just gives each panel its own slot.
  notes?: PanelNotes;
  render: Partial<Record<PanelId, PanelRender>>;
}) {
  const removable = canRemovePanel(panels);

  return (
    <div>
      {controls && <div className="mt-2.5 print:hidden">{controls}</div>}

      {PANEL_ORDER.filter((p) => panels.includes(p)).map((id) => {
        const panel = render[id];
        if (!panel) return null;
        return (
          <CardBox
            key={`${columnId}-${id}`}
            title={panel.tag}
            question={panel.question}
            tag={
              // Round 7 §2: plain text, no pill. The tinted pill it replaced read as a
              // button on the real dashboard, and nothing about a panel heading is
              // clickable. Scaled up from 11px so dropping the background is not read as
              // a demotion.
              <span className="flex flex-wrap items-center gap-1.5">
                {panel.beforeTag}
                <span className="text-[13px] font-semibold text-[var(--fg)]">{panel.tag}</span>
              </span>
            }
            actions={panel.actions}
            trailingActions={
              <IconButton
                label={
                  removable
                    ? `Remove the ${ADD_LABEL[id].toLowerCase()} view`
                    : `Cannot remove the ${ADD_LABEL[id].toLowerCase()} view — a card always keeps at least one`
                }
                disabled={!removable}
                onClick={() => onPanelsChange(removePanel(panels, id))}
              >
                {RemoveIcon}
              </IconButton>
            }
            controls={panel.controls}
            caption={panel.summary}
            source={panel.source}
            footerActions={({ print }) => (
              <>
                {notes && (
                  <PanelNote body={notes.bodyFor(id)} onSave={(body) => notes.onSave(id, body)} />
                )}
                <PanelExport onPrint={print} />
              </>
            )}
            // Round 8 §2: every panel the same height, so the three columns read as one
            // 3x3 grid rather than three ragged stacks.
            fixedHeight
          >
            {({ fullscreen }) => panel.body(fullscreen)}
          </CardBox>
        );
      })}
    </div>
  );
}

// The summary strip under a panel's figure -- the wireframe's own grey box. Trend's
// variant leads with a coloured direction word and arrow; everything else is one
// sentence. Shared so all four columns phrase their conclusion in the same shape.
export function PanelSummary({ lead, leadColour, children }: { lead?: string; leadColour?: string; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-baseline gap-1.5 rounded-lg bg-[var(--box-bg)] px-2.5 py-2 text-xs leading-relaxed text-[var(--muted2)]">
      {lead && <span className="font-bold whitespace-nowrap" style={{ color: leadColour }}>{lead}</span>}
      <span>{children}</span>
    </span>
  );
}
