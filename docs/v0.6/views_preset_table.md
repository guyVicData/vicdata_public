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
| 15 | `DV-C1-RES-TR-MAP` | Map | **map** · colour: member | academic.results · follows · school · follows-page · actual · latest | points/threshold/bands | all | MapPinIcon | [subject] at each comparator school, on the map | GCSE R, Post-16 R |
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

## The awkward cases ([review])

1. **The geography views have their own fetch.**
   - Affects `DV-C1-CAND-TR-GEO-*` and `DV-C1-RES-TR-GEO-*`.
   - They read `useSubjectGeography` (`/api/teacher/subject-geography`), not the page's data, and draw "not applicable" / "loading" notes of their own.
   - **In the spec they are ordinary data:** per year, no rows; at Candidates `entries: "points-eligible"`; their LA / region / England are compare series (follows-page resolves to them).
   - **S3:** the series builder picks that fetcher for any `la` / `region` / `england` series. The host's gating stays as rules: at GCSE, GCSE (9–1) full course only (`R-KS4-POINTS-GCSE-FULL`, `R-GEO-POINTS-ELIGIBLE`); points only at Results (`R-NO-GRADE-RATE-GEO`); the exact qualification at Post-16 (`R-KS5-ENGLAND-EXACT`).
   - **The Results ones keep `resultsMeasures` points / threshold / bands,** as round 3 recorded them: on Grade 4+ and bands they show the not-applicable note today. D7's greying will later say "points only" in step 3; no figure changes here.
   - S1 made their titles distinct (pinch point 3). The table's Title column reads the dataview's template, so it follows.
2. **"Grades (pick a range)" (`DV-C1-RES-CUR-GRADES`) is retired by D3.**
   - Translated as a spread (per grade, England ticks, `memberSpan: "page-range"`) so the four dashboards still load and draw it in S2.
   - S5 moves its job to the top bar's range control and removes the instance.
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
