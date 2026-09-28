# Teacher view Trends row merge and view titles: build report (v1)

Prompt: `vicdata_phase3_teacher_view_trends_row_merge_claude_code_prompt_v1.md` (read in full), with its brief. Built from `f8b28c3`, code commit `e5e2b82`. **Committed locally, not pushed.**

`tsc`, `eslint` (the same 7 problems as before) and `next build` are clean.

## Drift from the prompt's grounding

- **Four column components, not three.** `GradeCountsPanels`, built this morning in the grade bands round, also had a Trend and a % Change panel, so it got the same merge. Its two views each had a single view and no rail before, so they now share a new two-button rail: "Spread by year" and "Change table".
- **Private notes are stored per panel** (`{phase}:{column}:{panel}`), so a note on a % Change panel would have become unreachable. There are none: production has 3 notes in total, none on a Trend or % Change panel. Nothing needed migrating.
- **Column 1's Trend map shows the subject by school, not change.** It is value-coloured by default, with the map's own Grade band / Trends toggle. So its title says what it shows, "{Subject} at each comparator school, on the map", rather than the prompt's "change by school".
- **Comparisons' Trend chart** had no title either, and is not on the prompt's list. The verify step asks for every view to be titled, so it now has one.

## The merge

- **Panel model:** `PanelId` is `"current" | "trend"`, and `PANEL_ORDER` follows. A saved `"change"` id is dropped by `panelsFrom`'s existing filter (no migration, as the brief decided).
- **One view state per column,** covering both halves. The rail is Trend's buttons, then % Change's.
- **Panel fields.** The prompt says to default to Trend's version of each field. Where the two panels' versions differ, the merged panel instead **shows the version belonging to the view on screen**: the "From" menu, the fullscreen question, the summary sentence and the source, plus Comparisons' fullscreen invitation. That way neither panel's sentence is dropped. The "vs:" pill belongs to Trend's chart, so it shows only on Trend's views.
- **Always Trend's:** the tag ("Trends"), the direction flag, the Trend-line toggle (disabled on % Change's views), the subject legend and the collapsed bar's figure.
  - **Worth your call:** the collapsed bar used to show both the direction word and, on the % Change bar, a figure like "−12%". Only the direction word is left. The % figure could join it.
- **Unique labels:**

| Column | Rail |
|---|---|
| Candidates | Indexed · Actual · Trend table · Ranked change (or Area chart) · Change table |
| Results / Context | Indexed · Actual (headcounts) or Chart · Trend table · Map · Ranked change (or Area chart) · Change table |
| Comparisons | Chart · Trend table · Trend map · Ranked bars · Change table · Change map |
| Grade counts | Spread by year · Change table |

  - The geography comparison's "Chart" became **"Area chart"**, because Results' Trend already has a "Chart". Candidates uses the same name for consistency.
- **Reachability.** Comparisons' Trend buttons used to render only once a line or map was possible, because the table was the panel's only view. In a merged rail that would strand anyone on a % Change view, so Trend's buttons now always render. The unused classic path (`changeScope="all"`) had no rail at all; it now has a two-button one ("Trend chart", "Change chart").

## Titles

`ViewTitle` in `SeriesViews.tsx` is `TrendScaleTitle`'s style, generalised. Every view has one line above it, naming the scope (the category, Context's group, or the comparison set) plus the view's shape. The scope wording matches Candidates' existing "Entries in {category}", and Results uses "Results in {category}".

The prompt asked both for Candidates' wording to be reused **and** for every title in a rail to be distinct. "Entries in Humanities & Social Sciences" over three different views is not distinct, so each title keeps that wording and adds the view's shape:

- `Results in Humanities & Social Sciences: % change since 2021/22, ranked`
- `Results in Humanities & Social Sciences: 2021/22 against the latest year, ranked by change`
- `Every school in the 10 nearest schools: Attainment 8, year by year`
- `% change in Attainment 8 since 2021/22, coloured by school` (and `Change in … coloured by school` on the Trend map)
- **Lone subject** (no category to name): `Entries by year, since 2020/21`, `Results by year, since 2021/22`

Kept exactly as they were: `TrendScaleTitle`'s indexed/actual sentences, and the geography views' own heading ("{subject} against the wider system").

## Checks

- **Headless preview** of the real `CandidatesPanels`, `SubjectPanels` (Results) and `ComparisonsPanels`, side by side. They ran on The Chase's real GCSE History category (with Geography and RS) and its real 10 nearest schools, clicking every button. Screenshots are in `docs/screenshots/trends_row_merge_v1/`, including the before, rendered from `f8b28c3`.
  - Every rail was read back from the page: no label repeats within a rail.
  - Every view has a title that identifies it without the rail.
  - Every old Trend and % Change view has a button.
  - A lone subject gets its fallback titles.
- **Not previewed:** Post-16, and Context, which are the same components as Results with a different scope line. `GradeCountsPanels`' new rail is type-checked and built but was not re-screenshotted.

## For Guy's live look (after a push, hard-reload)

Each column now has two rows, Current and Trends. Click through each Trends rail on GCSE and Post-16. Each view should say what it is above it, and nothing from the old % Change panel should be missing. Then decide, column by column, which views to keep.
