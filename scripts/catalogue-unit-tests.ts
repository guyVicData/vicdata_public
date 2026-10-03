// Unit tests for the catalogue and its matching rule (no network, no database).
//
//   npx -y tsx --test scripts/catalogue-unit-tests.ts
//
// 1. matching.ts: compareMatches, timeMatches, whyNot, matchDataviews ordering and
//    relaxations, with small hand-made dataviews.
// 2. The combinations doc §3 tables A/B/C as expectations against the real DATAVIEWS.
// 3. Catalogue integrity: unique IDs, every reference resolves, rule shape.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import {
  ACADEMIC_CITATION,
  CONFIG_SCHEMA_VERSION,
  DATAVIEWS,
  MEASURES,
  RENDERERS,
  RULES,
  compareMatches,
  dataviewById,
  dataviewsForHost,
  matchDataviews,
  measureById,
  relaxations,
  rendererById,
  ruleById,
  timeMatches,
  whyNot,
  type CompareKind,
  type DashboardConfig,
  type Dataview,
  type DataviewId,
  type PickContext,
} from "../src/catalogue";

const ids = (results: { dataview: Dataview }[]) => results.map((r) => r.dataview.id);

// ---------------------------------------------------------------------------------
// Fixtures

function fakeView(id: DataviewId, over: Partial<Dataview["supports"]> = {}, status: Dataview["status"] = "live"): Dataview {
  return {
    id,
    label: id,
    railIcon: "TableIcon",
    measures: ["M-KS4-ENTRIES"],
    supports: {
      data: ["academic.candidates"],
      phases: ["ks4"],
      focus: ["subject"],
      compare: [],
      numberType: ["totals"],
      dateMode: "single",
      viewType: "table",
      ...over,
    },
    params: [],
    titleTemplate: id,
    renderer: "RD-YEAR-TABLE",
    host: { id: "teacher.c2.context", panel: "current", rail: null, file: "x" },
    audience: ["academic"],
    status,
    verifiedAt: [],
    origin: "test",
    rules: [],
  };
}

const CTX: PickContext = { data: "academic.candidates", phase: "ks4", focus: "subject", compare: [], time: "latest" };

// A one-panel dashboard placing `views` in a column whose compare is `compare`.
function fakeDashboard(id: string, owner: DashboardConfig["owner"], views: DataviewId[], compare: CompareKind[], time: "latest" | "over_time" = "latest"): DashboardConfig {
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id,
    name: id,
    kind: "dashboard",
    owner,
    colour: { key: "ks4" },
    layout: { preset: "1", tracks: [1], accordion: "auto-close" },
    columns: [{ id: "c1", title: "Col", icon: "candidates", data: { data: "academic.candidates", phase: "ks4" }, focus: { kind: "subject" }, compare: compare.length ? { kinds: compare } : null }],
    rows: [{ id: "r", name: "Row", time, openByDefault: true }],
    panels: [{ id: "p", row: "r", column: "c1", dataviews: views.map((v) => ({ id: `p/${v}`, kind: "view" as const, dataview: v })) }],
  };
}

// The seeded dashboards, when they exist (another S-step owns them).
async function seededDashboards(): Promise<DashboardConfig[]> {
  const file = path.resolve(__dirname, "../src/catalogue/dashboards/index.ts");
  if (!existsSync(file)) return [];
  const mod = (await import(pathToFileURL(file).href)) as { DASHBOARDS?: DashboardConfig[] };
  return mod.DASHBOARDS ?? [];
}

// ---------------------------------------------------------------------------------
// 1. matching.ts

describe("compareMatches (subset rule, combinations §2.3)", () => {
  it("no comparison offers only views that don't compare", () => {
    assert.equal(compareMatches([], []), true);
    assert.equal(compareMatches(["subjects"], []), false);
  });
  it("chosen comparisons offer views whose kinds are all among them", () => {
    assert.equal(compareMatches(["schools"], ["schools", "averages"]), true);
    assert.equal(compareMatches(["averages"], ["schools", "averages"]), true);
    assert.equal(compareMatches(["schools", "averages"], ["schools", "averages"]), true);
    assert.equal(compareMatches(["subjects", "averages"], ["averages"]), false);
  });
  it("a non-comparative view is not offered once a comparison is chosen", () => {
    assert.equal(compareMatches([], ["schools"]), false);
  });
});

describe("timeMatches (rows carry time, F1)", () => {
  it("latest = single, over time = trend, either = no filter", () => {
    assert.equal(timeMatches("single", "latest"), true);
    assert.equal(timeMatches("trend", "latest"), false);
    assert.equal(timeMatches("trend", "over_time"), true);
    assert.equal(timeMatches("single", "over_time"), false);
    assert.equal(timeMatches("single", "either"), true);
    assert.equal(timeMatches("trend", "either"), true);
  });
});

describe("whyNot (first failing condition, in the rule's order)", () => {
  const v = fakeView("DV-T-1", { data: ["academic.results"], results: ["points"], compare: ["schools"], dateMode: "trend" });
  it("reports data before anything else", () => assert.equal(whyNot(v, CTX), "data"));
  it("phase", () => assert.equal(whyNot(v, { ...CTX, data: "academic.results", phase: "ks5" }), "phase"));
  it("results sub-measure", () => assert.equal(whyNot(v, { ...CTX, data: "academic.results", results: "threshold" }), "results"));
  it("focus", () => assert.equal(whyNot(v, { ...CTX, data: "academic.results", results: "points", focus: "custom_area" }), "focus"));
  it("compare", () => assert.equal(whyNot(v, { ...CTX, data: "academic.results", results: "points" }), "compare"));
  it("time", () => assert.equal(whyNot(v, { ...CTX, data: "academic.results", results: "points", compare: ["schools"] }), "time"));
  it("palette", () =>
    assert.equal(whyNot(v, { ...CTX, data: "academic.results", results: "points", compare: ["schools"], time: "over_time", palette: ["academic.candidates"] }), "palette"));
  it("matches", () => assert.equal(whyNot(v, { ...CTX, data: "academic.results", results: "points", compare: ["schools"], time: "over_time" }), null));
  it("status: draft only for super-admin; deprecated and retired never offered", () => {
    assert.equal(whyNot(fakeView("DV-T-D", {}, "draft"), CTX), "status");
    assert.equal(whyNot(fakeView("DV-T-D", {}, "draft"), { ...CTX, superAdmin: true }), null);
    assert.equal(whyNot(fakeView("DV-T-X", {}, "deprecated"), { ...CTX, superAdmin: true }), "status");
    assert.equal(whyNot(fakeView("DV-T-R", {}, "retired"), { ...CTX, superAdmin: true }), "status");
  });
});

describe("matchDataviews ordering (familiar, then VicData, then also; catalogue order within)", () => {
  const catalogue = [fakeView("DV-T-A"), fakeView("DV-T-B"), fakeView("DV-T-C"), fakeView("DV-T-D"), fakeView("DV-T-NO", { compare: ["schools"] })];
  const dashboards = [
    // C sits in a matching panel (familiar); B on a VicData dashboard in a non-matching one.
    fakeDashboard("vd-match", "vicdata", ["DV-T-C"], []),
    fakeDashboard("vd-other", "vicdata", ["DV-T-B"], [], "over_time"),
    // A user's own dashboard never makes a view familiar.
    fakeDashboard("mine", "user", ["DV-T-D"], []),
  ];
  const out = matchDataviews(catalogue, CTX, dashboards);
  it("filters, then orders by tier and catalogue order", () => assert.deepEqual(ids(out), ["DV-T-C", "DV-T-B", "DV-T-A", "DV-T-D"]));
  it("tiers", () => assert.deepEqual(out.map((r) => r.tier), ["familiar", "vicdata", "also", "also"]));
  it("livesOn names the VicData dashboard and column", () => assert.deepEqual(out[0].livesOn, ["on vd-match, Col"]));
  it("groups by date mode and carries `requires` as a warning, never hiding the view", () => {
    const warned = fakeView("DV-T-W", { dateMode: "trend" });
    warned.requires = "Not enough years here yet";
    const r = matchDataviews([warned], { ...CTX, time: "either" }, []);
    assert.equal(r.length, 1);
    assert.equal(r[0].group, "over_time");
    assert.deepEqual(r[0].warnings, ["Not enough years here yet"]);
  });
});

describe("relaxations (empty state, combinations §4.3)", () => {
  it("counts what each loosening would unlock and drops zero-count ones", () => {
    const catalogue = [fakeView("DV-T-A", { compare: ["schools"], dateMode: "trend" }), fakeView("DV-T-B"), fakeView("DV-T-C", { compare: ["averages"] })];
    const r = relaxations(catalogue, { ...CTX, compare: ["schools"] }, []);
    assert.deepEqual(r, [{ id: "no-compare", label: "Without comparison", count: 1 }, { id: "over-time", label: "Over time instead", count: 1 }]);
  });
});

// ---------------------------------------------------------------------------------
// 2. Combinations doc §3 against the real catalogue

const KS4_CAND: PickContext = { data: "academic.candidates", phase: "ks4", focus: "subject", compare: ["subjects"], time: "latest" };
const KS4_RES = (results: PickContext["results"], over: Partial<PickContext> = {}): PickContext => ({
  data: "academic.results",
  phase: "ks4",
  results,
  focus: "subject",
  compare: ["subjects"],
  time: "latest",
  ...over,
});
const offered = (ctx: PickContext) => ids(matchDataviews(DATAVIEWS, ctx, []));

describe("Table A: the Teacher dashboard as it is, Candidates", () => {
  it("Col 1 × Current offers the number tiles", () => assert.ok(offered(KS4_CAND).includes("DV-C1-CAND-CUR-TILES")));
  it("Col 2 × Current offers donut, bar chart, ranked list and table", () => {
    const o = offered(KS4_CAND);
    for (const id of ["DV-C2-CUR-DONUT", "DV-C2-CUR-BARS", "DV-C2-CUR-LIST", "DV-C2-CUR-TABLE"] as const) assert.ok(o.includes(id), id);
  });
  it("Col 1 × Trends offers indexed, actual and trend table", () => {
    const o = offered({ ...KS4_CAND, time: "over_time" });
    for (const id of ["DV-C1-CAND-TR-INDEXED", "DV-C1-CAND-TR-ACTUAL", "DV-C1-CAND-TR-TABLE"] as const) assert.ok(o.includes(id), id);
  });
  it("Col 1 × Trends with no comparison does NOT offer the geography views (F2)", () => {
    const ctx: PickContext = { ...KS4_CAND, compare: [], time: "over_time" };
    const o = offered(ctx);
    assert.ok(!o.includes("DV-C1-CAND-TR-GEO-CHART"));
    assert.ok(!o.includes("DV-C1-CAND-TR-GEO-TABLE"));
    assert.equal(whyNot(dataviewById("DV-C1-CAND-TR-GEO-CHART")!, ctx), "compare");
  });
  it("Col 1 × Trends with the F2 override (subjects + averages) offers the geography views", () => {
    const o = offered({ ...KS4_CAND, compare: ["subjects", "averages"], time: "over_time" });
    assert.ok(o.includes("DV-C1-CAND-TR-GEO-CHART") && o.includes("DV-C1-CAND-TR-GEO-TABLE"));
  });
  it("Col 3 × Current (school focus, ranking set) offers map, rank tiles, bar chart, ranking", () => {
    const o = offered({ ...KS4_CAND, focus: "school", compare: ["schools"] });
    for (const id of ["DV-C3-CUR-MAP", "DV-C3-CUR-TILES", "DV-C3-CUR-BAR", "DV-C3-CUR-RANKING"] as const) assert.ok(o.includes(id), id);
  });
  it("Col 3 × Trends offers chart, trend table, trend map, ranked bars, change table, change map", () => {
    const o = offered({ ...KS4_CAND, compare: ["schools"], time: "over_time" });
    assert.deepEqual(o, ["DV-C3-TR-CHART", "DV-C3-TR-TABLE", "DV-C3-TR-MAP", "DV-C3-TR-CHANGELIST", "DV-C3-TR-CHANGETABLE", "DV-C3-TR-CHANGEMAP"]);
  });
  it("draft dead branches are hidden from users but shown to super-admin", () => {
    const ctx: PickContext = { ...KS4_CAND, time: "over_time" };
    assert.ok(!offered(ctx).includes("DV-C1-CAND-TR-CHANGELIST"));
    assert.ok(ids(matchDataviews(DATAVIEWS, { ...ctx, superAdmin: true }, [])).includes("DV-C1-CAND-TR-CHANGELIST"));
  });
});

describe("Table B: Results", () => {
  it("Average points, Col 2 Current: bar chart and ranked list, no donut", () => {
    const o = offered(KS4_RES("points"));
    assert.ok(o.includes("DV-C2-CUR-BARS") && o.includes("DV-C2-CUR-LIST"));
    assert.ok(!o.includes("DV-C2-CUR-DONUT"));
    assert.equal(whyNot(dataviewById("DV-C2-CUR-DONUT")!, KS4_RES("points")), "results");
  });
  it("Grade bands, Col 2 Current: the donut is offered (a share of counts)", () => assert.ok(offered(KS4_RES("bands")).includes("DV-C2-CUR-DONUT")));
  it("Grade 4+, Col 3 with averages ticked: set views only, no geography (no Grade 4+ benchmark)", () => {
    const res = matchDataviews(DATAVIEWS, KS4_RES("threshold", { compare: ["schools", "averages"], time: "either" }), []);
    assert.ok(res.length > 0);
    for (const r of res) assert.deepEqual(r.dataview.supports.compare, ["schools"], r.dataview.id);
  });
  it("Grade 4+, Col 1 Trends: chart and trend table", () => {
    const o = offered(KS4_RES("threshold", { time: "over_time" }));
    assert.ok(o.includes("DV-C1-RES-TR-CHART") && o.includes("DV-C1-RES-TR-TABLE"));
    assert.ok(!o.includes("DV-C1-RES-TR-GEO-CHART"));
  });
  it("Grade bands, Col 1 Current with England: tiles, grades view, bar, table", () => {
    const o = offered(KS4_RES("bands", { compare: ["subjects", "averages"] }));
    for (const id of ["DV-C1-RES-CUR-TILES", "DV-C1-RES-CUR-GRADES", "DV-C1-RES-CUR-BAR", "DV-C1-RES-CUR-TABLE"] as const) assert.ok(o.includes(id), id);
  });
  it("Grade counts: the distribution with England, the spread and change table without", () => {
    assert.ok(offered(KS4_RES("counts", { compare: ["averages"] })).includes("DV-C1-CNT-CUR-DIST"));
    const o = offered(KS4_RES("counts", { compare: [], time: "over_time" }));
    assert.deepEqual(o, ["DV-C1-CNT-TR-SPREAD", "DV-C1-CNT-TR-CHANGETABLE"]);
  });
});

describe("Table C: really changing it up", () => {
  it("C1: a row on Either shows both time groups", () => {
    const res = matchDataviews(DATAVIEWS, { ...KS4_CAND, time: "either" }, []);
    assert.ok(res.some((r) => r.group === "latest") && res.some((r) => r.group === "over_time"));
  });
  it("C2: one column, no comparison returns only non-comparative views, both time groups", () => {
    const res = matchDataviews(DATAVIEWS, KS4_RES("counts", { compare: [], time: "either" }), []);
    assert.ok(res.length > 0);
    for (const r of res) assert.deepEqual(r.dataview.supports.compare, [], r.dataview.id);
    // Candidates has none yet: every Candidates view compares.
    assert.deepEqual(offered({ ...KS4_CAND, compare: [], time: "either" }), []);
  });
  it("C3: a 4th column 'vs England' (averages) offers the geography chart and table on points", () => {
    const o = offered(KS4_RES("points", { compare: ["averages"], time: "over_time" }));
    assert.deepEqual(o, ["DV-C1-RES-TR-GEO-CHART", "DV-C1-RES-TR-GEO-TABLE"]);
  });
  it("C5: custom area focus × 10 nearest → nothing built (empty state)", () => {
    assert.deepEqual(offered({ ...KS4_CAND, focus: "custom_area", compare: ["schools"] }), []);
    assert.deepEqual(offered({ ...KS4_CAND, focus: "custom_area", compare: ["schools"], time: "either" }), []);
  });
  it("C7: Rolls and Births have measures but no views yet", () => {
    for (const data of ["rolls", "social.births"] as const) {
      assert.ok(MEASURES.some((m) => m.data === data), data);
      assert.deepEqual(offered({ data, phase: "ks4", focus: "school", compare: [], time: "either" }), []);
    }
  });
  it("C8: Births are area-keyed; their school geography is ✗", () => {
    const births = measureById("M-BIRTHS")!;
    assert.equal(births.keying, "geography");
    assert.equal(births.geographies.school.ok, false);
  });
  it("C15: palette limits adding (a Teacher palette without births offers nothing there)", () => {
    const ctx: PickContext = { ...KS4_CAND, palette: ["academic.candidates", "academic.results"] };
    assert.ok(offered(ctx).length > 0);
    assert.equal(whyNot(dataviewById("DV-C2-CUR-BARS")!, { ...ctx, data: "social.births" }), "data");
  });
});

describe("familiar first against the seeded VicData dashboards", () => {
  it("Col 2 Candidates Current: the seeded Context views come first, in rail order", async () => {
    const dashboards = await seededDashboards();
    if (!dashboards.length) return;
    const res = matchDataviews(DATAVIEWS, KS4_CAND, dashboards);
    const familiar = res.filter((r) => r.tier === "familiar").map((r) => r.dataview.id);
    assert.deepEqual(familiar.slice(familiar.indexOf("DV-C2-CUR-DONUT"), familiar.indexOf("DV-C2-CUR-DONUT") + 4), [
      "DV-C2-CUR-DONUT",
      "DV-C2-CUR-BARS",
      "DV-C2-CUR-LIST",
      "DV-C2-CUR-TABLE",
    ]);
    const tiers = res.map((r) => r.tier);
    assert.deepEqual(tiers, [...tiers].sort((a, b) => ["familiar", "vicdata", "also"].indexOf(a) - ["familiar", "vicdata", "also"].indexOf(b)));
  });
  it("placement report: seeded panel views that their own panel's context would not offer", async (t) => {
    const dashboards = await seededDashboards();
    const misfits: string[] = [];
    // A placement the matching rule wouldn't offer is allowed only in a panel that carries a
    // marked override (combinations F2, A4): S3's seeded configs say so explicitly.
    const marked: string[] = [];
    for (const d of dashboards) {
      for (const p of d.panels) {
        const col = d.columns.find((c) => c.id === p.column)!;
        const row = d.rows.find((r) => r.id === p.row)!;
        const data = p.override?.data ?? col.data;
        const compare = p.override?.compare !== undefined ? p.override.compare : col.compare;
        for (const v of p.dataviews) {
          if (v.kind !== "view") continue;
          const dv = dataviewById(v.dataview);
          if (!dv) continue;
          const results = data.results && data.results !== "pill" ? data.results : undefined;
          // The Results pill: the view fits if any of its sub-measures would.
          const subs = data.results === "pill" ? (dv.supports.results ?? [undefined]) : [results];
          const focus = (p.override?.focus ?? col.focus).kind;
          const fails = subs.map((r) => whyNot(dv, { data: data.data, phase: data.phase, results: r, focus, compare: compare?.kinds ?? [], time: row.time }));
          if (fails.every((f) => f !== null)) (p.override ? marked : misfits).push(`${d.id} ${p.column}/${p.row} ${dv.id}: ${fails[0]}`);
        }
      }
    }
    t.diagnostic(`${marked.length} placed views sit in marked override panels`);
    for (const m of marked) t.diagnostic(m);
    assert.deepEqual(misfits, [], "every placement the rule wouldn't offer must sit in a panel with a marked override");
  });
});

// ---------------------------------------------------------------------------------
// 3. Integrity

const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("catalogue integrity", () => {
  it("IDs are unique within and across layers", () => {
    const all = [...RULES.map((r) => r.id), ...MEASURES.map((m) => m.id), ...RENDERERS.map((r) => r.id), ...DATAVIEWS.map((d) => d.id)];
    assert.deepEqual(dupes(all), []);
  });
  it("every dataview's measures, rules and renderer exist", () => {
    for (const d of DATAVIEWS) {
      for (const m of d.measures) assert.ok(measureById(m), `${d.id} -> ${m}`);
      for (const r of d.rules) assert.ok(ruleById(r), `${d.id} -> ${r}`);
      assert.ok(rendererById(d.renderer), `${d.id} -> ${d.renderer}`);
    }
  });
  it("every measure's rules exist and every rule's supersededBy exists and is active", () => {
    for (const m of MEASURES) for (const r of m.rules) assert.ok(ruleById(r), `${m.id} -> ${r}`);
    for (const r of RULES) {
      if (r.status === "superseded") {
        assert.ok(r.supersededBy, r.id);
        assert.equal(ruleById(r.supersededBy!)?.status, "active", r.id);
      } else assert.equal(r.supersededBy, undefined, r.id);
    }
  });
  it("superseded rules are not applied by any measure or dataview", () => {
    const superseded = new Set(RULES.filter((r) => r.status === "superseded").map((r) => r.id));
    for (const m of MEASURES) for (const r of m.rules) assert.ok(!superseded.has(r), `${m.id} -> ${r}`);
    for (const d of DATAVIEWS) for (const r of d.rules) assert.ok(!superseded.has(r), `${d.id} -> ${r}`);
  });
  it("must-lift rules name from/to; automated test cases name a runner", () => {
    for (const r of RULES) {
      if (r.lift) assert.ok(r.lift.from && r.lift.to, r.id);
      if (r.testCase?.check) assert.match(r.testCase.check, /^[a-z][A-Za-z0-9]+$/, r.id);
    }
  });
  it("every dataview's supported data/phase is served by one of its measures", () => {
    for (const d of DATAVIEWS) {
      // Comparisons' ranking-set tiles show the whole-school headline in Candidates mode
      // too (audit A §1.6): offered on Candidates columns, measured in Results.
      if (d.id === "DV-C3-CUR-TILES") continue;
      for (const data of d.supports.data) {
        assert.ok(d.measures.some((m) => measureById(m)?.data === data), `${d.id}: no measure for ${data}`);
      }
      for (const phase of d.supports.phases) assert.ok(d.measures.some((m) => measureById(m)?.phase === phase), `${d.id}: no ${phase} measure`);
    }
  });
  it("number types are honest: a view offers only types one of its measures declares", () => {
    for (const d of DATAVIEWS) {
      const declared = new Set(d.measures.flatMap((m) => measureById(m)!.numberTypes));
      for (const n of d.supports.numberType) {
        // R-NUMBER-TYPE-HONESTY's open issue: % change on points/rates is live today and
        // recorded rather than hidden; every other type must be declared.
        if (n === "pct_change") continue;
        assert.ok(declared.has(n), `${d.id}: ${n}`);
      }
    }
  });
  it("market share only on count measures (R-DONUT-COUNTS-ONLY)", () => {
    for (const m of MEASURES) {
      if (m.numberTypes.includes("market_share")) assert.ok(m.data !== "academic.results" || m.results === "bands", m.id);
    }
  });
  it("live views have verifiedAt as a list, a title or a stated fallback, and a host rail or a note", () => {
    for (const d of DATAVIEWS) {
      assert.ok(Array.isArray(d.verifiedAt));
      assert.ok(d.titleTemplate || d.titleFallback, d.id);
      if (d.status === "live") assert.ok(d.host.rail !== null || d.note, d.id);
      if (d.status === "draft") assert.ok(d.note, `${d.id}: drafts say why`);
    }
  });
  it("dataviews are ordered by host then panel (the stable sort key)", () => {
    const hosts = ["teacher.c1.candidates", "teacher.c1.results", "teacher.c1.counts", "teacher.c2.context", "teacher.c3.comparisons"];
    const keys = DATAVIEWS.map((d) => hosts.indexOf(d.host.id) * 2 + (d.host.panel === "current" ? 0 : 1));
    assert.deepEqual(keys, [...keys].sort((a, b) => a - b));
  });
  it("dataviewsForHost returns rail order", () => {
    assert.deepEqual(
      dataviewsForHost("teacher.c2.context", "current").map((d) => d.id),
      ["DV-C2-CUR-DONUT", "DV-C2-CUR-BARS", "DV-C2-CUR-LIST", "DV-C2-CUR-TABLE"],
    );
  });
  it("every seeded dashboard view exists in the catalogue", async () => {
    for (const d of await seededDashboards())
      for (const p of d.panels) for (const v of p.dataviews) if (v.kind === "view") assert.ok(dataviewById(v.dataview), `${d.id} ${p.id} -> ${v.dataview}`);
  });
  it("the academic citation matches the app's SOURCE_NAME", async (t) => {
    try {
      const theme = (await import("../src/lib/teacher-view-theme")) as { SOURCE_NAME: Record<string, string> };
      assert.equal(theme.SOURCE_NAME.ks4, ACADEMIC_CITATION.ks4);
      assert.equal(theme.SOURCE_NAME.ks5, ACADEMIC_CITATION.ks5);
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e;
      t.skip(`teacher-view-theme not loadable outside Next: ${(e as Error).message}`);
    }
    for (const m of MEASURES) if (m.data.startsWith("academic.")) assert.equal(m.citation, ACADEMIC_CITATION[m.phase!], m.id);
  });
});

// ---------------------------------------------------------------------------------
// 4. Config: validation, the panel unit, the upgrade rule (G1)

describe("dashboard config", () => {
  it("every seeded dashboard validates", async () => {
    const { validateConfig } = await import("../src/catalogue/config");
    const known = new Set(DATAVIEWS.map((d) => d.id));
    for (const d of await seededDashboards()) assert.deepEqual(validateConfig(d, known), [], d.id);
  });
  it("validation catches overlaps, bad spans and unknown views", async () => {
    const { validateConfig } = await import("../src/catalogue/config");
    const [base] = await seededDashboards();
    const bad = structuredClone(base);
    bad.panels[1].column = bad.panels[0].column; // two panels in one cell
    bad.panels[2].span = { cols: 4, rows: 1 }; // past the last column
    bad.panels[3].dataviews = [{ id: "x", kind: "view", dataview: "DV-NOPE" }];
    const problems = validateConfig(bad, new Set(DATAVIEWS.map((d) => d.id))).map((p) => p.message).join(" | ");
    assert.match(problems, /overlaps/);
    assert.match(problems, /spans past the last column/);
    assert.match(problems, /unknown dataview DV-NOPE/);
  });
  it("PANEL_UNIT.height is CardBox's PANEL_HEIGHT", async () => {
    const { readFileSync } = await import("node:fs");
    const { PANEL_UNIT, spanWidth } = await import("../src/catalogue/config");
    const src = readFileSync(new URL("../src/components/teacher/CardBox.tsx", import.meta.url), "utf8");
    assert.equal(Number(/export const PANEL_HEIGHT = (\d+);/.exec(src)?.[1]), PANEL_UNIT.height);
    assert.equal(spanWidth(1), 351);
  });
  it("an upgrade keeps state where the panel survives and resets changed panels (G1)", async () => {
    const { carryUserState } = await import("../src/catalogue/config");
    const [prev] = await seededDashboards();
    const next = structuredClone(prev);
    const changed = next.panels[0];
    changed.dataviews = changed.dataviews.slice(0, 1).concat(changed.dataviews.slice(0, 0));
    changed.dataviews.push({ id: `${changed.id}/new`, kind: "placeholder", description: "x", shape: "graph" });
    const kept = next.panels[1];
    const state = { version: "1", panels: { [changed.id]: { open: true }, [kept.id]: { open: false, view: "v" } } };
    const out = carryUserState(prev, next, state, "2");
    assert.deepEqual(Object.keys(out.panels), [kept.id]);
    assert.equal(out.version, "2");
  });
});
