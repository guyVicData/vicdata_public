# Briefing: KS2 — what is measured and counted

For planning the whole-school → category → subject comparison ladder. Verified live against the hosted database, 2026-09-14.

## What it is

Key Stage 2 (KS2) is the end-of-primary national curriculum test result, age 11 — SATs. In VicData it's `dfe_ks2_attainment`: 574,427 rows, one data set (DfE's "Key stage 2 institutional level" v1 API feed), covering 2022–2024 only. There is no historic extension and none is planned — SATs were disrupted through 2020–2021 (cancelled/non-standard), so 2022 is genuinely the first year of continuous, comparable national data, not a gap in VicData's ingest.

## The core structural fact: no subject taxonomy, and that's correct

KS2 has no `subject_family_map` entries and no category/subject split of any kind. This isn't a gap to close — every pupil sits the same fixed set of national tests, so there's nothing to categorise. KS2 doesn't have a "subject level" the way GCSE and A-level do; it has **domains** (six of them), each with its own fixed, non-uniform set of measures. It sits outside the whole-school → category → subject ladder entirely: it's whole-school, by domain, full stop.

## The six domains and what's measured in each

Measures are not symmetric across domains — each domain only has the measures DfE actually publishes for it:

| Domain | Scaled score | % expected standard | % higher standard | % below/absent | Progress measure (+CI) |
|---|---|---|---|---|---|
| Reading | ✓ | ✓ | ✓ | ✓ (absent/not able to access) | ✓ |
| Writing | — (teacher-assessed, no test score) | ✓ | ✓ | ✓ (absent/disapplied) + working-towards | ✓ |
| Maths | ✓ | ✓ | ✓ | ✓ (absent/not able to access) | ✓ |
| GPS (grammar, punctuation & spelling) | ✓ | ✓ | ✓ | ✓ (absent/not able to access) | — |
| Science | — | ✓ | — | ✓ (absent/disapplied) | — |
| Reading, Writing & Maths combined | — | ✓ | ✓ | — | — |

Notable asymmetries worth remembering when building anything on top of this:
- **Writing has no scaled score** — it's teacher-assessed against standards, not sat as a test, so there's nothing to score numerically. Only the percent-threshold measures exist.
- **Science has the thinnest measure set** — no scaled score, no higher-standard percent, no progress measure. Just "% reaching expected standard" and an absence/disapplied rate.
- **GPS has no progress measure** — DfE doesn't publish a KS1→KS2 progress figure for grammar/punctuation/spelling, only for Reading, Writing and Maths.
- **The combined RWM domain is a pure threshold measure** — no scaled score, no progress figure, just the two headline percentages schools are usually judged on publicly ("expected standard" and "higher standard" in reading+writing+maths together).

## Scoring: scaled score, not points

KS2 uses **scaled scores** (roughly 80–120, with 100 defined as "the expected standard"), not a points system. There is no average-point-score concept at KS2 at all — nothing analogous to GCSE's 9–1 points or A-level's grade points exists or would make sense here, since the domains aren't qualifications being compared against each other, they're independent tests.

## Planning implication

KS2 is useful to VicData mainly as **population/context data** — the attainment profile of the age-11 cohort a secondary school's catchment is drawing from — not as a rung on the category/subject comparison ladder Guy is planning for GCSE and Post-16. Any "whole school → category → subject" feature should treat KS2 as out of scope by design, not as a future phase of the same feature.
