// Run: npx -y tsx --test --test-force-exit src/lib/front-door/contrast.test.ts
// VicData 0.8 front door: R-THEME-CONTRAST, R-PANEL-LADDER and R-ROLE-COLOURS' token half, read from
// globals.css itself. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AA, contrast, contrastTable, LADDER_STEP, ladderSteps, tokensOf, walkHeadPairs } from "./contrast";
import { GROUP_ACCENT, PHASE_ACCENT, ROLE_ACCENT, ROLE_ACCENT_LIGHT } from "../teacher-view-theme";

const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

test("contrast: the WCAG formula", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff") * 10) / 10, 21);
  assert.equal(contrast("#777777", "#777777"), 1);
});

test("R-THEME-CONTRAST: every Mid text/background pair and the ladder's text pairs pass AA", () => {
  const table = contrastTable(css);
  assert.ok(table.length >= 30, `table has ${table.length} rows`);
  for (const p of table) {
    assert.match(p.fg ?? "", /^#[0-9a-f]{6}$/, `${p.name}: fg read from the stylesheet`);
    assert.match(p.bg ?? "", /^#[0-9a-f]{6}$/, `${p.name}: bg read from the stylesheet`);
    const r = contrast(p.fg, p.bg);
    assert.ok(r >= AA[p.kind], `${p.name}: ${p.fg} on ${p.bg} = ${r.toFixed(2)} < ${AA[p.kind]}`);
  }
});

test("R-THEME-CONTRAST: the walk header draws only its own tokens, both bands, every part", () => {
  const src = readFileSync(path.join(__dirname, "../../components/front-door/WalkPage.tsx"), "utf8");
  const head = src.slice(src.indexOf("export function WalkHeader"), src.indexOf("function homeOf"));
  assert.ok(head.length > 200, "WalkHeader found");
  const vars = [...head.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  assert.ok(vars.length >= 8);
  for (const v of vars) assert.match(v, /^--wh-/, `WalkHeader reads ${v}`);
  const rows = walkHeadPairs(css);
  assert.equal(rows.length, 2 * (3 + 5 * 2));
  for (const p of rows) assert.ok(contrast(p.fg, p.bg) >= AA[p.kind], `${p.name}: ${p.fg} on ${p.bg}`);
});

test("R-PANEL-LADDER: a shut panel differs from its column by the logged step, Dark and Light", () => {
  const s = ladderSteps(css);
  assert.ok(s.darkFill >= LADDER_STEP.darkFill, `dark fill ${s.darkFill}`);
  assert.ok(s.darkBorder >= LADDER_STEP.darkBorder, `dark border ${s.darkBorder}`);
  assert.ok(s.lightBorder >= LADDER_STEP.lightBorder, `light border ${s.lightBorder}`);
  // Front door 2b (M3): Mid on the dashboards draws Light's ladder on the field -- the same step -- and a
  // column stands off every field's lighter stop; no Mid rule overrides the ladder's tokens.
  assert.ok(s.midBorder >= LADDER_STEP.midBorder, `mid border ${s.midBorder}`);
  assert.ok(s.midColumnOnField >= LADDER_STEP.midColumnOnField, `mid column on the field ${s.midColumnOnField}`);
  for (const m of css.matchAll(/#teacher-root\[data-mid-dash[^{]*\{([^}]*)\}/g)) assert.doesNotMatch(m[1], /--(shut-|panel-bg|box-bg|well-border)/, "a Mid rule overrides the ladder");
  // The well is the chart's plate: in Light, white on a grey column; in Dark, darker than its column.
  assert.equal(s.tokens.ll["--box-bg"], "#ffffff");
  assert.ok(contrast(s.tokens.ld["--box-bg"], "#000000") < contrast(s.tokens.ld["--panel-bg"], "#000000"));
  // page -> column: the column is lighter than the page in both themes.
  assert.ok(contrast(s.tokens.ll["--panel-bg"], "#000000") > contrast(s.tokens.ll["--bg"], "#000000"));
  assert.ok(contrast(s.tokens.ld["--panel-bg"], "#000000") > contrast(s.tokens.ld["--bg"], "#000000"));
});

test("R-ROLE-COLOURS: SMT orange, head office bronze, Post-16 violet, GCSE green, Admissions cyan", () => {
  assert.equal(ROLE_ACCENT.smt.hex, "#fb923c");
  assert.equal(ROLE_ACCENT_LIGHT.smt.hex, "#c2410c");
  assert.ok(contrast(ROLE_ACCENT_LIGHT.smt.hex, "#ffffff") >= 4.5);
  assert.equal(PHASE_ACCENT.ks5?.hex, "#a78bfa");
  assert.equal(PHASE_ACCENT.ks4?.hex, "#34d399");
  assert.equal(ROLE_ACCENT.admissions.hex, "#22d3ee");
  // Bronze: text on the dark panel, a mark on white.
  assert.ok(contrast(GROUP_ACCENT.hex, "#131315") >= 4.5);
  assert.ok(contrast(GROUP_ACCENT.hex, "#ffffff") >= 3);
  // SMT's and head office's tokens are no longer violet; set creator colours follow.
  const light = tokensOf(css, ":root");
  const dark = tokensOf(css, ':root[data-theme="dark"], #teacher-root[data-theme="dark"]');
  assert.equal(light["--set-smt-bg"], "#feebdc");
  assert.equal(dark["--set-smt-bg"], "#412c1d");
  assert.equal(light["--set-group-bg"], "#f3e6d8");
  for (const t of [light, dark]) {
    assert.ok(contrast(t["--set-smt-fg"], t["--set-smt-bg"]) >= 4.5);
    assert.ok(contrast(t["--set-group-fg"], t["--set-group-bg"]) >= 4.5);
  }
  const rows = tokensOf(css, "#teacher-root, body > [data-feedback-window]");
  assert.equal(rows["--row-featured-smt"], "#feebdc");
  assert.equal(rows["--row-featured-groups"], "#f7eee4");
  assert.notEqual(ROLE_ACCENT.smt.hex, PHASE_ACCENT.ks5?.hex);
  assert.notEqual(GROUP_ACCENT.hex, ROLE_ACCENT.smt.hex);
});
