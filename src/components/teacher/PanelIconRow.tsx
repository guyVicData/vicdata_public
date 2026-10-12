"use client";

// VicData 0.7 admissions r3 (F1): the one panel icon row, shared by every Teacher panel
// (CardBox) and every Admissions panel and large view -- the same icons in the same places,
// always, so a panel reads the same whichever product it is in.
//
// The order is fixed, right-aligned, left to right:
//
//   1. menu        ···  the panel menu: Print this graph, Copy this view… (PanelExport)
//   2. fullscreen  ⤢   full screen (in the modal: exit full screen)
//   3. collapse    ⌃   close the panel (Teacher's accordion)
//
// A slot whose icon doesn't apply to a panel stays reserved, at its own width, so the others
// never move: an Admissions panel (rows collapse, not panels) keeps an empty third slot, and a
// meeting slide's panel the same. The notes stay in the footer, as Teacher's always have (the
// source "i", the caption, the private note), with the flag at the footer's right.
import type { ReactNode } from "react";

export const PANEL_ICON_ORDER = ["menu", "fullscreen", "collapse"] as const;

// Each slot reserves its WIDTH only: the menu and full screen buttons are 24px wide, the collapse
// button Teacher's 26px IconButton. The height is the content's, so an empty slot adds no height
// and a panel's header is exactly as tall as it was (24px, or 26px with the collapse button).
const SLOT: Record<(typeof PANEL_ICON_ORDER)[number], string> = {
  menu: "w-6",
  fullscreen: "w-6",
  collapse: "w-[26px]",
};

export function PanelIconRow({ menu, fullscreen, collapse }: { menu?: ReactNode; fullscreen?: ReactNode; collapse?: ReactNode }) {
  const slots: Record<(typeof PANEL_ICON_ORDER)[number], ReactNode> = { menu, fullscreen, collapse };
  return (
    <div data-panel-icons="" className="flex shrink-0 items-center gap-0.5 print:hidden">
      {PANEL_ICON_ORDER.map((k) => (
        <span key={k} data-panel-icon={k} className={`flex shrink-0 items-center justify-center ${SLOT[k]}`}>
          {slots[k] ?? null}
        </span>
      ))}
    </div>
  );
}
