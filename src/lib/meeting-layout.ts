// VicData 0.6 S7: meeting slide geometry, and every layout and interaction constant the
// meetings screens use -- one module, so Guy can iterate on sizes without hunting.
//
// Guy's decision 7 (OPEN_QUESTIONS, after night 1): slides are laid out at the REAL panel
// unit (PANEL_UNIT: 351 x 384, 12px row gap, columns on the dashboard's 385 + 38px pitch),
// on a logical 16:9 canvas that holds a title plus 3 x 2 units, and the whole slide scales
// uniformly to fit -- editor, Present, Grid and PDF alike. There is no meeting-specific
// panel size. MeetingPlay.dc.html's 289 x 192 cells were the old assumed unit at 0.75; only
// its behaviour is followed here.
//
// Pure: no React, no DOM. Unit-tested in meeting-layout.test.ts.
import { PANEL_UNIT, spanHeight, spanWidth } from "@/catalogue/config";
import type { SlideConfig } from "@/catalogue/types";

export type SlideLayout = SlideConfig["layout"];
export type SlideSlot = SlideConfig["slots"][number];

// ------------------------------------------------------------------------------------
// The canvas

// Column pitch (left edge to left edge) and row pitch, exactly as on a dashboard.
export const COLUMN_PITCH = PANEL_UNIT.columnTrack + 2 * PANEL_UNIT.columnGap + PANEL_UNIT.divider; // 423
export const ROW_PITCH = PANEL_UNIT.height + PANEL_UNIT.rowGap; // 396

export const GRID_COLS = 3;
export const GRID_ROWS = 2;
// The 3 x 2 block: 1197 x 780.
export const GRID_WIDTH = spanWidth(GRID_COLS);
export const GRID_HEIGHT = spanHeight(GRID_ROWS);

// The band above the grid: padding, the title row (26px bold title, Meeting.dc.html), and
// the gap under it. Chosen so the canvas lands on 1536 x 864, a true 16:9 -- Guy's "about
// 1530 x 860".
export const SLIDE_PAD_TOP = 16;
export const SLIDE_TITLE_HEIGHT = 44;
export const SLIDE_TITLE_GAP = 12;
export const SLIDE_PAD_BOTTOM = 12;
export const SLIDE_TITLE_FONT = 26;

export const CANVAS_HEIGHT = SLIDE_PAD_TOP + SLIDE_TITLE_HEIGHT + SLIDE_TITLE_GAP + GRID_HEIGHT + SLIDE_PAD_BOTTOM; // 864
export const CANVAS_WIDTH = Math.round((CANVAS_HEIGHT * 16) / 9); // 1536

// The grid sits centred across the canvas; the title row spans the grid's width.
export const GRID_LEFT = Math.round((CANVAS_WIDTH - GRID_WIDTH) / 2); // 170
export const GRID_TOP = SLIDE_PAD_TOP + SLIDE_TITLE_HEIGHT + SLIDE_TITLE_GAP; // 72

// The most slots a slide holds (MeetingPlay's 6).
export const MAX_SLOTS = GRID_COLS * GRID_ROWS;

// ------------------------------------------------------------------------------------
// Screen and interaction constants (not geometry, but kept here so there is one place)

export const MEETING_UI = {
  // G8: undo/redo depth.
  undoDepth: 30,
  // Draft autosave after the last edit.
  autosaveMs: 900,
  // Editor chrome (Meeting.dc.html): the slide strip and its thumbnails.
  stripWidth: 216,
  thumbWidth: 168,
  thumbHeight: 94,
  // The editor never enlarges a slide past its logical size; Present may.
  editorMaxScale: 1,
  presentMaxScale: 2,
  // Grid view: slides per row and the gap between them.
  gridPerRow: 3,
  gridGap: 20,
  // PDF: A4 landscape with a 10mm margin, at the CSS 96px per inch -> 1047 x 718 px.
  printPage: { cssSize: "A4 landscape", marginMm: 10, width: 1047, height: 718 },
} as const;

// ------------------------------------------------------------------------------------
// Layouts

// A layout cell. `kind` says what it takes: "unit" a view or a text box, "text" a text
// box only, "span" a view only (the 2 x 2 span).
export type CellKind = "unit" | "text" | "span";
export type Cell = { col: number; row: number; cols: number; rows: number; kind: CellKind };

const unit = (col: number, row: number): Cell => ({ col, row, cols: 1, rows: 1, kind: "unit" });

// The manual layouts (scope brief §7.5; Meeting.dc.html's five layout tiles, in order).
export const MANUAL_LAYOUTS: Exclude<SlideLayout, "auto">[] = ["1+text", "2+text", "3-across", "3x2", "2x2+1"];

export const LAYOUT_CELLS: Record<Exclude<SlideLayout, "auto">, Cell[]> = {
  "1+text": [unit(0, 0), { col: 1, row: 0, cols: 2, rows: 1, kind: "text" }],
  "2+text": [unit(0, 0), unit(1, 0), { col: 2, row: 0, cols: 1, rows: 1, kind: "text" }],
  "3-across": [unit(0, 0), unit(1, 0), unit(2, 0)],
  "3x2": [unit(0, 0), unit(1, 0), unit(2, 0), unit(0, 1), unit(1, 1), unit(2, 1)],
  "2x2+1": [{ col: 0, row: 0, cols: 2, rows: 2, kind: "span" }, unit(2, 0), { col: 2, row: 1, cols: 1, rows: 1, kind: "text" }],
};

export const LAYOUT_LABEL: Record<SlideLayout, string> = {
  auto: "Auto",
  "1+text": "1 unit + text",
  "2+text": "2 units + text",
  "3-across": "3 across",
  "3x2": "3 × 2",
  "2x2+1": "2 × 2 span + 1",
};

// Automatic layout by count (MeetingPlay): 1, then 2 across, 3 across, 3 x 2.
export function autoCells(n: number): Cell[] {
  if (n <= 1) return [unit(0, 0)];
  if (n === 2) return [unit(0, 0), unit(1, 0)];
  if (n === 3) return LAYOUT_CELLS["3-across"];
  return LAYOUT_CELLS["3x2"].slice(0, Math.min(n, MAX_SLOTS));
}

// The arrangement's name, for Copy to meeting's "makes it side by side" line.
export function arrangementName(n: number): string {
  if (n <= 1) return "one view";
  if (n === 2) return "side by side";
  if (n === 3) return "three across";
  return "3 × 2";
}

function isTextSlot(s: SlideSlot): boolean {
  return !s.view;
}

function accepts(cell: Cell, slot: SlideSlot): boolean {
  if (cell.kind === "unit") return true;
  return cell.kind === "text" ? isTextSlot(slot) : !isTextSlot(slot);
}

// Each slot's cell: slots take cells in order, a text box preferring a text cell and a
// view preferring the span. Returns null when the slots don't fit the layout.
function place(cells: Cell[], slots: SlideSlot[]): (number | null)[] | null {
  const used = new Set<number>();
  const at: (number | null)[] = [];
  for (const slot of slots) {
    const order = cells
      .map((c, i) => i)
      .filter((i) => !used.has(i) && accepts(cells[i], slot))
      .sort((a, b) => rank(cells[a], slot) - rank(cells[b], slot) || a - b);
    if (!order.length) return null;
    used.add(order[0]);
    at.push(order[0]);
  }
  return at;
}

function rank(cell: Cell, slot: SlideSlot): number {
  if (isTextSlot(slot)) return cell.kind === "text" ? 0 : 1;
  return cell.kind === "span" ? 0 : 1;
}

export type Rect = { x: number; y: number; width: number; height: number };

export type PlacedCell = Cell & { rect: Rect; slotIndex: number | null };

export type Arrangement = {
  // The layout actually used: a manual one the slots overflow falls back to auto.
  layout: SlideLayout;
  fellBack: boolean;
  cells: PlacedCell[];
};

// Cell rects on the canvas, at the real unit. One-row arrangements are centred
// vertically, and every arrangement horizontally, as MeetingPlay centres its grid.
export function cellRects(cells: Cell[]): Rect[] {
  const cols = Math.max(...cells.map((c) => c.col + c.cols));
  const rows = Math.max(...cells.map((c) => c.row + c.rows));
  const left = GRID_LEFT + Math.round((GRID_WIDTH - spanWidth(cols)) / 2);
  const top = GRID_TOP + Math.round((GRID_HEIGHT - spanHeight(rows)) / 2);
  return cells.map((c) => ({
    x: left + c.col * COLUMN_PITCH,
    y: top + c.row * ROW_PITCH,
    width: spanWidth(c.cols),
    height: spanHeight(c.rows),
  }));
}

export function arrangeSlide(slide: Pick<SlideConfig, "layout" | "slots">): Arrangement {
  const slots = slide.slots.slice(0, MAX_SLOTS);
  let layout: SlideLayout = slide.layout;
  let fellBack = false;
  let cells = layout === "auto" ? autoCells(slots.length) : LAYOUT_CELLS[layout];
  let at = place(cells, slots);
  if (!at) {
    fellBack = layout !== "auto";
    layout = "auto";
    cells = autoCells(slots.length);
    at = slots.map((_, i) => i);
  }
  const rects = cellRects(cells);
  const byCell = new Map<number, number>();
  at.forEach((cell, slotIndex) => {
    if (cell !== null) byCell.set(cell, slotIndex);
  });
  return {
    layout,
    fellBack,
    cells: cells.map((c, i) => ({ ...c, rect: rects[i], slotIndex: byCell.get(i) ?? null })),
  };
}

// Would `slots` fit `layout` without falling back?
export function fitsLayout(layout: SlideLayout, slots: SlideSlot[]): boolean {
  if (slots.length > MAX_SLOTS) return false;
  if (layout === "auto") return true;
  return place(LAYOUT_CELLS[layout], slots) !== null;
}

// ------------------------------------------------------------------------------------
// Scaling

// The one uniform scale that fits a w x h canvas into the space available, never above
// `max`. Zero or negative room gives 0 rather than a negative scale.
export function fitScale(availWidth: number, availHeight: number, max = 1, width = CANVAS_WIDTH, height = CANVAS_HEIGHT): number {
  if (!(availWidth > 0) || !(availHeight > 0)) return 0;
  return Math.min(max, availWidth / width, availHeight / height);
}

// The schematic for a thumbnail: the same arrangement scaled into a w x h box.
export function thumbRects(slide: Pick<SlideConfig, "layout" | "slots">, w: number, h: number) {
  const s = fitScale(w, h, Infinity);
  const a = arrangeSlide(slide);
  return {
    title: { x: GRID_LEFT * s, y: SLIDE_PAD_TOP * s, width: GRID_WIDTH * s, height: SLIDE_TITLE_HEIGHT * s * 0.5 },
    cells: a.cells.map((c) => ({ ...c, rect: { x: c.rect.x * s, y: c.rect.y * s, width: c.rect.width * s, height: c.rect.height * s } })),
  };
}
