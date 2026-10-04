"use client";

// VicData 0.6 S5: what a panel's body shows in the editor. PLUGGABLE: the editor renders
// whatever `PanelPreview` component it is given (DashboardEditor's `Preview` prop), and
// this default is a data-free stand-in -- the view's standard rail icon and its resolved
// title -- so the editor works with no school and no fetch. E's LiveViewPreview (the live
// renderer for one view) drops in with the same props.
import type { ComponentType } from "react";
import { dataviewById } from "@/catalogue";
import { contextFromPanel, instanceTitle, VIEW_TYPE_LABEL, type PanelLabels } from "@/catalogue/pick";
import type { DashboardConfig, DataviewInstance, PanelConfig } from "@/catalogue/types";
import { railGlyph } from "@/components/chooser-v06/bits";

export type PanelPreviewProps = {
  config: DashboardConfig;
  panel: PanelConfig;
  // The view the rail has selected (a placeholder never reaches here: the editor draws
  // planned views itself).
  view: Extract<DataviewInstance, { kind: "view" }>;
  // The body's box in px (inside the panel's header, rail and standard elements).
  width: number;
  height: number;
  // Display labels for title placeholders ("[subject]"...), when the host has a school.
  labels?: PanelLabels;
};

export type PanelPreviewComponent = ComponentType<PanelPreviewProps>;

export function DataFreePreview({ config, panel, view, width, height, labels }: PanelPreviewProps) {
  const dv = dataviewById(view.dataview);
  // 0.6 snag 4 / 01: the view's own title (resolved) when it has one, else its dataview's.
  let title = dv?.label ?? view.dataview;
  if (dv) {
    try {
      title = instanceTitle(view, contextFromPanel(config, panel.id, labels));
    } catch {
      title = dv.label;
    }
  }
  const when = dv ? (dv.supports.dateMode === "single" ? "latest year" : "over time") : "";
  return (
    <div
      data-preview="data-free"
      style={{ width, height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", borderRadius: 8, border: "1px dashed var(--panel-border2)", background: "var(--box-bg)", padding: 14, boxSizing: "border-box" }}
    >
      <span
        aria-hidden="true"
        className="ed-preview-glyph"
        style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(var(--accent-rgb,96,165,250),0.14)", color: "var(--accent,var(--muted2))", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {railGlyph(dv?.railIcon ?? "TilesIcon")}
      </span>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)", lineHeight: 1.35, maxWidth: "100%" }}>{title}</div>
      {dv && (
        <div style={{ fontSize: 11, color: "var(--muted3)" }}>
          {VIEW_TYPE_LABEL[dv.supports.viewType]} · {when}
          {dv.status === "draft" ? " · draft" : ""}
        </div>
      )}
    </div>
  );
}
