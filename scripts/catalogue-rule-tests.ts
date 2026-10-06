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
  if (!process.env.VICDATA_API_URL && existsSync(file)) process.loadEnvFile(file);
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

type Outcome = { pass: boolean; detail: string };
type Runner = (L: Lib, rule: Rule) => Promise<Outcome>;

const round = (v: number | null | undefined, dp = 1) => (v === null || v === undefined ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const near = (a: number | null, b: number, tol = 0.05) => a !== null && Math.abs(a - b) <= tol;
const fmt = (o: Record<string, unknown>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

// --------------------------------------------------------------------------- runners
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
  async pointsSameQual({ adv, tvm, pop }) {
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
    const pass = aRow !== null && v.aLevelFamily === round(aRow, 2) && v.btecRows > 0 && v.btecFamily !== null && v.btecFamily !== v.aLevelFamily && v.noFocus === null && v.keepsOnPoints && !v.keepsOnEntries;
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

  // R-TREND-LINE-4YR: Acland Burghley 100053 GCSE Maths (General) (the rollup's subject name). Points: 4 real years -> line;
  // Grade 4+ (from the dashboard's grade rows, gradeYears "four"): 4 years -> line since 0.6.2 (2 years -> bars before).
  async trendLine({ adv, sg, tvp }) {
    const urn = "100053";
    const headline = ((await adv.fetchSubjectHeadlineForSchools([urn], "ks4")).get(urn) ?? []).filter((h) => h.subject === "Maths (General)");
    const periods = [...new Set(headline.map((h) => h.period))].sort();
    const points = { periods, series: [{ key: "m", label: "Mathematics", colour: "#000", values: periods.map((p) => headline.find((h) => h.period === p)?.avgPointScore ?? null) }] };
    const grades = ((await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? []).filter(
      (r) => r.subject === "Maths (General)" && r.qualificationType === "GCSE (9-1) Full Course",
    );
    const gp = [...new Set(grades.map((r) => r.period))].sort();
    const rate = { periods: gp, series: [{ key: "m", label: "Mathematics", colour: "#000", values: gp.map((p) => sg.thresholdRate(grades.filter((r) => r.period === p), "ks4")?.rate ?? null) }] };
    const v = {
      pointsYears: tvp.periodsWithData(points).length,
      pointsKind: tvp.trendChartKind(points),
      grade4Years: tvp.periodsWithData(rate).length,
      grade4Kind: tvp.trendChartKind(rate),
    };
    return { pass: v.pointsYears === 4 && v.pointsKind === "line" && v.grade4Years === 4 && v.grade4Kind === "line", detail: fmt(v) };
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

  // R-CURRENT-GRADES-FROM-2324: Acland Burghley 100053 GCSE Grade 4+ on its real four-year rows.
  // Read from 2023/24 on, as Current reads them: Turkish (grades only before 2023/24) leaves
  // the list, and Latin (no 2023/24) has no "vs last year" -- not 2024/25 against 2022/23.
  async currentGradesFrom2324({ adv, sg, tvp }) {
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
    return { pass: !v.turkishListed && v.turkishHasOldGrades && latin !== undefined && latin.delta === null && v.points === null && v.periods === "2021 2022 2023 2024", detail: fmt(v) };
  },

  // R-THRESHOLD-PERIODS: Acland Burghley 100053's school grade rows (the dashboard's, gradeYears
  // "four") cover exactly 2021/22-2024/25 since 0.6.2 (2023/24 and 2024/25 before). The Data
  // View's read (no option) is unchanged: still the modern years only.
  async thresholdPeriods({ adv, ref }) {
    const urn = "100053";
    const grades = (await adv.fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" })).byUrn.get(urn)?.gradeDistribution ?? [];
    const periods = [...new Set(grades.map((r) => r.period))].sort();
    const dataView = (await adv.fetchSubjectLevelDataForSchools([urn], "ks4")).byUrn.get(urn)?.gradeDistribution ?? [];
    const dvPeriods = [...new Set(dataView.map((r) => r.period))].sort();
    return {
      pass: periods.join(",") === "2021,2022,2023,2024" && dvPeriods.join(",") === "2023,2024",
      detail: fmt({ gradePeriods: periods.join(" "), dataViewPeriods: dvPeriods.join(" "), source: ref.gradeRollupRpcState() === "present" ? "rollup" : "facts" }),
    };
  },

  // R-HISTORIC-GRADE-LABELS: Croydon College 130432 Business Studies, BTEC Extended Certificate,
  // 2021/22 in its modern words on the vocational scale; King's Worcester 117037 A-level Maths
  // 2021/22 keeps its "*" rows on the A-level scale. Through the dashboard's read.
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
      mathsAtoE: round(mathsRate?.rate ?? null),
      mathsGraded: mathsRate?.entries ?? null,
    };
    const pass =
      v.btec === "Distinction*:2 Distinction:9 Merit:31 Pass:9" && v.btecShortCodes === 0 && v.covid === 44 && v.btecScale === "Distinction*" && sg.NON_GRADE_VALUES.has("COVID result") &&
      v.mathsStarRows > 0 && v.mathsAtoE === 100 && v.mathsGraded === 45;
    return { pass, detail: fmt(v) };
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
    }
  }
  console.log(`\n${fmt(counts)}`);
  if (counts.FAIL || counts.ERROR) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
