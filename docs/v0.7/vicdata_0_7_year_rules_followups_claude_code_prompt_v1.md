# VicData 0.7 — Year rules follow-ups: three small alignments

Claude Code prompt, written 13 Oct 2026, for the app repo (`~/dev/vicdata_public`). **Run it after the GCSE 2025/26 ingest has been promoted and checked on live,** so the release lands on the code that was tested on 13 Oct (fe466db).

**Read `docs/v0.7/year_rules_report_v1.md` first,** especially Y4 and `src/catalogue/years.ts`.

## Decided (Guy, 13 Oct)

- **Y4 1–3:** kept as built:
  - change measured from 2022/23;
  - all five years drawn, with the 2021/22 note;
  - "(provisional)" shown until DfE's revised release.
- **Y4 4, the Data View follows Teacher.** The Data View measures change from **2022/23**, not 2021/22, using the same constant in `years.ts`, and shows the same 2021/22 note where a trend draws 2021/22.
- **Y4 5, meetings follow the rule.** The slide picker offers a "trend" only from **4 years**, as every other view does (`R-TREND-LINE-4YR`).
- **Y4 6, entries follow the rule.** The subject ranking measures change in **entries** from the first year with data, never from 2022/23.
  - The 2022/23 start exists only because of 2021/22's generous grading, which doesn't affect entry numbers.
  - Grades and points keep 2022/23.

## Ground rules

- **Branch `v0.7-year-rules-followups` from `main`.** tsc, eslint, build, unit tests, rule tests, the RLS test (111) and the parity harnesses all clean.
- **Deliberate differences, and only these:**
  - **the Data View:** its "change since" figures, direction words and ranked change lists now count from 2022/23, and the note appears where it should;
  - **meeting slides:** the trend option for 3-year series;
  - **the subject ranking:** its entries change.
  
  List every pair that differs, with the reason. **Teacher, the public page and Admissions must be byte-identical.** Any other difference stops the merge.
- **Each change reads `src/catalogue/years.ts`;** no new constants.
- **Rules:**
  - a rule test for each change: Data View change start; meetings trend minimum; entries change start;
  - update `docs/catalogue/*.md` by regenerating it.
- **Never put a server key in client code.** Stage files by name. Leave Guy's untracked files alone. No database changes.
- **Log calls** under "2026-10-xx — year rules follow-ups" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.7/year_rules_followups_report_v1.md`, with:

- the three changes;
- before and after screenshots: the Data View for The Chase and King's Worcester; one meetings slide; the subject ranking for The Chase GCSE History;
- the parity summary, with each deliberate difference;
- logged calls.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.7-year-rules-followups -m "0.7 Year rules follow-ups: Data View from 2022/23, meetings trend from 4 years, entries change from the first year" && npm run build && git push
```
