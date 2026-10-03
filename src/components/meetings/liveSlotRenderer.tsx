"use client";

// VicData 0.6 E: the live renderer for meeting slots (S7's SlotRenderer contract). Each
// slot's figure is the real view, drawn by the same column host the Teacher dashboard uses
// -- TeacherDashboard in mode "embed", with a one-column, one-row, one-panel, one-view
// config built from the slot's dataview and its PinnedSettings:
//   school, phase, subject (and qualification), Candidates/Results and the Results
//   measure, the comparison (subjects: Context's category / all / selected; schools: a
//   saved set by name, else the 10 nearest), and the year.
// Year: a pinned (not kept-live) slot opens on its year where the host has a year control
// (Context's Current panel); everywhere else the host shows the latest data, and that is
// logged to the console, once per slot.
//
// The slot's own CardBox keeps the title, source, note, export and fullscreen, so this
// draws the figure alone ("figure" frame), filling the box S7 hands over. Several slots for
// one school share one fetch per route (lib/fetch-cache.ts).
import { useMemo, type ReactNode } from "react";
import type { PinnedSettings } from "@/lib/meeting-views";
import { TeacherDashboard } from "@/components/dashboard-config/TeacherDashboard";
import { oneViewConfig, oneViewPinned } from "@/components/dashboard-config/embed";
import { SlotRendererContext, type SlotRenderInput, type SlotRenderer } from "./SlotRendererContext";

const logged = new Set<string>();

function LiveSlot({ input }: { input: SlotRenderInput }) {
  const { slot, dataview: dv, pinned, keepLive, width, height, fullscreen } = input;
  const instanceId = slot.view?.id ?? slot.id;
  const pinKey = JSON.stringify(pinned);
  const built = useMemo(() => {
    if (!dv) return null;
    const p = JSON.parse(pinKey) as PinnedSettings;
    const { pinned: drawn, yearNote } = oneViewPinned(dv, p, keepLive);
    return { config: oneViewConfig(dv, p, `slot.${instanceId}`), pinned: drawn, yearNote };
  }, [dv, pinKey, keepLive, instanceId]);
  if (!built || !dv) return null;
  if (built.yearNote && !logged.has(instanceId)) {
    logged.add(instanceId);
    console.info(`[meetings] ${built.yearNote}`);
  }
  return (
    <div data-live-slot={dv.id} className="flex min-h-0 min-w-0 flex-col" style={fullscreen ? { flex: "1 1 auto" } : { width, height }}>
      <TeacherDashboard
        mode="embed"
        phase={built.config.columns[0].data.phase}
        school={pinned.schoolUrn ?? null}
        config={built.config}
        pinned={built.pinned}
        frame="figure"
        fullscreen={fullscreen}
      />
    </div>
  );
}

// S7's SlotRenderer: null (the data-free stand-in stays) when the slot has no registered
// view, no school, or a phase without a Teacher dashboard.
export const liveSlotRenderer: SlotRenderer = (input) => {
  const dv = input.dataview;
  if (!dv || !input.pinned.schoolUrn) return null;
  const phase = input.pinned.phase ?? dv.supports.phases[0];
  if (phase !== "ks4" && phase !== "ks5") return null;
  return <LiveSlot input={input} />;
};

// Wraps the meetings pages so every SlideCanvas draws live figures.
export function LiveSlotRendererProvider({ children }: { children: ReactNode }) {
  return <SlotRendererContext.Provider value={liveSlotRenderer}>{children}</SlotRendererContext.Provider>;
}
