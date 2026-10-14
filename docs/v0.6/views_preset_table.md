# VicData 0.6.1: views as ViewSpecs, the preset table (S2)

**Stage S2 of the view editor rebuild** (`docs/v0.6/vicdata_0_6_view_editor_rebuild_claude_code_prompt_v1.md`). Every dataview in `src/catalogue/dataviews.ts` is translated here to a **ViewSpec preset**: one recipe in the shape the new editor asks for it (1 · Data, 2 · View, 3 · Preview). Members' pages don't change in S2: the hosts still draw every view; the config-driven renderer that reads a spec is S3's.

- **Code is the source:** the presets live in `src/catalogue/viewspec.ts` (`VIEW_PRESETS`, `presetSpec()`).
- **The table below is generated** from that code by `npx -y tsx scripts/views-preset-table.ts --write`. A unit test (`src/lib/viewspec.test.ts`) fails when the table, or the preset ids in this doc, drift from the code.
- **Default compare for every translated preset is `"follows-page"` (D1a).** What that resolves to today, preset by preset, is in "What follows-page draws today" below. S3's series builder must produce exactly that.

## The ViewSpec

```ts
type ViewSpec = {
  data: {
    source: "academic.candidates" | "academic.results" | "follows-page";   // [ext] follows-page
    entries?: "all" | "points-eligible";                                   // [ext]
    subject: "follows" | "follows-or-whole-school" | "whole-school" | { fixed: string };  // [ext] the two whole-school values
    per: "year" | "subject" | "grade" | "school";
    rows?: "follows-page" | "category" | "all" | "selected" | "nearest" | { savedSet: string };
    shownAs: "actual" | "indexed" | "change";
    change?: "honest" | "absolute";                                        // [ext]
    years: { latest: true; memberPick?: boolean }                          // [ext] memberPick
         | { from: "first" | number; rollOn: boolean; memberPick?: boolean };
  };
  compare: "follows-page" | {
    kind: "self" | "category" | "allSubjects" | "selectedSubjects" | "la" | "region" | "england"
        | "nearest" | "savedSet" | "chosenSchool" | "otherSubject";
    colour: string;                                     // theme token or hex
    average?: "mean" | "median" | "weighted";           // an average of things NOT drawn
    as?: "line" | "marker" | "reference" | "row";       // [ext]
    at?: "earlier-year";                                // [ext]
  }[];
  view:                                                 // look is per kind
    | { kind: "line";    look: { trendLine?: boolean | "member"; endLabels?; fromZero?;
                                 shortSpan?: "change-bars" | "table";             // [ext]
                                 memberLegend?; cardFocusVsAverage?: "on-all-subjects" } }  // [ext]
    | { kind: "bar";     look: { orientation?: "horizontal" | "vertical";         // [ext]
                                 order?: "highest" | "az" | "above-comparison";
                                 average?: "none" | "mean" | "median" | "weighted";  // of the bars drawn
                                 top10?; highlight?; values?; spacious?; diverging? } }  // [ext] last two
    | { kind: "table";   look: { yearColumns?: "first-latest" | "every" | "latest";
                                 extra?: ("change" | "rank" | "n" | "vs-comparison")[];  // [ext] vs-comparison
                                 sort?: "listed" | "latest" | "change" | "vs-comparison";
                                 highlight?; colourChange?; memberSort?;
                                 leadingRank?; value?; changeLeads?: "value" | "percent" } }  // [ext] last three
    | { kind: "ranking"; look: { columns?: ("rank"|"sector"|"value"|"change"|"distance"|"n"|"bar")[];
                                 show?: "top5" | "all" | "around"; alwaysSelf? } }
    | { kind: "numbers"; look: {} }                     // the Figures stay in the instance's params.tiles (round 3)
    | { kind: "spread";  look: { show?: "percent" | "counts"; average?: "none" | "mean" | "median";
                                 bands?: "none" | "follows-page" | { top; bottom }; values?;
                                 memberSpan?: "highlight" | "page-range" } }      // [ext]
    | { kind: "slope";   look: {} }
    | { kind: "donut";   look: {} }
    | { kind: "map";     look: { colour: "value" | "change" | "member" } };
  resultsMeasures?: ResultsMeasure[];                   // absent = all four (or not a Results view)
  variants?: { compareAgainst?: …[]; comparator?: …[] };  // [ext] round 4's other axes
  icon: string;                                         // a PanelIcons glyph name
  title: string;                                        // template, placeholders allowed
  preset?: DataviewId;                                  // the dataview it was translated from (D10)
};
```

### How the rows, `per` and `compare` fit together

- **`per`** is what one value is for: one value per **year** is a time series (a line, a year table, a change table), per **subject / school** is one value per entity in a year (bars, rankings, tiles, a ranked change), per **grade** is a distribution.
- **`rows`** are the entities drawn as their own lines / bars / table rows (the category's subjects, the page's group, the comparison set's schools). Absent = the focused subject (or school) alone.
- **`compare`** adds what the rows are read against: lines, markers on each row, a dashed reference line, or extra table rows. An average here is of things *not* drawn. An average *of what is drawn* is a look option.

### Extensions to the prompt's S2 shape (each logged in `docs/OPEN_QUESTIONS.md`)

| Field | Why a translated view needs it |
|---|---|
| `data.source: "follows-page"` | Context and Comparisons draw on the dashboard's own Candidates / Results; the same preset sits on both dashboards. |
| `data.entries: "points-eligible"` | The geography views count points-eligible entries only (`R-GEO-POINTS-ELIGIBLE`), so the school's own row does too. |
| `data.subject: "follows-or-whole-school"` / `"whole-school"` | Comparisons falls back to the phase headline (Attainment 8 / A level points per entry) with no subject chip; its ranking tiles are always on the headline. |
| `data.change: "absolute"` | Comparisons' Trend map colours by the plain difference on every measure (entries included); its Change map by the honest change (`R-NUMBER-TYPE-HONESTY`). The same data otherwise. |
| `data.years.memberPick` | Members' own year controls (Context's year menu, every Trends "From" menu, Grade counts' compare year) move the span; the spec is where it starts. |
| `compare[].as` | The prompt's "lines or markers": England is a marker on each bar and a tick on each grade; a group average is a dashed reference line across ranked bars; the geography table's LA / region / England are rows. |
| `compare[].at: "earlier-year"` | Grade counts' Spread by year compares the subject with itself in an earlier year. |
| `variants` | Round 4's other page axes (Context's Compare against, Comparisons' comparator kind) beside `resultsMeasures`, so Comparisons' tiles stay ranking-only and the maps set-only. |
| line `shortSpan`, `memberLegend`, `cardFocusVsAverage` | `R-TREND-LINE-4YR`'s fallback differs by host (ranked change bars in the measure's units, or the table alone); Context's fullscreen show/hide list; Context's All subjects card. |
| bar `orientation`, `spacious`, `diverging` | Context's bars are vertical (VerticalBars), Results' rows roomy (ViewChart `spacious`), a change grows either way from zero (ChangeList). |
| table `vs-comparison`, `leadingRank`, `value`, `changeLeads` | The Current tables' third column ("vs National", "vs average", falling back to "vs last year"), the ranked change tables, Context's rank-only table, the geography table's %-first Change cell. |
| spread `memberSpan` | Grade counts' click-two-grades highlight; the retired Grades view's range picking. |

## The presets (40, one per dataview)

Read the columns as:
- **Data:** `source · subject · per · rows · shown as · years`. `—` = no rows (the focused subject or school alone).
- **Results measures:** the pill states the preset is offered on (round 3's `Dataview.resultsMeasures`). `all` = all four, or a Candidates view (no pill there).
- **Variants:** round 4's `Dataview.variants`. `all` = every state.
- **On:** the Teacher dashboards that place it (C = Candidates, R = Results).
- **Compare** is `"follows-page"` on every row (D1a); see the next section for what it draws.

<!-- preset-table:start (generated by scripts/views-preset-table.ts; do not edit by hand) -->

| # | Preset (dataview) | Rail label | View · look | Data: source · subject · per · rows · shown as · years | Results measures | Variants | Icon | Title | On |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `DV-C1-CAND-CUR-TILES` | Number tiles | **numbers** · — | academic.candidates · follows · subject · category · actual · latest | all | all | TilesIcon | [subject] Candidates: [year] | GCSE C, Post-16 C |
| 2 | `DV-C1-CAND-TR-INDEXED` | Indexed | **line** · trendLine: member; shortSpan: change-bars | academic.candidates · follows · year · category · indexed · from first, rolls on (members pick) | all | all | IndexedLineIcon | Entries in [category] | GCSE C, Post-16 C |
| 3 | `DV-C1-CAND-TR-ACTUAL` | Actual | **line** · trendLine: member; shortSpan: change-bars | academic.candidates · follows · year · category · actual · from first, rolls on (members pick) | all | all | TrendLineIcon | Entries in [category] | GCSE C, Post-16 C |
| 4 | `DV-C1-CAND-TR-TABLE` | Trend table | **table** · yearColumns: first-latest; extra: change; sort: latest; highlight: true; colourChange: true; memberSort: true | academic.candidates · follows · year · category · actual · from first, rolls on (members pick) | all | all | TableIcon | Entries in [category], year by year | GCSE C, Post-16 C |
| 5 | `DV-C1-CAND-TR-GEO-CHART` | Area chart | **line** · — | academic.candidates (points-eligible) · follows · year · — · indexed · from first, rolls on (members pick) | all | all | TrendLineIcon | [subject] against its LA and England, year by year | GCSE C, Post-16 C |
| 6 | `DV-C1-CAND-TR-GEO-TABLE` | Change table | **table** · yearColumns: first-latest; extra: change; sort: listed; highlight: true; colourChange: true; memberSort: true; changeLeads: percent | academic.candidates (points-eligible) · follows · year · — · actual · from first, rolls on (members pick) | all | all | TableIcon | [subject]: change against its LA, region and England | GCSE C, Post-16 C |
| 7 | `DV-C1-CAND-TR-CHANGELIST` | Ranked change | **bar** · orientation: horizontal; order: highest; highlight: true; values: true; diverging: true | academic.candidates · follows · subject · category · change · from first, rolls on (members pick) | all | all | HorizontalBarsIcon | Entries in [category]: % change since [year], ranked | none (draft) |
| 8 | `DV-C1-CAND-TR-CHANGETABLE` | Change table (category) | **table** · yearColumns: first-latest; extra: change; sort: latest; highlight: true; colourChange: true; memberSort: true | academic.candidates · follows · year · category · actual · from first, rolls on (members pick) | all | all | TableIcon | Entries in [category]: [year] against the latest year, with the change | none (draft) |
| 9 | `DV-C1-RES-CUR-TILES` | Number tiles | **numbers** · — | academic.results · follows · subject · category · actual · latest | points/threshold/bands | all | TilesIcon | (none) | GCSE R, Post-16 R |
| 10 | `DV-C1-RES-CUR-GRADES` | Grade distribution | **spread** · show: percent; bands: follows-page; memberSpan: page-range | academic.results · follows · grade · — · actual · latest | bands | all | GradesIcon | (none) | GCSE R, Post-16 R |
| 11 | `DV-C1-RES-CUR-BAR` | Bar chart | **bar** · orientation: horizontal; order: highest; highlight: true; values: true; spacious: true | academic.results · follows · subject · category · actual · latest | points/threshold/bands | all | HorizontalBarsIcon | Results in [category] | GCSE R, Post-16 R |
| 12 | `DV-C1-RES-CUR-TABLE` | Sortable table | **table** · yearColumns: latest; extra: vs-comparison; sort: vs-comparison; highlight: true; colourChange: true; memberSort: true | academic.results · follows · subject · category · actual · latest | points/threshold/bands | all | RankListIcon | Results in [category] | GCSE R, Post-16 R |
| 13 | `DV-C1-RES-TR-CHART` | Chart | **line** · trendLine: member; shortSpan: change-bars; memberLegend: true | academic.results · follows · year · category · actual · from first, rolls on (members pick) | points/threshold/bands | all | TrendLineIcon | Results in [category]: each subject's line | GCSE R, Post-16 R |
| 14 | `DV-C1-RES-TR-TABLE` | Trend table | **table** · yearColumns: first-latest; extra: change; sort: latest; highlight: true; colourChange: true; memberSort: true | academic.results · follows · year · category · actual · from first, rolls on (members pick) | points/threshold/bands | all | TableIcon | Results in [category], year by year | GCSE R, Post-16 R |
| 15 | `DV-C1-RES-TR-MAP` | Map | **map** · colour: member | academic.results · follows · school · follows-page · actual · latest | points/threshold/bands | all | MapPinIcon | Change in [subject] [measure] since [year], by school | GCSE R, Post-16 R |
| 16 | `DV-C1-RES-TR-GEO-CHART` | Area chart | **line** · — | academic.results · follows · year · — · actual · from first, rolls on (members pick) | points/threshold/bands | all | TrendLineIcon | [subject] against its LA and England, year by year | GCSE R, Post-16 R |
| 17 | `DV-C1-RES-TR-GEO-TABLE` | Change table | **table** · yearColumns: first-latest; extra: change; sort: listed; highlight: true; colourChange: true; memberSort: true | academic.results · follows · year · — · actual · from first, rolls on (members pick) | points/threshold/bands | all | TableIcon | [subject]: change against its LA, region and England | GCSE R, Post-16 R |
| 18 | `DV-C1-CNT-CUR-DIST` | Grade distribution | **spread** · show: percent; bands: none; memberSpan: highlight | academic.results · follows · grade · — · actual · latest | counts | all | GradesIcon | (none) | GCSE R, Post-16 R |
| 19 | `DV-C1-CNT-TR-SPREAD` | Spread by year | **spread** · show: percent; bands: none | academic.results · follows · grade · — · actual · latest (members pick) | counts | all | GradesIcon | [subject]'s spread of grades: [year] against [compare year], grade by grade | GCSE R, Post-16 R |
| 20 | `DV-C1-CNT-TR-CHANGETABLE` | Change table | **table** · yearColumns: first-latest; extra: change; sort: listed; colourChange: true; memberSort: true | academic.results · follows · grade · — · actual · from first, rolls on (members pick) | counts | all | TableIcon | [subject]'s entries at each grade: [change year] against [year], with the change | GCSE R, Post-16 R |
| 21 | `DV-C2-CUR-DONUT` | Share (donut) | **donut** · — | follows-page · follows · subject · follows-page · actual · latest (members pick) | all | all | DonutIcon | Entries in [subject] as a proportion of [comparison-group] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 22 | `DV-C2-CUR-BARS` | Bar chart | **bar** · orientation: vertical; order: highest; highlight: true; values: true | follows-page · follows · subject · follows-page · actual · latest (members pick) | all | all | VerticalBarsIcon | [Entries\|Results] by subject in [comparison-group] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 23 | `DV-C2-CUR-LIST` | Ranked list | **ranking** · columns: rank+value; show: all; alwaysSelf: true | follows-page · follows · subject · follows-page · actual · latest (members pick) | all | all | RankListIcon | [Entries\|Results] by subject in [comparison-group] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 24 | `DV-C2-CUR-TABLE` | Sortable table | **table** · yearColumns: latest; extra: vs-comparison; sort: latest; highlight: true; colourChange: true; memberSort: true; leadingRank: true; value: false | follows-page · follows · subject · follows-page · actual · latest (members pick) | all | all | TableIcon | [Entries\|Results] by subject in [comparison-group] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 25 | `DV-C2-TR-INDEXED` | Indexed | **line** · trendLine: member; shortSpan: change-bars; memberLegend: true; cardFocusVsAverage: on-all-subjects | academic.candidates · follows · year · follows-page · indexed · from first, rolls on (members pick) | all | all | IndexedLineIcon | Entries in [comparison-group] | GCSE C, Post-16 C |
| 26 | `DV-C2-TR-CHART` | Chart | **line** · trendLine: member; shortSpan: change-bars; memberLegend: true; cardFocusVsAverage: on-all-subjects | academic.results · follows · year · follows-page · actual · from first, rolls on (members pick) | all | all | TrendLineIcon | Results in [comparison-group]: each subject's line | GCSE R, Post-16 R |
| 27 | `DV-C2-TR-ACTUAL` | Actual | **line** · trendLine: member; shortSpan: change-bars; memberLegend: true; cardFocusVsAverage: on-all-subjects | academic.candidates · follows · year · follows-page · actual · from first, rolls on (members pick) | all | all | TrendLineIcon | Entries in [comparison-group] | GCSE C, Post-16 C |
| 28 | `DV-C2-TR-TABLE` | Trend table | **table** · yearColumns: first-latest; extra: change; sort: latest; highlight: true; colourChange: true; memberSort: true | follows-page · follows · year · follows-page · actual · from first, rolls on (members pick) | all | all | TableIcon | [Entries\|Results] in [comparison-group], year by year | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 29 | `DV-C2-TR-CHANGELIST` | Ranked change | **bar** · orientation: horizontal; order: highest; highlight: true; values: true; diverging: true | follows-page · follows · subject · follows-page · change · from first, rolls on (members pick) | all | all | HorizontalBarsIcon | [Entries\|Results] in [comparison-group]: [change-word] since [year], ranked | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 30 | `DV-C2-TR-CHANGETABLE` | Change table | **table** · yearColumns: first-latest; extra: change; sort: change; highlight: true; colourChange: true; leadingRank: true | follows-page · follows · year · follows-page · actual · from first, rolls on (members pick) | all | all | TableIcon | [Entries\|Results] in [comparison-group]: [year] against the latest year, ranked by change | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 31 | `DV-C3-CUR-TILES` | Number tiles | **numbers** · — | follows-page · whole-school · school · follows-page · actual · latest | all | comparator: ranking | TilesIcon | [school]'s rank in the [set]: [measure] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 32 | `DV-C3-CUR-MAP` | Map | **map** · colour: value | follows-page · follows-or-whole-school · school · follows-page · actual · latest | all | comparator: schools | MapPinIcon | [subject] [measure] by school, on the map | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 33 | `DV-C3-CUR-BAR` | Bar chart | **bar** · orientation: horizontal; order: highest; highlight: true; values: true | follows-page · follows-or-whole-school · school · follows-page · actual · latest | all | all | HorizontalBarsIcon | [Entries\|Results] by school in the [set] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 34 | `DV-C3-CUR-RANKING` | Ranking | **ranking** · columns: rank+sector+value+distance; show: all; alwaysSelf: true | follows-page · follows-or-whole-school · school · follows-page · actual · latest | all | all | RankListIcon | Schools ranked by [subject] [measure] in the [set] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 35 | `DV-C3-TR-CHART` | Chart | **line** · trendLine: member; shortSpan: table | follows-page · follows-or-whole-school · year · — · actual · from first, rolls on (members pick) | all | all | TrendLineIcon | This school's [measure] against [versus], year by year | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 36 | `DV-C3-TR-TABLE` | Trend table | **table** · yearColumns: first-latest; extra: change; sort: latest; highlight: true; colourChange: true; memberSort: true | follows-page · follows-or-whole-school · year · follows-page · actual · from first, rolls on (members pick) | all | all | TableIcon | Every school in the [set]: [measure], year by year | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 37 | `DV-C3-TR-MAP` | Trend map | **map** · colour: change | follows-page · follows-or-whole-school · school · follows-page · change (absolute) · from first, rolls on (members pick) | all | comparator: schools | MapPinIcon | Change in [measure] since [year], coloured by school | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 38 | `DV-C3-TR-CHANGELIST` | Ranked bars | **bar** · orientation: horizontal; order: highest; highlight: true; values: true; diverging: true | follows-page · follows-or-whole-school · school · follows-page · change · from first, rolls on (members pick) | all | all | HorizontalBarsIcon | [change-of-measure] since [year], ranked against the [set] | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 39 | `DV-C3-TR-CHANGETABLE` | Change table | **table** · yearColumns: first-latest; extra: change; sort: change; highlight: true; colourChange: true; leadingRank: true | follows-page · follows-or-whole-school · year · follows-page · actual · from first, rolls on (members pick) | all | all | TableIcon | Every school in the [set]: [year] against the latest year, ranked by change | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 40 | `DV-C3-TR-CHANGEMAP` | Change map | **map** · colour: change | follows-page · follows-or-whole-school · school · follows-page · change · from first, rolls on (members pick) | all | comparator: schools | MapPinIcon | [change-of-measure] since [year], coloured by school | GCSE C, GCSE R, Post-16 C, Post-16 R |
| 41 | `DV-ADM-P-NOW` | Entry point now | **numbers** · — | admissions.pupils · follows · school · — · actual · latest | all | all | TilesIcon | Your [entry] entry point now | none (draft) |
| 42 | `DV-ADM-P-PIPELINE` | Pipeline | **pipeline** · projection: member; pastPools: true; rungLabels: true | admissions.pipeline · follows · year · — · actual · from first, rolls on | all | all | AdmPipelineIcon | Children who will reach [entry-year] entry, by September | none (draft) |
| 43 | `DV-ADM-P-FUNNEL` | Funnel | **bar** · orientation: horizontal; values: true | admissions.pipeline · follows · school · — · actual · latest | all | entryPoint: 11+/16+/custom | AdmFunnelIcon | From births to your [entry-year] | none (draft) |
| 44 | `DV-ADM-P-MAP` | Map of feeders | **map** · colour: change | admissions.pipeline · follows · school · — · actual · latest | all | all | MapPinIcon | Your feeders, sized by pupils aged [feeder-age], coloured by trend | none (draft) |
| 45 | `DV-ADM-P-TABLE` | Feeder table | **table** · yearColumns: latest; extra: change; sort: listed; highlight: true; colourChange: true; memberSort: true | admissions.pipeline · follows · school · — · actual · latest | all | all | TableIcon | Your feeders: pupils aged [feeder-age], trend and flags | none (draft) |
| 46 | `DV-ADM-P-SHAPE` | Shape and size | **shapes** · columns: 2 | admissions.pupils · follows · school · — · actual · latest | all | all | AdmShapeIcon | Shape and size: your school, the local shape, and rivals' shapes | none (draft) |
| 47 | `DV-ADM-P-ENTRY-LINE` | Your cohort | **line** · — | admissions.pupils · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Your [entry-year] cohort, year by year | none (draft) |
| 48 | `DV-ADM-P-ENTRY-BARS` | Your cohort, bars | **bar** · orientation: vertical; values: true | admissions.pupils · follows · year · — · actual · from first, rolls on | all | all | VerticalBarsIcon | Your [entry-year] cohort, year by year | none (draft) |
| 49 | `DV-ADM-P-ENTRY-TABLE` | Your cohort, table | **table** · yearColumns: every; extra: change; years: down | admissions.pupils · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Your [entry-year] cohort, year by year | none (draft) |
| 50 | `DV-ADM-P-POOL-INDEXED` | Pool trends | **line** · — | admissions.pupils · follows · year · — · indexed · from first, rolls on | all | all | IndexedLineIcon | [feeder-age]-year-olds: your feeders, [la] and England | none (draft) |
| 51 | `DV-ADM-P-POOL-TABLE` | Pool trends, table | **table** · yearColumns: every; years: down | admissions.pupils · follows · year · — · actual · from first, rolls on | all | all | TableIcon | [feeder-age]-year-olds: your feeders, [la] and England | none (draft) |
| 52 | `DV-ADM-P-AREA-POP` | Area population | **bar** · orientation: vertical | admissions.pupils · follows · year · — · actual · latest | all | all | AdmPopulationIcon | Population trends in the area (ages 5-15) | none (draft) |
| 53 | `DV-ADM-P-HOLD-LINE` | Share needed | **line** · — | admissions.pipeline · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Share needed to hold numbers steady | none (draft) |
| 54 | `DV-ADM-P-HOLD-TABLE` | Share needed, table | **table** · yearColumns: every; years: down | admissions.pipeline · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Share needed to hold numbers steady | none (draft) |
| 55 | `DV-ADM-M-NOW` | Your place now | **numbers** · — | admissions.market · follows · school · — · actual · latest | all | all | TilesIcon | Your place among the [rivals], at [entry] | none (draft) |
| 56 | `DV-ADM-M-DONUT` | Share (donut) | **donut** · — | admissions.market · follows · school · — · actual · latest | all | all | DonutIcon | Your share of [entry-age]-year-olds across this group | none (draft) |
| 57 | `DV-ADM-M-BARS` | Ranked bars | **ranking** · columns: rank+bar+value+change; show: all; alwaysSelf: true | admissions.market · follows · school · — · actual · latest | all | all | HorizontalBarsIcon | [entry-age]-year-olds by school, ranked, with where each sits in regional and national results rankings | none (draft) |
| 58 | `DV-ADM-M-MAP` | Map of rivals | **map** · colour: value | admissions.market · follows · school · — · actual · latest | all | all | MapPinIcon | Your rivals, sized by pupils aged [entry-age] | none (draft) |
| 59 | `DV-ADM-M-TABLE` | Rivals table | **table** · yearColumns: latest; extra: change+rank; sort: latest; highlight: true; memberSort: true | admissions.market · follows · school · — · actual · latest | all | all | TableIcon | Your rivals at [entry] | none (draft) |
| 60 | `DV-ADM-M-MOMENTUM` | Rivals' momentum | **scatter** · labels: true; quadrantNames: true | admissions.rivals · follows · school · — · change · latest | all | all | AdmScatterIcon | Who is gaining pupils, and whose results are rising? | none (draft) |
| 61 | `DV-ADM-M-STRENGTHS` | Strengths and weaknesses | **strengths** · order: gap; showFlags: true | admissions.rivals · follows · subject · — · actual · latest | all | entryPoint: 11+/16+/custom | AdmStrengthsIcon | Where you lead and trail your rivals, by subject area | none (draft) |
| 62 | `DV-ADM-M-SHAPE` | Rivals' shapes | **shapes** · columns: 2 | admissions.pupils · follows · school · — · actual · latest | all | all | AdmShapeIcon | Shape and size: your school and rivals' shapes | none (draft) |
| 63 | `DV-ADM-M-FLAGS` | Flags | **flags** · show: flagged | admissions.rivals · follows · school · — · change · latest | all | all | FlagIcon | Rivals' flags: large and lasting changes | none (draft) |
| 64 | `DV-ADM-M-VS-LINE` | You and the rivals | **line** · — | admissions.market · follows · year · — · indexed · from first, rolls on | all | all | IndexedLineIcon | Your [entry-year] against the [rivals] | none (draft) |
| 65 | `DV-ADM-M-VS-BARS` | You and the rivals, bars | **bar** · orientation: vertical | admissions.market · follows · year · — · actual · from first, rolls on | all | all | VerticalBarsIcon | Your [entry-year] against the [rivals] | none (draft) |
| 66 | `DV-ADM-M-ACAD-RANK` | Academic ranking | **ranking** · columns: rank+value+change; show: all | admissions.rivals · follows · subject · — · actual · latest | all | all | RankListIcon | Academic: your rank among the rivals | none (draft) |
| 67 | `DV-ADM-M-ACAD-NUM` | Academic numbers | **table** · yearColumns: latest; extra: rank; sort: latest; highlight: true | admissions.rivals · follows · school · — · actual · latest | all | all | AdmNumbersIcon | Academic: the rivals' headline figures | none (draft) |
| 68 | `DV-ADM-M-ACAD-CHANGE` | Academic change | **bar** · orientation: horizontal; diverging: true; highlight: true; values: true | admissions.rivals · follows · school · — · change · latest | all | all | ChangeArrowIcon | Academic: change since 2022/23 | none (draft) |
| 69 | `DV-ADM-M-SHARE-LINE` | Market share | **line** · — | admissions.market · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Your market share at [entry], year by year | none (draft) |
| 70 | `DV-ADM-M-SHARE-NUM` | Market share numbers | **table** · yearColumns: every; years: down | admissions.market · follows · year · — · actual · from first, rolls on | all | all | AdmNumbersIcon | Your market share at [entry], year by year | none (draft) |
| 71 | `DV-ADM-M-SHARE-RANKS` | Market share ranks | **table** · yearColumns: every; extra: rank; years: down | admissions.market · follows · year · — · actual · from first, rolls on | all | all | HorizontalBarsIcon | Your rank at [entry], year by year | none (draft) |
| 72 | `DV-ADM-M-SHARE-CHANGE` | Market share change | **bar** · orientation: horizontal; diverging: true; values: true | admissions.market · follows · school · — · change · from first, rolls on | all | all | ChangeArrowIcon | Change since 2019/20: your pupils and share at [entry] | none (draft) |
| 73 | `DV-ADM-M-ROLL-LINE` | Roll trends | **line** · — | admissions.market · follows · year · — · actual · from first, rolls on | all | all | AdmRollIcon | Pupils in the entry point's age band: you and the [rivals] | none (draft) |
| 74 | `DV-SMT-O-NOW` | The school now | **numbers** · — | smt.school · follows · school · — · actual · latest | all | all | TilesIcon | The school now | none (draft) |
| 75 | `DV-SMT-O-SCORECARD` | Scorecard | **table** · yearColumns: latest; extra: rank+change | smt.results · follows · school · — · actual · latest | all | all | TableIcon | How [school] compares, headline by headline | none (draft) |
| 76 | `DV-SMT-O-MAP` | Map | **map** · colour: value | smt.school · follows · school · — · actual · latest | all | all | MapPinIcon | [school] and [set] | none (draft) |
| 77 | `DV-SMT-O-FLAGS` | Flags | **flags** · show: flagged | smt.school · follows · school · — · change · latest | all | all | FlagIcon | Flags: large and lasting changes at [school] | none (draft) |
| 78 | `DV-SMT-O-ROLL-LINE` | Roll, indexed | **line** · — | smt.school · follows · year · — · indexed · from first, rolls on | all | all | IndexedLineIcon | Roll, indexed (2019/20 = 100) | none (draft) |
| 79 | `DV-SMT-O-ROLL-TABLE` | Roll, table | **table** · yearColumns: every; years: down | smt.school · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Roll, year by year | none (draft) |
| 80 | `DV-SMT-O-RESULTS-LINE` | Results trend | **line** · — | smt.results · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Headline results against [set] | none (draft) |
| 81 | `DV-SMT-O-RESULTS-TABLE` | Results, table | **table** · yearColumns: every; years: down | smt.results · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Headline results against [set], year by year | none (draft) |
| 82 | `DV-SMT-O-MARKET-LINE` | Market share | **line** · — | smt.school · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Market share at 11+, against your rivals | none (draft) |
| 83 | `DV-SMT-O-MARKET-TABLE` | Market share, table | **table** · yearColumns: every; years: down | smt.school · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Market share at 11+, year by year | none (draft) |
| 84 | `DV-SMT-A-NOW` | The level now | **numbers** · — | smt.results · follows · school · — · actual · latest | all | all | TilesIcon | [level] now | none (draft) |
| 85 | `DV-SMT-A-AREAS` | Subject areas | **strengths** · order: gap; showFlags: true | smt.subjects · follows · subject · — · actual · latest | all | all | AdmStrengthsIcon | Where [school] leads and trails [set], by subject area | none (draft) |
| 86 | `DV-SMT-A-SUBJECTS` | Subjects | **table** · yearColumns: latest; extra: rank+change; sort: listed | smt.subjects · follows · subject · — · actual · latest | all | all | TableIcon | Each subject, its rank, and where it's heading | none (draft) |
| 87 | `DV-SMT-A-VA` | Value added | **table** · yearColumns: latest | smt.value_added · follows · subject · — · actual · latest | all | all | AdmNumbersIcon | Value added | none (draft) |
| 88 | `DV-SMT-A-GRADES` | Grade profile | **bar** · orientation: horizontal; values: true | smt.subjects · follows · grade · — · actual · latest | all | all | HorizontalBarsIcon | Grade profile | none (draft) |
| 89 | `DV-SMT-A-TREND-LINE` | Results trend | **line** · — | smt.results · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | [level] results against [set] | none (draft) |
| 90 | `DV-SMT-A-TREND-TABLE` | Results, table | **table** · yearColumns: every; years: down | smt.results · follows · year · — · actual · from first, rolls on | all | all | TableIcon | [level] results against [set], year by year | none (draft) |
| 91 | `DV-SMT-A-BANDS` | Results by band | **line** · — | smt.results · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Top 25%, middle 50%, bottom 25% | none (draft) |
| 92 | `DV-SMT-A-MIX` | Entries mix | **bar** · orientation: vertical | smt.subjects · follows · year · — · actual · from first, rolls on | all | all | VerticalBarsIcon | Entries mix, year by year | none (draft) |
| 93 | `DV-SMT-A-MIX-TABLE` | Entries mix, table | **table** · yearColumns: every; years: down | smt.subjects · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Entries mix, year by year | none (draft) |
| 94 | `DV-SMT-P-NOW` | Your pupils now | **numbers** · — | smt.school · follows · school · — · actual · latest | all | all | TilesIcon | Your pupils now | none (draft) |
| 95 | `DV-SMT-P-SHAPE` | Shape and size | **shapes** · columns: 1 | smt.school · follows · school · — · actual · latest | all | all | AdmShapeIcon | Pupils in each year group | none (draft) |
| 96 | `DV-SMT-P-ENTRIES` | Entry points | **table** · yearColumns: latest | smt.school · follows · school · — · actual · latest | all | all | AdmFunnelIcon | Entry points at a glance | none (draft) |
| 97 | `DV-SMT-P-LEAVING` | Leaving at 16 | **table** · yearColumns: every; years: down | smt.school · follows · year · — · actual · from first, rolls on | all | all | ChangeArrowIcon | Leaving at 16 | none (draft) |
| 98 | `DV-SMT-P-MARKET` | Market share | **line** · — | smt.school · follows · year · — · actual · from first, rolls on | all | all | DonutIcon | Market share at 11+, against your rivals | none (draft) |
| 99 | `DV-SMT-P-PHASES` | Roll by phase | **line** · — | smt.school · follows · year · — · indexed · from first, rolls on | all | all | IndexedLineIcon | Roll by phase, indexed (2019/20 = 100) | none (draft) |
| 100 | `DV-SMT-P-PHASES-TABLE` | Roll by phase, table | **table** · yearColumns: every; years: down | smt.school · follows · year · — · indexed · from first, rolls on | all | all | TableIcon | Roll by phase, year by year | none (draft) |
| 101 | `DV-SMT-P-POOL` | The pool | **line** · — | smt.school · follows · year · — · actual · from first, rolls on | all | all | AdmPipelineIcon | The pool for your main entry point | none (draft) |
| 102 | `DV-SMT-P-AREA` | School-age population | **line** · — | smt.school · follows · year · — · actual · from first, rolls on | all | all | AdmPopulationIcon | The area's school-age population | none (draft) |
| 103 | `DV-SMT-C-NOW` | The area now | **numbers** · — | smt.area · follows · school · — · actual · latest | all | all | TilesIcon | The area now | none (draft) |
| 104 | `DV-SMT-C-MAP` | Map | **map** · colour: value | smt.area · follows · school · — · actual · latest | all | all | MapPinIcon | Where the school-age children live | none (draft) |
| 105 | `DV-SMT-C-BYAGE` | Population by age | **bar** · orientation: vertical | smt.area · follows · year · — · actual · latest | all | all | VerticalBarsIcon | Children by single year of age | none (draft) |
| 106 | `DV-SMT-C-BIRTHS` | Births and projections | **line** · — | smt.area · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | Births and projections | none (draft) |
| 107 | `DV-SMT-C-NEARBY` | Children nearby over time | **line** · — | smt.area · follows · year · — · indexed · from first, rolls on | all | all | IndexedLineIcon | Children nearby over time | none (draft) |
| 108 | `DV-SMT-C-BIRTHS-INDEXED` | Births, indexed | **line** · — | smt.area · follows · year · — · indexed · from first, rolls on | all | all | IndexedLineIcon | Births, indexed | none (draft) |
| 109 | `DV-SMT-C-BIRTHS-TABLE` | Births, table | **table** · yearColumns: every; years: down | smt.area · follows · year · — · actual · from first, rolls on | all | all | TableIcon | Births, year by year | none (draft) |
| 110 | `DV-SMT-C-PROJECTION` | Projection | **line** · — | smt.area · follows · year · — · actual · from first, rolls on | all | all | TrendLineIcon | School-age population, projected | none (draft) |
| 111 | `DV-SMT-C-AGES` | By single year of age | **bar** · orientation: vertical | smt.area · follows · year · — · actual · latest | all | all | VerticalBarsIcon | Population by single year of age | none (draft) |

<!-- preset-table:end -->

## What "follows-page" draws today

`"follows-page"` means "what the host draws now, driven by the page's own controls". These are the series S3's builder has to produce for each preset, unchanged. In the notation of `compare`: *kind (as, average)*.

**The page's controls it follows:**
- Context's **Compare against** pill (`againstKey("context")`: category / whole / selected) picks the **group**.
- Comparisons' **Compared against** set (`setKey("rankings")`: a saved set, the chooser's choice, else 10 nearest) picks the **set**, or a **ranking**.
- The **Results** pill and the **band range** pick the measure.
- The **subject chips** pick the focused subject.

| Preset | Follows-page resolves to |
|---|---|
| `DV-C1-CAND-CUR-TILES` | Main: the focused subject's entries this year. Tiles: rank in its category (category, rank); rank among every subject at the school (allSubjects, rank); % change since the first year (self, earlier year). |
| `DV-C1-CAND-TR-INDEXED` | Nothing beyond the rows: each category subject is its own line (palette, focus in the accent). No average line. |
| `DV-C1-CAND-TR-ACTUAL` | As Indexed. |
| `DV-C1-CAND-TR-TABLE` | Nothing beyond the rows. |
| `DV-C1-CAND-TR-GEO-CHART` | self (line, accent); la (line); england (line). The region line is left off the chart only (it runs on top of England's). |
| `DV-C1-CAND-TR-GEO-TABLE` | self (row); la (row); region (row); england (row). |
| `DV-C1-CAND-TR-CHANGELIST` | category (reference, mean, self-inclusive): the category average's % change as a dashed line. *Draft: unreachable today.* |
| `DV-C1-CAND-TR-CHANGETABLE` | Nothing beyond the rows. *Draft: unreachable today.* |
| `DV-C1-RES-CUR-TILES` | **Points:** rank in the category (category, rank); England's figure for the subject (england); the gap to it. **Grade 4+ / A\*–E:** the rank tile only (`R-NO-GRADE-RATE-GEO`). **Bands:** the entries in the range, England's rate on the range, the gap (`R-BANDS-ENGLAND-BENCH`). |
| `DV-C1-RES-CUR-GRADES` | england (marker): England's share at each grade, the latest year. |
| `DV-C1-RES-CUR-BAR` | england (marker) on each bar where a same-year England figure exists: points; the focused subject only on bands; none on Grade 4+ / A\*–E. |
| `DV-C1-RES-CUR-TABLE` | england as the "vs National" column; on Grade 4+ / A\*–E "vs last year" (self, earlier year; `R-PREV-YEAR-FALLBACK`). |
| `DV-C1-RES-TR-CHART` | Nothing beyond the rows (each category subject its own line). |
| `DV-C1-RES-TR-TABLE` | Nothing beyond the rows. |
| `DV-C1-RES-TR-MAP` | The page's comparator schools (the map's profiles), coloured by the map's own toggle. |
| `DV-C1-RES-TR-GEO-CHART` | self (line); la (line); england (line), on average points. The region is left off the chart only. |
| `DV-C1-RES-TR-GEO-TABLE` | self (row); la (row); region (row); england (row), on average points. |
| `DV-C1-CNT-CUR-DIST` | england (marker): England's share at each grade, the latest year; a grade England suppresses has none. |
| `DV-C1-CNT-TR-SPREAD` | self (line, earlier year): the same subject's spread in an earlier year (members' year menu; the year before by default). No England. |
| `DV-C1-CNT-TR-CHANGETABLE` | Nothing: each grade's count in the first and latest year, with the change. |
| `DV-C2-CUR-DONUT` | The focused subject's entries as a share of the **group's** total (self-inclusive). On Grade bands: the group's entries in the range, of all its graded entries. |
| `DV-C2-CUR-BARS` | The rows are the group; no marker. |
| `DV-C2-CUR-LIST` | The rows are the group. |
| `DV-C2-CUR-TABLE` | The group's per-subject average (category / allSubjects / selectedSubjects, as row "vs average", mean). |
| `DV-C2-TR-INDEXED` | The rows are the group, each its own line. On **All subjects** the card draws the focused subject against the All subjects average (dashed line, mean) only; fullscreen draws every line. |
| `DV-C2-TR-CHART` | As Indexed, on the Results measure. |
| `DV-C2-TR-ACTUAL` | As Indexed, at real values. |
| `DV-C2-TR-TABLE` | The rows are the group. |
| `DV-C2-TR-CHANGELIST` | The group's average (reference, mean): its change as a dashed line through the ranked rows. |
| `DV-C2-TR-CHANGETABLE` | The rows are the group. |
| `DV-C3-CUR-TILES` | **Ranking only:** the school's rank in the ranking's **whole population**, and that population's average (same year), on the ranking's own measure (the phase headline). |
| `DV-C3-CUR-MAP` | The set's schools, coloured by value (the accent scale); the rank is the map's own. |
| `DV-C3-CUR-BAR` | The set's schools as bars, the school picked out, no marker (the other bars are the comparison). On a ranking, on its own measure: the school against the population's average, two bars. |
| `DV-C3-CUR-RANKING` | The set's schools. |
| `DV-C3-TR-CHART` | self (line, accent) against the members' **vs:** choice: the set's average (savedSet / nearest, mean over the other schools with a figure that year) or one named school (chosenSchool). On a ranking, on its own measure: the population's average. |
| `DV-C3-TR-TABLE` | The set's schools as rows. |
| `DV-C3-TR-MAP` | The set's schools (never a ranking), coloured by the absolute change over the span (`trend_absolute`). |
| `DV-C3-TR-CHANGELIST` | The set's average (reference, mean over the other schools): its change as a dashed line. |
| `DV-C3-TR-CHANGETABLE` | The set's schools as rows. |
| `DV-C3-TR-CHANGEMAP` | The set's schools (never a ranking), coloured by the honest change: the fixed ±% scale on a count, the set's own range on points and rates. |


**0.7 admissions r2.** On an Admissions dashboard, "follows-page" means the focused **entry point** (the chips) and the top bar's filters (Day + boarding, All pupils, State + independent). The series come from `/api/admissions/*` (`src/lib/admissions/views-api.ts`).

| Preset | Follows-page resolves to |
|---|---|
| `DV-ADM-P-NOW` | The focused entry point's own cohort now, its change since 2019/20, girls and boys, day and boarding (whole school), the school page's Roll by phase. |
| `DV-ADM-P-PIPELINE` | The pool by entry year for the focused entry point over the lead's lists (else nearby schools), narrowed by the top bar; projection only when the member asks (11+). |
| `DV-ADM-P-FUNNEL` | Births in the LA blend → each kind of school's pool → the school's entry cohort, this September's entrants. |
| `DV-ADM-P-MAP` | The nearest rung's schools, sized by pupils at that age, coloured by their trend against the set. |
| `DV-ADM-P-TABLE` | The same schools as rows, with flag, distance, sector, gender and XS–XL. |
| `DV-ADM-P-SHAPE` | The school's profile, the feeders' local shape, and the rivals' shapes (described, not ranked). |
| `DV-ADM-P-ENTRY-LINE` | The school's entry-age cohort, 2019/20 on. |
| `DV-ADM-P-ENTRY-BARS` | As the line, as bars. |
| `DV-ADM-P-ENTRY-TABLE` | As the line, a row per year. |
| `DV-ADM-P-POOL-INDEXED` | The feeders' past pools, the LA and England at the same age, indexed to their first common year. |
| `DV-ADM-P-POOL-TABLE` | As indexed, actual figures. |
| `DV-ADM-P-AREA-POP` | The school page's Population trends in the area (ages 5–15). |
| `DV-ADM-P-HOLD-LINE` | The share needed to hold numbers steady, each future year, against the share now. |
| `DV-ADM-P-HOLD-TABLE` | As the line, with the pools. |
| `DV-ADM-M-NOW` | Rank at the entry age among the rivals, market share, its change since 2019/20, whole-school rank by roll. |
| `DV-ADM-M-DONUT` | The school's share of the group at the entry age. |
| `DV-ADM-M-BARS` | Each school's pupils at the entry age, share, trend, and results ranks in its region and England. |
| `DV-ADM-M-MAP` | The rivals, sized by pupils at the entry age. |
| `DV-ADM-M-TABLE` | The rivals as rows. |
| `DV-ADM-M-MOMENTUM` | Each rival's entry-age change against its results change since 2022/23, with its flags. |
| `DV-ADM-M-STRENGTHS` | Each subject area: rank among the rivals with it, gap to their average, its move, flags. |
| `DV-ADM-M-SHAPE` | The rivals' shapes (described, not ranked). |
| `DV-ADM-M-FLAGS` | Each rival's momentum flags with their figures. |
| `DV-ADM-M-VS-LINE` | The school's entry cohort against the rivals' average, indexed. |
| `DV-ADM-M-VS-BARS` | As the line, actual figures as bars. |
| `DV-ADM-M-ACAD-RANK` | The overall rank among the rivals for the entry point's stage, then where the school leads and trails. |
| `DV-ADM-M-ACAD-NUM` | Each rival's headline figure and rank. |
| `DV-ADM-M-ACAD-CHANGE` | Each rival's headline change since 2022/23. |
| `DV-ADM-M-SHARE-LINE` | The school's share of the group at the entry age, 2019/20 on. |
| `DV-ADM-M-SHARE-NUM` | As the line, with the counts. |
| `DV-ADM-M-SHARE-RANKS` | The school's rank in the group each year. |
| `DV-ADM-M-SHARE-CHANGE` | The change since 2019/20 in pupils and share. |
| `DV-ADM-M-ROLL-LINE` | Whole-school rolls: the school and the rivals. |

0.8 SMT round 1: the SMT views follow the level chips (Whole school, a phase, a subject area under it) and the dashboard's one comparison set.

| Preset | What follows-page draws |
|---|---|
| `DV-SMT-O-NOW` | The school now: roll and its change since 2019/20, girls and boys (or day and boarding), each phase's headline with its national rank, A-level value added, Progress 8 or its reason, XS-XL by phase. |
| `DV-SMT-O-SCORECARD` | Each headline: the school, its rank in the set (schools with that result), the region, England, since 2022/23; IGCSE rows not ranked; the flags line. |
| `DV-SMT-O-MAP` | The school and the comparison set's schools, located. |
| `DV-SMT-O-FLAGS` | The school's own flags (roll falling three years, results against the set's middle, the entry cohort shrinking), with their figures. |
| `DV-SMT-O-ROLL-LINE` | The roll (day and boarding at a boarding school) indexed to 100 against the LA and England (pupils aged 5-15). |
| `DV-SMT-O-ROLL-TABLE` | As the line, year by year. |
| `DV-SMT-O-RESULTS-LINE` | Each headline against the set's middle half, 2021/22 shaded. |
| `DV-SMT-O-RESULTS-TABLE` | As the line, year by year, with the schools behind each band. |
| `DV-SMT-O-MARKET-LINE` | Market share at 11+ against the largest rival, from Admissions (read-only; empty with the reason without rivals). |
| `DV-SMT-O-MARKET-TABLE` | As the line, year by year. |
| `DV-SMT-A-NOW` | The level's headlines (both phases at Whole school), value added with its reason, the grade profile. |
| `DV-SMT-A-AREAS` | Each subject area against the set: rank, gap to the set's average, its move since 2022/23, flags. |
| `DV-SMT-A-SUBJECTS` | The area's subjects: entries, average, rank in the set and England, since 2022/23, the subject explorer link. |
| `DV-SMT-A-VA` | A-level value added by qualification type and by subject, with intervals; Progress 8 or its reason. |
| `DV-SMT-A-GRADES` | The grade profile in bands, latest year. |
| `DV-SMT-A-TREND-LINE` | The level's headline (or the area's average) against the set's middle half. |
| `DV-SMT-A-TREND-TABLE` | As the line, year by year. |
| `DV-SMT-A-BANDS` | Reserved: results by band arrive with their own round. |
| `DV-SMT-A-MIX` | Each area's (or subject's) share of the entries, year by year. |
| `DV-SMT-A-MIX-TABLE` | As the columns, year by year. |

0.8 SMT round 2: Pupils and Context follow the level too (Pupils highlights the level's ages); Context follows its Area pill (around the school, or the LA).

| Preset | What follows-page draws |
|---|---|
| `DV-SMT-P-NOW` | Your pupils now: roll and change since 2019/20, girls and boys (mixed), day and boarding (boarding), staying on at 16, XS-XL by phase, the LA context line. |
| `DV-SMT-P-SHAPE` | Pupils in each year group, the shape and since when, the shapes around (the LA's same-range schools, the set, staying on in the set's sixth forms); never ranked. |
| `DV-SMT-P-ENTRIES` | Each Admissions entry point: its cohort now and its next pool; read-only. |
| `DV-SMT-P-LEAVING` | Year 11 to Year 12, year by year: staying on and net leavers. |
| `DV-SMT-P-MARKET` | Market share at 11+, from Admissions; read-only. |
| `DV-SMT-P-PHASES` | Each phase's roll and England's pupils aged 5-15, indexed to 100. |
| `DV-SMT-P-PHASES-TABLE` | As the line, year by year. |
| `DV-SMT-P-POOL` | Admissions' pool for the main entry point: counted, then from births. |
| `DV-SMT-P-AREA` | The LA's residents aged 5-15 (or the level's ages), ONS mid-year estimates, year by year. |
| `DV-SMT-C-NOW` | The area now: children of the level's ages living within 5 miles (or in the LA), the census pupils beside them, births, the projection for the same ages, schools nearby, the place line, and Social context (deprivation, FSM). |
| `DV-SMT-C-MAP` | Neighbourhoods within 5 miles and a ring, shaded by children per hectare, IMD or IDACI, or schools coloured by FSM; the LA shading before the boundaries are loaded. |
| `DV-SMT-C-BYAGE` | Residents by single year of age 0-18 within 5 miles (or in the LA), the level's ages highlighted. |
| `DV-SMT-C-BIRTHS` | Births in the LA and the ONS projection of the level's ages. |
| `DV-SMT-C-NEARBY` | Children of the level's ages within 5 miles over time, indexed, against the LA and England. |
| `DV-SMT-C-BIRTHS-INDEXED` | Births, the LA against England, 2012 = 100. |
| `DV-SMT-C-BIRTHS-TABLE` | As the line, year by year. |
| `DV-SMT-C-PROJECTION` | The LA's residents of the level's ages: estimates, then ONS's projection, dashed. |
| `DV-SMT-C-AGES` | Residents by single year of age 0-18 within 5 miles (or in the LA). |

## The awkward cases ([review])

1. **The geography views have their own fetch.**
   - Affects `DV-C1-CAND-TR-GEO-*` and `DV-C1-RES-TR-GEO-*`.
   - They read `useSubjectGeography` (`/api/teacher/subject-geography`), not the page's data, and draw "not applicable" / "loading" notes of their own.
   - **In the spec they are ordinary data:** per year, no rows; at Candidates `entries: "points-eligible"`; their LA / region / England are compare series (follows-page resolves to them).
   - **S3:** the series builder picks that fetcher for any `la` / `region` / `england` series. The host's gating stays as rules: at GCSE, GCSE (9–1) full course only (`R-KS4-POINTS-GCSE-FULL`, `R-GEO-POINTS-ELIGIBLE`); points only at Results (`R-NO-GRADE-RATE-GEO`); the exact qualification at Post-16 (`R-KS5-ENGLAND-EXACT`).
   - **The Results ones keep `resultsMeasures` points / threshold / bands,** as round 3 recorded them: on Grade 4+ and bands they show the not-applicable note today. D7's greying will later say "points only" in step 3; no figure changes here.
   - S1 made their titles distinct (pinch point 3). The table's Title column reads the dataview's template, so it follows.
2. **"Grades (pick a range)" (`DV-C1-RES-CUR-GRADES`) loses its range picking to D3, and stays as "Grade distribution".**
   - Translated as a spread (per grade, England ticks, `memberSpan: "page-range"`) so the four dashboards still load and draw it in S2.
   - S5 moves its range picking to the top bar's grade band control and keeps the instance, renamed "Grade distribution": the focused subject's spread with the top bar's band shaded, read-only. The instances stay in the configs, so no re-seed is needed and members' open-view state survives.
   - Its preset stays registered, so old configs and meetings that name it keep loading (D9).
3. **`DV-C1-CNT-*`, the Grade counts views, are fixed to England, with a span highlight.**
   - Per grade, the focused subject, the latest year.
   - Current's England ticks are `follows-page` resolving to `england (marker)`. England is the only area figure for grades (`R-BANDS-ENGLAND-BENCH`), and none for a grade fewer than 5 schools publish.
   - The click-two-grades highlight is look-only (`memberSpan: "highlight"`): it changes no figure.
   - Spread by year compares the subject with itself (`at: "earlier-year"`). The change table is per grade over the first and latest year.
   - `resultsMeasures: counts` only, as round 3.
4. **The change map and the trend map.**
   - Both are per school over the members' span, on the set's schools, and `variants.comparator: schools` (never a ranking, `R-RANKING-SAMPLE`).
   - They differ only in **which change**: the Trend map is `change: "absolute"` (the plain difference, even on entries); the Change map the honest change (% on a count).
   - The colour mode is `look.colour: "change"`. The scale follows the change kind, as today (`forcedColourMode` trend / trend_absolute).
   - Column 1's Results Map (`DV-C1-RES-TR-MAP`) is a third map: the page's comparator schools, coloured by the map's own toggle (`colour: "member"`).
5. **Context's donut, bars and lists follow the pill.**
   - `rows: "follows-page"` (the group is the category, all subjects or the selected subjects), `source: "follows-page"`.
   - The donut is entries (Candidates), or bands with a range (`R-DONUT-COUNTS-ONLY`). On points and rates the host keeps it disabled. Its `resultsMeasures` stay unset (all four), as round 3 left Context's views.
   - On Grade counts, or bands without a range, Context falls back to points (`R-MEASURE-FALLBACK`). That stays a host rule.
6. **Comparisons' tiles are ranking-set only.**
   - `DV-C3-CUR-TILES` is `subject: "whole-school"` (always the ranking's own headline measure) and `variants.comparator: ranking`.
   - Its figures come from the ranking's whole population, not the sampled schools, so follows-page is the only honest compare.
7. **Candidates' ranked change (`DV-C1-CAND-TR-CHANGELIST`, and `-CHANGETABLE`) is still a draft.**
   - Both are unreachable today: Column 1's % change half is always the geography view where a school and subject exist.
   - Translated as written (a ranked change of the category's subjects against the category average; a change table), so S4's chooser can offer them honestly.
   - **On no dashboard.**

## Where specs live in a config (schema_version 2)

- **A view instance keeps its id and gains `spec`:** `{ id, kind: "view", dataview, spec, params?, title?, resultsMeasures?, variants? }`.
  - `spec.preset` is the old dataview id, and `validateConfig` requires it to equal `dataview`.
  - `dataview` stays as the key the hosts draw by until S3's renderer retires it.
- **Per-instance settings stay where they were:**
  - `params` (Customise's choices, round 3's Figures);
  - `title` (the editor's title);
  - `resultsMeasures` / `variants` (an instance's narrowing of the preset's offer);
  - the panel's `defaultView` / `defaultViewByResults` / `defaultViewByState`.
- **D10:**
  - `panelSignature` is built from each instance's `spec.preset`, so `carryUserState` keeps members' open rows and chosen views across the re-seed (the presets equal the old dataview ids).
  - `usePlanViewParams` looks a view's params up by **instance id** (the panel's showing instance, from `ColumnPanels`), not by (column, dataview).
- **Meetings and custom dashboards:** a stored `schema_version: 1` config is **converted on read** (`upgradeConfig`: each view instance, slide slots included, gains its preset's spec; nothing else changes). Text slots and pinned settings pass through untouched. Every store read goes through it: `dashboards-store` (versions, drafts, history), `meeting-store`, the library's `configsFor`.
- **Members' VicData pages are not upgraded on read (D9).** `published-vicdata.ts` draws the code copy for any published version that isn't schema_version 2 (and skips a v1 draft in Preview draft). The re-seed (`scripts/dashboards-seed-sql.ts`) publishes the four in v2 over the v1 rows, idempotently, and clears only old-format drafts.
- **The editor's store reads convert VicData's v1 rows too,** so the editor and History open a v1 version as the v2 it equals, rather than as the code copy.
