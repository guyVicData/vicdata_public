// VicData 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md, B5):
// the SMT entries in the four-layer catalogue -- measures, renderers, dataviews and their ViewSpec
// presets -- for the two published SMT dashboards (vicdata.smt.overview, vicdata.smt.academic;
// dashboards/smt.ts). Every SMT view is a catalogue entry plus a component (src/components/smt/),
// drawn inside the shared shell.
//
// Appended AFTER Teacher's and Admissions' entries in every list, so their order, ids and presets
// are untouched. No SMT dataview carries a Teacher phase, so no Teacher context ever offers one.
//
// The level plays the part the subject plays for Teacher: every view follows the level chips
// (focus "level"). What can't be edited (rules, never look options): the honesty wording
// (SMT_NOTES, R-SMT-NOTES), the IGCSE rule (R-IGCSE-EXCL), Progress 8's reasons (R-SMT-P8-REASON),
// the flag thresholds (R-SMT-FLAGS, src/lib/smt/flags.ts) and the trend base (R-TREND-FROM-2223).
import type { AudienceTag, CompareKind, Dataview, DataviewId, Measure, MeasureId, NumberType, Renderer, RuleId, SmtDataId, SmtHostId, ViewType } from "./types";
import type { ViewSpec, ViewView, ViewYears } from "./viewspec";
import { CENSUS_FIRST_PERIOD, CURRENT_CENSUS_PERIOD, HISTORIC_GRADE_FROM, periodLabel, TREND_BASE_PERIOD } from "./years";

const C = "src/components/smt";

// ------------------------------------------------------------------------------- measures

const geo = (school: boolean, set: boolean, region: boolean, england: boolean, why = "Not held") => ({
  school: school ? { ok: true } : { ok: false, reason: why },
  subject_area: { ok: false, reason: "Not a subject measure" },
  set: set ? { ok: true } : { ok: false, reason: why },
  la: { ok: false, reason: "No LA ranks for results (0.6.6 ranks nationally and by region)" },
  region: region ? { ok: true, reason: "school_region_nation" } : { ok: false, reason: why },
  england: england ? { ok: true, reason: "every school with a figure" } : { ok: false, reason: why },
});

export const SMT_MEASURES: Measure[] = [
  {
    id: "M-SMT-SCHOOL",
    name: "The school: roll, phases and size",
    data: "smt.school",
    definition: "The January census: the whole roll, girls and boys, day and boarding (boarding schools), the phases with pupils, and the school page's XS-XL by phase (src/lib/smt/school.ts, overview.ts).",
    grain: "School × census year",
    sources: ["dfe_school_census", "age_band_pupil_distributions", "age_profile_aggregates"],
    years: { from: String(CENSUS_FIRST_PERIOD), to: String(CURRENT_CENSUS_PERIOD), latest: "census", note: `Change since ${periodLabel(CENSUS_FIRST_PERIOD)}; the LA and England lines are pupils aged 5-15.` },
    keying: "urn",
    geographies: geo(true, true, true, true),
    numberTypes: ["totals", "pct_change", "index100", "rank"],
    rules: ["R-SMT-SET-RANKS", "R-SMT-BOARDING-ONLY", "R-SMT-NOTES"],
    fetchedBy: ["src/lib/smt/school.ts:smtSchool", "src/lib/smt/overview.ts:buildOverview", "src/app/api/smt/overview/route.ts"],
    knownGaps: ["The LA and England roll lines count pupils aged 5-15 only (the per-year area aggregates).", "No boarders by age; boarders aren't ranked."],
    citation: "DfE school census (January)",
  },
  {
    id: "M-SMT-RESULTS",
    name: "Headline results and ranks",
    data: "smt.results",
    definition: "Attainment 8 and grade 5+ in English and maths (GCSE), A-level points per entry (Post-16), reading, writing and maths at the expected standard (KS2): the school's, its rank among the comparison set's schools with that result, in its region and in England (0.6.6's whole-population ranking), and its change since 2022/23 (src/lib/smt/population.ts).",
    grain: "School × results year",
    sources: ["academic_headline_snapshot", "dfe_ks2_attainment"],
    years: { from: String(HISTORIC_GRADE_FROM), to: "2024", latest: "ks4", note: `Change measured from ${periodLabel(TREND_BASE_PERIOD)} (R-TREND-FROM-2223); each key stage's latest from the data.` },
    keying: "urn",
    geographies: geo(true, true, true, true),
    numberTypes: ["points", "rate", "change_points", "change_pp", "rank"],
    rules: ["R-SMT-SET-RANKS", "R-IGCSE-EXCL", "R-SMT-IGCSE-WORDING", "R-TREND-FROM-2223", "R-SMT-YEARS"],
    fetchedBy: ["src/lib/smt/population.ts:population", "src/lib/smt/overview.ts:buildOverview", "src/lib/smt/academic.ts:buildAcademic"],
    knownGaps: ["No LA rank for results.", "IGCSE schools are listed but not ranked at GCSE.", "KS2 is thin for independent preps (most don't sit SATs)."],
    citation: "DfE KS2, KS4 and KS5 performance tables",
  },
  {
    id: "M-SMT-VA",
    name: "Value added",
    data: "smt.value_added",
    definition: "A-level value added by qualification type (A level, Academic, Applied general, Tech level) with DfE's 95% confidence interval and banding; subject A-level value added; Progress 8 where DfE published it (state schools, to 2023/24).",
    grain: "School × qualification type (or subject) × year",
    sources: ["academic_headline_snapshot", "dfe_ks5_subject_value_added"],
    years: { from: "2021", to: "2024", note: "Progress 8 2021/22-2023/24 (none for 2024/25 or 2025/26: no KS2 baseline); A-level value added 2023/24 and 2024/25." },
    keying: "urn",
    geographies: geo(true, true, true, true),
    numberTypes: ["points", "rank"],
    rules: ["R-SMT-P8-REASON", "R-SMT-VA-HONEST"],
    fetchedBy: ["src/lib/smt/overview.ts:p8Of", "src/lib/smt/academic.ts:buildAcademic"],
    knownGaps: ["Progress 8 is never published for independent schools.", "DfE has never published GCSE value added by subject."],
    citation: "DfE KS4 and KS5 performance tables (value added)",
  },
  {
    id: "M-SMT-SUBJECTS",
    name: "Subject areas and subjects",
    data: "smt.subjects",
    definition: "Each subject area's average points against the comparison set (Admissions' strengths and weaknesses, buildRivals), and each subject's average points with its rank in the set and in England (Teacher's subjectRanking), its entries, grade profile and entries mix.",
    grain: "School × subject (or subject area) × year",
    sources: ["academic_subject_family", "dfe_ks4_subject_entries", "dfe_ks5_subject_results"],
    years: { from: String(HISTORIC_GRADE_FROM), to: "2024", latest: "ks4" },
    keying: "urn",
    geographies: geo(true, true, false, true),
    numberTypes: ["totals", "points", "change_points", "rank"],
    rules: ["R-SMT-SET-RANKS", "R-SMT-SMALL-ENTRIES", "R-ADM-FLAG-STRENGTHS", "R-TREND-FROM-2223"],
    fetchedBy: ["src/lib/smt/academic.ts:buildAcademic", "src/app/api/smt/academic/route.ts"],
    knownGaps: ["The subject areas are the data's own families (8), not the spec's illustrative list.", "Entries before 2023/24 come from the historic sources; the mix draws every year the subject rollup holds entries for, from its first (R-ENTRIES-FIRST-YEAR: 2020/21 at GCSE, entries only)."],
    citation: "DfE KS4 and KS5 subject tables",
  },
  {
    id: "M-SMT-AREA",
    name: "The area around the school",
    data: "smt.area",
    definition: "Residents by single year of age 0-18 within 5 miles of the school (ONS LSOA estimates, school_context_lookup) and per LA (ons_population_age; a shire county is its districts), ONS 2022-based projections by single year of age (ons_snpp), the school's neighbourhood deprivation and the IDACI mix of the children within 5 miles (IoD2025), free school meals for the school, its LA and England (dfe_school_fsm, dfe_fsm_geography), births by LA (ONS), census pupils at schools within 5 miles, and the LSOA and LA boundaries for the map (src/lib/smt/context.ts, context-map.ts).",
    grain: "LSOA, the 5-mile area or the LA × year",
    sources: ["school_context_lookup", "lsoa_context_lookup", "ons_population_age", "ons_snpp", "dfe_school_fsm", "dfe_fsm_geography", "ons_births", "lsoa_boundaries", "la_boundaries", "la_gss_crosswalk", "age_profile_aggregates", "dfe_school_census"],
    years: { from: "2011", to: String(CURRENT_CENSUS_PERIOD), latest: "census", note: "Small-area residents from mid-2011 to the latest mid-year held; LA residents from mid-2012; births from 2012; FSM from 2019/20; projections 11 years past the latest LA estimate. Every latest year is read from the data." },
    keying: "geography",
    geographies: { school: { ok: false, reason: "An area measure" }, subject_area: { ok: false, reason: "Not a subject measure" }, set: { ok: false, reason: "An area measure" }, la: { ok: true, reason: "age_profile_aggregates, ons_births" }, region: { ok: true, reason: "the region's LAs on the map" }, england: { ok: true, reason: "births: the sum of every English LA" } },
    numberTypes: ["totals", "pct_change", "index100"],
    rules: ["R-SMT-CONTEXT-RESIDENTS", "R-SMT-CONTEXT-DEPRIVATION", "R-SMT-CONTEXT-FSM", "R-SMT-CONTEXT-WORDING", "R-SMT-CONTEXT-GEOGRAPHY", "R-SMT-YEARS"],
    fetchedBy: ["src/lib/smt/context.ts:buildContext", "src/lib/smt/context-map.ts:buildContextMap", "src/lib/smt/area-data.ts", "src/app/api/smt/context/route.ts", "src/app/api/smt/context/map/route.ts"],
    knownGaps: ["The map shades local authorities until the LSOA boundaries are loaded (K0).", "No district for a school: no anon lookup returns postcode_geography.lad_code, so the place line is town · LA · region.", "Projections are by local authority only.", "FSM is not published for independent schools; \u201cFSM ever 6\u201d isn't in this source."],
    citation: "ONS mid-year estimates (LSOA and LA); ONS subnational population projections; English Indices of Deprivation (MHCLG); DfE Schools, pupils and their characteristics; ONS births; DfE school census (January)",
  },
];

// ------------------------------------------------------------------------------ renderers

const r = (id: `RD-${string}`, component: string, file: string, accepts: string, empty: string): Renderer => ({
  id,
  component,
  file: `${C}/${file}`,
  accepts,
  states: { empty, loading: "The panel's skeleton until the route answers." },
  minHeight: "The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions').",
  fullscreen: "The panel's full screen (focus mode), the same view larger.",
  phone: "Full width; the large view's views become tabs (Phone.dc.html).",
});

export const SMT_RENDERERS: Renderer[] = [
  r("RD-SMT-NOW", "SchoolNow", "views/Now.tsx", "Tiles: roll and change, girls and boys (or day and boarding), headline results with national ranks, value added, Progress 8's reason, XS-XL by phase.", "No census: the tiles say so."),
  r("RD-SMT-SCORECARD", "Scorecard", "views/Scorecard.tsx", "A row per headline: you, the set, the region, England, since 2022/23; 'not ranked' rows for IGCSE; the flags line.", "No headline figures."),
  r("RD-SMT-MAP", "SetMap", "views/SetMap.tsx", "The school and its comparison set, located.", "No located schools."),
  r("RD-SMT-FLAGS", "SchoolFlags", "views/Flags.tsx", "The school's own flags, each with the figures behind it.", "No flags: says so."),
  r("RD-SMT-LINE", "SmtLine", "views/Lines.tsx", "Lines by year: indexed rolls, or results with the set's middle half as a band and 2021/22 shaded.", "Fewer than two years: 'Not enough years yet'."),
  r("RD-SMT-TABLE", "SmtTable", "views/Tables.tsx", "A row per year, or per subject, with the figures behind the chart.", "No rows."),
  r("RD-SMT-AREAS", "SubjectAreas", "views/Areas.tsx", "Admissions' strengths and weaknesses against the comparison set.", "No subject area with set schools to compare."),
  r("RD-SMT-SUBJECTS", "Subjects", "views/Subjects.tsx", "The area's subjects: entries, average, rank in the set and England, since 2022/23, the subject explorer link.", "No subjects in this area."),
  r("RD-SMT-VA", "ValueAdded", "views/ValueAdded.tsx", "A-level value added by qualification type and by subject with confidence intervals; Progress 8 or its reason.", "Not published: says which reason applies."),
  r("RD-SMT-GRADES", "GradeProfile", "views/Grades.tsx", "The grade profile in bands (9-7, 6-5, 4, 3-1; A*-A, B, C, D-U).", "No graded entries."),
  r("RD-SMT-MIX", "EntriesMix", "views/Mix.tsx", "Each area's (or subject's) share of the entries, year by year.", "No entries."),
  r("RD-SMT-RESERVED", "ReservedPanel", "views/Reserved.tsx", "A reserved panel: the slot exists, the data doesn't yet.", "Always its caption."),
  // 0.8 SMT round 2
  r("RD-SMT-SHAPE", "ShapeAndSize", "views/Pupils.tsx", "Pupils in each year group, the shape and since when, and the shapes around: the LA's schools of the same type, the set's shapes, Year 12 against Year 11 in the set. Described, never ranked.", "No census: says so."),
  r("RD-SMT-ENTRIES", "EntryPointsAtAGlance", "views/Pupils.tsx", "Each Admissions entry point: its cohort now and its next pool, read-only, with Open in Admissions.", "No entry points set: the reason, and Open in Admissions."),
  r("RD-SMT-LEAVING", "LeavingAt16", "views/Pupils.tsx", "Year 11 to Year 12 at the school, year by year: Year 12 against Year 11 and the net leavers.", "No sixth form, or no Year 11: says so."),
  r("RD-SMT-AREA-MAP", "AreaMap", "views/Context.tsx", "Neighbourhoods (LSOAs) within 5 miles and a ring, shaded by children per hectare, IMD or IDACI decile (one sequential scale, decile 1 darkest), or schools coloured by FSM; the 5-mile circle; the school in the accent. Before the boundaries are loaded, and for the LA, round 2's LA shading.", "No located schools: says so."),
  r("RD-SMT-AGES", "AgeBars", "views/Context.tsx", "Residents by single year of age 0-18, within 5 miles or in the LA, the level's ages highlighted.", "No ages held: says so."),
  // 0.8 SMT round 3
  r("RD-SMT-NEARBY", "NearbyOverTime", "views/Context.tsx", "Children of the level's ages within 5 miles over time, indexed, against the LA and England (residents, not pupils).", "No small-area figures: says so."),
];

// ------------------------------------------------------------------------------ dataviews

const ORIGIN = "0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md)";
type Def = {
  id: DataviewId;
  label: string;
  railIcon: string;
  data: SmtDataId;
  host: SmtHostId;
  panel: "current" | "trend";
  file: string;
  viewType: ViewType;
  dateMode: "single" | "trend";
  numberType: NumberType[];
  compare: CompareKind[];
  measures: MeasureId[];
  renderer: `RD-${string}`;
  title: string;
  rules: RuleId[];
  audience: AudienceTag[];
  status?: "live" | "draft";
  note?: string;
};
const dv = (d: Def): Dataview => ({
  id: d.id,
  label: d.label,
  railIcon: d.railIcon,
  measures: d.measures,
  supports: { data: [d.data], phases: [], focus: ["level"], compare: d.compare, numberType: d.numberType, dateMode: d.dateMode, viewType: d.viewType },
  params: ["level", "set", "filters"],
  titleTemplate: d.title,
  renderer: d.renderer as Dataview["renderer"],
  host: { id: d.host, panel: d.panel, rail: d.label, file: `${C}/${d.file}` },
  audience: d.audience,
  status: d.status ?? "live",
  verifiedAt: [],
  origin: ORIGIN,
  rules: d.rules,
  ...(d.note ? { note: d.note } : {}),
});

const O = "smt.overview" as const;
const A = "smt.academic" as const;
const P2 = "smt.pupils" as const;
const C2 = "smt.context" as const;
const SET: CompareKind[] = ["schools"];
const SET_AREA: CompareKind[] = ["schools", "averages"];
const WS: AudienceTag[] = ["whole-school", "academic"];
const ROLLS: AudienceTag[] = ["whole-school", "rolls"];
const BASE = periodLabel(TREND_BASE_PERIOD);

export const SMT_DATAVIEWS: Dataview[] = [
  // ------------------------------------------------------ Overview: row 1
  dv({ id: "DV-SMT-O-NOW", label: "The school now", railIcon: "TilesIcon", data: "smt.school", host: O, panel: "current", file: "views/Now.tsx", viewType: "numerical", dateMode: "single", numberType: ["totals", "pct_change", "rank"], compare: SET_AREA, measures: ["M-SMT-SCHOOL", "M-SMT-RESULTS", "M-SMT-VA"], renderer: "RD-SMT-NOW", title: "The school now", rules: ["R-SMT-VIEW-NOW", "R-SMT-P8-REASON", "R-SMT-BOARDING-ONLY"], audience: ROLLS }),
  dv({ id: "DV-SMT-O-SCORECARD", label: "Scorecard", railIcon: "TableIcon", data: "smt.results", host: O, panel: "current", file: "views/Scorecard.tsx", viewType: "table", dateMode: "single", numberType: ["points", "rank", "change_points"], compare: SET_AREA, measures: ["M-SMT-RESULTS", "M-SMT-SCHOOL", "M-SMT-VA"], renderer: "RD-SMT-SCORECARD", title: "How [school] compares, headline by headline", rules: ["R-SMT-VIEW-SCORECARD", "R-SMT-SET-RANKS", "R-SMT-IGCSE-WORDING", "R-TREND-FROM-2223"], audience: WS }),
  dv({ id: "DV-SMT-O-MAP", label: "Map", railIcon: "MapPinIcon", data: "smt.school", host: O, panel: "current", file: "views/SetMap.tsx", viewType: "map", dateMode: "single", numberType: ["totals"], compare: SET, measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-MAP", title: "[school] and [set]", rules: ["R-SMT-VIEW-MAP"], audience: WS }),
  dv({ id: "DV-SMT-O-FLAGS", label: "Flags", railIcon: "FlagIcon", data: "smt.school", host: O, panel: "current", file: "views/Flags.tsx", viewType: "table", dateMode: "trend", numberType: ["pct_change", "change_points"], compare: SET, measures: ["M-SMT-SCHOOL", "M-SMT-RESULTS"], renderer: "RD-SMT-FLAGS", title: "Flags: large and lasting changes at [school]", rules: ["R-SMT-FLAGS"], audience: WS }),
  // ------------------------------------------------------ Overview: row 2
  dv({ id: "DV-SMT-O-ROLL-LINE", label: "Roll, indexed", railIcon: "IndexedLineIcon", data: "smt.school", host: O, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: ["averages"], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-LINE", title: "Roll, indexed (the first year every line shares = 100)", rules: ["R-SMT-VIEW-TRENDS"], audience: ROLLS }),
  dv({ id: "DV-SMT-O-ROLL-TABLE", label: "Roll, table", railIcon: "TableIcon", data: "smt.school", host: O, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["totals", "index100"], compare: ["averages"], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-TABLE", title: "Roll, year by year", rules: ["R-SMT-VIEW-TRENDS"], audience: ROLLS }),
  dv({ id: "DV-SMT-O-RESULTS-LINE", label: "Results trend", railIcon: "TrendLineIcon", data: "smt.results", host: O, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["points"], compare: SET, measures: ["M-SMT-RESULTS"], renderer: "RD-SMT-LINE", title: "Headline results against [set]", rules: ["R-SMT-VIEW-TRENDS", "R-TREND-FROM-2223", "R-IGCSE-EXCL"], audience: WS }),
  dv({ id: "DV-SMT-O-RESULTS-TABLE", label: "Results, table", railIcon: "TableIcon", data: "smt.results", host: O, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["points"], compare: SET, measures: ["M-SMT-RESULTS"], renderer: "RD-SMT-TABLE", title: "Headline results against [set], year by year", rules: ["R-SMT-VIEW-TRENDS", "R-TREND-FROM-2223"], audience: WS }),
  dv({ id: "DV-SMT-O-MARKET-LINE", label: "Market share", railIcon: "TrendLineIcon", data: "smt.school", host: O, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["market_share"], compare: SET, measures: ["M-SMT-SCHOOL", "M-ADM-MARKET"], renderer: "RD-SMT-LINE", title: "Market share at 11+, against your rivals", rules: ["R-SMT-VIEW-TRENDS", "R-ADM-GROUP-SHARE"], audience: ["market", "whole-school"], note: "Admissions' figures, read-only: an empty state with the reason where the school has no Admissions rivals at 11+." }),
  dv({ id: "DV-SMT-O-MARKET-TABLE", label: "Market share, table", railIcon: "TableIcon", data: "smt.school", host: O, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["market_share"], compare: SET, measures: ["M-SMT-SCHOOL", "M-ADM-MARKET"], renderer: "RD-SMT-TABLE", title: "Market share at 11+, year by year", rules: ["R-SMT-VIEW-TRENDS", "R-ADM-GROUP-SHARE"], audience: ["market", "whole-school"] }),

  // ------------------------------------------------------ Academic: row 1
  dv({ id: "DV-SMT-A-NOW", label: "The level now", railIcon: "TilesIcon", data: "smt.results", host: A, panel: "current", file: "views/AcademicNow.tsx", viewType: "numerical", dateMode: "single", numberType: ["totals", "points", "rank"], compare: SET, measures: ["M-SMT-RESULTS", "M-SMT-VA", "M-SMT-SUBJECTS"], renderer: "RD-SMT-NOW", title: "[level] now", rules: ["R-SMT-VIEW-ACADEMIC-NOW", "R-SMT-P8-REASON", "R-SMT-VA-HONEST"], audience: WS }),
  dv({ id: "DV-SMT-A-AREAS", label: "Subject areas", railIcon: "AdmStrengthsIcon", data: "smt.subjects", host: A, panel: "current", file: "views/Areas.tsx", viewType: "graph", dateMode: "single", numberType: ["points", "change_points", "rank"], compare: SET, measures: ["M-SMT-SUBJECTS"], renderer: "RD-SMT-AREAS", title: "Where [school] leads and trails [set], by subject area", rules: ["R-SMT-VIEW-AREAS", "R-ADM-FLAG-STRENGTHS", "R-SMT-SET-RANKS"], audience: WS }),
  dv({ id: "DV-SMT-A-SUBJECTS", label: "Subjects", railIcon: "TableIcon", data: "smt.subjects", host: A, panel: "current", file: "views/Subjects.tsx", viewType: "table", dateMode: "single", numberType: ["totals", "points", "rank", "change_points"], compare: SET, measures: ["M-SMT-SUBJECTS"], renderer: "RD-SMT-SUBJECTS", title: "Each subject, its rank, and where it's heading", rules: ["R-SMT-VIEW-SUBJECTS", "R-SMT-SMALL-ENTRIES", "R-TREND-FROM-2223"], audience: WS }),
  dv({ id: "DV-SMT-A-VA", label: "Value added", railIcon: "AdmNumbersIcon", data: "smt.value_added", host: A, panel: "current", file: "views/ValueAdded.tsx", viewType: "table", dateMode: "single", numberType: ["points"], compare: [], measures: ["M-SMT-VA"], renderer: "RD-SMT-VA", title: "Value added", rules: ["R-SMT-VA-HONEST", "R-SMT-P8-REASON"], audience: WS }),
  dv({ id: "DV-SMT-A-GRADES", label: "Grade profile", railIcon: "HorizontalBarsIcon", data: "smt.subjects", host: A, panel: "current", file: "views/Grades.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: [], measures: ["M-SMT-SUBJECTS"], renderer: "RD-SMT-GRADES", title: "Grade profile", rules: ["R-SMT-VIEW-GRADES"], audience: WS }),
  // ------------------------------------------------------ Academic: row 2
  dv({ id: "DV-SMT-A-TREND-LINE", label: "Results trend", railIcon: "TrendLineIcon", data: "smt.results", host: A, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["points"], compare: SET, measures: ["M-SMT-RESULTS", "M-SMT-SUBJECTS"], renderer: "RD-SMT-LINE", title: "[level] results against [set]", rules: ["R-SMT-VIEW-TRENDS", "R-TREND-FROM-2223"], audience: WS }),
  dv({ id: "DV-SMT-A-TREND-TABLE", label: "Results, table", railIcon: "TableIcon", data: "smt.results", host: A, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["points"], compare: SET, measures: ["M-SMT-RESULTS", "M-SMT-SUBJECTS"], renderer: "RD-SMT-TABLE", title: "[level] results against [set], year by year", rules: ["R-SMT-VIEW-TRENDS", "R-TREND-FROM-2223"], audience: WS }),
  dv({ id: "DV-SMT-A-BANDS", label: "Results by band", railIcon: "TrendLineIcon", data: "smt.results", host: A, panel: "trend", file: "views/Reserved.tsx", viewType: "graph", dateMode: "trend", numberType: ["points"], compare: [], measures: ["M-SMT-RESULTS"], renderer: "RD-SMT-RESERVED", title: "Top 25%, middle 50%, bottom 25%", rules: ["R-SMT-VIEW-RESERVED"], audience: WS, status: "draft", note: "Reserved: arrives with the results-by-band round (roadmap step 4). The slot exists; the data doesn't yet." }),
  dv({ id: "DV-SMT-A-MIX", label: "Entries mix", railIcon: "VerticalBarsIcon", data: "smt.subjects", host: A, panel: "trend", file: "views/Mix.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-SMT-SUBJECTS"], renderer: "RD-SMT-MIX", title: "Entries mix, year by year", rules: ["R-SMT-VIEW-MIX"], audience: WS }),
  dv({ id: "DV-SMT-A-MIX-TABLE", label: "Entries mix, table", railIcon: "TableIcon", data: "smt.subjects", host: A, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-SMT-SUBJECTS"], renderer: "RD-SMT-TABLE", title: "Entries mix, year by year", rules: ["R-SMT-VIEW-MIX"], audience: WS }),

  // ------------------------------------------------------ 0.8 SMT round 2: Pupils
  dv({ id: "DV-SMT-P-NOW", label: "Your pupils now", railIcon: "TilesIcon", data: "smt.school", host: P2, panel: "current", file: "views/Pupils.tsx", viewType: "numerical", dateMode: "single", numberType: ["totals", "pct_change"], compare: ["averages"], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-NOW", title: "Your pupils now", rules: ["R-SMT-VIEW-PUPILS-NOW", "R-SMT-BOARDING-ONLY", "R-SMT-PUPILS-LEVEL", "R-SMT-Y12-AGAINST-Y11"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-SHAPE", label: "Shape and size", railIcon: "AdmShapeIcon", data: "smt.school", host: P2, panel: "current", file: "views/Pupils.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: SET, measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-SHAPE", title: "Pupils in each year group", rules: ["R-SMT-VIEW-SHAPE", "R-ADM-SHAPE-NOT-RANKED", "R-SMT-PUPILS-LEVEL", "R-SMT-Y12-AGAINST-Y11"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-ENTRIES", label: "Entry points", railIcon: "AdmFunnelIcon", data: "smt.school", host: P2, panel: "current", file: "views/Pupils.tsx", viewType: "table", dateMode: "single", numberType: ["totals"], compare: [], measures: ["M-SMT-SCHOOL", "M-ADM-POOL"], renderer: "RD-SMT-ENTRIES", title: "Entry points at a glance", rules: ["R-SMT-ADMISSIONS-READ-ONLY", "R-ADM-POOL-NOT-INTAKE"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-LEAVING", label: "Leaving at 16", railIcon: "ChangeArrowIcon", data: "smt.school", host: P2, panel: "current", file: "views/Pupils.tsx", viewType: "table", dateMode: "trend", numberType: ["totals", "pct_change"], compare: [], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-LEAVING", title: "Leaving at 16", rules: ["R-SMT-VIEW-LEAVING", "R-ADM-JOINERS-ESTIMATE", "R-SMT-Y12-AGAINST-Y11"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-MARKET", label: "Market share", railIcon: "DonutIcon", data: "smt.school", host: P2, panel: "current", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["market_share"], compare: SET, measures: ["M-SMT-SCHOOL", "M-ADM-MARKET"], renderer: "RD-SMT-LINE", title: "Market share at 11+, against your rivals", rules: ["R-SMT-ADMISSIONS-READ-ONLY", "R-ADM-GROUP-SHARE"], audience: ["market", "whole-school"] }),
  dv({ id: "DV-SMT-P-PHASES", label: "Roll by phase", railIcon: "IndexedLineIcon", data: "smt.school", host: P2, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: ["averages"], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-LINE", title: "Roll by phase, indexed (the first year every line shares = 100)", rules: ["R-SMT-VIEW-TRENDS"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-PHASES-TABLE", label: "Roll by phase, table", railIcon: "TableIcon", data: "smt.school", host: P2, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["index100"], compare: ["averages"], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-TABLE", title: "Roll by phase, year by year", rules: ["R-SMT-VIEW-TRENDS"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-POOL", label: "The pool", railIcon: "AdmPipelineIcon", data: "smt.school", host: P2, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-SMT-SCHOOL", "M-ADM-POOL"], renderer: "RD-SMT-LINE", title: "The pool for your main entry point", rules: ["R-SMT-ADMISSIONS-READ-ONLY", "R-ADM-POOL-NOT-INTAKE", "R-ADM-LADDER"], audience: ROLLS }),
  dv({ id: "DV-SMT-P-AREA", label: "School-age population", railIcon: "AdmPopulationIcon", data: "smt.school", host: P2, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: ["averages"], measures: ["M-SMT-SCHOOL"], renderer: "RD-SMT-LINE", title: "The area's school-age population", rules: ["R-SMT-VIEW-TRENDS"], audience: ROLLS }),
  // ------------------------------------------------------ 0.8 SMT round 2: Context
  dv({ id: "DV-SMT-C-NOW", label: "The area now", railIcon: "TilesIcon", data: "smt.area", host: C2, panel: "current", file: "views/Context.tsx", viewType: "numerical", dateMode: "single", numberType: ["totals", "pct_change"], compare: ["averages"], measures: ["M-SMT-AREA"], renderer: "RD-SMT-NOW", title: "The area now", rules: ["R-SMT-VIEW-CONTEXT-NOW", "R-SMT-CONTEXT-PLACE", "R-SMT-CONTEXT-RESIDENTS", "R-SMT-CONTEXT-DEPRIVATION", "R-SMT-CONTEXT-FSM", "R-SMT-CONTEXT-WORDING"], audience: ["geography", "whole-school"] }),
  dv({ id: "DV-SMT-C-MAP", label: "Map", railIcon: "MapPinIcon", data: "smt.area", host: C2, panel: "current", file: "views/Context.tsx", viewType: "map", dateMode: "single", numberType: ["totals"], compare: ["averages"], measures: ["M-SMT-AREA"], renderer: "RD-SMT-AREA-MAP", title: "Where the school-age children live", rules: ["R-SMT-CONTEXT-GEOGRAPHY", "R-SMT-CONTEXT-WORDING"], audience: ["geography", "whole-school"] }),
  dv({ id: "DV-SMT-C-BYAGE", label: "Population by age", railIcon: "VerticalBarsIcon", data: "smt.area", host: C2, panel: "current", file: "views/Context.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: [], measures: ["M-SMT-AREA"], renderer: "RD-SMT-AGES", title: "Children by single year of age", rules: ["R-SMT-CONTEXT-GEOGRAPHY"], audience: ["geography"] }),
  dv({ id: "DV-SMT-C-BIRTHS", label: "Births and projections", railIcon: "TrendLineIcon", data: "smt.area", host: C2, panel: "current", file: "views/Context.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: ["averages"], measures: ["M-SMT-AREA"], renderer: "RD-SMT-LINE", title: "Births and projections", rules: ["R-SMT-VIEW-BIRTHS"], audience: ["geography"] }),
  // 0.8 SMT round 3: new in the large view's rail.
  dv({ id: "DV-SMT-C-NEARBY", label: "Children nearby over time", railIcon: "IndexedLineIcon", data: "smt.area", host: C2, panel: "current", file: "views/Context.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: ["averages"], measures: ["M-SMT-AREA"], renderer: "RD-SMT-NEARBY", title: "Children nearby over time", rules: ["R-SMT-CONTEXT-RESIDENTS", "R-SMT-CONTEXT-WORDING"], audience: ["geography"] }),
  dv({ id: "DV-SMT-C-BIRTHS-INDEXED", label: "Births, indexed", railIcon: "IndexedLineIcon", data: "smt.area", host: C2, panel: "trend", file: "views/Context.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: ["averages"], measures: ["M-SMT-AREA"], renderer: "RD-SMT-LINE", title: "Births, indexed", rules: ["R-SMT-VIEW-BIRTHS"], audience: ["geography"] }),
  dv({ id: "DV-SMT-C-BIRTHS-TABLE", label: "Births, table", railIcon: "TableIcon", data: "smt.area", host: C2, panel: "trend", file: "views/Context.tsx", viewType: "table", dateMode: "trend", numberType: ["totals", "index100"], compare: ["averages"], measures: ["M-SMT-AREA"], renderer: "RD-SMT-TABLE", title: "Births, year by year", rules: ["R-SMT-VIEW-BIRTHS"], audience: ["geography"] }),
  dv({ id: "DV-SMT-C-PROJECTION", label: "Projection", railIcon: "TrendLineIcon", data: "smt.area", host: C2, panel: "trend", file: "views/Context.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-SMT-AREA"], renderer: "RD-SMT-LINE", title: "School-age population, projected", rules: ["R-SMT-VIEW-BIRTHS", "R-SMT-FORWARD", "R-SMT-NOT-A-FORECAST"], audience: ["geography"] }),
  dv({ id: "DV-SMT-C-AGES", label: "By single year of age", railIcon: "VerticalBarsIcon", data: "smt.area", host: C2, panel: "trend", file: "views/Context.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: [], measures: ["M-SMT-AREA"], renderer: "RD-SMT-AGES", title: "Population by single year of age", rules: ["R-SMT-CONTEXT-GEOGRAPHY"], audience: ["geography"] }),
];

// ------------------------------------------------------------------------------- presets

const LATEST: ViewYears = { latest: true };
const SINCE_2019: ViewYears = { from: "first", rollOn: true };
const TRENDS: ViewYears = { from: "first", rollOn: true };
type Body = Pick<ViewSpec, "data" | "view">;
const b = (source: SmtDataId, per: ViewSpec["data"]["per"], shownAs: ViewSpec["data"]["shownAs"], years: ViewYears, view: ViewView): Body => ({
  data: { source, subject: "follows", per, shownAs, years },
  view,
});

export const SMT_BODIES: Record<string, Body> = {
  "DV-SMT-O-NOW": b("smt.school", "school", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-SMT-O-SCORECARD": b("smt.results", "school", "actual", LATEST, { kind: "table", look: { yearColumns: "latest", extra: ["rank", "change"] } }),
  "DV-SMT-O-MAP": b("smt.school", "school", "actual", LATEST, { kind: "map", look: { colour: "value" } }),
  "DV-SMT-O-FLAGS": b("smt.school", "school", "change", LATEST, { kind: "flags", look: { show: "flagged" } }),
  "DV-SMT-O-ROLL-LINE": b("smt.school", "year", "indexed", SINCE_2019, { kind: "line", look: {} }),
  "DV-SMT-O-ROLL-TABLE": b("smt.school", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-O-RESULTS-LINE": b("smt.results", "year", "actual", TRENDS, { kind: "line", look: {} }),
  "DV-SMT-O-RESULTS-TABLE": b("smt.results", "year", "actual", TRENDS, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-O-MARKET-LINE": b("smt.school", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-SMT-O-MARKET-TABLE": b("smt.school", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-A-NOW": b("smt.results", "school", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-SMT-A-AREAS": b("smt.subjects", "subject", "actual", LATEST, { kind: "strengths", look: { order: "gap", showFlags: true } }),
  "DV-SMT-A-SUBJECTS": b("smt.subjects", "subject", "actual", LATEST, { kind: "table", look: { yearColumns: "latest", extra: ["rank", "change"], sort: "listed" } }),
  "DV-SMT-A-VA": b("smt.value_added", "subject", "actual", LATEST, { kind: "table", look: { yearColumns: "latest" } }),
  "DV-SMT-A-GRADES": b("smt.subjects", "grade", "actual", LATEST, { kind: "bar", look: { orientation: "horizontal", values: true } }),
  "DV-SMT-A-TREND-LINE": b("smt.results", "year", "actual", TRENDS, { kind: "line", look: {} }),
  "DV-SMT-A-TREND-TABLE": b("smt.results", "year", "actual", TRENDS, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-A-BANDS": b("smt.results", "year", "actual", TRENDS, { kind: "line", look: {} }),
  "DV-SMT-A-MIX": b("smt.subjects", "year", "actual", TRENDS, { kind: "bar", look: { orientation: "vertical" } }),
  "DV-SMT-A-MIX-TABLE": b("smt.subjects", "year", "actual", TRENDS, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  // 0.8 SMT round 2
  "DV-SMT-P-NOW": b("smt.school", "school", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-SMT-P-SHAPE": b("smt.school", "school", "actual", LATEST, { kind: "shapes", look: { columns: 1 } }),
  "DV-SMT-P-ENTRIES": b("smt.school", "school", "actual", LATEST, { kind: "table", look: { yearColumns: "latest" } }),
  "DV-SMT-P-LEAVING": b("smt.school", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-P-MARKET": b("smt.school", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-SMT-P-PHASES": b("smt.school", "year", "indexed", SINCE_2019, { kind: "line", look: {} }),
  "DV-SMT-P-PHASES-TABLE": b("smt.school", "year", "indexed", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-P-POOL": b("smt.school", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-SMT-P-AREA": b("smt.school", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-SMT-C-NOW": b("smt.area", "school", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-SMT-C-MAP": b("smt.area", "school", "actual", LATEST, { kind: "map", look: { colour: "value" } }),
  "DV-SMT-C-BYAGE": b("smt.area", "year", "actual", LATEST, { kind: "bar", look: { orientation: "vertical" } }),
  "DV-SMT-C-BIRTHS": b("smt.area", "year", "actual", TRENDS, { kind: "line", look: {} }),
  "DV-SMT-C-BIRTHS-INDEXED": b("smt.area", "year", "indexed", TRENDS, { kind: "line", look: {} }),
  "DV-SMT-C-BIRTHS-TABLE": b("smt.area", "year", "actual", TRENDS, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-SMT-C-PROJECTION": b("smt.area", "year", "actual", TRENDS, { kind: "line", look: {} }),
  "DV-SMT-C-AGES": b("smt.area", "year", "actual", LATEST, { kind: "bar", look: { orientation: "vertical" } }),
  "DV-SMT-C-NEARBY": b("smt.area", "year", "indexed", TRENDS, { kind: "line", look: {} }),
};

export const SMT_FAMILIES: { id: SmtDataId; label: string }[] = [
  { id: "smt.school", label: "The school" },
  { id: "smt.results", label: "Results and ranks" },
  { id: "smt.value_added", label: "Value added" },
  { id: "smt.subjects", label: "Subject areas and subjects" },
  { id: "smt.area", label: "The area" },
];
export const isSmtData = (d: string | undefined | null): d is SmtDataId => !!d && d.startsWith("smt.");
export const isSmtHost = (h: string | undefined | null): h is SmtHostId => !!h && h.startsWith("smt.");

// Words used in titles, so the titles module can fill them.
export const SMT_TITLE_WORDS = { base: BASE } as const;
