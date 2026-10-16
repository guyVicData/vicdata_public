# VicData 0.8 — Year rules leftovers: entries from 2020/21, and four small fixes

Claude Code prompt for the app repo (`~/dev/vicdata_public`), written 16 Oct 2026. It follows the year-rules follow-ups (merged at 10dba8e).

**Read first:**
- `docs/v0.7/year_rules_followups_report_v1.md`;
- its entries under "2026-10-16 — year rules follow-ups" in `docs/OPEN_QUESTIONS.md`;
- `src/catalogue/years.ts`.

## 1. Entries start at the first year with data, everywhere (Guy, 16 Oct)

The subject ranking now measures the entries change from the first year with data, which is 2020/21 for GCSE subject entries. That was the teacher-assessed year: entry totals exist, but no grades. Teacher's Candidates panels still start at 2021/22. **Decision: keep 2020/21, and extend the Candidates panels back to it,** so every entries figure starts at the same year.
- **Where it applies:** every place that draws or measures **entries**. That means Teacher's Candidates panels (year table, trend, % change, rankings), the Data View's Candidates figures, SMT's subject entries, and the public page if it shows entries. Find them all and list them.
- **The year comes from the data,** per phase and measure, through one shared helper in `years.ts`. Don't add a hard-coded 2020/21. Post-16's first year with entries may differ; use whatever the data says, and report it.
- **Grades and points are unchanged:** they still start at 2022/23 for change, and draw from 2021/22 with the note. A 2020/21 column or point appears only on an entries view.
- **Wherever a view mixes entries and grades for 2020/21** (e.g. a year table with both), the 2020/21 grade cells say "–" with a short note: "2020/21: teacher-assessed; entries only". Put the full sentence in the (i).
- **Trend rules still hold:** R-TREND-LINE-4YR and the 2021/22 note logic. With six entry years, check that nothing hits a five-year limit (axes, column counts, slide layouts, the phone width).

## 2. Four small fixes

1. **The set average on "Candidates, % change"** (Data View, subject mode) plots the comparators' latest figure as if it were a % change. It's the same fault the last round fixed on "Results, % change". Make it the average of each comparator's own change, measured from the start in item 1.
2. **"−0%" in the Data View.** The diverging bars print it for small negative changes. Use the shared formatter Teacher uses (0.8 `signedDelta`), not a second copy. Search the whole app for any other place that can print a negative zero.
3. **Delete the unused round-5 meetings catalogue** (`availableViews` and anything only it uses). Show that nothing imports it. Then remove or update its rule enforcement, so R-TREND-LINE-4YR names only live code.
4. **Headcounts follow the roll rule, not the exam-results start.** SMT's roll and market-share direction words, and Admissions' pupil change, are census headcounts but still measure from 2022/23 (`TREND_BASE_PERIOD`).
   - Find the rule the roll views themselves use (Teacher's and SMT's roll panels, the group roll columns), and use that rule here. Report what it is before changing anything.
   - **If the roll views don't agree with each other, stop and report it.** Don't pick a rule.

## Ground rules

- **Branch `v0.8-year-rules-leftovers` from current `main`** (10dba8e or later, fetched over HTTPS). Commit this prompt as the first commit. If another session is using the checkout, work in a worktree (`cp` the `.env` without reading it; use free ports).
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness (Teacher, public page, Admissions, SMT, groups, Data View), with both trees' fixtures captured from the same data at the same time.
- **Allowed differences, listed with the reason for each:**
  - entries views gain 2020/21, and their change figures start there;
  - the two set-average fixes;
  - "−0" becomes "0";
  - headcount changes on the roll rule.

  Anything else stops the merge.
- **Rule tests:**
  - **R-ENTRIES-FIRST-YEAR:** The Chase GCSE History Candidates draws 2020/21, and its change matches the ranked list (+29% since 2020/21);
  - **R-NO-NEGATIVE-ZERO;**
  - a test for the headcount rule.

  Regenerate `docs/catalogue/*.md`.
- **Never put a server key in client code.** Stage files by name, and leave Guy's untracked files alone. No database writes.
- **Push over HTTPS.**
- **Log calls** under "2026-10-xx — year rules leftovers" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/year_rules_leftovers_report_v1.md`. Include:
- every entries view changed, and the first year found for each phase;
- the roll rule found, and where the headcounts now follow it;
- before and after screenshots:
  - The Chase GCSE History Candidates (year table and trend);
  - a view that mixes entries and grades for 2020/21;
  - the Data View "Candidates, % change" in subject mode;
  - SMT's roll direction words;
  - the phone width for a six-year entries table;
- the parity summary;
- logged calls.

**Merge if clean:**

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-year-rules-leftovers -m "0.8 Year rules leftovers: entries from the first year with data, set averages, no negative zero, headcounts on the roll rule" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

Then remind Guy that the change goes live with a Render deploy.
