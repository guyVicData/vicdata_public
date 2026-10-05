"use client";

// VicData 0.6.1 S4: a live preview of ANY ViewSpec, for a real school, at the real panel
// unit. The view is drawn the way the page draws it under the v2 renderer: a one-view embed
// of TeacherDashboard (the meeting slot's path, oneViewConfig) whose instance carries the
// draft spec, inside ViewsModeContext "v2" -- so its host hands the panel's frame to
// renderView(spec, frame), and a kind the renderer doesn't draw yet falls back to its host,
// exactly as on the page. The editor previews always render v2.
//
// `box` is the room in real pixels the figure is laid out in (the panel unit's body by
// default); the whole box is then scaled uniformly to `width`. A preview: it takes no clicks.
import { useMemo } from "react";
import type { ViewSpec } from "@/catalogue/viewspec";
import type { Dataview } from "@/catalogue/types";
import type { PinnedSettings } from "@/lib/meeting-views";
import { TeacherDashboard } from "@/components/dashboard-config/TeacherDashboard";
import { oneViewConfig, oneViewPinned } from "@/components/dashboard-config/embed";
import { ViewsModeContext } from "@/components/views";

export type PreviewPin = PinnedSettings & { schoolUrn: string };

export function SpecPreview({
  dataview,
  spec,
  pinned,
  params,
  box,
  width,
  id,
}: {
  dataview: Dataview;
  spec: ViewSpec;
  pinned: PreviewPin;
  params?: Record<string, unknown>;
  box: { width: number; height: number };
  width: number;
  id: string;
}) {
  const key = JSON.stringify([pinned, spec, params ?? null, dataview.id]);
  const built = useMemo(() => {
    const [p, s, prm] = JSON.parse(key) as [PreviewPin, ViewSpec, Record<string, unknown> | null];
    // As the page draws it on the pinned measure (asPage), never coerced to one the view's
    // figures support: the preview shows what members see on that measure.
    const config = oneViewConfig(dataview, p, `ve.${id}`, prm ?? undefined, undefined, { asPage: true });
    const panel = config.panels[0];
    const inst = panel.dataviews[0];
    if (inst.kind === "view") panel.dataviews = [{ ...inst, spec: s }];
    return { config, pinned: oneViewPinned(dataview, p, true, { asPage: true }).pinned };
  }, [dataview, key, id]);
  const scale = width / box.width;
  return (
    <div data-spec-preview={spec.view.kind} style={{ width, height: box.height * scale, overflow: "hidden", position: "relative" }}>
      <div inert style={{ width: box.width, height: box.height, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <ViewsModeContext.Provider value="v2">
          <TeacherDashboard mode="embed" phase={built.config.columns[0].data.phase} school={pinned.schoolUrn} config={built.config} pinned={built.pinned} frame="figure" />
        </ViewsModeContext.Provider>
      </div>
    </div>
  );
}
