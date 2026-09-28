# Grade bands and counts, Teacher view frontend: build report (v1)

Prompt: `vicdata_phase3_grade_bands_frontend_claude_code_prompt_v1.md` (read in full), with the build brief. Built from `17b1d4a`. **Committed locally, not pushed.**

| Commit | What |
|---|---|
| `4b6821c` | Data layer: `bandRate`, the range and its presets, the two measures, and the per-grade benchmark route, fetcher and hook |
| `54d99dc` | `GradeDistribution`, Grade bands across Column 1, Comparisons and Context, and Grade counts in Column 1 |
| (this commit) | This report, the round's docs and screenshots |

`tsc`, `eslint` (the same 7 problems as before) and `next build` are clean on both commits.

## Where the prompt's grounding differed from the code

- **Comparisons does not rank through `rankingSet`.** That is snagging round 1's national/regional ranking population, and it ranks on the phase headline only. Grade 4+ in Comparisons works through the `threshold` prop instead: each comparator's grade counts come from `/api/teacher/comparator-grades` and are scored by `rateOf`. Grade bands uses that exact mechanism with `bandRate` as `rateOf`, so the ranking, the average, thin-set handling and the own-school highlight are the threshold measure's own. No second mechanism was built.
- **Grade "X"** (flagged in the backend round) is already in `NON_GRADE_VALUES`, so it is left out of every band and every distribution, as `thresholdRate` leaves it out.
- **England suppression.** The existing `subject-geography` route asks for England with `minSchoolCount: 1`. As the prompt instructs, the grade route never lowers the RPC's 5-school minimum, England included. A grade England has no row for shows no tick, and the legend says why.

## What was built

- **`subject-grades.ts`** gains the following, next to `thresholdRate`:
  - `bestScale`, shared with `gradeOrderFrom`, so "which scale" has one answer;
  - `GradeRange` (a scale by identity, plus a top and bottom grade, inclusive);
  - `presetsFor`: 4–9 and 7–9, on GCSE 9-1 only;
  - `rangeLabel` and `spanBetween`;
  - **`bandRate`**, the one rate function for a school's own rows, a comparator's, and the LA/region/England rows.
  - `bandRate` returns no figure for rows on a different scale from the range's, the same way `thresholdRate` returns none for vocational scales. So a Double Award or IB subject is never scored as 0% on a GCSE span.
- **Measures:** `bands` (a rate, like `threshold`) and `counts` (entries). "Coming soon" is emptied.
- **`/api/teacher/subject-grade-geography`**, with `fetchSubjectGradeGeography` and `useSubjectGradeGeography`. It mirrors `subject-geography`: the same gate, the same LA/region resolution, and one lookup per grouping in series. It returns every grade's own row (`p_grade` null) and sums nothing.
- **`GradeDistribution`:** one row per grade in scale order.
  - Each grade is a real `<button>`: one click starts a range, the next click ends it, in either order. A click with no range pending starts a new one.
  - The bar is the school's share of its graded entries (with the count beside it); the tick is England's share.
- **Grade bands:**
  - **One range per dashboard,** saved as a column setting like the measure, so Comparisons and Context read the same span. It is kept only while both ends are grades on the focused subject's scale.
  - **Default:** the 7–9 preset on GCSE 9-1. On any other scale there is no range, and Current says "Pick a range to see a rate" rather than showing an invented band.
  - **Column 1 Results:**
    - preset chips and a Custom button under the header;
    - a Grades view to click out a span;
    - tiles for the rate, the count in range, England's rate on the span, and the gap;
    - Trend and % change on the range's rate over the years that have grades (2023/24 on).
  - **Comparisons:** every comparator is scored on the range through the threshold mechanism above.
  - **Context:** subjects are compared on the range (a mean per qualification, as the threshold measure does). Its donut shows the group's entries in the range as a share of all its graded entries, self-inclusive, with qualifications on other scales left out of both sides.
- **Grade counts (`GradeCountsPanels`):** Column 1's own three panels, because a distribution has no single figure.
  - **Current:** the distribution against England, with an ad-hoc highlight (same two clicks) and a Clear button.
  - **Trend:** this year's spread against a chosen earlier year (`FromYearMenu`), grade by grade.
  - **% change:** each grade's count from the chosen year to the latest, in grade order (`YearTable` with its change column, not `ChangeList`, which would re-sort by size of change).

## Judgement calls to check

1. **Grade counts in Context and Comparisons,** and Grade bands before a range is picked, fall back to **average point score**, and Context's note says so. Grade counts has no single figure to rank schools or compare subjects on. The prompt deferred a Comparisons view for counts; this is that deferral made explicit.
2. **The benchmark shown is England's.** LA and region are fetched in the same payload but not drawn yet, because Results already reads against England. They are ready to surface.
3. **Peers carry no England rate on Grade bands,** only the focused subject does, because only its geography is fetched. That matches the threshold measure, which has none at all. The table's "vs National" column shows "—" for peers.
4. **A pending first click** is shown as a one-grade range (the tag reads "Grade 6"), so the figures follow the click straight away.
5. **The range resets to the scale's default** when the focus moves to a subject on a different scale. It is saved and restored while the scale matches.
6. **No presets beyond GCSE 9-1,** as instructed. Double Award, A level, IB, vocational, Pre-U and T Level are custom-range only.

## Checks

- **Real data, through the app's own functions:**
  - The Chase GCSE History 2024: grades 7–9 **34.1%** (45 of 132) against England **26.6%** (76,171 of 286,338); grades 4–9 **75.8%** against **64.6%**.
  - Asked for GCSE 7–9, a BTEC returns no figure (not 0%).
- **Headless preview** of the real `SubjectPanels` and `GradeCountsPanels`, on The Chase's real grade rows and England's real per-grade rows (the route stubbed with them). Screenshots are in `docs/screenshots/grade_bands_v1/`:
  - Grade bands: the default tiles (34% against 27%, +7pp), the Grades view, a custom 5–8 span, the 4–9 preset (76% against 65%, +11pp), and a pending first click.
  - Grade counts: the highlight and Clear, Trend (2024/25 against 2023/24), % change in grade order, a BTEC on its own scale (*2 … P1 U, 2023 only), and the light theme.
  - **Fixed from the preview:** the Grades view had the category heading; the Grade counts list overflowed its card.
- **Not checked:** Comparisons and Context on Grade bands, which need the full page and a signed-in session. Their wiring is the existing threshold path and the existing donut, with the rate swapped.

## For Guy's live look (after a push, hard-reload)

The Chase, GCSE, Results, History focused:

1. **Switch measure → Grade bands.** You should see grades 7–9 by default: 34%, 45 of 132, England 27%, +7pp. Try the 4–9 chip. Then Custom… and click 5, then 8.
2. **Comparisons:** with History's chip, the set is ranked on the same span, and changing the span re-ranks it.
3. **Context:** subjects on the span; the donut shows the group's entries at grades 7–9.
4. **Focus a BTEC subject:** no presets, and "Pick a range" until you click two grades.
5. **Switch measure → Grade counts:** the distribution and highlight, Trend against 2023/24, and each grade's change.
