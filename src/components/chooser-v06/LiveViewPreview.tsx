"use client";

// VicData 0.6 E: the chooser's live preview of one view -- the real panel, for a real
// school, drawn by the same embed path as a meeting slot (TeacherDashboard mode "embed",
// a one-view config) and scaled uniformly from the panel unit (351 x 384, PANEL_UNIT) to
// the box it's given. A preview: it takes no clicks.
//
// PickPreview uses it when a school context is available, and keeps its data-free glyph
// otherwise.
import { useMemo } from "react";
import type { Dataview } from "@/catalogue/types";
import { PANEL_UNIT } from "@/catalogue/config";
import type { PinnedSettings } from "@/lib/meeting-views";
import { TeacherDashboard } from "@/components/dashboard-config/TeacherDashboard";
import { oneViewConfig, oneViewPinned } from "@/components/dashboard-config/embed";

// The school context a live preview needs: at least the school; the rest as pinned.
export type LivePreviewContext = PinnedSettings & { schoolUrn: string };

// `frame`: "card" (default) draws the whole panel, as a Pick card shows it; "figure" draws
// the figure alone, for a caller that brings its own panel chrome (the editor).
// `params`: the view instance's own settings (a tiles view's figures), drawn as set.
export function LiveViewPreview({ dataview, context, width, height, frame = "card", params }: { dataview: Dataview; context: LivePreviewContext; width: number; height: number; frame?: "card" | "figure"; params?: Record<string, unknown> }) {
  const key = JSON.stringify(context);
  const paramsKey = params ? JSON.stringify(params) : "";
  const built = useMemo(() => {
    const p = JSON.parse(key) as LivePreviewContext;
    const viewParams = paramsKey ? (JSON.parse(paramsKey) as Record<string, unknown>) : undefined;
    return { config: oneViewConfig(dataview, p, `preview.${dataview.id}`, viewParams), pinned: oneViewPinned(dataview, p, false).pinned };
  }, [dataview, key, paramsKey]);
  // The panel unit plus CardBox's own 12px top margin.
  const unitHeight = PANEL_UNIT.height + 12;
  const scale = Math.min(width / PANEL_UNIT.width, height / unitHeight);
  return (
    <div data-live-preview={dataview.id} style={{ width, height, overflow: "hidden", position: "relative" }}>
      <div
        inert
        style={{
          width: PANEL_UNIT.width,
          height: unitHeight,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          left: (width - PANEL_UNIT.width * scale) / 2,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <TeacherDashboard mode="embed" phase={built.config.columns[0].data.phase} school={context.schoolUrn} config={built.config} pinned={built.pinned} frame={frame} />
      </div>
    </div>
  );
}
