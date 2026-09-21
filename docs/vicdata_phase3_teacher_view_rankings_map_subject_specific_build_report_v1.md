# Teacher view — Rankings card: subject-specific comparator map — build report

Covers `vicdata_phase3_teacher_view_rankings_map_subject_specific_brief_v1.md`, all four pieces, KS4 and KS5. vicdata_public only; no backend change.

Untouched, as required: the compact/fullscreen map sizing (`h-72` / `h-[70vh] min-h-[22rem]`), the "N of M" position figure and the ranked list (both still whole-school), and every other `fetchAcademicProfiles` caller.

## 1. `AcademicSchoolProfile` — subject-grain fields (`src/lib/academic-data-view.ts`)

- `ks4Subjects`, `ks5Subjects` (bucket `'all'` rows) and `ks5SubjectsByBucket`, as siblings of the three family fields.
- Populated in `fetchAcademicProfiles()` with the existing `fetchSubjectHeadlineForSchools()`. KS4 uses its `'all'` grain; KS5 uses one `bucket: null` every-bucket call, split back into `'all'` and per-bucket in the same way `ks5FamilyByBucketByUrn` splits family rows.
- **Behind a new opt-in, `includeSubjects` (default `false`)**, commented with the same reasoning as `includePopulation`. The two subject calls run after the main `Promise.all`, not inside it, because these lookups contend and have hit a statement timeout together before (the dashboard route's own comment).
- `subjectYearsFor()` / `latestSubjectYear()`, siblings of `familyYearsFor()` / `latestFamilyYear()`. `bucket` only matters at KS5; omitted or null reads the `'all'` rows.
- Serialisation needed no change: the new fields are plain arrays and records, so the existing spreads carry them.

## 2. `AcademicMapView` — subject mode

- New `subject` / `subjectLabel` / `subjectBucket` props beside `familyId` / `familyLabel`.
- `rowDataByUrn` gains a subject branch, checked **before** the family branch and not merged with it. It mirrors the family branch field for field: latest year's entries → size, average point score → grade-band colour, the baseline-year score → trend anchor. So Grade band and Trends both work unchanged.
- The tooltip gains a subject branch ("N entries in {subject}", "X avg. point score", each with its year).
- The size legend reads "Entries in {subject}".
- "View by area" (the region/LA map) is disabled in subject mode, as it already is in family mode, because it is whole-school only.
- **Flagged:** subject mode colours with the ordinary grade-band ramp. The family-tinted ramp belongs to a category selection, which subject mode doesn't have.

With no `subject` passed, every existing path is byte-identical in behaviour.

## 3. `RankingsMap`

Passes `subject` / `subjectLabel` / `subjectBucket` straight through to `AcademicMapView`.

## 4. Chips and selection (`src/app/teacher/[phase]/page.tsx`)

A chip row above the map, inside the same `print:hidden` wrapper, built from `tickedItems` at the real grain:
- **KS4: one chip per ticked subject.** A subject ticked under two qualification types gets one chip; the qualifications are named on it ("Sports Studies · GCSE, Cambridge National") for the teacher's own context but select nothing, because the KS4 data has one merged series per subject.
- **KS5: one chip per ticked (subject, bucket)**, the bucket coming from `comparabilityKey` (`bucketFor`), so "Art and Design · A-level" and "Art and Design · BTec, OCR, VRQ" are two chips.
- Each chip is coloured by its qualification family (`QUALIFICATION_FAMILIES` / `qualificationFamilyOf`), styled as in the mockup: filled with dark text when chosen, outlined at 50% when not.
- The first chip is selected by default. The selection is page state, shared by the card's map and the fullscreen map.
- With nothing ticked there are no chips and the map shows the whole-school headline, exactly as today. KS2 has no subjects and so no chips.

## The opt-in — one deviation from the brief, flagged

The brief says only `/api/data-view/academic-schools/route.ts` should pass `includeSubjects: true`. That route is **not** Teacher view's alone: the Data View's own Academic map (`AcademicDataView`) fetches its profiles through the same route. Passing `includeSubjects: true` unconditionally would have added the subject fetch to every Data View load, which is the cost the opt-in exists to avoid. So the route passes `includeSubjects` only when a request carries `includeSubjects=1`, and only Teacher view's Rankings fetch sends it. The route remains the only caller that ever sets the option; the Data View's requests, and every other caller, make exactly the fetch they made before.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on every changed file (the only problems reported are in untouched pre-existing files: PeerTrendChart, SchoolMap, SchoolSearch); `next build` passes.

**Real data, through the real code.** `fetchAcademicProfiles` was run for Acland Burghley and four of its real Nearest 10:
- **Without `includeSubjects`:** every profile's subject fields are empty (0/0/0). Other callers neither pay for nor see the data.
- **With it**, the map's inputs change by subject:

| School | KS4 Biology entries / score | KS4 Maths (General) entries / score | KS5 Art and Design A-level | KS5 Art and Design BTec |
|---|---|---|---|---|
| Acland Burghley | 40 / 7.45 | 178 / 5.14 | 14 / 36.43 | 14 / 27.29 |
| Parliament Hill | 50 / 7.70 | 174 / 5.65 | 8 / 30.00 | none |
| Camden School for Girls | 30 / 7.73 | 114 / 6.42 | none | none |
| William Ellis | 36 / 6.03 | 97 / 5.30 | 5 / no score | none |
| La Sainte Union | 21 / 6.14 | 89 / 4.29 | 2 / no score | none |

Switching Biology → Maths changes which school has the largest dot (Parliament Hill → Acland Burghley) and every school's colour. The KS5 split is real: Acland Burghley's A-level and BTec Art and Design are separate series.

**Data View unaffected:** its map requests never carry `includeSubjects=1`, so they return profiles exactly as before, and `AcademicMapView` with no `subject` takes the same whole-school and family paths as before.

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, both phases, both themes:
1. chips appear per the grain above;
2. switching chips visibly changes dot sizes and colours;
3. the size legend names the selected subject;
4. the Data View's Academic map looks exactly as before.
