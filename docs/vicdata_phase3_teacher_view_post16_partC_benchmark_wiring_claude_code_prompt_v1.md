# Teacher View Post-16 Part C — KS5 benchmark wiring, own-figure fix, national-threshold regression

Frontend only (`vicdata_public`). Follows Part A (`c0040fd`), Part C1 (`95cdd49`), and vicdata's
Part B (`7430520`) and Part B-2 (`0c60f76`, `eaf7cda`) — all shipped and confirmed on production.
Full history: `docs/vicdata_phase3_teacher_view_post16_qualification_split_and_ks5_benchmark_claude_code_prompt_v1.md`
and `docs/vicdata_phase3_teacher_view_post16_qualification_status_v1.md`.

Three independent pieces of work. Do them in this order — the first is small and fixes a live
regression; the other two are the actual Part C scope.

## 1. Fix the Gujarati/Persian-Language regression (do first, small)

`eaf7cda` added `p_min_school_count int default 5` (trailing param, both functions) to:

- `academic_subject_geography_lookup` (KS4, live)
- `academic_subject_qualification_geography_lookup` (KS5, new)

Passing null (the omitted-parameter default in every existing caller) means "use 5", not "off".
That's correct and wanted for LA/regional rows — a 1-school LA row really is that school's own
figure, which is exactly what this threshold exists to hide. It's wrong for **national** rows:
a subject with only 4 schools nationally (2023's Gujarati, 2021/2024's Persian Language) is a
real, DfE-published national figure, not a disclosure risk, and it's now silently missing its
England marker on the dashboard.

Fix at the two call sites that request `groupingType: "national"` specifically — never touch the
default for an LA or region call:

- `src/app/api/teacher/dashboard/route.ts`, `englandAverages()`'s KS4 branch (currently calls
  `lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType:
  "national", groupingKeys: [NATIONAL_GROUPING_KEY] })`) — pass `minSchoolCount: 1`. This call
  only ever requests national grouping, so this is safe without any conditional.
- `src/app/api/teacher/subject-geography/route.ts`'s `fetchRows()` helper — it takes
  `groupingType` as a parameter and is called once each for `"la"`, `"region"`, `"national"`.
  Pass `minSchoolCount: groupingType === "national" ? 1 : undefined` (i.e. leave LA/region on
  the default 5).

Both changes need `lookupAcademicSubjectGeography()` (`src/lib/vicdata-reference.ts`) to accept
an optional `minSchoolCount?: number`, threaded through as `p_min_school_count` (omitted =>
`null` => backend default 5, matching every existing call's current behaviour unchanged).

Apply the identical `groupingType === "national" ? 1 : undefined` discipline to whatever new
national-only call Part 2 below adds for the KS5 qualification-grain benchmark — same regression,
same fix, same reasoning (rare A-level/AS subjects — Ancient Hebrew, Persian, Gujarati A-level —
will have the same small national school-counts KS4 does).

## 2. KS5 benchmark + own-figure wiring (the original Part C scope, updated)

### What's broken today, concretely

In `src/app/teacher/[phase]/page.tsx`:

- `headlineRowsFor(i, period)` (~L784) matches on `bucketOf(i)` — `comparabilityKey(phase,
  i.qualificationType)` — not on `i.qualificationType` itself. At KS5 this means a ticked AS
  Psychology item and a ticked A-level Psychology item both read the SAME blended "alevel"
  bucket row for their own school's points/entries. This is the "ticked AS subjects still show
  combined figures" gap flagged in Part A's build report and confirmed still open in C1's.
  **It's not just an AS/A-level problem** — the same blending happens for any two qualification
  types that share a non-alevel bucket too (e.g. two different IB or BTEC-family qualifications
  in the same subject at one school would show identical blended figures under today's code,
  for the same reason). Part B-2 built the fix generically, not AS-specific — see below.
- The `resultsSeries` benchmark (~L925): `benchmark: usingThreshold || (phase !== "ks4" &&
  i.key !== focusKey) ? undefined : resultsPeriods.map((p) => englandAt(i, p))` — at KS5 only
  the FOCUSED item ever gets a benchmark line; every category peer gets `undefined`. The
  adjacent comment explains why: `englandAt()` only had a bucket-grain whole-school figure to
  read, so giving every peer "the England alevel average" regardless of subject would be
  misleading. That's the backend gap Part B/B-2 closed.
- The category's own benchmark row, `resultsGroups`'s `England {category} average` (~L948):
  gated on `phase === "ks4" && !usingThreshold`. It's absent at KS5 entirely, for the same
  underlying reason — it averages every peer's `benchmark`, and every KS5 peer's benchmark is
  `undefined`.
- The two `geography={...}` props (Results' `SubjectPanels`, ~L1409, and `CandidatesPanels`,
  ~L1488) are both gated `phase === "ks4" && focusItem && schoolUrn`. They're what backs the
  % Change table's "this school vs its LA/region/England" comparison, and they read
  `/api/teacher/subject-geography`, which today only ever calls the KS4 subject-grain RPC.

### What's available to fix it, confirmed on production

Three RPCs, all shipped and backfilled:

```
academic_subject_qualification_geography_lookup(
  p_ks_stage, p_measure, p_grouping_type, p_grouping_keys, p_subject,
  p_qualification_type, p_family_id, p_period_min, p_period_max,
  p_limit, p_offset, p_min_school_count default 5
) -> grouping_type, grouping_key, ks_stage, subject, qualification_type,
     family_id, measure, period, avg_value, entries_total, school_count
```
LA/region/national average point score per (subject, EXACT qualification type), KS5. Granted
to `anon`. `p_subject`/`p_qualification_type` are both optional exact-match filters — omitting
them returns every subject x qualification combination for the requested grouping/period, which
is how `englandAverages()` already fetches the bucket-grain figures today (one unfiltered
national call, keyed client-side) — the same pattern works here.

```
academic_subject_qualification_headline_lookup(
  p_entity_ids, p_ks_stage, p_family_id, p_period_min, p_period_max,
  p_limit, p_offset, p_qualification_type
) -> entity_id, ks_stage, subject, family_id, family_label, period,
     entries_total, entries_share_of_school_percent, entries_share_of_family_percent,
     avg_point_score, points_coverage_percent, qualification_type
```
The school's own figure per (subject, EXACT qualification type), KS5. Same single-predecessor
`school_lineage` fallback as `academic_subject_headline_lookup` (the function
`lookupAcademicSubjectHeadline`/`fetchSubjectHeadlineForSchools` in `src/lib/academic-data-view.ts`
and `src/lib/vicdata-reference.ts` already wrap, chunked at 20 entity IDs). Granted to `anon`.
Note: "share of school" here is share of the school's WHOLE KS5 entries, not share within the
bucket — a different denominator from the existing bucket headline's share fields. `pointsAt`/
`entriesAt` don't use the share fields, so this doesn't affect this round, but don't reuse the
share numbers interchangeably with the bucket headline's.

Both confirmed by Claude Opus's build reports to sum back exactly to the existing bucket-grain
tables (production: 386,418 qualification-grain rows summing to all 333,102 bucket rows,
entries/points/size-units, apart from 12 AEA rows which are deliberately unscored in both).

### The change

1. Fetch the school's own KS5 figures at exact-qualification grain instead of bucket grain.
   Add a sibling to `fetchSubjectHeadlineForSchools()` (or extend it with a `qualificationType`
   parameter analogous to its existing `bucket` one) that calls
   `academic_subject_qualification_headline_lookup` the same chunked way. Fetch it for KS5
   (only) alongside today's `headline` fetch, and change `headlineRowsFor()`/`pointsAt()`/
   `entriesAt()` to match on `i.qualificationType` exactly (not `bucketOf(i)`) when `phase ===
   "ks5"`. This generalizes Part B-2's fix to every KS5 qualification, not just AS-in-A-level —
   if that turns out to be wrong for some other bucket (a reason two distinct qualification
   strings inside "ib" or "btec_ocr" SHOULD stay blended for a school's own figure), flag it in
   the build report rather than special-case it silently.
2. Fetch the England benchmark at exact-qualification grain too: one unfiltered national call
   per period range to `academic_subject_qualification_geography_lookup` (`p_ks_stage: "ks5"`,
   `p_grouping_type: "national"`, `p_grouping_keys: [NATIONAL_GROUPING_KEY]`, no subject/
   qualification filter, `minSchoolCount: 1` per section 1 above), keyed client-side by
   `${subject}::${qualificationType}`. Change `englandAt()` to look up this exact key first for
   KS5 items, falling back to today's bucket-grain lookup only if no exact-grain row exists (a
   genuine absence — e.g. AEA, or a period the qualification-grain table doesn't cover — should
   fall back rather than silently show nothing where the old code showed something).
3. Open the two gates this unlocks:
   - `resultsSeries`'s `benchmark` (~L925): drop the `phase !== "ks4" && i.key !== focusKey`
     clause — every category peer can now carry its own exact-qualification benchmark (or
     genuinely `null`, e.g. for "Other"-bucket qualifications with no DfE points table, which
     `englandAt()` will naturally return null for once the aggregate has no scored row).
   - `resultsGroups`'s `England {category} average` line (~L948): drop `phase === "ks4"`,
     keep `!usingThreshold` (the threshold measure still has no England anchor at either
     phase, unchanged).
   Check the benchmark legend/label text nearby (`benchmarkLabel`, `benchmarkNoun` on the
   `SubjectPanels` call ~L1432) reads sensibly once KS5 peers can show it — it currently says
   "the England average for the same qualification" for the non-subject basis, which should
   already read correctly for the new exact-grain figures; adjust the wording if it doesn't.
4. Open the two `geography={...}` gates (~L1409 Results, ~L1488 Candidates): extend
   `/api/teacher/subject-geography/route.ts` to handle `phase=ks5` (add a query param the two
   call sites pass, e.g. `phase` and `qualificationType`), calling
   `academic_subject_qualification_geography_lookup` (LA/region/national, `minSchoolCount`
   default 5 for LA/region, 1 for national per section 1) and the new own-figure fetch from step
   1 in place of the KS4 `avg_point_score`/points-eligible-entries pair. Write honest
   `notApplicableText` for KS5 — no A*-E/threshold measure exists at either phase's geography
   panel today, so the KS4 wording ("Switch Results to average point score...") should mostly
   carry over; adjust if the KS5 measure set makes it read wrong.

### Not in scope for this round (logged, don't build)

- Comparator-set membership still doesn't drop a school that lacks the exact qualification a
  teacher has ticked (queued behind the general comparator drop-and-replace mechanism — see
  `vicdata_phase3_teacher_view_post16_qualification_status_v1.md` item 3). Nothing here should
  touch `teacher-view-comparator-series.ts` or `teacher-view-rankings.ts`.
- LA/regional geographic meaningfulness for Post-16 (sixth forms recruit more widely than a
  catchment) is a separate, still-open product question, not a build item.

## 3. Small cleanup: AEA in the picker (one line, logged in Part A's build report as deferred)

`displayBucketFor()` (`src/lib/dfe-qualification-buckets.ts` ~L127) currently only special-cases
AS level:

```ts
export function displayBucketFor(qualificationType: string): Ks5Bucket {
  if ((qualificationType || "").startsWith("GCE AS level")) return "other";
  return bucketFor(qualificationType);
}
```

Add Advanced Extension Award to the same special case (`isAsLevelOrAea()` in the same file
already matches both — reuse it rather than repeating the string check):

```ts
export function displayBucketFor(qualificationType: string): Ks5Bucket {
  if (isAsLevelOrAea(qualificationType)) return "other";
  return bucketFor(qualificationType);
}
```

This only affects the picker/tile display grouping (`bucketFor()` itself, and every points
figure downstream of it, stays untouched — same guarantee as the existing AS case).

## Build report

As with every round on this thread: what changed and where, any decision you had to make that
isn't spelled out above, and anything from section 2's "not in scope" section that turns out to
need revisiting. Flag specifically whether generalizing the own-figure fix beyond AS/A-level
(item 1 in section 2's "The change") turned out to be safe once you looked at real IB/BTEC data,
and whether the fallback in item 2 (exact-grain missing -> bucket-grain) ever actually fires in
practice.
