# VicData 0.8 — Group round 3: Academic, Pupils, and a school's group as a comparison set — report

Report for `docs/v0.8/vicdata_0_8_groups_round3_academic_pupils_sets_claude_code_prompt_v1.md`. Built overnight, 16 Oct 2026, in the worktree `~/dev/vicdata_public_groups`, on branch **`v0.8-groups-r3`**, branched from `v0.8-groups-r2` (which is based on `v0.8-audit-fixes` @ 4bfe5ec: the audit fixes stopped unmerged). **Not merged** (the overnight rule).

**The group figures are fixture data**, as in round 2. The ingest's group lookups aren't promoted yet, so the dashboards read the dry run through round 2's guarded switch, and their screenshots are marked `fixture-data`. Stage S (the group as a comparison set) reads only round 1's lookups, which are live, so its screenshots are real data.

## What was built

### A — Academic (`/teacher/group/academic`)
- **Column 1, "{Phase} results now":**
  - schools with results "of" schools in the phase, the rest listed with the reason;
  - the headlines (GCSE: Attainment 8 and grade 5+ English and maths; Post-16: A-level and all-qualification points; Primary: KS2), pupil-weighted with an "Average school" toggle, the comparison set and England beside them;
  - the group's place in its peer band, ties shared;
  - the group's lowest, median and highest school;
  - a value added line pointing to its own view.
- **The large view's rail:**
  - **Schools ranked** (the default): each school's headline, its rank in the group and nationally; IGCSE schools "not ranked at GCSE"; the group median, the comparison set, non-group schools and England beneath.
  - **Subject areas across the group:** points per entry by subject family against England, the gap drawn both ways, n per area (schools and entries), withheld below the audit-fixes minimum, the two widest gaps each way named. Described, not ranked.
  - **Value added**, its own panel: A-level VA for every school where published; Progress 8 for state schools (its last published year); independents "not published".
- **Row 2:** the results trend by phase against the set; the Post-16 trend (A-level points) against the set; "Change by school" (improved / steady / fell since 2022/23), with **Results by band** as a labelled placeholder in its rail.

### P — Pupils (`/teacher/group/pupils`)
- **Column 1:** the combined roll; roll by phase (pupils 5–10, 11–15, 16–18); Year 12 against Year 11 (SMT round 2's wording); day and boarding where the group has boarders; change, like for like and combined.
- **The large view's rail:**
  - **The group's shape** (by single year of age, this year against the first);
  - **Entry cohorts across schools** (each school's main entry point over time, read-only);
  - **Leaving at 16** (each sixth form's Year 12 against its Year 11 last year);
  - **Market share** (each school's share of its LA's places in its main phase: the default, labelled).
- **Row 2:** the roll indexed (like for like) against the set; **children around each school, projected** (per school, at its saved or default catchment: see below); schools growing and shrinking.

### S — A school's group as a comparison set (Teacher and SMT)
- **The chooser:** for a member school, its payload (`/api/teacher/saved-comparator-sets`) carries each of its groups as a read-only set, as Victoria Consultancy's are (`src/lib/groups/school-sets.ts`). The chooser shows them under **"Your groups"**: "All Dukes schools · Club ISS — 7 with Post-16 results · 25 in all". Choosing one switches it on: the same path a school's shared set takes, its schools as the set.
- **Ranks within the group:** with the group chosen, SMT's scorecard ranks the school among its group beside its region and England. At Radnor House: "2 of 8" on A-level points, "2 of 25" on roll. Teacher's rankings do the same within the set.
- **Phase filtering:** the count is the schools with that phase's headline; preps and IGCSE schools don't count at GCSE.
- **Sources:**
  - official groups offered automatically;
  - likely members included and labelled ("· likely" on the group, "n likely" in the count);
  - a self-declared group only for the school that made it (none exist; the path is tested with a fixture);
  - single-academy trusts never offered; one body under two records (Harris' MAT and sponsor) shown once.
- **A school in several groups** sees each as its own set.
- **A school in no group** gets no "Your groups" row, and its payload is byte-for-byte as before.
- **Not given the set:** Admissions (its "compared against" is the lead's saved rivals list, a market choice with writes) and the public page (no chooser). Both logged.

## Each panel: its lookup and n

| Panel | Lookup | n |
|---|---|---|
| Results now | `group_aggregate_lookup` (phase rows; peer places; excluded lists) + `group_comparison_lookup` (the set, England) | with results / in phase; the excluded list |
| Schools ranked | `group_schools_year_lookup` (each school's results and national ranks) + the comparison rows | schools shown / in phase; the set's n |
| Subject areas | `group_aggregate_lookup` (`subject_areas`) + `group_comparison_lookup` (England's, the set's) | schools and entries per area |
| Value added | `group_schools_year_lookup` (`value_added`) + the group's weighted VA | schools with VA; independents not published |
| Results trend, Post-16 trend | G2 phase rows + the set's | n per point |
| Change by school | `group_schools_year_lookup` | schools with both years |
| Pupils now, shape | G2 `all` row (`roll_by_age`, `roll_by_phase`, `boarders`, `change`) | schools by phase |
| Entry cohorts, leaving at 16 | `group_schools_year_lookup` (`roll_by_age` per year) | schools with a sixth form and a Year 11 |
| Market share | `group_schools_year_lookup` + G2 `share.las` (each LA's pupils) | each school |
| Children around each school | the ingest's `area_projection` (live), per school | schools located in England |
| The group as a set | round 1's `school_groups_lookup` / `group_schools_lookup` (live) + `rankFixedSets` | with results / in all |

## The parity pairs gained by stage S

Every pair that changes must be a member school gaining its set, and the default set must never change.

| Product | Pairs | Changed | Why |
|---|---|---|---|
| Teacher (`run_parity.sh`, round 3 against round 2) | 2,875 | **0** (2,875 identical; the first run's one difference was the harness's known Trend-map flake, and that case set rerun gave 576/576 identical) | the chooser is closed in every case; the default set doesn't change |
| SMT (Overview, Academic, Pupils, Context, the home; The Chase, Leighton Park; both themes; 1440 and 390; every rail view) | 312 | **0 in the DOM**; 13 PNGs differ by antialiasing only (max 1–2 of 255) | neither school's default set changes; the set is chosen in the chooser |
| Admissions (every view; 3 schools × entries × themes × widths) | 328 | **0** (identical, pixels and DOM) | Admissions doesn't read the chooser's payload |
| The chooser for a non-member school (Leighton Park) | 1 | **0** (pixel-identical to the base) | no "Your groups" row |

**Who gains a set** (the chooser payload, read live from round 1's lookups):
- in the parity matrices, only Sevenoaks School (118952): "All Governors of Sevenoaks School schools", 2 schools, GIAS (proprietor). It shows only when the chooser is opened;
- **three examples:**
  - Radnor House (137018): "All Dukes schools", 25 schools, Club ISS;
  - Harris Academy Battersea (140985): "All Harris Federation schools", 58 schools, GIAS (the MAT and its sponsor record shown once);
  - Sevenoaks School (118952), as above.
- The Chase (137625) is a single-academy trust: no set. Leighton Park (110110): no group.

## What's missing from the ingest

- **A group projection that counts each neighbourhood once:** an `area_projection` over several schools' catchments (the union of their LSOAs). Until then the projection is per school (R-GROUP-CATCHMENT-OVERLAP not built).
- **Market share against Admissions' rivals, per school, for a group:** it lives in each school's Admissions; the group shows LA share instead (labelled).
- **Results by band:** not built anywhere yet.
- **Entry points per school:** derived from the census ages here; the ingest holds none.
- Subject areas across the group were missing; the ingest round added them.

## Differences from the wireframes

- **The subject-area chips** (All areas · English · Maths …) on Academic aren't built: the areas are drawn together in the Subject areas view. The ingest's areas are VicData's subject families, not the wireframe's English / Maths / Sciences split.
- **Schools ranked** shows 12 schools in the panel and all in full screen (the wireframe: 9, scrolling).
- **"Spread across the group"** is a line in column 1, not a tile.
- **Pupils had no wireframe of its own:** it follows the shell and SMT Pupils.

## Rules

| Rule | Test | Result |
|---|---|---|
| R-GROUP-VA-SEPARATE: value added never in a results chart | `src/lib/groups/rules.test.ts` | pass |
| R-GROUP-IGCSE: IGCSE schools listed "not ranked at GCSE", never ranked or counted, at group level | same | pass |
| Subject areas: the audit-fixes minimum, n per area, the lookup's figures | same | pass |
| Year 12 against Year 11 adds up from the schools' rows; the shape is the lookup's | same | pass |
| R-GROUP-SET: members only; phase-filtered count; nothing for a school in no group | `src/lib/groups/school-sets.test.ts` | pass |
| R-GROUP-SET-SOURCES: likely labelled; self-declared only for its maker (fixture) | same | pass |
| R-GROUP-SET: the default set unchanged; non-members byte-identical | SMT and chooser parity (below) | see the checks |
| R-GROUP-CATCHMENT-OVERLAP | not built (per school instead; logged) | — |
| R-METHOD-PRESENT, every new view (28 group views in all) | `src/lib/groups/methods.test.ts` | pass |
| Round 2's rules | `src/lib/groups/rules.test.ts` | pass |

## Checks

| Check | Result |
|---|---|
| tsc | clean, apart from `LayoutProps`, which `next build` generates |
| eslint (changed files) | clean |
| next build | clean; no service key and no fixture flag in `.next/static` |
| Unit tests (every `src/**/*.test.ts` + `scripts/catalogue-unit-tests.ts`) | **488 / 488** |
| Group rules on fixtures (`src/lib/groups/*.test.ts`) | all pass (round 2's and round 3's) |
| Rule tests (`scripts/catalogue-rule-tests.ts`, production reads) | **96 pass, 0 fail.** The full run, while parity loaded the database, gave 91 and 5 statement timeouts; all 5 pass alone |
| RLS (PGlite) | no new migration in this round; round 2's results stand |
| Teacher parity (round 3 against round 2) | **2,875 / 2,875 identical** (one case set rerun for the known map flake); public page SSR identical (137625, 117037) |
| Admissions parity (base against round 3) | **328 / 328 identical**, pixels and DOM |
| SMT parity (base against round 3) | **312 pairs: DOM identical in all 156; 299 PNGs identical, 13 antialiasing noise** (max 1–2 of 255) |
| Non-member chooser (Leighton Park) | pixel-identical to the base |

The `src/` diff of `v0.8-groups-r3` against `v0.8-groups-r2` is byte-identical to the one these checks ran on. The checks ran on a checkout of the same commits before the branch moved onto `v0.8-audit-fixes`.

## Screenshots (`docs/v0.8/groups_r3_screenshots/`)

- **The dashboards, real data** (retaken 16 Oct on production's lookups, after the promote and both merges; they replace the overnight fixture-data shots):
  - Harris Academic (Secondary) and Pupils;
  - Dukes Academic (Post-16) and Pupils;
  - both themes, 1440 and 390: `{harris_academic_secondary,harris_pupils_all,dukes_academic_post16,dukes_pupils_all}_{dark,light}_{1440,390}.png`.
- **Real data (round 1's lookups, live):**
  - a Dukes school's SMT with "All Dukes schools" chosen (`dukes_school_smt_all_dukes_schools_dark.png`, Radnor House);
  - the chooser's "Your groups" (`dukes_school_chooser_your_groups_dark.png`);
  - a Harris academy's SMT rank line (`harris_academy_smt_rank_line_dark.png`, Harris Academy Battersea);
  - a non-member school's chooser, unchanged (`non_member_chooser_unchanged_dark.png`, Leighton Park, pixel-identical to the base).
- **Not taken:** a Dukes school's *Teacher* view with the group chosen. Teacher uses the same chooser and the same saved-set path; take it live after the merge.

## Logged calls

Under "2026-10-16 — 0.8 groups r3" in `docs/OPEN_QUESTIONS.md`, all "decided overnight, for Guy to confirm", **including the open decision:** rank groups only against groups of the same type (built), or also offer a mixed comparison with a label?

## 16 Oct, after the run

Two commits on `v0.8-groups-r3`, after `3258c7f`:

- **`384686a`: comparison rows read by their full key.** `group_comparison_lookup` returns its rows in no fixed order, and the app already read them by key (kind, variant, reading; then period and phase). R-GROUP-KEYS now proves it:
  - each key (kind, variant, phase, reading, period) is unique;
  - Overview, Academic and Pupils are byte-identical with the comparison and aggregate rows reversed or shuffled two ways, for every compare choice and phase.
  - A planted positional read fails it. Sets with the same label now sort by key.
- **`b4ab21a`: mix-matched is non-group schools only (Guy's decision, OPEN_QUESTIONS r3 item 15).**
  - Labelled "Non-group schools, same regions and phases as {group}"; still the default set when mix-matched is chosen.
  - `mix_matched:england` is never offered: it duplicates `areas:region` by construction (the same region cells, the same weights). The areas set keeps its own label.
  - R-GROUP-SETS-DISTINCT checks that no two offered sets have identical figures in every year of any phase (both readings, Harris and Dukes); it fails when `mix_matched:england` is offered again.

**Production, after the promote:**
- every R-GROUP test passes with the switch off (13);
- the comparison lookups match the fixtures value for value. Every key is present on both sides. The only differences are row order and `0` printed as `0.0`. The ingest's `verify` reports both comparison calls as "DIFFERS" because it compares by position.

**For the ingest:**
- an `ORDER BY` in `group_comparison_lookup`;
- `verify` comparing rows by key and numbers by value;
- optionally, no longer computing `mix_matched_england`.

**Checks on `b4ab21a`, against `3258c7f`:**

| Check | Result |
|---|---|
| tsc, eslint, `next build` | clean; no fixture flag or service key in `.next/static` |
| Unit tests (every `src/**/*.test.ts` + `scripts/catalogue-unit-tests.ts`) | **491 / 491** |
| R-GROUP on production (switch off) | **13 / 13** |
| Rule tests (`scripts/catalogue-rule-tests.ts`, production) | **96 pass, 0 fail** |
| PGlite (`supabase/tests/*.mjs`) | all pass except `v08_subject_latest_names_pglite.mjs` (31 vs 47). It fails on `main` too: `c65acfd` (15 Oct) grew the app's map without updating the test's inlined copy. Not this round's |
| Teacher parity | 2,875 pairs: 2,873 identical, 1 noise, 1 unexpected (`rk-117037-reg-astara` Column 2 bar chart). The case set rerun gave that pair identical, and its one difference was the known `rk-137625-nat-pending` Trends map flake. The import graph's only changed module is `notes.ts` (the mix-matched note, not drawn in Teacher). Public page SSR identical |
| Admissions parity | **328 / 328 identical**, pixels and DOM |
| SMT parity | **156 / 156 DOM identical**; 308 of 312 PNGs identical, 4 antialiasing noise (max 1–2 of 255) |

The Admissions and SMT bundles of the two commits differ only in the `mixMatched` note string.

## 16 Oct: rebased onto `main` after the audit fixes merged

- **The rebase:** `v0.8-groups-r2` onto `main` @ `66c6a4d`, then `v0.8-groups-r3` onto it. The one conflict was `docs/OPEN_QUESTIONS.md`: main's "After the stop" notes are kept, then the groups sections. The `src/`, `supabase/` and `scripts/` diffs are byte-identical to before the rebase.
- **Separate commit:** `supabase/tests/v08_subject_latest_names_pglite.mjs` checks the migration's map against the app's, less the 16 KS5 rows `c65acfd` added without a migration. It had failed on `main` since then (31 vs 47). A GCSE row planted in the app's map still fails it.
- **Fixtures refreshed from the ingest (vicdata `8e17f2c`):**
  - each group's comparisons are 392 rows, not 448: only the `mix_matched:england` rows went, and every other row is the same by key and value;
  - in the aggregate files only `computed_at` changed.
- **Production after Guy's re-promote:**
  - the comparisons match the fixtures by key and value, now in the same order;
  - the aggregates match in every figure (only the build's metadata differs).

**Checks, with the fixture switch off:**

| Check | r2 alone | r3 |
|---|---|---|
| tsc, eslint, `next build` (no fixture flag or service key in `.next/static`) | clean | clean |
| Unit tests | 477 / 477 | 483 / 483 |
| R-GROUP on production | 6 / 6 | 13 / 13 (and 13 / 13 on the refreshed fixtures) |
| Rule tests on production | — | **97 pass, 0 fail** |
| PGlite, `supabase/tests/*.mjs` | — | **16 / 16** |
| Teacher parity against `main` | — | 2,875 pairs: 2,872 identical, 2 noise, 1 unexpected (the known `rk-137625-nat-pending` Trends map flake). Its case set rerun: 228 identical, 1 noise, 0 unexpected. Public page SSR identical |
| Admissions parity against `main` | — | **328 / 328 identical** |
| SMT parity against `main` | — | **DOM 156 / 156 identical**; 11 PNGs differ by antialiasing only (max 1 of 255) |
