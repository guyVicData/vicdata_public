# Teacher view Trend & % Change redesign: build report (v1)

Prompt: `vicdata_phase3_teacher_view_trend_pct_change_redesign_claude_code_prompt_v1.md`. Brief: `..._build_brief_v1.md`. Mockup: the "Candidates Trend — chart style options" artifact (read in full).

Built in the prompt's order from `057bcf2`:

| Commit | Steps |
|---|---|
| `bd466a2` | 1 |
| `12e524f` | 2, 4, 5 (the chart they share) |
| `baf9e95` | 3 |
| `1f8a316` | 6 |
| `8bce8aa` | 7 |
| `faaf8ad` | 8 |
| `ab7575c` | 9, 10 |
| `c76312e` | 11 |

The prompt's header line saying steps 8 and 9 are "NOT ready" is stale. The steps themselves, the brief's "Open items — both resolved" and your message all say they're confirmed, so I built them.

## Shared pieces (new)

- **`src/lib/teacher-view-trend-styles.ts`:**
  - `greyTints` / `tintInOrder`: the mockup's ramp, #c9c9c5 down to #494946, interpolated, lightest first, in Current's order, with the focus in the accent.
  - `indexTo100` (D2) and `changeOver`.
  - `topMovers` / `bandOf` (Option K: top 2 risers and top 2 decliners, the rest as a min–max band).
  - `INDIVIDUAL_SERIES_MAX` (10), the named threshold step 11 asked for.
- **`src/components/teacher/SeriesViews.tsx`:**
  - `MultiTrend`: Option B below `TREND_LINE_MIN_YEARS` real years, D2 from there, K when curated.
  - `ChangeList`: Option H.
  - `YearTable`: E and I, with first and last year on the card and every year in fullscreen. It has a latest-year rank "n of N" and a change column (count and %), sorts on any column, and has an optional curated mode with a "Rest of … (N)" min–max row.
  - `curatedKeys`: so K's table reads the same `topMovers` result as its chart.
- **`TrendChart`** gains an optional `focusKey` (drawn last and thicker; the fit follows it), a dashed `reference` line (D2's 100) and a shaded `band` (K). Existing callers are unchanged.
- **`PanelIcons`** gains Chart and Table icons for the new view toggles.

## Per step

1. **Candidates data source.** Candidates now reads `headline`'s `entriesTotal` via the page's `entriesAt()`, the same source and field Context uses, over the category's own periods. The raw `entries` prop is gone.
   - **Checked in the database:** `academic_subject_rollup` has entries for periods 2020–2024, i.e. 2020/21 to 2024/25, five years, at both GCSE and Post-16. So the From menu and Current now have the full range.
   - **⚠ Judgement call:** headline's grain is one row per subject at GCSE (entries summed across its qualifications) and one per (subject, bucket) at Post-16. The category is therefore de-duplicated to that grain; otherwise "Art (GCSE)" and "Art (BTEC)" would both show Art's whole total. **So a GCSE subject's candidates now count all its qualifications together** (Context has always counted them this way).
2. **Every subject on Trend,** grey-tinted in Current's order, with the focus in the accent and drawn on top. The tints are computed once in CandidatesPanels, so Current's bars use the same colours. The category-average line is no longer on Trend (see §D2).
3. **Dead toggle.** The "Trend line" toggle is now properly `disabled`, with a tooltip saying why, wherever there's no line to fit:
   - TrendChart's bars mode,
   - Option B,
   - any table view.

   This applies in all three columns.
4. **Option B** (under four real years): one row per subject, a short track per year (latest solid, earlier years fainter), and the first-to-last change as count and %, direction-coloured.
5. **Option D2** (four or more years): every subject its own line, indexed to its own first published year = 100, with a dashed 100 reference line and a legend. After step 1, Candidates has five years, so this is the usual case.
6. **Options E and I:** a Chart/Table toggle on Trend and on % Change, using `YearTable` for both, with the first/last-year card and all-years fullscreen split.
7. **Option H:** % Change is a ranked diverging list with rank numbers. The category average is a dashed reference line through the rows, with its value underneath, not a competing bar. There's no separate Rank view.
8. **Subject-name shortening:** a new `src/lib/subject-short-labels.ts`. Both old "first 4 letters + ." copies are gone.
   - **Order:** your table first, verbatim, then a word-based fallback, then a collision check over everything shown together.
   - **Collision check:** it first tries the two-word fallback, then more of the real name, and as a last resort the qualification for two items with the same subject name.
   - **⚠ Key check against real names** (`academic_subject_rollup`, 2024/25): many keys match exactly (Biology, History, Religious Studies, Business Studies, KS5 Mathematics, …). Many real names differ for the same subject, so **I added `SUBJECT_ABBREVIATION_ALIASES`**, mapping real name → your key, rather than editing your table:
     - Maths (General), Chemistry/Physics/Psychology (General), Science Double Award → Comb Sci
     - Art & Design, French Language, Music Studies (General), Speech & Drama
     - D & T, Hospitality / Catering Studies, Law / Legal Studies, Media / Film / TV Studies, and others (full list in the file)
   - **Deliberately not aliased:** "Food Technology" (not the same subject as Food Preparation and Nutrition) and "Chinese" (not necessarily Mandarin). They fall through to the fallback.
   - **Tested:** Eng Lang / Eng Lit, Phys / PE, Comb Sci / Maths, Bio (AL) / Bio (IB), and "Speech Drama" / "Drama Thea" where both would otherwise be "Drama".
   - **Post-16:** the (subject, bucket) suffix via `KS5_BUCKET_SUFFIX` is added **only when the same subject appears under more than one bucket** in what's shown (§D4).
9. **Context, Selected subjects:** `changeScope="individual"`. Context's subjects become the selected set (the same `contextMembers` its group average uses) plus the focus, drawn exactly like Column 1: B/D2, H with the group as a dashed line, and E/I tables.
10. **Context, All subjects:** `changeScope="curated"`.
    - Trend is Option K: focus in the accent, top 2 risers and top 2 decliners as grey lines, and a "rest of school (N)" band.
    - Its table on the card lists exactly those rows, read from the same `topMovers` call, plus a "Rest of school (N)" min–max row, "range, not summed". Fullscreen shows every subject.
    - % Change is H over every subject, since a list just scrolls.
    - `changeScope`'s old "focus" mode is gone. Column 1 Results passes nothing, keeps `"all"`, and **its behaviour is unchanged**: it keeps its handed-in colours, the focus-plus-group line and ChangeChart. Every new behaviour sits behind the two new modes.
11. **Comparisons, "vs: All schools, individually":** a third menu row under the average; the Current/Ranking view and the other two choices are untouched.
    - Your school is in the foreground colour; each comparator is grey-tinted in ranking order.
    - Trend: one line each (or B under four years); Option K beyond `INDIVIDUAL_SERIES_MAX` comparators.
    - % Change: H, ranked, with the set's average as the dashed line.
    - The summary gives your school's rank on change within the set.
    - Changing the comparator set still resets "vs:" to the average.

## Judgement calls to look at live (open decisions)

- **§D1: indexing only for headcounts.** D2 indexes when the measure sums (candidates). A points or rate measure (Context on Results, Comparisons on Attainment 8 or points) is drawn at its real level, because all subjects and schools share one scale and indexing would hide the levels that matter there.
- **§D2: no group-average line on the individual Trend views.** The brief's D2/K mockups draw subjects only, and the group average now lives in H as its dashed line. Say if you want it back on Trend as a dashed line too.
- **§D3: the grey tints also colour Current.** In Candidates and Context, Current's bars now use the same greys and accent as Trend and % Change, so a subject is one colour everywhere. Results keeps its colours.
- **§D4: the KS5 bucket suffix only appears when needed.** "Biology" alone, but "Bio (AL)" / "Bio (IB)" when both are shown. That's the same rule the focus chips follow.
- **§D5: colours.** Direction colours follow the app's existing convention: teal up, amber down (the mockup used its own green and orange). Comparisons draws your school in the foreground colour, as the prompt says; the mockup drew it green.
- **§D6: the Candidates grain change** (step 1 above). At GCSE a subject's candidates now include all of its qualifications.

## Verification

**Done:**
- `tsc --noEmit` is clean.
- `eslint` is clean on every touched and new file.
- `next build` succeeds.
- The step 1 data depth and the step 8 subject names were checked in the production database.
- The shortener was unit-checked with `tsx` against the pairs in the brief.

**Not done:** nothing has been seen in a browser; localhost needs a password and a sign-in. **This build is for the panel-by-panel live walk-through you asked for.**

**Out of scope, untouched as instructed:** the comparator-set chooser, FE colleges and KS2.
