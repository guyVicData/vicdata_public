"use client";

// VicData 0.6 S5: one panel in edit mode (Editor.dc.html's .panel.edit), at the real panel
// unit: header (row tag, data year, inherits/overridden badge, ··· menu), the view rail
// (reorder by dragging; + opens Add a view), the body (PanelPreview, or a planned view),
// the standard elements, and a right-edge handle that drags the span in whole columns.
// Planned panels (Skeleton.dc.html) are dashed and striped; one whose placeholder matches a
// draft view shows "Ready to swap in".
//
// Snag 1 / 03: each rail icon has its own view menu. Hovering an icon (edit mode) turns it
// amber and shows a small amber "···" tab on its right edge, over the rail divider; the tab,
// a right-click or the keyboard opens the menu. The panel's ··· menu is panel-only.
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { dataviewById } from "@/catalogue";
import { contextFromPanel, latestYear, defaultFromYear, resolveTitle, viewTitle, VIEW_TYPE_LABEL, type PanelLabels } from "@/catalogue/pick";
import type { DashboardConfig, Dataview, DataviewInstance, PanelConfig } from "@/catalogue/types";
import { railGlyph } from "@/components/chooser-v06/bits";
import { MenuDivider, MenuHeading, MenuRow, PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import { EC, EDITOR, panelWidth } from "@/lib/editor-layout";
import { spanOf } from "@/lib/editor-ops";
import { EBtn, InheritBadge, OverrideBadge, PlusIcon, StandardElements, StatePill } from "./bits";
import type { PanelPreviewComponent } from "./PanelPreview";

// Panel menu: rename, override, move-panel, delete-panel. View menu (snag 1 / 03): the rest,
// each for one instance. "copy-view" copies to a panel on this dashboard; "copy-view-out"
// is Copy to another dashboard or meeting (S6's CopyViewDialog).
export type PanelAction =
  | "rename"
  | "override"
  | "move-panel"
  | "delete-panel"
  | "edit-view"
  | "swap-view"
  | "move-view"
  | "copy-view"
  | "copy-view-out"
  | "make-default"
  | "view-up"
  | "view-down"
  | "remove-view";

const HEADER = 22;

export function EditorPanel({
  config,
  panel,
  rowName,
  selected,
  ready,
  Preview,
  labels,
  readOnly,
  maxSpan,
  onSelect,
  onAddView,
  onAction,
  onReorder,
  onSwapIn,
  onSpan,
}: {
  config: DashboardConfig;
  panel: PanelConfig;
  rowName: string;
  selected: string | null;
  ready: Record<string, Dataview[]>;
  Preview: PanelPreviewComponent;
  labels?: PanelLabels;
  readOnly?: boolean;
  maxSpan: number;
  onSelect: (instanceId: string) => void;
  onAddView: () => void;
  onAction: (a: PanelAction, instanceId?: string) => void;
  onReorder: (from: number, to: number) => void;
  onSwapIn: (instanceId: string, dataview: Dataview) => void;
  onSpan: (cols: number) => void;
}) {
  const span = spanOf(panel);
  const width = panelWidth(units(config, panel));
  const view = panel.dataviews.find((v) => v.id === selected) ?? panel.dataviews.find((v) => v.id === panel.defaultView) ?? panel.dataviews[0];
  const allPlanned = panel.dataviews.length > 0 && panel.dataviews.every((v) => v.kind === "placeholder");
  const readyHits = view && view.kind === "placeholder" ? ready[view.id] : undefined;
  const [menu, setMenu] = useState(false);
  const menuRef = useDismiss(menu, () => setMenu(false));
  // The rail icon whose view menu is open.
  const [viewMenu, setViewMenu] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState<string | null>(null);
  const showReady = readyHits && !kept.has(view!.id);

  let ctxLine = "";
  try {
    const ctx = contextFromPanel(config, panel.id, labels);
    const dv = view && view.kind === "view" ? dataviewById(view.dataview) : undefined;
    ctxLine = dv?.supports.dateMode === "trend" || (!dv && ctx.time === "over_time") ? `from ${defaultFromYear(ctx) ?? "the first year"}` : `Data ${latestYear(ctx) ?? "latest year"}`;
  } catch {
    ctxLine = "";
  }
  const col = config.columns.find((c) => c.id === panel.column)!;
  const badge = panel.override ? (
    <OverrideBadge title={panel.override.reason}>{panel.override.badge}</OverrideBadge>
  ) : (
    <InheritBadge>{span > 1 ? `inherits ${col.title} (left-most column)` : "inherits column"}</InheritBadge>
  );

  // Body box: panel width less padding and the rail; height less header, gap and the
  // standard elements' strip.
  const bodyW = width - 28 - (EDITOR.railIcon + 19);
  const bodyH = EDITOR.unit.height - 12 - 36 - HEADER - 8;

  // Span drag: the right edge snaps to whole columns.
  const [drag, setDrag] = useState<{ x: number; cols: number } | null>(null);
  const startW = useRef(0);
  const unitW = EDITOR.unit.columnTrack + EDITOR.trackGap;

  const planned = allPlanned;
  const shell = {
    boxSizing: "border-box",
    width,
    height: EDITOR.unit.height,
    borderRadius: EDITOR.panelRadius,
    padding: EDITOR.panelPad,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    position: "relative",
    background: planned ? `repeating-linear-gradient(135deg, var(--panel-bg) 0 10px, ${EC.plannedStripe} 10px 20px)` : "var(--panel-bg)",
    border: showReady && planned ? `1.5px solid ${EC.ready}` : planned ? `1.5px dashed ${EC.gold}` : "1px solid var(--panel-border)",
    outline: readOnly ? "none" : `1px dashed ${EC.amber}`,
    outlineOffset: 3,
    zIndex: menu || viewMenu ? 20 : undefined,
  } as const;

  return (
    <div data-panel={panel.id} style={shell}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: HEADER, minWidth: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--chip-fg)", whiteSpace: "nowrap" }}>{panel.name ?? rowName}</span>
        {ctxLine && <span style={{ fontSize: 11.5, color: "var(--muted2)", whiteSpace: "nowrap" }}>{ctxLine}</span>}
        {badge}
        <span style={{ flexGrow: 1 }} />
        {!readOnly && (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              aria-label="Panel menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1px solid transparent", background: menu ? EC.hover : "transparent", color: menu ? "var(--fg)" : "var(--muted2)", padding: 0, cursor: "pointer", fontSize: 13, letterSpacing: 1 }}
            >
              ···
            </button>
            {menu && (
              <PanelMenu label="Panel menu" align="right" width={EDITOR.panelMenuWidth}>
                {(
                  [
                    ["rename", "Rename panel", undefined],
                    ["override", "Change data / compared to…", "override"],
                    ["move-panel", "Move panel", undefined],
                  ] as [PanelAction, string, string | undefined][]
                ).map(([id, label, tag]) => (
                  <MenuRow key={id} label={label} tag={tag} onClick={() => { setMenu(false); onAction(id); }} />
                ))}
                <MenuDivider />
                <button
                  type="button"
                  onClick={() => { setMenu(false); onAction("delete-panel"); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-[7px] text-left text-[13px] font-medium hover:bg-[var(--box-bg)]"
                  style={{ color: EC.danger }}
                >
                  Delete panel
                </button>
              </PanelMenu>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <div className="ed-rail" style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, padding: "1px 9px 2px 0", borderRight: "1px solid var(--panel-border)", marginRight: 9 }}>
          {panel.dataviews.map((v, i) => (
            <RailButton
              key={v.id}
              v={v}
              active={v.id === view?.id}
              ready={!!ready[v.id]}
              draggable={!readOnly}
              menu={
                readOnly
                  ? null
                  : {
                      open: viewMenu === v.id,
                      title: viewLabel(config, panel, v, labels),
                      index: i,
                      count: panel.dataviews.length,
                      opening: (panel.dataviews.some((x) => x.id === panel.defaultView) ? panel.defaultView : panel.dataviews[0]?.id) === v.id,
                      onOpen: (open) => {
                        setViewMenu(open ? v.id : null);
                        if (open) onSelect(v.id);
                      },
                      onAction: (a) => {
                        setViewMenu(null);
                        onAction(a, v.id);
                      },
                    }
              }
              onClick={() => onSelect(v.id)}
              onDragStart={() => setDragFrom(i)}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== i) onReorder(dragFrom, i);
                setDragFrom(null);
              }}
            />
          ))}
          {!readOnly && (
            <button
              type="button"
              aria-label="Add a view"
              title="Add a view"
              onClick={onAddView}
              style={{ width: EDITOR.railIcon, height: EDITOR.railIcon, borderRadius: 5, border: `1px dashed ${EC.amber}`, color: EC.amber, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", padding: 0, cursor: "pointer" }}
            >
              <PlusIcon />
            </button>
          )}
        </div>
        <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {!view ? null : view.kind === "placeholder" ? (
            previewing && readyHits ? (
              <SwapPreview
                Preview={Preview}
                config={config}
                panel={panel}
                dv={readyHits.find((d) => d.id === previewing) ?? readyHits[0]}
                width={bodyW}
                height={bodyH - 40}
                onSwap={(dv) => { setPreviewing(null); onSwapIn(view.id, dv); }}
                onCancel={() => setPreviewing(null)}
                labels={labels}
              />
            ) : (
              <PlannedBody v={view} ready={showReady ? readyHits : undefined} onPreview={(dv) => setPreviewing(dv.id)} onKeep={() => setKept(new Set([...kept, view.id]))} />
            )
          ) : (
            <Preview config={config} panel={panel} view={view} width={bodyW} height={bodyH} labels={labels} />
          )}
        </div>
      </div>

      <StandardElements />

      {!readOnly && maxSpan > 1 && (
        <div
          role="slider"
          aria-label="Panel span in columns"
          aria-valuemin={1}
          aria-valuemax={maxSpan}
          aria-valuenow={drag?.cols ?? span}
          tabIndex={0}
          title="Drag to span more or fewer columns"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" && span < maxSpan) onSpan(span + 1);
            if (e.key === "ArrowLeft" && span > 1) onSpan(span - 1);
          }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            startW.current = e.clientX;
            setDrag({ x: e.clientX, cols: span });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            const cols = Math.max(1, Math.min(maxSpan, span + Math.round((e.clientX - startW.current) / unitW)));
            if (cols !== drag.cols) setDrag({ x: e.clientX, cols });
          }}
          onPointerUp={() => {
            if (drag && drag.cols !== span) onSpan(drag.cols);
            setDrag(null);
          }}
          style={{ position: "absolute", top: 0, bottom: 0, right: -EDITOR.spanHandle / 2, width: EDITOR.spanHandle, cursor: "ew-resize", zIndex: 2 }}
        />
      )}
      {drag && drag.cols !== span && (
        <div aria-hidden="true" style={{ position: "absolute", top: -3, left: -3, height: EDITOR.unit.height + 6, width: panelWidth(drag.cols) + 6, border: `2px solid ${EC.amber}`, borderRadius: EDITOR.panelRadius + 3, pointerEvents: "none", zIndex: 3 }} />
      )}
    </div>
  );
}

function units(config: DashboardConfig, p: PanelConfig): number {
  const start = config.columns.findIndex((c) => c.id === p.column);
  return config.layout.tracks.slice(start, start + spanOf(p)).reduce((a, b) => a + b, 0) || 1;
}

// The view's resolved title, for the view menu's heading.
function viewLabel(config: DashboardConfig, panel: PanelConfig, v: DataviewInstance, labels?: PanelLabels): string {
  if (v.kind === "placeholder") return v.description;
  const dv = dataviewById(v.dataview);
  if (!dv) return v.title ?? v.dataview;
  try {
    const ctx = contextFromPanel(config, panel.id, labels);
    const fromYear = typeof v.params?.fromYear === "string" ? v.params.fromYear : null;
    return v.title ? resolveTitle(v.title, dv, ctx, { fromYear }) : viewTitle(dv, ctx);
  } catch {
    return v.title ?? dv.label;
  }
}

type RailMenu = {
  open: boolean;
  title: string;
  index: number;
  count: number;
  opening: boolean;
  onOpen: (open: boolean) => void;
  onAction: (a: PanelAction) => void;
};

// One rail icon. In edit mode it sits in .ed-rv with its "···" tab and view menu; the hover,
// focus and touch states are CSS in DashboardEditor's style block (.ed-rv).
function RailButton({ v, active, ready, draggable, menu, onClick, onDragStart, onDrop }: { v: DataviewInstance; active: boolean; ready: boolean; draggable: boolean; menu: RailMenu | null; onClick: () => void; onDragStart: () => void; onDrop: () => void }) {
  const dv = v.kind === "view" ? dataviewById(v.dataview) : undefined;
  const label = v.kind === "view" ? (v.title ?? dv?.label ?? v.dataview) : `Planned: ${v.description}`;
  const planned = v.kind === "placeholder";
  const open = !!menu?.open;
  const wrapRef = useDismiss(open, () => menu?.onOpen(false));
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const icon = (
    <button
      type="button"
      className="ed-rv-icon"
      aria-label={label}
      aria-pressed={active}
      title={label}
      draggable={draggable}
      onClick={onClick}
      onContextMenu={
        menu
          ? (e) => {
              e.preventDefault();
              menu.onOpen(true);
            }
          : undefined
      }
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: EDITOR.railIcon,
        height: EDITOR.railIcon,
        borderRadius: 5,
        border: planned ? `1px dashed ${ready ? EC.ready : EC.gold}` : "1px solid transparent",
        background: active ? EC.hover : "transparent",
        color: planned ? (ready ? EC.ready : EC.gold) : active ? "var(--fg)" : "var(--muted2)",
        padding: 0,
        cursor: draggable ? "grab" : "pointer",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {planned ? "?" : railGlyph(dv?.railIcon ?? "TilesIcon")}
    </button>
  );
  if (!menu) return icon;

  const row = (a: PanelAction, text: string, opts: { disabled?: boolean; tag?: string } = {}) => <MenuRow label={text} disabled={opts.disabled} tag={opts.tag} onClick={() => menu.onAction(a)} />;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) tabRef.current?.focus();
  };
  return (
    <div ref={wrapRef} className="ed-rv" data-open={open || undefined} data-active={active || undefined} onKeyDown={onKeyDown}>
      {icon}
      <button
        ref={tabRef}
        type="button"
        className="ed-rv-tab"
        title="View options"
        aria-label={`Options for ${menu.title}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => menu.onOpen(!open)}
      >
        <span aria-hidden="true">···</span>
      </button>
      {open && (
        <div style={{ position: "absolute", left: EDITOR.railIcon + 20, top: -6, height: 0 }}>
          <PanelMenu label={`Options for ${menu.title}`} width={EDITOR.viewMenuWidth}>
            <MenuHeading>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span title={menu.title} style={{ minWidth: 0, flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {menu.title}
                </span>
                {menu.opening && <span className="shrink-0 rounded-full bg-[var(--box-bg)] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[var(--muted3)]">Opens first</span>}
              </span>
            </MenuHeading>
            {row("edit-view", "Edit this view…")}
            {row("swap-view", "Swap for another view…")}
            {row("move-view", "Move to another panel…")}
            {row("copy-view", "Copy to another panel…")}
            {row("copy-view-out", "Copy to another dashboard or meeting…", planned ? { disabled: true, tag: "Planned" } : {})}
            {!menu.opening && row("make-default", "Make this the opening view")}
            {menu.index > 0 && row("view-up", "Move up")}
            {menu.index < menu.count - 1 && row("view-down", "Move down")}
            <MenuDivider />
            <button
              type="button"
              onClick={() => menu.onAction("remove-view")}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-[7px] text-left text-[13px] font-medium hover:bg-[var(--box-bg)]"
              style={{ color: EC.danger }}
            >
              Remove this view
            </button>
          </PanelMenu>
        </div>
      )}
    </div>
  );
}

function PlannedBody({ v, ready, onPreview, onKeep }: { v: Extract<DataviewInstance, { kind: "placeholder" }>; ready?: Dataview[]; onPreview: (dv: Dataview) => void; onKeep: () => void }) {
  const shape = v.shape ? VIEW_TYPE_LABEL[v.shape].toLowerCase() : "not sure";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1, minHeight: 0 }}>
      <StatePill kind={ready ? "ready" : "planned"} />
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>{v.description}</div>
      {ready ? (
        <div style={{ fontSize: 11.5, color: "var(--muted2)", lineHeight: 1.4 }}>A new draft view matches this placeholder&apos;s context exactly.</div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--muted2)", lineHeight: 1.4 }}>
          Shape: {shape}
          {v.notes ? <> &middot; &ldquo;{v.notes}&rdquo;</> : null}
        </div>
      )}
      {v.context?.summary && <div style={{ fontSize: 10.5, color: "var(--muted3)", lineHeight: 1.4 }}>{v.context.summary}</div>}
      <div style={{ flexGrow: 1 }} />
      {ready ? (
        <div style={{ display: "flex", gap: 8 }}>
          <EBtn primary onClick={() => onPreview(ready[0])}>Preview and swap in</EBtn>
          <EBtn onClick={onKeep}>Keep planning</EBtn>
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: "var(--muted2)" }}>Teachers never see this. It&apos;s hidden until a real view replaces it.</div>
      )}
    </div>
  );
}

function SwapPreview({ Preview, config, panel, dv, width, height, onSwap, onCancel, labels }: { Preview: PanelPreviewComponent; config: DashboardConfig; panel: PanelConfig; dv: Dataview; width: number; height: number; onSwap: (dv: Dataview) => void; onCancel: () => void; labels?: PanelLabels }): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Preview config={config} panel={panel} view={{ id: `${panel.id}/${dv.id}`, kind: "view", dataview: dv.id }} width={width} height={height} labels={labels} />
      <div style={{ display: "flex", gap: 8 }}>
        <EBtn primary onClick={() => onSwap(dv)}>Swap in</EBtn>
        <EBtn onClick={onCancel}>Cancel</EBtn>
      </div>
    </div>
  );
}

// A cell with no panel, or a panel with no views: the board's "Empty panel + Add a view".
export function EmptyCell({ units: u, onAdd, readOnly }: { units: number; onAdd: () => void; readOnly?: boolean }) {
  return (
    <div
      style={{ boxSizing: "border-box", width: panelWidth(u), height: EDITOR.unit.height, borderRadius: EDITOR.panelRadius, border: "1px dashed var(--panel-border2)", background: "var(--panel-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, outline: readOnly ? "none" : `1px dashed ${EC.amber}`, outlineOffset: 3, position: "relative" }}
    >
      <div style={{ fontSize: 12, color: "var(--muted2)", textAlign: "center" }}>Empty panel</div>
      {!readOnly && (
        <>
          <button type="button" onClick={onAdd} style={{ border: `1px solid ${EC.amber}`, background: "transparent", color: EC.amberText, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Add a view
          </button>
          <div style={{ fontSize: 10.5, color: "var(--muted2)" }}>Opens Add a view</div>
        </>
      )}
    </div>
  );
}
