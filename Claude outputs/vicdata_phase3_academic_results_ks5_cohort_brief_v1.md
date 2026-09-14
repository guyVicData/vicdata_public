# Brief: KS5 qualification-type awareness — fix the "A-level only" blind spot, add real BTEC/IB comparator views

Queued behind the GCSE exclusion round (`docs/vicdata_phase3_academic_results_gcse_exclusion_brief_v1.md`)
— build this once that one's done and verified. Independent of it otherwise: touches
KS5 only, that round is KS4-only.

## Where this comes from

Guy's own stage-1 flag: "what we do about btecs - this KS5 data is not showing - so
for example Capital City College we just currently have A level stats - and most do
BTecs. This data is in the data set I think? ... and then also IB schools - this isn't
I think?"

Both checked directly against real data before writing this brief — **both BTEC and IB
results already exist in the ingested dataset**. The actual bug is narrower and purely
front-end: `academic-data-view.ts`'s `HEADLINE_MEASURE.ks5` is hardcoded to
`"A level::aps_per_entry"`, so any school whose KS5 cohort isn't (mostly) A-level shows
a near-empty or misleading headline figure — not because the data is missing, but
because the front end is only ever looking at one of several real `exam_cohort` values
DfE itself publishes.

## What's really in the data (confirmed, not assumed)

`dfe_ks5_headline.py` ingests DfE's live "Schools and colleges - performance" dataset
(publication "A level and other 16 to 18 results") with a real `exam_cohort` dimension
already kept distinct at ingest time: `Academic`, `A level`, `Applied general`,
`Tech level`, `Technical certificate`, `E/M measures`. Confirmed directly against
DfE's own published dataset metadata (`indicators`/`filters` on the live data-set
record) and against real rows for four real schools:

| School (URN) | exam_cohort rows with real (non-suppressed) APS entries, 2024/25 |
|---|---|
| Capital City College (130421) | Academic (868 entries), **A level (842)**, **Applied general (1083)**, Tech level (219), Technical certificate (42) |
| Sevenoaks (118952) | **Academic (244)** only — zero A-level entries |
| North London Collegiate School (102257) | Academic (96), A level (80) — both real |
| Leighton Park (110110) | Academic (78) = A level (78) (same pupils), Applied general (6), Tech level (6) |

This confirms the earlier finding precisely: Capital City College's real dominant KS5
cohort by entries is **Applied General** (BTEC-type), not A-level — the current front
end shows its A-level figure (842 entries, real but not the largest group) and nothing
for its larger BTEC cohort. Sevenoaks has **no A-level entries at all** — its real
results live entirely under `Academic`, which is DfE's own catch-all for A-level, IB,
Pre-U, Extended Project, and Core Maths together (confirmed via DfE's own official
16-18 technical guidance, already fetched and read in full for this project). NLCS is
genuinely mixed — real entries under both Academic and A level.

## New finding this brief adds: a real per-cohort entries count exists and was never ingested

The open question flagged after the last investigation — "there's no entries-count
field at KS5 headline level, so there's currently no way to tell which `exam_cohort`
is a mixed-cohort school's real dominant one" — is now settled. Fetched DfE's actual
live CSV directly (`api.education.gov.uk/statistics/v1/data-sets/{id}/csv` for
"Schools and colleges - performance") and read its real header, which is wider than
`dfe_ks5_headline.py`'s own `_EXPECTED_HEADER` list (that list is deliberately only
the subset of columns the module chooses to parse, checked via
`ignore_added=True` in `base.check_header_mismatch` — new/unlisted columns in the real
file are expected and silently ignored, not a schema-drift error).

The real, full column set includes, alongside every indicator `dfe_ks5_headline.py`
already ingests, a genuine per-row student-count column for each: `aps_per_entry_student_count`,
`retained_student_count`, `retained_2nd_year_student_count`,
`best_three_alevels_student_count`, `aab_student_count`, `level_3_maths_student_count`,
`vocational_student_count`, `maths_progress_inscope_count`, `english_progress_inscope_count`
— real per-`(school, disadvantage_status, exam_cohort)` denominators, none currently
ingested. (`end1618_student_count` also exists but is the whole-school 16-18 cohort
size repeated identically on every `exam_cohort` row for a school/year — confirmed
directly, e.g. Capital City College shows `end1618_student_count = 4859` on all six of
its cohort rows — so it's *not* usable for telling cohorts apart; it's a different,
whole-institution figure worth having someday for a "population" figure but not what
this brief needs.)

`aps_per_entry_student_count` specifically is the real entries count underlying the
very "average points per entry" figure already shown as the KS5 headline stat — the
right, defensible signal for "which cohort actually has the most entries for this
school," directly matching the numbers in the table above (they came from this real
column).

## Part 1 — Ingest: land the real entries-count column

In `dfe_ks5_headline.py`, add `"aps_per_entry_student_count"` to `_NUMERIC_COLUMNS`
(and therefore automatically to `_EXPECTED_HEADER`, which is built from it). Confirm
first that `base.check_header_mismatch`'s real behaviour (read it directly — it's a
plain set comparison, `ignore_added=True` already used here) won't flag anything by
adding one more real, confirmed-present column. No other ingest changes needed —
`_parse`'s existing loop over `_NUMERIC_COLUMNS` already handles it as
`{cohort}::aps_per_entry_student_count`, same pattern as every other measure in this
file.

Run the ingest locally (same discipline as every prior round — local Supabase stack
only, don't touch hosted), promote, and verify directly against real rows for all four
schools in the table above that `{cohort}::aps_per_entry_student_count` values now
exist in `canonical_facts`/`academic_headline_snapshot` and match the real figures
quoted here (868/842/1083/219/42 for Capital City College; 244 for Sevenoaks; 96/80
for NLCS; 78/78/6/6 for Leighton Park). Don't touch `dfe_ks5_headline_historic.py` —
the earliest year this feature's trend baseline (`TREND_BASELINE_PERIOD.ks5 = 2021`)
ever needs is already fully covered by the live/modern source alone (confirmed: it
spans 2021/22–2024/25 in one file, per its own module docstring), so the historic
source is out of scope here.

## Part 2 — Free card & paid Overview headline stat: auto-detect the school's own real dominant cohort

This is the fix for the reported bug itself (a single school's own headline number,
no group comparison involved, so there's no cross-school comparability problem to
worry about here).

Add a function alongside `HEADLINE_MEASURE` in `academic-data-view.ts` — something
like `dominantKs5Cohort(profile): string | null` — that, for a school's latest KS5
year, picks whichever real `exam_cohort` has the highest
`{cohort}::aps_per_entry_student_count` value among the six real cohort names
(`Academic`, `A level`, `Applied general`, `Tech level`, `Technical certificate`,
`E/M measures` — though `E/M measures` never carries a real APS entry count in any
real row seen so far and can likely be excluded from consideration; confirm against
real data rather than assuming). Falls back to `null` if the school has no real KS5
entries-count data at all (pre-Part-1-ingest gap years, or a school with genuinely no
KS5 provision).

Use this instead of the hardcoded `HEADLINE_MEASURE.ks5` wherever a **single school's
own** headline figure is shown with no group involved: the free snapshot card
(`AcademicSnapshotCard.tsx`) and the paid Overview's big headline number
(`AcademicGraphsView.tsx`'s Overview section — the number itself, not its spread/
growth/trend sub-sections, which are Part 3 below). Label honestly using the real
cohort name, not always "A-level" — e.g. "Capital City College's Applied General
students achieved an average of 24.3 points per entry" rather than continuing to say
"A-level students" for a school where that's not the dominant real cohort. New wording
needed — see the wordings-doc section below.

**Verify with real execution against all four named schools plus one control**
(Huntington School, URN 121673, or any other school already confirmed A-level-only
from earlier rounds): Capital City College should now show its real Applied General
figure; Sevenoaks and Leighton Park (previously blank/near-empty on the old hardcoded
key) should now show real numbers under "Academic"; NLCS should show whichever of
Academic (96) or A level (80) — in this case Academic, since it has more real entries;
the control school's number should be completely unchanged from today (real A-level
data staying the dominant, and only, real cohort).

## Part 3 — Group/comparison views at KS5: a real qualification-type selector, not silent auto-detection

This is what actually delivers what Guy explicitly asked for beyond the bug fix
("very useful comparator sets — IB rankings are very hard to see on the web
currently. And I have never seen BTEC rankings").

**Why auto-detection alone isn't enough here, unlike Part 2**: ranking or comparing a
group of schools needs them all measured on the *same* cohort — silently letting each
school in a comparator set pick its own dominant cohort would produce exactly the kind
of apples-to-oranges mixing this whole review keeps finding and fixing (it's the same
underlying problem as the GCSE/IGCSE round, just for KS5 qualification type instead of
KS4 curriculum type). The fix there was "leave incomparable schools out, with a
visible note" — reuse that exact pattern here rather than inventing a new one.

Add an explicit qualification-type control for KS5, visible wherever a *group* of
schools is being compared: Rankings (`AcademicRankingsView.tsx`), the Overview
section's own spread/dot-strip and Growth/decline and Context-over-time sub-sections
(`AcademicGraphsView.tsx`), and the Map (`AcademicMapView.tsx`) when `stage === "ks5"`.
Options: **A level** (default — keeps today's behaviour as the starting point for
everyone), **Academic** (labelled honestly, not as "IB" — see wording below),
**Applied General**, **Tech Level**, **Technical Certificate**. On first load, default
the selector to the *target* school's own dominant cohort from Part 2 (so a user
opening Capital City College's Rankings sees its real Applied General ranking by
default, not a jarring near-empty A-level one) — but make it a real, user-changeable
control from there, not a fixed per-school default with no way to see other cohorts.

One reasonable place for this control: next to (or as a natural extension of) the
existing `KsStageSwitcher` pattern in `AcademicDataView.tsx` — a second-level switcher
that only appears when the active stage is `ks5`, threaded down the same way `familyId`
already is. Your call on the exact placement/component shape; keep it visually
distinct from the Category (subject-family) filter so it doesn't read as the same
control by a different name.

**Schools without real, non-suppressed data in the selected cohort are left OUT** of
that specific chart/ranking/map — not shown with a zero or a blank slot — exactly the
same "denominator shrinks, visible note names who's missing and why" behaviour already
built for GCSE exclusion. Reuse whatever shared helper/pattern that round built for
the note, rather than writing a second, subtly different version. Wording for the note
here needs its own real sentence (a school isn't "excluded" in the IGCSE sense — it
just doesn't have entries in the qualification type currently selected) — see below.

**Verify with real execution**: switching Rankings' selector to Applied General with
Capital City College ticked (or as target) should produce a real ranking including it
and any other real schools with Applied General entries, and should visibly note any
ticked schools with no Applied General entries as left out. Switching to Academic with
Sevenoaks in the group should include it (244 real entries) even though it has zero
under A level; switching to A level with Sevenoaks in the group should show the note
that Sevenoaks isn't shown (zero real A-level entries) rather than a silent zero.

## Wording — new section for `vicdata`'s own `docs/vicdata_phase3_academic_results_summary_wordings_v1.md`

Read that doc's existing §8/§9/§11 first for the house style and the exact
group-note pattern §11 already settled (list-and-reason, singular/plural forms) —
mirror it, don't reinvent it. Add a new §13 (after §12's open questions) covering:

- **Free card / Overview headline stat, cohort-aware**: same shape as §1/§2's existing
  A-level sentence but with the real cohort name substituted in place of "A-level" —
  "[School]'s [Applied General] students achieved an average of [24.3] points per
  entry in [2024/25]." For `Academic` specifically, don't say "Academic students" (DfE
  jargon, not a real-world qualification name a school leader would recognise) — say
  something like "[School]'s A-level/IB students achieved an average of [X] points per
  entry" or similar plain-language framing; word this carefully, it's the one case
  here that needs real thought rather than a mechanical substitution.
- **The qualification-type selector's own label for "Academic"**: needs to say
  plainly that this groups A-level with IB, Pre-U, Extended Project and Core Maths
  together, and is not a pure IB figure — e.g. "Academic (A-level, IB and other
  qualifications DfE reports together)" as the control's own label/tooltip, not
  buried in a caption only some users will read. A school with real `Academic` entries
  but zero real `A level` entries (like Sevenoaks) is the clearest real-world signal
  that a school is genuinely IB/Pre-U-taught — worth stating directly somewhere
  visible when that's the case, e.g. "[School] reports no A-level entries — its
  results here are under DfE's combined Academic category (which includes IB)."
- **Group-comparison qualification-type note** (mirrors §11's own shape exactly):
  "[School A] isn't shown in this [Applied General] comparison — it has no real
  entries recorded in that qualification type." / multiple-school plural form matching
  §11's own.
- **Whole-group-empty fallback** (mirrors §11's own): "None of the schools in [the
  comparator set name] have entries in [Tech Level] to show here — try a different
  qualification type."

## What NOT to build this round

- No attempt to isolate "pure IB" out of the `Academic` cohort — DfE's own data
  doesn't support it at headline level (confirmed via their own technical guidance);
  the honest "Academic (A-level, IB and other)" framing above is the ceiling of what's
  achievable here, not a stopgap for something better arriving later.
- No change to `dfe_ks5_headline_historic.py` or to any KS2/KS4 code — KS5-only.
- No attempt to build a qualification-type selector for the free snapshot card — that
  tier stays single-number/auto-detected only, per Part 2; the explicit selector is
  Part 3's paid-tier, group-comparison-only addition.
- Don't rank on `end1618_student_count` for anything — it's whole-school, not
  per-cohort, and using it as if it were would silently misattribute population to the
  wrong qualification type.

## Deliverable

Full report, same shape as every prior round. Confirm Part 1's real ingested values
against the real figures quoted in this brief for all four named schools. Confirm
Part 2's real headline-stat output for all four schools plus the control school.
Confirm Part 3's real behaviour: at least one cohort switch that changes which real
schools appear in a Ranking, one real "left out, here's why" note actually rendering,
and (browser available or not — say plainly either way, same honesty rule as every
round) a real visual check of the new selector control if a browser tool exists this
session. Build and test locally only — do not commit, push, or touch hosted/
production. Guy will review Capital City College (BTEC), Sevenoaks (IB/Academic), and
NLCS (mixed) himself before anything ships.
