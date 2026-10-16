# VicData 0.7 — Year rules follow-ups: three small alignments (v2)

Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 13 Oct 2026 and updated 16 Oct. v1 was held back until the GCSE 2025/26 ingest; that ingest is now promoted, and a lot has merged since.

**Read `docs/v0.7/year_rules_report_v1.md` first,** especially Y4 and `src/catalogue/years.ts`.

## Decided (Guy, 13 Oct)

- **Y4 1–3, kept as built:**
  - change measured from 2022/23;
  - all five years drawn, with the 2021/22 note;
  - "(provisional)" shown until DfE's revised release.
- **Y4 4, the Data View follows Teacher.** The Data View measures change from **2022/23**, not 2021/22, using the same constant in `years.ts`. It shows the same 2021/22 note wherever a trend draws 2021/22.
- **Y4 5, meetings follow the rule.** The slide picker offers a "trend" only from **4 years**, as every other view does (`R-TREND-LINE-4YR`).
- **Y4 6, entries follow the rule.** The subject ranking measures change in **entries** from the first year with data, never from 2022/23.
  - The 2022/23 start exists only because 2021/22's grading was generous, and that doesn't affect entry numbers.
  - Grades and points keep 2022/23.

## Before you start

- **Base: current `main`** (25a94ab or later, after a fetch over HTTPS). Since v1 was written, main has gained the SMT rounds, groups r2 and r3, the audit fixes, the IGCSE subjects round and the ranking-cache fix.
- Check where each of the three rules now lives. If later rounds built a second copy of any of them, list it before changing anything:
  - change start;
  - trend minimum;
  - entries change.

  The likely places are SMT Academic, the group views and Admissions. Each place that shows the same measure follows the same rule, and reads it from `years.ts`.
- If another session is using `~/dev/vicdata_public`, work in a worktree (`~/dev/vicdata_public_years`). Copy `.env` with `cp`, without reading it, and use free ports.

## Ground rules

- **Branch `v0.7-year-rules-followups` from `main`.** Commit this prompt file as the branch's first commit.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness: Teacher, public page, Admissions, SMT and groups.
- **Capture the parity fixtures for both trees from the same data, at the same time.** Production changed on 16 Oct (the GIAS refresh), so fixtures captured earlier aren't comparable.
- **The only differences allowed:**
  - **the Data View:** its "change since" figures, direction words and ranked change lists now count from 2022/23, and the 2021/22 note appears where it should;
  - **meeting slides:** no trend option for 3-year series;
  - **the subject ranking:** its entries change;
  - **any second copy of a rule** you found and aligned (see above). List these separately.

  List every pair that differs, with the reason. Teacher's other views, the public page and Admissions must otherwise be byte-identical. Any other difference stops the merge.
- **Each change reads `src/catalogue/years.ts`,** with no new constants.
- **Rule tests:** one for each change (Data View change start; meetings trend minimum; entries change start). Regenerate `docs/catalogue/*.md`.
- **Never put a server key in client code.** Stage files by name, and leave Guy's untracked files alone. No database writes.
- **Push over HTTPS:** `git push https://github.com/guyVicData/vicdata_public.git <branch>`.
- **Log calls** under "2026-10-xx — year rules follow-ups" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.7/year_rules_followups_report_v1.md`. Include:
- the three changes, and any second copies aligned;
- before and after screenshots:
  - the Data View for The Chase and King's Worcester;
  - one meetings slide;
  - the subject ranking for The Chase GCSE History;
- the parity summary, with each deliberate difference;
- logged calls.

**Merge if clean:**

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.7-year-rules-followups -m "0.7 Year rules follow-ups: Data View from 2022/23, meetings trend from 4 years, entries change from the first year" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

Then remind Guy that the change goes live with a Render deploy.
