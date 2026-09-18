# Qualification-type comparability: layout fix + a real comparison filter

Two things confirmed in discussion with Guy, worth building as one brief since the second depends on understanding the first: (A) a simple UI layout fix — move the stage buttons into the existing Qualification Type row, no new logic; (B) a genuinely new filter, built on real DfE evidence gathered this round, letting users compare "oranges with oranges" (same qualification type, different schools) rather than only DfE's own blended headline figures.

**Do not confuse (A) and (B).** They are two different controls, with two different real vocabularies, living in two different places on the page. Building them as one merged thing would be a mistake — see "Why these stay separate" below.

## Part A — Layout fix (simple, no new logic)

Today: `KsStageSwitcher` (real labels `KS2` / `GCSE` / `Post-16`, `STAGE_LABEL` in `academic-data-view.ts`) portals into the shared `TopicTabs` row via `stageSwitcherSlot`. `Ks5CohortSwitcher` (labelled "Qualification type", real options in `KS5_COHORT_OPTIONS`: A-level / Academic / Applied General / Tech Level / Technical Certificate — DfE's own `exam_cohort` values, verbatim) renders separately inside `AcademicDataView.tsx`, only once Post-16/KS5 is selected.

Move the stage buttons out of the `TopicTabs` portal and into one combined row with the existing Ks5CohortSwitcher, relabelled:

```
QUALIFICATION [KS2] [GCSE] [Post-16]     TYPE [A-level] [Academic] [Applied General] [Tech Level] [Technical Certificate]
```

- Stage buttons: same three, same labels, same behaviour — always visible.
- TYPE half: same five pills, same behaviour, same labels — only visible once Post-16 is selected, exactly as today.
- **Do not rename any TYPE pill.** Checked directly against DfE's own qualification lists and methodology guides this round: "Tech Level" is DfE's own real category name (traces to the 2013 TechBacc reform) and is NOT the new T Level qualification — renaming it "T-level" would misrepresent what it shows. "Academic" genuinely blends A-level and IB entries per DfE's own combined reporting category (confirmed in code: `ks5HeadlineLabel` returns `"average points per A-level and International Baccalaureate entry"`) — renaming it "IB" would misrepresent that too, especially now that Part B below introduces a real, separate, unblended "IB" concept on the same page. Keep both labels exactly as they are.

## Part B — A real qualification-type comparison filter (new)

### The real problem, confirmed against live data

Checked directly: Capital City College's "Business & Law" subject-family card mixes A-level and BTEC entries in one list, with no way to see just one. Confirmed in code: `ks5Cohort` (Part A's TYPE selector) is never referenced anywhere in `SubjectAreaSection.tsx` or `SubjectDeepDiveDrawer.tsx` — the TYPE pill only ever affects the whole-school headline figure. Subject-level display has never been filterable by qualification type at all, at either the subject-card level or the comparator-set level.

### DfE's own stated purpose, and why their categories don't solve this

DfE's 2014 accountability consultation states the goal plainly: "it is therefore important that students and parents can compare like with like." That's the same goal here. But DfE's own category boundaries don't reliably deliver it — confirmed directly against DfE's official 2018 qualification lists that Cambridge Technical titles split across "Applied General" and "Tech Level" **by subject area**, not by size or rigour (Business/Health & Social Care Cambridge Technicals -> Applied General; Digital Media/Engineering/IT/Sport Cambridge Technicals -> Tech Level, despite identical GLH sizing). Treat DfE's five categories as a cross-check against official accountability reporting, not as the backbone for this filter.

### The real buckets — confirmed against actual ingested data, not guessed

Pulled every real distinct `qualificationType` string and its row count from `dfe_ks5_subject_results`/`dfe_ks5_subject_value_added` (33 distinct types). Grouped by real qualification family and cross-checked grading schemes directly against the data:

| Bucket | Real qualifications inside | Splits into | One-line description |
|---|---|---|---|
| **A-level** | GCE A level, GCE AS level (all variants), Advanced Extension Award | AS vs A2 | The traditional academic route — graded A*-E (AS: A-E) |
| **IB** | IBO Higher/Standard level components, International Baccalaureate (Diploma points), IBO Diploma Programme Core, IB Combined Certificate | by component | The International Baccalaureate Diploma — six subjects plus an extended essay and Theory of Knowledge core, out of 45 points |
| **BTec & OCR** | All BTEC National (Certificate/Extended Certificate/Diploma/Extended Diploma/Foundation Diploma) + BTEC Technical L2, all OCR Cambridge Technical L2/L3 | BTEC only / OCR only | Applied, coursework-assessed Level 3 vocational qualifications. Confirmed same real grade vocabulary (Pass/Merit/Distinction/Distinction*, same paired/tripled combination forms) across both awarding bodies -- genuinely comparable |
| **Other** | EPQ, Core Maths, Free-standing Maths, Pre-U, VRQ, Other General L2/L3 | -- | Each gets its own one-line note (see below); not comparable within itself as one group |

**VRQ needs an honest caveat, not a clean grouping.** Confirmed directly in `vicdata`'s own ingest source comments (`dfe_ks5_subject_results.py`, 2026-09-12 investigation of Haverstock School row collisions): "VRQ Level 3" genuinely combines multiple real, differently-sized qualification variants under one coarse DfE label (0.5 vs 1.0 A-level-equivalent size), with no finer detail available in the public file. A user filtering to "VRQ" would be comparing genuinely unlike things without knowing it. Show it inside "Other" with its own explicit caveat sentence -- do not imply it's one coherent qualification.

**EPQ, Core Maths, Free-standing Maths aren't subject-comparable at all** -- they don't belong to any one subject family the way Chemistry or Business does (EPQ is a generic research-skills qualification; Core Maths/Free-standing Maths are extra standalone maths quals, not tied to the main Maths A-level subject family). Keep them in "Other," flagged individually, not folded silently into a subject family list.

### Where this filter lives -- recommended, not yet built, confirm before Claude Code starts

Two real places this needs to apply, both using the same bucket vocabulary and same component:

1. **Comparator-set membership** -- a real ask from Guy ("compare between IB schools"): which schools count as comparable, filterable by which qualification-type bucket(s) they offer.
2. **Subject-family card / subject deep-dive drawer** -- filters which entries show within one school's card (so Capital City College's Business & Law card can show BTec-&-OCR-only, or A-level-only).

**Recommendation: build this as its own new control, separate from Part A's TYPE row.** Part A's row governs the DfE-validated headline comparison (unchanged, still five DfE cohorts). This new filter governs a structurally different thing -- subject-grain, unblended, real-world-grouped comparability -- and reusing Part A's row/vocabulary for it would conflate two genuinely different concepts sitting on the same page (DfE's blended "Academic" headline pill vs. this round's new, unblended "IB" bucket, for instance). Recommended placement: inside the comparator-set controls (sidebar/`AddSubtractSchoolsWindow`-adjacent) for (1), and inside `SubjectAreaSection.tsx`'s subject-family card and `SubjectDeepDiveDrawer.tsx` for (2) -- both driven by one shared bucket definition (a new lookup table/constant, not duplicated).

## Explicitly out of scope this round

- The "subject-crossing" idea (grouping Core Maths + Free-standing Maths + A-level Maths + IB Maths etc. as one real subject regardless of qualification type, for a department-level view) -- a real, valuable, separate future feature, not this round.
- T Level -- covered in its own companion brief (`vicdata_phase3_academic_results_t_level_ingest_brief_v1.md`). Once that lands, T Level becomes a fifth bucket in the table above, with its own honest caveat (UCAS Tariff points, not DfE's points scale -- see that brief).
- A wider UCAS-Tariff-based comparability layer spanning every qualification type -- a real, promising idea Guy wants pursued, parked separately (see `claude/vicdata_phase3_academic_results_future_ideas_v1.md`), not this round.

## Deliverable

Confirm the recommended placement (Part B, above) before building -- a one-line "yes, that's right" or a correction is enough, this doesn't need another full design round. Build Part A first (simple, no real open questions). Build Part B against real data: verify the bucket assignment for all 33 real qualification-type strings programmatically (don't hand-classify), confirm the VRQ caveat renders honestly, confirm GCSE/A-level behaviour is unchanged (equivalence-check the same way the qualification-type bugfix round did). Full build report. Commit and push once verified.
