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
import { useState, type ReactNode } from "react";
import { CardBox } from "./CardBox";
import { IconButton, PANEL_PICKER_ICONS, PlusIcon, RemoveIcon } from "./PanelIcons";
import { MenuCardRow, MenuHeading, PanelMenu, useDismiss } from "./PanelMenu";
import { PANEL_ORDER, addPanel, canRemovePanel, removePanel, type PanelId } from "@/lib/teacher-view-panels";

export type PanelRender = {
  // The pill at the top-left of the panel: "Current — 2024/25", "Candidates — 2021/22 to
  // 2024/25".
  tag: string;
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

const ADD_LABEL: Record<PanelId, string> = {
  current: "Current snapshot",
  trend: "Trend over time",
  change: "% change",
};

export function ColumnPanels({
  columnId,
  panels,
  onPanelsChange,
  controls,
  changeLabel,
  render,
}: {
  columnId: string;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  // The column's own header controls -- Results' measure pill, Context's combined picker,
  // Comparisons' two pills. Rendered to the left of Add.
  controls?: ReactNode;
  // "% change in candidate numbers" / "% change in average point score": the Add row
  // names the measure it would actually plot, so picking it is not a guess.
  changeLabel?: string;
  render: Partial<Record<PanelId, PanelRender>>;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useDismiss(open, () => setOpen(false));

  const missing = PANEL_ORDER.filter((p) => !panels.includes(p) && render[p]);
  const removable = canRemovePanel(panels);

  return (
    <div>
      <div className="relative mt-2 flex items-start justify-between gap-2 print:hidden" ref={menuRef}>
        <div className="min-w-0">{controls}</div>
        {missing.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-haspopup="menu"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--fg)] bg-[var(--fg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--bg)]"
            >
              {PlusIcon}
              Add
            </button>
            {open && (
              <PanelMenu label="Add a view" align="right" width={268}>
                <MenuHeading>Add a view</MenuHeading>
                {missing.map((p) => (
                  <MenuCardRow
                    key={p}
                    icon={PANEL_PICKER_ICONS[p]}
                    label={p === "change" ? changeLabel ?? ADD_LABEL.change : ADD_LABEL[p]}
                    onClick={() => { onPanelsChange(addPanel(panels, p)); setOpen(false); }}
                  />
                ))}
              </PanelMenu>
            )}
          </div>
        )}
      </div>

      {PANEL_ORDER.filter((p) => panels.includes(p)).map((id) => {
        const panel = render[id];
        if (!panel) return null;
        return (
          <CardBox
            key={`${columnId}-${id}`}
            title={panel.tag}
            question={panel.question}
            tag={
              <span className="inline-block rounded-full bg-[rgba(var(--accent-rgb,138,138,144),0.14)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent,var(--muted2))]">
                {panel.tag}
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
