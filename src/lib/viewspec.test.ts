// VicData 0.6.1 S2: the ViewSpec model, its presets, the code copy in schema_version 2, reading
// v1 meetings and custom dashboards, and D10. Run: npx -y tsx --test src/lib/viewspec.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DATAVIEWS } from "@/catalogue/dataviews";
import { TEACHER_DASHBOARDS } from "@/catalogue/dashboards";
import { carryUserState, validateConfig } from "@/catalogue/config";
import { CONFIG_SCHEMA_VERSION, type DashboardConfig, type DataviewInstance } from "@/catalogue/types";
import { PRESET_IDS, VIEW_PRESETS, presetSpec, retarget, upgradeConfig, viewInstance, type StoredConfig } from "@/catalogue/viewspec";
import { PRESET_TABLE_END, PRESET_TABLE_START, presetTableMarkdown } from "@/catalogue/viewspec-doc";
import { viewParamsFor } from "@/components/dashboard-config/plan";
import { slidesOf } from "./meeting-store";
import { arrangeSlide } from "./meeting-layout";
import { slotTitle } from "./meeting-views";

const KNOWN = new Set(DATAVIEWS.map((d) => d.id));
const DOC = readFileSync(new URL("../../docs/v0.6/views_preset_table.md", import.meta.url), "utf8");

// The v1 shape of a config: specs stripped, schema_version 1 (live's seed before the re-seed).
function asV1<T extends { schema_version: number }>(c: T): StoredConfig {
  const strip = (v: DataviewInstance) => {
    const x: Record<string, unknown> = { ...v };
    delete x.spec;
    return x;
  };
  const x = JSON.parse(JSON.stringify(c)) as DashboardConfig;
  return {
    ...x,
    schema_version: 1,
    panels: x.panels.map((p) => ({ ...p, dataviews: p.dataviews.map(strip) })),
    ...(x.presentation ? { presentation: { ...x.presentation, slides: x.presentation.slides.map((s) => ({ ...s, slots: s.slots.map((sl) => (sl.view ? { ...sl, view: strip(sl.view) } : sl)) })) } } : {}),
  } as unknown as StoredConfig;
}

test("every dataview has exactly one preset, made from it, following the page (D1a)", () => {
  assert.deepEqual(PRESET_IDS, DATAVIEWS.map((d) => d.id));
  assert.equal(PRESET_IDS.length, 40);
  for (const dv of DATAVIEWS) {
    const s = VIEW_PRESETS.get(dv.id)!;
    assert.equal(s.preset, dv.id);
    assert.equal(s.compare, "follows-page");
    assert.equal(s.icon, dv.railIcon);
    assert.equal(s.title, dv.titleTemplate);
    assert.deepEqual(s.resultsMeasures, dv.resultsMeasures);
    assert.deepEqual(s.variants, dv.variants);
  }
});

test("the preset table doc lists exactly the code's presets, and its table is current", () => {
  const block = DOC.slice(DOC.indexOf(PRESET_TABLE_START), DOC.indexOf(PRESET_TABLE_END) + PRESET_TABLE_END.length);
  const ids = (text: string) => [...new Set(text.match(/DV-[A-Z0-9-]+[A-Z0-9]/g) ?? [])].sort();
  assert.deepEqual(ids(block), [...PRESET_IDS].sort(), "the generated table's ids");
  assert.equal(block, presetTableMarkdown(), "stale: run npx -y tsx scripts/views-preset-table.ts --write");
  const followsPage = DOC.slice(DOC.indexOf('## What "follows-page" draws today'), DOC.indexOf("## The awkward cases"));
  assert.deepEqual(ids(followsPage), [...PRESET_IDS].sort(), "the follows-page section names every preset");
});

test("the awkward cases translate as the hosts draw them", () => {
  const p = (id: string) => VIEW_PRESETS.get(id as never)!;
  assert.equal(p("DV-C3-CUR-TILES").data.subject, "whole-school");
  assert.deepEqual(p("DV-C3-CUR-TILES").variants, { comparator: ["ranking"] });
  assert.equal(p("DV-C3-TR-MAP").data.change, "absolute");
  assert.equal(p("DV-C3-TR-CHANGEMAP").data.change, undefined);
  for (const id of ["DV-C1-CNT-CUR-DIST", "DV-C1-CNT-TR-SPREAD", "DV-C1-CNT-TR-CHANGETABLE"]) {
    assert.equal(p(id).data.per, "grade");
    assert.deepEqual(p(id).resultsMeasures, ["counts"]);
  }
  assert.equal(p("DV-C1-CAND-TR-GEO-CHART").data.entries, "points-eligible");
  assert.equal(p("DV-C1-CAND-TR-GEO-CHART").data.rows, undefined);
  assert.equal(p("DV-C2-CUR-DONUT").data.rows, "follows-page");
  assert.equal(p("DV-C1-RES-CUR-GRADES").view.kind, "spread");
});

test("presetSpec hands out a copy; viewInstance and retarget keep spec.preset === dataview", () => {
  const a = presetSpec("DV-C2-CUR-BARS");
  a.title = "changed";
  assert.notEqual(VIEW_PRESETS.get("DV-C2-CUR-BARS")!.title, "changed");
  const v = viewInstance("p/x", "DV-C2-CUR-BARS", { title: "Mine", params: { a: 1 } });
  assert.equal(v.spec.preset, "DV-C2-CUR-BARS");
  assert.equal(v.title, "Mine");
  const w = retarget(v, "DV-C2-CUR-LIST");
  assert.equal(w.id, "p/x");
  assert.equal(w.spec.preset, "DV-C2-CUR-LIST");
  assert.throws(() => presetSpec("DV-NOPE"));
});

test("the four Teacher dashboards' code copy is schema_version 2, every instance with its preset", () => {
  assert.equal(CONFIG_SCHEMA_VERSION, 2);
  for (const d of TEACHER_DASHBOARDS) {
    assert.equal(d.schema_version, 2);
    assert.deepEqual(validateConfig(d, KNOWN), []);
    for (const p of d.panels)
      for (const v of p.dataviews) {
        assert.equal(v.kind, "view");
        if (v.kind !== "view") continue;
        assert.equal(v.id, `${p.id}/${v.dataview}`, "instance ids unchanged (D10)");
        assert.deepEqual(v.spec, presetSpec(v.dataview));
      }
  }
});

test("validateConfig: a view without its spec, or with another dataview's, is a problem", () => {
  const d = JSON.parse(JSON.stringify(TEACHER_DASHBOARDS[0])) as DashboardConfig;
  const v = d.panels[0].dataviews[0] as Extract<DataviewInstance, { kind: "view" }>;
  v.spec = presetSpec("DV-C2-CUR-LIST");
  assert.match(validateConfig(d, KNOWN).map((p) => p.message).join("|"), /isn't its dataview/);
  delete (v as Partial<typeof v>).spec;
  assert.match(validateConfig(d, KNOWN).map((p) => p.message).join("|"), /needs its spec/);
});

test("D10: carryUserState keeps every panel's state across the v1 -> v2 re-seed", () => {
  for (const next of TEACHER_DASHBOARDS) {
    const prev = asV1(next) as unknown as DashboardConfig;
    const panels = Object.fromEntries(next.panels.map((p) => [p.id, { open: true, view: p.dataviews[p.dataviews.length - 1].id }]));
    const carried = carryUserState(prev, next, { version: "1", panels }, "2");
    assert.deepEqual(carried.panels, panels, next.id);
  }
});

test("D10: a view's params are looked up by instance id, not by (column, dataview)", () => {
  const d = JSON.parse(JSON.stringify(TEACHER_DASHBOARDS[1])) as DashboardConfig;
  const current = d.panels.find((p) => p.id.endsWith("c1.current"))!;
  current.dataviews.push(viewInstance(`${current.id}/DV-C1-RES-CUR-TILES~2`, "DV-C1-RES-CUR-TILES", { params: { tiles: [{ figure: "england" }] }, resultsMeasures: ["bands"] }));
  const first = current.dataviews.find((v) => v.id === `${current.id}/DV-C1-RES-CUR-TILES`)!;
  if (first.kind === "view") first.params = { tiles: [{ figure: "category" }] };
  assert.deepEqual(viewParamsFor(d, `${current.id}/DV-C1-RES-CUR-TILES`), { tiles: [{ figure: "category" }] });
  assert.deepEqual(viewParamsFor(d, `${current.id}/DV-C1-RES-CUR-TILES~2`), { tiles: [{ figure: "england" }] });
  assert.equal(viewParamsFor(d, null), null);
  assert.equal(viewParamsFor(d, "nope"), null);
});

test("a v1 custom dashboard converts on read: specs added, everything else as it was", () => {
  const v1 = {
    schema_version: 1,
    id: "c",
    name: "My History board",
    kind: "dashboard",
    owner: "user",
    colour: { key: "ks4" },
    layout: { preset: "1", tracks: [1], accordion: "auto-close" },
    columns: [{ id: "c1", title: "Results", icon: "results", data: { data: "academic.results", phase: "ks4", results: "pill" }, focus: { kind: "subject", subject: { mode: "follow-chips" } }, compare: null }],
    rows: [{ id: "r1", name: "Current", time: "latest", openByDefault: true }],
    panels: [
      {
        id: "p1",
        row: "r1",
        column: "c1",
        dataviews: [
          { id: "p1/DV-C1-RES-CUR-TILES", kind: "view", dataview: "DV-C1-RES-CUR-TILES", params: { tiles: [{ figure: "category" }] }, title: "Mine", resultsMeasures: ["points"] },
          { id: "p1/plan", kind: "placeholder", description: "Later", shape: null },
        ],
        defaultView: "p1/DV-C1-RES-CUR-TILES",
        defaultViewByResults: { points: "p1/DV-C1-RES-CUR-TILES" },
      },
    ],
  } as unknown as StoredConfig;
  const before = JSON.stringify(v1);
  const up = upgradeConfig(v1);
  assert.equal(JSON.stringify(v1), before, "the stored copy isn't mutated");
  assert.equal(up.schema_version, 2);
  assert.deepEqual(validateConfig(up, KNOWN), []);
  const v = up.panels[0].dataviews[0];
  assert.ok(v.kind === "view");
  assert.deepEqual(v.spec, presetSpec("DV-C1-RES-CUR-TILES"));
  const rest: Record<string, unknown> = { ...v };
  delete rest.spec;
  assert.deepEqual(rest, (v1.panels[0].dataviews[0] as object));
  assert.deepEqual(up.panels[0].dataviews[1], v1.panels[0].dataviews[1]);
  assert.deepEqual({ ...up.panels[0], dataviews: [] }, { ...v1.panels[0], dataviews: [] });
  assert.equal(upgradeConfig(up), up, "a current config comes back as it is");
  assert.equal(JSON.stringify(upgradeConfig(asV1(TEACHER_DASHBOARDS[0]))), JSON.stringify(TEACHER_DASHBOARDS[0]), "v1 seed -> the code copy");
});

test('Guy\'s meeting "Autumn department meeting" (v1, with a text-box slide) still loads and renders its model', () => {
  const meeting = {
    schema_version: 1,
    id: "m",
    name: "Autumn department meeting",
    kind: "presentation",
    owner: "user",
    colour: { key: "neutral" },
    layout: { preset: "1", tracks: [1], accordion: "independent" },
    columns: [],
    rows: [],
    panels: [],
    presentation: {
      meetingDate: "2026-10-20",
      slides: [
        {
          id: "s1",
          title: "History results",
          layout: "auto",
          slots: [
            {
              id: "a",
              view: { id: "a/DV-C2-CUR-BARS", kind: "view", dataview: "DV-C2-CUR-BARS", pinned: { phase: "ks4", data: "academic.candidates", subjectLabel: "History", schoolName: "Acland Burghley School", compare: { kind: "subjects", name: "Humanities" }, year: "2024/25" }, keepLive: false },
            },
          ],
        },
        { id: "s2", title: "Actions", layout: "1+text", slots: [{ id: "a2", view: { id: "a2/DV-C1-RES-TR-CHART", kind: "view", dataview: "DV-C1-RES-TR-CHART", pinned: { phase: "ks4", data: "academic.results", subjectLabel: "History", year: "2024/25" } } }, { id: "t", text: "1. Revisit the Year 11 mocks\n2. Share with SLT" }] },
      ],
    },
  } as unknown as StoredConfig;
  const up = upgradeConfig(meeting);
  assert.equal(up.schema_version, 2);
  // (A meeting has no columns, so only its own checks apply: none about its views.)
  assert.deepEqual(validateConfig(up, KNOWN).filter((p) => !/columns|tracks/.test(p.path)), []);
  const slides = slidesOf(up);
  assert.equal(slides.length, 2);
  // The text box is exactly as saved.
  assert.deepEqual(slides[1].slots[1], { id: "t", text: "1. Revisit the Year 11 mocks\n2. Share with SLT" });
  // The views gain their preset's spec and keep their pins.
  for (const s of slides) for (const sl of s.slots) if (sl.view) {
    assert.ok(sl.view.kind === "view");
    assert.equal(sl.view.spec.preset, sl.view.dataview);
    assert.ok(sl.view.pinned);
  }
  // The model renders as before: titles from the pins, and the 1+text layout places both slots.
  assert.equal(slotTitle(slides[0].slots[0]), slotTitle(asV1Slot(meeting, 0, 0)));
  assert.equal(slotTitle(slides[0].slots[0]), "Entries by subject in Humanities");
  const arranged = arrangeSlide(slides[1]);
  assert.equal(JSON.stringify(arranged), JSON.stringify(arrangeSlide((meeting as unknown as DashboardConfig).presentation!.slides[1])));
});

function asV1Slot(c: StoredConfig, s: number, i: number) {
  return (c as unknown as DashboardConfig).presentation!.slides[s].slots[i];
}
