// Run: npx -y tsx --test --test-force-exit src/lib/featured-row.test.ts
// VicData 0.8 Admissions feedback round 1 (F-17, R-TABLE-FEATURED-ROW): every product's tables tint the
// featured school's row in the product's own colour -- one token per product, light and dark -- and the
// tables draw it. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FEATURED_ROW_BG, FEATURED_ROW_TOKEN, featuredRow, featuredRowKey, featuredRowVars, type FeaturedRowKey } from "../components/shell/accent";
import { featuredRowFindings, FOCUS_TABLES, NO_FOCUS_ROWS } from "./featured-row-scan";
import { admissionsVars } from "../components/admissions/ui";
import { smtVars } from "../components/smt/ui";
import { groupVars } from "../components/groups/ui";
import { groupDashVars } from "../components/groups/dash/GroupDashboard";
import { SortTable } from "../components/teacher/SortTable";

const root = new URL("../../", import.meta.url).pathname;
const css = readFileSync(root + "src/app/globals.css", "utf8");
// The tokens set on #teacher-root's three theme blocks; the Data View's is on :root (F-22, below).
const KEYS = (Object.keys(FEATURED_ROW_TOKEN) as FeaturedRowKey[]).filter((k) => k !== "dataview");

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
  assert.deepEqual(KEYS.sort(), ["admissions", "gcse", "groups", "ks2", "post16", "smt"]);
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

// F-22 (feedback deploy gate): F-17's own bar, held for every token -- text 11:1 or better in both themes,
// muted text 6.3:1 or better on the light tint. "6.3" as F-17 rounded it: Post-16's and SMT's violet is
// 6.29:1 exactly, so the bar is 6.25 to the hundredth.
test("F-22: every tint meets F-17's contrast (text 11:1, muted 6.3:1)", () => {
  const b = blocks();
  for (const k of KEYS) {
    const t = FEATURED_ROW_TOKEN[k];
    assert.ok(ratio(valueIn(b.light, t)!, "#17171b") >= 11, `${t} light, --fg`);
    assert.ok(ratio(valueIn(b.light, t)!, "#55555c") >= 6.25, `${t} light, --muted2`);
    assert.ok(ratio(valueIn(b.dark, t)!, "#f2f2f3") >= 11, `${t} dark, --fg`);
  }
});

// The Data View's token: on :root (its pages are outside #teacher-root), light, the dark media query and
// the explicit dark theme. Its rows' text: #171717 / #ededed; muted on the row neutral-600 / neutral-400.
test("F-22: the Data View's token, light and dark, and its contrast", () => {
  const at = (sel: string) => {
    const i = css.indexOf(sel);
    assert.ok(i >= 0, sel);
    return css.slice(i, css.indexOf("}", i));
  };
  const light = valueIn(at(":root { --row-featured-dataview"), "--row-featured-dataview");
  const darkMedia = valueIn(at(':root:not([data-theme="light"]) { --row-featured-dataview'), "--row-featured-dataview");
  const dark = valueIn(at(':root[data-theme="dark"] { --row-featured-dataview'), "--row-featured-dataview");
  assert.ok(light && dark);
  assert.equal(darkMedia, dark);
  assert.notEqual(light, dark);
  assert.ok(ratio(light!, "#171717") >= 11 && ratio(light!, "#525252") >= 6.3, "Data View light");
  assert.ok(ratio(dark!, "#ededed") >= 11 && ratio(dark!, "#a1a1a1") >= 6.3, "Data View dark");
  // A meeting slide's Admissions view names Admissions' token (the meeting's root is rose).
  assert.ok(readFileSync(root + "src/components/meetings/liveSlotRenderer.tsx", "utf8").includes('featuredRowVars("admissions")'), "meeting slides: Admissions' token");
  // The Data View's pages name it.
  // (0.8 sets round 1: /sets/[id] is the set view now, whose list never holds the focus school.)
  for (const f of ["src/components/data-view/DataViewShell.tsx"]) assert.ok(readFileSync(root + f, "utf8").includes('featuredRowVars("dataview")'), f);
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
  assert.equal(featuredRowKey("teacher", "ks2"), "ks2");
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

// ------------------------------------------------------------------ F-22 (R-FEATURED-ROW-EVERYWHERE)
const tsxFiles = () =>
  (readdirSync(root + "src", { recursive: true }) as string[])
    .filter((f) => f.endsWith(".tsx") && !f.includes("__"))
    .map((f) => ({ file: `src/${f}`, text: readFileSync(root + "src/" + f, "utf8") }));

test("F-22: every table or rank view of schools marks the focus row, or says why it has none", () => {
  const { unmarkedTables, unlisted, rows } = featuredRowFindings(tsxFiles());
  assert.deepEqual(unmarkedTables, [], "focus tables without data-featured-row");
  assert.deepEqual(unlisted.map((r) => `${r.file}:${r.line} <${r.tag}>`), [], "school rows neither marked nor listed in NO_FOCUS_ROWS");
  assert.ok(rows.filter((r) => r.marked).length >= 15, "the marked rows are found");
  // Every listed exception still matches a row (a stale entry could hide a new table).
  for (const x of NO_FOCUS_ROWS) assert.ok(rows.some((r) => r.file === x.file && r.listed === x.why), `stale NO_FOCUS_ROWS entry: ${x.file} ${x.has ?? ""}`);
  for (const t of FOCUS_TABLES) assert.ok(readFileSync(root + t.file, "utf8").length > 0, t.file);
});

test("F-22: featuredRow marks and tints, and nothing else", () => {
  assert.deepEqual(featuredRow(false), {});
  const on = featuredRow(true);
  assert.equal(on["data-featured-row"], "");
  assert.equal(on.style?.background, FEATURED_ROW_BG);
  const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement("tr", { key: "a", ...featuredRow(true) }), createElement("tr", { key: "b", ...featuredRow(false) }))));
  assert.equal((html.match(/data-featured-row=""/g) ?? []).length, 1);
  assert.equal((html.match(/var\(--row-featured,/g) ?? []).length, 1);
});

test("F-22: no hand-made focus tint is left in the Data View, the group views or Admissions' ranked rows", () => {
  for (const f of ["src/components/data-view/RankingsView.tsx", "src/components/data-view/AcademicRankingsView.tsx", "src/components/data-view/SubjectDeepDiveDrawer.tsx"]) {
    assert.ok(!/bg-red-50|bg-red-950/.test(readFileSync(root + f, "utf8")), `${f}: bg-red-50 / bg-red-950 replaced by the token`);
  }
  assert.ok(!readFileSync(root + "src/components/groups/dash/views-r3.tsx", "utf8").includes("bg-[var(--adm-tint)]"), "views-r3: the picked school takes the groups' token");
  for (const f of ["src/components/admissions/views/Bars.tsx", "src/components/admissions/panels/Academic.tsx"]) {
    assert.ok(!/(me|isSchool) \? "bg-\[var\(--adm-tint\)\]/.test(readFileSync(root + f, "utf8")), `${f}: the school's row takes the token`);
  }
});
