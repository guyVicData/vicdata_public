# VicData 0.7 — Admissions, round 1: data layer, roles and shared lists (no dashboard UI yet)

Claude Code build prompt, written 7 Oct 2026. It is the first round of the Admissions dashboards.

**Read first, in full:**
- `docs/v0.7/vicdata_0_6_admissions_dashboard_data_plan_v1.md`: what the data holds and can't claim, the cohort ladder, framing, rivals, flags, roles and decisions;
- the wireframes in `docs/wireframes/admissions/` (the canvas "VicData Admissions dashboards"): `Main` (Pipelines), `MarketShare`, `Pipeline16`, `ShapeView`, `RivalMomentum`, `RivalSubjects`, `Phone`, `Onboard1`–`4`.

**This round builds what the views will stand on,** and proves it with rule tests on real schools:
- the data layer;
- the roles;
- the shared lists;
- the flags.

**Not in this round:** the dashboards, setup screens and views, which come in round 2 after Guy reviews this round's report.

**Run this after 0.6.6 / 0.6.7 have merged.** It uses 0.6.6's whole-population ranking function and 0.6.7's lean school details.

## Ground rules

- **Branches:**
  - app: `v0.7-admissions-r1` from `main`;
  - ingest repo: `feat/admissions-derived` from `main`.
- **Commit per stage,** with tsc, eslint, build, unit tests, rule tests (`npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`) and the existing parity harness all clean.
- **Nothing that exists may change.** Teacher, the Data View and the public school page are byte-identical in parity. Admissions adds things alongside them.
- **Never put a server key in client code.**
- **Database changes are written and tested, never applied by you.**
  - App database (vicdata-public, `lnhulykjlxmoneappnsp`) migrations go in this repo.
  - Production (vicdata-production, `hrqrbvrrhlidpoybezhs`) migrations go in the ingest repo.
  - Give apply commands as `&&` chains with the project-ref check and **no `exit`**.
- **Stage files by name; never `git commit -a`.** Leave Guy's untracked or modified files alone.
- **Log calls** under "2026-10-xx — 0.7 admissions r1" in `docs/OPEN_QUESTIONS.md`.
- **Don't merge.** Push both branches and report. This round adds the first delegated role-granting, so **a separate reviewer agent** (one that hasn't seen the build) must review A3 before Guy merges.

## A1 — The cohort ladder and pipeline maths (app, `src/lib/admissions/`)

A pure, unit-tested library, no UI, that computes everything Pipelines shows. Its inputs are the existing census, births and GIAS lookups.

1. **Entry points:**
   - 4+, 11+ and 16+, plus any custom age from 2 to 17;
   - the entry age, the matching rungs, and which kinds of school hold each age now.
2. **The cohort ladder** for an entry point and a rung set. For each future September from next September onward, return the pool and its source:
   - **counted** (census ages, at 31 August of the census year);
   - **births** (calendar-year births split 8/12 of year Y plus 4/12 of year Y−1; method note);
   - **projection** (ONS age-10 projections; 11+ only; off by default).
   Return the past pools 2020–2026 by the same method from earlier censuses.
   - **Horizons:** 16+ up to 10 years; 11+ up to 10 years; Reception at most 2 years beyond the last birth year.
   - **Full-time pupils** for ages 4 and up. For nursery ages, full-time plus part-time headcount, logged as a call.
3. **Drift ranges:**
   - for the set, measure the year-on-year change of each cohort from 2019/20 to 2025/26;
   - apply the spread (e.g. the 10th–90th percentile of the observed ratios) cumulatively, so the range widens with distance;
   - **never a single-point forecast** beyond the counted rungs.
4. **The LA birth blend:**
   - automatic weights from the LAs of the feeder schools (or the nearest schools), weighted by their pupils at the relevant age;
   - the Admissions lead can override it, and the override is saved with the lists (A3).
5. **Share needed to hold numbers steady:**
   - the school's entry-age cohort now, divided by the pool, each future year;
   - the current share is the latest year's;
   - it is labelled as a requirement.
6. **Market share:**
   - the school's count at the entry age, divided by the sum over the rivals plus the school, 2019/20–2025/26;
   - the same for a whole age band;
   - ranks within the set.
7. **Leaving at 16 and the first new-joiner estimate** (rolls spec §7): follow a cohort across census years, per school. Use the derived table from A2 when present, otherwise compute on the fly. Label it an estimate.
8. **Size and shape:** reuse `sizeBadgeForValue` (XS–XL by phase) and the shape classifier exactly as the school page does. **No new size words.** The **local shape** is the classifier run on the summed age profile of a set.

**Catalogue rules and tests** (`src/catalogue/`): add a rule per mechanism, with a statement, the honesty wording and a real-data test:
- R-ADM-LADDER;
- R-ADM-BIRTH-SPLIT;
- R-ADM-DRIFT-RANGE;
- R-ADM-HOLD-SHARE;
- R-ADM-GROUP-SHARE;
- R-ADM-JOINERS-ESTIMATE;
- R-ADM-SHAPE-NOT-RANKED;
- R-ADM-POOL-NOT-INTAKE.

**Test schools:**
- The Chase 137625 (11+, 16+);
- King's Worcester 117037 (independent, 11+ and 16+);
- an independent prep with boarders;
- an 11–16 school;
- an FE college (16+ only);
- a state primary (4+ only).

Hand-check one ladder against the raw census rows in the report.

**The wording** ("pool, not intake"; "share of this group"; "a requirement, not a forecast"; "estimate") goes in one place, `src/catalogue/notes.ts`, like the trend notes.

## A2 — Derived per-school table and nationally set flag thresholds (ingest repo, production)

1. **A table, e.g. `school_cohort_flow`:** per school and year, the leaving share at 16 and the estimated joiners at each age. It is rebuilt on census promote via `on_academic_source_promoted` or the census equivalent, plus a backfill script. Read it through a security-definer lookup granted to anon, in the style of `academic_subject_grade_rollup_lookup`.
2. **National flag distributions:** per phase, the 20th and 80th percentiles of two-year change for:
   - entry-age cohort size;
   - whole-school roll;
   - headline results (Attainment 8, A-level points per entry; KS2 where published);
   - subject-area results.
   Store them in a small table rebuilt on census and results promotes. **Guy decided** that thresholds are set nationally for now and adjusted later, so the percentiles and minimum cohort size are **constants in one place**.
3. **Tests** in `tests/`, and a read-only dry run with counts.

**Stop with the migrations and backfill unapplied.** Give the commands.

## A3 — Roles and the shared lists (app database)

1. **The Admissions lead:**
   - add a **lead flag** to the admissions membership (preferred over a new role value, so a lead is still `admissions` everywhere else). Log the choice;
   - `roles.ts` labels it "Admissions lead";
   - only the School-Admin can make someone lead.
2. **The lead adds staff** (Guy, 7 Oct): a security-definer function that lets the lead **grant or remove `admissions` only, for members of the lead's own school only**.
   - The lead can never grant lead, `smt` or any other role, and can't remove the School-Admin's grants.
   - Every change goes to the audit log.
   - The School-Admin's People page shows these changes and can override them.
   - Enforce it in the database (RLS and the function), not only in the interface.
3. **Shared lists, school-level:** `admissions_lists` with:
   - school;
   - entry point;
   - kind (`day_feeders` | `boarding_feeders` | `rivals` | `rung` for 16+ rungs);
   - members (URNs), or a fuzzy definition (filters: sector, gender, boarding, LAs, age range, "big leaving numbers at 16");
   - LA-blend overrides;
   - last changed by and when.
   **Read:** Admissions, SMT, and teams or roles the list is shared with through the existing Assign / share. **Write:** the Admissions lead only (RLS).
4. **The school's entry points** live in the same scope (school-level, lead writes).
5. **Admissions comes with the whole-school package** (Guy): no separate paywall; access is by role only.
6. **RLS tests:** a script that signs in as each role on a test school and proves:
   - read and write as described;
   - the lead's granting limits;
   - no access across schools.

## A4 — Rivals' ranks and flags (app, server routes)

1. **Ranks:** each rival's **regional and national rank**, using 0.6.6's ranking function:
   - results: headline, subject area, subject;
   - size: rank by roll and XS–XL.
   Return them alongside the rivals' figures for the views.
2. **Strengths and weaknesses:**
   - your rank among rivals by subject area (only rivals with that area; minimum entries);
   - the gap to the rivals' average, and its direction since 2022/23;
   - flags: Strength, Strength growing, Weakness, Weakness widening, by the national thresholds from A2.
3. **Momentum flags for rivals:** results rising fast, gaining pupils, losing pupils three years running, Year 7 shrinking, new sixth form, shape changed.
4. **Feeder flags:** **red flag** for a drop bigger than the area's; **focus** for rising or stable numbers.
5. **Every flag:**
   - a catalogue rule with a real-data test;
   - the figures behind it are returned for the hover;
   - **never from one small cohort**.
6. **The rivals' academic view by entry point:** 4+ → KS2, 11+ → GCSE, 16+ → Post-16. Honest gaps: preps without KS2 show "no published results", and IGCSE-heavy schools are listed but not ranked.

## A5 — Server routes (no UI)

Add `/api/admissions/*` routes the views will call:
- pipeline;
- market share;
- rivals (ranks, momentum, strengths);
- shape and size;
- lists (read and write, lead only).

Use member auth as Teacher routes do, plus the lean school details from 0.6.7. Cache public reference reads as 0.6.4 does; **no per-user or per-school data in a shared cache**.

**Speed targets on a warm server:**
- pipeline for a 25-school set: under 600 ms;
- market share for 10 rivals: under 400 ms;
- rivals' ranks: under 800 ms.

Report the timings.

## Report

Write `docs/v0.7/admissions_r1_report_v1.md`, with:

- what was built;
- **a hand-checked ladder and market share for The Chase and King's Worcester** (census rows, then the result);
- rule tests;
- the RLS test output;
- the reviewer agent's findings on A3, and what was fixed;
- the migrations and apply commands (both databases, in order);
- timings;
- logged calls;
- the questions for Guy before round 2 (the views).
