# Post-16: split AS from A-level for display, then build the KS5 subject+qualification geography benchmark

Two repos, three parts, sequenced — do Part A first (small, self-contained, vicdata_public
only), then B and C together (B is the backend prerequisite for C, and B lives entirely in the
`vicdata` repo, not this one — a separate Claude Code session against that repo). Ground truth
checked against `vicdata_public` HEAD `86d5044` and the real schema/ingest in `vicdata`
(`academic_subject_geography_aggregate`, `ingest/academic_aggregates.py`) — re-read the cited
files before editing, line numbers may have shifted.

Full reasoning and the finding that connects Parts A and B lives in this project's Claude
Project doc `vicdata_phase3_teacher_view_post16_gcse_parity_audit_v1.md` — read it first if
anything below is unclear on the "why".

## Part A — vicdata_public only: split AS level from A-level for display

**Decided scope (Guy, 2026-09-26): display only.** The whole-school headline APS figure must
stay byte-identical to DfE's own published number, which blends AS entries into the A-level
bucket at half size — verified against a real school (Capital City College, 27.51 computed vs
27.95 DfE-published). So `bucketFor()` (`src/lib/dfe-qualification-buckets.ts` L108-110) and its
Python mirror `bucket_for()` (`vicdata` repo, `ingest/dfe_points.py`) are NOT touched by this
round — they keep AS in the "alevel" bucket, exactly as now.

**What to add instead**: a new function, e.g. `displayBucketFor(qualificationType: string):
Ks5Bucket`, in `dfe-qualification-buckets.ts`, identical to `bucketFor()` except AS level
(`q.startsWith("GCE AS level")`) returns `"other"` instead of `"alevel"`. `"other"` already
groups EPQ, Core Maths, Pre-U etc. (`KS5_BUCKET_DESCRIPTION.other`) — AS level joining it there
is the same shape of grouping already in place, not a new concept.

**Where to point it**: `bucketFor()` is shared across two products, confirmed by grep — it
drives both Academic Results' bucket pills (`SubjectDeepDiveDrawer.tsx`,
`SubjectAreaSection.tsx`, all three explicitly commented "the same bucketFor() rule the pills,
the subject cards and the ingest use" — i.e. deliberately kept in sync with the points
calculation) and Teacher View's subject grouping (`teacher-view-catalogue.ts`,
`teacher-view-theme.ts`, `page.tsx`). Guy's complaint ("2 entries in all subjects lists") was
raised in a Teacher View conversation, so switch Teacher View's subject-list/tile call sites to
`displayBucketFor()`:

- `src/app/teacher/[phase]/page.tsx` L368, L436 — `buildSubjectItems`'s bucket assignment for
  the subject picker/tiles.
- `src/lib/teacher-view-catalogue.ts` L126, L131 — check both call sites; L131's comparabilityKey
  is used by the Comparisons panel's per-school threshold matching (§ below) and by the subject
  picker's grouping — confirm which of its callers is display (switch it) vs. matching logic
  that should stay keyed on the real qualification either way (this one may not need to change
  at all, since `comparabilityKey` already exists precisely to match real qualifications, not
  buckets — check before touching).
- `src/lib/teacher-view-theme.ts` L106 — `qualificationFamilyOf`, used for the family/bucket
  colour + label shown on chips and tiles.

Leave every Academic Results call site (`SubjectDeepDiveDrawer.tsx`, `SubjectAreaSection.tsx`)
on the real `bucketFor()`, unchanged — Guy didn't ask for that product's bucket pills to change,
and they're explicitly tied to the points calculation display, which must stay accurate to the
real bucket. If Guy wants the same AS/EPQ split there later, it's a one-line follow-up once
`displayBucketFor()` exists.

**Verify**: with a school that teaches both AS Maths and A-level Maths, the Teacher View
subject list/tiles now show Maths once under "A-level" (the real A-level entry) and, if AS
Maths is also ticked, once under "Other" alongside any EPQ/Core Maths — not twice under
"A-level". The whole-school headline APS figure for that school is byte-for-byte unchanged
from before this round (spot-check against the Capital City College case already referenced in
the codebase, or any other school with real AS entries).

## Part B — vicdata repo backend, SEPARATE Claude Code session: KS5 subject+qualification geography aggregate

Not built in this repo. Summary only, so this repo's build knows what Part C depends on —
full spec is in the Claude Project doc named above.

**Decided scope (Guy, 2026-09-26): key on subject + qualification type exactly** — e.g. compare
a school's A-level Maths only against other schools' A-level Maths, not against the broader
"alevel" bucket.

**Why this needs new aggregation, not a filter change**: `academic_subject_rollup`'s existing
KS5 rows are keyed by (entity_id, subject, period, bucket) — already summing AS Maths and
A-level Maths together into one "Maths / alevel" row before geography ever sees it. The raw
per-qualification data already exists in `canonical_facts` (nothing to wait on, no new ingest);
what's missing is a new aggregation pass at exact-qualification grain, populated into a new
sibling table (`academic_subject_qualification_geography_aggregate`, ks5-scoped), following this
repo's own established convention of a new sibling table per new grain rather than widening the
live GCSE table. New RPC (`academic_subject_qualification_geography_lookup`, mirroring the
existing `academic_subject_geography_lookup`) exposes it to this repo.

## Part C — vicdata_public: wire it into Teacher View

Once Part B is live and verified in `vicdata`:

1. New lookup wrapper in `src/lib/vicdata-reference.ts`, `lookupAcademicSubjectQualificationGeography()`,
   modelled on the existing `lookupAcademicSubjectGeography()` a few lines above it, with
   `qualificationType` added to its parameter/return shape.
2. `englandAverages()` (`src/app/api/teacher/dashboard/route.ts`) — add a KS5 branch calling the
   new lookup, keyed by `(subject, qualificationType)` from the school's own ticked items, in
   place of the current whole-school `academic_geography_aggregate` fallback. Decide the
   `basis` value the return type should carry for this case (neither the existing `"bucket"`
   nor GCSE's `"subject"` quite describes exact-qualification grain — name it honestly, e.g.
   `"subject_qualification"`, and update the type/consumers accordingly).
3. Open the three `phase === "ks4"` gates this round exists to fix, in
   `src/app/teacher/[phase]/page.tsx`:
   - ~L921 — the Results panel's per-subject benchmark bars, for every category peer, not just
     the focused subject.
   - ~L937 — the category comparison's "England {family} average" reference line.
   - ~L1384, ~L1463 — the Results & Candidates panels' LA/regional/national % Change geography
     sub-panel (`geography={...}` props), including their `notApplicableText` wording, which
     currently states the GCSE-only limitation and needs rewriting for the cases that now do
     and don't apply at Post-16 — the same honest-absence discipline as the existing GCSE
     wording.
4. Use `displayBucketFor()` from Part A wherever this round groups peers by family/bucket for
   the "England {family} average" line, so AS entries don't get pulled back into blended
   A-level figures on the benchmark side after being split out for display on the list side.

**Verify**: for a school with a real A-level Maths entry, the Results panel's Maths bar (and
every category peer with a real KS5 subject+qualification match) now carries a genuine England
benchmark at the same grain as GCSE. AS-only entries correctly show no benchmark yet unless
Part B's population step also covers "other" grain — confirm scope before assuming AS gets
benchmarked in this same round; it may not have enough data volume to be meaningful and can be
left for a later round if so.

## Deliverable

Part A: one commit, one build report (this repo). Parts B+C: one Claude Code session each
against their own repo, sequenced (B before C), each with its own build report — what changed,
real locations touched, verification steps above, and anything you had to interpret rather than
found explicitly specified here, flagged as an open decision for Guy.
