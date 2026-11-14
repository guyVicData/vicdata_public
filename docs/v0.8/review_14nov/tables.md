# Tables and rankings review (main @ a648be5)

Read-only review. Scope: every table and ranking in Teacher (GCSE/Post-16), SMT, Admissions and Group pages (not the walks).
Evidence: code (paths below, relative to repo root) and screenshots in `docs/v0.8/` (front_door_2b, groups_r2, group_sets, non_mainstream_groups, smt_academic_r2, admissions_fb1).

Ranked by severity. For each: location, what's there, what's missing, and a fix.

---

## High

### H1. NM Schools table shows the FSM % that was just withheld under 10 pupils
- **Where:** `src/components/groups/dash/views.tsx:568` (NmSchoolsTable FSM cell) reads `r.fsm`, which is set from the raw figure at `src/lib/groups/dash.ts:777` (`fsm: (f ?? lastWith)?.fsm?.pct`).
- **What's there:** 45bfe9f withheld a school's FSM under `FSM_MIN_PUPILS` (10) in `placing.fsm` and `placingText` (`src/lib/groups/non-mainstream.ts:167`). The NM Schools table's FSM column doesn't read `placing`. It reads `r.fsm`, so a 2-pupil AP or nursery school in a special/AP trust or nursery federation still shows "0.0% (region 56.4%)". The FSM sort also places it.
- **Fix:** In `dash.ts:777`, set `fsm: null` and add `fsmWithheld: roll` when `roll < FSM_MIN_PUPILS` (use the same rule as `placingOf`). In the cell, show `too few pupils (n)` in italics instead of "—", and keep the region bracket. Add a test next to the Aspire one in `non-mainstream.test.ts` covering `schools.rows[].fsm`.

### H2. Group Schools table: "Headline" and "National" sort across mixed measures
- **Where:** `src/components/groups/dash/views.tsx:453-454, 475-477, 518-520`. Screenshot `groups_r2_screenshots/harris_schools_light_1440.png`.
- **What's there:** Under "All phases", one Headline column holds Att 8 (points), KS2 RWM (%) and A-level points per entry, depending on the row. Sorting by Headline puts 61.7 (KS2 %) next to 53.8 (Att 8). National ranks come from different populations (4,383 secondaries vs about 16k primaries), so sorting "National" by raw rank number has no meaning. The column header gives no year either.
- **Fix:** When focus is "all", turn off the Headline and National sorts, or sort within phase (group the rows by the headline's measure and sort inside each group). Put the measure and year in the header when focus is one phase (for example "Att 8, 2024/25"). Under "All phases", keep the measure label in the cell and add the year to the cell title.

### H3. Group Schools table: "In group", "Trend" and "VA" columns don't say what they are
- **Where:** `views.tsx:476-479, 518-520`. Same screenshot.
- **What's there:**
  - "In group" reads "11th of 30" for a 59-school trust. The 30 is the schools with that headline, which isn't said. Three schools that joined on 1 Sept 2026 show "—", with nothing to say why (they weren't members when the results were taken).
  - "Trend" is the 3-year roll change (`GROWING_SPAN`). It sits next to VA, so it reads as a results trend.
  - "VA" doesn't say whether it's Progress 8 or A-level VA, or which year.
- **Fix:** Rename the headers to "Rank in group (with headline)", "Roll, 3 yrs" and "VA (P8 / A-level)". Put each row's VA measure and year in its cell title (`r.va.measure`, `r.va.year` are already there). Where `inGroup` is null for a member who joined later, show "joined after results" in italics.

---

## Medium

### M1. Group side-by-side and "Against others": the rank doesn't name its measure, there's no year on results, and the school counts conflict
- **Where:** `src/components/groups/dash/views-sets.tsx:62-77`, `src/lib/groups/dash.ts:462-468` (`rankIn`), `views.tsx:139-143`. Screenshot `group_sets_screenshots/02-side-by-side-harris-1440-light.png`.
- **What's there:**
  - "1st of 13 MATs with 41+ schools" is the rank on the headline measure (Att 8), but nothing says so.
  - The results headers (ATT 8, A-LEVEL PTS, A-LEVEL VA) give their year only on hover.
  - The sub-line says "59 schools" (membership, `typeSize`), but the Schools column says 54, and Current says "54 of 55". There are three counts for one group with no key.
  - "Growing" has no span. It's 3 years ("since 2022/23" in Current), next to "Roll, 5 years".
  - The table can't be sorted.
- **Fix:** Have `rankIn` return `"1st of 13 MATs with 41+ schools on Att 8"`. Add the year under each results header (`yearOfCol`, as a second line). Rename the sub-line count "59 members" and the column "Schools counted". Rename the column "Growing, 3 yrs".

### M2. Cards cut ranked lists to the top N, so the highlighted school can drop out, and most cuts aren't stated
- **Where:** `src/components/groups/dash/views-r3.tsx:111` (SchoolsRanked, 12), `:196` (VA, 8), `:371` (LeavingAt16, 10), `:404` (MarketShare, 10), `:431` (Projection, 8).
- **What's there:** "Highlight a school" tints its row, but on the card that school isn't drawn if it ranks below the cut. Only SchoolsRanked says "Showing 12 of N".
- **Fix:** Use the Teacher pattern, `windowCut` from `src/lib/subject-ranking-view.ts`: top rows, then a "⋯" break, then the highlighted row. Add "Showing x of N" under each cut list.

### M3. Group Academic "Schools ranked" and VA tables: ranks have no N, and VA has no uncertainty or header
- **Where:** `views-r3.tsx:137` ("11th in group · 694th nat."), `:205-230` (VA tables with no `<thead>`).
- **What's there:** Neither rank gives "of N". The VA lists show bare ±0.xx with no 95% range or band, though SMT's RankTable shows them for the same DfE figures. There's no sort or order statement.
- **Fix:** Show `11th of 30 in group · 694th of 4,383 nat.` (the `of` values exist in `inGroup` and `national`). Give the VA tables a header (School / VA / 95% range) and order them highest first, saying so.

### M4. Admissions Rivals table: "Results" column and "#" are unexplained
- **Where:** `src/components/admissions/views/Tables.tsx:117, 124, 145`. Screenshot `admissions_fb1_screenshots/chase_light_f17_rivals_table.png`.
- **What's there:**
  - "877th in England" doesn't say which measure (Att 8? P8?), which year, or out of how many schools.
  - "#" is the rank by pupils at the entry age, which isn't said.
  - "Share" doesn't say what it's a share of.
  - "Size" (XL/L/M/S) has no key.
  - `e?.distanceKm ? … : "—"` turns a real 0.0 km into "—" (line 139).
- **Fix:** Name the header "Results (England rank, Att 8 2024/25)" from `rr.results.national` and put "of N" in the cell. Retitle "#" as "Rank by pupils aged 11". Use "Share of rivals' 11s". Add a size note on the (i). Use `e?.distanceKm != null`.

### M5. Teacher ranked % change lists rank tiny entry bases with no count
- **Where:** `src/lib/view-series/candidates.ts:153-176`, `src/lib/teacher-view-panels.ts:471` (`percentChange`, no minimum), `src/components/teacher/SeriesViews.tsx:183` (ChangeList, no n).
- **What's there:** "Entries: % change since 2021/22, ranked" puts a subject that went from 2 to 6 entries (+200%) top. There's no n, and `MINIMUM_SUBJECT_N` isn't applied.
- **Fix:** Pass the first and last counts into `ChangeRow` and show "2→6". Put rows whose base is under `MINIMUM_SUBJECT_N` below the others with a † and the existing small-cohort note, as SubjectTable does.

### M6. SMT Scorecard: region and England columns are ranks only, rank direction isn't stated, and the phone view drops the figure
- **Where:** `src/components/smt/views/Scorecard.tsx:21-30, 42-47, 83`. Screenshot `front_door_2b_screenshots/smt_overview_mid_1440.png`.
- **What's there:**
  - "597 of 1,631" for Roll doesn't say whether 1 is the largest.
  - There's no regional or England average or median beside the ranks, so you can't see how far apart they are.
  - The note "counts show how many schools in each set have that result" sits on the Flags line, where it reads as part of Flags.
  - Market share's "—" for region and England isn't explained.
  - On a phone, only "6 of 11" shows, with no value of your own.
- **Fix:** Add a header note "1 = highest". Move the counts note under the table. Put "n/a: rivals only" in the title of the market-share "—" cells. On a phone, show `581 · 6 of 11`. If `overview.ts` can supply the set median, add it to the cell title.

### M7. SMT Academic RankTable: the "England" column is a bare rank, and there's no cohort count except for shares
- **Where:** `src/components/smt/views/Academic.tsx:345, 348, 370`.
- **What's there:** The England column prints "424", which could be read as the England average. Entries only show for `unit === "share"`, so the Att 8, A-level points and VA rows have no pupil count to warn about small cohorts. The table can't be sorted.
- **Fix:** Rename the header "England rank" and print "424 of 2,536". Add a "Pupils" column for every unit if the board rows carry it (they don't today, so add it in the API).

### M8. RankedList doesn't highlight the focused subject
- **Where:** `src/components/teacher/RankedList.tsx:34, 50`.
- **What's there:** `focusKey` only sets `data-highlight`, which is used for scroll centring. No CSS targets it, so the focused subject looks like every other row. SortTable, YearTable and SchoolRankingTable all use `FEATURED_ROW_BG`.
- **Fix:** Add `data-featured-row` and `style={{ background: FEATURED_ROW_BG, color: FEATURED_ROW_ACCENT_TEXT }}` to the focused `<li>`.

---

## Low

- **L1. SMT Subject areas (entries mode): the "vs set" column has no unit, and "Size" is unexplained.** `Academic.tsx:449, 452, 501`, screenshot `smt_academic_r2_screenshots/after-AC-PM-Entries-light.png`. The column shows "−0.4" (percentage points) and Size is "—" throughout. Fix: format as `−0.4 pp` (use `fmtChangeAc(…, "share")`). Hide Size when every row is null, or key it.
- **L2. Group set trend large view: each group's value can be from a different year.** `views-sets.tsx:209, 244`. `last()` takes each group's latest non-null value with no year attached. Fix: show the year when it isn't the chart's final year (for example "48.6 (23/24)").
- **L3. Groups library card and group page: headline has no n, and the card has no year.** `src/components/groups/library/GroupLibrary.tsx:300` and `GroupLibraryPage.tsx:122`. "Secondary · Att 8 47.1, England 46.3" doesn't say how many schools have the figure or which year. The group page's schools table also has no per-school year and can't be sorted. Fix: add `· 2024/25 · 12 of 30 schools` (`headlineWords` has `period`).
- **L4. Group Pupils projection: the "Now" column has no year.** `views-r3.tsx:440, 449`. `r.latestYear` is available but not shown. Fix: use the header "Now (2025)", or put the year in the cell.
- **L5. Group MarketShare: no census year in the title, and the LA count only appears on hover.** `views-r3.tsx:404-424`. Fix: add `· Jan 2026 census` to the title.
- **L6. Admissions Share/Rank table: the "Group" header collides with the Group product.** `Tables.tsx:205, 219`. Fix: rename it "Rivals' total".
- **L7. Teacher Comparisons table: "Result" doesn't say its unit, there's no set-average row, and the "too few entries" rows don't state the threshold.** `ComparisonsPanels.tsx:631-636`, `SchoolRankingTable.tsx:120`. Fix: use `measure.label` as the value heading (for example "Avg points"), add a muted footer row "Set average x.x" (`rankingAverageAt(latest)`), and set the cell title to `fewer than ${MINIMUM_SUBJECT_N} entries`.
- **L8. NM tables: compact mode drops the school and pupil counts, and there's no census year.** `views-nm.tsx:75-77`. Fix: keep "Schools" in compact mode, and add "Jan 2026 census" to the "Roll, 1 year" and FSM headers or the table title.
- **L9. SMT boarders and Leaving-at-16 year tables drop the comparator that the chart beside them draws.** `src/components/smt/views/Pupils.tsx:166-190, 326-345`. Fix: add a "Set median" column (the series exists, `d.set.trend`).
- **L10. YearTable rank: the leading-rank column has no heading, and the windowed national rank has no N.** `SeriesViews.tsx:564, 610`. Fix: put the population N in the column's `aria-label` and title (for example "Rank of 3,412"). The "n" header should say "entries".

## Repeated information on the same page
- **SMT Overview:** the Current tiles (Roll 581, points per entry 39.95 "7th of 10", VA +0.09) repeat the Scorecard rows beside them (`front_door_2b_screenshots/smt_overview_mid_1440.png`). Fix: drop the rank sub-line from the tiles, or drop those rows' "You" column in favour of the tiles.
- **Group Overview:** the Current tile "Schools growing 28 of 50" repeats the Against others "Growing 56%" for the same group (`group_sets_screenshots/02-…`). Acceptable, but label both "3 yrs" so they visibly match.
- **Group Academic:** AcademicNow's "side by side" block (`views-r3.tsx:46-72`) repeats the first results column of the Against others side-by-side table on Overview. It's on a different tab, so this is acceptable.

## Checked and fine
- **SMT RollTable and BandTable:** pupils and index in separate labelled columns, with year and set n.
- **Admissions FeederTable:** span in the title and a total for the whole set. The base count is on hover only, which is acceptable.
- **SubjectTable:** the † small-cohort note.
- **Teacher windowed rankings:** the title names the population.
- **NM Against:** the "too few" pool cells are suppressed and explained.
- **NM "9th highest FSM of 11":** direction stated.
