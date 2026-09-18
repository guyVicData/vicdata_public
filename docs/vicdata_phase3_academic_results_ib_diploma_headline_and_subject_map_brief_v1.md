# IB Diploma headline metric, subject-list clean-up, and a qualification-aware subject map

Bigger round than recent small fixes — Guy's own first live IB review surfaced three real problems, and scoping them properly surfaced a fourth, genuinely new one inside code already shipped and believed correct. Decision (confirmed with Guy): fix the root cause structurally, not just patch the one collision that surfaced it, and build the new IB headline metric in the same round rather than as a fast-follow.

## The four real findings, each confirmed directly against live data

### 1. "Baccalaureate" is not a subject — it's the whole Diploma's own total score

Confirmed in `canonical_facts_current` (`dfe_ks5_subject_results`/`_historic`): under qualification `International Baccalaureate`, subject `Baccalaureate`, size `5`, the real grade values are `24`–`45` — the actual Diploma point total (out of 45), not a subject grade. A second, genuinely different variant exists too: `International Baccalaureate Combined Certificate`, same subject text `Baccalaureate`, but size `0` and grades `A`–`E`/`Pass`/`Fail`/`Awarded`/`Not Awarded` — a different, non-Diploma IB award, not on the 45-point scale. Checked: under both qualifications, `Baccalaureate` and DfE's own `All subjects` pseudo-row (already excluded elsewhere) are the *only* subject values present — no other real content hiding under either qualification string.

Both are currently mapped by `subject_family_map` into `enterprise_applied` ("Enterprise & Applied Studies") alongside real subjects, as if a Diploma candidate "chose" Baccalaureate the way they chose History or Biology. It isn't a choice — every Diploma candidate has exactly one.

### 2. The IB Core's two components are graded A–E and read exactly like GCSE/A-level grades, but aren't optional subjects either

Under qualification `IBO Diploma Programme Core`, two subject rows, `Learning Skills` and `Study Skills`, both graded `A`–`E`. These are the Theory of Knowledge + Extended Essay matrix (the 0–3 bonus points added to the Diploma total) — mandatory for every Diploma candidate, not a subject choice, and the letter grades are DfE's own labels for a completely different points scale (Table 2g, already correctly implemented in the codebase — see finding 4). Both are currently mapped into `enterprise_applied`, same as Baccalaureate.

Real complication: `Study Skills` is *also* the genuine DfE subject name for EPQ (`Extended Project (Diploma)`, thousands of real entries nationally, A\*–E graded, a real and legitimate optional subject). Any fix must tell these two `Study Skills` apart by qualification, not by the text alone — deleting or excluding "Study Skills" outright would wrongly remove EPQ too.

### 3. A third Core component exists that the codebase doesn't yet know about — and it collides with Study Skills' own size

While scoping #2, a third raw subject turned up under the same qualification, `IBO Diploma Programme Core`: **`Self Development`**, graded `A`–`E`, size `0.2` — the exact same size as `Study Skills`. Confirmed this is real, distinct, ongoing content, not a renamed alias of the other two: `Learning Skills`/`Study Skills` co-occur 1:1 at identical school counts in every period 2021–2024 (69–74 schools), while `Self Development` appears consistently at a smaller, separate school count in every one of the same periods (24–33 schools) — a real third data point some schools' submissions include, not a relabeling over time.

This matters beyond the subject-list problem: `dfe-qualification-buckets.ts`'s `IB_CORE_BY_SIZE` table (and its Python twin in `ingest/dfe_points.py`) scores Diploma Programme Core rows **by size alone**:

```ts
const IB_CORE_BY_SIZE: Record<string, Record<string, number>> = {
  "0.3": { A: 12, B: 9, C: 6, D: 3, E: 0, Fail: 0 },
  "0.2": { A: 10, B: 8, C: 6, D: 4, E: 2, Fail: 0 },
};
// "The ingested data does not name which core component a row is, only its size,
// and the two real sizes happen to identify them."
```

That comment is no longer true — a third, real raw subject (`Self Development`) also carries size `0.2`, so it silently gets scored through the same table as `Study Skills` today, in code that a previous round explicitly verified and documented as correct. Real open question, not to be assumed either way: is `Self Development` genuinely IB-Core-matrix-eligible content that should be scored (in which case the scoring function needs to become subject-aware, not just size-aware, to tell it apart from Study Skills), or is it something DfE-submitted but not actually part of the real TOK+EE bonus-point calculation (in which case it should be excluded from bucket points the same deliberate way the whole Diploma total already is, per the existing comment about school 100369)? Research this — check DfE's own KS5 subject-level documentation/Table 2g guide for what "Self Development" actually represents — before deciding; don't guess from the shape of the numbers alone.

### 4. Mathematical Studies: a live, real grade-scale collision, confirmed at real schools, not theoretical

`subject_family_map` is keyed on `(ks_stage, raw_subject)` only — no qualification dimension (confirmed: `select ks_stage, raw_subject, family_id from subject_family_map`, used identically in both `recompute_subject_family_rollup()` and `recompute_subject_rollup()` in `ingest/academic_aggregates.py`). Two genuinely different real qualifications share the raw subject text `Mathematical Studies`: `Core Maths Qualifications at Level 3` (letter grades `A`–`E`) and `IBO Higher level component`/`IBO Standard level component` (numeric grades `1`–`7`).

Checked for real co-occurrence, not assumed: confirmed at real schools in real years, e.g. URNs 109369, 109371, 113910, 117017, 118223, 126137, 130629, 130803, 130851, 136276, 137339, 140987, 145749 all have *both* qualifications filed under `Mathematical Studies` in the same period. Since `recompute_subject_rollup()`'s grouping key is `(entity_id, ks_stage, subject, period)` with no qualification in it, `entries_total` for "Mathematical Studies" at these real schools currently blends two incomparable cohorts into one number.

## Why this is one root cause, not four separate bugs

`recompute_subject_rollup()` (and its family-grain sibling `recompute_subject_family_rollup()`) scan `dfe_ks4_subject_entries(_historic)`/`dfe_ks5_subject_results(_historic)` and resolve every row to a family via `family_map.get((ks_stage, subject))` — reading `qualification` off the breakdown but never using it except for the narrow GCE-A-level/GCSE-only points-eligibility check. Every one of the four findings above is really the same gap: the subject-choice system treats "subject" as bare text, with no way to know that the same text can mean a real subject in one qualification and something structurally different (a total score, a mandatory component, an unrelated qualification's own subject of the same name) in another.

`bucketFor()`/`bucket_for()` — the KS5 TYPE-filter classification (`alevel`/`ib`/`btec_ocr`/`tlevel`/`other`) — already exists as a tested, real twin in both repos (`dfe-qualification-buckets.ts` and `ingest/dfe_points.py`) and already correctly separates every qualification string involved here (IB variants → `ib`; Core Maths → `other`; EPQ → `other`). It's the natural building block for making the subject map qualification-aware, rather than inventing new classification logic — reuse it rather than re-deriving it, and keep the "twins must agree" discipline this whole arc has held to.

## What to build

### A. Make subject_family_map (and what it feeds) bucket-aware at KS5

The real requirement: the family lookup must be able to distinguish qualification where it matters. Two real ways to get there — pick whichever is the smaller, cleaner real diff once you're looking at the actual 282 rows, don't assume upfront:

- Extend `subject_family_map`'s key to `(ks_stage, raw_subject, bucket)`, defaulting existing rows to apply across every bucket they currently span (most subjects don't collide and don't need per-bucket rows at all), with explicit per-bucket overrides only where a real collision exists.
- Or a smaller companion table/override list, consulted first, for just the known collision cases, leaving the flat map as the fallback for everything else.

KS4 has no bucket concept in this codebase today (`bucketFor()`/`bucket_for()` is KS5-only). Check for a live KS4 equivalent of this same problem before assuming it doesn't need the same fix — a quick real query (same shape as the Mathematical Studies check above) settles it either way.

Update `recompute_subject_rollup()` and `recompute_subject_family_rollup()` to resolve family via the bucket-aware lookup, computing `bucket_for(qualification)` per row exactly as `_ks5_bucket_measures()` already does at KS5.

### B. Stop Baccalaureate and the Diploma Programme Core components being treated as subjects

Precise, confirmed exclusion set — verified there's nothing else hiding under these qualification/subject pairs, so this is exact, not a heuristic:

- `qualification IN ('International Baccalaureate', 'International Baccalaureate Combined Certificate') AND subject = 'Baccalaureate'`
- `qualification = 'IBO Diploma Programme Core' AND subject IN ('Learning Skills', 'Study Skills', 'Self Development')`

Remove these from `subject_family_map` (or exclude explicitly in the rollup scan, same treatment as the existing `All subjects` pseudo-row exclusion) so they stop appearing as subjects and stop inflating `enterprise_applied`'s entries_total. `Study Skills` under `Extended Project (Diploma)` must be untouched — confirm after the change that EPQ still appears normally with its real entries count.

### C. Resolve the Self Development / Study Skills size collision in the bucket-points code

Once B's research question is answered: if `Self Development` should be scored, `IB_CORE_BY_SIZE`'s lookup (both twins) needs to stop being size-only and become subject-aware too — check whether the raw subject text is actually available at the point this function runs (trace the call site; `SubjectGradeCount`/the KS5 raw-fact parsing already carries `subject` per row, so it may just need threading through). If it should NOT be scored, exclude it from the bucket-points calculation the same deliberate way the whole Diploma total is already excluded (with the same kind of documented, evidenced comment the existing code has for that exclusion). Either way, recompute and note whether this changes any real school's existing IB bucket points figure — if it does, that's a correction, not a regression, and should be reported as such with real before/after numbers for at least one affected school.

### D. Build the new "IB Diploma total points" headline metric

Confirmed there is no existing DfE-published headline column for this — `dfe_ks5_headline` only carries DfE's own five cohort categories (`A level`/`Academic`/`Applied general`/`Tech level`/`Technical certificate`), and `Academic` blends A-level and IB together, which is not what's wanted here. This is a genuinely new computation, not a column waiting to be exposed.

Source: the `Baccalaureate` subject-level data excluded in B — `International Baccalaureate`, size `5`, grades `24`–`45` (real point totals). Compute an entries-weighted average per school per year, the same real methodology already used elsewhere in this codebase for other points figures (not a new invented approach). Real decisions to make deliberately, not silently: how `Fail`/`No result`/`COVID result` should be treated in the average (count toward entries but not the points average, matching the established pattern for every other unscoreable-but-real outcome in this system — T Level's Partial achievement, VRQ's ambiguous grades — unless a real reason argues otherwise). Do not blend in `International Baccalaureate Combined Certificate` — it's a different, non-45-point award; decide explicitly whether/how it's surfaced at all this round, and say what you decided rather than silently dropping it.

Confirmed via a direct qualification-text scan that only five real IB-related qualification strings exist in the live data (`IBO Diploma Programme Core`, `IBO Higher level component`, `IBO Standard level component`, `International Baccalaureate`, `International Baccalaureate Combined Certificate`) — no Career-related Programme or other variant to account for.

Placement: above the subject list, per Guy's own framing — it's the flip side of the existing average-point-score figure, and the real headline number IB schools look for. Exact placement/wording alongside the existing whole-school headline area is a real product judgement call — use it, and say what you decided and why, rather than assuming one specific spot silently.

## Verify

- Hand-check a specific real IB school directly (pick one with a meaningful Diploma cohort) — compute the new headline figure by hand from the raw grade-count data and compare, the same discipline every round this arc has used rather than trusting internal consistency alone.
- Confirm the real Mathematical Studies co-occurrence schools listed above (at least 3–4 of them) now resolve cleanly — Core Maths entries and IB HL/SL entries no longer blended into one family/subject row.
- Confirm EPQ's `Study Skills` is completely unaffected — same entries count, same family, before and after.
- Spot-check a handful of ordinary, non-colliding subjects before/after the recompute to confirm the structural change didn't silently alter anything it shouldn't have.
- If C changes any real school's IB bucket points figure, report the specific before/after numbers for at least one such school.

## Deliverable

Full build report: the real findings with evidence (as verified independently, not just re-asserted), the shape of the structural fix actually taken and why, the exact exclusion applied, what was decided for Self Development and why, the new headline metric's real methodology and the judgement calls made, the recompute, and the hand-checks. Commit and push once verified.
