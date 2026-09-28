# Teacher view Current panel rework, round 1: build report (v1)

Prompt: `vicdata_phase3_teacher_view_current_panel_rework_round1_claude_code_prompt_v1.md`, with its brief. Built on `79e0de1`. **Not committed.**

`tsc` is clean. `eslint src` shows the same 7 problems as before, none in these files. `next build` succeeds.

## Step 0: re-grounding

Nothing had moved since the prompt was written:
- `currentLabel` is still a string prop on all three components.
- `CompareAgainstId` was still `"whole" | "selected"`.
- Each column still built `current.tag` from `currentLabel` plus `academicYearLabel(latest)`. Context's year sat in a `FromYearMenu` in `afterTag`.
- The page resolves Context's starting group from the saved setting at `page.tsx` (`readSetting(columns, againstKey("context"))`). There is no default prop.

## What changed

- **Tag, all columns.** Every Current tag is now `"Current"`. The date moves into `afterTag` as plain, regular-weight "Data 2024/25", through a new shared `DataDate` in `ColumnPanels.tsx`.
  - Context keeps its year menu, so it reads "Data 2024/25 ▾".
  - `currentLabel` is kept on every component and still passed by the page. It no longer builds the tag. Column 1 uses it in its title ("{subject} Candidates"). Context and Comparisons don't read it yet, so it's in their prop types but not destructured, which keeps `eslint` clean.
- **Column 1, Candidates variant.**
  - Current is Number tiles only, with no rail. The `view` state, the Bar chart and Ranked list branches, and the `titled()` wrapper are gone.
  - Title: "{subject} Candidates: {date}", e.g. "Maths (General) Candidates: 2024/25".
  - The Results variant keeps its own views. Only its tag changed.
- **Ranked list is now a shared component.** Its JSX moved as it was into `RankedList.tsx`, so Context draws the same list.
  - It says "231 candidates" on Entries, and just the figure on other measures.
  - It marks the focused row, so a whole-school list scrolls to it.
- **Column 2, Context.**
  - Current's Bar chart is now Column 1's `VerticalBars`, and Ranked list is `RankedList`. Both take a new `rankedViews` prop, fed by Context's own subjects in Current's order and colours.
  - The Bar chart is the default view.
  - The rail is Donut, Bar chart, Ranked list, Sortable table.
- **Subject category group.**
  - `CompareAgainstId` gains `"category"`, shown as "Subject category", first in the menu. It's the default: nothing saved, or a saved `"area"` from before S8, reads as it. A saved All or Selected choice stays.
  - With it chosen, Context's subjects are exactly `candidateItems`, the list Column 1 draws. The group's members, totals and averages come from those subjects' names. Nothing is fetched or derived a second way.
- **Titles.**
  - **Guy's:**
    - Column 1: "{subject} Candidates: {date}"
    - Donut: "Entries in {subject} as a proportion of {group}"
  - The group reads as the category name, "all subjects" or "your selected subjects" (the brief's wording).

## Provisional wording, to check with Guy

- **Context Bar chart, Ranked list and Sortable table:** "Entries by subject in {group}". On a Results measure, "Entries" becomes "Results".
- **Context donut on Grade bands** (the group's in-range entries, not the focused subject's): "Entries at {band} as a proportion of graded entries in {group}".
- **Comparisons, Map:** "{what} by school, on the map".
  - {what} is the chip's subject and measure ("Maths entries"), or the headline ("Attainment 8") when no chip is on.
- **Comparisons, Bar chart:** "Entries by school in the {set}", or "Results by school…" on a Results measure.
  - On a ranking set it's "{what}: {school} against the {set}'s average", because that chart is the school against the set average, not every school.
- **Comparisons, Ranking:** "Schools ranked by {what} in the {set}".
- **Comparisons, Number tiles** (ranking sets only): "{school}'s rank in the {set}: {ranking measure}".
  - This differs from the model's "{subject}'s rank": the tiles are always on the ranking's own headline measure, whatever subject chip is active.
- The set reads "the {set}", as the Trends titles already have it ("the 10 nearest schools").

## Calls made, worth a look

- **Context's old horizontal Bar chart is replaced, not kept beside the new one.** The brief says the two views are "additional". Keeping both would give two buttons both labelled "Bar chart", so Column 1's vertical `VerticalBars` took the Bar chart slot. Context's Sortable table stays, now with a table icon so it doesn't share the Ranked list's icon.
  - With a long list (All subjects), `VerticalBars` switches to horizontal rows by itself. See `after_whole_bars.png`.
- **Trends code is unchanged, but it reads the new default group.** No Trends line in any file changed.
  - Context's Trends reads whatever group is chosen, so with Subject category as the default it shows the category's subjects. Its card graph draws every line (as Selected does) rather than the whole-school two-line focus-vs-average (`cardTrend` is `focusVsGroup` for All subjects only).
  - Its scope title lowercases the group label ("Entries in sciences & maths"). That's the Trends code's own `toLowerCase()`, left alone this round.
  - The Current summary's benchmark noun keeps the category's own capitals.
- **Post-16:** the category's members are `candidateItems`' exact-qualification items. The group totals, though, add up every non-AS/AEA row of each subject name, the way the other two groups do. A subject taught in two qualifications of the same family would count both in the donut's total. This wasn't previewed.

## How it was checked

- **Headless preview** of the real `CandidatesPanels`, `SubjectPanels` (Context) and `ComparisonsPanels`, on The Chase's real GCSE Sciences & Maths data with Maths (General) in focus, and its real 10 nearest schools. It's the same unauthenticated harness as earlier rounds.
  - Context's props were built the way the page builds them for each group. The page's own default resolution wasn't exercised: it's type-checked and built, not clicked through.
- **Screenshots** are in `docs/screenshots/current_panel_rework_round1_v1/`:
  - `before_*`: Columns 1 and 2 before the change.
  - `after_default`, `after_list`, `after_donut`, `after_table`: Subject category.
  - `after_whole_*`, `after_selected_*`: the other two groups.
  - `after_comparisons_map`: Column 3.
- **Not previewed:** Results' Current (only its tag changed), Post-16, light theme and fullscreen.
