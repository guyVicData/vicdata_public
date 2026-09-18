# Build report: Academic Results front end, round 2

Brief: `docs/vicdata_phase3_academic_results_frontend_round2_brief_v1.md`. Builds on
round 1's own still-uncommitted working tree. Read round 1's report in full first, then
checked its claims against the real code rather than taking them on faith (per the
brief's own instruction) — every claim checked turned out accurate; specifics below.

**Browser tool check**: checked at the start of this round, same as instructed. No
Claude-in-Chrome connection was available this session either (the same check round 1
made, same result). All verification below is real dev-server + `curl`/API-level
testing plus direct data-layer execution via `tsx` — no visual browser test happened,
and none is implied below.

## Part A — the census double-fetch (done first, small)

Checked round 1's claim directly before fixing anything: `fetchAcademicProfiles`
(`academic-data-view.ts`) unconditionally called `fetchCensusFactsBatched`, and
`AcademicSnapshotCard`/`page.tsx` never read `ageGenderCounts` at all (confirmed by
`grep`, zero hits) — page.tsx has its own, separately-computed `ageGenderCounts` for
Roll/Shape, fed from a different fetch. Claim was accurate.

Fix: `fetchAcademicProfiles(urns, { includePopulation?: boolean })`, default `true` (so
`/api/data-view/academic-schools` — the Data View's own call site — is untouched).
`false` skips `fetchCensusFactsBatched` entirely and returns an empty `Map`. The free
card's call site in `page.tsx` now passes `includePopulation: false`.

**Verified via real execution, not just `tsc`**: a direct `tsx` run of
`fetchAcademicProfiles` for the same real URN, both ways —

```
includePopulation: true (default): 113ms
includePopulation: false: 53ms
with population, ageGenderCounts size: 20
without population, ageGenderCounts size: 0
headline data still present without population: 4 4
```

Roughly half the time, empty population map, headline data unaffected. The free page's
own server-rendered HTML was re-confirmed correct afterwards (Huntington School, same
real sentences as round 1).

## Part B — family-level Map (§3b) and Graphs section 4 (§4)

- **Category filter**: `src/components/data-view/AcademicDataView.tsx` — a new
  `familyId` state, reset whenever the key stage changes. Options are the real union of
  `(familyId, familyLabel)` pairs across the target + every ticked/added profile at the
  current stage (`availableFamilies`, new in `academic-data-view.ts`) — confirmed no new
  fetch was needed, per the brief's own note: `ks4Families`/`ks5Families` were already
  in every profile `fetchAcademicProfiles` returns. Visual style matches
  `FilterBar.tsx`'s own Phase pills (active fill, ▾ caret) via a small self-contained
  copy, not an import of that component's private `Pill` (styled for Rolls'
  `TAG_COLOURS` tag keys specifically, not this list of families).
- **Map** (`AcademicMapView.tsx`): once a family is selected, circle size becomes real
  `entriesTotal` for that family/year, colour becomes trend in `avgPointScore` since the
  stage's baseline. Grade-band mode is simply not offered at family level (button
  hidden), per the original brief's own deferral.
- **Graphs section 4** (`AcademicGraphsView.tsx`): an entries-share donut across this
  school's own full family mix (a small new N-slice donut, not a forced reuse of
  `GenderSplitCard`'s two-slice-only `Donut`), a bar chart of `avgPointScore` across the
  ticked set for the selected family (`SortedBarChart`, reused directly), and a trend
  line of the school's own family score since baseline (the existing
  `TargetVsAverageTrend` component, fed a null-only "average" series to draw just the
  one line — no new chart needed).

**Low-coverage families — evidence-checked, not assumed.** Queried
`academic_subject_family_headline` directly:

```
Health & Care:  0 rows with a real avg_point_score, at BOTH ks4 and ks5 (100% null)
Every other family: avg_point_score IS shown in most rows, even down to 0.5-9%
  real coverage in some cases (Enterprise & Applied Studies ks5 shows scores as low
  as 30.9% average coverage) -- avg_point_score's own null-ness, not a separate
  invented coverage-percentage cutoff, is what genuinely distinguishes "nothing to
  show" from "a real, if imperfect, figure exists."
```

So the honest caption (summary-wordings §6) is shown exactly when `avgPointScore ===
null` — matching the backend's own real semantic — not a second, invented threshold.

**Verified via real execution**: `tsx` run of `availableFamilies`/`familyYearsFor`/
`latestFamilyYear` against three real through-schools confirmed all 8 real families,
confirmed Health & Care's `avgPointScore: null` for a real school, and confirmed a real
per-year trend (Sciences & Maths, one school: 2020 null, 2021–2024 real scores
5.38–6.33) — the "first/last non-null score" trend logic was checked against this exact
shape. Also re-confirmed end-to-end through the real `/api/data-view/academic-schools`
route with a real authenticated session (40 real `ks4Families` rows returned for the
same school).

## Part C — subject-level Map (§3c) and table (§6): landed the table, not the Map

**Real breakdown-string shapes, checked directly before writing any grouping code**
(the brief's own explicit instruction) — genuinely more complex than
`academic_subject_family_rollup`'s flat `subject` shape, and this investigation changed
what got built:

```
dfe_ks4_subject_entries        "{qualification}::{subject}::{grade-or-total-label}"
dfe_ks5_subject_results        "{qualification}::{subject}::{size-weight}::{grade-or-total-label}"
dfe_ks5_subject_value_added    "{qualification}::{subject}::{size-weight}::{measure}"
```

Real findings from this investigation:

- Total-row labels vary (`"Total exam entries"` vs `"Total"` vs, in the _historic
  siblings only, `"Total number entered"`) but **never both appear for the same real
  (entity, period, qualification::subject[::size-weight]) row** — confirmed directly
  (zero overlapping rows) — so whichever is present is safely the entries count, no
  double-counting risk. Scoped to **modern sources only** this round (2023/24 on); the
  `_historic` siblings' own extra label variant wasn't investigated.
- **Subject names genuinely differ between the two KS5 sources** for the same real
  subject at the same real school — e.g. `"Art and Design (Fine Art)"` in
  `dfe_ks5_subject_results` vs `"Art & Design (Fine Art)"` in
  `dfe_ks5_subject_value_added`. A naive cross-source join by subject name would
  silently mismatch rows like this.
- `dfe_ks5_subject_value_added` is otherwise clean and self-consistent: real
  `entries_count`/`value_added`/`value_added_lower_ci`/`value_added_upper_ci` per
  (qualification, subject, size-weight, period) — no per-grade tallying needed.
- The raw entries sources give **per-grade counts** ("Level 2 distinction": 14,
  "Merit": 9, "U": 2), not a pre-computed average — an average point score per subject
  needs the same `GCSE_POINTS`/`ALEVEL_POINTS` conversion tables and weighted-averaging
  logic vicdata's own `ingest/academic_aggregates.py` built for the family rollup,
  which lives only in that repo's ingest pipeline.

**Built, as a result**: a subject-level table (`SubjectTable` in `AcademicGraphsView.tsx`),
reached via a Subject dropdown shown once a category is selected — real entries count
(both stages, from each stage's own raw source) and, KS5 only, real value-added rows
with their own confidence interval, framed the same honest way as this topic's
Progress-8 sentence template ("likely to sit somewhere between X and Y"), sourced
entirely from `dfe_ks5_subject_value_added`'s own `entries_count` (never cross-joined
with the raw entries source, for the real reason above). Fetched separately from the
main profile batch, for the target school only (`fetchSubjectLevelData`,
`/api/data-view/academic-subject`) — the table is a single-school view (spec §6), not a
ticked-set comparison, so it would be wasteful to fetch it for every ticked/added
school the way family data already is.

**Not built, and why — a real stopping point, not a shortcut**:

- **Average grade/point score per subject** (either stage) — needs the point-value
  conversion/weighted-averaging logic described above; genuinely new scoring logic with
  no real backend precedent to lean on in this repo, not a fetch+group job.
- **Subject-level Map (§3c)** — entries-based circle sizing would be buildable, but
  without an average point score there's no real metric for the colour dimension (the
  one thing that would make it more than a finer-grained repeat of the family map's own
  sizing idea). Not built rather than shipped colour-less.
- **The Subject dropdown isn't filtered to the selected family** — `subject_family_map`
  (which raw subject belongs to which family) isn't exposed via any RPC this round;
  every real subject for the stage is listed regardless of category, with a small
  caption saying so. A real, separate small gap, not something to fix by inventing a
  new backend RPC in an already-large round (and Part D is investigation-only).
- **Historic subject-level sources** (`dfe_ks4_subject_entries_historic`/
  `dfe_ks5_subject_results_historic`) — not investigated this round.

**Judgement call — minimum-N threshold, with real national evidence, not a round
number**: queried the real, national distribution of subject-level entry counts
(most recent real period per source, "Total exam entries"/"Total" rows only, "All
subjects" pseudo-rows excluded):

```
dfe_ks4_subject_entries (n=102,948 real rows): median 27; 17.6% have fewer than 5
  entries, 24.4% fewer than 10.
dfe_ks5_subject_results (n=79,621 real rows): median just 8; 32.0% have fewer than 5
  entries, 54.9% fewer than 10 -- a threshold of 10 would suppress the MAJORITY of
  real A-level subject rows, which stops being a caveat and starts being "hide most
  A-level subjects."
```

**Proposed N = 5.** It flags a real minority even at KS5 (32%, not the 55%+ a
threshold of 10 would hit), matches the long-established "fewer than 5 pupils" bar
already used throughout UK education statistics for statistical-noise concerns
(distinct from DfE's own separate disclosure-risk suppression, which already runs on
the published figures before they reach this ingest), and sits concretely below every
example this topic's own summary-wordings doc cites as obviously too few ("[3]
students..."). Implemented as `MINIMUM_SUBJECT_N` in `academic-data-view.ts`, applied
per row in the new subject table (a `†` marker + caption below the table).

**Verified via real execution**: `tsx` run of `fetchSubjectLevelData` against a real
through-school confirmed 33 real KS4 subjects and 47 real KS5 subjects, a real
`entriesCount`/`valueAdded`/CI sample, and the real national percentile query above run
directly against `vicdata`'s local database (52,584 real schools' worth of ingested
data, not a synthetic sample). Re-confirmed end-to-end through the real
`/api/data-view/academic-subject` route with a real authenticated session (82 real
entries rows, 43 real value-added rows for the same school).

## Part D — go-live readiness (investigation only; nothing applied, nothing deployed)

### `vicdata`: hosted migration status

Ran `supabase migration list` against the real linked hosted project
(`hrqrbvrrhlidpoybezhs.supabase.co` — the same real project `vicdata_public`'s own
`VICDATA_API_URL` points at, confirmed by comparing to that key's presence, not its
value) — a read-only comparison, nothing applied. Real result: every migration through
`20260828101500` (2026-08-28) is applied to hosted. **Every Academic Results migration
(2026-09-12 onward, 14 files, none applied yet)**:

```
20260912100000_ks4_ks5_subject_level_sources.sql
20260912110000_canonical_facts_snapshot_id_idx.sql
20260912200000_ks2_attainment_source.sql
20260912300000_historic_accountability_sources.sql
20260912400000_modern_ks4_ks5_headline_sources.sql
20260912500000_subject_family_taxonomy.sql
20260912510000_subject_family_map_data.sql
20260912520000_subject_family_rollup.sql
20260913100000_la_name_region_crosswalk.sql
20260913200000_academic_headline_snapshot.sql
20260913210000_academic_geography_aggregate.sql
20260913300000_academic_headline_lookup.sql
20260913310000_academic_subject_family_lookup.sql
20260913320000_academic_geography_lookup.sql
```

The entire Academic Results backend — every table, the crosswalk, and all three RPCs —
is real, tested, and working locally, but genuinely does not exist yet on hosted
`vicdata`.

### `vicdata_public`: deploy mechanism and hosted env vars

Real findings, not assumed: no `vercel.json`/`render.yaml`/`.github/workflows` in this
repo. `docs/vicdata_phase3_full_build_brief_v1.md` (the real launch-setup brief)
documents the actual decision: a **Render** Web Service (not Vercel — middleware/route
handlers need a running Node process), domain `vicdata.co.uk`. `.nvmrc`/`.node-version`
both pin Node 22, confirming that setup step was actually carried out, not just
proposed. Render's standard behaviour for a connected repo is a git-push-triggered
auto-deploy, but this session had **no Render CLI or dashboard access at all** (checked:
`render` command not found, no Render credentials in this environment) — I cannot
directly confirm auto-deploy is actually enabled for this specific service, or its
current deploy status, from here. A human should confirm this directly.

Hosted env vars: per the round's own instruction, checked only that the required
variable **names** exist (never their values) — confirmed via this repo's own
gitignored local `.env` (`git check` confirms `.env*` is gitignored, so this file was
never a source of truth for what's on Render, only for which names the code actually
needs): `VICDATA_API_URL`, `VICDATA_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_GATE_ENABLED`/
`ACCESS_GATE_USER`/`ACCESS_GATE_PASSWORD`. **Whether Render's own hosted configuration
actually has these set, and whether `VICDATA_API_URL` there points at the same hosted
`vicdata` project the pending migrations above would be applied to, could not be
confirmed this session** — no Render access. Flagged as a real, necessary human step,
not assumed either way.

### Go-live checklist (for a human decision — not executed)

1. Guy and Claude review the real diff across both repos together (standing
   instruction for this project).
2. Commit round 1 + round 2's changes in both `vicdata` and `vicdata_public`.
3. Push both to their remotes.
4. Apply the 14 pending Academic Results migrations to hosted `vicdata` (e.g.
   `supabase db push` against the linked project) — a deliberate, explicit,
   human-approved action.
5. Confirm Render's hosted environment already has `VICDATA_API_URL`/`VICDATA_ANON_KEY`
   set, pointing at the now-migrated `vicdata` hosted project (direct Render dashboard
   check — this session couldn't do this).
6. Confirm `vicdata_public`'s Render service actually picks up the push (automatic if
   auto-deploy is on; otherwise a manual deploy trigger) and rebuilds successfully.
7. Smoke-test the live hosted site: the free Academic snapshot card on a real school's
   State of School page, and the paid Data View's Academic tab (headline, family,
   subject table) end-to-end with a real member account, against the now-migrated
   hosted `vicdata` — not just that the build succeeded.
8. Only once that smoke test passes is the feature genuinely live.

## Explicitly out of scope, confirmed still out of scope

- `academic_geography_lookup` (LA/region/national): re-checked — neither Part B's
  family-level work nor Part C's subject-level work surfaced a genuine, concrete need
  for it (no chart in either part compares against a national/regional reference line).
  Still not wired in, per the round 2 brief's own instruction not to invent a use for
  it.
- Region/Nation-scale Academic Rankings, print/PDF export for the Academic tab,
  vocational/BTEC point-score conversion — untouched, as instructed.

## Verification summary

- `npx tsc --noEmit`: clean, both before and after every change this round.
- `npx eslint` on every new/modified file: clean (one real issue caught and fixed —
  the same class of `setState`-in-effect ordering bug round 1 hit once, this time in
  the new subject-data fetch effect in `AcademicDataView.tsx`).
- Real end-to-end testing (no browser tool available, confirmed at the start — see
  above): local `vicdata_public` Supabase stack + dev server restarted (ports
  temporarily remapped again to coexist with `vicdata`'s own running stack, reverted
  afterward — `git diff` on `config.toml` is clean), a real authenticated test session
  reused (new user this round, real approved membership via the existing
  `/api/testing/switch-school` tool), every new/changed data path hit via real `curl`
  requests and direct `tsx` execution against real local data, not mocked. Both local
  Supabase stacks stopped since testing finished.

## Confirmations

- Nothing was written to hosted/production: every command explicitly overrode
  `VICDATA_API_URL`/`VICDATA_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY` to local values; Part D's `supabase migration list` is a
  read-only comparison and applied nothing. Neither repo's own hosted `.env` was read
  into any command's environment.
- No existing Rolls, round-1 Academic, or DataViewShell behaviour regressed:
  `DataViewShell.tsx` was not touched at all this round (confirmed via `git status` —
  its only diff is round 1's own, unchanged); Part A/B/C's data-layer changes are
  additive (`includePopulation` defaults preserve the old behaviour; `familyId`/
  `subjectData` are optional props, default `null`, and every existing call site was
  re-tested and still returns the same real data as before).
- Do not commit or push, and do not touch hosted/production, as instructed — stopping
  here.
