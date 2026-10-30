// Run: npx -y tsx --test --test-force-exit src/lib/featured-row.test.ts
// VicData 0.8 Admissions feedback round 1 (F-17, R-TABLE-FEATURED-ROW): every product's tables tint the
// featured school's row in the product's own colour -- one token per product, light and dark -- and the
// tables draw it. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FEATURED_ROW_BG, FEATURED_ROW_TOKEN, featuredRowKey, featuredRowVars, type FeaturedRowKey } from "../components/shell/accent";
import { admissionsVars } from "../components/admissions/ui";
import { smtVars } from "../components/smt/ui";
import { groupVars } from "../components/groups/ui";
import { groupDashVars } from "../components/groups/dash/GroupDashboard";
import { SortTable } from "../components/teacher/SortTable";

const root = new URL("../../", import.meta.url).pathname;
const css = readFileSync(root + "src/app/globals.css", "utf8");
const KEYS = Object.keys(FEATURED_ROW_TOKEN) as FeaturedRowKey[];

// The three theme blocks: the light root, the dark media query, and the explicit dark theme.
function blocks(): { light: string; darkMedia: string; dark: string } {
  const light = css.slice(css.indexOf("#teacher-root, body > [data-feedback-window] {"));
  const darkMedia = css.slice(css.indexOf('#teacher-root:not([data-theme="light"]), body > [data-feedback-window] {'));
  const dark = css.slice(css.indexOf('#teacher-root[data-theme="dark"] {'));
  const upTo = (s: string) => s.slice(0, s.indexOf("}"));
  return { light: upTo(light), darkMedia: upTo(darkMedia), dark: upTo(dark) };
}
const valueIn = (block: string, token: string) => new RegExp(`${token}:\\s*(#[0-9a-f]{6})`).exec(block)?.[1] ?? null;

test("one token per product, set in light and both dark blocks", () => {
  assert.deepEqual(KEYS.sort(), ["admissions", "gcse", "groups", "post16", "smt"]);
  const b = blocks();
  for (const k of KEYS) {
    const t = FEATURED_ROW_TOKEN[k];
    const light = valueIn(b.light, t);
    const dark = valueIn(b.dark, t);
    assert.ok(light, `${t} light`);
    assert.ok(dark, `${t} dark`);
    assert.equal(valueIn(b.darkMedia, t), dark, `${t}: the dark media block and the dark theme agree`);
    assert.notEqual(light, dark, `${t} differs by theme`);
  }
});

// WCAG contrast of the body text on each tint: light --fg #17171b and --muted2 #55555c; dark --fg #f2f2f3.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
test("text reads on every tint (AA, 4.5:1)", () => {
  const b = blocks();
  for (const k of KEYS) {
    const t = FEATURED_ROW_TOKEN[k];
    assert.ok(ratio(valueIn(b.light, t)!, "#17171b") >= 4.5, `${t} light, --fg`);
    assert.ok(ratio(valueIn(b.light, t)!, "#55555c") >= 4.5, `${t} light, --muted2`);
    assert.ok(ratio(valueIn(b.dark, t)!, "#f2f2f3") >= 4.5, `${t} dark, --fg`);
  }
});

test("each product's root names its own token", () => {
  const named = (v: object) => (v as Record<string, string>)["--row-featured"];
  for (const theme of ["light", "dark"] as const) {
    assert.equal(named(admissionsVars(theme)), "var(--row-featured-admissions)");
    assert.equal(named(smtVars(theme)), "var(--row-featured-smt)");
    assert.equal(named(groupVars(theme)), "var(--row-featured-groups)");
    assert.equal(named(groupDashVars(theme)), "var(--row-featured-groups)");
  }
  assert.equal(featuredRowKey("teacher", "ks4"), "gcse");
  assert.equal(featuredRowKey("teacher", "ks5"), "post16");
  assert.equal(featuredRowKey("teacher", "ks2"), null);
  assert.deepEqual(featuredRowVars(null), {});
  assert.equal(featuredRowKey("admissions"), "admissions");
});

test("the tables draw the featured row with the token (and nothing else does)", () => {
  const html = renderToStaticMarkup(
    createElement(SortTable, {
      rows: [
        { key: "a", label: "Us", value: 5, valueLabel: "5", delta: null, deltaLabel: "", highlight: true },
        { key: "b", label: "Them", value: 4, valueLabel: "4", delta: null, deltaLabel: "" },
      ],
      sort: { key: "value", dir: "desc" },
      onSort: () => undefined,
      columns: { name: "School", value: "Result", delta: "Rank" },
    }),
  );
  assert.equal((html.match(/var\(--row-featured,/g) ?? []).length, 1);
  assert.ok(FEATURED_ROW_BG.startsWith("var(--row-featured,"));
  // The table files: every featured row reads FEATURED_ROW_BG; no old per-file tint is left.
  const files = ["src/components/admissions/views/Tables.tsx", "src/components/teacher/SchoolRankingTable.tsx", "src/components/teacher/SortTable.tsx", "src/components/teacher/SeriesViews.tsx", "src/components/groups/dash/views.tsx"];
  for (const f of files) {
    const src = readFileSync(root + f, "utf8");
    assert.ok(src.includes("FEATURED_ROW_BG"), `${f} uses the token`);
    assert.ok(!/<tr[^>]*bg-\[var\(--adm-tint\)\]/.test(src), `${f}: no row tinted with --adm-tint`);
    assert.ok(!src.includes("rgba(var(--accent-rgb,138,138,144),0.1"), `${f}: no hand-made accent tint`);
  }
});
