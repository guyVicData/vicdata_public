# KS2 domain comparison: replacing Section 03's KS2 placeholder with real content

KS2 structurally has no subject taxonomy (confirmed, permanent — every pupil sits the same fixed national tests) — but it does have a real, already-fully-ingested substitute axis: **domain**. This brief replaces Section 03's current KS2 gating (the "KS2 is assessed by domain, not subject" note added when Section 03 was fixed to stop showing "No real data to show yet") with real domain-level content, same Card-row shell as the GCSE/A-level subject engine, domains standing in for subjects.

Currently the KS2 whole-school headline only surfaces two figures — the RWM combined domain's `expected_standard_pupil_percent` and `higher_standard_pupil_percent` (`academic-data-view.ts` lines 157/163/417/423). Reading, Writing, Maths, GPS and Science individually are ingested but not shown anywhere in the product today. This round makes them visible for the first time.

## Data foundation — already fully ingested, no new backend needed

Source: `dfe_ks2_attainment`, whole-school (`breakdown_topic == "All pupils"`, `breakdown == "Total"`) scope only, real years 2022–2024, already on hosted production (no promotion step, unlike the subject-level historic sources). Confirmed directly from `vicdata/ingest/sources/dfe_ks2_attainment.py`.

Already wired and reusable as-is: `lookupReferenceData({ sourceId: "dfe_ks2_attainment", entityIds: urns })` already supports a batched multi-URN fetch — it's what feeds the existing KS2 whole-school headline today (`academic-data-view.ts:666`). The same call, same batching, extends directly to fetch every comparator school's KS2 domain facts for this round. **No new RPC, no new rollup table, no promotion — this should be achievable as a `vicdata_public`-only round.**

Real indicator columns, stored as `breakdown = "{subject}::{indicator}"` on each fact:

| Indicator | Reading | Writing | Maths | GPS | Science | RWM combined |
|---|---|---|---|---|---|---|
| `expected_standard_pupil_percent` | v | v | v | v | v | v |
| `higher_standard_pupil_percent` | v | v | v | v | - | v |
| `average_scaled_score` | v | - | v | v | - | - |
| `progress_measure_score` (+ lower/upper CI) | v | v | v | - | - | - |
| `absent_or_not_able_to_access_percent` | v | - | v | v | - | - |
| `working_towards_expected_standard_pupil_percent` | - | v | - | - | - | - |
| `absent_or_disapplied_percent` | - | v | - | - | v | - |

(Table reconstructed from the briefing paper's domain/measure matrix and the ingest module's own column list — **confirm the exact real `subject` string for each of the five domains not already used in code before building**. "Reading, writing and maths" is confirmed live already, quoted verbatim in `academic-data-view.ts`. The other five are very likely "Reading", "Writing", "Maths", "Grammar, punctuation and spelling", "Science" as real DfE labels, but check against real ingested rows rather than assuming — this project's own established discipline.)

## Design

**1. Domain replaces subject as the Section 03 axis for KS2.** Six fixed domain rows (Reading, Writing, Maths, GPS, Science, RWM combined) instead of a variable subject list — every KS2 school sits all six, so there's no "which domains does this school offer" question the way GCSE/A-level has a "which subjects" one. Same Card-row shell, same self-inclusive `comparableGroup` convention already used everywhere else on this page.

**2. No Candidates / Candidates %-change row.** Every domain has the identical fixed cohort — there's no qualification-entry concept at KS2. A "candidates" figure would just be roll size, which already belongs to the Rolls feature elsewhere in the product; not duplicated here.

**3. Results row — the richest available metric leads per domain, confirmed with Guy directly rather than forced into one uniform metric across all six.**
   - Reading, Maths, GPS: `average_scaled_score` leads (approx 80-120 scale, 100 = expected standard) — the finest-grained real figure DfE publishes for these three.
   - Writing, Science, RWM combined: `expected_standard_pupil_percent` leads — no scaled score exists for these three, structurally, not a gap.
   - Real consequence: the six rows won't all show the same *kind* of number — three show a scaled score, three show a percentage. Label the unit clearly per row so this reads as "each domain shows its own real, correctly-labelled figure" rather than one broken/inconsistent scale — matches this page's existing honest-asymmetry precedent (KS5 value-added CI, `points_coverage_percent`) rather than picking one artificial common denominator.
   - `higher_standard_pupil_percent` (every domain except Science) shown as a real supporting figure alongside the primary metric, not its own separate row — same "supporting figure, not a whole extra row" treatment as `points_coverage_percent` alongside `avg_point_score` elsewhere on this page.

**4. Results %-change row.** Trended across the real 2022-2024 span (`TREND_BASELINE_PERIOD.ks2 = 2022`, already established in the codebase), first/last real year with data, same resolution method used everywhere else on this page. Uses whichever metric leads for that domain (scaled-score %-change for Reading/Maths/GPS, %-expected-standard %-change for the other three).

**5. Progress measure with its CI — real supporting figure wherever it exists** (Reading, Writing, Maths only — GPS, Science and RWM combined structurally have none). Same honest-CI framing already established for KS5 value-added.

**6. A new row genuinely specific to KS2, worth including: participation/access.** `absent_or_not_able_to_access_percent` and `absent_or_disapplied_percent` vary meaningfully by domain (Science's own access pattern is structurally different from Reading's) and are already ingested but currently invisible anywhere in the product. Show as a real supporting figure rather than a full separate Card row, to avoid over-loading a genuinely thinner data source than GCSE/A-level with too many rows — your call on exact placement/prominence once you see it built.

**7. No drawer, no third level.** Domain is the real floor KS2 has — nothing further to drill into the way subject to single-subject deep-dive works for GCSE/A-level. Each row still gets the free fullscreen-expand every `Card` already provides for nothing extra.

## Explicitly out of scope

- Pupil-characteristic breakdowns (Sex, Disadvantaged, First language, Mobility, Prior attainment group) — real, present in the source file, deliberately reserved for the separate social-context work, not this round. Ingest already deliberately excludes them (whole-school scope only, confirmed in `dfe_ks2_attainment.py`'s own docstring, decision dated 2026-09-12).
- Section 01's Entries pie-chart row stays gated for KS2 — no entries/qualification-choice concept exists at KS2, correctly excluded already, not touched by this round.
- Any new ingest, promotion, rollup table, or RPC — this round should be achievable entirely from data already on hosted production via the existing batched `lookupReferenceData` call.

## Deliverable

Confirm the five unconfirmed real `subject` strings against real ingested data before building (a live query, not an assumption). Full build report, same shape as every prior round — real data verified against a real school and its real comparison set, not just code inspection. Commit and push once verified, per the normal working pattern.
