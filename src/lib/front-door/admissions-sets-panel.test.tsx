// Run: npx tsx --test --test-force-exit src/lib/front-door/admissions-sets-panel.test.tsx
// Leighton Park prep (20 Nov): the Admissions home's sets panel -- the entry point first, feeders and rivals side by
// side in two blues saying which walk each drives, the "Admissions makes the sets" note for anyone else, and the
// words under the map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdmissionsSetsPanel, admissionsSetStory, SET_BLUE } from "@/components/front-door/admissions-sets-panel";

const draw = (canMake: boolean) =>
  renderToStaticMarkup(createElement(AdmissionsSetsPanel, { urn: "110110", schoolName: "Leighton Park School", entries: ["11+", "16+"], entry: "16+", onEntry: () => undefined, picks: { fset: null, rset: null }, onPicks: () => undefined, canMake, readOnly: false, urnsOf: { feeders: null, rivals: null } }));

test("Admissions sets panel: entry point first, feeders and rivals side by side, each saying which walk it drives", () => {
  const html = draw(true);
  assert.match(html, /Who feeds us, and who do we compete with\?/);
  assert.ok(html.indexOf('data-entry-switch="11+"') < html.indexOf('data-adm-set-column="feeders"'), "the entry point comes first");
  assert.match(html, /data-entry-switch="16\+" aria-pressed="true"/);
  assert.ok(html.indexOf('data-adm-set-column="feeders"') < html.indexOf('data-adm-set-column="compared_against"'));
  assert.match(html, /Pipelines: how many children could join us/);
  assert.match(html, /Market share: what share we win, and against whom/);
  assert.notEqual(SET_BLUE.feeders.hex, SET_BLUE.compared_against.hex);
  assert.doesNotMatch(html, /Admissions makes and looks after/);
});

test("Admissions sets panel: anyone but Admissions switches sets, with a note that Admissions makes them", () => {
  const html = draw(false);
  // assert.ok, not assert.match: a failed match diffs the whole page, which hangs the runner.
  assert.ok(/Admissions makes and looks after the school’s feeder and rival sets\. You can switch between them here; to change one, ask your Admissions team\./.test(html), "the note");
  assert.doesNotMatch(html, /data-adm-set-make/);
});

test("admissionsSetStory: a default says how VicData matched it; a school set says who chose it", () => {
  assert.equal(admissionsSetStory("feeders", "16+", { name: "x", count: 18, block: "default", creator: "default", how: "The 18 schools nearest with Year 11.", main: 0 }), "Feeder schools at 16+: 18 schools, matched by VicData: The 18 schools nearest with Year 11.");
  assert.equal(admissionsSetStory("compared_against", "16+", { name: "16+ Rivals", count: 10, block: "school", creator: "admissions" }), 'Rivals at 16+: 10 schools, chosen by Admissions as "16+ Rivals".');
  assert.match(admissionsSetStory("feeders", "11+", { name: "Day feeders", count: 27, block: "school", creator: "admissions", main: 6 }), /27 schools, 6 of them main feeders, chosen by Admissions/);
});
