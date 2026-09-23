"use client";

// Teacher view, round 7 §1: the column's "+ Add" control.
//
// Lifted out of ColumnPanels so it can sit in the card's header row, where the wireframe
// puts it -- icon, title and subtitle on the left, Add on the right, one line. The panel
// state still belongs to the page, which owns persistence, so this takes the same
// `panels`/`onPanelsChange` pair ColumnPanels does rather than reaching for a context.
//
// It disappears when all three panels are showing: there is nothing left to add, and a
// button that opens an empty menu is worse than no button.
import { useState } from "react";
import { PANEL_PICKER_ICONS, PlusIcon } from "./PanelIcons";
import { MenuCardRow, MenuHeading, PanelMenu, useDismiss } from "./PanelMenu";
import { PANEL_ORDER, addPanel, type PanelId } from "@/lib/teacher-view-panels";

export const ADD_LABEL: Record<PanelId, string> = {
  current: "Current snapshot",
  trend: "Trend over time",
  change: "% change",
};

export function AddPanelButton({
  panels,
  onPanelsChange,
  changeLabel,
}: {
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  // "% change in candidate numbers" / "% change in average point score": the row names
  // the measure it would actually plot, so picking it is not a guess.
  changeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const missing = PANEL_ORDER.filter((p) => !panels.includes(p));
  if (missing.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
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
  );
}
