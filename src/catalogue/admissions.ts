// VicData 0.7 admissions r2 (D2, D7): the Admissions entries in the four-layer catalogue --
// measures, renderers, dataviews and their ViewSpec presets -- for the two published dashboards
// (vicdata.admissions.pipelines and vicdata.admissions.market-share, dashboards/admissions.ts).
//
// Appended AFTER Teacher's entries in every list (dataviews.ts, measures.ts, renderers.ts,
// viewspec.ts), so Teacher's own order, ids and presets are untouched. No Admissions dataview
// carries a Teacher phase or a Teacher family, so no Teacher context (matching.ts, the meetings'
// Add a view, the editor's presets per host) ever offers one.
//
// The entry point plays the part the subject plays for Teacher: every view follows the
// entry-point chips (focus "entry_point", ViewSubject "follows").
//
// What can't be edited (catalogue rules, never look options): the certainty styling and the
// honesty wording (ADMISSIONS_NOTES, R-ADM-LADDER, R-ADM-POOL-NOT-INTAKE), the flag thresholds
// (R-ADM-FLAG-*, thresholds.ts), and "shapes described, not ranked" (R-ADM-SHAPE-NOT-RANKED).
import type { AdmissionsDataId, AdmissionsHostId, AudienceTag, CompareKind, Dataview, DataviewId, EntryPointState, Measure, MeasureId, NumberType, Renderer, RuleId, ViewType } from "./types";
import type { ViewSpec, ViewView, ViewYears } from "./viewspec";
import { CENSUS_FIRST_PERIOD, periodLabel, TREND_BASE_PERIOD } from "./years";

const A = "src/components/admissions";

// ------------------------------------------------------------------------------- measures

const geo = (school: string | null, set: string | null, la: string | null, region: string | null, england: string | null) => ({
  school: school ? { ok: true } : { ok: false, reason: "Not held" },
  subject_area: { ok: false, reason: "Not a subject measure" },
  set: set ? { ok: true } : { ok: false, reason: "Not held" },
  la: la ? { ok: true, reason: la } : { ok: false, reason: "Not held" },
  region: region ? { ok: true, reason: region } : { ok: false, reason: "Not held" },
  england: england ? { ok: true, reason: england } : { ok: false, reason: "Not held" },
});

export const ADMISSIONS_MEASURES: Measure[] = [
  {
    id: "M-ADM-PUPILS",
    name: "Pupils by age",
    data: "admissions.pupils",
    definition: "Pupils at one age (the entry age, or a rung age) in the January census: full-time from age 4, plus part-time at 2-3 (src/lib/admissions/cohort.ts).",
    grain: "School × single age × sex × census year",
    sources: ["dfe_school_census"],
    years: { from: "2019", to: "2025", note: "January census, ages at 31 August." },
    keying: "urn",
    geographies: geo("cohort.ts", "pipeline.ts / market.ts", "age_profile_aggregates (ages 5-15; years as synced)", "age_profile_aggregates", "the sum of the nine regions"),
    numberTypes: ["totals", "pct_change", "index100", "rank"],
    rules: ["R-ADM-FAMILY-PUPILS", "R-ADM-JOINERS-ESTIMATE"],
    fetchedBy: ["src/lib/admissions/data.ts:cachedCensus", "src/app/api/admissions/pipeline/route.ts", "src/app/api/admissions/market-share/route.ts"],
    knownGaps: ["No boarders by age (whole school only).", "LA and England by single age only for the years age_profile_aggregates holds."],
    citation: "DfE school census (January), pupils by age",
  },
  {
    id: "M-ADM-POOL",
    name: "Pipeline (the pool)",
    data: "admissions.pipeline",
    definition: "The children who will reach the entry point each September: counted in the rung schools now, then from births in the LA blend, ranges from observed drift (src/lib/admissions/ladder.ts). A pool, never an intake.",
    grain: "School's sets × entry year",
    sources: ["dfe_school_census", "ons_births", "ons_population_projections"],
    years: { from: "2020", to: "2036", note: "Past pools 2020-2026; forward 10 years (Reception to the last birth year)." },
    keying: "urn",
    geographies: geo(null, "the rung sets", "births by LA", null, null),
    numberTypes: ["totals", "pct_change", "index100", "market_share"],
    rules: ["R-ADM-FAMILY-PIPELINE", "R-ADM-LADDER", "R-ADM-BIRTH-SPLIT", "R-ADM-DRIFT-RANGE", "R-ADM-POOL-NOT-INTAKE", "R-ADM-HOLD-SHARE"],
    fetchedBy: ["src/lib/admissions/pipeline.ts:buildPipeline", "src/app/api/admissions/pipeline/route.ts"],
    knownGaps: ["No catchment births (LA only).", "No Reception projections beyond the last birth year.", "Feeder relationships are not in the data: lists are the lead's, defaults are nearby schools."],
    citation: "DfE school census (January); ONS births by LA; ONS projections (age 10)",
  },
  {
    id: "M-ADM-MARKET",
    name: "Market share",
    data: "admissions.market",
    definition: "The school's pupils at the entry age (and its age band) as a share of the same ages across the rivals plus the school, each census year (src/lib/admissions/shares.ts). A share of this group, not the local market.",
    grain: "Rival set × census year",
    sources: ["dfe_school_census"],
    years: { from: "2019", to: "2025" },
    keying: "urn",
    geographies: geo("market.ts", "the rivals", null, null, null),
    numberTypes: ["totals", "market_share", "pct_change", "change_pp", "index100", "rank"],
    rules: ["R-ADM-FAMILY-MARKET", "R-ADM-GROUP-SHARE"],
    fetchedBy: ["src/lib/admissions/market.ts:buildMarketShare", "src/app/api/admissions/market-share/route.ts"],
    knownGaps: ["FE colleges have no census: their own figures come from ILR participation, labelled, never shared into the group."],
    citation: "DfE school census (January), pupils by age",
  },
  {
    // 0.8 Admissions feedback round 1 (F-13): the area around the school -- its catchment radius, SMT's.
    id: "M-ADM-CATCHMENT",
    name: "Children in the catchment",
    data: "admissions.pipeline",
    definition: "ONS small-area population (LSOAs whose population-weighted centre is within the school's catchment radius: the ingest's area_context) by single age 0-18, per mid-year: births (age 0), and the age a year below entry (src/lib/admissions/intake.ts). The radius is SMT's (src/lib/smt/catchment.ts).",
    grain: "School's catchment × single age × mid-year",
    sources: ["ons_lsoa_population", "ons_population_age"],
    years: { from: "2011", to: "2024", note: "LSOA mid-year estimates; the region and England from ONS's LA estimates (2012 on)." },
    keying: "urn",
    geographies: geo("the catchment radius", null, null, "the LAs in the school's region, summed", "England's LAs, summed"),
    numberTypes: ["totals", "index100"],
    rules: ["R-ADM-VIEW-INTAKE-CHANGE", "R-ADM-VIEW-LOCAL-BIRTHS", "R-ADM-CATCHMENT-RULE"],
    fetchedBy: ["src/lib/admissions/intake.ts:intakeChange, localBirths", "src/lib/smt/area-data.ts:areaContext", "src/app/api/admissions/pipeline/route.ts"],
    knownGaps: ["LSOA single ages from mid-2011 only: older cohorts' births are counted at the youngest age held.", "Not split by sex.", "A boarding school draws from beyond any radius."],
    citation: "ONS small-area population estimates (LSOA), single year of age",
  },
  {
    id: "M-ADM-RIVAL-RESULTS",
    name: "Rivals' results",
    data: "admissions.rivals",
    definition: "Each rival's (and the school's) whole-school headline and subject-area figures, with regional and national ranks on 0.6.6's ranking (src/lib/admissions/rivals.ts, ranks.ts). 4+ → KS2, 11+ → GCSE, 16+ → Post-16.",
    grain: "School × results year",
    sources: ["dfe_ks2_attainment", "academic_headline", "academic_subject_family"],
    years: { from: String(TREND_BASE_PERIOD), to: "2024", note: `The latest results year and the two before (changes since ${periodLabel(TREND_BASE_PERIOD)}).` },
    keying: "urn",
    geographies: geo("ranks.ts", "the rivals", null, "school_region_nation", "every school with a figure"),
    numberTypes: ["points", "change_points", "rank"],
    rules: ["R-ADM-FAMILY-RIVALS", "R-ADM-RIVAL-RANKS", "R-ADM-FLAG-MOMENTUM", "R-ADM-FLAG-STRENGTHS", "R-IGCSE-EXCL"],
    fetchedBy: ["src/lib/admissions/rivals.ts:buildRivals", "src/app/api/admissions/rivals/route.ts"],
    knownGaps: ["KS2 is thin for independent preps (most don't sit SATs): 'no published results'.", "IGCSE-heavy schools are listed but not ranked at 11+."],
    citation: "DfE KS2, KS4 and KS5 performance tables",
  },
];

// ------------------------------------------------------------------------------ renderers

const r = (id: `RD-${string}`, component: string, file: string, accepts: string, empty: string): Renderer => ({
  id,
  component,
  file: `${A}/${file}`,
  accepts,
  states: { empty, loading: "The panel's skeleton until the route answers." },
  minHeight: "The Admissions panel's body (row 1: 470px boards; row 2: 330px).",
  fullscreen: "The panel's fullscreen modal, the same view larger.",
  phone: "Full width; the large view's views become tabs (Phone.dc.html).",
});

export const ADMISSIONS_RENDERERS: Renderer[] = [
  r("RD-ADM-TILES", "EntryNowTiles", "panels/EntryNow.tsx", "The entry point now: four tiles, size by phase (XS-XL), the shape line and mini profile.", "No census for this school: the tiles say so (an FE college shows its ILR series instead)."),
  r("RD-ADM-PIPELINE", "PipelineChart", "views/PipelineChart.tsx", "Past pools then the ladder by entry year, styled by certainty (counted solid, births dashed with a range band, projection only on request).", "No feeder set or no census in it: 'No pool to draw'."),
  r("RD-ADM-FUNNEL", "Funnel", "views/Funnel.tsx", "Why did our intake change? A waterfall: your entry cohort in 2019/20, then births (cohort size), families moving and your share, then the latest year's cohort, all in the catchment radius.", "No funnel at 4+; a missing figure at either end says which."),
  r("RD-ADM-BIRTHS", "LocalBirths", "views/Funnel.tsx", "Births in the catchment by mid-year, indexed against the region and England, with the entry year each reaches as a second axis label.", "No small-area figures: says so."),
  r("RD-ADM-MAP", "AdmissionsMap", "views/AdmissionsMap.tsx", "Schools sized by pupils at the age, coloured by trend (feeders) or by share (rivals); the school ringed.", "No located schools."),
  r("RD-ADM-TABLE", "AdmissionsTable", "views/Tables.tsx", "A row per school (or year) with the figures, flags, distance, sector, gender and XS-XL.", "No schools in the set."),
  r("RD-ADM-SHAPES", "ShapeAndSize", "views/ShapeAndSize.tsx", "The school's profile by gender, the local shape, and rivals' shapes as small multiples: described, not ranked.", "No census for a school: its card says so."),
  r("RD-ADM-LINE", "AdmLine", "views/Lines.tsx", "A series per line over census or entry years (actual or indexed).", "Fewer than two years: 'Not enough years yet'."),
  r("RD-ADM-BARS", "AdmBars", "views/Bars.tsx", "Bars per year or per school; ranked bars with share, trend and results ranks.", "No figures."),
  r("RD-ADM-DONUT", "ShareDonut", "views/Bars.tsx", "The school's share of this group at the entry age.", "No group total."),
  r("RD-ADM-SCATTER", "MomentumScatter", "views/Momentum.tsx", `Pupil change (entry age, over 3 census years) against results change since ${periodLabel(TREND_BASE_PERIOD)}, four quadrants, with the flag list.`, "Thresholds not loaded: 'flags not available yet'; a school without both changes is left off the scatter and said so."),
  r("RD-ADM-STRENGTHS", "StrengthsBars", "views/Strengths.tsx", `Per subject area: rank among the rivals with it, the gap to their average (diverging), its direction since ${periodLabel(TREND_BASE_PERIOD)}, and flags.`, "KS2 has no subject areas; no ranked areas: says so."),
  r("RD-ADM-FLAGS", "FlagList", "views/Momentum.tsx", "Each rival's momentum flags, each with the figures behind it on hover.", "Thresholds not loaded: 'flags not available yet'."),
];

// ------------------------------------------------------------------------------ dataviews

const AUD_PUPILS: AudienceTag[] = ["rolls", "market"];
const AUD_MARKET: AudienceTag[] = ["market", "rolls"];
const AUD_RESULTS: AudienceTag[] = ["academic", "market"];
const live = { status: "live" as const, verifiedAt: [] as string[] };
const ORIGIN = "0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md)";

type Def = {
  id: DataviewId;
  label: string;
  railIcon: string;
  data: AdmissionsDataId;
  host: AdmissionsHostId;
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
  note?: string;
  // The entry points the view can be drawn on (the editor's "Shows for"); absent = all.
  entryPoints?: EntryPointState[];
};

const dv = (d: Def): Dataview => ({
  id: d.id,
  label: d.label,
  railIcon: d.railIcon,
  measures: d.measures,
  supports: { data: [d.data], phases: [], focus: ["entry_point"], compare: d.compare, numberType: d.numberType, dateMode: d.dateMode, viewType: d.viewType },
  params: ["entryPoint", "filters"],
  titleTemplate: d.title,
  renderer: d.renderer as Dataview["renderer"],
  host: { id: d.host, panel: d.panel, rail: d.label, file: `${A}/${d.file}` },
  audience: d.audience,
  ...live,
  origin: ORIGIN,
  rules: d.rules,
  ...(d.note ? { note: d.note } : {}),
  ...(d.entryPoints ? { variants: { entryPoint: d.entryPoints } } : {}),
});

const P = "admissions.pipelines" as const;
const M = "admissions.market" as const;
const SETS: CompareKind[] = ["schools"];
const SETS_AREA: CompareKind[] = ["schools", "averages"];

export const ADMISSIONS_DATAVIEWS: Dataview[] = [
  // ------------------------------------------------------ Pipelines: row 1, the entry point now
  dv({ id: "DV-ADM-P-NOW", label: "Entry point now", railIcon: "TilesIcon", data: "admissions.pupils", host: P, panel: "current", file: "panels/EntryNow.tsx", viewType: "numerical", dateMode: "single", numberType: ["totals", "pct_change"], compare: [], measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-TILES", title: "Your [entry] entry point now", rules: ["R-ADM-VIEW-NOW", "R-ADM-SHAPE-NOT-RANKED"], audience: AUD_PUPILS }),
  // ------------------------------------------------------ Pipelines: the large view
  dv({ id: "DV-ADM-P-PIPELINE", label: "Pipeline", railIcon: "AdmPipelineIcon", data: "admissions.pipeline", host: P, panel: "current", file: "views/PipelineChart.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals", "pct_change"], compare: SETS, measures: ["M-ADM-POOL"], renderer: "RD-ADM-PIPELINE", title: "Children who will reach [entry-year] entry, by September", rules: ["R-ADM-VIEW-PIPELINE", "R-ADM-LADDER", "R-ADM-POOL-NOT-INTAKE", "R-ADM-FLAG-FEEDER"], audience: AUD_PUPILS }),
  // 0.8 Admissions fb1 (F-13): rebuilt as "Why did our intake change?" over the catchment radius.
  dv({ id: "DV-ADM-P-FUNNEL", label: "Why did our intake change?", railIcon: "AdmFunnelIcon", data: "admissions.pipeline", host: P, panel: "current", file: "views/Funnel.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals", "pct_change"], compare: [], measures: ["M-ADM-CATCHMENT", "M-ADM-PUPILS"], renderer: "RD-ADM-FUNNEL", title: "Why did our intake change?", rules: ["R-ADM-VIEW-INTAKE-CHANGE", "R-ADM-CATCHMENT-RULE"], audience: AUD_PUPILS, entryPoints: ["11+", "16+", "custom"], note: "No funnel at 4+ (0.7 r3, F7)." }),
  dv({ id: "DV-ADM-P-BIRTHS", label: "Local births", railIcon: "AdmPopulationIcon", data: "admissions.pipeline", host: P, panel: "current", file: "views/Funnel.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: ["averages"], measures: ["M-ADM-CATCHMENT"], renderer: "RD-ADM-BIRTHS", title: "Births in your catchment, against the region and England", rules: ["R-ADM-VIEW-LOCAL-BIRTHS", "R-ADM-CATCHMENT-RULE"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-MAP", label: "Map of feeders", railIcon: "MapPinIcon", data: "admissions.pipeline", host: P, panel: "current", file: "views/AdmissionsMap.tsx", viewType: "map", dateMode: "single", numberType: ["totals", "pct_change"], compare: SETS, measures: ["M-ADM-POOL", "M-ADM-PUPILS"], renderer: "RD-ADM-MAP", title: "Your feeders, sized by pupils aged [feeder-age], coloured by trend", rules: ["R-ADM-VIEW-FEEDERS", "R-ADM-FLAG-FEEDER"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-TABLE", label: "Feeder table", railIcon: "TableIcon", data: "admissions.pipeline", host: P, panel: "current", file: "views/Tables.tsx", viewType: "table", dateMode: "single", numberType: ["totals", "pct_change"], compare: SETS, measures: ["M-ADM-POOL", "M-ADM-PUPILS"], renderer: "RD-ADM-TABLE", title: "Your feeders: pupils aged [feeder-age], trend and flags", rules: ["R-ADM-VIEW-FEEDERS", "R-ADM-FLAG-FEEDER"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-SHAPE", label: "Shape and size", railIcon: "AdmShapeIcon", data: "admissions.pupils", host: P, panel: "current", file: "views/ShapeAndSize.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: SETS, measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-SHAPES", title: "Shape and size: your school, the local shape, and rivals' shapes", rules: ["R-ADM-VIEW-SHAPES", "R-ADM-SHAPE-NOT-RANKED"], audience: AUD_PUPILS }),
  // ------------------------------------------------------ Pipelines: row 2, trends
  dv({ id: "DV-ADM-P-ENTRY-LINE", label: "Your cohort", railIcon: "TrendLineIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-LINE", title: "Your [entry-year] cohort, year by year", rules: ["R-ADM-VIEW-TRENDS", "R-ADM-POOL-NOT-INTAKE"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-ENTRY-BARS", label: "Your cohort, bars", railIcon: "VerticalBarsIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Bars.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-BARS", title: "Your [entry-year] cohort, year by year", rules: ["R-ADM-VIEW-TRENDS"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-ENTRY-TABLE", label: "Your cohort, table", railIcon: "TableIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-TABLE", title: "Your [entry-year] cohort, year by year", rules: ["R-ADM-VIEW-TRENDS"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-ENTRY-SEX", label: "Your cohort, girls and boys", railIcon: "IndexedLineIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: [], measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-LINE", title: "Your [entry-year] cohort: girls and boys", rules: ["R-ADM-VIEW-TRENDS", "R-ADM-ENTRY-SEX"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-POOL-INDEXED", label: "Pool trends", railIcon: "IndexedLineIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: SETS_AREA, measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-LINE", title: "[feeder-age]-year-olds: your feeders, [la] and England", rules: ["R-ADM-VIEW-TRENDS"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-POOL-TABLE", label: "Pool trends, table", railIcon: "TableIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["totals", "index100"], compare: SETS_AREA, measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-TABLE", title: "[feeder-age]-year-olds: your feeders, [la] and England", rules: ["R-ADM-VIEW-TRENDS"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-AREA-POP", label: "Area population", railIcon: "AdmPopulationIcon", data: "admissions.pupils", host: P, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: ["averages"], measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-BARS", title: "Population trends in the area (ages 5-15)", rules: ["R-ADM-VIEW-TRENDS"], audience: AUD_PUPILS, note: "The school page's Population trends in the area, as it draws them." }),
  dv({ id: "DV-ADM-P-HOLD-LINE", label: "Share needed", railIcon: "TrendLineIcon", data: "admissions.pipeline", host: P, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["market_share"], compare: SETS, measures: ["M-ADM-POOL"], renderer: "RD-ADM-LINE", title: "Share needed to hold numbers steady", rules: ["R-ADM-HOLD-SHARE", "R-ADM-VIEW-TRENDS"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-P-HOLD-TABLE", label: "Share needed, table", railIcon: "TableIcon", data: "admissions.pipeline", host: P, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["market_share", "totals"], compare: SETS, measures: ["M-ADM-POOL"], renderer: "RD-ADM-TABLE", title: "Share needed to hold numbers steady", rules: ["R-ADM-HOLD-SHARE"], audience: AUD_PUPILS }),

  // ------------------------------------------------------ Market share: row 1
  dv({ id: "DV-ADM-M-NOW", label: "Your place now", railIcon: "TilesIcon", data: "admissions.market", host: M, panel: "current", file: "panels/MarketNow.tsx", viewType: "numerical", dateMode: "single", numberType: ["rank", "market_share", "change_pp"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-TILES", title: "Your place among the [rivals], at [entry]", rules: ["R-ADM-VIEW-MARKET", "R-ADM-GROUP-SHARE"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-DONUT", label: "Share (donut)", railIcon: "DonutIcon", data: "admissions.market", host: M, panel: "current", file: "views/Bars.tsx", viewType: "donut", dateMode: "single", numberType: ["market_share"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-DONUT", title: "Your share of [entry-age]-year-olds across this group", rules: ["R-ADM-VIEW-MARKET", "R-ADM-GROUP-SHARE"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-BARS", label: "Ranked bars", railIcon: "HorizontalBarsIcon", data: "admissions.market", host: M, panel: "current", file: "views/Bars.tsx", viewType: "ranking", dateMode: "single", numberType: ["totals", "market_share", "rank"], compare: SETS, measures: ["M-ADM-MARKET", "M-ADM-RIVAL-RESULTS"], renderer: "RD-ADM-BARS", title: "[entry-age]-year-olds by school, ranked, with where each sits in regional and national results rankings", rules: ["R-ADM-VIEW-MARKET", "R-ADM-RIVAL-RANKS"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-MAP", label: "Map of rivals", railIcon: "MapPinIcon", data: "admissions.market", host: M, panel: "current", file: "views/AdmissionsMap.tsx", viewType: "map", dateMode: "single", numberType: ["totals", "market_share"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-MAP", title: "Your rivals, sized by pupils aged [entry-age]", rules: ["R-ADM-VIEW-MARKET"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-TABLE", label: "Rivals table", railIcon: "TableIcon", data: "admissions.market", host: M, panel: "current", file: "views/Tables.tsx", viewType: "table", dateMode: "single", numberType: ["totals", "market_share", "rank"], compare: SETS, measures: ["M-ADM-MARKET", "M-ADM-RIVAL-RESULTS"], renderer: "RD-ADM-TABLE", title: "Your rivals at [entry]", rules: ["R-ADM-VIEW-MARKET", "R-ADM-RIVAL-RANKS"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-MOMENTUM", label: "Rivals' momentum", railIcon: "AdmScatterIcon", data: "admissions.rivals", host: M, panel: "current", file: "views/Momentum.tsx", viewType: "graph", dateMode: "trend", numberType: ["pct_change", "change_points"], compare: SETS, measures: ["M-ADM-RIVAL-RESULTS", "M-ADM-PUPILS"], renderer: "RD-ADM-SCATTER", title: "Who is gaining pupils, and whose results are rising?", rules: ["R-ADM-VIEW-MOMENTUM", "R-ADM-FLAG-MOMENTUM"], audience: AUD_RESULTS }),
  dv({ id: "DV-ADM-M-STRENGTHS", label: "Strengths and weaknesses", railIcon: "AdmStrengthsIcon", data: "admissions.rivals", host: M, panel: "current", file: "views/Strengths.tsx", viewType: "graph", dateMode: "single", numberType: ["points", "change_points", "rank"], compare: SETS, measures: ["M-ADM-RIVAL-RESULTS"], renderer: "RD-ADM-STRENGTHS", title: "Where you lead and trail your rivals, by subject area", rules: ["R-ADM-VIEW-STRENGTHS", "R-ADM-FLAG-STRENGTHS"], audience: AUD_RESULTS, entryPoints: ["11+", "16+", "custom"], note: "KS2 has no subject areas: not on 4+ (a custom age below 11 shows the reason)." }),
  dv({ id: "DV-ADM-M-SHAPE", label: "Rivals' shapes", railIcon: "AdmShapeIcon", data: "admissions.pupils", host: M, panel: "current", file: "views/ShapeAndSize.tsx", viewType: "graph", dateMode: "single", numberType: ["totals"], compare: SETS, measures: ["M-ADM-PUPILS"], renderer: "RD-ADM-SHAPES", title: "Shape and size: your school and rivals' shapes", rules: ["R-ADM-VIEW-SHAPES", "R-ADM-SHAPE-NOT-RANKED"], audience: AUD_PUPILS }),
  dv({ id: "DV-ADM-M-FLAGS", label: "Flags", railIcon: "FlagIcon", data: "admissions.rivals", host: M, panel: "current", file: "views/Momentum.tsx", viewType: "table", dateMode: "trend", numberType: ["pct_change", "change_points"], compare: SETS, measures: ["M-ADM-RIVAL-RESULTS", "M-ADM-PUPILS"], renderer: "RD-ADM-FLAGS", title: "Rivals' flags: large and lasting changes", rules: ["R-ADM-VIEW-FLAGS", "R-ADM-FLAG-MOMENTUM"], audience: AUD_RESULTS, note: "In the editor's catalogue; the published dashboard shows the flags inside Rivals' momentum." }),
  // ------------------------------------------------------ Market share: row 2
  dv({ id: "DV-ADM-M-VS-LINE", label: "You and the rivals", railIcon: "IndexedLineIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: SETS, measures: ["M-ADM-MARKET", "M-ADM-PUPILS"], renderer: "RD-ADM-LINE", title: "Your [entry-year] against the [rivals]", rules: ["R-ADM-VIEW-TRENDS", "R-ADM-VIEW-MARKET"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-VS-BARS", label: "You and the rivals, bars", railIcon: "VerticalBarsIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Bars.tsx", viewType: "graph", dateMode: "trend", numberType: ["totals"], compare: SETS, measures: ["M-ADM-MARKET", "M-ADM-PUPILS"], renderer: "RD-ADM-BARS", title: "Your [entry-year] against the [rivals]", rules: ["R-ADM-VIEW-TRENDS"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-ACAD-RANK", label: "Academic ranking", railIcon: "RankListIcon", data: "admissions.rivals", host: M, panel: "trend", file: "panels/Academic.tsx", viewType: "ranking", dateMode: "single", numberType: ["rank", "change_points"], compare: SETS, measures: ["M-ADM-RIVAL-RESULTS"], renderer: "RD-ADM-STRENGTHS", title: "Academic: your rank among the rivals", rules: ["R-ADM-VIEW-ACADEMIC", "R-ADM-RIVAL-RANKS"], audience: AUD_RESULTS }),
  dv({ id: "DV-ADM-M-ACAD-NUM", label: "Academic numbers", railIcon: "AdmNumbersIcon", data: "admissions.rivals", host: M, panel: "trend", file: "panels/Academic.tsx", viewType: "table", dateMode: "single", numberType: ["points", "rank"], compare: SETS, measures: ["M-ADM-RIVAL-RESULTS"], renderer: "RD-ADM-TABLE", title: "Academic: the rivals' headline figures", rules: ["R-ADM-VIEW-ACADEMIC"], audience: AUD_RESULTS }),
  dv({ id: "DV-ADM-M-ACAD-CHANGE", label: "Academic change", railIcon: "ChangeArrowIcon", data: "admissions.rivals", host: M, panel: "trend", file: "panels/Academic.tsx", viewType: "graph", dateMode: "trend", numberType: ["change_points"], compare: SETS, measures: ["M-ADM-RIVAL-RESULTS"], renderer: "RD-ADM-BARS", title: `Academic: change since ${periodLabel(TREND_BASE_PERIOD)}`, rules: ["R-ADM-VIEW-ACADEMIC"], audience: AUD_RESULTS }),
  dv({ id: "DV-ADM-M-SHARE-LINE", label: "Market share", railIcon: "TrendLineIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["market_share"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-LINE", title: "Your market share at [entry], year by year", rules: ["R-ADM-VIEW-MARKET", "R-ADM-GROUP-SHARE"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-SHARE-NUM", label: "Market share numbers", railIcon: "AdmNumbersIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["totals", "market_share"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-TABLE", title: "Your market share at [entry], year by year", rules: ["R-ADM-VIEW-MARKET"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-SHARE-RANKS", label: "Market share ranks", railIcon: "HorizontalBarsIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Tables.tsx", viewType: "table", dateMode: "trend", numberType: ["rank"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-TABLE", title: "Your rank at [entry], year by year", rules: ["R-ADM-VIEW-MARKET"], audience: AUD_MARKET }),
  dv({ id: "DV-ADM-M-SHARE-CHANGE", label: "Change in share", railIcon: "ChangeArrowIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Bars.tsx", viewType: "graph", dateMode: "trend", numberType: ["pct_change", "change_pp"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-BARS", title: `Change in share at [entry] since ${periodLabel(CENSUS_FIRST_PERIOD)}`, rules: ["R-ADM-VIEW-MARKET"], audience: AUD_MARKET }),
  // 0.8 Admissions fb1 (F-20): indexed; the rivals' average in the panel, each rival in full screen.
  dv({ id: "DV-ADM-M-ROLL-LINE", label: "Entry age band roll", railIcon: "AdmRollIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["index100"], compare: SETS, measures: ["M-ADM-MARKET", "M-ADM-PUPILS"], renderer: "RD-ADM-LINE", title: "[entry age band] roll, indexed: you and the [rivals]", rules: ["R-ADM-VIEW-MARKET", "R-ADM-ROLL-INDEXED"], audience: AUD_MARKET }),
  // 0.8 Admissions fb1 (F-21): the share of the whole age band (11+: Years 7-11), the rail's last view.
  dv({ id: "DV-ADM-M-SHARE-BAND", label: "Share of Years 7–11", railIcon: "TrendLineIcon", data: "admissions.market", host: M, panel: "trend", file: "views/Lines.tsx", viewType: "graph", dateMode: "trend", numberType: ["market_share"], compare: SETS, measures: ["M-ADM-MARKET"], renderer: "RD-ADM-LINE", title: "Your share of [entry age band], year by year", rules: ["R-ADM-VIEW-MARKET", "R-ADM-GROUP-SHARE", "R-ADM-BAND-SHARE"], audience: AUD_MARKET }),
];

// ------------------------------------------------------------------------------- presets

const LATEST: ViewYears = { latest: true };
const SINCE_2019: ViewYears = { from: "first", rollOn: true };
type Body = Pick<ViewSpec, "data" | "view">;
const b = (source: AdmissionsDataId, per: ViewSpec["data"]["per"], shownAs: ViewSpec["data"]["shownAs"], years: ViewYears, view: ViewView): Body => ({
  data: { source, subject: "follows", per, shownAs, years },
  view,
});

export const ADMISSIONS_BODIES: Record<string, Body> = {
  "DV-ADM-P-NOW": b("admissions.pupils", "school", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-ADM-P-PIPELINE": b("admissions.pipeline", "year", "actual", SINCE_2019, { kind: "pipeline", look: { projection: "member", pastPools: true, rungLabels: true } }),
  "DV-ADM-P-FUNNEL": b("admissions.pipeline", "school", "change", SINCE_2019, { kind: "bar", look: { orientation: "vertical", values: true } }),
  "DV-ADM-P-BIRTHS": b("admissions.pipeline", "year", "indexed", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-P-MAP": b("admissions.pipeline", "school", "actual", LATEST, { kind: "map", look: { colour: "change" } }),
  "DV-ADM-P-TABLE": b("admissions.pipeline", "school", "actual", LATEST, { kind: "table", look: { yearColumns: "latest", extra: ["change"], sort: "listed", highlight: true, colourChange: true, memberSort: true } }),
  "DV-ADM-P-SHAPE": b("admissions.pupils", "school", "actual", LATEST, { kind: "shapes", look: { columns: 2 } }),
  "DV-ADM-P-ENTRY-LINE": b("admissions.pupils", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-P-ENTRY-BARS": b("admissions.pupils", "year", "actual", SINCE_2019, { kind: "bar", look: { orientation: "vertical", values: true } }),
  "DV-ADM-P-ENTRY-SEX": b("admissions.pupils", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-P-ENTRY-TABLE": b("admissions.pupils", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", extra: ["change"], years: "down" } }),
  "DV-ADM-P-POOL-INDEXED": b("admissions.pupils", "year", "indexed", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-P-POOL-TABLE": b("admissions.pupils", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-ADM-P-AREA-POP": b("admissions.pupils", "year", "actual", LATEST, { kind: "bar", look: { orientation: "vertical" } }),
  "DV-ADM-P-HOLD-LINE": b("admissions.pipeline", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-P-HOLD-TABLE": b("admissions.pipeline", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-ADM-M-NOW": b("admissions.market", "school", "actual", LATEST, { kind: "numbers", look: {} }),
  "DV-ADM-M-DONUT": b("admissions.market", "school", "actual", LATEST, { kind: "donut", look: {} }),
  "DV-ADM-M-BARS": b("admissions.market", "school", "actual", LATEST, { kind: "ranking", look: { columns: ["rank", "bar", "value", "change"], show: "all", alwaysSelf: true } }),
  "DV-ADM-M-MAP": b("admissions.market", "school", "actual", LATEST, { kind: "map", look: { colour: "value" } }),
  "DV-ADM-M-TABLE": b("admissions.market", "school", "actual", LATEST, { kind: "table", look: { yearColumns: "latest", extra: ["change", "rank"], sort: "latest", highlight: true, memberSort: true } }),
  "DV-ADM-M-MOMENTUM": b("admissions.rivals", "school", "change", LATEST, { kind: "scatter", look: { labels: true, quadrantNames: true } }),
  "DV-ADM-M-STRENGTHS": b("admissions.rivals", "subject", "actual", LATEST, { kind: "strengths", look: { order: "gap", showFlags: true } }),
  "DV-ADM-M-SHAPE": b("admissions.pupils", "school", "actual", LATEST, { kind: "shapes", look: { columns: 2 } }),
  "DV-ADM-M-FLAGS": b("admissions.rivals", "school", "change", LATEST, { kind: "flags", look: { show: "flagged" } }),
  "DV-ADM-M-VS-LINE": b("admissions.market", "year", "indexed", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-M-VS-BARS": b("admissions.market", "year", "actual", SINCE_2019, { kind: "bar", look: { orientation: "vertical" } }),
  "DV-ADM-M-ACAD-RANK": b("admissions.rivals", "subject", "actual", LATEST, { kind: "ranking", look: { columns: ["rank", "value", "change"], show: "all" } }),
  "DV-ADM-M-ACAD-NUM": b("admissions.rivals", "school", "actual", LATEST, { kind: "table", look: { yearColumns: "latest", extra: ["rank"], sort: "latest", highlight: true } }),
  "DV-ADM-M-ACAD-CHANGE": b("admissions.rivals", "school", "change", LATEST, { kind: "bar", look: { orientation: "horizontal", diverging: true, highlight: true, values: true } }),
  "DV-ADM-M-SHARE-LINE": b("admissions.market", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-M-SHARE-NUM": b("admissions.market", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", years: "down" } }),
  "DV-ADM-M-SHARE-RANKS": b("admissions.market", "year", "actual", SINCE_2019, { kind: "table", look: { yearColumns: "every", extra: ["rank"], years: "down" } }),
  "DV-ADM-M-SHARE-CHANGE": b("admissions.market", "school", "change", SINCE_2019, { kind: "bar", look: { orientation: "horizontal", diverging: true, values: true } }),
  "DV-ADM-M-ROLL-LINE": b("admissions.market", "year", "indexed", SINCE_2019, { kind: "line", look: {} }),
  "DV-ADM-M-SHARE-BAND": b("admissions.market", "year", "actual", SINCE_2019, { kind: "line", look: {} }),
};

// The families and compare options Step 1 lists for an Admissions dashboard (D7).
export const ADMISSIONS_FAMILIES: { id: AdmissionsDataId; label: string }[] = [
  { id: "admissions.pupils", label: "Pupils by age" },
  { id: "admissions.pipeline", label: "Pipeline" },
  { id: "admissions.market", label: "Market share" },
  { id: "admissions.rivals", label: "Rivals' results" },
];
export const isAdmissionsData = (d: string | undefined | null): d is AdmissionsDataId => !!d && d.startsWith("admissions.");
export const isAdmissionsHost = (h: string | undefined | null): h is AdmissionsHostId => !!h && h.startsWith("admissions.");

// 0.8 audit fixes (6, R-ADM-SEX-FILTER): how each view takes the girls/boys filter -- never on part of
// a panel. "applies": every pupil figure it draws is girls' or boys' (Pool trends hides its LA and
// England lines, which ONS and the census aggregates don't split, and says so). "not-split": nothing
// on it is split, and it says "Not split by sex" while the filter is on (shapes, area population,
// results, and momentum and flags, which set pupils against results).
export const ADM_SEX_FILTER: Record<string, "applies" | "not-split"> = {
  "DV-ADM-P-NOW": "applies",
  "DV-ADM-P-PIPELINE": "applies",
  // 0.8 Admissions fb1: the catchment's population has no girl/boy split.
  "DV-ADM-P-FUNNEL": "not-split",
  "DV-ADM-P-BIRTHS": "not-split",
  "DV-ADM-P-MAP": "applies",
  "DV-ADM-P-TABLE": "applies",
  "DV-ADM-P-SHAPE": "not-split",
  "DV-ADM-P-ENTRY-LINE": "applies",
  "DV-ADM-P-ENTRY-BARS": "applies",
  "DV-ADM-P-ENTRY-SEX": "not-split",
  "DV-ADM-P-ENTRY-TABLE": "applies",
  "DV-ADM-P-POOL-INDEXED": "applies",
  "DV-ADM-P-POOL-TABLE": "applies",
  "DV-ADM-P-AREA-POP": "not-split",
  "DV-ADM-P-HOLD-LINE": "applies",
  "DV-ADM-P-HOLD-TABLE": "applies",
  "DV-ADM-M-NOW": "applies",
  "DV-ADM-M-DONUT": "applies",
  "DV-ADM-M-BARS": "applies",
  "DV-ADM-M-MAP": "applies",
  "DV-ADM-M-TABLE": "applies",
  "DV-ADM-M-MOMENTUM": "not-split",
  "DV-ADM-M-STRENGTHS": "not-split",
  "DV-ADM-M-SHAPE": "not-split",
  "DV-ADM-M-FLAGS": "not-split",
  "DV-ADM-M-VS-LINE": "applies",
  "DV-ADM-M-VS-BARS": "applies",
  "DV-ADM-M-ACAD-RANK": "not-split",
  "DV-ADM-M-ACAD-NUM": "not-split",
  "DV-ADM-M-ACAD-CHANGE": "not-split",
  "DV-ADM-M-SHARE-LINE": "applies",
  "DV-ADM-M-SHARE-NUM": "applies",
  "DV-ADM-M-SHARE-RANKS": "applies",
  "DV-ADM-M-SHARE-CHANGE": "applies",
  "DV-ADM-M-ROLL-LINE": "applies",
  "DV-ADM-M-SHARE-BAND": "applies",
};
