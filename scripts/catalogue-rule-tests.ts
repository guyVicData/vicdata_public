// Runs each rule's test case against real data (catalogue doc §2.5 output 3).
//
//   npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts [R-ID ...]
//
// Read-only: every figure comes through the app's own lib fetch functions (vicdata
// reference RPCs over HTTP with the anon key, and the vicdata-public anon client). Prints
// PASS / FAIL / MANUAL per rule (MANUAL = a documented test case with no runner yet; rules
// without a test case are listed as NONE). Exit code 1 if any runner fails or errors.
//
// Until S2 lifts the page's population and measure code into src/lib (rule `lift`), a few
// runners reproduce the page's computation here, verbatim, on the lib's own rows; each
// says so. Swap them to the lifted functions once those exist.
import { existsSync } from "node:fs";
import path from "node:path";
import { RULES, ruleById, type Rule } from "../src/catalogue";

// --------------------------------------------------------------------------- env
const ROOT = path.resolve(__dirname, "..");
for (const f of [".env.local", ".env"]) {
  const file = path.join(ROOT, f);
  // Keyed on the key, not the URL, so a run through scripts/rpc-proxy.mjs (VICDATA_API_URL set in the
  // shell) still reads the key from .env; loadEnvFile never overrides a variable already set.
  if (!process.env.VICDATA_ANON_KEY && existsSync(file)) process.loadEnvFile(file);
}

// Lib modules, loaded after the env (supabase.ts reads it at call time; loaded lazily so
// `--help`-style runs and the unit tests never touch them).
const lib = async () => ({
  adv: await import("../src/lib/academic-data-view"),
  ref: await import("../src/lib/vicdata-reference"),
  sg: await import("../src/lib/subject-grades"),
  qb: await import("../src/lib/dfe-qualification-buckets"),
  agg: await import("../src/lib/academic-aggregate-trends"),
  tvp: await import("../src/lib/teacher-view-panels"),
  tvm: await import("../src/lib/teacher-view-measures"),
  pop: await import("../src/lib/teacher-view-populations"),
  sb: await import("../src/lib/supabase"),
  notes: await import("../src/catalogue/notes"),
});
type Lib = Awaited<ReturnType<typeof lib>>;
// 0.7 admissions: the national flag thresholds -- the database's once applied, else the ingest dry
// run's values (docs/v0.7/audit_scripts/admissions_flag_thresholds_dryrun.json), named in the detail.
async function admissionsThresholds() {
  const t = await import("../src/lib/admissions/thresholds");
  const live = await t.loadThresholds();
  if (live) return { thresholds: live, source: "database" };
  const rows = JSON.parse((await import("node:fs")).readFileSync(path.join(ROOT, "docs/v0.7/audit_scripts/admissions_flag_thresholds_dryrun.json"), "utf8")) as { phase: string; measure: string; change_kind: string; p_low: number; p_high: number; n_schools: number; period_from: number; period_to: number; min_cohort?: number }[];
  return {
    thresholds: t.thresholdsFrom(rows.map((r) => ({ phase: r.phase as never, measure: r.measure as never, changeKind: r.change_kind === "difference" ? ("difference" as const) : ("percent" as const), low: Number(r.p_low), high: Number(r.p_high), lowPct: 20, highPct: 80, minCohort: r.min_cohort ?? 10, nSchools: r.n_schools, from: r.period_from, to: r.period_to }))),
    source: "ingest dry run (not yet applied)",
  };
}


// manual: the check can't run yet (e.g. a migration not applied live): counted MANUAL, not FAIL.
type Outcome = { pass: boolean; detail: string; manual?: boolean };
type Runner = (L: Lib, rule: Rule) => Promise<Outcome>;

const round = (v: number | null | undefined, dp = 1) => (v === null || v === undefined ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const near = (a: number | null, b: number, tol = 0.05) => a !== null && Math.abs(a - b) <= tol;
const fmt = (o: Record<string, unknown>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

// A rehearsal subprocess's failure, named by its own last error line (stderr) rather than "Command failed".
const subprocessError = (e: unknown) => {
  const err = (e as { stderr?: string }).stderr ?? "";
  const line = err.split("\n").map((l) => l.trim()).filter((l) => /error/i.test(l)).at(-1);
  return (line ?? (e as Error).message).slice(0, 200);
};

// 0.8 Admissions fb1: every Admissions view for one school and entry point, rendered on the server from
// the routes' own answers (AdmissionsEveryView), at a fixed width so the charts draw; memoised.
const admRenderMemo = new Map<string, Promise<string>>();
function admRenderAll(urn: string, entry: string): Promise<string> {
  const key = `${urn}:${entry}`;
  if (!admRenderMemo.has(key))
    admRenderMemo.set(key, (async () => {
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const v = await import("../src/lib/admissions/views-api");
      const { AdmissionsEveryView } = await import("../src/components/admissions/AdmissionsDashboard");
      const { InitialWidth } = await import("../src/components/admissions/views/charts");
      const ep = v.entryPoint(entry)!;
      const [pipeline, market, rivals, shape] = await Promise.all([v.pipelineView(urn, ep, [], { catchment: { savedKm: null } }), v.marketView(urn, ep, []), v.rivalsView(urn, ep, []), v.shapeView(urn, ep, [])]);
      const member = { userId: "", token: "", membershipId: "m", schoolAccountId: "a", schoolUrn: urn, schoolName: urn, roles: ["admissions"], isAdmin: false, isAccountHolder: false, lead: true, access: "lead" as const, canEditLists: true, override: false, canShare: true, canManageTeam: true, readOnly: false, viewAs: null, leadColumn: true };
      const el = createElement(AdmissionsEveryView, { member, entry: ep.id, boardingSchool: false, pipeline, market, rivals, shape, lists: null });
      return renderToStaticMarkup(createElement(InitialWidth.Provider, { value: 900 }, el));
    })());
  return admRenderMemo.get(key)!;
}

// --------------------------------------------------------------------------- runners
// 0.8 SMT round 1: one school's SMT figures, built by the routes' own functions on the school's
// default set (Teacher's 10 nearest), memoised for the SMT runners.
const smtMemo = new Map<string, Promise<unknown>>();
async function smtCase(urn: string) {
  type Case = { school: import("../src/lib/smt/school").SmtSchool; set: { kind: string; label: string; urns: string[] }; overview: import("../src/lib/smt/overview").Overview };
  if (!smtMemo.has(urn))
    smtMemo.set(urn, (async (): Promise<Case> => {
      const { smtSchool } = await import("../src/lib/smt/school");
      const { buildOverview } = await import("../src/lib/smt/overview");
      const { resolveDefaultNearest } = await import("../src/lib/chooser-sets");
      const { setPhaseOf } = await import("../src/lib/smt/levels");
      const school = (await smtSchool(urn))!;
      const near = await resolveDefaultNearest(urn, setPhaseOf(school.phases));
      const set = { kind: "nearest", label: "10 nearest schools", urns: near.rows.map((r: { urn: string }) => r.urn).filter((u: string) => u !== urn) };
      return { school, set, overview: await buildOverview(school, set, null) };
    })().catch((e) => {
      smtMemo.delete(urn); // a failed read isn't kept: the next runner tries again
      throw e;
    }));
  return smtMemo.get(urn) as Promise<Case>;
}
// 0.8 SMT Academic by qualification: Academic for an address (?level=&mode=&group=&applied=&area=), the
// state resolved as the route resolves it; the set Default (each group its own) unless `set` is given.
async function smtAcademicCase(urn: string, query: string, set?: { kind: string; label: string; urns: string[] }) {
  const key = `${urn}|${query}|${set ? set.urns.join(",") : "default"}`;
  if (!smtMemo.has(key))
    smtMemo.set(key, (async () => {
      const c = await smtCase(urn);
      const { academicOffer, buildAcademic } = await import("../src/lib/smt/academic");
      const { parseAcademic } = await import("../src/lib/smt/qual-groups");
      const st = parseAcademic(new URLSearchParams(query), await academicOffer(c.school));
      return buildAcademic(c.school, st, set ?? c.set);
    })().catch((e) => {
      smtMemo.delete(key);
      throw e;
    }));
  return smtMemo.get(key) as Promise<import("../src/lib/smt/academic").Academic>;
}
// Render one SMT view as the page draws it (charts at a fixed width), for the wording checks.
async function smtRender(urn: string, dv: string, academic?: import("../src/lib/smt/academic").Academic, more: { pupils?: import("../src/lib/smt/pupils").Pupils; context?: import("../src/lib/smt/context").Context; contextMap?: import("../src/lib/smt/context-map").ContextMap; shade?: string } = {}) {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ViewBody } = await import("../src/components/smt/SmtDashboard");
  const { InitialWidth } = await import("../src/components/admissions/views/charts");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const c = await smtCase(urn);
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
  const ctx = {
    member: { userId: "", token: "", membershipId: "m", schoolAccountId: "a", schoolUrn: urn, schoolName: c.school.name, roles: ["smt"], isAdmin: false, isAccountHolder: false, access: "member", readOnly: false, viewAs: null },
    school: c.school,
    dash: dv.startsWith("DV-SMT-O-") ? "overview" : dv.startsWith("DV-SMT-P-") ? "pupils" : dv.startsWith("DV-SMT-C-") ? "context" : "academic",
    level: academic ? { phase: academic.state.phase, area: academic.state.area } : more.context ? { phase: more.context.level, area: null } : { phase: "whole", area: null },
    set: c.set,
    overview: { status: "ready", data: c.overview },
    academic: academic ? { status: "ready", data: academic } : { status: "loading" },
    pupils: more.pupils ? { status: "ready", data: more.pupils } : { status: "loading" },
    context: more.context ? { status: "ready", data: more.context } : { status: "loading" },
    contextMap: more.contextMap ? { status: "ready", data: more.contextMap } : { status: "loading" },
    shade: more.shade ?? "children",
    onShade: () => undefined,
    onArea: () => undefined,
    focusBar: null,
    phone: false,
    ask: { level: academic?.state.phase ?? null, mode: academic?.state.mode ?? "results", group: academic?.state.group ?? null, applied: academic?.state.applied ?? null, area: academic?.state.area ?? null },
    onAsk: () => undefined,
  };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(InitialWidth.Provider, { value: 800 }, createElement(ViewBody, { dv, c: ctx as never, fullscreen: false }))));
}
async function smtPupilsCase(urn: string, phase: "whole" | "gcse" | "post16" | "primary" = "whole") {
  const key = `pupils|${urn}|${phase}`;
  if (!smtMemo.has(key))
    smtMemo.set(key, (async () => {
      const c = await smtCase(urn);
      const { buildPupils } = await import("../src/lib/smt/pupils");
      return buildPupils(c.school, c.set, { phase, area: null }, null);
    })().catch((e) => {
      smtMemo.delete(key);
      throw e;
    }));
  return smtMemo.get(key) as Promise<import("../src/lib/smt/pupils").Pupils>;
}
// 0.8 SMT r4: the board at a radius in km. By default exactly the ingest's 5 miles (school_context_lookup's
// radius), so round 3's figures still hold through area_context, the read the board now uses.
const FIVE_MILES_KM = 5 * 1.609344;
async function smtContextCase(urn: string, area: "around" | "la" = "around", level: "whole" | "gcse" | "post16" | "primary" = "gcse", km = FIVE_MILES_KM) {
  const key = `context|${urn}|${area}|${level}|${km}`;
  if (!smtMemo.has(key))
    smtMemo.set(key, (async () => {
      const c = await smtCase(urn);
      const { buildContext } = await import("../src/lib/smt/context");
      return buildContext(c.school, area, level, { km, savedKm: null, defaultKm: km, capKm: 30, from: "view", capped: false });
    })().catch((e) => {
      smtMemo.delete(key);
      throw e;
    }));
  return smtMemo.get(key) as Promise<import("../src/lib/smt/context").Context>;
}
const textOf = (html: string) => html.replace(/<title>[^<]*<\/title>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// 0.8 audit fixes (10): the latest results year, from years.ts (filled from the data as the app fills
// it), for the rules whose expected values move with it (scripts/rule-year-fixtures.ts).
async function latestYearOf(L: Awaited<ReturnType<typeof lib>>, stage: "ks4" | "ks5"): Promise<number | null> {
  const Y = await import("../src/catalogue/years");
  if (Y.latestPeriodOf(stage) === null) Y.setLatestYears(await L.ref.lookupAcademicLatestYears());
  return Y.latestPeriodOf(stage);
}

const RUNNERS: Record<string, Runner> = {
  // R-KS5-ENGLAND-EXACT: 100369 Chemistry 2024/25, own IB HL 58.29; England exact HL 43.13, SL 37.84.
  async englandExact({ adv, ref, agg }) {
    const urn = "100369";
    const own = (await adv.fetchSubjectQualificationHeadlineForSchools([urn], "ks5")).get(urn) ?? [];
    const hl = own.find((h) => h.subject === "Chemistry" && h.period === 2024 && h.qualificationType === "IBO Higher level component");
    const eng = async (qualificationType: string) =>
      (
        await ref.lookupAcademicSubjectQualificationGeography({
          ksStage: "ks5",
          measure: "avg_point_score",
          groupingType: "national",
          groupingKeys: [agg.NATIONAL_GROUPING_KEY],
          subject: "Chemistry",
          qualificationType,
          minSchoolCount: 1,
        })
      ).filter((r) => r.period === 2024);
    const [engHl, engSl] = [await eng("IBO Higher level component"), await eng("IBO Standard level component")];
    // Exact or nothing: each lookup returns only its own qualification's row.
    const exactOnly = [...engHl, ...engSl].every((r) => r.qualification_type === "IBO Higher level component" || r.qualification_type === "IBO Standard level component");
    const hlV = engHl.find((r) => r.qualification_type === "IBO Higher level component")?.avg_value ?? null;
    const slV = engSl.find((r) => r.qualification_type === "IBO Standard level component")?.avg_value ?? null;
    const pass = near(hl?.avgPointScore ?? null, 58.29, 0.005) && near(hlV, 43.13, 0.005) && near(slV, 37.84, 0.005) && exactOnly;
    return { pass, detail: fmt({ ownHL: hl?.avgPointScore ?? null, englandHL: hlV, englandSL: slV, exactOnly }) };
  },

  // R-BANDS-ENGLAND-BENCH: The Chase 137625 GCSE History 2024/25, 7-9 34.1% vs England 26.6%; 4-9 75.8% vs 64.6%.
  async bandsEnglandBench({ adv, ref, sg, agg }) {
    const urn = "137625";
    const qual = "GCSE (9-1) Full Course";
    const own = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks4")).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "History" && r.period === 2024 && r.qualificationType === qual,
    );
    const eng = (
      await ref.lookupAcademicSubjectGradeGeography({ ksStage: "ks4", groupingType: "national", groupingKeys: [agg.NATIONAL_GROUPING_KEY], subject: "History", qualificationType: qual })
    )
      .filter((r) => r.period === 2024)
      .map((r) => ({ grade: r.grade, entries: Number(r.entries_total) }));
    const r79 = { scale: sg.GCSE_SCALE, top: "9", bottom: "7" };
    const r49 = { scale: sg.GCSE_SCALE, top: "9", bottom: "4" };
    const v = {
      own79: round(sg.bandRate(own, r79)?.rate),
      eng79: round(sg.bandRate(eng, r79)?.rate),
      own49: round(sg.bandRate(own, r49)?.rate),
      eng49: round(sg.bandRate(eng, r49)?.rate),
    };
    const pass = v.own79 === 34.1 && v.eng79 === 26.6 && v.own49 === 75.8 && v.eng49 === 64.6;
    return { pass, detail: fmt(v) };
  },

  // R-COUNTS-SELECTION: The Chase 137625 GCSE History 2024/25 -- a single grade 9, then 7-9,
  // through the selection's own answer line; 7-9 must equal Grade bands' 34.1% / 26.6%.
  async countsSelection({ adv, ref, sg, agg }) {
    const gs = await import("../src/lib/grade-selection");
    const urn = "137625";
    const qual = "GCSE (9-1) Full Course";
    const own = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks4")).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "History" && r.period === 2024 && r.qualificationType === qual,
    );
    const eng = (
      await ref.lookupAcademicSubjectGradeGeography({ ksStage: "ks4", groupingType: "national", groupingKeys: [agg.NATIONAL_GROUPING_KEY], subject: "History", qualificationType: qual })
    ).map((r) => ({ period: r.period, grade: r.grade, entries: Number(r.entries_total) }));
    const one = gs.nextSelection(sg.GCSE_SCALE, null, "9");
    const widened = one && one !== "ignore" ? gs.nextSelection(sg.GCSE_SCALE, one, "7") : null;
    if (!one || one === "ignore" || !widened || widened === "ignore") return { pass: false, detail: "selection steps failed" };
    const line = (sel: { top: string; bottom: string }) => {
      const range = { scale: sg.GCSE_SCALE, ...sel };
      const r = sg.bandRate(own, range);
      return gs.answerLine(range, r ? { met: r.met, entries: r.entries } : null, gs.englandShare(eng, 2024, range, sg.GCSE_SCALE.filter((g) => own.some((o) => o.grade === g))));
    };
    const l9 = line(one);
    const l79 = line(widened);
    const pass = !!l9 && /^Grade 9: \d+% of entries \(\d+\)/.test(l9) && !!l79 && /^Grades 7–9: 34% of entries \(\d+\) · England 27%$/.test(l79);
    return { pass, detail: fmt({ grade9: l9, grades79: l79 }) };
  },

  // R-POST16-BAND-DEFAULT (0.6.5 S1): each Post-16 family opens Grade bands on its scale's
  // default, read from the school's own grade rows the way the page reads them (the focus's
  // scale from its qualification and its 2023/24-on grades), and the default has a figure.
  async post16BandDefault({ adv, sg, tvm }) {
    const cases = [
      { urn: "117037", subject: "Mathematics", qual: "GCE A level", expect: "A*..A" },
      { urn: "130432", subject: "Business Studies", qual: "BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*", expect: "Distinction*-Distinction*-Distinction*..Distinction-Distinction-Distinction" },
      { urn: "130432", subject: "Business Studies", qual: "BTEC National Extended Certificate L3 - Band F - P-D*", expect: "Distinction*..Distinction" },
      { urn: "118952", subject: "Mathematical Studies", qual: "IBO Higher level component", expect: "7..6" },
      { urn: "130416", subject: "Health", qual: "T Level", expect: "Distinction*..Merit" },
    ];
    const out: string[] = [];
    let ok = true;
    for (const c of cases) {
      const rows = ((await adv.fetchSubjectLevelDataForSchools([c.urn], "ks5", { gradeYears: "four" })).byUrn.get(c.urn)?.gradeDistribution ?? []).filter(
        (r) => r.subject === c.subject && r.qualificationType === c.qual,
      );
      const scale = sg.scaleForQualification(c.qual, rows.filter((r) => r.period >= 2023).map((r) => r.grade));
      const ctx = { phase: "ks5", qualificationType: c.qual };
      const range = tvm.bandRangeFor(scale, null, undefined, ctx);
      const latest = Math.max(...rows.map((r) => r.period));
      const rate = range ? sg.bandRate(rows.filter((r) => r.period === latest), range)?.rate ?? null : null;
      // A saved range off this scale (a GCSE 7-9) falls back to the default.
      const fallback = tvm.bandRangeFor(scale, null, JSON.stringify({ top: "9", bottom: "7" }), ctx);
      const got = range ? `${range.top}..${range.bottom}` : "none";
      const pass = got === c.expect && rate !== null && fallback?.top === range?.top && fallback?.bottom === range?.bottom;
      ok &&= pass;
      out.push(`${c.urn} ${c.qual.split(" - ")[0]}: ${got === c.expect ? "ok" : `got ${got}`} ${rate === null ? "no figure" : round(rate) + "%"}`);
    }
    return { pass: ok, detail: out.join("; ") };
  },

  // R-RANKING-MEASURE (0.6.6): a ranking with a subject in focus is the whole population's, on
  // the measure in view, and the school's figure in it is Column 1's own.
  async rankingOnMeasure({ adv, ref, sg }) {
    const sr = await import("../src/lib/subject-ranking");
    const cs = await import("../src/lib/chooser-sets");
    const cc = await import("../src/lib/comparator-chooser");
    const nation = (await cs.cachedRankingPopulation(null, "ks4", null)).filter((r) => cc.matchesRanking(r, cc.defaultRankingFilters(cc.NATIONAL))).map((r) => r[0]);
    const req = { urns: nation, targetUrn: "137625", phase: "ks4" as const, subject: "History", familyId: "humanities_social", qualificationType: "GCSE (9-1) Full Course", measure: { kind: "threshold" as const }, period: null };
    const r = await sr.subjectRanking(req, "rule-test:ks4:england");
    const own = ((await adv.fetchSubjectLevelDataForSchools(["137625"], "ks4", { gradeYears: "four" })).byUrn.get("137625")?.gradeDistribution ?? []).filter(
      (g) => g.subject === "History" && g.qualificationType === "GCSE (9-1) Full Course" && g.period === r.period,
    );
    const column1 = sg.thresholdRate(own, "ks4")?.rate ?? null;
    const row = r.window.find((w) => w.urn === "137625");
    const sharedTies = r.window.every((w, i) => i === 0 || r.window[i - 1].pos !== w.pos - 1 || (w.value === r.window[i - 1].value ? w.rank === r.window[i - 1].rank : w.rank === w.pos));
    const ks5Nation = (await cs.cachedRankingPopulation(null, "ks5", null)).filter((x) => cc.matchesRanking(x, cc.defaultRankingFilters(cc.NATIONAL))).map((x) => x[0]);
    const kings = await sr.subjectRanking(
      { urns: ks5Nation, targetUrn: "117037", phase: "ks5", subject: "Mathematics", familyId: "sciences_maths", qualificationType: "GCE A level", measure: { kind: "points" }, period: null },
      "rule-test:ks5:england",
    );
    const kingsColumn1 = (await ref.lookupAcademicSubjectQualificationHeadline({ entityIds: ["117037"], ksStage: "ks5", qualificationType: "GCE A level" })).find(
      (x) => x.subject === "Mathematics" && x.period === kings.period,
    )?.avg_point_score;
    const v = {
      via: r.source,
      period: r.period,
      rank: `${r.targetRank} of ${r.ranked}`,
      ranking: r.target?.value === undefined ? null : Math.round(r.target.value * 100) / 100,
      column1: column1 === null ? null : Math.round(column1 * 100) / 100,
      windowRow: row ? `${row.rank}@${row.pos}` : "missing",
      sharedTies,
      kings: `${kings.target?.value} (Column 1 ${kingsColumn1}) rank ${kings.targetRank} of ${kings.ranked}`,
    };
    const pass =
      column1 !== null && r.target !== null && Math.abs(r.target.value - column1) < 1e-9 && r.ranked > 1000 && !!row && row.rank === r.targetRank && sharedTies &&
      kings.target !== null && kingsColumn1 !== null && kingsColumn1 !== undefined && Math.abs(kings.target.value - Number(kingsColumn1)) < 1e-9;
    return { pass, detail: fmt(v) };
  },

  // ---------------------------------------------------------------- 0.7 admissions r1 (A1)
  // Each recomputes from raw census / births rows with its own arithmetic, then compares.
  async admLadder({ ref }) {
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const p = await buildPipeline("137625", entryPoint("11+")!, { today: new Date("2026-10-07") });
    const set = p.sets.find((s) => s.age === 10)!.urns;
    const raw = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: set, periodMin: 2025, periodMax: 2025, breakdowns: ["full_time_male_aged_10", "full_time_female_aged_10"] });
    const expected = raw.reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const p2026 = p.ladder.past.find((x) => x.entryYear === 2026)?.pool;
    const sources = p.ladder.future.map((x) => x.source);
    const firstBirths = p.ladder.future.find((x) => x.source === "births")?.entryYear;
    const v = { set: set.length, raw2026: expected, pipeline2026: p2026, first: `${p.ladder.future[0].entryYear} age ${p.ladder.future[0].rungAge}`, firstBirths, years: p.ladder.future.length };
    const pass = p2026 === expected && p.ladder.future[0].entryYear === 2027 && p.ladder.future[0].rungAge === 9 && sources[0] === "counted" && firstBirths === 2033 && p.ladder.future.length === 10 && sources.indexOf("births") === sources.lastIndexOf("counted") + 1;
    return { pass, detail: fmt(v) };
  },

  async admBirthSplit({ ref }) {
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const p = await buildPipeline("136984", entryPoint("4+")!, { today: new Date("2026-10-07") });
    // Raw births for each blended LA, the shire counties summed from their districts, as the app does.
    const { SHIRE_COUNTY_DISTRICT_GSS_CODES } = await import("../src/lib/shire-county-districts");
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const sb = createServerAnonSupabaseClient();
    let blended2023 = 0;
    let blended2022 = 0;
    for (const b of p.blend) {
      const { data } = await sb.from("la_gss_crosswalk").select("gss_code").eq("dfe_code", b.laCode).maybeSingle();
      const codes = SHIRE_COUNTY_DISTRICT_GSS_CODES[b.laCode] ?? [data!.gss_code];
      const rows = await ref.lookupReferenceData({ sourceId: "ons_births", entityIds: codes, periodMin: 2022, periodMax: 2023, breakdowns: ["total"] });
      blended2023 += b.weight * rows.filter((r) => r.period === 2023).reduce((a, r) => a + (r.value_numeric ?? 0), 0);
      blended2022 += b.weight * rows.filter((r) => r.period === 2022).reduce((a, r) => a + (r.value_numeric ?? 0), 0);
    }
    const expected = (8 / 12) * blended2023 + (4 / 12) * blended2022;
    const got = p.ladder.future.find((x) => x.entryYear === 2027);
    const v = { blend: p.blend.map((b) => `${b.laName} ${(b.weight * 100).toFixed(0)}%`).join(" + "), expected: Math.round(expected * 10) / 10, pipeline: got?.pool === null || got?.pool === undefined ? null : Math.round(got.pool * 10) / 10, source: got?.source, birthYear: got?.birthYear };
    return { pass: !!got && got.source === "births" && got.birthYear === 2023 && Math.abs(got.pool! - expected) < 1e-6, detail: fmt(v) };
  },

  async admDriftRange() {
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const p = await buildPipeline("137625", entryPoint("16+")!, { today: new Date("2026-10-07") });
    const widths = p.ladder.future.map((x) => (x.pool && x.low !== null && x.high !== null ? (x.high - x.low) / x.pool : null));
    const allRanged = widths.every((w) => w !== null);
    const neverNarrows = widths.every((w, i) => i === 0 || w! >= widths[i - 1]! - 1e-9 || p.ladder.future[i].rungAge! <= 10 !== (p.ladder.future[i - 1].rungAge! <= 10));
    const h = p.ladder.handovers[0];
    const v = { drift: `${p.ladder.drift?.low.toFixed(3)}-${p.ladder.drift?.high.toFixed(3)} (${p.ladder.drift?.n} ratios, ${p.ladder.drift?.from}-${p.ladder.drift?.to})`, handover: h ? `age ${h.fromAge}: ${h.spread?.low.toFixed(2)}-${h.spread?.high.toFixed(2)}` : "none", widths: widths.map((w) => (w === null ? "-" : (w * 100).toFixed(0) + "%")).join(" ") };
    return { pass: allRanged && neverNarrows && p.ladder.drift?.from === 2019 && p.ladder.drift?.to === 2025 && !!h?.spread, detail: fmt(v) };
  },

  async admHoldShare({ ref }) {
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const p = await buildPipeline("137625", entryPoint("11+")!, { today: new Date("2026-10-07") });
    const ft = (age: number) => [`full_time_male_aged_${age}`, `full_time_female_aged_${age}`];
    const own = (await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: ["137625"], periodMin: 2025, periodMax: 2025, breakdowns: ft(11) })).reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const set = p.sets.find((s) => s.age === 10)!.urns;
    const pool2025 = (await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: set, periodMin: 2024, periodMax: 2024, breakdowns: ft(10) })).reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const expected = (own / pool2025) * 100;
    const futureOk = p.hold.needed.every((n, i) => n.share === null || Math.abs(n.share - (own / p.ladder.future[i].pool!) * 100) < 1e-9);
    const v = { own, pool2025, expected: expected.toFixed(2) + "%", pipeline: p.hold.current ? p.hold.current.share.toFixed(2) + "%" : null, first: p.hold.needed[0] ? `${p.hold.needed[0].entryYear} ${p.hold.needed[0].share?.toFixed(1)}%` : null };
    return { pass: !!p.hold.current && Math.abs(p.hold.current.share - expected) < 1e-9 && futureOk, detail: fmt(v) };
  },

  async admGroupShare({ ref }) {
    const { buildMarketShare } = await import("../src/lib/admissions/market");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const m = await buildMarketShare("117037", entryPoint("11+")!);
    const urns = ["117037", ...m.rivals];
    const raw = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: urns, periodMin: 2025, periodMax: 2025, breakdowns: ["full_time_male_aged_11", "full_time_female_aged_11"] });
    const total = raw.reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const kings = raw.filter((f) => f.entity_id === "117037").reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const row = m.entryAge.rows.find((r) => r.urn === "117037" && r.period === 2025)!;
    const sums = m.entryAge.periods.map((p) => m.entryAge.rows.filter((r) => r.period === p).reduce((a, r) => a + (r.share ?? 0), 0));
    const v = { schools: urns.length, kings, total, expected: ((kings / total) * 100).toFixed(2) + "%", got: row.share?.toFixed(2) + "%", rank: row.rank, sums: sums.map((x) => x.toFixed(1)).join(" ") };
    return { pass: Math.abs(row.share! - (kings / total) * 100) < 1e-9 && sums.every((x) => x === 0 || Math.abs(x - 100) < 1e-9), detail: fmt(v) };
  },

  async admJoiners({ ref }) {
    const { fetchCensus } = await import("../src/lib/admissions/data");
    const { cohortFlow } = await import("../src/lib/admissions/flow");
    const rows = cohortFlow((await fetchCensus(["137625"])).get("137625")!.table);
    const raw = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: ["137625"], periodMin: 2024, periodMax: 2025 });
    const ft = (age: number, p: number) => raw.filter((f) => f.period === p && (f.breakdown === `full_time_male_aged_${age}` || f.breakdown === `full_time_female_aged_${age}`)).reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const leaving = (ft(15, 2024) - ft(16, 2025)) / ft(15, 2024);
    const joiners11 = Math.max(0, ft(11, 2025) - ft(10, 2024));
    const r16 = rows.find((r) => r.age === 16 && r.period === 2025)!;
    const r11 = rows.find((r) => r.age === 11 && r.period === 2025)!;
    const v = { y11_2024: ft(15, 2024), y12_2025: ft(16, 2025), leaving: (leaving * 100).toFixed(1) + "%", got: (r16.leavingShare16! * 100).toFixed(1) + "%", joiners11, gotJoiners11: r11.joinersEst };
    return { pass: Math.abs(r16.leavingShare16! - leaving) < 1e-12 && r11.joinersEst === joiners11, detail: fmt(v) };
  },

  async admShape({ ref }) {
    const { fetchCensus } = await import("../src/lib/admissions/data");
    const { shapeOf } = await import("../src/lib/admissions/shape");
    const { classifyShape } = await import("../src/lib/shape-classifier");
    const rd = await import("../src/lib/roll-data");
    const facts = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: ["137625"] });
    const page = classifyShape(rd.shapeClassifierInput(rd.singleAgeGenderCountsForPeriod(facts, rd.latestPeriod(facts)!)))?.label ?? null;
    const adm = shapeOf((await fetchCensus(["137625"])).get("137625")!.ageGender);
    return { pass: page !== null && adm === page, detail: fmt({ page, admissions: adm }) };
  },

  async admPoolNotIntake() {
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const { ADMISSIONS_NOTES } = await import("../src/catalogue/notes");
    const p = await buildPipeline("137625", entryPoint("11+")!, { today: new Date("2026-10-07") });
    const json = JSON.stringify(p);
    const sources = Array.from(new Set([...p.ladder.past, ...p.ladder.future].map((x) => x.source)));
    return { pass: !/intake/i.test(json) && /pool, not an intake/.test(ADMISSIONS_NOTES.pool) && sources.every((x) => ["counted", "births", "projection"].includes(x)), detail: fmt({ sources: sources.join("/"), intakeInPayload: /intake/i.test(json) }) };
  },

  // ---------------------------------------------------------------- 0.7 admissions r1 (A4)
  async admRivalRanks({ ref }) {
    const { buildRivals } = await import("../src/lib/admissions/rivals");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const r = await buildRivals("137625", entryPoint("11+")!);
    const me = r.rows.find((x) => x.isSchool)!;
    // The whole population's raw Attainment 8 in the results year, counted here, less the IGCSE rule's
    // schools (R-IGCSE-EVERYWHERE, 0.8 audit fixes 1).
    const { igcseEngland } = await import("../src/lib/igcse");
    const ig = await igcseEngland();
    const rows = (await ref.lookupAcademicHeadline({ ksStage: "ks4", periodMin: r.resultsPeriod!, periodMax: r.resultsPeriod! })).filter((h) => !ig.has(h.entity_id));
    const vals = rows.map((x) => Number(x.measures.attainment8_average)).filter((v) => x(v));
    function x(v: number) { return Number.isFinite(v); }
    const mine = Number(rows.find((x) => x.entity_id === "137625")!.measures.attainment8_average);
    const national = { rank: 1 + vals.filter((v) => v > mine).length, of: vals.length };
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const sb = createServerAnonSupabaseClient();
    const { data: reg } = await sb.from("school_region_nation").select("region_code").eq("urn", "137625").maybeSingle();
    const inRegion = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from("school_region_nation").select("urn").eq("region_code", (reg as { region_code: string }).region_code).range(from, from + 999);
      for (const d of (data ?? []) as { urn: string }[]) inRegion.add(d.urn);
      if (!data || data.length < 1000) break;
    }
    const regVals = rows.filter((x) => inRegion.has(x.entity_id)).map((x) => Number(x.measures.attainment8_average)).filter((v) => Number.isFinite(v));
    const regional = { rank: 1 + regVals.filter((v) => v > mine).length, of: regVals.length };
    const preps = r.rows.filter((x) => x.results.note === "no_published_results").map((x) => x.urn);
    const igcse = r.rows.filter((x) => x.results.note === "igcse_not_ranked").map((x) => x.urn);
    // Every rival the IGCSE rule flags is listed and not ranked, and there is one (117018 was fixed here
    // until it left the GIAS data on 16 Oct 2026; King's Worcester 117037 is the one now).
    const flagged = await (await import("../src/lib/igcse")).igcseAmong(r.rows.filter((x) => !x.isSchool).map((x) => x.urn));
    const igcseRivalsOk = flagged.size > 0 && [...flagged].every((u) => igcse.includes(u)) && igcse.every((u) => flagged.has(u));
    const v = { national: `${me.results.national?.rank}/${me.results.national?.of} (raw ${national.rank}/${national.of})`, regional: `${me.results.regional?.rank}/${me.results.regional?.of} (raw ${regional.rank}/${regional.of})`, size: `${me.size?.badge} ${me.size?.national?.rank}/${me.size?.national?.of}`, noResults: preps.join(" "), igcse: igcse.join(" ") };
    const pass = me.results.national?.rank === national.rank && me.results.national?.of === national.of && me.results.regional?.rank === regional.rank && me.results.regional?.of === regional.of && preps.includes("117002") && igcseRivalsOk && !!me.size?.badge;
    return { pass, detail: fmt(v) };
  },

  async admMomentum({ ref }) {
    const { buildRivals } = await import("../src/lib/admissions/rivals");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const th = await admissionsThresholds();
    const r = await buildRivals("137625", entryPoint("11+")!, { thresholds: th.thresholds });
    const urns = r.rows.map((x) => x.urn);
    const P = r.censusPeriod;
    const tRoll = th.thresholds!.get("secondary", "roll")!;
    const tEntry = th.thresholds!.get("secondary", "entry_cohort")!;
    const tHead = th.thresholds!.get("secondary", "headline")!;
    // Raw rows, each year asked on its own (the lookup's predecessor rule, as the census read).
    const census = new Map<number, Awaited<ReturnType<typeof ref.lookupReferenceData>>>();
    for (const y of [P - 3, P - 2, P - 1, P]) census.set(y, await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: urns, periodMin: y, periodMax: y }));
    const roll = (u: string, y: number) => { const v = census.get(y)!.filter((f) => f.entity_id === u && /_aged_\d+$/.test(f.breakdown)).reduce((a, f) => a + (f.value_numeric ?? 0), 0); return v > 0 ? v : null; };
    const at11 = (u: string, y: number) => census.get(y)!.filter((f) => f.entity_id === u && (f.breakdown === "full_time_male_aged_11" || f.breakdown === "full_time_female_aged_11")).reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const head = await ref.lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4", periodMin: r.resultsPeriod! - 2 });
    const a8 = (u: string, y: number) => { const v = head.find((h) => h.entity_id === u && h.period === y)?.measures.attainment8_average; return v === undefined || v === null ? null : Number(v); };
    const problems: string[] = [];
    const fired: string[] = [];
    for (const row of r.rows) {
      const u = row.urn;
      const want = new Set<string>();
      const hf = a8(u, r.resultsPeriod! - 2), ht = a8(u, r.resultsPeriod!);
      if (hf !== null && ht !== null && at11(u, P) >= tHead.minCohort && ht - hf >= tHead.high) want.add("results_rising_fast");
      const rf = roll(u, P - 2), rt = roll(u, P);
      if (rf && rt && rt >= tRoll.minCohort && ((rt - rf) / rf) * 100 >= tRoll.high) want.add("gaining_pupils");
      const rs = [P - 3, P - 2, P - 1, P].map((y) => roll(u, y));
      if (rs.every((x) => x !== null) && rs[0]! >= tRoll.minCohort && rs.every((x, i) => i === 0 || x! < rs[i - 1]!)) want.add("losing_pupils_3y");
      const ef = at11(u, P - 2), et = at11(u, P);
      if (ef >= tEntry.minCohort && ((et - ef) / ef) * 100 <= tEntry.low) want.add("entry_year_shrinking");
      const got = new Set<string>(row.momentum.map((m) => m.id as string).filter((id) => want.has(id) || ["results_rising_fast", "gaining_pupils", "losing_pupils_3y", "entry_year_shrinking"].includes(id)));
      for (const id of new Set([...want, ...got])) if (want.has(id) !== got.has(id)) problems.push(`${u} ${id}: want ${want.has(id)}, got ${got.has(id)}`);
      for (const m of row.momentum) fired.push(`${u}:${m.id}`);
    }
    return { pass: problems.length === 0, detail: fmt({ thresholds: th.source, fired: fired.join(" ") || "none", problems: problems.join("; ") || "none" }) };
  },

  async admStrengths({ ref }) {
    const { buildRivals, MIN_AREA_ENTRIES } = await import("../src/lib/admissions/rivals");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const th = await admissionsThresholds();
    const r = await buildRivals("137625", entryPoint("11+")!, { thresholds: th.thresholds });
    // 0.8 IGCSE subjects: an IGCSE rival is out of an area only where the area is incomplete at it.
    const { igcseFamiliesOut } = await import("../src/lib/igcse");
    const out = await igcseFamiliesOut();
    const outOf = (u: string, f: string) => (out.get(u)?.[String(r.resultsPeriod)] ?? []).includes(f);
    const all = r.rows.map((x) => x.urn);
    const fam = await ref.lookupAcademicSubjectFamily({ entityIds: all, ksStage: "ks4", periodMin: r.resultsPeriod!, periodMax: r.resultsPeriod! });
    const fig = (u: string, f: string) => { const x = fam.find((y) => y.entity_id === u && y.family_id === f); return x && x.avg_point_score !== null && Number(x.entries_total) >= MIN_AREA_ENTRIES ? Number(x.avg_point_score) : null; };
    const problems: string[] = [];
    for (const a of r.areas) {
      const mine = fig("137625", a.familyId)!;
      const rivals = all.filter((u) => u !== "137625" && !outOf(u, a.familyId)).map((u) => fig(u, a.familyId)).filter((v): v is number => v !== null);
      const rank = 1 + rivals.filter((v) => v > mine).length;
      const gap = mine - rivals.reduce((x, y) => x + y, 0) / rivals.length;
      if (rank !== a.rank || rivals.length + 1 !== a.of || Math.abs(gap - a.gap) > 1e-9) problems.push(`${a.familyId}: rank ${a.rank}/${a.of} vs ${rank}/${rivals.length + 1}, gap ${a.gap} vs ${gap}`);
    }
    return { pass: problems.length === 0 && r.areas.length > 0, detail: fmt({ thresholds: th.source, areas: r.areas.map((a) => `${a.familyId} ${a.rank}/${a.of}${a.flags.length ? " " + a.flags.map((f) => f.id).join("+") : ""}`).join("; "), problems: problems.join("; ") || "none" }) };
  },

  async admFeeders({ ref }) {
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const { feederFlags } = await import("../src/lib/admissions/feeders");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const p = await buildPipeline("137625", entryPoint("11+")!);
    // One age, the age below entry (Year 6 at 11+), as the feeder table and the pipeline chart read it.
    const set = p.sets.find((s) => s.age === 10)!.urns.filter((u) => u !== "137625");
    const ages = [10];
    const census = await cachedCensus(set);
    const flags = feederFlags(new Map(set.map((u) => [u, census.get(u)!.table])), ages, 2025, 10);
    const { pipelineView } = await import("../src/lib/admissions/views-api");
    const view = await pipelineView("137625", entryPoint("11+")!, []);
    if (!("feeders" in view)) return { pass: false, detail: "pipeline view empty" };
    const sameAsView = JSON.stringify(view.feeders.map((f) => [f.urn, f.flag?.id ?? null])) === JSON.stringify(flags.map((f) => [f.urn, f.flag?.id ?? null]));
    // Raw: full-time pupils at those ages, 2023 and 2025.
    // Each year asked for on its own, so a converted school reads its predecessor's year (the
    // reference lookup's lineage rule), as the admissions census read does.
    const raw = [
      ...(await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: set, periodMin: 2023, periodMax: 2023 })),
      ...(await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: set, periodMin: 2025, periodMax: 2025 })),
    ];
    const sum = (u: string, p: number) => raw.filter((f) => f.entity_id === u && f.period === p && /^full_time_(male|female)_aged_(\d+)$/.test(f.breakdown) && ages.includes(Number(f.breakdown.split("_").pop()))).reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    let ok = true;
    let areaFrom = 0, areaTo = 0;
    for (const u of set) { areaFrom += sum(u, 2023); areaTo += sum(u, 2025); }
    const area = ((areaTo - areaFrom) / areaFrom) * 100;
    const out: string[] = [];
    for (const f of flags) {
      const from = sum(f.urn, 2023), to = sum(f.urn, 2025);
      const ch = ((to - from) / from) * 100;
      const want = from < 10 ? null : ch < 0 && ch < area - 5 ? "feeder_red" : ch >= -2 ? "feeder_focus" : null;
      if ((f.flag?.id ?? null) !== want) ok = false;
      out.push(`${f.urn}:${ch.toFixed(0)}%${f.flag ? "=" + f.flag.id.replace("feeder_", "") : ""}`);
    }
    return { pass: ok && sameAsView && flags.length === set.length, detail: fmt({ area: area.toFixed(1) + "%", sameAsView, feeders: out.join(" ") }) };
  },

  // R-POST16-DEFAULT-SET (0.6.5 S4): the Post-16 default set has Post-16 provision and shares
  // more of the focus's qualification; the GCSE nearest 10 is unchanged.
  async post16DefaultSet({ ref }) {
    const dcl = await import("../src/lib/default-comparator-lists");
    const urn = "117037";
    const gcse = await dcl.buildDefaultComparatorLists(urn, { only: "nearest" });
    const gcsePlain = await dcl.buildDefaultComparatorLists(urn);
    const post16 = await dcl.buildDefaultComparatorLists(urn, { only: "nearest", post16: true });
    const urnsOf = (l: typeof gcse) => (l.list1?.schools ?? []).map((sc) => sc.urn).filter((u) => u !== urn);
    const [before, after] = [urnsOf(gcse), urnsOf(post16)];
    const sharing = async (urns: string[]) =>
      new Set((await ref.lookupAcademicSubjectQualificationHeadline({ entityIds: urns, ksStage: "ks5", qualificationType: "GCE A level" })).filter((r) => r.subject === "Mathematics" && r.period === 2024 && Number(r.entries_total) > 0).map((r) => r.entity_id)).size;
    const withKs5 = await dcl.withKs5Results(after);
    const v = { before: before.length, after: after.length, shareBefore: await sharing(before), shareAfter: await sharing(after), allWithKs5: withKs5.size === after.length, gcseUnchanged: JSON.stringify(urnsOf(gcsePlain)) === JSON.stringify(before) };
    return { pass: v.after === 10 && v.allWithKs5 && v.shareAfter > v.shareBefore && v.gcseUnchanged, detail: fmt(v) };
  },

  // R-TREND-TABLE-YEARS (0.6.4 A): every trend table on a grade measure shows its chart's years.
  // The Chase 137625 GCSE History and King's Worcester 117037 A level Mathematics: real grade
  // rows (the dashboard's read, and the nearest set's through the comparator-grades read), each
  // column's frame built from them, then each trend table preset beside its column's trend
  // chart through the series builder, card and fullscreen, years across and years down.
  async trendTableYears(L) {
    const { adv, sg, tvp } = L;
    // A relationship: every chart from HISTORIC_GRADE_FROM to the stage's latest year (years.ts); the
    // card across shows the change's two ends (TREND_BASE_PERIOD and the latest) and names the rest.
    const Y = await import("../src/catalogue/years");
    const { missingFor } = await import("./rule-year-fixtures");
    const { buildSeries } = await import("../src/lib/view-series");
    const { presetSpec } = await import("../src/catalogue/viewspec");
    const { yearColumnsShown } = await import("../src/components/teacher/tableLayout");
    const { resolveDefaultNearest } = await import("../src/lib/chooser-sets");
    type Rows = Awaited<ReturnType<typeof adv.fetchSchoolGradeRows>>["byUrn"] extends Map<string, infer R> ? R : never;
    const cases = [
      { urn: "137625", phase: "ks4" as const, subject: "History", qual: "GCSE (9-1) Full Course", scale: sg.GCSE_SCALE, bands: [["9", "4"], ["9", "7"], ["9", "9"]] },
      { urn: "117037", phase: "ks5" as const, subject: "Mathematics", qual: "GCE A level", scale: sg.bestScale(["A*", "A", "B", "C", "D", "E"]), bands: [["A*", "A"], ["A*", "A*"]] },
    ];
    const problems: string[] = [];
    const seen: string[] = [];
    let checked = 0;
    for (const c of cases) {
      const own = ((await adv.fetchSubjectLevelDataForSchools([c.urn], c.phase, { gradeYears: "four" })).byUrn.get(c.urn)?.gradeDistribution ?? []) as Rows;
      const nearest = await resolveDefaultNearest(c.urn, c.phase);
      const set = [c.urn, ...nearest.rows.map((r) => r.urn).filter((u) => u !== c.urn)];
      const setRows = (await adv.fetchSchoolGradeRows(set, c.phase, c.subject)).byUrn;
      const periods = [...new Set(own.map((r) => r.period))].sort((a, b) => a - b);
      const latest = await latestYearOf(L, c.phase);
      if (latest === null || periods.at(-1) !== latest) {
        problems.push(`${c.urn} ${c.phase}: ${latest === null ? "no latest year read" : missingFor(latest)}`);
        continue;
      }
      const ends = `${Y.TREND_BASE_PERIOD},${latest}`;
      // The focus and up to three other subjects on the same qualification.
      const subjects = [c.subject, ...[...new Set(own.filter((r) => r.qualificationType === c.qual && r.subject !== c.subject).map((r) => r.subject))].slice(0, 3)];
      const rowsOf = (rows: Rows, subject: string, p: number) => rows.filter((r) => r.subject === subject && r.qualificationType === c.qual && r.period === p);
      const measures: { id: "threshold" | "bands"; label: string; rate: (rows: Rows) => number | null }[] = [
        { id: "threshold", label: c.phase === "ks4" ? "Grade 4+" : "A*-E", rate: (rows) => sg.thresholdRate(rows, c.phase)?.rate ?? null },
        ...c.bands.map(([top, bottom]) => ({ id: "bands" as const, label: `${top}-${bottom}`, rate: (rows: Rows) => sg.bandRate(rows, { scale: c.scale, top, bottom })?.rate ?? null })),
      ];
      for (const m of measures) {
        const measure = tvp.measureById(c.phase, m.id);
        const subjectSeries = subjects.map((s) => ({ key: `${s}::${c.qual}`, label: s, shortLabel: s, colour: "#888", values: periods.map((p) => m.rate(rowsOf(own, s, p))) }));
        const state = { trendStart: null, changeStart: null, showFit: false };
        const subjectsFrame = (host: "teacher.c1.results" | "teacher.c2.context") => ({
          kind: "subjects" as const, host, periods, subjects: subjectSeries, measure, focus: `${c.subject}::${c.qual}`, groups: [], groupKind: null, benchmarkKind: null,
          rankedTable: host === "teacher.c2.context", rankedViews: host === "teacher.c2.context", spaciousBars: host !== "teacher.c2.context", categoryLabel: "Category",
          changeScope: "individual" as const, theme: "dark" as const, accentHex: null, currentBlocked: false, hasGeography: false, phase: c.phase, schoolName: "This school",
          state: { ...state, latestIdx: periods.length - 1, hiddenKeys: new Set<string>(), sort: { key: "value" as const, dir: "desc" as const }, onSort: () => {} },
        });
        const comparisons = {
          kind: "comparisons" as const, periods, measure, targetName: "This school", setLabel: "10 nearest schools", comparedOn: c.subject, titleOn: c.subject,
          versus: { urn: "average" as const, label: "Average across 10 nearest schools" }, onRankingMeasure: false, ranking: null, setKind: "nearest" as const, subjectLabel: c.subject, blocked: false, phase: c.phase, state,
          schools: set.map((u) => ({ urn: u, name: u === c.urn ? "This school" : u, isTarget: u === c.urn, values: periods.map((p) => m.rate(rowsOf(setRows.get(u) ?? [], c.subject, p))) })),
        };
        const pairs: [string, string, unknown][] = [
          ["DV-C1-RES-TR-TABLE", "DV-C1-RES-TR-CHART", subjectsFrame("teacher.c1.results")],
          ["DV-C2-TR-TABLE", "DV-C2-TR-CHART", subjectsFrame("teacher.c2.context")],
          ["DV-C2-TR-CHANGETABLE", "DV-C2-TR-CHART", subjectsFrame("teacher.c2.context")],
          ["DV-C3-TR-TABLE", "DV-C3-TR-CHART", comparisons],
          ["DV-C3-TR-CHANGETABLE", "DV-C3-TR-CHART", comparisons],
        ];
        for (const [tableId, chartId, frame] of pairs) {
          for (const fullscreen of [false, true]) {
            const build = (id: string) => buildSeries(presetSpec(id as Parameters<typeof presetSpec>[0]), frame as Parameters<typeof buildSeries>[1], { fullscreen });
            const chart = build(chartId);
            const table = build(tableId);
            const tag = `${c.urn} ${m.label} ${tableId}${fullscreen ? " fullscreen" : ""}`;
            if (!chart || !("data" in chart.leaf) || !table || table.leaf.leaf !== "yearTable") {
              problems.push(`${tag}: no ${!chart ? "chart" : "table"}`);
              continue;
            }
            const chartYears = (chart.leaf.data as { periods: number[] }).periods;
            const data = table.leaf.data;
            for (const layout of ["across", "down"] as const) {
              const { shown, hidden } = yearColumnsShown(data.periods, data.statementFrom, { yearColumns: "first-latest", fullscreen, layout });
              const shownYears = shown.map((i) => data.periods[i]);
              const all = [...shownYears, ...hidden.map((i) => data.periods[i])].sort((a, b) => a - b);
              checked++;
              if (data.periods.join() !== chartYears.join()) problems.push(`${tag} ${layout}: table ${data.periods.join(" ")} vs chart ${chartYears.join(" ")}`);
              else if (chartYears[0] !== Y.HISTORIC_GRADE_FROM) problems.push(`${tag}: chart starts ${chartYears[0]}`);
              else if (all.join() !== chartYears.join()) problems.push(`${tag} ${layout}: shown + named ${all.join(" ")}`);
              else if ((layout === "down" || fullscreen) && hidden.length) problems.push(`${tag} ${layout}: hides ${hidden.length}`);
              else if (layout === "across" && !fullscreen && shownYears.join() !== ends) problems.push(`${tag} card across: ${shownYears.join(" ")}`);
              if (!fullscreen && layout === "across") seen.push(`${shownYears.join("+")} (+${hidden.length})`);
            }
          }
        }
      }
      // Grade counts' change table: every graded year, its change from 2022/23.
      const { gradeCounts } = await import("../src/lib/grade-spread");
      const counts = gradeCounts(own.filter((r) => r.subject === c.subject && r.qualificationType === c.qual), [], { compareFrom: null, changeFrom: null });
      const cd = counts.changeDataIn("#888");
      for (const fullscreen of [false, true])
        for (const layout of ["across", "down"] as const) {
          const { shown, hidden } = yearColumnsShown(cd.periods, cd.statementFrom, { yearColumns: "first-latest", fullscreen, layout });
          checked++;
          const ok = cd.periods.join() === periods.join() && cd.statementFrom === Y.TREND_BASE_PERIOD && (layout === "down" || fullscreen ? hidden.length === 0 : shown.map((i) => cd.periods[i]).join() === ends && hidden.length === periods.length - 2);
          if (!ok) problems.push(`${c.urn} Grade counts change table ${layout}${fullscreen ? " fullscreen" : ""}: ${cd.periods.join(" ")} from ${cd.statementFrom}`);
        }
    }
    return { pass: problems.length === 0 && checked > 0, detail: problems.length ? problems.slice(0, 6).join("; ") : fmt({ checked, cards: [...new Set(seen)].join(" | "), years: `${Y.periodLabel(Y.HISTORIC_GRADE_FROM)} to each stage's latest, every chart, every table` }) };
  },

  // R-ALEVEL-STAR (0.6.3 S3): King's Worcester 117037 A level Mathematics -- A* in every year
  // 2021/22-2024/25 (the raw "*" rows read as A*), and England's A* share in every year too.
  async aLevelStar({ adv, ref, sg, agg }) {
    const gr = await import("../src/lib/grade-rows");
    const urn = "117037";
    const qual = "GCE A level";
    const own = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks5", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "Mathematics" && r.qualificationType === qual,
    );
    const eng = gr.normaliseKs5AreaRows(
      (await ref.lookupAcademicSubjectGradeGeography({ ksStage: "ks5", groupingType: "national", groupingKeys: [agg.NATIONAL_GROUPING_KEY], subject: "Mathematics", qualificationType: qual })).map((r) => ({
        period: r.period,
        grade: r.grade,
        entries: Number(r.entries_total),
      })),
      qual,
    );
    const aStar = { scale: sg.GRADE_SCALES[2], top: "A*", bottom: "A*" };
    const v: Record<string, unknown> = {};
    let pass = !own.some((r) => r.grade === "*");
    for (const p of [2021, 2022, 2023, 2024]) {
      const o = sg.bandRate(own.filter((r) => r.period === p), aStar);
      const e = sg.bandRate(eng.filter((r) => r.period === p), aStar);
      v[`own${p}`] = o ? `${o.met}/${o.entries}` : null;
      v[`eng${p}`] = round(e?.rate);
      pass = pass && !!o && o.met > 0 && !!e && e.rate > 10;
    }
    return { pass, detail: fmt(v) };
  },

  // R-HISTORIC-GRADE-LABELS on England (0.6.3 S3): Croydon College 130432 BTEC Business,
  // Distinction* in every year for the school and England alike.
  async btecDistinctionStar({ adv, ref, sg, agg }) {
    const gr = await import("../src/lib/grade-rows");
    const urn = "130432";
    const qual = "BTEC National Extended Certificate L3 - Band F - P-D*";
    const own = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks5", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "Business Studies" && r.qualificationType === qual,
    );
    const engRaw = (await ref.lookupAcademicSubjectGradeGeography({ ksStage: "ks5", groupingType: "national", groupingKeys: [agg.NATIONAL_GROUPING_KEY], subject: "Business Studies", qualificationType: qual })).map((r) => ({
      period: r.period,
      grade: r.grade,
      entries: Number(r.entries_total),
    }));
    const eng = gr.normaliseKs5AreaRows(engRaw, qual);
    const scale = sg.scaleForQualification(qual, own.map((r) => r.grade));
    const dStar = { scale, top: "Distinction*", bottom: "Distinction*" };
    const v: Record<string, unknown> = { scale: scale.slice(0, 2).join("/"), engRawCodes: [...new Set(engRaw.filter((r) => r.period <= 2022).map((r) => r.grade))].join(" ") };
    let pass = scale[0] === "Distinction*";
    for (const p of [2021, 2022, 2023, 2024]) {
      const o = sg.bandRate(own.filter((r) => r.period === p), dStar);
      const e = sg.bandRate(eng.filter((r) => r.period === p), dStar);
      v[`own${p}`] = o ? `${o.met}/${o.entries}` : null;
      v[`eng${p}`] = round(e?.rate);
      pass = pass && !!e;
    }
    return { pass, detail: fmt(v) };
  },

  // R-SCALE-FROM-QUAL (0.6.3 S3): Sevenoaks 118952 IB Higher level Biology -- grade 7 and
  // 6-7 on the IB 7-1 scale (never GCSE's), every year.
  async ibSevenAndSixSeven({ adv, sg }) {
    const urn = "118952";
    const qual = "IBO Higher level component";
    const own = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks5", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "Biology" && r.qualificationType === qual,
    );
    const scale = sg.scaleForQualification(qual, own.filter((r) => r.period >= 2023).map((r) => r.grade));
    const seven = { scale, top: "7", bottom: "7" };
    const sixSeven = { scale, top: "7", bottom: "6" };
    const v: Record<string, unknown> = { ibScale: scale === sg.GRADE_SCALES[3] };
    let pass = scale === sg.GRADE_SCALES[3];
    for (const p of [2021, 2022, 2023, 2024]) {
      const rows = own.filter((r) => r.period === p);
      const a = sg.bandRate(rows, seven);
      const b = sg.bandRate(rows, sixSeven);
      v[`y${p}`] = a && b ? `${round(a.rate)}/${round(b.rate)}` : null;
      pass = pass && !!a && !!b && b.rate >= a.rate;
    }
    return { pass, detail: fmt(v) };
  },

  // R-KS5-ASAEA-EXCL: 102239 2024/25 'All subjects' entries group total 591 (school KS5 total 1,252).
  // Reproduces page.tsx groupRows (exact-qualification rows without AS/AEA) on the lib's rows.
  async asAeaGroupTotal({ adv, qb }) {
    const urn = "102239";
    const rows = ((await adv.fetchSubjectQualificationHeadlineForSchools([urn], "ks5")).get(urn) ?? []).filter((h) => h.period === 2024);
    const all = rows.reduce((a, h) => a + h.entriesTotal, 0);
    const group = rows.filter((h) => !qb.isAsLevelOrAea(h.qualificationType ?? "")).reduce((a, h) => a + h.entriesTotal, 0);
    // Cross-check against the raw facts the item list is built from.
    const raw = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks5")).byUrn.get(urn)?.entries ?? []).filter((e) => e.period === 2024);
    const rawNonAs = raw.filter((e) => !qb.isAsLevelOrAea(e.qualificationType)).reduce((a, e) => a + e.entries, 0);
    return { pass: group === 591 && rawNonAs === 591, detail: fmt({ allQualifications: all, groupTotal: group, rawNonAsAea: rawNonAs }) };
  },

  // R-POINTS-WEIGHTED: 130432 2024/25 Computer Science 7.0, Chemistry 24.3 on the A-level
  // family's scale. Through the lib's own contextGroupRows + contextGroupValue (S3b: points
  // keep to the focus's qualification family, R-POINTS-SAME-QUAL).
  async pointsWeighted({ adv, tvm, pop }) {
    const urn = "130432";
    const qh = (await adv.fetchSubjectQualificationHeadlineForSchools([urn], "ks5")).get(urn) ?? [];
    const groupRows = pop.contextGroupRows("ks5", [], qh);
    const g = { phase: "ks5" as const, measureId: "points" as const, groupRows, gradeRows: [], bandRange: null, inGroup: () => true, focusFamily: "alevel" };
    const v = { computerScience: round(tvm.contextGroupValue(g, "Computer Science", 2024)), chemistry: round(tvm.contextGroupValue(g, "Chemistry", 2024)) };
    return { pass: v.computerScience === 7 && v.chemistry === 24.3, detail: fmt(v) };
  },

  // R-POINTS-SAME-QUAL: Croydon College 130432, 2024/25. A subject the college runs as both
  // A level and BTEC (Business Studies) has one Context group value per qualification
  // family, never a blend: the A-level family's is the A-level row's own figure, and no
  // BTEC row moves it. Post-16 points keep to the family; entries do not.
  async pointsSameQual({ adv, tvm, pop, ref }) {
    const urn = "130432";
    const qh = (await adv.fetchSubjectQualificationHeadlineForSchools([urn], "ks5")).get(urn) ?? [];
    const groupRows = pop.contextGroupRows("ks5", [], qh);
    const at = (focusFamily: string | null) =>
      tvm.contextGroupValue({ phase: "ks5", measureId: "points", groupRows, gradeRows: [], bandRange: null, inGroup: () => true, focusFamily }, "Business Studies", 2024);
    const aRow = qh.find((h) => h.subject === "Business Studies" && h.period === 2024 && h.qualificationType === "GCE A level")?.avgPointScore ?? null;
    const btecRows = qh.filter((h) => h.subject === "Business Studies" && h.period === 2024 && (h.qualificationType ?? "").startsWith("BTEC"));
    const v = {
      aLevelFamily: round(at("alevel"), 2),
      aLevelRow: aRow,
      btecFamily: round(at("btec_ocr"), 2),
      btecRows: btecRows.length,
      noFocus: at(null),
      keepsOnPoints: tvm.contextKeepsToFamily("ks5", "points"),
      keepsOnEntries: tvm.contextKeepsToFamily("ks5", "entries"),
    };
    // 0.6.5 S3: Comparisons' read (the comparator-qualifications route's lookup) gives the
    // school's exact A level Maths figure -- Column 1's own row -- not the bucket's blend.
    const { resolveDefaultNearest } = await import("../src/lib/chooser-sets");
    const set = (await resolveDefaultNearest(urn, "ks5")).rows.map((r) => r.urn);
    const exact = await ref.lookupAcademicSubjectQualificationHeadline({ entityIds: [urn, ...set], ksStage: "ks5", qualificationType: "GCE A level" });
    const ownExact = exact.find((r) => r.entity_id === urn && r.subject === "Mathematics" && r.period === 2024)?.avg_point_score ?? null;
    const column1 = qh.find((h) => h.subject === "Mathematics" && h.period === 2024 && h.qualificationType === "GCE A level")?.avgPointScore ?? null;
    const bucket = ((await adv.fetchSubjectHeadlineForSchools([urn], "ks5", undefined, null)).get(urn) ?? []).find((h) => h.subject === "Mathematics" && h.period === 2024 && h.bucket === "alevel")?.avgPointScore ?? null;
    const onlyALevel = exact.every((r) => r.qualification_type === "GCE A level");
    Object.assign(v, { comparisonsExact: ownExact, column1: column1, bucketBlend: bucket, onlyALevel });
    const pass =
      aRow !== null && v.aLevelFamily === round(aRow, 2) && v.btecRows > 0 && v.btecFamily !== null && v.btecFamily !== v.aLevelFamily && v.noFocus === null && v.keepsOnPoints && !v.keepsOnEntries &&
      ownExact !== null && column1 !== null && Number(ownExact) === Number(column1) && bucket !== null && Number(bucket) !== Number(ownExact) && onlyALevel;
    return { pass, detail: fmt(v) };
  },

  // R-MIN-SCHOOLS: Camden (Acland Burghley's LA) GCSE points rows all have >= 5 schools by
  // default; asking for a minimum of 1 returns more rows (so the default really suppresses).
  async minSchools({ ref, sb }) {
    const { data } = await sb.createServerAnonSupabaseClient().from("schools").select("la_name").eq("urn", "100053").maybeSingle<{ la_name: string | null }>();
    const la = data?.la_name;
    if (!la) return { pass: false, detail: "no LA for 100053" };
    const def = await ref.lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: "la", groupingKeys: [la] });
    const one = await ref.lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: "la", groupingKeys: [la], minSchoolCount: 1 });
    const minDefault = def.length ? Math.min(...def.map((r) => r.school_count)) : null;
    const pass = def.length > 0 && minDefault !== null && minDefault >= 5 && one.length > def.length;
    return { pass, detail: fmt({ la, rowsDefault: def.length, minSchoolsDefault: minDefault, rowsWithMin1: one.length }) };
  },

  // R-IB-NONSUBJECT: Sevenoaks 118952. The rollup must carry no Baccalaureate / IB Core
  // subject rows, and nor may the Teacher view's subject list (subjectItemsOf, which every
  // picker, tick list and population starts from). The raw facts still carry them; that is
  // reported, not failed: the list is where the rule applies.
  async ibNonSubject({ adv, pop, qb }) {
    const urn = "118952";
    const nonSubject = (subject: string, qual: string) => /baccalaureate|diploma programme core/i.test(`${subject} ${qual}`) && !/component/i.test(qual);
    const rollup = (await adv.fetchSubjectQualificationHeadlineForSchools([urn], "ks5")).get(urn) ?? [];
    const rollupBad = rollup.filter((h) => nonSubject(h.subject, h.qualificationType ?? ""));
    const raw = (await adv.fetchSubjectLevelDataForSchools([urn], "ks5")).byUrn.get(urn)?.entries ?? [];
    const latest = Math.max(...raw.map((e) => e.period));
    const rawBad = raw.filter((e) => e.period === latest && nonSubject(e.subject, e.qualificationType));
    const items = pop.subjectItemsOf(raw);
    const listed = items.filter((i) => nonSubject(i.subject, i.qualificationType) || qb.isNonSubjectRow(i.qualificationType, i.subject));
    return {
      pass: rollupBad.length === 0 && listed.length === 0 && items.length > 0,
      detail: fmt({
        rollupNonSubjectRows: rollupBad.length,
        [`teacherSubjectList(${latest}/${String(latest + 1).slice(2)})`]: `${items.length} items, non-subject: ${listed.map((i) => i.label).join("; ") || "none"}`,
        rawFactsStillCarry: [...new Set(rawBad.map((e) => e.subject))].join(", ") || "none",
      }),
    };
  },

  // R-TREND-LINE-4YR: Acland Burghley 100053 GCSE Mathematics (the rollup's subject name). Points: 4 real years -> line;
  // Grade 4+ (from the dashboard's grade rows, gradeYears "four"): 4 years -> line since 0.6.2 (2 years -> bars before).
  async trendLine(L) {
    const { adv, sg, tvp } = L;
    const { expectedFor } = await import("./rule-year-fixtures");
    const want = expectedFor("R-TREND-LINE-4YR", await latestYearOf(L, "ks4"));
    if (!want.ok) return { pass: false, detail: want.detail };
    const urn = "100053";
    const headline = ((await adv.fetchSubjectHeadlineForSchools([urn], "ks4")).get(urn) ?? []).filter((h) => h.subject === "Mathematics");
    const periods = [...new Set(headline.map((h) => h.period))].sort();
    const points = { periods, series: [{ key: "m", label: "Mathematics", colour: "#000", values: periods.map((p) => headline.find((h) => h.period === p)?.avgPointScore ?? null) }] };
    const grades = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "Mathematics" && r.qualificationType === "GCSE (9-1) Full Course",
    );
    const gp = [...new Set(grades.map((r) => r.period))].sort();
    const rate = { periods: gp, series: [{ key: "m", label: "Mathematics", colour: "#000", values: gp.map((p) => sg.thresholdRate(grades.filter((r) => r.period === p), "ks4")?.rate ?? null) }] };
    const v = {
      pointsYears: tvp.periodsWithData(points).length,
      pointsKind: tvp.trendChartKind(points),
      grade4Years: tvp.periodsWithData(rate).length,
      grade4Kind: tvp.trendChartKind(rate),
    };
    // The kind follows the years: a line at TREND_LINE_MIN_YEARS (4) or more, whatever the year.
    const { TREND_LINE_MIN_YEARS } = await import("../src/catalogue/years");
    const kind = (n: number) => (n >= TREND_LINE_MIN_YEARS ? "line" : v.pointsKind);
    return { pass: v.pointsYears === want.value.pointsYears && v.grade4Years === want.value.grade4Years && v.pointsKind === kind(v.pointsYears) && v.pointsKind === "line" && v.grade4Kind === "line", detail: fmt({ ...v, expected: `${want.value.pointsYears}/${want.value.grade4Years} years` }) };
  },

  // R-TREND-FROM-2223: The Chase 137625 GCSE History, on its real rows. Its Trends span
  // (trimmed to data, as the hosts draw it) on Average points and on Grade bands 7-9 draws
  // 2021/22 and carries the note, but its sentence and direction word are measured from
  // 2022/23 ("since 2022/23", the same words as a Trend the member starts at 2022/23); a
  // Trend from 2023/24 is unchanged by the rule. Entries and KS2 never follow it. (The note
  // in fullscreen / print: src/lib/grading-note.test.ts; the views: src/lib/trend-base.test.ts.)
  async trendFrom2223({ adv, sg, tvp, notes }) {
    const urn = "137625";
    const qual = "GCSE (9-1) Full Course";
    const headline = ((await adv.fetchSubjectHeadlineForSchools([urn], "ks4")).get(urn) ?? []).filter((h) => h.subject === "History");
    const pp = [...new Set(headline.map((h) => h.period))].sort();
    const base = notes.trendBaseFor("points", "ks4");
    const points = tvp.withTrendBase(tvp.trimToData({ periods: pp, series: [{ key: "h", label: "History", colour: "#000", values: pp.map((p) => headline.find((h) => h.period === p)?.avgPointScore ?? null) }] }), base);
    const grades = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter((r) => r.subject === "History" && r.qualificationType === qual);
    const gp = [...new Set(grades.map((r) => r.period))].sort();
    const range = { scale: sg.bestScale(grades.filter((r) => r.period >= 2023).map((r) => r.grade)), top: "9", bottom: "7" };
    const bands = tvp.withTrendBase(tvp.trimToData({ periods: gp, series: [{ key: "h", label: "History", colour: "#000", values: gp.map((p) => sg.bandRate(grades.filter((r) => r.period === p), range)?.rate ?? null) }] }), notes.trendBaseFor("bands", "ks4"));
    const said = (d: ReturnType<typeof tvp.trimToData>) => {
      const span = tvp.statementSpan(d);
      const t = tvp.trendSentence({ subjectClause: "History", values: span.series[0].values, measure: tvp.measureById("ks4", "points"), startLabel: span.periods.length ? `${span.periods[0]}` : "" });
      return t ? `${t.direction}:${t.sentence}` : "none";
    };
    const has = (years: readonly number[] | null) => notes.trendNoteFor(years) === notes.TREND_BASE_NOTE;
    const v = {
      pointsYears: points.periods.join(" "),
      bandsYears: bands.periods.join(" "),
      statementYears: tvp.statementSpan(bands).periods.join(" "),
      pointsNote: has(points.periods),
      bandsNote: has(bands.periods),
      pointsSince2223: said(points) === said(tvp.sliceFrom(points, 2022)) && said(points).includes("since 2022"),
      bandsSince2223: said(bands) === said(tvp.sliceFrom(bands, 2022)) && said(bands).includes("since 2022"),
      from2324Unchanged: said(tvp.sliceFrom(bands, 2023)) === said(tvp.sliceFrom(tvp.trimToData({ ...bands, statementFrom: null }), 2023)),
      from2223NoNote: !has(tvp.sliceFrom(bands, 2022).periods) && !has(tvp.sliceFrom(points, 2022).periods),
      latestOnly: has(bands.periods.slice(-1)),
      entries: notes.trendBaseApplies("entries", "ks4"),
      ks2: notes.trendBaseApplies("points", "ks2"),
    };
    const pass = v.pointsNote && v.bandsNote && v.pointsSince2223 && v.bandsSince2223 && v.from2324Unchanged && v.from2223NoNote && !v.latestOnly && !v.entries && !v.ks2 && bands.periods[0] === 2021 && v.statementYears.startsWith("2022");
    return { pass, detail: fmt(v) };
  },

  // R-DV-TREND-FROM-2223 (year rules follow-ups): The Chase 137625, GCSE, on the Data View's own
  // profile and its own row builder. Every subject area's Results change is its points from 2022/23
  // to the latest year; its Candidates change runs from the first year with entries; the drawn
  // years still start at 2021/22 and carry the note.
  async dataViewTrendFrom2223({ adv, notes }) {
    const Y = await import("../src/catalogue/years");
    const { buildCategoryRows } = await import("../src/components/data-view/SubjectAreaSection");
    const urn = "137625";
    const [p] = await adv.fetchAcademicProfiles([urn], { includeSubjects: true });
    const base = adv.TREND_BASELINE_PERIOD;
    const pct = (a: number | null | undefined, b: number | null | undefined) => (a && b !== null && b !== undefined ? ((b - a) / a) * 100 : null);
    const same = (a: number | null, b: number | null) => (a === null ? b === null : b !== null && Math.abs(a - b) < 1e-9);
    const areas = buildCategoryRows(p, "ks4").map((r) => {
      const ys = adv.familyYearsFor(p, "ks4", r.id);
      const last = [...ys].reverse().find((y) => y.avgPointScore !== null);
      const at = ys.find((y) => y.period === base.ks4)?.avgPointScore ?? null;
      const firstE = ys.find((y) => y.entriesTotal > 0);
      const lastE = [...ys].reverse().find((y) => y.entriesTotal > 0);
      return {
        results: same(r.resultsPctChange, last && last.period > base.ks4 ? pct(at, last.avgPointScore) : null),
        candidates: same(r.candidatesPctChange, pct(firstE?.entriesTotal, lastE?.entriesTotal)),
        from2223: at !== null && r.resultsPctChange !== null,
      };
    });
    const drawn = [...new Set(adv.stageYears(p, "ks4").map((y) => y.period))].sort();
    const v = {
      since: `ks2 ${base.ks2}, ks4 ${base.ks4}, ks5 ${base.ks5}`,
      areas: areas.length,
      resultsFrom2223: areas.every((a) => a.results),
      measuredFrom2223: areas.filter((a) => a.from2223).length,
      candidatesFromFirst: areas.every((a) => a.candidates),
      drawnFrom: drawn[0],
      note: notes.trendNoteFor(drawn) === notes.TREND_BASE_NOTE,
    };
    const pass = base.ks4 === Y.TREND_BASE_PERIOD && base.ks5 === Y.TREND_BASE_PERIOD && base.ks2 === 2022 && v.areas > 0 && v.resultsFrom2223 && v.measuredFrom2223 > 0 && v.candidatesFromFirst && v.drawnFrom === Y.GRADING_2122_PERIOD && v.note;
    return { pass, detail: fmt(v) };
  },

  // R-MEETINGS-TREND-4YR (year rules follow-ups; the round-5 catalogue deleted in the leftovers): King's
  // Worcester 117037 GCSE. Computer Science has 3 real years of points and the slide draws its series as
  // bars; a subject with 4+ draws as a line (trendChartKind, the host's panels).
  async meetingsTrend4yr({ adv, tvp }) {
    const urn = "117037";
    const headline = (await adv.fetchSubjectHeadlineForSchools([urn], "ks4")).get(urn) ?? [];
    const yearsOf = (subject: string) => new Set(headline.filter((h) => h.subject === subject && h.avgPointScore !== null).map((h) => h.period)).size;
    const four = [...new Set(headline.map((h) => h.subject))].sort().find((s) => yearsOf(s) >= tvp.TREND_LINE_MIN_YEARS) ?? null;
    const kind = (subject: string) => {
      const rows = headline.filter((h) => h.subject === subject);
      const periods = [...new Set(rows.map((h) => h.period))].sort();
      return tvp.trendChartKind({ periods, series: [{ key: subject, label: subject, colour: "#000", values: periods.map((p) => rows.find((h) => h.period === p)?.avgPointScore ?? null) }] } as never);
    };
    const v = {
      minYears: tvp.TREND_LINE_MIN_YEARS,
      cs3Years: yearsOf("Computer Science"),
      cs3Draws: kind("Computer Science"),
      fourYearSubject: four,
      fourYearDraws: four ? kind(four) : "none",
    };
    const pass = v.minYears === 4 && v.cs3Years === 3 && v.cs3Draws === "bars" && !!four && v.fourYearDraws === "line";
    return { pass, detail: fmt(v) };
  },

  // R-RANKING-ENTRIES-CHANGE (year rules follow-ups): The Chase 137625 GCSE History, national. The
  // entries change list starts at the first year with data, the same from the database function and
  // the app's fallback; Average points' starts at 2022/23.
  async rankingEntriesChange({ adv }) {
    const Y = await import("../src/catalogue/years");
    const SR = await import("../src/lib/subject-ranking");
    const { cachedRankingPopulation } = await import("../src/lib/chooser-sets");
    const CC = await import("../src/lib/comparator-chooser");
    const urn = "137625";
    const { subjectFamilyMap } = await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" });
    const urns = (await cachedRankingPopulation(null, "ks4", null)).filter((r) => CC.matchesRanking(r, CC.defaultRankingFilters(CC.NATIONAL))).map((r) => r[0]);
    const req = (kind: "entries" | "points") => ({ urns, targetUrn: urn, phase: "ks4" as const, subject: "History", familyId: subjectFamilyMap["History"] ?? null, qualificationType: null, measure: { kind }, period: null });
    const ent = await SR.rankByFunction(req("entries"));
    const entFb = SR.rankFigures(req("entries"), await SR.fallbackFigures(req("entries")));
    const pts = await SR.rankByFunction(req("points"));
    const firstYear = ent ? Math.min(...ent.average.map((a) => a.period)) : null;
    const v = {
      function: ent ? "present" : "absent",
      entriesFrom: ent?.change?.from ?? entFb.change?.from ?? null,
      firstYearWithData: firstYear,
      fallbackFrom: entFb.change?.from ?? null,
      sameWindow: !ent || JSON.stringify(ent.change?.window.map((w) => [w.urn, w.rank])) === JSON.stringify(entFb.change?.window.map((w) => [w.urn, w.rank])),
      pointsFrom: pts?.change?.from ?? SR.rankFigures(req("points"), await SR.fallbackFigures(req("points"))).change?.from ?? null,
    };
    const pass = v.entriesFrom !== null && v.entriesFrom === v.fallbackFrom && (firstYear === null || v.entriesFrom === firstYear) && v.entriesFrom < Y.TREND_BASE_PERIOD && v.sameWindow && v.pointsFrom === Y.TREND_BASE_PERIOD;
    return { pass, detail: fmt(v) };
  },

  // R-ENTRIES-FIRST-YEAR (year rules leftovers): The Chase 137625 GCSE History. Every entries view starts at
  // the first year with entries in the data (2020/21, the teacher-assessed year): Teacher's Candidates
  // draws it, the Data View's subject-mode "Candidates, % change" and the SMT entries mix measure from it,
  // and both changes match the ranked list (+29% since 2020/21). Results keep 2021/22 / 2022/23.
  async entriesFirstYear({ adv, tvp }) {
    const Y = await import("../src/catalogue/years");
    const SR = await import("../src/lib/subject-ranking");
    const SAS = await import("../src/components/data-view/SubjectAreaSection");
    const { cachedRankingPopulation } = await import("../src/lib/chooser-sets");
    const CC = await import("../src/lib/comparator-chooser");
    const urn = "137625";
    const head = (await adv.fetchSubjectHeadlineForSchools([urn], "ks4")).get(urn) ?? [];
    const hist = head.filter((h) => h.subject === "History").sort((a, b) => a.period - b.period);
    const first = Y.entriesFirstPeriod(hist.filter((h) => h.entriesTotal > 0).map((h) => h.period));
    // Teacher's Candidates: the page's periods (every year the headline holds), trimmed to the data.
    const periods = [...new Set(head.map((h) => h.period))].sort();
    const drawn = tvp.trimToData({ periods, series: [{ key: "History", label: "History", colour: "#000", values: periods.map((p) => hist.find((h) => h.period === p)?.entriesTotal ?? null) }] } as never);
    const resultsFrom = hist.find((h) => h.avgPointScore !== null)?.period ?? null;
    // The Data View, subject mode, as the page builds the school's rows.
    const { byUrn, subjectFamilyMap } = await adv.fetchSubjectLevelDataForSchools([urn], "ks4");
    const sd = byUrn.get(urn);
    const familyId = subjectFamilyMap["History"] ?? "";
    const bySubject = new Map<string, typeof head>();
    for (const h of head) if (h.familyId === familyId) bySubject.set(h.subject, [...(bySubject.get(h.subject) ?? []), h]);
    const rows = SAS.buildSubjectRows("ks4", familyId, sd ? { entries: sd.entries, valueAdded: sd.valueAdded ?? [], subjectFamilyMap } : null, bySubject, "qualification");
    const dv = rows.find((r) => r.subject === "History")?.candidatesPctChange ?? null;
    // The ranked list (national).
    const urns = (await cachedRankingPopulation(null, "ks4", null)).filter((r) => CC.matchesRanking(r, CC.defaultRankingFilters(CC.NATIONAL))).map((r) => r[0]);
    const req = { urns, targetUrn: urn, phase: "ks4" as const, subject: "History", familyId: familyId || null, qualificationType: null, measure: { kind: "entries" as const }, period: null };
    const rk = (await SR.rankByFunction(req)) ?? SR.rankFigures(req, await SR.fallbackFigures(req));
    const v = {
      firstWithEntries: first,
      teacherDrawsFrom: (drawn as { periods: number[] }).periods[0] ?? null,
      resultsFrom,
      dataViewChange: dv === null ? null : Math.round(dv),
      rankedFrom: rk.change?.from ?? null,
      rankedChange: rk.change?.target === undefined || rk.change?.target === null ? null : Math.round(rk.change.target),
    };
    const pass = first !== null && first < Y.GRADING_2122_PERIOD && v.teacherDrawsFrom === first && v.rankedFrom === first && v.resultsFrom === Y.GRADING_2122_PERIOD && v.dataViewChange !== null && v.dataViewChange === v.rankedChange && v.rankedChange === 29;
    return { pass, detail: fmt(v) };
  },

  // R-NO-NEGATIVE-ZERO (year rules leftovers): a change that rounds to zero prints as an exact zero prints
  // there, never "−0" / "-0": the shared formatter in each style, the Data View's diverging bars (rendered),
  // SMT's, Admissions' and the change map's formatters; and no hand-rolled sign-then-toFixed is left in src.
  async noNegativeZero() {
    const { signedDelta, UNSIGNED_ZERO } = await import("../src/lib/signed-delta");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const DBC = (await import("../src/components/data-view/DivergingBarChart")).default;
    const SDBC = (await import("../src/components/data-view/SubjectAreaDivergingBarChart")).default;
    const smt = await import("../src/components/smt/ui");
    const adm = await import("../src/components/admissions/ui");
    const cmp = await import("../src/lib/teacher-view-comparisons");
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const pct = (x: number) => `${Math.abs(x).toFixed(0)}%`;
    const printed: Record<string, string> = {
      teacher: signedDelta(-0.3, pct),
      dataView: signedDelta(-0.3, pct, UNSIGNED_ZERO),
      bars: renderToStaticMarkup(createElement(DBC, { points: [{ urn: "1", name: "A", pctChange: -0.3, isTarget: true }, { urn: "2", name: "B", pctChange: 4, isTarget: false }] })),
      subjectBars: renderToStaticMarkup(createElement(SDBC, { items: [{ id: "a", label: "A", pctChange: -0.4 }, { id: "b", label: "B", pctChange: -3 }] })),
      smtVa: smt.fmt(-0.004, "va"),
      smtPp: smt.fmtChange({ change: -0.04, unit: "pp" }),
      admissions: adm.fmtSigned(-0.04),
      changeMap: cmp.signedPercent(-0.3),
    };
    const neg0 = /[−-]0(\.0+)?(%|pp| ?pts)?(?![.0-9])/;
    const bad = Object.entries(printed).filter(([, s]) => neg0.test(s.replace(/<[^>]+>/g, " "))).map(([k]) => k);
    // Still signed where the change is real: −3% stays "−3%" in the Data View's bars, "−6pp" in Teacher's.
    const real = printed.subjectBars.includes("−3%") && signedDelta(-6.5, (x) => `${Math.abs(Math.round(x))}pp`) === "−6pp";
    const handRolled: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\./.test(f) && /\? "\+" : ""\}?\s*\$?\{?[^`]{0,80}\.toFixed\(/.test(readFileSync(p, "utf8"))) handRolled.push(path.relative(ROOT, p));
      }
    };
    walk(path.join(ROOT, "src"));
    const pass = bad.length === 0 && real && handRolled.length === 0;
    return { pass, detail: fmt({ negativeZero: bad.join(", ") || "none", stillSigned: real, handRolled: handRolled.join(", ") || "none", smtPp: printed.smtPp, admissions: printed.admissions, dataView: printed.dataView, teacher: printed.teacher }) };
  },

  // R-ROLL-WORDS-3YR (consistency): roll direction words compare the latest census with 3 years before,
  // steady when the change rounds to 0% (R-FLAT-BAND). SMT's roll word on Wolverley (growing), Pershore
  // (shrinking), Bewdley (steady) and Chilmington Green (only three census years: its longest span, 2
  // years); Admissions' Momentum base year; the groups' span; the (i) sentence.
  async rollWords3yr() {
    const Y = await import("../src/catalogue/years");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RollDirectionWord } = await import("../src/components/smt/views/Lines");
    const { GROWING_SPAN } = await import("../src/lib/groups/dash");
    const { METHODS: M0 } = await import("../src/catalogue/methods");
    const { METHODS_GROUPS } = await import("../src/catalogue/methods-groups");
    const METHODS = { ...M0, ...METHODS_GROUPS };
    const want: [string, string, string, boolean][] = [["135061", "Wolverley", "Growing", false], ["136925", "Pershore", "Shrinking", false], ["135035", "Bewdley", "Steady", false], ["149840", "Chilmington Green", "Growing", true]];
    const out: string[] = [];
    let pass = true;
    for (const [urn, name, word, short] of want) {
      const o = (await smtCase(urn)).overview;
      const pts = o.trends.roll.lines[0]?.pts ?? [];
      const d = Y.rollDirection(pts, 0);
      const html = renderToStaticMarkup(createElement(RollDirectionWord, { pts }));
      const text = html.replace(/<[^>]+>/g, "").trim();
      const realYears = pts.filter((p) => p.value !== null).length;
      const ok = !!d && d.word === word && d.short === short && text.endsWith(word) && (short ? d.span === realYears - 1 && realYears < 4 : d.span === Y.ROLL_DIRECTION_SPAN);
      pass &&= ok;
      out.push(`${name}: ${d ? `${Y.periodLabel(d.from)}-${Y.periodLabel(d.to)} ${d.pct.toFixed(2)}% "${text}"` : "none"} ${ok ? "ok" : "MISMATCH"}`);
    }
    const v = await import("../src/lib/admissions/views-api");
    const m = await v.marketView("137625", v.entryPoint("11+")!, []);
    const mine = m.extras.find((e) => e.urn === "137625")!;
    const momentum = mine.entryBasePeriod === m.summary.latest - Y.ROLL_DIRECTION_SPAN;
    const groups = GROWING_SPAN === String(Y.ROLL_DIRECTION_SPAN);
    const sentence = "Growing or shrinking compares this year's roll with three years ago.";
    const info = ["DV-SMT-O-ROLL-LINE", "DV-SMT-P-PHASES", "DV-ADM-M-MOMENTUM", "GRP-O-MAP", "GRP-O-ROLL", "GRP-S-GROWING", "GRP-P-GROWING"].filter((k) => !JSON.stringify((METHODS as Record<string, unknown>)[k] ?? "").includes(sentence));
    pass &&= momentum && groups && info.length === 0;
    return { pass, detail: `${out.join("; ")}; Momentum from ${mine.entryBasePeriod} (latest ${m.summary.latest}) ${momentum ? "ok" : "MISMATCH"}; groups span ${GROWING_SPAN}; (i) missing: ${info.join(", ") || "none"}` };
  },

  // R-SET-CHANGE-AVERAGE (consistency): a set's "% change" is the change in the set's yearly average, in
  // both modes. The Chase 137625 GCSE and its 10 nearest: subject mode (History entries, from the rollup)
  // and category mode (Humanities entries, family rows), each against a plain yearly-mean sum.
  async setChangeAverage({ adv }) {
    const { setAverageChange } = await import("../src/lib/set-change");
    const SAS = await import("../src/components/data-view/SubjectAreaSection");
    const Y = await import("../src/catalogue/years");
    const { resolveDefaultNearest } = await import("../src/lib/chooser-sets");
    const near = (await resolveDefaultNearest("137625", "ks4")).rows.map((r: { urn: string }) => r.urn);
    const urns = Array.from(new Set(["137625", ...near]));
    const head = await adv.fetchSubjectHeadlineForSchools(urns, "ks4");
    const { byUrn, subjectFamilyMap } = await adv.fetchSubjectLevelDataForSchools(urns, "ks4");
    const familyId = subjectFamilyMap["History"] ?? "";
    const manual = (series: { period: number; value: number }[][]) => {
      const by = new Map<number, number[]>();
      for (const s of series) for (const x of s) by.set(x.period, [...(by.get(x.period) ?? []), x.value]);
      const ps = [...by.keys()].sort((a, b) => a - b);
      const mean = (p: number) => by.get(p)!.reduce((a, b) => a + b, 0) / by.get(p)!.length;
      const from = Y.changeStartFor("entries", ps);
      return ps.length > 1 ? ((mean(ps.at(-1)!) - mean(from)) / mean(from)) * 100 : null;
    };
    // Subject mode: each school's row as the page builds it, then the set's change.
    const series = urns.map((u) => {
      const bySubject = new Map<string, ReturnType<typeof head.get> & object>();
      for (const h of head.get(u) ?? []) if (h.familyId === familyId) bySubject.set(h.subject, [...(bySubject.get(h.subject) ?? []), h]);
      const sd = byUrn.get(u);
      const rows = SAS.buildSubjectRows("ks4", familyId, sd ? { entries: sd.entries, valueAdded: sd.valueAdded ?? [], subjectFamilyMap } : null, bySubject, "qualification");
      return rows.find((r) => r.subject === "History")?.candidatesSeries ?? [];
    });
    const subject = setAverageChange(series, "entries");
    const subjectManual = manual(series);
    // Category mode: the family rows (whole-school 'all' rows), through the page's own aggregateFamilyTrend.
    const { lookupAcademicSubjectFamily } = await import("../src/lib/vicdata-reference");
    const fam = (await lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks4" })).filter((f) => (f.bucket ?? "all") === "all");
    const yearsOf = (u: string) => fam.filter((f) => f.entity_id === u).map((f) => ({ familyId: f.family_id, familyLabel: f.family_label, period: f.period, entriesTotal: f.entries_total, entriesSharePercent: f.entries_share_percent, avgPointScore: f.avg_point_score, pointsCoveragePercent: f.points_coverage_percent }));
    const profiles = urns.map((u) => ({ urn: u, ks4Families: yearsOf(u), ks5Families: [] })) as never[];
    const famSeries = urns.map((u) => yearsOf(u).filter((y) => y.familyId === familyId && y.entriesTotal > 0).map((y) => ({ period: y.period, value: y.entriesTotal })));
    const category = SAS.aggregateFamilyTrend(profiles, "ks4", familyId, (y) => (y.entriesTotal > 0 ? y.entriesTotal : null));
    const categoryManual = manual(famSeries);
    const near1 = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 1e-9;
    const v = { schools: urns.length, subject: subject?.toFixed(2), subjectManual: subjectManual?.toFixed(2), category: category?.toFixed(2), categoryManual: categoryManual?.toFixed(2), startsAt: Y.changeStartFor("entries", series.flat().map((x) => x.period)) };
    return { pass: near1(subject, subjectManual) && near1(category, categoryManual), detail: fmt(v) };
  },

  // R-MINUS-SIGN (consistency): no figure prints a hyphen-minus as its sign. The shared formatter's
  // styles, the Data View's bars (rendered), SMT's and Admissions' percent formats and flag figures, and
  // no hyphen style or hand-rolled hyphen sign left in src.
  async minusSign() {
    const { signedDelta, signedValue, UNSIGNED_ZERO } = await import("../src/lib/signed-delta");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const DBC = (await import("../src/components/data-view/DivergingBarChart")).default;
    const SDBC = (await import("../src/components/data-view/SubjectAreaDivergingBarChart")).default;
    const smt = await import("../src/components/smt/ui");
    const adm = await import("../src/components/admissions/ui");
    const { figuresOf } = await import("../src/components/admissions/views/Momentum");
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const pct = (x: number) => `${Math.abs(x).toFixed(0)}%`;
    const printed: Record<string, string> = {
      teacher: signedDelta(-3, pct),
      unsignedZero: signedDelta(-3, pct, UNSIGNED_ZERO),
      value: signedValue(-1.25, 1),
      bars: renderToStaticMarkup(createElement(DBC, { points: [{ urn: "1", name: "A", pctChange: -12, isTarget: true }, { urn: "2", name: "B", pctChange: 4, isTarget: false }] })),
      subjectBars: renderToStaticMarkup(createElement(SDBC, { items: [{ id: "a", label: "A", pctChange: -3 }] })),
      smtPct: smt.fmt(-2.34, "pct"),
      admissionsPct: adm.fmtPct(-2),
      admissionsSigned: adm.fmtSigned(-2.5),
      flagFigures: figuresOf({ label: "Losing pupils", figures: { changePct: -3.456, gap: -2 } } as never),
    };
    const text = (s: string) => s.replace(/<[^>]+>/g, " ");
    const hyphen = Object.entries(printed).filter(([, s]) => /(^|[\s(:>])-\d/.test(text(s)) || !text(s).includes("−")).map(([k]) => k);
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) {
          const src = readFileSync(p, "utf8");
          if (/minus:\s*"-"|HYPHEN_SIGN|\? "\+" : ""|: "-"\s*\}|>= 0 \? "\+" : ""/.test(src)) offenders.push(path.relative(ROOT, p));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    return { pass: hyphen.length === 0 && offenders.length === 0, detail: fmt({ hyphenSigns: hyphen.join(", ") || "none", sourceOffenders: offenders.join(", ") || "none", bars: (text(printed.bars).match(/[−-]12%/) ?? [""])[0], smtPct: printed.smtPct, flagFigures: printed.flagFigures.replace(/\n/g, " | ") }) };
  },

  // R-FLAT-BAND (consistency): a change that rounds to 0 at the precision shown is steady: no ▲/▼, "–",
  // neutral colour. The shared helper, SMT's tile and Scorecard formats, Admissions' arrow, the group home
  // line and its growing count; and no "▬" or unbanded ▲/▼ left in src.
  async flatBand() {
    const S = await import("../src/lib/signed-delta");
    const smt = await import("../src/components/smt/ui");
    const adm = await import("../src/components/admissions/ui");
    const { summaryLine } = await import("../src/components/groups/GroupHome");
    const { rollSummary } = await import("../src/lib/groups/access-rules");
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const p0 = (x: number) => `${x.toFixed(0)}%`;
    const v = {
      helper: S.arrowed(-0.4, p0, 0),
      fall: S.arrowed(-0.6, p0, 0),
      smtTile: smt.fmtChange({ change: -0.3, unit: "pct" }),
      smtColour: smt.dirClass(-0.3, 0, 0),
      smtArrow: smt.arrowOf(-0.003, 0.05),
      admissions: adm.arrow(-0.3, 0, 0),
      groupHome: summaryLine({ summary: { schools: 5, changePct: -0.04, growing: 0, compared: 5 } } as never),
      groupGrowing: rollSummary([{ urn: "1", now: 1003, before: 1000 }, { urn: "2", now: 1010, before: 1000 }]).growing,
    };
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) {
          const src = readFileSync(p, "utf8");
          if (/▬|>= 0 \? "▲" : "▼"|< 0 \? "▼" : "▲"/.test(src)) offenders.push(path.relative(ROOT, p));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    const pass = v.helper === "– 0%" && v.fall === "▼ 1%" && v.smtTile === "– 0%" && v.smtColour.includes("muted") && v.smtArrow === "–" && v.admissions === "–" && v.groupHome.includes("roll – 0.0%") && v.groupGrowing === 1 && offenders.length === 0;
    return { pass, detail: fmt({ ...v, offenders: offenders.join(", ") || "none" }) };
  },

  // R-CURRENT-GRADES-FROM-2324: Acland Burghley 100053 GCSE Grade 4+ on its real four-year rows.
  // Read from 2023/24 on, as Current reads them: Turkish (grades only before 2023/24) leaves
  // the list, and Latin (no 2023/24) has no "vs last year" -- not 2024/25 against 2022/23.
  async currentGradesFrom2324(L) {
    const { adv, sg, tvp } = L;
    const { expectedFor } = await import("./rule-year-fixtures");
    const Y = await import("../src/catalogue/years");
    const latest = await latestYearOf(L, "ks4");
    const want = expectedFor("R-CURRENT-GRADES-FROM-2324", latest);
    if (!want.ok) return { pass: false, detail: want.detail };
    const urn = "100053";
    const qual = "GCSE (9-1) Full Course";
    const grades = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter((r) => r.qualificationType === qual);
    const periods = [...new Set(grades.map((r) => r.period))].sort();
    const subjects = [...new Set(grades.map((r) => r.subject))].sort();
    const series = subjects.map((subject) => ({ key: subject, values: periods.map((p) => sg.thresholdRate(grades.filter((r) => r.subject === subject && r.period === p), "ks4")?.rate ?? null) }));
    const figured = tvp.latestYearSeries(series.filter((s) => s.values.some((v) => v !== null)), periods, tvp.latestYearFrom("threshold"), null);
    const latestIdx = periods.length - 1;
    const rows = tvp.currentRowsWithDelta(figured, latestIdx, false);
    const latin = rows.find((r) => r.s.key === "Latin");
    const v = {
      periods: periods.join(" "),
      turkishListed: figured.some((s) => s.key === "Turkish"),
      turkishHasOldGrades: series.some((s) => s.key === "Turkish" && s.values.some((x) => x !== null)),
      latinDelta: latin ? latin.delta : "absent",
      points: tvp.latestYearFrom("points"),
    };
    const yearsOk = v.periods === Array.from({ length: latest! - Y.HISTORIC_GRADE_FROM + 1 }, (_, i) => Y.HISTORIC_GRADE_FROM + i).join(" ");
    const latinOk = latin !== undefined && (want.value.latinDelta === null ? latin.delta === null : latin.delta !== null && Math.abs(latin.delta - want.value.latinDelta) < 0.01);
    return { pass: !v.turkishListed && v.turkishHasOldGrades && latinOk && v.points === null && yearsOk, detail: fmt({ ...v, expectedLatinDelta: want.value.latinDelta === null ? "none" : want.value.latinDelta.toFixed(2) }) };
  },

  // R-THRESHOLD-PERIODS: Acland Burghley 100053's school grade rows (the dashboard's, gradeYears
  // "four") cover exactly 2021/22-2024/25 since 0.6.2 (2023/24 and 2024/25 before). The Data
  // View's read (no option) is unchanged: still the modern years only.
  async thresholdPeriods(L) {
    const { adv, ref } = L;
    // A relationship, not a number: the grade rows run from HISTORIC_GRADE_FROM (four-year read) or
    // MODERN_GRADE_FROM (the Data View read) to the latest year, every year between.
    const Y = await import("../src/catalogue/years");
    const { missingFor } = await import("./rule-year-fixtures");
    const latest = await latestYearOf(L, "ks4");
    if (latest === null) return { pass: false, detail: "no latest year read" };
    const range = (from: number) => Array.from({ length: latest - from + 1 }, (_, i) => from + i).join(",");
    const urn = "100053";
    const grades = (await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? [];
    const periods = [...new Set(grades.map((r) => r.period))].sort();
    const dataView = (await adv.fetchSubjectLevelDataForSchools([urn], "ks4")).byUrn.get(urn)?.gradeDistribution ?? [];
    const dvPeriods = [...new Set(dataView.map((r) => r.period))].sort();
    return {
      pass: periods.join(",") === range(Y.HISTORIC_GRADE_FROM) && dvPeriods.join(",") === range(Y.MODERN_GRADE_FROM),
      detail: periods.at(-1) !== latest ? missingFor(latest) : fmt({ gradePeriods: periods.join(" "), dataViewPeriods: dvPeriods.join(" "), expected: `${range(Y.HISTORIC_GRADE_FROM)} / ${range(Y.MODERN_GRADE_FROM)}`, source: ref.gradeRollupRpcState() === "present" ? "rollup" : "facts" }),
    };
  },

  // R-HISTORIC-GRADE-LABELS: Croydon College 130432 Business Studies, BTEC Extended Certificate,
  // 2021/22 in its modern words on the vocational scale; King's Worcester 117037 A-level Maths
  // 2021/22 keeps its "*" rows on the A-level scale, read as A* since 0.6.3 (R-ALEVEL-STAR).
  // Through the dashboard's read.
  async historicGradeLabels({ adv, sg }) {
    const read = async (urn: string) => (await adv.fetchSubjectLevelDataForSchools([urn], "ks5", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? [];
    const btec = (await read("130432")).filter((r) => r.subject === "Business Studies" && r.period === 2021 && r.qualificationType.startsWith("BTEC National Extended Certificate"));
    const at = (rows: typeof btec, g: string) => rows.filter((r) => r.grade === g).reduce((a, r) => a + r.entries, 0);
    const btecScale = sg.bestScale(btec.map((r) => r.grade));
    const maths = (await read("117037")).filter((r) => r.subject === "Mathematics" && r.period === 2021 && r.qualificationType === "GCE A level");
    const mathsRate = sg.thresholdRate(maths, "ks5");
    const v = {
      btec: ["Distinction*", "Distinction", "Merit", "Pass"].map((g) => `${g}:${at(btec, g)}`).join(" "),
      btecShortCodes: btec.filter((r) => ["*", "D", "M", "P"].includes(r.grade)).length,
      covid: at(btec, "COVID result"),
      btecScale: btecScale[0] ?? "none",
      mathsStarRows: maths.filter((r) => r.grade === "*").length,
      // 0.6.3 S3 (R-ALEVEL-STAR): the "*" rows are A* now, on the same A-level scale.
      mathsAStar: at(maths, "A*"),
      mathsAtoE: round(mathsRate?.rate ?? null),
      mathsGraded: mathsRate?.entries ?? null,
    };
    const pass =
      v.btec === "Distinction*:2 Distinction:9 Merit:31 Pass:9" && v.btecShortCodes === 0 && v.covid === 44 && v.btecScale === "Distinction*" && sg.NON_GRADE_VALUES.has("COVID result") &&
      v.mathsStarRows === 0 && v.mathsAStar === 20 && v.mathsAtoE === 100 && v.mathsGraded === 45;
    return { pass, detail: fmt(v) };
  },
  // ---------------------------------------------------------------- 0.7 admissions r2 (D7)
  // Every runner reads the screens' own functions (views-api.ts: what the routes answer) for a
  // real school and checks them against raw rows or round 1's own builders.
  async yearsRollover(L, rule) {
    // 0.8 audit fixes (10): a rehearsal of GCSE 2026/27 arriving. The latest KS4 year moves to 2026
    // (as academic_current_periods would say) while the data and fixtures stay; every year-dependent
    // rule must then pass or say "no expected value for 2026/27" -- never fail on a wrong number.
    const Y = await import("../src/catalogue/years");
    const { missingFor } = await import("./rule-year-fixtures");
    await latestYearOf(L, "ks4");
    const before = { ks4: Y.latestPeriodOf("ks4"), ks5: Y.latestPeriodOf("ks5"), census: Y.latestPeriodOf("census"), ks2: Y.latestPeriodOf("ks2") };
    const next = (before.ks4 ?? 2025) + 1;
    const say = missingFor(next);
    const checks = ["trendLine", "thresholdPeriods", "trendTableYears", "currentGradesFrom2324", "smtFlags"];
    const out: string[] = [];
    let ok = true;
    try {
      Y.setLatestYears({ ks4: { period: next, provisional: false } });
      for (const k of checks) {
        const r = await RUNNERS[k](L, rule);
        const fine = r.pass || r.detail.includes(say);
        ok &&= fine;
        out.push(`${k}: ${r.pass ? "pass" : r.detail.includes(say) ? "says no expected value" : `WRONG (${r.detail.slice(0, 120)})`}`);
      }
    } finally {
      Y.resetLatestYears();
      Y.setLatestYears(Object.fromEntries(Object.entries(before).filter(([, p]) => p !== null).map(([k, p]) => [k, { period: p as number, provisional: false }])));
    }
    return { pass: ok, detail: fmt({ rehearsed: Y.periodLabel(next), checks: out.join("; ") }) };
  },
  async rankTies({ ref }) {
    const { resolveRankingSet, cachedRankingPopulation } = await import("../src/lib/chooser-sets");
    const { defaultRankingFilters, matchesRanking, NATIONAL } = await import("../src/lib/comparator-chooser");
    const { placeWord } = await import("../src/lib/view-series/tiles");
    const { igcseEngland } = await import("../src/lib/igcse");
    const nat = defaultRankingFilters(NATIONAL);
    const r = await resolveRankingSet("137625", "The Chase", "ks4", nat, null);
    const ig = await igcseEngland();
    const pop = (await cachedRankingPopulation(null, "ks4", null)).filter((x) => matchesRanking(x, nat)).map((x) => x[0]).filter((u) => !ig.has(u));
    const heads = await ref.lookupAcademicHeadline({ entityIds: pop, ksStage: "ks4" });
    const latest = new Map<string, { period: number; value: number }>();
    for (const h of heads) {
      const v = Number(h.measures.attainment8_average);
      if (!Number.isFinite(v)) continue;
      const cur = latest.get(h.entity_id);
      if (!cur || h.period > cur.period) latest.set(h.entity_id, { period: h.period, value: v });
    }
    const mine = latest.get("137625")!.value;
    const above = Array.from(latest.values()).filter((x) => x.value > mine).length;
    const same = Array.from(latest).filter(([u, x]) => u !== "137625" && x.value === mine).length;
    const pass = r.targetRank === above + 1 && r.targetTied === same > 0 && (same === 0 || (r.note ?? "").includes(`ranks =${placeWord(above + 1).replace(/^=/, "")}`)) && placeWord(3, true) === "=3rd" && placeWord(5) === "5th";
    return { pass, detail: fmt({ value: mine, place: r.targetRank, recomputed: above + 1, sharedWith: same, tied: String(r.targetTied), note: r.note }) };
  },
  async admSexFilter() {
    // 0.8 audit fixes (6): every Admissions view is either split by the girls/boys filter throughout or
    // says it isn't; the split views' figures are girls' (or boys') at every point.
    const { ADM_SEX_FILTER } = await import("../src/catalogue/admissions");
    const { DATAVIEWS } = await import("../src/catalogue/dataviews");
    const { ADMISSIONS_NOTES } = await import("../src/catalogue/notes");
    const v = await import("../src/lib/admissions/views-api");
    const fs = await import("node:fs");
    const ids = DATAVIEWS.filter((d) => d.id.startsWith("DV-ADM-")).map((d) => d.id).sort();
    const registry = ids.join() === Object.keys(ADM_SEX_FILTER).sort().join();
    const today = new Date("2026-10-12");
    const ep = v.entryPoint("11+")!;
    const [all, girls, mAll, mGirls] = await Promise.all([v.pipelineView("137625", ep, [], { today }), v.pipelineView("137625", ep, [], { today, sex: "female" }), v.marketView("137625", ep, []), v.marketView("137625", ep, [], { sex: "female" })]);
    if ("empty" in all || "empty" in girls) return { pass: false, detail: "empty" };
    const now = { tiles: girls.now.cohort === all.now.girls && girls.now.cohort !== all.now.cohort && (girls.now.roll ?? 0) < (all.now.roll ?? 0), trend: girls.now.series.every((s, i) => s.cohort === all.now.series[i].female) };
    const sumOf = (rows: { pupils: number | null }[]) => rows.reduce((t, r) => t + (r.pupils ?? 0), 0);
    const feeders = { split: sumOf(girls.feederTable.rows) > 0 && sumOf(girls.feederTable.rows) < sumOf(all.feederTable.rows) };
    const me = (m: typeof mAll, u: string) => m.extras.find((e) => e.urn === u)!;
    const market = { roll: (me(mGirls, "137625").roll ?? 0) < (me(mAll, "137625").roll ?? 0), momentumWhole: mGirls.extras.every((e) => e.entryChangePctAll === me(mAll, e.urn).entryChangePctAll) };
    const src = fs.readFileSync("src/components/admissions/AdmissionsDashboard.tsx", "utf8");
    const notes = { said: !!ADMISSIONS_NOTES.notSplitBySex && !!ADMISSIONS_NOTES.poolAreaNotSplit && /withSexNote\(dv, c, notesOf\(dv, c\)\)/.test(src), poolHidden: /la=\{lines\.has\("la"\) && c\.filters\.sex === "all"\}/.test(src) };
    const parts = { registry, ...now, ...feeders, ...market, ...notes };
    return { pass: Object.values(parts).every(Boolean), detail: fmt({ ...Object.fromEntries(Object.entries(parts).map(([k, x]) => [k, String(x)])), notSplit: Object.entries(ADM_SEX_FILTER).filter(([, x]) => x === "not-split").map(([k]) => k.replace("DV-ADM-", "")).join(" ") }) };
  },
  async admFamilyPupils({ ref }) {
    const v = await import("../src/lib/admissions/views-api");
    const p = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today: new Date("2026-10-12") });
    if ("empty" in p) return { pass: false, detail: "empty" };
    const facts = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: ["137625"], breakdowns: ["full_time_female_aged_11", "full_time_male_aged_11"] });
    const at = (b: string, y: number) => facts.find((f) => f.breakdown === b && f.period === y)?.value_numeric ?? null;
    const raw = { girls: at("full_time_female_aged_11", 2025), boys: at("full_time_male_aged_11", 2025), base: (at("full_time_female_aged_11", 2019) ?? 0) + (at("full_time_male_aged_11", 2019) ?? 0) };
    const n = p.now;
    return { pass: n.girls === raw.girls && n.boys === raw.boys && n.cohort === (raw.girls ?? 0) + (raw.boys ?? 0) && n.base.cohort === raw.base, detail: fmt({ cohort: n.cohort, girls: n.girls, boys: n.boys, base2019: n.base.cohort, rawBase: raw.base }) };
  },
  async admFamilyPipeline() {
    const v = await import("../src/lib/admissions/views-api");
    const { buildPipeline } = await import("../src/lib/admissions/pipeline");
    const ep = v.entryPoint("11+")!;
    const today = new Date("2026-10-12");
    const [screen, r1] = await Promise.all([v.pipelineView("137625", ep, [], { today }), buildPipeline("137625", ep, { today })]);
    if ("empty" in screen) return { pass: false, detail: "empty" };
    const same = (k: "ladder" | "hold" | "change" | "sets" | "blend") => JSON.stringify(screen[k]) === JSON.stringify(r1[k]);
    const keys = ["ladder", "hold", "change", "sets", "blend"] as const;
    return { pass: keys.every(same), detail: fmt({ ...Object.fromEntries(keys.map((k) => [k, same(k)])), pool2025: round(screen.ladder.past.find((x) => x.entryYear === 2025)?.pool ?? null, 0) }) };
  },
  async admFamilyMarket() {
    const v = await import("../src/lib/admissions/views-api");
    const { buildMarketShare } = await import("../src/lib/admissions/market");
    const ep = v.entryPoint("11+")!;
    const [screen, r1] = await Promise.all([v.marketView("117037", ep, []), buildMarketShare("117037", ep)]);
    const k = screen.entryAge.rows.find((r) => r.urn === "117037" && r.period === 2025);
    return { pass: JSON.stringify(screen.entryAge) === JSON.stringify(r1.entryAge) && JSON.stringify(screen.ageBand) === JSON.stringify(r1.ageBand) && near(k?.share ?? null, 6.6, 0.01) && screen.entryAge.totals[2025] === 1531, detail: fmt({ share2025: round(k?.share ?? null, 2), total2025: screen.entryAge.totals[2025], rivals: screen.rivals.length }) };
  },
  async admFamilyRivals({ ref }) {
    const v = await import("../src/lib/admissions/views-api");
    const r = await v.rivalsView("137625", v.entryPoint("11+")!, []);
    const rows = await ref.lookupAcademicHeadline({ entityIds: ["137625"], ksStage: "ks4" });
    const a8 = (y: number) => {
      const m = rows.find((x) => x.period === y)?.measures.attainment8_average;
      return m === undefined || m === null ? null : Number(m);
    };
    const mine = r.resultsChange["137625"];
    const expected = a8(r.resultsPeriod!)! - a8(2022)!;
    const igcse = r.rows.filter((x) => x.results.note === "igcse_not_ranked").every((x) => r.resultsChange[x.urn].points === null);
    return { pass: near(mine.points, expected, 1e-9) && igcse, detail: fmt({ from: mine.from, to: mine.to, points: round(mine.points, 2), igcseNull: igcse }) };
  },
  async admViewNow({ ref }) {
    const v = await import("../src/lib/admissions/views-api");
    const p = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today: new Date("2026-10-12") });
    if ("empty" in p) return { pass: false, detail: "empty" };
    const facts = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: ["137625"], breakdowns: ["boarders_total", "boarders_male", "boarders_female"], periodMin: 2025, periodMax: 2025 });
    const total = facts.find((f) => f.breakdown === "boarders_total")?.value_numeric ?? null;
    const raw = total ?? (facts.length ? facts.reduce((a, f) => a + (f.value_numeric ?? 0), 0) : null);
    const n = p.now;
    const src = (await import("node:fs")).readFileSync(path.join(ROOT, "src/components/admissions/panels/EntryNow.tsx"), "utf8");
    return { pass: (n.girls ?? 0) + (n.boys ?? 0) === n.cohort && n.boarders === raw && /PhaseBadgeRow|SIZE_BADGES|BADGE_ORDER/.test(src) && !/\b(tiny|huge|big school|small school)\b/i.test(src), detail: fmt({ cohort: n.cohort, girls: n.girls, boys: n.boys, boarders: n.boarders, roll: n.roll, rawBoarders: raw }) };
  },
  async admViewPipeline() {
    const v = await import("../src/lib/admissions/views-api");
    const ep = v.entryPoint("11+")!;
    const off = await v.pipelineView("137625", ep, [], { today: new Date("2026-10-12") });
    const on = await v.pipelineView("137625", ep, [], { today: new Date("2026-10-12"), projection: true });
    if ("empty" in off || "empty" in on) return { pass: false, detail: "empty" };
    const sources = new Set(off.ladder.future.map((x) => x.source));
    const src = (await import("node:fs")).readFileSync(path.join(ROOT, "src/components/admissions/views/PipelineChart.tsx"), "utf8");
    const usesNotes = /ADMISSIONS_NOTES|notes\.(counted|births|projection|pool)/.test(src);
    const pass = [...sources].every((s) => ["counted", "births", "projection"].includes(s)) && off.ladder.projection.length === 0 && on.ladder.projection.length > 0 && off.ladder.past.every((x) => x.source === "counted") && usesNotes && !/look\.(certainty|dash|solid)/.test(src);
    return { pass, detail: fmt({ sources: [...sources].join("/"), projectionOff: off.ladder.projection.length, projectionOn: on.ladder.projection.length, usesNotes }) };
  },
  // ------------------------------------------------------------------ 0.8 Admissions feedback round 1
  // R-ADM-VIEW-INTAKE-CHANGE: the split recomputed from area_context and the census, by hand (F-31: two
  // steps, local cohort x share, and the cohort step's "of which").
  async admIntakeChange() {
    const v = await import("../src/lib/admissions/views-api");
    const { areaContext } = await import("../src/lib/smt/area-data");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const F = await import("../src/components/admissions/views/Funnel");
    const today = new Date("2026-10-29");
    const out: string[] = [];
    let pass = true;
    const check = async (urn: string, entry: string, wantKm: number, wantBirthsAge: number, wantVerb?: string) => {
      const ep = v.entryPoint(entry)!;
      const p = await v.pipelineView(urn, ep, [], { today, catchment: { savedKm: null } });
      if ("empty" in p || p.intake.status !== "ok") { pass = false; out.push(`${urn} ${entry}: no split`); return; }
      const x = p.intake;
      const ctx = (await areaContext(urn, wantKm))!;
      const at = (mid: number, age: number) => ctx.years.find((y) => y.year === mid)!.children[age];
      const t = (await cachedCensus([urn])).get(urn)!.table;
      const A = ep.age;
      const end = (E: number) => ({ here: at(E - A + wantBirthsAge, wantBirthsAge), area: at(E - 1, A - 1), school: cohortAt(t, A, E)! });
      const b0 = end(x.baseYear);
      const b1 = end(x.latestYear);
      const L = (b1.school - b0.school) / (Math.log(b1.school) - Math.log(b0.school));
      const parts = [L * Math.log(b1.area / b0.area), L * Math.log(b1.school / b1.area / (b0.school / b0.area))];
      const sum = x.split.parts.reduce((a, q) => a + q.value, 0);
      const o = x.split.ofWhich;
      const dHere = b1.here - b0.here;
      const dMoved = b1.area - b1.here - (b0.area - b0.here);
      const ofOk = !!o && o.here + o.moved === x.split.parts[0].value && Math.abs(o.exactHere - (parts[0] * dHere) / (dHere + dMoved)) < 1e-9 && Math.abs(o.exactMoved - (parts[0] * dMoved) / (dHere + dMoved)) < 1e-9;
      const m = F.movedAt(x)!;
      const verbOk = !wantVerb || F.movedVerb(m) === wantVerb;
      const sumOk = F.intakeSum(x) === `${x.split.start}${x.split.parts.map((q) => (q.value < 0 ? ` − ${-q.value}` : ` + ${q.value}`)).join("")} = ${x.split.end}`;
      const ok = x.area.km === wantKm && x.birthsAge === wantBirthsAge && !x.averaged && JSON.stringify(x.ends.base) === JSON.stringify(b0) && sum === x.split.change && x.split.parts.every((q, i) => Math.abs(q.exact - parts[i]) < 1e-9 && Math.abs(q.value - parts[i]) < 1) && ofOk && verbOk && sumOk;
      pass &&= ok;
      out.push(`${urn} ${entry} ${x.area.km} km: ${F.intakeSum(x)} (of which here ${o?.here}, ${F.movedVerb(m)} ${o?.moved}; earliest age ${x.birthsAge}) ${ok ? "ok" : "MISMATCH"}`);
    };
    await check("110110", "11+", 15, 3);
    await check("110110", "16+", 15, 8);
    await check("137625", "11+", 12, 3);
    await check("102787", "11+", 2, 3, "moved out");
    // 4+: none; and a saved feeder list changes nothing.
    const four = await v.pipelineView("115786", v.entryPoint("4+")!, [], { today, catchment: { savedKm: null } });
    const listed = await v.pipelineView("110110", v.entryPoint("11+")!, [{ kind: "day_feeders", rung: null, members: ["109982", "109985"], la_blend: null, confirmed: true }], { today, catchment: { savedKm: null } });
    const plain = await v.pipelineView("110110", v.entryPoint("11+")!, [], { today, catchment: { savedKm: null } });
    const noFour = !("empty" in four) && four.intake.status === "none";
    const listsIgnored = !("empty" in listed) && !("empty" in plain) && JSON.stringify(listed.intake) === JSON.stringify(plain.intake);
    pass &&= noFour && listsIgnored;
    return { pass, detail: `${out.join("; ")}; 4+ none ${noFour}; lists ignored ${listsIgnored}` };
  },
  // R-ADM-VIEW-LOCAL-BIRTHS: the catchment's age 0 equals area_context's; the region and England are the sums.
  async admLocalBirths() {
    const v = await import("../src/lib/admissions/views-api");
    const { areaContext, englandPopulation } = await import("../src/lib/smt/area-data");
    const p = await v.pipelineView("110110", v.entryPoint("11+")!, [], { catchment: { savedKm: null } });
    const p16 = await v.pipelineView("110110", v.entryPoint("16+")!, [], { catchment: { savedKm: null } });
    if ("empty" in p || "empty" in p16 || p.localBirths.status !== "ok" || p16.localBirths.status !== "ok") return { pass: false, detail: "no view" };
    const b = p.localBirths;
    const ctx = (await areaContext("110110", b.area.km))!;
    const en = await englandPopulation();
    const catchmentOk = b.rows.every((r) => r.catchment === ctx.years.find((y) => y.year === r.year)!.children[0]);
    const englandOk = b.rows.every((r) => r.england === (en.get(r.year)?.[0] ?? null));
    const entryOk = b.rows.every((r) => r.entryYear === r.year + 11) && p16.localBirths.rows.every((r) => r.entryYear === r.year + 16);
    const baseOk = b.indexed.catchment.find((x) => x.year === b.base)?.value === 100;
    return { pass: catchmentOk && englandOk && entryOk && baseOk && b.regionName === "South East", detail: fmt({ km: b.area.km, region: b.regionName, base: b.base, years: `${b.rows[0].year}-${b.rows.at(-1)!.year}`, catchmentOk, englandOk, entryOk }) };
  },
  // R-ADM-CATCHMENT-RULE: the density radius recomputed from nearest_schools; SMT and the funnel agree.
  async admCatchmentRule() {
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const v = await import("../src/lib/admissions/views-api");
    const K = await import("../src/lib/smt/catchment");
    const { withDensity } = await import("../src/lib/smt/catchment-density");
    const { data } = await createServerAnonSupabaseClient().rpc("nearest_schools", { p_urn: "137625", p_limit: 400, p_relax_sector: true });
    const secs = ((data ?? []) as { establishment_type_group: string; statutory_low_age: number; statutory_high_age: number; distance_metres: number }[]).filter((c) => c.establishment_type_group !== "Independent schools" && c.statutory_low_age <= 11 && c.statutory_high_age >= 15).sort((a, b) => a.distance_metres - b.distance_metres);
    const want = Math.ceil(secs[4].distance_metres / 1000);
    const chase = (await smtCase("137625")).school;
    const lp = (await smtCase("110110")).school;
    const smtChase = K.resolveCatchment(await withDensity("137625", chase), null, null);
    const smtLp = K.resolveCatchment(await withDensity("110110", lp), null, null);
    const f = await v.pipelineView("137625", v.entryPoint("11+")!, [], { catchment: { savedKm: null } });
    const fl = await v.pipelineView("110110", v.entryPoint("11+")!, [], { catchment: { savedKm: null } });
    const funnelKm = !("empty" in f) ? f.intake.area?.km : null;
    const funnelLp = !("empty" in fl) ? fl.intake.area?.km : null;
    const how = smtChase.rule === "density" && /5 nearest state secondaries/.test(K.catchmentHowWords(smtChase, "secondary"));
    return { pass: want === 12 && smtChase.km === want && funnelKm === want && smtLp.km === 15 && funnelLp === 15 && how, detail: fmt({ fifth: (secs[4].distance_metres / 1000).toFixed(2), want, smtChase: smtChase.km, funnelChase: funnelKm, smtLp: smtLp.km, funnelLp, how }) };
  },
  // R-ADM-ENTRY-SEX: girls + boys = the cohort each year.
  async admEntrySex() {
    const v = await import("../src/lib/admissions/views-api");
    const p = await v.pipelineView("110110", v.entryPoint("11+")!, []);
    if ("empty" in p) return { pass: false, detail: "empty" };
    const s = p.now.series.filter((x) => x.cohort !== null);
    const ok = s.length >= 2 && s.every((x) => (x.female ?? 0) + (x.male ?? 0) === x.cohort);
    return { pass: ok, detail: s.map((x) => `${x.period}: ${x.female}+${x.male}=${x.cohort}`).join(", ") };
  },
  // R-ADM-ROLL-INDEXED: the average and the index recomputed from the band rows.
  async admRollIndexed() {
    const v = await import("../src/lib/admissions/views-api");
    const m = await v.marketView("110110", v.entryPoint("11+")!, []);
    const r = m.summary.rollIndexed;
    const yrs = m.ageBand.periods;
    const cnt = (u: string, y: number) => m.ageBand.rows.find((x) => x.urn === u && x.period === y)?.count ?? null;
    const whole = m.rivals.filter((u) => yrs.every((y) => cnt(u, y) !== null));
    const avg = (y: number) => whole.reduce((t, u) => t + cnt(u, y)!, 0) / whole.length;
    const b = r.base!;
    const ok = b === 2019 && whole.length === r.averageOf && yrs.every((y, i) => Math.abs((r.average[i].value ?? NaN) - (100 * avg(y)) / avg(b)) < 1e-9 && Math.abs((r.mine[i].value ?? NaN) - (100 * cnt("110110", y)!) / cnt("110110", b)!) < 1e-9) && r.rivals.length === m.rivals.length;
    return { pass: ok, detail: fmt({ base: b, averageOf: r.averageOf, rivals: r.rivals.length, mineLatest: round(r.mine.at(-1)?.value), avgLatest: round(r.average.at(-1)?.value) }) };
  },
  // R-ADM-VS-EACH: You and the rivals in full screen, rendered on the server from the route's answer: a key
  // entry per rival drawn, each small rival named, each line recomputed from the entry-age rows; the panel
  // keeps the average; the band roll and this view share YouAndEachRival (source scan).
  async admVsEach() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const fs = await import("node:fs");
    const v = await import("../src/lib/admissions/views-api");
    const { VsRivals } = await import("../src/components/admissions/views/Lines");
    const { InitialWidth } = await import("../src/components/admissions/views/charts");
    const { ROLL_INDEX_MIN } = await import("../src/lib/index-base");
    const m = await v.marketView("110110", v.entryPoint("11+")!, []);
    const draw = (fullscreen: boolean) => renderToStaticMarkup(createElement(InitialWidth.Provider, { value: 900 }, createElement(VsRivals, { m, setLabel: "10 nearest", as: "line", fullscreen, room: 600 })));
    const [full, panel] = [draw(true), draw(false)];
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const cnt = (u: string, y: number) => m.entryAge.rows.find((r) => r.urn === u && r.period === y)?.count ?? null;
    const b = m.summary.vsIndexed.base!;
    const yrs = m.entryAge.periods;
    const each = m.rivals.map((u) => {
      const from = cnt(u, b) !== null ? b : yrs.find((y) => cnt(u, y) !== null) ?? null;
      const base = from === null ? null : cnt(u, from);
      return { u, name: m.schools[u]?.name ?? u, small: (base ?? 0) < ROLL_INDEX_MIN, last: base ? (100 * (cnt(u, yrs.at(-1)!) ?? NaN)) / base : null };
    });
    const key = full.split("data-vs-key")[1]?.split("</div>")[0] ?? "";
    const note = full.split("data-vs-small")[1]?.split("</span>")[0] ?? "";
    const drawn = each.filter((x) => !x.small);
    const { yearLabel } = await import("../src/components/admissions/ui");
    const titles = drawn.every((x) => x.last === null || !Number.isFinite(x.last) || full.includes(`${esc(x.name)} ${yearLabel(yrs.at(-1)!)}: ${x.last.toFixed(0)}`));
    // 0.8 Sets r1 (F23): full screen also keys the rivals' average (you + each rival drawn + the average),
    // on this view and on the band roll's (both through YouAndEachRival).
    const avgKey = (k: string) => k.includes(">Rivals&#x27; average</span>");
    const keyed = drawn.every((x) => key.includes(`>${esc(x.name)}</span>`)) && (key.match(/<span class="inline-flex/g) ?? []).length === drawn.length + 2 && avgKey(key);
    const { RollTrend } = await import("../src/components/admissions/views/Lines");
    const rollFull = renderToStaticMarkup(createElement(InitialWidth.Provider, { value: 900 }, createElement(RollTrend, { m, fullscreen: true, room: 600 })));
    const rollAvg = avgKey(rollFull.split("data-roll-key")[1]?.split("</div>")[0] ?? "");
    const named = each.filter((x) => x.small).every((x) => note.includes(esc(x.name)) && !key.includes(`>${esc(x.name)}</span>`));
    const lines = fs.readFileSync(path.join(ROOT, "src/components/admissions/views/Lines.tsx"), "utf8");
    const fn = (n: string) => lines.split(`export function ${n}(`)[1]?.split("\nexport function ")[0] ?? "";
    const shared = ["RollTrend", "VsRivals"].every((n) => fn(n).includes("<YouAndEachRival")) && (lines.match(/var\(--adm-series-\$\{/g) ?? []).length === 1;
    const panelOk = panel.includes("Rivals’ average") && !panel.includes("data-vs-key") && !panel.includes("data-y-grid") && !panel.includes("--adm-series-");
    const ok = keyed && rollAvg && named && titles && shared && panelOk && full.includes("data-y-grid");
    return { pass: ok, detail: fmt({ base: b, drawn: drawn.length, small: each.filter((x) => x.small).map((x) => x.name).join("; "), keyed, rollAvg, named, titles, shared, panelOk }) };
  },
  // R-ADM-BAND-SHARE: the band share recomputed; the rail's last view.
  async admBandShare() {
    const v = await import("../src/lib/admissions/views-api");
    const { ADMISSIONS_DASHBOARDS } = await import("../src/catalogue/dashboards/admissions");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const m = await v.marketView("110110", v.entryPoint("11+")!, []);
    const census = await cachedCensus([m.urn, ...m.rivals]);
    const band = (u: string, y: number) => [11, 12, 13, 14, 15].reduce<number | null>((t, a) => { const c = cohortAt(census.get(u)?.table ?? new Map(), a, y); return c === null ? t : (t ?? 0) + c; }, null);
    const y = Math.max(...m.ageBand.periods);
    const total = [m.urn, ...m.rivals].reduce((t, u) => t + (band(u, y) ?? 0), 0);
    const share = m.ageBand.rows.find((r) => r.urn === m.urn && r.period === y)!.share!;
    const rail = ADMISSIONS_DASHBOARDS[1].panels.find((p) => p.id.endsWith("c3.trends"))!.dataviews.map((d) => (d.kind === "view" ? d.dataview : ""));
    const ok = Math.abs(share - (100 * band(m.urn, y)!) / total) < 1e-9 && rail.at(-1) === "DV-ADM-M-SHARE-BAND";
    return { pass: ok, detail: fmt({ year: y, share: round(share, 2), last: rail.at(-1) }) };
  },
  // R-ADM-AXIS-TICKS, R-ADM-MAP-SELF, R-ADM-FEEDER-SHAPES, R-ADM-SHAPE-ROWS, R-ADM-MOMENTUM-SCOPE: the views
  // rendered on the server from real answers (AdmissionsEveryView, as R-ADM-BOARDING-ONLY-WHERE-BOARDERS).
  async admAxisTicks() {
    const html = await admRenderAll("110110", "11+");
    const svgs = html.split("<svg").slice(1).filter((x) => x.includes("data-tick="));
    const views = [/Your Year 7 cohort, year by year/, /Your share of Years 7.11, year by year/, /Births within 15 km/];
    const each = views.map((t) => t.test(html));
    return { pass: svgs.length >= 5 && each.every(Boolean) && html.includes("data-tick-middle"), detail: fmt({ chartsWithTicks: svgs.length, views: each.join("/") }) };
  },
  async admMapSelf() {
    const v = await import("../src/lib/admissions/views-api");
    const p = await v.pipelineView("110110", v.entryPoint("11+")!, []);
    if ("empty" in p) return { pass: false, detail: "empty" };
    const src = (await import("node:fs")).readFileSync(path.join(ROOT, "src/components/admissions/views/AdmissionsMap.tsx"), "utf8");
    const ok = p.school.easting !== null && p.school.northing !== null && p.now.cohort !== null && /markerOf=\{\(m\) => (\(|\{\s*if \()m\.urn === p\.school\.urn/.test(src) && /roll: p\.now\.cohort/.test(src);
    return { pass: ok, detail: fmt({ easting: p.school.easting, northing: p.school.northing, cohort: p.now.cohort }) };
  },
  async admFeederShapes() {
    const v = await import("../src/lib/admissions/views-api");
    const s = await v.shapeView("110110", v.entryPoint("11+")!, []);
    const p = await v.pipelineView("110110", v.entryPoint("11+")!, []);
    if ("empty" in p) return { pass: false, detail: "empty" };
    const set = p.sets.find((x) => x.age === 10)!.urns.filter((u) => u !== "110110");
    const ok = s.feeders.age === 10 && JSON.stringify(s.feeders.schools.map((f) => f.urn)) === JSON.stringify(set);
    return { pass: ok, detail: fmt({ age: s.feeders.age, feeders: s.feeders.schools.length, set: set.length }) };
  },
  async admShapeRows() {
    const html = await admRenderAll("110110", "11+");
    const rows = Array.from(html.matchAll(/data-mini-rows="(\d+)"/g)).map((m) => Number(m[1]));
    const v = await import("../src/lib/admissions/views-api");
    const s = await v.shapeView("110110", v.entryPoint("11+")!, []);
    const own = s.profile.filter((r) => r.female + r.male > 0);
    const want = own.at(-1)!.age - own[0].age + 1;
    return { pass: rows.length >= s.rivals.length && rows.slice(0, s.rivals.length).every((n) => n === want), detail: fmt({ cards: rows.length, rows: Array.from(new Set(rows)).join("/"), want }) };
  },
  // 0.8 feedback deploy gate (F-23, F-26): Pipelines' local shape at 16+ is ages 11-15 in the age-15 set; 11+ as round 1.
  async admLocalShape16() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const v = await import("../src/lib/admissions/views-api");
    const { ShapeAndSize } = await import("../src/components/admissions/views/ShapeAndSize");
    const at = async (entry: string) => {
      const ep = v.entryPoint(entry)!;
      const [s, p] = await Promise.all([v.shapeView("110110", ep, []), v.pipelineView("110110", ep, [])]);
      if ("empty" in p) throw new Error(`no pipeline at ${entry}`);
      const html = renderToStaticMarkup(createElement(ShapeAndSize, { s, entryAge: ep.age, showLocal: true, fullscreen: false, columns: 2 }));
      const local = html.slice(html.indexOf("data-local-shape"), html.indexOf("data-mini-rows"));
      const barAges = Array.from(local.matchAll(/title="Age (\d+):/g)).map((m) => Number(m[1]));
      const cardRows = Array.from(html.matchAll(/data-mini-rows="(\d+)"/g)).map((m) => Number(m[1]));
      return { s, p, html, barAges, cardRows };
    };
    const a = await at("16+");
    const set15 = a.p.sets.find((x) => x.age === 15)!.urns.filter((u) => u !== "110110");
    const profAges = a.s.localProfile.filter((r) => r.female + r.male > 0).map((r) => r.age);
    const ok16 =
      JSON.stringify(a.s.localShape.ages) === "[11,15]" &&
      a.s.localShape.kind === "secondaries" &&
      a.s.feeders.age === 15 &&
      JSON.stringify(a.s.feeders.schools.map((f) => f.urn)) === JSON.stringify(set15) &&
      a.s.localShape.schools === set15.length &&
      profAges.length > 0 && profAges.every((x) => x >= 11 && x <= 15) &&
      JSON.stringify([...a.barAges].sort((x, y) => x - y)) === "[11,12,13,14,15]" &&
      a.cardRows.length === set15.length && a.cardRows.every((n) => n === 5) &&
      a.html.includes(`All pupils aged 11&ndash;15 in the ${set15.length} nearest secondaries (schools teaching 11 to 15), together.`.replace("&ndash;", "–"));
    // 11+: round 1's -- the 15 nearest primaries (the youngest rung), ages 4 to 10, cards over 4 to 10.
    const b = await at("11+");
    const set4 = b.p.sets.find((x) => x.age === 4)!.urns;
    const ok11 =
      b.s.localShape.ages === null &&
      b.s.localShape.kind === "primaries" &&
      b.s.feeders.age === 10 &&
      b.s.localShape.schools === new Set(set4).size &&
      JSON.stringify([...b.barAges].sort((x, y) => x - y)) === "[4,5,6,7,8,9,10]" &&
      b.cardRows.every((n) => n === 7) &&
      b.html.includes(`All pupils aged 4–10 in your ${b.s.localShape.schools} feeder schools, together.`);
    return { pass: ok16 && ok11, detail: fmt({ "16+ ages": a.barAges.length ? `${Math.min(...a.barAges)}-${Math.max(...a.barAges)}` : "none", "16+ schools": a.s.localShape.schools, "16+ cards": `${a.cardRows.length}x${Array.from(new Set(a.cardRows)).join("/")}`, "11+ ages": b.barAges.length ? `${Math.min(...b.barAges)}-${Math.max(...b.barAges)}` : "none", "11+ schools": b.s.localShape.schools, "11+ cards": `${b.cardRows.length}x${Array.from(new Set(b.cardRows)).join("/")}`, ok16, ok11 }) };
  },
  async admMomentumScope() {
    const html = await admRenderAll("110110", "11+");
    return { pass: html.includes("Schools submitting GCSE results only"), detail: "11+ momentum" };
  },
  // R-ADM-MOMENTUM-IGCSE (0.8 Sets r1, F25): the 11+ results switch recomputed from the KS4 / KS5
  // headline populations and the IGCSE rule, and the panel rendered on the server from the route's answer.
  async admMomentumIgcse() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const fs = await import("node:fs");
    const v = await import("../src/lib/admissions/views-api");
    const { headlinePopulation } = await import("../src/lib/admissions/ranks");
    const { latestResults } = await import("../src/lib/admissions/rivals");
    const { igcseAmong } = await import("../src/lib/igcse");
    const { resultsMeasureFor, IGCSE_SWITCH_SHARE } = await import("../src/lib/sets/results-coverage");
    const { Momentum, momentumChips } = await import("../src/components/admissions/views/Momentum");
    const { InitialWidth } = await import("../src/components/admissions/views/charts");
    const { TREND_BASE_PERIOD } = await import("../src/catalogue/notes");
    const [k4, k5] = [await latestResults("ks4"), await latestResults("ks5")];
    const [p4, p5] = [await headlinePopulation("ks4", k4.period!), await headlinePopulation("ks5", k5.period!)];
    const ep = v.entryPoint("11+")!;
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const one = async (urn: string, members: string[] | null) => {
      const lists = members ? [{ kind: "rivals", rung: null, members, la_blend: null, confirmed: true }] : [];
      const [m, r] = await Promise.all([v.marketView(urn, ep, lists), v.rivalsView(urn, ep, lists)]);
      const rivals = r.rows.filter((x) => !x.isSchool).map((x) => x.urn);
      const ig = await igcseAmong(rivals);
      const want = resultsMeasureFor(11, rivals.map((u) => ({ urn: u, hasGcse: !ig.has(u) && p4.get(u)?.get(k4.period!) !== undefined, hasPost16: p5.get(u)?.get(k5.period!) !== undefined, igcse: ig.has(u) })));
      const got = r.momentum!;
      const same = got.measure === want.measure && got.noGcse === want.noGcse && got.noPost16 === want.noPost16 && got.of === want.of && JSON.stringify(got.leftOut.map((x) => x.urn)) === JSON.stringify(want.leftOut);
      const html = renderToStaticMarkup(createElement(InitialWidth.Provider, { value: 900 }, createElement(Momentum, { m, r, fullscreen: false })));
      const scope = html.split("data-momentum-scope")[1]?.split("</div>")[0] ?? "";
      // Each dot's y on the switched measure: the KS5 headline change since 2022/23.
      const ys = got.measure !== "post16" || r.rows.every((x) => { const a = p5.get(x.urn)?.get(TREND_BASE_PERIOD); const b = p5.get(x.urn)?.get(k5.period!); const pts = got.resultsChange[x.urn]?.points; return a === undefined || b === undefined ? pts === null : Math.abs((pts ?? NaN) - (b - a)) < 1e-9; });
      return { r, got, want, same, scope, ys, chip: momentumChips(m, r).results, html };
    };
    // Leighton Park's 11+ default set -- since sets round 1 (B8) the default recipe, "10 nearest |
    // independent" (src/lib/sets/recipes.ts), as the page's routes draw it -- whatever the rule says for
    // its real counts, drawn as the rule says.
    const { admissionsRecipes } = await import("../src/lib/sets/recipes");
    const lpDefault = (await admissionsRecipes("110110", ep, "compared_against")).find((x) => x.isDefaultChoice)!;
    const lp = await one("110110", lpDefault.urns);
    const lpLine = `Post-16 results: ${lp.got.noGcse} of ${lp.got.of} rivals have no GCSE results`;
    const lpDrawn = lp.got.switched
      ? lp.scope.includes(esc(lpLine)) && lp.chip === "Results: A-level points" && lp.ys
      : lp.got.noGcse / lp.got.of <= IGCSE_SWITCH_SHARE || lp.got.noPost16 >= lp.got.noGcse
        ? lp.got.leftOut.every((x) => lp.scope.includes(esc(x.name))) && (lp.got.leftOut.length === 0 || lp.scope.includes("Left out, no GCSE results")) && lp.scope.includes("Schools submitting GCSE results only") && lp.chip === "Results: Attainment 8"
        : false;
    const lpOk = lp.same && lpDrawn;
    // Leighton Park with a saved list of its nearby IGCSE independents and two state grammars: switches.
    const sw = await one("110110", ["110165", "110137", "110109", "110151", "134467", "136449", "136448"]);
    const line = `Post-16 results: ${sw.got.noGcse} of ${sw.got.of} rivals have no GCSE results (mostly IGCSE)`;
    const swOk = sw.same && sw.got.switched && sw.got.measure === "post16" && sw.scope.includes(esc(line)) && sw.scope.includes('data-momentum-measure="post16"') && sw.ys && sw.chip === "Results: A-level points" && sw.html.includes("A-level points per entry");
    // A state school's set (Maiden Erlegh School): stays on GCSE.
    const st = await one("136637", null);
    const stOk = st.same && st.got.measure === "gcse" && !st.got.switched;
    // 16+: nothing changes (no momentum rule; the rivals view's own post-16 results).
    const r16 = await v.rivalsView("110110", v.entryPoint("16+")!, []);
    const at16 = r16.momentum === null && r16.stage === "ks5";
    // The 40% in one place: the constant is declared once, and only results-coverage.ts holds 0.4 for it.
    const src = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
    const once = (src("src/lib/sets/results-coverage.ts").match(/IGCSE_SWITCH_SHARE = 0\.4\b/g) ?? []).length === 1 && !/resultsMeasureFor|IGCSE_SWITCH_SHARE/.test(src("src/components/admissions/views/Momentum.tsx").replace(/import[^;]+;/g, "")) && src("src/lib/admissions/views-api.ts").includes("resultsMeasureFor(");
    const pass = lpOk && swOk && stOk && at16 && once;
    const d = (x: Awaited<ReturnType<typeof one>>) => `${x.got.measure} (no GCSE ${x.got.noGcse}/${x.got.of}, ${x.got.noGcseIgcse} IGCSE; no post-16 ${x.got.noPost16}/${x.got.of}; left out: ${x.got.leftOut.map((y) => y.name).join("; ") || "none"})`;
    return { pass, detail: fmt({ leightonPark: d(lp), lpOk, saved7: d(sw), swOk, line: sw.got.switched ? line : "not switched", maidenErlegh: d(st), stOk, at16, oneConstant: once }) };
  },
  async admBoardingOnly() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const v = await import("../src/lib/admissions/views-api");
    const { fetchSchoolTraits } = await import("../src/lib/admissions/traits");
    const { AdmissionsEveryView, methodVars } = await import("../src/components/admissions/AdmissionsDashboard");
    const { METHODS, methodOf, methodText } = await import("../src/catalogue/methods");
    const { Setup } = await import("../src/components/admissions/setup/Setup");
    const { OpenInFullscreen } = await import("../src/components/teacher/CardBox");
    // Setup's "add by name" (SchoolSearch) reads the app router: a do-nothing one for a server render.
    const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
    const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
    const withRouter = (el: ReturnType<typeof createElement>) => createElement(AppRouterContext.Provider, { value: router as never }, el);
    const today = new Date("2026-10-12");
    // Any word about boarding, or the day-only wording that implies it. ("dashboard" doesn't match.)
    const BOARD = /\b(boarding|boarders?|boards|ISC)\b|day only|day and boarding|day \+ boarding/i;
    const member = (urn: string) => ({ userId: "", token: "", membershipId: "m", schoolAccountId: "a", schoolUrn: urn, schoolName: urn, roles: ["admissions"], isAdmin: false, isAccountHolder: false, lead: true, access: "lead" as const, canEditLists: true, override: false, canShare: true, canManageTeam: true, readOnly: false, viewAs: null, leadColumn: true });
    const out: string[] = [];
    let pass = true;
    const run = async (urn: string, entry: string) => {
      const ep = v.entryPoint(entry)!;
      const t = (await fetchSchoolTraits([urn])).get(urn)!;
      const boarding = t.boarding;
      const [p, m, r, s] = await Promise.all([v.pipelineView(urn, ep, [], { today }), v.marketView(urn, ep, []), v.rivalsView(urn, ep, []), v.shapeView(urn, ep, [])]);
      const html = renderToStaticMarkup(createElement(OpenInFullscreen.Provider, { value: true }, createElement(AdmissionsEveryView, { member: member(urn), boardingSchool: boarding, entry: ep.id, pipeline: p, market: m, rivals: r, shape: s, lists: null })));
      const chunks = html.split(/(?=<div data-adm-(?:filters|dash)=)/).filter((c) => c.startsWith("<div data-adm-"));
      const own = chunks.filter((c) => c.startsWith('<div data-adm-filters') || c.startsWith('<div data-adm-dash="pipelines"'));
      const market = chunks.filter((c) => c.startsWith('<div data-adm-dash="market-share"'));
      const setup = ["entry", "day", "boarding", "rivals"].map((step) => renderToStaticMarkup(withRouter(createElement(Setup, { member: member(urn), step: step as "entry", entry: ep.id, lists: null, ages: { low: t.low, high: t.high, boarding }, theme: "dark", onStep: () => undefined, onDone: () => undefined, onSkip: () => undefined }))));
      const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
      // 0.7 admissions editor s2: the editor's 1 · Data for each feeder view, previewing this school.
      const { AdmissionsDataStep } = await import("../src/components/view-editor/AdmissionsSteps");
      const { presetSpec } = await import("../src/catalogue/viewspec");
      const { ADMISSIONS_VIEW_COMPARE } = await import("../src/catalogue/admissions-editor");
      const editor = Object.entries(ADMISSIONS_VIEW_COMPARE)
        .filter(([, o]) => o?.feeders)
        .map(([dv]) =>
          renderToStaticMarkup(
            createElement(AdmissionsDataStep, { draft: { spec: presetSpec(dv as `DV-${string}`), ticks: [], title: null }, set: () => undefined, env: { phase: "ks4", columnHost: "admissions.pipelines", side: dv.includes("-HOLD") || dv.includes("-POOL") ? "trend" : "current", measure: "entries", followsPill: false, ctx: {} as never, admissions: { family: presetSpec(dv as `DV-${string}`).data.source } }, wide: true, school: { urn, name: urn }, dataview: dv as `DV-${string}`, boardingSchool: boarding }),
          ),
        );
      const editorOk = boarding ? editor.every((h) => /Boarding feeders/.test(text(h))) : editor.every((h) => !BOARD.test(text(h)));
      // 0.8 Sets r1 (F24): every Admissions view's (i) as the host fills it (methodVars: the view's
      // placeholders and the school's boarding flag): its notes and its method's text.
      const host = { boardingSchool: boarding, pipeline: { status: "ready" as const, data: p }, market: { status: "ready" as const, data: m } };
      const iText = (dv: string) => { const x = methodOf(dv, methodVars(dv, host as never))!; return [...(x.notes ?? []), methodText(x)].join("\n"); };
      const admDvs = Object.keys(METHODS).filter((d) => d.startsWith("DV-ADM-"));
      if (!boarding) {
        const leaks = [...own, ...setup].map(text).filter((x) => BOARD.test(x)).map((x) => x.match(BOARD)![0]);
        const marketControls = market.map(text).some((x) => /Rivals with boarders|Boarding only/.test(x));
        const tile = !/data-pair="Boarding"/.test(html) && />Day</.test(html);
        // The server ignores a boarding filter for a day school: the same pool as with none.
        const asked = await v.pipelineView(urn, ep, [], { today, filters: { lists: "boarding", sector: "all", boardingOnly: false } });
        const ignored = !("empty" in asked) && !("empty" in p) && JSON.stringify(asked.ladder) === JSON.stringify(p.ladder);
        const steps = /Step 1 of 3/.test(setup[0]) && /Step 3 of 3/.test(setup[3]) && /Step 2 of 3/.test(setup[2]);
        // A day school's (i): no boarding words, but the rivals' own figures may still say they board
        // (Market share's GIAS traits and the group line's count of schools with boarding).
        const RIVALS_BOARD = [/nearest schools, sector, boarding, gender, location/g, /independent, state and boarding \(your school included/g];
        const iLeaks = admDvs.filter((d) => BOARD.test(RIVALS_BOARD.reduce((t, r) => t.replace(r, ""), iText(d))));
        // 0.8 sets round 1 (B8, B11): the boarding choice is a set now; a day school's menu offers none.
        const { admissionsRecipes } = await import("../src/lib/sets/recipes");
        const dayRecipes = [...(await admissionsRecipes(urn, ep, "compared_against")), ...(await admissionsRecipes(urn, ep, "feeders"))];
        const noBoardingSets = !dayRecipes.some((x) => BOARD.test(x.name) || x.audience === "boarding");
        const ok = leaks.length === 0 && iLeaks.length === 0 && !marketControls && tile && ignored && steps && editorOk && noBoardingSets;
        pass &&= ok;
        out.push(`${urn} ${entry} day: no boarding sets offered ${noBoardingSets}, ${chunks.length} surfaces + 4 setup steps + ${editor.length} editor Data steps, boarding words ${leaks.length}${leaks.length ? ` (${leaks.slice(0, 3).join(", ")})` : ""}, (i)s with boarding words ${iLeaks.length}/${admDvs.length}${iLeaks.length ? ` (${iLeaks.slice(0, 3).join(", ")})` : ""}, market controls ${marketControls}, Day-only tile ${tile}, filter ignored ${ignored}, steps 1-3 ${steps}, editor compare without boarding ${editorOk} ${ok ? "ok" : "FAIL"}`);
      } else {
        const T = text(html);
        // 0.8 sets round 1 (B8, B11): the old Day + boarding filter is a choice of set: the menu's Default
        // block offers "10 nearest | boarding" and the Boarding feeder sets for a boarding school.
        const { admissionsRecipes } = await import("../src/lib/sets/recipes");
        const rec = [...(await admissionsRecipes(urn, ep, "compared_against")), ...(await admissionsRecipes(urn, ep, "feeders"))];
        const filters = rec.some((x) => x.key === "adm:nearest-boarding") && rec.some((x) => x.audience === "boarding");
        // 0.8 SMT feedback round 1 (F-1): the tile is a PairTile, each figure boxed with its own label.
        const tile = /data-pair="Day"/.test(html) && /data-pair="Boarding"/.test(html);
        // Admissions feedback round 2 (F-31): the ISC note left the intake chart for its (i) (DV-ADM-P-FUNNEL's
        // notes); it shows in the pipeline itself or in that (i). 0.8 Sets r1 (F24): read as the host fills
        // the (i) for this boarding school, with the intake's boarding caveat beside it.
        const funnelI = iText("DV-ADM-P-FUNNEL");
        const iscInI = /International boarders/.test(funnelI) && /Boarding schools draw from far beyond any radius/.test(funnelI);
        const isc = ep.age > 4 ? /International boarders/.test(T) || iscInI : true;
        const setupOk = /Day and boarding/.test(text(setup[0])) && /Your boarding feeders/.test(text(setup[2])) && /Step 3 of 4/.test(setup[2]) && /Step 4 of 4/.test(setup[3]) && /Boarding only/.test(text(setup[3]));
        // The boarding feeder list end to end: setup's search returns independent preps, day or boarding
        // (0.8 sets round 1, B8: no longer boarding-only), kept as a fuzzy set, and Boarding only draws
        // the pool from them.
        const cand = await v.candidatesView(urn, ep, new URLSearchParams({ kind: "boarding", mode: "nearest", n: "40" }));
        const preps = cand.rows.filter((x) => x.sector === "independent");
        const bp = await v.pipelineView(urn, ep, [{ kind: "boarding_feeders", rung: null, members: preps.map((x) => x.urn), la_blend: null, confirmed: true }], { today, filters: { lists: "boarding", sector: "all", boardingOnly: false } });
        const used = !("empty" in bp) && bp.sets.some((x) => x.urns.some((u) => preps.some((pp) => pp.urn === u)));
        const ok = filters && tile && isc && setupOk && preps.length > 0 && preps.length === cand.rows.length && preps.some((x) => x.boarding) && used && editorOk;
        pass &&= ok;
        out.push(`${urn} ${entry} boarding: boarding sets in the menu ${filters}, day or boarding preps ${preps.filter((x) => !x.boarding).length} day + ${preps.filter((x) => x.boarding).length} boarding, tile ${tile}, ISC note ${isc}, setup 1-4 ${setupOk}, boarding preps ${preps.length}/${cand.rows.length}, boarding-only pool from them ${used}, editor's feeder chips on ${editor.length} views ${editorOk} ${ok ? "ok" : "FAIL"}`);
      }
    };
    await run("137625", "11+");
    await run("137625", "16+");
    await run("137051", "11+");
    await run("115786", "4+");
    await run("115786", "11+");
    return { pass, detail: out.join("; ") };
  },
  async admEditorLooks() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const v = await import("../src/lib/admissions/views-api");
    const { fetchSchoolTraits } = await import("../src/lib/admissions/traits");
    const { AdmissionsOneView } = await import("../src/components/admissions/AdmissionsDashboard");
    const { InitialWidth } = await import("../src/components/admissions/views/charts");
    const { ADMISSIONS_LOOKS, ADMISSIONS_VIEW_COMPARE, compareOf } = await import("../src/catalogue/admissions-editor");
    const { ADMISSIONS_NOTES } = await import("../src/catalogue/notes");
    const { ADMISSIONS_DASHBOARDS } = await import("../src/catalogue/dashboards/admissions");
    const { presetSpec } = await import("../src/catalogue/viewspec");
    const { showsOnState } = await import("../src/catalogue/variants");
    const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
    const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
    const today = new Date("2026-10-12");
    const BOARD = /\b(boarding|boarders?|boards|ISC)\b|day only|day and boarding|day \+ boarding/i;
    const member = (urn: string) => ({ userId: "", token: "", membershipId: "m", schoolAccountId: "a", schoolUrn: urn, schoolName: urn, roles: ["admissions"], isAdmin: false, isAccountHolder: false, lead: true, access: "lead" as const, canEditLists: true, override: false, canShare: true, canManageTeam: true, readOnly: false, viewAs: null, leadColumn: true });
    const decode = (h: string) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    // Every ADMISSIONS_NOTES line the render carries (in text or a hover title).
    const notesIn = (h: string) => { const t = decode(h); return Object.entries(ADMISSIONS_NOTES).filter(([, n]) => typeof n === "string" && n.length > 12 && t.includes(n)).map(([k]) => k); };
    const views = [...new Set(ADMISSIONS_DASHBOARDS.flatMap((d) => d.panels.flatMap((p) => p.dataviews.flatMap((x) => (x.kind === "view" ? [x.dataview] : []))))), "DV-ADM-M-FLAGS" as const];
    // A map draws in the browser only (Leaflet): its colour look is checked in the preview harness.
    const browserOnly = new Set(["DV-ADM-P-MAP/colour", "DV-ADM-M-MAP/colour"]);
    const effect = new Map<string, boolean>();
    const out: string[] = [];
    let pass = true;
    const run = async (urn: string, entry: string) => {
      const ep = v.entryPoint(entry)!;
      const boarding = (await fetchSchoolTraits([urn])).get(urn)!.boarding;
      const [p, m, r, sh] = await Promise.all([v.pipelineView(urn, ep, [], { today }), v.marketView(urn, ep, []), v.rivalsView(urn, ep, []), v.shapeView(urn, ep, [])]);
      const render = (dv: string, spec?: ReturnType<typeof presetSpec>) =>
        renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(InitialWidth.Provider, { value: 880 }, createElement(AdmissionsOneView, { member: member(urn), boardingSchool: boarding, entry: ep.id, pipeline: p, market: m, rivals: r, shape: sh, dv, spec }))));
      let renders = 0, lost = 0, notDefault = 0, boardLeak = 0;
      const lostWhat: string[] = [];
      for (const dv of views) {
        const preset = presetSpec(dv);
        if (!showsOnState({ kind: "view", id: dv, dataview: dv, spec: preset }, { entryPoint: ep.id as "4+" })) continue;
        const base = render(dv, preset);
        const want = notesIn(base);
        // Defaults draw the preset: no spec, and the preset's own spec, are the same render.
        if (render(dv) !== base) { notDefault++; lostWhat.push(`${dv} default`); }
        renders += 2;
        const variants: { key: string; spec: typeof preset }[] = [];
        for (const o of ADMISSIONS_LOOKS[dv] ?? []) {
          const values = o.choices === "tick" ? [!o.fallback] : o.choices.map((c) => c.value).filter((x) => x !== o.fallback);
          for (const val of values) variants.push({ key: `${dv}/${o.key}=${val}`, spec: { ...preset, view: { ...preset.view, look: { ...(preset.view.look as object), [o.key]: val } } as typeof preset.view } });
        }
        const opts = ADMISSIONS_VIEW_COMPARE[dv];
        for (const l of opts?.lines ?? []) variants.push({ key: `${dv}/${l.kind}=off`, spec: { ...preset, compare: compareOf({ feeders: "page", lines: new Set((opts!.lines ?? []).map((x) => x.kind).filter((k) => k !== l.kind)) }, opts) } });
        for (const x of variants) {
          const h = render(dv, x.spec);
          renders++;
          const miss = want.filter((n) => !notesIn(h).includes(n));
          if (miss.length) { lost++; lostWhat.push(`${x.key} drops ${miss.join(",")}`); }
          const k = x.key.split("=")[0] + "=" + x.key.split("=")[1];
          effect.set(k, (effect.get(k) ?? false) || h !== base);
        }
        // A day school asked for boarding feeders draws its preset, with no boarding words.
        if (opts?.feeders && !boarding) {
          for (const f of ["boarding", "both"] as const) {
            const h = render(dv, { ...preset, compare: compareOf({ feeders: f, lines: new Set((opts.lines ?? []).map((x) => x.kind)) }, opts) });
            renders++;
            if (h !== base || BOARD.test(h.replace(/<[^>]+>/g, " "))) { boardLeak++; lostWhat.push(`${dv} feeders=${f} on a day school`); }
          }
        }
      }
      const ok = lost === 0 && notDefault === 0 && boardLeak === 0;
      pass &&= ok;
      out.push(`${urn} ${entry}${boarding ? " (boarding)" : ""}: ${renders} renders, notes lost ${lost}, defaults not the preset ${notDefault}, boarding leaks ${boardLeak}${lostWhat.length ? ` [${lostWhat.slice(0, 4).join("; ")}]` : ""} ${ok ? "ok" : "FAIL"}`);
    };
    await run("137625", "11+");
    await run("137625", "16+");
    await run("117037", "11+");
    await run("115786", "11+");
    // Every option offered changes the drawing somewhere (Guy's decision 1: no control without an effect).
    const idle = [...effect.entries()].filter(([k, e]) => !e && !browserOnly.has(k.split("=")[0])).map(([k]) => k);
    pass &&= idle.length === 0;
    out.push(`options ${effect.size}, without an effect in any case: ${idle.length ? idle.join(", ") : "none"} (map colours checked in the browser)`);
    return { pass, detail: out.join("; ") };
  },
  async admViewFeeders() {
    const v = await import("../src/lib/admissions/views-api");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { feederFlags } = await import("../src/lib/admissions/feeders");
    const p = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today: new Date("2026-10-12") });
    if ("empty" in p) return { pass: false, detail: "empty" };
    const urns = p.feederTable.rows.map((r) => r.urn);
    const census = await cachedCensus(urns);
    const ref = feederFlags(new Map(urns.map((u) => [u, census.get(u)!.table])), [10], 2025, 10);
    const same = p.feederTable.rows.every((r) => (ref.find((x) => x.urn === r.urn)?.flag?.id ?? null) === (r.flag?.id ?? null));
    const area = (p.feederTable.area.to - p.feederTable.area.from) / p.feederTable.area.from;
    return { pass: same && !urns.includes("137625") && p.feederTable.area.from === 363 && p.feederTable.area.to === 382 && near(area * 100, ((382 - 363) / 363) * 100, 1e-9), detail: fmt({ rows: urns.length, flags: p.feederTable.rows.filter((r) => r.flag).map((r) => r.flag!.id).join("/"), area: `${p.feederTable.area.from}->${p.feederTable.area.to}` }) };
  },
  async admViewShapes() {
    const v = await import("../src/lib/admissions/views-api");
    const { rivalSet } = await import("../src/lib/admissions/rival-set");
    const ep = v.entryPoint("11+")!;
    const [s, set] = await Promise.all([v.shapeView("137625", ep, []), rivalSet("137625", ep, [], v.DEFAULT_FILTERS)]);
    const order = s.rivals.map((r) => r.urn).join() === set.rivals.join();
    const noRank = !JSON.stringify(s.rivals).match(/"rank"|"score"/);
    // 0.7 r3 (F3): the profiles drawn stop at 17, and leaving out 18+ changes no school's shape (the
    // shared classifier reads ages 5-17 already): every school in the view, own, rivals and feeders.
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { shapeOf } = await import("../src/lib/admissions/shape");
    const p = await v.pipelineView("137625", ep, [], { today: new Date("2026-10-12") });
    const urns = Array.from(new Set(["137625", ...set.rivals, ...("empty" in p ? [] : p.sets.flatMap((x) => x.urns))]));
    const census = await cachedCensus(urns);
    let changed = 0;
    let with18 = 0;
    for (const u of urns) {
      const c = census.get(u)?.ageGender;
      if (!c) continue;
      if ([...c.keys()].some((a) => a >= 18)) with18++;
      const without = new Map([...c].filter(([a]) => a <= 17));
      if (shapeOf(c) !== shapeOf(without)) changed++;
    }
    const maxAge = Math.max(...[s.profile, s.localProfile, ...s.rivals.map((r) => r.profile)].flat().map((r) => r.age));
    return { pass: order && noRank && s.localShape.shape !== undefined && changed === 0 && maxAge <= 17, detail: fmt({ order, noRank, local: s.localShape.shape, mine: s.shapeByYear.at(-1)?.shape, schools: urns.length, withAge18: with18, shapeChangedWithout18: changed, profileMaxAge: maxAge }) };
  },
  async admViewTrends() {
    const v = await import("../src/lib/admissions/views-api");
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const p = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today: new Date("2026-10-12") });
    if ("empty" in p) return { pass: false, detail: "empty" };
    const past = p.ladder.past.filter((x) => x.source === "counted").map((x) => x.pool);
    const { data } = await createServerAnonSupabaseClient().from("age_profile_aggregates").select("by_age").eq("scope", "la").eq("scope_key", "Worcestershire").eq("period", 2025).maybeSingle();
    const la2025 = (data as { by_age: Record<string, number> } | null)?.by_age["10"] ?? null;
    const mine = p.poolTrends.la.find((x) => x.year === 2025)?.value ?? null;
    // 0.7 r2b (E3): past years (backfilled) are flagged for the undercount note; England is the
    // sum of the nine regions in each of them too.
    const t = p.poolTrends;
    const latest = Math.max(...t.areaYears);
    const pastOk = JSON.stringify(t.pastAreaYears) === JSON.stringify(t.areaYears.filter((y) => y < latest && (t.la.some((x) => x.year === y && x.value !== null) || t.england.some((x) => x.year === y && x.value !== null))));
    const first = t.pastAreaYears[0];
    let englandOk = true;
    if (first !== undefined) {
      const { data: regions } = await createServerAnonSupabaseClient().from("age_profile_aggregates").select("by_age").eq("scope", "region").eq("period", first);
      const rs = (regions ?? []) as { by_age: Record<string, number> }[];
      englandOk = rs.length === 9 && t.england.find((x) => x.year === first)?.value === rs.reduce((a, r) => a + (r.by_age["10"] ?? 0), 0);
    }
    return {
      pass: JSON.stringify(t.feeders.map((x) => x.value)) === JSON.stringify(past) && mine === la2025 && mine !== null && pastOk && englandOk,
      detail: fmt({ feederYears: t.feeders.length, la2025: mine, areaYears: t.areaYears.join("/"), pastAreaYears: t.pastAreaYears.join("/"), england1st: first === undefined ? null : t.england.find((x) => x.year === first)?.value }),
    };
  },
  async admViewMarket() {
    const v = await import("../src/lib/admissions/views-api");
    const m = await v.marketView("117037", v.entryPoint("11+")!, []);
    const sum = m.entryAge.rows.filter((r) => r.period === 2025).reduce((a, r) => a + (r.share ?? 0), 0);
    const mine = m.extras.find((e) => e.urn === "117037")!;
    const rank = 1 + m.extras.filter((e) => e.roll !== null && mine.roll !== null && e.roll > mine.roll).length;
    return { pass: near(sum, 100, 1e-6) && mine.rollRank === rank, detail: fmt({ sum: round(sum, 4), roll: mine.roll, rollRank: mine.rollRank, of: m.extras.length }) };
  },
  async admViewMomentum({ ref }) {
    const v = await import("../src/lib/admissions/views-api");
    const { buildRivals } = await import("../src/lib/admissions/rivals");
    const ep = v.entryPoint("11+")!;
    const [m, r] = await Promise.all([v.marketView("137625", ep, []), v.rivalsView("137625", ep, [])]);
    const facts = await ref.lookupReferenceData({ sourceId: "dfe_school_census", entityIds: m.rivals.slice(0, 3), breakdowns: ["full_time_female_aged_11", "full_time_male_aged_11"], periodMin: 2022, periodMax: 2025 });
    const raw = (u: string, y: number) => facts.filter((f) => f.entity_id === u && f.period === y).reduce((a, f) => a + (f.value_numeric ?? 0), 0);
    const xOk = m.rivals.slice(0, 3).every((u) => {
      const e = m.extras.find((x) => x.urn === u)!;
      // R-ROLL-WORDS-3YR (consistency): the base is 3 census years back (2022/23 for 2025/26).
      return e.entryBase === null || (e.entryBasePeriod === 2022 && e.entryBase === raw(u, e.entryBasePeriod) && e.entryNow === raw(u, 2025));
    });
    const none = await buildRivals("137625", ep, { thresholds: null });
    const guessed = none.rows.some((x) => x.momentum.some((f) => f.id !== "shape_changed"));
    return { pass: xOk && !guessed && none.thresholds === "not_loaded" && Object.keys(r.resultsChange).length === r.rows.length, detail: fmt({ xOk, withoutThresholds: none.thresholds, guessed, flagged: r.rows.filter((x) => x.momentum.length).length }) };
  },
  async admViewStrengths() {
    const v = await import("../src/lib/admissions/views-api");
    const { FLAG_RULES } = await import("../src/lib/admissions/flags");
    const r = await v.rivalsView("137625", v.entryPoint("11+")!, []);
    const ok = r.areas.every((a) => {
      const third = Math.max(1, Math.floor(a.of * FLAG_RULES.strengthShare));
      return a.flags.every((f) => (f.id.startsWith("strength") ? a.gap > 0 && a.rank <= third : f.id.startsWith("weakness") ? a.gap < 0 && a.rank > a.of - third : true));
    });
    return { pass: ok && r.areas.length > 0 && r.areas.every((a) => !!r.areaLabels[a.familyId]), detail: fmt({ areas: r.areas.length, flagged: r.areas.filter((a) => a.flags.length).map((a) => `${a.familyId}:${a.flags.map((f) => f.id).join("+")}`).join(" ") }) };
  },
  async admViewFlags() {
    const v = await import("../src/lib/admissions/views-api");
    const ids = new Set(["results_rising_fast", "gaining_pupils", "losing_pupils_3y", "entry_year_shrinking", "new_sixth_form", "shape_changed"]);
    const r = await v.rivalsView("117037", v.entryPoint("11+")!, []);
    const flags = r.rows.flatMap((x) => x.momentum);
    return { pass: flags.every((f) => ids.has(f.id) && Object.keys(f.figures).length > 0), detail: fmt({ flags: flags.length, ids: Array.from(new Set(flags.map((f) => f.id))).join("/") || "none" }) };
  },
  async admViewAcademic() {
    const v = await import("../src/lib/admissions/views-api");
    const { stageForEntry } = await import("../src/lib/admissions/rivals");
    const r = await v.rivalsView("117037", v.entryPoint("16+")!, []);
    const map = [4, 11, 16].map(stageForEntry).join("/");
    const notes = r.rows.filter((x) => x.results.note).every((x) => x.results.national === null);
    return { pass: map === "ks2/ks4/ks5" && r.stage === "ks5" && notes, detail: fmt({ map, stage: r.stage, unranked: r.rows.filter((x) => x.results.note).length }) };
  },
  async admFeSource() {
    const v = await import("../src/lib/admissions/views-api");
    const { FE_SOURCE_LABEL } = await import("../src/lib/admissions/screens");
    const m = await v.marketView("130432", v.entryPoint("16+")!, []);
    const own = m.entryAge.rows.filter((r) => r.urn === "130432");
    return { pass: !!m.fe && m.fe.label === FE_SOURCE_LABEL && m.fe.series.length > 0 && own.every((r) => r.count === null && r.share === null), detail: fmt({ ilrYears: m.fe?.series.map((x) => x.year).join("/"), ownCensusRows: own.filter((r) => r.count !== null).length }) };
  },
  async admFilters() {
    const v = await import("../src/lib/admissions/views-api");
    const { fetchSchoolTraits } = await import("../src/lib/admissions/traits");
    const today = new Date("2026-10-12");
    const ep = v.entryPoint("16+")!;
    const p = await v.pipelineView("137625", ep, [], { today, filters: { lists: "both", sector: "independent", boardingOnly: false } });
    // Boarding only, with no boarding list: the honest empty state for a boarding school (Beaudesert
    // Park); for a day school (The Chase) the filter isn't its to use and is ignored (0.7 r3, F2).
    const b = await v.pipelineView("115786", v.entryPoint("11+")!, [], { today, filters: { lists: "boarding", sector: "all", boardingOnly: false } });
    const day = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today, filters: { lists: "boarding", sector: "all", boardingOnly: false } });
    if ("empty" in p) return { pass: false, detail: "empty" };
    const urns = Array.from(new Set(p.sets.flatMap((s) => s.urns)));
    const t = await fetchSchoolTraits(urns);
    const onlyIndependent = urns.every((u) => u === "137625" || t.get(u)?.sector === "independent");
    return { pass: onlyIndependent && "empty" in b && b.empty === "no_boarding_list" && !("empty" in day), detail: fmt({ schools: urns.length, onlyIndependent, boardingSchoolEmpty: "empty" in b, daySchoolIgnored: !("empty" in day) }) };
  },

  // ------------------------------------------------------------------ 0.8 SMT round 2
  async doubleAwardPoints() {
    const { doubleAwardPoints, DOUBLE_AWARD_QUALIFICATION } = await import("../src/lib/subject-grades");
    const { fetchSubjectHeadlineForSchools } = await import("../src/lib/academic-data-view");
    const L = await lib();
    const out: string[] = [];
    let pass = true;
    for (const urn of ["137625", "100053", "137051"]) {
      const raw = (await L.ref.lookupAcademicSubjectGradeRollup({ entityIds: [urn], ksStage: "ks4", qualificationType: DOUBLE_AWARD_QUALIFICATION, periodMin: 2024, periodMax: 2024 })) ?? [];
      let sum = 0;
      let n = 0;
      for (const r of raw) {
        if (r.subject !== "Combined Science") continue;
        const m = /^([1-9])([1-9])$/.exec(r.grade);
        const e = Number(r.entries);
        if (m) { sum += ((Number(m[1]) + Number(m[2])) / 2) * e; n += e; } else if (r.grade === "U") n += e;
      }
      const expect = n ? Math.round((sum / n) * 100) / 100 : null;
      const head = (await fetchSubjectHeadlineForSchools([urn], "ks4")).get(urn)?.find((x) => x.subject === "Combined Science" && x.period === 2024);
      const fn = doubleAwardPoints(raw.filter((r) => r.subject === "Combined Science").map((r) => ({ grade: r.grade, entries: Number(r.entries) })));
      const ok = expect !== null && head?.avgPointScore === expect && fn?.points === expect;
      pass &&= ok;
      out.push(`${urn} ${head?.avgPointScore} (recomputed ${expect}) ${ok ? "ok" : "MISMATCH"}`);
    }
    // Ranked in a set and in England (SMT's Subjects, Teacher's subjectRanking).
    // 0.8 SMT Academic: SMT's subject areas rank it in the set (England's place is Teacher's, below).
    const a = await smtAcademicCase("137625", "level=gcse&mode=results&area=sciences_maths");
    const subjAll = a.areas.blocks.flatMap((b) => b.quals.flatMap((q) => q.subjects));
    const dblRow = subjAll.find((x) => x.subject === "Combined Science");
    const dbl = dblRow ? { set: dblRow.place, england: dblRow.place, avg: dblRow.value } : undefined;
    const fsmqRow = subjAll.find((x) => /FSMQ|Additional\)/.test(x.subject));
    const fsmq = fsmqRow ? { subject: fsmqRow.subject, reason: fsmqRow.value === null ? "scale" : "ranked" } : undefined;
    pass &&= !!dbl?.set && dbl.avg !== null && (!fsmq || fsmq.reason === "scale");
    // Teacher's Comparisons asks for GCSE points with no qualification: still ranked.
    const { subjectRanking } = await import("../src/lib/subject-ranking");
    const c = await smtCase("137625");
    const t = await subjectRanking({ urns: ["137625", ...c.set.urns], targetUrn: "137625", phase: "ks4", subject: "Combined Science", familyId: "sciences_maths", qualificationType: null, measure: { kind: "points" }, period: null }, "rule:teacher-ask");
    pass &&= t.targetRank !== null && t.target?.value === dbl?.avg;
    // 0.8 audit fixes (2): Teacher's Column 1 scores it the same, its latest and each year; a BTEC
    // in the same subject still borrows nothing.
    const M = await import("../src/lib/teacher-view-measures");
    const rows = (await fetchSubjectHeadlineForSchools(["137625"], "ks4")).get("137625") ?? [];
    const item = { subject: "Combined Science", qualificationType: DOUBLE_AWARD_QUALIFICATION };
    const own = M.ownHeadlineRows("ks4", item, rows, []);
    const col1 = M.latestOwnPoints("ks4", item, own);
    const col1At = M.subjectPointsAt("ks4", item, own.filter((h) => h.period === col1?.period));
    const last = own.filter((h) => h.avgPointScore !== null).sort((x, y) => x.period - y.period).at(-1);
    const btec = M.latestOwnPoints("ks4", { subject: "Combined Science", qualificationType: "BTEC Level 1/Level 2 First Award" }, own);
    const column1 = col1 !== null && col1.value === last?.avgPointScore && col1At === col1.value && btec === null;
    pass &&= column1;
    return { pass, detail: fmt({ schools: out.join("; "), chaseRanked: dbl?.set && `${dbl.set.rank} of ${dbl.set.of}, England ${dbl.england?.rank} of ${dbl.england?.of}`, teacherAsk: `${t.targetRank} of ${t.ranked} (${t.target?.value})`, column1: col1 ? `${col1.value} in ${col1.period}, BTEC ${btec}` : "none", fsmq: fsmq ? `${fsmq.subject}: ${fsmq.reason}` : "none" }) };
  },
  async smtMix() {
    // 0.8 SMT Academic: the Post-16 mix by VicData's groups; Leighton Park's IB starts and stops within it.
    const a = await smtAcademicCase("110110", "level=post16&mode=results&group=alevel");
    const L = await lib();
    const m = a.trends.mix;
    const sums = m.years.every((y) => Math.abs(Object.values(y.shares).reduce((s, v) => s + v, 0) - 100) < 1e-6);
    const raw = await L.ref.lookupAcademicHeadline({ entityIds: ["110110"], ksStage: "ks5" });
    const ibAt = (y: number) => Number(raw.find((r) => r.period === y)?.measures["bucket:ib::entries"] ?? 0);
    const ibOk = m.years.every((y) => (y.counts.ib ?? 0) === ibAt(y.year));
    const pass = m.years.length >= 3 && m.years.at(-1)?.year === a.period && sums && ibOk && !!m.sentence && /IB/.test(m.sentence);
    return { pass, detail: fmt({ years: m.years.map((y) => `${y.year}:${y.total}`).join(" "), addsTo100: sums, ibMatchesHeadline: ibOk, sentence: m.sentence }) };
  },

  async smtPupilsLevel() {
    const out: string[] = [];
    let pass = true;
    // 0.8 audit fixes (3, S2): the ages are first and last inclusive -- GCSE Y7-Y11, Post-16 Y12-Y13.
    for (const [phase, want, labels] of [["gcse", [11, 15], "Y7,Y8,Y9,Y10,Y11"], ["post16", [16, 17], "Y12,Y13"], ["whole", null, ""]] as const) {
      const p = await smtPupilsCase("137625", phase);
      const html = await smtRender("137625", "DV-SMT-P-SHAPE", undefined, { pupils: p });
      const on = (html.match(/data-level-age="on"/g) ?? []).length;
      const lit = p.shape.yearGroups.filter((y) => want && y.age >= want[0] && y.age <= want[1]);
      const ok = JSON.stringify(p.highlight) === JSON.stringify(want) && on === lit.length && lit.map((y) => y.label).join() === labels;
      pass &&= ok;
      out.push(`${phase}: ${JSON.stringify(p.highlight)} ${on} bars (${lit.map((y) => y.label).join(" ")}) ${ok ? "ok" : "MISMATCH"}`);
    }
    return { pass, detail: out.join("; ") };
  },
  async smtPupilsNow() {
    const p = await smtPupilsCase("137625");
    const c = await smtCase("137625");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const t = (await cachedCensus(["137625"])).get("137625")!.table;
    const P = c.school.census.at(-1)!.period;
    const pct = (cohortAt(t, 16, P)! / cohortAt(t, 15, P - 1)!) * 100;
    const lp = await smtPupilsCase("110110");
    const html = await smtRender("137625", "DV-SMT-P-NOW", undefined, { pupils: p });
    const lpHtml = await smtRender("110110", "DV-SMT-P-NOW", undefined, { pupils: lp });
    const pass = p.now.roll === c.school.census.at(-1)!.totalRoll && Math.abs((p.now.stayingOn?.pct ?? -1) - pct) < 1e-9 && p.now.boarding === null && !/data-pair="Boarding"/.test(html) && /data-pair="Boarding"/.test(lpHtml) && /data-pair="Girls"/.test(html);
    // 0.8 SMT feedback round 1 (F-1): the paired tiles box each figure with its label (data-pair).
    return { pass, detail: fmt({ roll: p.now.roll, stayingOn: round(p.now.stayingOn?.pct, 1), recomputed: round(pct, 1), chaseBoardingTile: /data-pair="Boarding"/.test(html), leightonBoardingTile: /data-pair="Boarding"/.test(lpHtml) }) };
  },
  async smtY12AgainstY11() {
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const p = await smtPupilsCase("110110");
    const c = await smtCase("110110");
    const t = (await cachedCensus(["110110"])).get("110110")!.table;
    const P = c.school.census.at(-1)!.period;
    const pct = (cohortAt(t, 16, P)! / cohortAt(t, 15, P - 1)!) * 100;
    const views: Record<string, string> = {};
    for (const id of ["DV-SMT-P-NOW", "DV-SMT-P-SHAPE", "DV-SMT-P-LEAVING"]) views[id] = textOf(await smtRender("110110", id, undefined, { pupils: p }));
    const named = Object.values(views).every((v) => v.includes(SMT_NOTES.y12Label));
    const staying = Object.entries(views).filter(([, v]) => /staying on/i.test(v)).map(([k]) => k);
    const caption = views["DV-SMT-P-NOW"].includes(SMT_NOTES.y12AgainstY11);
    const same = Math.abs((p.now.stayingOn?.pct ?? -1) - pct) < 1e-9;
    const pass = named && staying.length === 0 && caption && same && pct > 100;
    return { pass, detail: fmt({ leightonPark: round(p.now.stayingOn?.pct, 1), recomputed: `Y12 ${P} / Y11 ${P - 1} = ${round(pct, 1)}`, namedInAllThree: named, saysStayingOn: staying.join(",") || "none", caption }) };
  },
  async smtShape() {
    const p = await smtPupilsCase("137625");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const counts = (await cachedCensus(["137625"])).get("137625")!.ageGender;
    const same = p.shape.yearGroups.every((y) => { const v = counts.get(y.age); return !!v && v.male + v.female === y.total; });
    const html = textOf(await smtRender("137625", "DV-SMT-P-SHAPE", undefined, { pupils: p }));
    const ranked = /\b\d+(st|nd|rd|th) of\b|\branked \d|\brank(ed)? (in|among)\b/i.test(html);
    return { pass: same && !ranked && p.shape.label !== null, detail: fmt({ yearGroups: p.shape.yearGroups.length, matchCensus: same, shape: p.shape.label, laShape: p.shape.around.la?.shape, rankedWords: ranked }) };
  },
  async smtAdmissionsReadOnly() {
    const p = await smtPupilsCase("137625");
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const html = await smtRender("137625", "DV-SMT-P-ENTRIES", undefined, { pupils: p });
    const text = textOf(html);
    const noEdit = !/<button/.test(html) && !/Choose|Edit the|Set up/.test(text);
    const pass = p.entries.status === "empty" && p.entries.reason === SMT_NOTES.entryPointsNone && /Open in Admissions/.test(text) && noEdit && p.trends.pool.status === "ready";
    return { pass, detail: fmt({ entries: p.entries.status, reasonShown: text.includes(SMT_NOTES.entryPointsNone.slice(0, 40)), openInAdmissions: /Open in Admissions/.test(text), noEditControls: noEdit, pool: p.trends.pool.status }) };
  },
  async smtLeaving() {
    const p = await smtPupilsCase("137625");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const t = (await cachedCensus(["137625"])).get("137625")!.table;
    const ok = p.leaving.length > 0 && p.leaving.every((r) => r.year11 === cohortAt(t, 15, r.year - 1) && r.year12 === cohortAt(t, 16, r.year));
    return { pass: ok, detail: fmt({ years: p.leaving.map((r) => `${r.year}:${r.year11}->${r.year12}`).join(" "), matchCensus: ok }) };
  },
  async smtContextGeography() {
    // Both states, each in a child process: before the boundaries (install-no-boundaries.ts makes the
    // boundary RPCs answer as before K0's migration), and production as it is (lsoa_boundaries loaded,
    // 15 Oct). SMT r3 snags: the first state was production itself until Guy applied K0.
    const { execFileSync } = await import("node:child_process");
    const run = (pre: string[], urn: string) => {
      try {
        const out = execFileSync("npx", ["-y", "tsx", "--env-file=.env", ...pre, path.join(ROOT, "scripts/context-preview/context-map-check.mts"), urn], { cwd: ROOT, encoding: "utf8", timeout: 900_000, stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").at(-1) ?? "";
        return JSON.parse(out) as { state: string; reason?: string; opts: string[]; here?: number; lookup?: number; everyBoundary?: boolean; las?: number };
      } catch (e) {
        return { state: `error ${(e as Error).message.slice(0, 120)}`, opts: [] as string[] };
      }
    };
    const without = run(["--import=./scripts/context-preview/install-no-boundaries.ts"], "137625");
    const withB = run([], "137625");
    const c = await smtContextCase("137625");
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const html = textOf(await smtRender("137625", "DV-SMT-C-MAP", undefined, { context: c, contextMap: { state: "fallback", reason: "test" } }));
    const fallbackOk = without.state === "fallback" && without.opts.join() === "children,fsm" && (without.las ?? 0) > 0 && html.includes(SMT_NOTES.shadeByDistrict.slice(0, 40));
    const loadedOk = withB.state === "lsoa" && withB.here === withB.lookup && withB.here === 34 && withB.everyBoundary === true && withB.opts.join() === "children,imd,idaci,fsm";
    return { pass: fallbackOk && loadedOk, detail: fmt({ withoutBoundaries: `${without.state} (${without.reason ?? ""}), shade ${without.opts.join("/")}, ${without.las} LAs, district note ${html.includes(SMT_NOTES.shadeByDistrict.slice(0, 40))}`, withBoundaries: `${withB.state}: ${withB.here} within 5 miles (lookup ${withB.lookup}), boundaries ${withB.everyBoundary}, shade ${withB.opts.join("/")}` }) };
  },
  async smtContextPlace() {
    const want: Record<string, string> = { "110110": "Reading · South East", "137625": "Malvern · Worcestershire · West Midlands", "100053": "London · Camden · London" };
    const got: Record<string, string> = {};
    for (const urn of Object.keys(want)) {
      const c = await smtContextCase(urn, "around", "whole");
      const html = await smtRender(urn, "DV-SMT-C-NOW", undefined, { context: c });
      got[urn] = textOf(/<div[^>]*data-place=""[^>]*>([^<]*)<\/div>/.exec(html)?.[1] ?? "").trim();
    }
    const pass = Object.entries(want).every(([u, v]) => got[u] === v);
    return { pass, detail: fmt(got) };
  },
  async smtContextResidents() {
    const c = await smtContextCase("137625", "around", "gcse");
    const { callReferenceRpc } = (await lib()).ref;
    const rows = (await callReferenceRpc("school_context_lookup", { p_urns: ["137625"] })) as { year: number; children: number[] }[];
    const last = rows.sort((a, b) => a.year - b.year).at(-1)!;
    const sum = last.children.slice(11, 16).reduce((a, b) => a + b, 0);
    const html = textOf(await smtRender("137625", "DV-SMT-C-NOW", undefined, { context: c }));
    const census = c.now.pupilsNearby;
    // 0.8 SMT r4: read through area_context at exactly 5 miles, the radius school_context_lookup counts at.
    const labelled = html.includes(`pupils at schools within ${c.radius}`) && html.includes(`living within ${c.radius}`);
    const pass = c.now.children.value === sum && c.now.children.year === last.year && sum === 3354 && !!census && html.includes(census.value.toLocaleString("en-GB")) && labelled;
    return { pass, detail: fmt({ tile: `${c.now.children.value} (mid-${c.now.children.year})`, lookupAges11to15: sum, censusLine: census ? `${census.value} (${census.period})` : null, bothLabelled: labelled }) };
  },
  async smtContextDeprivation() {
    const want: Record<string, [number, number]> = { "137625": [8, 3], "110110": [6, 5], "100053": [4, 5] };
    const got: Record<string, string> = {};
    let pass = true;
    for (const [urn, [imd, idaci]] of Object.entries(want)) {
      const c = await smtContextCase(urn, "around", "whole");
      const mix = c.social.mix ?? [];
      const total = mix.reduce((a, b) => a + b, 0);
      const html = textOf(await smtRender(urn, "DV-SMT-C-NOW", undefined, { context: c }));
      const ok = c.social.imd === imd && c.social.idaci === idaci && mix.length === 10 && Math.abs(total - 100) < 0.05 && html.includes(`decile ${imd} of 10`) && html.includes(`decile ${idaci} of 10`);
      pass &&= ok;
      got[urn] = `IMD ${c.social.imd}, IDACI ${c.social.idaci}, mix ${total.toFixed(2)}%${ok ? "" : " (MISMATCH)"}`;
    }
    return { pass, detail: fmt(got) };
  },
  async smtContextFsm() {
    const chase = await smtContextCase("137625", "around", "whole");
    const acland = await smtContextCase("100053", "around", "whole");
    const lp = await smtContextCase("110110", "around", "whole");
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const f1 = chase.social.fsm, f2 = acland.social.fsm;
    const r1 = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
    const chaseOk = f1.status === "published" && r1(f1.value) === 17.7 && r1(f1.la.value) === 20.8 && r1(f1.england) === 26.5 && f1.period === 2025;
    const aclandOk = f2.status === "published" && r1(f2.value) === 34 && r1(f2.la.value) === 46.1;
    const html = textOf(await smtRender("110110", "DV-SMT-C-NOW", undefined, { context: lp }));
    const fsmBlock = html.slice(html.indexOf(SMT_NOTES.fsmTitle));
    const { smtNote } = await import("../src/catalogue/notes");
    const lpOk = lp.social.fsm.status === "independent" && html.includes(SMT_NOTES.wIndependentFsm) && html.includes(smtNote("wIndependentDraw", { radius: lp.radius })) && !/\d+(\.\d)?%/.test(fsmBlock.slice(0, 200));
    const shown = textOf(await smtRender("137625", "DV-SMT-C-NOW", undefined, { context: chase }));
    const shownOk = shown.includes("17.7%") && shown.includes("Worcestershire 20.8%") && shown.includes("England 26.5%");
    return { pass: chaseOk && aclandOk && lpOk && shownOk, detail: fmt({ chase: f1.status === "published" ? `${f1.value}% (${f1.period}) vs ${f1.la.name} ${r1(f1.la.value)}%, England ${r1(f1.england)}%` : f1.status, acland: f2.status === "published" ? `${f2.value}% vs ${f2.la.name} ${r1(f2.la.value)}%` : f2.status, leighton: `${lp.social.fsm.status}; rule 2 shown ${html.includes(SMT_NOTES.wIndependentFsm)}; no number ${lpOk}`, chaseRendered: shownOk }) };
  },
  async smtContextWording() {
    const { SMT_NOTES, smtNote } = await import("../src/catalogue/notes");
    const lp = await smtContextCase("110110", "around", "whole");
    const chase = await smtContextCase("137625", "around", "gcse");
    const views = ["DV-SMT-C-NOW", "DV-SMT-C-MAP", "DV-SMT-C-BYAGE", "DV-SMT-C-PROJECTION", "DV-SMT-C-NEARBY"];
    let text = "";
    for (const dv of views) text += " " + textOf(await smtRender("110110", dv, undefined, { context: lp, contextMap: { state: "fallback", reason: "test" } }));
    for (const dv of views) text += " " + textOf(await smtRender("137625", dv, undefined, { context: chase, contextMap: { state: "fallback", reason: "test" } }));
    // Rule 6 is the source (i): the panels' source line, built from the data's years.
    text += " " + chase.notes.sources;
    const rules: Record<string, string> = { "1 deprivation": SMT_NOTES.wDeprivation, "2 independent FSM": SMT_NOTES.wIndependentFsm, "2 draw": smtNote("wIndependentDraw", { radius: lp.radius }), "4 deciles": SMT_NOTES.wDeciles, "5 projection": SMT_NOTES.wProjection };
    const missing = Object.entries(rules).filter(([, v]) => !text.includes(v)).map(([k]) => k);
    // Rule 3 lives in the captions (each view's "What this shows" line, in its (i)): checked on the notes the panels show.
    const rule3 = chase.notes.children.includes(smtNote("wResidents", { radius: chase.radius }));
    const rule6 = /ONS mid-year population estimates for LSOAs \(mid-\d{4}\)/.test(chase.notes.sources) && /English Indices of Deprivation \d{4}/.test(chase.notes.sources) && /\(\d{4}\/\d{2}\)\.$/.test(chase.notes.sources);
    // No "pupils" beside a deprivation figure: the social block's deprivation lines, less the rule's own words.
    const social = text.split("Social context").slice(1).map((t) => t.split(SMT_NOTES.fsmTitle)[0]).join(" ").replaceAll(SMT_NOTES.wDeprivation, "");
    const pupilsNearDeprivation = /pupils/i.test(social);
    const pass = missing.length === 0 && rule3 && rule6 && !pupilsNearDeprivation;
    return { pass, detail: fmt({ missing: missing.join(", ") || "none", residentsRule: rule3, sources: chase.notes.sources, pupilsNextToDeprivation: pupilsNearDeprivation }) };
  },
  async smtContextNow() {
    const c = await smtContextCase("137625", "around", "gcse");
    const { fetchBirthsByLa } = await import("../src/lib/admissions/data");
    const births = (await fetchBirthsByLa(["885"])).get("885")!;
    const year = Math.max(...births.keys());
    const L = await lib();
    // 0.8 SMT r4 (F5): the tile is the area's projection (area_projection at the radius, ages 11-15), from
    // the latest count to five years on, recomputed from the lookup's own rows.
    const raw = (await L.ref.callReferenceRpc("area_projection", { p_urn: "137625", p_radius_miles: 5 })) as unknown as { latest_year: number; rows: { year: number; age_from: number; age_to: number; middle: number }[] };
    const at = (y: number) => raw.rows.find((r) => r.year === y && r.age_from === 11 && r.age_to === 15)?.middle ?? NaN;
    const p = c.now.projection;
    const projOk = !!p && p.from === raw.latest_year && p.to === raw.latest_year + 5 && Math.abs(((at(p.to) - at(p.from)) / at(p.from)) * 100 - p.changePct) < 1e-6;
    const pass = c.now.births?.year === year && c.now.births.value === births.get(year) && c.now.schools.count > 0 && c.place.la === "Worcestershire" && projOk;
    return { pass, detail: fmt({ births: `${c.now.births?.value} (${c.now.births?.year})`, raw: births.get(year), schoolsNearby: c.now.schools.count, projection: p && `${p.agesWord} ${p.from}->${p.to} ${p.changePct.toFixed(1)}%`, projectionRecomputed: projOk, place: [c.place.town, c.place.la, c.place.region].join(" · ") }) };
  },
  async smtBirths() {
    const c = await smtContextCase("137625", "around", "gcse");
    const base = c.births.base;
    const at = (pts: { year: number; value: number | null }[]) => pts.find((p) => p.year === base)?.value;
    // 0.8 SMT r4: the projection runs from the latest count to the settings' horizon (latest + 11).
    const f = c.forward!;
    const proj = f.projection;
    const pass = base === 2012 && at(c.births.indexed.la) === 100 && at(c.births.indexed.england) === 100 && proj.length > 1 && proj[0].year === f.latestYear && proj.at(-1)!.year === f.horizonEnd && f.horizonEnd === f.latestYear + f.settings.horizon_years;
    return { pass, detail: fmt({ base, england2012: c.births.england.find((p) => p.year === 2012)?.value, latestCount: f.latestYear, projectionYears: `${proj[0]?.year}-${proj.at(-1)?.year}`, horizon: f.settings.horizon_years }) };
  },
  // ------------------------------------------------------------------ 0.8 SMT round 4
  // R-SMT-RADIUS: the default from the saved setting, else by the school's type; the whole board follows
  // N, and no caption says another radius; the setting's RLS (supabase/tests/v08_smt_r4_catchment_pglite.mjs,
  // run here when PGLITE_POSTGIS_DIR names a folder with PGlite and PostGIS, as its header says).
  async smtRadius() {
    const K = await import("../src/lib/smt/catchment");
    const chase = (await smtCase("137625")).school;
    const lp = (await smtCase("110110")).school;
    const state16 = { independent: false, high: 16, phases: { post16: false } };
    const rules = {
      // 0.8 Admissions fb1 (R-ADM-CATCHMENT-RULE): a state school's default is its density radius.
      chaseDefault: K.resolveCatchment(await (await import("../src/lib/smt/catchment-density")).withDensity("137625", chase), null, null).km === 12 && K.catchmentCapKm(chase) === 30,
      leightonDefault: K.resolveCatchment(lp, null, null).km === 15 && K.catchmentCapKm(lp) === 30,
      state16Cap: K.catchmentCapKm(state16) === 15 && K.catchmentPresets(state16).join() === "2,3,5,8,10,15",
      saved: K.resolveCatchment(chase, null, 8).km === 8 && K.resolveCatchment(chase, null, 8).from === "saved",
      viewBeatsSaved: K.resolveCatchment(chase, "3", 8).km === 3 && K.resolveCatchment(chase, "3", 8).from === "view",
      cappedSaved: K.resolveCatchment(state16, null, 20).km === 15 && K.resolveCatchment(state16, null, 20).capped,
      clamp: K.clampKm("99", chase) === 30 && K.clampKm("0", chase) === 2 && K.clampKm("x", chase) === null,
    };
    // The whole board at 3 km: every caption the Context views draw says 3 km, none another radius.
    const c = await smtContextCase("137625", "around", "gcse", 3);
    const views = ["DV-SMT-C-NOW", "DV-SMT-C-BYAGE", "DV-SMT-C-PROJECTION", "DV-SMT-C-NEARBY"];
    let text = Object.values(c.notes).join(" ");
    for (const dv of views) text += " " + textOf(await smtRender("137625", dv, undefined, { context: c, contextMap: { state: "fallback", reason: "test" } }));
    const follows = c.radius === "3 km" && text.includes("within 3 km") && !/\b(5|five) miles\b|\b5 km\b|\b8\.\d+ km\b/.test(text) && c.now.schools.scope === "within 3 km";
    const pure = Object.values(rules).every(Boolean);
    let rls = "not run (set PGLITE_POSTGIS_DIR)";
    let rlsOk = true;
    if (process.env.PGLITE_POSTGIS_DIR) {
      const { execFileSync } = await import("node:child_process");
      try {
        const out = execFileSync("node", [path.join(ROOT, "supabase/tests/v08_smt_r4_catchment_pglite.mjs")], { cwd: ROOT, encoding: "utf8", env: { ...process.env, PGLITE_DIR: process.env.PGLITE_POSTGIS_DIR }, timeout: 600_000 });
        rls = out.trim().split("\n").at(-1) ?? "";
      } catch (e) {
        rls = `FAILED ${(e as Error).message.slice(0, 120)}`;
        rlsOk = false;
      }
    }
    return { pass: pure && follows && rlsOk, detail: fmt({ ...rules, boardFollows3km: follows, rls }) };
  },
  // R-SMT-FORWARD: the line starts at the latest count; the band contains the line; the unborn years are
  // flagged; Leighton Park's authority mix names Reading and Wokingham; and the figures equal the ingest's
  // P5 spot checks exactly (docs/vicdata_area_projection_report_v1.md, settings version 2, as production
  // returned them on 15 Oct). If they differ, the rule fails: the expected figures are never edited to match.
  async smtForward() {
    const P5: Record<string, number[][]> = {
      "137625:3": [[2379, 2379, 2379], [2225, 2122, 2361], [1985, 1784, 2231]],
      "137625:5": [[3326, 3326, 3326], [3295, 3142, 3497], [3043, 2734, 3418]],
      "137625:10": [[12729, 12729, 12729], [12310, 11737, 12778], [11153, 10391, 12529]],
      "110110:3": [[13145, 13145, 13145], [13143, 12757, 14581], [11988, 11548, 15189]],
      "110110:5": [[23156, 23156, 23156], [22557, 21966, 24989], [19986, 19456, 25214]],
      "110110:10": [[43229, 43229, 43229], [41316, 40544, 44740], [36736, 35200, 44280]],
      "100053:3": [[35426, 35426, 35426], [31221, 28749, 32987], [28342, 24464, 32174]],
      "100053:5": [[97228, 97228, 97228], [87588, 81309, 91904], [79229, 70534, 91874]],
      "100053:10": [[317672, 317672, 317672], [293246, 273282, 306214], [267567, 240695, 300163]],
    };
    const { areaProjection } = await import("../src/lib/smt/area-data");
    const mismatch: string[] = [];
    for (const [k, want] of Object.entries(P5)) {
      const [urn, miles] = k.split(":");
      const p = (await areaProjection(urn, Number(miles) * 1.609344, [11, 15]))!;
      const got = [2025, 2030, 2035].map((y) => {
        const r = p.rows.find((x) => x.year === y && x.ageFrom === 11 && x.ageTo === 15)!;
        return [r.middle, r.low, r.high];
      });
      if (JSON.stringify(got) !== JSON.stringify(want)) mismatch.push(`${k} ${JSON.stringify(got)}`);
    }
    // The board: the Chase at 5 miles (GCSE) and at Primary (4-10, whose later years include the unborn).
    const c = await smtContextCase("137625", "around", "gcse");
    const f = c.forward!;
    const first = f.projection[0];
    const meets = f.estimates.at(-1)!.year === f.latestYear && f.estimates.at(-1)!.value === first.middle && first.low === first.middle && first.high === first.middle;
    const contains = f.projection.every((x) => x.low !== null && x.high !== null && x.middle !== null && x.low <= x.middle && x.middle <= x.high);
    const pr = await smtContextCase("137625", "around", "primary");
    const fp = pr.forward!;
    const unborn = fp.unbornFrom === fp.latestYear + 5 && fp.projection.every((x) => x.includesUnborn === x.year - fp.latestYear > 4) && !f.projection.some((x) => x.includesUnborn);
    const lp = await smtContextCase("110110", "around", "gcse");
    const mix = lp.now.mix?.line ?? "";
    const mixOk = /Reading \d+%/.test(mix) && /Wokingham \d+%/.test(mix);
    const html = textOf(await smtRender("137625", "DV-SMT-C-PROJECTION", undefined, { context: pr }));
    const drawn = html.includes("includes children not yet born");
    const pass = mismatch.length === 0 && meets && contains && unborn && mixOk && drawn;
    return { pass, detail: fmt({ p5: mismatch.length ? `DIFFERS: ${mismatch.join("; ")}` : "9 / 9 equal", meetsAtLatestCount: meets, bandContainsLine: contains, unbornFlagged: `${unborn} (primary from ${fp.unbornFrom})`, labelDrawn: drawn, leightonMix: mix }) };
  },
  // R-METHOD-PRESENT (0.8 SMT r4, stage I): every registered view -- Teacher, Admissions, SMT (groups'
  // views are SMT's) -- has a method: sources named, the area, the years, at least one numbered step, and
  // no unfilled {placeholder} once filled with nothing (the hosts' fallback words).
  async methodPresent() {
    const { DATAVIEWS } = await import("../src/catalogue/dataviews");
    const { METHODS, methodOf, methodText } = await import("../src/catalogue/methods");
    const missing: string[] = [];
    const thin: string[] = [];
    for (const d of DATAVIEWS) {
      const m = METHODS[d.id];
      if (!m) {
        missing.push(d.id);
        continue;
      }
      const filled = methodOf(d.id, {})!;
      const ok = m.sources.length > 0 && m.sources.every((x) => x.trim().length > 3) && m.geography.trim() && m.years.trim() && m.steps.length >= 1 && m.steps.every((x) => x.trim().length > 10) && !/[{}]/.test(methodText(filled));
      if (!ok) thin.push(d.id);
    }
    const extra = Object.keys(METHODS).filter((k) => !DATAVIEWS.some((d) => d.id === k));
    return { pass: missing.length === 0 && thin.length === 0 && extra.length === 0, detail: fmt({ views: DATAVIEWS.length, withMethod: DATAVIEWS.length - missing.length, missing: missing.join(" ") || "none", incomplete: thin.join(" ") || "none", notAView: extra.join(" ") || "none" }) };
  },
  // R-METHOD-SETTINGS: the forward view's method is generated from the projection's settings -- every
  // setting value appears in its text, and changing a setting in a fixture changes the text to match.
  async methodSettings() {
    const { projectionMethod, methodText } = await import("../src/catalogue/methods");
    const base = {
      scope: "around" as const, radius: "5 km", laName: "Reading", ages: "11–15", lsoaCount: 118, mixLine: "Within 5 km: Wokingham 49%, Reading 46%, other 5%", latestYear: 2025, horizonEnd: 2036, bandMissing: false, settingsVersion: 2,
      settings: { exceptional_years: [2020, 2021, 2022, 2023, 2024], exceptional_reason: "Covid (years to mid-2020 and 2021) and exceptionally high migration (2022-24)", first_rate_year: 2013, middle_pre_years: 5, weight_pre: 1, weight_post: 2, band_includes_exceptional: true, scenario_years: [2022, 2023, 2024], scenario_label: "if migration returned to 2022-24 levels", horizon_years: 11 },
      yearsUsed: { normal: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2025], middle_weights: { "2015": 1, "2016": 1, "2017": 1, "2018": 1, "2019": 1, "2025": 2 }, band: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], scenario: [2022, 2023, 2024] },
      sources: { la_estimates: { first: 2012, latest: 2025, edition: "Nomis NM_2002_1" }, lsoa_estimates: { first: 2011, latest: 2024, edition: "mid-2022 (revised Nov 2025) to mid-2024" } },
    };
    const t1 = methodText(projectionMethod(base));
    const values = [String(base.settingsVersion), "2020, 2021, 2022, 2023 and 2024", base.settings.exceptional_reason, String(base.settings.first_rate_year), `weight ${base.settings.weight_pre}`, `weight ${base.settings.weight_post}`, "2022, 2023 and 2024", base.settings.scenario_label, `${base.settings.horizon_years} years on`, String(base.settings.middle_pre_years), "including 2020, 2021, 2022, 2023 and 2024"];
    const absent = values.filter((v) => !t1.includes(v));
    // A changed fixture: one more exceptional year (2019), weight 3 for the recent years, an 8-year horizon,
    // a band of normal years only.
    const changed = { ...base, horizonEnd: 2033, settings: { ...base.settings, exceptional_years: [2019, 2020, 2021, 2022, 2023, 2024], weight_post: 3, horizon_years: 8, band_includes_exceptional: false } };
    const t2 = methodText(projectionMethod(changed));
    const moved = t2 !== t1 && t2.includes("We leave out 2019, 2020, 2021, 2022, 2023 and 2024") && t2.includes("2014, 2015, 2016, 2017 and 2018, at weight 1") && t2.includes("2025 weight 3") && t2.includes("8 years on") && t2.includes("any single normal year's rates since 2013") && !t2.includes("including 2019");
    return { pass: absent.length === 0 && moved, detail: fmt({ everySettingInText: absent.length ? `missing ${absent.join(" | ")}` : "yes", changedFixtureChangesText: moved }) };
  },
  // R-SMT-NOT-A-FORECAST: the wording rule. "forecast" only in "not a forecast", never "your roll", and
  // the method note's sentences, word for word, in SMT_NOTES (locked) and on the forward views.
  async smtNotAForecast() {
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const notes = Object.values(SMT_NOTES).join(" ");
    const c = await smtContextCase("110110", "around", "gcse");
    let text = Object.values(c.notes).join(" ");
    for (const dv of ["DV-SMT-C-NOW", "DV-SMT-C-PROJECTION", "DV-SMT-C-BIRTHS"]) text += " " + textOf(await smtRender("110110", dv, undefined, { context: c, contextMap: { state: "fallback", reason: "test" } }));
    const pupils = await smtPupilsCase("110110", "whole");
    text += " " + textOf(await smtRender("110110", "DV-SMT-P-AREA", undefined, { pupils }));
    const all = `${notes} ${text}`;
    const forecastOk = !/forecast/i.test(all.replace(/not a forecast/gi, ""));
    const rollOk = !/your roll/i.test(all);
    const locked = SMT_NOTES.wProjection === "A projection of children living in the area, not a forecast for the school." && SMT_NOTES.whatItIs.startsWith("It is the children living in the area, projected from children already counted");
    const shown = text.includes(SMT_NOTES.wProjection);
    return { pass: forecastOk && rollOk && locked && shown, detail: fmt({ forecastOnlyAsNot: forecastOk, noYourRoll: rollOk, notesLocked: locked, onTheViews: shown }) };
  },
  // ------------------------------------------------------------------ 0.8 SMT round 1
  async smtLevelChips() {
    const { levelChips, parseLevel } = await import("../src/lib/smt/levels");
    const chase = (await smtCase("137625")).school;
    const lp = (await smtCase("110110")).school;
    const chips = levelChips(chase.phases).join(",");
    const lpChips = levelChips(lp.phases).join(",");
    const fallback = parseLevel(new URLSearchParams("level=primary"), chase.phases, { gcse: chase.areas.gcse.map((a) => a.id), post16: chase.areas.post16.map((a) => a.id) });
    // The Chase's GCSE areas are the families it entered in the latest year.
    const { lookupAcademicSubjectFamily } = (await lib()).ref;
    const p = chase.latest.ks4!.period;
    const raw = (await lookupAcademicSubjectFamily({ entityIds: ["137625"], ksStage: "ks4", periodMin: p, periodMax: p })).filter((r) => Number(r.entries_total) > 0).map((r) => r.family_id).sort();
    const areasOk = JSON.stringify(chase.areas.gcse.map((a) => a.id).sort()) === JSON.stringify(raw);
    // 0.8 IGCSE subjects: Leighton Park's GCSE areas are offered; its incomplete ones under the short label.
    const lpLabels = lp.areas.gcse.map((a) => a.label);
    const lpAreasOk = lpLabels.includes("Sciences & Maths · no maths (IGCSE)") && lpLabels.includes("Languages & Literature · no English (IGCSE)") && lp.areas.gcse.filter((a) => a.igcseNote).length === 2;
    const pass = chips === "whole,gcse,post16" && lpChips === "whole,gcse,post16" && lp.phases.igcse === true && lpAreasOk && fallback.phase === "whole" && areasOk;
    return { pass, detail: fmt({ chase: chips, leighton: `${lpChips} (igcse=${lp.phases.igcse})`, leightonGcseAreas: lp.areas.gcse.length, primaryFallsBackTo: fallback.phase, chaseAreasMatchFamilies: areasOk }) };
  },
  async smtSetRanks() {
    const c = await smtCase("137625");
    const L = await lib();
    const row = c.overview.rows.find((r) => r.key === "attainment8_average")!;
    const p = row.period!;
    const urns = ["137625", ...c.set.urns];
    const heads = await L.ref.lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4", periodMin: p, periodMax: p });
    const { igcseAmong: igcseIn } = await import("../src/lib/igcse");
    const igcse = await igcseIn(urns);
    const vals = new Map(heads.filter((h) => !igcse.has(h.entity_id)).map((h) => [h.entity_id, Number(h.measures.attainment8_average)]).filter(([, v]) => Number.isFinite(v as number)) as [string, number][]);
    const mine = vals.get("137625")!;
    const rank = 1 + [...vals.values()].filter((v) => v > mine).length;
    const of = vals.size;
    const labelOk = /with GCSE results$/.test(row.set?.label ?? "");
    const pass = row.set?.rank === rank && row.set?.of === of && labelOk && row.england !== null;
    return { pass, detail: fmt({ value: row.value, scorecard: `${row.set?.rank} of ${row.set?.of}`, recomputed: `${rank} of ${of}`, igcseInSet: igcse.size, label: row.set?.label, england: row.england && `${row.england.rank} of ${row.england.of}` }) };
  },
  async igcseGroupLabel() {
    const { igcseAmong } = await import("../src/lib/igcse");
    const { igcseGroupLabelFor, igcseGroupNoteFor } = await import("../src/lib/igcse-words");
    const L = await lib();
    const ig = await igcseAmong(["110110", "137625"]);
    const rows = await L.adv.fetchSubjectHeadlineForSchools(["110110", "137625"], "ks4");
    const lp = rows.get("110110") ?? [], ch = rows.get("137625") ?? [];
    // Raw: Leighton Park's latest year holds no Mathematics and no English with entries.
    const latest = Math.max(...lp.map((r) => r.period));
    const held = new Set(lp.filter((r) => r.period === latest && r.entriesTotal > 0).map((r) => r.subject));
    const raw = !held.has("Mathematics") && !held.has("English Language") && !held.has("English Literature");
    const bio = igcseGroupLabelFor(lp, "Biology", ig.has("110110"));
    const latin = igcseGroupLabelFor(lp, "Latin", ig.has("110110"));
    const chase = igcseGroupLabelFor(ch, "Biology", ig.has("137625"));
    // 0.8 IGCSE subjects (follow-up 1): the short label everywhere, the full sentence in the (i).
    const bioNote = igcseGroupNoteFor(lp, "Biology", ig.has("110110")) ?? "";
    const pass = ig.has("110110") && !ig.has("137625") && raw
      && bio === "Sciences & Maths · no maths (IGCSE)"
      && latin === "Languages & Literature · no English (IGCSE)"
      && bioNote.includes("sciences only: maths taken as IGCSE")
      && chase === "Sciences & Maths" && igcseGroupNoteFor(ch, "Biology", false) === null;
    return { pass, detail: fmt({ lpIgcse: ig.has("110110"), latest, noMathsOrEnglish: raw, bio, latin, bioNote: bioNote.slice(0, 60), chase }) };
  },

  async igcseEverywhere() {
    const { igcseEngland } = await import("../src/lib/igcse");
    const { resolveRankingSet, resolveDefaultNearest, cachedRankingPopulation } = await import("../src/lib/chooser-sets");
    const { defaultRankingFilters, matchesRanking, NATIONAL } = await import("../src/lib/comparator-chooser");
    const { subjectRanking } = await import("../src/lib/subject-ranking");
    const { headlinePlaces, headlinePopulation } = await import("../src/lib/admissions/ranks");
    const { placesOn, population } = await import("../src/lib/smt/population");
    const { igcseExcluded } = await import("../src/lib/smt/overview");
    const L = await lib();
    const ig = await igcseEngland();
    const nat = defaultRankingFilters(NATIONAL);
    // Teacher's headline ranking: the IGCSE school unranked, said; a GCSE school's sample and "out of" clear of them.
    const lpRank = await resolveRankingSet("110110", "Leighton Park School", "ks4", nat, null);
    const kw = await resolveRankingSet("137625", "The Chase", "ks4", nat, null);
    const pop = (await cachedRankingPopulation(null, "ks4", null)).filter((r) => matchesRanking(r, nat)).map((r) => r[0]);
    const heads = await L.ref.lookupAcademicHeadline({ entityIds: pop, ksStage: "ks4" });
    const withFigure = new Set(heads.filter((h) => Number.isFinite(Number(h.measures.attainment8_average))).map((h) => h.entity_id));
    const teacher = {
      lpUnranked: lpRank.targetRank === null && !!lpRank.targetIgcse && /not ranked at GCSE \(IGCSE\)/.test(lpRank.note ?? ""),
      sampleClear: kw.rows.every((r) => !ig.has(r.urn)) && lpRank.rows.every((r) => r.isTarget || !ig.has(r.urn)) && !kw.targetIgcse,
      outOf: kw.ranked === Array.from(withFigure).filter((u) => !ig.has(u)).length && (kw.igcseOut ?? 0) > 0 && /not ranked at GCSE \(mostly IGCSE\)/.test(kw.note ?? ""),
    };
    // 0.8 IGCSE subjects: narrowed to whole-school measures and incomplete subject groups. A subject group
    // across schools leaves an IGCSE school out only where the group is incomplete at it (Leighton Park's
    // Sciences & Maths: no GCSE maths); single subjects are R-IGCSE-SUBJECT's.
    const { familyPlaces } = await import("../src/lib/admissions/ranks");
    const fp = Math.max(...heads.map((h) => h.period));
    const famSci = await familyPlaces("ks4", fp, "sciences_maths", ["110110", "137625"], 10);
    const subject = { lpSciencesOut: famSci.get("110110")!.national === null, chaseSciencesIn: famSci.get("137625")!.national !== null, notSubjectRule: typeof subjectRanking === "function" };
    // Admissions' and SMT's national places: the same population less the IGCSE schools.
    const period = Math.max(...heads.map((h) => h.period));
    const hp = await headlinePopulation("ks4", period);
    const popN = Array.from(hp.keys()).filter((u) => hp.get(u)?.get(period) != null && !ig.has(u)).length;
    const adm = await headlinePlaces("ks4", period, ["110110", "137625"]);
    const sp = await population("ks4");
    const smt = await placesOn(sp, period, "attainment8_average", ["110110", "137625"], await igcseExcluded());
    const places = {
      admLp: adm.get("110110")!.national === null, admOf: adm.get("137625")!.national?.of === popN,
      smtLp: smt.get("110110")!.national === null, smtOf: (smt.get("137625")!.national?.of ?? 0) > 0 && (smt.get("137625")!.national?.of ?? 0) < Array.from(sp.keys()).filter((u) => sp.get(u)?.get(period)?.attainment8_average != null).length,
    };
    // 10 nearest at GCSE: 10, none IGCSE; where it filled past them, the reach is named.
    const near = await Promise.all(["110110", "117037", "137625"].map((u) => resolveDefaultNearest(u, "ks4")));
    const nearest = { ten: near.every((n) => n.count === 10 && n.rows.filter((r) => !r.isTarget).length === 10), clear: near.every((n) => n.rows.every((r) => r.isTarget || !ig.has(r.urn))), reach: /nearest eligible reach \d+ km/.test(near[0].note ?? "") && near[2].note === null };
    const all = [teacher, subject, places, nearest].flatMap((o) => Object.values(o));
    return { pass: all.every(Boolean) && ig.has("110110"), detail: fmt({ igcseEngland: ig.size, teacher: JSON.stringify(teacher), families: JSON.stringify(subject), places: JSON.stringify(places), nearest: JSON.stringify(nearest), kwOutOf: `${kw.ranked} vs ${Array.from(withFigure).filter((u) => !ig.has(u)).length}`, lpNote: lpRank.note, nearLp: near[0].note }) };
  },
  async igcseSubject() {
    // 0.8 IGCSE subjects (R-IGCSE-SUBJECT): Leighton Park and King's Worcester, IGCSE schools both.
    const { igcseAmong, igcseFamiliesOut } = await import("../src/lib/igcse");
    const { igcseGroupNoteFor, igcseTakenAsIgcse } = await import("../src/lib/igcse-words");
    const { resolveRankingSet, resolveDefaultNearest, cachedRankingPopulation } = await import("../src/lib/chooser-sets");
    const { defaultRankingFilters, matchesRanking, NATIONAL } = await import("../src/lib/comparator-chooser");
    const { subjectRanking } = await import("../src/lib/subject-ranking");
    const { familyPlaces, headlinePopulation } = await import("../src/lib/admissions/ranks");
    const { placesOn, population } = await import("../src/lib/smt/population");
    const { igcseExcluded } = await import("../src/lib/smt/overview");
    const L = await lib();
    const ig = await igcseAmong(["110110", "117037", "137625"]);
    const nat = defaultRankingFilters(NATIONAL);
    const pop = (await cachedRankingPopulation(null, "ks4", null)).filter((r) => matchesRanking(r, nat)).map((r) => r[0]);
    const rankIn = async (urn: string, subject: string) => (await subjectRanking({ urns: pop, targetUrn: urn, phase: "ks4", subject, familyId: null, qualificationType: null, measure: { kind: "points" }, period: null }, "rule:igcse-subject:nation"));
    const rows = await L.adv.fetchSubjectHeadlineForSchools(["110110", "117037"], "ks4");
    const latestOf = (u: string) => Math.max(...(rows.get(u) ?? []).map((r) => r.period));
    const held = (u: string) => new Set((rows.get(u) ?? []).filter((r) => r.period === latestOf(u) && r.entriesTotal > 0).map((r) => r.subject));
    const period = latestOf("110110");
    const hp = await headlinePopulation("ks4", period);
    const sp = await population("ks4");
    const out: Record<string, unknown> = {};
    const ok: boolean[] = [ig.has("110110"), ig.has("117037"), !ig.has("137625")];
    // Ranked in the subjects each entered as GCSE: Leighton Park's five, King's Worcester's held ones.
    const lpSubjects = ["Biology", "Chemistry", "Physics", "Art and Design", "Combined Science"];
    const kwSubjects = ["Art and Design", "History", "Geography"].filter((x) => held("117037").has(x));
    for (const [u, list] of [["110110", lpSubjects], ["117037", kwSubjects]] as const) {
      for (const sub of list) {
        const r = await rankIn(u, sub);
        out[`${u}:${sub}`] = r.targetRank === null ? "unranked" : `${r.targetTied ? "=" : ""}${r.targetRank} of ${r.ranked}`;
        ok.push(r.targetRank !== null && !r.targetIgcse && r.window.some((w) => w.urn === u));
      }
    }
    ok.push(kwSubjects.length > 0);
    // Never inferred for a subject it simply doesn't take: King's Worcester has no GCSE Biology, and
    // Biology isn't "taken as IGCSE" -- there's no figure, so no rank, and nothing claims IGCSE.
    ok.push(!held("117037").has("Biology") && !igcseTakenAsIgcse(true, held("117037")).has("Biology") && (await rankIn("117037", "Biology")).targetRank === null);
    // Not ranked: Attainment 8, English and maths, Sciences & Maths, English (Languages & Literature).
    const a8 = await resolveRankingSet("110110", "Leighton Park School", "ks4", nat, null);
    const em = await placesOn(sp, period, "engmath_95_percent", ["110110", "117037"], await igcseExcluded());
    const fams = await Promise.all(["sciences_maths", "languages_literature", "humanities_social"].map((f) => familyPlaces("ks4", period, f, ["110110", "117037"], 10)));
    const fo = await igcseFamiliesOut();
    ok.push(a8.targetRank === null && !!a8.targetIgcse);
    ok.push(em.get("110110")!.national === null && em.get("117037")!.national === null);
    for (const u of ["110110", "117037"]) ok.push(fams[0].get(u)!.national === null && fams[1].get(u)!.national === null);
    // King's Worcester's humanities are complete: ranked in that group.
    ok.push(fams[2].get("117037")!.national !== null && !(fo.get("117037")?.[String(period)] ?? []).includes("humanities_social"));
    // The label's sentence; the population count includes IGCSE schools with the subject as GCSE.
    const note = igcseGroupNoteFor(rows.get("110110") ?? [], "Biology", true) ?? "";
    ok.push(note.includes("sciences only: maths taken as IGCSE"));
    const bio = await rankIn("137625", "Biology");
    ok.push(bio.window.length > 0 && (await rankIn("110110", "Biology")).ranked === bio.ranked);
    // "10 nearest" for a subject: Leighton Park's set has IGCSE schools back for their GCSE subjects; the
    // whole-school ten still has none.
    const igAll = await (await import("../src/lib/igcse")).igcseEngland();
    const near = await resolveDefaultNearest("110110", "ks4");
    const subjectIgcse = (near.subjectRows ?? []).filter((r) => !r.isTarget && igAll.has(r.urn)).length;
    ok.push(near.rows.every((r) => r.isTarget || !igAll.has(r.urn)) && subjectIgcse > 0 && (near.subjectRows ?? []).filter((r) => !r.isTarget).length === near.count);
    Object.assign(out, {
      a8: a8.targetIgcse ? "IGCSE, unranked" : a8.targetRank, em: `${em.get("110110")!.national} / ${em.get("117037")!.national}`,
      sciences: `${fams[0].get("110110")!.national} / ${fams[0].get("117037")!.national}`, english: `${fams[1].get("110110")!.national} / ${fams[1].get("117037")!.national}`,
      kwHumanities: JSON.stringify(fams[2].get("117037")!.national), nearSubjectIgcse: subjectIgcse, biologyRanked: bio.ranked, popN: hp.size,
    });
    return { pass: ok.every(Boolean), detail: fmt(out) + ` checks=${ok.map((b) => (b ? 1 : 0)).join("")}` };
  },
  async smtIgcse() {
    const c = await smtCase("110110");
    const { setPhaseOf } = await import("../src/lib/smt/levels");
    const { SMT_NOTES, smtNote } = await import("../src/catalogue/notes");
    const g = c.overview.rows.filter((r) => r.stage === "ks4");
    const a = c.overview.rows.find((r) => r.key === "A level::aps_per_entry");
    const academic = await smtAcademicCase("110110", "level=gcse&mode=results");
    // 0.8 IGCSE subjects: only the whole-school views keep the note (column 1 at GCSE, all areas).
    const html = textOf(await smtRender("110110", "DV-SMT-A-NOW", academic));
    const sc = textOf(await smtRender("110110", "DV-SMT-O-SCORECARD"));
    // 0.8 SMT feedback round 1 (R-SCORECARD-ROWS-BY-TYPE): the Scorecard leaves the GCSE rows out.
    const pass = g.length === 0 && c.overview.igcse && !!a?.set && setPhaseOf(c.school.phases) === "ks5" && html.includes(smtNote("igcseView", { school: c.school.name })) && !/Attainment 8|IGCSE not ranked/.test(sc) && !!SMT_NOTES.igcseChip;
    return { pass, detail: fmt({ gcseRows: g.length, alevelRank: a?.set && `${a.set.rank} of ${a.set.of}`, setPhase: setPhaseOf(c.school.phases), gcseViewSaysWhy: html.includes("sits IGCSEs"), scorecardGcse: /Attainment 8|IGCSE not ranked/.test(sc) }) };
  },
  async smtP8() {
    const chase = (await smtCase("137625")).overview.p8;
    const lp = (await smtCase("110110")).overview.p8;
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const pass = chase.status === "published" && chase.period === 2023 && Math.abs(chase.value - 0.08) < 1e-9 && /2024\/25/.test(chase.text) && lp.status === "independent" && lp.text === SMT_NOTES.p8Independent;
    return { pass, detail: fmt({ chase: chase.status === "published" ? `${chase.value} (${chase.period}) "${chase.text}"` : chase.status, leighton: `${lp.status} "${lp.text}"` }) };
  },
  async smtVa() {
    // 0.8 SMT Academic: column 1's A-level value added at Post-16 is DfE's headline, its range and band.
    const a = await smtAcademicCase("137625", "level=post16&mode=va&group=alevel");
    const L = await lib();
    const latest = (await smtCase("137625")).school.latest.ks5!.period;
    const raw = (await L.ref.lookupAcademicHeadline({ entityIds: ["137625"], ksStage: "ks5", periodMin: latest, periodMax: latest }))[0]?.measures ?? {};
    const r = a.lines.find((x) => x.key === "alevel");
    const html = textOf(await smtRender("137625", "DV-SMT-A-NOW", a));
    const pass = !!r && r.value === Number(raw["A level::value_added"]) && r.lo === Number(raw["A level::value_added_lower_ci"]) && r.hi === Number(raw["A level::value_added_upper_ci"]) && String(r.band).toLowerCase() === String(raw["A level::progress_banding"]).toLowerCase() && html.includes("A level") && a.board.unit === "va" && a.board.rows.every((x) => x.value === null || (x.lo !== null && x.hi !== null));
    return { pass, detail: fmt({ va: r && `${r.value} (${r.lo} to ${r.hi}) ${r.band}`, raw: `${raw["A level::value_added"]} (${raw["A level::value_added_lower_ci"]} to ${raw["A level::value_added_upper_ci"]}) ${raw["A level::progress_banding"]}` }) };
  },

  async smtYears() {
    const c = await smtCase("137625");
    const a8 = c.overview.rows.find((r) => r.key === "attainment8_average")!;
    const today = a8.period === c.school.latest.ks4!.period;
    // No year literal in an SMT source line (comments aside).
    const { readdirSync, readFileSync } = await import("node:fs");
    const files = ["src/lib/smt", "src/components/smt", "src/components/smt/views"].flatMap((d) => readdirSync(path.join(ROOT, d)).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => path.join(ROOT, d, f)));
    const literal: string[] = [];
    for (const f of files)
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*(\/\*\*?|\*).*$/, "");
        if (/\b20[12]\d\/\d\d\b|\b20(19|2[0-9])\b/.test(code) && !/LAST_P8_PERIOD = 2023/.test(code)) literal.push(`${path.basename(f)}:${i + 1}`);
      });
    // The rehearsal: a synthetic GCSE 2025/26 (provisional) in a child process.
    const { execFileSync } = await import("node:child_process");
    const script = path.join(ROOT, "scripts/year-rehearsal/smt-rehearsal-check.mts");
    let rehearsal = "";
    try {
      rehearsal = execFileSync("npx", ["-y", "tsx", "--env-file=.env", "--import=./scripts/year-rehearsal/install-ks4-2025.ts", script], { cwd: ROOT, encoding: "utf8", timeout: 900_000, stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").at(-1) ?? "";
    } catch (e) {
      rehearsal = `error ${subprocessError(e)}`;
    }
    const r = (() => { try { return JSON.parse(rehearsal) as { a8: number; aps: number; provisional: boolean }; } catch { return null; } })();
    // 0.8 SMT r3: ONS adds an LSOA mid-year (install-lsoa-next.ts): Context moves to it with no code change.
    const ctx = await smtContextCase("137625", "around", "gcse");
    let lsoa = "";
    try {
      lsoa = execFileSync("npx", ["-y", "tsx", "--env-file=.env", "--import=./scripts/year-rehearsal/install-lsoa-next.ts", path.join(ROOT, "scripts/year-rehearsal/smt-context-rehearsal-check.mts")], { cwd: ROOT, encoding: "utf8", timeout: 900_000, stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").at(-1) ?? "";
    } catch (e) {
      lsoa = `error ${subprocessError(e)}`;
    }
    const l = (() => { try { return JSON.parse(lsoa) as { children: number; byAge: number; sources: number; nearbyLast: number }; } catch { return null; } })();
    const next = (ctx.now.children.year ?? 0) + 1;
    const lsoaOk = !!l && l.children === next && l.byAge === next && l.sources === next && l.nearbyLast === next;
    const pass = today && literal.length === 0 && !!r && r.a8 === 2025 && r.aps === c.school.latest.ks5!.period && r.provisional && lsoaOk;
    return { pass, detail: fmt({ todayA8: a8.period, latestKs4: c.school.latest.ks4!.period, yearLiterals: literal.join(" ") || "none", rehearsal: r ? `A8 ${r.a8}, Post-16 ${r.aps}, provisional=${r.provisional}` : rehearsal, lsoaRehearsal: l ? `today mid-${ctx.now.children.year}; with a new year: children ${l.children}, by age ${l.byAge}, sources ${l.sources}, nearby to ${l.nearbyLast}` : lsoa }) };
  },
  async smtBoardingOnly() {
    // 0.8 SMT Academic: rewritten for no pills (R-SMT-NO-PILLS) -- boarding shows only at a boarding school.
    const { smtHasContent } = await import("../src/components/smt/content");
    const chase = await smtCase("137625");
    const lp = await smtCase("110110");
    const [chaseP, lpP] = await Promise.all([smtPupilsCase("137625"), smtPupilsCase("110110")]);
    const has = (c: { school: import("../src/lib/smt/school").SmtSchool }, p: import("../src/lib/smt/pupils").Pupils, dv: string) => smtHasContent(dv, { school: c.school, dash: "pupils", level: { phase: "whole", area: null }, pupils: { status: "ready", data: p } } as never);
    const chaseOk = !chase.school.boarding && !chase.overview.rows.some((r) => r.key === "boarders") && chase.overview.trends.roll.lines.every((l) => l.key !== "boarding" && l.key !== "day") && chaseP.dayBoarding === null && chaseP.now.boarding === null && !has(chase, chaseP, "DV-SMT-P-DAY-BOARDING");
    const lpOk = lp.school.boarding && lp.overview.rows.some((r) => r.key === "boarders") && lp.overview.trends.roll.lines.some((l) => l.key === "boarding") && !!lpP.dayBoarding && lpP.dayBoarding.now.boarders > 0 && has(lp, lpP, "DV-SMT-P-DAY-BOARDING");
    return { pass: chaseOk && lpOk, detail: fmt({ chaseBoardersRow: chase.overview.rows.some((r) => r.key === "boarders"), chaseLines: chase.overview.trends.roll.lines.map((l) => l.key).join("/"), chaseDayBoardingView: has(chase, chaseP, "DV-SMT-P-DAY-BOARDING"), leightonBoardersRow: lp.overview.rows.some((r) => r.key === "boarders"), leightonLines: lp.overview.trends.roll.lines.map((l) => l.key).join("/"), leightonBoarders: lpP.dayBoarding ? `${lpP.dayBoarding.now.boarders} (${round(lpP.dayBoarding.now.share, 1)}%)` : null }) };
  },
  async smtNoPills() {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { smtHasContent } = await import("../src/components/smt/content");
    const { buildOverview } = await import("../src/lib/smt/overview");
    const { buildPupils, girlsShare, countsAsMixed } = await import("../src/lib/smt/pupils");
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { percentile } = await import("../src/lib/admissions/stats");
    // 1. No SMT source draws a sex or boarding pill or threads the filters (comments aside).
    const files = ["src/components/smt", "src/components/smt/views", "src/lib/smt", "src/app/api/smt/overview", "src/app/api/smt/pupils"].flatMap((d) => readdirSync(path.join(ROOT, d)).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(ROOT, d, f)));
    const pill: string[] = [];
    for (const f of files)
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*(\/\*\*?|\*).*$/, "");
        if (/SmtFilters|pillsFor|DEFAULT_SMT_FILTERS|label="Pupils"|label="Day and boarding"|"All pupils"|"Boarding only"|"Day only"|sex: "all"|boarding: "all"|\bc\.filters\b/.test(code)) pill.push(`${path.relative(ROOT, f)}:${i + 1}`);
      });
    const arity = buildOverview.length === 3 && buildPupils.length === 4;
    // 2. Leighton Park (boarding, mixed): both views, with figures and rail icons.
    const lp = await smtCase("110110");
    const lpP = await smtPupilsCase("110110");
    const ctx = (c: { school: import("../src/lib/smt/school").SmtSchool }, p: import("../src/lib/smt/pupils").Pupils | null) => ({ school: c.school, dash: "pupils", level: { phase: "whole", area: null }, pupils: p ? { status: "ready", data: p } : { status: "loading" } }) as never;
    const g = lpP.girlsBoys;
    const d = lpP.dayBoarding;
    const lpOk = !!g && g.years.length > 0 && g.years.every((y) => y.share !== null) && g.whole.change !== null && g.whole.set.change.schools > 0 && g.shifts.some((x) => x.key === "year7") && g.shifts.some((x) => x.key === "sixth") && !!d && d.years.length > 1 && d.set.boardingSchools > 0 && smtHasContent("DV-SMT-P-GIRLS-BOYS", ctx(lp, lpP)) && smtHasContent("DV-SMT-P-DAY-BOARDING", ctx(lp, lpP));
    const lpHtml = textOf(await smtRender("110110", "DV-SMT-P-GIRLS-BOYS", undefined, { pupils: lpP })) + textOf(await smtRender("110110", "DV-SMT-P-DAY-BOARDING", undefined, { pupils: lpP }));
    const drawn = /Girls['\u2019] share in each year group/.test(lpHtml) && /Where it shifts/.test(lpHtml) && /Boarders['\u2019] share of the roll/.test(lpHtml);
    // 3. Acland Burghley: the set's girls' share recomputed from the raw census and GIAS -- single-sex schools
    // left out, never counted as 0 (the third pill bug).
    const ab = await smtCase("100053");
    const abP = await smtPupilsCase("100053");
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const { data: gias } = await createServerAnonSupabaseClient().from("schools").select("urn, gender").in("urn", ab.set.urns);
    const genderOf = new Map(((gias ?? []) as { urn: string; gender: string | null }[]).map((r) => [r.urn, r.gender]));
    const census = await cachedCensus(ab.set.urns);
    const P = abP.girlsBoys?.year ?? -1;
    const mixed = ab.set.urns.filter((u) => countsAsMixed(genderOf.get(u), census.get(u)?.ageGenderByPeriod.get(P)));
    const singleSex = ab.set.urns.filter((u) => genderOf.get(u) === "Girls" || genderOf.get(u) === "Boys");
    const want = percentile(mixed.map((u) => girlsShare(census.get(u)!.ageGenderByPeriod.get(P))!), 50);
    const asZero = percentile(ab.set.urns.map((u) => (mixed.includes(u) ? girlsShare(census.get(u)!.ageGenderByPeriod.get(P))! : 0)), 50);
    const got = abP.girlsBoys?.whole.set.share;
    const abOk = !!got && got.median !== null && want !== null && Math.abs(got.median - want) < 1e-9 && got.schools === mixed.length && singleSex.length > 0 && singleSex.every((u) => !mixed.includes(u)) && abP.girlsBoys!.leftOut === ab.set.urns.length - mixed.length;
    // 4. A single-sex school (Parliament Hill, girls): no Girls and boys view, before or after the data loads.
    const ph = await smtCase("100050");
    const phP = await smtPupilsCase("100050");
    const phOk = !ph.school.mixed && phP.girlsBoys === null && !smtHasContent("DV-SMT-P-GIRLS-BOYS", ctx(ph, null)) && !smtHasContent("DV-SMT-P-GIRLS-BOYS", ctx(ph, phP));
    // 5. The Scorecard's Roll row: the whole roll, ranked on it (the first pill bug).
    const roll = lp.overview.rows.find((r) => r.key === "roll");
    const rollOk = !!roll && roll.label === "Roll" && roll.value === lp.school.census.at(-1)?.totalRoll;
    const pass = pill.length === 0 && arity && lpOk && drawn && abOk && phOk && rollOk;
    return {
      pass,
      detail: fmt({
        pillLines: pill.join(" ") || "none",
        builderArity: `${buildOverview.length}/${buildPupils.length}`,
        leightonGirls: g ? `${round(g.whole.share, 1)}% (${g.whole.baseYear}: ${round(g.whole.base, 1)}%, ${round(g.whole.change, 1)} pp; set ${round(g.whole.set.change.median, 1)} pp over ${g.whole.set.change.schools}); Y7 shift ${round(g.shifts.find((x) => x.key === "year7")?.shift, 1)} pp, sixth ${round(g.shifts.find((x) => x.key === "sixth")?.shift, 1)} pp; left out ${g.leftOut}` : null,
        leightonBoarding: d ? `${d.now.boarders} of ${d.now.boarders + d.now.day} (${round(d.now.share, 1)}%), ${round(d.change, 1)} pp since ${d.baseYear}; set ${round(d.set.share.median, 1)}% over ${d.set.boardingSchools} of ${d.set.of}` : null,
        drawn,
        aclandSetGirls: got ? `${round(got.median, 1)}% over ${got.schools} mixed (want ${round(want, 1)}%; as-zero would be ${round(asZero, 1)}%); single-sex ${singleSex.length}, left out ${abP.girlsBoys?.leftOut}` : null,
        parliamentHillView: smtHasContent("DV-SMT-P-GIRLS-BOYS", ctx(ph, phP)),
        rollRow: roll ? `${roll.label} ${roll.value}` : null,
      }),
    };
  },
  async smtFlags(L0) {
    const { expectedFor } = await import("./rule-year-fixtures");
    const want = expectedFor("R-SMT-FLAGS", await latestYearOf(L0, "ks4"));
    if (!want.ok) return { pass: false, detail: want.detail };
    const c = await smtCase("137625");
    const { SMT_FLAG_RULES } = await import("../src/lib/smt/flags-rules");
    const { percentile } = await import("../src/lib/admissions/stats");
    const { igcseAmong: igcseIn } = await import("../src/lib/igcse");
    const L = await lib();
    const latest = c.school.latest.ks4!.period;
    const from = Math.max(latest - 2, 2022);
    const urns = ["137625", ...c.set.urns];
    const rows = await L.ref.lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4", periodMin: from, periodMax: latest });
    const ig = await igcseIn(urns);
    const a8 = (u: string, y: number) => { const r = rows.find((x) => x.entity_id === u && x.period === y); const v = r ? Number(r.measures.attainment8_average) : NaN; return Number.isFinite(v) ? v : null; };
    const changes = c.set.urns.filter((u) => !ig.has(u)).map((u) => { const a = a8(u, from), b = a8(u, latest); return a === null || b === null ? null : b - a; }).filter((v): v is number => v !== null);
    const mine = a8("137625", latest)! - a8("137625", from)!;
    const gap = mine - percentile(changes, 50)!;
    const expect = Math.abs(gap) >= SMT_FLAG_RULES.resultsGap.ks4 && changes.length >= SMT_FLAG_RULES.resultsMinSchools;
    const got = c.overview.flags.some((f) => f.id === "results_rising" || f.id === "results_falling");
    const rollFlag = c.overview.flags.some((f) => /Roll falling/.test(f.label));
    // The app's flag equals the rule recomputed from raw rows, and both equal the year's expected value
    // (found with SQL); where the fixture holds the figures, they match too.
    const w = want.value as { flagged: boolean; change?: number; setMedian?: number };
    const figuresOk = (w.change === undefined || Math.abs(mine - w.change) < 0.01) && (w.setMedian === undefined || Math.abs(percentile(changes, 50)! - w.setMedian) < 0.01);
    const pass = got === expect && expect === w.flagged && figuresOk && !rollFlag;
    return { pass, detail: fmt({ change: round(mine, 2), setMedian: round(percentile(changes, 50), 2), gap: round(gap, 2), threshold: SMT_FLAG_RULES.resultsGap.ks4, schools: changes.length, flagged: got, expectedFlag: w.flagged, rollFalling: rollFlag }) };
  },
  async smtNotes() {
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const html = textOf(await smtRender("110110", "DV-SMT-O-NOW")) + textOf(await smtRender("110110", "DV-SMT-O-SCORECARD"));
    // No SMT component copies a SMT_NOTES sentence (each is read from the notes file).
    const { readdirSync, readFileSync } = await import("node:fs");
    const files = ["src/components/smt", "src/components/smt/views"].flatMap((d) => readdirSync(path.join(ROOT, d)).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(ROOT, d, f)));
    const copies: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const [k, v] of Object.entries(SMT_NOTES)) if (v.length > 40 && src.includes(v.slice(0, 40))) copies.push(`${path.basename(f)}:${k}`);
    }
    // 0.8 SMT feedback round 1 (R-INDEP-ENTRY-TILES): an independent school's Progress 8 and IGCSE tiles give
    // way to its entry tiles; the Progress 8 reason is the (i)'s (captionOf, from p8.text), and the IGCSE
    // line is the Scorecard's (i) (SMT_NOTES.igcseView).
    const c = await smtCase("110110");
    const entry = /data-entry-tile="join11"/.test(await smtRender("110110", "DV-SMT-O-NOW")) && /data-entry-tile="net16"/.test(await smtRender("110110", "DV-SMT-O-NOW"));
    const pass = c.overview.p8.text === SMT_NOTES.p8Independent && entry && !/Not published|IGCSE school/.test(html) && copies.length === 0;
    return { pass, detail: fmt({ p8Reason: c.overview.p8.text === SMT_NOTES.p8Independent, entryTiles: entry, oldTilesGone: !/Not published|IGCSE school/.test(html), copiedSentences: copies.join(" ") || "none" }) };
  },
  async smtSubjects() {
    // 0.8 SMT Academic: the subject areas' subjects (GCSE Sciences & Maths): under 5 entries listed, not
    // ranked; Biology's place recomputed from the set's own rollup rows.
    const a = await smtAcademicCase("137625", "level=gcse&mode=results&area=sciences_maths");
    const { MIN_SUBJECT_ENTRIES } = await import("../src/lib/smt/academic");
    const subs = a.areas.blocks.flatMap((b) => b.quals.flatMap((q) => q.subjects));
    const small = subs.filter((x) => x.entries < MIN_SUBJECT_ENTRIES);
    const bio = subs.find((x) => x.subject === "Biology");
    const L = await lib();
    const y = a.areas.period!;
    const rows = await L.ref.lookupAcademicSubjectHeadline({ entityIds: a.set.urns, ksStage: "ks4", periodMin: y, periodMax: y, bucket: "all" });
    const peers = rows.filter((r) => r.subject === "Biology" && Number(r.entries_total) >= MIN_SUBJECT_ENTRIES && r.avg_point_score !== null).map((r) => Number(r.avg_point_score));
    const want = bio && bio.value !== null ? { rank: 1 + peers.filter((v) => v > bio.value!).length, of: peers.length + 1 } : null;
    const pass = small.every((x) => !x.ranked && x.place === null) && !!bio && !!want && bio.place?.rank === want.rank && bio.place?.of === want.of;
    return { pass, detail: fmt({ subjects: subs.length, unrankedSmall: small.map((x) => `${x.subject}(${x.entries})`).join(" ") || "none", biology: bio && `${bio.value} ${bio.place?.rank} of ${bio.place?.of}`, recomputed: want && `${want.rank} of ${want.of}` }) };
  },

  async smtViewNow() {
    const c = await smtCase("137625");
    const n = c.overview.now;
    const census = c.school.census.at(-1)!;
    const pass = n.roll === census.totalRoll && (n.girls ?? 0) + (n.boys ?? 0) === census.totalRoll && n.sizes.map((b) => b.key).join() === census.byAgeBand.filter((b) => b.total > 0 && ["early_years", "primary", "secondary", "sixth_form"].includes(b.key)).map((b) => b.key).join();
    return { pass, detail: fmt({ roll: n.roll, census: census.totalRoll, girlsPlusBoys: (n.girls ?? 0) + (n.boys ?? 0), bands: n.sizes.map((b) => `${b.key}:${b.badge}`).join(" ") }) };
  },
  async smtViewMap() {
    const c = await smtCase("137625");
    const located = Object.values(c.overview.schools).filter((s) => s.easting !== null && s.northing !== null).length;
    const pass = Object.keys(c.overview.schools).length === c.set.urns.length + 1 && located >= c.set.urns.length;
    return { pass, detail: fmt({ schools: Object.keys(c.overview.schools).length, located, set: c.set.urns.length }) };
  },
  async smtViewTrends() {
    const c = await smtCase("137625");
    const roll = c.overview.trends.roll;
    const base = roll.base;
    const at100 = roll.lines.every((l) => Math.abs((l.pts.find((p) => p.year === base)?.value ?? 0) - 100) < 1e-9);
    const t = c.overview.trends.results.find((x) => x.stage === "ks4")!;
    const L = await lib();
    const { igcseAmong: igcseIn } = await import("../src/lib/igcse");
    const { percentile } = await import("../src/lib/admissions/stats");
    const ig = await igcseIn(c.set.urns);
    const y = c.school.latest.ks4!.period;
    const rows = await L.ref.lookupAcademicHeadline({ entityIds: c.set.urns, ksStage: "ks4", periodMin: y, periodMax: y });
    const vals = rows.filter((r) => !ig.has(r.entity_id)).map((r) => Number(r.measures.attainment8_average)).filter(Number.isFinite);
    const b = t.band.find((x) => x.year === y)!;
    const html = textOf(await smtRender("137625", "DV-SMT-O-ROLL-LINE"));
    const pass = at100 && b.n === vals.length && b.p25 === percentile(vals, 25) && b.p75 === percentile(vals, 75) && /Roll, indexed/.test(html);
    return { pass, detail: fmt({ base, linesAt100: at100, band: `${round(b.p25, 2)}-${round(b.p75, 2)} (${b.n})`, recomputed: `${round(percentile(vals, 25), 2)}-${round(percentile(vals, 75), 2)} (${vals.length})` }) };
  },
  async smtAcademicNow() {
    // 0.8 SMT Academic: Leighton Park's Post-16 lines in Results.
    const a = await smtAcademicCase("110110", "level=post16&mode=results&group=alevel");
    const L = await lib();
    const p = a.period!;
    const raw = (await L.ref.lookupAcademicHeadline({ entityIds: ["110110"], ksStage: "ks5", periodMin: p, periodMax: p }))[0]?.measures ?? {};
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const al = a.lines.find((l) => l.key === "alevel");
    const epq = a.lines.find((l) => l.key === "epq");
    const keys = a.lines.map((l) => l.key).join(",");
    const pass = !!al && al.value === Number(raw["A level::aps_per_entry"]) && al.grade === raw["A level::aps_per_entry_grade"] && !!al.place && !!epq && epq.value === null && epq.why === SMT_NOTES.acEpqNoPoints && /applied:ag/.test(keys) && /applied:tl/.test(keys);
    return { pass, detail: fmt({ lines: keys, alevel: al && `${al.value} ${al.grade} ${al.place?.rank} of ${al.place?.of}`, epq: epq?.why }) };
  },

  async smtAreas() {
    // 0.8 SMT Academic: Acland Burghley's value added by subject area, by qualification.
    const a = await smtAcademicCase("100053", "level=post16&mode=va&group=all");
    const sci = a.areas.blocks.find((b) => b.id === "sciences_maths");
    const qual = (q: RegExp) => sci?.quals.find((x) => q.test(x.qualification));
    const maths = qual(/^GCE A level$/)?.subjects.find((s) => s.subject === "Mathematics");
    const appSci = qual(/^BTEC/)?.subjects.find((s) => /Applied Science/.test(s.subject));
    const art = a.areas.blocks.flatMap((b) => b.quals).find((q) => q.qualification === "GCE A level" && q.subjects.some((s) => s.subject === "Art and Design"))?.subjects.find((s) => s.subject === "Art and Design");
    const epqOut = a.areas.outside.length > 0 && !a.areas.blocks.some((b) => b.quals.some((q) => /^Extended Project/.test(q.qualification)));
    const pass = !!maths && maths.entries === 23 && Math.abs((maths.value ?? 0) + 0.14) < 1e-9 && !!appSci && Math.abs((appSci.value ?? 0) - 0.43) < 1e-9 && !!art?.vicdata && epqOut;
    return { pass, detail: fmt({ areas: a.areas.blocks.map((b) => b.label).join(" / "), maths: maths && `${maths.entries} ${maths.value}`, appliedScience: appSci && `${appSci.entries} ${appSci.value}`, artVicdata: !!art?.vicdata, epqOutside: epqOut }) };
  },

  async smtGrades() {
    const a = await smtAcademicCase("137625", "level=gcse&mode=results");
    const g = a.grades[0];
    const sum = g ? g.bands.reduce((s, b) => s + b.entries, 0) : 0;
    const pct = g ? g.bands.reduce((s, b) => s + b.pct, 0) : 0;
    const pass = !!g && g.entries > 0 && sum === g.entries && Math.abs(pct - 100) < 1e-6 && g.top !== null;
    return { pass, detail: fmt({ graded: g?.entries, bandsSum: sum, pct: round(pct, 4), top: g?.top && `${g.top.label} ${round(g.top.pct, 1)}%` }) };
  },

  async smtReserved() {
    // Superseded (R-SMT-ACADEMIC-MODES): the reserved "results by band" panel is gone from Academic.
    const { SMT_DASHBOARDS } = await import("../src/catalogue/dashboards/smt");
    const views = SMT_DASHBOARDS.flatMap((d) => d.panels.flatMap((p) => p.dataviews.map((v) => (v.kind === "view" ? v.dataview : ""))));
    const pass = !views.includes("DV-SMT-A-BANDS");
    return { pass, detail: fmt({ bandsPanel: views.includes("DV-SMT-A-BANDS") ? "still there" : "gone" }) };
  },


  // ------------------------------------------------------------ 0.8 SMT Academic by qualification
  async smtAcademicModes() {
    const res = await smtAcademicCase("110110", "level=post16&mode=results&group=alevel");
    const ent = await smtAcademicCase("110110", "level=post16&mode=entries&group=alevel");
    const va = await smtAcademicCase("110110", "level=post16&mode=va&group=alevel");
    const you = (a: typeof res) => a.board.rows.find((r) => r.you)!;
    const { SMT_DASHBOARDS } = await import("../src/catalogue/dashboards/smt");
    const views = SMT_DASHBOARDS.flatMap((d) => d.panels.flatMap((p) => p.dataviews.map((v) => (v.kind === "view" ? v.dataview : ""))));
    const gone = !(["DV-SMT-A-VA", "DV-SMT-A-SUBJECTS", "DV-SMT-A-BANDS"] as const).some((v) => views.includes(v));
    const pass = res.board.unit === "points" && res.board.median !== null && ent.board.unit === "share" && you(ent).entries !== null && va.board.unit === "va" && you(va).lo !== null && you(va).hi !== null && gone && SMT_DASHBOARDS.length === 4;
    return { pass, detail: fmt({ results: `${you(res).value} ${res.board.place.set?.rank} of ${res.board.place.set?.of}, median ${round(res.board.median, 2)}`, entries: `${round(you(ent).value, 1)}% (${you(ent).entries} entries)`, va: `${you(va).value} (${you(va).lo} to ${you(va).hi}) ${you(va).band}`, oldViewsGone: gone }) };
  },
  async smtQualGroups() {
    const { academicOffer } = await import("../src/lib/smt/academic");
    const { groupChips, parseAcademic } = await import("../src/lib/smt/qual-groups");
    const pm = await academicOffer((await smtCase("100183")).school);
    const sv = await academicOffer((await smtCase("118952")).school);
    const lpo = await academicOffer((await smtCase("110110")).school);
    const whole = parseAcademic(new URLSearchParams("level=whole"), lpo);
    const pass = groupChips(pm.groups)[0] === "all" && pm.groups.includes("applied") && pm.applied.length === 2 && groupChips(sv.groups).join() === "ib" && whole.phase === lpo.main;
    return { pass, detail: fmt({ plumstead: groupChips(pm.groups).join(" "), applied: pm.applied.join(" "), sevenoaks: groupChips(sv.groups).join(" "), leightonWhole: `${whole.phase} (main ${lpo.main})` }) };
  },
  async smtGroupSets() {
    const a = await smtAcademicCase("118952", "level=post16&mode=results&group=ib");
    const { offering } = await import("../src/lib/smt/academic-sets");
    const offers = await offering("ib", a.set.urns, a.period!);
    const c = await smtCase("118952");
    const chosen = await smtAcademicCase("118952", "level=post16&mode=results&group=ib", { kind: "saved", label: "Rule set", urns: c.set.urns });
    const pass = a.set.size === 10 && offers.size === a.set.size && /offering IB/.test(a.set.label) && (a.set.reachKm ?? 0) > 20 && chosen.set.chosen && !!chosen.board.setNote;
    return { pass, detail: fmt({ set: a.set.label, offerIb: `${offers.size} of ${a.set.size}`, reachKm: round(a.set.reachKm, 0), chosen: chosen.board.setNote }) };
  },
  async smtCol1Level() {
    const g = await smtAcademicCase("100053", "level=gcse&mode=va");
    const p = await smtAcademicCase("100053", "level=post16&mode=va&group=all");
    const pass = g.lines.length === 1 && g.lines[0].key === "p8" && p.lines.length >= 5 && !p.lines.some((l) => l.key === "p8") && p.lines.some((l) => l.key === "coremaths");
    return { pass, detail: fmt({ gcse: g.lines.map((l) => l.label).join(", "), post16: p.lines.map((l) => `${l.label} ${l.value}`).join(", ") }) };
  },
  async smtVaBands() {
    const { rangeBand, p8Band } = await import("../src/lib/smt/qual-groups");
    const edges = rangeBand(0.01, 0.5) === "Clearly above" && rangeBand(0, 0.5) === "In line" && rangeBand(-0.5, 0) === "In line" && rangeBand(-0.5, -0.01) === "Clearly below" && p8Band(0.51, 0.01, 1) === "Well above average" && p8Band(0.5, 0.01, 1) === "Above average" && p8Band(0.3, 0, 0.6) === "Average" && p8Band(-0.5, -1, -0.01) === "Below average" && p8Band(-0.51, -1, -0.01) === "Well below average";
    const a = await smtAcademicCase("100053", "level=post16&mode=va&group=all");
    const cm = a.lines.find((l) => l.key === "coremaths");
    const g = await smtAcademicCase("100053", "level=gcse&mode=va");
    const derived = g.board.rows.every((r) => r.value === null || r.band === p8Band(r.value, r.lo, r.hi));
    const pass = edges && cm?.band === "Clearly above" && derived;
    return { pass, detail: fmt({ edges, coreMaths: cm && `${cm.value} (${cm.lo} to ${cm.hi}) ${cm.band}`, p8Derived: derived }) };
  },
  async smtVaIndependent() {
    const a = await smtAcademicCase("110110", "level=gcse&mode=va");
    const england = await (await import("../src/lib/admissions/ranks")).englandSchools();
    const state = a.board.rows.filter((r) => !r.you).every((r) => england.get(r.urn)?.group !== "Independent schools" && r.value !== null);
    const me = a.board.rows.find((r) => r.you);
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const indep = Array.from(england.entries()).filter(([u, x]) => x.group === "Independent schools" && u !== "110110").slice(0, 3).map(([u]) => u);
    const none = await smtAcademicCase("110110", "level=gcse&mode=va", { kind: "saved", label: "Independents", urns: indep });
    const pass = a.set.size === 10 && state && !!me && me.value === null && me.why === SMT_NOTES.acIndependentP8 && a.trends.schoolLabel === null && none.board.empty === SMT_NOTES.acNoStateSchools;
    return { pass, detail: fmt({ set: a.set.label, allStateWithP8: state, ownRow: me?.why, noStateMessage: none.board.empty }) };
  },
  async vaSubjectMatch() {
    const { VA_SUBJECT_MATCHES, VA_SUBJECT_MATCHES_STATUS } = await import("../src/lib/smt/va-subject-matches");
    const L = await lib();
    const facts = await L.ref.lookupReferenceData({ sourceId: "dfe_ks5_subject_value_added", entityIds: ["100053", "110110", "100183", "118952"] });
    const names = new Set(facts.map((f) => f.breakdown.split("::").slice(0, 2).join("::")).filter((k) => !k.endsWith("::All subjects")));
    const missing = Array.from(names).filter((k) => !VA_SUBJECT_MATCHES[k]);
    const noArea = Object.entries(VA_SUBJECT_MATCHES).filter(([, m]) => !m.area && !m.outside).map(([k]) => k);
    const pass = missing.length === 0 && noArea.length === 0;
    return { pass, detail: fmt({ status: VA_SUBJECT_MATCHES_STATUS, names: Object.keys(VA_SUBJECT_MATCHES).length, fourSchoolsNamesUnlisted: missing.join("; ") || "none", withoutArea: noArea.join("; ") || "none" }) };
  },

  // ------------------------------------------------------------ 0.8 SMT feedback round 1
  async scorecardRows() {
    const lp = await smtCase("110110");
    const chase = await smtCase("137625");
    const { boardersByUrn } = await import("../src/lib/smt/overview");
    const { englandSchools, rankIn } = await import("../src/lib/admissions/ranks");
    const P = lp.school.census.at(-1)!.period;
    const b = lp.overview.rows.find((r) => r.key === "boarders");
    const all = await boardersByUrn(P);
    const own = lp.school.census.at(-1)!.boarding!.boarders;
    const eng = rankIn([...Array.from(all).filter(([u]) => u !== "110110").map(([, v]) => v), own], own);
    const region = (await englandSchools()).get("110110")?.regionName;
    const sc = await smtRender("110110", "DV-SMT-O-SCORECARD");
    const ks4 = (o: typeof lp.overview) => o.rows.filter((r) => r.stage === "ks4").map((r) => r.key);
    const pass = ks4(lp.overview).length === 0 && !!b && !!b.set && b.region?.name === region && region === "South East" && b.england?.rank === eng.rank && b.england?.of === eng.of && /<th[^>]*title="10 nearest with a sixth form or 16\+ provision"[^>]*>10 nearest<\/th>|<th[^>]*>10 nearest<\/th>/.test(sc.replace(/10 nearest schools/, "")) &&
      ["Attainment 8", "Grade 5+ in English and maths", "Progress 8"].every((l) => chase.overview.rows.some((r) => r.label === l && r.stage === "ks4")) && !chase.overview.rows.some((r) => r.key === "boarders");
    return { pass, detail: fmt({ leightonGcseRows: ks4(lp.overview).length, boarders: b && `${b.value}: set ${b.set?.rank}/${b.set?.of}, ${b.region?.name} ${b.region?.rank}/${b.region?.of}, England ${b.england?.rank}/${b.england?.of}`, recomputedEngland: `${eng.rank}/${eng.of}`, header: lp.overview.set.short, chaseRows: chase.overview.rows.map((r) => r.label).join("/") }) };
  },
  async trendPerCell() {
    const c = await smtCase("137625");
    const { population, figure, SMT_MEASURES } = await import("../src/lib/smt/population");
    const ks5 = await population("ks5");
    const row = (l: string) => c.overview.rows.find((r) => r.label === l);
    const va = row("A-level value added");
    const v = (p: number) => figure(ks5, "137625", p, SMT_MEASURES.ks5.va);
    const vaOk = !!va?.since && va.since.period === "2023/24 → 2024/25" && Math.abs(va.since.change - (v(2024)! - v(2023)!)) < 1e-9;
    const html = await smtRender("137625", "DV-SMT-O-SCORECARD");
    const pass = row("Attainment 8")?.since?.period === "since 2022/23" && vaOk && row("Progress 8")?.since?.period === "2022/23 → 2023/24" && row("Roll")?.since?.period === "since 2019/20" && />Trends</.test(html) && !/Since 2022\/23/.test(textOf(html)) && /2023\/24 → 2024\/25/.test(textOf(html));
    return { pass, detail: fmt({ a8: row("Attainment 8")?.since?.period, va: va?.since && `${va.since.period} ${round(va.since.change, 2)}`, recomputed: round((v(2024) ?? 0) - (v(2023) ?? 0), 2), p8: row("Progress 8")?.since?.period, roll: row("Roll")?.since?.period, header: />Trends</.test(html) }) };
  },
  async indepEntryTiles() {
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const lp = await smtCase("110110");
    const kw = await smtCase("117037");
    const ch = await smtCase("137625");
    const lpP = await smtPupilsCase("110110");
    const P = lp.school.census.at(-1)!.period;
    const t = (await cachedCensus(["110110"])).get("110110")!.table;
    const tk = (await cachedCensus(["117037"])).get("117037")!.table;
    const Pk = kw.school.census.at(-1)!.period;
    const e = lp.overview.now.entry ?? [];
    const j = e.find((x) => x.key === "join11");
    const n16 = e.find((x) => x.key === "net16");
    const leaving = lpP.leaving.at(-1)!;
    const k11 = kw.overview.now.entry?.find((x) => x.key === "net11");
    const chaseHtml = await smtRender("137625", "DV-SMT-O-NOW");
    const pass = j?.value === cohortAt(t, 11, P) && n16?.value === cohortAt(t, 16, P)! - cohortAt(t, 15, P - 1)! && n16.value === -(leaving.leaving ?? NaN) && leaving.year === P &&
      k11?.value === cohortAt(tk, 11, Pk)! - cohortAt(tk, 10, Pk - 1)! && ch.overview.now.entry === null && !/data-entry-tile/.test(chaseHtml) && /Attainment 8/.test(chaseHtml) && /Progress 8/.test(chaseHtml);
    return { pass, detail: fmt({ leighton: e.map((x) => `${x.label} ${x.value} (${round(x.since?.pct ?? null, 0)}% since ${x.since?.base})`).join("; "), leavingAt16: leaving.leaving, kings: (kw.overview.now.entry ?? []).map((x) => `${x.label} ${x.value}`).join("; "), chase: ch.overview.now.entry === null ? "state, unchanged" : "tiles!" }) };
  },
  async railHidesEmpty() {
    const { railHidden } = await import("../docs/v0.8/audit_scripts/smt_fb1/rail-hidden");
    const out: string[] = [];
    let pass = true;
    for (const urn of ["110110", "137625", "117037"]) {
      const r = await railHidden(urn);
      const c = await smtCase(urn);
      const flagsHidden = r.hidden.some((h) => h.dataview === "DV-SMT-O-FLAGS");
      // Flags is hidden exactly when there are no flags and the thresholds loaded.
      if (flagsHidden !== (c.overview.flags.length === 0 && c.overview.flagsLoaded)) pass = false;
      out.push(`${urn}: ${r.hidden.map((h) => `${h.product}${h.entry ? ` ${h.entry}` : ""} ${h.dataview}`).join(", ") || "none"}`);
    }
    const { activeWithContent } = await import("../src/lib/rail-content");
    pass = pass && activeWithContent([{ id: "s" }, { id: "m" }, { id: "f" }], "f", (id) => id !== "f") === "s";
    return { pass, detail: out.join("; ") };
  },
  async marketDefaultRivals() {
    const c = await smtCase("110110");
    // 0.8 SMT feedback round 2: Overview follows the set (R-MARKET-FOLLOWS-SET); Pupils keeps the default.
    const m = (await smtPupilsCase("110110")).market;
    void c;
    const { defaultRivals, nearbyCandidates } = await import("../src/lib/admissions/rungs");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const expect = defaultRivals(entryPoint("11+")!, await nearbyCandidates("110110")).filter((u) => u !== "110110");
    const html = textOf(await smtRender("110110", "DV-SMT-P-MARKET", undefined, { pupils: await smtPupilsCase("110110") }));
    const pass = m.status === "ready" && m.defaultRivals && m.rivals === expect.length && expect.length === 10 && /10 nearest schools \(default rivals\)/.test(html);
    return { pass, detail: fmt({ status: m.status, defaultRivals: m.status === "ready" && m.defaultRivals, rivals: m.status === "ready" ? m.rivals : null, expected: expect.length, titled: /default rivals/.test(html) }) };
  },
  async feedbackFollowsView() {
    const st = await import("../src/components/feedback/store");
    const { appVersion } = await import("../src/lib/feedback-server");
    st.resetFeedbackStore({ status: "ready", allowed: true, items: [] });
    const surface = { product: "smt", dashboard: { id: "vicdata.smt.overview", name: "SMT Overview" } } as never;
    const v = (id: string, label: string) => ({ surface, view: { panelId: "p", panelName: null, instanceId: id, dataview: id, label }, viewKey: `d:p:${id}`, anchor: null });
    st.setPanelView(v("map", "Map"));
    st.openFeedback(v("map", "Map"));
    st.setPanelView(v("flags", "Flags"));
    const offer = st.movedView(st.feedbackSnapshot())?.view.label;
    const at = st.feedbackSnapshot().target!.openedAt;
    st.moveFeedback(st.movedView(st.feedbackSnapshot())!);
    const after = st.feedbackSnapshot().target!;
    st.closeFeedback();
    // Admissions feedback round 2 (F-31): A at 11+, then 16+ and a click in B's panel.
    const { feedbackPayload } = await import("../src/components/feedback/FeedbackWindow");
    const { stateMismatch } = await import("../src/lib/view-ref");
    const adm = (entry: string) => ({ product: "admissions", dashboard: { id: "vicdata.admissions.pipelines", name: "Pipelines", versionId: null }, scope: { kind: "school", urn: "110110", name: "Leighton Park School" }, role: "admissions", viewAs: false, peek: false, noteScope: null, state: { dashboard: "pipelines", entry } }) as never;
    const a = (entry: string) => ({ surface: adm(entry), view: { panelId: "c1", panelName: "Trends", instanceId: "sex", dataview: "DV-ADM-P-ENTRY-SEX", label: "Your cohort, girls and boys" }, viewKey: "vicdata.admissions.pipelines:c1:sex", anchor: null });
    const b = (entry: string) => ({ surface: adm(entry), view: { panelId: "c2", panelName: "Funnel", instanceId: "funnel", dataview: "DV-ADM-P-FUNNEL", label: "Why did our intake change?" }, viewKey: "vicdata.admissions.pipelines:c2:funnel", anchor: null });
    const addr = (entry: string) => ({ path: "/teacher/admissions", search: `?view=pipelines&entry=${encodeURIComponent(entry)}` });
    const form = { kinds: [], importance: null, scope: null, applies: null, where: [], area: [], saw: "", expected: "", text: "x" };
    const sent = () => {
      const s = st.feedbackSnapshot();
      const plan = st.sendPlan(s, addr("16+"))!;
      const p = feedbackPayload(plan.surface, s.target!, form, { ...plan.address, width: 1400, theme: "light" });
      return `${p.view_label} @ ${p.state.entry} / ${p.page_query}${stateMismatch(p.state, p.page_query) ? " (MIX)" : ""}`;
    };
    const round2 = (move: boolean) => {
      st.resetFeedbackStore({ status: "ready", allowed: true, items: [] });
      st.setLiveSurface(adm("11+"));
      st.setPanelView(a("11+"));
      st.setPanelView(b("11+"));
      st.openFeedback(a("11+"), addr("11+"));
      st.setLiveSurface(adm("16+"));
      st.touchPanel(adm("16+"), "c2");
      const offer = st.driftOf(st.feedbackSnapshot());
      if (move && offer?.to) st.moveFeedback(offer.to, addr("16+"));
      const out = { offer: offer ? `${offer.kind}: ${offer.to?.view.label} @ ${(offer.to?.surface.state as { entry?: string } | undefined)?.entry}` : "none", sent: sent() };
      st.closeFeedback();
      return out;
    };
    const moved = round2(true);
    const declined = round2(false);
    const r2 =
      moved.offer === "panel: Why did our intake change? @ 16+" &&
      moved.sent === "Why did our intake change? @ 16+ / view=pipelines&entry=16%2B" &&
      declined.sent === "Your cohort, girls and boys @ 11+ / view=pipelines&entry=11%2B" &&
      !!stateMismatch({ entry: "11+" }, "view=pipelines&entry=16%2B");
    const pass = r2 && offer === "Flags" && after.view.label === "Flags" && after.openedAt === at && appVersion({ NODE_ENV: "production" }) === "unknown" && appVersion({ RENDER_GIT_COMMIT: "abc", NODE_ENV: "production" }) === "abc";
    return { pass, detail: fmt({ offer, movedTo: after.view.label, draftKept: after.openedAt === at, round2Offer: moved.offer, round2Moved: moved.sent, round2Declined: declined.sent, versionWithout: appVersion({ NODE_ENV: "production" }) }) };
  },

  // ------------------------------------------------------------ 0.8 SMT feedback round 2
  async setDrivesOverview() {
    const { threeSets, overviewFor } = await import("../docs/v0.8/audit_scripts/smt_fb2/sets");
    const { school, sets } = await threeSets("110110");
    const os = await Promise.all(sets.map((s) => overviewFor(school, s)));
    const out: string[] = [];
    let pass = true;
    os.forEach((o, i) => {
      const s = sets[i];
      const n = s.urns.length;
      const ranks = o.rows.filter((r) => r.set);
      const ok =
        ranks.every((r) => r.set!.of <= n + 1 && r.set!.label.startsWith(s.label)) &&
        o.now.setSizes.every((b) => b.of <= n + 1) &&
        Object.keys(o.schools).length === n + 1 && s.urns.every((u) => u in o.schools) &&
        o.trends.results.every((t) => t.band.every((b) => b.n <= n)) &&
        o.trends.roll.lines.filter((l) => l.key.startsWith("set-")).every((l) => l.label.startsWith(o.set.short)) &&
        !o.trends.roll.lines.some((l) => l.key === "la" || l.key === "england") &&
        o.trends.market.status === "ready" && o.trends.market.rivals === n && o.trends.market.setRivals === s.label;
      if (!ok) pass = false;
      out.push(`${s.label}: ${ok ? "follows" : "DOES NOT follow"} (A-level ${o.rows.find((r) => r.key === "A level::aps_per_entry")?.set?.rank}/${o.rows.find((r) => r.key === "A level::aps_per_entry")?.set?.of}, market ${o.trends.market.status === "ready" ? o.trends.market.school.at(-1)?.value?.toFixed(1) : "-"}%)`);
    });
    // The Scorecard's regional and England ranks don't move with the set.
    const key = (o: (typeof os)[number]) => o.rows.map((r) => `${r.key}:${r.region?.rank}/${r.region?.of}:${r.england?.rank}/${r.england?.of}`).join("|");
    const fixed = os.every((o) => key(o) === key(os[0]));
    // The page names the set: The school now and the market title.
    const c = await smtCase("110110");
    const now = textOf(await smtRender("110110", "DV-SMT-O-NOW"));
    const mk = textOf(await smtRender("110110", "DV-SMT-O-MARKET-LINE"));
    const named = now.includes(`in ${c.overview.set.short}`) && mk.includes(c.overview.set.label) && !/Reading and nationally|national rank/.test(now);
    pass = pass && fixed && named;
    return { pass, detail: `${out.join("; ")}; region/England ranks fixed=${fixed}; named=${named}` };
  },
  async rollIndexedSet() {
    const { schoolCensus } = await import("../src/lib/smt/school");
    const lp = await smtCase("110110");
    const ch = await smtCase("137625");
    const L = lp.overview.trends.roll.lines;
    const years = L[0].pts.map((p) => p.year);
    // The set's average boarding, recomputed: the set's schools with boarders in every year shown.
    const cs = await Promise.all(lp.set.urns.map((u) => schoolCensus(u)));
    const b = cs.map((c) => years.map((y) => c.find((x) => x.period === y)?.boarding?.boarders ?? 0)).filter((s) => s.every((v) => v > 0));
    const avg = years.map((_, i) => b.reduce((t, s) => t + s[i], 0) / b.length);
    const sb = L.find((l) => l.key === "set-boarding");
    const avgOk = !!sb && sb.actual!.every((p, i) => Math.abs((p.value ?? NaN) - avg[i]) < 1e-9);
    const html = await smtRender("110110", "DV-SMT-O-ROLL-LINE");
    const dotted = /stroke-dasharray="2 3"/.test(html);
    const keys = (o: typeof lp.overview) => o.trends.roll.lines.map((l) => l.key);
    const chaseBoarders = await Promise.all(ch.set.urns.map(async (u) => (await schoolCensus(u)).at(-1)?.boarding?.boarders ?? 0));
    const pass = ["day", "boarding", "set-day", "set-boarding"].every((k) => keys(lp.overview).includes(k)) && avgOk && dotted && !keys(lp.overview).some((k) => k === "la" || k === "england") &&
      chaseBoarders.every((v) => v === 0) && keys(ch.overview).join(",") === "school,set-day";
    return { pass, detail: fmt({ leighton: keys(lp.overview).join("/"), boardingAvg: avgOk ? `${b.length} schools, recomputed` : "MISMATCH", dotted, chase: keys(ch.overview).join("/"), chaseSetBoarders: chaseBoarders.reduce((a, v) => a + v, 0) }) };
  },
  async marketFollowsSet() {
    const c = await smtCase("110110");
    const m = c.overview.trends.market;
    const { cachedCensus } = await import("../src/lib/admissions/data");
    const { cohortAt } = await import("../src/lib/admissions/cohort");
    const all = ["110110", ...c.set.urns];
    const census = await cachedCensus(all);
    const latest = m.status === "ready" ? m.school.at(-1)! : null;
    const y7 = (u: string) => (latest ? cohortAt(census.get(u)?.table ?? new Map(), 11, latest.year) ?? 0 : 0);
    const share = (y7("110110") / all.reduce((t, u) => t + y7(u), 0)) * 100;
    const html = textOf(await smtRender("110110", "DV-SMT-O-MARKET-LINE"));
    const pass = m.status === "ready" && m.rivals === c.set.urns.length && m.setRivals === c.set.label && Math.abs((latest?.value ?? NaN) - share) < 1e-6 && html.includes(`against ${c.set.label}`);
    return { pass, detail: fmt({ rivals: m.status === "ready" ? m.rivals : null, set: c.set.urns.length, share: round(latest?.value ?? null, 2), recomputed: round(share, 2), titled: html.includes(`against ${c.set.label}`) }) };
  },
  async feedbackPage() {
    const { feedbackPayload } = await import("../src/components/feedback/FeedbackWindow");
    const { feedbackRow } = await import("../src/lib/feedback-server");
    const st = await import("../src/components/feedback/store");
    const { pageKey, feedbackColour, scopeKey } = await import("../src/lib/view-ref");
    const c = await smtCase("110110");
    const surface = { product: "smt" as const, dashboard: { id: "vicdata.smt.overview", name: "SMT Overview", versionId: null }, scope: { kind: "school" as const, urn: "110110", name: c.school.name }, role: "smt", viewAs: true, peek: false, noteScope: "110110", state: { set: c.set.label, level: "whole" } };
    st.resetFeedbackStore({ status: "ready", allowed: true, items: [] });
    st.openPageFeedback(surface);
    const t = st.feedbackSnapshot().target!;
    const p = feedbackPayload(surface, t, { kinds: ["layout"], importance: null, scope: null, applies: null, where: [], area: ["set_bar"], saw: "", expected: "", text: "The set bar" }, { path: "/teacher/smt", search: "", width: 1440, theme: "dark" });
    const row = feedbackRow(p, "test");
    const refused = "error" in feedbackRow({ ...p, panel_id: "p" }, "test");
    st.addOwnItem({ id: "x", number: 1, created_at: "", view_key: t.viewKey, school_urn: "110110", school_name: null, group_id: null, group_name: null, status: "new", looks_good: false, kinds: ["layout"], has_text: true, excerpt: "" });
    const colour = feedbackColour(st.marksFor(st.feedbackSnapshot().items, pageKey("vicdata.smt.overview")), scopeKey(surface.scope));
    st.closeFeedback();
    const pass = t.page === true && t.viewKey === "page:vicdata.smt.overview" && "row" in row && row.row.panel_id === null && JSON.stringify(row.row.area) === '["set_bar"]' && row.row.view_as === true && refused && colour === "open";
    return { pass, detail: fmt({ key: t.viewKey, panel: "row" in row ? String(row.row.panel_id) : "-", area: "row" in row ? JSON.stringify(row.row.area) : "-", shapeHeld: refused, colour }) + " (the database half: supabase/tests/v08_feedback_page_pglite.mjs)" };
  },
  // ------------------------------------------------------------------ 0.8 Admissions feedback round 1
  // R-TABLE-FEATURED-ROW (F-17): Leighton Park's Rivals table, drawn from the screen's own figures, tints
  // exactly one row -- Leighton Park's -- with the featured-row token; each product's root names its own
  // token, set for light and dark (the unit half: src/lib/featured-row.test.ts).
  async tableFeaturedRow() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RivalsTable } = await import("../src/components/admissions/views/Tables");
    const { admissionsVars } = await import("../src/components/admissions/ui");
    const { smtVars } = await import("../src/components/smt/ui");
    const { groupDashVars } = await import("../src/components/groups/dash/GroupDashboard");
    const { FEATURED_ROW_TOKEN, featuredRowKey } = await import("../src/components/shell/accent");
    const { readFileSync } = await import("node:fs");
    const v = await import("../src/lib/admissions/views-api");
    const m = await v.marketView("110110", v.entryPoint("11+")!, []);
    const html = renderToStaticMarkup(createElement(RivalsTable, { m, rivals: { status: "loading" }, fullscreen: true }));
    const rows = html.match(/<tr[^>]*data-featured-row=""[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    const name = m.schools["110110"]?.name ?? "";
    const tinted = rows.length === 1 && rows[0].includes("var(--row-featured,") && textOf(rows[0]).includes(name);
    const named = (x: object) => (x as Record<string, string>)["--row-featured"];
    const roots = named(admissionsVars("dark")) === "var(--row-featured-admissions)" && named(smtVars("light")) === "var(--row-featured-smt)" && named(groupDashVars("dark")) === "var(--row-featured-groups)" && featuredRowKey("teacher", "ks4") === "gcse" && featuredRowKey("teacher", "ks5") === "post16";
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const tokens = Object.values(FEATURED_ROW_TOKEN).every((t) => (css.match(new RegExp(`${t}:\\s*#[0-9a-f]{6}`, "g")) ?? []).length === 3);
    const pass = tinted && roots && tokens;
    return { pass, detail: fmt({ featuredRows: rows.length, school: name, schools: m.entryAge.rows.filter((r) => r.period === m.summary.latest).length, roots, tokensLightAndDark: tokens }) };
  },
  // ------------------------------------------------------------------ 0.8 feedback deploy gate
  // R-FEEDBACK-STATUSES, -PROMOTE, -DEPLOY-GAPS, -LIVE-CHECK: the database's half in PGlite (never a real
  // database), the app's half in the unit test; each rule names its own lines.
  async feedbackDeployGate(_L, rule) {
    const { execFileSync } = await import("node:child_process");
    const root = new URL("..", import.meta.url).pathname;
    const run = (cmd: string, args: string[]) => {
      try {
        return { ok: true, out: execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e8 }) };
      } catch (e) {
        return { ok: false, out: String((e as { stdout?: string }).stdout ?? "") };
      }
    };
    const pg = run("node", ["supabase/tests/v08_feedback_deploy_gate_pglite.mjs"]);
    const unit = run("npx", ["-y", "tsx", "--test", "--test-force-exit", "src/lib/feedback-deploy-gate.test.ts"]);
    const lines = pg.out.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("FAIL"));
    const mine = lines.filter((l) => l.includes(rule.id));
    const total = /(\d+) PASS, (\d+) FAIL/.exec(pg.out);
    const pass = pg.ok && unit.ok && !lines.some((l) => l.startsWith("FAIL"));
    return { pass, detail: fmt({ pglite: total ? `${total[1]} pass, ${total[2]} fail` : "did not run", thisRule: mine.length ? `${mine.length} named checks` : "checked within the suite", unit: unit.ok ? "pass" : "FAIL" }) };
  },
  // R-FEEDBACK-RESOLVED-VIEWS (Admissions feedback round 2): the PGlite suite and the app's unit tests.
  async feedbackResolvedViews() {
    const { execFileSync } = await import("node:child_process");
    const root = new URL("..", import.meta.url).pathname;
    const run = (cmd: string, args: string[]) => {
      try {
        return { ok: true, out: execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e8 }) };
      } catch (e) {
        return { ok: false, out: String((e as { stdout?: string }).stdout ?? "") };
      }
    };
    const pg = run("node", ["supabase/tests/v08_feedback_resolved_views_pglite.mjs"]);
    const gate = run("node", ["supabase/tests/v08_feedback_deploy_gate_pglite.mjs"]);
    const unit = run("npx", ["-y", "tsx", "--test", "--test-force-exit", "src/lib/feedback-resolved-views.test.ts"]);
    const total = /(\d+) PASS, (\d+) FAIL/.exec(pg.out);
    const pass = pg.ok && gate.ok && unit.ok;
    return { pass, detail: fmt({ pglite: total ? `${total[1]} pass, ${total[2]} fail` : "did not run", deployGateSuite: gate.ok ? "pass" : "FAIL", unit: unit.ok ? "pass" : "FAIL" }) };
  },
  async republishGuard() {
    const { execFileSync } = await import("node:child_process");
    const root = new URL("..", import.meta.url).pathname;
    let ok = true;
    let out = "";
    try {
      out = execFileSync("npx", ["-y", "tsx", "--test", "--test-force-exit", "--test-name-pattern", "R-REPUBLISH-GUARD", "src/lib/feedback-deploy-gate.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      ok = false;
      out = String((e as { stdout?: string }).stdout ?? "");
    }
    // The summary is "ℹ pass N" (spec reporter, a terminal) or "# pass N" (TAP, which Node uses when piped, as here).
    const passed = /^(?:ℹ|#) pass (\d+)/m.exec(out)?.[1] ?? "0";
    return { pass: ok && Number(passed) >= 2, detail: fmt({ tests: passed, mocked: "/api/version" }) };
  },
  // R-REPORT-COMMANDS-ORDER: every report first committed on or after the template (6 Nov), and any not yet
  // committed -- the next one -- gives Guy's commands in the template's order.
  async reportCommandsOrder() {
    const { execFileSync } = await import("node:child_process");
    const { readFileSync } = await import("node:fs");
    const { checkCommands } = await import("./report-template");
    const root = new URL("..", import.meta.url).pathname;
    const git = (...a: string[]) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
    const isReport = (f: string) => /^docs\/.*report.*\.md$/i.test(f) && !/screenshots|archive/.test(f);
    const since = git("log", "--since=2026-11-06T00:00:00Z", "--diff-filter=A", "--name-only", "--format=").split("\n").filter(isReport);
    const untracked = git("ls-files", "--others", "--exclude-standard", "docs").split("\n").filter(isReport);
    const files = Array.from(new Set([...since, ...untracked]));
    const bad = files.map((f) => ({ f, p: checkCommands(readFileSync(`${root}${f}`, "utf8")) })).filter((x) => x.p.length);
    return { pass: bad.length === 0, detail: fmt({ reports: files.length ? files.join(", ") : "none since the template yet", problems: bad.length ? bad.map((b) => `${b.f}: ${b.p.join("; ")}`).join(" | ") : "none" }) };
  },
  // R-FEATURED-ROW-EVERYWHERE (F-22): every table or rank view of schools marks and tints the focus row;
  // a row of schools without the mark must be listed with why (src/lib/featured-row-scan.ts).
  async featuredRowEverywhere() {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { featuredRowFindings, NO_FOCUS_ROWS } = await import("../src/lib/featured-row-scan");
    const { FEATURED_ROW_TOKEN } = await import("../src/components/shell/accent");
    const src = path.join(ROOT, "src");
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith(".tsx") && !f.includes("__")).map((f) => ({ file: `src/${f}`, text: readFileSync(path.join(src, f), "utf8") }));
    const { unmarkedTables, unlisted, rows } = featuredRowFindings(files);
    const stale = NO_FOCUS_ROWS.filter((x) => !rows.some((r) => r.file === x.file && r.listed === x.why));
    const css = readFileSync(path.join(src, "app/globals.css"), "utf8");
    const tokens = Object.values(FEATURED_ROW_TOKEN).every((t) => (css.match(new RegExp(`${t}:\\s*#[0-9a-f]{6}`, "g")) ?? []).length === 3);
    const pass = !unmarkedTables.length && !unlisted.length && !stale.length && tokens;
    return { pass, detail: fmt({ marked: rows.filter((r) => r.marked).length, listed: rows.filter((r) => r.listed).length, unmarkedTables: unmarkedTables.join(", ") || "none", unlisted: unlisted.map((r) => `${r.file}:${r.line}`).join(", ") || "none", stale: stale.length, tokens: Object.keys(FEATURED_ROW_TOKEN).length, tokensLightAndDark: tokens }) };
  },
  // 0.8 sets round 1: R-SETS-ONE-MODEL -- no src read of the old tables (code, not comments), and the
  // conversion of Leighton Park's 6 lists and the sets' RLS proved in PGlite (v08_sets_r1_pglite.mjs).
  async setsOneModel() {
    const fs = await import("node:fs");
    const root = new URL("..", import.meta.url).pathname;
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
      }
    };
    walk(path.join(root, "src"));
    const OLD = /\b(saved_sets|saved_set_members|admissions_lists)\b/;
    const hits: string[] = [];
    for (const f of files) {
      fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "").replace(/\/\*.*?\*\//g, "");
        // Test names and messages mention the old tables in prose; a read is a from() or an embed.
        if (OLD.test(code) && /from\(\s*["'`](saved_sets|saved_set_members|admissions_lists)|\b(saved_set_members|saved_sets|admissions_lists)\([a-z_]/.test(code)) hits.push(`${path.relative(root, f)}:${i + 1}`);
      });
    }
    const { execFileSync } = await import("node:child_process");
    let out = "";
    let ok = true;
    try {
      out = execFileSync("node", ["supabase/tests/v08_sets_r1_pglite.mjs"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e8 });
    } catch (e) {
      ok = false;
      out = String((e as { stdout?: string }).stdout ?? "");
    }
    const lines = out.split("\n");
    const conv = lines.filter((l) => /^(PASS|FAIL)\s+ {2}(11|16)\+ /.test(l));
    const twice = lines.filter((l) => /applies a second time|changes nothing/.test(l));
    const pass = hits.length === 0 && ok && conv.length === 6 && conv.every((l) => l.startsWith("PASS")) && twice.every((l) => l.startsWith("PASS")) && twice.length === 2;
    return { pass, detail: fmt({ oldTableReadsInSrc: hits.length ? hits.slice(0, 5).join(" ") : 0, filesScanned: files.length, conversion: `${conv.filter((l) => l.startsWith("PASS")).length}/6 rows exact`, runTwice: twice.every((l) => l.startsWith("PASS")) ? "no change" : "CHANGED", pglite: ok ? "all pass" : "FAIL" }) };
  },
  // 0.8 sets round 1: R-SET-PILL -- the selector rendered on the server with its menu open, the
  // page filter (buildMenu) on stored sets, and which pages draw it.
  async setPill() {
    const fs = await import("node:fs");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { SetSelector } = await import("../src/components/sets/SetSelector");
    const { buildMenu } = await import("../src/lib/sets/admissions-page");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const root = new URL("..", import.meta.url).pathname;
    const row = (k: string, creator: "default" | "smt" | "admissions" | "me", pinned = false) => ({ key: k, name: `Set ${k}`, count: 10, creator, pinned });
    const school = Array.from({ length: 7 }, (_, i) => row(`s${i}`, i % 2 ? "smt" : "admissions", i < 6));
    const html = renderToStaticMarkup(createElement(SetSelector, { label: "Compared against", kind: "compared_against", current: { name: "Set d1", count: 10 }, rows: { default: [row("d1", "default")], school, mine: [row("m1", "me")] }, mine: { active: 1, cap: 8 }, selectedKey: "d1", onPick: () => undefined, onEdit: { label: "Edit this set…", onClick: () => undefined }, onNew: { label: "New set…", onClick: () => undefined }, manageHref: "/sets", defaultOpen: true }));
    const labelOutside = /<span[^>]*>Compared against<\/span><button[^>]*data-set-button/.test(html);
    const order = ["default", "school", "mine"].map((b) => html.indexOf(`data-set-block="${b}"`));
    const ordered = order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1]));
    const ticked = /aria-checked="true"[^>]*data-set-row="d1"/.test(html);
    const actions = html.indexOf("Edit this set…") > order[2] && html.indexOf("New set…") > html.indexOf("Edit this set…") && html.indexOf("Manage sets") > html.indexOf("New set…");
    const shown = (html.match(/data-set-row="s\d"/g) ?? []).length;
    const more = /All school sets \(7\)/.test(html);
    const tags = (html.match(/data-set-creator=/g) ?? []).length === shown;
    const mineOf = /My sets.*?1 of 8/.test(html);
    // The page filter: an 11+ compared-against page leaves out a feeder set and a 16+ set.
    const mk = (id: string, kind: "compared_against" | "feeders", entryPoint: string) => ({ id, name: id, description: null, kind, entryPoint, phase: null, focusUrn: "110110", ownerScope: "school" as const, schoolAccountId: "a", ownerProfileId: null, creatorKind: "smt" as const, audience: kind === "feeders" ? ("day" as const) : null, rungAge: null, isDefault: false, pinned: false, folder: null, tags: [], archived: false, rule: null, sourceRecipe: null, laBlend: null, config: {}, members: [{ urn: "100000", position: 0, tier: null }], createdBy: null, createdAt: "", updatedBy: null, updatedAt: "" });
    const ep = entryPoint("11+")!;
    const menu = buildMenu({ stored: [mk("fits", "compared_against", "11+"), mk("feeder", "feeders", "11+"), mk("sixteen", "compared_against", "16+")], recipes: [], boardingSchool: false }, ep, "compared_against", { key: "x", name: "x", count: 0, block: "default", creator: "default" }, { profileId: null, canCurate: true });
    const filtered = menu.school.map((r) => r.key).join() === "set:fits";
    // Teacher's fixed width; every page draws SetSelector; the old Compared against pill is gone.
    const teacherHtml = renderToStaticMarkup(createElement(SetSelector, { label: "Compared against", kind: "compared_against", current: { name: "A very long set name that goes on and on past the button", count: 12 }, rows: { default: [], school: [], mine: [] }, mine: null, selectedKey: null, onPick: () => undefined, width: 200 }));
    const fixed = /data-set-button=""[^>]*style="width:200px"/.test(teacherHtml) && /class="[^"]*truncate[^"]*">A very long set name/.test(teacherHtml) && /title="A very long set name/.test(teacherHtml);
    const src = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
    const draws = ["src/components/admissions/AdmissionsSets.tsx", "src/components/smt/SmtDashboard.tsx", "src/components/teacher/ComparisonsPanels.tsx"].every((f) => /<SetSelector/.test(src(f)));
    const oldPill = /<PillMenu label="Compared against"/.test(src("src/components/smt/SmtDashboard.tsx")) || /<FChip[^>]*>\s*Rivals: \{setLabel\}/.test(src("src/components/admissions/AdmissionsDashboard.tsx"));
    const pass = labelOutside && ordered && ticked && actions && shown === 5 && more && tags && mineOf && filtered && fixed && draws && !oldPill;
    return { pass, detail: fmt({ labelOutside, blocksInOrder: ordered, ticked, actionsBelow: actions, schoolRowsShown: shown, allSchoolSets: more, creatorTags: tags, mineOfCap: mineOf, pageFilter: filtered, teacherFixedWidth: fixed, everyPageDrawsIt: draws, oldPill }) };
  },
  // R-SET-DEFAULTS-ADMISSIONS: the recipes on live reference data, and the school's own sets.
  async setDefaultsAdmissions() {
    const { admissionsRecipes } = await import("../src/lib/sets/recipes");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const { resolveChoice } = await import("../src/lib/sets/admissions-page");
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const e11 = entryPoint("11+")!, e16 = entryPoint("16+")!;
    const lp = await admissionsRecipes("110110", e11, "compared_against");
    const lpDefault = lp.find((x) => x.isDefaultChoice);
    const lpOk = lpDefault?.name === "10 nearest | independent" && lp[1]?.key === "adm:nearest-boarding" && lpDefault.urns.length === 10;
    // A top-two-fifths boarding school with Year 7 entry (boarding_quintiles: quintile 3 or 4).
    const { data: tops } = await createServerAnonSupabaseClient().from("boarding_quintiles").select("urn, quintile, boarding_school_type").gte("quintile", 3).eq("boarding_school_type", "independent_boarding_senior").limit(40);
    let top: { urn: string; def: string | undefined } | null = null;
    for (const r of (tops ?? []) as { urn: string }[]) {
      const rec = await admissionsRecipes(r.urn, e11, "compared_against");
      if (rec.some((x) => x.key === "adm:nearest-boarding")) {
        top = { urn: r.urn, def: rec.find((x) => x.isDefaultChoice)?.key };
        break;
      }
    }
    const topOk = top?.def === "adm:nearest-boarding";
    const chase = await admissionsRecipes("137625", e11, "compared_against");
    const chaseFeeders = await admissionsRecipes("137625", e11, "feeders");
    const dayOk = !chase.some((x) => x.key === "adm:nearest-boarding") && !chaseFeeders.some((x) => x.audience === "boarding") && chase.find((x) => x.isDefaultChoice)?.key === "adm:nearest-sector";
    const lp16 = await admissionsRecipes("110110", e16, "compared_against");
    const la16 = lp16.find((x) => x.key === "adm:la")?.name ?? "";
    const la16Ok = /^All post-16 in /.test(la16);
    const lpFeeders = await admissionsRecipes("110110", e11, "feeders");
    const feedNames = lpFeeders.map((x) => x.name).join(", ");
    const feedOk = lpFeeders.length === 6 && lpFeeders[0].name === "Day | all sectors" && lpFeeders.every((x) => x.urns.length >= 10 && x.urns.length <= 40);
    // With the school's own default sets (Leighton Park's 6, converted), the page draws them: the
    // day and boarding feeders together, exactly the old lists.
    const fixture = JSON.parse((await import("node:fs")).readFileSync(path.join(ROOT, "supabase/tests/fixtures/sets_r1_leighton_lists.json"), "utf8")) as { rows: { id: string; entry_point: string; kind: string; members: string[] }[] };
    const stored = fixture.rows.map((r) => ({ id: r.id, name: r.kind, description: null, kind: r.kind === "rivals" ? ("compared_against" as const) : ("feeders" as const), entryPoint: r.entry_point, phase: null, focusUrn: "110110", ownerScope: "school" as const, schoolAccountId: "a", ownerProfileId: null, creatorKind: "admissions" as const, audience: r.kind === "day_feeders" ? ("day" as const) : r.kind === "boarding_feeders" ? ("boarding" as const) : null, rungAge: null, isDefault: true, pinned: true, folder: null, tags: [], archived: false, rule: null, sourceRecipe: null, laBlend: null, config: {}, members: r.members.map((u, i) => ({ urn: u, position: i, tier: null })), createdBy: null, createdAt: "", updatedBy: null, updatedAt: "" }));
    const { savedListsFromSets } = await import("../src/lib/sets/admissions-lists");
    const base = savedListsFromSets(stored, "11+");
    const r = resolveChoice({ stored, recipes: lpFeeders, boardingSchool: true }, e11, "feeders", null, base, null, true);
    const ownOk = r.choice.key === "school:day+boarding" && JSON.stringify(r.lists) === JSON.stringify(base) && r.choice.count === new Set(fixture.rows.filter((x) => x.entry_point === "11+" && x.kind !== "rivals").flatMap((x) => x.members)).size;
    const pass = lpOk && topOk && dayOk && la16Ok && feedOk && ownOk;
    return { pass, detail: fmt({ leightonPark11: `${lpDefault?.name} (${lp.map((x) => x.name).join(" / ")})`, topTwoFifths: top ? `${top.urn} -> ${top.def}` : "none found", theChase: dayOk ? "no boarding set, same-sector default" : "FAIL", leightonPark16La: la16, feeders: feedNames, ownSets: ownOk ? `${r.choice.name} (${r.choice.count}), the old lists exactly` : "FAIL" }) };
  },
  // R-PANEL-NAMES-SET: every Admissions view with a set names it (rendered on real data), and the
  // SMT and Teacher headers carry it.
  async panelNamesSet() {
    const fs = await import("node:fs");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const v = await import("../src/lib/admissions/views-api");
    const { AdmissionsEveryView, setKindOfView } = await import("../src/components/admissions/AdmissionsDashboard");
    const { OpenInFullscreen } = await import("../src/components/teacher/CardBox");
    const { fetchSchoolTraits } = await import("../src/lib/admissions/traits");
    const ep = v.entryPoint("11+")!;
    const urn = "110110";
    const today = new Date("2026-10-12");
    const [p, m, r, s] = await Promise.all([v.pipelineView(urn, ep, [], { today }), v.marketView(urn, ep, []), v.rivalsView(urn, ep, []), v.shapeView(urn, ep, [])]);
    const boarding = (await fetchSchoolTraits([urn])).get(urn)!.boarding;
    const member = { userId: "", token: "", membershipId: "m", schoolAccountId: "a", schoolUrn: urn, schoolName: urn, roles: ["admissions"], isAdmin: false, isAccountHolder: false, lead: true, access: "lead" as const, canEditLists: true, override: false, canShare: true, canManageTeam: true, readOnly: false, viewAs: null, leadColumn: true };
    const sets = { feeders: { key: "default:adm:feeders:day:all", name: "Day | all sectors", count: 28, block: "default" as const, creator: "default" as const, main: 6 }, rivals: { key: "default:adm:nearest-sector", name: "10 nearest | independent", count: 10, block: "default" as const, creator: "default" as const } };
    const html = renderToStaticMarkup(createElement(OpenInFullscreen.Provider, { value: true }, createElement(AdmissionsEveryView, { member, boardingSchool: boarding, entry: ep.id, pipeline: p, market: m, rivals: r, shape: s, lists: null, sets })));
    const chunks = html.split(/(?=<div data-adm-dash=)/).filter((c) => c.startsWith("<div data-adm-dash="));
    const dvOf = (c: string) => /data-adm-dv="([^"]+)"/.exec(c)?.[1] ?? "";
    const missing: string[] = [];
    const extra: string[] = [];
    for (const c of chunks) {
      const dv = dvOf(c);
      const kind = setKindOfView(dv);
      const has = /data-set-header=/.test(c);
      const words = kind === "feeders" ? /Day \| all sectors · 28 · 6 main/.test(c) : kind ? /against 10 nearest \| independent · 10/.test(c) : true;
      if (kind && (!has || !words)) missing.push(dv);
      if (!kind && has) extra.push(dv);
    }
    const root = new URL("..", import.meta.url).pathname;
    const src = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
    const smt = /const set = `\$\{c\.set\.label\} · \$\{c\.set\.urns\.length\}`/.test(src("src/components/smt/SmtDashboard.tsx"));
    // Teacher: the column's set selector, directly above both panels, names the set and its count.
    const teacher = /<SetSelector label="Compared against" kind="compared_against" width=\{TEACHER_SET_PILL_WIDTH\}/.test(src("src/components/teacher/ComparisonsPanels.tsx")) && /current: \{ name: activeSetLabel, count: activeCount \}/.test(src("src/components/dashboard-config/TeacherDashboard.tsx"));
    const wraps = /data-set-header=[^>]*class="[^"]*flex-wrap[^"]*whitespace-normal/.test(html) && !/data-set-header=[^>]*truncate/.test(html);
    const pass = chunks.length > 30 && missing.length === 0 && extra.length === 0 && smt && teacher && wraps;
    return { pass, detail: fmt({ admissionsViews: chunks.length, named: chunks.length - missing.length - chunks.filter((c) => !setKindOfView(dvOf(c))).length, missing: missing.join(" ") || 0, noSetViewsWithALine: extra.join(" ") || 0, smtHeaders: smt, teacherPanels: teacher, wrapsOnPhone: wraps }) };
  },
  // R-SET-EDITOR-TICK: the pure list (editor.test.ts) and the editor rendered on the server in each mode.
  async setEditorTick() {
    const { execFileSync } = await import("node:child_process");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
    const { SetEditor } = await import("../src/components/sets/SetEditor");
    const root = new URL("..", import.meta.url).pathname;
    let unit = true;
    try {
      execFileSync("npx", ["-y", "tsx", "--test", "--test-force-exit", "src/lib/sets/editor.test.ts"], { cwd: root, stdio: "ignore" });
    } catch {
      unit = false;
    }
    const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
    const page = { urn: "110110", schoolName: "Leighton Park", kind: "compared_against" as const, entry: "11+", phase: null, returnTo: "/teacher/admissions?view=market-share&entry=11%2B", returnFallback: false, returnLabel: "Back to Leighton Park · Market share 11+", usedOn: "Market share at 11+", profileId: "p", schoolAccountId: "a", schoolCreator: null, personalActive: 2, boardingSchool: true, readOnly: false };
    const set = { id: "s", name: "Rivals", description: null, kind: "compared_against" as const, entryPoint: "11+", phase: null, focusUrn: "110110", ownerScope: "school" as const, schoolAccountId: "a", ownerProfileId: null, creatorKind: "admissions" as const, audience: null, rungAge: null, isDefault: true, pinned: true, folder: null, tags: [], archived: false, rule: null, sourceRecipe: null, laBlend: null, config: {}, members: [{ urn: "110137", position: 0, tier: null }], createdBy: null, createdAt: "", updatedBy: null, updatedAt: "" };
    const render = (mode: "save" | "copy" | "new", creator: "admissions" | "default" | "me") =>
      renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(SetEditor, { page, start: { set: mode === "save" || creator === "admissions" ? set : null, name: "Rivals", description: null, members: [{ urn: "110137" }], creator, sourceRecipe: null, mode, editableBy: "SMT, Admissions and the School-Admin", lastChanged: null } })));
    const curator = render("save", "admissions");
    const teacher = render("copy", "admissions");
    const dflt = render("copy", "default");
    const saveBtn = (h: string) => /data-editor-save=""/.test(h);
    const copyNote = (h: string) => /data-editor-copy=""/.test(h) && /Save as your own…/.test(h);
    const pass = unit && saveBtn(curator) && !copyNote(curator) && !saveBtn(teacher) && copyNote(teacher) && !saveBtn(dflt) && copyNote(dflt);
    return { pass, detail: fmt({ unitTests: unit ? "pass" : "FAIL", curatorSaves: saveBtn(curator), teacherCopyOnly: !saveBtn(teacher) && copyNote(teacher), defaultCopyOnly: !saveBtn(dflt) && copyNote(dflt) }) };
  },
  // R-SET-HOW-CLOSE: Leighton Park's default 11+ rivals, on live data, through the editor's own route code.
  async setHowClose() {
    const { admissionsRecipes } = await import("../src/lib/sets/recipes");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const { editorData } = await import("../src/lib/sets/editor-data");
    const { closeness, closenessWords, median } = await import("../src/lib/sets/closeness");
    const { resultsMeasureFor } = await import("../src/lib/sets/results-coverage");
    const ep = entryPoint("11+")!;
    const def = (await admissionsRecipes("110110", ep, "compared_against")).find((x) => x.isDefaultChoice)!;
    const d = await editorData("110110", ep, "compared_against", def.urns, { sector: "all", boardingOnly: false, n: 10 });
    const c = closeness(d.focus, d.rows, ep.age);
    const kms = d.rows.map((r) => r.km).filter((k): k is number => k !== null);
    const exact = c.distance !== null && c.distance.min === Math.min(...kms) && c.distance.max === Math.max(...kms) && c.distance.median === median(kms);
    const counts = c.results.gcse === d.rows.filter((r) => r.hasGcse).length && c.results.post16 === d.rows.filter((r) => r.hasPost16).length;
    const rule = resultsMeasureFor(ep.age, d.rows.map((r) => ({ urn: r.urn, hasGcse: r.hasGcse, hasPost16: r.hasPost16, igcse: r.igcse })));
    const starts = c.results.startsOn === rule.measure;
    const w = closenessWords(c, "Leighton Park");
    const says = new RegExp(`${c.results.post16} of ${c.n} have Post-16 results; ${c.results.gcse} have GCSE results`).test(w.results) && /Counts only/.test(w.population);
    const pass = d.rows.length === 10 && exact && counts && starts && says;
    return { pass, detail: fmt({ set: def.name, schools: d.rows.length, distance: w.distance, results: `${c.results.gcse} GCSE, ${c.results.post16} Post-16, starts on ${c.results.startsOn}`, matchesDashboardRule: starts, population: w.population.split(". Counts")[0] }) };
  },
  // R-FEEDER-TIERS: the feeder table rendered on real data with tiers, and the map's dot rule.
  async feederTiers() {
    const fs = await import("node:fs");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const v = await import("../src/lib/admissions/views-api");
    const { FeederTable } = await import("../src/components/admissions/views/Tables");
    const { MAIN_DOT_SCALE } = await import("../src/lib/sets/tiers");
    const ep = v.entryPoint("11+")!;
    const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/tests/fixtures/sets_r1_leighton_lists.json"), "utf8")) as { rows: { entry_point: string; kind: string; members: string[] }[] };
    const day = fixture.rows.find((r) => r.entry_point === "11+" && r.kind === "day_feeders")!.members;
    const p = await v.pipelineView("110110", ep, [{ kind: "day_feeders", rung: null, members: day, la_blend: null, confirmed: true }], { today: new Date("2026-10-12") });
    if ("empty" in p) return { pass: false, detail: "empty pipeline" };
    const rows = p.feederTable.rows;
    const red = rows.filter((r) => r.flag?.id === "feeder_red");
    // Main: the last two rows in the table's order (so a pass proves they move up), and one red-flagged school.
    const mains = new Set([rows[rows.length - 1]?.urn, rows[rows.length - 2]?.urn, red[0]?.urn].filter(Boolean) as string[]);
    const occ = red.find((r) => !mains.has(r.urn));
    const tiers = Object.fromEntries(rows.map((r) => [r.urn, mains.has(r.urn) ? "main" : occ && r.urn === occ.urn ? "occasional" : "regular"]));
    const html = renderToStaticMarkup(createElement(FeederTable, { p: { ...p, tiers } as never, fullscreen: true }));
    const order = Array.from(html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)).map((m) => m[0]).slice(1);
    const firstN = order.slice(0, mains.size).every((tr) => /data-main-feeder=/.test(tr));
    const alert = /data-main-feeder-alert=""/.test(html);
    const names = red.filter((r) => mains.has(r.urn)).map((r) => r.name);
    const alertNames = names.every((n) => html.includes(n.replace(/&/g, "&amp;").replace(/'/g, "&#x27;")));
    const occNot = !occ || !/Main feeder[^<]*falling:[^<]*/.test(html) || !html.match(/falling:([^<]*)/)?.[1].includes(occ.name);
    const mapSrc = fs.readFileSync(path.join(ROOT, "src/components/admissions/views/AdmissionsMap.tsx"), "utf8");
    const mapLarger = MAIN_DOT_SCALE === 1.5 && /isMain\(tiers, m\.urn\)[\s\S]{0,200}\* MAIN_DOT_SCALE/.test(mapSrc);
    const pass = rows.length > 3 && firstN && (red.length === 0 || (alert && alertNames)) && occNot && mapLarger;
    return { pass, detail: fmt({ feeders: rows.length, mains: mains.size, mainFirst: firstN, redFlagged: red.length, alert: alert ? (html.match(/data-main-feeder-alert=""[^>]*>([^<]*)/)?.[1] ?? "") : "none", occasionalNeverAlerts: occNot, mapMainLarger: mapLarger }) };
  },
  // R-SETS-MOBILE: the four screens' phone markup, rendered on the server (the pixel half -- no horizontal
  // scroll, hit boxes, the sheets opening and closing -- is measured in headless Chrome for the report).
  async setsMobile() {
    const fs = await import("node:fs");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
    const { SetSelector } = await import("../src/components/sets/SetSelector");
    const { SetEditor } = await import("../src/components/sets/SetEditor");
    const { SetsLibrary } = await import("../src/components/sets/SetsLibrary");
    const { SetView } = await import("../src/components/sets/SetView");
    const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
    const wrap = (el: ReturnType<typeof createElement>) => createElement(AppRouterContext.Provider, { value: router as never }, el);
    const row = (k: string, creator: "default" | "smt" | "me") => ({ key: k, name: `Set ${k}`, count: 10, creator });
    const selector = renderToStaticMarkup(createElement(SetSelector, { label: "Feeder schools", kind: "feeders", current: { name: "Day | all sectors", count: 28, main: 6 }, rows: { default: [row("d", "default")], school: [row("s", "smt")], mine: [row("m", "me")] }, mine: { active: 1, cap: 8 }, selectedKey: "d", onPick: () => undefined, onEdit: { label: "Edit this set…", onClick: () => undefined }, onNew: { label: "New set…", onClick: () => undefined }, manageHref: "/sets", phone: true, defaultOpen: true }));
    const set = { id: "s", name: "Rivals", description: "why", kind: "compared_against" as const, entryPoint: "11+", phase: null, focusUrn: "110110", ownerScope: "school" as const, schoolAccountId: "a", ownerProfileId: null, creatorKind: "admissions" as const, audience: null, rungAge: null, isDefault: true, pinned: true, folder: null, tags: [], archived: false, rule: null, sourceRecipe: null, laBlend: null, config: {}, members: [{ urn: "110137", position: 0, tier: null }], createdBy: null, createdAt: "2026-11-06T00:00:00Z", updatedBy: null, updatedAt: "2026-11-06T00:00:00Z" };
    const page = { urn: "110110", schoolName: "Leighton Park", kind: "compared_against" as const, entry: "11+", phase: null, returnTo: "/teacher/admissions?view=market-share&entry=11%2B", returnFallback: true, returnLabel: "Back to Leighton Park · Market share 11+", usedOn: "Market share", profileId: "p", schoolAccountId: "a", schoolCreator: "admissions" as const, personalActive: 1, boardingSchool: true, readOnly: false };
    const editor = renderToStaticMarkup(wrap(createElement(SetEditor, { page, start: { set, name: "Rivals", description: null, members: set.members, creator: "admissions", sourceRecipe: null, mode: "save", editableBy: "SMT", lastChanged: null }, phone: true })));
    const lib = { school: { urn: "110110", name: "Leighton Park", boarding: true }, entries: ["11+", "16+"], defaults: [{ key: "adm:nearest-sector", name: "10 nearest | independent", kind: "compared_against" as const, entryPoint: "11+", urns: ["1"], how: "", count: 1 }], stored: [set], lastUsed: {}, folders: {}, names: {}, curates: { compared_against: true, feeders: true }, creators: { compared_against: "admissions" as const, feeders: "admissions" as const }, profileId: "p", personalActive: 1, cap: 8 };
    const library = renderToStaticMarkup(createElement(SetsLibrary, { data: lib as never, phone: true }));
    const view = renderToStaticMarkup(createElement(SetView, { urn: "110110", schoolName: "Leighton Park", set: { id: "s", key: "set:s", name: "Rivals", description: null, kind: "compared_against", entry: "11+", phase: null, creator: "admissions", scope: "school", pinned: true, members: [{ urn: "110137", tier: null }], lastChanged: null, canChange: true }, editHref: "/e", duplicateHref: "/d", phone: true }));
    const screens: Record<string, string> = { selector, editor, library, view };
    const wide: string[] = [];
    const small: string[] = [];
    for (const [name, html] of Object.entries(screens)) {
      for (const m of html.matchAll(/(?<![-\w])(?:w|min-w)-\[(\d+)px\]/g)) if (Number(m[1]) > 358) wide.push(`${name}: ${m[0]}`);
      for (const m of html.matchAll(/style="[^"]*(?<!max-)width:(\d+)px/g)) if (Number(m[1]) > 358) wide.push(`${name}: width ${m[1]}px`);
      // Every control's opening tag carries a 44 px minimum; a checkbox or radio sits in a 44 px label.
      const tags = Array.from(html.matchAll(/<(button|a|select|summary|input|textarea)\b[^>]*>/g));
      for (const t of tags) {
        const tag = t[0];
        const cls = /class="([^"]*)"/.exec(tag)?.[1] ?? "";
        if (/type="(checkbox|radio)"/.test(tag)) {
          const before = html.slice(Math.max(0, t.index! - 400), t.index!);
          const label = before.lastIndexOf("<label");
          if (label < 0 || !/(?:min-)?h-\[44px\]/.test(before.slice(label))) small.push(`${name}: ${tag.slice(0, 80)}`);
          continue;
        }
        // A full-screen backdrop (inset-0) is the whole screen.
        if (!/(?:^|\s)(?:min-h-\[44px\]|h-\[44px\])/.test(cls) && !/leading-\[44px\]/.test(cls) && !/(?:^|\s)inset-0(?:\s|$)/.test(cls)) small.push(`${name}: ${tag.slice(0, 90)}`);
      }
    }
    const src = fs.readFileSync(path.join(ROOT, "src/components/sets/SetSelector.tsx"), "utf8");
    const sheet = /data-set-menu="sheet"/.test(selector) && /data-set-sheet-handle=""/.test(selector) && /data-set-sheet-backdrop=""/.test(selector) && /e\.key === "Escape"/.test(src) && selector.indexOf("data-set-actions") > selector.indexOf('data-set-block="mine"');
    const sticky = /data-editor-sticky=""[^>]*class="[^"]*fixed[^"]*bottom-0/.test(editor) && /data-editor-sticky=""[\s\S]*data-editor-save=""[\s\S]*data-editor-save-as=""/.test(editor) && /data-set-artwork=""[^>]*width:72px/.test(editor);
    const tabs = /role="tablist"/.test(library) && /data-library-card=/.test(library);
    const folded = /<details data-view-close|<details data-view-where/.test(view) && /<details data-view-where/.test(view);
    const pass = wide.length === 0 && small.length === 0 && sheet && sticky && tabs && folded;
    return { pass, detail: fmt({ fixedWidthsOver358: wide.join(" | ") || 0, controlsUnder44: small.slice(0, 6).join(" | ") || 0, controlsUnder44Count: small.length, menuSheet: sheet, editorStickyBar: sticky, libraryTabsAndCards: tabs, viewFolded: folded }) };
  },
  // R-SETS-WAY-BACK: the library and the set view, rendered on the server with and without returnTo; the
  // set menu's Manage sets rendered with a page address; the pure rules (return-to.test.ts, editor-return.test.ts).
  async setsWayBack() {
    const fs = await import("node:fs");
    const { execFileSync } = await import("node:child_process");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { SetSelector } = await import("../src/components/sets/SetSelector");
    const { SetsLibrary } = await import("../src/components/sets/SetsLibrary");
    const { SetsWayBack, wayBack } = await import("../src/components/sets/SetsShell");
    const root = new URL("..", import.meta.url).pathname;
    let unit = true;
    try {
      execFileSync("npx", ["-y", "tsx", "--test", "--test-force-exit", "src/lib/sets/return-to.test.ts", "src/lib/sets/editor-return.test.ts"], { cwd: root, stdio: "ignore" });
    } catch {
      unit = false;
    }
    const SET = "8a3c1d9e-0000-4000-8000-0000000000aa";
    const member = { urn: "110110", role: "teacher" as const };
    // 1. Manage sets: the page as it stands (a fake window: the menu draws its link when it opens).
    const g = globalThis as unknown as { window?: unknown };
    const had = g.window;
    g.window = { location: { pathname: "/teacher/admissions", search: "?view=pipelines&entry=11%2B&fset=set%3Aabc", hash: "", origin: "https://vicdata.co.uk" } };
    let menuHtml = "";
    try {
      menuHtml = renderToStaticMarkup(createElement(SetSelector, { label: "Feeder schools", kind: "feeders", current: { name: "Day", count: 18 }, rows: { default: [], school: [], mine: [] }, mine: null, selectedKey: null, onPick: () => undefined, manageHref: "/sets?kind=feeders&entry=11%2B", manageUrn: "110110", defaultOpen: true }));
    } finally {
      g.window = had;
    }
    const manageHref = (/<a href="([^"]*)"[^>]*>Manage sets</.exec(menuHtml)?.[1] ?? "").replace(/&amp;/g, "&");
    const manageRt = new URL(manageHref || "/", "https://x.invalid").searchParams.get("returnTo");
    const manage = manageRt === "/teacher/admissions?view=pipelines&entry=11%2B&fset=set%3Aabc&school=110110";
    const src = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
    const products = /manageUrn=\{member\.schoolUrn\}/.test(src("src/components/admissions/AdmissionsSets.tsx")) && /manageUrn=\{member\.schoolUrn\}/.test(src("src/components/smt/SmtDashboard.tsx")) && /manageUrn: schoolUrn/.test(src("src/components/dashboard-config/TeacherDashboard.tsx"));
    // 2. The library with returnTo: Back first, named for the page, 44 px on a phone; set links keep it.
    const set = { id: SET, name: "Day feeders", description: null, kind: "feeders" as const, entryPoint: "11+", phase: null, focusUrn: "110110", ownerScope: "school" as const, schoolAccountId: "a", ownerProfileId: null, creatorKind: "admissions" as const, audience: "day", rungAge: null, isDefault: true, pinned: true, folder: null, tags: [], archived: false, rule: null, sourceRecipe: null, laBlend: null, config: {}, members: [{ urn: "110137", position: 0, tier: null }], createdBy: null, createdAt: "", updatedBy: null, updatedAt: "" };
    const lib = { school: { urn: "110110", name: "Leighton Park", boarding: true }, entries: ["11+", "16+"], defaults: [], stored: [set], lastUsed: {}, folders: {}, names: {}, curates: { compared_against: true, feeders: true }, creators: { compared_against: "admissions" as const, feeders: "admissions" as const }, profileId: "p", personalActive: 0, cap: 8 };
    const rt = "/teacher/admissions?view=pipelines&entry=11%2B&school=110110";
    const back = wayBack(rt, member);
    const libPhone = renderToStaticMarkup(createElement(SetsLibrary, { data: lib as never, phone: true, back }));
    const libDesk = renderToStaticMarkup(createElement(SetsLibrary, { data: lib as never, back }));
    const firstLink = (h: string) => /<a [^>]*>/.exec(h)?.[0] ?? "";
    const backFirst = (h: string) => /data-sets-way-back="returnTo"/.test(firstLink(h)) && /Back to Pipelines</.test(h);
    const phone44 = /min-h-\[44px\]/.test(firstLink(libPhone));
    const enc = encodeURIComponent(rt).replace(/%20/g, "+");
    const linksKeep = libDesk.includes(`/sets/${SET}?urn=110110&amp;returnTo=${enc}`);
    // The set view's breadcrumb keeps returnTo; the editor's way back is the page itself (returnToHere).
    const viewSrc = src("src/app/sets/[id]/page.tsx");
    const crumb = /href=\{`\/sets\?urn=\$\{urn\}\$\{keepBack\}`\}/.test(viewSrc) && /<SetsWayBack back=\{back\}/.test(viewSrc) && /returnTo: returnToHere\(urn/.test(viewSrc) && /returnTo: returnToHere\(urn/.test(src("src/components/sets/SetsLibrary.tsx"));
    // 3. No returnTo, or one not allowed: the role's dashboard, "Back to dashboard".
    const fb = [null, "/sets?urn=110110", "https://evil.example/teacher/ks4", "javascript:alert(1)"].map((r) => wayBack(r, { urn: "110110", role: "admissions" }));
    const fallback = fb.every((b) => b.fallback && b.returnTo === "/teacher/admissions?school=110110" && b.label === "Back to dashboard") && wayBack(null, { urn: "110110", role: "smt" }).returnTo === "/teacher/smt?school=110110" && wayBack(null, member).returnTo === "/teacher?school=110110" && wayBack(null, null).returnTo === "/teacher";
    const libNone = renderToStaticMarkup(createElement(SetsLibrary, { data: lib as never, phone: true, back: wayBack(null, member) }));
    const noneShown = /data-sets-way-back="fallback"[^>]*href="\/teacher\?school=110110"|href="\/teacher\?school=110110"[^>]*data-sets-way-back="fallback"/.test(libNone) && /Back to dashboard</.test(libNone) && libNone.includes(`href="/sets/${SET}?urn=110110"`);
    // 4. The set goes back with the person when it's the kind the page uses.
    const link = (to: string, kind: "feeders" | "compared_against") => renderToStaticMarkup(createElement(SetsWayBack, { back: wayBack(to, member), set: { id: SET, kind, entry: "11+", phase: null } }));
    const goes = link(rt, "feeders").includes(`useSet=${SET}`) && !link("/teacher/admissions?view=market-share&entry=11%2B", "feeders").includes("useSet=") && link("/teacher/admissions?view=market-share&entry=11%2B", "compared_against").includes(`useSet=${SET}`);
    const pass = unit && manage && products && backFirst(libPhone) && backFirst(libDesk) && phone44 && linksKeep && crumb && fallback && noneShown && goes;
    return { pass, detail: fmt({ unitTests: unit ? "pass" : "FAIL", manageSetsReturnTo: manageRt ?? "none", allThreeProducts: products, libraryBackFirst: backFirst(libPhone) && backFirst(libDesk), phone44, setLinksKeepReturnTo: linksKeep, viewBreadcrumbAndEditor: crumb, fallbackToRoleDashboard: fallback && noneShown, setGoesBackWhenItsKind: goes }) };
  },
  // R-SMT-ENTRIES-SIZE: the fifths and the badge on a fixture and in the unit tests, the migration in
  // PGlite, then the live table if it's applied (MANUAL until then: the migration is Guy's to apply).
  async smtEntriesSize(L) {
    const { execFileSync } = await import("node:child_process");
    const es = await import("../src/lib/subject-entry-size");
    const root = new URL("..", import.meta.url).pathname;
    const run = (cmd: string, a: string[]) => {
      try {
        return { ok: true, out: execFileSync(cmd, a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e8 }) };
      } catch (e) {
        return { ok: false, out: String((e as { stdout?: string }).stdout ?? "") };
      }
    };
    const unit = run("npx", ["-y", "tsx", "--test", "--test-force-exit", "src/lib/subject-entry-size.test.ts"]);
    const unitPassed = Number(/^(?:ℹ|#) pass (\d+)/m.exec(unit.out)?.[1] ?? "0");
    // Fixture: 50 schools entering (1..50) and 30 that don't (0): the zeros are left out, each badge
    // holds ten schools, a cut point is the band above, and nine schools are too few to size.
    const counts = [...Array.from({ length: 50 }, (_, i) => i + 1), ...Array(30).fill(0)];
    const f = es.fifthsOf(counts)!;
    const per: Record<string, number> = {};
    for (const n of counts) {
      const b = es.entrySizeBadge(n, f);
      if (b) per[b] = (per[b] ?? 0) + 1;
    }
    const fixture =
      f.schools === 50 && ["XS", "S", "M", "L", "XL"].every((b) => per[b] === 10) && es.entrySizeBadge(f.p20, f) === "S" && es.entrySizeBadge(0, f) === null && es.entrySizeBadge(5, es.fifthsOf([1, 2, 3, 4, 5, 6, 7, 8, 9])) === null && es.MIN_SCHOOLS_TO_SIZE === 10;
    const pg = run("node", ["supabase/tests/v08_subject_entry_size_pglite.mjs"]);
    const pgPass = (pg.out.match(/^PASS /gm) ?? []).length;
    const offline = unit.ok && unitPassed >= 5 && fixture && pg.ok && /all passed/.test(pg.out);
    const offlineDetail = { unitTests: unit.ok ? unitPassed : "FAIL", fixture: fixture ? `pass (${JSON.stringify(f)})` : "FAIL", pglite: pg.ok ? `${pgPass} pass` : "FAIL" };
    // Live: the latest Post-16 year in the table (from the data), A-level Psychology, Leighton Park's badge.
    const sb = L.sb.createServerAnonSupabaseClient();
    const latest = await sb.from("subject_entry_size_fifths").select("period").eq("ks_stage", "ks5").order("period", { ascending: false }).limit(1);
    if (latest.error) return { pass: offline, manual: offline, detail: fmt({ ...offlineDetail, live: `table not applied yet (${latest.error.code ?? latest.error.message}): apply 20261122090000 and run the sync` }) };
    const period = (latest.data?.[0] as { period: number } | undefined)?.period;
    if (period === undefined) return { pass: offline, manual: offline, detail: fmt({ ...offlineDetail, live: "table applied but empty: run scripts/sync-subject-entry-size-fifths.ts" }) };
    const key = { qualification: "GCE A level", subject: "Psychology", period };
    const fifths = (await es.entrySizeFifths("ks5", [key, { ...key, subject: es.ALL_SUBJECTS }])).get(es.entrySizeKey(key));
    const lp = (await L.ref.lookupAcademicSubjectQualificationHeadline({ entityIds: ["110110"], ksStage: "ks5", qualificationType: "GCE A level", periodMin: period, periodMax: period })).find((r) => r.subject === "Psychology" && r.period === period);
    const entries = lp ? Number(lp.entries_total) : null;
    const badge = es.entrySizeBadge(entries, fifths);
    const ordered = !!fifths && fifths.p20 <= fifths.p40 && fifths.p40 <= fifths.p60 && fifths.p60 <= fifths.p80 && fifths.schools >= 1000;
    const live = ordered && (entries === null ? badge === null : badge !== null);
    return { pass: offline && live, detail: fmt({ ...offlineDetail, period, psychology: fifths ? `${fifths.schools} schools, ${fifths.p20}/${fifths.p40}/${fifths.p60}/${fifths.p80}` : "none", leightonPark: `${entries ?? "no"} entries -> ${badge ?? "no badge"}` }) };
  },
  // R-SETS-RLS: the read, write, curate, cap and stamp checks in v08_sets_r1_pglite.mjs.
  async setsRls() {
    const { execFileSync } = await import("node:child_process");
    const root = new URL("..", import.meta.url).pathname;
    let out = "";
    let ok = true;
    try {
      out = execFileSync("node", ["supabase/tests/v08_sets_r1_pglite.mjs"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e8 });
    } catch (e) {
      ok = false;
      out = String((e as { stdout?: string }).stdout ?? "");
    }
    const sections = ["who reads", "who writes: compared-against school sets", "who writes: feeder school sets", "no set moves or changes hands", "the cap: 8 active personal sets", "the stamp and the per-user state", "save_set"];
    const bySection: Record<string, string> = {};
    let cur = "";
    for (const l of out.split("\n")) {
      const m = /^-- (.*)$/.exec(l);
      if (m) cur = sections.find((s) => m[1].startsWith(s)) ?? "";
      else if (cur && /^(PASS|FAIL)/.test(l)) bySection[cur] = (bySection[cur] ?? "") + (l.startsWith("PASS") ? "+" : "x");
    }
    const pass = ok && sections.every((s) => (bySection[s] ?? "").length > 0 && !bySection[s].includes("x"));
    return { pass, detail: sections.map((s) => `${s}: ${(bySection[s] ?? "").split("").filter((c) => c === "+").length} pass${(bySection[s] ?? "").includes("x") ? ", FAIL" : ""}`).join("; ") };
  },
};

// --------------------------------------------------------------------------- main
async function main() {
  const only = process.argv.slice(2).filter((a) => a.startsWith("R-"));
  const rules = only.length ? only.map((id) => ruleById(id)).filter((r): r is Rule => !!r) : RULES;
  if (!process.env.VICDATA_API_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("Missing VICDATA_API_URL / NEXT_PUBLIC_SUPABASE_URL: run with --env-file=.env (values are never printed).");
    process.exit(2);
  }
  const L = await lib();
  const counts = { PASS: 0, FAIL: 0, ERROR: 0, MANUAL: 0, NONE: 0, SUPERSEDED: 0 };
  for (const rule of rules) {
    if (rule.status === "superseded") {
      counts.SUPERSEDED++;
      console.log(`SUPERSEDED ${rule.id} -> ${rule.supersededBy}`);
      continue;
    }
    const tc = rule.testCase;
    if (!tc) {
      counts.NONE++;
      console.log(`NONE   ${rule.id}`);
      continue;
    }
    const runner = tc.check ? RUNNERS[tc.check] : undefined;
    if (!runner) {
      counts.MANUAL++;
      console.log(`MANUAL ${rule.id}  ${tc.school} (${tc.urn}): ${tc.expect}`);
      continue;
    }
    const t0 = Date.now();
    try {
      const out = await runner(L, rule);
      if (out.manual) {
        counts.MANUAL++;
        console.log(`MANUAL ${rule.id} [${tc.check}] ${tc.school} (${tc.urn}): ${out.detail} (${Date.now() - t0}ms)`);
        continue;
      }
      counts[out.pass ? "PASS" : "FAIL"]++;
      console.log(`${out.pass ? "PASS  " : "FAIL  "} ${rule.id} [${tc.check}] ${tc.school} (${tc.urn}): ${out.detail} (${Date.now() - t0}ms)`);
    } catch (e) {
      counts.ERROR++;
      console.log(`ERROR  ${rule.id} [${tc.check}]: ${(e as Error).message}`);
      if (process.env.RULE_STACK) console.log((e as Error).stack);
    }
  }
  console.log(`\n${fmt(counts)}`);
  if (counts.FAIL || counts.ERROR) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
