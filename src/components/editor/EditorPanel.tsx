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
// 0.6.1 S5: the view menu is the RailMenu board: "Shows for" chips, Edit view…, the
// default, Move up / down, Move or copy to another panel…, Copy to a dashboard or
// meeting…, Take off [measure] and Remove everywhere.
import { createContext, useContext, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { dataviewById } from "@/catalogue";
import { effectiveStates, panelState, showsOnState, viewsOnState, type VariantAxis, type VariantState } from "@/catalogue/variants";
import { contextFromPanel, latestYear, defaultFromYear, instanceTitle, titleOverrideOf, VIEW_TYPE_LABEL, type PanelLabels } from "@/catalogue/pick";
import type { DashboardConfig, Dataview, DataviewInstance, PanelConfig } from "@/catalogue/types";
import { glyph } from "@/components/view-editor/bits";
import { MenuDivider, MenuRow, PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import { EC, EDITOR, panelWidth } from "@/lib/editor-layout";
import { isDefaultView, spanOf } from "@/lib/editor-ops";
import { EBtn, InheritBadge, OverrideBadge, PlusIcon, StandardElements, StatePill } from "./bits";
import type { PanelPreviewComponent } from "./PanelPreview";
import { viewInstance } from "@/catalogue/viewspec";
import { showsForRows, toggledStates, type ShowsForRow } from "@/lib/rail-menu";

// Panel menu: rename, override, move-panel, delete-panel. View menu (snag 1 / 03): the rest,
// each for one instance. "copy-view" copies to a panel on this dashboard; "copy-view-out"
// is Copy to another dashboard or meeting (S6's CopyViewDialog). 0.6.1 S5: the rail menu
// sends "move-or-copy-view" (one dialog, Move / Copy) and "take-off" (the pill's measure);
// "swap-view", "move-view" and "copy-view" stay for callers outside it.
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
  | "move-or-copy-view"
  | "take-off"
  | "make-default"
  | "view-up"
  | "view-down"
  | "remove-view";

const HEADER = 22;

// 0.6 snag 3 / 03: the edit bar's Results pill, on a Results dashboard. Rails show the
// views on `measure` (all of them, off-measure ones dimmed, with `showAll`), the panel
// body previews it, and the view menu's default, "Shows for" and Take off rows follow it.
// 0.6 snag 4 / 02: every variant axis the dashboard has (catalogue/variants.ts) -- the
// Results pill, Context's Compare against, Comparisons' comparator kind -- each with its own
// pill in the edit bar. Each panel reads the axes it varies by.
export type EditorVariants = {
  // The edit bar's pills, one state per axis the dashboard has.
  state: VariantState;
  // Each axis's name ("Results") and its states' names, as the pills say them.
  axes: Partial<Record<VariantAxis, { name: string; labels: Record<string, string> }>>;
  showAll: boolean;
  onShowOn: (panelId: string, instanceId: string, axis: VariantAxis, states: string[]) => void;
  // The page's selected subjects, so a Context preview on "Selected subjects" draws them.
  contextSelected?: string[];
  // 0.6.1 S5: the edit bar's grade band (Results on Grade bands), for the live previews.
  band?: { top: string; bottom: string } | null;
};
export const EditorVariantsContext = createContext<EditorVariants | null>(null);

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
  const variants = useContext(EditorVariantsContext);
  // The panel's state: the edit bar's pills on the axes this panel varies by.
  const st: VariantState = variants ? panelState(config, panel, variants.state) : {};
  const stAxes = (Object.keys(st) as VariantAxis[]).filter((a) => variants?.axes[a]);
  const stated = stAxes.length > 0;
  const stateText = stAxes.map((a) => variants!.axes[a]!.labels[st[a]!]).join(" · ");
  // The rail: the views shown in that state (or every view, the others dimmed, with Show
  // all views).
  const railViews = stated && !variants?.showAll ? viewsOnState(panel, st) : panel.dataviews;
  const defaultId = railViews.find((v) => isDefaultView(panel, v.id, stated ? st : null))?.id;
  const view = railViews.find((v) => v.id === selected) ?? railViews.find((v) => v.id === defaultId) ?? railViews[0];
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
          {railViews.map((v, i) => {
            // Indices into the panel's own list (the rail may be a pill's subset).
            const full = (j: number) => panel.dataviews.indexOf(railViews[j]);
            const off = stated && !showsOnState(v, st);
            return (
              <RailButton
                key={v.id}
                v={v}
                label={railTooltip(config, panel, v, labels)}
                active={v.id === view?.id}
                ready={!!ready[v.id]}
                dimmed={off}
                draggable={!readOnly}
                menu={
                  readOnly
                    ? null
                    : {
                        open: viewMenu === v.id,
                        title: viewLabel(config, panel, v, labels),
                        index: i,
                        count: railViews.length,
                        opening: v.id === defaultId && !off,
                        pill: stated ? { label: stateText, off } : null,
                        showsFor: variants && stated && v.kind === "view" ? showsForRows(config, panel, v, variants.axes) : null,
                        onChips: (axis, states) => variants?.onShowOn(panel.id, v.id, axis, states),
                        // Take off [measure]: the Results pill's state (pinch point 6).
                        takeOff:
                          variants && st.results && v.kind === "view"
                            ? {
                                label: variants.axes.results?.labels[st.results] ?? st.results,
                                why: off ? "Not shown on it" : effectiveStates(v, "results").length <= 1 ? "Shows only here" : null,
                              }
                            : null,
                        onOpen: (open) => {
                          setViewMenu(open ? v.id : null);
                          if (open) onSelect(v.id);
                        },
                        onAction: (a) => {
                          setViewMenu(null);
                          // Move up / down step past views the pill's rail doesn't show.
                          if (a === "view-up" || a === "view-down") {
                            const to = i + (a === "view-up" ? -1 : 1);
                            if (to >= 0 && to < railViews.length) onReorder(full(i), full(to));
                            return;
                          }
                          onAction(a, v.id);
                        },
                      }
                }
                onClick={() => onSelect(v.id)}
                onDragStart={() => setDragFrom(i)}
                onDrop={() => {
                  if (dragFrom !== null && dragFrom !== i) onReorder(full(dragFrom), full(i));
                  setDragFrom(null);
                }}
              />
            );
          })}
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
          {!view ? (
            stated ? (
              <div data-no-views-on={stateText} style={{ fontSize: 12, color: "var(--muted2)", lineHeight: 1.45, padding: "4px 2px" }}>
                No views on {stateText} in this panel. Add one with +, or turn on Show all views.
              </div>
            ) : null
          ) : view.kind === "placeholder" ? (
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

// The view's resolved title, for the view menu's heading: its own (Customise's) title when
// it has one, else its dataview's (0.6 snag 4 / 01: one resolver, pick.ts instanceTitle).
function viewLabel(config: DashboardConfig, panel: PanelConfig, v: DataviewInstance, labels?: PanelLabels): string {
  if (v.kind === "placeholder") return v.description;
  const dv = dataviewById(v.dataview);
  if (!dv) return v.title ?? v.dataview;
  try {
    return instanceTitle(v, contextFromPanel(config, panel.id, labels));
  } catch {
    return dv.label;
  }
}

// The rail icon's tooltip: the view's own title when it has one (resolved), else the
// dataview's short label, as before.
function railTooltip(config: DashboardConfig, panel: PanelConfig, v: DataviewInstance, labels?: PanelLabels): string {
  if (v.kind === "placeholder") return `Planned: ${v.description}`;
  const dv = dataviewById(v.dataview);
  return titleOverrideOf(v) ? viewLabel(config, panel, v, labels) : (dv?.label ?? v.dataview);
}

type RailMenu = {
  open: boolean;
  title: string;
  index: number;
  count: number;
  opening: boolean;
  // 0.6 snag 3 / 03: on a Results dashboard, the edit bar's pill (`off`: this view isn't
  // shown on it). Snag 4 / 02: the panel's state on every axis it varies by ("Grade counts ·
  // Selected subjects").
  pill: { label: string; off: boolean } | null;
  // 0.6.1 S5: the board's "Shows for" chips (lib/rail-menu.ts), one row per axis.
  showsFor: ShowsForRow[] | null;
  onChips: (axis: VariantAxis, states: string[]) => void;
  // "Take off [measure]": `why` = why it can't be (off the pill; the view's only measure).
  takeOff: { label: string; why: string | null } | null;
  onOpen: (open: boolean) => void;
  onAction: (a: PanelAction) => void;
};

// One rail icon. In edit mode it sits in .ed-rv with its "···" tab and view menu; the hover,
// focus and touch states are CSS in DashboardEditor's style block (.ed-rv).
function RailButton({ v, label, active, ready, dimmed = false, draggable, menu, onClick, onDragStart, onDrop }: { v: DataviewInstance; label: string; active: boolean; ready: boolean; dimmed?: boolean; draggable: boolean; menu: RailMenu | null; onClick: () => void; onDragStart: () => void; onDrop: () => void }) {
  const dv = v.kind === "view" ? dataviewById(v.dataview) : undefined;
  const planned = v.kind === "placeholder";
  const open = !!menu?.open;
  const wrapRef = useDismiss(open, () => menu?.onOpen(false));
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const openMenu = (o: boolean) => menu?.onOpen(o);
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
              openMenu(true);
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
        // 0.6 snag 3 / 03: Show all views -- a view not on the current pill, dimmed.
        opacity: dimmed ? 0.4 : undefined,
      }}
      data-off-pill={dimmed || undefined}
    >
      {planned ? "?" : glyph(v.kind === "view" && v.spec?.icon ? v.spec.icon : (dv?.railIcon ?? "TilesIcon"))}
    </button>
  );
  if (!menu) return icon;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) tabRef.current?.focus();
  };
  const pillText = menu.pill?.label ?? null;
  return (
    <div ref={wrapRef} className="ed-rv" data-open={open || undefined} data-active={active || undefined} onKeyDown={onKeyDown}>
      {icon}
      {/* Snag 3 / 02: the default view's marker, edit mode only (a read-only rail has no menu). */}
      {menu.opening && <span aria-hidden="true" data-default-dot="" style={{ position: "absolute", right: 1, bottom: 1, width: 4, height: 4, borderRadius: 999, background: EC.amber, pointerEvents: "none" }} />}
      <button
        ref={tabRef}
        type="button"
        className="ed-rv-tab"
        title="View options"
        aria-label={`Options for ${menu.title}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => openMenu(!open)}
      >
        <span aria-hidden="true">···</span>
      </button>
      {open && (
        // RailMenu.dc.html: the menu's top-left 36px right of the icon and 12px below its top.
        <div style={{ position: "absolute", left: 36, top: 6, height: 0 }}>
          <PanelMenu label={`Options for ${menu.title}`} width={EDITOR.viewMenuWidth} tight>
            <div data-rail-menu="" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "6px 9px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                <span title={menu.title} style={{ fontSize: 11, fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: 0.4, flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {menu.title}
                </span>
                {menu.opening && <span style={{ fontSize: 10, fontWeight: 700, color: EC.amberText, background: `color-mix(in srgb, ${EC.amber} 14%, transparent)`, borderRadius: 999, padding: "2px 7px", flexShrink: 0 }}>Default</span>}
              </div>
              {menu.showsFor && menu.showsFor.length > 0 && <ShowsFor rows={menu.showsFor} onChips={menu.onChips} />}
              <MenuDivider />
              <RailRow onClick={() => menu.onAction("edit-view")} hint={planned ? undefined : "opens at Preview"}>
                Edit view&hellip;
              </RailRow>
              {menu.opening ? (
                <RailRow disabled muted>
                  <span aria-hidden="true" style={{ marginRight: 4 }}>&#10003;</span>
                  Default view{pillText ? ` for ${pillText}` : ""}
                </RailRow>
              ) : (
                <RailRow onClick={() => menu.onAction("make-default")} disabled={!!menu.pill?.off} hint={menu.pill?.off ? "Not shown" : undefined}>
                  {pillText ? `Make this the default for ${pillText}` : "Make this the default view"}
                </RailRow>
              )}
              <MoveRow index={menu.index} count={menu.count} onMove={(a) => menu.onAction(a)} />
              <RailRow onClick={() => menu.onAction("move-or-copy-view")}>Move or copy to another panel&hellip;</RailRow>
              <RailRow onClick={() => menu.onAction("copy-view-out")} disabled={planned} hint={planned ? "Planned" : undefined}>
                Copy to a dashboard or meeting&hellip;
              </RailRow>
              <MenuDivider />
              {menu.takeOff && (
                <RailRow onClick={() => menu.onAction("take-off")} disabled={!!menu.takeOff.why} hint={menu.takeOff.why ?? undefined}>
                  Take off {menu.takeOff.label}
                </RailRow>
              )}
              <RailRow onClick={() => menu.onAction("remove-view")} danger>
                {menu.showsFor?.some((r) => r.axis === "results") || menu.takeOff ? "Remove everywhere" : "Remove view"}
              </RailRow>
            </div>
          </PanelMenu>
        </div>
      )}
    </div>
  );
}

// RailMenu.dc.html's .mrow: 7px 9px, 13px / 500, radius 7, a quiet hint on the right.
function RailRow({ children, onClick, disabled = false, muted = false, danger = false, hint }: { children: ReactNode; onClick?: () => void; disabled?: boolean; muted?: boolean; danger?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      className="ed-mrow"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "7px 9px",
        border: "none",
        background: "none",
        borderRadius: 7,
        fontSize: 13,
        fontWeight: 500,
        textAlign: "left",
        color: danger ? EC.danger : muted || disabled ? "var(--muted3)" : "var(--chip-fg)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span style={{ minWidth: 0, flex: "0 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
      {hint && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted3)", whiteSpace: "nowrap", flexShrink: 0 }}>{hint}</span>}
    </button>
  );
}

// "Move up / down": one row, as the board draws it; its two arrows step the view through
// the rail (past views the pill's rail doesn't show).
function MoveRow({ index, count, onMove }: { index: number; count: number; onMove: (a: "view-up" | "view-down") => void }) {
  const arrow = (a: "view-up" | "view-down", can: boolean) => (
    <button
      type="button"
      className="ed-mrow-arrow"
      aria-label={a === "view-up" ? "Move up" : "Move down"}
      title={a === "view-up" ? "Move up" : "Move down"}
      disabled={!can}
      onClick={() => onMove(a)}
      style={{ width: 22, height: 20, borderRadius: 5, border: "1px solid var(--panel-border2)", background: "transparent", color: can ? "var(--chip-fg)" : "var(--muted3)", opacity: can ? 1 : 0.45, padding: 0, fontSize: 11, lineHeight: 1, cursor: can ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {a === "view-up" ? "↑" : "↓"}
    </button>
  );
  const only = count < 2;
  return (
    <div data-move-row="" className="ed-mrow" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 7, fontSize: 13, fontWeight: 500, color: only ? "var(--muted3)" : "var(--chip-fg)" }}>
      <span>Move up / down</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
        {arrow("view-up", index > 0)}
        {arrow("view-down", index < count - 1)}
      </span>
    </div>
  );
}

// RailMenu.dc.html's "Shows for": a chip per Results measure (.mt; .on ticked in green;
// .no dashed and greyed, its reason as the tooltip). A panel varying by another axis too
// gets that axis's chips under its own name.
function ShowsFor({ rows, onChips }: { rows: ShowsForRow[]; onChips: (axis: VariantAxis, states: string[]) => void }) {
  return (
    <div data-shows-for="" style={{ padding: "4px 9px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((row, i) => (
        <div key={row.axis} data-shows-for-axis={row.axis} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, color: "var(--muted2)" }}>{i === 0 ? "Shows for" : `Shows for · ${row.name}`}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {row.chips.map((c) => {
              const next = toggledStates(row, c.state);
              const no = !c.ok && !c.on;
              const title = no ? `${c.name}: ${c.reason ?? "can't be drawn here"}` : c.last ? `Shows only on ${c.name}. To delete it, use Remove everywhere.` : c.note ? `${c.name}: ${c.note}` : c.name;
              return (
                <button
                  key={c.state}
                  type="button"
                  className="ed-mt"
                  aria-pressed={c.on}
                  aria-disabled={!next || undefined}
                  disabled={no}
                  title={title}
                  data-no={no || undefined}
                  onClick={() => next && onChips(row.axis, next)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    border: `1px ${no ? "dashed" : "solid"} ${c.on ? EC.ready : "var(--edge-strong)"}`,
                    borderRadius: 999,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: c.on ? EC.ready : no ? "var(--muted3)" : "var(--chip-fg)",
                    background: "color-mix(in srgb, var(--fg) 4%, var(--panel-bg))",
                    cursor: next ? "pointer" : "default",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.on && <span aria-hidden="true">&#10003;</span>}
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
      <Preview config={config} panel={panel} view={viewInstance(`${panel.id}/${dv.id}`, dv.id)} width={width} height={height} labels={labels} />
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
