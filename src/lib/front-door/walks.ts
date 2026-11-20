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
import { teacherDashboardFor } from "@/catalogue/dashboards/teacher";
import { SMT_DASHBOARDS } from "@/catalogue/dashboards/smt";
import { ADMISSIONS_DASHBOARDS } from "@/catalogue/dashboards/admissions";
import type { DashboardConfig } from "@/catalogue/types";
import { GROUP_LAYOUT_IDS } from "@/lib/groups/dash-layout";

export type WalkProduct = "gcse" | "post16" | "smt" | "smt_primary" | "admissions" | "group";
export type WalkRhythm = "this-year" | "in-context" | "over-time" | "wider";

/** Where a screen lives on its dashboard: the 3x2 grid's column and row (the mini-map, Show me), how
 * many columns its panel spans and the panel's name. Review fixes (14 Nov, M1): worked out from the
 * dashboard's own config (spotOf), never written by hand -- nine were wrong. */
export type GridSpot = { col: 0 | 1 | 2; row: 0 | 1; span: 1 | 2; panel: string };

export type WalkScreen = {
  /** The dataview it shows (catalogue ID), or a group view ID (the group dashboard's own vocabulary). */
  view: string;
  question: string;
  /** The answer template's key (answers.ts): one template per view. */
  answer: string;
  rhythm: WalkRhythm;
  /** Filled from the dashboard's config when the walks are built (spotOf). */
  spot: GridSpot;
  /** How the view is set: the pill's measure, what it's compared against. */
  options?: { measure?: "entries" | "points"; against?: "category" | "whole" | "nearest" };
  /** A screen borrowed from another role's dashboard (Leighton Park prep, 20 Nov: SMT Pupils ends on Admissions'
   * Share needed); its spot comes from that dashboard. "admissions": the Pipelines dashboard. */
  from?: "admissions";
};

/** A screen as written below: its spot comes from the dashboard's config. */
type AuthoredScreen = Omit<WalkScreen, "spot">;
type AuthoredWalk = Omit<Walk, "screens"> & { screens: AuthoredScreen[] };

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
  /**
   * 0.8 feedback B1 (G1, R-WALK-ENDS-ON-ANSWER): what the walk's last window ("Here's what you found") draws to
   * answer the walk's own question -- a ranking, chart or table, never the summary alone. `view`: a screen's
   * view (drawn again, large, with its answer), or a view drawn only there (SMT Academic's subjects ranked).
   * `kind` says which sort of data view it is. A walk with no screens has none.
   */
  answer?: WalkAnswer;
  /** 0.8 feedback B4 (Admissions 8): the walk starts with the school -- its second screen is the school's own
   * figures over time, outside the rhythm; the rhythm runs from the third. */
  schoolFirst?: true;
};

export type WalkAnswer = { kind: "ranking" | "chart" | "table"; view: string };

/** The screen a walk's answer draws again (its index), or -1 for a view drawn only on the last window. */
export function answerStep(walk: Pick<Walk, "screens" | "answer">): number {
  return walk.answer ? walk.screens.findIndex((s) => s.view === walk.answer!.view) : -1;
}

/** SMT Academic's answer: every subject the school teaches, strongest to weakest against the set, with those
 * needing attention marked (SMT 7). Drawn from DV-SMT-A-AREAS's own figures (smt-subject-ranking.ts). */
export const SMT_SUBJECTS_RANKED = "SMT-A-SUBJECTS-RANKED";

// ------------------------------------------------------------------------------------------------ Teacher

const teacherWalks = (product: "gcse" | "post16"): AuthoredWalk[] => {
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
      // How many: the entries year by year, the subject against its area (a chart).
      answer: { kind: "chart", view: "DV-C1-CAND-TR-ACTUAL" },
      screens: [
        { view: "DV-C1-CAND-CUR-TILES", question: "How many took [subject] this year?", answer: "entries-tiles", rhythm: "this-year" },
        { view: "DV-C2-CUR-BARS", question: "How does it compare with the other subjects in [category]?", answer: "entries-category", rhythm: "in-context", options: { measure: "entries", against: "category" } },
        { view: "DV-C2-CUR-BARS", question: "And across the whole school?", answer: "entries-whole", rhythm: "in-context", options: { measure: "entries", against: "whole" } },
        { view: "DV-C1-CAND-TR-ACTUAL", question: "Has that gone up or down?", answer: "entries-trend", rhythm: "over-time", options: { measure: "entries", against: "category" } },
        { view: "DV-C2-TR-DUMBBELL", question: "Has it grown more than other subjects?", answer: "entries-dumbbell", rhythm: "over-time", options: { measure: "entries", against: "whole" } },
        { view: "DV-C1-CAND-TR-GEO-CHART", question: "Is the same thing happening nearby and nationally?", answer: "entries-area", rhythm: "wider", options: { measure: "entries", against: "nearest" } },
      ],
    },
    {
      id: `${product}-well`,
      product,
      question: "How well did they do in [subject]?",
      icon: "results",
      label: "Results",
      dashboard: dash,
      // How well: average points year by year, against England (a chart).
      answer: { kind: "chart", view: "DV-C1-RES-TR-CHART" },
      screens: [
        { view: "DV-C1-RES-CUR-TILES", question: "What did they get this year?", answer: "points-tiles", rhythm: "this-year", options: { measure: "points" } },
        { view: "DV-C1-RES-CUR-GRADES", question: "How were the grades spread?", answer: "grades-spread", rhythm: "this-year", options: { measure: "points" } },
        { view: "DV-C2-CUR-BARS", question: "How does it compare with the other subjects in [category]?", answer: "points-category", rhythm: "in-context", options: { measure: "points", against: "category" } },
        { view: "DV-C2-CUR-BARS", question: "And across the whole school?", answer: "points-whole", rhythm: "in-context", options: { measure: "points", against: "whole" } },
        { view: "DV-C1-RES-TR-CHART", question: "Are results going up or down?", answer: "points-trend", rhythm: "over-time", options: { measure: "points" } },
        { view: "DV-C1-RES-TR-GEO-CHART", question: "Is the same thing happening nearby and nationally?", answer: "points-area", rhythm: "wider", options: { measure: "points", against: "nearest" } },
      ],
    },
    {
      id: `${product}-nearby`,
      product,
      question: p16 ? "How do we compare with sixth forms nearby?" : "How do we compare with schools nearby?",
      icon: "rankings",
      label: "Comparisons",
      dashboard: dash,
      // How we compare: the nearby schools ranked (a ranking; its counts where too few have a figure).
      answer: { kind: "ranking", view: "DV-C3-CUR-RANKING" },
      screens: [
        { view: "DV-C3-CUR-MAP", question: p16 ? "Which sixth forms are nearby?" : "Which schools are nearby?", answer: "nearby-map", rhythm: "this-year", options: { against: "nearest" } },
        { view: "DV-C3-CUR-BAR", question: "How many take it at each school?", answer: "nearby-entries", rhythm: "in-context", options: { measure: "entries", against: "nearest" } },
        { view: "DV-C3-CUR-BAR", question: "How did they do at each school?", answer: "nearby-points", rhythm: "in-context", options: { measure: "points", against: "nearest" } },
        { view: "DV-C3-CUR-RANKING", question: "Where do we rank?", answer: "nearby-rank", rhythm: "in-context", options: { measure: "points", against: "nearest" } },
        { view: "DV-C3-TR-RANK", question: "Has our position changed?", answer: "nearby-trend", rhythm: "over-time", options: { measure: "points", against: "nearest" } },
      ],
    },
  ];
};

// ------------------------------------------------------------------------------------------------ SMT

const SMT_O = "/teacher/smt";
const smtWalks = (primary: boolean): AuthoredWalk[] => {
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
      // How is the school doing: headline by headline against the set (a table).
      answer: { kind: "table", view: "DV-SMT-O-SCORECARD" },
      screens: [
        { view: "DV-SMT-O-NOW", question: "Where does the school stand this year?", answer: "smt-now", rhythm: "this-year" },
        { view: "DV-SMT-O-SCORECARD", question: "How does it compare, headline by headline?", answer: "smt-scorecard", rhythm: "in-context" },
        { view: "DV-SMT-O-ROLL-LINE", question: "Has the roll grown or shrunk?", answer: "smt-roll-trend", rhythm: "over-time" },
        { view: "DV-SMT-O-RESULTS-LINE", question: "Are headline results going up or down?", answer: "smt-results-trend", rhythm: "over-time" },
        { view: "DV-SMT-O-MARKET-LINE", question: "Are we winning more of the pupils around us?", answer: "smt-market", rhythm: "wider" },
        { view: "DV-SMT-O-FLAGS", question: "What has changed a lot, and for good?", answer: "smt-flags", rhythm: "wider" },
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
      // SMT 7: every subject, strongest to weakest, those needing attention marked (a ranking).
      ...(primary ? {} : { answer: { kind: "ranking" as const, view: SMT_SUBJECTS_RANKED } }),
      // A primary school's Academic walk needs KS2 views SMT Academic doesn't have yet: the card says so.
      screens: primary
        ? []
        : [
            { view: "DV-SMT-A-NOW", question: "How did the school do this year?", answer: "smt-academic-now", rhythm: "this-year" },
            { view: "DV-SMT-A-CHART", question: "How does that compare with the set?", answer: "smt-academic-chart", rhythm: "in-context" },
            { view: "DV-SMT-A-AREAS", question: "Which subject areas lead, and which trail?", answer: "smt-academic-areas", rhythm: "in-context" },
            { view: "DV-SMT-A-GRADES", question: "How were the grades spread?", answer: "smt-academic-grades", rhythm: "in-context" },
            { view: "DV-SMT-A-TREND-LINE", question: "Are results going up or down?", answer: "smt-academic-trend", rhythm: "over-time" },
            { view: "DV-SMT-A-LINES", question: "What moved most since last year?", answer: "smt-academic-lines", rhythm: "wider" },
          ],
    },
    // Leighton Park prep (20 Nov): the GCSE and Post-16 tabs' first walk -- the level's entries (SMT Academic's
    // Entries views, read in its entries mode at the tab's level). Secondary schools only; the home shows it on the
    // phase tabs, never on the whole school.
    ...(primary
      ? []
      : [
          {
            id: `${product}-entries`,
            product,
            question: "How many entries, and in which subjects?",
            icon: "VerticalBarsIcon",
            label: "Entries",
            kind: "Dashboard",
            dashboard: `${SMT_O}/academic`,
            // Which subjects: each subject's entries, first year to latest (a chart).
            answer: { kind: "chart" as const, view: "DV-SMT-A-DUMBBELL" },
            screens: [
              { view: "DV-SMT-A-NOW", question: "How many entries this year?", answer: "smt-entries-now", rhythm: "this-year" as const },
              { view: "DV-SMT-A-MIX", question: "Which qualifications are they in?", answer: "smt-entries-mix", rhythm: "in-context" as const },
              { view: "DV-SMT-A-DUMBBELL", question: "Which subjects have grown or shrunk?", answer: "smt-entries-subjects", rhythm: "over-time" as const },
              { view: "DV-SMT-A-MOVES", question: "What moved most?", answer: "smt-entries-moves", rhythm: "over-time" as const },
              { view: "DV-SMT-A-AGAINST", question: "How does our mix differ from the set's?", answer: "smt-entries-against", rhythm: "wider" as const },
            ],
          },
        ]),
    // Leighton Park prep (20 Nov): Context comes before Pupils -- the area first, then whether our numbers hold up in it.
    {
      id: `${product}-context`,
      product,
      question: primary ? "How many children are being born near us?" : "What is happening in the area around us?",
      icon: "MapPinIcon",
      label: "Context",
      kind: "Dashboard",
      dashboard: `${SMT_O}/context`,
      // What is happening around us: the children nearby, year by year and projected (a chart).
      answer: { kind: "chart", view: "DV-SMT-C-NEARBY" },
      screens: [
        { view: "DV-SMT-C-NOW", question: "What is the area like now?", answer: "smt-context-now", rhythm: "this-year" },
        { view: "DV-SMT-C-MAP", question: "Where do the children live?", answer: "smt-context-map", rhythm: "in-context" },
        { view: "DV-SMT-C-BYAGE", question: "How old are they?", answer: "smt-context-byage", rhythm: "in-context" },
        { view: "DV-SMT-C-BIRTHS", question: "How many children are being born nearby?", answer: "smt-context-births", rhythm: "over-time" },
        { view: "DV-SMT-C-NEARBY", question: "And over the next few years?", answer: "smt-context-nearby", rhythm: "wider" },
      ],
    },
    {
      id: `${product}-pupils`,
      product,
      // Review fixes (24): no screen answers "Are we filling our Reception places?" (no view holds places
      // or offers), so the primary walk asks what its screens answer.
      question: primary ? "Who are our pupils, and are numbers holding up from Reception?" : "Who are our pupils, and are numbers holding up?",
      // Crosscheck (14 Nov, home_smt.png / home_group.png): the Pupils badge is the year-groups stack.
      icon: "AdmShapeIcon",
      label: "Pupils",
      kind: "Dashboard",
      dashboard: `${SMT_O}/pupils`,
      // Are numbers holding up: each phase's roll, year by year (a chart); a secondary school's walk ends on the
      // share of the pool needed to hold numbers steady (Leighton Park prep, 20 Nov: Admissions' Pipelines).
      answer: { kind: "chart", view: primary ? "DV-SMT-P-PHASES" : "DV-ADM-P-HOLD-LINE" },
      screens: [
        { view: "DV-SMT-P-NOW", question: "How many pupils do we have this year?", answer: "smt-pupils-now", rhythm: "this-year" },
        { view: "DV-SMT-P-SHAPE", question: "How big is each year group?", answer: "smt-pupils-shape", rhythm: "in-context" },
        // 0.8 feedback B5 (D6, SMT 9): Entry points leave the secondary walk ("who is the pool?" -- Admissions
        // answers it); they stay on the SMT Pupils dashboard, and on a primary school's walk (its 4+ entry).
        ...(primary ? [{ view: "DV-SMT-P-ENTRIES", question: "How many could join at each entry point?", answer: "smt-pupils-entries", rhythm: "in-context" as const }] : []),
        ...(primary ? [] : [{ view: "DV-SMT-P-LEAVING", question: "How many leave at 16?", answer: "smt-pupils-leaving", rhythm: "over-time" as const }]),
        { view: "DV-SMT-P-PHASES", question: "Has each phase grown or shrunk?", answer: "smt-pupils-phases", rhythm: "over-time" },
        { view: "DV-SMT-P-AREA", question: "Is the area's school-age population changing?", answer: "smt-pupils-area", rhythm: "wider" },
        ...(primary ? [] : [{ view: "DV-ADM-P-HOLD-LINE", question: "What share of the [entry] pool must we win to hold our numbers?", answer: "adm-hold", rhythm: "wider" as const, from: "admissions" as const }]),
      ],
    },
  ];
};

// ------------------------------------------------------------------------------------------------ Admissions

const admissionsWalks: AuthoredWalk[] = [
  {
    id: "admissions-pipeline",
    product: "admissions",
    question: "How many children could join us at [entry]?",
    icon: "AdmPipelineIcon",
    label: "Pipelines",
    kind: "Dashboard",
    dashboard: "/teacher/admissions",
    // How many could join: the pool reaching the entry point, year by year (a chart).
    answer: { kind: "chart", view: "DV-ADM-P-PIPELINE" },
    // 0.8 feedback B4 (Admissions 8): the school first, then outwards -- its own cohort second, then the pool.
    schoolFirst: true,
    screens: [
      { view: "DV-ADM-P-NOW", question: "How many children are in the [entry] pool this year?", answer: "adm-now", rhythm: "this-year" },
      { view: "DV-ADM-P-ENTRY-LINE", question: "How many have joined us at [entry], year by year?", answer: "adm-cohort", rhythm: "over-time" },
      { view: "DV-ADM-P-PIPELINE", question: "How many will reach [entry], year by year?", answer: "adm-pipeline", rhythm: "in-context" },
      { view: "DV-ADM-P-MAP", question: "Where do they come from?", answer: "adm-feeders-map", rhythm: "in-context" },
      { view: "DV-ADM-P-POOL-INDEXED", question: "Is the pool growing or shrinking?", answer: "adm-pool-trend", rhythm: "over-time" },
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
    // What share, against whom: our share beside each rival's (a ranking).
    answer: { kind: "ranking", view: "DV-ADM-M-BARS" },
    screens: [
      { view: "DV-ADM-M-NOW", question: "What share of the pool joined us this year?", answer: "adm-share-now", rhythm: "this-year" },
      { view: "DV-ADM-M-BARS", question: "How does that compare with our rivals?", answer: "adm-share-rivals", rhythm: "in-context" },
      { view: "DV-ADM-M-MAP", question: "Where are our rivals?", answer: "adm-rivals-map", rhythm: "in-context" },
      { view: "DV-ADM-M-MOMENTUM", question: "Who is gaining, and who is losing?", answer: "adm-momentum", rhythm: "over-time" },
      { view: "DV-ADM-M-SHARE-LINE", question: "Has our share changed over time?", answer: "adm-share-trend", rhythm: "over-time" },
      { view: "DV-ADM-M-ACAD-RANK", question: "And how do our results compare?", answer: "adm-academic", rhythm: "wider" },
    ],
  },
];

// ------------------------------------------------------------------------------------------------ head office

const GRP = "/teacher/group";
const groupWalks: AuthoredWalk[] = [
  {
    id: "group-overview",
    product: "group",
    question: "How is the group doing, and against whom?",
    icon: "TilesIcon",
    label: "Overview",
    kind: "Group dashboard",
    dashboard: `${GRP}/overview`,
    // How is the group doing, against whom: the group beside the comparison, measure by measure (a table).
    answer: { kind: "table", view: "GRP-O-AGAINST" },
    screens: [
      { view: "GRP-O-NOW", question: "Where does the group stand this year?", answer: "grp-now", rhythm: "this-year" },
      { view: "GRP-O-AGAINST", question: "How does it compare with other groups?", answer: "grp-against", rhythm: "in-context" },
      { view: "GRP-O-MAP", question: "Where are our schools?", answer: "grp-map", rhythm: "in-context" },
      { view: "GRP-O-ROLL", question: "Has the combined roll grown?", answer: "grp-roll", rhythm: "over-time" },
      { view: "GRP-O-RESULTS", question: "Are results going up or down?", answer: "grp-results", rhythm: "over-time" },
      { view: "GRP-O-SHARE", question: "What share of places do we hold?", answer: "grp-share", rhythm: "wider" },
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
    // Which schools are growing: each school's roll, year by year (a chart).
    answer: { kind: "chart", view: "GRP-S-GROWING" },
    screens: [
      { view: "GRP-S-NOW", question: "How many schools, and how many pupils?", answer: "grp-schools-now", rhythm: "this-year" },
      { view: "GRP-S-TABLE", question: "How do the schools compare?", answer: "grp-schools-table", rhythm: "in-context" },
      { view: "GRP-S-GROWING", question: "Which are growing?", answer: "grp-schools-growing", rhythm: "over-time" },
      { view: "GRP-S-SCATTER", question: "Do the bigger schools do better?", answer: "grp-schools-scatter", rhythm: "wider" },
      { view: "GRP-S-SHAPES", question: "What shape is each school?", answer: "grp-schools-shapes", rhythm: "wider" },
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
    // How results compare: the schools ranked (a ranking).
    answer: { kind: "ranking", view: "GRP-A-RANKED" },
    screens: [
      { view: "GRP-A-NOW", question: "What did the group get this year?", answer: "grp-academic-now", rhythm: "this-year" },
      { view: "GRP-A-RANKED", question: "How do our schools rank?", answer: "grp-academic-ranked", rhythm: "in-context" },
      { view: "GRP-A-AREAS", question: "Which subject areas lead?", answer: "grp-academic-areas", rhythm: "in-context" },
      { view: "GRP-A-TREND", question: "Are results going up or down?", answer: "grp-academic-trend", rhythm: "over-time" },
      { view: "GRP-A-IMPROVING", question: "Which schools are improving?", answer: "grp-academic-improving", rhythm: "wider" },
    ],
  },
  {
    id: "group-pupils",
    product: "group",
    question: "Are pupil numbers holding up across the group?",
    icon: "AdmShapeIcon",
    label: "Pupils",
    kind: "Group dashboard",
    dashboard: `${GRP}/pupils`,
    // Are numbers holding up: each school growing or shrinking (a chart).
    answer: { kind: "chart", view: "GRP-P-GROWING" },
    screens: [
      { view: "GRP-P-NOW", question: "How many pupils does the group have?", answer: "grp-pupils-now", rhythm: "this-year" },
      { view: "GRP-P-SHAPE", question: "What shape is the group?", answer: "grp-pupils-shape", rhythm: "in-context" },
      { view: "GRP-P-ROLL", question: "Has the roll grown or shrunk?", answer: "grp-pupils-roll", rhythm: "over-time" },
      { view: "GRP-P-GROWING", question: "Which schools are growing, and which are shrinking?", answer: "grp-pupils-growing", rhythm: "over-time" },
      { view: "GRP-P-PROJECTION", question: "How many children live around the schools?", answer: "grp-pupils-projection", rhythm: "wider" },
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
  "GRP-O-RESULTS": { label: "Results trend", icon: "TrendLineIcon" },
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
  "GRP-P-ROLL": { label: "Combined roll, indexed", icon: "IndexedLineIcon" },
  "GRP-P-GROWING": { label: "Growing and shrinking", icon: "VerticalBarsIcon" },
  "GRP-P-PROJECTION": { label: "Children around the schools", icon: "AdmPopulationIcon" },
};

/** The dashboard a Teacher walk screen lives on: Results for a Results view or a screen set on points. */
export function teacherModeOf(s: { view: string; options?: { measure?: string } }): "candidates" | "results" {
  return s.view.startsWith("DV-C1-RES") || s.view.startsWith("DV-C1-CNT") || s.options?.measure === "points" ? "results" : "candidates";
}

/** The dashboard config a walk screen draws from (Teacher, SMT, Admissions); null for head office. */
export function walkDashboardConfig(walk: Pick<Walk, "product" | "dashboard">, s: { view: string; options?: { measure?: string }; from?: "admissions" }): DashboardConfig | null {
  if (s.from === "admissions") return ADMISSIONS_DASHBOARDS[0] ?? null;
  if (walk.product === "gcse" || walk.product === "post16") return teacherDashboardFor(walk.product === "gcse" ? "ks4" : "ks5", teacherModeOf(s));
  if (walk.product === "smt" || walk.product === "smt_primary") {
    const part = walk.dashboard.split("/")[3] ?? "overview";
    return SMT_DASHBOARDS.find((d) => d.id === `vicdata.smt.${part}`) ?? null;
  }
  if (walk.product === "admissions") return ADMISSIONS_DASHBOARDS[walk.dashboard.includes("market-share") ? 1 : 0] ?? null;
  return null;
}

/** Where a screen's view sits on its dashboard, from the dashboard's own config (or the group layout). */
export function spotOf(walk: Pick<Walk, "product" | "dashboard">, s: { view: string; options?: { measure?: string }; from?: "admissions" }): GridSpot | null {
  const COL = { c1: 0, c2: 1, c3: 2 } as const;
  if (walk.product === "group") {
    const L = GROUP_LAYOUT_IDS[groupWalkDash(s.view)];
    for (const [ri, cells] of [L.now, L.trends].entries()) {
      let col = 0;
      for (const c of cells) {
        // A panel holding several views is named by the view itself, not its first (review fixes, M2).
        if (c.views.includes(s.view)) return { col: col as 0 | 1 | 2, row: ri as 0 | 1, span: c.span, panel: c.views.length > 1 ? "" : GROUP_VIEW_META[c.views[0]]?.label ?? c.id };
        col += c.span;
      }
    }
    return null;
  }
  const cfg = walkDashboardConfig(walk, s);
  const panel = cfg?.panels.find((p) => p.dataviews.some((v) => v.kind === "view" && v.dataview === s.view));
  if (!panel) return null;
  return { col: COL[panel.column as "c1" | "c2" | "c3"] ?? 0, row: panel.row === "current" || panel.row === "now" ? 0 : 1, span: (panel.span?.cols ?? 1) === 2 ? 2 : 1, panel: panel.name ?? cfg?.columns.find((c) => c.id === panel.column)?.title ?? panel.column };
}

const withSpots = (w: AuthoredWalk): Walk => ({
  ...w,
  screens: w.screens.map((s) => {
    const spot = spotOf(w, s);
    if (!spot) throw new Error(`walks.ts: ${w.id}'s screen ${s.view} isn't on its dashboard (${w.dashboard})`);
    return { ...s, spot };
  }),
});

export const WALKS: Walk[] = [...teacherWalks("gcse"), ...teacherWalks("post16"), ...smtWalks(false), ...smtWalks(true), ...admissionsWalks, ...groupWalks].map(withSpots);

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

/**
 * 0.8 feedback B2 (D4): the walk rail's names, one per screen in the walk's order -- the view's own name, and
 * where a walk shows one view twice, what each is set to ("Bars · whole school").
 */
export function walkRailLabels(walk: Pick<Walk, "screens">): string[] {
  const names = walk.screens.map((s) => screenMeta(s.view)?.label ?? s.view);
  return walk.screens.map((s, i) => {
    if (names.filter((n) => n === names[i]).length < 2) return names[i];
    const o = s.options ?? {};
    const set = o.against === "whole" ? "whole school" : o.against === "category" ? "subject area" : o.measure === "points" ? "results" : o.measure === "entries" ? "entries" : null;
    return set ? `${names[i]} · ${set}` : names[i];
  });
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
