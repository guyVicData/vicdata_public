# Teacher view Post-16 Part C: KS5 benchmark wiring, own-figure fix, national threshold: build report (v1)

Prompt: `vicdata_phase3_teacher_view_post16_partC_benchmark_wiring_claude_code_prompt_v1.md` (read in full). Built from `95cdd49`, one commit per section:

| Commit | Section |
|---|---|
| `3877293` | 1. National threshold regression |
| `69e1de5` | 2. KS5 own figure and benchmark wiring |
| `9da255a` | 3. AEA in `displayBucketFor()` |

Checks: `tsc --noEmit` is clean and `npm run build` succeeds. `eslint src` reports the same 7 problems before and after this round, none of them in files touched here. I checked the RPCs directly against live data with the anon key (scripts in the session scratchpad). Localhost is gated, so the on-screen checks below are for you.

## 1. National threshold regression

- **`src/lib/vicdata-reference.ts`:** `lookupAcademicSubjectGeography()` takes an optional `minSchoolCount`, sent as `p_min_school_count`. When it is omitted, `null` is sent, which the backend reads as its default of 5, so every other call is unchanged.
- **`src/app/api/teacher/dashboard/route.ts`, `englandAverages()`, KS4:** passes `minSchoolCount: 1`. This call is national only.
- **`src/app/api/teacher/subject-geography/route.ts`, `fetchRows()`:** passes `groupingType === "national" ? 1 : undefined`, so LA and region keep the minimum of 5.
- **Verified live, KS4 national `avg_point_score`:**
  - With the default threshold: Gujarati has no 2023 row; Persian Language has no 2021 or 2024 row.
  - With 1: Gujarati 2023 (4 schools, 6.72) and Persian Language 2021 (4 schools, 8.1) and 2024 (4 schools, 7.15) come back.

## 2. KS5 own figure and benchmark wiring

### Data layer
- **`vicdata-reference.ts`**
  - New `lookupAcademicSubjectQualificationHeadline()`: chunked at 20 entity IDs, sequential, and tolerant per chunk, like the bucket lookup.
  - New `lookupAcademicSubjectQualificationGeography()`: takes `minSchoolCount`.
  - The chunk loop moved into a shared `inEntityChunks()` helper, so both headline lookups use the same fault isolation. `lookupAcademicSubjectHeadline()` behaves exactly as before.
- **`academic-data-view.ts`**
  - New `fetchSubjectQualificationHeadlineForSchools()`, a sibling of the bucket fetcher rather than a new parameter on it. It returns the same entry type, which gains an optional `qualificationType`.
  - The share fields are copied through with a comment saying they are shares of the whole KS5 total, and nothing reads them.
- **Dashboard route**
  - At KS5 the payload gains `qualificationHeadline`, the school's own exact-grain rows.
  - `englandAverages.qualificationValues` is keyed `{subject}::{qualificationType}`. It comes from one unfiltered national call with `minSchoolCount: 1`, per section 1.
  - The bucket `values` stay as the fallback.
- **Subject-geography route**
  - New `phase=ks5&qualificationType=` parameters. With them, the route reads `academic_subject_qualification_geography_lookup`: LA and region at the default minimum of 5, England at 1.
  - The payload shape is unchanged: `entries_total` there is points-eligible entries, the same meaning as at KS4.
  - `fetchSubjectGeography()` and `useSubjectGeography()` now pass the qualification type and cache by subject plus qualification. Otherwise switching focus from AS to A-level Psychology would reuse the AS figures.

### `src/app/teacher/[phase]/page.tsx`
- **New `ownRowsFor(item)`.** At KS5 it returns the item's rows matched on the **exact** `qualificationType`; at GCSE it returns the subject's rows, as before. `headlineRowsFor`, and therefore `pointsAt` and `entriesAt`, read through it.
  - **Decision:** `resultsFor` (the onboarding step 3 preview) and `movedResults` (the "this moved" line on Results) read through it too. Their comments promise they can never disagree with the dashboard's own figures; left on bucket grain, they would have.
- **New `englandValue(item, period, fallback)`.** At KS5 it looks up the exact `{subject}::{qualificationType}` figure first. Only with `fallback` does it use the bucket figure. `englandAt` and `englandFor` both use it. Both England tables are indexed once (`useMemo`), not searched on every call.
  - **Decision: the bucket fallback applies only where the old code showed a benchmark.** That is the focused item (`englandAt`) and the onboarding preview (`englandFor`). Category peers get exact-grain figures only. Before this round peers had no marker at all, so falling back for them would show new markers such as a VRQ row against BTEC's England average. The real data (below) shows the fallback never lands beside a real figure anyway.
- **Gates opened**
  - `resultsSeries` benchmark: now `usingThreshold ? undefined : …` at both phases.
  - `resultsGroups`' "England {category} average": gated on `!usingThreshold` only.
- **`benchmarkNoun` at KS5:** now "the England average for the same subject and qualification". The old "for the same qualification" was accurate for the bucket figure but undersells the new one.
- **Geography props**
  - Both now apply at KS5, passing `qualificationType`. The label is `focusItem.label`, which names the qualification when the school runs the subject under more than one.
  - Results `applies` at KS5 whenever the measure is points. Candidates always applies at KS5.
  - A qualification with no published points (VRQ, AEA, EPQ) gets back no area rows. GeographyView then shows its existing "No LA, regional or national … figures are published for …" message, which is true.
  - The KS4 "switch Results to average point score" wording carries over unchanged. Its other branch (GCSE full course) is only reachable at KS4.
- **Decision: the Candidates dedup is now GCSE only.** It merged items that shared one headline row, which at KS5 was the bucket row. With exact-grain rows every KS5 item has its own row. Kept at KS5, it would have hidden IB Standard level Biology behind Higher level Biology's bar.

### Flag 1: does generalising the own-figure fix beyond AS/A-level hold up on real IB/BTEC data? **Yes, and it's needed.**

I checked 28 schools: 100369 (IB + A level), five heavy-AS sixth forms, five multi-BTEC colleges, and 18 VRQ/IB schools. For each current item and year, I compared the old bucket figure with the new exact one.

| Bucket | Item-years where bucket ≠ exact | Same |
|---|---|---|
| ib | 410 | 38 |
| btec_ocr | 427 | 45 |
| alevel | 890 | 766 |
| tlevel | 0 | 11 |

- **IB:** the blend mixes Higher and Standard level, which DfE scores on different tables. For example, at 100369 in 2024, Chemistry HL is 58.29 and SL is 45.71, and the old code showed both as the bucket blend, 54.1.
- **BTEC/OCR:** the blend mixes different sizes (Extended Certificate, Diploma, Extended Diploma) of the same subject.
- I found no case where two qualification strings in one bucket *should* share a figure. Every one is a qualification a teacher ticks separately.
- **Nothing is lost.**
  - The exact rows sum back to the bucket rows exactly: 0 mismatches over 3,893 bucket rows at 45 schools.
  - In every one of 170 item-years where a bucket row existed with no exact row for that item, the bucket row belonged to a sibling. For example, 101676's Maths AEA used to show the A-level+AS Maths figure for 2021–2023.
  - The one oddity is 2020/21: DfE's 2020 file uses coarse labels ("A level", "Applied general", "Other academic", "Tech level"), which match no current item at either grain. Before, only items in the Other bucket (EPQ, Core Maths) picked up a 2020 figure, and it was the subject's whole "Other academic" row. Now no item has a 2020/21 figure, so EPQ's Candidates bar loses that one year. **I think that's more honest, but it is a visible change.**

### Flag 2: does the exact-grain → bucket-grain England fallback ever fire? **Yes, but never beside a real figure.**

- Period coverage is identical at both grains (2021/22–2024/25), so a missing year never triggers it.
- Across the 28 schools, counting only years where the school has its own exact row, the exact national figure was missing about 172 times. The fallback would fire mostly for:
  - VRQ Level 3 (78) and VRQ Level 2 (14);
  - GCE AS level (25, nearly all 2021/22);
  - OCR Cambridge Technical (about 30) and BTEC (about 12);
  - AEA (6), IB Standard level (5) and GCE A level (2).
- **In every one of those cases the school's own figure was also null** (unscored, suppressed, or 2021 AS). So the fallback only ever puts a bucket-average marker beside an empty bar.
- As built, that can only happen for the focused item.
- **My recommendation: drop the fallback in a later round.** A VRQ item marked against BTEC's England average, or AS against the A-level bucket, is the blending this round removes elsewhere.

## 3. AEA in `displayBucketFor()`

- **`src/lib/dfe-qualification-buckets.ts`:** `displayBucketFor()` now calls `isAsLevelOrAea()`, so AEA shows under Other in the picker and tiles alongside AS.
- `bucketFor()` and every points path are unchanged. Comments in `teacher-view-theme.ts` updated to match.

## Not in scope: nothing needed revisiting

`teacher-view-comparator-series.ts` and `teacher-view-rankings.ts` are untouched. Nothing here depends on comparator membership.

## Found along the way (not built): Context's group double-counts at Post-16

`groupValueFor()` in `page.tsx` sums every `headline` row for a subject. At KS5 the dashboard fetches every bucket **including `all`** (`p_bucket: null`), so each subject is counted twice. At 100369 in 2024, Biology returns rows for alevel (19), all (34) and ib (15), and the group total counts 68 entries against a real 34. The points mean averages the three rows.

This predates this round, but it now matters more, because Context's own-subject value is exact-grain while the group total it is a share of is inflated. The donut's share is roughly halved at Post-16. **The one-line fix is to skip `bucket === "all"` rows at KS5.** Alternatively, move the group onto `qualificationHeadline`, which would also close C1's open item 1 by leaving AS/AEA out of the group properly. I left it for you to decide because it changes Context's figures.

## Live checks for Guy

1. **100369, Post-16:** focus IB HL Chemistry. Its Results figure is 58.29 for 2024/25, no longer 54.1. SL Chemistry is 45.71, and both appear as separate bars in the category.
2. **Same school:** every Sciences & Maths peer has an England marker, and there is an "England Sciences & Maths average" line.
3. **Same school, % Change:** the LA/region/England table appears for the focused KS5 item. Focus a VRQ or EPQ item and it says no figures are published.
4. **A school with AS and A-level Psychology:** focusing each one shows different own figures and different England markers.
5. **AEA:** it appears under Other in the picker and tiles, not A-level.
6. **GCSE, a school offering Gujarati (2023) or Persian Language (2021/2024):** the England marker is back.

## Open decisions for Guy

1. Drop the England bucket fallback (flag 2): as built it only ever sits beside an empty focused bar.
2. Fix Context's Post-16 double count (above): skip `all` rows, or move the group to exact grain.
3. EPQ and other Other-bucket items lose their 2020/21 figure (flag 1). That figure was never theirs specifically, but vicdata could map DfE's 2020 coarse labels if you want that year back.
