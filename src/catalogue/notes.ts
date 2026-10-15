// Notes a view carries after its source (the caveat line in the panel's "i", printed as text
// in fullscreen and in "Print this graph"), and the one trend rule they explain. One place for
// the wording and the base year, so either can be edited without touching a component.
//
// R-TREND-FROM-2223 (0.6.2 S4b, Guy's decision of 6 Oct 2026; it replaces S4's
// R-2122-GRADING-NOTE): 2021/22 (summer 2022, Ofqual's transition year) stays on a grade or
// points trend's graphs and tables, but every trend statement is measured from 2022/23 --
// direction words, "change since", change tables, ranked change lists, change maps, fitted
// lines, slopes, captions and summaries. A view whose drawn years include 2021/22 carries the
// note saying so. Never on a latest-year view, on Candidates (entries) or at KS2 (its tests
// aren't graded by Ofqual's GCSE / A-level transition).
import type { ViewSpec } from "./viewspec";
import { CENSUS_FIRST_PERIOD, GRADING_2122_PERIOD, periodLabel, TREND_BASE_PERIOD } from "./years";

// The wording. Edit here; every view reads it.
export const TREND_BASE_NOTE =
  `Trends are measured from ${periodLabel(TREND_BASE_PERIOD)}. ${periodLabel(GRADING_2122_PERIOD)} is still shown, but its grades were awarded more generously (Ofqual's transition year after the pandemic), so measuring from it would make most schools look as if results had fallen.`;

// 2021/22 (the summer-2022 results) and the year every trend statement is measured from,
// 2022/23 (the summer-2023 results): both set in years.ts, with the app's other fixed years.
export { GRADING_2122_PERIOD, TREND_BASE_PERIOD };

// The measures a view's figure can be on (teacher-view-panels' MeasureId): grades and points
// follow the rule, entries ("Candidates") don't.
const GRADED = new Set(["points", "threshold", "bands", "counts"]);

// Whether a view's figure is a grade or points one -- the panel's measure, at its phase.
export function trendBaseApplies(measureId: string, phase: string | null | undefined): boolean {
  return GRADED.has(measureId) && phase !== "ks2";
}

// The year statements on this measure are measured from, or null (entries, KS2: from the
// first year, as before).
export function trendBaseFor(measureId: string, phase: string | null | undefined): number | null {
  return trendBaseApplies(measureId, phase) ? TREND_BASE_PERIOD : null;
}

// The note for a view over `years` (the periods it draws, after any "From" trim), or null.
// A trend: two or more years, one of them 2021/22. `years` null = not a grade or points
// view, or a latest-year one.
export function trendNoteFor(years: readonly number[] | null | undefined): string | null {
  if (!years || years.length < 2) return null;
  return years.includes(GRADING_2122_PERIOD) ? TREND_BASE_NOTE : null;
}

// Under views=v2, the years the panel's showing view draws: its host's (the Trends "From"
// year, Grade counts' compare year), except a latest-year spec (none; one the member moves
// with a year menu -- Grade counts' Spread by year, latest against a picked year -- keeps
// the host's) and a slope with a fixed first year (that year and the latest; slope.ts is
// the one builder that reads a numeric `from`).
export function specYears(spec: ViewSpec | null | undefined, hostYears: readonly number[] | null | undefined): readonly number[] | null {
  if (!hostYears) return null;
  if (!spec) return hostYears;
  const years = spec.data.years;
  if ("latest" in years) return years.memberPick ? hostYears : null;
  // R-TREND-FROM-2223: a change map colours each school by its change from 2022/23 at the
  // earliest, so it draws no 2021/22 figure.
  if (spec.view.kind === "map") return hostYears.filter((p) => p >= TREND_BASE_PERIOD);
  if (spec.view.kind === "slope") {
    const last = hostYears[hostYears.length - 1];
    if (last === undefined) return null;
    // R-TREND-FROM-2223: a slope from the span's first year starts at 2022/23 at the
    // earliest (slope.ts), so it draws 2021/22 only when its first year is fixed there.
    const from = typeof years.from === "number" ? years.from : hostYears.find((p) => p >= TREND_BASE_PERIOD);
    return from === undefined || last < from ? null : [from, last];
  }
  return hostYears;
}

// ------------------------------------------------------------------ admissions (0.7 r1)
// The honesty wording for the Admissions dashboards (src/lib/admissions/), in one place like the
// trend notes above, so a view never words a pool, a share or an estimate on its own.
export const ADMISSIONS_NOTES = {
  // R-ADM-POOL-NOT-INTAKE
  pool: "This is the pool, not an intake: the children in these schools, or born in these areas, who will reach this entry point. It does not say how many will come.",
  // R-ADM-LADDER: the certainty of each year, by its source
  counted: "Counted: children in these schools now (the January census), followed forward.",
  // 0.8 audit fixes (6, R-ADM-SEX-FILTER): a panel the girls/boys filter doesn't split, and Pool
  // trends' area lines while it is on.
  notSplitBySex: "Not split by sex: girls and boys together.",
  poolAreaNotSplit: "The LA and England lines aren't split by sex, so they are hidden while girls or boys is chosen.",
  // 0.8 audit fixes (5, A2): at 4+ (and younger) the births are not scaled to the schools; the ratio
  // sets only the range. From 11+ the ladder does scale them (ladder.ts birthsPoint), so that entry
  // keeps its own words (birthsScaled).
  births: "Births in the local authority blend; the Reception-to-births ratio sets the range.",
  birthsScaled: "From births: the local authority blend's births, scaled to these schools by the ratio of their Reception pupils to births in past years, then carried forward. A range, not a count.",
  projection: "From ONS projections (age 10, by local authority): a wider band, shown only on request.",
  // R-ADM-BIRTH-SPLIT
  birthSplit: "Births are counted by calendar year; a school year runs September to August, so each year's pool is 8/12 of one year's births plus 4/12 of the year before.",
  birthSex: "Births have no boy/girl split: a girls' or boys' pool from births is an estimate (49% / 51%).",
  // R-ADM-DRIFT-RANGE
  drift: `The range is how much these schools' year groups have actually grown or shrunk from one year to the next since ${periodLabel(CENSUS_FIRST_PERIOD)} (the middle 80% of those changes), applied for each year still to go -- so it widens the further ahead it looks.`,
  // R-ADM-HOLD-SHARE
  holdShare: "The share needed to hold numbers steady: this year's intake as a share of each future pool. A requirement, not a forecast.",
  // R-ADM-GROUP-SHARE
  groupShare: "A share of this group: your pupils at this age as a share of the same age across these schools. Not a share of the local market.",
  // R-ADM-JOINERS-ESTIMATE
  joiners: "An estimate: the growth in a year group from one January to the next. It counts net arrivals, not every pupil who joined.",
  leaving16: "Leaving at 16: the fall from Year 11 to Year 12 at the same school, a year apart. An estimate of net leavers.",
  // R-ADM-SHAPE-NOT-RANKED
  shape: "Shapes describe a school's year groups; they are not better or worse, so they are never ranked.",
  // 0.7 r2: the short forms the panels' bottom rows and keys carry (the same rules, fewer words).
  poolShort: "A pipeline shows the pool of children, not who will join. Ranges widen with distance.",
  requirement: "A requirement, not a forecast",
  groupShort: "Share of this group only",
  cohortShort: "Cohort size, not new joiners",
  estimate: "An estimate",
  shapesShort: "Described, not ranked",
  localShape: "A narrowing base means smaller year groups are on the way.",
  flagsRule: "Flags appear only when a change is large and lasting (fixed national thresholds, over two or more years), never from one small cohort. Hover a flag for the figures behind it.",
  flagsMissing: "Flags not available yet: the national thresholds aren't loaded, and no flag is ever guessed.",
  feederFlags: "Flags compare each school's trend with the area's (the whole set's).",
  boardingCensus: "International boarders aren't in the school census. Your pipeline shows national new joiners to ISC schools by country as context.",
  // 0.7 r2b (E3): the LA and England pool-trend lines for past years (age_profile_aggregates,
  // backfilled from today's schools table). Shown only when a past year is drawn.
  areaUndercount: "Earlier years count only schools still open, so they slightly undercount.",
  // 0.7 r3 (F7): the funnel's note (behind the panel's caption button, F1), and each bar's label
  // after its bold lead word ({area}: "Worcestershire", or "Worcestershire 70% · Herefordshire 30%").
  funnelNote: "Each bar is its own count from its own source, for the same area: not a flow of the same children.",
  funnelBirths: "in {area} · born Sept {from} – Aug {to} · worked out from calendar-year births",
  funnelPoolOne: "in all {area} schools, state and independent · {year}",
  funnelPoolBlend: "in all schools in {area}, state and independent · {year}",
  funnelEntry: "entry cohort · {year}",
  funnelPoolMethod: "January census: every pupil aged {age} at 31 August in every mainstream school in the area -- academies, LA-maintained, free and independent -- weighted as the births are.",
  funnelPoolBySex: "Not held by girls or boys: the area's counts have no split.",
} as const;

// ------------------------------------------------------------------------- SMT (0.8 round 1)
// The honesty wording for the SMT dashboards (src/lib/smt/, src/components/smt/), in one place like
// the notes above: every SMT view takes its caveats from here (R-SMT-NOTES), never its own words.
// {placeholders} are filled by smtNote().
export const SMT_NOTES = {
  // Ranks (R-SMT-SET-RANKS): who is counted.
  ranks: "Ranks are among the schools with that result: highest first, ties share a place. The count says how many were ranked.",
  setRank: "{rank} of {of} {setLabel} with {stage} results",
  // R-IGCSE-EXCL, said for SMT.
  igcseChip: "No published GCSE results: this school sits IGCSEs, which DfE's tables don't count, so its GCSE figures aren't comparable.",
  igcseView: "{school} sits IGCSEs, which DfE's GCSE tables don't count. Its GCSE figures would read near zero, so it isn't compared or ranked at GCSE. Post-16 results are compared as usual.",
  igcseRow: "not ranked: IGCSE",
  // Progress 8 (R-SMT-P8-REASON): which reason applies, never a blank.
  p8Independent: "Progress 8 is not published for independent schools.",
  p8NoBaseline: "Progress 8 is not published for {years}: those pupils sat no KS2 tests (2020 and 2021), so there is no baseline.",
  p8Published: "Progress 8, {year}: the latest DfE published. None for {years} (no KS2 baseline).",
  p8NoGcse: "No GCSE results, so no Progress 8.",
  // A-level value added (R-SMT-VA-HONEST).
  alevelVa: "A-level value added compares each student's results with others nationally who started from similar GCSEs. 0 is the national average; the range is DfE's 95% confidence interval -- a figure whose range crosses 0 isn't clearly different from average.",
  vaNotKs2: "Value added isn't published for KS2.",
  vaNoGcseSubjects: "DfE has never published GCSE value added by subject. When Progress 8 returns, the whole-school figure shows here, never a subject one.",
  vaNotPublished: "No value added is published for this school at Post-16.",
  // Trends (R-TREND-FROM-2223 is the shared note; these are SMT's own lines).
  sinceBase: "Change is measured from {base}, the first year graded on the normal scale.",
  middleHalf: "The band is the middle half of {setLabel} with results that year (the 25th to the 75th percentile). Schools without results are left out.",
  rollIndexed: "Each line is indexed to 100 in {base}. {la} and England count pupils aged 5 to 15 in every mainstream school (age_profile_aggregates), so they are a like-for-like trend for the area, not a total roll.",
  rollAreaUndercount: "Earlier area years count only schools still open, so they slightly undercount.",
  // Entries (the year rules: change in entries counts from the first year).
  entriesMix: "Each subject's share of the entries, year by year. Entries change counts from the first year shown (entries aren't graded, so the 2021/22 note doesn't apply).",
  // Market share from Admissions, read-only.
  marketNoLists: "The Admissions lead hasn't chosen rivals at 11+ yet, so there is no market share to show. Admissions sets them.",
  marketNoEntry: "This school has no 11+ entry, so it has no market share at 11+.",
  marketShort: "A share of the rivals Admissions chose: not a share of the local market.",
  // Flags (R-SMT-FLAGS).
  // 0.8 audit fixes (3, S1): {gap} is the measure and its size ("2 Attainment 8 points"), filled by
  // flagsRuleText only, so every filled form reads as a sentence.
  flagsRule: "Flags appear only when a change is large and lasting: three years of falling roll, results whose two-year change differs from the set's middle change by at least {gap} (with at least {min} set schools to compare), or an entry year shrinking past the national threshold. Hover a flag for the figures.",
  flagsRuleNoResults: "Flags appear only when a change is large and lasting: three years of falling roll, or an entry year shrinking past the national threshold. Hover a flag for the figures.",
  flagsNone: "No flags: nothing has moved far enough, for long enough.",
  // The size badges, as the school page says them.
  size: "XS to XL: this school's pupils in each phase against every school with that phase in England (fifths). The school page's Roll by phase.",
  // Results by band (reserved).
  bandReserved: "Arrives with the results-by-band round: the top 25%, middle 50% and bottom 25% of entries.",
  // A qualification on its own scale (an FSMQ's A-E, a BTEC's Distinction-Pass) has no GCSE points.
  differentScale: "different grading scale, not ranked",
  // ---- 0.8 SMT round 2: Pupils
  entryPointsNone: "Admissions hasn't set this school's entry points yet, so there is nothing to show here. The Admissions lead sets them in Admissions.",
  // 0.8 groups r1 (G0): not "staying on" -- a sixth form that recruits shows more than 100%.
  y12Label: "Year 12 against Year 11",
  y12AgainstY11: "Year 12 this year against Year 11 last year: below 100% when pupils leave at 16, above 100% when more join than leave.",
  shapesAround: "Shapes are described, never ranked: a smaller sixth form isn't worse.",
  rollByPhase: "Each phase's roll, and England's pupils aged 5 to 15 in every mainstream school (the census aggregates), indexed to 100 in {base}.",
  pool: "The pool for the main entry point, from Admissions: counted in the schools it draws from, then from births. A pool, not an intake.",
  levelAges: "The level picks the ages: GCSE Years 7 to 11, Post-16 Years 12 and 13, Primary Reception to Year 6.",
  // 0.8 SMT r3 (K5): the area's school-age population is ONS residents now, not census pupils.
  areaResidents: "{la}'s residents aged {ages} (ONS mid-year estimates, by local authority): the children living in the area, not pupils.",
  areaResidentsCaption: "ONS mid-year estimates, residents",
  // ---- 0.8 SMT round 2: Context
  shadeByDistrict: "Shading by district: until the neighbourhood boundaries are loaded, the map shades whole local authorities by the pupils of these ages in their schools (school census).",
  aroundSchool: "Around the school: every school within {radius}, all sectors.",
  childrenAround: "Pupils aged {ages} in schools within {radius} (school census): children who go to school nearby, wherever they live.",
  births: "Births are counted by local authority (ONS), by calendar year.",
  // ---- 0.8 SMT round 3: Context on real data. The six wording rules (R-SMT-CONTEXT-WORDING), word for word:
  // 1. Deprivation describes the area, never the school's pupils.
  wDeprivation: "the area around the school, not its pupils",
  // 2. Independent schools: never 0%, never a bare dash.
  wIndependentFsm: "Free school meals are not published for independent schools.",
  wIndependentDraw: "Independent schools often draw pupils from well beyond {radius}.",
  // 3. Residents and pupils are different counts.
  wResidents: "Children living within {radius} (ONS estimates) are not pupils at schools within {radius} (census): two different counts, and neither is divided by the other.",
  // 4. Deciles.
  wDeciles: "1 = the most deprived 10% of neighbourhoods in England, 10 = the least.",
  // 5. Projections (0.8 SMT r4: the method note's own sentence, on every chart that uses it).
  wProjection: "A projection of children living in the area, not a forecast for the school.",
  // 6. Sources and editions (the footer's source "i"), the years and editions filled from the data.
  wSources: "ONS mid-year population estimates for LSOAs (mid-{lsoaYear}) and local authorities (mid-{laYear}); the children-in-an-area projection (settings version {settingsVersion}), and ONS's {snppBase}-based subnational projections for births' change and the comparison line; ONS births by local authority; DfE school census (pupils at schools nearby); English Indices of Deprivation {iodYear} (MHCLG); DfE \u201cSchools, pupils and their characteristics\u201d ({fsmYear}).",
  // The area now (K1).
  childrenLiving: "living within {radius} (ONS estimates, mid-{year})",
  childrenLivingLa: "living in {la} (ONS estimates, mid-{year})",
  pupilsNearby: "{n} pupils at schools within {radius} (census {year})",
  // 0.8 SMT r4 (F5): the projection tile's caption.
  projectionTile: "children living within {radius}, projected; not a forecast for the school",
  projectionTileLa: "children living in {la}, projected; not a forecast for the school",
  projection: "A projection of children living in the area, not a forecast for the school: children aged {ages} living {where}, aged forward a year at a time from those already counted, at the area's own record of families moving in and out.",
  noDistrict: "Town \u00b7 local authority \u00b7 region: VicData can't yet name a school's district.",
  // Social context (K2).
  neighbourhood: "The school's neighbourhood",
  idaciName: "IDACI: income deprivation affecting children",
  imdName: "IMD: the Index of Multiple Deprivation",
  noLsoa: "This school's postcode doesn't place it in an English neighbourhood (LSOA), so there is no deprivation figure for its area.",
  mixTitle: "Children within {radius}, by deprivation",
  mixLine: "{pct}% of children within {radius} live in the most deprived 20% of neighbourhoods (England: 20%)",
  mixInfo: "The IDACI deciles of the neighbourhoods where children aged 0 to 15 live within {radius} (ONS estimates). England's 20% is by construction: deciles 1 and 2 are a fifth of England's neighbourhoods.",
  fsmTitle: "Free school meals",
  fsmNone: "DfE publishes no free-school-meals figure for this school.",
  fsmInfo: "Pupils known to be eligible for free school meals (DfE, January census), with the local authority and England the same year.",
  // The map (K3).
  mapTitle: "Where the school-age children live",
  mapNeighbourhoods: "Neighbourhoods are ONS LSOAs, joined through postcodes",
  mapChildren: "Neighbourhoods shaded by children aged {ages} per hectare (ONS estimates, mid-{year}): neighbourhoods differ in size, so a count alone would darken the largest.",
  mapRing: "Shaded {ring} beyond the {radius} circle, so the shading has no hard edge; the circle marks the {radius} counted.",
  // 0.8 SMT r4 (R4): over context-map.ts DOTS_FROM neighbourhoods.
  mapDots: "At {radius} there are too many neighbourhoods to draw their boundaries, so each is a dot at its population-weighted centre.",
  mapDeprivation: "Neighbourhoods shaded by their {index} decile ({edition}).",
  mapDecileLegend: "1 = most deprived 10%",
  mapFsm: "Free school meals aren't published by neighbourhood, so this shades the schools, not the areas: each school's latest figure ({year}). Independent schools, hollow, don't publish one.",
  mapFsmLegend: "Shades schools, not areas",
  // Population (K4).
  popByAgeAround: "Residents by single year of age living within {radius} (ONS estimates, mid-{year}): where children live, not where they go to school.",
  popByAgeLa: "{la}'s residents by single year of age (ONS mid-year estimates, mid-{year}).",
  nearbyOverTime: "Children aged {ages} living within {radius}, against {la} and England (ONS mid-year estimates), indexed to 100 in {base}.",
  nearbyOverTimeCaption: "residents, not pupils",
  // 0.8 SMT r4 (F2): the projection starts from the latest count, so the estimates and the line always
  // meet; round 3's join note (projectionJoin, R-SMT-CONTEXT-PROJECTION-JOIN) is retired.
  populationProjected: "Children aged {ages} living {where}: estimates to mid-{year}, then the projection to {to}, its band shaded.",
  // 0.8 SMT r4 (F): the forward view. The method note's "What it is, and isn't", word for word in sense
  // (R-SMT-NOT-A-FORECAST: never "forecast" but "not a forecast", never "your roll", never a school number).
  whatItIs: "It is the children living in the area, projected from children already counted, at the area's own record of families moving in and out. It is not a forecast of any school's roll.",
  includesUnborn: "includes children not yet born",
  onsToggle: "Compare with ONS's projection",
  onsLine: "ONS {base}-based projection",
  onsAround: "ONS's {base}-based change for each local authority, applied to the area's children of these ages in it (ONS projects local authorities only).",
  bandMissing: "The band for ages {ages} needs the ingest's age-range update; the middle line is exact.",
  // 0.8 SMT r4 (R): the catchment.
  areaMix: "Within {radius}: {mix}",
  areaMixAges: "children aged {ages}",
  catchmentSaved: "Our usual catchment: {radius}",
  catchmentDefault: "The default for {kind} school, until the School-Admin saves the school's usual catchment: {radius}.",
  catchmentCapped: "The saved catchment is {saved}; the widest this board draws for a school of this type is {cap}.",
  catchmentView: "This view only: {radius}. The school's usual catchment is {usual}.",
  catchmentCap: "Up to {cap} for {kind} school.",
  oneNeighbourhood: "One neighbourhood only: figures below 5 are not shown.",
  // Small numbers.
  smallEntries: "Subjects with fewer than {min} entries aren't ranked: one or two pupils would decide the rank.",
} as const;

/** An SMT note with its {placeholders} filled. */
export function smtNote(key: keyof typeof SMT_NOTES, vars: Record<string, string | number> = {}): string {
  return SMT_NOTES[key].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

// VicData 0.8 groups round 1: head office, access and the group view's honesty wording (spec §3.4).
// Text here can change without code (the membership model is still to be confirmed by Guy).
export const GROUP_NOTES = {
  headOffice: "{group} · head office",
  // The Access page.
  accessTitle: "Access to the group view",
  accessLead: "head office decides which schools’ SMT see the group dashboards",
  comparisonSet: "Every member school already sees {set} as a comparison set in its own dashboards. This page adds the {dashboards} (Overview, Schools, Academic, Pupils) for a school’s SMT.",
  allSchools: "All {group} schools",
  groupDashboards: "group dashboards",
  membership: "A school needs its own VicData membership for its staff to sign in; the group membership covers head office and the group view.",
  usage: "Usage counts come from the usage log (counts only; names are never shown across schools).",
  notMember: "not a member",
  invite: "invite to VicData",
  inviteHow: "VicData sends no email: send the person the invitation link. It works once, only for that address, and only when they choose to accept it.",
  likely: "likely member",
  likelyWhy: "Companies House links this school to the group; no second source has confirmed it yet.",
  left: "Left the group",
  leftWhy: "No longer a member in {source}: the group view ended when the school left. History only.",
  giveAllConfirm: "Give the group view to every member school with its own VicData membership ({n} schools)? Likely members are left for you to switch on one by one.",
  removeAllConfirm: "Remove the group view from every school ({n} now see it)?",
  // The home.
  theGroup: "How are our schools doing, and against whom?",
  ourSchools: "Open any member school’s SMT dashboards",
  accessCard: "Which schools’ SMT see the group view: {n} of {m}",
  accessCount: "{n} of {m} schools see the group view",
  coming: "Coming in the next group rounds",
  summary: "Combined roll from the school census, {now} against {before}, over the {n} schools with both years; growing = the roll rose.",
  // Head office on a member school's SMT.
  headOfficeReadOnly: "{group} head office: read-only",
  admissionsPrivate: "Private to {school}. Its School-Admin can share its Admissions panels with head office.",
  // A school's own side.
  schoolGroupView: "{group}: your SMT sees the group dashboards (from {since}).",
  schoolNoGroupView: "{group}: head office hasn’t given your SMT the group dashboards.",
  shareAdmissions: "Share our Admissions panels with {group} head office",
  shareWhy: "Off: head office sees your SMT dashboards, but not your Admissions entry points or rivals.",
  // The honesty lines (spec §3.4), for the dashboards to come.
  membershipAsOf: "Membership as of {date}, from {source}.",
  combined: "Combined figures add up the schools listed. A school that joined recently counts for every year shown.",
} as const;

/** A group note with its {placeholders} filled. */
export function groupNote(key: keyof typeof GROUP_NOTES, vars: Record<string, string | number> = {}): string {
  return GROUP_NOTES[key].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

// Production's source labels, as the views say them.
export const GROUP_SOURCE_LABELS: Record<string, string> = {
  gias: "GIAS",
  gias_groups: "GIAS",
  club_iss: "Club ISS",
  gias_proprietor: "GIAS (proprietor)",
  companies_house: "Companies House",
  charity_commission: "the Charity Commission",
};
