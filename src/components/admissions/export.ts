"use client";

// VicData 0.7 admissions r2 (D8): a panel's ··· menu -- print the view (its fullscreen, printed
// alone, as Teacher's "Print this graph"), and copy it to a meeting's slides (Teacher's own Copy
// this view dialog, to a meeting only: a custom dashboard draws Teacher's hosts). The slide pins
// the school and the entry point; meetings draw it live from the same routes.
import type { DataviewInstance } from "@/catalogue/types";
import type { PickPanelContext } from "@/catalogue/pick";
import type { CopyViewSource } from "@/lib/copy-view";
import type { PanelMenuAction } from "./ui";

type Ctx = { member: { schoolUrn: string; schoolName: string; viewAs: unknown }; entry: string | null; filters: Record<string, unknown> };

export function copySource(instance: Extract<DataviewInstance, { kind: "view" }>, c: Ctx, title: string, context: PickPanelContext): CopyViewSource {
  return {
    instance,
    context,
    title: `${title} · ${c.entry ?? ""}`,
    pinned: { schoolUrn: c.member.schoolUrn, schoolName: c.member.schoolName, params: { entry: c.entry, filters: c.filters }, keepLive: true },
  };
}

export function copyActions(open: { print: () => void; copy: (() => void) | null }): PanelMenuAction[] {
  return [
    { label: "Print this view", onClick: open.print },
    ...(open.copy ? [{ label: "Copy to meeting slides…", onClick: open.copy }] : []),
  ];
}
