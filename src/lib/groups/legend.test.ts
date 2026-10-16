// VicData 0.8 IGCSE subjects (follow-up 5): the group Trends legends with the longest real set name. Every
// series keeps its legend entry, on one line (truncated, the full name as its tooltip), and the footnote
// stays: the legend wraps within the panel. The longest real set label (production's group index, 16 Oct
// 2026: 3,733 groups) is mix-matched for the longest group name, 168 characters.
// Run: VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures npx -y tsx --test src/lib/groups/legend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOverview, kindsFor, mixMatchedLabel } from "./dash";
import { AgainstOthers, RollTrend, ResultsTrend } from "../../components/groups/dash/views";
import type { ComparisonRow, GroupAggregate } from "./aggregates";

const LONGEST_GROUP = "Christ Church (Church of England) Infant School and Nursery and Christ Church (Church of England) Junior School Federation";
const LONGEST = mixMatchedLabel(LONGEST_GROUP);
const FX = path.join(__dirname, "../../../docs/v0.8/groups_fixtures");
const agg = JSON.parse(readFileSync(path.join(FX, "harris_group_aggregate_lookup_at_time.json"), "utf8")) as GroupAggregate;
const comps = (JSON.parse(readFileSync(path.join(FX, "harris_group_comparison_lookup.json"), "utf8")) as ComparisonRow[]).filter((r) => kindsFor("mix_matched").includes(r.kind));

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

test("the longest real set label is the one the test uses", () => {
  assert.equal(LONGEST.length, 168);
});

test("follow-up 5: every series keeps a one-line legend entry with its full name as the tooltip", () => {
  const o = buildOverview({ agg, comps, compare: "mix_matched", focus: "all", name: LONGEST_GROUP });
  assert.equal(o.trends.roll.lines[1]?.label, LONGEST, "the chosen set carries the longest label");
  for (const [name, el] of [
    ["roll", createElement(RollTrend, { o, fullscreen: false })],
    ["results", createElement(ResultsTrend, { o, average: false, fullscreen: false })],
  ] as const) {
    const html = renderToStaticMarkup(el);
    const lines = name === "roll" ? o.trends.roll.lines : o.trends.results[0].lines;
    const keys = html.match(/data-set-key=""/g) ?? [];
    assert.equal(keys.length, lines.length, `${name}: one entry per series`);
    for (const l of lines) assert.ok(html.includes(`title="${attr(l.label)}"`), `${name}: ${l.label.slice(0, 30)}… has its tooltip`);
    assert.ok(/class="min-w-0 max-w-\[15rem\] truncate"/.test(html), `${name}: the visible name truncates`);
    assert.ok(html.includes("flex min-w-0 flex-wrap"), `${name}: the legend wraps within the panel`);
  }
  // Against others: a long set name takes two lines at most, with the full name as its tooltip.
  const ag = renderToStaticMarkup(createElement(AgainstOthers, { o, average: false }));
  assert.ok(ag.includes(`data-set-name="" title="${attr(LONGEST)}" class="line-clamp-2`), "Against others: the long name clamps, with its tooltip");
  // The results panel's title names the set too: one line, the full title as its tooltip.
  const res = renderToStaticMarkup(createElement(ResultsTrend, { o, average: false, fullscreen: false }));
  assert.ok(res.includes(`title="${attr(`Results against ${LONGEST}`)}" class="truncate`));
});
