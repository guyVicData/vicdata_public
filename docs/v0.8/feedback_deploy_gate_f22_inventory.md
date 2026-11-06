### F-22: the focus school highlighted in every table and rank view

Guy: "ALL table / rank views the focus school should be highlit." F-17 (round 1) tinted Admissions' rivals table, Teacher's three tables and the groups' "against" and Schools tables, and nothing else. This is every table or rank view with school rows, before and after.

**The rule:** a table or ranked list of schools tints the focus school's row with its product's token and marks it `data-featured-row`. One helper does both: `featuredRow(on)` in `src/components/shell/accent.ts`. On a group's views the focus is the school picked; with none picked, no member row is tinted. Bar charts aren't rank views here. Their focus bar is already coloured and its name bold (see the calls in OPEN_QUESTIONS).

**Two new tokens.** The F-17 checks pass for every token: text 11:1 or better in both themes, and muted text at least 6.3:1 on the light tint.

| Token | Light | Dark | Text, light / dark | Muted, light / dark |
|---|---|---|---|---|
| `--row-featured-ks2` (new; Teacher KS2 has no accent) | #eeeef0 | #2a2a2e | 15.4 / 12.8 | 6.4 / 5.1 |
| `--row-featured-dataview` (new; on `:root`, since the Data View is outside `#teacher-root` and follows the system theme) | #fef2f2 | #220a0a | 16.4 / 16.1 | 7.1 / 7.3 |
| `--row-featured-admissions` (F-17) | #d7f7fc | #163940 | 15.8 / 11.1 | 6.5 / 4.4 |
| `--row-featured-gcse` (F-17) | #daf7ed | #1a392f | 15.8 / 11.2 | 6.5 / 4.5 |
| `--row-featured-post16`, `-smt` (F-17) | #efeafe | #312b43 | 15.2 / 12.1 | 6.29 / 4.8 |
| `--row-featured-groups` (F-17) | #feebdc | #412c1d | 15.4 / 11.7 | 6.4 / 4.7 |

- **The Data View's token is the red it already drew**, now as a token: red-50 light, and red-950 at 40% over the dark page.
- **On its focus row, the rank number's muted grey is one step darker:** neutral-600 light and neutral-400 dark. Neutral-500 was 4.3:1 on the light tint.
- **Muted contrast in dark is under 6.3:1 for every F-17 token, as before.** F-17's 6.3:1 was measured in light only.

**The inventory.** "Before" is the state at `8f6e8b7` (main plus this round's prompt).

| Product | View (component) | Before | After |
|---|---|---|---|
| Teacher (GCSE, Post-16) | Ranking table (`SchoolRankingTable`) | tinted, `-gcse` / `-post16` | the same, now marked |
| Teacher (GCSE, Post-16) | Sortable table (`SortTable`) | tinted, `-gcse` / `-post16` | the same, now marked |
| Teacher (GCSE, Post-16) | Change table, year table (`SeriesViews`; years down, the focus is a column) | tinted, `-gcse` / `-post16` | the same, now marked |
| Teacher KS2 | whichever of the three tables KS2 draws (the root now names its token) | neutral fallback (grey accent at 14%) | `--row-featured-ks2` |
| Teacher KS2 | nearest primaries list | the school isn't in it | no change |
| SMT | every table (roll, bands, market, mix, scorecard, subjects, value added, entry points, leaving at 16, births) | rows are years, measures, subjects or qualifications, not schools | none to tint |
| Admissions | Rivals table (`RivalsTable`) | tinted, `-admissions` (F-17) | the same |
| Admissions | Rivals ranked by size (`RankedBars`) | `--adm-tint` (the accent at 14% / 12%) | `--row-featured-admissions`, marked |
| Admissions | The rivals' results (`AcademicNumbers`) | `--adm-tint` | `--row-featured-admissions`, marked |
| Admissions | Feeder table | the feeders only, never the school | no change |
| Admissions | Rivals' momentum | the rivals only | no change |
| Groups | Against others (`AgainstOthers`) | the group's row, `-groups` (F-17) | the same |
| Groups | Every school (`SchoolsTable`) | the school picked, `-groups` (F-17) | the same |
| Groups | Schools ranked (`SchoolsRanked`) | the school picked, `--adm-tint` | `--row-featured-groups`, marked |
| Groups | Value added (A-level and Progress 8 tables) | no tint | the school picked |
| Groups | Year 12 against Year 11 (`LeavingAt16`) | no tint | the school picked |
| Groups | Each school's share of its area (`MarketShare`) | no tint | the school picked |
| Groups | Children around each school (`ProjectionPerSchool`) | no tint | the school picked |
| Groups | Joined and left (`JoinedLeft`) | no tint | the school picked |
| Groups | Shapes (cards) | the school picked, `--adm-tint` | unchanged: a chart |
| Group home | each group's member list | nothing is picked | none |
| Data View | Rankings: current roll, growth or decline (`RankTable`) | red-50 / red-950 at 40% (classes), red left border | `--row-featured-dataview`, border kept, marked |
| Data View | Rankings: rank over time (`ComparisonOverTimeTable`) | the same classes | the token, marked |
| Data View | Rankings at region or nation scale (`LargeSetMetricRanking`) | red-50 / red-950 at 30% | the token (dark one step deeper, as the other tables), marked |
| Data View | Academic Rankings: the three tables | as Rankings | as Rankings |
| Data View | The deep dive: "Every real school … ranked" | red-50 / red-950 at 40% | the token, marked |
| Data View | Graphs | no tables; its bar charts colour the school's bar | unchanged (a chart) |
| Saved set (`/sets/[id]`) | Roll-size rank | no tint ("(this school)" only) | `--row-featured-dataview`, marked |
| Custom and member dashboards | Teacher's tables (`TeacherDashboard`, the phase's token) | as Teacher | as Teacher, KS2 included |
| Meeting slides | Teacher slides (embed, the phase's token) | as Teacher | as Teacher |
| Meeting slides | SMT slides | `smtVars` | the same |
| Meeting slides | Admissions slides | fell back to the meeting's rose at 14% (the preview names no token) | `--row-featured-admissions` on the slot |
| Public school page | — | no table or rank view has the school's row: its nearest-schools list leaves it out, the roll chart already colours it, and a consortium's member list has no focus | none to tint; no token added |

**The test:**
- **R-FEATURED-ROW-EVERYWHERE** (`src/lib/featured-row-scan.ts`; unit test `src/lib/featured-row.test.ts`; rule runner `featuredRowEverywhere`).
- **What it checks:**
  - every focus table marks its row;
  - every `<tr>`, `<div>` or `<li>` keyed by a school's URN anywhere in `src` is marked, or is listed in `NO_FOCUS_ROWS` with a reason.

  At this round's end that is 18 rows marked and 22 listed.
- **What fails it:**
  - a new table of schools without the mark;
  - a stale entry in the list.

**Screenshots** are in `docs/v0.8/feedback_deploy_gate_screenshots/f22/`, as `{before|after}_{view}_{light|dark}.png`.
- **How they were made:** the real components server-rendered on real read-only data, with each tree's own built CSS, in headless Chrome:
  - Admissions at Leighton Park, 11+;
  - the groups from the ingest fixtures (Harris, a school picked);
  - the Data View's Rankings, for Leighton Park against Admissions' 10 nearest rivals.
- **What they show:**
  - `adm_ranked_bars` and `adm_academic_numbers`: the cyan token in place of the 14% accent;
  - `grp_schools_ranked`: the groups token;
  - `grp_leaving_at16`: newly tinted;
  - `dv_rankings`: the same red, now the token.
- **Not shot:** Teacher's tables (only the mark is new; pixels unchanged) and the deep dive drawer (it opens on a click).
