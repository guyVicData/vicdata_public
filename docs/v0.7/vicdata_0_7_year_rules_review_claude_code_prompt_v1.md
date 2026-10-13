# VicData 0.7 — Year rules review, before GCSE 2025/26 lands

Claude Code build prompt, written 13 Oct 2026, for the app repo (`~/dev/vicdata_public`). **Run it before 15 Oct,** when DfE publishes provisional GCSE (KS4) results for 2025/26. The ingest follows in a separate prompt.

**The aim:** when a new year arrives for **one** key stage, every view picks it up correctly, with no hard-coded "latest year". The years the rules start from (2021/22's grading note, statements from 2022/23) stay deliberate and visible.

## Ground rules

- **Branch `v0.7-year-rules` from `main`.** tsc, eslint, build, unit tests, rule tests, the RLS test (111), the Admissions parity pass (328) and the Teacher parity harness (2,875) all clean.
- **With today's data, every Teacher, Admissions, Data View and public-page pair is byte-identical.** This round changes how years are chosen, not what shows today. Any difference is a bug, or a listed, deliberate fix that Guy approves before the merge.
- **Never put a server key in client code.** Stage files by name. Leave Guy's untracked files alone. No database changes.
- **Log calls** under "2026-10-13 — year rules" in `docs/OPEN_QUESTIONS.md`.
- **Merge and push if clean.** **Stop before merging** if any rule's substance would change (as opposed to how its year is found).

## Y1 — Inventory every year in the code

List in the report **every** place a year or period is fixed or assumed, with file, line, what it does, and whether it is a **rule** (deliberate) or an **assumption** (it should follow the data). Start from:

- **Rules:**
  - `MODERN_GRADE_FROM` (`src/lib/grade-rows.ts`);
  - `R-TREND-FROM-2223`: statements, change and fitted lines measured from 2022/23 (`SubjectPanels`, `TrendChart`, `SeriesViews`, `GradeCountsPanels`, `GeographyComparison`, `ColumnPanels`, `tableLayout`);
  - `R-TREND-LINE-4YR`;
  - `R-2122-GRADING-NOTE`;
  - the four- against five-year trend windows.
- **Possible assumptions:**
  - "2024/25" in labels, tags and pills ("Results 2024/25", "Data 2024/25", "Candidates — 2021/22 to 2024/25");
  - `comparator-grades` and `dashboard` route year ranges;
  - `embed.ts` period parsing;
  - Admissions' `censusPeriod ?? 2025` fallbacks;
  - the catalogue's `measures.ts` `from`/`to` years;
  - the rank lookup's year;
  - any `max(period)` that is **global** rather than **per key stage and per measure**.

## Y2 — Make "latest" follow the data, per key stage and per measure

- **The latest year is found from the data,** separately for each key stage and measure family:
  - KS4 headline;
  - KS4 subject entries and grades;
  - KS5 headline;
  - KS5 subject;
  - KS2;
  - value added;
  - census.
  
  After Thursday, **GCSE's latest is 2025/26 while Post-16's stays 2024/25** until DfE's A-level release. A page showing both must label each with its own year.
- **Every label and tag reads the year it's showing** from the data. No string holds a year.
- **Provisional data:** DfE marks October KS4 data as provisional and revises it in the spring. Add a small, data-driven "provisional" marker to the year label, e.g. "2025/26 (provisional)". Drive it from a source-level flag the ingest sets, and default it off, so today's output is unchanged.
- **The rules keep their years:** 2022/23 as the statement start, and the 2021/22 note. They're **named constants in one file** (`src/catalogue/years.ts` or the existing equivalent) with the reason beside each, so Guy can see and change them in one place.

## Y3 — Rehearse 2025/26 with a fixture

- **Build a test fixture** that adds a synthetic 2025/26 KS4 year:
  - copy 2024/25's rows for The Chase 137625, King's Worcester 117037 and Sevenoaks 118952 (the IGCSE rule);
  - copy them for their 10 nearest, and the LA, region and England aggregates;
  - nudge the values;
  - give it **no Progress 8**, as DfE publishes none for 2025/26: that cohort sat no KS2 tests in 2021.
- **Render** Teacher GCSE (Candidates and Results), the Data View's academic graphs, the public page's GCSE lines, Admissions' academic panel at 11+, and the ranking table, for those schools, at 1440 and 390.
- **Report what changes,** each one expected:
  - the latest year is 2025/26 on GCSE views only;
  - trends gain a fifth year;
  - statements are still measured from 2022/23;
  - the 2021/22 note still shows where a trend includes 2021/22;
  - Post-16 views are unchanged;
  - "provisional" appears where the flag is set;
  - Sevenoaks is still excluded from GCSE comparison;
  - Progress 8 shows "not published for 2025/26", not a gap or an error.
- **Five years:** check that every trend chart, table and phone layout still fits five years (labels, widths, the fitted line). Fix any that don't, in the existing style.
- **The fixture stays as a test,** so the next year's arrival can be rehearsed the same way.

## Y4 — Questions for Guy (the recommendations are the default; list any he should change)

1. **Statements from 2022/23:** with 2025/26, keep measuring change from 2022/23 (four years of change)? Or move to "the last three years"? *Default: keep 2022/23.*
2. **Years drawn:** draw all five (2021/22–2025/26), with the 2021/22 note? *Default: yes.*
3. **Provisional marker:** "(provisional)" after the year, until DfE's revised release? *Default: yes.*

## Report

Write `docs/v0.7/year_rules_report_v1.md`, with:

- Y1's inventory table;
- what became data-driven;
- the constants file;
- the fixture rehearsal, with screenshots and the expected-change list;
- parity: identical with today's data;
- the questions.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.7-year-rules -m "0.7 Year rules: latest year from the data per key stage, rules in one place, 2025/26 rehearsed" && npm run build && git push
```
