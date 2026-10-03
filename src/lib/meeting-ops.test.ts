// Run: npx -y tsx --test src/lib/meeting-layout.test.ts src/lib/meeting-ops.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DataviewInstance, SlideConfig } from "@/catalogue/types";
import {
  addLabel,
  addSlide,
  addTextBox,
  addViewToMeeting,
  applySuggestedTitle,
  changeSummary,
  clickSlot,
  dayAfter,
  deleteSlide,
  dragMove,
  initEditor,
  isArchived,
  moveSelectedHere,
  newMeetingConfig,
  nudge,
  redo,
  removeSelected,
  reuseSlides,
  setLayout,
  setTitle,
  shuffle,
  suggestedTitle,
  undo,
  type EditorState,
} from "./meeting-ops";
import { pinLine, resolveTemplate, rollSlotForward, shiftYear, slotTitle, citationOf } from "./meeting-views";
import { dataviewById } from "@/catalogue";

const inst = (id: string, dataview = "DV-C1-RES-TR-CHART"): DataviewInstance => ({ id, kind: "view", dataview: dataview as `DV-${string}` });
const slot = (id: string, dataview?: string, subject = "Maths (General)"): SlideConfig["slots"][number] => ({
  id,
  view: { ...inst(`v${id}`, dataview), pinned: { phase: "ks4", subjectLabel: subject, year: "2024/25" }, keepLive: false },
});
const slide = (id: string, ids: string[], layout: SlideConfig["layout"] = "auto"): SlideConfig => ({ id, title: "", layout, slots: ids.map((i) => slot(i)) });
const ids = (s: EditorState, i = s.cur) => s.slides[i].slots.map((x) => x.id);

const start = () => initEditor([slide("s1", ["a", "b"]), slide("s2", ["c"]), slide("s3", ["d", "e", "f"])]);

test("click selects, click again deselects", () => {
  let s = clickSlot(start(), 0);
  assert.deepEqual(s.sel, { slide: 0, idx: 0 });
  s = clickSlot(s, 0);
  assert.equal(s.sel, null);
});

test("click another view swaps (same slide)", () => {
  let s = clickSlot(start(), 0);
  s = clickSlot(s, 1);
  assert.deepEqual(ids(s), ["b", "a"]);
  assert.equal(s.sel, null);
  assert.equal(s.past.length, 1);
});

test("swap across slides: pick up, go to another slide, click a view", () => {
  let s = clickSlot(start(), 1);
  s = { ...s, cur: 2 };
  s = clickSlot(s, 0);
  assert.deepEqual(ids(s, 0), ["a", "d"]);
  assert.deepEqual(ids(s, 2), ["b", "e", "f"]);
});

test("move to next / previous slide follows the view; past the end makes a slide", () => {
  let s = clickSlot(start(), 0);
  s = nudge(s, 1);
  assert.equal(s.cur, 1);
  assert.deepEqual(ids(s, 1), ["c", "a"]);
  assert.deepEqual(s.sel, { slide: 1, idx: 1 });
  s = nudge(s, -1);
  assert.deepEqual(ids(s, 0), ["b", "a"]);
  let t = initEditor([slide("s1", ["a"])]);
  t = nudge(clickSlot(t, 0), 1);
  assert.equal(t.slides.length, 2);
  assert.deepEqual(ids(t, 1), ["a"]);
  const z = clickSlot(start(), 0);
  assert.equal(nudge(z, -1), z, "no slide before the first: unchanged");
});

test("a full slide refuses a move onto its end", () => {
  let s = initEditor([slide("s1", ["a"]), slide("s2", ["1", "2", "3", "4", "5", "6"])]);
  s = clickSlot(s, 0);
  const before = s.slides;
  s = nudge(s, 1);
  assert.equal(s.slides, before);
});

test("Move here / Move to the end, and the add label", () => {
  let s = clickSlot(start(), 0);
  assert.equal(addLabel(s), "Move to the end");
  s = { ...s, cur: 1 };
  assert.equal(addLabel(s), "Move here");
  s = moveSelectedHere(s);
  assert.deepEqual(ids(s, 1), ["c", "a"]);
  assert.equal(addLabel(s), "+ Add a view");
  assert.equal(addLabel(initEditor([slide("x", ["1", "2", "3", "4", "5", "6"])])), "Slide full");
});

test("drag and drop: onto a slot swaps, onto a slide moves to its end", () => {
  let s = dragMove(start(), { slide: 0, idx: 0 }, { slide: 2, idx: 2 });
  assert.deepEqual(ids(s, 0), ["f", "b"]);
  assert.deepEqual(ids(s, 2), ["d", "e", "a"]);
  s = dragMove(s, { slide: 2, idx: 0 }, { slide: 1, idx: null });
  assert.deepEqual(ids(s, 1), ["c", "d"]);
  const same = dragMove(start(), { slide: 0, idx: 1 }, { slide: 0, idx: 1 });
  assert.equal(same.past.length, 0);
});

test("remove, shuffle, add slide, delete slide, layout", () => {
  let s = removeSelected(clickSlot(start(), 1));
  assert.deepEqual(ids(s), ["a"]);
  s = { ...s, cur: 2 };
  s = shuffle(s);
  assert.deepEqual(ids(s), ["e", "f", "d"]);
  s = addSlide(s);
  assert.equal(s.slides.length, 4);
  assert.equal(s.cur, 3);
  s = deleteSlide(s, 3);
  assert.equal(s.slides.length, 3);
  s = setLayout(s, "3x2");
  assert.equal(s.slides[s.cur].layout, "3x2");
  s = addTextBox(s);
  assert.equal(s.slides[s.cur].slots.at(-1)!.text, "");
});

test("undo and redo, 30 deep; typing a title is one step", () => {
  let s = start();
  s = setTitle(s, "M");
  s = setTitle(s, "Ma");
  s = setTitle(s, "Maths");
  assert.equal(s.past.length, 1);
  s = undo(s);
  assert.equal(s.slides[0].title, "");
  s = redo(s);
  assert.equal(s.slides[0].title, "Maths");
  for (let i = 0; i < 40; i++) s = shuffle(s);
  assert.equal(s.past.length, 30);
  let u = s;
  for (let i = 0; i < 35; i++) u = undo(u);
  assert.equal(u.past.length, 0);
  assert.equal(u.future.length, 30);
});

test("suggested titles name the shared subject and the kinds", () => {
  const sl: SlideConfig = { id: "x", title: "", layout: "auto", slots: [slot("a", "DV-C1-RES-TR-CHART"), slot("b", "DV-C3-CUR-MAP"), slot("c", "DV-C3-CUR-RANKING")] };
  assert.equal(suggestedTitle(sl), "Maths (General): graph, map and table");
  const mixed: SlideConfig = { ...sl, slots: [slot("a", "DV-C3-CUR-MAP", "Maths"), slot("b", "DV-C3-CUR-MAP", "Biology")] };
  assert.equal(suggestedTitle(mixed), "Map");
  assert.equal(suggestedTitle({ ...sl, slots: [] }), null);
  const s = applySuggestedTitle(initEditor([sl]));
  assert.equal(s.slides[0].title, "Maths (General): graph, map and table");
});

test("addViewToMeeting: next free slot, the slide re-arranges", () => {
  const cfg = newMeetingConfig({ id: "m1", name: "Governors", meetingDate: "2026-11-14", slides: [slide("s1", ["a"]), slide("s2", ["1", "2", "3", "4", "5", "6"])] });
  const r = addViewToMeeting(cfg, "s1", inst("new"), { phase: "ks4", subjectLabel: "Maths (General)", year: "2024/25", keepLive: true });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.count, 2);
  assert.equal(r.arrangement, "side by side");
  const added = r.config.presentation!.slides[0].slots[1];
  assert.equal(added.view!.keepLive, true);
  assert.equal((added.view!.pinned as { keepLive?: boolean }).keepLive, undefined, "keepLive lives on the view, not in pinned");
  assert.equal(cfg.presentation!.slides[0].slots.length, 1, "input not mutated");
  const full = addViewToMeeting(cfg, "s2", inst("x"), {});
  assert.deepEqual(full, { ok: false, reason: "slide-full" });
  const fresh = addViewToMeeting(cfg, "new", inst("y"), {});
  assert.ok(fresh.ok && fresh.config.presentation!.slides.length === 3 && fresh.arrangement === "one view");
  const manual = newMeetingConfig({ name: "x", meetingDate: "2026-11-14", slides: [slide("m", ["a"], "1+text")] });
  const m = addViewToMeeting(manual, "m", inst("z"), {});
  assert.ok(m.ok && m.relaidOut && m.config.presentation!.slides[0].layout === "auto");
  assert.deepEqual(addViewToMeeting({ ...cfg, kind: "dashboard" }, "s1", inst("q"), {}), { ok: false, reason: "not-a-meeting" });
  assert.deepEqual(addViewToMeeting(cfg, "nope", inst("q"), {}), { ok: false, reason: "no-such-slide" });
});

test("pinned views: resolved title, pin line, citation, moving on to the latest data", () => {
  const s = slot("a", "DV-C3-CUR-MAP");
  (s.view!.pinned as Record<string, unknown>).compare = { kind: "schools", name: "10 nearest schools" };
  assert.match(slotTitle(s), /^Maths \(General\) .* by school, on the map$/);
  assert.equal(pinLine(s), "Pinned · as of 2024/25");
  assert.equal(citationOf(s), "DfE Key stage 4 performance");
  assert.equal(pinLine({ ...s, view: { ...s.view!, keepLive: true } }), "Live · latest data");
  assert.equal(resolveTemplate(dataviewById("DV-C2-CUR-DONUT")!, { subjectLabel: "Maths", compare: { kind: "subjects", name: "Sciences & Maths" } }), "Entries in Maths as a proportion of Sciences & Maths");
  assert.equal(shiftYear("2021/22", 3), "2024/25");
  assert.equal(shiftYear("2099/00", 1), "2100/01");
  const old = { ...s, view: { ...s.view!, pinned: { phase: "ks4", year: "2022/23" } } };
  assert.equal((rollSlotForward(old).view!.pinned as { year: string }).year, "2024/25");
  const tr = { ...s, view: { ...s.view!, dataview: "DV-C1-RES-TR-CHART" as const, pinned: { phase: "ks4", yearRange: { from: "2020/21", to: "2023/24" } } } };
  assert.deepEqual((rollSlotForward(tr).view!.pinned as { yearRange: unknown }).yearRange, { from: "2021/22", to: "2024/25" });
});

test("reuse copies with fresh ids; dates and archive", () => {
  const src = [slide("s1", ["a", "b"])];
  const copy = reuseSlides(src, false);
  assert.notEqual(copy[0].id, "s1");
  assert.notEqual(copy[0].slots[0].id, "a");
  assert.equal(copy[0].slots.length, 2);
  assert.equal(isArchived("2026-10-02", "2026-10-03"), true);
  assert.equal(isArchived("2026-10-03", "2026-10-03"), false, "archives the day after, not on the day");
  assert.equal(isArchived(null, "2026-10-03"), false);
  assert.equal(dayAfter("2026-11-14"), "2026-11-15");
  assert.equal(dayAfter("2026-12-31"), "2027-01-01");
  assert.equal(changeSummary(null, src), "1 slide");
  assert.equal(changeSummary(src, [...src, slide("s2", ["c"])]), "Added 1 slide, added 1 view");
});
