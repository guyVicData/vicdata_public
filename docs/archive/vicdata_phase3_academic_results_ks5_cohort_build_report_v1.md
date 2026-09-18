# Build report: KS5 qualification-type awareness

Brief: `docs/vicdata_phase3_academic_results_ks5_cohort_brief_v1.md`. Independent of
the GCSE exclusion round (KS5-only vs. that round's KS4-only), touching
`academic-data-view.ts` via different exports — re-read the file fresh before
starting, per instruction, rather than working from a stale mental model of the
GCSE round's own edits. Built and tested locally only; nothing committed, pushed, or
touched on hosted/production.

**A real incident interrupted this round before Part 1 started** — see
`docs/vicdata_ingest_local_dev_seed_note_v1.md`'s own "Built, 2026-09-13" section and
`ingest/derived_data.py`'s own docstring for the full writeup: an accidental
`supabase db reset --local` wiped the local `vicdata` stack's test data, and the
recovery ingest then triggered an unguarded hook that ran a real recompute against
**hosted** vicdata_public. Both are now fixed (a hard opt-in guard on the hook,
verified twice via real promotes with it unset; a real, restore-tested local-dev seed
for GIAS) and confirmed working before this round's own work began — not repeated in
full here.

**Browser tool check**: checked again at the start (`tabs_context_mcp`) — still no
Claude-in-Chrome connection this session. The brief asked for a real visual check of
the new selector control if one existed; none did, so that check was **not**
performed. In its place: a real dev server against the local remapped stack, curled
for the free card's actual server-rendered HTML (works — server-rendered), and a
standalone script exercising the real data-layer functions (`dominantKs5Cohort`,
`ks5HasCohortEntries`, the new RPC) against real fetched profiles for the Data View
surfaces, which are client-rendered after a browser fetch and can't be curled.

## Part 1 — landing `aps_per_entry_student_count`

Added to `dfe_ks5_headline.py`'s `_NUMERIC_COLUMNS` (confirmed first, per the brief's
own instruction, that `recompute_academic_headline_snapshot` in
`ingest/academic_aggregates.py` reads every real breakdown key generically with no
allowlist — so this one addition was genuinely sufficient, no second ingest-side
change needed). `base.check_header_mismatch`'s `ignore_added=True` only flags a
*missing* expected column, and the real live CSV does have this column (confirmed by
fetching it directly before writing the code) — no mismatch risk.

**Real execution, re-verified after the incident's full local rebuild** — real
`aps_per_entry_student_count` values for all four named schools, matching the
brief's own quoted figures exactly:

```
Capital City College (130421): Academic 868, A level 842, Applied general 1083, Tech level 219, Technical certificate 42
Sevenoaks (118952): Academic 244 (only)
NLCS (102257): Academic 96, A level 80
Leighton Park (110110): Academic 78, A level 78, Applied general 6, Tech level 6
```

Confirmed directly (real query) that `E/M measures` never carries this field in any
real row — safely excluded from `KS5_COHORTS`, matching the brief's own instruction
to check rather than assume.

## Part 2 — real IB/Pre-U flag

New RPC `academic_ks5_qualification_flags_lookup` (migration
`20260913330000_academic_ks5_qualification_flags_lookup.sql`), same established shape
as every other lookup here (plpgsql, security definer, dynamic EXECUTE, the same
clean-1:1-Predecessor `school_lineage` fallback `academic_headline_lookup`/
`reference_data_lookup` already carry). Aggregates `canonical_facts_current` for
`source_id = 'dfe_ks5_subject_results'`, matching `split_part(breakdown, '::', 1)`
against the five confirmed real IB names and two confirmed real Pre-U names.
`ks5QualTypes: { ib, preU }` threaded onto `AcademicSchoolProfile` via
`fetchAcademicProfiles`, same one-more-fetch pattern as `establishmentTypeGroup` was
for the GCSE round.

**Real execution** against all eight schools on record for this feature (the five the
brief named plus Huntington control, Hockerill, and Halcyon):

```
NLCS (102257): ib=true preU=false
Leighton Park (110110): ib=true preU=false        <- see note below
Benenden (118939): ib=false preU=true
Sevenoaks (118952): ib=true preU=false
Huntington (121673, control): ib=false preU=false
Capital City College (130421): ib=false preU=false
Hockerill (136482): ib=true preU=false
Halcyon (139415): ib=true preU=false
```

Every result matches the brief's own expectations. **One genuine, unexpected real
finding**: Leighton Park (characterised in the GCSE-exclusion round as having "a
small real vocational minority alongside A-level") also has `ib=true` — real,
confirmed IB entries in `dfe_ks5_subject_results`, not something either brief
predicted. Not a bug; flagged for Guy's own awareness since it changes Leighton
Park's own Part 3 headline sentence (see below).

## Part 3 — auto-detected dominant cohort (the reported bug's actual fix)

`dominantKs5Cohort(profile)` picks whichever real cohort has the highest
`aps_per_entry_student_count` for the school's latest KS5 year; used instead of the
old hardcoded `HEADLINE_MEASURE.ks5` in exactly the two single-school, no-comparison
places the brief named: the free snapshot card and the paid Overview's own headline
number (not its spread/growth/trend sub-sections — see Part 4). The Academic-and-IB
case needed real judgement, not mechanical substitution, per the brief's own flag —
drafted into a new §13 of the summary-wordings doc (marked as drafted-not-settled,
alongside §11's own still-unreviewed wording).

**Real execution, dev-server HTML (server-rendered, so directly curlable)** — all
five named schools:

```
Capital City College: "...Applied General students achieved an average of 24.3 points per entry in 2024/25."
Sevenoaks: "...A-level and International Baccalaureate students achieved an average of 49.5 points per entry in 2024/25."
NLCS: "...A-level and International Baccalaureate students achieved an average of 54.6 points per entry in 2024/25."
Leighton Park: "...A-level and International Baccalaureate students achieved an average of 39.9 points per entry in 2024/25."
Huntington (control): "...A-level and other academic students achieved an average of 38.9 points per entry in 2024/25."
```

Capital City College now shows its real dominant Applied General figure (previously
blank/near-empty on the old hardcoded A-level key); Sevenoaks and Leighton Park now
show real numbers instead of the old near-empty A-level line; NLCS shows Academic
(96 real entries) over A-level (80), matching the brief's own expectation exactly.
Huntington (a real, plain A-level-and-not-much-else school, per earlier rounds) is
correctly unaffected in substance — same real average as before, just now reads
"A-level and other academic" rather than a bare "A-level" label, since it turns out
to have a handful of non-A-level Academic-cohort entries too (real, not new — the old
hardcoded code simply never surfaced this).

Leighton Park is a genuine tie (Academic 78 = A level 78 exactly) — `dominantKs5Cohort`
picks "Academic" on an exact tie (first in `KS5_COHORTS`' own order), which combined
with its real, confirmed IB flag (Part 2) produces the "A-level and International
Baccalaureate" sentence. A defensible, honest tie-break (never under-counts real
entries), but flagged for Guy's own read given it wasn't explicitly specified by the
brief for the tied case.

## Part 4 — the qualification-type selector

New `Ks5CohortSwitcher` in `AcademicDataView.tsx` (visually distinct blue pills, not
reused from `CategoryFilter` — a genuinely different concept, per the brief's own
instruction), rendered whenever `effectiveStage === "ks5"`, for every view including
Rankings (unlike `CategoryFilter`, which is hidden there — this control genuinely
applies to a ranking too). Defaults to the target's own real dominant cohort
(`dominantKs5Cohort`) on first load, resets to that default on every stage change,
and is a real, independently-changeable control from there — exactly the brief's own
"jarring near-empty A-level view by default" fix.

Five real options (`KS5_COHORT_OPTIONS`): A-level (default), Academic (IB) —
restricted to Part 2's real IB flag, Applied General, Tech Level, Technical
Certificate. No separate Pre-U option, per the brief's own "what NOT to build."

**Exclusion mechanism reuses the GCSE round's own shape** (`ks5HasCohortEntries`,
`ks5CohortExclusionNote`, `ks5CohortWholeGroupSentence`), generalised to any cohort
rather than IGCSE-specific, feeding the same `comparableGroup` pattern in
Graphs/Rankings/Map. One real design difference from the GCSE round, flagged
directly: unlike ks4's dedicated "the school being viewed is itself excluded"
sentence, KS5's own excluded-target case has no separate sentence — the target is
simply named in the same group note as any other excluded school, since Part 3
already gives the target's own single-school headline number independently, so the
only real gap to explain is "why is this school's own dot/bar/line missing from the
group chart below," which the shared note already answers.

**Real execution, four scenarios**, using real fetched profiles:

```
A: Applied General selected, {Capital City College, Huntington, Sevenoaks}
   -> Sevenoaks correctly excluded ("...isn't shown in this Applied General comparison — it has no real Applied General entries recorded.")
   -> Capital City College and Huntington both correctly included (both have real Applied General entries)

B: Academic (IB) selected, {Sevenoaks, Hockerill, NLCS} — all three real IB
   -> all three correctly included, none excluded

C: Academic (IB) selected, {Sevenoaks, Hockerill, Huntington (plain A-level)}
   -> Huntington correctly excluded ("...isn't shown in this International Baccalaureate comparison — it has no confirmed IB entries recorded.")

D: Technical Certificate selected, {Huntington, NLCS} — neither has real Tech Cert entries
   -> whole-group-excluded correctly detected: "None of the schools in this comparator set have entries in Technical Certificate to show here — try a different qualification type."
```

All four matched real expectations exactly — the same discipline as the GCSE
round's own group/comparator-set verification, confirming excluded schools are
genuinely removed from rankings/averages, not just hidden.

**Not built, deliberately, matching the brief's own scope**: grade-band ("AAB or
higher") colour mode on the Map is only offered when the selector is on its "A
level" default — hidden (same treatment as family level) for every other cohort,
since DfE has no equivalent threshold field for Applied General/Tech
Level/Technical Certificate and "Academic" blends types too freely for one to mean
anything. Flagging this as a real, deliberate scope call, not an oversight.

## Wording — new §13

Added to `vicdata`'s own `docs/vicdata_phase3_academic_results_summary_wordings_v1.md`,
mirroring §11's list-and-reason shape rather than inventing a new one. Two things in
it are genuinely drafted, not quoted verbatim from the brief (flagged in §12 as open,
same as §11 originally was): the Academic-dominant-but-no-IB headline sentence, and
the generic (non-IB) per-cohort exclusion note shape (the brief only gave exact text
for the IB case and the whole-group-empty case).

## Verification summary

- `npx tsc --noEmit`: clean throughout.
- `npx eslint` on every changed file: clean (two stray unused-import warnings caught
  and fixed along the way).
- Real execution, not just types: Part 1's ingested figures, Part 2's RPC flags, Part
  3's dev-server-rendered sentences, and Part 4's four cohort-switch scenarios all
  verified against real data for every named school in the brief, plus Hockerill/
  Halcyon/Huntington.
- **Not verified, plainly**: the Data View's own on-screen rendering (the selector
  control actually appearing and working, a chart's composition visibly changing on
  a real click) — no browser tool was available this session (checked again at the
  start). The underlying logic was verified as directly as possible without one (see
  above); the actual rendered interaction is unconfirmed.

## Confirmations

- Nothing written to hosted/production this round (the earlier incident, and its
  fix, are covered in a separate report/note, not repeated here). Both local stacks
  stopped, `vicdata_public`'s `config.toml` reverted (`git diff` clean) since testing
  finished.
- `git status` clean of test artifacts — the temporary verification script and dev
  server/log used for the real HTML checks were removed after use.
- Do not commit or push, as instructed — stopping here. Guy will review Capital City
  College (BTEC), Sevenoaks (IB), and NLCS (mixed) himself before anything ships —
  plus, given this round's own findings, it may be worth a look at Leighton Park's
  new "A-level and International Baccalaureate" sentence too, since that's a real
  change in how that school reads that neither brief anticipated.
