# Qualification row UX fixes + subject deep-dive bucket-filter gap

Five real, verified issues from a live review of Capital City College (URN 130421) — this platform's own first live click-through in this whole arc. All in `vicdata_public`, all frontend, no ingest/backend changes.

## 1. "Qualification" heading and the Post-16 button disappear for a single-stage school

`QualificationRow` (`AcademicDataView.tsx`) wraps the "Qualification" label and `KsStageSwitcher` together in `{stages.length > 1 && (...)}`. Capital City College only has real KS5 data (`stages.length === 1`), so this whole block — label included — doesn't render. The TYPE row (`Ks5TypeSwitcher`) still renders on its own, so a visitor sees unlabelled "Type" pills floating with no "Qualification" context above them and no indication of which stage they're looking at.

Fix: when `stages.length <= 1` but `showType` is true, still render the "Qualification" label and a plain, non-interactive text indicator of the one real stage (e.g. "Post-16", not a clickable switcher — there's nothing to switch to). The row should read "QUALIFICATION Post-16 TYPE [pills]" consistently whether a school has one stage or three, not silently drop the label and indicator for the common case of a Post-16-only institution.

## 2. No way to clear a TYPE selection once made

`Ks5TypeSwitcher` renders only the five bucket pills from `KS5_BUCKET_OPTIONS`. There's no "All" or reset control — once a visitor clicks "IB" or "BTec & OCR" there's no button to get back to the real default state (`ks5Bucket === null`, "each school's own qualification-type headline measure", per the existing code comment on item 10). Add an "All" pill, styled consistently with the others, that calls the existing `onChange` path back to `null`. Confirm `null` still means what the code comments say it means (no default forced, whole-school view) rather than silently defaulting to "alevel" anywhere downstream — check `ks5BucketExclusionNote(excludedNamesKs5, ks5Bucket ?? "alevel")` and any other `?? "alevel"` fallback don't change user-visible behaviour when "All" is explicitly clicked versus the initial unset state; they may be fine as is, but confirm rather than assume.

## 3. Buckets the school doesn't offer still show as selectable

`Ks5TypeSwitcher` renders `KS5_BUCKET_OPTIONS.map(...)` unconditionally — every school sees all five pills (A-level, IB, BTec & OCR, T Level, Other) regardless of real provision. `ks5HasBucketEntries()` already exists and is already used elsewhere in this same file for comparator-group exclusion (`ks5ExcludedUrns`, the `qualifying` count) — it has just never been applied to the pills themselves. Capital City College offers no real IB (confirmed in the qualification-bucket round's own build report — Capital City and Acland Burghley are the two schools cited as having no IB), yet the IB pill is clickable there today.

Fix: filter `KS5_BUCKET_OPTIONS` through `ks5HasBucketEntries(targetProfile, bucket)` for the currently-viewed school before rendering `Ks5TypeSwitcher`'s pills, so a bucket with zero real entries at this school doesn't appear as a button at all. Keep the "All" pill from #2 always present regardless of this filter.

## 4. Verify the entries/results charts below are actually wired to the TYPE filter

`ks5Bucket` is threaded as a prop into `AcademicMapView`, `AcademicGraphsView`, and `AcademicRankingsView`, and `AcademicGraphsView` calls `ks5BucketMeasureFor`/`entriesSeries(..., ks5Bucket)`/`latestEntriesCount(..., ks5Bucket)` — this looks correctly wired from a code read, but hasn't been confirmed live. Before moving on: open Capital City College, switch the TYPE pill through A-level / BTec & OCR / Other / the new "All", and confirm for each — the target school's own headline entries figure, its own headline results/points figure, and the trend charts — all change to reflect the selected bucket, not just the comparator group figures (the code paths for target-school figures and comparator-group figures are different call sites; both need checking, not just one). Also confirm the "Other" bucket's no-points-figure note (`KS5_OTHER_NO_FIGURE_NOTE`) still renders correctly once "All" exists as a selectable state alongside it.

## 5. Real bug: subject deep-dive drawer's empty state ignores the active bucket filter

Verified root cause, not guessed. Capital City College's real "Arts, Media & Design" provision is 19 subjects, 2413 entries — overwhelmingly `GCE A level` (Art and Design variants, Film Studies, Music, Drama, etc.), plus one `VRQ Level 3` Art and Design entry and exactly one real `BTEC National Foundation Diploma L3` entry (subject "Multimedia", count 1). With TYPE=BTec & OCR selected and this category opened, the drawer shows: "No entries data for the 27 subjects in this category yet."

The bug: in `SubjectDeepDiveDrawer.tsx`, `allSubjectNames` (which drives both the empty-state branch and the "27" in its text) is built from `headlineByUrn` — the category's full subject list, **not filtered by the active bucket**. `listedSubjects` — the actual rows shown — IS bucket-filtered, via `scopedSubjectByUrn`. So when a bucket has few or no real entries in a category, `listedSubjects` correctly empties out, but the empty-state message still reports the full unfiltered subject count (27, every qualification type combined) with wording ("yet") that implies missing data rather than "this school's provision in this category is a different qualification type."

Two things to fix:

- **The message must reflect the active bucket.** When a bucket is selected and produces zero rows, say so honestly and specifically — e.g. "No BTec & OCR entries for this category at this school" — not a raw subject count that was never scoped to the filter causing the emptiness. The existing category-empty-vs-filtered-empty distinction in the code (the comment above this block) is the right idea; it just needs to also account for the bucket dimension, not only "category returned nothing" vs "subjects exist but none have entries in the raw-fact source."
- **Check whether the one real Multimedia BTEC entry is being wrongly dropped, or correctly excluded for a real reason.** It's a single real fact row (count 1) — verify directly whether it fails `rowFor()`'s `candidates !== null` filter due to a genuine data gap (e.g. no matching period/headline pairing for that one row) or whether it's being lost somewhere in the bucket-scoping logic. Report which, don't assume either way. If it's a real, valid entry being dropped, that's a second bug on top of the messaging one.

## Deliverable

All five fixed, each checked live against Capital City College (and at least one multi-stage, multi-bucket school for #1/#2/#4, so the fix doesn't just work for the single-stage case it was found on). Full build report — what was found at each of the five, what the real fix was, and the real answer on the Multimedia BTEC entry. Commit and push once verified.
