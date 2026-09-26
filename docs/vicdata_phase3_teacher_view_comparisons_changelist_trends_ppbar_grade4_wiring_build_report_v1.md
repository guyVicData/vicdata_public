# Teacher view: Comparisons % Change → ChangeList, Trends pp bars, Grade 4+ comparator data: build report (v1)

Three items, one commit each, all pushed. `tsc`, `eslint` (touched files) and `next build` are clean.

| Item | What | Commit |
|---|---|---|
| 1 | Comparisons % Change: ranked ChangeList of every school | `b3d2acb` |
| 2 | Trends short-span fallback: ranked bars in the measure's own units | `5fc54f9` |
| 3 | Comparisons on Grade 4+ / A*–E rate: real per-school rates | `0b872df` |

## 1. Comparisons % Change is a ChangeList

- **Chart view:** `ChangeChart` is replaced by `ChangeList`, built from `changeTable.series`, so it shows every school in the set with the same rows and span as the table.
  - The school's own row is `focusKey="own"`.
  - The dashed reference line is the set's average: the mean per year over the other schools, then its own `percentChange`. It does not come from `versusPct`.
  - The list scrolls inside `CentredOnTarget`, starting with the school's row in view.
- **Controls removed:** the "vs:" pill is gone from this panel, along with `changeVersusOpen` / `changeVersusRef` and their reset in `changeSet`. Trend keeps `versus`, `versusPill` and its own open flag.
- **Icon:** the chart icon is now the horizontal-bars icon ("Ranked bars") rather than vertical bars, matching Candidates' ChangeList.
- **`ChangeChart.tsx` stays:** SubjectPanels still renders it (Results' "all" scope).

**Judgement call (§D1):**
- **Caption sentence:** it used to compare against whatever "vs:" pointed at. With no selector on this panel, it now compares against the set's average. It reads "…has risen 6% since 2023/24, against a fall of 5% for the average across nearest 10 schools."

## 2. Trends short-span fallback is ranked pp bars

- **ChangeList is generalised:**
  - `ChangeRow.percent` becomes `value`, and `group.percent` becomes `group.value`.
  - A new `formatValue?: (v) => string` prop defaults to the old rounded, signed %.
  - Direction tone uses the rounded value only in the default % mode (so "+0%" stays flat). With a caller's formatter it uses the raw value, as TrendList did.
- **MultiTrend's fallback** (below `TREND_LINE_MIN_YEARS`) now renders a ChangeList:
  - rows use `value = changeOver(values)?.delta` and `formatValue = measure.formatDelta`;
  - there is no `group`.
  - This applies to every measure, not only the threshold one.
- **TrendList is deleted,** along with its `opacity()` helper and year legend.
- **Checked** in the headless card replica with the brief's Grade 4+ figures (nine subjects). The list is ranked Computer Science +20pp down to Photography −23pp. Maths (General) is picked out at +5pp (the whole-number fixtures give 5; live unrounded figures give +6pp). There's no scroll at card size.

**Flag, as asked: the prop fits, but the field rename touched every caller.**
- `formatValue` itself slots in cleanly: none of the three existing callers needed to pass it.
- But the brief's "a `value` field in place of `percent`" can't be done without touching callers.
- CandidatesPanels and SubjectPanels pass their `ChangeBar[]` straight in. `ChangeBar` is shared with ChangeChart and keeps `percent`.
- So each of the three call sites (Candidates, SubjectPanels, and Comparisons from item 1) now maps `{ key, label, colour, value: b.percent }` and passes `group.value`. That's a one-line change each, with no behaviour change.
- The alternative was keeping the field named `percent` and putting pp deltas in it, which I judged worse.

**Minor (§D2):** the fallback no longer has a year legend. The span shows in the panel's From menu and source line.

## 3. Comparisons on a grade threshold: real per-school rates

**Correction to the brief's grounding:** threshold mode's `SchoolSeries.results` was never empty. `comparatorSubjectSeries` always filled it with `avgPointScore`, and `comparisonsMeasure` was pinned to points. That's why points showed under the rate's name before the last round's note.

**Data path:**
- **New route `GET /api/teacher/comparator-grades?anchorUrn&urns&stage&subject`:**
  - Membership gate on `anchorUrn`, the same as `academic-schools`.
  - One `fetchSubjectLevelDataForSchools(urns, stage)` call, the same batched lookup the dashboard runs for the school itself. The anchor URN is always included.
  - Returns `gradeRowsByUrn`, filtered server-side to the requested subject.
- **Client helper:** `fetchComparatorGrades` in `src/lib/teacher-view-comparator-grades.ts`.
- **Checked directly against the data** (the fetch function run under `tsx` with the repo's env), for Maths (General), GCSE (9-1) Full Course, 2023/24 → 2024/25:

| School | 2023/24 | 2024/25 |
|---|---|---|
| The Chase | 77.5 | 83.1 |
| Dyson Perrins | 60.0 | 72.2 |
| Nunnery Wood | 81.6 | 76.1 |
| Blessed Edward Oldcorne | 83.5 | 83.2 |
| Hanley Castle | 77.9 | 80.0 |
| Christopher Whitehead | 73.9 | 70.0 |

  The Chase's +5.6pp matches Column 1's +6pp.

**Wiring:**
- `page.tsx` passes `threshold={{ subject, qualificationType, rateOf }}` to ComparisonsPanels. This happens only when Results is showing, the threshold measure is chosen and a subject is in focus (never KS2).
  - `rateOf` is `thresholdRate(rows, phase)?.rate`, the page's own scorer.
  - `comparisonsMeasure` now follows the Results toggle when a subject is focused.
- ComparisonsPanels fetches, caches by subject plus the set's URNs, and builds each school's rate per year. It filters rows to subject and qualification type, as `thresholdAt()` does.
- In threshold mode `seriesFor()` reads those rates, so Current (graph and ranking), Trend, % Change and both tables all use real rates.
- While the grades load, the panels show the existing "Loading…" state.

**Judgement calls (§D3), flagged rather than decided silently:**
- **The state and the fetch live in ComparisonsPanels, not `page.tsx` as the brief sketched.**
  - The page has an early return (`if (loading) …`) before the lines that work out the focused subject and measure, so a new `useEffect` can't go where those values exist.
  - This follows the pattern `useSubjectGeography` already uses: the hook lives in the panel component, and the page passes the inputs.
- **The request is subject-scoped, not "every subject for every school."**
  - Returning every subject's grade rows for a whole set would be tens of thousands of rows.
  - So each focused subject is one small request. Switching subjects means one more round trip, cached per subject plus URN set, most recent only.
- **It is sequenced after the map's profiles land, not fired beside them.**
  - The two lookups hit the same reference database.
  - `academic-subject-comparison` serialises them because running them together caused Postgres statement timeouts.
- **The note is narrower, at column level:**
  - A comparator with no grade rows for that subject and qualification simply drops out of the lists. That's the same existing rule as for points ("not listed for it").
  - The whole-column note now appears only when no comparator in the set has a rate: "None of the {set} publishes a grade 4+ rate for {subject}."
  - It also appears, with different wording, when the fetch fails: "…could not be loaded. Try again shortly." A failed request is not reported as missing data.
  - I did not add per-school notes.
- **The Map is not converted.** It is still coloured and ranked by average point score (it draws from `mapProfiles`), and its caption still describes that.
  - To avoid a points rank beside a rate, the Current panel's "N of M" ignores the map's rank in threshold mode and uses the rate ranking.
  - Converting the map itself (RankingsMap / AcademicMapView take profiles, not series) is separate work.

## Live checks for Guy (localhost is gated)

1. **Comparisons → Results → Av. Points → % Change, chart view.**
   - One row per school, with This school highlighted.
   - A dashed average line, and no "vs:" pill.
   - Order and figures match the table.
2. **Column 1 and Column 2 Trends on Grade 4+ rate.**
   - Ranked pp bars, with the focused subject coloured.
   - Av. Points Trends is still the line chart.
3. **Comparisons → Results → Grade 4+ rate → Maths (General).**
   - Graph, Ranking, Trend, % Change and both tables show real rates: The Chase 83% in 2024/25, +6pp.
   - A subject no comparator offers shows the note.
   - The Map view still shows points (§D3).
