# Post-16 Part A: AS level split from A-level for display, build report (v1)

This covers Part A of `vicdata_phase3_teacher_view_post16_qualification_split_and_ks5_benchmark_claude_code_prompt_v1.md` only. Part C was not started, because it waits on Part B in the `vicdata` repo.

One commit. `tsc`, `eslint` (touched files) and `next build` are clean.

## What changed

- **`src/lib/dfe-qualification-buckets.ts`:** new `displayBucketFor(qualificationType)`.
  - It is `bucketFor()` except that anything starting `"GCE AS level"` returns `"other"`.
  - `bucketFor()` itself is untouched. The diff to this file is only the new function and its comment.
- **`src/lib/teacher-view-theme.ts`:**
  - `qualificationFamilyOf()` uses `displayBucketFor()` at KS5.
  - The two KS5 family-tile descriptions follow the change:
    - A-level: "A level, Advanced Extension Award" (AS level removed);
    - Other: "AS level, EPQ, Core Maths, Pre-U and similar".
- **`src/components/teacher/QualificationFamilyTiles.tsx`:** a comment update only.

`qualificationFamilyOf()` has three callers, all display, all in `src/app/teacher/[phase]/page.tsx`:
- **L455, `familyOfItem`:** the subject picker's family tabs, and its "same subject twice in one tab" label rule. This is used by onboarding step 2 and the dashboard's quick edit.
- **L527:** onboarding step 1's family tiles and their subject counts.
- **L743:** the dashboard subject chip's colour (`hex`).

**Untouched:** `bucketFor()`, the Python `bucket_for()`, and every Academic Results call site (`SubjectDeepDiveDrawer.tsx`, `SubjectAreaSection.tsx`, `KS5_BUCKET_DESCRIPTION`).

## Where the brief's locations were wrong (checked, not switched)

- **`page.tsx` L368 and L436 are not `buildSubjectItems`, and they are not display.**
  - `buildSubjectItems` (L49) has no bucket at all.
  - L368 is `resultsFor()` and L436 is `movedResults`. Both pick out the `headline` rows (`academic_subject_headline`) for an item by bucket.
  - Those rows are keyed by the rollup's bucket, where AS is blended into `"alevel"`.
  - Switching them would have made every AS item look for an `"other"` headline row that doesn't exist, losing its score, and could have matched the wrong row where one does. So both stay on `bucketFor()`.
- **`teacher-view-catalogue.ts` L126 / L131: left unchanged, as the brief suspected.**
  - `comparabilityKey()` is matching logic. It is used by headline row selection (`bucketOf` / `headlineRowsFor`), the England-average key (`englandFor` / `englandAt`), the map chip's `bucket` (which selects the comparator profiles' rollup rows) and the §7 comparable-peer grouping in `computeView`.
  - All of those must stay on the bucket the data is keyed by.
  - `comparabilityLabel()` (L131) is the same rule in label form. See §D2.

## Verification (Part A's two checks)

**1. AS and A-level no longer listed twice under A-level.**
Checked against real data for **Capital City College (URN 130421)**. I ran the real `fetchSubjectLevelDataForSchools` under `tsx` and grouped the school's subject items by family before and after:

| | A-level tab rows | Subjects appearing twice in the A-level tab | AS Maths / AS Biology |
|---|---|---|---|
| Before (`bucketFor`) | 59 | Mathematics (×2 extra), Biology, Chemistry, Computer Studies / Computing, Mathematics (Further), Physics, Computer Science, History | under A-level |
| After (`qualificationFamilyOf` → `displayBucketFor`) | 50 | Mathematics (once extra, see §D1) | under **Other** |

Mathematics still appears twice under A-level. The second row is Maths as an **Advanced Extension Award**: the school has AEA, A level and AS Maths in both 2023/24 and 2024/25. `bucketFor()` puts AEA in `"alevel"`, and the brief keeps it there. The picker already labels that row with its qualification, because it shares a tab with A level, so it reads as a separate row rather than a duplicate. See §D1.

**2. Whole-school headline APS unchanged.**
This holds by construction rather than by a before-and-after number:
- `bucketFor()` is byte-identical: the diff adds a function and changes no existing line of that file.
- `displayBucketFor()` has exactly one caller, `qualificationFamilyOf()`, whose three callers are the picker tabs, onboarding tiles and chip colour.
- Nothing on the points or headline path (`resultsFor`, `headlineRowsFor`, `englandFor` / `englandAt`, the rollup, the ingest's `bucket_for()`) reads it.

So the Capital City College 27.95 A-level figure, DfE-published, cannot move. I didn't re-run the number: localhost is gated, and nothing it depends on changed.

## Open decisions for Guy

- **§D1: Advanced Extension Award stays under A-level.** That's per the brief (`bucketFor` keeps it in `"alevel"`). But at a school running AEA Maths it still gives a second Maths row in the A-level tab, labelled "(Advanced Extension Award)". If AEA should join AS under Other, it's one more line in `displayBucketFor()`.
- **§D2: once an AS subject is ticked, the dashboard still describes it as A-level, with A-level-bucket figures.**
  - This is the display-only scope working as decided, but worth seeing before it's judged live.
  - The picker, the tiles and the chip colour now say "Other". The chip's text (`qualificationShortLabel` → `comparabilityLabel`, the bucket label) still reads "Mathematics · A-level".
  - More importantly, every figure for that item comes from the headline row for Maths in the `"alevel"` bucket, which has AS and A-level blended. So a ticked AS Maths and a ticked A-level Maths show the same entries and points on the dashboard.
  - Changing the label to "AS level" is cheap, but it would then sit over blended figures. Correct per-qualification figures need Part B's exact-qualification data (or a per-qualification headline).
  - For now: leave as-is until B/C, relabel now, or keep AS items out of the dashboard entirely?
- **§D3: the chip colour and the comparison grouping disagree for AS items.**
  - The chip's colour now comes from the Other family (grey), while `colourByGroup()` (keyed by `comparabilityKey`) still groups AS with A-level for the panels' per-group colours.
  - So an AS item's chip is grey but its bars are A-level's colour.
  - I left `colourByGroup` on the comparability key because it deliberately means "comparable". Tell me if you'd rather the display bucket drove it.
