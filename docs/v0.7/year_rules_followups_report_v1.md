# VicData 0.7: year rules follow-ups

Report for `docs/v0.7/vicdata_0_7_year_rules_followups_claude_code_prompt_v2.md`, branch `v0.7-year-rules-followups` from `main` `25a94ab`, 16 Oct 2026. Worktree `~/dev/vicdata_public_years` (other sessions use `~/dev/vicdata_public`). No database writes.

**In one line:** the Data View now measures GCSE and Post-16 change from 2022/23, as Teacher does, and still draws 2021/22 with the note; the subject ranking measures its entries change from the first year with data; the meetings constant follows the 4-year rule, but no meeting slide changes, because the 3-year gate was in code no page calls any more.

| Check | Result |
|---|---|
| tsc, eslint, `next build` | clean (eslint: 0 errors, the 2 existing warnings) |
| Unit tests (every `src/**/*.test.ts`, with `.env`) | **438 / 438**; catalogue unit tests **77 / 77** |
| Rule tests (production, read-only) | **101 pass, 0 fail, 0 errors** (MANUAL 15, NONE 19, SUPERSEDED 4), including the 3 new ones |
| PGlite (RLS, usage log, every `supabase/tests/*.mjs`) | **20 / 20** |
| Teacher parity | **2,875 / 2,875 identical**; fixtures 10/10 byte-identical between the trees |
| Public page SSR | identical (137625, 117037) |
| Admissions parity | **328 / 328 identical**, pixels and DOM, 592 panel-views; fixtures byte-identical |
| SMT parity | 312 pairs: DOM identical in all; 3 PNGs at 1–2 / 255 (antialiasing); fixtures byte-identical |
| Groups parity | group dashboards (Harris, Dukes; 4 pages, both themes, both widths, every rail view): 176 files, 175 identical, 1 PNG at 1 / 255; member schools' SMT with the group as the set (137018, 140985): 168 / 168 identical |
| Data View | 16 / 16 pages differ, only in the intended change figures and the note (below) |

## 1. Where each rule lived

Checked before changing anything; every place that shows the same measure now reads `src/catalogue/years.ts`, with no new constants.

| Rule | Where | Second copies found |
|---|---|---|
| Change start (Y4 4) | `DATA_VIEW_TREND_BASELINE` (years.ts) → `TREND_BASELINE_PERIOD`: the Data View's Graphs, Rankings and Map | **Yes, in the Data View:** the subject area's "Results, % change" (area, subject and the set's average) and the deep dive's results change ran from each series' first real year; the large-set chart indexed points to 100 at its first year (2021/22); Rankings' "Position over time" ran from the first ranked year. All aligned. |
| Trend minimum (Y4 5) | `MEETING_TREND_MIN_YEARS` → `TREND_MIN_YEARS` in `teacher-view-catalogue.ts` (`availableViews`) | None. **But no page calls `availableViews`** (§2). |
| Entries change (Y4 6) | `subject-ranking.ts` (`rankFigures` and the database function's `p_trend_base`) | None in SMT Academic, the group views or Admissions: their changes are on results. Related but **not** aligned (headcounts, not entries): §4. |

## 2. The three changes

**Data View (Y4 4).** `DATA_VIEW_TREND_BASELINE = { ks2: 2022, ks4: TREND_BASE_PERIOD, ks5: TREND_BASE_PERIOD }`.
- Every change figure on points or Attainment 8 is from 2022/23: Graphs' Growth / decline bars, the subject area's family sentence and "Results, % change since 2022/23" (school, set average, a chosen comparator), the deep dive's results change, the large-set chart's index (100 at 2022/23), Rankings' Trend tile, growth ranking and "Position over time", and the Map's trend colours and popup.
- The old baseline also started the drawn years. The two are now separate: the graphs and the rank table draw from the data's own first year (2021/22 at GCSE and Post-16, checked: `academic_headline_snapshot` starts there), and every points trend that draws 2021/22 carries the same note Teacher uses (`TrendBaseNote`, `trendNoteFor`).
- KS2 stays on its first year, 2022/23: nothing changes there. Candidates' changes still run from the first year with entries.
- In subject mode, the set's average "Results, % change" was the average of the comparators' latest **points**, drawn as a percentage (a 6.0 average read "+6%"). It is now the average of each comparator's own change since 2022/23.

**Meetings (Y4 5).** `MEETING_TREND_MIN_YEARS = TREND_LINE_MIN_YEARS` (4).
- The 3-year gate was in the round-5 axis catalogue (`availableViews`), which no page calls since the 0.8 meetings work: the live slide picker is the S4 chooser, which offers each view's "Over time" form whatever the years, and a slide draws it through the host's own panels, which already apply R-TREND-LINE-4YR (3 years: per-year bars, no line).
- So **no meeting slide changes**; the expected "no trend option for 3-year series" difference doesn't arise. The constant now agrees, and the rule test shows the 3-year case both ways (King's Worcester GCSE Computer Science: no trend offered, and drawn as bars).
- No gate was added to the live chooser: Teacher's dashboards share it, and Teacher had to stay byte-identical. A call for Guy (logged).

**Subject ranking (Y4 6).** `changeFrom()`: entries from the first year with data, points and rates from 2022/23.
- The database function takes one start year, so for entries the app asks once, reads the years in the answer (its yearly averages and the school's series) and asks again from the first. Checked against production: function and fallback give the same list (The Chase GCSE History: from 2020/21, +29.27%, 878th of 3,204).
- The first year with data is **2020/21** for GCSE subject entries (the teacher-assessed year: totals, no grades). Teacher's Candidates panels start at 2021/22. A call for Guy (logged).
- It fixes a visible mismatch: on `main`, The Chase's ranked list said "since 2022/23" (+16%, 961st) while the change table beside it read "2020/21 against the latest year" (+29%).

## 3. Before and after (`docs/v0.7/year_rules_followups_screenshots/`)

Drawn by `main` (before) and the branch (after) from the same fixtures, captured at the same moment, at 1440, light theme.

- **The Chase, GCSE, Data View:** `dataview_137625_ks4_graphs_*`, `dataview_137625_ks4_rankings_*`.
  - Attainment 8 "No change −3% since 2021/22" → "No change +5% since 2022/23". The generous-2021/22 effect the rule exists for.
  - Growth / decline: The Chase 4th → 3rd of 11; the set's figures from −2%…−20% to +7%…−9%.
  - "Position over time": "from #4 (2021/22)" → "from #5 (2022/23) to #1 (2025/26)".
  - The rank table still draws 2021/22–2025/26, now with the note.
- **King's Worcester, Post-16, Data View:** `dataview_117037_ks5_graphs_*`, `dataview_117037_ks5_rankings_*`: the same changes at A level.
- **Subject ranking, The Chase GCSE History, Candidates, national:** `ranking_137625_history_candidates_change_*` (the ranked list: "since 2022/23 … +16%, 961st of 3,410" → "since 2020/21 … +29%, 878th of 3,204") and `ranking_137625_history_candidates_table_*` (the change table the list now agrees with). Drawn by the same branch bundle on ranking answers computed by each tree's code.
- **One meetings slide:** `meeting_trend_slide_117037_main.png` and `_branch.png`, King's Worcester's GCSE Results trend, a slide's content: identical (50 / 50 files of that case identical). See §2.

**Not drawn:** the Map (no harness draws it; it reads the same baseline, shown by the rule test), the deep dive (opens on a click; its wording change is in the code and the rule's enforcedIn).

## 4. Parity: every difference, with its reason

All fixtures were captured for both trees from the same data within minutes of each other (Production changed on 16 Oct; nothing earlier was reused).

- **Teacher:** 2,875 / 2,875 identical. Ranking fixtures are computed once, by the branch, for both trees, so the entries change can't show there; it is shown separately (§3). Errors files: the README's known random `rej TypeError: parameter 1 is not of type 'Element'` on 130416 Post-16, on both trees in one case set and on the branch only in another.
- **Public page:** SSR byte-identical.
- **Admissions:** 328 / 328 identical; each school's fixtures byte-identical between the trees (Admissions' subject places read only the national rank, never the change list).
- **SMT and groups:** as in the table; the group dashboard bundles are byte-identical apart from module paths.
- **Data View, the deliberate differences** (16 pages: The Chase GCSE and King's Worcester Post-16; Graphs and Rankings; both themes; 1440 and 390). Every difference is in one of:
  - Graphs: "Growth / decline since 2022/23" (title and bars), "Results, % change since 2022/23" (title and bars);
  - Rankings: the Trend tile, "Position over time", the growth ranking (title, order, figures), and the note under the rank table.
  - Candidates, Results and Position are identical on every page.
- **Meetings:** no difference (§2).
- **Subject ranking:** its Candidates change views only (the year-by-year table's rows, the ranked change list, the change table's rows), national and regional.

## 5. Rules

| Rule | Status |
|---|---|
| **R-DV-TREND-FROM-2223** (new, check `dataViewTrendFrom2223`) | pass: The Chase, 7 areas, results from 2022/23, candidates from the first year, drawn from 2021/22 with the note |
| **R-MEETINGS-TREND-4YR** (new, check `meetingsTrend4yr`) | pass: King's Worcester GCSE Computer Science (3 years) no trend and bars; Art and Design (5) a "5-year trend" and a line |
| **R-RANKING-ENTRIES-CHANGE** (new, check `rankingEntriesChange`) | pass: from 2020/21 on both paths, points from 2022/23 |
| R-TREND-3YR | retired (no enforcement left) |
| R-TREND-LINE-4YR | its open issue (the legacy 3) closed; enforcedIn names the catalogue |
| R-RANKING-MEASURE | its change-list wording: points and rates from 2022/23, entries from the first year |

`docs/catalogue/*.md` regenerated. Unit test added: `subject-ranking.test.ts` (R-RANKING-ENTRIES-CHANGE); `year-rules.test.ts` updated to the decided values.

## 6. Logged calls

Under "2026-10-16 — year rules follow-ups" in `docs/OPEN_QUESTIONS.md`: the drawn years and the change start separated; the second copies; the subject-mode average fix and the same fault left in "Candidates, % change"; meetings unchanged and the dead round-5 catalogue (suggest deleting); entries from 2020/21; the two-call function path; SMT's and Admissions' headcount changes still from 2022/23. Also seen, not changed: the Data View's diverging bars print "−0%" for small negative changes (Teacher's 0.8 `signedDelta` fix didn't reach the Data View).
