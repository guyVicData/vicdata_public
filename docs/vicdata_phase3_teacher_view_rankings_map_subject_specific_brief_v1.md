# Teacher view — Rankings card: subject-specific comparator map (KS4 + KS5)

## Why this brief exists

Guy, live: "the school comparison map doesn't look to be subject specific, with pills
to switch subject." Confirmed against both the real code and the wireframe
(`GCSE-Dashboard-Desktop.dc.html` / `GCSE-Edit-Rankings.dc.html`):

The Rankings card's map (`RankingsMap` → `AcademicMapView`) currently sizes/colours
every school's dot by its **whole-school** headline measure (Attainment 8 at GCSE,
average points per entry at Post-16) — the same figure the "2 of 7" position number
above it uses. The wireframe's map is driven by **one ticked subject at a time**,
switched by a row of chips above the map — dot size = that subject's entries at each
school, dot colour = that subject's average point score. That mechanism does not exist
in the real build at all yet — no chips, no per-subject map data.

**Compact-vs-fullscreen sizing is already correct and is NOT part of this fix** — Guy
raised this live and, once shown the wireframe still renders a small map compactly
(128px) and a large one in fullscreen (matching what's already built: `h-72` /
`h-[70vh]`), agreed this part already matches. Nothing to change there.

**Scope: both KS4 and KS5.** Unlike the England-average round, the underlying data
(`academic_subject_rollup`, `fetchSubjectHeadlineForSchools`) already exists at both
stages with no backend work needed — this is a `vicdata_public`-only round.

## The most important finding: KS4 and KS5 do not have the same real grain here

The wireframe's own demo data (`GCSE_MAP_SUBJECTS` in `GCSE-Dashboard-Desktop.dc.html`)
invents two separate chips for the same KS4 subject under different qualification
types — "Sports Studies · GCSE" and "Sports Studies · BTEC & OCR" — as if each had its
own entries/avg-point-score series. **That distinction does not exist in the real KS4
data.** `recompute_subject_rollup()` (the `vicdata` ingest repo) only splits a
subject's rollup row by qualification bucket `if ks_stage == "ks5"` — at KS4 there is
exactly one row per (school, subject, period), entries and points already merged
across whatever qualification types that subject is taught under at that school.
`academic_subject_headline_lookup`/`fetchSubjectHeadlineForSchools` reflect this
directly: a KS4 subject has no `bucket` dimension worth branching on (its rows are all
`bucket = 'all'`); a KS5 subject genuinely does (A-level vs BTEC vs other buckets are
real, separately-computed rows).

So, matching real data grain rather than the mockup's own invented split (the same
"don't invent taxonomy" principle the onboarding rebuild brief already established):

- **KS4 chips: one per ticked subject**, not per subject+qualification-type. A subject
  a teacher has ticked under two different KS4 qualification types still gets one chip
  and one map series — that's genuinely all the data distinguishes. The teacher's own
  qualification type can still appear as a small label on the chip for their own
  context, but it does not select a different data series.
- **KS5 chips: one per ticked (subject, bucket) pair** — a subject legitimately entered
  under two different buckets (A-level and BTEC, say) gets two chips, because
  `academic_subject_rollup` genuinely has two separate rows for it. Use
  `comparabilityKey`/`bucketFor` (already used for exactly this purpose elsewhere in
  `[phase]/page.tsx`) to derive the bucket, not a new mechanism.

## What to build

### 1. `AcademicSchoolProfile` — new subject-grain fields (`src/lib/academic-data-view.ts`)

Add, as direct siblings of the existing `ks4Families`/`ks5Families`/
`ks5FamiliesByBucket`:

```ts
ks4Subjects: AcademicSubjectHeadlineEntry[];
ks5Subjects: AcademicSubjectHeadlineEntry[];              // bucket = 'all' rows only
ks5SubjectsByBucket: Record<string, AcademicSubjectHeadlineEntry[]>;
```

Populate them in `fetchAcademicProfiles()` using the EXISTING
`fetchSubjectHeadlineForSchools()` (already batches many URNs in one call, already
chunked/fault-isolated against the statement-timeout issue its own comment documents)
— no new RPC, no new backend work. Call it for `ks4` (bucket omitted/`'all'`, matching
the real KS4 grain above) and for `ks5` with `bucket: null` to get every bucket in one
call (same "fetch every bucket once, split back out" trick `ks5FamilyByBucketByUrn`
already uses a few lines above — mirror that pattern exactly, don't reinvent it for
subjects).

**Gate this behind a new opt-in option, `includeSubjects` (default `false`)**, exactly
matching the existing `includePopulation` option's own reasoning (see that option's
header comment): most callers of `fetchAcademicProfiles` — the free Academic snapshot
card, the paid Data View's own family-level map — have no use for subject-grain data
and should not pay for an extra batched RPC call they never read. Only the Teacher view
Rankings map's own profile fetch (`/api/data-view/academic-schools/route.ts`) passes
`includeSubjects: true`.

Add `subjectYearsFor(profile, stage, subject, bucket?)` / `latestSubjectYear(...)`,
direct siblings of `familyYearsFor`/`latestFamilyYear` a few lines above them, same
shape, filtering on `subject` (and `bucket` at KS5) instead of `familyId`.

`serializeAcademicProfile`/`deserializeAcademicProfile` need no changes — the new
fields are plain arrays/records, not `Map`s, so they already pass through the existing
`...profile`/`...wire` spreads untouched.

### 2. `AcademicMapView` — a subject mode (`src/components/data-view/AcademicMapView.tsx`)

Add `subject`/`subjectLabel`/`subjectBucket` props, direct siblings of the existing
`familyId`/`familyLabel` props (`subjectBucket` only meaningful at KS5, mirroring how
`ks5Bucket` already works alongside `familyId`). In `rowDataByUrn`'s computation, add a
new branch alongside the existing `if (familyId) { ... }` one, using
`latestSubjectYear`/`subjectYearsFor` instead of `latestFamilyYear`/`familyYearsFor` —
`AcademicSubjectHeadlineEntry` and `AcademicFamilyYear` have the same shape
(`entriesTotal`, `avgPointScore`, `period`), so this branch should closely mirror the
family one, not diverge from it. Grade band / Trend colour modes should work
unchanged once `rowDataByUrn` is populated correctly — per this file's own comment,
those modes already work "at every scope" once real `avgValue`/`anchorValue` data is
present; no separate gating needed for subject mode.

Update the size caption (`{familyId ? `Entries in ${familyLabel ?? "this category"}` :
sizeCaption}`) to also handle subject mode — "Entries in {subjectLabel}" — and check
the tooltip/legend text elsewhere in the file for other `familyId`/`familyLabel`-keyed
strings that need a subject equivalent.

`familyId` and `subject` are mutually exclusive in practice (Teacher view's Rankings
map only ever passes one), but don't need to be type-enforced as such — just make sure
subject mode is checked ahead of or instead of family mode in `rowDataByUrn`, not
merged with it.

### 3. `RankingsMap` (`src/components/teacher/RankingsMap.tsx`)

Thread new `subject`/`subjectLabel`/`subjectBucket` props straight through to
`AcademicMapView`, same as it already does for `profiles`/`targetUrn`/`stage`.

### 4. Chips + selection state (`src/app/teacher/[phase]/page.tsx`)

Above the map (inside the same `print:hidden` wrapper), render a row of chips, one per
the real grain described above:

- Build the chip list from `tickedItems` (already computed on this page), deduplicated
  per the KS4/KS5 grain rule (KS4: dedupe by subject; KS5: dedupe by (subject,
  comparabilityKey)).
- Colour each chip using `QUALIFICATION_FAMILIES`/`qualificationFamilyOf` from
  `teacher-view-theme.ts` (already gives the exact hex/rgb the wireframe's chips use —
  `#34d399` for GCSE, `#60a5fa` for BTEC & OCR, etc. — no new colour scheme to invent).
- State: which chip is selected (default: the first ticked item, matching the
  wireframe's own `mapSubject` default). Selecting a chip updates the `subject`/
  `subjectBucket` passed into `<RankingsMap>`.
- No ticked ranking-relevant subjects (`tickedItems.length === 0`): match whatever this
  card already does today when nothing is ticked elsewhere on the page, don't invent a
  new empty state.

## What NOT to touch

The compact/fullscreen sizing (`heightClass={fullscreen ? "h-[70vh] min-h-[22rem]" :
"h-72"}`) — already correct, confirmed against the wireframe. The "2 of 7" position
number and the ranked list below the map — both stay on the whole-school headline
measure for this round; making those subject-specific too would be a genuine follow-on
(the same "comparisons should be that granular" principle extended further) but Guy
asked specifically about the map, and it's a separate, larger change to the card's
summary figure and `neighbours`/`rankOf` computation, not bundled in here. Every other
caller of `fetchAcademicProfiles` (Data View's own map, the free Academic snapshot
card) — unaffected, since `includeSubjects` defaults to `false`.

## Verification

Live, both phases, both themes: tick two or three subjects (including, at KS5, one
genuinely entered under two different buckets if the test school has one), confirm a
chip appears per the real grain rule above (not per mockup-style subject+qualification
at KS4), confirm switching chips changes dot sizes/colours on the map (not just a
colour relabel — check a couple of real schools' dot sizes shift between two subjects
with different entry counts), and confirm the legend caption names the selected
subject. Confirm the Data View's own Academic map (a different page) is completely
unaffected — same dot sizes/colours as before this round, since it doesn't opt into
`includeSubjects`.
