"use client";

// VicData 0.6 integration: the editor's panel body drawn live (E's LiveViewPreview) for a
// school -- super-admin's look-as school, else their own membership school. The school
// comes through EditorSchoolContext (so this stays one static component, as the editor's
// `Preview` prop wants); with no school it is the data-free stand-in.
//
// 0.6.1 S4: the editor previews always render v2 -- the instance's own spec through
// renderView (SpecPreview), so a view of its own previews as itself, not as its preset.
import { createContext, useContext } from "react";
import dynamic from "next/dynamic";
import type { PreviewPin } from "@/components/view-editor/SpecPreview";
import { dataviewById } from "@/catalogue";
import { contextFromPanel } from "@/catalogue/pick";
import { pinFromContext, type PinSchool } from "@/lib/pin-context";
import { DataFreePreview, type PanelPreviewProps } from "./PanelPreview";
import { EditorVariantsContext } from "./EditorPanel";

const SpecPreview = dynamic(() => import("@/components/view-editor/SpecPreview").then((m) => m.SpecPreview), { ssr: false });

export const EditorSchoolContext = createContext<PinSchool>(null);

export function LivePanelPreview(props: PanelPreviewProps) {
  const school = useContext(EditorSchoolContext);
  const variants = useContext(EditorVariantsContext);
  const dv = dataviewById(props.view.dataview);
  if (!school || !dv) return <DataFreePreview {...props} />;
  let pinned;
  try {
    pinned = pinFromContext(contextFromPanel(props.config, props.panel.id, props.labels), dv, school);
    // 0.6 snag 4 / 02: a Context view previews on the edit bar's Compare against set.
    const against = variants?.state.compareAgainst;
    if (against && dv.host.id === "teacher.c2.context")
      pinned = { ...pinned, params: { ...(pinned.params ?? {}), against, ...(against === "selected" && variants?.contextSelected ? { selected: variants.contextSelected } : {}) } };
  } catch {
    return <DataFreePreview {...props} />;
  }
  return (
    <div data-preview="live" style={{ width: props.width, height: props.height, borderRadius: 8, overflow: "hidden" }}>
      <SpecPreview id={props.view.id} dataview={dv} spec={props.view.spec} params={props.view.params} pinned={{ ...pinned, schoolUrn: school.urn } as PreviewPin} box={{ width: props.width, height: props.height }} width={props.width} />
    </div>
  );
}
