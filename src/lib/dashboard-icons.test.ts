// Run: npx -y tsx --test src/lib/copy-view.test.ts src/lib/dashboard-icons.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { teacherDashboardFor } from "@/catalogue/dashboards";
import { PHASE_ACCENT, FEATURE_ACCENT } from "./teacher-view-theme";
import {
  colourKeyOf,
  colourOf,
  DASHBOARD_COLOURS,
  defaultIcon,
  iconOf,
  ICON_SET,
  NEUTRAL_COLOUR,
  resolveIcon,
  tileMetrics,
  uploadPath,
  uploadUrl,
  viewsOn,
  withColour,
} from "./dashboard-icons";

test("the six swatches are the real tokens, in the board's order", () => {
  assert.deepEqual(DASHBOARD_COLOURS.map((c) => c.label), ["GCSE", "Post-16", "Rolls", "Social context", "Rose", "Amber"]);
  assert.equal(DASHBOARD_COLOURS[0].hex, PHASE_ACCENT.ks4!.hex);
  assert.equal(DASHBOARD_COLOURS[1].hex, PHASE_ACCENT.ks5!.hex);
  assert.equal(DASHBOARD_COLOURS[2].hex, "#22d3ee");
  assert.equal(DASHBOARD_COLOURS[2].rgb, "34,211,238");
  assert.equal(DASHBOARD_COLOURS[3].hex, "#fb923c");
  assert.equal(DASHBOARD_COLOURS[4].hex, FEATURE_ACCENT.meetings.hex);
  assert.equal(DASHBOARD_COLOURS[5].hex, FEATURE_ACCENT.recruitment.hex);
});

test("colour: phase key, override, neutral; picking writes back", () => {
  assert.equal(colourOf({ key: "ks5" }).hex, "#a78bfa");
  assert.equal(colourOf({ key: "ks4", override: "rolls" }).hex, "#22d3ee");
  assert.deepEqual(colourOf({ key: "neutral" }), NEUTRAL_COLOUR);
  assert.equal(colourKeyOf({ key: "neutral", override: "#123456" }), "neutral");
  assert.deepEqual(withColour({ key: "ks4", override: "rose" }, "ks5"), { key: "ks5" });
  assert.deepEqual(withColour({ key: "ks4" }, "amber"), { key: "ks4", override: "amber" });
});

test("default icon: the first column's icon (the Main board's cards), meetings' own glyph", () => {
  assert.deepEqual(defaultIcon(teacherDashboardFor("ks4", "candidates")), { source: "set", ref: "column.candidates" });
  assert.deepEqual(defaultIcon(teacherDashboardFor("ks5", "results")), { source: "set", ref: "column.results" });
  assert.deepEqual(defaultIcon({ kind: "dashboard", columns: [] }), { source: "set", ref: "library" });
  assert.deepEqual(defaultIcon({ kind: "presentation", columns: [] }), { source: "set", ref: "feature.meetings" });
  assert.deepEqual(iconOf({ kind: "dashboard", columns: [], icon: { source: "set", ref: "school" } }), { source: "set", ref: "school" });
  for (const i of ICON_SET) assert.deepEqual(resolveIcon({ source: "set", ref: i.ref }), { kind: "set", ref: i.ref });
});

test("from a view: the view's standard rail glyph; unknown falls back", () => {
  assert.deepEqual(resolveIcon({ source: "view", ref: "DV-C3-TR-CHART" }), { kind: "rail", name: "TrendLineIcon" });
  assert.deepEqual(resolveIcon({ source: "view", ref: "DV-NOPE" }), { kind: "set", ref: "library" });
  assert.deepEqual(resolveIcon({ source: "set", ref: "nope" }), { kind: "set", ref: "library" });
});

test("upload: path and public URL", () => {
  assert.equal(uploadPath("mine-1", "Logo.PNG", 36), "mine-1/10.png");
  assert.equal(uploadPath("a b/c", "x.svg", 36), "a_b_c/10.svg");
  assert.equal(uploadPath("d", "photo.jpg"), null);
  assert.equal(uploadUrl("d/1.png", "https://x.supabase.co/"), "https://x.supabase.co/storage/v1/object/public/dashboard-icons/d/1.png");
  assert.equal(uploadUrl("https://cdn/x.png", "https://x"), "https://cdn/x.png");
  assert.deepEqual(resolveIcon({ source: "upload", ref: "d/1.png" }, "https://x.supabase.co"), { kind: "img", src: "https://x.supabase.co/storage/v1/object/public/dashboard-icons/d/1.png" });
});

test("tile metrics: the boards' 38 and 52 sizes", () => {
  assert.deepEqual(tileMetrics(38), { size: 38, radius: 10, glyph: 20, tint: 0.14 });
  assert.deepEqual(tileMetrics(52), { size: 52, radius: 13, glyph: 27, tint: 0.16 });
});

test("views on a dashboard, once each", () => {
  const v = viewsOn(teacherDashboardFor("ks4", "results"));
  assert.equal(new Set(v).size, v.length);
  assert.ok(v.includes("DV-C3-TR-CHART"));
});
