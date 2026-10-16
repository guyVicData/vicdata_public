# VicData 0.8: year rules leftovers

Report for `docs/v0.8/vicdata_0_8_year_rules_leftovers_claude_code_prompt_v1.md`, branch `v0.8-year-rules-leftovers` from `main` `10dba8e`, 16 Oct 2026. Worktree `~/dev/vicdata_public_leftovers` (other sessions use `~/dev/vicdata_public`). No database writes.

**In one line:** every entries view now starts at the first year with entries (2020/21); the Data View's subject-mode "Candidates, % change" and its set average are fixed; "−0" is gone app-wide through one formatter; the unused round-5 meetings catalogue is deleted. Headcounts are unchanged: the roll views disagree, so I stopped and asked, and Guy said to leave item 4.

| Check | Result |
|---|---|
| tsc, eslint, `next build` | clean (eslint: 0 errors, the 2 existing warnings) |
| Unit tests (every `src/**/*.test.ts`, with `.env`) | **441 / 441**; catalogue unit tests **77 / 77** |
| Rule tests (production, read-only) | **103 pass, 0 fail** (MANUAL 15, NONE 19, SUPERSEDED 4). 3 hit statement timeouts on the full run and passed on rerun. Includes the 2 new rules and 3 updated ones. |
| PGlite (RLS, usage log, every `supabase/tests/*.mjs`) | **17 / 17** files |
| Teacher parity | **2,875 pairs: 2,874 identical + 1 noise**; fixtures byte-identical between the trees. One map PNG was flagged on the first run and was identical on a rerun of its case set (timing). |
| Public page SSR | identical (137625, 117037) |
| Admissions parity | 328 pairs: 308 identical, 20 differ, all the zero rule (§4) |
| SMT parity | Overview, Pupils and Home byte-identical; every Academic difference is the entries mix gaining 2020/21 |
| Groups parity | group dashboards 176 / 176 identical |
| Data View | Rankings identical; Graphs differ only in the zero rule and the subject-mode Candidates change (§4) |

## 1. Entries: the first year with data, everywhere (item 1)

**What the data says.** The subject rollup holds entry totals from **2020/21 at both GCSE and Post-16** (checked on 137625, 117037 and 100053 GCSE; 117037, 130432 and 118952 Post-16); points start in 2021/22 at both. One helper reads it: `years.ts` `entriesFirstPeriod(periods)` and `changeStartFor("entries" | "results", periods)`. No year is written down.

**A correction first.** Last round's report (call 5) said Teacher's Candidates panels started at 2021/22. That was wrong. They already read the rollup's entry totals with no first-year filter. On The Chase GCSE History, the trend, the year table and the change read "From 2020/21", +29%, and the ranked list agrees. I stopped and asked; Guy said to fix the real gaps.

| Entries view | Before | Now |
|---|---|---|
| Teacher Candidates: year table, trend, % change, ranking | from 2020/21 already (`trimToData` over every year the headline holds) | unchanged |
| Teacher Candidates: against LA, region and England | from 2021/22: the area totals start there | unchanged. An app change can't add a year the area tables don't hold (logged). |
| Subject ranking, entries change | from the first year with data (last round) | same rule, now through `changeStartFor` |
| Data View, "Candidates, % change", category mode | first to last year with entries (2020/21) | same, through `entriesFirstPeriod` |
| **Data View, "Candidates, % change", subject mode** (and the deep dive's tile) | **raw entry facts: from 2023/24** | **the rollup's entries, from 2020/21**, where the rollup describes that row alone (the whole subject, a GCSE subject under one qualification, a Post-16 row's own bucket); otherwise the raw facts as before |
| **SMT Academic, entries mix** (chart and table) | **from 2021/22** (`HISTORIC_GRADE_FROM`) | **from the first year with entries (2020/21)** |
| Public school page | no entries | — |
| Group dashboards, Admissions | no entries series (entries only as a minimum-entries gate) | — |

- **Grades and points are unchanged:** change from 2022/23, drawn from 2021/22 with the note.
- **No view mixes entries and 2020/21 grades.** 2020/21 appears only on entries views, so no "–" cells were needed. The SMT Subjects table puts entries beside grades, but shows the latest year only.
- **Six years fit.** I found no five-year limit on any entries view. Teacher's year table card shows the first and latest years plus "+4 more years"; "years down" shows all six at 390 (screenshot). The SMT mix draws one flexible column per year. The trend rules hold: R-TREND-LINE-4YR, and the 2021/22 note on points only.

## 2. Four small fixes (item 2)

1. **Set average on "Candidates, % change"** (Data View, subject mode). It summed the comparators' latest entries and drew the sum as a %. The Chase's Humanities set read "+1067% / +1010% / +773%". It is now the average of each comparator's own change from the first year with entries: +1% / +23% / +10%.
2. **No negative zero (R-NO-NEGATIVE-ZERO).**
   - `signedDelta` moved from `teacher-view-panels.ts` (re-exported there) to `src/lib/signed-delta.ts`, with a style for what an exact zero prints and which minus.
   - Every signed figure now goes through it, each keeping its own look: 29 places in the Data View, SMT, Admissions, groups, Teacher and the narrative.
   - Teacher, SMT tiles and Admissions keep "−" and "+0" / "±0"; the Data View and some tooltips keep their hyphen and unsigned "0%".
   - The rule test renders the Data View's bars and fails if any hand-rolled sign-then-`toFixed` is left in `src`. That check finds 17 files on `main` and 0 on the branch.
3. **Round-5 meetings catalogue deleted.**
   - Removed from `teacher-view-catalogue.ts`: `AXES`, `availableViews`, `yearsOfData`, `computeView` and their helpers; also `MEETING_TREND_MIN_YEARS` from `years.ts`.
   - Nothing imported them. Before deleting, I grepped `src` and `scripts` for every name: 0 callers outside the file, except `year-rules.test.ts` and the rule runner, both updated.
   - The live parts stay: `ColumnId`, `COLUMN_TITLE`, `defaultBoxTitle`, `familyFor`, `comparabilityKey`, and `ComputedView` for `ViewChart`.
   - R-TREND-LINE-4YR and R-MEETINGS-TREND-4YR now name only live code (`trendChartKind`).
4. **Headcounts: not changed.** See §3.

## 3. The roll rule (item 4): stopped, as the prompt says

| View | Change measured from |
|---|---|
| SMT roll tile / rows (`overview.ts`, `pupils.ts`) | 2019/20 (`CENSUS_FIRST_PERIOD`) |
| SMT direction words: roll, phases, market share (`Lines.tsx` `direction`) | 2022/23 (`TREND_BASE_PERIOD`, the results rule) |
| Groups: "since" figure (`dash.ts` `sinceFirst`) | the group's first census year (2019/20) |
| Groups: "Growing" | 3 years back (`GROWING_SPAN`) |
| Groups r3 Growing/Shrinking; group home summary | last year |
| Groups: combined roll change | 1, 3 and 5 years back |
| Admissions: entry tile | 2019/20 |
| Admissions: Momentum pupil change (`screens.ts`) | 2022/23 |
| Data View roll | the member's "since" (default 2019/20) |
| Teacher | no roll panel |

The "since" figures agree on the first census year, but the direction words don't. Guy (16 Oct): "leave item 4 for now". No headcount was changed, and no headcount rule test was added. SMT's roll direction words are byte-identical between the trees (screenshot).

## 4. Parity: every difference, with its reason

All fixtures were captured from production for both trees back-to-back. Teacher: 23:01, 20 seconds apart. SMT: 23:02–23:19. Admissions, groups and the Data View: 23:32–23:36. Nothing earlier was reused.

- **Teacher:** 2,874 / 2,875 identical; 1 noise PNG.
  - On the first run, one map image (rk-137625-nat-pending, c1 Map view) had identical text and a pixel difference around the target circle's label. A rerun of its case set was identical.
  - No Teacher figure printed "−0" in the cases, so the zero fix makes no visible Teacher difference.
- **Public page:** SSR byte-identical.
- **SMT:**
  - The Academic entries mix gains a 20/21 column and a 2020/21 table row; the shares change accordingly.
  - The top six keys are picked from all years' totals, so adding 2020/21 can reorder them. On Leighton Park Post-16, "Business & Law" leaves the top three.
  - Subjects table cells: 0 differ. Overview, Pupils and Home: byte-identical.
  - One PNG oddity: Leighton Park Context, light 1440. 25 pixels differ by up to 15/255 on the "Context" tab pill's edge, with identical HTML. A rendering artefact.
- **Admissions** (fixtures byte-identical), 20 differences, all the zero rule:
  - "−0.0 pts" → "±0.0 pts" (4);
  - in tooltips, a +0.4% change "+0%" → "±0%" (12): a tiny positive now prints as this view's exact zero;
  - "The gap moved +0.00 pts" → "0.00 pts" (4, tooltip).
  - These last two are the same rule from the positive side: a figure that prints as zero carries no sign. **Not strictly "−0 becomes 0"; logged for Guy (call 7).**
- **Groups:** 176 / 176 identical.
- **Data View:**
  - Rankings identical.
  - The Chase GCSE: two "-0%" → "0%" in the set-average list.
  - King's Worcester Post-16: one "+0%" → "0%" (a tiny positive).
  - New subject-mode case (The Chase, Humanities & Social Sciences):
    - The school's "Candidates, % change" now runs from 2020/21: Geography +11% → +20%, History −12% → +29% (now matching the ranked list), Religious Studies +118% → +227%.
    - The set average is fixed (§2).
    - "Results, % change": Geography "+0%" → "0%".

## 5. Screenshots (`docs/v0.8/year_rules_leftovers_screenshots/`, light theme, `main` vs branch from the same fixtures)

- **The Chase GCSE History Candidates:** `teacher_137625_history_candidates_trend_1280_*` and `teacher_137625_history_candidates_table_1280_*`. Identical: Teacher already drew 2020/21 (§1).
- **Phone width, six-year entries table:** `teacher_137625_history_candidates_yearsdown_390_*`. All six years, 2020/21–2025/26, with the change row.
- **The Data View "Candidates, % change" in subject mode:** `dataview_137625_ks4_subject_candidates_change_*`.
- **SMT entries mix:** `smt_137625_entries_mix_*` (the branch adds 20/21).
- **SMT roll direction words:** `smt_137625_roll_direction_*`. Identical: item 4 was not changed.
- **A view that mixes entries and grades for 2020/21:** none exists (§1), so there is no screenshot.

## 6. Rules

| Rule | Status |
|---|---|
| R-ENTRIES-FIRST-YEAR | **new**. Test: The Chase GCSE History: entries from 2020/21, results from 2021/22; Teacher draws 2020/21; the Data View's subject-mode change = the ranked list = +29% since 2020/21. |
| R-NO-NEGATIVE-ZERO | **new**. Test: the formatter in every style, the Data View's bars rendered, SMT, Admissions and the change map; no hand-rolled sign-then-`toFixed` left in `src`. |
| Headcount rule | **not added**: item 4 left for Guy (§3) |
| R-SMT-VIEW-MIX | updated: the mix starts at the rollup's first year with entries |
| R-MEETINGS-TREND-4YR | updated: names only `trendChartKind`; its test no longer uses the deleted catalogue |
| R-TREND-LINE-4YR | updated: the deleted catalogue removed from `enforcedIn` |
| R-RANKING-ENTRIES-CHANGE | `enforcedIn` adds `years.ts:changeStartFor` |

`docs/catalogue/*.md` regenerated. New unit test: `src/lib/signed-delta.test.ts`.

## 7. Logged calls

Under "2026-10-16 — year rules leftovers" in `docs/OPEN_QUESTIONS.md`:
1. Teacher already drew 2020/21; last round's note was wrong.
2. 2020/21 is the first entries year at GCSE and Post-16.
3. Area comparisons stay at 2021/22 (an ingest change would be needed).
4. No mixed 2020/21 view exists.
5. The Data View uses the rollup only where it describes the row alone.
6. The category-mode set average is a summed-set change, the subject-mode one an average of changes: pick one.
7. The zero rule's style option; the Data View's hyphen; tiny positives now print as the view's zero ("0%", "±0%").
8. Arrow forms "▼ 0%".
9. The round-5 catalogue is deleted.
10. Headcounts: the disagreement, left at Guy's word.
11. Grade counts' % change table stays on 2022/23.
