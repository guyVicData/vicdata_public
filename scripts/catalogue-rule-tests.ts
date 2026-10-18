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


type Outcome = { pass: boolean; detail: string };
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
      return { school, set, overview: await buildOverview(school, set, { sex: "all", boarding: "all" }, null) };
    })().catch((e) => {
      smtMemo.delete(urn); // a failed read isn't kept: the next runner tries again
      throw e;
    }));
  return smtMemo.get(urn) as Promise<Case>;
}
async function smtAcademicCase(urn: string, phase: "whole" | "gcse" | "post16" | "primary", area: string | null) {
  const key = `${urn}|${phase}|${area ?? ""}`;
  if (!smtMemo.has(key))
    smtMemo.set(key, (async () => {
      const c = await smtCase(urn);
      const { buildAcademic } = await import("../src/lib/smt/academic");
      return buildAcademic(c.school, { phase, area }, c.set);
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
    level: academic?.level ?? (more.context ? { phase: more.context.level, area: null } : { phase: "whole", area: null }),
    set: c.set,
    filters: { sex: "all", boarding: "all" },
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
  };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(InitialWidth.Provider, { value: 800 }, createElement(ViewBody, { dv, c: ctx as never, fullscreen: false }))));
}
async function smtPupilsCase(urn: string, phase: "whole" | "gcse" | "post16" | "primary" = "whole") {
  const key = `pupils|${urn}|${phase}`;
  if (!smtMemo.has(key))
    smtMemo.set(key, (async () => {
      const c = await smtCase(urn);
      const { buildPupils } = await import("../src/lib/smt/pupils");
      return buildPupils(c.school, c.set, { sex: "all", boarding: "all" }, { phase, area: null }, null);
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
  async admViewFunnel() {
    const v = await import("../src/lib/admissions/views-api");
    const { fetchBirthsByLa } = await import("../src/lib/admissions/data");
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const today = new Date("2026-10-12");
    const p = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today });
    const p4 = await v.pipelineView("115786", v.entryPoint("4+")!, [], { today });
    if ("empty" in p || "empty" in p4) return { pass: false, detail: "empty" };
    const [b, pool, entry] = [p.funnel.find((s) => s.kind === "births"), p.funnel.find((s) => s.kind === "pool"), p.funnel.find((s) => s.kind === "entry")];
    const la = b?.area?.[0];
    const births = await fetchBirthsByLa([la!.laCode]);
    const expect = Math.round((8 / 12) * (births.get(la!.laCode)?.get(2014) ?? NaN) + (4 / 12) * (births.get(la!.laCode)?.get(2013) ?? NaN));
    const { data } = await createServerAnonSupabaseClient().from("age_profile_aggregates").select("by_age").eq("scope", "la").eq("scope_key", la!.laName!).eq("period", 2024).maybeSingle<{ by_age: Record<string, number> }>();
    const labels = p.funnel.map((s) => s.label).join(" / ");
    const pass = p.funnel.length === 3 && b?.value === expect && b?.year === 2014 && pool?.value === data?.by_age["10"] && pool?.age === 10 && pool?.year === 2024 && entry?.value === 236 && labels === "Births / Year 6 / Your Year 7" && p4.funnel.length === 0;
    return { pass, detail: fmt({ area: la?.laName, births: b?.value, expect, pool: pool?.value, rawAge10: data?.by_age["10"], entry: entry?.value, labels, fourPlus: p4.funnel.length }) };
  },
  async admFunnelSameArea() {
    const v = await import("../src/lib/admissions/views-api");
    const { fetchBirthsByLa } = await import("../src/lib/admissions/data");
    const { fetchSchoolTraits } = await import("../src/lib/admissions/traits");
    const { createServerAnonSupabaseClient } = await import("../src/lib/supabase");
    const today = new Date("2026-10-12");
    const sb = createServerAnonSupabaseClient();
    const raw = async (laName: string, age: number) => (await sb.from("age_profile_aggregates").select("by_age").eq("scope", "la").eq("scope_key", laName).eq("period", 2024).maybeSingle<{ by_age: Record<string, number> }>()).data?.by_age[String(age)] ?? NaN;
    const out: string[] = [];
    let pass = true;
    const check = async (urn: string, entry: string, lists: Parameters<typeof v.pipelineView>[2], expectArea: { laCode: string; weight: number }[] | null) => {
      const p = await v.pipelineView(urn, v.entryPoint(entry)!, lists, { today });
      if ("empty" in p) { pass = false; return; }
      const b = p.funnel.find((s) => s.kind === "births")!;
      const pool = p.funnel.find((s) => s.kind === "pool")!;
      const key = (a: typeof b.area) => JSON.stringify((a ?? []).map((x) => [x.laCode, x.laName, Math.round(x.weight * 1e6)]));
      const own = (await fetchSchoolTraits([urn])).get(urn)!;
      const want = expectArea ?? [{ laCode: own.laCode!, weight: 1 }];
      const sameArea = key(b.area) === key(pool.area) && JSON.stringify((b.area ?? []).map((x) => [x.laCode, Math.round(x.weight * 1e6)])) === JSON.stringify(want.map((x) => [x.laCode, Math.round(x.weight * 1e6)]));
      const births = await fetchBirthsByLa(want.map((x) => x.laCode));
      const X = 2025 - p.entry.age;
      const bl = (y: number) => want.reduce((a, x) => a + x.weight * (births.get(x.laCode)?.get(y) ?? NaN), 0);
      const expBirths = Math.round((8 / 12) * bl(X) + (4 / 12) * bl(X - 1));
      let expPool = 0;
      for (const x of b.area!) expPool += x.weight * (await raw(x.laName!, p.entry.age - 1));
      // The age mapping is the ladder's: the pool's age is a rung the ladder counts at.
      const ladderAge = p.sets.some((s) => s.age === p.entry.age - 1);
      const ok = sameArea && b.value === expBirths && pool.value === Math.round(expPool) && pool.age === p.entry.age - 1 && pool.year === 2024 && ladderAge;
      pass &&= ok;
      out.push(`${urn} ${entry}${expectArea ? " blend" : ""}: area ${(b.area ?? []).map((x) => `${x.laName} ${Math.round(x.weight * 100)}%`).join("+")}, births ${b.value}/${expBirths}, pool ${pool.value}/${Math.round(expPool)} ${ok ? "ok" : "MISMATCH"}`);
    };
    await check("137625", "11+", [], null);
    await check("137625", "16+", [], null);
    await check("117037", "11+", [], null);
    // A lead's blend: the same blend, weighted the same way, for both bars.
    const base = await v.pipelineView("137625", v.entryPoint("11+")!, [], { today });
    if (!("empty" in base) && base.blend.length >= 2) {
      const blend = { [base.blend[0].laCode]: 0.7, [base.blend[1].laCode]: 0.3 };
      await check("137625", "11+", [{ kind: "day_feeders", rung: null, members: null, la_blend: blend, confirmed: true }], Object.entries(blend).map(([laCode, weight]) => ({ laCode, weight })));
    }
    return { pass, detail: out.join("; ") };
  },
  async admBoardingOnly() {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const v = await import("../src/lib/admissions/views-api");
    const { fetchSchoolTraits } = await import("../src/lib/admissions/traits");
    const { AdmissionsEveryView } = await import("../src/components/admissions/AdmissionsDashboard");
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
      if (!boarding) {
        const leaks = [...own, ...setup].map(text).filter((x) => BOARD.test(x)).map((x) => x.match(BOARD)![0]);
        const marketControls = market.map(text).some((x) => /Rivals with boarders|Boarding only/.test(x));
        const tile = /Day · boarding/.test(text(html)) === false && />Day</.test(html);
        // The server ignores a boarding filter for a day school: the same pool as with none.
        const asked = await v.pipelineView(urn, ep, [], { today, filters: { lists: "boarding", sector: "all", boardingOnly: false } });
        const ignored = !("empty" in asked) && !("empty" in p) && JSON.stringify(asked.ladder) === JSON.stringify(p.ladder);
        const steps = /Step 1 of 3/.test(setup[0]) && /Step 3 of 3/.test(setup[3]) && /Step 2 of 3/.test(setup[2]);
        const ok = leaks.length === 0 && !marketControls && tile && ignored && steps && editorOk;
        pass &&= ok;
        out.push(`${urn} ${entry} day: ${chunks.length} surfaces + 4 setup steps + ${editor.length} editor Data steps, boarding words ${leaks.length}${leaks.length ? ` (${leaks.slice(0, 3).join(", ")})` : ""}, market controls ${marketControls}, Day-only tile ${tile}, filter ignored ${ignored}, steps 1-3 ${steps}, editor compare without boarding ${editorOk} ${ok ? "ok" : "FAIL"}`);
      } else {
        const T = text(html);
        const filters = chunks.filter((c) => c.startsWith("<div data-adm-filters")).every((c) => /Day \+ boarding/.test(text(c)));
        const tile = /Day · boarding/.test(T);
        const isc = ep.age > 4 ? /International boarders/.test(T) : true;
        const setupOk = /Day and boarding/.test(text(setup[0])) && /Your boarding feeders/.test(text(setup[2])) && /Step 3 of 4/.test(setup[2]) && /Step 4 of 4/.test(setup[3]) && /Boarding only/.test(text(setup[3]));
        // The boarding feeder list end to end: setup's search returns preps with boarders, kept as a
        // fuzzy set, and Boarding only draws the pool from them.
        const cand = await v.candidatesView(urn, ep, new URLSearchParams({ kind: "boarding", mode: "nearest", n: "40" }));
        const preps = cand.rows.filter((x) => x.boarding && x.sector === "independent");
        const bp = await v.pipelineView(urn, ep, [{ kind: "boarding_feeders", rung: null, members: preps.map((x) => x.urn), la_blend: null, confirmed: true }], { today, filters: { lists: "boarding", sector: "all", boardingOnly: false } });
        const used = !("empty" in bp) && bp.sets.some((x) => x.urns.some((u) => preps.some((pp) => pp.urn === u)));
        const ok = filters && tile && isc && setupOk && preps.length > 0 && preps.length === cand.rows.length && used && editorOk;
        pass &&= ok;
        out.push(`${urn} ${entry} boarding: filters ${filters}, tile ${tile}, ISC note ${isc}, setup 1-4 ${setupOk}, boarding preps ${preps.length}/${cand.rows.length}, boarding-only pool from them ${used}, editor's feeder chips on ${editor.length} views ${editorOk} ${ok ? "ok" : "FAIL"}`);
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
    const a = await smtAcademicCase("137625", "gcse", "sciences_maths");
    const dbl = a.parts[0].subjects.find((x) => x.subject === "Combined Science");
    const fsmq = a.parts[0].subjects.find((x) => /FSMQ/.test(x.qualification) || /FSMQ/.test(x.subject));
    pass &&= !!dbl?.set && !!dbl?.england && dbl.avg !== null && (!fsmq || fsmq.reason === "scale");
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
    const a = await smtAcademicCase("137625", "gcse", null);
    const p = a.parts[0];
    const years = p.mix.years.map((y) => y.year);
    const trendYears = p.trend.school.filter((x) => x.value !== null).map((x) => x.year);
    const sums = p.mix.years.every((y) => Math.abs(Object.values(y.shares).reduce((s, v) => s + v, 0) - 100) < 1e-6);
    // R-ENTRIES-FIRST-YEAR (year rules leftovers): the mix starts at the rollup's first year with entries
    // (2020/21 at GCSE), a year before the results trend's first graded year.
    const L = await lib();
    const head = (await L.adv.fetchSubjectHeadlineForSchools(["137625"], "ks4")).get("137625") ?? [];
    const first = Math.min(...head.filter((e) => e.entriesTotal > 0).map((e) => e.period));
    const pass = years[0] === first && years.at(-1) === p.period && trendYears[0] === L.notes.GRADING_2122_PERIOD && years[0] < trendYears[0] && sums;
    return { pass, detail: fmt({ mixYears: years.join("/"), rollupFirst: first, trendFrom: trendYears[0], addsTo100: sums }) };
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
    const html = textOf(await smtRender("137625", "DV-SMT-P-NOW", undefined, { pupils: p }));
    const lpHtml = textOf(await smtRender("110110", "DV-SMT-P-NOW", undefined, { pupils: lp }));
    const pass = p.now.roll === c.school.census.at(-1)!.totalRoll && Math.abs((p.now.stayingOn?.pct ?? -1) - pct) < 1e-9 && p.now.boarding === null && !/Day · boarding/.test(html) && /Day · boarding/.test(lpHtml) && /Girls · boys/.test(html);
    return { pass, detail: fmt({ roll: p.now.roll, stayingOn: round(p.now.stayingOn?.pct, 1), recomputed: round(pct, 1), chaseBoardingTile: /Day · boarding/.test(html), leightonBoardingTile: /Day · boarding/.test(lpHtml) }) };
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
      chaseDefault: K.resolveCatchment(chase, null, null).km === 5 && K.catchmentCapKm(chase) === 30,
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
    const academic = await smtAcademicCase("110110", "gcse", null);
    // 0.8 IGCSE subjects: only the whole-school views keep the note (value added; the headline trend).
    const html = textOf(await smtRender("110110", "DV-SMT-A-VA", academic));
    const sc = textOf(await smtRender("110110", "DV-SMT-O-SCORECARD"));
    const pass = g.length === 2 && g.every((r) => r.note === "igcse" && r.value === null && r.set === null && r.england === null) && !!a?.set && setPhaseOf(c.school.phases) === "ks5" && html.includes(smtNote("igcseView", { school: c.school.name })) && /IGCSE not ranked/.test(sc) && !!SMT_NOTES.igcseChip;
    return { pass, detail: fmt({ gcseRows: g.map((r) => `${r.label}:${r.note}`).join("/"), alevelRank: a?.set && `${a.set.rank} of ${a.set.of}`, setPhase: setPhaseOf(c.school.phases), gcseViewSaysWhy: html.includes("sits IGCSEs"), scorecardNotRanked: /IGCSE not ranked/.test(sc) }) };
  },
  async smtP8() {
    const chase = (await smtCase("137625")).overview.p8;
    const lp = (await smtCase("110110")).overview.p8;
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const pass = chase.status === "published" && chase.period === 2023 && Math.abs(chase.value - 0.08) < 1e-9 && /2024\/25/.test(chase.text) && lp.status === "independent" && lp.text === SMT_NOTES.p8Independent;
    return { pass, detail: fmt({ chase: chase.status === "published" ? `${chase.value} (${chase.period}) "${chase.text}"` : chase.status, leighton: `${lp.status} "${lp.text}"` }) };
  },
  async smtVa() {
    const a = await smtAcademicCase("137625", "post16", null);
    const L = await lib();
    const latest = (await smtCase("137625")).school.latest.ks5!.period;
    const raw = (await L.ref.lookupAcademicHeadline({ entityIds: ["137625"], ksStage: "ks5", periodMin: latest, periodMax: latest }))[0]?.measures ?? {};
    const r = a.va.alevel.find((x) => x.qualification === "A level" && x.period === latest);
    const html = textOf(await smtRender("137625", "DV-SMT-A-VA", a));
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const pass = !!r && r.value === Number(raw["A level::value_added"]) && r.lo === Number(raw["A level::value_added_lower_ci"]) && r.hi === Number(raw["A level::value_added_upper_ci"]) && r.banding === raw["A level::progress_banding"] && html.includes(SMT_NOTES.alevelVa.slice(0, 60));
    return { pass, detail: fmt({ va: r && `${r.value} (${r.lo} to ${r.hi}) ${r.banding}`, raw: `${raw["A level::value_added"]} (${raw["A level::value_added_lower_ci"]} to ${raw["A level::value_added_upper_ci"]}) ${raw["A level::progress_banding"]}`, wordingShown: html.includes(SMT_NOTES.alevelVa.slice(0, 60)) }) };
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
    const { pillsFor } = await import("../src/lib/smt/levels");
    const { buildOverview } = await import("../src/lib/smt/overview");
    const chase = await smtCase("137625");
    const lp = await smtCase("110110");
    const ignored = await buildOverview(chase.school, chase.set, { sex: "all", boarding: "boarding" }, null);
    const pass = pillsFor(chase.school).join() === "gender" && pillsFor(lp.school).join() === "gender,boarding" && ignored.filters.boarding === "all" && !ignored.rows.some((r) => r.key === "boarders") && ignored.now.roll === chase.overview.now.roll && lp.overview.rows.some((r) => r.key === "boarders") && lp.overview.trends.roll.lines.some((l) => l.key === "boarding");
    return { pass, detail: fmt({ chasePills: pillsFor(chase.school).join("+"), leightonPills: pillsFor(lp.school).join("+"), chaseBoardingFilterIgnored: ignored.filters.boarding === "all" && ignored.now.roll === chase.overview.now.roll, leightonBoardersRow: lp.overview.rows.some((r) => r.key === "boarders"), leightonLines: lp.overview.trends.roll.lines.map((l) => l.key).join("/") }) };
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
    const pass = /for independent schools/.test(html) && /IGCSE school/.test(html) && copies.length === 0;
    return { pass, detail: fmt({ p8Reason: /for independent schools/.test(html), igcseTile: /IGCSE school/.test(html), copiedSentences: copies.join(" ") || "none" }) };
  },
  async smtSubjects() {
    const a = await smtAcademicCase("137625", "gcse", "sciences_maths");
    const { MIN_SUBJECT_ENTRIES } = await import("../src/lib/smt/academic");
    const subs = a.parts[0].subjects;
    const small = subs.filter((x) => x.entries < MIN_SUBJECT_ENTRIES);
    const bio = subs.find((x) => x.subject === "Biology");
    const { subjectRanking } = await import("../src/lib/subject-ranking");
    const c = await smtCase("137625");
    const s = bio ? await subjectRanking({ urns: ["137625", ...c.set.urns], targetUrn: "137625", phase: "ks4", subject: "Biology", familyId: bio.familyId, qualificationType: bio.qualification, measure: { kind: "points" }, period: null }, "rule:smt") : null;
    const html = await smtRender("137625", "DV-SMT-A-SUBJECTS", a);
    const linkOk = /\/teacher\/ks4\?set=\d{6}(,\d{6})*&amp;setLabel=/.test(html);
    const pass = small.every((x) => !x.ranked && x.set === null) && !!bio && !!s && bio.set?.rank === s.targetRank && bio.set?.of === s.ranked && Math.abs((bio.avg ?? 0) - (s.target?.value ?? -1)) < 1e-9 && linkOk;
    return { pass, detail: fmt({ subjects: subs.length, unrankedSmall: small.map((x) => `${x.subject}(${x.entries})`).join(" ") || "none", biology: bio && `${bio.avg} ${bio.set?.rank} of ${bio.set?.of}`, subjectRanking: s && `${s.target?.value} ${s.targetRank} of ${s.ranked}`, explorerLink: linkOk }) };
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
    const a = await smtAcademicCase("137625", "gcse", "sciences_maths");
    const L = await lib();
    const p = a.parts[0].period!;
    const fam = (await L.ref.lookupAcademicSubjectFamily({ entityIds: ["137625"], ksStage: "ks4", familyIds: ["sciences_maths"], periodMin: p, periodMax: p })).find((r) => (r.bucket ?? "all") === "all");
    const entries = a.parts[0].tiles.find((t) => t.key === "entries")?.value;
    const avg = a.parts[0].tiles.find((t) => t.key === "area_avg")?.value;
    // S4: four tiles with an area, the rank its own and last (GCSE and Post-16).
    const post = await smtAcademicCase("137625", "post16", (await smtCase("137625")).school.areas.post16[0].id);
    const order = (t: { key: string }[]) => t.map((x) => x.key).join(",");
    const fourOk = order(a.parts[0].tiles) === "entries,area_avg,top,area_rank" && order(post.parts[0].tiles) === "entries,area_avg,top,area_rank";
    const pass = !!fam && entries === Number(fam.entries_total) && avg === Number(fam.avg_point_score) && fourOk;
    return { pass, detail: fmt({ entries, familyEntries: fam?.entries_total, average: avg, familyAverage: fam?.avg_point_score, gcseTiles: order(a.parts[0].tiles), post16Tiles: order(post.parts[0].tiles) }) };
  },
  async smtAreas() {
    const a = await smtAcademicCase("137625", "gcse", null);
    const c = await smtCase("137625");
    const { buildRivals } = await import("../src/lib/admissions/rivals");
    const { entryPoint } = await import("../src/lib/admissions/entry-points");
    const r = await buildRivals("137625", entryPoint("11+")!, { rivals: c.set.urns });
    const mine = a.parts[0].areas.map((x) => `${x.familyId}:${x.rank}/${x.of}:${x.gap.toFixed(3)}`).sort().join(" ");
    const theirs = r.areas.map((x) => `${x.familyId}:${x.rank}/${x.of}:${x.gap.toFixed(3)}`).sort().join(" ");
    return { pass: mine === theirs && mine.length > 0, detail: fmt({ areas: a.parts[0].areas.length, same: mine === theirs }) };
  },
  async smtGrades() {
    const a = await smtAcademicCase("137625", "gcse", null);
    const g = a.parts[0].grades;
    const sum = g.bands.reduce((s, b) => s + b.entries, 0);
    const pct = g.bands.reduce((s, b) => s + b.pct, 0);
    const mixOk = a.parts[0].mix.years.every((y) => Math.abs(Object.values(y.shares).reduce((s, v) => s + v, 0) - 100) < 1e-6);
    const pass = g.entries > 0 && sum === g.entries && Math.abs(pct - 100) < 1e-6 && mixOk;
    return { pass, detail: fmt({ graded: g.entries, bandsSum: sum, pct: round(pct, 4), mixYears: a.parts[0].mix.years.map((y) => y.year).join("/"), mixAddsTo100: mixOk }) };
  },
  async smtReserved() {
    const a = await smtAcademicCase("137625", "gcse", null);
    const html = textOf(await smtRender("137625", "DV-SMT-A-BANDS", a));
    const { SMT_NOTES } = await import("../src/catalogue/notes");
    const exact = SMT_NOTES.bandReserved === "Arrives with the results-by-band round: the top 25%, middle 50% and bottom 25% of entries.";
    const pass = exact && !/pupils/.test(SMT_NOTES.bandReserved) && html.includes(SMT_NOTES.bandReserved) && !/\d+(\.\d+)?%/.test(html.replace(SMT_NOTES.bandReserved, "").replace(/Top 25%, middle 50%, bottom 25%/, ""));
    return { pass, detail: fmt({ captionOfEntries: exact, shown: html.includes(SMT_NOTES.bandReserved), noFigures: pass }) };
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
