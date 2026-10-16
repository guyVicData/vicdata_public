// VicData 0.8 groups r2 (E): every group view's method (R-METHOD-PRESENT), in the shape of the other
// products' (methods.ts's ViewMethod). {placeholders} are filled by the group dashboard from the lookups'
// own metadata: the reading, the comparison set and its n, the years, the exclusions and the sources
// (group_aggregate_lookup's build and membership). Written from the ingest's computation
// (~/dev/vicdata ingest/group_aggregates.py; docs/vicdata_group_aggregates_report_v1.md).
import type { ViewMethod } from "./methods";

const MEMBERSHIP = "Group membership: {membershipSources} (as of {asOf})";
const CENSUS = "DfE school census (January), every member school's own rows from 2019/20 (and a member's GIAS predecessors)";
const RESULTS = "DfE performance tables: KS2, KS4 (Attainment 8, English and maths, Progress 8) and KS5 (A-level and all-qualification points per entry, A-level value added)";
const READING = "Reading: {reading}. 'Members at the time' counts a school in a year only if it was a member on that year's census day (15 January), where the source dates membership; sources without dates count every listed school every year. 'All schools listed now' counts every current member every year.";
const WEIGHTED = "Results are pupil-weighted: each school counts by its pupils (GCSE pupils, KS2 cohort, post-16 entries); 'average school' is the plain mean of the schools' figures.";

export const METHODS_GROUPS: Record<string, ViewMethod> = {
  "GRP-O-NOW": {
    sources: [MEMBERSHIP, CENSUS, "School sizes: national fifths by phase band, each year"],
    geography: "The group's member schools; schools outside England are counted and listed, not added up",
    years: "The latest census, {census}; change over 1, 3 and 5 years",
    leftOut: ["Schools outside England (no DfE census): listed, never added", "Schools not yet open in a year"],
    steps: [READING, "We add up the member schools' census rolls for the year: the combined roll.", "Change is shown two ways: combined (every school counted each year, so schools that joined add to it) and like for like (only schools with a roll in both years).", "Schools growing are the schools whose roll rose over three years, among those with both years.", "Each school's size (XS to XL) places its largest phase among national fifths for that phase."],
    rounding: ["Rolls to whole pupils", "Changes to one decimal place"],
  },
  "GRP-O-AGAINST": {
    sources: [MEMBERSHIP, CENSUS, RESULTS, "Comparison sets: peer groups, non-group schools, the group's areas and England (group_comparison_lookup)"],
    geography: "The group against {setLabel} and the other sets in the table",
    years: "Roll: like-for-like change over 5 years to {census}. Results: each measure's latest published year ({resultsYear})",
    leftOut: ["IGCSE schools from every GCSE figure (the IGCSE rule)", "Schools without a published result that year, listed in Current and Schools", "Self-declared groups never enter a peer set"],
    steps: [READING, WEIGHTED, "Peer groups are groups of the same type and size band (2–5, 6–10, 11–20, 21–40, 41+ schools); the band's figure takes all their schools together, each counted once.", "Non-group schools: for a MAT, LA-maintained schools and single-academy trusts; for an independent group, standalone independent schools.", "The group's areas: every school in the LAs where its schools sit, weighted to the group's pupils in each LA, so a London-heavy group isn't set against England's mix.", "Mix-matched: non-group schools only, in the group's regions, reweighted to its own mix of phases and regions (labelled \"Non-group schools, same regions and phases as\" the group).", "Each figure shows how many schools stand behind it; the group's place in its peer band shares ties."],
    rounding: ["Attainment 8 and points to one decimal place (A-level points two)", "Percentages to one decimal place", "Value added to two decimal places"],
  },
  "GRP-O-MAP": {
    sources: [MEMBERSHIP, "School locations (easting and northing)", CENSUS],
    geography: "The group's current member schools in England; schools outside England are listed beside the map",
    years: "The latest census, {census}",
    leftOut: ["Schools outside England, listed instead", "Schools with no recorded location"],
    steps: ["Each current member school is drawn at its location, sized by its roll in the latest census.", "Its colour is its roll change over the last year: growing, steady (within 1%) or shrinking."],
    rounding: ["None"],
  },
  "GRP-O-JOINED": {
    sources: [MEMBERSHIP],
    geography: "The group's members, current and past where the source records it",
    years: "As the source dates them",
    leftOut: ["Join dates where the source has none: 'last seen' instead"],
    steps: ["Each school's join date is the source's (GIAS dates trust membership); where the source has no date, the date we last saw the school listed is shown instead.", "Schools that have left show the date they left, or when they were last seen."],
    rounding: ["None"],
  },
  "GRP-O-ROLL": {
    sources: [MEMBERSHIP, CENSUS, "The comparison set: {setLabel}"],
    geography: "The group and {setLabel}",
    years: "{from} to {census}, indexed: {base}",
    leftOut: ["Schools outside England"],
    steps: [READING, "Each line is a like-for-like index: each year it moves by that year's change over the schools with a roll in both years, starting at 100 in the first year, so a school joining or leaving doesn't move the line.", "The group's line and the comparison set's are built the same way."],
    rounding: ["Index to one decimal place"],
  },
  "GRP-O-RESULTS": {
    sources: [MEMBERSHIP, RESULTS, "The comparison set: {setLabel}"],
    geography: "The group and {setLabel}, by phase",
    years: "Each measure's published years to {resultsYear}",
    leftOut: ["IGCSE schools from GCSE figures", "Years DfE didn't publish a measure"],
    steps: [READING, WEIGHTED, "Each phase's headline is drawn for the group and the comparison set: Attainment 8 for secondaries, A-level points for sixth forms, KS2 reading, writing and maths for primaries."],
    rounding: ["As the measure is published"],
  },
  "GRP-O-SHARE": {
    sources: [MEMBERSHIP, CENSUS],
    geography: "Each LA and region where the group's schools sit (independent groups: independent pupils only)",
    years: "{census}, and each year since {from}",
    leftOut: ["Schools outside England"],
    steps: ["The group's pupils of the phase in view, as a share of all pupils of that phase at mainstream schools in the same LA (and region).", "For an independent group, the share is of the area's independent pupils.", "The trend word compares the latest share with the first year's."],
    rounding: ["Shares to one decimal place"],
  },
  "GRP-S-NOW": {
    sources: [MEMBERSHIP, CENSUS],
    geography: "The group's member schools",
    years: "The latest census, {census}",
    leftOut: ["Schools outside England: counted and listed"],
    steps: [READING, "Schools and the combined roll, as Overview counts them.", "Day and boarding: the census's boarders across the member schools.", "Membership: confirmed members, and likely ones (Companies House shows the group controlling the school's company, not yet confirmed by a second source), each labelled."],
    rounding: ["Rolls to whole pupils"],
  },
  "GRP-S-TABLE": {
    sources: [MEMBERSHIP, CENSUS, RESULTS, "National ranks among every school in England with the figure that year"],
    geography: "Every current member school",
    years: "Roll: {census}. Results: each measure's latest published year ({resultsYear})",
    leftOut: ["None: a school without a figure shows the reason (IGCSE: not ranked at GCSE; prep: no KS2 published; outside England; no results published)"],
    steps: ["One row per current member school: its roll, size, shape by age, headline result for the phase in view, its rank within the group and nationally (ties share a place; IGCSE schools out at GCSE), value added where published, and its roll change over the last year.", "Each name opens the school's SMT dashboards, read-only, where head office has access and the school has its own VicData membership; otherwise its public page."],
    rounding: ["As published"],
  },
  "GRP-S-GROWING": {
    sources: [CENSUS],
    geography: "Every current member school, and the group",
    years: "{from} to {census}, each school indexed to its first year",
    leftOut: ["Schools without two census years"],
    steps: ["Each school's roll, indexed to 100 in its first census year; the group's like-for-like line beside them.", "The count is the schools whose roll rose over the last year."],
    rounding: ["Index to whole numbers"],
  },
  "GRP-S-SCATTER": {
    sources: [CENSUS, RESULTS],
    geography: "The group's schools with both figures",
    years: "Roll {census}; results {resultsYear}",
    leftOut: ["Schools without a published result", "IGCSE schools at GCSE"],
    steps: ["Each school is a dot: across, its pupils in the phase; up, its headline result.", "The school picked in the bar is highlighted."],
    rounding: ["None"],
  },
  "GRP-S-SHAPES": {
    sources: [CENSUS],
    geography: "Every current member school in England",
    years: "{census}",
    leftOut: ["Schools outside England"],
    steps: ["Each school's pupils by single year of age, with the shape VicData's classifier gives it (described, never ranked)."],
    rounding: ["None"],
  },
  "GRP-A-NOW": {
    sources: [MEMBERSHIP, RESULTS, "The comparison set: {setLabel}; England"],
    geography: "The group's schools in the phase in view; the comparison set and England beside them",
    years: "Each measure's latest published year ({resultsYear})",
    leftOut: ["IGCSE schools from every GCSE figure (listed, with the reason)", "Schools without a published result, listed with the reason"],
    steps: [READING, WEIGHTED, "The group's place in its peer band ranks it among groups of the same type and size band on the same figure, ties shared.", "The spread gives the group's lowest, middle (median) and highest school on the headline."],
    rounding: ["As published"],
  },
  "GRP-A-RANKED": {
    sources: [MEMBERSHIP, RESULTS, "National ranks among every school in England with the figure that year"],
    geography: "Every current member school in the phase in view",
    years: "The headline's latest published year ({resultsYear})",
    leftOut: ["IGCSE schools: 'not ranked at GCSE', never ranked", "Schools without a figure: listed with the reason"],
    steps: ["Each school's headline (Attainment 8, A-level points or KS2), its rank within the group (ties share a place) and its national rank.", "Beside them: the group's median school, the comparison set and non-group schools (pupil-weighted) and England."],
    rounding: ["As published"],
  },
  "GRP-A-AREAS": {
    sources: ["DfE KS4 and KS5 subject tables, by subject family (VicData's subject families)", MEMBERSHIP],
    geography: "The group's schools, against every school in England",
    years: "The latest year with subject results",
    leftOut: ["Areas where fewer than 2 schools each have 10 or more entries (the audit-fixes minimum): withheld", "IGCSE schools at GCSE"],
    steps: ["For each subject area, the group's average points per entry over its schools with 10 or more entries in it, and England's.", "The gap is the group's figure less England's; the two widest gaps each way are named as strengths and weaknesses.", "Described, not ranked; each area shows its schools and entries."],
    rounding: ["Points per entry to two decimal places"],
  },
  "GRP-A-VA": {
    sources: ["DfE performance tables: A-level value added and Progress 8", MEMBERSHIP],
    geography: "Every current member school with a sixth form (A level) or a GCSE phase (Progress 8)",
    years: "A-level VA to {resultsYear}; Progress 8's last published year",
    leftOut: ["Independent schools: Progress 8 not published", "Schools with no published value added that year"],
    steps: ["Each school's value added as DfE published it, and the group's, weighted by the pupils it covers.", "Value added has its own panel and never appears in a results chart."],
    rounding: ["Two decimal places, signed"],
  },
  "GRP-A-TREND": {
    sources: [MEMBERSHIP, RESULTS, "The comparison set: {setLabel}"],
    geography: "The group and {setLabel}, by phase",
    years: "Each measure's published years",
    leftOut: ["IGCSE schools from GCSE figures"],
    steps: [READING, WEIGHTED, "Each phase's headline over the years, the group against the comparison set."],
    rounding: ["As published"],
  },
  "GRP-A-POST16": {
    sources: [MEMBERSHIP, "DfE KS5 performance tables (A-level points per entry)", "The comparison set: {setLabel}"],
    geography: "The group's sixth forms and {setLabel}",
    years: "Each published year",
    leftOut: ["Schools without a sixth form"],
    steps: [READING, "A-level points per entry over the years, pupil-weighted by entries, the group against the comparison set."],
    rounding: ["Two decimal places"],
  },
  "GRP-A-IMPROVING": {
    sources: [RESULTS],
    geography: "Every current member school with the headline in both years",
    years: "From 2022/23 to the latest published year",
    leftOut: ["Schools without both years", "IGCSE schools at GCSE"],
    steps: ["Each school's headline in 2022/23 against its latest.", "Improved or fell when the change is larger than the steady margin (1 point for Attainment 8 and A-level points; 2 percentage points for KS2 and English and maths); steady otherwise."],
    rounding: ["None"],
  },
  "GRP-A-BANDS": {
    sources: ["Not built yet"],
    geography: "The group",
    years: "None yet",
    leftOut: ["The whole view: results by band arrive with the bands, as SMT's do"],
    steps: ["A labelled placeholder: no figure is drawn until the results-by-band data exists."],
    rounding: ["None"],
  },
  "GRP-P-NOW": {
    sources: [MEMBERSHIP, CENSUS],
    geography: "The group's schools in England",
    years: "The latest census, {census}, and the one before",
    leftOut: ["Schools outside England"],
    steps: [READING, "Roll by phase: pupils aged 5–10, 11–15 and 16–18.", "Year 12 against Year 11: pupils aged 16 this January against pupils aged 15 last January, over the schools with a sixth form both years (SMT round 2's wording).", "Day and boarding from the census's boarders."],
    rounding: ["Whole pupils; percentages to one decimal place"],
  },
  "GRP-P-SHAPE": {
    sources: [CENSUS],
    geography: "The group's schools in England, combined",
    years: "{census} against {from}",
    leftOut: ["Schools outside England"],
    steps: [READING, "The group's pupils by single year of age, this year as bars and the first year as a dashed line; described, never ranked."],
    rounding: ["Whole pupils"],
  },
  "GRP-P-ENTRIES": {
    sources: [CENSUS],
    geography: "Each current member school",
    years: "{from} to {census}",
    leftOut: ["Schools without two census years"],
    steps: ["Each school's main entry point is the age with the largest rise in pupils over the age below (Reception, Year 7, Year 12).", "Its pupils of that age each January, read-only."],
    rounding: ["Whole pupils"],
  },
  "GRP-P-LEAVING": {
    sources: [CENSUS],
    geography: "The group's schools with a sixth form",
    years: "{census} against the year before",
    leftOut: ["Schools without a sixth form both years"],
    steps: ["Year 12 against Year 11: each school's pupils aged 16 this January against its pupils aged 15 last January. Over 100%: more join Year 12 than its own Year 11 had."],
    rounding: ["One decimal place"],
  },
  "GRP-P-MARKET": {
    sources: [CENSUS],
    geography: "Each current member school and its own LA",
    years: "{census}",
    leftOut: ["Schools outside England"],
    steps: ["The default, labelled: each school's pupils in its main phase, as a share of all mainstream pupils of that phase in its LA.", "Admissions' rivals-based share is per school and stays in that school's own Admissions."],
    rounding: ["One decimal place"],
  },
  "GRP-P-ROLL": {
    sources: [MEMBERSHIP, CENSUS, "The comparison set: {setLabel}"],
    geography: "The group and {setLabel}",
    years: "{from} to {census}, indexed: {base}",
    leftOut: ["Schools outside England"],
    steps: [READING, "A like-for-like index: each year moves by that year's change over the schools with a roll in both years, starting at 100."],
    rounding: ["One decimal place"],
  },
  "GRP-P-PROJECTION": {
    sources: ["ONS small-area population estimates, and VicData's children-in-an-area projection (the area projection method, settings version 2)", "Each school's saved catchment (else its default by type)"],
    geography: "The area around each member school in England, at its own catchment",
    years: "The latest estimate to the projection's horizon",
    leftOut: ["Schools outside England, or without a location"],
    steps: ["For each school, the children of the school's own ages living in its catchment, now and projected.", "Shown per school, never added up: catchments overlap and the projection gives each area's total, so a sum would count a neighbourhood near two schools twice.", "Not a forecast of any school's roll."],
    rounding: ["Whole children; change to one decimal place"],
  },
  "GRP-P-GROWING": {
    sources: [CENSUS],
    geography: "Every current member school with both years",
    years: "{census} against the year before",
    leftOut: ["Schools without both years"],
    steps: ["Each school's roll this January against last: growing if it rose, shrinking if it fell."],
    rounding: ["None"],
  },
};

/** The group methods' fallbacks: what a placeholder reads when the host doesn't know it. */
export const GROUP_METHOD_FALLBACK: Record<string, string> = {
  membershipSources: "the group's source",
  asOf: "the latest check",
  census: "the latest census",
  resultsYear: "the latest published year",
  setLabel: "the comparison set",
  reading: "members at the time",
  from: "the first year held",
  base: "the first year every line shares",
};

const fill = (s: string, vars: Record<string, string | number | null | undefined>) =>
  s.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? (GROUP_METHOD_FALLBACK[k] ?? "as shown") : String(v);
  });

/** A group view's method with its placeholders filled from the lookups' metadata (null: not a group view). */
export function groupMethodOf(id: string, vars: Record<string, string | number | null | undefined>): ViewMethod | null {
  const m = METHODS_GROUPS[id];
  if (!m) return null;
  return { ...m, sources: m.sources.map((s) => fill(s, vars)), geography: fill(m.geography, vars), years: fill(m.years, vars), leftOut: m.leftOut.map((s) => fill(s, vars)), steps: m.steps.map((s) => fill(s, vars)), rounding: m.rounding.map((s) => fill(s, vars)) };
}
