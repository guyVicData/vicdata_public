"use client";

// VicData 0.7 admissions r3 (F1): the one panel icon row, shared by every Teacher panel
// (CardBox) and every Admissions panel and large view -- the same icons in the same places,
// always, so a panel reads the same whichever product it is in.
//
// The order is fixed, right-aligned, left to right:
//
//   1. fullscreen  ⤢   full screen (in the modal: exit full screen)
//   2. collapse    ⌃   close the panel (Teacher's accordion)
//
// A slot whose icon doesn't apply to a panel stays reserved, at its own width, so the others
// never move: an Admissions panel (rows collapse, not panels) keeps an empty collapse slot, and a
// meeting slide's panel the same. The notes stay in the footer, as Teacher's always have.
//
// 0.8 notes and feedback (decision 2): the three-dots menu, this row's first slot since 0.7 r3, moved
// down to the footer's right (PanelFooter.tsx PanelExport). The row keeps full screen and the
// reserved collapse slot only.
import type { ReactNode } from "react";

export const PANEL_ICON_ORDER = ["fullscreen", "collapse"] as const;

// Each slot reserves its WIDTH only: the full screen button is 24px wide, the collapse button
// Teacher's 26px IconButton. The height is the content's, so an empty slot adds no height and a
// panel's header is exactly as tall as it was (24px, or 26px with the collapse button).
const SLOT: Record<(typeof PANEL_ICON_ORDER)[number], string> = {
  fullscreen: "w-6",
  collapse: "w-[26px]",
};

export function PanelIconRow({ fullscreen, collapse }: { fullscreen?: ReactNode; collapse?: ReactNode }) {
  const slots: Record<(typeof PANEL_ICON_ORDER)[number], ReactNode> = { fullscreen, collapse };
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
