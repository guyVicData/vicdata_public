# VicData 0.6.2 — Grade data round: four years of school grades from the rollup

Claude Code build prompt. One continuous pass, stages in order, committing after each. **This round changes figures on members' pages on purpose, so it stops before merging.** Guy reviews the before/after report first.

## Why

- School-level grade measures (Grade 4+ / A*–E, Grade bands, Grade counts) show only **2023/24–2024/25**. The app's grade reader (`src/lib/academic-data-view.ts`, `parseSubjectGradeDistribution`, the `sourceIds` around lines 1170 and 1200) reads only the **modern** DfE files: `dfe_ks4_subject_entries`, and the KS5 modern sources.
- The **historic** files (`dfe_ks4_subject_entries_historic`, `dfe_ks5_subject_results_historic`) hold 2021/22–2022/23. They are already loaded.
- **`academic_subject_grade_rollup`**, in the production data database, combines both:
  - columns: `entity_id, ks_stage, subject, qualification_type, grade, family_id, period, entries, computed_at`;
  - periods 2021–2024, i.e. 2021/22–2024/25;
  - about 4,350–4,470 KS4 schools and 2,650–2,720 KS5 schools a year.
- **Effects of two years per school:**
  - school grade trends draw as 2-year bars instead of lines (`R-TREND-LINE-4YR`);
  - "Across schools" grade lines are greyed in Comparisons (0.6.1 report, decision 2);
  - comparator grades are parsed from raw facts (audit §B: slow).

## Checked before writing this (by Claude, against production, 5 Oct 2026)

- **KS4: the rollup equals the source facts exactly** (modern + historic, per-grade rows, excluding totals), nationally, in all four years:

  | Period | Entries |
  |---|---|
  | 2021 | 4,950,392 |
  | 2022 | 5,073,301 |
  | 2023 | 5,201,165 |
  | 2024 | 5,120,856 |

  At **The Chase (137625), GCSE History**, it matches grade by grade in all four years (totals 95, 91, 121 and 132).
- **KS5: not yet reconciled.**
  - The historic years differ from the facts by about **−0.9%**.
  - A naive check of the modern years double-counts, because KS5 breakdowns carry a **size** segment (`qualification::subject::size::grade`), and the rollup has **no size column**.
  - So the rollup may sum across sizes (e.g. A level with AS) where the app keeps them apart (`sizeWeight`; `R-KS5-ASAEA-EXCL`, the AS/AEA rules, family gating).

## Ground rules (as 0.6)

- **Branch `v0.6.2-grades` from `main`.** Commit per stage, with tsc, eslint, build and all tests clean.
  - Unit tests: `npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`.
  - Real-data rule tests: `npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`.
  - Parity: the 0.6.1 harness.
- **Log calls** under "2026-10-05 — 0.6.2 grade data round" in `docs/OPEN_QUESTIONS.md`.
- **Never put a server key in client code.** Read the rollup in server routes only, as the existing grade routes do.
- **Database changes** (indexes, views, RPCs on the production data DB): write them as migrations, test them, leave them for Guy with apply commands, and **don't apply them yourself.** If the rollup needs an index to be fast, propose it. Don't build around it with client-side loops.
- **Pixel-perfect,** existing components and tokens, both themes.
- **Don't merge.** Push the branch.
- **Stop only for:**
  - RLS changes on existing data;
  - destructive migrations;
  - **KS5 that won't reconcile** (S1), in which case ship KS4 only and stop with the findings;
  - a figure change *other than* the expected ones listed in S5.

## Stages

### S1 — Reconcile, with no app change

1. **KS4:** confirm the totals above. Then, for a sample of 200 random (school, subject, qualification) sets across all four years, check that the rollup equals the facts **per grade**, and that the **modern years equal what the app shows today** (same grades, the same handling of `X`, suppressed values and total labels).
2. **KS5:** reconcile per (school, subject, qualification, **size**, grade, period).
   - Establish whether the rollup sums across sizes, how AS / A level / AEA / BTEC sizes are kept, and where the −0.9% in the historic years comes from: suppression, IB non-subject rows (`R-IB-NONSUBJECT`), T levels, or excluded qualifications.
   - **If the rollup can't reproduce what the app shows today for 2023/24–2024/25 at Post-16, don't use it for KS5.** Instead, read the historic facts directly with the same parser (`parseSubjectGradeDistribution` handles the size segment), and log it.
3. **Write `docs/v0.6/grade_rollup_reconciliation_v1.md`:** the method, the tables, and the decision for each phase (rollup or historic facts).

### S2 — Read four years for the school's own grades

- **School grade rows** (`subjectData.gradeDistribution` and its route) return 2021/22–2024/25 from the chosen source. **Same shape, same rules:**
  - `NON_GRADE_VALUES`;
  - the KS5 size weighting and AS/AEA exclusions;
  - qualification family gating;
  - the minimum-count rules.
- **The catalogue:** `measures.ts` years become `from: "2021/22"` for the grade measures. Remove the "rollup not read" gap notes from `measures.ts`, `rules.ts` and the generated `docs/catalogue/*.md`, then regenerate.
- **The rules:** confirm `R-TREND-LINE-4YR` now lets Grade 4+ / bands draw lines, and that "History, this school only" on Grade bands is a line.

### S3 — Comparator schools' grades (Comparisons)

- **Serve `/api/teacher/comparator-grades` from the chosen source** for one subject and four years, instead of parsing raw facts. It must give identical results for the years already shown, and it should be faster: report before/after timings.
- **Lift the greying** on "Across schools" grade lines (10 nearest, saved set) for **Grade 4+, bands and counts** in the editor (step 1, step 3 ticks), using the catalogue's honest rules.
  - Grade counts across schools should show a share (%), not raw counts, where schools differ in size. Follow the existing rule for comparator counts, or log the choice.

### S4 — The 2021/22 grading note

- **Why:** 2021/22 (summer 2022) was the first year back to exams after the pandemic, and was graded more generously. **Ofqual set grading roughly midway between 2021 and 2019.** A trend that starts in 2021/22 will often show a fall that is partly grading.
- **What to add:** wherever a grade or points **trend** includes 2021/22, put a short footnote on the view, in the existing note and caveat style (as the small-entries notes are done):

  > *2021/22 grades were awarded more generously (Ofqual's transition year), so some fall from that year reflects grading, not results.*

  - It appears on the view, in fullscreen and in exports.
  - It doesn't appear on latest-year views.
  - Put the wording in **one place**, so Guy can edit it.
- **Add a catalogue rule `R-2122-GRADING-NOTE`**, with a test.
- **Points too:** points trends already include 2021/22, so the note applies to them as well. **That's a deliberate wording change on live**; list it in the report.

### S5 — Expected figure changes, parity, before/after

- **Expected changes only:**
  - grade measures gain 2021/22 and 2022/23 (more years on trend charts and tables);
  - two-year bars become four-year lines;
  - anything computed "since the first year" moves: change since 2021/22, indexed lines, trend direction words (`R-TREND-FLAT-4PCT`), ranked change lists;
  - the new note.
- **Everything else must be identical:** every latest-year figure, every points figure apart from the note, and every Candidates figure. Run the parity harness on:
  - the four Teacher dashboards;
  - all Results measures and Compare-against sets;
  - 100053 GCSE, 117037 Post-16, and **137625 (The Chase) GCSE History**;
  - 1280 and 390, both themes.
- **Before/after tables for named schools** (format as in the night-2 report):
  - Grade 4+, bands (9–4, 9–7) and counts trends;
  - change since first year;
  - direction word;
  - a Comparisons across-schools grade line;
  - at least The Chase (History), Acland Burghley (one subject), King's Worcester (Post-16 Maths) and Croydon College (one BTEC).

### S6 — Report

Write `docs/v0.6/grade_data_round_report_v1.md`, with:

- the reconciliation decision per phase;
- what changed;
- the before/after tables;
- timings;
- migrations with apply commands, if any;
- logged calls;
- a click-through for Guy:
  1. The Chase, GCSE History, Grade bands: the school-only trend is a 4-year line with the 2021/22 note.
  2. Comparisons, Grade 4+: the 10 nearest line.
  3. A Post-16 subject, if KS5 shipped.
  4. A latest-year view, unchanged.

**Push the branch. Don't merge.**
