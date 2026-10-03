"use client";

// VicData 0.6 S5: the dashboard in edit mode (Editor.dc.html below the edit bar): column
// headers with "Data: … · Compared to: …" and Edit column, rows as dashed bands with their
// icon buttons, panels at the panel unit on whole-unit tracks, and "+ Add row" with the
// structure picker. `readOnly` draws the same thing without affordances (History preview).
import { useState } from "react";
import type { Dataview, DashboardConfig } from "@/catalogue/types";
import type { PanelLabels } from "@/catalogue/pick";
import { COLUMN_ICON_PATHS } from "@/components/teacher/DashboardColumn";
import { useDismiss } from "@/components/teacher/PanelMenu";
import { EC, EDITOR, trackWidth } from "@/lib/editor-layout";
import { columnLine, rowCells, rowLine, structuresFor, type Structure, type Target } from "@/lib/editor-ops";
import { ChevronDown, ChevronRight, CopyIcon, DownIcon, EBtn, IconBtn, PencilIcon, StructIcon, TrashIcon, UpIcon } from "./bits";
import { EditorPanel, EmptyCell, type PanelAction } from "./EditorPanel";
import type { PanelPreviewComponent } from "./PanelPreview";

export type CanvasHandlers = {
  editColumn: (columnId: string) => void;
  renameColumn: (columnId: string, title: string) => void;
  rowSettings: (rowId: string) => void;
  copyRow: (rowId: string) => void;
  moveRow: (rowId: string, dir: -1 | 1) => void;
  deleteRow: (rowId: string) => void;
  addView: (target: Target) => void;
  panelAction: (panelId: string, a: PanelAction, instanceId: string | null) => void;
  reorder: (panelId: string, from: number, to: number) => void;
  swapIn: (instanceId: string, dv: Dataview) => void;
  span: (panelId: string, cols: number) => void;
  addRow: (structure: Structure) => void;
};

export function canvasWidth(config: DashboardConfig): number {
  return config.layout.tracks.reduce((a, w) => a + trackWidth(w), 0) + (config.layout.tracks.length - 1) * EDITOR.trackGap;
}

export function EditorCanvas({
  config,
  readOnly = false,
  Preview,
  labels,
  selected,
  onSelect,
  ready,
  handlers,
}: {
  config: DashboardConfig;
  readOnly?: boolean;
  Preview: PanelPreviewComponent;
  labels?: PanelLabels;
  selected: Record<string, string>;
  onSelect: (panelId: string, instanceId: string) => void;
  ready: Record<string, Dataview[]>;
  handlers?: CanvasHandlers;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const grid = {
    display: "grid",
    gridTemplateColumns: config.layout.tracks.map((w) => `${trackWidth(w)}px`).join(" "),
    columnGap: EDITOR.trackGap,
  } as const;
  const width = canvasWidth(config);
  const h = handlers;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: EDITOR.bandGap, width }}>
      {/* Column headers */}
      <div style={grid}>
        {config.columns.map((col) => (
          <div key={col.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: `0 ${EDITOR.trackInset}px` }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(var(--accent-rgb),0.14)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {COLUMN_ICON_PATHS[col.icon]}
              </svg>
            </span>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              {readOnly || !h ? (
                <div style={{ fontSize: 15, fontWeight: 700 }}>{col.title}</div>
              ) : (
                <input
                  aria-label={`Column title: ${col.title}`}
                  defaultValue={col.title}
                  key={col.title}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== col.title && h.renameColumn(col.id, e.target.value.trim())}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", background: "transparent", border: "none", borderBottom: "1px dashed transparent", padding: 0, width: "100%", outline: "none", fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderBottomColor = "var(--edge-strong)")}
                />
              )}
              <div style={{ fontSize: 11, marginTop: 2, color: "var(--muted2)" }}>{columnLine(col, labels)}</div>
            </div>
            {!readOnly && h && (
              <EBtn small onClick={() => h.editColumn(col.id)}>
                Edit column
              </EBtn>
            )}
          </div>
        ))}
      </div>

      {config.rows.map((row, ri) => {
        const open = !collapsed.has(row.id);
        const cells = rowCells(config, row.id);
        return (
          <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: EDITOR.bandGap }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px dashed var(--edge-strong)", borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: "var(--chip-fg)" }}>
              <button
                type="button"
                aria-label={open ? `Collapse ${row.name}` : `Expand ${row.name}`}
                aria-expanded={open}
                onClick={() => {
                  const next = new Set(collapsed);
                  if (open) next.add(row.id);
                  else next.delete(row.id);
                  setCollapsed(next);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "inherit", font: "inherit", padding: 0, cursor: "pointer" }}
              >
                {open ? <ChevronDown /> : <ChevronRight />}
                {row.name}
              </button>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted2)" }}>{rowLine(config, row)}</span>
              <span style={{ flexGrow: 1 }} />
              {!readOnly && h && (
                <>
                  <IconBtn label="Row settings" onClick={() => h.rowSettings(row.id)}>
                    <PencilIcon />
                  </IconBtn>
                  <IconBtn label="Copy row" onClick={() => h.copyRow(row.id)}>
                    <CopyIcon />
                  </IconBtn>
                  {ri > 0 && (
                    <IconBtn label="Move row up" onClick={() => h.moveRow(row.id, -1)}>
                      <UpIcon />
                    </IconBtn>
                  )}
                  {ri < config.rows.length - 1 && (
                    <IconBtn label="Move row down" onClick={() => h.moveRow(row.id, 1)}>
                      <DownIcon />
                    </IconBtn>
                  )}
                  <IconBtn label="Delete row" danger disabled={config.rows.length === 1} onClick={() => h.deleteRow(row.id)}>
                    <TrashIcon />
                  </IconBtn>
                </>
              )}
            </div>
            {open && (
              <div style={grid}>
                {cells.map((cell) => {
                  const units = config.layout.tracks.slice(cell.start, cell.start + cell.span).reduce((a, b) => a + b, 0);
                  const col = config.columns[cell.start];
                  // How far this panel could span: up to the next filled panel.
                  let maxSpan = cell.span;
                  for (let c = cell.start + cell.span; c < config.columns.length; c++) {
                    const next = cells.find((x) => x.start === c);
                    if (next?.panel && next.panel.dataviews.length) break;
                    maxSpan = c - cell.start + 1;
                  }
                  return (
                    <div key={`${row.id}:${cell.start}`} style={{ gridColumn: `${cell.start + 1} / span ${cell.span}`, paddingLeft: EDITOR.trackInset }}>
                      {cell.panel && cell.panel.dataviews.length ? (
                        <EditorPanel
                          config={config}
                          panel={cell.panel}
                          rowName={row.name}
                          selected={selected[cell.panel.id] ?? null}
                          ready={ready}
                          Preview={Preview}
                          labels={labels}
                          readOnly={readOnly || !h}
                          maxSpan={maxSpan}
                          onSelect={(id) => onSelect(cell.panel!.id, id)}
                          onAddView={() => h?.addView(cell.panel!.id)}
                          onAction={(a) => h?.panelAction(cell.panel!.id, a, selected[cell.panel!.id] ?? cell.panel!.defaultView ?? cell.panel!.dataviews[0]?.id ?? null)}
                          onReorder={(from, to) => h?.reorder(cell.panel!.id, from, to)}
                          onSwapIn={(id, dv) => h?.swapIn(id, dv)}
                          onSpan={(cols) => h?.span(cell.panel!.id, cols)}
                        />
                      ) : (
                        <EmptyCell units={units} readOnly={readOnly || !h} onAdd={() => h?.addView(cell.panel ? cell.panel.id : { row: row.id, column: col.id })} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && h && <AddRow columns={config.columns.length} tracks={config.layout.tracks} onAdd={h.addRow} />}
    </div>
  );
}

function AddRow({ columns, tracks, onAdd }: { columns: number; tracks: number[]; onAdd: (s: Structure) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const options = structuresFor(columns);
  const [hover, setHover] = useState<number>(Math.max(0, options.findIndex((s) => s.length === columns)));
  const weights = (s: Structure) => {
    let i = 0;
    return s.map((span) => {
      const w = tracks.slice(i, i + span).reduce((a, b) => a + b, 0);
      i += span;
      return w;
    });
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ width: "100%", border: `1px dashed ${EC.barBorder}`, background: EC.addRowBg, color: EC.amberText, borderRadius: 10, padding: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
      >
        + Add row
      </button>
      {open && (
        <div
          role="group"
          aria-label="New row structure"
          style={{ position: "absolute", left: "50%", marginLeft: -EDITOR.structureMenuWidth / 2, bottom: 46, width: EDITOR.structureMenuWidth, boxSizing: "border-box", padding: 12, display: "flex", flexDirection: "column", gap: 10, background: "var(--panel-bg)", border: "1px solid var(--panel-border2)", borderRadius: 10, boxShadow: "0 10px 24px rgba(0,0,0,0.25)", zIndex: 30 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>New row &mdash; pick a structure</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {options.map((s, i) => (
              <span key={s.join(":")} onMouseEnter={() => setHover(i)}>
                <StructIcon
                  weights={weights(s)}
                  on={i === hover}
                  label={`${s.length} panel${s.length === 1 ? "" : "s"}: ${s.join(" + ")} columns`}
                  onClick={() => {
                    setOpen(false);
                    onAdd(s);
                  }}
                />
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted2)" }}>
            Spans snap to this dashboard&apos;s {columns} column{columns === 1 ? "" : "s"}. A spanning panel inherits from its left-most column.
          </div>
        </div>
      )}
    </div>
  );
}
