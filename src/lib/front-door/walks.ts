// VicData 0.8 front door (B11-B12): the walks, as configuration. A walk is a short story, not a panel
// played out: an ordered list of existing dataview IDs, each with its question and answer template, in
// one rhythm for every walk -- this year, in context, over time, wider. Home tiles draw a walk's screens
// as their icon row (B9), so the two can't disagree (R-HOME-TILES). Kept as data so a later round can let
// the editor change them.
//
// A screen names the dataview it shows (its label and rail icon come from the catalogue, the one
// vocabulary: B14), the dashboard column and row it lives in (for the mini-map and "Show me"), the
// question it asks and the answer template the walk fills from real data (answers.ts). `options` say
// how the view is set (the pill): which measure, compared against what.
//
// Where a role's walk needs a view that doesn't exist yet, the screen is left out and listed in
// WALK_SCREENS_LEFT_OUT (logged in the report).
import { dataviewById } from "@/catalogue/dataviews";

export type WalkProduct = "gcse" | "post16" | "smt" | "smt_primary" | "admissions" | "group";
export type WalkRhythm = "this-year" | "in-context" | "over-time" | "wider";

/** Where a screen lives on its dashboard: the 3x2 grid's column and row (the mini-map, Show me). */
export type GridSpot = { col: 0 | 1 | 2; row: 0 | 1 };

export type WalkScreen = {
  /** The dataview it shows (catalogue ID), or a group view ID (the group dashboard's own vocabulary). */
  view: string;
  question: string;
  /** The answer template's key (answers.ts): one template per view. */
  answer: string;
  rhythm: WalkRhythm;
  spot: GridSpot;
  /** How the view is set: the pill's measure, what it's compared against. */
  options?: { measure?: "entries" | "points"; against?: "category" | "whole" | "nearest" };
};

export type Walk = {
  id: string;
  product: WalkProduct;
  /** The tile's and the walk header's question; [subject] and [phase] are filled from the focus. */
  question: string;
  /** The column icon the tile's badge draws (COLUMN_ICON_PATHS for Teacher; a product glyph otherwise). */
  icon: string;
  /** The tile's small label above the figure ("Candidates · Context"). */
  label: string;
  /** "Dashboard" or "Group dashboard": the tile's second line, for the role homes. */
  kind?: string;
  /** The full dashboard this walk teaches (Show me, the end screen). */
  dashboard: string;
  screens: WalkScreen[];
};

// ------------------------------------------------------------------------------------------------ Teacher

const teacherWalks = (product: "gcse" | "post16"): Walk[] => {
  const phase = product === "gcse" ? "ks4" : "ks5";
  const p16 = product === "post16";
  const dash = `/teacher/${phase}`;
  return [
    {
      id: `${product}-many`,
      product,
      question: p16 ? "How many students take [subject] A level?" : "How many pupils take [subject]?",
      icon: "candidates",
      label: "Candidates · Context",
      dashboard: dash,
      screens: [
        { view: "DV-C1-CAND-CUR-TILES", question: p16 ? "How many took [subject] this year?" : "How many took [subject] this year?", answer: "entries-tiles", rhythm: "this-year", spot: { col: 0, row: 0 } },
        { view: "DV-C2-CUR-BARS", question: "How does it compare with the other subjects in [category]?", answer: "entries-category", rhythm: "in-context", spot: { col: 1, row: 0 }, options: { measure: "entries", against: "category" } },
        { view: "DV-C2-CUR-BARS", question: "And across the whole school?", answer: "entries-whole", rhythm: "in-context", spot: { col: 1, row: 0 }, options: { measure: "entries", against: "whole" } },
        { view: "DV-C1-CAND-TR-ACTUAL", question: "Has that gone up or down?", answer: "entries-trend", rhythm: "over-time", spot: { col: 0, row: 1 }, options: { measure: "entries", against: "category" } },
        { view: "DV-C2-TR-DUMBBELL", question: "Has it grown more than other subjects?", answer: "entries-dumbbell", rhythm: "over-time", spot: { col: 1, row: 1 }, options: { measure: "entries", against: "whole" } },
        { view: "DV-C1-CAND-TR-GEO-CHART", question: "Is the same thing happening nearby and nationally?", answer: "entries-area", rhythm: "wider", spot: { col: 0, row: 1 }, options: { measure: "entries", against: "nearest" } },
      ],
    },
    {
      id: `${product}-well`,
      product,
      question: "How well did they do?",
      icon: "results",
      label: "Results",
      dashboard: dash,
      screens: [
        { view: "DV-C1-RES-CUR-TILES", question: "What did they get this year?", answer: "points-tiles", rhythm: "this-year", spot: { col: 0, row: 0 }, options: { measure: "points" } },
        { view: "DV-C1-RES-CUR-GRADES", question: "How were the grades spread?", answer: "grades-spread", rhythm: "this-year", spot: { col: 0, row: 0 }, options: { measure: "points" } },
        { view: "DV-C2-CUR-BARS", question: "How does it compare with the other subjects in [category]?", answer: "points-category", rhythm: "in-context", spot: { col: 1, row: 0 }, options: { measure: "points", against: "category" } },
        { view: "DV-C2-CUR-BARS", question: "And across the whole school?", answer: "points-whole", rhythm: "in-context", spot: { col: 1, row: 0 }, options: { measure: "points", against: "whole" } },
        { view: "DV-C1-RES-TR-CHART", question: "Are results going up or down?", answer: "points-trend", rhythm: "over-time", spot: { col: 0, row: 1 }, options: { measure: "points" } },
        { view: "DV-C1-RES-TR-GEO-CHART", question: "Is the same thing happening nearby and nationally?", answer: "points-area", rhythm: "wider", spot: { col: 0, row: 1 }, options: { measure: "points", against: "nearest" } },
      ],
    },
    {
      id: `${product}-nearby`,
      product,
      question: p16 ? "How do we compare with sixth forms nearby?" : "How do we compare with schools nearby?",
      icon: "rankings",
      label: "Comparisons",
      dashboard: dash,
      screens: [
        { view: "DV-C3-CUR-MAP", question: p16 ? "Which sixth forms are nearby?" : "Which schools are nearby?", answer: "nearby-map", rhythm: "this-year", spot: { col: 2, row: 0 }, options: { against: "nearest" } },
        { view: "DV-C3-CUR-BAR", question: "How many take it at each?", answer: "nearby-entries", rhythm: "in-context", spot: { col: 2, row: 0 }, options: { measure: "entries", against: "nearest" } },
        { view: "DV-C3-CUR-BAR", question: "How did they do at each?", answer: "nearby-points", rhythm: "in-context", spot: { col: 2, row: 0 }, options: { measure: "points", against: "nearest" } },
        { view: "DV-C3-CUR-RANKING", question: "Where do we rank?", answer: "nearby-rank", rhythm: "in-context", spot: { col: 2, row: 0 }, options: { measure: "points", against: "nearest" } },
        { view: "DV-C3-TR-CHART", question: "Has our position changed?", answer: "nearby-trend", rhythm: "over-time", spot: { col: 2, row: 1 }, options: { measure: "points", against: "nearest" } },
      ],
    },
  ];
};

// ------------------------------------------------------------------------------------------------ SMT

const SMT_O = "/teacher/smt";
const smtWalks = (primary: boolean): Walk[] => {
  const product: WalkProduct = primary ? "smt_primary" : "smt";
  return [
    {
      id: `${product}-overview`,
      product,
      question: "How is the school doing?",
      icon: "TableIcon",
      label: "Overview",
      kind: "Dashboard",
      dashboard: SMT_O,
      screens: [
        { view: "DV-SMT-O-NOW", question: "Where does the school stand this year?", answer: "smt-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
        { view: "DV-SMT-O-SCORECARD", question: "How does it compare, headline by headline?", answer: "smt-scorecard", rhythm: "in-context", spot: { col: 1, row: 0 } },
        { view: "DV-SMT-O-ROLL-LINE", question: "Has the roll grown or shrunk?", answer: "smt-roll-trend", rhythm: "over-time", spot: { col: 0, row: 1 } },
        { view: "DV-SMT-O-RESULTS-LINE", question: "Are headline results going up or down?", answer: "smt-results-trend", rhythm: "over-time", spot: { col: 1, row: 1 } },
        { view: "DV-SMT-O-MARKET-LINE", question: "Are we winning more of the pupils around us?", answer: "smt-market", rhythm: "wider", spot: { col: 2, row: 1 } },
        { view: "DV-SMT-O-FLAGS", question: "What has changed a lot, and stayed changed?", answer: "smt-flags", rhythm: "wider", spot: { col: 2, row: 0 } },
      ],
    },
    {
      id: `${product}-academic`,
      product,
      question: primary ? "How did Year 6 do in reading, writing and maths?" : "Which subjects are strong, and which need attention?",
      icon: "HorizontalBarsIcon",
      label: "Academic",
      kind: "Dashboard",
      dashboard: `${SMT_O}/academic`,
      // A primary school's Academic walk needs KS2 views SMT Academic doesn't have yet: the card says so.
      screens: primary
        ? []
        : [
            { view: "DV-SMT-A-NOW", question: "How did the school do this year?", answer: "smt-academic-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
            { view: "DV-SMT-A-CHART", question: "How does that compare with the set?", answer: "smt-academic-chart", rhythm: "in-context", spot: { col: 1, row: 0 } },
            { view: "DV-SMT-A-AREAS", question: "Which subject areas lead, and which trail?", answer: "smt-academic-areas", rhythm: "in-context", spot: { col: 1, row: 0 } },
            { view: "DV-SMT-A-GRADES", question: "How were the grades spread?", answer: "smt-academic-grades", rhythm: "in-context", spot: { col: 1, row: 0 } },
            { view: "DV-SMT-A-TREND-LINE", question: "Are results going up or down?", answer: "smt-academic-trend", rhythm: "over-time", spot: { col: 0, row: 1 } },
            { view: "DV-SMT-A-LINES", question: "What moved most since last year?", answer: "smt-academic-lines", rhythm: "wider", spot: { col: 1, row: 1 } },
          ],
    },
    {
      id: `${product}-pupils`,
      product,
      question: primary ? "Are we filling our Reception places?" : "Who are our pupils, and are numbers holding up?",
      icon: "AdmRollIcon",
      label: "Pupils",
      kind: "Dashboard",
      dashboard: `${SMT_O}/pupils`,
      screens: [
        { view: "DV-SMT-P-NOW", question: "How many pupils do we have this year?", answer: "smt-pupils-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
        { view: "DV-SMT-P-SHAPE", question: "How big is each year group?", answer: "smt-pupils-shape", rhythm: "in-context", spot: { col: 1, row: 0 } },
        { view: "DV-SMT-P-ENTRIES", question: "How many could join at each entry point?", answer: "smt-pupils-entries", rhythm: "in-context", spot: { col: 1, row: 0 } },
        ...(primary ? [] : [{ view: "DV-SMT-P-LEAVING", question: "How many leave at 16?", answer: "smt-pupils-leaving", rhythm: "over-time" as const, spot: { col: 1, row: 0 } as GridSpot }]),
        { view: "DV-SMT-P-PHASES", question: "Has each phase grown or shrunk?", answer: "smt-pupils-phases", rhythm: "over-time", spot: { col: 0, row: 1 } },
        { view: "DV-SMT-P-AREA", question: "Is the area's school-age population changing?", answer: "smt-pupils-area", rhythm: "wider", spot: { col: 1, row: 1 } },
      ],
    },
    {
      id: `${product}-context`,
      product,
      question: primary ? "How many children are being born near us?" : "What is happening in the area around us?",
      icon: "MapPinIcon",
      label: "Context",
      kind: "Dashboard",
      dashboard: `${SMT_O}/context`,
      screens: [
        { view: "DV-SMT-C-NOW", question: "What is the area like now?", answer: "smt-context-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
        { view: "DV-SMT-C-MAP", question: "Where do the children live?", answer: "smt-context-map", rhythm: "in-context", spot: { col: 1, row: 0 } },
        { view: "DV-SMT-C-BYAGE", question: "How old are they?", answer: "smt-context-byage", rhythm: "in-context", spot: { col: 1, row: 0 } },
        { view: "DV-SMT-C-BIRTHS", question: "How many children are being born nearby?", answer: "smt-context-births", rhythm: "over-time", spot: { col: 0, row: 1 } },
        { view: "DV-SMT-C-NEARBY", question: "And over the next few years?", answer: "smt-context-nearby", rhythm: "wider", spot: { col: 1, row: 1 } },
      ],
    },
  ];
};

// ------------------------------------------------------------------------------------------------ Admissions

const admissionsWalks: Walk[] = [
  {
    id: "admissions-pipeline",
    product: "admissions",
    question: "How many children could join us at [entry]?",
    icon: "AdmPipelineIcon",
    label: "Pipelines",
    kind: "Dashboard",
    dashboard: "/teacher/admissions",
    screens: [
      { view: "DV-ADM-P-NOW", question: "How many children are in the [entry] pool this year?", answer: "adm-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
      { view: "DV-ADM-P-PIPELINE", question: "How many will reach [entry], year by year?", answer: "adm-pipeline", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "DV-ADM-P-MAP", question: "Where do they come from?", answer: "adm-feeders-map", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "DV-ADM-P-POOL-INDEXED", question: "Is the pool growing or shrinking?", answer: "adm-pool-trend", rhythm: "over-time", spot: { col: 0, row: 1 } },
      { view: "DV-ADM-P-ENTRY-LINE", question: "And our own cohort?", answer: "adm-cohort", rhythm: "wider", spot: { col: 1, row: 1 } },
    ],
  },
  {
    id: "admissions-market",
    product: "admissions",
    question: "What share of them do we win, and against whom?",
    icon: "DonutIcon",
    label: "Market share",
    kind: "Dashboard",
    dashboard: "/teacher/admissions?dash=market-share",
    screens: [
      { view: "DV-ADM-M-NOW", question: "What share of the pool joined us this year?", answer: "adm-share-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
      { view: "DV-ADM-M-BARS", question: "How does that compare with our rivals?", answer: "adm-share-rivals", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "DV-ADM-M-MAP", question: "Where are our rivals?", answer: "adm-rivals-map", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "DV-ADM-M-MOMENTUM", question: "Who is gaining, and who is losing?", answer: "adm-momentum", rhythm: "over-time", spot: { col: 1, row: 0 } },
      { view: "DV-ADM-M-SHARE-LINE", question: "Has our share changed over time?", answer: "adm-share-trend", rhythm: "over-time", spot: { col: 0, row: 1 } },
      { view: "DV-ADM-M-ACAD-RANK", question: "And how do our results compare?", answer: "adm-academic", rhythm: "wider", spot: { col: 1, row: 1 } },
    ],
  },
];

// ------------------------------------------------------------------------------------------------ head office

const GRP = "/teacher/group";
const groupWalks: Walk[] = [
  {
    id: "group-overview",
    product: "group",
    question: "How is the group doing, and against whom?",
    icon: "TilesIcon",
    label: "Overview",
    kind: "Group dashboard",
    dashboard: `${GRP}/overview`,
    screens: [
      { view: "GRP-O-NOW", question: "Where does the group stand this year?", answer: "grp-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
      { view: "GRP-O-AGAINST", question: "How does it compare with other groups?", answer: "grp-against", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "GRP-O-MAP", question: "Where are our schools?", answer: "grp-map", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "GRP-O-ROLL", question: "Has the combined roll grown?", answer: "grp-roll", rhythm: "over-time", spot: { col: 0, row: 1 } },
      { view: "GRP-O-RESULTS", question: "Are results going up or down?", answer: "grp-results", rhythm: "over-time", spot: { col: 1, row: 1 } },
      { view: "GRP-O-SHARE", question: "What share of places do we hold?", answer: "grp-share", rhythm: "wider", spot: { col: 2, row: 1 } },
    ],
  },
  {
    id: "group-schools",
    product: "group",
    question: "Which of our schools are growing, and which are not?",
    icon: "SchoolIcon",
    label: "Schools",
    kind: "Group dashboard",
    dashboard: `${GRP}/schools`,
    screens: [
      { view: "GRP-S-NOW", question: "How many schools, and how many pupils?", answer: "grp-schools-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
      { view: "GRP-S-TABLE", question: "How do the schools compare?", answer: "grp-schools-table", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "GRP-S-GROWING", question: "Which are growing?", answer: "grp-schools-growing", rhythm: "over-time", spot: { col: 0, row: 1 } },
      { view: "GRP-S-SCATTER", question: "Do the bigger schools do better?", answer: "grp-schools-scatter", rhythm: "wider", spot: { col: 1, row: 1 } },
      { view: "GRP-S-SHAPES", question: "What shape is each school?", answer: "grp-schools-shapes", rhythm: "wider", spot: { col: 2, row: 1 } },
    ],
  },
  {
    id: "group-academic",
    product: "group",
    question: "How do results compare across our schools?",
    icon: "RankListIcon",
    label: "Academic",
    kind: "Group dashboard",
    dashboard: `${GRP}/academic`,
    screens: [
      { view: "GRP-A-NOW", question: "What did the group get this year?", answer: "grp-academic-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
      { view: "GRP-A-RANKED", question: "How do our schools rank?", answer: "grp-academic-ranked", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "GRP-A-AREAS", question: "Which subject areas lead?", answer: "grp-academic-areas", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "GRP-A-TREND", question: "Are results going up or down?", answer: "grp-academic-trend", rhythm: "over-time", spot: { col: 0, row: 1 } },
      { view: "GRP-A-IMPROVING", question: "Which schools are improving?", answer: "grp-academic-improving", rhythm: "wider", spot: { col: 1, row: 1 } },
    ],
  },
  {
    id: "group-pupils",
    product: "group",
    question: "Are pupil numbers holding up across the group?",
    icon: "AdmRollIcon",
    label: "Pupils",
    kind: "Group dashboard",
    dashboard: `${GRP}/pupils`,
    screens: [
      { view: "GRP-P-NOW", question: "How many pupils does the group have?", answer: "grp-pupils-now", rhythm: "this-year", spot: { col: 0, row: 0 } },
      { view: "GRP-P-SHAPE", question: "What shape is the group?", answer: "grp-pupils-shape", rhythm: "in-context", spot: { col: 1, row: 0 } },
      { view: "GRP-P-ROLL", question: "Has the roll grown or shrunk?", answer: "grp-pupils-roll", rhythm: "over-time", spot: { col: 0, row: 1 } },
      { view: "GRP-P-GROWING", question: "Which schools are growing and shrinking?", answer: "grp-pupils-growing", rhythm: "over-time", spot: { col: 1, row: 1 } },
      { view: "GRP-P-PROJECTION", question: "How many children live around the schools?", answer: "grp-pupils-projection", rhythm: "wider", spot: { col: 2, row: 1 } },
    ],
  },
];

/** Which group dashboard a group view's walk screen draws from (its ID's letter: O, S, A, P). */
export function groupWalkDash(view: string): "overview" | "schools" | "academic" | "pupils" {
  return ({ O: "overview", S: "schools", A: "academic", P: "pupils" } as const)[view.charAt(4) as "O" | "S" | "A" | "P"] ?? "overview";
}

/** The group dashboard's own view names and rail icons (GROUP_VIEWS in GroupDashboard.tsx, read there;
 * copied here because that file is a client component; a unit test keeps the two equal). */
export const GROUP_VIEW_META: Record<string, { label: string; icon: string }> = {
  "GRP-O-NOW": { label: "The group now", icon: "TilesIcon" },
  "GRP-O-AGAINST": { label: "Against others", icon: "TableIcon" },
  "GRP-O-MAP": { label: "Map", icon: "MapPinIcon" },
  "GRP-O-ROLL": { label: "Combined roll, indexed", icon: "IndexedLineIcon" },
  "GRP-O-RESULTS": { label: "Results by phase", icon: "TrendLineIcon" },
  "GRP-O-SHARE": { label: "Share of places", icon: "HorizontalBarsIcon" },
  "GRP-S-NOW": { label: "The group now", icon: "TilesIcon" },
  "GRP-S-TABLE": { label: "Schools", icon: "TableIcon" },
  "GRP-S-GROWING": { label: "Who is growing", icon: "TrendLineIcon" },
  "GRP-S-SCATTER": { label: "Size and results", icon: "AdmScatterIcon" },
  "GRP-S-SHAPES": { label: "Shapes", icon: "AdmShapeIcon" },
  "GRP-A-NOW": { label: "Results now", icon: "TilesIcon" },
  "GRP-A-RANKED": { label: "Schools ranked", icon: "RankListIcon" },
  "GRP-A-AREAS": { label: "Subject areas", icon: "AdmStrengthsIcon" },
  "GRP-A-TREND": { label: "Results trend", icon: "TrendLineIcon" },
  "GRP-A-IMPROVING": { label: "Improving and declining", icon: "VerticalBarsIcon" },
  "GRP-P-NOW": { label: "Pupils now", icon: "TilesIcon" },
  "GRP-P-SHAPE": { label: "The group's shape", icon: "AdmShapeIcon" },
  "GRP-P-ROLL": { label: "Roll, indexed", icon: "IndexedLineIcon" },
  "GRP-P-GROWING": { label: "Growing and shrinking", icon: "VerticalBarsIcon" },
  "GRP-P-PROJECTION": { label: "Children around the schools", icon: "AdmPopulationIcon" },
};

export const WALKS: Walk[] = [...teacherWalks("gcse"), ...teacherWalks("post16"), ...smtWalks(false), ...smtWalks(true), ...admissionsWalks, ...groupWalks];

export function walkById(id: string): Walk | undefined {
  return WALKS.find((w) => w.id === id);
}

export function walksFor(product: WalkProduct): Walk[] {
  return WALKS.filter((w) => w.product === product);
}

/** A screen's name and rail icon, from the catalogue (B14: same names, same icons as the dashboard). */
export function screenMeta(view: string): { label: string; icon: string } | null {
  if (view.startsWith("GRP-")) return GROUP_VIEW_META[view] ?? null;
  const dv = dataviewById(view);
  return dv ? { label: dv.label, icon: dv.railIcon } : null;
}

/** Screens left out because their view doesn't exist yet (B12): logged in the report. */
export const WALK_SCREENS_LEFT_OUT: { walk: string; screen: string; why: string }[] = [
  { walk: "smt_primary-academic", screen: "every screen (Year 6 results, by subject, over time)", why: "SMT Academic has no KS2 views yet: the card says so in its own space." },
  { walk: "smt_primary-pupils", screen: "Reception places filled (offers against places)", why: "No view holds Reception places or offers; the walk uses the year groups and the 4+ entry point instead." },
  { walk: "smt-pupils / smt_primary-pupils", screen: "Leaving at 16 (primary only)", why: "A primary school has no Year 11: left out of the primary walk." },
  { walk: "group-academic", screen: "Post-16 trend, Value added", why: "Shown on the group dashboard by phase; one Results trend keeps the walk to five screens." },
];

/** Fill a walk's or screen's template from the focus ("[subject]", "[category]", "[entry]"). */
export function fillTemplate(t: string, ctx: { subject?: string | null; category?: string | null; entry?: string | null }): string {
  return t
    .replace(/\[subject\]/g, ctx.subject ?? "your subject")
    .replace(/\[category\]/g, ctx.category ?? "its area")
    .replace(/\[entry\]/g, ctx.entry ?? "your entry point");
}
