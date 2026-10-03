// Run: npx -y tsx --test src/lib/meeting-layout.test.ts src/lib/meeting-ops.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PANEL_UNIT } from "@/catalogue/config";
import {
  arrangeSlide,
  autoCells,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  cellRects,
  COLUMN_PITCH,
  fitScale,
  fitsLayout,
  GRID_HEIGHT,
  GRID_LEFT,
  GRID_TOP,
  GRID_WIDTH,
  LAYOUT_CELLS,
  MANUAL_LAYOUTS,
  ROW_PITCH,
  type SlideSlot,
} from "./meeting-layout";

const view = (id: string): SlideSlot => ({ id, view: { id: `v-${id}`, kind: "view", dataview: "DV-C2-CUR-BARS" } });
const text = (id: string): SlideSlot => ({ id, text: "" });

test("canvas is 16:9 and built from the real panel unit", () => {
  assert.equal(PANEL_UNIT.width, 351);
  assert.equal(PANEL_UNIT.height, 384);
  assert.equal(COLUMN_PITCH, 423);
  assert.equal(ROW_PITCH, 396);
  assert.equal(GRID_WIDTH, 1197);
  assert.equal(GRID_HEIGHT, 780);
  assert.equal(CANVAS_WIDTH, 1536);
  assert.equal(CANVAS_HEIGHT, 864);
  assert.equal(CANVAS_WIDTH * 9, CANVAS_HEIGHT * 16);
  assert.ok(GRID_LEFT + GRID_WIDTH <= CANVAS_WIDTH);
  assert.ok(GRID_TOP + GRID_HEIGHT <= CANVAS_HEIGHT);
});

test("every slot of the 3 x 2 is exactly one panel unit, on the dashboard pitch", () => {
  const rects = cellRects(LAYOUT_CELLS["3x2"]);
  for (const r of rects) {
    assert.equal(r.width, 351);
    assert.equal(r.height, 384);
  }
  assert.equal(rects[1].x - rects[0].x, 423);
  assert.equal(rects[3].y - rects[0].y, 396);
  assert.equal(rects[0].x, GRID_LEFT);
  assert.equal(rects[0].y, GRID_TOP);
  assert.equal(rects[5].x + rects[5].width, GRID_LEFT + GRID_WIDTH);
  assert.equal(rects[5].y + rects[5].height, GRID_TOP + GRID_HEIGHT);
});

test("auto layout by count: 1 -> 2 across -> 3 across -> 3 x 2", () => {
  assert.equal(autoCells(0).length, 1);
  assert.equal(autoCells(1).length, 1);
  assert.deepEqual(autoCells(2).map((c) => [c.col, c.row]), [[0, 0], [1, 0]]);
  assert.deepEqual(autoCells(3).map((c) => [c.col, c.row]), [[0, 0], [1, 0], [2, 0]]);
  assert.deepEqual(autoCells(4).map((c) => [c.col, c.row]), [[0, 0], [1, 0], [2, 0], [0, 1]]);
  assert.equal(autoCells(6).length, 6);
  assert.equal(autoCells(9).length, 6);
});

test("one-row arrangements are centred on the canvas", () => {
  const one = arrangeSlide({ layout: "auto", slots: [view("a")] }).cells[0].rect;
  assert.equal(one.width, 351);
  assert.equal(Math.round(one.x + one.width / 2), Math.round(GRID_LEFT + GRID_WIDTH / 2));
  assert.equal(one.y, GRID_TOP + (GRID_HEIGHT - 384) / 2);
  const two = arrangeSlide({ layout: "auto", slots: [view("a"), view("b")] }).cells.map((c) => c.rect);
  assert.equal(two[1].x - two[0].x, 423);
  assert.equal(Math.round((two[0].x + two[1].x + two[1].width) / 2), Math.round(GRID_LEFT + GRID_WIDTH / 2));
});

test("manual layouts: the board's five, with text and span cells", () => {
  assert.deepEqual(MANUAL_LAYOUTS, ["1+text", "2+text", "3-across", "3x2", "2x2+1"]);
  const span = arrangeSlide({ layout: "2x2+1", slots: [view("a"), view("b"), text("t")] });
  assert.equal(span.fellBack, false);
  const big = span.cells.find((c) => c.kind === "span")!;
  assert.equal(big.rect.width, 774);
  assert.equal(big.rect.height, 780);
  assert.equal(big.slotIndex, 0);
  assert.equal(span.cells.find((c) => c.kind === "text")!.slotIndex, 2);
  const oneText = arrangeSlide({ layout: "1+text", slots: [text("t"), view("a")] });
  assert.equal(oneText.cells[0].slotIndex, 1, "the view takes the unit cell even listed second");
  assert.equal(oneText.cells[1].slotIndex, 0);
  assert.equal(oneText.cells[1].rect.width, 774);
});

test("a manual layout the slots overflow falls back to auto", () => {
  const a = arrangeSlide({ layout: "1+text", slots: [view("a"), view("b")] });
  assert.equal(a.layout, "auto");
  assert.equal(a.fellBack, true);
  assert.equal(a.cells.length, 2);
  assert.equal(fitsLayout("1+text", [view("a"), view("b")]), false);
  assert.equal(fitsLayout("3x2", [view("a"), view("b")]), true);
  assert.equal(fitsLayout("2x2+1", [text("a"), text("b"), text("c")]), false, "the span takes a view only");
  assert.equal(fitsLayout("auto", Array.from({ length: 7 }, (_, i) => view(String(i)))), false);
});

test("empty cells of a manual layout stay as empty slots", () => {
  const a = arrangeSlide({ layout: "3x2", slots: [view("a")] });
  assert.equal(a.cells.length, 6);
  assert.equal(a.cells.filter((c) => c.slotIndex === null).length, 5);
});

test("fitScale is uniform, capped, and never negative", () => {
  assert.equal(fitScale(1536, 864), 1);
  assert.equal(fitScale(3072, 1728), 1);
  assert.equal(fitScale(3072, 1728, 2), 2);
  assert.equal(fitScale(768, 864), 0.5);
  assert.equal(fitScale(1536, 432), 0.5);
  assert.equal(fitScale(0, 500), 0);
  assert.equal(fitScale(-5, 500), 0);
});
