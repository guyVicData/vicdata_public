// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/subject-colour.test.tsx
// VicData 0.8 review fixes (14 Nov, M7): R-SUBJECT-COLOUR -- one family, one colour, everywhere; keyed; never by
// rank -- and its half of R-THEME-CONTRAST. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SUBJECT_FAMILY_COLOURS, cssVarNameForSubjectFamily, familyColourVar } from "./subject-family-colours";
import { clearSubjectFamilies, registerSubjectFamilies } from "./subject-family-registry";
import { paletteInOrder, tintInOrder } from "./teacher-view-trend-styles";
import { QUAL_GROUP_COLOURS } from "@/components/smt/views/Academic";
import { WalkChart, palette } from "@/components/front-door/charts";
import type { Chart } from "./front-door/teacher-screens";

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h: string) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function lab(h: string): [number, number, number] {
  const [r, g, b] = rgb(h).map(lin);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** CIEDE2000. */
function de(h1: string, h2: string): number {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2), rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360, h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
  let dh = h2p - h1p; if (C1 * C2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad), Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2;
  let hb = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : (h1p + h2p + 360) / 2; if (C1 * C2 === 0) hb = h1p + h2p;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)), dth = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dth * rad) * Rc;
  const dC = C2 - C1;
  return Math.sqrt(((L2 - L1) / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
// The product accents and the fixed lines a family colour must stay away from.
const RESERVED = { light: ["#12a05c", "#7c5ce6", "#c2410c", "#0b6fa6", "#a86f00", "#3987e5", "#d55181", "#dc2626", "#8a5a2b"], dark: ["#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#c98500", "#3987e5", "#d55181", "#dc2626", "#a8743f"] };
const PLATE = { light: "#ffffff", mid: "#ffffff", dark: "#0b0b0d" } as const;

test("R-SUBJECT-COLOUR: eight families well apart (CIEDE2000 >= 15), away from the accents and fixed lines (>= 12); R-THEME-CONTRAST: 3:1 on each theme's plate", () => {
  const ids = Object.keys(SUBJECT_FAMILY_COLOURS);
  assert.equal(ids.length, 8);
  for (const t of ["light", "mid", "dark"] as const) {
    const cs = ids.map((id) => SUBJECT_FAMILY_COLOURS[id][t][1]);
    let min = Infinity;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) min = Math.min(min, de(cs[i], cs[j]));
    assert.ok(min >= 15, `${t}: closest pair ${min.toFixed(1)}`);
    const res = RESERVED[t === "dark" ? "dark" : "light"];
    for (const c of cs) {
      assert.ok(Math.min(...res.map((r) => de(c, r))) >= 12, `${t} ${c} too near an accent or fixed line`);
      assert.ok(contrast(c, PLATE[t]) >= 3, `${t} ${c}: ${contrast(c, PLATE[t]).toFixed(2)}:1`);
    }
  }
  // globals.css carries the same colours as the TS (the CSS variables the dashboards draw with).
  const css = readFileSync("src/app/globals.css", "utf8");
  for (const id of ids) {
    const v = cssVarNameForSubjectFamily(id);
    assert.ok(css.includes(`${v}: ${SUBJECT_FAMILY_COLOURS[id].light[1]};`), `${v} light`);
    assert.ok(css.includes(`${v}: ${SUBJECT_FAMILY_COLOURS[id].dark[1]};`), `${v} dark`);
  }
});

test("R-SUBJECT-COLOUR: a subject keeps its family's colour whatever its rank (bars and trend lines); the focus keeps the accent", () => {
  clearSubjectFamilies();
  registerSubjectFamilies([{ subject: "Maths", familyId: "sciences_maths" }, { subject: "Physics", familyId: "sciences_maths" }, { subject: "History", familyId: "humanities_social" }, { subject: "French", familyId: "languages_literature" }]);
  const keys = ["Maths::G", "Physics::G", "History::G", "French::G"];
  const a = tintInOrder(keys, "History::G", "ACCENT");
  const b = tintInOrder([...keys].reverse(), "History::G", "ACCENT");
  for (const k of keys) assert.equal(a.get(k), b.get(k), `${k}: the same colour in any order`);
  assert.equal(a.get("History::G"), "ACCENT");
  assert.equal(a.get("French::G"), familyColourVar("languages_literature"));
  const p1 = paletteInOrder(keys, null, "ACCENT", ["#111111", "#222222"], null);
  const p2 = paletteInOrder([keys[2], keys[0], keys[3], keys[1]], null, "ACCENT", ["#111111", "#222222"], null);
  for (const k of keys) assert.equal(p1.get(k), p2.get(k), `${k}: a trend line's colour doesn't follow its rank`);
  assert.notEqual(p1.get("Maths::G"), p1.get("Physics::G"), "two of one family told apart by shade");
  assert.ok(String(p1.get("Maths::G")).includes(cssVarNameForSubjectFamily("sciences_maths")));
  // Not registered (a school, an area): the old palette.
  assert.equal(paletteInOrder(["own", "area-la"], "own", "ACCENT", ["#111111"], null).get("area-la"), "#111111");
  clearSubjectFamilies();
});

test("R-SUBJECT-COLOUR: the walk's bars colour each subject by family and key every family shown; qualification groups have their own colours", () => {
  const chart: Chart = { kind: "vbars", rows: [{ label: "Geography", value: 9, role: "focus" }, { label: "Maths", value: 8, role: "other", family: "sciences_maths" }, { label: "French", value: 7, role: "other", family: "languages_literature" }], average: null, unit: "entries", yCaption: "Entries", keys: [{ label: "Geography", role: "focus", mark: "swatch" }, { label: "Sciences & Maths", role: "peer", mark: "swatch", family: "sciences_maths" }, { label: "Languages & Literature", role: "peer", mark: "swatch", family: "languages_literature" }] };
  const html = renderToStaticMarkup(createElement(WalkChart, { chart, p: palette({ dark: false, accent: { hex: "#34d399", light: "#12a05c" }, categoryId: null }) }));
  assert.ok(html.includes(SUBJECT_FAMILY_COLOURS.sciences_maths.light[1]), "Maths in its family's colour");
  assert.ok(html.includes(SUBJECT_FAMILY_COLOURS.languages_literature.light[1]), "French in its family's colour");
  assert.equal((html.match(/data-key-entry=/g) ?? []).length, 3, "a key entry for the focus and each family");
  assert.equal(new Set(QUAL_GROUP_COLOURS).size, 8, "eight qualification-group colours: none repeats after five");
  assert.ok(QUAL_GROUP_COLOURS.every((c) => !/ac-above|ac-below/.test(c)), "never the above/below-the-set colours");
  const src = readFileSync("src/components/smt/views/Academic.tsx", "utf8");
  assert.doesNotMatch(src, /MIX_COLOURS = \["var\(--accent\)", "var\(--ac-above\)"/);
});
