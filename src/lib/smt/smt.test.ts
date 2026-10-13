// VicData 0.8 SMT round 1: the pure rules -- the level chips (R-SMT-LEVEL-CHIPS), the pills
// (R-SMT-BOARDING-ONLY), level-aware set ranks (R-SMT-SET-RANKS), the flags (R-SMT-FLAGS), Progress
// 8's reasons (R-SMT-P8-REASON), and SMT's place in the catalogue (after Teacher's and Admissions',
// never offered to a Teacher context, every view with an R-SMT rule, seeded to SMT only).
// Run: npx -y tsx --test src/lib/smt/smt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { levelChips, levelQuery, parseLevel, pillsFor, setPhaseOf } from "./levels";
import { setPlace, type Population } from "./population";
import { resultsAgainstSet } from "./flags";
import { SMT_FLAG_RULES } from "./flags-rules";
import { p8Of } from "./overview";
import { SMT_NOTES, smtNote } from "../../catalogue/notes";
import { DATAVIEWS } from "../../catalogue/dataviews";
import { MEASURES } from "../../catalogue/measures";
import { RULES } from "../../catalogue/rules";
import { SMT_DASHBOARDS, SMT_COMING, isSmtDashboard } from "../../catalogue/dashboards/smt";
import { DASHBOARDS } from "../../catalogue/dashboards";
import { validateConfig } from "../../catalogue/config";

const sp = (q: string) => new URLSearchParams(q);

test("level chips: Whole school then only the phases the school has; areas only under GCSE or Post-16", () => {
  assert.deepEqual(levelChips({ primary: false, gcse: true, post16: true }), ["whole", "gcse", "post16"]);
  assert.deepEqual(levelChips({ primary: true, gcse: false, post16: false }), ["whole", "primary"]);
  const phases = { primary: false, gcse: true, post16: true };
  const areas = { gcse: ["sciences_maths"], post16: ["humanities_social"] };
  assert.deepEqual(parseLevel(sp("level=gcse&area=sciences_maths"), phases, areas), { phase: "gcse", area: "sciences_maths" });
  // A phase the school hasn't, an area it doesn't enter, an area under Whole school: fall back.
  assert.deepEqual(parseLevel(sp("level=primary"), phases, areas), { phase: "whole", area: null });
  assert.deepEqual(parseLevel(sp("level=gcse&area=health_care"), phases, areas), { phase: "gcse", area: null });
  assert.deepEqual(parseLevel(sp("level=whole&area=sciences_maths"), phases, areas), { phase: "whole", area: null });
  assert.deepEqual(parseLevel(sp("level=nonsense"), phases, areas), { phase: "whole", area: null });
  assert.deepEqual(levelQuery({ phase: "whole", area: null }), {});
  assert.deepEqual(levelQuery({ phase: "post16", area: "humanities_social" }), { level: "post16", area: "humanities_social" });
});

test("the set's phase: GCSE where ranked; an IGCSE school's is Post-16", () => {
  assert.equal(setPhaseOf({ primary: false, gcse: true, post16: true }), "ks4");
  assert.equal(setPhaseOf({ primary: false, gcse: true, post16: true, igcse: true }), "ks5");
  assert.equal(setPhaseOf({ primary: true, gcse: false, post16: false }), "ks2");
});

test("pills only where they apply: Gender for a mixed school, Day + boarding for a boarding school", () => {
  assert.deepEqual(pillsFor({ mixed: true, boarding: false }), ["gender"]);
  assert.deepEqual(pillsFor({ mixed: true, boarding: true }), ["gender", "boarding"]);
  assert.deepEqual(pillsFor({ mixed: false, boarding: false }), []);
});

test("set ranks count only the set's schools with the figure, the school too, ties sharing a place", () => {
  const v = new Map<string, number | null>([["me", 50], ["a", 60], ["b", 50], ["c", null], ["d", 40], ["ig", 99]]);
  assert.deepEqual(setPlace(v, "me", new Set(["ig"])), { rank: 2, of: 4 });
  assert.equal(setPlace(v, "c"), null);
  assert.equal(setPlace(v, "ig", new Set(["ig"])), null);
});

test("results against the set: only past the threshold, only with enough set schools", () => {
  const g = SMT_FLAG_RULES.resultsGap.ks4;
  const set = [0, -1, 1, 0.5, -0.5];
  assert.equal(resultsAgainstSet("ks4", "GCSE results", { from: 50, to: 50 + g - 0.1, fromYear: 2022, toYear: 2024 }, set), null);
  const up = resultsAgainstSet("ks4", "GCSE results", { from: 50, to: 50 + g + 0.1, fromYear: 2022, toYear: 2024 }, set);
  assert.equal(up?.tone, "up");
  assert.match(up?.label ?? "", /rising faster than the set/);
  assert.equal(resultsAgainstSet("ks4", "GCSE results", { from: 50, to: 40, fromYear: 2022, toYear: 2024 }, set.slice(0, SMT_FLAG_RULES.resultsMinSchools - 1)), null);
  assert.equal(resultsAgainstSet("ks4", "GCSE results", { from: 50, to: 40, fromYear: 2022, toYear: 2024 }, set)?.tone, "down");
});

test("Progress 8: published with its year, or the reason that applies -- never blank", () => {
  const pop: Population = new Map([["s", new Map([[2023, { progress8_average: 0.08, progress8_lower_95_ci: -0.12, progress8_upper_95_ci: 0.28 }]])]]);
  const state = { independent: false, phases: { primary: false, gcse: true, post16: true }, latest: { ks4: { period: 2024, provisional: false } } };
  const p = p8Of(state, pop, "s", false);
  assert.equal(p.status, "published");
  assert.match(p.text, /2023\/24/);
  assert.match(p.text, /2024\/25/);
  assert.equal(p8Of({ ...state, independent: true }, pop, "s", false).text, SMT_NOTES.p8Independent);
  assert.equal(p8Of(state, pop, "s", true).status, "independent");
  // A state school with no published year (a new school): the KS2-baseline reason, naming the years.
  const none = p8Of({ ...state, latest: { ks4: { period: 2025, provisional: true } } }, new Map(), "s", false);
  assert.equal(none.status, "no_baseline");
  assert.equal(none.text, smtNote("p8NoBaseline", { years: "2024/25 or 2025/26" }));
  assert.equal(p8Of({ ...state, phases: { primary: true, gcse: false, post16: false } }, pop, "s", false).status, "no_gcse");
});

test("SMT in the catalogue: after Teacher's and Admissions', no Teacher phase, every view with an R-SMT rule", () => {
  const first = DATAVIEWS.findIndex((d) => d.id.startsWith("DV-SMT-"));
  const lastAdm = DATAVIEWS.map((d) => d.id.startsWith("DV-ADM-")).lastIndexOf(true);
  assert.ok(first > lastAdm && DATAVIEWS.slice(first).every((d) => d.id.startsWith("DV-SMT-")));
  const ruleIds = new Set(RULES.map((r) => r.id));
  for (const d of DATAVIEWS.slice(first)) {
    assert.deepEqual(d.supports.phases, [], d.id);
    assert.deepEqual(d.supports.focus, ["level"], d.id);
    assert.ok(d.host.id.startsWith("smt."), d.id);
    assert.ok(d.rules.some((r) => r.startsWith("R-SMT-") && ruleIds.has(r)), `${d.id} has an R-SMT rule`);
  }
  for (const m of MEASURES.filter((x) => x.id.startsWith("M-SMT-"))) assert.ok(m.rules.every((r) => ruleIds.has(r)), m.id);
  for (const r of RULES.filter((x) => x.id.startsWith("R-SMT-"))) assert.ok(r.testCase?.check, `${r.id} has a real-data runner`);
});

test("the four SMT dashboards validate, linked as one group, with one large view spanning columns 2-3", () => {
  assert.deepEqual(SMT_DASHBOARDS.map((d) => d.id), ["vicdata.smt.overview", "vicdata.smt.academic", "vicdata.smt.pupils", "vicdata.smt.context"]);
  const known = new Set(DATAVIEWS.map((d) => d.id));
  for (const d of SMT_DASHBOARDS) {
    assert.deepEqual(validateConfig(d, known), [], d.id);
    assert.equal(d.group?.id, "vicdata.smt");
    const large = d.panels.filter((p) => (p.span?.cols ?? 1) === 2);
    assert.equal(large.length, 1);
    assert.equal(large[0].column, "c2");
    assert.ok(isSmtDashboard(d.id));
  }
  // Round 2 built Pupils and Context: nothing is "coming" now.
  assert.deepEqual(SMT_COMING, []);
  assert.equal(DASHBOARDS.filter((d) => isSmtDashboard(d.id)).length, 4);
});

test("the subject explorer link carries the set and its name; Teacher reads the name, else Admissions' default", async () => {
  const { parseLinkedSet, linkedSetChoice, withoutLinkedSet, LINKED_SET_LABEL } = await import("../teacher-view-linked-set");
  const l = parseLinkedSet(new URLSearchParams("set=137186,116999&setLabel=10 nearest schools&subject=Biology"))!;
  assert.equal(JSON.parse(linkedSetChoice(l)).label, "10 nearest schools");
  assert.equal(JSON.parse(linkedSetChoice(parseLinkedSet(new URLSearchParams("set=137186"))!)).label, LINKED_SET_LABEL);
  assert.equal(withoutLinkedSet("https://x/teacher/ks4?set=137186&setLabel=a&subject=b&k=1"), "/teacher/ks4?k=1");
});

test("R-DOUBLE-AWARD-POINTS: two entries per award, each the average of its two grades; a mixed scale isn't scored", async () => {
  const { doubleAwardPoints, isDoubleAward } = await import("../subject-grades");
  assert.deepEqual(doubleAwardPoints([{ grade: "98", entries: 1 }]), { points: 8.5, entries: 2 });
  assert.deepEqual(doubleAwardPoints([{ grade: "99", entries: 1 }, { grade: "11", entries: 1 }, { grade: "U", entries: 2 }, { grade: "Suppressed", entries: 5 }]), { points: 2.5, entries: 8 });
  assert.equal(doubleAwardPoints([{ grade: "98", entries: 1 }, { grade: "7", entries: 1 }]), null);
  assert.equal(doubleAwardPoints([{ grade: "No result", entries: 3 }]), null);
  assert.ok(isDoubleAward("GCSE (9-1) Full Course (Double Award)") && !isDoubleAward("GCSE (9-1) Full Course"));
});

test("Pupils follows the level by the ages it highlights; staying on is Year 12 against Year 11 a year before", async () => {
  const { LEVEL_AGES, stayingOnAt } = await import("./pupils");
  assert.deepEqual(LEVEL_AGES, { whole: null, primary: [4, 11], gcse: [11, 16], post16: [16, 18] });
  const t = new Map([[2024, new Map([[15, { male: 50, female: 50 }]])], [2025, new Map([[16, { male: 30, female: 30 }]])]]);
  assert.deepEqual(stayingOnAt(t, 2025), { pct: 60, from: 100, to: 60, year: 2025 });
  assert.equal(stayingOnAt(new Map(), 2025), null);
});

test("Context's main ages follow the school's phase, in the census's held ages", async () => {
  const { mainAges } = await import("./context");
  assert.deepEqual(mainAges({ phases: { primary: false, gcse: true, post16: true }, low: 11 }), [11, 15]);
  assert.deepEqual(mainAges({ phases: { primary: true, gcse: false, post16: false }, low: 4 }), [5, 10]);
});
