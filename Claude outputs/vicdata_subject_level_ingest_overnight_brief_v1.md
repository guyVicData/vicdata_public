# Overnight brief: investigate + ingest KS4/KS5 SUBJECT-LEVEL academic data

Run unattended overnight. No one will be watching to redirect you, so the discipline
below matters more than usual: investigate before building, and when something is
genuinely ambiguous, write it up and stop rather than guess and keep going.

## Goal

Land real, subject-level DfE KS4 (GCSE) and KS5 (A-level/16-18) data in the database —
per-subject, per-school, per-year, not the whole-school headline measures (Attainment 8,
Progress 8, average point score) that were the subject of the *separate*, still-on-hold
overnight brief (`docs/vicdata_academic_ingest_overnight_brief_v1.md`). Don't conflate the
two — this round is subject-level only, and doesn't require the headline round to have
happened first.

Guy's own framing for tonight, verbatim: start with what's genuinely available now (2023/24
and 2024/25 are the full real history — there is nothing earlier to backfill, confirmed by
direct investigation, not assumed) and let the site's own history accumulate one real DfE
release at a time going forward. So the sync scripts built tonight should be written as
genuinely re-runnable, idempotent jobs (upsert by school+subject+year, matching whatever
this codebase's existing sync-*.ts scripts already do for repeat runs) — not a one-off
destructive load — since a new year's file will land on EES roughly annually and the same
scripts should just pick it up.

Front-end display is explicitly OUT of scope for tonight — ingest only, same as the
headline round. The point is real, confirmed data sitting in the database by morning, with
honest findings written up, so the front-end can be spec'd later against real data shapes.

## What's already confirmed — real investigation done, don't re-derive from scratch

This has already been checked directly against DfE's Explore Education Statistics (EES)
platform and against Guy's own downloaded local files this week. Treat the following as
established fact, not something to re-verify from first principles — but DO verify the
specific column structures flagged below as not yet directly opened.

- **No institution-level subject data exists before 2023/24 for either KS4 or KS5.**
  Checked directly (not assumed): 2019/20 and 2022/23 EES release pages for both KS4 and
  KS5 show no institution-level subject file at all, only LA/national/institution-type
  aggregates. 2023/24 is genuinely the start of the public record for this — not a gap in
  anyone's search.
- **KS4 subject-entries file**: institution-level, URN-keyed, confirmed to exist as a real,
  separate EES dataset for BOTH 2023/24 and 2024/25 (roughly 700-750k rows each release,
  exact counts to be confirmed directly again tonight since they were checked from EES
  release pages, not opened row-by-row). Real column headers/schema have **not** been
  directly opened yet — confirm them the same way KS5's files were (see below), don't
  assume they mirror KS5's shape.
- **KS5 subject-and-qualification-results file** (grade distribution, institution-level):
  real header already confirmed via Guy's own local 2024/25 download
  (`institution_subject_and_qualification_results_202425_API.csv`, 686,396 rows):
  `time_period,time_identifier,geographic_level,country_code,country_name,version,old_la_code,new_la_code,la_name,school_name,school_urn,school_laestab,exam_cohort,qualification_detailed,qualification_level,a_level_equivelent_size,gcse_equivelent_size,grade_structure,subject,grade,entries_count`.
  A separate, real 2023/24 institution-level version of this same file is confirmed to
  exist live on EES (706,828 rows) but Guy hasn't downloaded it locally — fetch it fresh
  from EES and confirm its schema matches before assuming it does.
- **KS5 subject-and-qualification-value-added file** (institution-level): real header
  confirmed via Guy's local 2024/25 download
  (`institution_subject_and_qualification_value_added_202425_API.csv`, 101,979 rows):
  `...,exam_cohort,sublevno,qualification_detailed,a_level_equivelent_size,subject_code,subject,value_added,value_added_lower_ci,value_added_upper_ci,entries_count`
  — DfE's own computed subject-level value-added score with confidence intervals. This
  means vicdata does NOT need to (and structurally can't, from the grade-distribution file
  alone) derive its own Progress-8-style subject measure — just ingest what DfE already
  computed. **Check directly whether a 2023/24 equivalent value-added file exists** — this
  has not been confirmed either way; if EES only has this specific value-added file for
  2024/25, land one year honestly rather than assuming/forcing a second.
- **There is no KS4 equivalent of the subject-level value-added file.** KS4's own
  Progress 8 is a whole-school headline measure, not computed per-subject the way KS5's
  is — don't go hunting for a KS4 subject-value-added dataset that doesn't exist; this
  asymmetry between KS4 and KS5 is real, not a gap in last week's search.
- **DfE's own stated limitation, worth carrying into any write-up**: Progress 8 cannot be
  calculated for 2024/25 and 2025/26 due to COVID-era baseline gaps. Doesn't block this
  subject-level ingest directly (Progress 8 is a headline measure, out of scope here), but
  worth noting if it surfaces in any of the subject-level files' own metadata/caveats.

## Architecture: match what's actually live — CORRECTED, read this before starting

An earlier version of this brief (and the session that wrote it) had the wrong picture of
this repo's architecture — it described "direct purpose-built scripts, one per dataset,"
based on `vicdata_public/scripts/sync-roll-aggregates.ts`. That script lives in the
**other** repo (`vicdata_public`, the Next.js app) and is not this repo's pattern at all.
Confirmed directly against `vicdata`'s own real, live state before writing this correction
(62 real migrations, a real `run_ingest.py` CLI, real `ingest/sources/*.py` modules): this
repo runs the full registry architecture described in
`docs/vicdata_ingest_schema_and_build_plan_v2_3.md` (the current version — a `v2_2` also
exists in `docs/`, ignore it, `v2_3` is the one that matches the live schema), and it is
genuinely live, not a superseded plan: `source_registry`, `ingest_snapshots`,
`canonical_facts` (real, currently ~26.6M rows, per that doc's own §10 incident writeup),
`source_field_mappings`, `breakdown_taxonomy_versions`, `school_entities`,
`school_lineage`, `groups`/`group_membership` all exist as real tables with real data
behind them today.

**Build KS4/KS5 subject-level data as new sources inside this SAME real system** — do not
invent standalone tables or scripts outside it. The closest real precedent, read it before
writing anything: `ingest/sources/dfe_school_census.py` — another EES-sourced dataset, same
platform, same discover-then-download problem this brief's own earlier research already
solved for KS4/KS5 (dataset IDs, real column headers, real years — see below). Follow its
same two-phase shape: `ingest()` (fetch the real file, archive it raw, create an
`ingest_snapshots` row) and `promote()` (write the parsed rows into `canonical_facts` under
a persistent `source_id`, per year as a new snapshot — never a new `source_id` per release
year, per the schema doc's own "multi-year series continuity" rule, since Guy's own intent
is for next year's release to land as just another snapshot under the same source). Run via
`python run_ingest.py <source_id> [--promote]`, same as every other real source in this
repo. Register each new source properly in `source_registry` first (topic `academic`,
entity_keying `urn`, access_method `csv_download_variable_url` — matching
`dfe_school_census`'s own registration, since it's the same EES discover-then-download
mechanic) — check `docs/vicdata_academic_ingest_scoping_v1.md` too, it may already have
scoping notes relevant to exactly this that predate this brief.

Suggested `source_id`s (rename if a clearer real convention already exists in
`source_registry` — check what's there before inventing new naming):
`dfe_ks4_subject_entries`, `dfe_ks5_subject_results`, `dfe_ks5_subject_value_added`.

Build and test against **this repo's own local Supabase CLI stack** (`project_id =
"vicdata"`, confirmed distinct from `vicdata_public`'s own separate local stack — they are
NOT the same local database, don't assume a table that exists in one is visible from the
other). Do not touch the hosted/production Supabase project tonight. Do not modify any
existing table's data — new `source_registry`/`canonical_facts` ROWS for the new sources
are the expected way to add data to this system (that's what promote does), but don't
touch any other source's existing rows, and don't alter schema outside what a normal new
migration for these three sources requires.

Fetch fresh from EES directly for every file, discovered live the same way
`dfe_school_census.py` does it (no hardcoded dataset ID) — this naturally picks up 2023/24
AND 2024/25 for the two files that have both years.

## The group-reporting wrinkle — CORRECTED: use this repo's own school_lineage, not vicdata_public's consortium_members

The earlier version of this brief pointed at a `consortium_members` table — that table is
real, but it lives in `vicdata_public`'s own separate local database (confirmed: different
`project_id`, no migration for it exists anywhere in this repo), so it is NOT reachable
from this repo's own local Supabase stack. Don't chase it.

This repo has its own, better real answer already: `ingest/sources/gias_links.py` ingests
GIAS's real "Establishment links" bulk CSV directly into `school_lineage` — read that
module's own docstring, it documents the real `LinkType` distribution from a real
2026-08-27 pull (35,242 rows) and explicitly names "sixth-form-centre links" as one of the
real categories present, alongside Predecessor/Successor/merges/splits. This is the same
underlying GIAS data `vicdata_public`'s `consortium_members` table was separately built
from, just already live in the correct repo for this ingest.

**Use `school_lineage` for the consortium check.** For the KS5 subject-level files
specifically: confirm directly whether `school_urn` values in
`institution_subject_and_qualification_results`/`..._value_added` include known
sixth-form-consortium URNs — LaSWAP (132838, covering Acland Burghley/William Ellis/
Parliament Hill/La Sainte Union), PGW Partnership (134820), Harris Federation Post 16, and
any others `school_lineage`'s own sixth-form-centre-type rows surface — rather than (or in
addition to) their constituent schools' own URNs, and get a real count of how many real
schools this affects across the whole file, not just the named examples. If it does, land
the data under the REAL URN the file actually uses (the consortium's), and note in the
write-up that resolving "which schools does this consortium represent" at query/display
time is a job for `school_lineage`, not something to solve inside this ingest.

For KS4 subject-entries: check directly whether the same pattern applies (GCSE consortium
arrangements are much rarer than post-16 ones, so this may turn out clean) rather than
assuming either way.

## Process: investigate, then build only what's confirmed clean

For each of the three real datasets named above (KS4 subject-entries, KS5 subject-results,
KS5 subject-value-added):

1. Confirm the real current EES dataset ID/URL and re-verify the row counts/years quoted
   above directly (they were gathered across several sessions this week — re-confirm
   rather than trust blindly, the same discipline this project always applies to itself).
2. Open the real file and confirm its actual column headers before writing any parsing
   code — KS5's two files are already confirmed (quoted above); KS4's subject-entries file
   is NOT yet confirmed and must be opened directly first.
3. Run the consortium-URN check described above against the real file's actual
   `school_urn`/`school_laestab` values.
4. Confirm real coverage — how many distinct real open schools/institutions actually
   appear, and whether that's a sensible fraction of all real KS4/KS5-eligible schools
   nationally (a sanity check, not a hard bar).
5. If clean (confirmed schema, confirmed consortium handling, sensible coverage): write
   the sync script, run it for real against the local Supabase stack, land real rows for
   every real year that dataset has (both 2023/24 and 2024/25 where both exist).
6. If genuinely ambiguous (an unresolved structural question, a consortium pattern that
   doesn't fit the existing `school_lineage` cross-link model, missing coverage for a
   meaningful chunk of schools) — do not guess a resolution. Write it up with the same
   candidates-considered/trade-offs/recommendation structure used in
   `vicdata_fe_college_data_investigation_v1.md`, and leave it unbuilt for Guy to decide.

Land whichever of the three datasets come back clean. It's fine and honest if not all
three do.

## Deliverable for the morning

Same shape as every other build report this project uses:
- What was actually investigated for each of the three datasets — the real EES dataset
  ID/URL, real row counts, real years covered, real column schema (paste the actual header
  row), real coverage count of distinct schools/institutions.
- The real consortium-URN finding for both KS4 and KS5 — confirmed clean, or confirmed
  affected (with a real count and named examples), for each.
- What was actually built and ingested — table name(s), script name(s), real row counts
  per year, a few spot-checked real schools (name + URN) with their real subject-level
  figures, cross-checked against DfE's own public Compare School Performance site by URN
  where possible so the numbers are actually right, not just internally consistent.
- Anything left unbuilt and why, written up as real open questions with your own
  recommendation, not a bare "TODO."
- Confirm the sync scripts are genuinely re-runnable/idempotent (upsert, not
  append-and-duplicate) — this matters more than usual tonight since Guy's explicit intent
  is for these to run again automatically when next year's release lands.
- tsc/lint clean on whatever code was written.
- Confirm nothing was written to the hosted/production Supabase project, and no existing
  table (including `school_lineage` and any other source's rows in `canonical_facts`) was
  modified — only new rows for the new sources.

Do not start any front-end work even if the ingest finishes early — write up additional
findings instead (e.g. anything notable in the real subject-level data itself worth
knowing before that gets spec'd), clearly labelled as investigation-only, not a build.
