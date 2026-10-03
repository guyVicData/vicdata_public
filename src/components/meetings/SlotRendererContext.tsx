"use client";

// VicData 0.6 S7: the hook point for a meeting slot's live figure.
//
// A slot's data render comes from the standalone dataview renderer another stage is
// building. Until it's plugged in, the context is absent and every slot shows a clear,
// data-free stand-in inside the same CardBox (rail icon, resolved title, "as of {year}").
//
// To plug in a renderer, wrap the meetings pages:
//   <SlotRendererContext.Provider value={(input) => <DataviewRenderer … />}>
// Return null for any slot it can't draw, and that slot keeps the stand-in.
import { createContext, useContext, type ReactNode } from "react";
import type { Dataview, SlideConfig } from "@/catalogue/types";
import type { PinnedSettings } from "@/lib/meeting-views";

export type SlotRenderInput = {
  // The stored slot: slot.view is the DataviewInstance (+ pinned, keepLive).
  slot: SlideConfig["slots"][number];
  // The registry entry (undefined when the id is no longer registered).
  dataview: Dataview | undefined;
  pinned: PinnedSettings;
  keepLive: boolean;
  // The figure's box inside the CardBox, in logical (unscaled) px.
  width: number;
  height: number;
  // CardBox renders its content twice while fullscreen is open: once in the card, once
  // in the modal.
  fullscreen: boolean;
};

export type SlotRenderer = (input: SlotRenderInput) => ReactNode | null;

export const SlotRendererContext = createContext<SlotRenderer | null>(null);

export function useSlotRenderer(): SlotRenderer | null {
  return useContext(SlotRendererContext);
}
